/**
 * SillyTavern Integration Module
 * Handles all event listeners and integration with SillyTavern's event system
 */

import { getContext } from '../../../../../../extensions.js';
import { chat, chat_metadata, user_avatar, setExtensionPrompt, extension_prompt_types } from '../../../../../../../script.js';

// Core modules
import {
    extensionSettings,
    lastGeneratedData,
    committedTrackerData,
    lastActionWasSwipe,
    isPlotProgression,
    isAwaitingNewMessage,
    setLastActionWasSwipe,
    setIsPlotProgression,
    setIsGenerating,
    setIsAwaitingNewMessage,
    updateLastGeneratedData,
    updateCommittedTrackerData,
    $musicPlayerContainer,
    incrementSeparateGenerationId
} from '../../core/state.js';
import {
    saveChatData,
    loadChatData,
    autoSwitchPresetForEntity,
    getMessageSwipeTrackerData,
    getCurrentMessageSwipeTrackerData,
    restoreLatestTrackerStateFromChat,
    setMessageSwipeTrackerData,
    getSwipeData,
    commitTrackerDataFromPriorMessage,
    inheritSwipeDataFromPriorMessage,
    flushDeferredChatDataSave
} from '../../core/persistence.js';
import { i18n } from '../../core/i18n.js';

// Generation & Parsing
import { parseResponse, parseUserStats } from '../generation/parser.js';
import { parseAndStoreSpotifyUrl, convertToEmbedUrl } from '../features/musicPlayer.js';
import { updateRPGData } from '../generation/apiClient.js';
import { removeLocks } from '../generation/lockManager.js';
import { onGenerationStarted, initHistoryInjectionListeners } from '../generation/injector.js';

// Rendering
import { renderUserStats } from '../rendering/userStats.js';
import { renderInfoBox } from '../rendering/infoBox.js';
import { renderThoughts, updateChatThoughts } from '../rendering/thoughts.js';
import { renderInventory } from '../rendering/inventory.js';
import { renderQuests } from '../rendering/quests.js';
import { renderMusicPlayer } from '../rendering/musicPlayer.js';

// Utils
import { getSafeThumbnailUrl } from '../../utils/avatars.js';

// UI
import { setFabLoadingState, updateFabWidgets } from '../ui/mobile.js';
import { updateStripWidgets } from '../ui/desktop.js';

// Chapter checkpoint
import { updateAllCheckpointIndicators } from '../ui/checkpointUI.js';
import { restoreCheckpointOnLoad } from '../features/chapterCheckpoint.js';

let chatStateRehydrateRunId = 0;

/**
 * Reads the swipe store of the last assistant message in `currentChat` and
 * writes its data into `lastGeneratedData`, including syncing stat bars via
 * `parseUserStats`.  If no assistant message exists, or none has stored swipe
 * data, `lastGeneratedData` is left unchanged.
 *
 * Use this wherever the displayed tracker state must be re-derived from the
 * authoritative swipe store rather than from chat_metadata (e.g. after a
 * CHAT_CHANGED caused by branching, or after a message deletion).
 *
 * @param {Array} currentChat - Live chat array from getContext().chat
 * @returns {boolean} True if swipe data was found and applied
 */
function syncLastGeneratedDataFromSwipeStore(currentChat) {
    for (let i = currentChat.length - 1; i >= 0; i--) {
        const msg = currentChat[i];
        if (!msg.is_user && !msg.is_system) {
            const swipeId = msg.swipe_id || 0;
            const swipeData = getSwipeData(msg, swipeId);
            if (swipeData) {
                lastGeneratedData.userStats = swipeData.userStats || null;
                lastGeneratedData.infoBox = swipeData.infoBox || null;
                // Normalize characterThoughts to string (backward compat with old object format).
                if (swipeData.characterThoughts && typeof swipeData.characterThoughts === 'object') {
                    lastGeneratedData.characterThoughts = JSON.stringify(swipeData.characterThoughts, null, 2);
                } else {
                    lastGeneratedData.characterThoughts = swipeData.characterThoughts || null;
                }
                if (swipeData.userStats) {
                    parseUserStats(swipeData.userStats);
                }
                return true;
            }
            return false; // Last assistant message exists but has no swipe data yet
        }
    }
    return false; // No assistant messages in chat
}

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
        if (!message.is_user && !message.is_system) {
            // Found last assistant message - commit its tracker data
            const swipeId = message.swipe_id || 0;
            const swipeData = getSwipeData(message, swipeId);

            if (swipeData) {
                // console.log('[RPG Companion] Committing tracker data from assistant message at index', i, 'swipe', swipeId);
                committedTrackerData.userStats = swipeData.userStats || null;
                committedTrackerData.infoBox = swipeData.infoBox || null;
                const rawCharacterThoughts = swipeData.characterThoughts;
                if (rawCharacterThoughts == null) {
                    committedTrackerData.characterThoughts = null;
                } else if (typeof rawCharacterThoughts === 'object') {
                    committedTrackerData.characterThoughts = JSON.stringify(rawCharacterThoughts);
                } else {
                    committedTrackerData.characterThoughts = String(rawCharacterThoughts);
                }
            } else {
                // No saved swipe data — treat as empty (e.g. first message, no prior generation)
                committedTrackerData.userStats = null;
                committedTrackerData.infoBox = null;
                committedTrackerData.characterThoughts = null;
            }
            break;
        }
    }
}

function getSwipeTrackerData(message) {
    return getMessageSwipeTrackerData(message);
}

function getCurrentSwipeTrackerData(message) {
    return getCurrentMessageSwipeTrackerData(message);
}

function hasAssistantMessageBody() {
    const $messages = $('#chat .mes');

    for (let i = $messages.length - 1; i >= 0; i--) {
        const $message = $messages.eq(i);
        if ($message.attr('is_user') === 'true') continue;
        if ($message.find('.mes_text').length > 0) {
            return true;
        }
    }

    return false;
}

function hasAnyTrackerStateInChat() {
    const chatMessages = getContext()?.chat || [];

    for (let i = chatMessages.length - 1; i >= 0; i--) {
        const swipeData = getSwipeTrackerData(chatMessages[i]);
        if (swipeData?.userStats || swipeData?.infoBox || swipeData?.characterThoughts) {
            return true;
        }
    }

    return false;
}

function hasAssistantMessagesInChat() {
    const chatMessages = getContext()?.chat || [];
    return chatMessages.some(message => message && !message.is_user && !message.is_system);
}

function hasPotentialTrackerSourceInChat() {
    const chatMessages = getContext()?.chat || [];

    for (const message of chatMessages) {
        if (!message || message.is_user || message.is_system) {
            continue;
        }

        if (message.extra?.rpg_companion_swipes) {
            return true;
        }

        if (Array.isArray(message.swipe_info) && message.swipe_info.some(info => info?.extra?.rpg_companion_swipes)) {
            return true;
        }

        if (Array.isArray(message.swipes) && message.swipes.length > 1) {
            return true;
        }
    }

    return false;
}

function maybeRehydrateUserStatsFromDisplayData() {
    const hasSavedUserStats = !!chat_metadata?.rpg_companion?.userStats;
    if (!hasSavedUserStats && lastGeneratedData.userStats) {
        try {
            parseUserStats(lastGeneratedData.userStats);
        } catch (error) {
            console.warn('[RPG Companion] Failed to rebuild user stats from display data:', error);
        }
    }
}

function getCurrentSwipeText(message) {
    const swipeId = Number(message?.swipe_id ?? 0);

    if (Array.isArray(message?.swipes) && typeof message.swipes[swipeId] === 'string' && message.swipes[swipeId].trim()) {
        return message.swipes[swipeId];
    }

    return typeof message?.mes === 'string' ? message.mes : '';
}

/**
 * Resolves the currently active swipe index for a message.
 * Some ST flows can briefly expose a stale message.swipe_id during swipe transitions,
 * so we also match against message.mes in the swipes array when possible.
 *
 * @param {Object} message - Assistant message object
 * @returns {number} Active swipe index
 */
function resolveActiveSwipeId(message) {
    const fallbackSwipeId = Number(message?.swipe_id ?? 0);
    const swipes = Array.isArray(message?.swipes) ? message.swipes : null;

    if (!swipes || swipes.length === 0) {
        return Math.max(0, fallbackSwipeId);
    }

    const currentText = typeof message?.mes === 'string' ? message.mes : '';
    if (currentText) {
        for (let i = swipes.length - 1; i >= 0; i--) {
            if (typeof swipes[i] === 'string' && swipes[i] === currentText) {
                return i;
            }
        }
    }

    if (fallbackSwipeId < 0) {
        return 0;
    }

    return Math.min(fallbackSwipeId, swipes.length - 1);
}

function repairLatestTrackerStateFromCurrentSwipeContent(chatMessages = getContext()?.chat || []) {
    for (let i = chatMessages.length - 1; i >= 0; i--) {
        const message = chatMessages[i];
        if (!message || message.is_user || message.is_system) {
            continue;
        }

        const swipeId = Number(message.swipe_id ?? 0);
        if (getCurrentSwipeTrackerData(message)) {
            continue;
        }

        const currentSwipeText = getCurrentSwipeText(message);
        if (!currentSwipeText) {
            continue;
        }

        const parsedData = parseResponse(currentSwipeText, { suppressNoDataError: true });
        if (parsedData.userStats) {
            parsedData.userStats = removeLocks(parsedData.userStats);
        }
        if (parsedData.infoBox) {
            parsedData.infoBox = removeLocks(parsedData.infoBox);
        }
        if (parsedData.characterThoughts) {
            parsedData.characterThoughts = removeLocks(parsedData.characterThoughts);
        }

        if (!parsedData.userStats && !parsedData.infoBox && !parsedData.characterThoughts) {
            continue;
        }

        setMessageSwipeTrackerData(message, swipeId, {
            userStats: parsedData.userStats || null,
            infoBox: parsedData.infoBox || null,
            characterThoughts: parsedData.characterThoughts || null
        });

        return true;
    }

    return false;
}

function restoreOrRepairLatestTrackerState() {
    const chatMessages = getContext()?.chat || [];
    let restored = restoreLatestTrackerStateFromChat(chatMessages);

    if (!restored) {
        const repaired = repairLatestTrackerStateFromCurrentSwipeContent(chatMessages);
        if (repaired) {
            restored = restoreLatestTrackerStateFromChat(chatMessages);
        }
    }

    return restored;
}

function rerenderRpgState() {
    renderUserStats();
    renderInfoBox();
    renderThoughts();
    renderInventory();
    renderQuests();
    renderMusicPlayer($musicPlayerContainer[0]);
    updateFabWidgets();
    updateStripWidgets();
}

export function scheduleChatStateRehydration() {
    chatStateRehydrateRunId++;
    const runId = chatStateRehydrateRunId;
    let attempts = 0;
    const maxAttempts = 15;
    const eagerRetryAttempts = 4;

    const tryRestoreState = () => {
        if (runId !== chatStateRehydrateRunId) {
            return;
        }

        attempts++;

        loadChatData();
        restoreOrRepairLatestTrackerState();
        maybeRehydrateUserStatsFromDisplayData();
        rerenderRpgState();

        const hasRestoredTrackerState = !!(
            lastGeneratedData.userStats
            || lastGeneratedData.infoBox
            || lastGeneratedData.characterThoughts
            || committedTrackerData.userStats
            || committedTrackerData.infoBox
            || committedTrackerData.characterThoughts
        );
        const hasStoredTrackerState = !!chat_metadata?.rpg_companion || hasAnyTrackerStateInChat();
        const hasAssistantMessages = hasAssistantMessagesInChat();
        const hasPotentialTrackerSource = hasPotentialTrackerSourceInChat();
        const chatBodyReady = hasAssistantMessageBody();

        if (chatBodyReady) {
            updateChatThoughts();
        }

        const shouldRetryForRestore = !hasRestoredTrackerState && (
            hasStoredTrackerState
            || (hasAssistantMessages && attempts < eagerRetryAttempts)
            || (hasPotentialTrackerSource && attempts < maxAttempts)
        );

        const shouldRetryForDom = !chatBodyReady && hasAssistantMessages;

        if ((shouldRetryForRestore || shouldRetryForDom) && attempts < maxAttempts) {
            setTimeout(tryRestoreState, 200);
        }
    };

    setTimeout(tryRestoreState, 200);
}

export function onChatLoaded() {
    loadChatData();
    restoreOrRepairLatestTrackerState();
    maybeRehydrateUserStatsFromDisplayData();
    rerenderRpgState();
    flushDeferredChatDataSave();
    scheduleChatStateRehydration();
    updateAllCheckpointIndicators();
}

function syncDisplayedTrackerStateFromChat() {
    const restored = restoreOrRepairLatestTrackerState();

    if (!restored) {
        lastGeneratedData.userStats = null;
        lastGeneratedData.infoBox = null;
        lastGeneratedData.characterThoughts = null;
        committedTrackerData.userStats = null;
        committedTrackerData.infoBox = null;
        committedTrackerData.characterThoughts = null;
    }

    rerenderRpgState();
    updateChatThoughts();
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

    // Set flag to indicate we're expecting a new message from generation
    // This allows auto-update to distinguish between new generations and loading chat history
    setIsAwaitingNewMessage(true);




    // Note: FAB spinning is NOT shown for together mode since no extra API request is made
    // The RPG data comes embedded in the main response
    // FAB spinning is handled by apiClient.js for separate/external modes when updateRPGData() is called
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
            const rawSwipeId = Number(lastMessage.swipe_id ?? 0);
            const responseText = lastMessage.mes;
            const parsedData = parseResponse(responseText, { suppressNoDataError: true });

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

            const currentSwipeId = resolveActiveSwipeId(lastMessage);

            setMessageSwipeTrackerData(lastMessage, currentSwipeId, {
                userStats: parsedData.userStats,
                infoBox: parsedData.infoBox,
                characterThoughts: parsedData.characterThoughts
            });

            // console.log('[RPG Companion] Stored RPG data for swipe', currentSwipeId);

            // Remove the tracker code blocks from the visible message
            let cleanedMessage = responseText;

            // Note: JSON code blocks are hidden from display by regex script (but preserved in message data)

            // Remove old text format code blocks (legacy support)
            cleanedMessage = cleanedMessage.replace(/```[^`]*?Stats\s*\n\s*---[^`]*?```\s*/gi, '');
            cleanedMessage = cleanedMessage.replace(/```[^`]*?Info Box\s*\n\s*---[^`]*?```\s*/gi, '');
            cleanedMessage = cleanedMessage.replace(/```[^`]*?Present Characters\s*\n\s*---[^`]*?```\s*/gi, '');
            // Remove any stray "---" dividers that might appear after the code blocks
            cleanedMessage = cleanedMessage.replace(/^\s*---\s*$/gm, '');
            // Clean up multiple consecutive newlines
            cleanedMessage = cleanedMessage.replace(/\n{3,}/g, '\n\n');
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

            // Update FAB widgets and strip widgets with newly parsed data
            updateFabWidgets();
            updateStripWidgets();

            // Then update the DOM to reflect the cleaned message
            // Using updateMessageBlock to perform macro substitutions + regex formatting
            const messageId = chat.length - 1;
            updateMessageBlock(messageId, lastMessage, { rerenderMessage: true });

            // console.log('[RPG Companion] Cleaned message, removed tracker code blocks from DOM');

            // Re-insert chat thoughts after SillyTavern finishes rerendering the cleaned message DOM.
            if (parsedData.characterThoughts) {
                setTimeout(() => updateChatThoughts(), 100);
            }

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

            // When auto-update is disabled, no tracker API call will run for this message.
            // Inherit the prior assistant message's tracker data into this swipe slot so that
            // commitTrackerDataFromPriorMessage can find a valid state next turn instead of nulling everything.
            // Inheritance does not overwrite existing data, so it's safe to call even if the condition misses an edge case.
            if (!extensionSettings.autoUpdate || !isAwaitingNewMessage) {
                inheritSwipeDataFromPriorMessage(lastMessage, chat.length - 1);
            }
        }

        // Trigger auto-update if enabled (for both separate and external modes)
        // Only trigger if this is a newly generated message, not loading chat history
        if (extensionSettings.autoUpdate && isAwaitingNewMessage) {
            // Capture the current generation ID before the async gap so that any
            // message deletion (or a newer generation) that increments the counter
            // while the 500ms timer or the API call is in-flight will cause
            // updateRPGData to discard its result rather than stomping the UI.
            const genId = incrementSeparateGenerationId();
            setTimeout(async () => {
                await updateRPGData(renderUserStats, renderInfoBox, renderThoughts, renderInventory, genId);
                // Update FAB widgets and strip widgets after separate/external mode update completes
                setFabLoadingState(false);
                updateFabWidgets();
                updateStripWidgets();
            }, 500);
        }
    }

    // Reset the awaiting flag after processing the message
    setIsAwaitingNewMessage(false);

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

    // Stop FAB loading state and update widgets
    setFabLoadingState(false);
    updateFabWidgets();
    updateStripWidgets();

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
    $('.rpg-inline-thoughts, .rpg-inline-thought').remove();
    $('#chat').off('scroll.thoughtPanel');
    $(window).off('resize.thoughtPanel');
    $(document).off('click.thoughtPanel');

    // Auto-switch to the preset associated with this character/group (if any)
    const presetSwitched = autoSwitchPresetForEntity();
    // if (presetSwitched) {
    //     console.log('[RPG Companion] Auto-switched preset for character');
    // }

    // Load chat-specific data when switching chats
    loadChatData();
    flushDeferredChatDataSave();

    // chat_metadata may not reflect the actual chat tail for branches, so
    // loadChatData() may have just restored stale data from the parent chat.
    // Override lastGeneratedData from the swipe store of the last assistant message.
    // The message objects in the branch already carry their full swipe stores, making this authoritative.
    // If no swipe data exists (e.g. branching at message 0, or a chat with no generations yet),
    // null out lastGeneratedData and committedTrackerData so we don't display stale values from the parent chat.
    const hadSwipeData = syncLastGeneratedDataFromSwipeStore(getContext().chat);
    if (!hadSwipeData) {
        lastGeneratedData.userStats = null;
        lastGeneratedData.infoBox = null;
        lastGeneratedData.characterThoughts = null;
        committedTrackerData.userStats = null;
        committedTrackerData.infoBox = null;
        committedTrackerData.characterThoughts = null;
    }

    // Don't call commitTrackerData() here - it would overwrite the loaded committedTrackerData
    // with data from the last message, which may be null/empty. The loaded committedTrackerData
    // already contains the committed state from when we last left this chat.
    // commitTrackerData() will be called naturally when new messages arrive.

    // Re-render with the loaded data and retry once SillyTavern finishes restoring chat state.
    rerenderRpgState();
    scheduleChatStateRehydration();

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

    const swipeCount = Array.isArray(message.swipes) ? message.swipes.length : 0;
    const rawSwipeId = Number(message.swipe_id ?? 0);
    // New swipe. mes is still the old text here, so go by swipe_id
    const currentSwipeId = rawSwipeId >= swipeCount ? rawSwipeId : resolveActiveSwipeId(message);

    // Only set flag to true if this swipe will trigger a NEW generation
    // Check if the swipe already exists (has content in the swipes array)
    const isExistingSwipe = message.swipes &&
        message.swipes[currentSwipeId] !== undefined &&
        message.swipes[currentSwipeId] !== null &&
        message.swipes[currentSwipeId].length > 0;
    const swipeData = getSwipeData(message, currentSwipeId);
    const isPendingNewSwipe = currentSwipeId >= swipeCount;

    if (!isExistingSwipe) {
        // This is a NEW swipe that will trigger generation
        setLastActionWasSwipe(true);
        setIsAwaitingNewMessage(true);
        // Immediately commit context from the prior assistant message (N-1) so generation
        // uses the world state before this message, not the last-viewed sibling swipe.
        commitTrackerDataFromPriorMessage(messageIndex);
        // console.log('[RPG Companion] 🔵 NEW swipe detected - Set lastActionWasSwipe = true');
    } else {
        // This is navigating to an EXISTING swipe - don't change the flag
        // console.log('[RPG Companion] 🔵 EXISTING swipe navigation - lastActionWasSwipe unchanged =', lastActionWasSwipe);
    }

    if (isPendingNewSwipe) {
        lastGeneratedData.characterThoughts = null;
    }

    // console.log('[RPG Companion] Loading data for swipe', currentSwipeId);

    // Load saved swipe data for the active swipe only.
    // Using the current-swipe helper here avoids falling back to another
    // stored swipe payload and showing stale tracker state.
    if (swipeData) {
        // Load swipe data into lastGeneratedData for display (both modes)
        lastGeneratedData.userStats = swipeData.userStats || null;
        lastGeneratedData.infoBox = swipeData.infoBox || null;

        // Normalize characterThoughts to string format (for backward compatibility with old object format)
        if (swipeData.characterThoughts && typeof swipeData.characterThoughts === 'object') {
            lastGeneratedData.characterThoughts = JSON.stringify(swipeData.characterThoughts, null, 2);
        } else {
            lastGeneratedData.characterThoughts = swipeData.characterThoughts || null;
        }

        // Sync extensionSettings.userStats so stat bars reflect this swipe
        if (swipeData.userStats) {
            parseUserStats(swipeData.userStats);
        }

        // console.log('[RPG Companion] 🔄 Loaded swipe data for swipe:', currentSwipeId);
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

    // Update widget strips with the newly loaded swipe data
    updateFabWidgets();
    updateStripWidgets();

    // Update chat thought overlays
    updateChatThoughts();
}

export function onMessageDeleted() {
    if (!extensionSettings.enabled) {
        return;
    }

    // Invalidate any pending or in-flight separate-mode generation so
    // its result is not applied to the (now-changed) chat tail.
    incrementSeparateGenerationId();

    const currentChat = getContext().chat || [];
    let lastAssistantIndex = -1;
    for (let i = currentChat.length - 1; i >= 0; i--) {
        if (!currentChat[i].is_user && !currentChat[i].is_system) {
            lastAssistantIndex = i;
            break;
        }
    }

    syncDisplayedTrackerStateFromChat();

    // After the display state has been rebuilt, restore generation context from
    // the assistant message immediately before the new tail message so the next
    // generation uses the correct N-1 tracker state.
    if (lastAssistantIndex !== -1) {
        commitTrackerDataFromPriorMessage(lastAssistantIndex);
    }

    saveChatData();
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

/**
 * Initialize history injection event listeners.
 * Should be called once during extension initialization.
 */
export function initHistoryInjection() {
    initHistoryInjectionListeners();
}
