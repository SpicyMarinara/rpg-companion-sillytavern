/**
 * Tracker Data Types - Unified JSON Schema
 * Structure adapts dynamically based on trackerConfig settings
 * 
 * TODO: Future enhancements:
 * - Generate formal JSON Schema for prompting (helps LLMs understand structure better)
 * - Validate LLM responses against schema
 * - In SEPARATE mode, retry generation if schema validation fails
 * - Could use libraries like ajv for validation
 */

/**
 * @typedef {Object} TrackerItem
 * @property {string} name - Item name
 * @property {string} description - Item description  
 * @property {string} [grantsSkill] - Optional: skill name this item grants
 */

/**
 * @typedef {Object} TrackerSkill
 * @property {string} name - Skill/ability name
 * @property {string} description - Skill description
 * @property {string} [grantedBy] - Optional: item name that grants this skill
 */

/**
 * @typedef {Object} TrackerCharacter
 * @property {string} name - Character name
 * @property {string} [relationship] - Relationship type
 * @property {Object.<string, string>} [fields] - Dynamic custom fields (appearance, demeanor, etc.)
 * @property {string} [thoughts] - Character's inner thoughts
 */

/**
 * @typedef {Object} TrackerQuest
 * @property {string} name - Quest name/title
 * @property {string} description - Quest description/objective
 */

/**
 * @typedef {Object.<string, number>} TrackerStats
 * Dynamic stats object - keys are stat names from config, values are percentages
 * Example: { "Health": 85, "Energy": 70, "Custom Stat": 50 }
 */

/**
 * @typedef {Object.<string, number>} TrackerAttributes
 * Dynamic attributes object - keys are attribute names from config (e.g., STR, DEX), values are numeric
 * Example: { "STR": 15, "DEX": 12, "INT": 18 }
 */

/**
 * @typedef {Object} TrackerStatus
 * @property {string} [mood] - Mood emoji (if enabled)
 * @property {Object.<string, string>} [fields] - Dynamic custom fields from config
 */

/**
 * @typedef {Object} TrackerInfoBox
 * Dynamic based on enabled widgets in config
 * @property {string} [date] - Current date (if widget enabled)
 * @property {string} [time] - Time range (if widget enabled)
 * @property {string} [weather] - Weather with emoji (if widget enabled)
 * @property {string} [temperature] - Temperature (if widget enabled)
 * @property {string} [location] - Scene location (if widget enabled)
 * @property {string} [recentEvents] - Recent events summary (if widget enabled)
 */

/**
 * @typedef {Object} TrackerInventory
 * @property {TrackerItem[]} onPerson - Items carried/worn
 * @property {Object.<string, TrackerItem[]>} stored - Items stored at locations
 * @property {TrackerItem[]} assets - Major possessions (vehicles, property)
 * @property {TrackerItem[]} [simplified] - Optional single-list simplified inventory
 */

/**
 * @typedef {Object.<string, TrackerSkill[]>} TrackerSkills
 * Key is skill category name from config, value is array of abilities
 */

/**
 * @typedef {Object} TrackerQuests
 * @property {TrackerQuest|null} main - Main quest or null
 * @property {TrackerQuest[]} optional - Optional quests
 */

/**
 * Complete tracker data structure from LLM
 * All fields are optional - only enabled sections are included
 * @typedef {Object} TrackerData
 * @property {TrackerStats} [stats] - Numeric stats (based on config)
 * @property {TrackerStatus} [status] - Status info (mood, custom fields)
 * @property {TrackerAttributes} [attributes] - RPG attributes (STR, DEX, etc.)
 * @property {number} [level] - Character level
 * @property {TrackerInfoBox} [infoBox] - Scene information (based on enabled widgets)
 * @property {TrackerCharacter[]} [characters] - Present characters
 * @property {TrackerInventory} [inventory] - Player inventory
 * @property {TrackerSkills} [skills] - Player skills by category
 * @property {TrackerQuests} [quests] - Active quests
 */

export const TRACKER_DATA_VERSION = 3;

/**
 * Creates empty tracker data based on current config
 * @param {Object} trackerConfig - The tracker configuration
 * @returns {TrackerData}
 */
export function createEmptyTrackerData(trackerConfig) {
    const data = { version: TRACKER_DATA_VERSION };
    
    // Stats based on config
    if (trackerConfig?.userStats?.customStats) {
        data.stats = {};
        for (const stat of trackerConfig.userStats.customStats) {
            if (stat?.enabled && stat.name) {
                data.stats[stat.name] = 100;
            }
        }
    }
    
    // Attributes based on config
    if (trackerConfig?.userStats?.rpgAttributes) {
        data.attributes = {};
        for (const attr of trackerConfig.userStats.rpgAttributes) {
            if (attr?.enabled && attr.name) {
                data.attributes[attr.name] = 10;
            }
        }
    }
    
    // Level defaults to 1
    data.level = 1;
    
    // Status
    data.status = { mood: '😐', fields: {} };
    
    // Info box based on enabled widgets
    if (trackerConfig?.infoBox?.widgets) {
        data.infoBox = {};
    }
    
    // Characters
    data.characters = [];
    
    // Inventory
    data.inventory = {
        onPerson: [],
        stored: {},
        assets: [],
        simplified: []
    };
    
    // Skills based on config categories
    data.skills = {};
    if (trackerConfig?.userStats?.skillsSection?.customFields) {
        for (const category of trackerConfig.userStats.skillsSection.customFields) {
            const categoryName = typeof category === 'string' ? category : category?.name;
            if (categoryName) {
                data.skills[categoryName] = [];
            }
        }
    }
    
    // Quests
    data.quests = {
        main: null,
        optional: []
    };
    
    return data;
}

/**
 * Generates a JSON schema example based on tracker config
 * Used in prompts to show LLM the expected format
 * @param {Object} trackerConfig - The tracker configuration
 * @param {Object} options - Generation options
 * @returns {Object} Example JSON object
 */
export function generateSchemaExample(trackerConfig, options = {}) {
    const example = {};
    const {
        includeStats = true,
        includeInfoBox = true,
        includeCharacters = true,
        includeInventory = true,
        includeSkills = true,
        includeQuests = true,
        enableItemSkillLinks = false
    } = options;
    
    // Stats section
    if (includeStats && trackerConfig?.userStats?.customStats) {
        example.stats = {};
        for (const stat of trackerConfig.userStats.customStats) {
            if (stat.enabled) {
                example.stats[stat.name] = 75; // Example value
            }
        }
        
        // Status fields
        if (trackerConfig.userStats.statusSection?.enabled) {
            example.status = {};
            if (trackerConfig.userStats.statusSection.showMoodEmoji) {
                example.status.mood = "😊";
            }
            if (trackerConfig.userStats.statusSection.customFields?.length > 0) {
                example.status.fields = {};
                for (const field of trackerConfig.userStats.statusSection.customFields) {
                    example.status.fields[field] = `[${field} value]`;
                }
            }
        }
    }
    
    // Info Box
    if (includeInfoBox && trackerConfig?.infoBox?.widgets) {
        example.infoBox = {};
        const widgets = trackerConfig.infoBox.widgets;
        if (widgets.date?.enabled) example.infoBox.date = "Monday, March 15, 1242";
        if (widgets.time?.enabled) example.infoBox.time = "14:00 → 15:30";
        if (widgets.weather?.enabled) example.infoBox.weather = "☀️ Sunny";
        if (widgets.temperature?.enabled) {
            const unit = widgets.temperature.unit === 'F' ? '°F' : '°C';
            example.infoBox.temperature = `22${unit}`;
        }
        if (widgets.location?.enabled) example.infoBox.location = "Forest Clearing";
        if (widgets.recentEvents?.enabled) example.infoBox.recentEvents = "The party arrived at dawn";
    }
    
    // Characters
    if (includeCharacters && trackerConfig?.presentCharacters) {
        const charConfig = trackerConfig.presentCharacters;
        const charExample = { name: "Elena" };
        
        if (charConfig.relationshipFields?.length > 0) {
            charExample.relationship = charConfig.relationshipFields[0];
        }
        
        if (charConfig.customFields?.length > 0) {
            charExample.fields = {};
            for (const field of charConfig.customFields) {
                if (field.enabled) {
                    charExample.fields[field.name] = `[${field.description || field.name}]`;
                }
            }
        }
        
        if (charConfig.thoughts?.enabled) {
            charExample.thoughts = "I wonder what adventures await...";
        }
        
        example.characters = [charExample];
    }
    
    // Inventory
    if (includeInventory) {
        const itemExample = { name: "Iron Sword", description: "A sturdy blade" };
        if (enableItemSkillLinks) {
            itemExample.grantsSkill = "Sword Fighting";
        }
        example.inventory = {
            onPerson: [itemExample],
            stored: { "Home": [{ name: "Gold Coins", description: "50 gold pieces" }] },
            assets: [{ name: "Small House", description: "A modest dwelling" }]
        };
    }
    
    // Skills
    if (includeSkills && trackerConfig?.userStats?.skillsSection?.customFields?.length > 0) {
        example.skills = {};
        for (const category of trackerConfig.userStats.skillsSection.customFields) {
            const skillExample = { name: "Example Ability", description: "What this ability does" };
            if (enableItemSkillLinks) {
                skillExample.grantedBy = "Item Name";
            }
            example.skills[category] = [skillExample];
        }
    }
    
    // Quests
    if (includeQuests) {
        example.quests = {
            main: { name: "Main Quest", description: "The primary objective" },
            optional: [{ name: "Side Quest", description: "An optional objective" }]
        };
    }
    
    return example;
}

/**
 * Validates tracker data structure
 * @param {any} data - Data to validate
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateTrackerData(data) {
    const errors = [];
    
    if (!data || typeof data !== 'object') {
        return { valid: false, errors: ['Data must be an object'] };
    }
    
    // Validate inventory structure if present (be flexible with LLM variations)
    if (data.inventory) {
        // Accept arrays or empty objects - normalize in parser
        if (data.inventory.onPerson && !Array.isArray(data.inventory.onPerson) && Object.keys(data.inventory.onPerson).length > 0) {
            errors.push('inventory.onPerson must be an array');
        }
        if (data.inventory.stored && typeof data.inventory.stored !== 'object') {
            errors.push('inventory.stored must be an object');
        }
        // Accept arrays or empty objects for assets
        if (data.inventory.assets && !Array.isArray(data.inventory.assets) && Object.keys(data.inventory.assets).length > 0) {
            errors.push('inventory.assets must be an array');
        }
    }
    
    // Validate skills structure if present
    if (data.skills && typeof data.skills !== 'object' && typeof data.skills !== 'string') {
        errors.push('skills must be an object or a string');
    }
    
    // Validate quests structure if present
    if (data.quests) {
        if (data.quests.optional && !Array.isArray(data.quests.optional)) {
            errors.push('quests.optional must be an array');
        }
    }
    
    // Validate characters structure if present
    if (data.characters && !Array.isArray(data.characters)) {
        errors.push('characters must be an array');
    }
    
    return { valid: errors.length === 0, errors };
}

/**
 * Finds all items that grant a specific skill
 * @param {TrackerData} data - Tracker data
 * @param {string} skillName - Skill name to search for
 * @returns {TrackerItem[]}
 */
export function findItemsGrantingSkill(data, skillName) {
    const items = [];
    if (!data.inventory) return items;
    
    const checkItems = (itemList) => {
        if (!Array.isArray(itemList)) return;
        for (const item of itemList) {
            if (item.grantsSkill === skillName) {
                items.push(item);
            }
        }
    };
    
    checkItems(data.inventory.onPerson);
    checkItems(data.inventory.assets);
    if (data.inventory.stored) {
        for (const locationItems of Object.values(data.inventory.stored)) {
            checkItems(locationItems);
        }
    }
    
    return items;
}

/**
 * Finds all skills granted by a specific item
 * @param {TrackerData} data - Tracker data
 * @param {string} itemName - Item name to search for
 * @returns {Array<{category: string, skill: TrackerSkill}>}
 */
export function findSkillsGrantedByItem(data, itemName) {
    const skills = [];
    if (!data.skills) return skills;
    
    for (const [category, skillList] of Object.entries(data.skills)) {
        if (!Array.isArray(skillList)) continue;
        for (const skill of skillList) {
            if (skill.grantedBy === itemName) {
                skills.push({ category, skill });
            }
        }
    }
    
    return skills;
}

/**
 * Removes an item and optionally its linked skills from tracker data
 * @param {TrackerData} data - Tracker data (mutated)
 * @param {string} itemName - Item name to remove
 * @param {string} location - 'onPerson', 'assets', or stored location name
 * @param {boolean} removeLinkedSkills - Whether to also remove skills granted by this item
 */
export function removeItemAndLinkedSkills(data, itemName, location, removeLinkedSkills = true) {
    if (!data.inventory) return;
    
    let removedItem = null;
    
    const removeFromList = (list) => {
        if (!Array.isArray(list)) return false;
        const index = list.findIndex(item => item.name === itemName);
        if (index >= 0) {
            removedItem = list[index];
            list.splice(index, 1);
            return true;
        }
        return false;
    };
    
    if (location === 'onPerson') {
        removeFromList(data.inventory.onPerson);
    } else if (location === 'assets') {
        removeFromList(data.inventory.assets);
    } else if (data.inventory.stored?.[location]) {
        removeFromList(data.inventory.stored[location]);
    }
    
    // Remove linked skills if requested
    if (removeLinkedSkills && removedItem?.grantsSkill && data.skills) {
        for (const skillList of Object.values(data.skills)) {
            if (!Array.isArray(skillList)) continue;
            const skillIndex = skillList.findIndex(s => 
                s.name === removedItem.grantsSkill && s.grantedBy === itemName
            );
            if (skillIndex >= 0) {
                skillList.splice(skillIndex, 1);
            }
        }
    }
}

/**
 * Merges new tracker data with existing data
 * New data overwrites existing fields, but preserves fields not in new data
 * @param {TrackerData} existing - Existing tracker data
 * @param {TrackerData} newData - New data from LLM
 * @returns {TrackerData} Merged data
 */
export function mergeTrackerData(existing, newData) {
    const merged = JSON.parse(JSON.stringify(existing || {}));
    
    if (newData.stats) {
        merged.stats = { ...merged.stats, ...newData.stats };
    }
    
    if (newData.status) {
        merged.status = { 
            ...merged.status, 
            ...newData.status,
            fields: { ...merged.status?.fields, ...newData.status?.fields }
        };
    }
    
    if (newData.attributes) {
        merged.attributes = { ...merged.attributes, ...newData.attributes };
    }
    
    if (newData.level !== undefined) {
        merged.level = newData.level;
    }
    
    if (newData.infoBox) {
        merged.infoBox = { ...merged.infoBox, ...newData.infoBox };
    }
    
    if (newData.characters) {
        merged.characters = newData.characters;
    }
    
    if (newData.inventory) {
        merged.inventory = newData.inventory;
    }
    
    if (newData.skills) {
        merged.skills = newData.skills;
    }
    
    if (newData.quests) {
        merged.quests = newData.quests;
    }
    
    return merged;
}
