/**
 * Avatar Generator Module
 * Handles automatic and manual avatar generation for NPC characters
 *
 * Features:
 * - Batch generation with awaitable completion
 * - Batch prompt generation via LLM
 * - Individual image generation via /sd command
 * - Manual regeneration support
 */

import { characters, this_chid } from '../../../../../../../script.js';
import { safeGenerateRaw } from '../../utils/responseExtractor.js';
import { executeSlashCommandsOnChatInput } from '../../../../../../../scripts/slash-commands.js';
import { selected_group, getGroupMembers } from '../../../../../../group-chats.js';
import { extensionSettings, sessionAvatarPrompts, setSessionAvatarPrompt, setSessionAvatarPhysical, setSessionAvatarClothing } from '../../core/state.js';
import { saveSettings } from '../../core/persistence.js';
import { generateAvatarPromptGenerationPrompt } from '../generation/promptBuilder.js';
import { getCurrentPresetName, switchToPreset, generateWithExternalAPI } from '../generation/apiClient.js';
import { generateSpriteWithComfyUI, saveImageToST } from './comfyUIClient.js';
import { isBackgroundWorkerAvailable, runAvatarPipelineInBackground } from '../../utils/backgroundWorker.js';

// Generation state - tracks characters currently being generated
const pendingGenerations = new Set();

// Main expressions to generate (subset of ST's full expression list)
const MAIN_EXPRESSIONS = ['neutral', 'happy', 'sad', 'angry', 'surprised'];

const EXPRESSION_MODIFIERS = {
    neutral: 'neutral expression, calm, composed face',
    happy: 'happy smiling expression, joyful, cheerful',
    sad: 'sad expression, sorrowful, downcast eyes',
    angry: 'angry expression, furious, furrowed brow, intense',
    surprised: 'surprised expression, wide eyes, shocked, open mouth',
};


/**
 * Checks if a character is pending generation (waiting or actively generating)
 * @param {string} characterName - Name of character to check
 * @returns {boolean} True if generation is pending
 */
export function isGenerating(characterName) {
    return pendingGenerations.has(characterName);
}

/**
 * Checks if any avatars are currently being generated
 * @returns {boolean} True if any generation is in progress
 */
export function isAnyGenerating() {
    return pendingGenerations.size > 0;
}

/**
 * Gets all characters currently pending generation
 * @returns {string[]} Array of character names
 */
export function getPendingGenerations() {
    return [...pendingGenerations];
}

/**
 * Helper to check if two character names match (case-insensitive, handles partial matches)
 * @param {string} cardName - Name from character card
 * @param {string} aiName - Name from AI response
 * @returns {boolean} True if names match
 */
function namesMatch(cardName, aiName) {
    if (!cardName || !aiName) return false;
    const cardLower = cardName.toLowerCase().trim();
    const aiLower = aiName.toLowerCase().trim();
    if (cardLower === aiLower) return true;
    const cardCore = cardLower.split(/[\s,'"]+/)[0];
    const aiCore = aiLower.split(/[\s,'"]+/)[0];
    if (cardCore === aiCore) return true;
    const escapedCardCore = cardCore.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const wordBoundary = new RegExp(`\\b${escapedCardCore}\\b`);
    return wordBoundary.test(aiCore);
}

/**
 * Checks if a character already has an avatar (custom NPC avatar or from character card)
 * @param {string} characterName - Name of character to check
 * @returns {boolean} True if character has an avatar
 */
export function hasExistingAvatar(characterName) {
    // Check for custom NPC avatar first
    if (extensionSettings.npcAvatars && extensionSettings.npcAvatars[characterName]) {
        const avatar = extensionSettings.npcAvatars[characterName];
        if (typeof avatar === 'string' && avatar) {
            return true;
        }
    }

    // Check group members for avatar
    if (selected_group) {
        try {
            const groupMembers = getGroupMembers(selected_group);
            if (groupMembers && groupMembers.length > 0) {
                const matchingMember = groupMembers.find(member =>
                    member && member.name && namesMatch(member.name, characterName)
                );
                if (matchingMember && matchingMember.avatar && matchingMember.avatar !== 'none') {
                    return true;
                }
            }
        } catch (e) {
            // Ignore errors
        }
    }

    // Check all characters for avatar
    if (characters && characters.length > 0) {
        const matchingCharacter = characters.find(c =>
            c && c.name && namesMatch(c.name, characterName)
        );
        if (matchingCharacter && matchingCharacter.avatar && matchingCharacter.avatar !== 'none') {
            return true;
        }
    }

    // Check current character in 1-on-1 chat
    if (this_chid !== undefined && characters[this_chid] &&
        characters[this_chid].name && namesMatch(characters[this_chid].name, characterName)) {
        if (characters[this_chid].avatar && characters[this_chid].avatar !== 'none') {
            return true;
        }
    }

    return false;
}

// Shared folder name sanitizer (must match npcSpriteDisplay.js toFolderName)
function toFolderName(characterName) {
    return characterName.replace(/[^a-zA-Z0-9 _-]/g, '').trim().replace(/ /g, '_');
}

/**
 * Runs a full avatar + expression pipeline for one character via the background worker.
 * Loads the ComfyUI API workflow, builds LLM messages, and submits a single pipeline job.
 * When the job completes, stores the avatar URL and expression paths in extension settings.
 *
 * @param {string} characterName
 */
async function generateSingleAvatarViaWorker(characterName) {
    try {
        // Load API workflow (same URL as comfyUIClient.js uses)
        const workflowUrl = '/scripts/extensions/third-party/rpg-companion-sillytavern/workflows/sprite_generator_v1.2_api.json';
        const workflowResp = await fetch(workflowUrl);
        if (!workflowResp.ok) throw new Error(`Failed to load ComfyUI workflow (${workflowResp.status})`);
        const apiWorkflow = await workflowResp.json();

        // Build LLM messages for the avatar prompt
        const llmMessages = await generateAvatarPromptGenerationPrompt(characterName);

        const mode = extensionSettings.generationMode;
        const { baseUrl, model, maxTokens, temperature } = extensionSettings.externalApiSettings || {};
        const apiKey = localStorage.getItem('rpg_companion_external_api_key');

        const folderName = toFolderName(characterName);
        
        let preGeneratedResponse = null;
        if (mode !== 'external') {
            preGeneratedResponse = await safeGenerateRaw({ prompt: llmMessages, quietToLoud: false });
        }

        const result = await runAvatarPipelineInBackground({
            characterName,
            folderName,
            llmMessages,
            preGeneratedResponse,
            mode: mode === 'external' ? 'external' : 'st',
            apiConfig: { baseUrl, model, maxTokens, temperature, apiKey },
            imageConfig: {
                comfyUrl: (extensionSettings.comfyUIUrl || 'http://127.0.0.1:8188').replace(/\/$/, ''),
                apiWorkflow,
                characterDescriptionNodeId: '487',
                removeSpriteBg: extensionSettings.removeSpriteBg !== false,
            },
            expressionConfig: extensionSettings.autoGenerateExpressions && !hasExistingExpressions(characterName) ? {
                enabled: true,
                expressions: MAIN_EXPRESSIONS,
                modifiers: EXPRESSION_MODIFIERS,
            } : { enabled: false },
        });

        // Apply results to settings
        if (result.imagePath) {
            if (!extensionSettings.npcAvatars) extensionSettings.npcAvatars = {};
            extensionSettings.npcAvatars[characterName] = result.imagePath;
            setSessionAvatarPrompt(characterName, result.avatarPrompt);
        }

        if (result.expressionPaths && Object.keys(result.expressionPaths).length > 0) {
            if (!extensionSettings.npcExpressionsGenerated) extensionSettings.npcExpressionsGenerated = {};
            extensionSettings.npcExpressionsGenerated[characterName] = true;
        }

        saveSettings();
        console.log(`[RPG Avatar] Background worker completed avatar pipeline for ${characterName}`);
    } catch (err) {
        console.error(`[RPG Avatar] Background worker pipeline failed for ${characterName}:`, err.message);
    }
}

/**
 * Generates avatars for multiple characters and waits for all to complete.
 * This is the main entry point for auto-generation within a workflow.
 *
 * @param {string[]} characterNames - Array of character names to generate avatars for
 * @param {Function} onStarted - Optional callback when generation starts (to update UI)
 * @returns {Promise<void>} Resolves when all generations complete
 */
export async function generateAvatarsForCharacters(characterNames, onStarted = null) {
    if (!extensionSettings.autoGenerateAvatars) {
        return;
    }

    // Filter to characters that need avatars
    const needsGeneration = characterNames.filter(name => {
        // Skip if already pending
        if (pendingGenerations.has(name)) {
            return false;
        }
        // Skip if has avatar
        if (hasExistingAvatar(name)) {
            return false;
        }
        return true;
    });

    if (needsGeneration.length === 0) {
        return;
    }

    // console.log('[RPG Avatar] Starting batch generation for:', needsGeneration);

    // Mark all as pending IMMEDIATELY (before any async work)
    for (const name of needsGeneration) {
        pendingGenerations.add(name);
    }

    // Trigger UI update to show loading spinners
    if (onStarted) {
        try {
            onStarted([...needsGeneration]);
        } catch (e) {
            console.error('[RPG Avatar] Error in onStarted callback:', e);
        }
    }

    // Check once whether we can offload to the background worker
    const useBackgroundWorker = extensionSettings.useComfyUISpriteWorkflow
        && (extensionSettings.generationMode === 'external' || extensionSettings.generationMode === 'separate')
        && await isBackgroundWorkerAvailable();

    try {
        // Generate images one at a time, generating prompt on demand
        for (const characterName of needsGeneration) {
            // Skip if somehow already has avatar now
            if (hasExistingAvatar(characterName)) {
                pendingGenerations.delete(characterName);
                continue;
            }

            if (useBackgroundWorker) {
                await generateSingleAvatarViaWorker(characterName);
            } else {
                // Generate LLM prompt for this character
                const prompt = await generateAvatarPrompt(characterName);

                // Generate the image using the prompt
                await generateSingleAvatar(characterName, prompt);

                // Generate expressions if enabled (uses the same base prompt)
                await generateExpressionsForCharacter(characterName, prompt || sessionAvatarPrompts[characterName]);
            }

            pendingGenerations.delete(characterName);

            // Small delay between generations to avoid overwhelming the API
            if (needsGeneration.indexOf(characterName) < needsGeneration.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
    } finally {
        // Ensure all are removed from pending even if there's an error
        for (const name of needsGeneration) {
            pendingGenerations.delete(name);
        }
    }

    // console.log('[RPG Avatar] Batch generation complete');
}

/**
 * Regenerates avatar for a specific character
 * Clears existing avatar and prompt, then generates new ones
 * Handles preset switching if useSeparatePreset is enabled
 *
 * @param {string} characterName - Name of character to regenerate
 * @returns {Promise<string|null>} New avatar URL or null if failed
 */
export async function regenerateAvatar(characterName) {
    // console.log('[RPG Avatar] Regenerating avatar for:', characterName);

    // Mark as pending immediately
    pendingGenerations.add(characterName);

    // Clear existing avatar and prompt cache so the pipeline generates fresh ones
    if (extensionSettings.npcAvatars?.[characterName]) {
        delete extensionSettings.npcAvatars[characterName];
        saveSettings();
    }
    if (sessionAvatarPrompts[characterName]) {
        delete sessionAvatarPrompts[characterName];
    }

    try {
        // Route through background worker when ComfyUI is enabled so the generation
        // survives browser closes (the worker calls ComfyUI directly, bypassing the
        // ST proxy that would interrupt ComfyUI on socket close).
        if (extensionSettings.useComfyUISpriteWorkflow && await isBackgroundWorkerAvailable()) {
            await generateSingleAvatarViaWorker(characterName);
            return extensionSettings.npcAvatars?.[characterName] ?? null;
        }

        // Fallback: client-side path (A1111 / worker unavailable)
        const prompt = await generateAvatarPrompt(characterName);
        return await generateSingleAvatar(characterName, prompt);
    } finally {
        pendingGenerations.delete(characterName);
    }
}

/**
 * Generates an LLM prompt for a single character
 *
 * @param {string} characterName - Name of character
 * @returns {Promise<string|null>} Generated prompt or null if failed
 */
async function generateAvatarPrompt(characterName) {
    // Check cache first if not forcing regeneration
    if (sessionAvatarPrompts[characterName]) {
        return sessionAvatarPrompts[characterName];
    }

    try {
        // console.log('[RPG Avatar] Generating LLM prompt for:', characterName);

        const promptMessages = await generateAvatarPromptGenerationPrompt(characterName);
        let response;

        if (extensionSettings.generationMode === 'external') {
            // console.log('[RPG Avatar] Using external API for avatar prompt generation');
            response = await generateWithExternalAPI(promptMessages);
        } else {
            response = await safeGenerateRaw({
                prompt: promptMessages,
                quietToLoud: false
            });
        }

        if (response) {
            const text = response.trim();

            // Parse structured PHYSICAL: / CLOTHING: output
            const physicalMatch = text.match(/^PHYSICAL:\s*(.+)$/m);
            const clothingMatch = text.match(/^CLOTHING:\s*(.+)$/m);

            if (physicalMatch && clothingMatch) {
                const physical = physicalMatch[1].trim();
                const clothing = clothingMatch[1].trim();
                setSessionAvatarPhysical(characterName, physical);
                setSessionAvatarClothing(characterName, clothing);
                const prompt = `${physical}, ${clothing}`;
                setSessionAvatarPrompt(characterName, prompt);
                return prompt;
            }

            // Fallback: treat whole response as prompt (e.g. custom instruction without structured output)
            setSessionAvatarPrompt(characterName, text);
            return text;
        }
    } catch (error) {
        console.error(`[RPG Avatar] Failed to generate LLM prompt for ${characterName}:`, error);
    }
    return null;
}

/**
 * Builds a fallback prompt when LLM prompt generation fails or isn't available
 * Uses information embedded in the character name if present (e.g., from malformed tracker output)
 *
 * @param {string} characterName - Character name (may contain additional details)
 * @returns {string} A basic prompt for image generation
 */
function buildFallbackPrompt(characterName) {
    // Check if the name contains embedded details (malformed format from weaker models)
    // e.g., "Eris Details: 🌟 | beautiful girl with white hair | kind expression"
    if (characterName.includes('Details:') || characterName.includes('|')) {
        // Extract useful description parts
        const parts = characterName.split(/Details:|[|]/).map(p => p.trim()).filter(p => p && !p.match(/^[\p{Emoji}]+$/u));
        if (parts.length > 1) {
            // First part is likely the name, rest are descriptions
            const name = parts[0];
            const descriptions = parts.slice(1).join(', ');
            return `portrait of ${name}, ${descriptions}, fantasy art style, detailed`;
        }
    }

    // Simple fallback - just use the name
    return `portrait of ${characterName}, character portrait, fantasy art style, detailed face, high quality`;
}

/**
 * Checks if a character already has expressions generated
 * @param {string} characterName - Name of character to check
 * @returns {boolean} True if expressions have been generated
 */
function hasExistingExpressions(characterName) {
    return !!(extensionSettings.npcExpressionsGenerated && extensionSettings.npcExpressionsGenerated[characterName]);
}

/**
 * Generates main expression sprites for a character and uploads them via /expression-upload.
 * Saves to the character's sprite folder so ST's expression system can use them.
 *
 * @param {string} characterName - Name of character
 * @param {string} basePrompt - The SD prompt describing the character's appearance
 * @returns {Promise<void>}
 */
async function generateExpressionsForCharacter(characterName, basePrompt) {
    if (!extensionSettings.autoGenerateExpressions) return;
    if (hasExistingExpressions(characterName)) return;
    if (!basePrompt) return;

    // Dispatch to ComfyUI workflow if the setting is enabled
    if (extensionSettings.useComfyUISpriteWorkflow) {
        return await generateExpressionsForCharacterComfyUI(characterName, basePrompt);
    }

    // Sanitize folder name: strip non-alphanumeric (except spaces/hyphens), then replace spaces
    // with underscores so the name is safe as a slash-command argument.
    const folderName = characterName
        .replace(/[^a-zA-Z0-9 _-]/g, '')
        .trim()
        .replace(/ /g, '_');
    if (!folderName) return;

    let uploadedCount = 0;

    for (const expression of MAIN_EXPRESSIONS) {
        const modifier = EXPRESSION_MODIFIERS[expression];
        const expressionPrompt = `${basePrompt}, ${modifier}`;

        try {
            const sdResult = await executeSlashCommandsOnChatInput(
                `/sd quiet=true ${expressionPrompt}`,
                { clearChatInput: false }
            );

            const imageUrl = extractImageUrl(sdResult);
            if (imageUrl) {
                // Percent-encode spaces in the URL so the slash-command parser
                // doesn't split the path on spaces (e.g. "/user/images/Game Master/...")
                const safeUrl = imageUrl.replace(/ /g, '%20');
                await executeSlashCommandsOnChatInput(
                    `/expression-upload label=${expression} folder=${folderName} ${safeUrl}`,
                    { clearChatInput: false }
                );
                uploadedCount++;
            } else {
                console.warn(`[RPG Avatar] No image URL from /sd for ${characterName}/${expression}`, sdResult);
            }
        } catch (error) {
            console.error(`[RPG Avatar] Expression generation failed for ${characterName}/${expression}:`, error);
        }

        // Small delay between generations
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Only mark as done if at least one expression was actually uploaded —
    // so that a completely failed run doesn't permanently block retries.
    if (uploadedCount > 0) {
        if (!extensionSettings.npcExpressionsGenerated) {
            extensionSettings.npcExpressionsGenerated = {};
        }
        extensionSettings.npcExpressionsGenerated[characterName] = true;
        saveSettings();
    }
}

/**
 * Generates a single avatar via the ComfyUI Sprite Generator workflow.
 *
 * @param {string} characterName
 * @param {string} prompt - SD prompt describing the character
 * @returns {Promise<string|null>} Avatar URL or null if failed
 */
async function generateSingleAvatarComfyUI(characterName, prompt) {
    try {
        const { format, data } = await generateSpriteWithComfyUI(prompt);
        const filename = `avatar_${Date.now()}`;
        const imagePath = await saveImageToST(data, format, characterName, filename);
        if (imagePath) {
            if (!extensionSettings.npcAvatars) extensionSettings.npcAvatars = {};
            extensionSettings.npcAvatars[characterName] = imagePath;
            saveSettings();
            return imagePath;
        }
        console.warn(`[RPG ComfyUI] No image path returned for ${characterName}`);
    } catch (error) {
        console.error(`[RPG ComfyUI] Avatar generation failed for ${characterName}:`, error);
    }
    return null;
}

/**
 * Generates expression sprites via ComfyUI and uploads them via /expression-upload.
 *
 * @param {string} characterName
 * @param {string} basePrompt
 * @returns {Promise<void>}
 */
async function generateExpressionsForCharacterComfyUI(characterName, basePrompt) {
    if (!extensionSettings.autoGenerateExpressions) return;
    if (hasExistingExpressions(characterName)) return;
    if (!basePrompt) return;

    const folderName = characterName
        .replace(/[^a-zA-Z0-9 _-]/g, '')
        .trim()
        .replace(/ /g, '_');
    if (!folderName) return;

    let uploadedCount = 0;

    for (const expression of MAIN_EXPRESSIONS) {
        const modifier = EXPRESSION_MODIFIERS[expression];
        const expressionPrompt = `${basePrompt}, ${modifier}`;

        try {
            const { format, data } = await generateSpriteWithComfyUI(expressionPrompt);
            const filename = `${expression}_${Date.now()}`;
            const imagePath = await saveImageToST(data, format, characterName, filename);

            if (imagePath) {
                const safeUrl = imagePath.replace(/ /g, '%20');
                await executeSlashCommandsOnChatInput(
                    `/expression-upload label=${expression} folder=${folderName} ${safeUrl}`,
                    { clearChatInput: false }
                );
                uploadedCount++;
            } else {
                console.warn(`[RPG ComfyUI] No image path for ${characterName}/${expression}`);
            }
        } catch (error) {
            console.error(`[RPG ComfyUI] Expression generation failed for ${characterName}/${expression}:`, error);
        }

        await new Promise(resolve => setTimeout(resolve, 500));
    }

    if (uploadedCount > 0) {
        if (!extensionSettings.npcExpressionsGenerated) extensionSettings.npcExpressionsGenerated = {};
        extensionSettings.npcExpressionsGenerated[characterName] = true;
        saveSettings();
    }
}

/**
 * Generates a single avatar using the /sd command (or ComfyUI if enabled)
 *
 * @param {string} characterName - Name of character to generate avatar for
 * @param {string|null} prompt - The prompt to use (optional, will fallback if null)
 * @returns {Promise<string|null>} Avatar URL or null if failed
 */
async function generateSingleAvatar(characterName, prompt = null) {
    // Use provided prompt, or check cache, or build fallback
    if (!prompt) {
        prompt = sessionAvatarPrompts[characterName];
    }

    if (!prompt) {
        // console.log(`[RPG Avatar] No LLM prompt for ${characterName}, using fallback prompt`);
        prompt = buildFallbackPrompt(characterName);
    }

    // Dispatch to ComfyUI workflow if the setting is enabled
    if (extensionSettings.useComfyUISpriteWorkflow) {
        return await generateSingleAvatarComfyUI(characterName, prompt);
    }

    // console.log(`[RPG Avatar] Starting image generation for: ${characterName}`);

    try {
        // Execute /sd command with quiet=true to suppress chat output
        const result = await executeSlashCommandsOnChatInput(
            `/sd quiet=true ${prompt}`,
            { clearChatInput: false }
        );

        // Extract image URL from result
        const imageUrl = extractImageUrl(result);

        if (imageUrl) {
            // Store the avatar
            if (!extensionSettings.npcAvatars) {
                extensionSettings.npcAvatars = {};
            }
            extensionSettings.npcAvatars[characterName] = imageUrl;
            saveSettings();

            // console.log(`[RPG Avatar] Successfully generated avatar for: ${characterName}`);
            return imageUrl;
        } else {
            console.warn(`[RPG Avatar] Failed to extract image URL for ${characterName}:`, result);
            return null;
        }
    } catch (error) {
        console.error(`[RPG Avatar] Generation failed for ${characterName}:`, error);
        return null;
    }
}

/**
 * Extracts image URL from /sd command result
 * Handles various result formats
 *
 * @param {any} result - Result from executeSlashCommandsOnChatInput
 * @returns {string|null} Image URL or null
 */
function extractImageUrl(result) {
    if (!result) return null;

    // Handle string result
    if (typeof result === 'string') {
        // Validate it looks like a URL or data URI
        if (result.startsWith('http') || result.startsWith('data:') || result.startsWith('/')) {
            return result;
        }
        return null;
    }

    // Handle object result with various possible properties
    if (typeof result === 'object') {
        // Try common properties
        const url = result.pipe || result.output || result.image || result.url || result.result;

        if (url && typeof url === 'string') {
            if (url.startsWith('http') || url.startsWith('data:') || url.startsWith('/')) {
                return url;
            }
        }
    }

    return null;
}

/**
 * Clears all pending generations and resets state
 */
export function clearPendingGenerations() {
    pendingGenerations.clear();
}

/**
 * Gets the current generation status for display
 * @returns {{pending: number, names: string[]}}
 */
export function getGenerationStatus() {
    return {
        pending: pendingGenerations.size,
        names: [...pendingGenerations]
    };
}
