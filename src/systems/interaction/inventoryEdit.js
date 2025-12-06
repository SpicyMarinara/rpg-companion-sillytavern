/**
 * Inventory Item Editing Module
 * Handles inline editing of inventory item names
 */

import { extensionSettings, lastGeneratedData } from '../../core/state.js';
import { saveChatData, updateMessageSwipeData } from '../../core/persistence.js';
import { renderInventory } from '../rendering/inventory.js';
import { renderSkills } from '../rendering/skills.js';
import { sanitizeItemName } from '../../utils/security.js';

/**
 * Updates an existing inventory item's name.
 * Validates, sanitizes, and persists the change.
 *
 * @param {string} field - Field name ('onPerson', 'stored', 'assets', 'simplified')
 * @param {number} index - Index of item in the array
 * @param {string} newName - New name for the item
 * @param {string} [location] - Location name (required for 'stored' field)
 */
export function updateInventoryItem(field, index, newName, location) {
    const sanitizedName = sanitizeItemName(newName);
    if (!sanitizedName) {
        console.warn('[RPG Companion] Invalid item name, reverting change');
        renderInventory();
        return;
    }

    // Ensure inventory exists in lastGeneratedData
    if (!lastGeneratedData.inventory) {
        lastGeneratedData.inventory = { onPerson: [], stored: {}, assets: [], simplified: [] };
    }
    const inv = lastGeneratedData.inventory;
    
    let targetArray = null;

    if (field === 'simplified') {
        inv.simplified = inv.simplified || [];
        targetArray = inv.simplified;
    } else if (field === 'stored') {
        if (!location) {
            console.error('[RPG Companion] Location required for stored items');
            return;
        }
        inv.stored = inv.stored || {};
        inv.stored[location] = inv.stored[location] || [];
        targetArray = inv.stored[location];
    } else if (field === 'onPerson' || field === 'assets') {
        inv[field] = inv[field] || [];
        targetArray = inv[field];
    } else {
        console.error(`[RPG Companion] Unsupported inventory field: ${field}`);
        return;
    }

    if (index < 0 || index >= targetArray.length) {
        console.error(`[RPG Companion] Invalid item index: ${index}`);
        return;
    }

    const oldItem = targetArray[index];
    const oldItemName = typeof oldItem === 'object' ? oldItem.name : oldItem;

    if (typeof oldItem === 'object') {
        targetArray[index] = { ...oldItem, name: sanitizedName };
    } else {
        targetArray[index] = { name: sanitizedName, description: '' };
    }

    if (oldItemName && oldItemName !== sanitizedName && extensionSettings.enableItemSkillLinks) {
        updateSkillLinksForRenamedItem(oldItemName, sanitizedName);
        renderSkills();
    }

    saveChatData();
    updateMessageSwipeData();
    renderInventory();
}

/**
 * Updates skill grantedBy links when an inventory item is renamed
 * @param {string} oldName - The old item name
 * @param {string} newName - The new item name
 */
function updateSkillLinksForRenamedItem(oldName, newName) {
    const skills = lastGeneratedData.skills;
    if (!skills) return;
    
    const oldNameLower = oldName.toLowerCase().trim();
    let updated = false;
    
    for (const [_skillName, abilities] of Object.entries(skills)) {
        if (!Array.isArray(abilities)) continue;
        for (const ability of abilities) {
            if (ability?.grantedBy?.toLowerCase().trim() === oldNameLower) {
                ability.grantedBy = newName;
                updated = true;
            }
        }
    }
    
    if (updated) {
        console.log(`[RPG Companion] Updated skill links: "${oldName}" -> "${newName}"`);
    }
}
