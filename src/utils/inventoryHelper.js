/**
 * Inventory Helper Module
 * Provides unified access to v3 inventory data from lastGeneratedData/committedTrackerData
 */

import { lastGeneratedData, committedTrackerData } from '../core/state.js';

/**
 * V3 Inventory item format
 * @typedef {Object} V3Item
 * @property {string} name - Item name
 * @property {number} [quantity] - Item quantity (defaults to 1)
 */

/**
 * V3 Inventory format
 * @typedef {Object} V3Inventory
 * @property {V3Item[]} onPerson - Items carried on person
 * @property {V3Item[]} clothing - Clothing worn
 * @property {Object.<string, V3Item[]>} stored - Items stored by location
 * @property {V3Item[]} assets - Major assets (vehicles, property)
 */

/**
 * Default empty v3 inventory structure
 * @returns {V3Inventory}
 */
function getDefaultInventory() {
    return {
        onPerson: [],
        clothing: [],
        stored: {},
        assets: []
    };
}

/**
 * Filters out "None" items from a v3 item array
 * "None" is used in v2 format to indicate empty slots and should not be displayed as an item
 * @param {V3Item[]} items - Array of v3 items
 * @returns {V3Item[]} Filtered array without "None" items
 */
function filterNoneItems(items) {
    return items.filter(item => {
        if (!item) return false;
        const name = typeof item === 'string' ? item : (item.name || '');
        return name.toLowerCase() !== 'none' && name.trim() !== '';
    });
}

/**
 * Extracts v3 inventory data from lastGeneratedData.userStats or committedTrackerData.userStats
 * This is the single source of truth for inventory data in the v3 system.
 * 
 * @returns {V3Inventory} V3 format inventory with arrays of {name, quantity} objects
 */
export function getInventoryV3() {
    const currentData = committedTrackerData.userStats || lastGeneratedData.userStats;
    
    if (!currentData) {
        return getDefaultInventory();
    }

    const trimmed = currentData.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
        // Not JSON format - return defaults
        return getDefaultInventory();
    }

    try {
        const jsonData = JSON.parse(currentData);
        if (!jsonData || typeof jsonData !== 'object') {
            return getDefaultInventory();
        }

        const inv = jsonData.inventory;
        if (!inv || typeof inv !== 'object') {
            return getDefaultInventory();
        }

        // Ensure all required fields exist with correct types
        // Filter out "None" items which represent empty slots in v2 format
        return {
            onPerson: Array.isArray(inv.onPerson) ? filterNoneItems(inv.onPerson) : [],
            clothing: Array.isArray(inv.clothing) ? filterNoneItems(inv.clothing) : [],
            stored: (inv.stored && typeof inv.stored === 'object' && !Array.isArray(inv.stored)) 
                ? normalizeStoredInventory(inv.stored) 
                : {},
            assets: Array.isArray(inv.assets) ? filterNoneItems(inv.assets) : []
        };
    } catch (e) {
        console.warn('[RPG Companion] Failed to parse inventory from JSON:', e);
        return getDefaultInventory();
    }
}

/**
 * Normalizes stored inventory - ensures each location has an array of v3 items
 * @param {Object} stored - Raw stored inventory object
 * @returns {Object.<string, V3Item[]>} Normalized stored inventory
 */
function normalizeStoredInventory(stored) {
    const result = {};
    for (const [location, items] of Object.entries(stored)) {
        if (Array.isArray(items)) {
            result[location] = filterNoneItems(items);
        } else if (typeof items === 'string') {
            // Legacy string format - convert to v3 array
            result[location] = parseStringToV3Items(items);
        } else {
            result[location] = [];
        }
    }
    return result;
}

/**
 * Parses a comma-separated string into v3 item array (for legacy compatibility)
 * @param {string} itemString - Comma-separated items string
 * @returns {V3Item[]} Array of v3 item objects
 */
function parseStringToV3Items(itemString) {
    if (!itemString || itemString.toLowerCase() === 'none') {
        return [];
    }
    const items = itemString.split(',').map(s => s.trim()).filter(s => s);
    return items.map(item => {
        const qtyMatch = item.match(/^(\d+)x\s+(.+)$/);
        if (qtyMatch) {
            return { name: qtyMatch[2].trim(), quantity: parseInt(qtyMatch[1]) };
        }
        return { name: item, quantity: 1 };
    });
}

/**
 * Updates the inventory in lastGeneratedData.userStats and committedTrackerData.userStats
 * This should be called after any inventory modification.
 * 
 * @param {V3Inventory} inventory - The updated v3 inventory
 */
export function setInventoryV3(inventory) {
    const currentData = committedTrackerData.userStats || lastGeneratedData.userStats;
    
    if (!currentData) {
        console.warn('[RPG Companion] Cannot update inventory - no existing tracker data');
        return;
    }

    const trimmed = currentData.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
        console.warn('[RPG Companion] Cannot update inventory - tracker data is not JSON format');
        return;
    }

    try {
        const jsonData = JSON.parse(currentData);
        if (jsonData && typeof jsonData === 'object') {
            jsonData.inventory = inventory;
            const updatedJSON = JSON.stringify(jsonData, null, 2);
            lastGeneratedData.userStats = updatedJSON;
            committedTrackerData.userStats = updatedJSON;
        }
    } catch (e) {
        console.warn('[RPG Companion] Failed to update inventory in JSON:', e);
    }
}

/**
 * Formats a v3 item for display
 * @param {V3Item} item - V3 item object
 * @returns {string} Formatted display string (e.g., "3x Health Potion" or "Sword")
 */
export function formatItemDisplay(item) {
    if (!item) return '';
    if (typeof item === 'string') return item;
    
    const name = item.name || '';
    const qty = item.quantity || 1;
    
    if (qty > 1) {
        return `${qty}x ${name}`;
    }
    return name;
}

/**
 * Creates a new v3 item from a name string (parses quantity if present)
 * @param {string} itemName - Item name, optionally with quantity prefix (e.g., "3x Potion")
 * @returns {V3Item} V3 item object
 */
export function createV3Item(itemName) {
    if (!itemName) return { name: '', quantity: 1 };
    
    const qtyMatch = itemName.match(/^(\d+)x\s+(.+)$/);
    if (qtyMatch) {
        return { name: qtyMatch[2].trim(), quantity: parseInt(qtyMatch[1]) };
    }
    return { name: itemName.trim(), quantity: 1 };
}
