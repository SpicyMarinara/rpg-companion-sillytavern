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
 * @param {boolean} isExpanded - Whether this is for expanded message actions
 */
export function addCheckpointButtonToMessage(messageId, menu, isExpanded = false) {
    if (!menu) return;

    const isCheckpoint = isCheckpointMessage(messageId);

    // Create the menu item
    const menuItem = document.createElement('div');
    // Use different classes for expanded vs dropdown menu
    if (isExpanded) {
        menuItem.className = 'mes_button';
        menuItem.setAttribute('tabindex', '0');
    } else {
        menuItem.className = 'extraMesButtonsHint list-group-item flex-container flexGap5';
    }

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

    // Update all message blocks
    const messageBlocks = document.querySelectorAll('.mes');
    messageBlocks.forEach((block) => {
        // Get the actual message ID from the mesid attribute
        const messageId = Number(block.getAttribute('mesid'));

        if (isNaN(messageId)) return;

        addCheckpointIndicator(messageId, block);

        // Update any existing dropdown menu button for this message
        const dropdownMenu = block.querySelector('.extraMesButtons');
        if (dropdownMenu) {
            updateCheckpointButtonInMenu(dropdownMenu, messageId);
        }

        // Update any existing expanded button for this message
        const mesButtons = block.querySelector('.mes_buttons');
        if (mesButtons) {
            updateCheckpointButtonInMenu(mesButtons, messageId);
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
    // Observer for dropdown menus and message blocks
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            // Check for added nodes
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    // Check if extraMesButtons container was added (dropdown menu)
                    if (node.classList && node.classList.contains('extraMesButtons')) {
                        processExtraMesButtons(node);
                    }

                    // Check if message block was added (for expanded mode)
                    if (node.classList && node.classList.contains('mes')) {
                        processExpandedButton(node);
                    }

                    // Also check if either exists within added subtree
                    if (node.querySelector) {
                        const extraButtons = node.querySelectorAll('.extraMesButtons');
                        extraButtons.forEach(processExtraMesButtons);

                        const messageBlocks = node.querySelectorAll('.mes');
                        messageBlocks.forEach(processExpandedButton);
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

        // Process any existing menus and messages on initialization
        const existingDropdownMenus = chatContainer.querySelectorAll('.extraMesButtons');
        existingDropdownMenus.forEach(processExtraMesButtons);

        const existingMessages = chatContainer.querySelectorAll('.mes');
        existingMessages.forEach(processExpandedButton);
    }
}

/**
 * Process an extraMesButtons container to add checkpoint button (dropdown menu)
 * @param {HTMLElement} menu - The extraMesButtons container
 */
function processExtraMesButtons(menu) {
    if (!menu) return;

    // Find the message block
    const messageBlock = menu.closest('.mes');
    if (!messageBlock) return;

    // Check if expanded mode is active - if so, don't add to dropdown
    const mesButtons = messageBlock.querySelector('.mes_buttons');
    if (mesButtons && window.getComputedStyle(mesButtons).display !== 'none') {
        return; // Expanded mode is active, skip dropdown
    }

    // Get the message ID from the mesid attribute (SillyTavern's standard way)
    const messageId = Number(messageBlock.getAttribute('mesid'));

    if (isNaN(messageId)) return;

    // Check if button already exists in this container
    if (menu.querySelector('.rpg-checkpoint-button')) return;

    // Add checkpoint button for dropdown menu
    const checkpointBtn = addCheckpointButtonToMessage(messageId, menu, false);
    if (checkpointBtn) {
        checkpointBtn.classList.add('rpg-checkpoint-button');
        menu.appendChild(checkpointBtn);
    }
}

/**
 * Process message to add expanded checkpoint button
 * @param {HTMLElement} messageBlock - The message block element
 */
function processExpandedButton(messageBlock) {
    if (!messageBlock) return;

    const mesButtons = messageBlock.querySelector('.mes_buttons');
    if (!mesButtons) return;

    // Only add if mes_buttons is visible (expanded mode is active)
    if (window.getComputedStyle(mesButtons).display === 'none') {
        return;
    }

    const messageId = Number(messageBlock.getAttribute('mesid'));
    if (isNaN(messageId)) return;

    // Check if button already exists in this container
    if (mesButtons.querySelector('.rpg-checkpoint-button-expanded')) return;

    // Add checkpoint button as separate mes_button
    const checkpointBtn = addCheckpointButtonToMessage(messageId, mesButtons, true);
    if (checkpointBtn) {
        checkpointBtn.classList.add('rpg-checkpoint-button-expanded');
        mesButtons.appendChild(checkpointBtn);
    }
}

/**
 * Update the checkpoint button in an existing menu
 * @param {HTMLElement} menu - The extraMesButtons or mes_buttons container
 * @param {number} messageId - The message index
 */
function updateCheckpointButtonInMenu(menu, messageId) {
    if (!menu) return;

    // Check for both button classes (dropdown and expanded)
    const existingButton = menu.querySelector('.rpg-checkpoint-button, .rpg-checkpoint-button-expanded');
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
