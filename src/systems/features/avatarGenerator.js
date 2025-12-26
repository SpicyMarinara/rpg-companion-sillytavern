/**
 * Avatar Generator Module
 * Handles automatic avatar generation for characters without images
 */

import { executeSlashCommandsOnChatInput } from '../../../../../../../scripts/slash-commands.js';
import { extensionSettings } from '../../core/state.js';
import { saveSettings } from '../../core/persistence.js';

// Track pending avatar generations to avoid duplicate requests
const pendingGenerations = new Set();

/**
 * Style presets for avatar generation prompts
 */
const STYLE_PRESETS = {
    'auto': 'portrait, fantasy character, RPG style',
    'fantasy': 'portrait, fantasy character, medieval RPG style, detailed face',
    'scifi': 'portrait, sci-fi character, futuristic, cyberpunk style, detailed face',
    'anime': 'portrait, anime character, manga style, detailed face',
    'realistic': 'portrait, realistic character, detailed face, photorealistic'
};

/**
 * Builds the generation prompt for a character
 * @param {string} characterName - Name of the character
 * @returns {string} Full prompt for /sd command
 */
function buildGenerationPrompt(characterName) {
    const style = STYLE_PRESETS[extensionSettings.avatarGenerationStyle] || STYLE_PRESETS.auto;
    const custom = extensionSettings.avatarGenerationPrompt || '';
    return `${style}, ${characterName}, ${custom}`.trim();
}

/**
 * Generates an avatar for a character using /sd command
 * @param {string} characterName - Name of the character to generate avatar for
 * @returns {Promise<string|null>} Avatar URL or null if failed
 */
export async function generateAvatar(characterName) {
    // Skip if already generating
    if (pendingGenerations.has(characterName)) {
        console.log(`[RPG Avatar] Already generating avatar for: ${characterName}`);
        return null;
    }

    // Skip if disabled
    if (!extensionSettings.autoGenerateAvatars) {
        return null;
    }

    // Skip if custom avatar already exists
    if (extensionSettings.npcAvatars && extensionSettings.npcAvatars[characterName]) {
        return null;
    }

    pendingGenerations.add(characterName);
    console.log(`[RPG Avatar] Starting generation for: ${characterName}`);

    try {
        const prompt = buildGenerationPrompt(characterName);

        // Execute /sd command with quiet=true
        // This saves to gallery without posting to chat
        const result = await executeSlashCommandsOnChatInput(
            `/sd ${prompt} quiet=true`,
            { clearChatInput: false }
        );

        // The result might be an object with various properties
        // We need to extract the actual image URL if available
        let imageUrl = null;

        if (result) {
            // Handle different result formats
            if (typeof result === 'string') {
                imageUrl = result;
            } else if (result.pipe) {
                imageUrl = result.pipe;
            } else if (result.output || result.image || result.url) {
                imageUrl = result.output || result.image || result.url;
            }

            // Only store if we got a valid string URL
            if (imageUrl && typeof imageUrl === 'string') {
                if (!extensionSettings.npcAvatars) {
                    extensionSettings.npcAvatars = {};
                }
                extensionSettings.npcAvatars[characterName] = imageUrl;
                saveSettings();

                console.log(`[RPG Avatar] Generation complete for: ${characterName}`);
                return imageUrl;
            } else {
                console.warn(`[RPG Avatar] Generation result for ${characterName} was not a valid URL:`, result);
            }
        }

        return null;
    } catch (error) {
        console.error(`[RPG Avatar] Generation failed for ${characterName}:`, error);
        return null;
    } finally {
        pendingGenerations.delete(characterName);
    }
}

/**
 * Checks if a character needs an avatar and triggers generation
 * @param {string} characterName - Name of the character to check
 * @param {boolean} hasAvatar - Whether the character already has an avatar
 * @returns {Promise<void>}
 */
export function checkAndGenerateAvatar(characterName, hasAvatar) {
    // Only generate if no avatar exists and feature is enabled
    if (hasAvatar || !extensionSettings.autoGenerateAvatars) {
        return;
    }

    // Check if we already have a custom NPC avatar
    if (extensionSettings.npcAvatars && extensionSettings.npcAvatars[characterName]) {
        return;
    }

    // Trigger generation (non-blocking)
    generateAvatar(characterName);
}

/**
 * Checks if an avatar is currently being generated for a character
 * @param {string} characterName - Name of the character to check
 * @returns {boolean} True if generation is in progress
 */
export function isGenerating(characterName) {
    return pendingGenerations.has(characterName);
}
