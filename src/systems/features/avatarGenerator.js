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
import { extensionSettings, sessionAvatarPrompts, setSessionAvatarPrompt } from '../../core/state.js';
import { saveSettings } from '../../core/persistence.js';
import { generateAvatarPromptGenerationPrompt } from '../generation/promptBuilder.js';
import { getCurrentPresetName, switchToPreset, generateWithExternalAPI } from '../generation/apiClient.js';

// Generation state - tracks characters currently being generated
const pendingGenerations = new Set();


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

    try {
        // Generate images one at a time, generating prompt on demand
        for (const characterName of needsGeneration) {
            // Skip if somehow already has avatar now
            if (hasExistingAvatar(characterName)) {
                pendingGenerations.delete(characterName);
                continue;
            }

            // Generate LLM prompt for this character
            const prompt = await generateAvatarPrompt(characterName);

            // Generate the image using the prompt
            await generateSingleAvatar(characterName, prompt);

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

    // Clear existing avatar
    if (extensionSettings.npcAvatars && extensionSettings.npcAvatars[characterName]) {
        delete extensionSettings.npcAvatars[characterName];
        saveSettings();
    }

    // Clear existing prompt cache
    if (sessionAvatarPrompts[characterName]) {
        delete sessionAvatarPrompts[characterName];
    }

    try {
        // Generate new LLM prompt
        const prompt = await generateAvatarPrompt(characterName);

        // Generate the avatar
        return await generateSingleAvatar(characterName, prompt);
    } finally {
        // Remove from pending when done
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
            const prompt = response.trim();
            // console.log(`[RPG Avatar] Generated prompt for ${characterName}:`, prompt);

            // Store prompt in session storage
            setSessionAvatarPrompt(characterName, prompt);
            return prompt;
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
 * Generates a single avatar using the /sd command
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
