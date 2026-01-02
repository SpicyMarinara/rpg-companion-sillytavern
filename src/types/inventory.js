/**
 * Inventory Type Definitions
 * JSDoc types for RPG Companion inventory system v2
 */

/**
 * Version 2 inventory structure with categorized storage
 * @typedef {Object} InventoryV2
 * @property {number} version - Schema version (always 2)
 * @property {string} onPerson - Items currently carried/worn by the character (plaintext list)
 * @property {string} clothing - Clothing and armor currently worn (plaintext list)
 * @property {Object.<string, string>} stored - Items stored at named locations (location name → plaintext list)
 * @property {string} assets - Character's vehicles, property, and major possessions (plaintext list)
 */

/**
 * Version 1 inventory structure (legacy string format)
 * Simple plaintext string like "Sword, Shield, 3x Potions"
 * @typedef {string} InventoryV1
 */

/**
 * Result of inventory migration operation
 * @typedef {Object} MigrationResult
 * @property {InventoryV2} inventory - The migrated inventory data in v2 format
 * @property {boolean} migrated - Whether migration was performed (true if v1→v2, false if already v2)
 * @property {string} source - Source version ('v1', 'v2', 'null', 'default')
 */

// Export types for JSDoc consumption (this file has no runtime exports)
export {};
