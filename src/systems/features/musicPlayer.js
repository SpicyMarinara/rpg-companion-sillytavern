/**
 * Music Player Module
 * Handles parsing and storing Spotify URLs from AI responses
 */

import { extensionSettings, committedTrackerData } from '../../core/state.js';

/**
 * Extracts song suggestion from AI response in <spotify:Song - Artist/> format
 * @param {string} responseText - The raw AI response text
 * @returns {Object|null} Object with {song, artist, searchQuery} or null if not found
 */
export function extractSpotifyUrl(responseText) {
    if (!responseText || !extensionSettings.enableSpotifyMusic) return null;

    // Match <spotify:Song Title - Artist Name/> format
    const songMatch = responseText.match(/<spotify:([^<>-]+)\s*-\s*([^<>\/]+)\/>/i);
    if (songMatch) {
        const song = songMatch[1].trim();
        const artist = songMatch[2].trim();
        const searchQuery = `${song} ${artist}`;
        return {
            song,
            artist,
            searchQuery,
            displayText: `${song} - ${artist}`
        };
    }

    return null;
}

/**
 * Converts song data to Spotify app protocol URL
 * @param {Object} songData - Object with {song, artist, searchQuery}
 * @returns {string} Spotify app protocol URL
 */
export function convertToEmbedUrl(songData) {
    if (!songData || !songData.searchQuery) return '';

    // Use Spotify app protocol for direct app opening
    const encodedQuery = encodeURIComponent(songData.searchQuery);
    return `spotify:search:${encodedQuery}`;
}

/**
 * Parses AI response for song suggestion and stores it
 * @param {string} responseText - The raw AI response text
 * @returns {boolean} True if song was found and stored
 */
export function parseAndStoreSpotifyUrl(responseText) {
    if (!extensionSettings.enableSpotifyMusic) return false;

    const songData = extractSpotifyUrl(responseText);
    // console.log('[RPG Companion] Spotify Parser: Found song:', songData);
    if (songData) {
        // Store in committed tracker data
        committedTrackerData.spotifyUrl = songData;
        // console.log('[RPG Companion] Spotify Parser: Stored song in committedTrackerData:', committedTrackerData.spotifyUrl);
        return true;
    }

    return false;
}

/**
 * Gets the current song data from committed tracker data
 * @returns {Object|null} Current song data or null
 */
export function getCurrentSpotifyUrl() {
    return committedTrackerData.spotifyUrl || null;
}

/**
 * Clears the current song data
 */
export function clearSpotifyUrl() {
    committedTrackerData.spotifyUrl = null;
}
