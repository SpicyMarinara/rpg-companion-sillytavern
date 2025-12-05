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
 * @param {string} field - Field name ('onPerson', 'stored', 'assets')
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

    // Get current items for the field
    let currentString;
    if (field === 'stored') {
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

    // Update the item at this index
    items[index] = sanitizedName;

    // Serialize back to string
    const newItemString = serializeItems(items);

    // Update the inventory
    if (field === 'stored') {
        inventory.stored[location] = newItemString;
    } else {
        inventory[field] = newItemString;
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
