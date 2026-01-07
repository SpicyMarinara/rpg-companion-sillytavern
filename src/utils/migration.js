/**
 * Inventory Migration Module
 * Handles conversion from v1 (string) to v2 (structured) inventory format
 */

// Type imports
/** @typedef {import('../types/inventory.js').InventoryV1} InventoryV1 */
/** @typedef {import('../types/inventory.js').InventoryV2} InventoryV2 */
/** @typedef {import('../types/inventory.js').MigrationResult} MigrationResult */

/**
 * Default v2 inventory structure for new/empty inventories
 * @type {InventoryV2}
 */
const DEFAULT_INVENTORY_V2 = {
    version: 2,
    onPerson: "None",
    clothing: "None",
    stored: {},
    assets: "None"
};

/**
 * Migrates inventory data from v1 (string) to v2 (structured) format.
 * Handles all edge cases: null, undefined, "None", already-migrated data.
 *
 * @param {InventoryV1 | InventoryV2 | null | undefined} inventory - Inventory data to migrate
 * @returns {MigrationResult} Migration result with v2 inventory and metadata
 */
export function migrateInventory(inventory) {
    // Case 1: v2 format missing version property (parser output)
    // Parser returns v2 structure but without the version tag
    if (inventory && typeof inventory === 'object' &&
        'onPerson' in inventory && 'clothing' in inventory &&
        'stored' in inventory && 'assets' in inventory &&
        !('version' in inventory)) {
        // console.log('[RPG Companion Migration] v2 inventory missing version tag, adding it');
        return {
            inventory: {
                version: 2,
                ...inventory
            },
            migrated: true,
            source: 'parser-output'
        };
    }

    // Case 2: Already v2 format (has version property and is an object)
    if (inventory && typeof inventory === 'object' && inventory.version === 2) {
        // Check if clothing field exists (v2.1 upgrade)
        if (!inventory.hasOwnProperty('clothing')) {
            // console.log('[RPG Companion Migration] Upgrading v2 inventory to v2.1 (adding clothing field)');
            inventory.clothing = "None";
            return {
                inventory: inventory,
                migrated: true,
                source: 'v2-upgrade'
            };
        }

        // console.log('[RPG Companion Migration] Inventory already v2, no migration needed');
        return {
            inventory: inventory,
            migrated: false,
            source: 'v2'
        };
    }

    // Case 3: null or undefined → use defaults
    if (inventory === null || inventory === undefined) {
        // console.log('[RPG Companion Migration] Inventory is null/undefined, using defaults');
        return {
            inventory: { ...DEFAULT_INVENTORY_V2 },
            migrated: true,
            source: 'null'
        };
    }

    // Case 4: v1 string format → migrate to v2
    if (typeof inventory === 'string') {
        // Check if it's an empty/default string
        const trimmed = inventory.trim();
        if (trimmed === '' || trimmed.toLowerCase() === 'none') {
            // console.log('[RPG Companion Migration] Inventory is empty/None, using defaults');
            return {
                inventory: { ...DEFAULT_INVENTORY_V2 },
                migrated: true,
                source: 'v1'
            };
        }

        // Non-empty v1 string → migrate to v2.onPerson
        // console.log('[RPG Companion Migration] Migrating v1 string to v2.onPerson:', inventory);
        return {
            inventory: {
                version: 2,
                onPerson: inventory,
                clothing: "None",
                stored: {},
                assets: "None"
            },
            migrated: true,
            source: 'v1'
        };
    }

    // Case 4: Unknown format (malformed object, number, etc.) → use defaults
    console.warn('[RPG Companion Migration] Unknown inventory format, using defaults:', inventory);
    return {
        inventory: { ...DEFAULT_INVENTORY_V2 },
        migrated: true,
        source: 'default'
    };
}
