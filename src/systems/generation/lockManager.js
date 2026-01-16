/**
 * Lock Manager
 * Handles applying and removing locks for tracker items
 * Locks prevent AI from modifying specific values
 */

import { extensionSettings, committedTrackerData } from '../../core/state.js';
import { repairJSON } from '../../utils/jsonRepair.js';

/**
 * Preserve locked field values from current data when AI returns new data.
 * This enforces locks by preventing AI changes to locked fields.
 *
 * @param {string} newData - JSON string of new data from AI
 * @param {string} trackerType - Type of tracker ('userStats', 'infoBox', 'characters')
 * @returns {string} Merged data with locked fields preserved from committedTrackerData
 */
export function preserveLockedValues(newData, trackerType) {
    if (!newData) return newData;

    // Map trackerType to the correct committedTrackerData key
    // 'characterThoughts' data is stored in committedTrackerData.characterThoughts
    // but locks are stored under extensionSettings.lockedItems.characters
    const dataKey = trackerType;
    const lockKey = trackerType === 'characterThoughts' ? 'characters' : trackerType;

    // Get current committed data for this tracker type
    const currentData = committedTrackerData[dataKey];
    if (!currentData) return newData;

    // Parse both JSON strings
    const parsedNew = repairJSON(newData);
    const parsedCurrent = repairJSON(currentData);
    if (!parsedNew || !parsedCurrent) return newData;

    // Get locked items for this tracker type (use lockKey for characters)
    const lockedItems = extensionSettings.lockedItems?.[lockKey];
    if (!lockedItems || Object.keys(lockedItems).length === 0) return newData;

    // Apply preservation based on tracker type
    switch (trackerType) {
        case 'userStats':
            return preserveUserStatsLocked(parsedNew, parsedCurrent, lockedItems);
        case 'infoBox':
            return preserveInfoBoxLocked(parsedNew, parsedCurrent, lockedItems);
        case 'characters':
        case 'characterThoughts':
            return preserveCharactersLocked(parsedNew, parsedCurrent, lockedItems);
        default:
            return newData;
    }
}

/**
 * Preserve locked values in User Stats tracker
 */
function preserveUserStatsLocked(newData, currentData, lockedItems) {
    // Preserve locked stats
    if (newData.stats && currentData.stats && lockedItems.stats) {
        const isStatsLocked = lockedItems.stats === true;
        if (isStatsLocked) {
            // Entire stats section is locked - preserve all stats
            newData.stats = currentData.stats;
        } else {
            // Individual stats are locked
            for (const statName in lockedItems.stats) {
                if (lockedItems.stats[statName] && currentData.stats[statName] !== undefined) {
                    newData.stats[statName] = currentData.stats[statName];
                }
            }
        }
    }

    // Preserve locked status
    if (lockedItems.status && currentData.status) {
        newData.status = currentData.status;
    }

    // Preserve locked skills
    if (newData.skills && currentData.skills && lockedItems.skills) {
        if (Array.isArray(currentData.skills)) {
            // Build a map of locked skill names
            const lockedSkillNames = Object.keys(lockedItems.skills).filter(k => lockedItems.skills[k]);

            // For each locked skill in current data, preserve it
            if (Array.isArray(newData.skills)) {
                for (const lockedSkillName of lockedSkillNames) {
                    // Find the skill in current data
                    const currentSkill = currentData.skills.find(s =>
                        (typeof s === 'string' && s === lockedSkillName) ||
                        (s.name === lockedSkillName)
                    );
                    if (currentSkill) {
                        // Find and replace in new data, or add if missing
                        const newIndex = newData.skills.findIndex(s =>
                            (typeof s === 'string' && s === lockedSkillName) ||
                            (s.name === lockedSkillName)
                        );
                        if (newIndex >= 0) {
                            newData.skills[newIndex] = currentSkill;
                        }
                    }
                }
            }
        }
    }

    // Preserve locked inventory items
    if (newData.inventory && currentData.inventory && lockedItems.inventory) {
        const preserveInventoryItems = (newItems, currentItems, category) => {
            if (!Array.isArray(newItems) || !Array.isArray(currentItems)) return newItems;

            return newItems.map((item, index) => {
                const bracketPath = `${category}[${index}]`;
                if (lockedItems.inventory[bracketPath] && currentItems[index] !== undefined) {
                    return currentItems[index];
                }
                return item;
            });
        };

        if (newData.inventory.onPerson && currentData.inventory.onPerson) {
            newData.inventory.onPerson = preserveInventoryItems(
                newData.inventory.onPerson, currentData.inventory.onPerson, 'onPerson'
            );
        }

        if (newData.inventory.clothing && currentData.inventory.clothing) {
            newData.inventory.clothing = preserveInventoryItems(
                newData.inventory.clothing, currentData.inventory.clothing, 'clothing'
            );
        }

        if (newData.inventory.assets && currentData.inventory.assets) {
            newData.inventory.assets = preserveInventoryItems(
                newData.inventory.assets, currentData.inventory.assets, 'assets'
            );
        }

        // Preserve locked stored items
        if (newData.inventory.stored && currentData.inventory.stored && lockedItems.inventory.stored) {
            for (const location in newData.inventory.stored) {
                if (Array.isArray(newData.inventory.stored[location]) &&
                    Array.isArray(currentData.inventory.stored?.[location])) {
                    newData.inventory.stored[location] = newData.inventory.stored[location].map((item, index) => {
                        const bracketPath = `${location}[${index}]`;
                        if (lockedItems.inventory.stored[bracketPath] &&
                            currentData.inventory.stored[location][index] !== undefined) {
                            return currentData.inventory.stored[location][index];
                        }
                        return item;
                    });
                }
            }
        }
    }

    // Preserve locked quests
    if (newData.quests && currentData.quests && lockedItems.quests) {
        // Preserve main quest if locked
        if (lockedItems.quests.main === true && currentData.quests.main) {
            newData.quests.main = currentData.quests.main;
        }

        // Preserve locked optional quests
        if (newData.quests.optional && Array.isArray(newData.quests.optional) &&
            currentData.quests.optional && Array.isArray(currentData.quests.optional)) {
            newData.quests.optional = newData.quests.optional.map((quest, index) => {
                const bracketPath = `optional[${index}]`;
                if (lockedItems.quests[bracketPath] && currentData.quests.optional[index] !== undefined) {
                    return currentData.quests.optional[index];
                }
                return quest;
            });
        }
    }

    return JSON.stringify(newData, null, 2);
}

/**
 * Preserve locked values in Info Box tracker
 */
function preserveInfoBoxLocked(newData, currentData, lockedItems) {
    if (lockedItems.date && currentData.date) {
        newData.date = currentData.date;
    }

    if (lockedItems.weather && currentData.weather) {
        newData.weather = currentData.weather;
    }

    if (lockedItems.temperature && currentData.temperature) {
        newData.temperature = currentData.temperature;
    }

    if (lockedItems.time && currentData.time) {
        newData.time = currentData.time;
    }

    if (lockedItems.location && currentData.location) {
        newData.location = currentData.location;
    }

    if (lockedItems.recentEvents && currentData.recentEvents) {
        newData.recentEvents = currentData.recentEvents;
    }

    return JSON.stringify(newData, null, 2);
}

/**
 * Preserve locked values in Characters tracker
 */
function preserveCharactersLocked(newData, currentData, lockedItems) {
    // Handle both array format and object format
    let newCharacters = Array.isArray(newData) ? newData : (newData.characters || []);
    let currentCharacters = Array.isArray(currentData) ? currentData : (currentData.characters || []);

    newCharacters = newCharacters.map((char, index) => {
        const charName = char.name || char.characterName;

        // Check if entire character is locked (index-based)
        if (lockedItems[index] === true) {
            // Preserve entire character from current data
            if (currentCharacters[index]) {
                return currentCharacters[index];
            }
            return char;
        }

        // Check if character name exists in locked items
        const charLocks = lockedItems[charName];

        if (charLocks === true) {
            // Entire character is locked - find by name in current data
            const currentChar = currentCharacters.find(c =>
                (c.name || c.characterName) === charName
            );
            if (currentChar) {
                return currentChar;
            }
            return char;
        } else if (charLocks && typeof charLocks === 'object') {
            // Character has field-level locks
            const currentChar = currentCharacters.find(c =>
                (c.name || c.characterName) === charName
            );
            if (!currentChar) return char;

            const modifiedChar = { ...char };

            for (const fieldName in charLocks) {
                if (charLocks[fieldName] === true) {
                    // Convert to snake_case for matching (AI often returns snake_case)
                    const snakeCaseFieldName = fieldName
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, '_')
                        .replace(/^_+|_+$/g, '');
                    
                    // Also try lowercase without underscore conversion
                    const lowerFieldName = fieldName.toLowerCase();

                    let preserved = false;

                    // Check at root level first
                    if (currentChar[fieldName] !== undefined) {
                        modifiedChar[fieldName] = currentChar[fieldName];
                        preserved = true;
                    } else if (currentChar[snakeCaseFieldName] !== undefined) {
                        modifiedChar[snakeCaseFieldName] = currentChar[snakeCaseFieldName];
                        preserved = true;
                    } else if (currentChar[lowerFieldName] !== undefined) {
                        modifiedChar[lowerFieldName] = currentChar[lowerFieldName];
                        preserved = true;
                    }

                    // Check in nested details object
                    if (!preserved && currentChar.details) {
                        const currentValue = currentChar.details[fieldName] 
                            ?? currentChar.details[snakeCaseFieldName] 
                            ?? currentChar.details[lowerFieldName];
                        
                        if (currentValue !== undefined) {
                            // Ensure modifiedChar.details exists
                            if (!modifiedChar.details) {
                                modifiedChar.details = {};
                            } else {
                                modifiedChar.details = { ...modifiedChar.details };
                            }
                            
                            // Use the same key that exists in currentChar.details
                            const keyToUse = currentChar.details[fieldName] !== undefined ? fieldName
                                : currentChar.details[snakeCaseFieldName] !== undefined ? snakeCaseFieldName
                                : lowerFieldName;
                            modifiedChar.details[keyToUse] = currentValue;
                            preserved = true;
                        }
                    }

                    // Check in nested relationship object
                    if (!preserved && currentChar.relationship) {
                        const currentValue = currentChar.relationship[fieldName] 
                            ?? currentChar.relationship[snakeCaseFieldName] 
                            ?? currentChar.relationship[lowerFieldName];
                        
                        if (currentValue !== undefined) {
                            if (!modifiedChar.relationship) {
                                modifiedChar.relationship = {};
                            } else {
                                modifiedChar.relationship = { ...modifiedChar.relationship };
                            }
                            
                            const keyToUse = currentChar.relationship[fieldName] !== undefined ? fieldName
                                : currentChar.relationship[snakeCaseFieldName] !== undefined ? snakeCaseFieldName
                                : lowerFieldName;
                            modifiedChar.relationship[keyToUse] = currentValue;
                            preserved = true;
                        }
                    }

                    // Check in nested thoughts object
                    if (!preserved && currentChar.thoughts) {
                        const currentValue = currentChar.thoughts[fieldName] 
                            ?? currentChar.thoughts[snakeCaseFieldName] 
                            ?? currentChar.thoughts[lowerFieldName];
                        
                        if (currentValue !== undefined) {
                            if (!modifiedChar.thoughts) {
                                modifiedChar.thoughts = {};
                            } else {
                                modifiedChar.thoughts = { ...modifiedChar.thoughts };
                            }
                            
                            const keyToUse = currentChar.thoughts[fieldName] !== undefined ? fieldName
                                : currentChar.thoughts[snakeCaseFieldName] !== undefined ? snakeCaseFieldName
                                : lowerFieldName;
                            modifiedChar.thoughts[keyToUse] = currentValue;
                        }
                    }
                }
            }

            return modifiedChar;
        }

        return char;
    });

    return Array.isArray(newData)
        ? JSON.stringify(newCharacters, null, 2)
        : JSON.stringify({ ...newData, characters: newCharacters }, null, 2);
}

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
    // console.log('[Lock Manager] applyCharactersLocks called');
    // console.log('[Lock Manager] Locked items:', JSON.stringify(lockedItems, null, 2));
    // console.log('[Lock Manager] Input data:', JSON.stringify(data, null, 2));

    // Handle both array format and object format
    let characters = Array.isArray(data) ? data : (data.characters || []);

    characters = characters.map((char, index) => {
        const charName = char.name || char.characterName;

        // Check if entire character is locked (index-based)
        if (lockedItems[index] === true) {
            // console.log('[Lock Manager] Locking entire character by index:', index);
            return { ...char, locked: true };
        }

        // Check if character name exists in locked items (could be nested object for field locks or boolean for full lock)
        const charLocks = lockedItems[charName];

        if (charLocks === true) {
            // Entire character is locked
            // console.log('[Lock Manager] Locking entire character:', charName);
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
                        // console.log('[Lock Manager] Applying lock to field:', `${charName}.${fieldName}`);
                        modifiedChar[fieldName] = {
                            value: modifiedChar[fieldName],
                            locked: true
                        };
                        locked = true;
                    } else if (modifiedChar[snakeCaseFieldName] !== undefined) {
                        // console.log('[Lock Manager] Applying lock to snake_case field:', `${charName}.${snakeCaseFieldName} (from ${fieldName})`);
                        modifiedChar[snakeCaseFieldName] = {
                            value: modifiedChar[snakeCaseFieldName],
                            locked: true
                        };
                        locked = true;
                    }

                    // Check in nested objects (details, relationship, thoughts)
                    if (!locked && modifiedChar.details) {
                        if (modifiedChar.details[fieldName] !== undefined) {
                            // console.log('[Lock Manager] Applying lock to details field:', `${charName}.details.${fieldName}`);
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
                            // console.log('[Lock Manager] Applying lock to details snake_case field:', `${charName}.details.${snakeCaseFieldName} (from ${fieldName})`);
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
                            // console.log('[Lock Manager] Applying lock to relationship field:', `${charName}.relationship.${fieldName}`);
                            modifiedChar.relationship = { ...modifiedChar.relationship };
                            modifiedChar.relationship[fieldName] = {
                                value: modifiedChar.relationship[fieldName],
                                locked: true
                            };
                            locked = true;
                        } else if (modifiedChar.relationship[snakeCaseFieldName] !== undefined) {
                            // console.log('[Lock Manager] Applying lock to relationship snake_case field:', `${charName}.relationship.${snakeCaseFieldName} (from ${fieldName})`);
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
                            // console.log('[Lock Manager] Applying lock to thoughts field:', `${charName}.thoughts.${fieldName}`);
                            modifiedChar.thoughts = { ...modifiedChar.thoughts };
                            modifiedChar.thoughts[fieldName] = {
                                value: modifiedChar.thoughts[fieldName],
                                locked: true
                            };
                            locked = true;
                        } else if (modifiedChar.thoughts[snakeCaseFieldName] !== undefined) {
                            // console.log('[Lock Manager] Applying lock to thoughts snake_case field:', `${charName}.thoughts.${snakeCaseFieldName} (from ${fieldName})`);
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

    // console.log('[Lock Manager] Output data:', result);
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
    // console.log('[Lock Manager] setItemLock called:', { trackerType, itemPath, locked });

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

    // console.log('[Lock Manager] Locked items after set:', JSON.stringify(extensionSettings.lockedItems, null, 2));
}
