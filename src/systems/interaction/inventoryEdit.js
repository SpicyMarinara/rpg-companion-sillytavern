/**
 * Inventory Item Editing Module
 * Handles inline editing of inventory item names
 */

import { extensionSettings, lastGeneratedData, committedTrackerData } from '../../core/state.js';
import { saveSettings, saveChatData, updateMessageSwipeData } from '../../core/persistence.js';
import { buildInventorySummary } from '../generation/promptBuilder.js';
import { renderInventory } from '../rendering/inventory.js';
import { parseItems, serializeItems } from '../../utils/itemParser.js';
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
    const inventory = extensionSettings.userStats.inventory;

    // Validate and sanitize the new item name
    const sanitizedName = sanitizeItemName(newName);
    if (!sanitizedName) {
        console.warn('[RPG Companion] Invalid item name, reverting change');
        // Re-render to revert the change in UI
        renderInventory();
        return;
    }

    // Get the OLD item name before updating (for skill link updates)
    let oldItemName = null;
    if (extensionSettings.inventoryV3) {
        let structuredArray = null;
        
        if (field === 'simplified' && extensionSettings.inventoryV3.simplified) {
            structuredArray = extensionSettings.inventoryV3.simplified;
        } else if (field === 'stored' && extensionSettings.inventoryV3.stored?.[location]) {
            structuredArray = extensionSettings.inventoryV3.stored[location];
        } else if (field === 'onPerson' && extensionSettings.inventoryV3.onPerson) {
            structuredArray = extensionSettings.inventoryV3.onPerson;
        } else if (field === 'assets' && extensionSettings.inventoryV3.assets) {
            structuredArray = extensionSettings.inventoryV3.assets;
        }
        
        if (structuredArray && structuredArray[index]) {
            const item = structuredArray[index];
            oldItemName = typeof item === 'string' ? item : item.name;
            // Update the structured item
            if (typeof item === 'object') {
                item.name = sanitizedName;
            } else {
                structuredArray[index] = sanitizedName;
            }
        }
    }

    // Get current items for the legacy format
    let currentString;
    if (field === 'simplified') {
        currentString = inventory.items || inventory.onPerson || 'None';
    } else if (field === 'stored') {
        if (!location) {
            console.error('[RPG Companion] Location required for stored items');
            return;
        }
        currentString = inventory.stored[location] || 'None';
    } else {
        currentString = inventory[field] || 'None';
    }

    // Parse current items
    const items = parseItems(currentString);

    // Validate index
    if (index < 0 || index >= items.length) {
        console.error(`[RPG Companion] Invalid item index: ${index}`);
        return;
    }

    // Get old name from legacy format if not found in structured format
    if (!oldItemName) {
        oldItemName = items[index];
    }

    // Update the item at this index
    items[index] = sanitizedName;

    // Serialize back to string
    const newItemString = serializeItems(items);

    // Update the legacy inventory
    if (field === 'simplified') {
        inventory.items = newItemString;
        inventory.onPerson = newItemString;
    } else if (field === 'stored') {
        inventory.stored[location] = newItemString;
    } else {
        inventory[field] = newItemString;
    }

    // Update skill links if the item name changed
    if (oldItemName && oldItemName !== sanitizedName && extensionSettings.skillAbilityLinks) {
        updateSkillLinksForRenamedItem(oldItemName, sanitizedName);
    }

    // Update lastGeneratedData and committedTrackerData with new inventory
    updateLastGeneratedDataInventory();

    // Save changes
    saveSettings();
    saveChatData();
    updateMessageSwipeData();

    // Re-render inventory
    renderInventory();
}

/**
 * Updates skill-ability links when an inventory item is renamed
 * @param {string} oldName - The old item name
 * @param {string} newName - The new item name
 */
function updateSkillLinksForRenamedItem(oldName, newName) {
    if (!extensionSettings.skillAbilityLinks) return;
    
    const oldNameLower = oldName.toLowerCase().trim();
    let updated = false;
    
    for (const [key, linkedItem] of Object.entries(extensionSettings.skillAbilityLinks)) {
        // Case-insensitive comparison to match the linking logic
        if (linkedItem && linkedItem.toLowerCase().trim() === oldNameLower) {
            extensionSettings.skillAbilityLinks[key] = newName;
            updated = true;
        }
    }
    
    if (updated) {
        console.log(`[RPG Companion] Updated skill links: "${oldName}" -> "${newName}"`);
    }
}

/**
 * Updates lastGeneratedData.userStats AND committedTrackerData.userStats to include
 * current inventory in text format.
 * This ensures manual edits are immediately visible to AI in next generation.
 * @private
 */
function updateLastGeneratedDataInventory() {
    const stats = extensionSettings.userStats;
    const inventorySummary = buildInventorySummary(stats.inventory);

    // Rebuild the userStats text format
    const statsText =
        `Health: ${stats.health}%\n` +
        `Satiety: ${stats.satiety}%\n` +
        `Energy: ${stats.energy}%\n` +
        `Hygiene: ${stats.hygiene}%\n` +
        `Arousal: ${stats.arousal}%\n` +
        `${stats.mood}: ${stats.conditions}\n` +
        `${inventorySummary}`;

    // Update BOTH lastGeneratedData AND committedTrackerData
    // This makes manual edits immediately visible to AI
    lastGeneratedData.userStats = statsText;
    committedTrackerData.userStats = statsText;
}
