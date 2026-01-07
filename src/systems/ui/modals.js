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
    $userStatsContainer,
    setPendingDiceRoll,
    getPendingDiceRoll,
    clearSessionAvatarPrompts
} from '../../core/state.js';
import { saveSettings, saveChatData } from '../../core/persistence.js';
import { renderUserStats } from '../rendering/userStats.js';
import { renderInfoBox } from '../rendering/infoBox.js';
import { renderThoughts, updateChatThoughts } from '../rendering/thoughts.js';
import { renderQuests } from '../rendering/quests.js';
import { renderInventory } from '../rendering/inventory.js';
import {
    rollDice as rollDiceCore,
    clearDiceRoll as clearDiceRollCore,
    updateDiceDisplay as updateDiceDisplayCore,
    addDiceQuickReply as addDiceQuickReplyCore
} from '../features/dice.js';
import { i18n } from '../../core/i18n.js';

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
    $('#rpg-clear-dice').attr('title', i18n.getTranslation('template.mainPanel.clearLastRoll'));

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
        console.log('[RPG Companion] Clear Cache button clicked');

        // Clear the data (set to null so panels show "not generated yet")
        lastGeneratedData.userStats = null;
        lastGeneratedData.infoBox = null;
        lastGeneratedData.characterThoughts = null;
        lastGeneratedData.html = null;

        // Clear committed tracker data (used for generation context)
        committedTrackerData.userStats = null;
        committedTrackerData.infoBox = null;
        committedTrackerData.characterThoughts = null;

        // Clear session avatar prompts
        clearSessionAvatarPrompts();

        // Clear chat metadata immediately (don't wait for debounced save)
        const context = getContext();
        if (context.chat_metadata && context.chat_metadata.rpg_companion) {
            delete context.chat_metadata.rpg_companion;
            console.log('[RPG Companion] Cleared chat_metadata.rpg_companion for current chat');
        }

        // Clear all message swipe data
        const chat = context.chat;
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
        if ($userStatsContainer) {
            $userStatsContainer.empty();
        }

        // Reset user stats to default object structure (extensionSettings stores as object, not JSON string)
        extensionSettings.userStats = {
            health: 100,
            satiety: 100,
            energy: 100,
            hygiene: 100,
            arousal: 0,
            mood: '😐',
            conditions: 'None',
            skills: [],
            inventory: {
                version: 2,
                onPerson: "None",
                clothing: "None",
                stored: {},
                assets: "None"
            }
        };

        // Reset info box to defaults (as object)
        extensionSettings.infoBox = {
            date: new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
            weather: '☀️ Clear skies',
            temperature: '20°C',
            time: '00:00 - 00:00',
            location: 'Unknown Location',
            recentEvents: []
        };

        // Reset character thoughts to empty (as object)
        extensionSettings.characterThoughts = {
            characters: []
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

        // Reset level to 1
        extensionSettings.level = 1;

        // Clear quests
        extensionSettings.quests = {
            main: "None",
            optional: []
        };

        // Clear all locked items
        extensionSettings.lockedItems = {
            stats: [],
            skills: [],
            inventory: {
                onPerson: [],
                clothing: [],
                stored: {},
                assets: []
            },
            quests: {
                main: false,
                optional: []
            },
            infoBox: {
                date: false,
                weather: false,
                temperature: false,
                time: false,
                location: false,
                recentEvents: false
            },
            characters: {}
        };

        // Save everything
        saveChatData();
        saveSettings();

        // Re-render all panels - they will show "not generated yet" messages since data is null
        renderUserStats();
        renderInfoBox();
        renderThoughts();
        updateDiceDisplayCore();
        updateChatThoughts();
        renderInventory();
        renderQuests();

        console.log('[RPG Companion] Cache cleared successfully');
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

/**
 * Shows the welcome modal for v3.0.0 on first launch
 * Checks if user has already seen this version's welcome screen
 */
export function showWelcomeModalIfNeeded() {
    const WELCOME_VERSION = '3.0.1';
    const STORAGE_KEY = 'rpg_companion_welcome_seen';

    try {
        const seenVersion = localStorage.getItem(STORAGE_KEY);

        // If user hasn't seen v3.0.0 welcome yet, show it
        if (seenVersion !== WELCOME_VERSION) {
            showWelcomeModal(WELCOME_VERSION, STORAGE_KEY);
        }
    } catch (error) {
        console.error('[RPG Companion] Failed to check welcome modal status:', error);
    }
}

/**
 * Shows the welcome modal
 * @param {string} version - The version to mark as seen
 * @param {string} storageKey - The localStorage key to use
 */
function showWelcomeModal(version, storageKey) {
    const modal = document.getElementById('rpg-welcome-modal');
    if (!modal) {
        console.error('[RPG Companion] Welcome modal element not found');
        return;
    }

    // Apply current theme to modal
    const theme = extensionSettings.theme || 'default';
    modal.setAttribute('data-theme', theme);

    // Show modal
    modal.style.display = 'flex';
    modal.classList.add('is-open');

    // Close button handler
    const closeBtn = document.getElementById('rpg-welcome-close');
    const gotItBtn = document.getElementById('rpg-welcome-got-it');

    const closeModal = () => {
        modal.classList.add('is-closing');

        setTimeout(() => {
            modal.style.display = 'none';
            modal.classList.remove('is-open', 'is-closing');
        }, 200);

        // Mark this version as seen
        try {
            localStorage.setItem(storageKey, version);
        } catch (error) {
            console.error('[RPG Companion] Failed to save welcome modal status:', error);
        }
    };

    // Attach event listeners
    closeBtn?.addEventListener('click', closeModal, { once: true });
    gotItBtn?.addEventListener('click', closeModal, { once: true });

    // Close on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    }, { once: true });
}
