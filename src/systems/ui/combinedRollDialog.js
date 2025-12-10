/**
 * Combined Roll Dialog Module
 * Single window for attack and damage rolls with live results
 */

import { executeRollCommand } from '../features/dice.js';

/**
 * Shows a combined attack + damage roll dialog
 * @param {Object} options - Options for the dialog
 * @param {string} options.itemName - Name of spell/ability
 * @param {Object} options.attackInfo - Attack info {modifier, bonus, hasAttack}
 * @param {string} options.damageFormula - Base damage formula (can be complex like "8d6+2d6")
 * @param {Object} options.damageInfo - Damage info {selectable, modifiers}
 * @param {number} options.damageBonus - Damage bonus
 * @param {boolean} options.isCritical - Is critical hit
 * @param {number} options.spellLevel - Spell level for slot deduction (optional, only for spells)
 * @returns {Promise<{rolled: boolean, attackRoll: number|null, attackBreakdown: string|null, damageRoll: number|null, damageBreakdown: string|null, damageType: string|null, isCrit: boolean, spellLevel: number|null}>}
 */
export async function showCombinedRollDialog(options) {
    const { itemName, attackInfo, damageFormula, damageInfo, damageBonus = 0, isCritical = false, spellLevel = null } = options;

    return new Promise((resolve) => {
        // Initialize damage dice from formula - handle complex formulas like "8d6+2d6"
        // Just display the formula as-is in the input field
        let displayFormula = damageFormula;
        if (damageBonus > 0) {
            displayFormula = `${damageFormula}+${damageBonus}`;
        }

        if (isCritical) {
            // Double the dice count for crits
            // For complex formulas like "8d6+2d6", we need to double each die term
            displayFormula = displayFormula.split('+').map(term => {
                const match = term.match(/^(\d+)d(\d+)$/);
                if (match) {
                    return `${parseInt(match[1]) * 2}d${match[2]}`;
                }
                return term;
            }).join('+');
        }

        // Build damage type options
        let damageTypeOptions = '';
        if (damageInfo && (damageInfo.selectable.length > 0 || damageInfo.modifiers.length > 0)) {
            damageTypeOptions = damageInfo.selectable
                .map(type => `<option value="${type}">${type}</option>`)
                .join('');
            damageTypeOptions += '<option value="custom">Custom...</option>';
        }

        // Build attack section HTML
        let attackSectionHtml = '';
        if (attackInfo && attackInfo.hasAttack) {
            const totalModifier = (attackInfo.modifier || 0) + (attackInfo.bonus || 0);
            attackSectionHtml = `
                <div class="rpg-form-group" style="margin-bottom: 1.5rem; padding-bottom: 1.5rem; border-bottom: 1px solid var(--rpg-border);">
                    <label style="color: var(--rpg-text); font-weight: bold; display: block; margin-bottom: 0.75rem;">Attack Roll</label>
                    <div style="display: flex; gap: 0.5rem; align-items: flex-end; margin-bottom: 0.5rem;">
                        <div style="flex: 1;">
                            <label style="color: var(--rpg-text); font-size: 0.85rem; display: block; margin-bottom: 0.25rem;">Formula</label>
                            <input type="text" id="rpg-attack-formula" class="rpg-modal-input" value="1d20+${totalModifier}" style="width: 100%;" />
                        </div>
                        <button id="rpg-attack-roll-btn" class="rpg-modal-btn rpg-modal-submit" style="padding: 0.5rem 1rem;">Roll</button>
                    </div>
                    <div id="rpg-attack-result" style="color: var(--rpg-text); font-weight: bold; min-height: 1.5rem; display: flex; align-items: center; color: #4a9eff;">
                        <!-- Result will appear here -->
                    </div>
                </div>
            `;
        }

        // Build damage type selector
        let damageTypeSelectorHtml = '';
        if (damageTypeOptions) {
            damageTypeSelectorHtml = `
                <div style="flex: 1;">
                    <label style="color: var(--rpg-text); font-size: 0.85rem; display: block; margin-bottom: 0.25rem;">Damage Type</label>
                    <select id="rpg-damage-type-select" class="rpg-modal-input" style="width: 100%;">
                        ${damageTypeOptions}
                    </select>
                    <input type="text" id="rpg-damage-type-custom" class="rpg-modal-input" placeholder="Enter custom type" style="width: 100%; margin-top: 0.25rem; display: none;" />
                </div>
            `;
        }

        const dialogHtml = `
            <div class="rpg-add-item-modal">
                <h2>${escapeHtml(itemName)}</h2>
                <div class="rpg-modal-form">
                    ${attackSectionHtml}
                    
                    <div class="rpg-form-group">
                        <label style="color: var(--rpg-text); font-weight: bold; display: block; margin-bottom: 0.75rem;">Damage Roll</label>
                        <div style="display: flex; gap: 0.5rem; align-items: flex-end; margin-bottom: 0.5rem;">
                            <div style="flex: 1;">
                                <label style="color: var(--rpg-text); font-size: 0.85rem; display: block; margin-bottom: 0.25rem;">Formula</label>
                                <input type="text" id="rpg-damage-formula" class="rpg-modal-input" value="${displayFormula}" style="width: 100%;" />
                            </div>
                            ${damageTypeSelectorHtml}
                            <button id="rpg-damage-roll-btn" class="rpg-modal-btn rpg-modal-submit" style="padding: 0.5rem 1rem;">Roll</button>
                        </div>
                        <div id="rpg-damage-result" style="color: var(--rpg-text); font-weight: bold; min-height: 1.5rem; display: flex; align-items: center; color: #f76b8a;">
                            <!-- Result will appear here -->
                        </div>
                    </div>
                    
                    <div class="rpg-modal-buttons" style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--rpg-border);">
                        <button id="rpg-combined-cancel" class="rpg-modal-btn rpg-modal-cancel">Cancel</button>
                        <button id="rpg-combined-send" class="rpg-modal-btn rpg-modal-submit">Send to Chat!</button>
                    </div>
                </div>
            </div>
        `;

        const $modal = $('<div class="rpg-add-item-modal-overlay"></div>');
        $modal.html(dialogHtml);
        $('body').append($modal);

        // State to track roll results
        let attackResult = null;
        let attackBreakdown = null;
        let damageResult = null;
        let damageBreakdown = null;
        let isCritRoll = false;
        let selectedDamageType = damageInfo && damageInfo.selectable.length > 0 ? damageInfo.selectable[0] : null;

        // Handle damage type custom input
        if (damageTypeOptions) {
            $modal.find('#rpg-damage-type-select').on('change', function () {
                if ($(this).val() === 'custom') {
                    $modal.find('#rpg-damage-type-custom').show().focus();
                    selectedDamageType = null;
                } else {
                    $modal.find('#rpg-damage-type-custom').hide();
                    selectedDamageType = $(this).val();
                }
            });

            $modal.find('#rpg-damage-type-custom').on('input', function () {
                selectedDamageType = $(this).val() || null;
            });
        }

        // Handle attack roll
        $modal.find('#rpg-attack-roll-btn').on('click', async function () {
            const formula = $modal.find('#rpg-attack-formula').val().trim();
            if (!formula) return;

            const result = await executeRollCommand(`/roll ${formula}`);
            attackResult = result.total || 0;
            
            // Build breakdown string from individual rolls + modifiers
            if (result.rolls && result.rolls.length > 0) {
                attackBreakdown = result.rolls.join('+');
                // Extract modifiers from formula (e.g., "+9" from "1d20+9")
                const modifierMatches = formula.match(/([+-]\d+)/g) || [];
                for (const modifier of modifierMatches) {
                    attackBreakdown += modifier;
                }
            } else {
                attackBreakdown = String(attackResult);
            }
            
            const isCrit = formula.includes('1d20') && result.rolls && result.rolls[0] === 20;
            isCritRoll = isCrit;
            const critText = isCrit ? ' <span style="color: #ff6b6b; font-weight: bold;">CRIT!!</span>' : '';
            $modal.find('#rpg-attack-result').html(`Attack Result: ${attackBreakdown} = <strong>${attackResult}</strong>${critText}`);
            
            // Auto-double damage dice on crit
            if (isCrit) {
                const damageFormulaField = $modal.find('#rpg-damage-formula');
                const currentFormula = damageFormulaField.val();
                // Double all dice terms in the formula (e.g., "8d6+2d6" becomes "16d6+4d6")
                const doubledFormula = currentFormula.split('+').map(term => {
                    const match = term.match(/^(\d+)d(\d+)$/);
                    if (match) {
                        return `${parseInt(match[1]) * 2}d${match[2]}`;
                    }
                    return term;
                }).join('+');
                damageFormulaField.val(doubledFormula);
            }
        });

        // Handle damage roll
        $modal.find('#rpg-damage-roll-btn').on('click', async function () {
            const formula = $modal.find('#rpg-damage-formula').val().trim();
            if (!formula) return;

            const result = await executeRollCommand(`/roll ${formula}`);
            damageResult = result.total || 0;

            // Build breakdown string showing individual rolls + modifiers
            if (result.rolls && result.rolls.length > 0) {
                damageBreakdown = result.rolls.join('+');
                // Extract modifiers from formula (e.g., "+4" from "2d6+4")
                const modifierMatches = formula.match(/([+-]\d+)/g) || [];
                for (const modifier of modifierMatches) {
                    damageBreakdown += modifier;
                }
            } else {
                damageBreakdown = String(damageResult);
            }

            $modal.find('#rpg-damage-result').html(`Damage Result: ${damageBreakdown} = <strong>${damageResult}</strong>`);
        });

        // Handle send to chat
        $modal.find('#rpg-combined-send').on('click', function () {
            // Require at least damage roll (attack is optional)
            if (damageResult === null) {
                alert('Please roll damage before sending to chat');
                return;
            }

            $modal.remove();
            resolve({
                rolled: true,
                attackRoll: attackResult,
                attackBreakdown: attackBreakdown,
                damageRoll: damageResult,
                damageBreakdown: damageBreakdown,
                damageType: selectedDamageType,
                isCrit: isCritRoll,
                spellLevel: spellLevel,
                requiresSave: options.requiresSave || false,
                saveType: options.saveType || null,
                isAreaSpell: options.isAreaSpell || false
            });
        });

        // Handle cancel
        $modal.find('#rpg-combined-cancel').on('click', function () {
            $modal.remove();
            resolve({ rolled: false });
        });

        // Close on overlay click
        $modal.on('click', function (e) {
            if (e.target === this) {
                $modal.remove();
                resolve({ rolled: false });
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
