/**
 * Modal Management Module
 * Handles DiceModal and SettingsModal ES6 classes with state management
 */

import { getContext } from '../../../../../../extensions.js';
import {
    extensionSettings,
    lastGeneratedData,
    committedTrackerData,
    $infoBoxContainer,
    $thoughtsContainer,
    setPendingDiceRoll,
    getPendingDiceRoll
} from '../../core/state.js';
import { saveSettings, saveChatData } from '../../core/persistence.js';
import { renderUserStats } from '../rendering/userStats.js';
import { updateChatThoughts } from '../rendering/thoughts.js';
import { renderQuests } from '../rendering/quests.js';
import {
    rollDice as rollDiceCore,
    clearDiceRoll as clearDiceRollCore,
    updateDiceDisplay as updateDiceDisplayCore,
    addDiceQuickReply as addDiceQuickReplyCore
} from '../features/dice.js';

/**
 * Modern DiceModal ES6 Class
 * Manages dice roller modal with proper state management and CSS classes
 */
export class DiceModal {
    constructor() {
        this.modal = document.getElementById('rpg-dice-popup');
        this.animation = document.getElementById('rpg-dice-animation');
        this.result = document.getElementById('rpg-dice-result');
        this.resultValue = document.getElementById('rpg-dice-result-value');
        this.resultDetails = document.getElementById('rpg-dice-result-details');
        this.rollBtn = document.getElementById('rpg-dice-roll-btn');

        this.state = 'IDLE'; // IDLE, ROLLING, SHOWING_RESULT
        this.isAnimating = false;
    }

    /**
     * Opens the modal with proper animation
     */
    open() {
        if (this.isAnimating) return;

        // Apply theme
        const theme = extensionSettings.theme;
        this.modal.setAttribute('data-theme', theme);

        // Apply custom theme if needed
        if (theme === 'custom') {
            this._applyCustomTheme();
        }

        // Reset to initial state
        this._setState('IDLE');

        // Open modal with CSS class
        this.modal.classList.add('is-open');
        this.modal.classList.remove('is-closing');

        // Focus management
        this.modal.querySelector('#rpg-dice-popup-close')?.focus();
    }

    /**
     * Closes the modal with animation
     */
    close() {
        if (this.isAnimating) return;

        this.isAnimating = true;
        this.modal.classList.add('is-closing');
        this.modal.classList.remove('is-open');

        // Wait for animation to complete
        setTimeout(() => {
            this.modal.classList.remove('is-closing');
            this.isAnimating = false;

            // Clear pending roll
            setPendingDiceRoll(null);
        }, 200);
    }

    /**
     * Starts the rolling animation
     */
    startRolling() {
        this._setState('ROLLING');
    }

    /**
     * Shows the result
     * @param {number} total - The total roll value
     * @param {Array<number>} rolls - Individual roll values
     */
    showResult(total, rolls) {
        this._setState('SHOWING_RESULT');

        // Update result values
        this.resultValue.textContent = total;
        this.resultValue.classList.add('is-animating');

        // Remove animation class after it completes
        setTimeout(() => {
            this.resultValue.classList.remove('is-animating');
        }, 500);

        // Show details if multiple rolls
        if (rolls && rolls.length > 1) {
            this.resultDetails.textContent = `Rolls: ${rolls.join(', ')}`;
        } else {
            this.resultDetails.textContent = '';
        }
    }

    /**
     * Manages modal state changes
     * @private
     */
    _setState(newState) {
        this.state = newState;

        switch (newState) {
            case 'IDLE':
                this.rollBtn.hidden = false;
                this.animation.hidden = true;
                this.result.hidden = true;
                break;

            case 'ROLLING':
                this.rollBtn.hidden = true;
                this.animation.hidden = false;
                this.result.hidden = true;
                this.animation.setAttribute('aria-busy', 'true');
                break;

            case 'SHOWING_RESULT':
                this.rollBtn.hidden = true;
                this.animation.hidden = true;
                this.result.hidden = false;
                this.animation.setAttribute('aria-busy', 'false');
                break;
        }
    }

    /**
     * Applies custom theme colors
     * @private
     */
    _applyCustomTheme() {
        const content = this.modal.querySelector('.rpg-dice-popup-content');
        if (content && extensionSettings.customColors) {
            content.style.setProperty('--rpg-bg', extensionSettings.customColors.bg);
            content.style.setProperty('--rpg-accent', extensionSettings.customColors.accent);
            content.style.setProperty('--rpg-text', extensionSettings.customColors.text);
            content.style.setProperty('--rpg-highlight', extensionSettings.customColors.highlight);
        }
    }
}

/**
 * SettingsModal - Manages the settings popup modal
 * Handles opening, closing, theming, and animations
 */
export class SettingsModal {
    constructor() {
        this.modal = document.getElementById('rpg-settings-popup');
        this.content = this.modal?.querySelector('.rpg-settings-popup-content');
        this.isAnimating = false;
    }

    /**
     * Opens the modal with proper animation
     */
    open() {
        if (this.isAnimating || !this.modal) return;

        // Apply theme
        const theme = extensionSettings.theme || 'default';
        this.modal.setAttribute('data-theme', theme);

        // Apply custom theme if needed
        if (theme === 'custom') {
            this._applyCustomTheme();
        }

        // Open modal with CSS class
        this.modal.classList.add('is-open');
        this.modal.classList.remove('is-closing');

        // Focus management
        this.modal.querySelector('#rpg-close-settings')?.focus();
    }

    /**
     * Closes the modal with animation
     */
    close() {
        if (this.isAnimating || !this.modal) return;

        this.isAnimating = true;
        this.modal.classList.add('is-closing');
        this.modal.classList.remove('is-open');

        // Wait for animation to complete
        setTimeout(() => {
            this.modal.classList.remove('is-closing');
            this.isAnimating = false;
        }, 200);
    }

    /**
     * Updates the theme in real-time (used when theme selector changes)
     */
    updateTheme() {
        if (!this.modal) return;

        const theme = extensionSettings.theme || 'default';
        this.modal.setAttribute('data-theme', theme);

        if (theme === 'custom') {
            this._applyCustomTheme();
        } else {
            // Clear custom CSS variables to let theme CSS take over
            this._clearCustomTheme();
        }
    }

    /**
     * Applies custom theme colors
     * @private
     */
    _applyCustomTheme() {
        if (!this.content || !extensionSettings.customColors) return;

        this.content.style.setProperty('--rpg-bg', extensionSettings.customColors.bg);
        this.content.style.setProperty('--rpg-accent', extensionSettings.customColors.accent);
        this.content.style.setProperty('--rpg-text', extensionSettings.customColors.text);
        this.content.style.setProperty('--rpg-highlight', extensionSettings.customColors.highlight);
    }

    /**
     * Clears custom theme colors
     * @private
     */
    _clearCustomTheme() {
        if (!this.content) return;

        this.content.style.setProperty('--rpg-bg', '');
        this.content.style.setProperty('--rpg-accent', '');
        this.content.style.setProperty('--rpg-text', '');
        this.content.style.setProperty('--rpg-highlight', '');
    }
}

// Global instances
let diceModal = null;
let settingsModal = null;

/**
 * Sets up the dice roller functionality.
 * @returns {DiceModal} The initialized DiceModal instance
 */
export function setupDiceRoller() {
    // Initialize DiceModal instance
    diceModal = new DiceModal();

    // Click dice display to open popup
    $('#rpg-dice-display').on('click', function() {
        openDicePopup();
    });

    // Close popup - handle both close button and backdrop clicks
    $('#rpg-dice-popup-close').on('click', function() {
        closeDicePopup();
    });

    // Close on backdrop click (clicking outside content)
    $('#rpg-dice-popup').on('click', function(e) {
        if (e.target === this) {
            closeDicePopup();
        }
    });

    // Roll dice button
    $('#rpg-dice-roll-btn').on('click', async function() {
        await rollDiceCore(diceModal);
    });

    // Save roll button (closes popup and saves the roll)
    $('#rpg-dice-save-btn').on('click', function() {
        // Save the pending roll
        const roll = getPendingDiceRoll();
        if (roll) {
            extensionSettings.lastDiceRoll = roll;
            saveSettings();
            updateDiceDisplayCore();
            setPendingDiceRoll(null);
        }
        closeDicePopup();
    });

    // Reset on Enter key
    $('#rpg-dice-count, #rpg-dice-sides').on('keypress', function(e) {
        if (e.which === 13) {
            rollDiceCore(diceModal);
        }
    });

    // Clear dice roll button
    $('#rpg-clear-dice').on('click', function(e) {
        e.stopPropagation(); // Prevent opening the dice popup
        clearDiceRollCore();
    });

    return diceModal;
}

/**
 * Sets up the settings popup functionality.
 * @returns {SettingsModal} The initialized SettingsModal instance
 */
export function setupSettingsPopup() {
    // Initialize SettingsModal instance
    settingsModal = new SettingsModal();

    // Open settings popup
    $('#rpg-open-settings').on('click', function() {
        openSettingsPopup();
    });

    // Close settings popup - close button
    $('#rpg-close-settings').on('click', function() {
        closeSettingsPopup();
    });

    // Close on backdrop click (clicking outside content)
    $('#rpg-settings-popup').on('click', function(e) {
        if (e.target === this) {
            closeSettingsPopup();
        }
    });

    // Clear cache button
    $('#rpg-clear-cache').on('click', function() {
        // Clear the data
        lastGeneratedData.userStats = null;
        lastGeneratedData.infoBox = null;
        lastGeneratedData.characterThoughts = null;

        // Clear committed tracker data (used for generation context)
        committedTrackerData.userStats = null;
        committedTrackerData.infoBox = null;
        committedTrackerData.characterThoughts = null;

        // Clear all message swipe data
        const chat = getContext().chat;
        if (chat && chat.length > 0) {
            for (let i = 0; i < chat.length; i++) {
                const message = chat[i];
                if (message.extra && message.extra.rpg_companion_swipes) {
                    delete message.extra.rpg_companion_swipes;
                    // console.log('[RPG Companion] Cleared swipe data from message at index', i);
                }
            }
        }

        // Clear the UI
        if ($infoBoxContainer) {
            $infoBoxContainer.empty();
        }
        if ($thoughtsContainer) {
            $thoughtsContainer.empty();
        }

        // Reset stats to defaults and re-render
        extensionSettings.userStats = {
            health: 100,
            satiety: 100,
            energy: 100,
            hygiene: 100,
            arousal: 0,
            mood: '😐',
            conditions: 'None',
            inventory: 'None'
        };

        // Reset classic stats (attributes) to defaults
        extensionSettings.classicStats = {
            str: 10,
            dex: 10,
            con: 10,
            int: 10,
            wis: 10,
            cha: 10
        };

        // Clear dice roll
        extensionSettings.lastDiceRoll = null;

        // Clear quests
        extensionSettings.quests = {
            main: "None",
            optional: []
        };

        // Save everything
        saveChatData();
        saveSettings();

        // Re-render user stats and dice display
        renderUserStats();
        updateDiceDisplayCore();
        updateChatThoughts(); // Clear the thought bubble in chat
        renderQuests(); // Clear and re-render quests UI

        // console.log('[RPG Companion] Chat cache cleared');
    });

    return settingsModal;
}

/**
 * Opens the dice rolling popup.
 * Backwards compatible wrapper for DiceModal class.
 */
export function openDicePopup() {
    if (diceModal) {
        diceModal.open();
    }
}

/**
 * Closes the dice rolling popup.
 * Backwards compatible wrapper for DiceModal class.
 */
export function closeDicePopup() {
    if (diceModal) {
        diceModal.close();
    }
}

/**
 * Opens the settings popup.
 * Backwards compatible wrapper for SettingsModal class.
 */
export function openSettingsPopup() {
    if (settingsModal) {
        settingsModal.open();
    }
}

/**
 * Closes the settings popup.
 * Backwards compatible wrapper for SettingsModal class.
 */
export function closeSettingsPopup() {
    if (settingsModal) {
        settingsModal.close();
    }
}

/**
 * @deprecated Legacy function - use diceModal._applyCustomTheme() instead
 */
export function applyCustomThemeToPopup() {
    if (diceModal) {
        diceModal._applyCustomTheme();
    }
}

/**
 * Clears the last dice roll.
 * Backwards compatible wrapper for dice module.
 */
export function clearDiceRoll() {
    clearDiceRollCore();
}

/**
 * Updates the dice display in the sidebar.
 * Backwards compatible wrapper for dice module.
 */
export function updateDiceDisplay() {
    updateDiceDisplayCore();
}

/**
 * Adds the Roll Dice quick reply button.
 * Backwards compatible wrapper for dice module.
 */
export function addDiceQuickReply() {
    addDiceQuickReplyCore();
}

/**
 * Returns the SettingsModal instance for external use
 * @returns {SettingsModal} The global SettingsModal instance
 */
export function getSettingsModal() {
    return settingsModal;
}
