/**
 * Chapter Checkpoint UI Module
 * Adds UI elements for chapter checkpoint functionality
 */

import { getContext } from '../../../../../../extensions.js';
import { i18n } from '../../core/i18n.js';
import {
    setChapterCheckpoint,
    clearChapterCheckpoint,
    isCheckpointMessage
} from '../features/chapterCheckpoint.js';

/**
 * Adds the chapter checkpoint button to a message's extra menu
 * @param {number} messageId - The message index
 * @param {HTMLElement} menu - The message menu element
 */
export function addCheckpointButtonToMessage(messageId, menu) {
    if (!menu) return;

    const isCheckpoint = isCheckpointMessage(messageId);

    // Create the menu item
    const menuItem = document.createElement('div');
    menuItem.className = 'extraMesButtonsHint list-group-item flex-container flexGap5';
    const translationKey = isCheckpoint ? 'checkpoint.clearChapterStart' : 'checkpoint.setChapterStart';
    menuItem.setAttribute('data-i18n', translationKey);
    menuItem.title = isCheckpoint
        ? 'Clear Chapter Start'
        : 'Set Chapter Start: When bookmarked, this message will count as the first message in the chat history, skipping earlier ones';

    // Icon only (no text label)
    const icon = document.createElement('i');
    icon.className = isCheckpoint ? 'fa-solid fa-bookmark' : 'fa-regular fa-bookmark';
    icon.style.color = isCheckpoint ? '#4a9eff' : '';

    menuItem.appendChild(icon);

    // Click handler
    menuItem.addEventListener('click', (e) => {
        e.stopPropagation();

        const wasCheckpoint = isCheckpointMessage(messageId);

        if (wasCheckpoint) {
            clearChapterCheckpoint();
        } else {
            setChapterCheckpoint(messageId);
        }

        // Update this button immediately
        const newIsCheckpoint = isCheckpointMessage(messageId);
        icon.className = newIsCheckpoint ? 'fa-solid fa-bookmark' : 'fa-regular fa-bookmark';
        icon.style.color = newIsCheckpoint ? '#4a9eff' : '';
        menuItem.title = newIsCheckpoint
            ? 'Clear Chapter Start'
            : 'Set Chapter Start: When bookmarked, this message will count as the first message in the chat history, skipping earlier ones';
        const newTranslationKey = newIsCheckpoint ? 'checkpoint.clearChapterStart' : 'checkpoint.setChapterStart';
        menuItem.setAttribute('data-i18n', newTranslationKey);

        // Update indicators in all messages
        updateAllCheckpointIndicators();
    });

    return menuItem;
}

/**
 * Adds visual indicators to messages that are checkpoints
 * @param {number} messageId - The message index
 * @param {HTMLElement} messageBlock - The message DOM element
 */
export function addCheckpointIndicator(messageId, messageBlock) {
    if (!messageBlock) return;

    const isCheckpoint = isCheckpointMessage(messageId);

    // Remove existing indicator if present
    const existingIndicator = messageBlock.querySelector('.rpg-checkpoint-indicator');
    if (existingIndicator) {
        existingIndicator.remove();
    }

    if (!isCheckpoint) return;

    // Add checkpoint indicator
    const indicator = document.createElement('div');
    indicator.className = 'rpg-checkpoint-indicator';
    const indicatorText = i18n.getTranslation('checkpoint.indicator') || 'Chapter Start';
    const tooltipText = i18n.getTranslation('checkpoint.tooltip') || 'Messages before this point are excluded from context';
    indicator.innerHTML = `
        <i class="fa-solid fa-bookmark"></i>
        <span>${indicatorText}</span>
    `;
    indicator.title = tooltipText;

    // Insert at the beginning of the message
    const mesText = messageBlock.querySelector('.mes_text');
    if (mesText && mesText.parentNode) {
        mesText.parentNode.insertBefore(indicator, mesText);
    }
}

/**
 * Updates checkpoint indicators for all messages
 */
export function updateAllCheckpointIndicators() {
    const context = getContext();
    const chat = context.chat;

    if (!chat) return;

    // Clear all processed flags so buttons can be updated
    document.querySelectorAll('.extraMesButtons[data-checkpoint-processed]').forEach(menu => {
        delete menu.dataset.checkpointProcessed;
    });

    // Update all message blocks
    const messageBlocks = document.querySelectorAll('.mes');
    messageBlocks.forEach((block) => {
        // Get the actual message ID from the mesid attribute
        const messageId = Number(block.getAttribute('mesid'));

        if (isNaN(messageId)) return;

        addCheckpointIndicator(messageId, block);

        // Also update any open menus for this message
        const menu = block.querySelector('.extraMesButtons');
        if (menu) {
            updateCheckpointButtonInMenu(menu, messageId);
        }
    });
}

/**
 * Initializes the chapter checkpoint UI
 */
export function initChapterCheckpointUI() {
    // Listen for checkpoint changes
    document.addEventListener('rpg-companion-checkpoint-changed', () => {
        updateAllCheckpointIndicators();
    });

    // Listen for chat changes to update indicators
    const context = getContext();
    if (context && context.eventSource) {
        // Update checkpoint indicators when messages are rendered
        const observer = new MutationObserver((mutations) => {
            let shouldUpdate = false;
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE &&
                        node.classList && node.classList.contains('mes')) {
                        shouldUpdate = true;
                    }
                });
            });

            if (shouldUpdate) {
                // Debounce updates to avoid excessive re-rendering
                clearTimeout(window.rpgCheckpointUpdateTimeout);
                window.rpgCheckpointUpdateTimeout = setTimeout(() => {
                    updateAllCheckpointIndicators();
                }, 100);
            }
        });

        const chatContainer = document.getElementById('chat');
        if (chatContainer) {
            observer.observe(chatContainer, {
                childList: true,
                subtree: false
            });
        }
    }

    // Update indicators on initialization
    updateAllCheckpointIndicators();
}

/**
 * Injects checkpoint button into message menus
 * This should be called when SillyTavern renders message menus
 */
export function injectCheckpointButton() {
    // Direct approach: Hook into when extraMesButtons elements appear or are populated
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            // Check for added nodes
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    // Check if extraMesButtons container was added
                    if (node.classList && node.classList.contains('extraMesButtons')) {
                        processExtraMesButtons(node);
                    }

                    // Also check if extraMesButtons exists within added subtree
                    if (node.querySelector) {
                        const extraButtons = node.querySelectorAll('.extraMesButtons');
                        extraButtons.forEach(processExtraMesButtons);
                    }
                }
            });

            // Check if nodes were added TO an extraMesButtons container
            if (mutation.target && mutation.target.classList &&
                mutation.target.classList.contains('extraMesButtons')) {
                processExtraMesButtons(mutation.target);
            }
        });
    });

    // Observe the chat container
    const chatContainer = document.getElementById('chat');
    if (chatContainer) {
        observer.observe(chatContainer, {
            childList: true,
            subtree: true
        });

        // Process any existing menus on initialization
        const existingMenus = chatContainer.querySelectorAll('.extraMesButtons');
        existingMenus.forEach(processExtraMesButtons);
    }
}

/**
 * Process an extraMesButtons container to add checkpoint button
 * @param {HTMLElement} menu - The extraMesButtons container
 */
function processExtraMesButtons(menu) {
    if (!menu) return;

    // Find the message block
    const messageBlock = menu.closest('.mes');
    if (!messageBlock) return;

    // Get the message ID from the mesid attribute (SillyTavern's standard way)
    const messageId = Number(messageBlock.getAttribute('mesid'));

    if (isNaN(messageId)) return;

    // Check if button already exists
    if (!menu.dataset.checkpointProcessed) {
        // Mark as processed
        menu.dataset.checkpointProcessed = 'true';

        // Add checkpoint button
        const checkpointBtn = addCheckpointButtonToMessage(messageId, menu);
        if (checkpointBtn) {
            checkpointBtn.classList.add('rpg-checkpoint-button');
            menu.appendChild(checkpointBtn);
        }
    }
}

/**
 * Update the checkpoint button in an existing menu
 * @param {HTMLElement} menu - The extraMesButtons container
 * @param {number} messageId - The message index
 */
function updateCheckpointButtonInMenu(menu, messageId) {
    if (!menu) return;

    const existingButton = menu.querySelector('.rpg-checkpoint-button');
    if (!existingButton) return;

    const isCheckpoint = isCheckpointMessage(messageId);

    // Update icon
    const icon = existingButton.querySelector('i');
    if (icon) {
        icon.className = isCheckpoint ? 'fa-solid fa-bookmark' : 'fa-regular fa-bookmark';
        icon.style.color = isCheckpoint ? '#4a9eff' : '';
    }

    // Update tooltip
    existingButton.title = isCheckpoint
        ? 'Clear Chapter Start'
        : 'Set Chapter Start: When bookmarked, this message will count as the first message in the chat history, skipping earlier ones';
    const translationKey = isCheckpoint ? 'checkpoint.clearChapterStart' : 'checkpoint.setChapterStart';
    existingButton.setAttribute('data-i18n', translationKey);
}
