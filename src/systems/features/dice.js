/**
 * Dice System Module
 * Handles dice rolling logic, display updates, and quick reply integration
 */

import {
    extensionSettings,
    setPendingDiceRoll
} from '../../core/state.js';
import { saveSettings } from '../../core/persistence.js';
import { i18n } from '../../core/i18n.js';

/**
 * Rolls the dice and displays result.
 * Works with the DiceModal class for UI updates.
 * @param {DiceModal} diceModal - The DiceModal instance
 */
export async function rollDice(diceModal) {
    if (!diceModal) return;

    const count = parseInt(String($('#rpg-dice-count').val())) || 1;
    const sides = parseInt(String($('#rpg-dice-sides').val())) || 20;

    // Start rolling animation
    diceModal.startRolling();

    // Wait for animation (simulate rolling)
    await new Promise(resolve => setTimeout(resolve, 1200));

    // Execute /roll command
    const rollCommand = `/roll ${count}d${sides}`;
    const rollResult = await executeRollCommand(rollCommand);

    // Parse result
    const total = rollResult.total || 0;
    const rolls = rollResult.rolls || [];

    // Store result temporarily (not saved until "Save Roll" is clicked)
    setPendingDiceRoll({
        formula: `${count}d${sides}`,
        total: total,
        rolls: rolls,
        timestamp: Date.now()
    });

    // Show result
    diceModal.showResult(total, rolls);

    // Don't update sidebar display yet - only update when user clicks "Save Roll"
}

/**
 * Executes a /roll command and returns the result.
 * @param {string} command - The roll command (e.g., "/roll 2d20")
 * @returns {Promise<{total: number, rolls: Array<number>}>} The roll result
 */
export async function executeRollCommand(command) {
    try {
        // Parse the dice notation (e.g., "2d20")
        const match = command.match(/(\d+)d(\d+)/);
        if (!match) {
            return { total: 0, rolls: [] };
        }

        const count = parseInt(match[1]);
        const sides = parseInt(match[2]);
        const rolls = [];
        let total = 0;

        for (let i = 0; i < count; i++) {
            const roll = Math.floor(Math.random() * sides) + 1;
            rolls.push(roll);
            total += roll;
        }

        return { total, rolls };
    } catch (error) {
        console.error('[RPG Companion] Error rolling dice:', error);
        return { total: 0, rolls: [] };
    }
}

/**
 * Updates the dice display in the sidebar.
 */
export function updateDiceDisplay() {
    const lastRoll = extensionSettings.lastDiceRoll;
    const label = i18n.getTranslation('template.mainPanel.lastRoll') || 'Last Roll: ';
    const noneValue = i18n.getTranslation('global.none') || 'None';

    if (lastRoll) {
        $('#rpg-last-roll-text').text(`${label}(${lastRoll.formula}): ${lastRoll.total}`);
    } else {
        $('#rpg-last-roll-text').text(label + noneValue);
    }
}

/**
 * Clears the last dice roll.
 */
export function clearDiceRoll() {
    extensionSettings.lastDiceRoll = null;
    saveSettings();
    updateDiceDisplay();
}

/**
 * Adds the Roll Dice quick reply button.
 */
export function addDiceQuickReply() {
    // Create quick reply button if Quick Replies exist
    if (window.quickReplyApi) {
        // Quick Reply API integration would go here
        // For now, the dice display in the sidebar serves as the button
    }
}
