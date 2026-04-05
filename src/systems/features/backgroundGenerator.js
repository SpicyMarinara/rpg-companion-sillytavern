/**
 * Background Generator Module
 * Handles manual generation and application of scene background images.
 *
 * Generated backgrounds are keyed by location name and cached in extensionSettings.sceneBackgrounds.
 * Applies the image to SillyTavern's #bg1 element (same mechanism as ST's own backgrounds.js).
 */

import { safeGenerateRaw } from '../../utils/responseExtractor.js';
import { executeSlashCommandsOnChatInput } from '../../../../../../../scripts/slash-commands.js';
import { extensionSettings } from '../../core/state.js';
import { saveSettings } from '../../core/persistence.js';
import { generateBackgroundPromptGenerationPrompt } from '../generation/promptBuilder.js';
import { generateBackgroundWithComfyUI, saveImageToST } from './comfyUIClient.js';

// Store the original ST background URL so we can restore it
let originalBackground = null;

/**
 * Parses the location name out of an infoBox data string (JSON or text format).
 * Mirrors the same parsing logic in infoBox.js.
 *
 * @param {string|object} infoBoxData - Raw infoBox tracker data
 * @returns {string} Location name, or empty string if not found
 */
export function extractLocationFromInfoBox(infoBoxData) {
    if (!infoBoxData) return '';

    // Try JSON format first
    try {
        const raw = typeof infoBoxData === 'string' ? infoBoxData : JSON.stringify(infoBoxData);
        const parsed = JSON.parse(raw);
        if (parsed.location?.value) return parsed.location.value;
        if (typeof parsed.location === 'string') return parsed.location;
    } catch (_) { /* not JSON */ }

    // Text format: look for "Location: ..." or "🗺️: ..."
    const text = typeof infoBoxData === 'string' ? infoBoxData : '';
    for (const line of text.split('\n')) {
        if (line.startsWith('Location:')) return line.replace('Location:', '').trim();
        if (line.includes('🗺️:')) return line.replace('🗺️:', '').trim();
    }

    return '';
}

/**
 * Returns the cached background URL for a location, or null if not generated yet.
 *
 * @param {string} locationName
 * @returns {string|null}
 */
export function getStoredBackground(locationName) {
    return extensionSettings.sceneBackgrounds?.[locationName] || null;
}

/**
 * Applies a background image URL to ST's #bg1 element.
 * Saves the original background first so it can be restored via clearBackground().
 *
 * @param {string} imageUrl - Path like /user/images/backgrounds/...
 */
export function applyBackground(imageUrl) {
    const $bg1 = $('#bg1');
    if (!$bg1.length) {
        console.warn('[RPG Background] #bg1 element not found');
        return;
    }
    // Save original so it can be restored
    if (originalBackground === null) {
        originalBackground = $bg1.css('background-image') || '';
    }
    $bg1.css('background-image', `url('${imageUrl}')`);
    console.log('[RPG Background] Applied background:', imageUrl);
}

/**
 * Restores ST's original background (before any RPG Companion override).
 */
export function clearBackground() {
    const $bg1 = $('#bg1');
    if (!$bg1.length) return;
    $bg1.css('background-image', originalBackground || '');
    originalBackground = null;
    console.log('[RPG Background] Cleared background, restored original');
}

/**
 * Extracts image URL from /sd command result.
 * Mirrors extractImageUrl in avatarGenerator.js.
 *
 * @param {any} result
 * @returns {string|null}
 */
function extractImageUrl(result) {
    if (!result) return null;
    if (typeof result === 'string') {
        if (result.startsWith('http') || result.startsWith('data:') || result.startsWith('/')) return result;
        return null;
    }
    if (typeof result === 'object') {
        const url = result.pipe || result.output || result.image || result.url || result.result;
        if (url && typeof url === 'string') {
            if (url.startsWith('http') || url.startsWith('data:') || url.startsWith('/')) return url;
        }
    }
    return null;
}

/**
 * Generates a scene background for the given location and applies it to #bg1.
 * If a cached image already exists for this location, applies it immediately.
 *
 * @param {string} locationName - Current location (from Info Box)
 * @param {string|object} infoBoxData - Full Info Box tracker data (for weather/time context)
 * @returns {Promise<string|null>} Image URL that was applied, or null on failure
 */
export async function generateAndApplyBackground(locationName, infoBoxData) {
    if (!locationName) {
        console.warn('[RPG Background] No location name provided');
        return null;
    }

    // Cache hit: apply stored background immediately
    const cached = getStoredBackground(locationName);
    if (cached) {
        console.log('[RPG Background] Cache hit for:', locationName);
        applyBackground(cached);
        return cached;
    }

    console.log('[RPG Background] Generating background for:', locationName);

    // Generate SD prompt via LLM
    let prompt = null;
    try {
        const promptMessages = await generateBackgroundPromptGenerationPrompt(locationName, infoBoxData);
        const response = await safeGenerateRaw({
            prompt: promptMessages,
            quietToLoud: false
        });
        if (response && typeof response === 'string' && response.trim()) {
            prompt = response.trim();
            // Append custom instruction if set
            const customInstruction = extensionSettings.backgroundCustomInstruction || '';
            if (customInstruction.trim()) {
                prompt += ', ' + customInstruction.trim();
            }
        }
    } catch (e) {
        console.warn('[RPG Background] LLM prompt generation failed, using fallback:', e);
    }

    // Fallback prompt if LLM failed
    if (!prompt) {
        const customInstruction = extensionSettings.backgroundCustomInstruction || '';
        prompt = `landscape, ${locationName}, detailed environment, no characters, no people, fantasy art, high quality, atmospheric lighting`;
        if (customInstruction.trim()) prompt += ', ' + customInstruction.trim();
    }

    console.log('[RPG Background] SD prompt:', prompt);

    let imagePath = null;

    try {
        if (extensionSettings.useComfyUIBackgroundWorkflow) {
            // ComfyUI path — uses dedicated background workflow (not the sprite workflow)
            const { format, data } = await generateBackgroundWithComfyUI(prompt);
            const filename = `bg_${Date.now()}`;
            imagePath = await saveImageToST(data, format, 'backgrounds', filename);
        } else {
            // /sd command path — force landscape dimensions (896×512)
            const result = await executeSlashCommandsOnChatInput(
                `/sd quiet=true width=896 height=512 ${prompt}`,
                { clearChatInput: false }
            );
            imagePath = extractImageUrl(result);
        }
    } catch (e) {
        console.error('[RPG Background] Image generation failed:', e);
        return null;
    }

    if (!imagePath) {
        console.warn('[RPG Background] No image path returned for:', locationName);
        return null;
    }

    // Cache and apply
    if (!extensionSettings.sceneBackgrounds) extensionSettings.sceneBackgrounds = {};
    extensionSettings.sceneBackgrounds[locationName] = imagePath;
    saveSettings();

    applyBackground(imagePath);
    return imagePath;
}
