/**
 * SillyTavern Integration Module
 * Handles all event listeners and integration with SillyTavern's event system
 */

import { getContext } from '../../../../../../extensions.js';
import { chat, user_avatar, setExtensionPrompt, extension_prompt_types, saveChatDebounced } from '../../../../../../../script.js';

// Core modules
import {
    extensionSettings,
    lastGeneratedData,
    committedTrackerData,
    lastActionWasSwipe,
    isPlotProgression,
    setLastActionWasSwipe,
    setIsPlotProgression,
    setIsGenerating,
    updateLastGeneratedData,
    updateCommittedTrackerData,
    $musicPlayerContainer
} from '../../core/state.js';
import { saveChatData, loadChatData } from '../../core/persistence.js';
import { i18n } from '../../core/i18n.js';

// Generation & Parsing
import { parseResponse, parseUserStats } from '../generation/parser.js';
import { parseAndStoreSpotifyUrl, convertToEmbedUrl } from '../features/musicPlayer.js';
import { updateRPGData } from '../generation/apiClient.js';
import { removeLocks } from '../generation/lockManager.js';
import { onGenerationStarted } from '../generation/injector.js';

// Rendering
import { renderUserStats } from '../rendering/userStats.js';
import { renderInfoBox } from '../rendering/infoBox.js';
import { renderThoughts, updateChatThoughts } from '../rendering/thoughts.js';
import { renderInventory } from '../rendering/inventory.js';
import { renderQuests } from '../rendering/quests.js';
import { renderMusicPlayer } from '../rendering/musicPlayer.js';

// Utils
import { getSafeThumbnailUrl } from '../../utils/avatars.js';

// Chapter checkpoint
import { updateAllCheckpointIndicators } from '../ui/checkpointUI.js';
import { restoreCheckpointOnLoad } from '../features/chapterCheckpoint.js';

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
 * In together mode, commits displayed data (only for real messages, not streaming placeholders).
 */
export function onMessageSent() {
    if (!extensionSettings.enabled) return;

    // console.log('[RPG Companion] 🟢 EVENT: onMessageSent - lastActionWasSwipe =', lastActionWasSwipe);

    // Check if this is a streaming placeholder message (content = "...")
    // When streaming is on, ST sends a "..." placeholder before generation starts
    const context = getContext();
    const chat = context.chat;
    const lastMessage = chat && chat.length > 0 ? chat[chat.length - 1] : null;

    if (lastMessage && lastMessage.mes === '...') {
        // console.log('[RPG Companion] 🟢 Ignoring onMessageSent: streaming placeholder message');
        return;
    }

    // console.log('[RPG Companion] 🟢 EVENT: onMessageSent (after placeholder check)');
    // console.log('[RPG Companion] 🟢 NOTE: lastActionWasSwipe will be reset in onMessageReceived after generation completes');

    // For separate mode with auto-update disabled, commit displayed tracker
    if (extensionSettings.generationMode === 'separate' && !extensionSettings.autoUpdate) {
        if (lastGeneratedData.userStats || lastGeneratedData.infoBox || lastGeneratedData.characterThoughts) {
            committedTrackerData.userStats = lastGeneratedData.userStats;
            committedTrackerData.infoBox = lastGeneratedData.infoBox;
            committedTrackerData.characterThoughts = lastGeneratedData.characterThoughts;

            // console.log('[RPG Companion] 💾 SEPARATE MODE: Committed displayed tracker (auto-update disabled)');
        }
    }
}

/**
 * Event handler for when a message is generated.
 */
export async function onMessageReceived(data) {
    // console.log('[RPG Companion] onMessageReceived called, lastActionWasSwipe:', lastActionWasSwipe);

    if (!extensionSettings.enabled) {
        return;
    }

    // Reset swipe flag after generation completes
    // This ensures next user message (whether from original or swipe) triggers commit
    setLastActionWasSwipe(false);
    // console.log('[RPG Companion] 🟢 Reset lastActionWasSwipe = false (generation completed)');

    if (extensionSettings.generationMode === 'together') {
        // In together mode, parse the response to extract RPG data
        // Commit happens in onMessageSent (when user sends message, before generation)
        const lastMessage = chat[chat.length - 1];
        if (lastMessage && !lastMessage.is_user) {
            const responseText = lastMessage.mes;
            const parsedData = parseResponse(responseText);

            // Note: Don't show parsing error here - this event fires when loading chat history too
            // Error notification is handled in apiClient.js for fresh generations only

            // Remove locks from parsed data (JSON format only, text format is unaffected)
            if (parsedData.userStats) {
                parsedData.userStats = removeLocks(parsedData.userStats);
            }
            if (parsedData.infoBox) {
                parsedData.infoBox = removeLocks(parsedData.infoBox);
            }
            if (parsedData.characterThoughts) {
                parsedData.characterThoughts = removeLocks(parsedData.characterThoughts);
            }

            // Parse and store Spotify URL if feature is enabled
            parseAndStoreSpotifyUrl(responseText);

            // Update display data with newly parsed response
            // console.log('[RPG Companion] 📝 TOGETHER MODE: Updating lastGeneratedData with parsed response');
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

            // Remove the tracker code blocks from the visible message
            let cleanedMessage = responseText;

            // Only remove trackers if saveTrackerHistory is disabled
            // When enabled, trackers are in <trackers> XML tags which SillyTavern auto-hides
            if (!extensionSettings.saveTrackerHistory) {
                // Note: JSON code blocks are hidden from display by regex script (but preserved in message data)

                // Remove old text format code blocks (legacy support)
                cleanedMessage = cleanedMessage.replace(/```[^`]*?Stats\s*\n\s*---[^`]*?```\s*/gi, '');
                cleanedMessage = cleanedMessage.replace(/```[^`]*?Info Box\s*\n\s*---[^`]*?```\s*/gi, '');
                cleanedMessage = cleanedMessage.replace(/```[^`]*?Present Characters\s*\n\s*---[^`]*?```\s*/gi, '');
                // Remove any stray "---" dividers that might appear after the code blocks
                cleanedMessage = cleanedMessage.replace(/^\s*---\s*$/gm, '');
                // Clean up multiple consecutive newlines
                cleanedMessage = cleanedMessage.replace(/\n{3,}/g, '\n\n');
            }
            // Note: <trackers> XML tags are automatically hidden by SillyTavern
            // Note: <Song - Artist/> tags are also automatically hidden by SillyTavern

            // Update the message in chat history
            lastMessage.mes = cleanedMessage.trim();

            // Update the swipe text as well
            if (lastMessage.swipes && lastMessage.swipes[currentSwipeId] !== undefined) {
                lastMessage.swipes[currentSwipeId] = cleanedMessage.trim();
            }

            // Render the updated data FIRST (before cleaning DOM)
            renderUserStats();
            renderInfoBox();
            renderThoughts();
            renderInventory();
            renderQuests();
            renderMusicPlayer($musicPlayerContainer[0]);

            // Then update the DOM to reflect the cleaned message
            // Using updateMessageBlock to perform macro substitutions + regex formatting
            const messageId = chat.length - 1;
            updateMessageBlock(messageId, lastMessage, { rerenderMessage: true });

            // console.log('[RPG Companion] Cleaned message, removed tracker code blocks from DOM');

            // Save to chat metadata
            saveChatData();
        }
    } else if (extensionSettings.generationMode === 'separate' || extensionSettings.generationMode === 'external') {
        // In separate/external mode, also parse Spotify URLs from the main roleplay response
        const lastMessage = chat[chat.length - 1];
        if (lastMessage && !lastMessage.is_user) {
            const responseText = lastMessage.mes;

            // Parse and store Spotify URL
            const foundSpotifyUrl = parseAndStoreSpotifyUrl(responseText);

            // No need to clean message - SillyTavern auto-hides <Song - Artist/> tags
            if (foundSpotifyUrl && extensionSettings.enableSpotifyMusic) {
                // Just render the music player
                renderMusicPlayer($musicPlayerContainer[0]);
            }
        }

        // Trigger auto-update if enabled (for both separate and external modes)
        if (extensionSettings.autoUpdate) {
            setTimeout(async () => {
                await updateRPGData(renderUserStats, renderInfoBox, renderThoughts, renderInventory);
            }, 500);
        }
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

    // Re-apply checkpoint in case SillyTavern unhid messages during generation
    await restoreCheckpointOnLoad();
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

    // Don't call commitTrackerData() here - it would overwrite the loaded committedTrackerData
    // with data from the last message, which may be null/empty. The loaded committedTrackerData
    // already contains the committed state from when we last left this chat.
    // commitTrackerData() will be called naturally when new messages arrive.

    // Re-render with the loaded data
    renderUserStats();
    renderInfoBox();
    renderThoughts();
    renderInventory();
    renderQuests();
    renderMusicPlayer($musicPlayerContainer[0]);

    // Update chat thought overlays
    updateChatThoughts();

    // Update checkpoint indicators for the loaded chat
    updateAllCheckpointIndicators();
}

/**
 * Event handler for when a message is swiped.
 * Loads the RPG data for the swipe the user navigated to.
 */
export function onMessageSwiped(messageIndex) {
    if (!extensionSettings.enabled) {
        return;
    }

    // console.log('[RPG Companion] 🔵 EVENT: onMessageSwiped at index:', messageIndex);

    // Get the message that was swiped
    const message = chat[messageIndex];
    if (!message || message.is_user) {
        // console.log('[RPG Companion] 🔵 Ignoring swipe - message is user or undefined');
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
        // console.log('[RPG Companion] 🔵 NEW swipe detected - Set lastActionWasSwipe = true');
    } else {
        // This is navigating to an EXISTING swipe - don't change the flag
        // console.log('[RPG Companion] 🔵 EXISTING swipe navigation - lastActionWasSwipe unchanged =', lastActionWasSwipe);
    }

    // console.log('[RPG Companion] Loading data for swipe', currentSwipeId);

    // Load RPG data for this swipe
    // lastGeneratedData is for DISPLAY, committedTrackerData is for GENERATION
    // It's safe to load swipe data into lastGeneratedData - it won't be committed due to !lastActionWasSwipe check
    if (message.extra && message.extra.rpg_companion_swipes && message.extra.rpg_companion_swipes[currentSwipeId]) {
        const swipeData = message.extra.rpg_companion_swipes[currentSwipeId];

        // Load swipe data into lastGeneratedData for display (both modes)
        lastGeneratedData.userStats = swipeData.userStats || null;
        lastGeneratedData.infoBox = swipeData.infoBox || null;
        lastGeneratedData.characterThoughts = swipeData.characterThoughts || null;

        // Parse user stats if available
        if (swipeData.userStats) {
            parseUserStats(swipeData.userStats);
        }

        // console.log('[RPG Companion] 🔄 Loaded swipe data into lastGeneratedData for display:', currentSwipeId);
    } else {
        // console.log('[RPG Companion] ℹ️ No stored data for swipe:', currentSwipeId);
    }

    // Re-render the panels
    renderUserStats();
    renderInfoBox();
    renderThoughts();
    renderInventory();
    renderQuests();
    renderMusicPlayer($musicPlayerContainer[0]);

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
    setExtensionPrompt('rpg-companion-dialogue-coloring', '', extension_prompt_types.IN_CHAT, 0, false);
    setExtensionPrompt('rpg-companion-spotify', '', extension_prompt_types.IN_CHAT, 0, false);
    setExtensionPrompt('rpg-companion-context', '', extension_prompt_types.IN_CHAT, 1, false);
    // Note: rpg-companion-plot is not cleared here since it's passed via quiet_prompt option
    // console.log('[RPG Companion] Cleared all extension prompts');
}

/**
 * Event handler for when generation stops or ends
 * Re-applies checkpoint if SillyTavern unhid messages
 */
export async function onGenerationEnded() {
    // console.log('[RPG Companion] 🏁 onGenerationEnded called');

    // Note: isGenerating flag is cleared in onMessageReceived after parsing (together mode)
    // or in apiClient.js after separate generation completes (separate mode)

    // SillyTavern may auto-unhide messages when generation stops
    // Re-apply checkpoint if one exists
    await restoreCheckpointOnLoad();
}
