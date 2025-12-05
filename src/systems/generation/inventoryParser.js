/**
 * Inventory Parser Module
 * Extracts v2 inventory data from AI-generated text
 */

// Type imports
/** @typedef {import('../../types/inventory.js').InventoryV2} InventoryV2 */

/**
 * Extracts inventory data from AI-generated stats text in v2 multi-line format.
 *
 * Expected format from AI:
 * ```
 * On Person: Sword (equipped), 3x Health Potions, Leather Armor
 * Stored - Home: Spare clothes, Tools, 50 gold coins
 * Stored - Bank: Family heirloom, Important documents
 * Assets: Motorcycle (garage), Downtown apartment (owned)
 * ```
 *
 * @param {string} statsText - Raw stats text from AI response
 * @returns {InventoryV2|null} Parsed inventory v2 object or null if not found
 */
export function extractInventoryData(statsText) {
    if (!statsText || typeof statsText !== 'string') {
        return null;
    }

    const result = {
        version: 2,
        onPerson: "None",
        stored: {},
        assets: "None"
    };

    let foundAnyInventoryData = false;

    // Split into lines for parsing
    const lines = statsText.split('\n');

    for (const line of lines) {
        const trimmed = line.trim();

        // Parse "On Person: ..." line
        const onPersonMatch = trimmed.match(/^On Person:\s*(.+)$/i);
        if (onPersonMatch) {
            result.onPerson = onPersonMatch[1].trim() || "None";
            foundAnyInventoryData = true;
            continue;
        }

        // Parse "Stored - [Location]: ..." lines
        const storedMatch = trimmed.match(/^Stored\s*-\s*([^:]+):\s*(.+)$/i);
        if (storedMatch) {
            const locationName = storedMatch[1].trim();
            const items = storedMatch[2].trim();
            if (locationName && items) {
                result.stored[locationName] = items;
                foundAnyInventoryData = true;
            }
            continue;
        }

        // Parse "Assets: ..." line
        const assetsMatch = trimmed.match(/^Assets:\s*(.+)$/i);
        if (assetsMatch) {
            result.assets = assetsMatch[1].trim() || "None";
            foundAnyInventoryData = true;
            continue;
        }
    }

    // Return null if we didn't find any inventory data
    return foundAnyInventoryData ? result : null;
}

/**
 * Attempts to parse legacy v1 inventory format (single line).
 * Fallback for old AI responses that haven't been updated to v2 format.
 *
 * Expected format: "Inventory: Sword, Shield, 3x Potions, Gold coins"
 *
 * @param {string} text - Text that may contain legacy inventory
 * @returns {string|null} Legacy inventory string or null
 */
export function extractLegacyInventory(text) {
    if (!text || typeof text !== 'string') {
        return null;
    }

    // Match old single-line format: "Inventory: ..."
    const match = text.match(/Inventory:\s*(.+?)(?:\n|$)/i);
    if (match && match[1]) {
        const inventoryText = match[1].trim();
        // Return null for empty values like "None" or ""
        if (!inventoryText || inventoryText.toLowerCase() === 'none') {
            return null;
        }
        return inventoryText;
    }

    return null;
}

/**
 * Main inventory extraction function that tries v2 format first, then falls back to v1.
 * Converts v1 format to v2 automatically if found.
 *
 * @param {string} statsText - Raw stats text from AI response
 * @returns {InventoryV2|null} Parsed inventory in v2 format or null
 */
export function extractInventory(statsText) {
    // Try v2 format first
    const v2Data = extractInventoryData(statsText);
    if (v2Data) {
        return v2Data;
    }

    // Fallback to v1 format and convert to v2
    const v1Data = extractLegacyInventory(statsText);
    if (v1Data) {
        // Convert v1 string to v2 format (place in onPerson)
        return {
            version: 2,
            onPerson: v1Data,
            stored: {},
            assets: "None"
        };
    }

    // No inventory data found
    return null;
}
