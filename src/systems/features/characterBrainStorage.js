/**
 * Character Brain Storage Module
 * Handles persistence of character brain configurations
 *
 * Storage locations:
 * - localStorage: API keys (secure, not synced)
 * - chat_metadata: Per-chat brain states
 * - extension_settings: Global brain configurations
 */

import { chat_metadata, saveChatDebounced } from '../../../../../../../script.js';
import { getContext } from '../../../../../../extensions.js';
import { extensionSettings } from '../../core/state.js';
import { saveSettings } from '../../core/persistence.js';

const STORAGE_KEY = 'rpg_companion_character_brains';
const PRESETS_KEY = 'rpg_companion_brain_presets';

/**
 * Loads all character brain configurations from storage
 * @returns {Object} Map of character ID to brain config
 */
export function loadCharacterBrains() {
    try {
        // First, try to load from extension settings (persistent across sessions)
        if (extensionSettings.characterBrains && typeof extensionSettings.characterBrains === 'object') {
            return { ...extensionSettings.characterBrains };
        }

        // Fallback to localStorage for migration
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            // Migrate to extension settings
            extensionSettings.characterBrains = parsed;
            saveSettings();
            // console.log('[Character Brain Storage] Migrated from localStorage to extension settings');
            return parsed;
        }
    } catch (error) {
        console.error('[Character Brain Storage] Failed to load character brains:', error);
    }

    return {};
}

/**
 * Saves all character brain configurations
 * @param {Object} brains - Map of character ID to brain config
 */
export function saveCharacterBrains(brains) {
    try {
        extensionSettings.characterBrains = { ...brains };
        saveSettings();
    } catch (error) {
        console.error('[Character Brain Storage] Failed to save character brains:', error);
    }
}

/**
 * Gets a stored character brain configuration
 * @param {string} characterId - Character ID
 * @returns {Object|null} Brain config or null
 */
export function getStoredCharacterBrain(characterId) {
    if (!characterId) return null;

    const brains = loadCharacterBrains();
    return brains[characterId] || null;
}

/**
 * Sets a character brain configuration in storage
 * @param {string} characterId - Character ID
 * @param {Object} config - Brain configuration
 */
export function setStoredCharacterBrain(characterId, config) {
    if (!characterId) return;

    const brains = loadCharacterBrains();
    brains[characterId] = {
        ...config,
        lastModified: Date.now()
    };

    saveCharacterBrains(brains);
}

/**
 * Removes a character brain configuration from storage
 * @param {string} characterId - Character ID
 */
export function removeStoredCharacterBrain(characterId) {
    if (!characterId) return;

    const brains = loadCharacterBrains();
    if (brains[characterId]) {
        delete brains[characterId];
        saveCharacterBrains(brains);
    }
}

/**
 * Gets all stored character brain configurations
 * @returns {Object} Map of character ID to brain config
 */
export function getAllStoredCharacterBrains() {
    return loadCharacterBrains();
}

/**
 * Saves character brain state to chat metadata
 * This allows per-chat overrides of brain configurations
 * @param {string} characterId - Character ID
 * @param {Object} state - Brain state (e.g., conversation context)
 */
export function saveBrainStateToChatMetadata(characterId, state) {
    if (!chat_metadata || !characterId) return;

    if (!chat_metadata.rpg_companion_character_brains) {
        chat_metadata.rpg_companion_character_brains = {};
    }

    chat_metadata.rpg_companion_character_brains[characterId] = {
        ...state,
        savedAt: Date.now()
    };

    saveChatDebounced();
}

/**
 * Loads character brain state from chat metadata
 * @param {string} characterId - Character ID
 * @returns {Object|null} Brain state or null
 */
export function loadBrainStateFromChatMetadata(characterId) {
    if (!chat_metadata || !characterId) return null;

    return chat_metadata.rpg_companion_character_brains?.[characterId] || null;
}

/**
 * Clears all brain states from current chat metadata
 */
export function clearChatBrainStates() {
    if (!chat_metadata) return;

    chat_metadata.rpg_companion_character_brains = {};
    saveChatDebounced();
}

// =============================================================================
// Brain Presets Storage
// =============================================================================

/**
 * Loads all brain presets from storage
 * @returns {Object} Map of preset ID to preset data
 */
export function loadBrainPresets() {
    try {
        if (extensionSettings.characterBrainPresets && typeof extensionSettings.characterBrainPresets === 'object') {
            return { ...extensionSettings.characterBrainPresets };
        }

        // Fallback to localStorage for migration
        const stored = localStorage.getItem(PRESETS_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            extensionSettings.characterBrainPresets = parsed;
            saveSettings();
            return parsed;
        }
    } catch (error) {
        console.error('[Character Brain Storage] Failed to load presets:', error);
    }

    return {};
}

/**
 * Saves all brain presets
 * @param {Object} presets - Map of preset ID to preset data
 */
export function saveBrainPresets(presets) {
    try {
        extensionSettings.characterBrainPresets = { ...presets };
        saveSettings();
    } catch (error) {
        console.error('[Character Brain Storage] Failed to save presets:', error);
    }
}

/**
 * Gets a brain preset by ID
 * @param {string} presetId - Preset ID
 * @returns {Object|null} Preset data or null
 */
export function getBrainPreset(presetId) {
    const presets = loadBrainPresets();
    return presets[presetId] || null;
}

/**
 * Saves a brain preset
 * @param {string} presetId - Preset ID
 * @param {Object} preset - Preset data
 */
export function saveBrainPreset(presetId, preset) {
    const presets = loadBrainPresets();
    presets[presetId] = {
        ...preset,
        lastModified: Date.now()
    };
    saveBrainPresets(presets);
}

/**
 * Deletes a brain preset
 * @param {string} presetId - Preset ID
 */
export function deleteBrainPreset(presetId) {
    const presets = loadBrainPresets();
    if (presets[presetId]) {
        delete presets[presetId];
        saveBrainPresets(presets);
    }
}

// =============================================================================
// Export/Import Functions
// =============================================================================

/**
 * Exports character brains for sharing
 * Does NOT export API keys for security
 * @param {string[]} characterIds - Character IDs to export (empty = all)
 * @returns {Object} Export data
 */
export function exportCharacterBrains(characterIds = []) {
    const allBrains = loadCharacterBrains();
    const brainsToExport = {};

    // Determine which brains to export
    const idsToExport = characterIds.length > 0 ? characterIds : Object.keys(allBrains);

    for (const id of idsToExport) {
        if (allBrains[id]) {
            // Clone and remove sensitive data
            const brain = { ...allBrains[id] };
            delete brain.apiKeyEnvVar; // Don't export key references

            brainsToExport[id] = brain;
        }
    }

    return {
        version: '1.0',
        exportDate: new Date().toISOString(),
        type: 'character_brains',
        brains: brainsToExport
    };
}

/**
 * Imports character brains from export data
 * @param {Object} importData - Import data
 * @param {boolean} overwrite - Overwrite existing configs
 * @returns {number} Number of brains imported
 */
export function importCharacterBrains(importData, overwrite = false) {
    if (!importData?.brains || typeof importData.brains !== 'object') {
        throw new Error('Invalid import data: missing brains');
    }

    const currentBrains = loadCharacterBrains();
    let importCount = 0;

    for (const [characterId, brain] of Object.entries(importData.brains)) {
        if (!brain || typeof brain !== 'object') continue;

        // Check if exists and whether to overwrite
        if (currentBrains[characterId] && !overwrite) {
            // console.log('[Character Brain Storage] Skipping existing:', characterId);
            continue;
        }

        currentBrains[characterId] = {
            ...brain,
            importedAt: Date.now()
        };
        importCount++;
    }

    if (importCount > 0) {
        saveCharacterBrains(currentBrains);
    }

    return importCount;
}

/**
 * Exports brain presets for sharing
 * @param {string[]} presetIds - Preset IDs to export (empty = all)
 * @returns {Object} Export data
 */
export function exportBrainPresets(presetIds = []) {
    const allPresets = loadBrainPresets();
    const presetsToExport = {};

    const idsToExport = presetIds.length > 0 ? presetIds : Object.keys(allPresets);

    for (const id of idsToExport) {
        if (allPresets[id]) {
            const preset = { ...allPresets[id] };
            // Remove key references from config
            if (preset.config) {
                delete preset.config.apiKeyEnvVar;
            }
            presetsToExport[id] = preset;
        }
    }

    return {
        version: '1.0',
        exportDate: new Date().toISOString(),
        type: 'brain_presets',
        presets: presetsToExport
    };
}

/**
 * Imports brain presets from export data
 * @param {Object} importData - Import data
 * @param {boolean} overwrite - Overwrite existing presets with same name
 * @returns {number} Number of presets imported
 */
export function importBrainPresets(importData, overwrite = false) {
    if (!importData?.presets || typeof importData.presets !== 'object') {
        throw new Error('Invalid import data: missing presets');
    }

    const currentPresets = loadBrainPresets();
    const existingNames = new Set(Object.values(currentPresets).map(p => p.name?.toLowerCase()));
    let importCount = 0;

    for (const [originalId, preset] of Object.entries(importData.presets)) {
        if (!preset?.name || !preset?.config) continue;

        const nameLower = preset.name.toLowerCase();

        // Check for name collision
        let newId = originalId;
        let newName = preset.name;

        if (existingNames.has(nameLower)) {
            if (overwrite) {
                // Find and remove existing preset with same name
                for (const [existingId, existingPreset] of Object.entries(currentPresets)) {
                    if (existingPreset.name?.toLowerCase() === nameLower) {
                        delete currentPresets[existingId];
                        break;
                    }
                }
            } else {
                // Generate unique name
                let counter = 1;
                while (existingNames.has(`${nameLower} (${counter})`)) {
                    counter++;
                }
                newName = `${preset.name} (${counter})`;
                newId = `brain_preset_${Date.now()}_${importCount}`;
            }
        }

        currentPresets[newId] = {
            ...preset,
            id: newId,
            name: newName,
            importedAt: Date.now()
        };

        existingNames.add(newName.toLowerCase());
        importCount++;
    }

    if (importCount > 0) {
        saveBrainPresets(currentPresets);
    }

    return importCount;
}

// =============================================================================
// Character Association Helpers
// =============================================================================

/**
 * Gets the entity key for associating brains with characters/groups
 * @returns {string|null} Entity key or null
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
 * Gets the display name for the current entity
 * @returns {string} Display name
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
 * Gets all characters in the current context (for group chats)
 * @returns {Array<{id: string, name: string}>} Array of character info
 */
export function getCurrentContextCharacters() {
    const context = getContext();
    const characters = [];

    if (context.groupId) {
        // Group chat - get all members
        const group = context.groups?.find(g => g.id === context.groupId);
        if (group?.members) {
            for (const memberId of group.members) {
                const char = context.characters?.find(c => c.avatar === memberId);
                if (char) {
                    characters.push({
                        id: char.avatar || memberId,
                        name: char.name
                    });
                }
            }
        }
    } else if (context.characterId !== undefined && context.characterId !== null) {
        // 1-on-1 chat
        characters.push({
            id: `char_${context.characterId}`,
            name: context.name2 || 'Character'
        });
    }

    return characters;
}

/**
 * Clears all character brain data (use with caution)
 */
export function clearAllCharacterBrains() {
    extensionSettings.characterBrains = {};
    extensionSettings.characterBrainPresets = {};
    saveSettings();
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(PRESETS_KEY);
    // console.log('[Character Brain Storage] Cleared all character brain data');
}
