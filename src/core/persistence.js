/**
 * Core Persistence Module
 * Handles saving/loading extension settings and chat data
 */

import { saveSettingsDebounced, chat_metadata, saveChatDebounced } from '../../../../../../script.js';
import { getContext } from '../../../../../extensions.js';
import {
    extensionSettings,
    lastGeneratedData,
    committedTrackerData,
    updateExtensionSettings,
    setLastGeneratedData,
    setCommittedTrackerData
} from './state.js';
import { migrateInventory } from '../utils/migration.js';
import { validateStoredInventory, cleanItemString } from '../utils/security.js';

const extensionName = 'third-party/rpg-companion-sillytavern';

/**
 * Validates extension settings structure
 * @param {Object} settings - Settings object to validate
 * @returns {boolean} True if valid, false otherwise
 */
function validateSettings(settings) {
    if (!settings || typeof settings !== 'object') {
        return false;
    }

    // Check for required top-level properties
    if (typeof settings.enabled !== 'boolean' ||
        typeof settings.autoUpdate !== 'boolean' ||
        !settings.userStats || typeof settings.userStats !== 'object') {
        console.warn('[RPG Companion] Settings validation failed: missing required properties');
        return false;
    }

    // Validate userStats structure
    const stats = settings.userStats;
    if (typeof stats.health !== 'number' ||
        typeof stats.satiety !== 'number' ||
        typeof stats.energy !== 'number') {
        console.warn('[RPG Companion] Settings validation failed: invalid userStats structure');
        return false;
    }

    return true;
}

/**
 * Loads the extension settings from the global settings object.
 * Automatically migrates v1 inventory to v2 format if needed.
 */
export function loadSettings() {
    try {
        const context = getContext();
        const extension_settings = context.extension_settings || context.extensionSettings;

        // Validate extension_settings structure
        if (!extension_settings || typeof extension_settings !== 'object') {
            console.warn('[RPG Companion] extension_settings is not available, using default settings');
            return;
        }

        if (extension_settings[extensionName]) {
            const savedSettings = extension_settings[extensionName];

            // Validate loaded settings
            if (!validateSettings(savedSettings)) {
                console.warn('[RPG Companion] Loaded settings failed validation, using defaults');
                console.warn('[RPG Companion] Invalid settings:', savedSettings);
                // Save valid defaults to replace corrupt data
                saveSettings();
                return;
            }

            updateExtensionSettings(savedSettings);
        }

        // Migrate inventory from v1 (string) to v2 (object) format if needed
        const migrationResult = migrateInventory(extensionSettings.userStats.inventory);
        if (migrationResult.migrated) {
            console.log(`[RPG Companion] Inventory migrated from ${migrationResult.source} to v2 format`);
            extensionSettings.userStats.inventory = migrationResult.inventory;
            saveSettings(); // Persist migrated inventory
        }

        // Migrate to trackerConfig if it doesn't exist
        if (!extensionSettings.trackerConfig) {
            console.log('[RPG Companion] Migrating to trackerConfig format');
            migrateToTrackerConfig();
            saveSettings(); // Persist migration
        }
        
        // Migrate to new stats/skills format with descriptions
        if (migrateStatsAndSkillsFormat()) {
            saveSettings(); // Persist migration
        }
        
        // Migrate quests from legacy format to structured format
        if (migrateQuestsFormat()) {
            saveSettings(); // Persist migration
        }
    } catch (error) {
        console.error('[RPG Companion] Error loading settings:', error);
        console.error('[RPG Companion] Error details:', error.message, error.stack);
        console.warn('[RPG Companion] Using default settings due to load error');
        // Settings will remain at defaults from state.js
    }

    // Validate inventory structure (Bug #3 fix)
    validateInventoryStructure(extensionSettings.userStats.inventory, 'settings');
}

/**
 * Saves the extension settings to the global settings object.
 */
export function saveSettings() {
    const context = getContext();
    const extension_settings = context.extension_settings || context.extensionSettings;

    if (!extension_settings) {
        console.error('[RPG Companion] extension_settings is not available, cannot save');
        return;
    }

    extension_settings[extensionName] = extensionSettings;
    saveSettingsDebounced();
}

/**
 * Saves RPG data to the current chat's metadata.
 */
export function saveChatData() {
    if (!chat_metadata) {
        return;
    }

    chat_metadata.rpg_companion = {
        userStats: extensionSettings.userStats,
        classicStats: extensionSettings.classicStats,
        quests: extensionSettings.quests,
        lastGeneratedData: lastGeneratedData,
        committedTrackerData: committedTrackerData,
        // Structured data (JSON format)
        inventoryV3: extensionSettings.inventoryV3,
        skillsV2: extensionSettings.skillsV2,
        skillAbilityLinks: extensionSettings.skillAbilityLinks,
        infoBoxData: extensionSettings.infoBoxData,
        charactersData: extensionSettings.charactersData,
        questsV2: extensionSettings.questsV2,
        timestamp: Date.now()
    };

    saveChatDebounced();
}

/**
 * Updates the last assistant message's swipe data with current tracker data.
 * This ensures user edits are preserved across swipes and included in generation context.
 */
export function updateMessageSwipeData() {
    const chat = getContext().chat;
    if (!chat || chat.length === 0) {
        return;
    }

    // Find the last assistant message
    for (let i = chat.length - 1; i >= 0; i--) {
        const message = chat[i];
        if (!message.is_user) {
            // Found last assistant message - update its swipe data
            if (!message.extra) {
                message.extra = {};
            }
            if (!message.extra.rpg_companion_swipes) {
                message.extra.rpg_companion_swipes = {};
            }

            const swipeId = message.swipe_id || 0;
            message.extra.rpg_companion_swipes[swipeId] = {
                userStats: lastGeneratedData.userStats,
                infoBox: lastGeneratedData.infoBox,
                characterThoughts: lastGeneratedData.characterThoughts
            };
            break;
        }
    }
}

/**
 * Loads RPG data from the current chat's metadata.
 * Automatically migrates v1 inventory to v2 format if needed.
 */
export function loadChatData() {
    if (!chat_metadata || !chat_metadata.rpg_companion) {
        // Reset to defaults if no data exists (new chat)
        updateExtensionSettings({
            userStats: {
                health: 100,
                satiety: 100,
                energy: 100,
                hygiene: 100,
                arousal: 0,
                mood: '😐',
                conditions: 'None',
                // Use v2 inventory format for defaults
                inventory: {
                    version: 2,
                    onPerson: "None",
                    stored: {},
                    assets: "None"
                },
                skills: "None" // Legacy single-string skills (for Status section)
            },
            quests: {
                main: "None",
                optional: []
            },
            // Reset structured data fields
            inventoryV3: {
                onPerson: [],
                stored: {},
                assets: [],
                simplified: []
            },
            skillsV2: {},
            skillsData: {},
            skillAbilityLinks: {},
            skills: { list: [], categories: {} },
            charactersData: [],
            infoBoxData: null,
            questsV2: {
                main: null,
                optional: []
            }
        });
        setLastGeneratedData({
            userStats: null,
            infoBox: null,
            characterThoughts: null,
            html: null
        });
        setCommittedTrackerData({
            userStats: null,
            infoBox: null,
            characterThoughts: null
        });
        return;
    }

    const savedData = chat_metadata.rpg_companion;

    // Restore stats
    if (savedData.userStats) {
        extensionSettings.userStats = { ...savedData.userStats };
    }

    // Restore classic stats
    if (savedData.classicStats) {
        extensionSettings.classicStats = { ...savedData.classicStats };
    }

    // Restore quests
    if (savedData.quests) {
        extensionSettings.quests = { ...savedData.quests };
    } else {
        // Initialize with defaults if not present
        extensionSettings.quests = {
            main: "None",
            optional: []
        };
    }

    // Restore last generated data (sanitize null values in infoBox)
    if (savedData.lastGeneratedData) {
        const sanitizedData = { ...savedData.lastGeneratedData };
        if (sanitizedData.infoBox && typeof sanitizedData.infoBox === 'string') {
            // Remove lines that contain "null" values
            sanitizedData.infoBox = sanitizedData.infoBox
                .split('\n')
                .filter(line => !line.match(/:\s*null\s*$/i) && !line.match(/:\s*undefined\s*$/i))
                .join('\n');
        }
        setLastGeneratedData(sanitizedData);
    }

    // Restore committed tracker data (sanitize null values in infoBox)
    if (savedData.committedTrackerData) {
        const sanitizedData = { ...savedData.committedTrackerData };
        if (sanitizedData.infoBox && typeof sanitizedData.infoBox === 'string') {
            // Remove lines that contain "null" values
            sanitizedData.infoBox = sanitizedData.infoBox
                .split('\n')
                .filter(line => !line.match(/:\s*null\s*$/i) && !line.match(/:\s*undefined\s*$/i))
                .join('\n');
        }
        setCommittedTrackerData(sanitizedData);
    }

    // Restore structured data (JSON format)
    if (savedData.inventoryV3) {
        extensionSettings.inventoryV3 = savedData.inventoryV3;
    }
    if (savedData.skillsV2) {
        extensionSettings.skillsV2 = savedData.skillsV2;
    }
    if (savedData.skillAbilityLinks) {
        extensionSettings.skillAbilityLinks = savedData.skillAbilityLinks;
    }
    if (savedData.infoBoxData) {
        extensionSettings.infoBoxData = savedData.infoBoxData;
    }
    if (savedData.charactersData) {
        extensionSettings.charactersData = savedData.charactersData;
    }
    if (savedData.questsV2) {
        extensionSettings.questsV2 = savedData.questsV2;
    }

    // Migrate quests from legacy format to structured format if needed
    if (migrateQuestsFormat()) {
        saveChatData(); // Persist migrated quests to chat metadata
    }

    // Migrate inventory from v1 (string) to v2 (object) format if needed
    if (extensionSettings.userStats.inventory) {
        const migrationResult = migrateInventory(extensionSettings.userStats.inventory);
        if (migrationResult.migrated) {
            console.log(`[RPG Companion] Chat inventory migrated from ${migrationResult.source} to v2 format`);
            extensionSettings.userStats.inventory = migrationResult.inventory;
            saveChatData(); // Persist migrated inventory to chat metadata
        }
    }

    validateInventoryStructure(extensionSettings.userStats.inventory, 'chat');
}

/**
 * Validates and repairs inventory structure to prevent corruption.
 * Ensures all v2 fields exist and are the correct type.
 *
 * @param {Object} inventory - Inventory object to validate
 * @param {string} source - Source of load ('settings' or 'chat') for logging
 * @private
 */
function validateInventoryStructure(inventory, source) {
    if (!inventory || typeof inventory !== 'object') {
        console.error(`[RPG Companion] Invalid inventory from ${source}, resetting to defaults`);
        extensionSettings.userStats.inventory = {
            version: 2,
            onPerson: "None",
            stored: {},
            assets: "None"
        };
        saveSettings();
        return;
    }

    let needsSave = false;

    // Ensure v2 structure
    if (inventory.version !== 2) {
        console.warn(`[RPG Companion] Inventory from ${source} missing version, setting to 2`);
        inventory.version = 2;
        needsSave = true;
    }

    // Validate onPerson field
    if (typeof inventory.onPerson !== 'string') {
        console.warn(`[RPG Companion] Invalid onPerson from ${source}, resetting to "None"`);
        inventory.onPerson = "None";
        needsSave = true;
    } else {
        // Clean items in onPerson (removes corrupted/dangerous items)
        const cleanedOnPerson = cleanItemString(inventory.onPerson);
        if (cleanedOnPerson !== inventory.onPerson) {
            console.warn(`[RPG Companion] Cleaned corrupted items from onPerson inventory (${source})`);
            inventory.onPerson = cleanedOnPerson;
            needsSave = true;
        }
    }

    if (!inventory.stored || typeof inventory.stored !== 'object' || Array.isArray(inventory.stored)) {
        console.error(`[RPG Companion] Corrupted stored inventory from ${source}, resetting to empty object`);
        inventory.stored = {};
        needsSave = true;
    } else {
        // Validate stored object keys/values
        const cleanedStored = validateStoredInventory(inventory.stored);
        if (JSON.stringify(cleanedStored) !== JSON.stringify(inventory.stored)) {
            console.warn(`[RPG Companion] Cleaned dangerous/invalid stored locations from ${source}`);
            inventory.stored = cleanedStored;
            needsSave = true;
        }
    }

    // Validate assets field
    if (typeof inventory.assets !== 'string') {
        console.warn(`[RPG Companion] Invalid assets from ${source}, resetting to "None"`);
        inventory.assets = "None";
        needsSave = true;
    } else {
        // Clean items in assets (removes corrupted/dangerous items)
        const cleanedAssets = cleanItemString(inventory.assets);
        if (cleanedAssets !== inventory.assets) {
            console.warn(`[RPG Companion] Cleaned corrupted items from assets inventory (${source})`);
            inventory.assets = cleanedAssets;
            needsSave = true;
        }
    }

    // Persist repairs if needed
    if (needsSave) {
        console.log(`[RPG Companion] Repaired inventory structure from ${source}, saving...`);
        saveSettings();
        if (source === 'chat') {
            saveChatData();
        }
    }
}

/**
 * Migrates old settings format to new trackerConfig format
 * Converts statNames to customStats array and sets up default config
 */
function migrateToTrackerConfig() {
    // Initialize trackerConfig if it doesn't exist
    if (!extensionSettings.trackerConfig) {
        extensionSettings.trackerConfig = {
            userStats: {
                customStats: [],
                showRPGAttributes: true,
                alwaysSendAttributes: false,
                allowAIUpdateAttributes: true,
                rpgAttributes: [
                    { id: 'str', name: 'STR', description: '', enabled: true },
                    { id: 'dex', name: 'DEX', description: '', enabled: true },
                    { id: 'con', name: 'CON', description: '', enabled: true },
                    { id: 'int', name: 'INT', description: '', enabled: true },
                    { id: 'wis', name: 'WIS', description: '', enabled: true },
                    { id: 'cha', name: 'CHA', description: '', enabled: true }
                ],
                statusSection: {
                    enabled: true,
                    showMoodEmoji: true,
                    customFields: ['Conditions']
                },
                skillsSection: {
                    enabled: false,
                    label: 'Skills'
                }
            },
            infoBox: {
                widgets: {
                    date: { enabled: true, format: 'Weekday, Month, Year' },
                    weather: { enabled: true },
                    temperature: { enabled: true, unit: 'C' },
                    time: { enabled: true },
                    location: { enabled: true },
                    recentEvents: { enabled: true }
                }
            },
            presentCharacters: {
                showEmoji: true,
                showName: true,
                customFields: [
                    { id: 'physicalState', label: 'Physical State', enabled: true, placeholder: 'Visible Physical State (up to three traits)' },
                    { id: 'demeanor', label: 'Demeanor Cue', enabled: true, placeholder: 'Observable Demeanor Cue (one trait)' },
                    { id: 'relationship', label: 'Relationship', enabled: true, type: 'relationship', placeholder: 'Enemy/Neutral/Friend/Lover' },
                    { id: 'internalMonologue', label: 'Internal Monologue', enabled: true, placeholder: 'Internal Monologue (in first person POV, up to three sentences long)' }
                ],
                characterStats: {
                    enabled: false,
                    stats: []
                }
            }
        };
    }

    // Migrate old statNames to customStats if statNames exists
    if (extensionSettings.statNames && extensionSettings.trackerConfig.userStats.customStats.length === 0) {
        const statOrder = ['health', 'satiety', 'energy', 'hygiene', 'arousal'];
        extensionSettings.trackerConfig.userStats.customStats = statOrder.map(id => ({
            id: id,
            name: extensionSettings.statNames[id] || id.charAt(0).toUpperCase() + id.slice(1),
            enabled: true
        }));
        console.log('[RPG Companion] Migrated statNames to customStats array');
    }

    // Ensure all stats have corresponding values in userStats
    if (extensionSettings.userStats) {
        for (const stat of extensionSettings.trackerConfig.userStats.customStats) {
            if (extensionSettings.userStats[stat.id] === undefined) {
                extensionSettings.userStats[stat.id] = stat.id === 'arousal' ? 0 : 100;
            }
        }
    }

    // Migrate old showRPGAttributes boolean to rpgAttributes array
    if (extensionSettings.trackerConfig.userStats.showRPGAttributes !== undefined) {
        const shouldShow = extensionSettings.trackerConfig.userStats.showRPGAttributes;
        extensionSettings.trackerConfig.userStats.rpgAttributes = [
            { id: 'str', name: 'STR', description: '', enabled: shouldShow },
            { id: 'dex', name: 'DEX', description: '', enabled: shouldShow },
            { id: 'con', name: 'CON', description: '', enabled: shouldShow },
            { id: 'int', name: 'INT', description: '', enabled: shouldShow },
            { id: 'wis', name: 'WIS', description: '', enabled: shouldShow },
            { id: 'cha', name: 'CHA', description: '', enabled: shouldShow }
        ];
        delete extensionSettings.trackerConfig.userStats.showRPGAttributes;
        console.log('[RPG Companion] Migrated showRPGAttributes to rpgAttributes array');
    }

    // Ensure rpgAttributes exists even if no migration was needed
    if (!extensionSettings.trackerConfig.userStats.rpgAttributes) {
        extensionSettings.trackerConfig.userStats.rpgAttributes = [
            { id: 'str', name: 'STR', description: '', enabled: true },
            { id: 'dex', name: 'DEX', description: '', enabled: true },
            { id: 'con', name: 'CON', description: '', enabled: true },
            { id: 'int', name: 'INT', description: '', enabled: true },
            { id: 'wis', name: 'WIS', description: '', enabled: true },
            { id: 'cha', name: 'CHA', description: '', enabled: true }
        ];
    }

    // Ensure showRPGAttributes exists (defaults to true)
    if (extensionSettings.trackerConfig.userStats.showRPGAttributes === undefined) {
        extensionSettings.trackerConfig.userStats.showRPGAttributes = true;
    }

    // Ensure all rpgAttributes have corresponding values in classicStats
    if (extensionSettings.classicStats) {
        for (const attr of extensionSettings.trackerConfig.userStats.rpgAttributes) {
            if (extensionSettings.classicStats[attr.id] === undefined) {
                extensionSettings.classicStats[attr.id] = 10;
            }
        }
    }

    // Migrate old presentCharacters structure to new format
    if (extensionSettings.trackerConfig.presentCharacters) {
        const pc = extensionSettings.trackerConfig.presentCharacters;

        // Check if using old flat customFields structure (has 'label' or 'placeholder' keys)
        if (pc.customFields && pc.customFields.length > 0) {
            const hasOldFormat = pc.customFields.some(f => f.label || f.placeholder || f.type === 'relationship');

            if (hasOldFormat) {
                console.log('[RPG Companion] Migrating Present Characters to new structure');

                // Extract relationship fields from old customFields
                const relationshipFields = ['Lover', 'Friend', 'Ally', 'Enemy', 'Neutral'];

                // Extract non-relationship fields and convert to new format
                const newCustomFields = pc.customFields
                    .filter(f => f.type !== 'relationship' && f.id !== 'internalMonologue')
                    .map(f => ({
                        id: f.id,
                        name: f.label || f.name || 'Field',
                        enabled: f.enabled !== false,
                        description: f.placeholder || f.description || ''
                    }));

                // Extract thoughts config from old Internal Monologue field
                const thoughtsField = pc.customFields.find(f => f.id === 'internalMonologue');
                const thoughts = {
                    enabled: thoughtsField ? (thoughtsField.enabled !== false) : true,
                    name: 'Thoughts',
                    description: thoughtsField?.placeholder || 'Internal monologue (in first person POV, up to three sentences long)'
                };

                // Update to new structure
                pc.relationshipFields = relationshipFields;
                pc.customFields = newCustomFields;
                pc.thoughts = thoughts;

                console.log('[RPG Companion] Present Characters migration complete');
                saveSettings(); // Persist the migration
            }
        }

        // Ensure new structure exists even if migration wasn't needed
        if (!pc.relationshipFields) {
            pc.relationshipFields = ['Lover', 'Friend', 'Ally', 'Enemy', 'Neutral'];
        }
        if (!pc.relationshipEmojis) {
            // Create default emoji mapping from relationshipFields
            pc.relationshipEmojis = {
                'Lover': '❤️',
                'Friend': '⭐',
                'Ally': '🤝',
                'Enemy': '⚔️',
                'Neutral': '⚖️'
            };
        }
        if (!pc.thoughts) {
            pc.thoughts = {
                enabled: true,
                name: 'Thoughts',
                description: 'Internal monologue (in first person POV, up to three sentences long)'
            };
        }
    }
}

/**
 * Migrates stats and skills to new format with description fields.
 * - customStats: adds description field
 * - rpgAttributes: adds description field  
 * - skillsSection.customFields: converts from string array to object array
 * @returns {boolean} true if any migration was performed
 */
function migrateStatsAndSkillsFormat() {
    let migrated = false;
    
    if (!extensionSettings.trackerConfig?.userStats) {
        return false;
    }
    
    const userStats = extensionSettings.trackerConfig.userStats;
    
    // Migrate customStats - add description if missing
    if (userStats.customStats) {
        for (const stat of userStats.customStats) {
            if (stat && typeof stat === 'object' && stat.description === undefined) {
                stat.description = '';
                migrated = true;
            }
        }
    }
    
    // Migrate rpgAttributes - add description if missing
    if (userStats.rpgAttributes) {
        for (const attr of userStats.rpgAttributes) {
            if (attr && typeof attr === 'object' && attr.description === undefined) {
                attr.description = '';
                migrated = true;
            }
        }
    }
    
    // Migrate skillsSection.customFields - convert string array to object array
    if (userStats.skillsSection?.customFields) {
        const oldFields = userStats.skillsSection.customFields;
        const hasOldFormat = oldFields.some(f => typeof f === 'string');
        
        if (hasOldFormat) {
            console.log('[RPG Companion] Migrating skill categories to new format');
            userStats.skillsSection.customFields = oldFields.map((field, index) => {
                if (typeof field === 'string') {
                    return {
                        id: 'skill_' + Date.now() + '_' + index,
                        name: field,
                        description: '',
                        enabled: true
                    };
                }
                // Already an object, ensure it has all fields
                return {
                    id: field.id || 'skill_' + Date.now() + '_' + index,
                    name: field.name || 'Skill',
                    description: field.description || '',
                    enabled: field.enabled !== false
                };
            });
            migrated = true;
        }
    }
    
    // Migrate character stats - add description if missing
    if (extensionSettings.trackerConfig?.presentCharacters?.characterStats?.customStats) {
        for (const stat of extensionSettings.trackerConfig.presentCharacters.characterStats.customStats) {
            if (stat && typeof stat === 'object' && stat.description === undefined) {
                stat.description = '';
                migrated = true;
            }
        }
    }
    
    if (migrated) {
        console.log('[RPG Companion] Stats/skills format migration complete');
    }
    
    return migrated;
}

/**
 * Migrates quests from legacy format to structured format (questsV2).
 * Legacy format: quests.main (string), quests.optional (string array)
 * New format: questsV2.main ({name, description}), questsV2.optional (array of {name, description})
 * @returns {boolean} true if any migration was performed
 */
function migrateQuestsFormat() {
    let migrated = false;
    
    // Initialize questsV2 if it doesn't exist
    if (!extensionSettings.questsV2) {
        extensionSettings.questsV2 = {
            main: null,
            optional: []
        };
    }
    
    // Migrate main quest if it exists in legacy format but not in new format
    // Check if legacy format has data AND new format is empty/null
    if (extensionSettings.quests?.main && 
        extensionSettings.quests.main !== 'None' && 
        extensionSettings.quests.main !== '' &&
        (!extensionSettings.questsV2.main || !extensionSettings.questsV2.main.name)) {
        extensionSettings.questsV2.main = {
            name: extensionSettings.quests.main,
            description: extensionSettings.quests?.mainDescription || ''
        };
        migrated = true;
        console.log('[RPG Companion] Migrated main quest to structured format:', extensionSettings.quests.main);
    }
    
    // Migrate optional quests if they exist in legacy format but not in new format
    // Check if legacy format has data AND new format is empty
    if (extensionSettings.quests?.optional && 
        Array.isArray(extensionSettings.quests.optional) && 
        extensionSettings.quests.optional.length > 0 &&
        (!extensionSettings.questsV2.optional || extensionSettings.questsV2.optional.length === 0)) {
        const descriptions = extensionSettings.quests?.optionalDescriptions || [];
        extensionSettings.questsV2.optional = extensionSettings.quests.optional
            .filter(title => title && title !== 'None' && title !== '')
            .map((title, i) => ({
                name: title,
                description: descriptions[i] || ''
            }));
        if (extensionSettings.questsV2.optional.length > 0) {
            migrated = true;
            console.log('[RPG Companion] Migrated optional quests to structured format:', extensionSettings.questsV2.optional.length, 'quests');
        }
    }
    
    if (migrated) {
        console.log('[RPG Companion] Quests format migration complete');
    }
    
    return migrated;
}
