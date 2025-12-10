/**
 * Abilities Rendering Module
 * Displays character abilities and allows interactions
 */

import { extensionSettings, $abilitiesContainer, updateExtensionSettings } from '../../core/state.js';
import { saveSettings, saveChatData } from '../../core/persistence.js';
import { addAbilityToLorebook, removeAbilityFromLorebook } from '../../utils/abilitykeeper.js';
import { showAddAbilityModal } from '../ui/addItemModal.js';
import { showEditAbilityModal } from '../ui/editItemModal.js';
import { extractDiceFormulas, extractFlatDamageBonus } from '../ui/damageRoller.js';
import { showRollDialog, showRollConfirmationModal } from '../ui/rollDamageDialog.js';
import { extractAttackBonus, showAttackRollDialog, extractDamageTypes, showDamageTypeDialog } from '../ui/rollAttackDialog.js';
import { showCombinedRollDialog } from '../ui/combinedRollDialog.js';

function escapeHtml(text) {
    return String(text || '').replace(/[&<>"]+/g, function (s) {
        return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[s];
    });
}

// Detects the save type from an ability description (e.g., "Dexterity saving throw")
function extractSaveType(description) {
    if (!description) return null;

    const match = description.match(/(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+saving\s+throw/i);
    if (match && match[1]) {
        return match[1].toLowerCase();
    }

    return null;
}

// Detects if an ability is an area-of-effect ability
function isAreaAbility(description) {
    if (!description) return false;

    const aoeKeywords = ['area', 'radius', 'cone', 'line', 'sphere', 'cube', 'cylinder', 'aura'];
    const lowerDesc = description.toLowerCase();

    return aoeKeywords.some(keyword => lowerDesc.includes(keyword));
}

export function renderAbilities() {
    console.log('[RPG Companion] renderAbilities() called');
    console.log('[RPG Companion] $abilitiesContainer exists:', !!$abilitiesContainer);
    console.log('[RPG Companion] Container jQuery object:', $abilitiesContainer);
    
    if (!$abilitiesContainer) {
        console.warn('[RPG Companion] Abilities container not found, skipping render');
        return;
    }

    const abilities = extensionSettings.abilities || { knownAbilities: [] };
    console.log('[RPG Companion] Rendering abilities:', abilities);
    console.log('[RPG Companion] Container before render - display:', $abilitiesContainer.css('display'));
    console.log('[RPG Companion] Container before render - visibility:', $abilitiesContainer.css('visibility'));
    console.log('[RPG Companion] Container before render - height:', $abilitiesContainer.height());
    console.log('[RPG Companion] Container before render - parent:', $abilitiesContainer.parent());

    // Ability Bonus modifiers section
    let bonusHtml = '<div class="rpg-abilities-bonuses" style="margin-bottom: 1rem; padding: 0.75rem; background: var(--rpg-bg-dark); border: 1px solid var(--rpg-border); border-radius: 4px;">';
    bonusHtml += '<h4 style="margin: 0 0 0.75rem 0; color: var(--rpg-text);">Ability Bonuses</h4>';
    bonusHtml += '<div style="display: flex; gap: 1rem; flex-wrap: wrap;">';
    bonusHtml += `<div style="flex: 1; min-width: 150px;">
        <label style="color: var(--rpg-text); font-size: 0.85rem; display: block; margin-bottom: 0.25rem;">Hit Bonus</label>
        <input type="number" id="rpg-ability-hit-bonus" class="rpg-modal-input" value="${abilities.hitBonus || 0}" min="0" style="width: 100%;" />
    </div>`;
    bonusHtml += `<div style="flex: 1; min-width: 150px;">
        <label style="color: var(--rpg-text); font-size: 0.85rem; display: block; margin-bottom: 0.25rem;">Damage Bonus</label>
        <input type="number" id="rpg-ability-damage-bonus" class="rpg-modal-input" value="${abilities.damageBonus || 0}" min="0" style="width: 100%;" />
    </div>`;
    bonusHtml += '</div></div>';

    // Known abilities list
    let abilitiesHtml = '<div class="rpg-abilities-known">';
    abilitiesHtml += '<h3><i class="fa-solid fa-fist-raised"></i> Abilities</h3>';
    abilitiesHtml += bonusHtml;
    
    if (!abilities.knownAbilities || abilities.knownAbilities.length === 0) {
        abilitiesHtml += '<div class="rpg-no-abilities">No abilities added yet</div>';
    } else {
        abilitiesHtml += '<ul class="rpg-ability-list">';
        abilities.knownAbilities.forEach((ability, idx) => {
            const hasDescription = ability.description && ability.description.trim().length > 0;
            abilitiesHtml += `
                <li class="rpg-ability-item" data-index="${idx}">
                    <div class="rpg-ability-header">
                        <span class="rpg-ability-name">${escapeHtml(ability.name)}</span>
                        <div class="rpg-ability-actions">
                            ${hasDescription ? `<button class="rpg-btn-small rpg-toggle-ability-desc" data-index="${idx}" title="Toggle Description">▼</button>` : ''}
                            <button class="rpg-btn-small rpg-edit-ability" data-index="${idx}" title="Edit"><i class="fa-solid fa-pencil"></i></button>
                            <button class="rpg-btn-small rpg-use-ability" data-index="${idx}">Use</button>
                            <button class="rpg-btn-small rpg-remove-ability" data-index="${idx}">Remove</button>
                        </div>
                    </div>
                    ${hasDescription ? `<div class="rpg-ability-description" data-index="${idx}" style="display: none;">${escapeHtml(ability.description)}</div>` : ''}
                </li>
            `;
        });
        abilitiesHtml += '</ul>';
    }

    // Add ability button
    abilitiesHtml += `
        <div class="rpg-add-item-button-container">
            <button id="rpg-add-ability-btn" class="rpg-btn-small">+ Add Ability</button>
        </div>
    `;

    abilitiesHtml += '</div>'; // Close rpg-abilities-known

    console.log('[RPG Companion] Setting abilities HTML, length:', abilitiesHtml.length);
    $abilitiesContainer.html(abilitiesHtml);

    console.log('[RPG Companion] After setting HTML - display:', $abilitiesContainer.css('display'));
    console.log('[RPG Companion] After setting HTML - visibility:', $abilitiesContainer.css('visibility'));
    console.log('[RPG Companion] After setting HTML - height:', $abilitiesContainer.height());
    console.log('[RPG Companion] After setting HTML - is visible:', $abilitiesContainer.is(':visible'));
    console.log('[RPG Companion] After setting HTML - has content:', $abilitiesContainer.children().length);
    console.log('[RPG Companion] Abilities HTML set, container visible:', $abilitiesContainer.is(':visible'));
    console.log('[RPG Companion] Abilities container display:', $abilitiesContainer.css('display'));

    // Bind events
    $abilitiesContainer.find('#rpg-add-ability-btn').off('click').on('click', async function () {
        const result = await showAddAbilityModal();
        if (!result) return;
        
        const { name, description } = result;
        if (!extensionSettings.abilities) extensionSettings.abilities = { knownAbilities: [] };
        extensionSettings.abilities.knownAbilities = extensionSettings.abilities.knownAbilities || [];
        extensionSettings.abilities.knownAbilities.push({ name, description });
        
        // Add to lorebook
        await addAbilityToLorebook(name, description || '');
        
        saveChatData();
        renderAbilities();
    });

    $abilitiesContainer.find('.rpg-edit-ability').off('click').on('click', async function () {
        const idx = parseInt($(this).data('index'));
        if (isNaN(idx)) return;
        
        const ability = extensionSettings.abilities.knownAbilities[idx];
        const result = await showEditAbilityModal(ability.name, ability.description || '');
        if (!result) return;
        
        const oldName = ability.name;
        const { name, description } = result;
        
        // Update ability data
        extensionSettings.abilities.knownAbilities[idx] = { name, description };
        
        // Update lorebook if needed
        if (oldName !== name || ability.description !== description) {
            // Remove old entry
            await removeAbilityFromLorebook(oldName);
            // Add new entry
            await addAbilityToLorebook(name, description || '');
        }
        
        saveChatData();
        renderAbilities();
    });

    $abilitiesContainer.find('.rpg-remove-ability').off('click').on('click', async function () {
        const idx = parseInt($(this).data('index'));
        if (isNaN(idx)) return;
        
        const ability = extensionSettings.abilities.knownAbilities[idx];
        
        // Confirm before removing
        if (!confirm(`Remove ability "${ability.name}"?${ability.description ? '\n\nThis will also remove it from the lorebook.' : ''}`)) {
            return;
        }
        
        // Remove from abilities array
        extensionSettings.abilities.knownAbilities.splice(idx, 1);
        
        // Remove from lorebook if it had a description
        if (ability && ability.description) {
            await removeAbilityFromLorebook(ability.name);
        }
        
        saveChatData();
        renderAbilities();
    });

    $abilitiesContainer.find('.rpg-toggle-ability-desc').off('click').on('click', function () {
        const idx = $(this).data('index');
        const $desc = $abilitiesContainer.find(`.rpg-ability-description[data-index="${idx}"]`);
        const $btn = $(this);
        
        if ($desc.is(':visible')) {
            $desc.slideUp(200);
            $btn.text('▼');
        } else {
            $desc.slideDown(200);
            $btn.text('▲');
        }
    });

    // Ability Bonus handlers
    $abilitiesContainer.find('#rpg-ability-hit-bonus').off('change').on('change', function () {
        const val = parseInt($(this).val()) || 0;
        if (!extensionSettings.abilities) extensionSettings.abilities = { knownAbilities: [] };
        extensionSettings.abilities.hitBonus = val;
        saveChatData();
    });

    $abilitiesContainer.find('#rpg-ability-damage-bonus').off('change').on('change', function () {
        const val = parseInt($(this).val()) || 0;
        if (!extensionSettings.abilities) extensionSettings.abilities = { knownAbilities: [] };
        extensionSettings.abilities.damageBonus = val;
        saveChatData();
    });

    // Roll damage for ability
    $abilitiesContainer.find('.rpg-roll-ability-damage').off('click').on('click', async function () {
        const abilityIndex = parseInt($(this).data('index'));
        if (isNaN(abilityIndex)) return;

        const ability = extensionSettings.abilities?.knownAbilities?.[abilityIndex];
        if (!ability) return;

        const rollResult = await rollDamage({
            itemName: ability.name,
            description: ability.description
        });

        if (rollResult.success) {
            await showDamageRollModal(rollResult);
        }
    });

    $abilitiesContainer.find('.rpg-use-ability').off('click').on('click', async function () {
        const abilityIndex = parseInt($(this).data('index'));
        if (isNaN(abilityIndex)) return;

        const ability = extensionSettings.abilities?.knownAbilities?.[abilityIndex];
        if (!ability) return;

        // Extract attack and damage info
        const attackInfo = extractAttackBonus(ability.description);
        const diceFormulas = extractDiceFormulas(ability.description);
        
        // Check if ability has damage
        if (diceFormulas.length === 0 && !attackInfo.hasAttack) {
            // No attack or damage, just send simple use message
            const messageInput = document.querySelector('#send_textarea') || document.querySelector('textarea[id*="send"]') || document.querySelector('textarea.edit_textarea');
            if (messageInput) {
                const useText = ` I use ${escapeHtml(ability.name)}`;
                const startPos = messageInput.selectionStart;
                messageInput.value = messageInput.value.substring(0, startPos) + useText + messageInput.value.substring(startPos);
                messageInput.focus();
                messageInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
            return;
        }

        // Show combined roll dialog
        const descDamageBonus = diceFormulas.length > 0 ? extractFlatDamageBonus(ability.description) : 0;
        const trackerDamageBonus = attackInfo.hasAttack ? (extensionSettings.abilities?.damageBonus || 0) : 0;
        const totalDamageBonus = descDamageBonus + trackerDamageBonus;
        const hitBonus = extensionSettings.abilities?.hitBonus || 0;
        const damageInfo = extractDamageTypes(ability.description);

        // Add modifiers to damage type text
        let damageTypeText = '';
        if (damageInfo.modifiers.length > 0) {
            damageTypeText = damageInfo.modifiers.join(' ') + (damageInfo.selectable.length > 0 ? ' ' : '');
        }

        const saveType = extractSaveType(ability.description);
        const isArea = isAreaAbility(ability.description);

        const rollResult = await showCombinedRollDialog({
            itemName: ability.name,
            attackInfo: attackInfo.hasAttack ? {
                hasAttack: true,
                modifier: attackInfo.modifier,
                bonus: hitBonus
            } : null,
            damageFormula: diceFormulas.length > 0 ? diceFormulas[0].formula : '0d0',
            damageInfo: damageInfo,
            damageBonus: totalDamageBonus,
            isCritical: false,
            requiresSave: !!saveType,
            saveType: saveType,
            isAreaSpell: isArea
        });

        if (rollResult.rolled) {
            let useText = ` I use ${escapeHtml(ability.name)}`;
            
            // Add attack roll if it was made
            if (rollResult.attackRoll !== null) {
                const attackDisplay = rollResult.attackBreakdown ? `${rollResult.attackBreakdown} = ${rollResult.attackRoll}` : rollResult.attackRoll;
                const critText = rollResult.isCrit ? ' CRIT!!' : '';
                useText += `, Hit roll: ${attackDisplay}${critText}`;
            }
            
            // Add damage roll
            if (rollResult.damageRoll !== null) {
                const finalDamageType = rollResult.damageType ? ` ${damageTypeText}${rollResult.damageType}` : '';
                useText += `, Damage Roll: ${rollResult.damageRoll}${finalDamageType}`;
            }

            // Append save prompt if needed
            if (rollResult.requiresSave && rollResult.saveType) {
                const targetWording = rollResult.isAreaSpell ? 'creatures in the area' : 'the target';
                useText += `, ${targetWording} needs to make a ${rollResult.saveType} saving throw!`;
            }

            // Insert into message
            const messageInput = document.querySelector('#send_textarea') || document.querySelector('textarea[id*="send"]') || document.querySelector('textarea.edit_textarea');
            if (messageInput) {
                const startPos = messageInput.selectionStart;
                const endPos = messageInput.selectionEnd;
                const textBefore = messageInput.value.substring(0, startPos);
                const textAfter = messageInput.value.substring(endPos);
                messageInput.value = textBefore + useText + textAfter;
                messageInput.selectionStart = messageInput.selectionEnd = startPos + useText.length;
                messageInput.focus();
                messageInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }
    });
}

export default renderAbilities;
