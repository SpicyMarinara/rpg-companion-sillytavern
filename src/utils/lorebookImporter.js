/**
 * Lorebook Importer Utility Module
 * Imports spells, cantrips, and abilities from SillyTavern lorebook JSON files
 */

import { extensionSettings } from '../core/state.js';
import { saveSettings, saveChatData } from '../core/persistence.js';
import { addSpellToLorebook } from './lorekeeper.js';
import { addAbilityToLorebook } from './abilitykeeper.js';
import { renderSpellbook } from '../systems/rendering/spellbook.js';
import { renderAbilities } from '../systems/rendering/abilities.js';

/**
 * Parses a lorebook JSON file and imports entries as spells/cantrips/abilities
 * @param {File} file - The lorebook JSON file to import
 * @returns {Promise<Object>} - Import results with counts
 */
export async function importFromLorebook(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = async (e) => {
            try {
                const json = JSON.parse(e.target.result);
                const results = {
                    spells: 0,
                    cantrips: 0,
                    abilities: 0,
                    skipped: 0,
                    errors: []
                };

                if (!json.entries) {
                    throw new Error('Invalid lorebook format: missing "entries" object');
                }

                // Initialize data structures if needed
                if (!extensionSettings.spellbook) {
                    extensionSettings.spellbook = { 
                        spellSlots: {}, 
                        knownSpells: [], 
                        cantrips: [] 
                    };
                }
                if (!extensionSettings.abilities) {
                    extensionSettings.abilities = { knownAbilities: [] };
                }

                // Process each entry
                for (const [uid, entry] of Object.entries(json.entries)) {
                    // Skip the header entry (uid 0) or disabled entries
                    if (entry.uid === 0 || entry.comment?.includes('Header:')) {
                        results.skipped++;
                        continue;
                    }

                    const comment = entry.comment || '';
                    const name = extractNameFromComment(comment, entry);
                    const description = entry.content || '';

                    // Determine type from comment prefix
                    if (comment.startsWith('Spell:')) {
                        // Add as spell (default to level 1)
                        extensionSettings.spellbook.knownSpells = extensionSettings.spellbook.knownSpells || [];
                        
                        // Check if already exists
                        const exists = extensionSettings.spellbook.knownSpells.some(s => s.name === name);
                        if (!exists) {
                            extensionSettings.spellbook.knownSpells.push({ 
                                name, 
                                level: 1, 
                                description 
                            });
                            await addSpellToLorebook(name, description, 'Spell');
                            results.spells++;
                        } else {
                            results.skipped++;
                        }
                    } else if (comment.startsWith('Cantrip:')) {
                        // Add as cantrip
                        extensionSettings.spellbook.cantrips = extensionSettings.spellbook.cantrips || [];
                        
                        // Check if already exists
                        const exists = extensionSettings.spellbook.cantrips.some(c => c.name === name);
                        if (!exists) {
                            extensionSettings.spellbook.cantrips.push({ 
                                name, 
                                description 
                            });
                            await addSpellToLorebook(name, description, 'Cantrip');
                            results.cantrips++;
                        } else {
                            results.skipped++;
                        }
                    } else if (comment.startsWith('Ability:')) {
                        // Add as ability
                        extensionSettings.abilities.knownAbilities = extensionSettings.abilities.knownAbilities || [];
                        
                        // Check if already exists
                        const exists = extensionSettings.abilities.knownAbilities.some(a => a.name === name);
                        if (!exists) {
                            extensionSettings.abilities.knownAbilities.push({ 
                                name, 
                                description 
                            });
                            await addAbilityToLorebook(name, description);
                            results.abilities++;
                        } else {
                            results.skipped++;
                        }
                    } else {
                        // Unknown type, skip
                        results.skipped++;
                    }
                }

                // Save and re-render
                saveSettings();
                saveChatData();
                renderSpellbook();
                renderAbilities();

                resolve(results);
            } catch (error) {
                reject(error);
            }
        };

        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
    });
}

/**
 * Extracts the name from the comment field
 * @param {string} comment - The comment field (e.g., "Spell: Fireball")
 * @param {Object} entry - The lorebook entry (fallback to first key)
 * @returns {string} - The extracted name
 */
function extractNameFromComment(comment, entry) {
    // Try to extract from comment (e.g., "Spell: Fireball" -> "Fireball")
    const match = comment.match(/^(?:Spell|Cantrip|Ability):\s*(.+)$/);
    if (match) {
        return match[1].trim();
    }
    
    // Fallback to first key if available
    if (entry.key && entry.key.length > 0) {
        return entry.key[0];
    }
    
    // Last resort: use comment as-is
    return comment || 'Unknown';
}

/**
 * Shows a file picker and imports the selected lorebook
 * @returns {Promise<Object>} - Import results
 */
export async function showImportDialog() {
    return new Promise((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) {
                reject(new Error('No file selected'));
                return;
            }
            
            try {
                const results = await importFromLorebook(file);
                resolve(results);
            } catch (error) {
                reject(error);
            }
        };
        
        input.click();
    });
}
