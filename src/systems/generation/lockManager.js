/**
 * Lock Manager
 * Handles applying and removing locks for tracker items
 * Locks prevent AI from modifying specific values
 */

import { extensionSettings } from '../../core/state.js';
import { repairJSON } from '../../utils/jsonRepair.js';

/**
 * Apply locks to tracker data before sending to AI.
 * Adds "locked": true to locked items in JSON format.
 *
 * @param {string} trackerData - JSON string of tracker data
 * @param {string} trackerType - Type of tracker ('userStats', 'infoBox', 'characters')
 * @returns {string} Tracker data with locks applied
 */
export function applyLocks(trackerData, trackerType) {
    if (!trackerData) return trackerData;

    // Try to parse as JSON
    const parsed = repairJSON(trackerData);
    if (!parsed) {
        // Not JSON format, return as-is (text format doesn't support locks)
        return trackerData;
    }

    // Get locked items for this tracker type
    const lockedItems = extensionSettings.lockedItems?.[trackerType] || {};

    // Apply locks based on tracker type
    switch (trackerType) {
        case 'userStats':
            return applyUserStatsLocks(parsed, lockedItems);
        case 'infoBox':
            return applyInfoBoxLocks(parsed, lockedItems);
        case 'characters':
            return applyCharactersLocks(parsed, lockedItems);
        default:
            return trackerData;
    }
}

/**
 * Apply locks to User Stats tracker
 * @param {Object} data - Parsed user stats data
 * @param {Object} lockedItems - Locked items configuration
 * @returns {string} JSON string with locks applied
 */
function applyUserStatsLocks(data, lockedItems) {
    // Lock individual stats within stats object
    if (data.stats && lockedItems.stats) {
        // Handle both section lock and individual stat locks
        const isStatsLocked = lockedItems.stats === true;
        if (isStatsLocked) {
            // Lock entire stats section
            for (const statName in data.stats) {
                data.stats[statName] = {
                    value: data.stats[statName].value || data.stats[statName],
                    locked: true
                };
            }
        } else {
            // Lock individual stats
            for (const statName in lockedItems.stats) {
                if (lockedItems.stats[statName] && data.stats[statName] !== undefined) {
                    data.stats[statName] = {
                        value: data.stats[statName].value || data.stats[statName],
                        locked: true
                    };
                }
            }
        }
    }

    // Lock status field
    if (data.status && lockedItems.status) {
        data.status = {
            ...data.status,
            locked: true
        };
    }

    // Lock individual skills
    if (data.skills && lockedItems.skills) {
        if (Array.isArray(data.skills)) {
            data.skills = data.skills.map(skill => {
                if (typeof skill === 'string') {
                    if (lockedItems.skills[skill]) {
                        return { name: skill, locked: true };
                    }
                    return skill;
                } else if (skill.name && lockedItems.skills[skill.name]) {
                    return { ...skill, locked: true };
                }
                return skill;
            });
        }
    }

    // Lock inventory items - handle bracket notation paths like "inventory.onPerson[0]"
    if (data.inventory && lockedItems.inventory) {
        // Helper function to parse bracket notation and apply lock
        const applyInventoryLocks = (items, category) => {
            if (!Array.isArray(items)) return items;

            return items.map((item, index) => {
                // Check if this specific item is locked using bracket notation with inventory prefix
                const bracketPath = `${category}[${index}]`;
                if (lockedItems.inventory[bracketPath]) {
                    return typeof item === 'string'
                        ? { item, locked: true }
                        : { ...item, locked: true };
                }
                return item;
            });
        };

        // Apply locks to onPerson items
        if (data.inventory.onPerson) {
            data.inventory.onPerson = applyInventoryLocks(data.inventory.onPerson, 'onPerson');
        }

        // Apply locks to clothing items
        if (data.inventory.clothing) {
            data.inventory.clothing = applyInventoryLocks(data.inventory.clothing, 'clothing');
        }

        // Apply locks to assets
        if (data.inventory.assets) {
            data.inventory.assets = applyInventoryLocks(data.inventory.assets, 'assets');
        }

        // Apply locks to stored items (nested structure with inventory.stored.location[index])
        if (data.inventory.stored && lockedItems.inventory.stored) {
            for (const location in data.inventory.stored) {
                if (Array.isArray(data.inventory.stored[location])) {
                    data.inventory.stored[location] = data.inventory.stored[location].map((item, index) => {
                        const bracketPath = `${location}[${index}]`;
                        if (lockedItems.inventory.stored[bracketPath]) {
                            return typeof item === 'string'
                                ? { item, locked: true }
                                : { ...item, locked: true };
                        }
                        return item;
                    });
                }
            }
        }
    }

    // Lock individual quests - handle paths like "quests.main" and "quests.optional[0]"
    if (data.quests && lockedItems.quests) {
        // Check if main quest is locked (entire section)
        if (data.quests.main && lockedItems.quests.main === true) {
            data.quests.main = { value: data.quests.main, locked: true };
        }

        // Check individual optional quests
        if (data.quests.optional && Array.isArray(data.quests.optional)) {
            data.quests.optional = data.quests.optional.map((quest, index) => {
                const bracketPath = `optional[${index}]`;
                if (lockedItems.quests[bracketPath]) {
                    return typeof quest === 'string'
                        ? { title: quest, locked: true }
                        : { ...quest, locked: true };
                }
                return quest;
            });
        }
    }

    return JSON.stringify(data, null, 2);
}

/**
 * Apply locks to Info Box tracker
 * @param {Object} data - Parsed info box data
 * @param {Object} lockedItems - Locked items configuration
 * @returns {string} JSON string with locks applied
 */
function applyInfoBoxLocks(data, lockedItems) {
    if (lockedItems.date && data.date) {
        data.date = { ...data.date, locked: true };
    }

    if (lockedItems.weather && data.weather) {
        data.weather = { ...data.weather, locked: true };
    }

    if (lockedItems.temperature && data.temperature) {
        data.temperature = { ...data.temperature, locked: true };
    }

    if (lockedItems.time && data.time) {
        data.time = { ...data.time, locked: true };
    }

    if (lockedItems.location && data.location) {
        data.location = { ...data.location, locked: true };
    }

    if (lockedItems.recentEvents && data.recentEvents) {
        data.recentEvents = { ...data.recentEvents, locked: true };
    }

    return JSON.stringify(data, null, 2);
}

/**
 * Apply locks to Characters tracker
 * @param {Object} data - Parsed characters data
 * @param {Object} lockedItems - Locked items configuration
 * @returns {string} JSON string with locks applied
 */
function applyCharactersLocks(data, lockedItems) {
    console.log('[Lock Manager] applyCharactersLocks called');
    console.log('[Lock Manager] Locked items:', JSON.stringify(lockedItems, null, 2));
    console.log('[Lock Manager] Input data:', JSON.stringify(data, null, 2));

    // Handle both array format and object format
    let characters = Array.isArray(data) ? data : (data.characters || []);

    characters = characters.map((char, index) => {
        const charName = char.name || char.characterName;

        // Check if entire character is locked (index-based)
        if (lockedItems[index] === true) {
            console.log('[Lock Manager] Locking entire character by index:', index);
            return { ...char, locked: true };
        }

        // Check if character name exists in locked items (could be nested object for field locks or boolean for full lock)
        const charLocks = lockedItems[charName];

        if (charLocks === true) {
            // Entire character is locked
            console.log('[Lock Manager] Locking entire character:', charName);
            return { ...char, locked: true };
        } else if (charLocks && typeof charLocks === 'object') {
            // Character has field-level locks
            const modifiedChar = { ...char };

            for (const fieldName in charLocks) {
                if (charLocks[fieldName] === true) {
                    // Check both the original field name and snake_case version
                    // (AI returns snake_case, but locks are stored with original configured names)
                    // Use the same conversion as toSnakeCase in thoughts.js
                    const snakeCaseFieldName = fieldName
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, '_')
                        .replace(/^_+|_+$/g, '');

                    let locked = false;

                    // Check at root level first (backward compatibility)
                    if (modifiedChar[fieldName] !== undefined) {
                        console.log('[Lock Manager] Applying lock to field:', `${charName}.${fieldName}`);
                        modifiedChar[fieldName] = {
                            value: modifiedChar[fieldName],
                            locked: true
                        };
                        locked = true;
                    } else if (modifiedChar[snakeCaseFieldName] !== undefined) {
                        console.log('[Lock Manager] Applying lock to snake_case field:', `${charName}.${snakeCaseFieldName} (from ${fieldName})`);
                        modifiedChar[snakeCaseFieldName] = {
                            value: modifiedChar[snakeCaseFieldName],
                            locked: true
                        };
                        locked = true;
                    }

                    // Check in nested objects (details, relationship, thoughts)
                    if (!locked && modifiedChar.details) {
                        if (modifiedChar.details[fieldName] !== undefined) {
                            console.log('[Lock Manager] Applying lock to details field:', `${charName}.details.${fieldName}`);
                            if (!modifiedChar.details || typeof modifiedChar.details !== 'object') {
                                modifiedChar.details = {};
                            } else {
                                modifiedChar.details = { ...modifiedChar.details };
                            }
                            modifiedChar.details[fieldName] = {
                                value: modifiedChar.details[fieldName],
                                locked: true
                            };
                            locked = true;
                        } else if (modifiedChar.details[snakeCaseFieldName] !== undefined) {
                            console.log('[Lock Manager] Applying lock to details snake_case field:', `${charName}.details.${snakeCaseFieldName} (from ${fieldName})`);
                            if (!modifiedChar.details || typeof modifiedChar.details !== 'object') {
                                modifiedChar.details = {};
                            } else {
                                modifiedChar.details = { ...modifiedChar.details };
                            }
                            modifiedChar.details[snakeCaseFieldName] = {
                                value: modifiedChar.details[snakeCaseFieldName],
                                locked: true
                            };
                            locked = true;
                        }
                    }

                    // Check in relationship object
                    if (!locked && modifiedChar.relationship) {
                        if (modifiedChar.relationship[fieldName] !== undefined) {
                            console.log('[Lock Manager] Applying lock to relationship field:', `${charName}.relationship.${fieldName}`);
                            modifiedChar.relationship = { ...modifiedChar.relationship };
                            modifiedChar.relationship[fieldName] = {
                                value: modifiedChar.relationship[fieldName],
                                locked: true
                            };
                            locked = true;
                        } else if (modifiedChar.relationship[snakeCaseFieldName] !== undefined) {
                            console.log('[Lock Manager] Applying lock to relationship snake_case field:', `${charName}.relationship.${snakeCaseFieldName} (from ${fieldName})`);
                            modifiedChar.relationship = { ...modifiedChar.relationship };
                            modifiedChar.relationship[snakeCaseFieldName] = {
                                value: modifiedChar.relationship[snakeCaseFieldName],
                                locked: true
                            };
                            locked = true;
                        }
                    }

                    // Check in thoughts object
                    if (!locked && modifiedChar.thoughts) {
                        if (modifiedChar.thoughts[fieldName] !== undefined) {
                            console.log('[Lock Manager] Applying lock to thoughts field:', `${charName}.thoughts.${fieldName}`);
                            modifiedChar.thoughts = { ...modifiedChar.thoughts };
                            modifiedChar.thoughts[fieldName] = {
                                value: modifiedChar.thoughts[fieldName],
                                locked: true
                            };
                            locked = true;
                        } else if (modifiedChar.thoughts[snakeCaseFieldName] !== undefined) {
                            console.log('[Lock Manager] Applying lock to thoughts snake_case field:', `${charName}.thoughts.${snakeCaseFieldName} (from ${fieldName})`);
                            modifiedChar.thoughts = { ...modifiedChar.thoughts };
                            modifiedChar.thoughts[snakeCaseFieldName] = {
                                value: modifiedChar.thoughts[snakeCaseFieldName],
                                locked: true
                            };
                            locked = true;
                        }
                    }
                }
            }

            return modifiedChar;
        }

        // No locks for this character
        return char;
    });

    const result = Array.isArray(data)
        ? JSON.stringify(characters, null, 2)
        : JSON.stringify({ ...data, characters }, null, 2);

    console.log('[Lock Manager] Output data:', result);
    return result;
}

/**
 * Remove locks from tracker data received from AI.
 * Strips "locked": true from all items to clean up the data.
 *
 * @param {string} trackerData - JSON string of tracker data
 * @returns {string} Tracker data with locks removed
 */
export function removeLocks(trackerData) {
    if (!trackerData) return trackerData;

    // Try to parse as JSON
    const parsed = repairJSON(trackerData);
    if (!parsed) {
        // Not JSON format, return as-is
        return trackerData;
    }

    // Recursively remove all "locked" properties
    const cleaned = removeLockedProperties(parsed);

    return JSON.stringify(cleaned, null, 2);
}

/**
 * Recursively remove "locked" properties from an object
 * @param {*} obj - Object to clean
 * @returns {*} Object with locked properties removed
 */
function removeLockedProperties(obj) {
    if (Array.isArray(obj)) {
        return obj.map(item => removeLockedProperties(item));
    } else if (obj !== null && typeof obj === 'object') {
        const cleaned = {};
        for (const key in obj) {
            if (key !== 'locked') {
                cleaned[key] = removeLockedProperties(obj[key]);
            }
        }
        return cleaned;
    }
    return obj;
}

/**
 * Check if a specific item is locked
 * @param {string} trackerType - Type of tracker
 * @param {string} itemPath - Path to the item (e.g., 'stats.Health', 'quests.main.0')
 * @returns {boolean} Whether the item is locked
 */
export function isItemLocked(trackerType, itemPath) {
    const lockedItems = extensionSettings.lockedItems?.[trackerType];
    if (!lockedItems) return false;

    const parts = itemPath.split('.');
    let current = lockedItems;

    for (const part of parts) {
        if (current[part] === undefined) return false;
        current = current[part];
    }

    return !!current;
}

/**
 * Toggle lock state for a specific item
 * @param {string} trackerType - Type of tracker
 * @param {string} itemPath - Path to the item
 * @param {boolean} locked - New lock state
 */
export function setItemLock(trackerType, itemPath, locked) {
    console.log('[Lock Manager] setItemLock called:', { trackerType, itemPath, locked });

    if (!extensionSettings.lockedItems) {
        extensionSettings.lockedItems = {};
    }

    if (!extensionSettings.lockedItems[trackerType]) {
        extensionSettings.lockedItems[trackerType] = {};
    }

    const parts = itemPath.split('.');
    let current = extensionSettings.lockedItems[trackerType];

    // Navigate to parent of target
    for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!current[part]) {
            current[part] = {};
        }
        current = current[part];
    }

    // Set or remove lock
    const finalKey = parts[parts.length - 1];
    if (locked) {
        current[finalKey] = true;
    } else {
        delete current[finalKey];
    }

    console.log('[Lock Manager] Locked items after set:', JSON.stringify(extensionSettings.lockedItems, null, 2));
}
