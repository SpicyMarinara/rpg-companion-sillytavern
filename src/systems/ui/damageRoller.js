/**
 * Damage Roller Module
 * Handles extracting dice notation from descriptions and rolling damage
 */

import { executeRollCommand } from '../features/dice.js';

/**
 * Extracts dice notation from a description
 * Finds patterns like "8d6", "2d4 + 1d6 per higher-level spell slot", etc.
 * @param {string} description - The ability/spell description
 * @returns {Array<{formula: string, label: string}>} Array of dice formulas found
 */
export function extractDiceFormulas(description) {
    if (!description || typeof description !== 'string') {
        return [];
    }

    const formulas = [];
    
    // Pattern 1: Simple dice notation like "8d6", "2d4", etc.
    const simpleDiceRegex = /(\d+d\d+)/gi;
    const simpleMatches = [...description.matchAll(simpleDiceRegex)];
    
    if (simpleMatches.length > 0) {
        // Check if there's a "per higher-level spell slot" or similar scaling modifier
        const hasPerSlot = /per\s+(higher-level\s+)?spell\s+slot|per\s+level|for\s+each\s+slot\s+level\s+above|increases?\s+by|using\s+a\s+higher-level\s+spell\s+slot/i.test(description);
        
        // Get the first dice notation as base damage
        const baseDice = simpleMatches[0][1].toLowerCase();
        
        if (hasPerSlot) {
            formulas.push({
                formula: baseDice,
                label: 'Base Damage',
                isBaseWithScaling: true
            });
        } else {
            formulas.push({
                formula: baseDice,
                label: 'Damage'
            });
        }
    }

    return formulas;
}

/**
 * Extracts the first flat damage bonus after a dice term (e.g., "1d8+1" -> 1)
 * @param {string} description
 * @returns {number} flat bonus (can be negative); 0 if none found
 */
export function extractFlatDamageBonus(description) {
    if (!description || typeof description !== 'string') return 0;

    // Look for patterns like "1d8+1" or "2d6 - 3"
    const diceWithBonus = /(\d+d\d+)\s*([+\-])\s*(\d+)/i;
    const match = description.match(diceWithBonus);
    if (match) {
        const sign = match[2] === '-' ? -1 : 1;
        const bonus = parseInt(match[3]);
        return sign * (bonus || 0);
    }
    return 0;
}

/**
 * Calculates additional dice from spell level scaling
 * "per higher-level spell slot" means +1 die per level above the spell's base level
 * @param {string} description - The ability/spell description
 * @param {number} baseLevel - The spell's base level
 * @param {number} castLevel - The level the spell was cast at
 * @returns {string} Additional dice formula (e.g., "2d6") or empty string
 */
export function calculateScalingDice(description, baseLevel, castLevel) {
    if (!description || baseLevel === undefined || castLevel === undefined) {
        return '';
    }

    const hasPerSlot = /per\s+(higher-level\s+)?spell\s+slot|per\s+level|for\s+each\s+slot\s+level\s+above|increases?\s+by|using\s+a\s+higher-level\s+spell\s+slot/i.test(description);
    if (!hasPerSlot) {
        return '';
    }

    const levelDifference = castLevel - baseLevel;
    if (levelDifference <= 0) {
        return '';
    }

    // Try multiple patterns to find the scaling dice
    // Pattern 1: "1d6 per higher-level spell slot" or "1d6 for each slot level above"
    const pattern1 = /(\d+d\d+)\s+(?:for\s+)?(?:each\s+)?(?:spell\s+)?(?:slot\s+)?level\s+above|(\d+d\d+)\s+per\s+(?:higher-level\s+)?spell\s+slot/i;
    const match1 = description.match(pattern1);
    
    if (match1) {
        // Get the first non-null match group
        const dicePattern = (match1[1] || match1[2] || '').toLowerCase();
        if (dicePattern) {
            const [count, sides] = dicePattern.split('d').map(Number);
            if (count && sides) {
                return `${count * levelDifference}d${sides}`;
            }
        }
    }

    // Pattern 2: Look for "The damage increases by 1d6" pattern
    const pattern2 = /(?:damage|harm)\s+increases?\s+by\s+(\d+d\d+)/i;
    const match2 = description.match(pattern2);
    
    if (match2) {
        const dicePattern = match2[1].toLowerCase();
        const [count, sides] = dicePattern.split('d').map(Number);
        if (count && sides) {
            return `${count * levelDifference}d${sides}`;
        }
    }

    // If we can't parse the exact pattern, assume 1d6 per level (common D&D convention)
    return `${levelDifference}d6`;
}

/**
 * Rolls damage for a spell/ability with optional scaling
 * @param {Object} options - Options for rolling
 * @param {string} options.itemName - Name of spell/ability
 * @param {string} options.description - Full description
 * @param {number} options.baseLevel - Base spell level (optional)
 * @param {number} options.castLevel - Level cast at (optional)
 * @returns {Promise<{success: boolean, rolls: Array, total: number, formula: string, scalingFormula?: string, scalingRolls?: Array, scalingTotal?: number}>}
 */
export async function rollDamage(options) {
    const { itemName, description, baseLevel, castLevel } = options;
    
    const formulas = extractDiceFormulas(description);
    if (formulas.length === 0) {
        return {
            success: false,
            error: 'No dice notation found in description'
        };
    }

    const baseFormula = formulas[0].formula;
    const result = await executeRollCommand(`/roll ${baseFormula}`);

    const rollResult = {
        success: true,
        formula: baseFormula,
        rolls: result.rolls || [],
        total: result.total || 0,
        itemName: itemName
    };

    // Handle scaling damage
    if (formulas[0].isBaseWithScaling && baseLevel !== undefined && castLevel !== undefined) {
        const scalingFormula = calculateScalingDice(description, baseLevel, castLevel);
        if (scalingFormula) {
            const scalingResult = await executeRollCommand(`/roll ${scalingFormula}`);
            rollResult.scalingFormula = scalingFormula;
            rollResult.scalingRolls = scalingResult.rolls || [];
            rollResult.scalingTotal = scalingResult.total || 0;
            rollResult.total += rollResult.scalingTotal;
        }
    }

    return rollResult;
}

/**
 * Shows a damage roll result modal
 * @param {Object} rollResult - Result from rollDamage()
 * @returns {Promise<boolean>} Resolves when user closes modal
 */
export async function showDamageRollModal(rollResult) {
    return new Promise((resolve) => {
        if (!rollResult.success) {
            // Show error
            const errorHtml = `
                <div class="rpg-add-item-modal-overlay">
                    <div class="rpg-add-item-modal">
                        <h2>Damage Roll</h2>
                        <div class="rpg-modal-form">
                            <p style="color: var(--rpg-text); text-align: center;">
                                No damage dice found in description
                            </p>
                            <div class="rpg-modal-buttons">
                                <button class="rpg-modal-btn rpg-modal-submit" style="margin: 0 auto;">Close</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            const $error = $(errorHtml);
            $('body').append($error);
            
            $error.on('click', '.rpg-modal-submit', () => {
                $error.remove();
                resolve(false);
            });
            
            return;
        }

        // Build roll display
        let rollDisplay = rollResult.rolls.map(r => `<span class="rpg-roll-result">${r}</span>`).join(' + ');
        let rollsText = `${rollResult.formula}: [${rollDisplay}] = <strong>${rollResult.total}</strong>`;

        let scalingDisplay = '';
        if (rollResult.scalingFormula && rollResult.scalingTotal !== undefined) {
            const scalingRollDisplay = rollResult.scalingRolls.map(r => `<span class="rpg-roll-result">${r}</span>`).join(' + ');
            scalingDisplay = `
                <div class="rpg-form-group" style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--rpg-border);">
                    <label style="color: var(--rpg-text); font-size: 0.85rem; opacity: 0.8;">Scaling Damage</label>
                    <div style="color: var(--rpg-text); font-family: monospace; font-size: 0.95rem;">
                        ${rollResult.scalingFormula}: [${scalingRollDisplay}] = <strong>${rollResult.scalingTotal}</strong>
                    </div>
                </div>
            `;
        }

        const modalHtml = `
            <div class="rpg-add-item-modal-overlay">
                <div class="rpg-add-item-modal">
                    <h2>Damage Roll</h2>
                    <div class="rpg-modal-form">
                        <div class="rpg-form-group">
                            <label style="color: var(--rpg-text); font-size: 0.9rem;">
                                ${escapeHtml(rollResult.itemName)}
                            </label>
                            <div style="color: var(--rpg-text); font-family: monospace; font-size: 0.95rem; margin-top: 0.5rem;">
                                ${rollsText}
                            </div>
                        </div>
                        ${scalingDisplay}
                        <div class="rpg-form-group" style="margin-top: 1.5rem; background-color: rgba(233, 69, 96, 0.1); padding: 1rem; border-radius: 4px; border: 1px solid var(--rpg-highlight);">
                            <div style="color: var(--rpg-highlight); font-size: 1.2rem; font-weight: bold; text-align: center;">
                                Total Damage: ${rollResult.total}
                            </div>
                        </div>
                        <div class="rpg-modal-buttons">
                            <button class="rpg-modal-btn rpg-modal-submit">Close</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const $modal = $(modalHtml);
        $('body').append($modal);

        $modal.on('click', '.rpg-modal-submit, .rpg-add-item-modal-overlay', (e) => {
            if (e.target === $modal[0] || $(e.target).hasClass('rpg-modal-submit')) {
                $modal.remove();
                resolve(true);
            }
        });
    });
}

/**
 * Escapes HTML special characters
 */
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}
