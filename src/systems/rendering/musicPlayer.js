/**
 * Music Player Rendering Module
 * Handles UI rendering for Spotify music player widget
 */

import { extensionSettings, committedTrackerData } from '../../core/state.js';
import { i18n } from '../../core/i18n.js';

/**
 * Creates a Spotify deep link URL that opens the Spotify app
 * Uses spotify:search: protocol for app, falls back to web URL
 * @param {Object} songData - Object with {song, artist, searchQuery}
 * @returns {Object} Object with appUrl and webUrl
 */
function createSpotifyUrls(songData) {
    if (!songData || !songData.searchQuery) {
        return { appUrl: '', webUrl: '' };
    }

    const encodedQuery = encodeURIComponent(songData.searchQuery);

    return {
        // Spotify app protocol - opens directly in Spotify app on desktop/mobile
        appUrl: `spotify:search:${encodedQuery}`,
        // Web fallback - opens Spotify web player search
        webUrl: `https://open.spotify.com/search/${encodedQuery}`
    };
}

/**
 * Opens Spotify with the given song
 * Tries app protocol first, falls back to web
 * @param {Object} songData - Song data object
 */
function openInSpotify(songData) {
    const urls = createSpotifyUrls(songData);

    // Try to open in Spotify app first
    // On mobile, this will open the Spotify app if installed
    // On desktop, this will open Spotify desktop app if installed
    window.location.href = urls.appUrl;

    // Fallback: If app doesn't open within 2 seconds, open web version
    // This handles cases where Spotify app isn't installed
    setTimeout(() => {
        // Check if we're still on the same page (app didn't open)
        // Note: This is a best-effort fallback
        if (document.hasFocus()) {
            window.open(urls.webUrl, '_blank');
        }
    }, 1500);
}

/**
 * Renders the Spotify music player as a mini player widget above chat input
 * @param {HTMLElement} container - Container element to render into
 */
export function renderMusicPlayer(container) {
    console.log('[RPG Companion] Music Player: renderMusicPlayer called');

    // Remove old chat-attached player if it exists
    $('#rpg-chat-music-player').remove();

    console.log('[RPG Companion] Music Player: enableSpotifyMusic =', extensionSettings.enableSpotifyMusic);

    if (!extensionSettings.enableSpotifyMusic) {
        console.warn('[RPG Companion] Music Player: Spotify music is disabled');
        return;
    }

    const songData = committedTrackerData.spotifyUrl;
    console.log('[RPG Companion] Music Player: Rendering with song:', songData);

    if (!songData || !songData.displayText) {
        // No song - don't show anything
        return;
    }

    // Create the mini music player widget
    const musicPlayerHtml = `
        <div id="rpg-chat-music-player" class="rpg-music-widget">
            <div class="rpg-music-widget-content">
                <div class="rpg-music-widget-icon">
                    <i class="fa-brands fa-spotify"></i>
                </div>
                <div class="rpg-music-widget-info">
                    <div class="rpg-music-widget-title" title="${songData.song}">${songData.song}</div>
                    <div class="rpg-music-widget-artist" title="${songData.artist}">${songData.artist}</div>
                </div>
                <button class="rpg-music-widget-play" title="Play in Spotify">
                    <i class="fa-solid fa-play"></i>
                </button>
                <button class="rpg-music-widget-close" title="Dismiss">
                    <i class="fa-solid fa-times"></i>
                </button>
            </div>
        </div>
    `;

    // Find the chat form container and insert widget before (above) it
    const $chatForm = $('#send_form');

    console.log('[RPG Companion] Music Player: Found #send_form:', $chatForm.length > 0);

    if ($chatForm.length === 0) {
        console.error('[RPG Companion] Music Player: Could not find #send_form - cannot render widget!');
        return;
    }

    // Insert widget inside (at top of) the chat form
    console.log('[RPG Companion] Music Player: Prepending widget to #send_form');
    $chatForm.prepend(musicPlayerHtml);

    console.log('[RPG Companion] Music Player: Widget inserted, checking if visible...');
    const $widget = $('#rpg-chat-music-player');
    console.log('[RPG Companion] Music Player: Widget exists:', $widget.length > 0);
    if ($widget.length > 0) {
        console.log('[RPG Companion] Music Player: Widget position:', $widget.offset());
        console.log('[RPG Companion] Music Player: Widget dimensions:', { width: $widget.width(), height: $widget.height() });
        console.log('[RPG Companion] Music Player: Widget CSS display:', $widget.css('display'));
        console.log('[RPG Companion] Music Player: Widget CSS visibility:', $widget.css('visibility'));
    }

    // Bind play button click
    $('#rpg-chat-music-player .rpg-music-widget-play').on('click', function(e) {
        e.stopPropagation();
        openInSpotify(songData);
    });

    // Bind close button click
    $('#rpg-chat-music-player .rpg-music-widget-close').on('click', function(e) {
        e.stopPropagation();
        $('#rpg-chat-music-player').fadeOut(200, function() {
            $(this).remove();
        });
    });

    // Clicking anywhere else on the widget also opens Spotify
    $('#rpg-chat-music-player .rpg-music-widget-content').on('click', function() {
        openInSpotify(songData);
    });
}

/**
 * Updates the music player display
 * @param {HTMLElement} container - Container element
 */
export function updateMusicPlayer(container) {
    renderMusicPlayer(container);
}
