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
    setExtensionSettings,
    updateExtensionSettings,
    setLastGeneratedData,
    setCommittedTrackerData,
    FEATURE_FLAGS
} from './state.js';
import { migrateInventory } from '../utils/migration.js';
import { validateStoredInventory, cleanItemString } from '../utils/security.js';
import { migrateToV3JSON } from '../utils/jsonMigration.js';

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

            // Perform settings migrations based on version
            const currentVersion = extensionSettings.settingsVersion || 1;
            let settingsChanged = false;

            // Migration to version 2: Enable dynamic weather for existing users
            if (currentVersion < 2) {
                // console.log('[RPG Companion] Migrating settings to version 2 (enabling dynamic weather)');
                extensionSettings.enableDynamicWeather = true;
                extensionSettings.settingsVersion = 2;
                settingsChanged = true;
            }

            // Migration to version 3: Convert text trackers to JSON format
            if (currentVersion < 3) {
                // console.log('[RPG Companion] Migrating settings to version 3 (JSON tracker format)');
                migrateToV3JSON();
                extensionSettings.settingsVersion = 3;
                settingsChanged = true;
            }

            // Save migrated settings
            if (settingsChanged) {
                saveSettings();
            }

            // console.log('[RPG Companion] Settings loaded:', extensionSettings);
        } else {
            // console.log('[RPG Companion] No saved settings found, using defaults');
        }

        // Migrate inventory if feature flag enabled
        if (FEATURE_FLAGS.useNewInventory) {
            const migrationResult = migrateInventory(extensionSettings.userStats.inventory);
            if (migrationResult.migrated) {
                // console.log(`[RPG Companion] Inventory migrated from ${migrationResult.source} to v2 format`);
                extensionSettings.userStats.inventory = migrationResult.inventory;
                saveSettings(); // Persist migrated inventory
            }
        }

        // Migrate to trackerConfig if it doesn't exist
        if (!extensionSettings.trackerConfig) {
            // console.log('[RPG Companion] Migrating to trackerConfig format');
            migrateToTrackerConfig();
            saveSettings(); // Persist migration
        }

        // Migrate to preset manager system if presets don't exist
        migrateToPresetManager();
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

    // console.log('[RPG Companion] 💾 saveChatData called - committedTrackerData:', {
    //     userStats: committedTrackerData.userStats ? `${committedTrackerData.userStats.substring(0, 50)}...` : 'null',
    //     infoBox: committedTrackerData.infoBox ? 'exists' : 'null',
    //     characterThoughts: committedTrackerData.characterThoughts ? 'exists' : 'null'
    // });
    // console.log('[RPG Companion] 💾 saveChatData RAW committedTrackerData:', committedTrackerData);
    // console.log('[RPG Companion] 💾 saveChatData RAW lastGeneratedData:', lastGeneratedData);

    chat_metadata.rpg_companion = {
        userStats: extensionSettings.userStats,
        classicStats: extensionSettings.classicStats,
        quests: extensionSettings.quests,
        lastGeneratedData: lastGeneratedData,
        committedTrackerData: committedTrackerData,
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

            // console.log('[RPG Companion] Updated message swipe data after user edit');
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
        // Reset to defaults if no data exists
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
                }
            },
            quests: {
                main: "None",
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

    // Restore committed tracker data first
    if (savedData.committedTrackerData) {
        // console.log('[RPG Companion] 📥 loadChatData restoring committedTrackerData:', {
        //     userStats: savedData.committedTrackerData.userStats ? `${savedData.committedTrackerData.userStats.substring(0, 50)}...` : 'null',
        //     infoBox: savedData.committedTrackerData.infoBox ? 'exists' : 'null',
        //     characterThoughts: savedData.committedTrackerData.characterThoughts ? 'exists' : 'null'
        // });
        // console.log('[RPG Companion] 📥 RAW savedData.committedTrackerData:', savedData.committedTrackerData);
        // console.log('[RPG Companion] 📥 Type check:', {
        //     userStatsType: typeof savedData.committedTrackerData.userStats,
        //     infoBoxType: typeof savedData.committedTrackerData.infoBox,
        //     characterThoughtsType: typeof savedData.committedTrackerData.characterThoughts
        // });
        setCommittedTrackerData({ ...savedData.committedTrackerData });
    }

    // Restore last generated data (for display)
    // Always prefer lastGeneratedData as it contains the most recent generation (including swipes)
    if (savedData.lastGeneratedData) {
        // console.log('[RPG Companion] 📥 loadChatData restoring lastGeneratedData');
        setLastGeneratedData({ ...savedData.lastGeneratedData });
    } else {
        // console.log('[RPG Companion] ⚠️ No lastGeneratedData found in save');
    }

    // Migrate inventory in chat data if feature flag enabled
    if (FEATURE_FLAGS.useNewInventory && extensionSettings.userStats.inventory) {
        const migrationResult = migrateInventory(extensionSettings.userStats.inventory);
        if (migrationResult.migrated) {
            // console.log(`[RPG Companion] Chat inventory migrated from ${migrationResult.source} to v2 format`);
            extensionSettings.userStats.inventory = migrationResult.inventory;
            saveChatData(); // Persist migrated inventory to chat metadata
        }
    }

    // Validate inventory structure (Bug #3 fix)
    validateInventoryStructure(extensionSettings.userStats.inventory, 'chat');

    // console.log('[RPG Companion] Loaded chat data:', savedData);
}

/**
 * Validates and repairs inventory structure to prevent corruption.
 * Ensures all v2 fields exist and are the correct type.
 * Fixes Bug #3: Location disappears when switching tabs
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

    // Validate stored field (CRITICAL for Bug #3)
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
        // console.log(`[RPG Companion] Repaired inventory structure from ${source}, saving...`);
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
                rpgAttributes: [
                    { id: 'str', name: 'STR', enabled: true },
                    { id: 'dex', name: 'DEX', enabled: true },
                    { id: 'con', name: 'CON', enabled: true },
                    { id: 'int', name: 'INT', enabled: true },
                    { id: 'wis', name: 'WIS', enabled: true },
                    { id: 'cha', name: 'CHA', enabled: true }
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
        // console.log('[RPG Companion] Migrated statNames to customStats array');
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
            { id: 'str', name: 'STR', enabled: shouldShow },
            { id: 'dex', name: 'DEX', enabled: shouldShow },
            { id: 'con', name: 'CON', enabled: shouldShow },
            { id: 'int', name: 'INT', enabled: shouldShow },
            { id: 'wis', name: 'WIS', enabled: shouldShow },
            { id: 'cha', name: 'CHA', enabled: shouldShow }
        ];
        delete extensionSettings.trackerConfig.userStats.showRPGAttributes;
        // console.log('[RPG Companion] Migrated showRPGAttributes to rpgAttributes array');
    }

    // Ensure rpgAttributes exists even if no migration was needed
    if (!extensionSettings.trackerConfig.userStats.rpgAttributes) {
        extensionSettings.trackerConfig.userStats.rpgAttributes = [
            { id: 'str', name: 'STR', enabled: true },
            { id: 'dex', name: 'DEX', enabled: true },
            { id: 'con', name: 'CON', enabled: true },
            { id: 'int', name: 'INT', enabled: true },
            { id: 'wis', name: 'WIS', enabled: true },
            { id: 'cha', name: 'CHA', enabled: true }
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
                // console.log('[RPG Companion] Migrating Present Characters to new structure');

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

                // console.log('[RPG Companion] Present Characters migration complete');
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

        // Migrate to new relationships structure if not already present
        if (!pc.relationships) {
            pc.relationships = {
                enabled: true, // Default to enabled for backward compatibility
                relationshipEmojis: pc.relationshipEmojis || {
                    'Lover': '❤️',
                    'Friend': '⭐',
                    'Ally': '🤝',
                    'Enemy': '⚔️',
                    'Neutral': '⚖️'
                }
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

// ============================================================================
// Preset Management Functions
// ============================================================================

/**
 * Gets the entity key for the current character or group
 * @returns {string|null} Entity key in format "char_{id}" or "group_{id}", or null if no character selected
 */
export function getCurrentEntityKey() {
    const context = getContext();
    if (context.groupId) {
        return `group_${context.groupId}`;
    } else if (context.characterId !== undefined && context.characterId !== null) {
        return `char_${context.characterId}`;
    }
    return null;
}

/**
 * Gets the display name for the current character or group
 * @returns {string} Display name for the current entity
 */
export function getCurrentEntityName() {
    const context = getContext();
    if (context.groupId) {
        const group = context.groups?.find(g => g.id === context.groupId);
        return group?.name || 'Group Chat';
    } else if (context.characterId !== undefined && context.characterId !== null) {
        return context.name2 || 'Character';
    }
    return 'No Character';
}

/**
 * Migrates existing trackerConfig to the preset system if presetManager doesn't exist
 * Creates a "Default" preset from the current trackerConfig
 */
export function migrateToPresetManager() {
    if (!extensionSettings.presetManager || Object.keys(extensionSettings.presetManager.presets || {}).length === 0) {
        // console.log('[RPG Companion] Migrating to preset manager system');

        // Initialize presetManager if it doesn't exist
        if (!extensionSettings.presetManager) {
            extensionSettings.presetManager = {
                presets: {},
                characterAssociations: {},
                activePresetId: null,
                defaultPresetId: null
            };
        }

        // Create default preset from existing trackerConfig
        const defaultPresetId = 'preset_default';
        extensionSettings.presetManager.presets[defaultPresetId] = {
            id: defaultPresetId,
            name: 'Default',
            trackerConfig: JSON.parse(JSON.stringify(extensionSettings.trackerConfig))
        };
        extensionSettings.presetManager.activePresetId = defaultPresetId;
        extensionSettings.presetManager.defaultPresetId = defaultPresetId;

        // console.log('[RPG Companion] Created Default preset from existing trackerConfig');
        saveSettings();
    }
}

/**
 * Gets all available presets
 * @returns {Object} Map of preset ID to preset data
 */
export function getPresets() {
    return extensionSettings.presetManager?.presets || {};
}

/**
 * Gets a specific preset by ID
 * @param {string} presetId - The preset ID
 * @returns {Object|null} The preset object or null if not found
 */
export function getPreset(presetId) {
    return extensionSettings.presetManager?.presets?.[presetId] || null;
}

/**
 * Gets the currently active preset ID
 * @returns {string|null} The active preset ID or null
 */
export function getActivePresetId() {
    return extensionSettings.presetManager?.activePresetId || null;
}

/**
 * Gets the default preset ID
 * @returns {string|null} The default preset ID or null
 */
export function getDefaultPresetId() {
    return extensionSettings.presetManager?.defaultPresetId || null;
}

/**
 * Sets a preset as the default
 * @param {string} presetId - The preset ID to set as default
 */
export function setDefaultPreset(presetId) {
    if (extensionSettings.presetManager.presets[presetId]) {
        extensionSettings.presetManager.defaultPresetId = presetId;
        saveSettings();
        // console.log(`[RPG Companion] Set preset ${presetId} as default`);
    }
}

/**
 * Checks if the given preset is the default
 * @param {string} presetId - The preset ID to check
 * @returns {boolean} True if it's the default preset
 */
export function isDefaultPreset(presetId) {
    return extensionSettings.presetManager?.defaultPresetId === presetId;
}

/**
 * Creates a new preset from the current trackerConfig
 * @param {string} name - Name for the new preset
 * @returns {string} The ID of the newly created preset
 */
export function createPreset(name) {
    const presetId = `preset_${Date.now()}`;
    extensionSettings.presetManager.presets[presetId] = {
        id: presetId,
        name: name,
        trackerConfig: JSON.parse(JSON.stringify(extensionSettings.trackerConfig))
    };
    // Also set it as the active preset so edits go to the new preset
    extensionSettings.presetManager.activePresetId = presetId;
    saveSettings();
    // console.log(`[RPG Companion] Created preset "${name}" with ID ${presetId}`);
    return presetId;
}

/**
 * Saves the current trackerConfig to the specified preset
 * @param {string} presetId - The preset ID to save to
 */
export function saveToPreset(presetId) {
    const preset = extensionSettings.presetManager.presets[presetId];
    if (preset) {
        preset.trackerConfig = JSON.parse(JSON.stringify(extensionSettings.trackerConfig));
        saveSettings();
        // console.log(`[RPG Companion] Saved current config to preset "${preset.name}"`);
    }
}

/**
 * Loads a preset's trackerConfig as the active configuration
 * @param {string} presetId - The preset ID to load
 * @returns {boolean} True if loaded successfully, false otherwise
 */
export function loadPreset(presetId) {
    const preset = extensionSettings.presetManager.presets[presetId];
    if (preset && preset.trackerConfig) {
        extensionSettings.trackerConfig = JSON.parse(JSON.stringify(preset.trackerConfig));
        extensionSettings.presetManager.activePresetId = presetId;
        saveSettings();
        // console.log(`[RPG Companion] Loaded preset "${preset.name}"`);
        return true;
    }
    return false;
}

/**
 * Renames a preset
 * @param {string} presetId - The preset ID to rename
 * @param {string} newName - The new name for the preset
 */
export function renamePreset(presetId, newName) {
    const preset = extensionSettings.presetManager.presets[presetId];
    if (preset) {
        preset.name = newName;
        saveSettings();
        // console.log(`[RPG Companion] Renamed preset to "${newName}"`);
    }
}

/**
 * Deletes a preset
 * @param {string} presetId - The preset ID to delete
 * @returns {boolean} True if deleted, false if it's the last preset (can't delete)
 */
export function deletePreset(presetId) {
    const presets = extensionSettings.presetManager.presets;
    const presetIds = Object.keys(presets);

    // Don't delete if it's the last preset
    if (presetIds.length <= 1) {
        // console.warn('[RPG Companion] Cannot delete the last preset');
        return false;
    }

    // Remove any character associations using this preset
    const associations = extensionSettings.presetManager.characterAssociations;
    for (const entityKey of Object.keys(associations)) {
        if (associations[entityKey] === presetId) {
            delete associations[entityKey];
        }
    }

    // Delete the preset
    delete presets[presetId];

    // If the deleted preset was active, switch to the first available preset
    if (extensionSettings.presetManager.activePresetId === presetId) {
        const remainingIds = Object.keys(presets);
        if (remainingIds.length > 0) {
            loadPreset(remainingIds[0]);
        }
    }

    saveSettings();
    // console.log(`[RPG Companion] Deleted preset ${presetId}`);
    return true;
}

/**
 * Associates the current preset with the current character/group
 */
export function associatePresetWithCurrentEntity() {
    const entityKey = getCurrentEntityKey();
    const activePresetId = extensionSettings.presetManager.activePresetId;

    if (entityKey && activePresetId) {
        extensionSettings.presetManager.characterAssociations[entityKey] = activePresetId;
        saveSettings();
        // console.log(`[RPG Companion] Associated preset ${activePresetId} with ${entityKey}`);
    }
}

/**
 * Removes the preset association for the current character/group
 */
export function removePresetAssociationForCurrentEntity() {
    const entityKey = getCurrentEntityKey();
    if (entityKey && extensionSettings.presetManager.characterAssociations[entityKey]) {
        delete extensionSettings.presetManager.characterAssociations[entityKey];
        saveSettings();
        // console.log(`[RPG Companion] Removed preset association for ${entityKey}`);
    }
}

/**
 * Gets the preset ID associated with the current character/group
 * @returns {string|null} The associated preset ID or null
 */
export function getPresetForCurrentEntity() {
    const entityKey = getCurrentEntityKey();
    if (entityKey) {
        return extensionSettings.presetManager.characterAssociations[entityKey] || null;
    }
    return null;
}

/**
 * Checks if the current character/group has a preset association
 * @returns {boolean} True if there's an association
 */
export function hasPresetAssociation() {
    const entityKey = getCurrentEntityKey();
    return entityKey && extensionSettings.presetManager.characterAssociations[entityKey] !== undefined;
}

/**
 * Auto-switches to the preset associated with the current character/group
 * Called when character changes. Falls back to default preset if no association.
 * @returns {boolean} True if a preset was switched, false otherwise
 */
export function autoSwitchPresetForEntity() {
    const associatedPresetId = getPresetForCurrentEntity();
    
    // If there's a character-specific preset, use it
    if (associatedPresetId && associatedPresetId !== extensionSettings.presetManager.activePresetId) {
        // Check if the preset still exists
        if (extensionSettings.presetManager.presets[associatedPresetId]) {
            return loadPreset(associatedPresetId);
        } else {
            // Preset was deleted, remove the stale association
            removePresetAssociationForCurrentEntity();
        }
    }
    
    // No character association - fall back to default preset if set
    if (!associatedPresetId) {
        const defaultPresetId = extensionSettings.presetManager.defaultPresetId;
        if (defaultPresetId && 
            defaultPresetId !== extensionSettings.presetManager.activePresetId &&
            extensionSettings.presetManager.presets[defaultPresetId]) {
            return loadPreset(defaultPresetId);
        }
    }
    
    return false;
}

/**
 * Exports presets for sharing (without character associations)
 * @param {string[]} presetIds - Array of preset IDs to export, or empty for all
 * @returns {Object} Export data object
 */
export function exportPresets(presetIds = []) {
    const presetsToExport = {};
    const allPresets = extensionSettings.presetManager.presets;

    // If no specific IDs provided, export all
    const idsToExport = presetIds.length > 0 ? presetIds : Object.keys(allPresets);

    for (const id of idsToExport) {
        if (allPresets[id]) {
            presetsToExport[id] = {
                id: allPresets[id].id,
                name: allPresets[id].name,
                trackerConfig: allPresets[id].trackerConfig
            };
        }
    }

    return {
        version: '1.0',
        exportDate: new Date().toISOString(),
        presets: presetsToExport
        // Note: characterAssociations are intentionally NOT exported
    };
}

/**
 * Imports presets from an export file
 * @param {Object} importData - The imported data object
 * @param {boolean} overwrite - If true, overwrites existing presets with same name
 * @returns {number} Number of presets imported
 */
export function importPresets(importData, overwrite = false) {
    if (!importData.presets || typeof importData.presets !== 'object') {
        throw new Error('Invalid import data: missing presets');
    }

    let importCount = 0;
    const existingNames = new Set(
        Object.values(extensionSettings.presetManager.presets).map(p => p.name.toLowerCase())
    );

    for (const [originalId, preset] of Object.entries(importData.presets)) {
        if (!preset.name || !preset.trackerConfig) {
            continue; // Skip invalid presets
        }

        let name = preset.name;
        const nameLower = name.toLowerCase();

        // Check for name collision
        if (existingNames.has(nameLower)) {
            if (overwrite) {
                // Find and delete the existing preset with this name
                for (const [existingId, existingPreset] of Object.entries(extensionSettings.presetManager.presets)) {
                    if (existingPreset.name.toLowerCase() === nameLower) {
                        delete extensionSettings.presetManager.presets[existingId];
                        break;
                    }
                }
            } else {
                // Generate a unique name
                let counter = 1;
                while (existingNames.has(`${nameLower} (${counter})`)) {
                    counter++;
                }
                name = `${preset.name} (${counter})`;
            }
        }

        // Create new preset with new ID
        const newId = `preset_${Date.now()}_${importCount}`;
        extensionSettings.presetManager.presets[newId] = {
            id: newId,
            name: name,
            trackerConfig: JSON.parse(JSON.stringify(preset.trackerConfig))
        };
        existingNames.add(name.toLowerCase());
        importCount++;
    }

    if (importCount > 0) {
        saveSettings();
    }

    return importCount;
}

