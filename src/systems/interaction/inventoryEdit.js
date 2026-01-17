/**
 * Inventory Item Editing Module
 * Handles inline editing of inventory item names (v3 format)
 */

import { extensionSettings, lastGeneratedData, committedTrackerData } from '../../core/state.js';
import { saveSettings, saveChatData, updateMessageSwipeData } from '../../core/persistence.js';
import { renderInventory } from '../rendering/inventory.js';
import { sanitizeItemName } from '../../utils/security.js';
import { getInventoryV3, setInventoryV3, createV3Item, formatItemDisplay } from '../../utils/inventoryHelper.js';

/**
 * Updates an existing inventory item's name (v3 format).
 * Validates, sanitizes, and persists the change.
 *
 * @param {string} field - Field name ('onPerson', 'clothing', 'stored', 'assets')
 * @param {number} index - Index of item in the array
 * @param {string} newName - New name for the item (can include quantity prefix like "3x Potion")
 * @param {string} [location] - Location name (required for 'stored' field)
 */
export function updateInventoryItem(field, index, newName, location) {
    // Validate and sanitize the new item name
    const sanitizedName = sanitizeItemName(newName);
    if (!sanitizedName) {
        console.warn('[RPG Companion] Invalid item name, reverting change');
        // Re-render to revert the change in UI
        renderInventory();
        return;
    }

    // Get v3 inventory
    const inventory = getInventoryV3();

    // Get current items array for the field
    let items;
    if (field === 'stored') {
        if (!location) {
            console.error('[RPG Companion] Location required for stored items');
            return;
        }
        items = inventory.stored[location] || [];
    } else {
        items = inventory[field] || [];
    }

    // Validate index
    if (index < 0 || index >= items.length) {
        console.error(`[RPG Companion] Invalid item index: ${index}`);
        return;
    }

    // Create new v3 item from the sanitized name (parses quantity if present)
    const newItem = createV3Item(sanitizedName);

    // Update the item at this index
    items[index] = newItem;

    // Update the inventory
    if (field === 'stored') {
        inventory.stored[location] = items;
    } else {
        inventory[field] = items;
    }

    // Save v3 inventory back
    setInventoryV3(inventory);

    // Save changes
    saveSettings();
    saveChatData();
    updateMessageSwipeData();

    // Re-render inventory
    renderInventory();
}