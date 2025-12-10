/**
 * Spellbook Rendering Module
 * Displays spell slots and known spells, and allows simple interactions
 */

import { extensionSettings, $spellbookContainer, updateExtensionSettings } from '../../core/state.js';
import { saveSettings, saveChatData } from '../../core/persistence.js';
import { addSpellToLorebook, removeSpellFromLorebook } from '../../utils/lorekeeper.js';
import { showAddSpellModal, showAddCantripModal } from '../ui/addItemModal.js';
import { showEditSpellModal, showEditCantripModal } from '../ui/editItemModal.js';
import { extractDiceFormulas, calculateScalingDice, extractFlatDamageBonus } from '../ui/damageRoller.js';
import { showRollDialog, showRollConfirmationModal } from '../ui/rollDamageDialog.js';
import { extractAttackBonus, showAttackRollDialog, extractDamageTypes, showDamageTypeDialog } from '../ui/rollAttackDialog.js';
import { showCombinedRollDialog } from '../ui/combinedRollDialog.js';

function escapeHtml(text) {
    return String(text || '').replace(/[&<>"]+/g, function (s) {
        return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[s];
    });
}

/**
 * Extracts the saving throw type from spell description.
 * Looks for patterns like "Dexterity saving throw" and returns lowercase ability name.
 * @param {string} description - The spell description
 * @returns {string|null} - The saving throw type (e.g., 'dexterity', 'wisdom') or null
 */
function extractSaveType(description) {
    if (!description) return null;
    
    // Match pattern: "[Ability] saving throw"
    const match = description.match(/(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+saving\s+throw/i);
    if (match) {
        return match[1].toLowerCase();
    }
    return null;
}

/**
 * Detects if a spell is an area-of-effect spell.
 * Looks for keywords like "area", "radius", "cone", "line", "sphere", "cube", "cylinder" in the description.
 * @param {string} description - The spell description
 * @returns {boolean} - True if the spell appears to be an AoE spell
 */
function isAreaSpell(description) {
    if (!description) return false;
    
    // Keywords that indicate area-of-effect spells
    const aoeKeywords = ['area', 'radius', 'cone', 'line', 'sphere', 'cube', 'cylinder', 'aura'];
    const lowerDesc = description.toLowerCase();
    
    return aoeKeywords.some(keyword => lowerDesc.includes(keyword));
}

export function renderSpellbook() {
    if (!$spellbookContainer) return;

    const spellbook = extensionSettings.spellbook || { spellSlots: {}, knownSpells: [], cantrips: [] };

    // Bonus modifiers section
    let bonusHtml = '<div class="rpg-spellbook-bonuses" style="margin-bottom: 1rem; padding: 0.75rem; background: var(--rpg-bg-dark); border: 1px solid var(--rpg-border); border-radius: 4px;">';
    bonusHtml += '<h4 style="margin: 0 0 0.75rem 0; color: var(--rpg-text);">Spell Bonuses</h4>';
    bonusHtml += '<div style="display: flex; gap: 1rem; flex-wrap: wrap;">';
    bonusHtml += `<div style="flex: 1; min-width: 150px;">
        <label style="color: var(--rpg-text); font-size: 0.85rem; display: block; margin-bottom: 0.25rem;">Spell Attack</label>
        <input type="number" id="rpg-spell-attack-bonus" class="rpg-modal-input" value="${spellbook.spellAttackBonus || 0}" min="0" style="width: 100%;" />
    </div>`;
    bonusHtml += `<div style="flex: 1; min-width: 150px;">
        <label style="color: var(--rpg-text); font-size: 0.85rem; display: block; margin-bottom: 0.25rem;">Damage Bonus</label>
        <input type="number" id="rpg-spell-damage-bonus" class="rpg-modal-input" value="${spellbook.damageBonus || 0}" min="0" style="width: 100%;" />
    </div>`;
    bonusHtml += `<div style="flex: 1; min-width: 150px;">
        <label style="color: var(--rpg-text); font-size: 0.85rem; display: block; margin-bottom: 0.25rem;">Spell Save DC</label>
        <input type="number" id="rpg-spell-save-dc" class="rpg-modal-input" value="${spellbook.spellSaveDC || 0}" min="0" style="width: 100%;" />
    </div>`;
    bonusHtml += '</div></div>';

    // Spell Slots section
    let slotsHtml = '<div class="rpg-spellbook-slots">';
    slotsHtml += '<h4 class="rpg-collapsible-header" data-section="slots"><span class="rpg-collapse-icon">▼</span> Spell Slots</h4>';
    slotsHtml += '<div class="rpg-collapsible-content" data-section="slots">';
    let hasAnySlots = false;
    
    // Get all spell slot levels and display them
    const spellSlotLevels = spellbook.spellSlots ? Object.keys(spellbook.spellSlots).map(k => parseInt(k)).sort((a, b) => a - b) : [];
    
    spellSlotLevels.forEach(lvl => {
        const slot = spellbook.spellSlots[lvl];
        
        // Only show slots if max > 0
        if (slot.max > 0) {
            hasAnySlots = true;
            const displayName = slot.name || `Level ${lvl}`;
            slotsHtml += `
                <div class="rpg-spell-slot-row" data-level="${lvl}">
                            <div class="rpg-spell-slot-label">${displayName}</div>
                            <div class="rpg-spell-slot-count">${Math.max(0, slot.max - (slot.used || 0))} / ${slot.max}</div>
                    <div class="rpg-spell-slot-controls">
                                <button class="rpg-btn-small rpg-slot-decrement-used" data-level="${lvl}" title="Recover Slot">Recover</button>
                                <button class="rpg-btn-small rpg-slot-increment-used" data-level="${lvl}" title="Use Slot">Use</button>
                        <input type="number" min="0" class="rpg-slot-max-input" data-level="${lvl}" value="${slot.max}" title="Set Max Slots" />
                    </div>
                </div>
            `;
        }
    });
    
    if (!hasAnySlots) {
        slotsHtml += '<div class="rpg-no-spells">No spell slots configured. Use Edit Trackers to set up spell slots.</div>';
    }
    
    slotsHtml += '</div>'; // Close collapsible-content
    slotsHtml += '</div>'; // Close rpg-spellbook-slots

    // Cantrips section
    let cantripsHtml = '<div class="rpg-spellbook-cantrips">';
    cantripsHtml += '<h4 class="rpg-collapsible-header" data-section="cantrips"><span class="rpg-collapse-icon">▼</span> Cantrips</h4>';
    cantripsHtml += '<div class="rpg-collapsible-content" data-section="cantrips">';
    
    if (!spellbook.cantrips || spellbook.cantrips.length === 0) {
        cantripsHtml += '<div class="rpg-no-spells">No cantrips added yet</div>';
    } else {
        cantripsHtml += '<ul class="rpg-spell-list">';
        spellbook.cantrips.forEach((c, idx) => {
            const hasDescription = c.description && c.description.trim().length > 0;
            cantripsHtml += `
                <li class="rpg-spell-item" data-cantrip-index="${idx}">
                    <div class="rpg-spell-header">
                        <span class="rpg-spell-name">${escapeHtml(c.name)}</span>
                        <div class="rpg-spell-actions">
                            ${hasDescription ? `<button class="rpg-btn-small rpg-toggle-cantrip-desc" data-index="${idx}" title="Toggle Description">▼</button>` : ''}
                            <button class="rpg-btn-small rpg-edit-cantrip" data-index="${idx}" title="Edit"><i class="fa-solid fa-pencil"></i></button>
                            <button class="rpg-btn-small rpg-cast-cantrip" data-index="${idx}">Cast</button>
                            <button class="rpg-btn-small rpg-remove-cantrip" data-index="${idx}">Remove</button>
                        </div>
                    </div>
                    ${hasDescription ? `<div class="rpg-cantrip-description" data-index="${idx}" style="display: none;">${escapeHtml(c.description)}</div>` : ''}
                </li>
            `;
        });
        cantripsHtml += '</ul>';
    }
    
    // Add cantrip button
    cantripsHtml += `
        <div class="rpg-add-item-button-container">
            <button id="rpg-add-cantrip-btn" class="rpg-btn-small">+ Add Cantrip</button>
        </div>
    `;
    cantripsHtml += '</div>'; // Close collapsible-content
    cantripsHtml += '</div>'; // Close rpg-spellbook-cantrips

    // Known spells list - grouped by level
    let spellsHtml = '<div class="rpg-spellbook-known">';
    spellsHtml += '<h4 class="rpg-collapsible-header" data-section="spells"><span class="rpg-collapse-icon">▼</span> Known Spells</h4>';
    spellsHtml += '<div class="rpg-collapsible-content" data-section="spells">';
    
    if (!spellbook.knownSpells || spellbook.knownSpells.length === 0) {
        spellsHtml += '<div class="rpg-no-spells">No spells added yet</div>';
    } else {
        // Group spells by level
        const spellsByLevel = {};
        for (let lvl = 1; lvl <= 9; lvl++) {
            spellsByLevel[lvl] = [];
        }

        spellbook.knownSpells.forEach((s, idx) => {
            if (s.level && spellsByLevel[s.level]) {
                spellsByLevel[s.level].push({ ...s, index: idx });
            }
        });

        // Render each level group
        for (let lvl = 1; lvl <= 9; lvl++) {
            const spellsAtLevel = spellsByLevel[lvl];
            if (spellsAtLevel.length > 0) {
                spellsHtml += `<div class="rpg-spells-level-group">`;
                spellsHtml += `<h5>Level ${lvl}</h5>`;
                spellsHtml += `<ul class="rpg-spell-list">`;

                spellsAtLevel.forEach((s) => {
                    const hasDescription = s.description && s.description.trim().length > 0;
                    spellsHtml += `
                        <li class="rpg-spell-item" data-index="${s.index}" data-level="${s.level}">
                            <div class="rpg-spell-header">
                                <span class="rpg-spell-name">${escapeHtml(s.name)}</span>
                                <div class="rpg-spell-actions">
                                    ${hasDescription ? `<button class="rpg-btn-small rpg-toggle-spell-desc" data-index="${s.index}" title="Toggle Description">▼</button>` : ''}
                                    <button class="rpg-btn-small rpg-edit-spell" data-index="${s.index}" data-level="${s.level}" title="Edit"><i class="fa-solid fa-pencil"></i></button>
                                    <button class="rpg-btn-small rpg-cast-spell" data-index="${s.index}" data-level="${s.level}">Cast</button>
                                    <button class="rpg-btn-small rpg-remove-spell" data-index="${s.index}">Remove</button>
                                </div>
                            </div>
                            ${hasDescription ? `<div class="rpg-spell-description" data-index="${s.index}" style="display: none;">${escapeHtml(s.description)}</div>` : ''}
                        </li>
                    `;
                });

                spellsHtml += `</ul>`;
                spellsHtml += `</div>`;
            }
        }
    }

    // Add spell button
    spellsHtml += `
        <div class="rpg-add-item-button-container">
            <button id="rpg-add-spell-btn" class="rpg-btn-small">+ Add Spell</button>
        </div>
    `;

    spellsHtml += '</div>'; // Close collapsible-content
    spellsHtml += '</div>'; // Close rpg-spellbook-known

    const combined = `
        <div class="rpg-spellbook-container">
            <h3><i class="fa-solid fa-book"></i> Spellbook</h3>
            ${bonusHtml}
            ${slotsHtml}
            ${cantripsHtml}
            ${spellsHtml}
        </div>
    `;

    $spellbookContainer.html(combined);

    // Collapsible section handlers
    $spellbookContainer.find('.rpg-collapsible-header').off('click').on('click', function () {
        const section = $(this).data('section');
        const $content = $spellbookContainer.find(`.rpg-collapsible-content[data-section="${section}"]`);
        const $icon = $(this).find('.rpg-collapse-icon');
        
        if ($content.is(':visible')) {
            $content.slideUp(200);
            $icon.text('▶');
        } else {
            $content.slideDown(200);
            $icon.text('▼');
        }
    });

    // Spell Bonus handlers
    $spellbookContainer.find('#rpg-spell-attack-bonus').off('change').on('change', function () {
        const val = parseInt($(this).val()) || 0;
        if (!extensionSettings.spellbook) extensionSettings.spellbook = { spellSlots: {}, knownSpells: [], cantrips: [] };
        extensionSettings.spellbook.spellAttackBonus = val;
        saveChatData();
    });

    $spellbookContainer.find('#rpg-spell-damage-bonus').off('change').on('change', function () {
        const val = parseInt($(this).val()) || 0;
        if (!extensionSettings.spellbook) extensionSettings.spellbook = { spellSlots: {}, knownSpells: [], cantrips: [] };
        extensionSettings.spellbook.damageBonus = val;
        saveChatData();
    });

    $spellbookContainer.find('#rpg-spell-save-dc').off('change').on('change', function () {
        const val = parseInt($(this).val()) || 0;
        if (!extensionSettings.spellbook) extensionSettings.spellbook = { spellSlots: {}, knownSpells: [], cantrips: [] };
        extensionSettings.spellbook.spellSaveDC = val;
        saveChatData();
    });

    // Bind events
    $spellbookContainer.find('.rpg-slot-max-input').off('change').on('change', function () {
        const lvl = String($(this).data('level'));
        const val = parseInt($(this).val()) || 0;
        if (!extensionSettings.spellbook) extensionSettings.spellbook = { spellSlots: {}, knownSpells: [], cantrips: [] };
        if (!extensionSettings.spellbook.spellSlots) extensionSettings.spellbook.spellSlots = {};
        if (!extensionSettings.spellbook.spellSlots[lvl]) extensionSettings.spellbook.spellSlots[lvl] = { max: 0, used: 0 };
        extensionSettings.spellbook.spellSlots[lvl].max = val;
        // Ensure used does not exceed max
        if (extensionSettings.spellbook.spellSlots[lvl].used > val) {
            extensionSettings.spellbook.spellSlots[lvl].used = val;
        }
        saveChatData();
        renderSpellbook();
    });

    $spellbookContainer.find('.rpg-slot-increment-used').off('click').on('click', function () {
        const lvl = String($(this).data('level'));
        if (!extensionSettings.spellbook) extensionSettings.spellbook = { spellSlots: {}, knownSpells: [], cantrips: [] };
        const slot = extensionSettings.spellbook.spellSlots[lvl] || { max: 0, used: 0 };
        if (slot.used < slot.max) {
            slot.used = (slot.used || 0) + 1;
            extensionSettings.spellbook.spellSlots[lvl] = slot;
            saveChatData();
            renderSpellbook();
        } else {
            // optionally notify user
        }
    });

    $spellbookContainer.find('.rpg-slot-decrement-used').off('click').on('click', function () {
        const lvl = String($(this).data('level'));
        if (!extensionSettings.spellbook) extensionSettings.spellbook = { spellSlots: {}, knownSpells: [], cantrips: [] };
        const slot = extensionSettings.spellbook.spellSlots[lvl] || { max: 0, used: 0 };
        if (slot.used > 0) {
            slot.used = Math.max(0, (slot.used || 0) - 1);
            extensionSettings.spellbook.spellSlots[lvl] = slot;
            saveChatData();
            renderSpellbook();
        }
    });

    // Edit spell handler
    $spellbookContainer.find('.rpg-edit-spell').off('click').on('click', async function () {
        const idx = parseInt($(this).data('index'));
        if (isNaN(idx)) return;
        
        const spell = extensionSettings.spellbook.knownSpells[idx];
        const result = await showEditSpellModal(spell.name, spell.level || 1, spell.description || '');
        if (!result) return;
        
        const oldName = spell.name;
        const { name, level, description } = result;
        
        // Update spell data
        extensionSettings.spellbook.knownSpells[idx] = { name, level, description };
        
        // Update lorebook if needed
        if (oldName !== name || spell.description !== description) {
            // Remove old entry
            await removeSpellFromLorebook(oldName);
            // Add new entry
            await addSpellToLorebook(name, description || '', 'Spell');
        }
        
        saveChatData();
        renderSpellbook();
    });

    $spellbookContainer.find('#rpg-add-spell-btn').off('click').on('click', async function () {
        const result = await showAddSpellModal();
        if (!result) return;
        
        const { name, level, description } = result;
        if (!extensionSettings.spellbook) extensionSettings.spellbook = { spellSlots: {}, knownSpells: [], cantrips: [] };
        extensionSettings.spellbook.knownSpells = extensionSettings.spellbook.knownSpells || [];
        extensionSettings.spellbook.knownSpells.push({ name, level, description });
        
        // Add to lorebook
        await addSpellToLorebook(name, description || '', 'Spell');
        
        saveChatData();
        renderSpellbook();
    });

    $spellbookContainer.find('.rpg-remove-spell').off('click').on('click', async function () {
        const idx = parseInt($(this).data('index'));
        if (isNaN(idx)) return;
        
        const spell = extensionSettings.spellbook.knownSpells[idx];
        
        // Confirm before removing
        if (!confirm(`Remove spell "${spell.name}" from your spellbook?${spell.description ? '\n\nThis will also remove it from the lorebook.' : ''}`)) {
            return;
        }
        
        // Remove from spellbook array
        extensionSettings.spellbook.knownSpells.splice(idx, 1);
        
        // Remove from lorebook if it had a description (meaning it was added to lorebook)
        if (spell && spell.description) {
            await removeSpellFromLorebook(spell.name);
        }
        
        saveChatData();
        renderSpellbook();
    });

    $spellbookContainer.find('.rpg-toggle-spell-desc').off('click').on('click', function () {
        const idx = $(this).data('index');
        const $desc = $spellbookContainer.find(`.rpg-spell-description[data-index="${idx}"]`);
        const $btn = $(this);
        
        if ($desc.is(':visible')) {
            $desc.slideUp(200);
            $btn.text('▼');
        } else {
            $desc.slideDown(200);
            $btn.text('▲');
        }
    });

    // Edit cantrip handler
    $spellbookContainer.find('.rpg-edit-cantrip').off('click').on('click', async function () {
        const idx = parseInt($(this).data('index'));
        if (isNaN(idx)) return;
        
        const cantrip = extensionSettings.spellbook.cantrips[idx];
        const result = await showEditCantripModal(cantrip.name, cantrip.description || '');
        if (!result) return;
        
        const oldName = cantrip.name;
        const { name, description } = result;
        
        // Update cantrip data
        extensionSettings.spellbook.cantrips[idx] = { name, description };
        
        // Update lorebook if needed
        if (oldName !== name || cantrip.description !== description) {
            // Remove old entry
            await removeSpellFromLorebook(oldName);
            // Add new entry
            await addSpellToLorebook(name, description || '', 'Cantrip');
        }
        
        saveChatData();
        renderSpellbook();
    });

    // Cantrip handlers
    $spellbookContainer.find('#rpg-add-cantrip-btn').off('click').on('click', async function () {
        const result = await showAddCantripModal();
        if (!result) return;
        
        const { name, description } = result;
        if (!extensionSettings.spellbook) extensionSettings.spellbook = { spellSlots: {}, knownSpells: [], cantrips: [] };
        extensionSettings.spellbook.cantrips = extensionSettings.spellbook.cantrips || [];
        extensionSettings.spellbook.cantrips.push({ name, description });
        
        // Add to lorebook
        await addSpellToLorebook(name, description || '', 'Cantrip');
        
        saveChatData();
        renderSpellbook();
    });

    $spellbookContainer.find('.rpg-remove-cantrip').off('click').on('click', async function () {
        const idx = parseInt($(this).data('index'));
        if (isNaN(idx)) return;
        
        const cantrip = extensionSettings.spellbook.cantrips[idx];
        
        // Confirm before removing
        if (!confirm(`Remove cantrip "${cantrip.name}" from your spellbook?${cantrip.description ? '\n\nThis will also remove it from the lorebook.' : ''}`)) {
            return;
        }
        
        // Remove from cantrips array
        extensionSettings.spellbook.cantrips.splice(idx, 1);
        
        // Remove from lorebook if it had a description
        if (cantrip && cantrip.description) {
            await removeSpellFromLorebook(cantrip.name);
        }
        
        saveChatData();
        renderSpellbook();
    });

    $spellbookContainer.find('.rpg-toggle-cantrip-desc').off('click').on('click', function () {
        const idx = $(this).data('index');
        const $desc = $spellbookContainer.find(`.rpg-cantrip-description[data-index="${idx}"]`);
        const $btn = $(this);
        
        if ($desc.is(':visible')) {
            $desc.slideUp(200);
            $btn.text('▼');
        } else {
            $desc.slideDown(200);
            $btn.text('▲');
        }
    });

    $spellbookContainer.find('.rpg-cast-cantrip').off('click').on('click', async function () {
        const cantripIndex = parseInt($(this).data('index'));
        if (isNaN(cantripIndex)) return;

        const cantrip = extensionSettings.spellbook?.cantrips?.[cantripIndex];
        if (!cantrip) return;

        // Extract attack and damage info
        const attackInfo = extractAttackBonus(cantrip.description);
        const diceFormulas = extractDiceFormulas(cantrip.description);
        
        // Check if cantrip has damage
        if (diceFormulas.length === 0 && !attackInfo.hasAttack) {
            // No attack or damage, just send simple cast message
            const messageInput = document.querySelector('#send_textarea') || document.querySelector('textarea[id*="send"]') || document.querySelector('textarea.edit_textarea');
            if (messageInput) {
                const castText = ` I cast ${escapeHtml(cantrip.name)}`;
                const startPos = messageInput.selectionStart;
                messageInput.value = messageInput.value.substring(0, startPos) + castText + messageInput.value.substring(startPos);
                messageInput.focus();
                messageInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
            return;
        }

        // Show combined roll dialog
        const descDamageBonus = diceFormulas.length > 0 ? extractFlatDamageBonus(cantrip.description) : 0;
        const trackerDamageBonus = attackInfo.hasAttack ? (extensionSettings.spellbook?.damageBonus || 0) : 0;
        const totalDamageBonus = descDamageBonus + trackerDamageBonus;
        const spellAttackBonus = extensionSettings.spellbook?.spellAttackBonus || 0;
        const damageInfo = extractDamageTypes(cantrip.description);

        // Add modifiers to damage type text
        let damageTypeText = '';
        if (damageInfo.modifiers.length > 0) {
            damageTypeText = damageInfo.modifiers.join(' ') + (damageInfo.selectable.length > 0 ? ' ' : '');
        }

        const saveType = extractSaveType(cantrip.description);
        const isArea = isAreaSpell(cantrip.description);

        const rollResult = await showCombinedRollDialog({
            itemName: cantrip.name,
            attackInfo: attackInfo.hasAttack ? {
                hasAttack: true,
                modifier: attackInfo.modifier,
                bonus: spellAttackBonus
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
            let castText = ` I cast ${escapeHtml(cantrip.name)}`;
            
            // Add attack roll if it was made
            if (rollResult.attackRoll !== null) {
                const attackDisplay = rollResult.attackBreakdown ? `${rollResult.attackBreakdown} = ${rollResult.attackRoll}` : rollResult.attackRoll;
                const critText = rollResult.isCrit ? ' CRIT!!' : '';
                castText += `, Hit roll: ${attackDisplay}${critText}`;
            }
            
            // Add damage roll
            if (rollResult.damageRoll !== null) {
                const finalDamageType = rollResult.damageType ? ` ${damageTypeText}${rollResult.damageType}` : '';
                castText += `, Damage Roll: ${rollResult.damageRoll}${finalDamageType}`;
            }

            // Append save prompt if needed
            if (rollResult.requiresSave && rollResult.saveType) {
                const targetWording = rollResult.isAreaSpell ? 'creatures in the area' : 'the target';
                const saveDC = extensionSettings.spellbook?.spellSaveDC || 0;
                const dcText = saveDC > 0 ? `, DC ${saveDC}` : '';
                castText += `, ${targetWording} needs to make a ${rollResult.saveType} saving throw${dcText}!`;
            }

            // Insert into message
            const messageInput = document.querySelector('#send_textarea') || document.querySelector('textarea[id*="send"]') || document.querySelector('textarea.edit_textarea');
            if (messageInput) {
                const startPos = messageInput.selectionStart;
                const endPos = messageInput.selectionEnd;
                const textBefore = messageInput.value.substring(0, startPos);
                const textAfter = messageInput.value.substring(endPos);
                messageInput.value = textBefore + castText + textAfter;
                messageInput.selectionStart = messageInput.selectionEnd = startPos + castText.length;
                messageInput.focus();
                messageInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }
    });

    $spellbookContainer.find('.rpg-cast-spell').off('click').on('click', function () {
        const spellIndex = parseInt($(this).data('index'));
        if (isNaN(spellIndex)) return;

        const spell = extensionSettings.spellbook?.knownSpells?.[spellIndex];
        if (!spell) return;

        const spellLevel = spell.level || 1;

        // Get available levels that are >= spell level (those with slots available)
        const availableLevels = [];
        for (let lvl = spellLevel; lvl <= 9; lvl++) {
            const slot = extensionSettings.spellbook.spellSlots?.[lvl];
            if (slot && slot.max > 0) {
                const available = Math.max(0, slot.max - (slot.used || 0));
                if (available > 0) {
                    availableLevels.push(lvl);
                }
            }
        }

        if (availableLevels.length === 0) {
            alert(`No level ${spellLevel}+ spell slots available to cast ${escapeHtml(spell.name)}!`);
            return;
        }

        // Show level selection dialog
        const levelOptions = availableLevels
            .map(lvl => `<option value="${lvl}">Level ${lvl}</option>`)
            .join('');

        const dialogHtml = `
            <div class="rpg-add-item-modal">
                <h2>Cast Spell</h2>
                <div class="rpg-modal-form">
                    <div class="rpg-form-group">
                        <label>Casting: <strong>${escapeHtml(spell.name)}</strong> (Level ${spellLevel})</label>
                    </div>
                    <div class="rpg-form-group">
                        <label for="rpg-cast-level-select">Use Spell Slot Level</label>
                        <select id="rpg-cast-level-select" class="rpg-modal-input">
                            ${levelOptions}
                        </select>
                    </div>
                    <div class="rpg-modal-buttons">
                        <button id="rpg-cast-cancel" class="rpg-modal-btn rpg-modal-cancel">Cancel</button>
                        <button id="rpg-cast-confirm" class="rpg-modal-btn rpg-modal-submit">Cast Spell</button>
                    </div>
                </div>
            </div>
        `;

        // Create and show modal
        const $modal = $('<div class="rpg-add-item-modal-overlay"></div>');
        $modal.html(dialogHtml);
        
        $('body').append($modal);

        // Handle confirm
        $modal.find('#rpg-cast-confirm').on('click', async function () {
            const selectedLevel = parseInt($modal.find('#rpg-cast-level-select').val());
            
            // Extract attack and damage info
            const attackInfo = extractAttackBonus(spell.description);
            const diceFormulas = extractDiceFormulas(spell.description);
            
            // Check if spell has damage
            if (diceFormulas.length === 0 && !attackInfo.hasAttack) {
                // No attack or damage, just send simple cast message
                const castText = ` I cast ${escapeHtml(spell.name)} (Level ${selectedLevel} spellslot)`;
                const messageInput = document.querySelector('#send_textarea') || document.querySelector('textarea[id*="send"]') || document.querySelector('textarea.edit_textarea');
                if (messageInput) {
                    const startPos = messageInput.selectionStart;
                    messageInput.value = messageInput.value.substring(0, startPos) + castText + messageInput.value.substring(startPos);
                    messageInput.focus();
                    messageInput.dispatchEvent(new Event('input', { bubbles: true }));
                }
                
                // Deduct spell slot for non-combat spells
                if (!extensionSettings.spellbook) {
                    extensionSettings.spellbook = { spellSlots: {}, knownSpells: [] };
                }
                if (!extensionSettings.spellbook.spellSlots) {
                    extensionSettings.spellbook.spellSlots = {};
                }
                if (!extensionSettings.spellbook.spellSlots[selectedLevel]) {
                    extensionSettings.spellbook.spellSlots[selectedLevel] = { max: 0, used: 0 };
                }
                
                const slot = extensionSettings.spellbook.spellSlots[selectedLevel];
                slot.used = (slot.used || 0) + 1;
                saveSettings();
                renderSpellbook();
                
                $modal.remove();
                return;
            }

            // Show combined roll dialog
            const descDamageBonus = diceFormulas.length > 0 ? extractFlatDamageBonus(spell.description) : 0;
            const trackerDamageBonus = attackInfo.hasAttack ? (extensionSettings.spellbook?.damageBonus || 0) : 0;
            const totalDamageBonus = descDamageBonus + trackerDamageBonus;
            const spellAttackBonus = extensionSettings.spellbook?.spellAttackBonus || 0;
            const damageInfo = extractDamageTypes(spell.description);

            // Calculate scaling dice for upcast spells
            let damageFormula = diceFormulas.length > 0 ? diceFormulas[0].formula : '0d0';
            let scalingFormula = '';
            if (diceFormulas.length > 0 && diceFormulas[0].isBaseWithScaling) {
                scalingFormula = calculateScalingDice(spell.description, spell.level || 1, selectedLevel);
                // Combine base + scaling into single formula for the dialog
                if (scalingFormula) {
                    damageFormula = `${damageFormula}+${scalingFormula}`;
                }
            }

            // Add modifiers to damage type text
            let damageTypeText = '';
            if (damageInfo.modifiers.length > 0) {
                damageTypeText = damageInfo.modifiers.join(' ') + (damageInfo.selectable.length > 0 ? ' ' : '');
            }

            const saveType = extractSaveType(spell.description);
            const isArea = isAreaSpell(spell.description);

            const rollResult = await showCombinedRollDialog({
                itemName: spell.name,
                attackInfo: attackInfo.hasAttack ? {
                    hasAttack: true,
                    modifier: attackInfo.modifier,
                    bonus: spellAttackBonus
                } : null,
                damageFormula: damageFormula,
                damageInfo: damageInfo,
                damageBonus: totalDamageBonus,
                isCritical: false,
                spellLevel: selectedLevel,
                requiresSave: !!saveType,
                saveType: saveType,
                isAreaSpell: isArea
            });

            // Remove the spell level selection modal immediately
            $modal.remove();

            if (rollResult.rolled) {
                let castText = ` I cast ${escapeHtml(spell.name)} (Level ${selectedLevel} spellslot)`;
                
                // Add attack roll if it was made
                if (rollResult.attackRoll !== null) {
                    const attackDisplay = rollResult.attackBreakdown ? `${rollResult.attackBreakdown} = ${rollResult.attackRoll}` : rollResult.attackRoll;
                    const critText = rollResult.isCrit ? ' CRIT!!' : '';
                    castText += `, Hit roll: ${attackDisplay}${critText}`;
                }
                
                // Add damage roll
                if (rollResult.damageRoll !== null) {
                    const finalDamageType = rollResult.damageType ? ` ${damageTypeText}${rollResult.damageType}` : '';
                    castText += `, Damage Roll: ${rollResult.damageRoll}${finalDamageType}`;
                }

            // Append save prompt if needed
            if (rollResult.requiresSave && rollResult.saveType) {
                const targetWording = rollResult.isAreaSpell ? 'creatures in the area' : 'the target';
                const saveDC = extensionSettings.spellbook?.spellSaveDC || 0;
                const dcText = saveDC > 0 ? `, DC ${saveDC}` : '';
                castText += `, ${targetWording} needs to make a ${rollResult.saveType} saving throw${dcText}!`;
            }                // Insert into message
                const messageInput = document.querySelector('#send_textarea') || document.querySelector('textarea[id*="send"]') || document.querySelector('textarea.edit_textarea');
                if (messageInput) {
                    const startPos = messageInput.selectionStart;
                    const endPos = messageInput.selectionEnd;
                    const textBefore = messageInput.value.substring(0, startPos);
                    const textAfter = messageInput.value.substring(endPos);
                    messageInput.value = textBefore + castText + textAfter;
                    messageInput.selectionStart = messageInput.selectionEnd = startPos + castText.length;
                    messageInput.focus();
                    messageInput.dispatchEvent(new Event('input', { bubbles: true }));
                }

                // Deduct spell slot
                if (rollResult.spellLevel && rollResult.spellLevel > 0) {
                    if (!extensionSettings.spellbook) {
                        extensionSettings.spellbook = { spellSlots: {}, knownSpells: [] };
                    }
                    if (!extensionSettings.spellbook.spellSlots) {
                        extensionSettings.spellbook.spellSlots = {};
                    }
                    if (!extensionSettings.spellbook.spellSlots[rollResult.spellLevel]) {
                        extensionSettings.spellbook.spellSlots[rollResult.spellLevel] = { max: 0, used: 0 };
                    }

                    const slot = extensionSettings.spellbook.spellSlots[rollResult.spellLevel];
                    
                    // Increment used count
                    slot.used = (slot.used || 0) + 1;
                    saveSettings();
                    renderSpellbook();
                }
            }
        });

        // Handle cancel
        $modal.find('#rpg-cast-cancel').on('click', function () {
            $modal.remove();
        });
    });
}

export default renderSpellbook;
