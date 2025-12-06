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
    setCommittedTrackerData,
    createFreshTrackerData
} from './state.js';
import { migrateInventory } from '../utils/migration.js';
import { parseItems } from '../utils/itemParser.js';
import { TRACKER_DATA_VERSION } from '../types/trackerData.js';
import { defaultSettings } from './config.js';

const extensionName = 'third-party/rpg-companion-sillytavern';

/**
 * Deep merges source into target, ensuring all default fields exist.
 * - Primitives/arrays in target are preserved
 * - Missing fields are filled from source (defaults)
 * - Objects are recursively merged
 * @param {Object} target - The saved/loaded settings
 * @param {Object} source - The default settings
 * @returns {Object} The merged object
 */
function deepMergeDefaults(target, source) {
    if (!source || typeof source !== 'object') return target;
    if (!target || typeof target !== 'object') return JSON.parse(JSON.stringify(source));
    
    const result = { ...target };
    
    for (const key of Object.keys(source)) {
        if (!(key in result)) {
            // Missing field - use default
            result[key] = JSON.parse(JSON.stringify(source[key]));
        } else if (
            source[key] !== null &&
            typeof source[key] === 'object' &&
            !Array.isArray(source[key]) &&
            result[key] !== null &&
            typeof result[key] === 'object' &&
            !Array.isArray(result[key])
        ) {
            // Both are objects (not arrays) - recurse
            result[key] = deepMergeDefaults(result[key], source[key]);
        }
        // Otherwise keep the target value (user's saved value)
    }
    
    return result;
}

/**
 * Validates extension settings structure
 * @param {Object} settings - Settings object to validate
 * @returns {boolean} True if valid, false otherwise
 */
function validateSettings(settings) {
    if (!settings || typeof settings !== 'object') {
        return false;
    }

    if (typeof settings.enabled !== 'boolean' ||
        typeof settings.autoUpdate !== 'boolean' ||
        typeof settings.showUserStats !== 'boolean') {
        console.warn('[RPG Companion] Settings validation failed: missing required properties');
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

        if (!extension_settings || typeof extension_settings !== 'object') {
            console.warn('[RPG Companion] extension_settings is not available, using default settings');
            return;
        }

        if (extension_settings[extensionName]) {
            const savedSettings = extension_settings[extensionName];

            if (!validateSettings(savedSettings)) {
                console.warn('[RPG Companion] Loaded settings failed validation, using defaults');
                saveSettings();
            } else {
                // Deep merge saved settings with defaults to ensure all fields exist
                const mergedSettings = deepMergeDefaults(savedSettings, defaultSettings);
                updateExtensionSettings(mergedSettings);
            }

            // If legacy tracker payloads are present in saved settings, migrate them into committed tracker data
            const legacyTracker = migrateLegacyTrackerFromSettings(extensionSettings);
            if (legacyTracker) {
                setCommittedTrackerData(legacyTracker);
                setLastGeneratedData(createFreshTrackerData());
                stripLegacyTrackerFieldsFromSettings();
                saveSettings(); // Persist cleaned settings
            }
        }

        // Run legacy migrations (these handle structural changes, not missing fields)
        if (migrateToTrackerConfig()) {
            saveSettings();
        }
        
        if (migrateStatsAndSkillsFormat()) {
            saveSettings();
        }
    } catch (error) {
        console.error('[RPG Companion] Error loading settings:', error);
        console.error('[RPG Companion] Error details:', error.message, error.stack);
        console.warn('[RPG Companion] Using default settings due to load error');
    }
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

    stripLegacyTrackerFieldsFromSettings();
    extension_settings[extensionName] = extensionSettings;
    saveSettingsDebounced();
}

/**
 * Saves RPG data to the current chat's metadata.
 */
export function saveChatData() {
    const context = getContext();
    const hasActiveChat = chat_metadata && context.chat && context.chat.length > 0;

    // Rebuild structured tracker data from any legacy-view edits before saving
    const rebuilt = buildTrackerDataFromLegacy(extensionSettings);

    if (rebuilt) {
        setCommittedTrackerData(rebuilt);
    }

    const dataToSave = {
        trackerVersion: TRACKER_DATA_VERSION,
        committedTrackerData: JSON.parse(JSON.stringify(committedTrackerData)),
        lastGeneratedData: JSON.parse(JSON.stringify(lastGeneratedData)),
        timestamp: Date.now()
    };

    if (hasActiveChat) {
        chat_metadata.rpg_companion = dataToSave;
        saveChatDebounced();
        if (extensionSettings._pendingTrackerData) {
            delete extensionSettings._pendingTrackerData;
            saveSettingsDebounced();
        }
    } else {
        extensionSettings._pendingTrackerData = dataToSave;
        saveSettingsDebounced();
    }
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
            // Found last assistant message - update its swipe data with structured tracker
            if (!message.extra) {
                message.extra = {};
            }
            if (!message.extra.rpg_companion_swipes) {
                message.extra.rpg_companion_swipes = {};
            }

            const swipeId = message.swipe_id || 0;
            message.extra.rpg_companion_swipes[swipeId] = JSON.parse(JSON.stringify(lastGeneratedData));
            break;
        }
    }
}

/**
 * Loads RPG data from the current chat's metadata.
 * Automatically migrates v1 inventory to v2 format if needed.
 * Also restores any pending data saved before chat was active.
 */
export function loadChatData() {
    // Check for pending data from before chat was active
    const pendingData = extensionSettings._pendingTrackerData;
    
    if (!chat_metadata || !chat_metadata.rpg_companion) {
        if (pendingData && pendingData.lastGeneratedData) {
            setCommittedTrackerData(pendingData.committedTrackerData || createFreshTrackerData());
            setLastGeneratedData(pendingData.lastGeneratedData);
            delete extensionSettings._pendingTrackerData;
            saveSettingsDebounced();
            saveChatData();
            return;
        }
        setCommittedTrackerData(createFreshTrackerData());
        setLastGeneratedData(createFreshTrackerData());
        return;
    }

    const savedData = chat_metadata.rpg_companion;

    if (savedData.trackerVersion === TRACKER_DATA_VERSION &&
        savedData.committedTrackerData) {
        setCommittedTrackerData(savedData.committedTrackerData);
        setLastGeneratedData(savedData.lastGeneratedData || createFreshTrackerData());

        if (pendingData) {
            delete extensionSettings._pendingTrackerData;
            saveSettingsDebounced();
        }
        return;
    }

    // Legacy chat payloads → migrate into structured tracker data
    const migratedCommitted = migrateLegacyTrackerFromChat(savedData);
    setCommittedTrackerData(migratedCommitted || createFreshTrackerData());
    setLastGeneratedData(createFreshTrackerData());
    saveChatData(); // Persist upgraded format
}

function migrateLegacyTrackerFromSettings(settings) {
    if (!settings) return null;
    const hasLegacy =
        settings.userStats ||
        settings.inventoryV3 ||
        settings.skillsV2 ||
        settings.skills ||
        settings.skillsData ||
        settings.infoBoxData ||
        settings.charactersData ||
        settings.quests ||
        settings.questsV2;

    if (!hasLegacy) {
        return null;
    }

    return buildTrackerDataFromLegacy(settings);
}

function migrateLegacyTrackerFromChat(chatPayload) {
    if (!chatPayload) return null;
    // If legacy committed tracker exists in text form, prefer structured rebuild
    return buildTrackerDataFromLegacy(chatPayload);
}

function stripLegacyTrackerFieldsFromSettings() {
    delete extensionSettings.userStats;
    delete extensionSettings.inventoryV3;
    delete extensionSettings.skillsV2;
    delete extensionSettings.skillsData;
    delete extensionSettings.skills;
    delete extensionSettings.itemSkillLinks;
    delete extensionSettings.skillAbilityLinks;
    delete extensionSettings.infoBoxData;
    delete extensionSettings.charactersData;
    delete extensionSettings.quests;
    delete extensionSettings.questsV2;
    delete extensionSettings.classicStats;
    delete extensionSettings.level;
}

function buildTrackerDataFromLegacy(source) {
    const tracker = createFreshTrackerData();
    const trackerConfig = extensionSettings.trackerConfig;

    const legacyStats = source.userStats || {};
    const legacyAttributes = source.classicStats || {};
    const legacyQuests = source.quests || {};
    const legacyQuestsV2 = source.questsV2 || {};

    // Stats
    if (trackerConfig?.userStats?.customStats) {
        for (const stat of trackerConfig.userStats.customStats) {
            if (!stat?.enabled || !stat.name) continue;
            const raw = legacyStats[stat.id];
            tracker.stats[stat.name] = typeof raw === 'number' ? clampPercent(raw) : (stat.default ?? 100);
        }
    }

    // Status
    if (trackerConfig?.userStats?.statusSection?.enabled) {
        if (trackerConfig.userStats.statusSection.showMoodEmoji) {
            tracker.status.mood = legacyStats.mood || '😐';
        }
        const customFields = trackerConfig.userStats.statusSection.customFields || [];
        for (const field of customFields) {
            const value = legacyStats[field] ?? legacyStats.conditions ?? '';
            tracker.status.fields[field] = value || '';
        }
    }

    // Attributes
    if (trackerConfig?.userStats?.rpgAttributes) {
        tracker.attributes = {};
        for (const attr of trackerConfig.userStats.rpgAttributes) {
            if (!attr?.enabled || !attr.name) continue;
            const val = legacyAttributes[attr.id];
            tracker.attributes[attr.name] = typeof val === 'number' ? val : 10;
        }
    }

    // Level
    tracker.level = typeof source.level === 'number' ? source.level : 1;

    // Info box
    if (source.infoBoxData && typeof source.infoBoxData === 'object') {
        tracker.infoBox = { ...source.infoBoxData };
    }

    // Characters
    if (Array.isArray(source.charactersData)) {
        tracker.characters = [...source.charactersData];
    }

    // Inventory
    tracker.inventory = normalizeInventory(source);

    // Skills
    tracker.skills = normalizeSkills(source);

    // Quests
    tracker.quests = normalizeQuests(legacyQuestsV2, legacyQuests);

    return tracker;
}

function normalizeInventory(source) {
    if (source.inventoryV3) {
        const inv = source.inventoryV3;
        return {
            onPerson: normalizeItemList(inv.onPerson),
            stored: normalizeStored(inv.stored),
            assets: normalizeItemList(inv.assets),
            simplified: normalizeItemList(inv.simplified || inv.items)
        };
    }

    const legacyInventory = source.userStats?.inventory;
    if (legacyInventory) {
        const migration = migrateInventory(legacyInventory);
        const inv = migration.inventory;
        return {
            onPerson: normalizeItemList(inv.onPerson),
            stored: normalizeStored(inv.stored),
            assets: normalizeItemList(inv.assets),
            simplified: normalizeItemList(inv.items)
        };
    }

    return { onPerson: [], stored: {}, assets: [], simplified: [] };
}

function normalizeSkills(source) {
    if (source.skillsV2 && typeof source.skillsV2 === 'object') {
        const result = {};
        for (const [category, list] of Object.entries(source.skillsV2)) {
            result[category] = normalizeSkillList(list);
        }
        return result;
    }

    if (source.skillsData) {
        const result = {};
        for (const [category, items] of Object.entries(source.skillsData)) {
            result[category] = normalizeSkillList(parseItems(items));
        }
        return result;
    }

    if (source.skills?.categories) {
        const result = {};
        for (const [category, items] of Object.entries(source.skills.categories)) {
            result[category] = normalizeSkillList(parseItems(items));
        }
        return result;
    }

    return {};
}

function normalizeQuests(questsV2, legacyQuests) {
    if (questsV2 && typeof questsV2 === 'object') {
        return {
            main: questsV2.main || null,
            optional: Array.isArray(questsV2.optional) ? questsV2.optional : []
        };
    }

    const optional = Array.isArray(legacyQuests.optional)
        ? legacyQuests.optional.filter(Boolean).map(name => ({ name, description: '' }))
        : [];

    const mainQuestName = typeof legacyQuests.main === 'string' && legacyQuests.main !== 'None'
        ? legacyQuests.main
        : null;

    return {
        main: mainQuestName ? { name: mainQuestName, description: '' } : null,
        optional
    };
}

function normalizeItemList(items) {
    if (Array.isArray(items)) {
        return items.map(item => {
            if (typeof item === 'string') {
                return { name: item, description: '' };
            }
            if (item && typeof item === 'object') {
                return {
                    name: item.name || '',
                    description: item.description || '',
                    grantsSkill: item.grantsSkill
                };
            }
            return { name: '', description: '' };
        }).filter(item => item.name);
    }

    if (typeof items === 'string') {
        return parseItems(items).map(name => ({ name, description: '' }));
    }

    return [];
}

function normalizeStored(stored) {
    if (!stored || typeof stored !== 'object') {
        return {};
    }
    const result = {};
    for (const [location, list] of Object.entries(stored)) {
        result[location] = normalizeItemList(list);
    }
    return result;
}

function normalizeSkillList(list) {
    if (Array.isArray(list)) {
        return list.map(skill => {
            if (typeof skill === 'string') {
                return { name: skill, description: '' };
            }
            return {
                name: skill?.name || '',
                description: skill?.description || '',
                grantedBy: skill?.grantedBy
            };
        }).filter(skill => skill.name);
    }
    if (typeof list === 'string') {
        return parseItems(list).map(name => ({ name, description: '' }));
    }
    return [];
}

function clampPercent(value) {
    return Math.max(0, Math.min(100, value));
}

/**
 * Validates and repairs inventory structure to prevent corruption.
 * Ensures all v2 fields exist and are the correct type.
 *
 * @param {Object} inventory - Inventory object to validate
 * @param {string} source - Source of load ('settings' or 'chat') for logging
 * @private
 */
// Legacy inventory validation removed; tracker data now stored in structured form

/**
 * Migrates old settings format to new trackerConfig format
 * Converts statNames to customStats array and sets up default config
 * @returns {boolean} True if any migration was performed
 */
function migrateToTrackerConfig() {
    let migrated = false;

    // Initialize trackerConfig if it doesn't exist (shouldn't happen with deepMergeDefaults, but safety check)
    if (!extensionSettings.trackerConfig) {
        migrated = true;
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
        migrated = true;
        console.log('[RPG Companion] Migrated statNames to customStats array');
    }

    // Ensure rpgAttributes array exists (old configs may not have it)
    if (!extensionSettings.trackerConfig.userStats.rpgAttributes) {
        extensionSettings.trackerConfig.userStats.rpgAttributes = [
            { id: 'str', name: 'STR', description: '', enabled: true },
            { id: 'dex', name: 'DEX', description: '', enabled: true },
            { id: 'con', name: 'CON', description: '', enabled: true },
            { id: 'int', name: 'INT', description: '', enabled: true },
            { id: 'wis', name: 'WIS', description: '', enabled: true },
            { id: 'cha', name: 'CHA', description: '', enabled: true }
        ];
        migrated = true;
        console.log('[RPG Companion] Created default rpgAttributes array');
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
            migrated = true;
        }
    }

    return migrated;
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
    
    // Migrate customStats - add description and default if missing
    if (userStats.customStats) {
        for (const stat of userStats.customStats) {
            if (stat && typeof stat === 'object') {
                if (stat.description === undefined) {
                    stat.description = '';
                    migrated = true;
                }
                if (stat.default === undefined) {
                    // Arousal defaults to 0, everything else to 100
                    stat.default = (stat.id === 'arousal' || stat.name?.toLowerCase() === 'arousal') ? 0 : 100;
                    migrated = true;
                }
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
    
    // Migrate character stats - add description and default if missing
    if (extensionSettings.trackerConfig?.presentCharacters?.characterStats?.customStats) {
        for (const stat of extensionSettings.trackerConfig.presentCharacters.characterStats.customStats) {
            if (stat && typeof stat === 'object') {
                if (stat.description === undefined) {
                    stat.description = '';
                    migrated = true;
                }
                if (stat.default === undefined) {
                    stat.default = (stat.id === 'arousal' || stat.name?.toLowerCase() === 'arousal') ? 0 : 100;
                    migrated = true;
                }
            }
        }
    }
    
    if (migrated) {
        console.log('[RPG Companion] Stats/skills format migration complete');
    }
    
    return migrated;
}
