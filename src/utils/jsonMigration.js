/**
 * JSON Migration Module
 * Migrates committed tracker data from v2 text format to v3 JSON format
 */

import { committedTrackerData, extensionSettings, updateCommittedTrackerData, updateExtensionSettings } from '../core/state.js';
import { saveSettings, saveChatData } from '../core/persistence.js';

/**
 * Helper to separate emoji from text in a string
 * @param {string} str - String potentially containing emoji followed by text
 * @returns {{emoji: string, text: string}} Separated emoji and text
 */
function separateEmojiFromText(str) {
    if (!str) return { emoji: '', text: '' };

    str = str.trim();

    // Regex to match emoji at the start
    const emojiRegex = /^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F910}-\u{1F96B}\u{1F980}-\u{1F9E0}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}]+/u;
    const emojiMatch = str.match(emojiRegex);

    if (emojiMatch) {
        const emoji = emojiMatch[0];
        let text = str.substring(emoji.length).trim();
        // Remove leading comma or space
        text = text.replace(/^[,\s]+/, '');
        return { emoji, text };
    }

    // Check if there's a comma separator anyway
    const commaParts = str.split(',');
    if (commaParts.length >= 2) {
        return {
            emoji: commaParts[0].trim(),
            text: commaParts.slice(1).join(',').trim()
        };
    }

    // No clear separation - return original as text
    return { emoji: '', text: str };
}

/**
 * Parses item text to JSON format
 * Handles "3x Item Name" or "Item Name" formats
 * @param {string} itemsText - Comma-separated items string
 * @returns {Array<{name: string, quantity?: number}>} Array of item objects
 */
function parseItemsToJSON(itemsText) {
    if (!itemsText || itemsText.trim() === '' || itemsText.toLowerCase() === 'none') {
        return [];
    }

    const items = itemsText.split(',').map(s => s.trim()).filter(s => s);
    return items.map(item => {
        // Parse "3x Health Potion" format
        const qtyMatch = item.match(/^(\d+)x\s*(.+)/i);
        if (qtyMatch) {
            return {
                name: qtyMatch[2].trim(),
                quantity: parseInt(qtyMatch[1])
            };
        }
        return { name: item, quantity: 1 };
    });
}

/**
 * Migrates User Stats from v2 text format to v3 JSON format
 * @param {string} textData - V2 text format user stats
 * @returns {object} V3 JSON format user stats
 */
export function migrateUserStatsToJSON(textData) {
    if (!textData || typeof textData !== 'string') {
        return null;
    }

    const lines = textData.split('\n');
    const result = {
        version: 3,
        stats: [],
        status: {},
        skills: [],
        inventory: {
            onPerson: [],
            clothing: [],
            stored: {},
            assets: []
        },
        quests: {
            main: null,
            optional: []
        }
    };

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === '---' || trimmed.startsWith('```')) continue;

        // Parse "- StatName: X%" format
        const statMatch = trimmed.match(/^-\s*([^:]+):\s*(\d+)%/);
        if (statMatch) {
            const name = statMatch[1].trim();
            const id = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
            result.stats.push({
                id: id,
                name: name,
                value: parseInt(statMatch[2])
            });
            continue;
        }

        // Parse "Status: emoji, text" or "Status: text" format
        const statusMatch = trimmed.match(/^Status:\s*(.+)/i);
        if (statusMatch) {
            const { emoji, text } = separateEmojiFromText(statusMatch[1]);
            if (emoji) result.status.mood = emoji;
            if (text) result.status.conditions = text;
            continue;
        }

        // Parse "Skills: skill1, skill2" format
        const skillsMatch = trimmed.match(/^Skills:\s*(.+)/i);
        if (skillsMatch) {
            const skillsText = skillsMatch[1].trim();
            if (skillsText && skillsText.toLowerCase() !== 'none') {
                const skills = skillsText.split(',').map(s => s.trim()).filter(s => s);
                result.skills = skills.map(name => ({ name }));
            }
            continue;
        }

        // Parse inventory lines
        const onPersonMatch = trimmed.match(/^On Person:\s*(.+)/i);
        if (onPersonMatch) {
            result.inventory.onPerson = parseItemsToJSON(onPersonMatch[1]);
            continue;
        }

        const clothingMatch = trimmed.match(/^Clothing:\s*(.+)/i);
        if (clothingMatch) {
            result.inventory.clothing = parseItemsToJSON(clothingMatch[1]);
            continue;
        }

        const storedMatch = trimmed.match(/^Stored\s*-\s*([^:]+):\s*(.+)/i);
        if (storedMatch) {
            const location = storedMatch[1].trim();
            result.inventory.stored[location] = parseItemsToJSON(storedMatch[2]);
            continue;
        }

        const assetsMatch = trimmed.match(/^Assets:\s*(.+)/i);
        if (assetsMatch) {
            const assetsText = assetsMatch[1].trim();
            if (assetsText && assetsText.toLowerCase() !== 'none') {
                result.inventory.assets = assetsText.split(',').map(s => s.trim()).filter(s => s).map(name => ({ name }));
            }
            continue;
        }

        // Parse quest lines
        const mainQuestMatch = trimmed.match(/^Main Quests?:\s*(.+)/i);
        if (mainQuestMatch) {
            const questText = mainQuestMatch[1].trim();
            if (questText && questText.toLowerCase() !== 'none') {
                result.quests.main = { title: questText };
            }
            continue;
        }

        const optionalQuestsMatch = trimmed.match(/^Optional Quests?:\s*(.+)/i);
        if (optionalQuestsMatch) {
            const questsText = optionalQuestsMatch[1].trim();
            if (questsText && questsText.toLowerCase() !== 'none') {
                const quests = questsText.split(',').map(s => s.trim()).filter(s => s);
                result.quests.optional = quests.map(title => ({ title }));
            }
            continue;
        }
    }

    return result;
}

/**
 * Migrates Info Box from v2 text format to v3 JSON format
 * @param {string} textData - V2 text format info box
 * @returns {object} V3 JSON format info box
 */
export function migrateInfoBoxToJSON(textData) {
    if (!textData || typeof textData !== 'string') {
        return null;
    }

    const lines = textData.split('\n');
    const result = {
        version: 3
    };

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === '---' || trimmed.startsWith('```') || trimmed.toLowerCase() === 'info box') continue;

        // Parse "Date: value" format
        const dateMatch = trimmed.match(/^Date:\s*(.+)/i);
        if (dateMatch) {
            result.date = { value: dateMatch[1].trim() };
            continue;
        }

        // Parse "Weather: emoji, text" or "Weather: text" format
        const weatherMatch = trimmed.match(/^Weather:\s*(.+)/i);
        if (weatherMatch) {
            const { emoji, text } = separateEmojiFromText(weatherMatch[1]);
            result.weather = {
                emoji: emoji || '',
                forecast: text || weatherMatch[1].trim()
            };
            continue;
        }

        // Parse "Temperature: X°C" or "Temperature: X°F" format
        const tempMatch = trimmed.match(/^Temperature:\s*(\d+)\s*°?([CF])?/i);
        if (tempMatch) {
            result.temperature = {
                value: parseInt(tempMatch[1]),
                unit: tempMatch[2] ? tempMatch[2].toUpperCase() : 'C'
            };
            continue;
        }

        // Parse "Time: start → end" format
        const timeMatch = trimmed.match(/^Time:\s*(.+?)\s*→\s*(.+)/i);
        if (timeMatch) {
            result.time = {
                start: timeMatch[1].trim(),
                end: timeMatch[2].trim()
            };
            continue;
        }

        // Parse "Location: value" format
        const locationMatch = trimmed.match(/^Location:\s*(.+)/i);
        if (locationMatch) {
            result.location = { value: locationMatch[1].trim() };
            continue;
        }

        // Parse "Recent Events: event1, event2, event3" format
        const eventsMatch = trimmed.match(/^Recent Events:\s*(.+)/i);
        if (eventsMatch) {
            const eventsText = eventsMatch[1].trim();
            if (eventsText && eventsText.toLowerCase() !== 'none') {
                result.recentEvents = eventsText.split(',').map(s => s.trim()).filter(s => s);
            }
            continue;
        }
    }

    return result;
}

/**
 * Migrates Present Characters from v2 text format to v3 JSON format
 * @param {string} textData - V2 text format present characters
 * @returns {object} V3 JSON format present characters
 */
export function migrateCharactersToJSON(textData) {
    if (!textData || typeof textData !== 'string') {
        return null;
    }

    const result = {
        version: 3,
        characters: []
    };

    // Split by character blocks (marked by "- Name")
    const blocks = ('\n' + textData).split(/\n-\s+/);

    for (const block of blocks) {
        if (!block.trim()) continue;

        const lines = block.trim().split('\n');
        if (lines.length === 0) continue;

        const character = {
            name: lines[0].trim()
        };

        // Parse subsequent lines for this character
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            // Parse "Details: emoji | field1 | field2" format
            const detailsMatch = line.match(/^Details:\s*(.+)/i);
            if (detailsMatch) {
                const detailsText = detailsMatch[1].trim();
                const parts = detailsText.split('|').map(s => s.trim());

                const { emoji } = separateEmojiFromText(parts[0] || '');
                if (emoji) character.emoji = emoji;

                character.details = {};
                for (let j = 1; j < parts.length; j++) {
                    const fieldName = `field${j}`;
                    character.details[fieldName] = parts[j];
                }
                continue;
            }

            // Parse "Relationship: status" format
            const relationshipMatch = line.match(/^Relationship:\s*(.+)/i);
            if (relationshipMatch) {
                character.relationship = { status: relationshipMatch[1].trim() };
                continue;
            }

            // Parse "Stats: stat1: X% | stat2: Y%" format
            const statsMatch = line.match(/^Stats:\s*(.+)/i);
            if (statsMatch) {
                const statsText = statsMatch[1].trim();
                const statParts = statsText.split('|').map(s => s.trim());
                character.stats = [];

                for (const statPart of statParts) {
                    const statValueMatch = statPart.match(/^([^:]+):\s*(\d+)%/);
                    if (statValueMatch) {
                        character.stats.push({
                            name: statValueMatch[1].trim(),
                            value: parseInt(statValueMatch[2])
                        });
                    }
                }
                continue;
            }

            // Parse "Thoughts: content" format
            const thoughtsMatch = line.match(/^Thoughts:\s*(.+)/i);
            if (thoughtsMatch) {
                character.thoughts = { content: thoughtsMatch[1].trim() };
                continue;
            }
        }

        result.characters.push(character);
    }

    return result;
}

/**
 * Main migration function - migrates all committed tracker data to v3 JSON format
 * @returns {Promise<void>}
 */
export async function migrateToV3JSON() {
    console.log('[RPG Migration] Starting migration to v3 JSON format...');

    const migrated = {
        userStats: null,
        infoBox: null,
        characterThoughts: null
    };

    // Migrate User Stats
    if (committedTrackerData.userStats && typeof committedTrackerData.userStats === 'string') {
        console.log('[RPG Migration] Migrating User Stats...');
        migrated.userStats = migrateUserStatsToJSON(committedTrackerData.userStats);
        if (migrated.userStats) {
            console.log('[RPG Migration] ✓ User Stats migrated');
        }
    }

    // Migrate Info Box
    if (committedTrackerData.infoBox && typeof committedTrackerData.infoBox === 'string') {
        console.log('[RPG Migration] Migrating Info Box...');
        migrated.infoBox = migrateInfoBoxToJSON(committedTrackerData.infoBox);
        if (migrated.infoBox) {
            console.log('[RPG Migration] ✓ Info Box migrated');
        }
    }

    // Migrate Present Characters
    if (committedTrackerData.characterThoughts && typeof committedTrackerData.characterThoughts === 'string') {
        console.log('[RPG Migration] Migrating Present Characters...');
        migrated.characterThoughts = migrateCharactersToJSON(committedTrackerData.characterThoughts);
        if (migrated.characterThoughts) {
            console.log('[RPG Migration] ✓ Present Characters migrated');
        }
    }

    // Update committed data
    updateCommittedTrackerData(migrated);

    // Initialize lockedItems if not present
    if (!extensionSettings.lockedItems) {
        console.log('[RPG Migration] Initializing lockedItems structure...');
        updateExtensionSettings({
            lockedItems: {
                stats: [],
                skills: [],
                inventory: {
                    onPerson: [],
                    clothing: [],
                    stored: {},
                    assets: []
                },
                quests: {
                    main: false,
                    optional: []
                },
                infoBox: {
                    date: false,
                    weather: false,
                    temperature: false,
                    time: false,
                    location: false,
                    recentEvents: false
                },
                characters: {}
            }
        });
    }

    // Save migrated data
    await saveChatData();
    await saveSettings();

    console.log('[RPG Migration] ✅ Migration to v3 JSON format complete');
}
