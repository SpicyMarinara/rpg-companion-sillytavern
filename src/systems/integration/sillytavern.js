/**
 * SillyTavern Integration Module
 * Handles all event listeners and integration with SillyTavern's event system
 */

import { getContext } from '../../../../../../extensions.js';
import {
    chat,
    user_avatar,
    setExtensionPrompt,
    extension_prompt_types
} from '../../../../../../../script.js';

// Core modules
import {
    extensionSettings,
    lastGeneratedData,
    committedTrackerData,
    lastActionWasSwipe,
    isPlotProgression,
    setLastActionWasSwipe,
    setIsPlotProgression,
    setLastGeneratedData,
    setCommittedTrackerData,
    createFreshTrackerData
} from '../../core/state.js';
import { saveChatData, loadChatData } from '../../core/persistence.js';

// Generation & Parsing
import { tryParseJSONResponse } from '../generation/parser.js';
import { updateRPGData } from '../generation/apiClient.js';

// Features
import { interceptAndModifyUserMessage, executeSmartTrigger, clearSmartTriggerPrompt } from '../features/messageModification.js';
import { onCharacterConfigChange } from '../features/characterConfig.js';

// Rendering
import { renderUserStats } from '../rendering/userStats.js';
import { renderInfoBox } from '../rendering/infoBox.js';
import { renderThoughts, updateChatThoughts } from '../rendering/thoughts.js';
import { renderSkills } from '../rendering/skills.js';
import { renderInventory } from '../rendering/inventory.js';
import { renderQuests } from '../rendering/quests.js';

// Utils
import { getSafeThumbnailUrl } from '../../utils/avatars.js';

// UI sync (imported from index to update settings UI after config load)
import { syncSettingsUI } from '../../../index.js';

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
            // Found last assistant message - commit its structured tracker data
            if (message.extra?.rpg_companion_swipes) {
                const swipeId = message.swipe_id || 0;
                const swipeData = message.extra.rpg_companion_swipes[swipeId];

                if (swipeData) {
                    Object.assign(committedTrackerData, JSON.parse(JSON.stringify(swipeData)));
                }
            }
            break;
        }
    }
}

/**
 * Event handler for when the user sends a message.
 * Sets the flag to indicate this is NOT a swipe.
 * In separate mode with auto-update disabled, commits the displayed tracker data.
 */
export async function onMessageSent() {
    if (!extensionSettings.enabled) return;

    setLastActionWasSwipe(false);

    // Optionally intercept and rewrite the user message via LLM
    if (extensionSettings.enableMessageInterception && extensionSettings.messageInterceptionActive !== false) {
        try {
            await interceptAndModifyUserMessage();
        } catch (error) {
            console.error('[RPG Companion] Message interception failed:', error);
        }
    }

    // Optionally execute Smart Trigger (LLM-generated system message before user message)
    if (extensionSettings.enableSmartTrigger) {
        try {
            await executeSmartTrigger();
        } catch (error) {
            console.error('[RPG Companion] Smart Trigger execution failed:', error);
        }
    }

    // In separate mode with auto-update disabled, commit displayed tracker when user sends a message
    if (extensionSettings.generationMode === 'separate' && !extensionSettings.autoUpdate) {
        // Commit structured lastGeneratedData to committedTrackerData
        Object.assign(committedTrackerData, JSON.parse(JSON.stringify(lastGeneratedData)));
        saveChatData();
    }
}

/**
 * Event handler for when generation ends (success or failure).
 * Clears temporary prompts like Smart Trigger.
 */
export function onGenerationEnded() {
    // Clear Smart Trigger prompt after generation completes
    if (extensionSettings.enableSmartTrigger) {
        clearSmartTriggerPrompt();
    }
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

            // Parse JSON response
            const jsonParsed = tryParseJSONResponse(responseText);
            
            if (jsonParsed) {
                console.log('[RPG Companion] JSON parsing successful in together mode');
                // Store swipe data
                if (!lastMessage.extra) lastMessage.extra = {};
                if (!lastMessage.extra.rpg_companion_swipes) lastMessage.extra.rpg_companion_swipes = {};
                const currentSwipeId = lastMessage.swipe_id || 0;
                lastMessage.extra.rpg_companion_swipes[currentSwipeId] = JSON.parse(JSON.stringify(lastGeneratedData));
                
                // Render and save
                renderUserStats();
                renderInfoBox();
                renderThoughts();
                renderInventory();
                renderQuests();
                renderSkills();
                saveChatData();
            } else {
                console.warn('[RPG Companion] JSON parsing failed in together mode');
            }
        }
    } else if (extensionSettings.generationMode === 'separate' && extensionSettings.autoUpdate) {
        // In separate mode with auto-update, trigger update after message
        setTimeout(async () => {
            await updateRPGData(renderUserStats, renderInfoBox, renderThoughts, renderInventory);
        }, 500);
    }

    // Reset the swipe flag after generation completes
    // This ensures that if the user swiped → auto-reply generated → flag is now cleared
    if (lastActionWasSwipe) {
        setLastActionWasSwipe(false);
    }

    // Clear plot progression flag if this was a plot progression generation
    // Note: No need to clear extension prompt since we used quiet_prompt option
    if (isPlotProgression) {
        setIsPlotProgression(false);
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

    // Load RPG Companion config and sync settings UI if config was loaded
    const configLoaded = onCharacterConfigChange();
    if (configLoaded) {
        syncSettingsUI();
    }

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
    renderSkills();

    // Update chat thought overlays
    updateChatThoughts();
}

/**
 * Event handler for when a message is swiped.
 * Loads the RPG data for the swipe the user navigated to.
 * Special handling for first message (greeting) - reinitializes state.
 */
export function onMessageSwiped(messageIndex) {
    if (!extensionSettings.enabled) {
        return;
    }

    // Get the message that was swiped
    const message = chat[messageIndex];
    if (!message || message.is_user) {
        return;
    }

    const currentSwipeId = message.swipe_id || 0;

    // Special case: first message swiped (greeting change)
    if (messageIndex === 0 && extensionSettings.generationMode === 'separate') {
        console.log('[RPG Companion] First message swiped (greeting change) - reinitializing state');
        
        const freshData = createFreshTrackerData();
        setLastGeneratedData(freshData);
        setCommittedTrackerData(JSON.parse(JSON.stringify(freshData)));
        
        const greetingContent = message.swipes?.[currentSwipeId] || message.mes || '';
        let foundExistingData = false;
        
        if (greetingContent) {
            foundExistingData = tryParseJSONResponse(greetingContent);
            if (foundExistingData) {
                console.log('[RPG Companion] Found RPG data in greeting');
            }
        }
        
        saveChatData();
        
        // Re-render all panels
        renderUserStats();
        renderInfoBox();
        renderThoughts();
        renderInventory();
        renderSkills();
        renderQuests();

        // Update chat thought overlays
        updateChatThoughts();
        
        if (!foundExistingData && extensionSettings.autoUpdate) {
            console.log('[RPG Companion] Triggering RPG generation for new greeting');
            setTimeout(async () => {
                await updateRPGData(renderUserStats, renderInfoBox, renderThoughts, renderInventory);
            }, 500);
        }
        
        return;
    }

    // Only set flag to true if this swipe will trigger a NEW generation
    // Check if the swipe already exists (has content in the swipes array)
    const isExistingSwipe = message.swipes &&
        message.swipes[currentSwipeId] !== undefined &&
        message.swipes[currentSwipeId] !== null &&
        message.swipes[currentSwipeId].length > 0;

    if (!isExistingSwipe) {
        setLastActionWasSwipe(true);
    }

    // Load RPG data for this swipe into lastGeneratedData (for display only)
    // This updates what the user sees, but does NOT commit it
    // Committed data will be updated when/if the user replies to this swipe
    if (message.extra?.rpg_companion_swipes?.[currentSwipeId]) {
        const swipeData = message.extra.rpg_companion_swipes[currentSwipeId];
        // Copy structured swipe data to lastGeneratedData
        setLastGeneratedData(JSON.parse(JSON.stringify(swipeData)));
    }

    // Re-render the panels (display only - committedTrackerData unchanged)
    renderUserStats();
    renderInfoBox();
    renderThoughts();
    renderInventory();
    renderSkills();
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
        return;
    }

    // Get current user_avatar from context instead of using imported value
    const context = getContext();
    const currentUserAvatar = context.user_avatar || user_avatar;

    // Try to get a valid thumbnail URL using our safe helper
    if (currentUserAvatar) {
        const thumbnailUrl = getSafeThumbnailUrl('persona', currentUserAvatar);

        if (thumbnailUrl) {
            portraitImg.src = thumbnailUrl;
        }
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
}
