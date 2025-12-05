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
    setIsGenerating
} from '../../core/state.js';
import { saveChatData } from '../../core/persistence.js';
import { generateSeparateUpdatePrompt } from './promptBuilder.js';
import { parseResponse, parseUserStats, parseSkills, tryParseJSONResponse } from './parser.js';
import { renderQuests } from '../rendering/quests.js';
import { renderSkills } from '../rendering/skills.js';
import { i18n } from '../../core/i18n.js';

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

        if (result && typeof result === 'object' && result.pipe) {
            const presetName = String(result.pipe).trim();
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
        await executeSlashCommandsOnChatInput(`/preset ${presetName}`, { quiet: true });
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
        return;
    }

    if (!extensionSettings.enabled) {
        return;
    }

    if (extensionSettings.generationMode !== 'separate') {
        return;
    }

    try {
        setIsGenerating(true);

        // Update button to show "Updating..." state
        const $updateBtn = $('#rpg-manual-update');
        const updatingText = i18n.getTranslation('template.mainPanel.updating') || 'Updating...';
        $updateBtn.html(`<i class="fa-solid fa-spinner fa-spin"></i> ${updatingText}`).prop('disabled', true);

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

        const prompt = await generateSeparateUpdatePrompt();

        // Generate using raw prompt (uses current preset, no chat history)
        const response = await generateRaw({
            prompt: prompt,
            quietToLoud: false
        });

        if (response) {
            const jsonParsed = tryParseJSONResponse(response);
            
            if (jsonParsed) {
                // JSON parsing succeeded - render all sections
                console.log('[RPG Companion] JSON parsing successful');
                renderUserStats();
                renderInfoBox();
                renderThoughts();
                renderInventory();
                renderQuests();
                renderSkills();
                saveChatData();
            } else {
                console.warn('[RPG Companion] JSON parsing failed, attempting legacy text parsing...');
                const parsedData = parseResponse(response);

                extensionSettings.charactersData = [];
                const parsedCharacterThoughts = parsedData.characterThoughts || '';

                const lastMessage = chat && chat.length > 0 ? chat[chat.length - 1] : null;
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
                        characterThoughts: parsedCharacterThoughts
                    };

                    if (parsedData.userStats) {
                    lastGeneratedData.userStats = parsedData.userStats;
                    parseUserStats(parsedData.userStats);
                }
                if (parsedData.skills) {
                    parseSkills(parsedData.skills);
                }
                if (parsedData.infoBox) {
                    lastGeneratedData.infoBox = parsedData.infoBox;
                }
                    lastGeneratedData.characterThoughts = parsedCharacterThoughts;

                    const hasAnyCommittedContent = (
                        (committedTrackerData.userStats && committedTrackerData.userStats.trim() !== '') ||
                        (committedTrackerData.infoBox && committedTrackerData.infoBox.trim() !== '' && committedTrackerData.infoBox !== 'Info Box\n---\n') ||
                        (committedTrackerData.characterThoughts && committedTrackerData.characterThoughts.trim() !== '' && committedTrackerData.characterThoughts !== 'Present Characters\n---\n')
                    );

                    if (!hasAnyCommittedContent) {
                        committedTrackerData.userStats = parsedData.userStats;
                        committedTrackerData.infoBox = parsedData.infoBox;
                        committedTrackerData.characterThoughts = parsedCharacterThoughts;
                    }

                // Render the updated data
                renderUserStats();
                renderInfoBox();
                lastGeneratedData.characterThoughts = parsedCharacterThoughts;
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
                lastGeneratedData.characterThoughts = parsedCharacterThoughts;
                renderThoughts();
                renderInventory();
                renderQuests();
            }

                // Save to chat metadata
                saveChatData();
            }
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

        const $updateBtn = $('#rpg-manual-update');
        const refreshText = i18n.getTranslation('template.mainPanel.refreshRpgInfo') || 'Refresh RPG Info';
        $updateBtn.html(`<i class="fa-solid fa-sync"></i> ${refreshText}`).prop('disabled', false);
        setLastActionWasSwipe(false);
    }
}
