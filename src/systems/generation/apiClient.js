/**
 * API Client Module
 * Handles API calls for RPG tracker generation
 */

import { generateRaw, chat } from '../../../../../../../script.js';
import { executeSlashCommandsOnChatInput } from '../../../../../../../scripts/slash-commands.js';
import {
    extensionSettings,
    lastGeneratedData,
    committedTrackerData,
    isGenerating,
    lastActionWasSwipe,
    setIsGenerating,
    setLastActionWasSwipe
} from '../../core/state.js';
import { saveChatData } from '../../core/persistence.js';
import {
    generateSeparateUpdatePrompt
} from './promptBuilder.js';
import { parseResponse, parseUserStats } from './parser.js';
import { renderUserStats } from '../rendering/userStats.js';
import { renderInfoBox } from '../rendering/infoBox.js';
import { renderThoughts } from '../rendering/thoughts.js';
import { renderInventory } from '../rendering/inventory.js';
import { renderQuests } from '../rendering/quests.js';
import { i18n } from '../../core/i18n.js';
import { generateAvatarsForCharacters } from '../features/avatarGenerator.js';

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
    const { baseUrl, apiKey, model, maxTokens, temperature } = extensionSettings.externalApiSettings || {};

    // Validate required settings
    if (!baseUrl || !baseUrl.trim()) {
        throw new Error('External API base URL is not configured');
    }
    if (!apiKey || !apiKey.trim()) {
        throw new Error('External API key is not configured');
    }
    if (!model || !model.trim()) {
        throw new Error('External API model is not configured');
    }

    // Normalize base URL (remove trailing slash if present)
    const normalizedBaseUrl = baseUrl.trim().replace(/\/+$/, '');
    const endpoint = `${normalizedBaseUrl}/chat/completions`;

    console.log(`[RPG Companion] Calling external API: ${normalizedBaseUrl} with model: ${model}`);

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey.trim()}`
            },
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
        console.log('[RPG Companion] External API response received successfully');

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
    const { baseUrl, apiKey, model } = extensionSettings.externalApiSettings || {};

    if (!baseUrl || !apiKey || !model) {
        return {
            success: false,
            message: 'Please fill in all required fields (Base URL, API Key, and Model)'
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

    const isExternalMode = extensionSettings.generationMode === 'external';

    try {
        setIsGenerating(true);

        // Update button to show "Updating..." state
        const $updateBtn = $('#rpg-manual-update');
        const updatingText = i18n.getTranslation('template.mainPanel.updating') || 'Updating...';
        $updateBtn.html(`<i class="fa-solid fa-spinner fa-spin"></i> ${updatingText}`).prop('disabled', true);

        // Save current preset name before switching (if we're going to switch)
        // Note: Preset switching is only used in separate mode, not external mode
        if (!isExternalMode && extensionSettings.useSeparatePreset) {
            originalPresetName = await getCurrentPresetName();
            console.log(`[RPG Companion] Saved original preset: "${originalPresetName}"`);
        }

        // Switch to separate preset if enabled (separate mode only)
        if (!isExternalMode && extensionSettings.useSeparatePreset) {
            const switched = await switchToPreset('RPG Companion Trackers');
            if (!switched) {
                console.warn('[RPG Companion] Failed to switch to RPG Companion Trackers preset. Using current preset.');
                originalPresetName = null; // Don't try to restore if we didn't switch
            }
        }

        const prompt = await generateSeparateUpdatePrompt();

        // Generate response based on mode
        let response;
        if (isExternalMode) {
            // External mode: Use external OpenAI-compatible API directly
            console.log('[RPG Companion] Using external API for tracker generation');
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

            // When saveTrackerHistory is enabled, store tracker data on the user's message too
            // This allows scrolling through history and seeing trackers at each point
            if (extensionSettings.saveTrackerHistory && lastMessage && lastMessage.is_user) {
                if (!lastMessage.extra) {
                    lastMessage.extra = {};
                }
                lastMessage.extra.rpg_companion_data = {
                    userStats: parsedData.userStats,
                    infoBox: parsedData.infoBox,
                    characterThoughts: parsedData.characterThoughts,
                    timestamp: Date.now()
                };
                // console.log('[RPG Companion] 💾 Stored tracker data on user message for history');
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

            // Save to chat metadata
            saveChatData();

            // Generate avatars if auto-generate is enabled (runs within this workflow)
            // This uses the RPG Companion Trackers preset and keeps the button spinning
            if (extensionSettings.autoGenerateAvatars) {
                const charactersNeedingAvatars = parseCharactersFromThoughts(parsedData.characterThoughts);
                if (charactersNeedingAvatars.length > 0) {
                    console.log('[RPG Companion] Generating avatars for:', charactersNeedingAvatars);
                    
                    // Generate avatars - this awaits completion
                    await generateAvatarsForCharacters(charactersNeedingAvatars, (names) => {
                        // Callback when generation starts - re-render to show loading spinners
                        console.log('[RPG Companion] Avatar generation started, showing spinners...');
                        renderThoughts();
                    });

                    // Re-render once all avatars are generated
                    console.log('[RPG Companion] All avatars generated, re-rendering...');
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
        // Restore original preset if we switched to a separate one
        if (originalPresetName && extensionSettings.useSeparatePreset) {
            console.log(`[RPG Companion] Restoring original preset: "${originalPresetName}"`);
            await switchToPreset(originalPresetName);
            originalPresetName = null; // Clear after restoring
        }

        setIsGenerating(false);

        // Restore button to original state
        const $updateBtn = $('#rpg-manual-update');
        const refreshText = i18n.getTranslation('template.mainPanel.refreshRpgInfo') || 'Refresh RPG Info';
        $updateBtn.html(`<i class="fa-solid fa-sync"></i> ${refreshText}`).prop('disabled', false);

        // Reset the flag after tracker generation completes
        // This ensures the flag persists through both main generation AND tracker generation
        // console.log('[RPG Companion] 🔄 Tracker generation complete - resetting lastActionWasSwipe to false');
        setLastActionWasSwipe(false);
    }
}

/**
 * Parses character names from Present Characters thoughts data
 * @param {string} characterThoughtsData - Raw character thoughts data
 * @returns {Array<string>} Array of character names found
 */
function parseCharactersFromThoughts(characterThoughtsData) {
    if (!characterThoughtsData) return [];

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
