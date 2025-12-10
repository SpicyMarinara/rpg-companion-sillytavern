/**
 * Roll Damage Dialog Module
 * Shows dice rolling interface with manual adjustment capability
 */

import { executeRollCommand } from '../features/dice.js';

/**
 * Shows a damage rolling dialog with manual adjustment
 * @param {Object} options - Options for the dialog
 * @param {string} options.itemName - Name of spell/ability
 * @param {string} options.formula - Dice formula (e.g., "8d6")
 * @param {string} options.scalingFormula - Optional scaling formula (e.g., "2d6")
 * @param {number} options.damageBonus - Bonus from tracker (e.g., 4)
 * @param {boolean} options.isCritical - If true, double the damage bonus
 * @param {Object} options.attackInfo - Optional attack roll info to display (e.g., {total: 27, isCrit: true})
 * @returns {Promise<{rolled: boolean, total: number, baseRolls: Array, scalingRolls: Array, baseFormula: string, scalingFormula?: string}>}
 */
export async function showRollDialog(options) {
    const { itemName, formula, scalingFormula, damageBonus = 0, isCritical = false, attackInfo = null } = options;

    return new Promise((resolve) => {
        // Build initial HTML with adjustable dice
        const parts = formula.split('d');
        let baseCount = parseInt(parts[0]);
        const baseSides = parseInt(parts[1]);

        // Double the dice count on critical hit
        if (isCritical) {
            baseCount = baseCount * 2;
        }

        // Add attack roll info at the top if provided
        let attackInfoHtml = '';
        if (attackInfo) {
            const critText = attackInfo.isCrit ? ' <span style="color: #ff6b6b; font-weight: bold;">CRIT!!</span>' : '';
            attackInfoHtml = `
                <div style="margin-bottom: 1rem; padding: 0.75rem; background: var(--rpg-bg-dark); border: 1px solid var(--rpg-border); border-radius: 4px;">
                    <div style="color: var(--rpg-text); font-size: 0.9rem;"><strong>Attack Roll Result:</strong> ${attackInfo.total}${critText}</div>
                </div>
            `;
        }

        let scalingHtml = '';
        let scalingCount = 0;
        let scalingSides = 0;
        if (scalingFormula) {
            const scalingParts = scalingFormula.split('d');
            scalingCount = parseInt(scalingParts[0]);
            scalingSides = parseInt(scalingParts[1]);
            // Double scaling dice on critical too
            if (isCritical) {
                scalingCount = scalingCount * 2;
            }
            scalingHtml = `
                <div class="rpg-form-group" style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--rpg-border);">
                    <label style="color: var(--rpg-text); font-size: 0.9rem;">Scaling Damage</label>
                    <div style="display: flex; gap: 0.5rem; align-items: center; margin-top: 0.5rem;">
                        <input type="number" id="rpg-scaling-count" class="rpg-modal-input" value="${scalingCount}" min="1" style="width: 60px;" />
                        <span style="color: var(--rpg-text);">d</span>
                        <input type="number" id="rpg-scaling-sides" class="rpg-modal-input" value="${scalingSides}" min="1" style="width: 60px;" />
                    </div>
                </div>
            `;
        }

        const bonusHtml = damageBonus > 0 ? `
            <div style="margin-top: 0.5rem;">
                <label style="color: var(--rpg-text); font-size: 0.85rem;">+ ${damageBonus} bonus ${isCritical ? '(critical)' : '(ability)'}</label>
            </div>
        ` : '';

        const criticalNote = isCritical ? '<div style="color: var(--rpg-accent); font-size: 0.85rem; margin-top: 0.5rem;"><strong>CRITICAL HIT!</strong> Dice doubled</div>' : '';

        const dialogHtml = `
            <div class="rpg-add-item-modal">
                <h2>Roll Damage</h2>
                <div class="rpg-modal-form">
                    ${attackInfoHtml}
                    <div class="rpg-form-group">
                        <label style="color: var(--rpg-text); font-size: 0.9rem;">
                            ${escapeHtml(itemName)}
                        </label>
                        <label style="color: var(--rpg-text); font-size: 0.85rem; opacity: 0.8; margin-top: 0.5rem;">Base Damage</label>
                        <div style="display: flex; gap: 0.5rem; align-items: center; margin-top: 0.5rem;">
                            <input type="number" id="rpg-base-count" class="rpg-modal-input" value="${baseCount}" min="1" style="width: 60px;" />
                            <span style="color: var(--rpg-text);">d</span>
                            <input type="number" id="rpg-base-sides" class="rpg-modal-input" value="${baseSides}" min="1" style="width: 60px;" />
                        </div>
                        ${bonusHtml}
                        ${criticalNote}
                    </div>
                    ${scalingHtml}
                    <div class="rpg-modal-buttons">
                        <button id="rpg-roll-cancel" class="rpg-modal-btn rpg-modal-cancel">Cancel</button>
                        <button id="rpg-roll-confirm" class="rpg-modal-btn rpg-modal-submit">Roll Damage</button>
                    </div>
                </div>
            </div>
        `;

        const $modal = $('<div class="rpg-add-item-modal-overlay"></div>');
        $modal.html(dialogHtml);
        $('body').append($modal);

        $modal.find('#rpg-roll-confirm').on('click', async function () {
            const newBaseCount = parseInt($modal.find('#rpg-base-count').val()) || baseCount;
            const newBaseSides = parseInt($modal.find('#rpg-base-sides').val()) || baseSides;
            const newFormula = `${newBaseCount}d${newBaseSides}`;

            const baseRollResult = await executeRollCommand(`/roll ${newFormula}`);
            let baseTotal = (baseRollResult.total || 0) + damageBonus;

            let scalingRolls = [];
            let scalingTotal = 0;
            let newScalingFormula = '';
            let total = baseTotal;

            if (scalingFormula) {
                const newScalingCount = parseInt($modal.find('#rpg-scaling-count').val()) || scalingCount;
                const newScalingSides = parseInt($modal.find('#rpg-scaling-sides').val()) || scalingSides;
                newScalingFormula = `${newScalingCount}d${newScalingSides}`;
                const scalingRollResult = await executeRollCommand(`/roll ${newScalingFormula}`);
                scalingRolls = scalingRollResult.rolls || [];
                scalingTotal = (scalingRollResult.total || 0) + damageBonus;
                total += scalingTotal;
            }

            $modal.remove();

            resolve({
                rolled: true,
                total: total,
                baseRolls: baseRollResult.rolls || [],
                scalingRolls: scalingRolls,
                baseFormula: newFormula,
                scalingFormula: newScalingFormula,
                baseTotal: baseTotal,
                scalingTotal: scalingTotal,
                damageBonus: damageBonus
            });
        });

        $modal.find('#rpg-roll-cancel').on('click', function () {
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
 * Shows a confirmation modal with both attack and damage roll results
 * @param {Object} options - Roll result info
 * @param {string} options.itemName - Name of item
 * @param {number} options.attackRoll - Attack roll total
 * @param {boolean} options.isCrit - Is natural 20
 * @param {number} options.damageRoll - Damage roll total
 * @param {string} options.damageType - Damage type (optional)
 * @returns {Promise<boolean>} true to send, false to cancel
 */
export async function showRollConfirmationModal(options) {
    const { itemName, attackRoll, isCrit, damageRoll, damageType } = options;
    
    return new Promise((resolve) => {
        const critHtml = isCrit ? '<span style="color: #ff6b6b; font-weight: bold; margin-left: 0.5rem;">CRIT!!</span>' : '';
        const typeHtml = damageType ? `<span style="margin-left: 0.5rem; color: var(--rpg-text);">${escapeHtml(damageType)}</span>` : '';
        
        const dialogHtml = `
            <div class="rpg-add-item-modal">
                <h2>Roll Summary</h2>
                <div class="rpg-modal-form">
                    <div style="margin-bottom: 1rem; padding: 1rem; background: var(--rpg-bg-dark); border: 1px solid var(--rpg-border); border-radius: 4px;">
                        <div style="color: var(--rpg-text); margin-bottom: 0.75rem;">
                            <strong style="font-size: 1.1rem;">${escapeHtml(itemName)}</strong>
                        </div>
                        <div style="color: var(--rpg-text); margin-bottom: 0.5rem; display: flex; align-items: center;">
                            <strong>Attack Roll:</strong>
                            <span style="margin-left: 0.5rem; font-weight: bold; color: #4a9eff;">${attackRoll}</span>
                            ${critHtml}
                        </div>
                        <div style="color: var(--rpg-text); display: flex; align-items: center;">
                            <strong>Damage Roll:</strong>
                            <span style="margin-left: 0.5rem; font-weight: bold; color: #f76b8a;">${damageRoll}</span>
                            ${typeHtml}
                        </div>
                    </div>
                    <div class="rpg-modal-buttons">
                        <button id="rpg-confirm-cancel" class="rpg-modal-btn rpg-modal-cancel">Cancel</button>
                        <button id="rpg-confirm-send" class="rpg-modal-btn rpg-modal-submit">Send to Chat</button>
                    </div>
                </div>
            </div>
        `;

        const $modal = $('<div class="rpg-add-item-modal-overlay"></div>');
        $modal.html(dialogHtml);
        $('body').append($modal);

        $modal.find('#rpg-confirm-send').on('click', function () {
            $modal.remove();
            resolve(true);
        });

        $modal.find('#rpg-confirm-cancel').on('click', function () {
            $modal.remove();
            resolve(false);
        });

        // Close on overlay click
        $modal.on('click', function (e) {
            if (e.target === this) {
                $modal.remove();
                resolve(false);
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
