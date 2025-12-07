/**
 * Character Configuration Loader
 * Loads RPG Companion configuration from character creator notes
 * Supports per-character config storage in memory
 */

import { getContext } from '../../../../../../extensions.js';
import { saveSettingsDebounced } from '../../../../../../../script.js';
import { extensionSettings } from '../../core/state.js';

const STORAGE_KEY = 'rpg_companion_character_configs';

/**
 * In-memory storage for per-character configs.
 * Key: character avatar filename (unique identifier)
 * Value: partial extensionSettings object
 */
const characterConfigs = new Map();

/**
 * Gets the storage object from SillyTavern's extension_settings
 */
function getStorage() {
    const context = getContext();
    const ext = context.extension_settings || context.extensionSettings;
    if (!ext[STORAGE_KEY]) ext[STORAGE_KEY] = {};
    return ext[STORAGE_KEY];
}

/**
 * Tracks the last character ID to detect character changes
 */
let lastCharacterId = null;

/**
 * Deep merges source object into target object recursively.
 * Only updates keys that exist in source, preserving other target keys.
 * @param {Object} target - The target object to merge into
 * @param {Object} source - The source object with values to merge
 */
function deepMerge(target, source) {
    for (const key of Object.keys(source)) {
        const sourceValue = source[key];
        const targetValue = target[key];

        if (
            sourceValue !== null &&
            typeof sourceValue === 'object' &&
            !Array.isArray(sourceValue) &&
            targetValue !== null &&
            typeof targetValue === 'object' &&
            !Array.isArray(targetValue)
        ) {
            deepMerge(targetValue, sourceValue);
        } else {
            target[key] = sourceValue;
        }
    }
}

/**
 * Deep clones an object (simple JSON-based clone)
 * @param {Object} obj - Object to clone
 * @returns {Object} Cloned object
 */
function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

/**
 * Strips optional markdown-style code fences (```json or '''json) around config text.
 * @param {string} rawText - Text captured from creator notes
 * @returns {string} Unwrapped text ready for JSON parsing
 */
function unwrapConfigText(rawText) {
    const trimmed = rawText.trim();
    const fenceRegex = /^(```|''')(?:json|javascript|js)?\s*\n?([\s\S]*?)\n?\1$/i;
    const fenceMatch = trimmed.match(fenceRegex);
    if (fenceMatch) {
        return fenceMatch[2].trim();
    }
    return trimmed;
}

/**
 * Gets a unique identifier for a character
 * @param {Object} context - SillyTavern context
 * @returns {string|null} Character identifier or null
 */
function getCharacterKey(context) {
    const { characterId } = context;
    if (characterId === undefined || characterId === null) return null;
    
    const character = context.characters[characterId];
    // Use avatar as unique key since it's unique per character
    return character?.avatar || null;
}

/**
 * Saves the current extensionSettings for a character.
 * @param {string} characterKey - Unique character identifier
 */
function saveCharacterConfig(characterKey) {
    if (!characterKey) return;

    const config = deepClone(extensionSettings);
    characterConfigs.set(characterKey, config);
    
    // Persist to storage
    const storage = getStorage();
    storage[characterKey] = config;
    saveSettingsDebounced();
    
    console.log('[RPG Companion] Saved config for character:', characterKey);
}

/**
 * Loads config from memory for a character if available
 * @param {string} characterKey - Unique character identifier
 * @returns {boolean} True if config was loaded from memory
 */
function loadCharacterConfigFromMemory(characterKey) {
    if (!characterKey) return false;

    const storedConfig = characterConfigs.get(characterKey);
    if (!storedConfig) return false;

    deepMerge(extensionSettings, storedConfig);
    console.log('[RPG Companion] Loaded config from memory for character:', characterKey);
    return true;
}

/**
 * Reads RPG Companion configuration from <rpg_companion> tags in the character's creator_notes.
 * @param {Object} context - SillyTavern context
 * @returns {boolean} True if config was loaded from creator notes
 */
function loadConfigFromCreatorNotes(context) {
    const { characterId } = context;
    const character = context.characters[characterId];
    const creatorNotes = character?.data?.creator_notes;

    if (!creatorNotes) {
        console.log('[RPG Companion] No creator_notes found for character');
        return false;
    }

    const configRegex = /<rpg_companion>([\s\S]*?)<\/rpg_companion>/gi;
    const match = configRegex.exec(creatorNotes);

    if (!match) {
        console.log('[RPG Companion] No <rpg_companion> config found in creator_notes');
        return false;
    }

    const configText = unwrapConfigText(match[1]);
    
    try {
        const config = JSON.parse(configText);
        console.log('[RPG Companion] Loaded character config from creator notes:', config);
        deepMerge(extensionSettings, config);
        return true;
    } catch (error) {
        console.error('[RPG Companion] Failed to parse <rpg_companion> config as JSON:', error);
        return false;
    }
}

/**
 * Handles character change - saves previous config and loads new one.
 * Called when CHAT_CHANGED event fires.
 * @returns {boolean} True if config was loaded
 */
export function onCharacterConfigChange() {
    const context = getContext();
    const currentCharacterKey = getCharacterKey(context);

    // If per-character config is enabled, save the previous character's config
    if (extensionSettings.perCharacterConfig && lastCharacterId !== null) {
        const prevContext = { ...context, characterId: lastCharacterId };
        const prevCharacterKey = getCharacterKey(prevContext);
        if (prevCharacterKey && prevCharacterKey !== currentCharacterKey) {
            saveCharacterConfig(prevCharacterKey);
        }
    }

    // Update last character tracker
    lastCharacterId = context.characterId;

    if (currentCharacterKey === null) {
        console.log('[RPG Companion] No character selected, skipping config load');
        return false;
    }

    // Only load character-specific config if per-character config is enabled
    if (extensionSettings.perCharacterConfig) {
        // Try loading from memory first, fall back to creator notes
        if (loadCharacterConfigFromMemory(currentCharacterKey)) {
            return true;
        }
        return loadConfigFromCreatorNotes(context);
    }

    return false;
}

/**
 * Clears all stored character configs from memory and storage
 */
export function clearCharacterConfigs() {
    characterConfigs.clear();
    lastCharacterId = null;
    
    // Also clear from storage
    const storage = getStorage();
    for (const key of Object.keys(storage)) {
        delete storage[key];
    }
    saveSettingsDebounced();
    
    console.log('[RPG Companion] Cleared all character configs');
}

/**
 * Initializes character configs from persistent storage.
 * Call this once on extension load.
 */
export function initCharacterConfigs() {
    const storage = getStorage();
    for (const [key, config] of Object.entries(storage)) {
        characterConfigs.set(key, config);
    }
    console.log('[RPG Companion] Loaded', characterConfigs.size, 'character configs from storage');
}
