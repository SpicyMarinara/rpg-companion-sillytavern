/**
 * Dice System Module
 * Handles dice rolling logic, display updates, and quick reply integration
 */

import {
    extensionSettings,
    pendingDiceRoll,
    setPendingDiceRoll
} from '../../core/state.js';
import { saveSettings } from '../../core/persistence.js';

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
        // Parse dice notation with keep highest/lowest support
        // Supports: XdY, XdYkh#, XdYkl# (e.g., "2d20kh1+5" for advantage, "2d20kl1+5" for disadvantage)
        
        // Strip /roll prefix if present
        let cleanCommand = command.trim();
        if (cleanCommand.startsWith('/roll ')) {
            cleanCommand = cleanCommand.substring(6); // Remove '/roll ' prefix
        }
        
        let total = 0;
        let rolls = [];
        let diceTerms = [];

        // Split by + and - but keep the operators
        const parts = cleanCommand.split(/(?=[+-])/);
        
        for (const part of parts) {
            const trimmedPart = part.trim();
            if (!trimmedPart) continue; // Skip empty parts
            
            // Check for dice notation with keep modifiers (e.g., "2d20kh1", "2d20kl1")
            const diceWithKeepMatch = trimmedPart.match(/^([+-])?(\d+)d(\d+)(?:k([hl])(\d+))?$/i);
            
            if (diceWithKeepMatch) {
                const sign = diceWithKeepMatch[1] ? (diceWithKeepMatch[1] === '-' ? -1 : 1) : 1;
                const count = parseInt(diceWithKeepMatch[2]);
                const sides = parseInt(diceWithKeepMatch[3]);
                const keepType = diceWithKeepMatch[4]?.toLowerCase(); // 'h' for highest, 'l' for lowest
                const keepCount = diceWithKeepMatch[5] ? parseInt(diceWithKeepMatch[5]) : 1;
                
                // Roll all dice
                const rollsForTerm = [];
                for (let i = 0; i < count; i++) {
                    const roll = Math.floor(Math.random() * sides) + 1;
                    rollsForTerm.push(roll);
                }
                
                // Sort and keep only the requested dice
                let keptRolls = rollsForTerm;
                if (keepType) {
                    const sortedRolls = [...rollsForTerm].sort((a, b) => b - a); // Sort descending
                    
                    if (keepType === 'h') {
                        // Keep highest
                        keptRolls = sortedRolls.slice(0, keepCount);
                    } else if (keepType === 'l') {
                        // Keep lowest
                        keptRolls = sortedRolls.slice(-keepCount); // Get last N (lowest)
                    }
                }
                
                // Add kept rolls to total
                const termTotal = keptRolls.reduce((sum, r) => sum + r, 0) * sign;
                total += termTotal;
                rolls.push(...keptRolls);
                
                diceTerms.push({
                    original: rollsForTerm,
                    kept: keptRolls,
                    keepType: keepType,
                    sign: sign
                });
            } else {
                // Flat modifier (e.g., "+5", "-3")
                const modifierMatch = trimmedPart.match(/^([+-])(\d+)$/);
                if (modifierMatch) {
                    const sign = modifierMatch[1] === '-' ? -1 : 1;
                    const value = parseInt(modifierMatch[2]);
                    total += value * sign;
                }
            }
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
    if (lastRoll) {
        $('#rpg-last-roll-text').text(`Last Roll (${lastRoll.formula}): ${lastRoll.total}`);
    } else {
        $('#rpg-last-roll-text').text('Last Roll: None');
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
