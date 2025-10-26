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
import { generateSeparateUpdatePrompt } from './promptBuilder.js';
import { parseResponse, parseUserStats } from './parser.js';
import { renderUserStats } from '../rendering/userStats.js';
import { renderInfoBox } from '../rendering/infoBox.js';
import { renderThoughts } from '../rendering/thoughts.js';
import { renderInventory } from '../rendering/inventory.js';
import { renderQuests } from '../rendering/quests.js';

// Store the original preset name to restore after tracker generation
let originalPresetName = null;

/**
 * Gets the current preset name using the /preset command
 * @returns {Promise<string|null>} Current preset name or null if unavailable
 */
async function getCurrentPresetName() {
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
}/**
 * Switches to a specific preset by name using the /preset slash command
 * @param {string} presetName - Name of the preset to switch to
 * @returns {Promise<boolean>} True if switching succeeded, false otherwise
 */
async function switchToPreset(presetName) {
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

    if (extensionSettings.generationMode !== 'separate') {
        // console.log('[RPG Companion] Not in separate mode, skipping manual update');
        return;
    }

    try {
        setIsGenerating(true);

        // Update button to show "Updating..." state
        const $updateBtn = $('#rpg-manual-update');
        const originalHtml = $updateBtn.html();
        $updateBtn.html('<i class="fa-solid fa-spinner fa-spin"></i> Updating...').prop('disabled', true);

        // Save current preset name before switching (if we're going to switch)
        if (extensionSettings.useSeparatePreset) {
            originalPresetName = await getCurrentPresetName();
            console.log(`[RPG Companion] Saved original preset: "${originalPresetName}"`);
        }

        // Switch to separate preset if enabled
        if (extensionSettings.useSeparatePreset) {
            const switched = await switchToPreset('RPG Companion Trackers');
            if (!switched) {
                console.warn('[RPG Companion] Failed to switch to RPG Companion Trackers preset. Using current preset.');
                originalPresetName = null; // Don't try to restore if we didn't switch
            }
        }

        const prompt = generateSeparateUpdatePrompt();

        // Generate using raw prompt (uses current preset, no chat history)
        const response = await generateRaw({
            prompt: prompt,
            quietToLoud: false
        });

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

                // Update lastGeneratedData for display AND future commit
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
                // console.log('[RPG Companion] 💾 SEPARATE MODE: Updated lastGeneratedData:', {
                //     userStats: lastGeneratedData.userStats ? 'exists' : 'null',
                //     infoBox: lastGeneratedData.infoBox ? 'exists' : 'null',
                //     characterThoughts: lastGeneratedData.characterThoughts ? 'exists' : 'null'
                // });

                // Only auto-commit on TRULY first generation (no committed data exists at all)
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
            } else {
                // No assistant message to attach to - just update display
                if (parsedData.userStats) {
                    parseUserStats(parsedData.userStats);
                }
                renderUserStats();
                renderInfoBox();
                renderThoughts();
                renderInventory();
                renderQuests();
            }

            // Save to chat metadata
            saveChatData();
        }

    } catch (error) {
        console.error('[RPG Companion] Error updating RPG data:', error);
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
        $updateBtn.html('<i class="fa-solid fa-sync"></i> Refresh RPG Info').prop('disabled', false);

        // Reset the flag after tracker generation completes
        // This ensures the flag persists through both main generation AND tracker generation
        // console.log('[RPG Companion] 🔄 Tracker generation complete - resetting lastActionWasSwipe to false');
        setLastActionWasSwipe(false);
    }
}
