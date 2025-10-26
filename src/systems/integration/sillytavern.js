/**
 * SillyTavern Integration Module
 * Handles all event listeners and integration with SillyTavern's event system
 */

import { getContext } from '../../../../../../extensions.js';
import { chat, user_avatar, setExtensionPrompt, extension_prompt_types } from '../../../../../../../script.js';

// Core modules
import {
    extensionSettings,
    lastGeneratedData,
    committedTrackerData,
    lastActionWasSwipe,
    isPlotProgression,
    setLastActionWasSwipe,
    setIsPlotProgression,
    updateLastGeneratedData,
    updateCommittedTrackerData
} from '../../core/state.js';
import { saveChatData, loadChatData } from '../../core/persistence.js';

// Generation & Parsing
import { parseResponse, parseUserStats } from '../generation/parser.js';
import { updateRPGData } from '../generation/apiClient.js';

// Rendering
import { renderUserStats } from '../rendering/userStats.js';
import { renderInfoBox } from '../rendering/infoBox.js';
import { renderThoughts, updateChatThoughts } from '../rendering/thoughts.js';
import { renderInventory } from '../rendering/inventory.js';
import { renderQuests } from '../rendering/quests.js';

// Utils
import { getSafeThumbnailUrl } from '../../utils/avatars.js';

/**
 * Commits the tracker data from the last assistant message to be used as source for next generation.
 * This should be called when the user has replied to a message, ensuring all swipes of the next
 * response use the same committed context.
 */
export function commitTrackerData() {
    const chat = getContext().chat;
    if (!chat || chat.length === 0) {
        return;
    }

    // Find the last assistant message
    for (let i = chat.length - 1; i >= 0; i--) {
        const message = chat[i];
        if (!message.is_user) {
            // Found last assistant message - commit its tracker data
            if (message.extra && message.extra.rpg_companion_swipes) {
                const swipeId = message.swipe_id || 0;
                const swipeData = message.extra.rpg_companion_swipes[swipeId];

                if (swipeData) {
                    // console.log('[RPG Companion] Committing tracker data from assistant message at index', i, 'swipe', swipeId);
                    committedTrackerData.userStats = swipeData.userStats || null;
                    committedTrackerData.infoBox = swipeData.infoBox || null;
                    committedTrackerData.characterThoughts = swipeData.characterThoughts || null;
                } else {
                    // console.log('[RPG Companion] No swipe data found for swipe', swipeId);
                }
            } else {
                // console.log('[RPG Companion] No RPG data found in last assistant message');
            }
            break;
        }
    }
}

/**
 * Event handler for when the user sends a message.
 * Sets the flag to indicate this is NOT a swipe.
 */
export function onMessageSent() {
    if (!extensionSettings.enabled) return;

    // User sent a new message - NOT a swipe
    setLastActionWasSwipe(false);
    // console.log('[RPG Companion] 🟢 EVENT: onMessageSent - lastActionWasSwipe =', lastActionWasSwipe);
}

/**
 * Event handler for when a message is generated.
 */
export async function onMessageReceived(data) {
    if (!extensionSettings.enabled) {
        return;
    }

    if (extensionSettings.generationMode === 'together') {
        // In together mode, parse the response to extract RPG data
        // The message should be in chat[chat.length - 1]
        const lastMessage = chat[chat.length - 1];
        if (lastMessage && !lastMessage.is_user) {
            const responseText = lastMessage.mes;
            // console.log('[RPG Companion] Parsing together mode response:', responseText);

            const parsedData = parseResponse(responseText);

            // Update stored data
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

            // Store RPG data for this specific swipe in the message's extra field
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

            // console.log('[RPG Companion] Stored RPG data for swipe', currentSwipeId);

            // If there's no committed data yet (first time generating), automatically commit
            if (!committedTrackerData.userStats && !committedTrackerData.infoBox && !committedTrackerData.characterThoughts) {
                committedTrackerData.userStats = parsedData.userStats;
                committedTrackerData.infoBox = parsedData.infoBox;
                committedTrackerData.characterThoughts = parsedData.characterThoughts;
                // console.log('[RPG Companion] 🔆 FIRST TIME: Auto-committed tracker data');
            } else {
                // console.log('[RPG Companion] Data will be committed when user replies');
            }

            // Remove the tracker code blocks from the visible message
            let cleanedMessage = responseText;
            // Remove all code blocks that contain tracker data
            cleanedMessage = cleanedMessage.replace(/```[^`]*?Stats\s*\n\s*---[^`]*?```\s*/gi, '');
            cleanedMessage = cleanedMessage.replace(/```[^`]*?Info Box\s*\n\s*---[^`]*?```\s*/gi, '');
            cleanedMessage = cleanedMessage.replace(/```[^`]*?Present Characters\s*\n\s*---[^`]*?```\s*/gi, '');
            // Remove any stray "---" dividers that might appear after the code blocks
            cleanedMessage = cleanedMessage.replace(/^\s*---\s*$/gm, '');
            // Clean up multiple consecutive newlines
            cleanedMessage = cleanedMessage.replace(/\n{3,}/g, '\n\n');

            // Update the message in chat history
            lastMessage.mes = cleanedMessage.trim();

            // Update the swipe text as well
            if (lastMessage.swipes && lastMessage.swipes[currentSwipeId] !== undefined) {
                lastMessage.swipes[currentSwipeId] = cleanedMessage.trim();
            }

            // console.log('[RPG Companion] Cleaned message, removed tracker code blocks');

            // Render the updated data
            renderUserStats();
            renderInfoBox();
            renderThoughts();
            renderInventory();
            renderQuests();

            // Save to chat metadata
            saveChatData();
        }
    } else if (extensionSettings.generationMode === 'separate' && extensionSettings.autoUpdate) {
        // In separate mode with auto-update, trigger update after message
        setTimeout(async () => {
            await updateRPGData(renderUserStats, renderInfoBox, renderThoughts, renderInventory);
        }, 500);
    }

    // Reset the swipe flag after generation completes
    // This ensures that if the user swiped → auto-reply generated → flag is now cleared
    // so the next user message will be treated as a new message (not a swipe)
    if (lastActionWasSwipe) {
        // console.log('[RPG Companion] 🔄 Generation complete after swipe - resetting lastActionWasSwipe to false');
        setLastActionWasSwipe(false);
    }

    // Clear plot progression flag if this was a plot progression generation
    // Note: No need to clear extension prompt since we used quiet_prompt option
    if (isPlotProgression) {
        setIsPlotProgression(false);
        // console.log('[RPG Companion] Plot progression generation completed');
    }
}

/**
 * Event handler for character change.
 */
export function onCharacterChanged() {
    // Remove thought panel and icon when changing characters
    $('#rpg-thought-panel').remove();
    $('#rpg-thought-icon').remove();
    $('#chat').off('scroll.thoughtPanel');
    $(window).off('resize.thoughtPanel');
    $(document).off('click.thoughtPanel');

    // Load chat-specific data when switching chats
    loadChatData();

    // Commit tracker data from the last assistant message to initialize for this chat
    commitTrackerData();

    // Re-render with the loaded data
    renderUserStats();
    renderInfoBox();
    renderThoughts();
    renderInventory();
    renderQuests();

    // Update chat thought overlays
    updateChatThoughts();
}

/**
 * Event handler for when a message is swiped.
 * Loads the RPG data for the swipe the user navigated to.
 */
export function onMessageSwiped(messageIndex) {
    if (!extensionSettings.enabled) {
        return;
    }

    // console.log('[RPG Companion] Message swiped at index:', messageIndex);

    // Get the message that was swiped
    const message = chat[messageIndex];
    if (!message || message.is_user) {
        return;
    }

    const currentSwipeId = message.swipe_id || 0;

    // Only set flag to true if this swipe will trigger a NEW generation
    // Check if the swipe already exists (has content in the swipes array)
    const isExistingSwipe = message.swipes &&
                           message.swipes[currentSwipeId] !== undefined &&
                           message.swipes[currentSwipeId] !== null &&
                           message.swipes[currentSwipeId].length > 0;

    if (!isExistingSwipe) {
        // This is a NEW swipe that will trigger generation
        setLastActionWasSwipe(true);
        // console.log('[RPG Companion] 🔵 EVENT: onMessageSwiped (NEW generation) - lastActionWasSwipe =', lastActionWasSwipe);
    } else {
        // This is navigating to an EXISTING swipe - don't change the flag
        // console.log('[RPG Companion] 🔵 EVENT: onMessageSwiped (existing swipe navigation) - lastActionWasSwipe unchanged =', lastActionWasSwipe);
    }

    // console.log('[RPG Companion] Loading data for swipe', currentSwipeId);

    // Load RPG data for this swipe into lastGeneratedData (for display only)
    // This updates what the user sees, but does NOT commit it
    // Committed data will be updated when/if the user replies to this swipe
    if (message.extra && message.extra.rpg_companion_swipes && message.extra.rpg_companion_swipes[currentSwipeId]) {
        const swipeData = message.extra.rpg_companion_swipes[currentSwipeId];

        // Update display data
        lastGeneratedData.userStats = swipeData.userStats || null;
        lastGeneratedData.infoBox = swipeData.infoBox || null;
        lastGeneratedData.characterThoughts = swipeData.characterThoughts || null;

        // Parse user stats if available
        if (swipeData.userStats) {
            parseUserStats(swipeData.userStats);
        }

        // console.log('[RPG Companion] Loaded RPG data for swipe', currentSwipeId, '(display only, NOT committed)');
        // console.log('[RPG Companion] committedTrackerData unchanged - will be updated if user replies to this swipe');
    } else {
        // No data for this swipe - keep existing lastGeneratedData (don't clear it)
        // This ensures the display remains consistent and data is available for next commit
        // console.log('[RPG Companion] No RPG data for swipe', currentSwipeId, '- keeping existing lastGeneratedData');
    }

    // Re-render the panels (display only - committedTrackerData unchanged)
    renderUserStats();
    renderInfoBox();
    renderThoughts();
    renderInventory();
    renderQuests();

    // Update chat thought overlays
    updateChatThoughts();
}

/**
 * Update the persona avatar image when user switches personas
 */
export function updatePersonaAvatar() {
    const portraitImg = document.querySelector('.rpg-user-portrait');
    if (!portraitImg) {
        // console.log('[RPG Companion] Portrait image element not found in DOM');
        return;
    }

    // Get current user_avatar from context instead of using imported value
    const context = getContext();
    const currentUserAvatar = context.user_avatar || user_avatar;

    // console.log('[RPG Companion] Attempting to update persona avatar:', currentUserAvatar);

    // Try to get a valid thumbnail URL using our safe helper
    if (currentUserAvatar) {
        const thumbnailUrl = getSafeThumbnailUrl('persona', currentUserAvatar);

        if (thumbnailUrl) {
            // Only update the src if we got a valid URL
            portraitImg.src = thumbnailUrl;
            // console.log('[RPG Companion] Persona avatar updated successfully');
        } else {
            // Don't update the src if we couldn't get a valid URL
            // This prevents 400 errors and keeps the existing image
            // console.warn('[RPG Companion] Could not get valid thumbnail URL for persona avatar, keeping existing image');
        }
    } else {
        // console.log('[RPG Companion] No user avatar configured, keeping existing image');
    }
}

/**
 * Clears all extension prompts.
 */
export function clearExtensionPrompts() {
    setExtensionPrompt('rpg-companion-inject', '', extension_prompt_types.IN_CHAT, 0, false);
    setExtensionPrompt('rpg-companion-example', '', extension_prompt_types.IN_CHAT, 0, false);
    setExtensionPrompt('rpg-companion-html', '', extension_prompt_types.IN_CHAT, 0, false);
    setExtensionPrompt('rpg-companion-context', '', extension_prompt_types.IN_CHAT, 1, false);
    // Note: rpg-companion-plot is not cleared here since it's passed via quiet_prompt option
    // console.log('[RPG Companion] Cleared all extension prompts');
}
