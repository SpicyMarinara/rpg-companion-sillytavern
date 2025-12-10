/**
 * Roll Attack Dialog Module
 * Shows attack/hit roll interface with d20 + modifier
 */

import { executeRollCommand } from '../features/dice.js';

/**
 * Extracts attack/hit bonus from description
 * Looks for patterns like "Hit 1+8", "Attack +5", etc.
 * @param {string} description - The ability/spell description
 * @returns {{hasAttack: boolean, modifier: number}} Attack info
 */
export function extractAttackBonus(description) {
    if (!description || typeof description !== 'string') {
        return { hasAttack: false, modifier: 0 };
    }

    // Pattern 1: "Hit +5" or "Hit 5" (with or without colon)
    const hitPattern = /Hit\s*:?\s*\+?(\d+)/i;
    const hitMatch = description.match(hitPattern);
    
    if (hitMatch) {
        const modifier = parseInt(hitMatch[1]);
        return { hasAttack: true, modifier: modifier || 0 };
    }

    // Pattern 2: "Attack bonus +5" or "Attack +5"
    const attackPattern = /Attack\s+(?:bonus\s+)?\+(\d+)/i;
    const attackMatch = description.match(attackPattern);
    
    if (attackMatch) {
        const modifier = parseInt(attackMatch[1]);
        return { hasAttack: true, modifier: modifier || 0 };
    }

    // Pattern 3: "Melee/Ranged Weapon Attack: +5"
    const weaponPattern = /(?:Melee|Ranged)\s+Weapon\s+Attack:\s*\+(\d+)/i;
    const weaponMatch = description.match(weaponPattern);
    
    if (weaponMatch) {
        const modifier = parseInt(weaponMatch[1]);
        return { hasAttack: true, modifier: modifier || 0 };
    }

    // Pattern 4: "Spell Attack +5"
    const spellAttackPattern = /Spell\s+Attack\s*\+(\d+)/i;
    const spellAttackMatch = description.match(spellAttackPattern);
    
    if (spellAttackMatch) {
        const modifier = parseInt(spellAttackMatch[1]);
        return { hasAttack: true, modifier: modifier || 0 };
    }

    // Pattern 5: bare "Hit" without a numeric bonus (default to 0 modifier)
    const bareHitPattern = /\bHit\b(?!\s*points)/i;
    if (bareHitPattern.test(description)) {
        return { hasAttack: true, modifier: 0 };
    }

    return { hasAttack: false, modifier: 0 };
}

/**
 * Shows an attack roll dialog with d20 + modifier
 * @param {Object} options - Options for the dialog
 * @param {string} options.itemName - Name of spell/ability
 * @param {number} options.modifier - Attack bonus modifier (from description)
 * @param {number} options.bonus - Additional bonus (from tracker)
 * @returns {Promise<{rolled: boolean, total: number, d20Roll: number, modifier: number, isNatural20: boolean}>}
 */
export async function showAttackRollDialog(options) {
    const { itemName, modifier = 0, bonus = 0 } = options;
    const totalModifier = modifier + bonus;

    return new Promise((resolve) => {
        const dialogHtml = `
            <div class="rpg-add-item-modal">
                <h2>Attack Roll</h2>
                <div class="rpg-modal-form">
                    <div class="rpg-form-group">
                        <label style="color: var(--rpg-text); font-size: 0.9rem;">
                            ${escapeHtml(itemName)}
                        </label>
                        <label style="color: var(--rpg-text); font-size: 0.85rem; opacity: 0.8; margin-top: 0.5rem;">Roll d20 + Bonuses</label>
                        <div style="display: flex; gap: 0.5rem; align-items: center; margin-top: 0.5rem;">
                            <span style="color: var(--rpg-text); font-weight: 600;">d20</span>
                            ${modifier > 0 ? `<span style="color: var(--rpg-text);">+ ${modifier} (description)</span>` : ''}
                            ${bonus > 0 ? `<span style="color: var(--rpg-text);">+ ${bonus} (Bonus)</span>` : ''}
                        </div>
                        <div style="margin-top: 0.5rem;">
                            <label style="color: var(--rpg-text); font-size: 0.85rem;">Total Modifier</label>
                            <input type="number" id="rpg-attack-modifier" class="rpg-modal-input" value="${totalModifier}" style="width: 80px;" />
                        </div>
                    </div>
                    <div class="rpg-modal-buttons">
                        <button id="rpg-attack-cancel" class="rpg-modal-btn rpg-modal-cancel">Cancel</button>
                        <button id="rpg-attack-confirm" class="rpg-modal-btn rpg-modal-submit">Roll Attack</button>
                    </div>
                </div>
            </div>
        `;

        const $modal = $('<div class="rpg-add-item-modal-overlay"></div>');
        $modal.html(dialogHtml);
        $('body').append($modal);

        $modal.find('#rpg-attack-confirm').on('click', async function () {
            const finalModifier = parseInt($modal.find('#rpg-attack-modifier').val()) || totalModifier;

            // Roll d20
            const d20Result = await executeRollCommand('/roll 1d20');
            const d20Roll = d20Result.rolls?.[0] || 0;
            const total = d20Roll + finalModifier;
            const isNatural20 = d20Roll === 20;

            $modal.remove();

            resolve({
                rolled: true,
                total: total,
                d20Roll: d20Roll,
                modifier: finalModifier,
                isNatural20: isNatural20
            });
        });

        $modal.find('#rpg-attack-cancel').on('click', function () {
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
 * Extracts damage types from description
 * Looks for patterns like "piercing or slashing", "Fire or Necrotic", etc.
 * Separates out "magical/nonmagical" modifiers which always prepend to the result
 * @param {string} description - The ability/spell description
 * @returns {{selectable: string[], modifiers: string[]}} Selectable types and always-on modifiers
 */
export function extractDamageTypes(description) {
    if (!description || typeof description !== 'string') {
        return { selectable: [], modifiers: [] };
    }

    // Common damage type keywords
    const damageKeywords = [
        'piercing', 'slashing', 'bludgeoning',
        'fire', 'cold', 'lightning', 'thunder', 'acid', 'poison',
        'radiant', 'necrotic', 'psychic', 'force',
        'magical', 'nonmagical'
    ];

    // Build a regex pattern for all damage types with word boundaries
    // Looks for "type1 or type2 or type3 damage" patterns
    const damagePattern = new RegExp(
        `(${damageKeywords.join('|')})\\s+(?:or\\s+)?(?:damage|d\\d)?`,
        'gi'
    );

    const matches = [...description.matchAll(damagePattern)];
    const selectableTypes = [];
    const modifierTypes = [];
    const seen = new Set();

    matches.forEach(match => {
        const type = match[1].trim().toLowerCase();
        // Capitalize and avoid duplicates
        const capitalizedType = type.charAt(0).toUpperCase() + type.slice(1);
        
        if (seen.has(capitalizedType) || type === 'damage') return;
        
        // Separate magical/nonmagical from selectable types
        if (type === 'magical' || type === 'nonmagical') {
            modifierTypes.push(capitalizedType);
        } else {
            selectableTypes.push(capitalizedType);
        }
        seen.add(capitalizedType);
    });

    return { selectable: selectableTypes, modifiers: modifierTypes };
}

/**
 * Shows a damage type selection dialog if multiple types exist
 * @param {Object} options - Options object
 * @param {string[]} options.selectableTypes - Array of damage type options to choose from
 * @param {string[]} options.modifiers - Modifiers like "Magical" that always prepend
 * @returns {Promise<string|null>} Selected damage type or null if cancelled
 */
export async function showDamageTypeDialog(options = {}) {
    const { selectableTypes = [], modifiers = [] } = options;

    if (!selectableTypes || selectableTypes.length === 0) {
        // No selectable types, just return modifiers joined (if any)
        return modifiers.length > 0 ? modifiers.join(' ') : null;
    }

    if (selectableTypes.length === 1) {
        // Single type - combine with modifiers if any
        const result = selectableTypes[0];
        return modifiers.length > 0 ? modifiers.join(' ') + ' ' + result : result;
    }

    // Multiple selectable types - show selection dialog
    return new Promise((resolve) => {
        const typeOptions = selectableTypes
            .map(type => `<option value="${type}">${type}</option>`)
            .join('');

        const dialogHtml = `
            <div class="rpg-add-item-modal">
                <h2>Select Damage Type</h2>
                <div class="rpg-modal-form">
                    <div class="rpg-form-group">
                        <label for="rpg-damage-type-select" style="color: var(--rpg-text);">Choose damage type:</label>
                        <select id="rpg-damage-type-select" class="rpg-modal-input">
                            ${typeOptions}
                        </select>
                    </div>
                    <div class="rpg-modal-buttons">
                        <button id="rpg-type-cancel" class="rpg-modal-btn rpg-modal-cancel">Cancel</button>
                        <button id="rpg-type-confirm" class="rpg-modal-btn rpg-modal-submit">Confirm</button>
                    </div>
                </div>
            </div>
        `;

        const $modal = $('<div class="rpg-add-item-modal-overlay"></div>');
        $modal.html(dialogHtml);
        $('body').append($modal);

        $modal.find('#rpg-type-confirm').on('click', function () {
            const selectedType = $modal.find('#rpg-damage-type-select').val();
            $modal.remove();
            // Combine modifiers with selected type
            const result = modifiers.length > 0 
                ? modifiers.join(' ') + ' ' + selectedType 
                : selectedType;
            resolve(result);
        });

        $modal.find('#rpg-type-cancel').on('click', function () {
            $modal.remove();
            resolve(null);
        });

        // Close on overlay click
        $modal.on('click', function (e) {
            if (e.target === this) {
                $modal.remove();
                resolve(null);
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
