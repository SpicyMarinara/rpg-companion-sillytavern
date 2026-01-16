/**
 * API Client Module
 * Handles API calls for RPG tracker generation
 */

import { generateRaw, chat, eventSource } from '../../../../../../../script.js';
import { executeSlashCommandsOnChatInput } from '../../../../../../../scripts/slash-commands.js';

// Custom event name for when RPG Companion finishes updating tracker data
// Other extensions can listen for this event to know when RPG Companion is done
export const RPG_COMPANION_UPDATE_COMPLETE = 'rpg_companion_update_complete';
import {
    extensionSettings,
    lastGeneratedData,
    committedTrackerData,
    isGenerating,
    lastActionWasSwipe,
    setIsGenerating,
    setLastActionWasSwipe,
    $musicPlayerContainer
} from '../../core/state.js';
import { saveChatData } from '../../core/persistence.js';
import {
    generateSeparateUpdatePrompt
} from './promptBuilder.js';
import { parseResponse, parseUserStats } from './parser.js';
import { parseAndStoreSpotifyUrl } from '../features/musicPlayer.js';
import { renderUserStats } from '../rendering/userStats.js';
import { renderInfoBox } from '../rendering/infoBox.js';
import { removeLocks, preserveLockedValues } from './lockManager.js';
import { renderThoughts } from '../rendering/thoughts.js';
import { renderInventory } from '../rendering/inventory.js';
import { renderQuests } from '../rendering/quests.js';
import { renderMusicPlayer } from '../rendering/musicPlayer.js';
import { i18n } from '../../core/i18n.js';
import { generateAvatarsForCharacters } from '../features/avatarGenerator.js';
import { setFabLoadingState, updateFabWidgets } from '../ui/mobile.js';
import { updateStripWidgets } from '../ui/desktop.js';

// Store the original preset name to restore after tracker generation
let originalPresetName = null;

/**
 * Generates tracker data using an external OpenAI-compatible API.
 * Used when generationMode is 'external'.
 *
 * @param {Array<{role: string, content: string}>} messages - Array of message objects for the API
 * @returns {Promise<string>} The generated response content
 * @throws {Error} If the API call fails or configuration is invalid
 */
export async function generateWithExternalAPI(messages) {
    const { baseUrl, model, maxTokens, temperature } = extensionSettings.externalApiSettings || {};
    // Retrieve API key from secure storage (not shared extension settings)
    const apiKey = localStorage.getItem('rpg_companion_external_api_key');

    // Validate required settings
    if (!baseUrl || !baseUrl.trim()) {
        throw new Error('External API base URL is not configured');
    }
    if (!model || !model.trim()) {
        throw new Error('External API model is not configured');
    }

    // Normalize base URL (remove trailing slash if present)
    const normalizedBaseUrl = baseUrl.trim().replace(/\/+$/, '');
    const endpoint = `${normalizedBaseUrl}/chat/completions`;

    // console.log(`[RPG Companion] Calling external API: ${normalizedBaseUrl} with model: ${model}`);

    // Prepare headers - only include Authorization if API key is provided
    const headers = {
        'Content-Type': 'application/json'
    };

    if (apiKey && apiKey.trim()) {
        headers['Authorization'] = `Bearer ${apiKey.trim()}`;
    }

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                model: model.trim(),
                messages: messages,
                max_tokens: maxTokens || 2048,
                temperature: temperature ?? 0.7
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            let errorMessage = `External API error: ${response.status} ${response.statusText}`;
            try {
                const errorJson = JSON.parse(errorText);
                if (errorJson.error?.message) {
                    errorMessage = `External API error: ${errorJson.error.message}`;
                }
            } catch (e) {
                // If parsing fails, use the raw text if it's short enough
                if (errorText.length < 200) {
                    errorMessage = `External API error: ${errorText}`;
                }
            }
            throw new Error(errorMessage);
        }

        const data = await response.json();

        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new Error('Invalid response format from external API');
        }

        const content = data.choices[0].message.content;
        // console.log('[RPG Companion] External API response received successfully');

        return content;
    } catch (error) {
        if (error.name === 'TypeError' && (error.message.includes('fetch') || error.message.includes('Failed to fetch') || error.message.includes('NetworkError'))) {
            throw new Error(`CORS Access Blocked: This API endpoint (${normalizedBaseUrl}) does not allow direct access from a browser. This is a browser security restriction (CORS), not a bug in the extension. Please use an endpoint that supports CORS (like OpenRouter or a local proxy) or use SillyTavern's internal API system (Separate Mode).`);
        }
        throw error;
    }
}

/**
 * Tests the external API connection with a simple request.
 * @returns {Promise<{success: boolean, message: string, model?: string}>}
 */
export async function testExternalAPIConnection() {
    const { baseUrl, model } = extensionSettings.externalApiSettings || {};
    const apiKey = localStorage.getItem('rpg_companion_external_api_key');

    if (!baseUrl || !model) {
        return {
            success: false,
            message: 'Please fill in all required fields (Base URL and Model). API Key is optional for local servers.'
        };
    }

    try {
        const testMessages = [
            { role: 'user', content: 'Respond with exactly: "Connection successful"' }
        ];

        const response = await generateWithExternalAPI(testMessages);

        return {
            success: true,
            message: `Connection successful! Model: ${model}`,
            model: model
        };
    } catch (error) {
        return {
            success: false,
            message: error.message || 'Connection failed'
        };
    }
}

/**
 * Gets the current preset name using the /preset command
 * @returns {Promise<string|null>} Current preset name or null if unavailable
 */
export async function getCurrentPresetName() {
    try {
        // Use /preset without arguments to get the current preset name
        const result = await executeSlashCommandsOnChatInput('/preset', { quiet: true });

        // console.log('[RPG Companion] /preset result:', result);

        // The result should be an object with a 'pipe' property containing the preset name
        if (result && typeof result === 'object' && result.pipe) {
            const presetName = String(result.pipe).trim();
            // console.log('[RPG Companion] Extracted preset name:', presetName);
            return presetName || null;
        }

        // Fallback if result is a string
        if (typeof result === 'string') {
            return result.trim() || null;
        }

        return null;
    } catch (error) {
        console.error('[RPG Companion] Error getting current preset:', error);
        return null;
    }
}

/**
 * Switches to a specific preset by name using the /preset slash command
 * @param {string} presetName - Name of the preset to switch to
 * @returns {Promise<boolean>} True if switching succeeded, false otherwise
 */
export async function switchToPreset(presetName) {
    try {
        // Use the /preset slash command to switch presets
        // This is the proper way to change presets in SillyTavern
        await executeSlashCommandsOnChatInput(`/preset ${presetName}`, { quiet: true });

        // console.log(`[RPG Companion] Switched to preset "${presetName}"`);
        return true;
    } catch (error) {
        console.error('[RPG Companion] Error switching preset:', error);
        return false;
    }
}

/**
 * Check if the current swipe has existing RPG data saved
 * @returns {{hasData: boolean, swipeData: Object|null, previousData: Object|null}}
 */
function checkCurrentSwipeData() {
    const lastMessage = chat && chat.length > 0 ? chat[chat.length - 1] : null;
    
    if (!lastMessage || lastMessage.is_user) {
        return { hasData: false, swipeData: null, previousData: null };
    }

    const currentSwipeId = lastMessage.swipe_id || 0;
    const swipeData = lastMessage.extra?.rpg_companion_swipes?.[currentSwipeId];
    
    // Check if any tracker data exists in the current swipe
    const hasData = swipeData && (
        (swipeData.userStats && swipeData.userStats.trim() !== '') ||
        (swipeData.infoBox && swipeData.infoBox.trim() !== '') ||
        (swipeData.characterThoughts && swipeData.characterThoughts.trim() !== '')
    );

    // Find previous message data to reset to (search backwards for assistant message with data)
    let previousData = null;
    for (let i = chat.length - 2; i >= 0; i--) {
        const msg = chat[i];
        if (!msg.is_user && msg.extra?.rpg_companion_swipes) {
            const prevSwipeId = msg.swipe_id || 0;
            const prevSwipeData = msg.extra.rpg_companion_swipes[prevSwipeId];
            if (prevSwipeData && (prevSwipeData.userStats || prevSwipeData.infoBox || prevSwipeData.characterThoughts)) {
                previousData = prevSwipeData;
                break;
            }
        }
    }

    return { hasData: !!hasData, swipeData, previousData };
}

/**
 * Show confirmation popup when refreshing with existing data
 * @returns {Promise<'reset'|'keep'|'cancel'>} User's choice
 */
function showRefreshConfirmPopup() {
    return new Promise((resolve) => {
        // Create popup overlay
        const overlay = document.createElement('div');
        overlay.className = 'rpg-refresh-confirm-overlay';
        overlay.innerHTML = `
            <div class="rpg-refresh-confirm-popup">
                <div class="rpg-refresh-confirm-header">
                    <i class="fa-solid fa-arrows-rotate"></i>
                    <span>${i18n.getTranslation('refreshConfirm.title') || 'Refresh RPG Data'}</span>
                </div>
                <div class="rpg-refresh-confirm-body">
                    <p>${i18n.getTranslation('refreshConfirm.message') || 'This swipe already has RPG data. How would you like to proceed?'}</p>
                </div>
                <div class="rpg-refresh-confirm-buttons">
                    <div class="rpg-refresh-confirm-option">
                        <button class="rpg-refresh-confirm-btn rpg-refresh-confirm-reset">
                            <i class="fa-solid fa-trash-can"></i>
                            ${i18n.getTranslation('refreshConfirm.reset') || 'Discard Current & Refresh'}
                        </button>
                        <div class="rpg-refresh-confirm-hint">
                            <i class="fa-solid fa-circle-info"></i>
                            <span>${i18n.getTranslation('refreshConfirm.resetHint') || 'Reverts to stats from the previous message, then generates new data. Use this to undo changes.'}</span>
                        </div>
                    </div>
                    <div class="rpg-refresh-confirm-option">
                        <button class="rpg-refresh-confirm-btn rpg-refresh-confirm-keep">
                            <i class="fa-solid fa-arrow-right"></i>
                            ${i18n.getTranslation('refreshConfirm.keep') || 'Use Current & Refresh'}
                        </button>
                        <div class="rpg-refresh-confirm-hint">
                            <i class="fa-solid fa-circle-info"></i>
                            <span>${i18n.getTranslation('refreshConfirm.keepHint') || 'Keeps your current stats as the starting point and generates updated data from them.'}</span>
                        </div>
                    </div>
                    <button class="rpg-refresh-confirm-btn rpg-refresh-confirm-cancel">
                        <i class="fa-solid fa-xmark"></i>
                        ${i18n.getTranslation('refreshConfirm.cancel') || 'Cancel'}
                    </button>
                </div>
            </div>
        `;

        // Add styles if not already present
        if (!document.getElementById('rpg-refresh-confirm-styles')) {
            const styles = document.createElement('style');
            styles.id = 'rpg-refresh-confirm-styles';
            styles.textContent = `
                .rpg-refresh-confirm-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.7);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10000;
                    animation: rpg-fade-in 0.2s ease;
                }
                @keyframes rpg-fade-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                .rpg-refresh-confirm-popup {
                    background: var(--SmartThemeBlurTintColor, #1a1a2e);
                    border: 1px solid var(--SmartThemeBorderColor, #333);
                    border-radius: 12px;
                    padding: 20px;
                    max-width: 480px;
                    width: 90%;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
                    animation: rpg-slide-up 0.2s ease;
                }
                @keyframes rpg-slide-up {
                    from { transform: translateY(20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                .rpg-refresh-confirm-header {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    margin-bottom: 15px;
                    font-size: 1.1em;
                    font-weight: 600;
                    color: var(--SmartThemeBodyColor, #eaeaea);
                }
                .rpg-refresh-confirm-header i {
                    color: var(--SmartThemeQuoteColor, #59a8e8);
                }
                .rpg-refresh-confirm-body {
                    margin-bottom: 20px;
                    color: var(--SmartThemeBodyColor, #ccc);
                    line-height: 1.5;
                }
                .rpg-refresh-confirm-buttons {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                .rpg-refresh-confirm-option {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }
                .rpg-refresh-confirm-hint {
                    display: flex;
                    align-items: flex-start;
                    gap: 6px;
                    padding: 0 4px;
                    font-size: 0.8em;
                    color: var(--SmartThemeBodyColor, #999);
                    opacity: 0.8;
                }
                .rpg-refresh-confirm-hint i {
                    margin-top: 2px;
                    font-size: 0.9em;
                    flex-shrink: 0;
                }
                .rpg-refresh-confirm-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    padding: 12px 16px;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 0.95em;
                    font-weight: 500;
                    transition: all 0.2s ease;
                }
                .rpg-refresh-confirm-reset {
                    background: linear-gradient(135deg, #e74c3c, #c0392b);
                    color: white;
                }
                .rpg-refresh-confirm-reset:hover {
                    background: linear-gradient(135deg, #c0392b, #a93226);
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(231, 76, 60, 0.3);
                }
                .rpg-refresh-confirm-keep {
                    background: linear-gradient(135deg, #27ae60, #1e8449);
                    color: white;
                }
                .rpg-refresh-confirm-keep:hover {
                    background: linear-gradient(135deg, #1e8449, #186a3b);
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(39, 174, 96, 0.3);
                }
                .rpg-refresh-confirm-cancel {
                    background: transparent;
                    border: 1px solid var(--SmartThemeBorderColor, #444);
                    color: var(--SmartThemeBodyColor, #ccc);
                    margin-top: 4px;
                }
                .rpg-refresh-confirm-cancel:hover {
                    background: var(--SmartThemeBorderColor, #444);
                }
            `;
            document.head.appendChild(styles);
        }

        // Add event handlers
        const cleanup = () => {
            overlay.remove();
        };

        overlay.querySelector('.rpg-refresh-confirm-reset').addEventListener('click', () => {
            cleanup();
            resolve('reset');
        });

        overlay.querySelector('.rpg-refresh-confirm-keep').addEventListener('click', () => {
            cleanup();
            resolve('keep');
        });

        overlay.querySelector('.rpg-refresh-confirm-cancel').addEventListener('click', () => {
            cleanup();
            resolve('cancel');
        });

        // Close on overlay click (outside popup)
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                cleanup();
                resolve('cancel');
            }
        });

        // Close on Escape key
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                document.removeEventListener('keydown', escHandler);
                cleanup();
                resolve('cancel');
            }
        };
        document.addEventListener('keydown', escHandler);

        document.body.appendChild(overlay);
    });
}


/**
 * Updates RPG tracker data using separate API call (separate mode only).
 * Makes a dedicated API call to generate tracker data, then stores it
 * in the last assistant message's swipe data.
 *
 * @param {Function} renderUserStats - UI function to render user stats
 * @param {Function} renderInfoBox - UI function to render info box
 * @param {Function} renderThoughts - UI function to render character thoughts
 * @param {Function} renderInventory - UI function to render inventory
 */
export async function updateRPGData(renderUserStats, renderInfoBox, renderThoughts, renderInventory) {
    if (isGenerating) {
        // console.log('[RPG Companion] Already generating, skipping...');
        return;
    }

    if (!extensionSettings.enabled) {
        return;
    }

    if (extensionSettings.generationMode !== 'separate' && extensionSettings.generationMode !== 'external') {
        // console.log('[RPG Companion] Not in separate or external mode, skipping manual update');
        return;
    }

    // Check if current swipe already has saved data
    const { hasData, swipeData, previousData } = checkCurrentSwipeData();
    
    if (hasData) {
        // Show confirmation popup to user
        const choice = await showRefreshConfirmPopup();
        
        if (choice === 'cancel') {
            return; // User cancelled, do nothing
        }
        
        if (choice === 'reset') {
            // Reset to previous message's data - same behavior as creating a new swipe
            // This matches the logic in onMessageSwiped for new swipes
            if (previousData) {
                committedTrackerData.userStats = previousData.userStats || null;
                committedTrackerData.infoBox = previousData.infoBox || null;
                committedTrackerData.characterThoughts = previousData.characterThoughts || null;
            } else {
                // No previous data found - clear committed data (same as swipe handler)
                committedTrackerData.userStats = null;
                committedTrackerData.infoBox = null;
                committedTrackerData.characterThoughts = null;
            }
            
            // Update lastGeneratedData to match (for UI display while generating)
            lastGeneratedData.userStats = committedTrackerData.userStats;
            lastGeneratedData.infoBox = committedTrackerData.infoBox;
            lastGeneratedData.characterThoughts = committedTrackerData.characterThoughts;
            
            // Parse user stats for display if available
            if (committedTrackerData.userStats) {
                parseUserStats(committedTrackerData.userStats);
            }
            
            // Re-render UI to show reset state while generating
            renderUserStats();
            renderInfoBox();
            renderThoughts();
            renderInventory();
        } else if (choice === 'keep' && swipeData) {
            // Keep current swipe's data as the base for regeneration
            // Update committedTrackerData to use current swipe's data (not old committed data)
            if (swipeData.userStats) {
                committedTrackerData.userStats = swipeData.userStats;
            }
            if (swipeData.infoBox) {
                committedTrackerData.infoBox = swipeData.infoBox;
            }
            if (swipeData.characterThoughts) {
                committedTrackerData.characterThoughts = swipeData.characterThoughts;
            }
        }
    }

    const isExternalMode = extensionSettings.generationMode === 'external';

    try {
        setIsGenerating(true);
        setFabLoadingState(true); // Show spinning FAB on mobile

        // Update button to show "Updating..." state
        const $updateBtn = $('#rpg-manual-update');
        const $stripRefreshBtn = $('#rpg-strip-refresh');
        const updatingText = i18n.getTranslation('template.mainPanel.updating') || 'Updating...';
        $updateBtn.html(`<i class="fa-solid fa-spinner fa-spin"></i> ${updatingText}`).prop('disabled', true);
        $stripRefreshBtn.html('<i class="fa-solid fa-spinner fa-spin"></i>').prop('disabled', true);

        const prompt = await generateSeparateUpdatePrompt();

        // Generate response based on mode
        let response;
        if (isExternalMode) {
            // External mode: Use external OpenAI-compatible API directly
            // console.log('[RPG Companion] Using external API for tracker generation');
            response = await generateWithExternalAPI(prompt);
        } else {
            // Separate mode: Use SillyTavern's generateRaw
            response = await generateRaw({
                prompt: prompt,
                quietToLoud: false
            });
        }

        if (response) {
            // console.log('[RPG Companion] Raw AI response:', response);
            const parsedData = parseResponse(response);

            // Check if parsing completely failed (no tracker data found)
            if (parsedData.parsingFailed) {
                toastr.error(i18n.getTranslation('errors.parsingError'), '', { timeOut: 5000 });
            }

            // Remove locks from parsed data (JSON format only, text format is unaffected)
            if (parsedData.userStats) {
                parsedData.userStats = removeLocks(parsedData.userStats);
                parsedData.userStats = preserveLockedValues(parsedData.userStats, 'userStats');
            }
            if (parsedData.infoBox) {
                parsedData.infoBox = removeLocks(parsedData.infoBox);
                parsedData.infoBox = preserveLockedValues(parsedData.infoBox, 'infoBox');
            }
            if (parsedData.characterThoughts) {
                parsedData.characterThoughts = removeLocks(parsedData.characterThoughts);
                parsedData.characterThoughts = preserveLockedValues(parsedData.characterThoughts, 'characterThoughts');
            }

            // Parse and store Spotify URL if feature is enabled
            parseAndStoreSpotifyUrl(response);
            // console.log('[RPG Companion] Parsed data:', parsedData);
            // console.log('[RPG Companion] parsedData.userStats:', parsedData.userStats ? parsedData.userStats.substring(0, 100) + '...' : 'null');

            // DON'T update lastGeneratedData here - it should only reflect the data
            // from the assistant message the user replied to, not auto-generated updates
            // This ensures swipes/regenerations use consistent source data

            // Store RPG data for the last assistant message (separate mode)
            const lastMessage = chat && chat.length > 0 ? chat[chat.length - 1] : null;
            // console.log('[RPG Companion] Last message is_user:', lastMessage ? lastMessage.is_user : 'no message');

            // Update lastGeneratedData for display (regardless of message type)
            if (parsedData.userStats) {
                lastGeneratedData.userStats = parsedData.userStats;
                parseUserStats(parsedData.userStats);
            }
            if (parsedData.infoBox) {
                lastGeneratedData.infoBox = parsedData.infoBox;
            }
            if (parsedData.characterThoughts) {
                lastGeneratedData.characterThoughts = parsedData.characterThoughts;
            }

            // Also store on assistant message if present (existing behavior)
            if (lastMessage && !lastMessage.is_user) {
                if (!lastMessage.extra) {
                    lastMessage.extra = {};
                }
                if (!lastMessage.extra.rpg_companion_swipes) {
                    lastMessage.extra.rpg_companion_swipes = {};
                }

                const currentSwipeId = lastMessage.swipe_id || 0;
                lastMessage.extra.rpg_companion_swipes[currentSwipeId] = {
                    userStats: parsedData.userStats,
                    infoBox: parsedData.infoBox,
                    characterThoughts: parsedData.characterThoughts
                };

                // console.log('[RPG Companion] Stored separate mode RPG data for message swipe', currentSwipeId);
            }

            // Only commit on TRULY first generation (no committed data exists at all)
            // This prevents auto-commit after refresh when we have saved committed data
            const hasAnyCommittedContent = (
                (committedTrackerData.userStats && committedTrackerData.userStats.trim() !== '') ||
                (committedTrackerData.infoBox && committedTrackerData.infoBox.trim() !== '' && committedTrackerData.infoBox !== 'Info Box\n---\n') ||
                (committedTrackerData.characterThoughts && committedTrackerData.characterThoughts.trim() !== '' && committedTrackerData.characterThoughts !== 'Present Characters\n---\n')
            );

            // Only commit if we have NO committed content at all (truly first time ever)
            if (!hasAnyCommittedContent) {
                committedTrackerData.userStats = parsedData.userStats;
                committedTrackerData.infoBox = parsedData.infoBox;
                committedTrackerData.characterThoughts = parsedData.characterThoughts;
                // console.log('[RPG Companion] 🔆 FIRST TIME: Auto-committed tracker data');
            }

            // Render the updated data
            renderUserStats();
            renderInfoBox();
            renderThoughts();
            renderInventory();
            renderQuests();
            renderMusicPlayer($musicPlayerContainer[0]);

            // Save to chat metadata
            saveChatData();

            // Generate avatars if auto-generate is enabled (runs within this workflow)
            // This uses the RPG Companion Trackers preset and keeps the button spinning
            if (extensionSettings.autoGenerateAvatars) {
                const charactersNeedingAvatars = parseCharactersFromThoughts(parsedData.characterThoughts);
                if (charactersNeedingAvatars.length > 0) {
                    // console.log('[RPG Companion] Generating avatars for:', charactersNeedingAvatars);

                    // Generate avatars - this awaits completion
                    await generateAvatarsForCharacters(charactersNeedingAvatars, (names) => {
                        // Callback when generation starts - re-render to show loading spinners
                        // console.log('[RPG Companion] Avatar generation started, showing spinners...');
                        renderThoughts();
                    });

                    // Re-render once all avatars are generated
                    // console.log('[RPG Companion] All avatars generated, re-rendering...');
                    renderThoughts();
                }
            }
        }

    } catch (error) {
        console.error('[RPG Companion] Error updating RPG data:', error);
        if (isExternalMode) {
            toastr.error(error.message, 'RPG Companion External API Error');
        }
    } finally {
        setIsGenerating(false);
        setFabLoadingState(false); // Stop spinning FAB on mobile
        updateFabWidgets(); // Update FAB widgets with new data
        updateStripWidgets(); // Update strip widgets with new data

        // Restore button to original state
        const $updateBtn = $('#rpg-manual-update');
        const $stripRefreshBtn = $('#rpg-strip-refresh');
        const refreshText = i18n.getTranslation('template.mainPanel.refreshRpgInfo') || 'Refresh RPG Info';
        $updateBtn.html(`<i class="fa-solid fa-sync"></i> ${refreshText}`).prop('disabled', false);
        $stripRefreshBtn.html('<i class="fa-solid fa-sync"></i>').prop('disabled', false);

        // Reset the flag after tracker generation completes
        // This ensures the flag persists through both main generation AND tracker generation
        // console.log('[RPG Companion] 🔄 Tracker generation complete - resetting lastActionWasSwipe to false');
        setLastActionWasSwipe(false);

        // Emit event for other extensions to know RPG Companion has finished updating
        console.debug('[RPG Companion] Emitting RPG_COMPANION_UPDATE_COMPLETE event');
        eventSource.emit(RPG_COMPANION_UPDATE_COMPLETE);
    }
}

/**
 * Parses character names from Present Characters thoughts data
 * @param {string} characterThoughtsData - Raw character thoughts data
 * @returns {Array<string>} Array of character names found
 */
function parseCharactersFromThoughts(characterThoughtsData) {
    if (!characterThoughtsData) return [];

    // Try parsing as JSON first (current format)
    try {
        const parsed = typeof characterThoughtsData === 'string'
            ? JSON.parse(characterThoughtsData)
            : characterThoughtsData;

        // Handle both {characters: [...]} and direct array formats
        const charactersArray = Array.isArray(parsed) ? parsed : (parsed.characters || []);

        if (charactersArray.length > 0) {
            // Extract names from JSON character objects
            return charactersArray
                .map(char => char.name)
                .filter(name => name && name.toLowerCase() !== 'unavailable');
        }
    } catch (e) {
        // Not JSON, fall back to text parsing
    }

    // Fallback: Parse text format (legacy)
    const lines = characterThoughtsData.split('\n');
    const characters = [];

    for (const line of lines) {
        if (line.trim().startsWith('- ')) {
            const name = line.trim().substring(2).trim();
            if (name && name.toLowerCase() !== 'unavailable') {
                characters.push(name);
            }
        }
    }
    return characters;
}
