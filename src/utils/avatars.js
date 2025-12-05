/**
 * Avatar Utilities Module
 * Handles safe avatar/thumbnail URL generation with error handling
 */

import { getThumbnailUrl } from '../../../../../../script.js';

/**
 * Safely retrieves a thumbnail URL from SillyTavern's API with error handling.
 * Returns null instead of throwing errors to prevent extension crashes.
 *
 * @param {string} type - Type of thumbnail ('avatar' or 'persona')
 * @param {string} filename - Filename of the avatar/persona
 * @returns {string|null} Thumbnail URL or null if unavailable/error
 */
export function getSafeThumbnailUrl(type, filename) {
    // Return null if no filename provided
    if (!filename || filename === 'none') {
        // console.log(`[RPG Companion] No valid filename provided for ${type} thumbnail`);
        return null;
    }

    try {
        // Attempt to get thumbnail URL from SillyTavern API
        const url = getThumbnailUrl(type, filename);

        // Validate that we got a string back
        if (typeof url !== 'string' || url.trim() === '') {
            console.warn(`[RPG Companion] getThumbnailUrl returned invalid result for ${type}:`, filename);
            return null;
        }

        // console.log(`[RPG Companion] Successfully generated ${type} thumbnail URL for: ${filename}`);
        return url;
    } catch (error) {
        // Log detailed error information for debugging
        console.error(`[RPG Companion] Failed to get ${type} thumbnail for "${filename}":`, error);
        console.error('[RPG Companion] Error details:', {
            type,
            filename,
            errorMessage: error.message,
            errorStack: error.stack
        });
        return null;
    }
}
