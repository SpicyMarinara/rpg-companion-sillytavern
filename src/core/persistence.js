/**
 * Core Persistence Module
 * Handles saving/loading extension settings and chat data
 */

import { saveSettingsDebounced, chat_metadata, saveChatDebounced, getCurrentChatId } from '../../../../../../script.js';
import { getContext } from '../../../../../extensions.js';
import {
    extensionSettings,
    lastGeneratedData,
    committedTrackerData,
    thoughtBasedExpressionPortraits,
    setExtensionSettings,
    updateExtensionSettings,
    setLastGeneratedData,
    setCommittedTrackerData,
    setThoughtBasedExpressionPortraits,
    clearThoughtBasedExpressionPortraits,
    FEATURE_FLAGS
} from './state.js';
import { migrateInventory } from '../utils/migration.js';
import { validateStoredInventory, cleanItemString } from '../utils/security.js';
import { migrateToV3JSON } from '../utils/jsonMigration.js';

const extensionName = 'third-party/rpg-companion-sillytavern';
const CURRENT_SETTINGS_VERSION = 5;

const DEFAULT_USER_STATS = {
    health: 100,
    satiety: 100,
    energy: 100,
    hygiene: 100,
    arousal: 0,
    mood: '😐',
    conditions: 'None',
    skills: [],
    inventory: {
        version: 2,
        onPerson: "None",
        clothing: "None",
        stored: {},
        assets: "None"
    }
};

const DEFAULT_EXTENSION_SETTINGS = cloneSerializable(extensionSettings);
DEFAULT_EXTENSION_SETTINGS.settingsVersion = CURRENT_SETTINGS_VERSION;

let hasDeferredChatDataSave = false;

function cloneSerializable(value) {
    if (value === undefined) {
        return undefined;
    }

    try {
        return structuredClone(value);
    } catch {
        return JSON.parse(JSON.stringify(value));
    }
}

function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function mergeWithDefaults(defaultValue, savedValue) {
    if (savedValue === undefined) {
        return cloneSerializable(defaultValue);
    }

    if (isPlainObject(defaultValue) && isPlainObject(savedValue)) {
        const merged = cloneSerializable(defaultValue);
        for (const [key, value] of Object.entries(savedValue)) {
            merged[key] = mergeWithDefaults(defaultValue[key], value);
        }
        return merged;
    }

    return cloneSerializable(savedValue);
}

function parseMaybeJSON(value) {
    if (typeof value !== 'string') {
        return value;
    }

    const trimmed = value.trim();
    if (!trimmed || (!trimmed.startsWith('{') && !trimmed.startsWith('['))) {
        return value;
    }

    try {
        return JSON.parse(trimmed);
    } catch {
        return value;
    }
}

function stringifyInventoryItems(items) {
    if (typeof items === 'string') {
        return items.trim() || 'None';
    }

    if (!Array.isArray(items)) {
        return 'None';
    }

    const text = items
        .map(item => {
            if (isPlainObject(item) && item.name) {
                const quantity = Number(item.quantity);
                return quantity > 1 ? `${quantity}x ${item.name}` : item.name;
            }
            return String(item || '').trim();
        })
        .filter(Boolean)
        .join(', ');

    return text || 'None';
}

function normalizeStoredInventory(stored) {
    if (!isPlainObject(stored)) {
        return {};
    }

    const normalized = {};
    for (const [location, items] of Object.entries(stored)) {
        normalized[location] = stringifyInventoryItems(items);
    }
    return normalized;
}

function normalizeInventoryValue(inventory) {
    const parsedInventory = parseMaybeJSON(inventory);

    if (isPlainObject(parsedInventory) && (
        Array.isArray(parsedInventory.onPerson)
        || Array.isArray(parsedInventory.clothing)
        || Array.isArray(parsedInventory.assets)
        || isPlainObject(parsedInventory.stored)
    )) {
        return {
            version: 2,
            onPerson: stringifyInventoryItems(parsedInventory.onPerson),
            clothing: stringifyInventoryItems(parsedInventory.clothing),
            stored: normalizeStoredInventory(parsedInventory.stored),
            assets: stringifyInventoryItems(parsedInventory.assets)
        };
    }

    const migrationResult = migrateInventory(parsedInventory);
    return mergeWithDefaults(DEFAULT_USER_STATS.inventory, migrationResult.inventory);
}

function normalizeUserStatsValue(userStats) {
    const parsedStats = parseMaybeJSON(userStats);
    const normalized = cloneSerializable(DEFAULT_USER_STATS);

    if (!isPlainObject(parsedStats)) {
        return normalized;
    }

    if (Array.isArray(parsedStats.stats)) {
        for (const stat of parsedStats.stats) {
            if (!stat || typeof stat !== 'object') continue;
            const id = stat.id || stat.name?.toLowerCase?.();
            if (id && stat.value !== undefined) {
                normalized[id] = stat.value;
            }
        }
    } else {
        for (const [key, value] of Object.entries(parsedStats)) {
            if (!['stats', 'status', 'inventory', 'quests'].includes(key) && value !== undefined) {
                normalized[key] = cloneSerializable(value);
            }
        }
    }

    if (isPlainObject(parsedStats.status)) {
        for (const [key, value] of Object.entries(parsedStats.status)) {
            if (value !== undefined) {
                normalized[key] = cloneSerializable(value);
            }
        }
    }

    if (parsedStats.inventory !== undefined) {
        normalized.inventory = normalizeInventoryValue(parsedStats.inventory);
    }

    for (const [key, defaultValue] of Object.entries(DEFAULT_USER_STATS)) {
        if (typeof defaultValue !== 'number') continue;

        const numericValue = Number(normalized[key]);
        normalized[key] = Number.isFinite(numericValue) ? numericValue : defaultValue;
    }

    return mergeWithDefaults(DEFAULT_USER_STATS, normalized);
}

function normalizeQuestValue(quest) {
    let value = quest;
    while (isPlainObject(value) && value.value !== undefined) {
        value = value.value;
    }

    if (typeof value === 'string') {
        return value.trim() || 'None';
    }

    if (isPlainObject(value)) {
        return value.title || value.description || JSON.stringify(value);
    }

    return value == null ? 'None' : String(value);
}

function normalizeQuestsValue(quests) {
    if (!isPlainObject(quests)) {
        return { main: 'None', optional: [] };
    }

    const optionalSource = Array.isArray(quests.optional)
        ? quests.optional
        : (Array.isArray(quests.active) ? quests.active : []);

    return {
        main: normalizeQuestValue(quests.main),
        optional: optionalSource
            .map(normalizeQuestValue)
            .filter(quest => quest && quest !== 'None')
    };
}

function normalizeSettings(savedSettings) {
    const sourceSettings = isPlainObject(savedSettings) ? savedSettings : {};
    const normalized = mergeWithDefaults(DEFAULT_EXTENSION_SETTINGS, sourceSettings);
    const savedVersion = Number(sourceSettings.settingsVersion);
    normalized.settingsVersion = Number.isFinite(savedVersion) && savedVersion > 0 ? savedVersion : 1;
    normalized.userStats = normalizeUserStatsValue(sourceSettings.userStats);

    const parsedUserStats = parseMaybeJSON(sourceSettings.userStats);
    if (sourceSettings.quests !== undefined) {
        normalized.quests = normalizeQuestsValue(sourceSettings.quests);
    } else if (isPlainObject(parsedUserStats) && parsedUserStats.quests !== undefined) {
        normalized.quests = normalizeQuestsValue(parsedUserStats.quests);
    }

    return {
        settings: normalized,
        changed: JSON.stringify(normalized) !== JSON.stringify(savedSettings)
    };
}

function isChatDataSaveReady() {
    return !!(
        chat_metadata
        && typeof chat_metadata === 'object'
        && chat_metadata.integrity
        && getCurrentChatId()
    );
}

function hasTrackerPayload(payload) {
    return !!(payload && typeof payload === 'object' && (
        payload.userStats
        || payload.infoBox
        || payload.characterThoughts
    ));
}

function getCurrentTrackerPayloadFromSwipeStore(store, preferredSwipeId = 0) {
    if (!store) {
        return null;
    }

    if (hasTrackerPayload(store)) {
        return store;
    }

    const preferredKey = String(preferredSwipeId);
    const preferredPayload = store[preferredKey] ?? store[preferredSwipeId];
    if (hasTrackerPayload(preferredPayload)) {
        return preferredPayload;
    }

    return null;
}

function getTrackerPayloadFromSwipeStore(store, preferredSwipeId = 0) {
    const currentPayload = getCurrentTrackerPayloadFromSwipeStore(store, preferredSwipeId);
    if (currentPayload) {
        return currentPayload;
    }

    if (!store || typeof store !== 'object') {
        return null;
    }

    const numericKeys = Object.keys(store)
        .filter(key => /^\d+$/.test(key))
        .sort((a, b) => Number(b) - Number(a));

    for (const key of numericKeys) {
        const payload = store[key];
        if (hasTrackerPayload(payload)) {
            return payload;
        }
    }

    for (const payload of Object.values(store)) {
        if (hasTrackerPayload(payload)) {
            return payload;
        }
    }

    return null;
}

function ensureTrackerPayloadSlot(store, swipeId = 0) {
    if (!store || typeof store !== 'object' || Array.isArray(store)) {
        return null;
    }

    if (hasTrackerPayload(store)) {
        return store;
    }

    if (!store[swipeId] || typeof store[swipeId] !== 'object' || Array.isArray(store[swipeId])) {
        store[swipeId] = {};
    }

    return store[swipeId];
}

function ensureSwipeInfoEntry(message, swipeId = 0) {
    if (!Array.isArray(message?.swipe_info)) {
        return null;
    }

    if (!message.swipe_info[swipeId] || typeof message.swipe_info[swipeId] !== 'object') {
        message.swipe_info[swipeId] = {
            send_date: message.send_date,
            gen_started: message.gen_started,
            gen_finished: message.gen_finished,
            extra: {}
        };
    }

    if (!message.swipe_info[swipeId].extra || typeof message.swipe_info[swipeId].extra !== 'object') {
        message.swipe_info[swipeId].extra = {};
    }

    return message.swipe_info[swipeId];
}

export function getCurrentMessageSwipeTrackerData(message) {
    if (!message || message.is_user) {
        return null;
    }

    const swipeId = Number(message.swipe_id ?? 0);

    const preferredSources = [
        message.extra?.rpg_companion_swipes,
        message.swipe_info?.[swipeId]?.extra?.rpg_companion_swipes
    ];

    for (const source of preferredSources) {
        const payload = getCurrentTrackerPayloadFromSwipeStore(source, swipeId);
        if (payload) {
            return payload;
        }
    }

    return null;
}

export function getMessageSwipeTrackerData(message) {
    if (!message || message.is_user) {
        return null;
    }

    const swipeId = Number(message.swipe_id ?? 0);
    const currentPayload = getCurrentMessageSwipeTrackerData(message);
    if (currentPayload) {
        return currentPayload;
    }

    const preferredSources = [
        message.extra?.rpg_companion_swipes,
        message.swipe_info?.[swipeId]?.extra?.rpg_companion_swipes
    ];

    for (const source of preferredSources) {
        const payload = getTrackerPayloadFromSwipeStore(source, swipeId);
        if (payload) {
            return payload;
        }
    }

    if (Array.isArray(message.swipe_info)) {
        for (let i = message.swipe_info.length - 1; i >= 0; i--) {
            const payload = getTrackerPayloadFromSwipeStore(message.swipe_info[i]?.extra?.rpg_companion_swipes, swipeId);
            if (payload) {
                return payload;
            }
        }
    }

    return null;
}

export function getLatestTrackerDataFromChat(chatMessages) {
    if (!Array.isArray(chatMessages)) {
        return null;
    }

    for (let i = chatMessages.length - 1; i >= 0; i--) {
        const message = chatMessages[i];
        if (message?.is_user) continue;

        const swipeData = getCurrentMessageSwipeTrackerData(message);
        if (!swipeData) continue;

        return {
            userStats: swipeData.userStats || null,
            infoBox: swipeData.infoBox || null,
            characterThoughts: typeof swipeData.characterThoughts === 'object'
                ? JSON.stringify(swipeData.characterThoughts, null, 2)
                : (swipeData.characterThoughts || null)
        };
    }

    return null;
}

export function restoreLatestTrackerStateFromChat(chatMessages) {
    const latestData = getLatestTrackerDataFromChat(chatMessages);
    if (!latestData) {
        return false;
    }

    setLastGeneratedData({
        userStats: latestData.userStats || null,
        infoBox: latestData.infoBox || null,
        characterThoughts: latestData.characterThoughts || null,
        html: lastGeneratedData.html || null
    });

    setCommittedTrackerData({
        userStats: latestData.userStats || committedTrackerData.userStats || null,
        infoBox: latestData.infoBox || committedTrackerData.infoBox || null,
        characterThoughts: latestData.characterThoughts || committedTrackerData.characterThoughts || null
    });

    return true;
}

export function setMessageSwipeTrackerData(message, swipeId = 0, trackerData = {}) {
    if (!message || message.is_user || !trackerData || typeof trackerData !== 'object') {
        return null;
    }

    if (!message.extra || typeof message.extra !== 'object') {
        message.extra = {};
    }
    if (!message.extra.rpg_companion_swipes || typeof message.extra.rpg_companion_swipes !== 'object' || Array.isArray(message.extra.rpg_companion_swipes)) {
        message.extra.rpg_companion_swipes = {};
    }

    const extraPayload = ensureTrackerPayloadSlot(message.extra.rpg_companion_swipes, swipeId);
    if (extraPayload) {
        Object.assign(extraPayload, trackerData);
    }

    const swipeInfoEntry = ensureSwipeInfoEntry(message, swipeId);
    if (swipeInfoEntry) {
        if (!swipeInfoEntry.extra.rpg_companion_swipes || typeof swipeInfoEntry.extra.rpg_companion_swipes !== 'object' || Array.isArray(swipeInfoEntry.extra.rpg_companion_swipes)) {
            swipeInfoEntry.extra.rpg_companion_swipes = {};
        }

        const swipePayload = ensureTrackerPayloadSlot(swipeInfoEntry.extra.rpg_companion_swipes, swipeId);
        if (swipePayload) {
            Object.assign(swipePayload, trackerData);
        }
    }

    return extraPayload;
}

export function setMessageSwipeTrackerField(message, swipeId = 0, field, value) {
    if (!field) {
        return null;
    }

    return setMessageSwipeTrackerData(message, swipeId, { [field]: value });
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

    // Check for required top-level properties
    if (typeof settings.enabled !== 'boolean' ||
        typeof settings.autoUpdate !== 'boolean' ||
        !settings.userStats || typeof settings.userStats !== 'object' ||
        Array.isArray(settings.userStats)) {
        console.warn('[RPG Companion] Settings validation failed: missing required properties');
        return false;
    }

    // Validate userStats structure
    const stats = settings.userStats;
    if (typeof stats.health !== 'number' ||
        typeof stats.satiety !== 'number' ||
        typeof stats.energy !== 'number' ||
        !stats.inventory || typeof stats.inventory !== 'object') {
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
            const normalizedResult = normalizeSettings(savedSettings);
            const normalizedSettings = normalizedResult.settings;

            // Validate loaded settings after schema repair/normalization
            if (!validateSettings(normalizedSettings)) {
                console.warn('[RPG Companion] Loaded settings failed validation, using defaults');
                console.warn('[RPG Companion] Invalid settings:', normalizedSettings);
                // Save valid defaults to replace corrupt data
                saveSettings();
                return;
            }

            updateExtensionSettings(normalizedSettings);

            // Perform settings migrations based on version
            const currentVersion = extensionSettings.settingsVersion || 1;
            let settingsChanged = normalizedResult.changed;

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

            // Migration to version 4: Enable FAB widgets by default
            if (currentVersion < 4) {
                // console.log('[RPG Companion] Migrating settings to version 4 (enabling FAB widgets)');
                if (!extensionSettings.mobileFabWidgets) {
                    extensionSettings.mobileFabWidgets = {};
                }
                extensionSettings.mobileFabWidgets.enabled = true;
                extensionSettings.mobileFabWidgets.weatherIcon = { enabled: true };
                extensionSettings.mobileFabWidgets.weatherDesc = { enabled: true };
                extensionSettings.mobileFabWidgets.clock = { enabled: true };
                extensionSettings.mobileFabWidgets.date = { enabled: true };
                extensionSettings.mobileFabWidgets.location = { enabled: true };
                extensionSettings.mobileFabWidgets.stats = { enabled: true };
                extensionSettings.mobileFabWidgets.attributes = { enabled: true };
                extensionSettings.settingsVersion = 4;
                settingsChanged = true;
            }

            // Migration to version 5: Add opacity properties for all colors
            if (currentVersion < 5) {
                // console.log('[RPG Companion] Migrating settings to version 5 (adding color opacity)');
                if (!extensionSettings.customColors) {
                    extensionSettings.customColors = {};
                }
                if (extensionSettings.customColors.bgOpacity === undefined) extensionSettings.customColors.bgOpacity = 100;
                if (extensionSettings.customColors.accentOpacity === undefined) extensionSettings.customColors.accentOpacity = 100;
                if (extensionSettings.customColors.textOpacity === undefined) extensionSettings.customColors.textOpacity = 100;
                if (extensionSettings.customColors.highlightOpacity === undefined) extensionSettings.customColors.highlightOpacity = 100;
                if (extensionSettings.statBarColorLowOpacity === undefined) extensionSettings.statBarColorLowOpacity = 100;
                if (extensionSettings.statBarColorHighOpacity === undefined) extensionSettings.statBarColorHighOpacity = 100;
                extensionSettings.settingsVersion = 5;
                settingsChanged = true;
            }

            // Normalize additive settings without introducing another schema bump.
            if (!extensionSettings.thoughtsInChatStyle) {
                extensionSettings.thoughtsInChatStyle = 'corner';
                settingsChanged = true;
            }

            if (extensionSettings.showAlternatePresentCharactersPanel === undefined) {
                extensionSettings.showAlternatePresentCharactersPanel = false;
                settingsChanged = true;
            }

            if (extensionSettings.hideDefaultExpressionDisplay === undefined) {
                extensionSettings.hideDefaultExpressionDisplay = false;
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

        // Initialize custom status fields
        initializeCustomStatusFields();

        // Ensure all stats have maxValue (for number display mode)
        ensureStatsHaveMaxValue();
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
    if (!isChatDataSaveReady()) {
        hasDeferredChatDataSave = true;
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
        thoughtBasedExpressionPortraits: thoughtBasedExpressionPortraits,
        timestamp: Date.now()
    };

    saveChatDebounced();
}

export function flushDeferredChatDataSave() {
    if (!hasDeferredChatDataSave || !isChatDataSaveReady()) {
        return false;
    }

    hasDeferredChatDataSave = false;
    saveChatData();
    return true;
}

/**
 * Mirrors a tracker data entry into message.swipe_info so it survives page reloads.
 * ST only serializes swipe_info to disk; message.extra is in-memory only.
 * Guard: skips silently if swipe_info[swipeId] doesn't exist yet
 *
 * @param {Object} message  - The chat message object
 * @param {number} swipeId  - The swipe index to mirror into
 * @param {Object} swipeEntry - { userStats, infoBox, characterThoughts }
 */
export function mirrorToSwipeInfo(message, swipeId, swipeEntry) {
    if (!message.swipe_info || !message.swipe_info[swipeId]) return;
    if (!message.swipe_info[swipeId].extra) {
        message.swipe_info[swipeId].extra = {};
    }
    if (!message.swipe_info[swipeId].extra.rpg_companion_swipes) {
        message.swipe_info[swipeId].extra.rpg_companion_swipes = {};
    }
    message.swipe_info[swipeId].extra.rpg_companion_swipes[swipeId] = swipeEntry;
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
        if (!message.is_user && !message.is_system) {
            // Found last assistant message - update its swipe data
            if (!message.extra) {
                message.extra = {};
            }
            if (!message.extra.rpg_companion_swipes) {
                message.extra.rpg_companion_swipes = {};
            }

            const swipeId = message.swipe_id || 0;
            setMessageSwipeTrackerData(message, swipeId, {
                userStats: lastGeneratedData.userStats,
                infoBox: lastGeneratedData.infoBox,
                characterThoughts: lastGeneratedData.characterThoughts
            });

            // console.log('[RPG Companion] Updated message swipe data after user edit');
            break;
        }
    }
}

/**
 * Reads RPG tracker data for a specific swipe from a message.
 * Checks message.extra first (in-memory, current session), then message.swipe_info
 * (serialized by SillyTavern on save, available after page reload).
 *
 * @param {Object} message - The chat message object
 * @param {number} swipeId - The swipe index to read
 * @returns {{userStats, infoBox, characterThoughts}|null} The swipe data or null
 */
export function getSwipeData(message, swipeId) {
    // Primary: in-memory extra (current session or after a recent write)
    const fromExtra = message.extra?.rpg_companion_swipes?.[swipeId];
    if (fromExtra) return fromExtra;

    // Fallback: swipe_info (populated by ST when loading from disk)
    const fromSwipeInfo = message.swipe_info?.[swipeId]?.extra?.rpg_companion_swipes?.[swipeId];
    if (fromSwipeInfo) return fromSwipeInfo;

    return null;
}

/**
 * Resolve active swipe index for a message.
 * Falls back to message.swipe_id, but prefers exact match against current
 * message text when available to avoid stale swipe_id during event timing races.
 *
 * @param {Object} message - Assistant message object
 * @returns {number} Active swipe index
 */
function resolveActiveSwipeId(message) {
    const fallbackSwipeId = Number(message?.swipe_id ?? 0);
    const swipes = Array.isArray(message?.swipes) ? message.swipes : null;

    if (!swipes || swipes.length === 0) {
        return Math.max(0, fallbackSwipeId);
    }

    const currentText = typeof message?.mes === 'string' ? message.mes : '';
    if (currentText) {
        for (let i = swipes.length - 1; i >= 0; i--) {
            if (typeof swipes[i] === 'string' && swipes[i] === currentText) {
                return i;
            }
        }
    }

    if (fallbackSwipeId < 0) {
        return 0;
    }

    return Math.min(fallbackSwipeId, swipes.length - 1);
}

/**
 * Commits tracker data from the assistant message immediately before currentMessageIndex.
 * Walks backward through the chat skipping the current message, user messages, and system
 * messages until it finds the prior assistant message, then loads its active swipe data.
 * If no prior assistant message exists or exists without a tracker state, nulls out all fields so
 * the AI generates from an empty context rather than a ghost state.
 *
 * @param {number} currentMessageIndex - Index of the message to start searching before
 */
export function commitTrackerDataFromPriorMessage(currentMessageIndex) {
    const chat = getContext().chat;
    if (!chat || chat.length === 0) {
        committedTrackerData.userStats = null;
        committedTrackerData.infoBox = null;
        committedTrackerData.characterThoughts = null;
        return;
    }


    for (let i = currentMessageIndex - 1; i >= 0; i--) {
        const message = chat[i];
        if (message.is_user || message.is_system) continue;

        // Found the prior assistant message — commit its active swipe data
        const swipeId = resolveActiveSwipeId(message);
        const swipeData = getSwipeData(message, swipeId);

        if (!swipeData) {
            // Keep searching backward for a valid state if this assistant message has no data
            continue;
        }

        committedTrackerData.userStats = swipeData.userStats || null;
        committedTrackerData.infoBox = swipeData.infoBox || null;
        const rawCharacterThoughts = swipeData.characterThoughts;
        committedTrackerData.characterThoughts =
            rawCharacterThoughts == null
                ? null
                : (typeof rawCharacterThoughts === 'string'
                    ? rawCharacterThoughts
                    : JSON.stringify(rawCharacterThoughts));

        return;
    }

    // No prior assistant message found — use empty context
    committedTrackerData.userStats = null;
    committedTrackerData.infoBox = null;
    committedTrackerData.characterThoughts = null;
}

/**
 * Populates a message's current swipe slot with tracker data inherited from the
 * nearest prior assistant message, when no tracker data has been generated for
 * this swipe yet (e.g. auto-update is disabled).
 *
 * This ensures that commitTrackerDataFromPriorMessage can always find a tracker
 * state to commit when the user sends the next message, rather than nulling
 * everything out and resetting the tracker display to empty.
 *
 * Does nothing if the current swipe already has its own tracker data.
 *
 * @param {Object} message - The assistant message object to inherit into
 * @param {number} messageIndex - Index of that message in chat
 * @returns {boolean} True if inheritance was written, false otherwise
 */
export function inheritSwipeDataFromPriorMessage(message, messageIndex) {
    const chat = getContext().chat;
    if (!chat) return false;

    const currentSwipeId = message.swipe_id || 0;

    // Don't overwrite if this swipe already has its own tracker data.
    if (getSwipeData(message, currentSwipeId)) return false;

    // Walk backward to find the nearest prior assistant message with swipe data.
    for (let i = messageIndex - 1; i >= 0; i--) {
        const msg = chat[i];
        if (msg.is_user || msg.is_system) continue;

        const swipeId = resolveActiveSwipeId(msg);
        const swipeData = getSwipeData(msg, swipeId);
        if (!swipeData) continue; // No data on this assistant message; keep searching further back

        // Write inherited data into this swipe slot.
        if (!message.extra) message.extra = {};
        if (!message.extra.rpg_companion_swipes) message.extra.rpg_companion_swipes = {};

        const inherited = {
            userStats: swipeData.userStats,
            infoBox: swipeData.infoBox,
            characterThoughts: swipeData.characterThoughts
        };
        message.extra.rpg_companion_swipes[currentSwipeId] = inherited;
        mirrorToSwipeInfo(message, currentSwipeId, inherited);
        // console.log('[RPG Companion] Inherited tracker data from chat[' + i + '] into current swipe slot', currentSwipeId);
        return true;
    }
    return false;
}

/**
 * Loads RPG data from the current chat's metadata.
 * Automatically migrates v1 inventory to v2 format if needed.
 */
export function loadChatData() {
    const savedData = chat_metadata?.rpg_companion;

    if (!savedData) {
        // Reset to defaults if no metadata exists, then try to rebuild from message swipe data below.
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
                    clothing: "None",
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
        clearThoughtBasedExpressionPortraits();
    }

    // Restore stats
    if (savedData?.userStats) {
        extensionSettings.userStats = { ...savedData.userStats };
    }

    // Restore classic stats
    if (savedData?.classicStats) {
        extensionSettings.classicStats = { ...savedData.classicStats };
    }

    // Restore quests
    if (savedData?.quests) {
        extensionSettings.quests = { ...savedData.quests };
    } else {
        // Initialize with defaults if not present
        extensionSettings.quests = {
            main: "None",
            optional: []
        };
    }

    // Restore committed tracker data first
    if (savedData?.committedTrackerData) {
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
    if (savedData?.lastGeneratedData) {
        // console.log('[RPG Companion] 📥 loadChatData restoring lastGeneratedData');
        setLastGeneratedData({ ...savedData.lastGeneratedData });
    } else {
        // console.log('[RPG Companion] ⚠️ No lastGeneratedData found in save');
    }

    if (savedData?.thoughtBasedExpressionPortraits && typeof savedData.thoughtBasedExpressionPortraits === 'object') {
        setThoughtBasedExpressionPortraits(savedData.thoughtBasedExpressionPortraits);
    } else {
        clearThoughtBasedExpressionPortraits();
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


    // Sync display data from the latest assistant message's stored swipe payload.
    // This is more reliable than chat metadata alone on chat re-entry because the
    // latest rendered swipe data may exist on the message even if the debounced
    // metadata save did not flush yet.
    try {
        const chatContext = getContext();
        const chatMessages = chatContext?.chat;
        restoreLatestTrackerStateFromChat(chatMessages);
    } catch (e) {
        console.warn('[RPG Companion] Per-message data sync skipped:', e.message);
    }

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
            clothing: "None",
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

    // Validate clothing field
    if (typeof inventory.clothing !== 'string') {
        console.warn(`[RPG Companion] Invalid clothing from ${source}, resetting to "None"`);
        inventory.clothing = "None";
        needsSave = true;
    } else {
        const cleanedClothing = cleanItemString(inventory.clothing);
        if (cleanedClothing !== inventory.clothing) {
            console.warn(`[RPG Companion] Cleaned corrupted items from clothing inventory (${source})`);
            inventory.clothing = cleanedClothing;
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
                    { id: 'internalMonologue', label: 'Internal Monologue', enabled: true, placeholder: 'Internal Monologue (in first person from character\'s POV, up to three sentences long)' }
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
                    description: thoughtsField?.placeholder || 'Internal Monologue (in first person from character\'s POV, up to three sentences long)'
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
                description: 'Internal Monologue (in first person from character\'s POV, up to three sentences long)'
            };
        }
    }
}

// ============================================================================
// Preset Management Functions
// ============================================================================

/**
 * Gets the entity key for the current character or group
 * For characters, the key is only used for the settings-map fallback (associations saved by older versions);
 * new character associations are stored in the character card (see getCardPresetId).
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
 * Initializes custom status fields in userStats based on trackerConfig
 * Ensures all defined custom status fields have a value in the userStats object
 */
function initializeCustomStatusFields() {
    const customFields = extensionSettings.trackerConfig?.userStats?.statusSection?.customFields || [];

    // Initialize each custom field if it doesn't exist
    for (const fieldName of customFields) {
        const fieldKey = fieldName.toLowerCase();
        if (extensionSettings.userStats[fieldKey] === undefined) {
            extensionSettings.userStats[fieldKey] = 'None';
            // console.log(`[RPG Companion] Initialized custom status field: ${fieldKey}`);
        }
    }
}

/**
 * Ensures all custom stats have a maxValue property
 * This migration supports the number display mode feature
 */
function ensureStatsHaveMaxValue() {
    const customStats = extensionSettings.trackerConfig?.userStats?.customStats || [];

    for (const stat of customStats) {
        if (stat && stat.maxValue === undefined) {
            stat.maxValue = 100; // Default to 100 for backward compatibility
            // console.log(`[RPG Companion] Added maxValue to stat: ${stat.id || stat.name}`);
        }
    }

    // Ensure statsDisplayMode is set (default to percentage)
    if (extensionSettings.trackerConfig?.userStats &&
        extensionSettings.trackerConfig.userStats.statsDisplayMode === undefined) {
        extensionSettings.trackerConfig.userStats.statsDisplayMode = 'percentage';
        // console.log('[RPG Companion] Initialized statsDisplayMode to percentage');
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
        trackerConfig: JSON.parse(JSON.stringify(extensionSettings.trackerConfig)),
        historyPersistence: extensionSettings.historyPersistence
            ? JSON.parse(JSON.stringify(extensionSettings.historyPersistence))
            : null
    };
    // Also set it as the active preset so edits go to the new preset
    extensionSettings.presetManager.activePresetId = presetId;
    saveSettings();
    // console.log(`[RPG Companion] Created preset "${name}" with ID ${presetId}`);
    return presetId;
}

/**
 * Saves the current trackerConfig and historyPersistence to the specified preset
 * @param {string} presetId - The preset ID to save to
 */
export function saveToPreset(presetId) {
    const preset = extensionSettings.presetManager.presets[presetId];
    if (preset) {
        preset.trackerConfig = JSON.parse(JSON.stringify(extensionSettings.trackerConfig));
        preset.historyPersistence = extensionSettings.historyPersistence
            ? JSON.parse(JSON.stringify(extensionSettings.historyPersistence))
            : null;
        saveSettings();
        // console.log(`[RPG Companion] Saved current config to preset "${preset.name}"`);
    }
}

/**
 * Loads a preset's trackerConfig and historyPersistence as the active configuration
 * @param {string} presetId - The preset ID to load
 * @returns {boolean} True if loaded successfully, false otherwise
 */
export function loadPreset(presetId) {
    const preset = extensionSettings.presetManager.presets[presetId];
    if (preset && preset.trackerConfig) {
        extensionSettings.trackerConfig = JSON.parse(JSON.stringify(preset.trackerConfig));
        // Load historyPersistence if present, otherwise use defaults
        if (preset.historyPersistence) {
            extensionSettings.historyPersistence = JSON.parse(JSON.stringify(preset.historyPersistence));
        } else {
            // Default values for presets that don't have historyPersistence yet
            extensionSettings.historyPersistence = {
                enabled: false,
                messageCount: 5,
                injectionPosition: 'assistant_message_end',
                contextPreamble: ''
            };
        }
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
    // (settings map only; a card that still references this preset counts as "no association")
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

/** Key of this extension's data in the character card (Character Card V2 `data.extensions`). */
const CARD_EXTENSION_KEY = 'rpg_companion';

/**
 * Reads the preset association stored in the current character's card.
 * Character associations used to be stored only in `characterAssociations` under "char_{id}", where the id is the
 * index into SillyTavern's character list. That index shifts when characters are imported, created or deleted, so
 * new associations are stored in the card, which stays with the character (also when it is renamed).
 * @returns {string|null|undefined} The preset ID, null for "explicitly no association", or undefined when the card
 *   holds nothing (then the old index-based entry is used as a fallback)
 */
function getCardPresetId() {
    const context = getContext();
    if (context.groupId || context.characterId === undefined || context.characterId === null) {
        return undefined;
    }
    const data = context.characters?.[context.characterId]?.data?.extensions?.[CARD_EXTENSION_KEY];
    if (!data || typeof data !== 'object' || !('presetId' in data)) {
        return undefined;
    }
    return typeof data.presetId === 'string' ? data.presetId : null;
}

/**
 * Stores the preset association in the current character's card.
 * @param {string|null} presetId - The preset ID, or null for "no association"
 * @returns {boolean} False for groups, without a character, or when SillyTavern has no writeExtensionField
 */
function writeCardPresetId(presetId) {
    const context = getContext();
    const characterId = context.characterId;
    if (context.groupId || characterId === undefined || characterId === null || !context.characters?.[characterId]
        || typeof context.writeExtensionField !== 'function') {
        return false;
    }
    // Updates the character in memory right away, then saves the card on the server
    Promise.resolve(context.writeExtensionField(characterId, CARD_EXTENSION_KEY, { presetId })).catch(error => {
        console.error('[RPG Companion] Failed to save the preset association in the character card:', error);
        toastr.error('Failed to save the preset association in the character card.');
    });
    return true;
}

/**
 * Associates the current preset with the current character/group
 */
export function associatePresetWithCurrentEntity() {
    const entityKey = getCurrentEntityKey();
    const activePresetId = extensionSettings.presetManager.activePresetId;

    if (entityKey && activePresetId) {
        if (writeCardPresetId(activePresetId)) {
            // The card takes precedence; drop the old index-based entry so no other character picks it up later
            delete extensionSettings.presetManager.characterAssociations[entityKey];
        } else {
            // Settings map: groups, and SillyTavern versions without writeExtensionField
            extensionSettings.presetManager.characterAssociations[entityKey] = activePresetId;
        }
        saveSettings();
        // console.log(`[RPG Companion] Associated preset ${activePresetId} with ${entityKey}`);
    }
}

/**
 * Removes the preset association for the current character/group
 */
export function removePresetAssociationForCurrentEntity() {
    const entityKey = getCurrentEntityKey();
    if (!entityKey) return;
    // "No association" is stored in the card too, so the old index-based fallback no longer applies
    writeCardPresetId(null);
    // Settings map: the group association, or a character association saved by an older version
    if (extensionSettings.presetManager.characterAssociations[entityKey]) {
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
    const cardPresetId = getCardPresetId();
    if (cardPresetId !== undefined) {
        // The card decides. An unknown preset (deleted, or a card shared from another installation) means no association.
        return cardPresetId && extensionSettings.presetManager.presets[cardPresetId] ? cardPresetId : null;
    }

    // Fallback: settings map. Used for groups, and for character associations saved by older versions
    // (index-based "char_{id}" key) as long as the card holds nothing.
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
    if (getCardPresetId() !== undefined) {
        return getPresetForCurrentEntity() !== null;
    }

    // Fallback: settings map (groups, and character associations saved by older versions)
    const entityKey = getCurrentEntityKey();
    return entityKey && extensionSettings.presetManager.characterAssociations[entityKey] !== undefined;
}

/**
 * Checks if the current character/group is associated with the currently active preset
 * @returns {boolean} True if the current entity is associated with the active preset
 */
export function isAssociatedWithCurrentPreset() {
    const entityKey = getCurrentEntityKey();
    const activePresetId = extensionSettings.presetManager?.activePresetId;
    if (!entityKey || !activePresetId) return false;
    return getPresetForCurrentEntity() === activePresetId;
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
            // Preset was deleted, remove the stale settings-map entry (group, or character association saved by an
            // older version). Card values never get here: an unknown preset in the card already counts as no association.
            delete extensionSettings.presetManager.characterAssociations[getCurrentEntityKey()];
            saveSettings();
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
