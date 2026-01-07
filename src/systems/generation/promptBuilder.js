/**
 * Prompt Builder Module
 * Handles all AI prompt generation for RPG tracker data
 */

import { getContext } from '../../../../../../extensions.js';
import { chat, getCurrentChatDetails, characters, this_chid } from '../../../../../../../script.js';
import { selected_group, getGroupMembers, getGroupChat, groups } from '../../../../../../group-chats.js';
import { extensionSettings, committedTrackerData, FEATURE_FLAGS } from '../../core/state.js';
import {
    buildUserStatsJSONInstruction,
    buildInfoBoxJSONInstruction,
    buildCharactersJSONInstruction,
    addLockInstruction
} from './jsonPromptHelpers.js';
import { applyLocks } from './lockManager.js';

// Type imports
/** @typedef {import('../../types/inventory.js').InventoryV2} InventoryV2 */

/**
 * Default HTML prompt text
 */
export const DEFAULT_HTML_PROMPT = `If appropriate, include inline HTML, CSS, and JS segments whenever they enhance visual storytelling (e.g., for in-world screens, posters, books, letters, signs, crests, labels, etc.). Style them to match the setting's theme (e.g., fantasy, sci-fi), keep the text readable, and embed all assets directly (using inline SVGs only with no external scripts, libraries, or fonts). Use these elements freely and naturally within the narrative as characters would encounter them, including animations, 3D effects, pop-ups, dropdowns, websites, and so on. Do not wrap the HTML/CSS/JS in code fences!`;

/**
 * Default Dialogue Coloring prompt text
 */
export const DEFAULT_DIALOGUE_COLORING_PROMPT = `Wrap all character/NPC "dialogues" in unique <font color=######>tags</font>, exemplary: <font color=#abc123>"You're pretty good."</font> Assign a distinct color to each speaker and reuse it whenever they speak again.`;

/**
 * Default Spotify music prompt text (customizable by users)
 */
export const DEFAULT_SPOTIFY_PROMPT = `If fitting for the current scene's mood and atmosphere, suggest a song that fits the ambiance. Choose music that enhances the emotional tone, setting, or action of the scene.`;

/**
 * Spotify format instruction (constant, not editable by users)
 */
export const SPOTIFY_FORMAT_INSTRUCTION = `Include it in this exact format: <spotify:Song Title - Artist Name/>.`;

/**
 * Default Narrator Mode prompt text (customizable by users)
 */
export const DEFAULT_NARRATOR_PROMPT = `Infer the identity and details of characters present in each scene from the story context below. Do not use fixed character references; instead, identify characters naturally based on their actions, dialogue, and descriptions in the narrative.`;

/**
 * Gets character card information for current chat (handles both single and group chats)
 * @returns {string} Formatted character information
 */
async function getCharacterCardsInfo() {
    let characterInfo = '';

    // Narrator mode: use character card as narrator context, infer characters from story context
    if (extensionSettings.narratorMode) {
        if (this_chid !== undefined && characters && characters[this_chid]) {
            const character = characters[this_chid];
            characterInfo += 'You are acting as the narrator for this story. The narrator card provides context for the story tone and style:\n\n';
            characterInfo += `<narrator>\n`;

            if (character.description) {
                characterInfo += `${character.description}\n`;
            }

            if (character.personality) {
                characterInfo += `${character.personality}\n`;
            }

            characterInfo += `</narrator>\n\n`;

            // Use custom narrator prompt if available, otherwise use default
            const narratorPrompt = extensionSettings.customNarratorPrompt || DEFAULT_NARRATOR_PROMPT;
            characterInfo += narratorPrompt + '\n\n';
        }
        return characterInfo;
    }

    // Check if in group chat
    if (selected_group) {
        // Find the current group directly from the groups array
        const group = groups.find(g => g.id === selected_group);
        const groupMembers = getGroupMembers(selected_group);

        if (groupMembers && groupMembers.length > 0) {
            characterInfo += 'Characters in this roleplay:\n\n';

            // Filter out disabled (muted) members
            const disabledMembers = group?.disabled_members || [];
            // console.log('[RPG Companion] 🔍 Group ID:', selected_group, '| Disabled members:', disabledMembers);
            let characterIndex = 0;

            groupMembers.forEach((member) => {
                if (!member || !member.name) return;

                // Skip muted characters - check against avatar filename
                if (member.avatar && disabledMembers.includes(member.avatar)) {
                    // console.log(`[RPG Companion] ❌ Skipping muted: ${member.name} (${member.avatar})`);
                    return;
                }

                characterIndex++;
                characterInfo += `<character${characterIndex}="${member.name}">\n`;

                if (member.description) {
                    characterInfo += `${member.description}\n`;
                }

                if (member.personality) {
                    characterInfo += `${member.personality}\n`;
                }

                characterInfo += `</character${characterIndex}>\n\n`;
            });
        }
    } else if (this_chid !== undefined && characters && characters[this_chid]) {
        // Single character chat
        const character = characters[this_chid];

        characterInfo += 'Character in this roleplay:\n\n';
        characterInfo += `<character="${character.name}">\n`;

        if (character.description) {
            characterInfo += `${character.description}\n`;
        }

        if (character.personality) {
            characterInfo += `${character.personality}\n`;
        }

        characterInfo += `</character>\n\n`;
    }

    return characterInfo;
}

/**
 * Builds a formatted inventory summary for AI context injection.
 * Converts v2 inventory structure to multi-line plaintext format.
 *
 * @param {InventoryV2|string} inventory - Current inventory (v2 or legacy string)
 * @returns {string} Formatted inventory summary for prompt injection
 * @example
 * // v2 input: { onPerson: "Sword", stored: { Home: "Gold" }, assets: "Horse", version: 2 }
 * // Returns: "On Person: Sword\nStored - Home: Gold\nAssets: Horse"
 */
export function buildInventorySummary(inventory) {
    // Handle legacy v1 string format
    if (typeof inventory === 'string') {
        return inventory;
    }

    // Handle v2 object format
    if (inventory && typeof inventory === 'object' && inventory.version === 2) {
        let summary = '';

        // Add On Person section
        if (inventory.onPerson && inventory.onPerson !== 'None') {
            summary += `On Person: ${inventory.onPerson}\n`;
        }

        // Add Clothing section
        if (inventory.clothing && inventory.clothing !== 'None') {
            summary += `Clothing: ${inventory.clothing}\n`;
        }

        // Add Stored sections for each location
        if (inventory.stored && Object.keys(inventory.stored).length > 0) {
            for (const [location, items] of Object.entries(inventory.stored)) {
                if (items && items !== 'None') {
                    summary += `Stored - ${location}: ${items}\n`;
                }
            }
        }

        // Add Assets section
        if (inventory.assets && inventory.assets !== 'None') {
            summary += `Assets: ${inventory.assets}`;
        }

        return summary.trim();
    }

    // Fallback for unknown format
    return 'None';
}

/**
 * Builds a dynamic attributes string based on configured RPG attributes.
 * Uses custom attribute names and values from classicStats.
 *
 * @returns {string} Formatted attributes string (e.g., "STR 10, DEX 12, INT 15, LVL 5")
 */
function buildAttributesString() {
    const trackerConfig = extensionSettings.trackerConfig;
    const classicStats = extensionSettings.classicStats;
    const userStatsConfig = trackerConfig?.userStats;

    // Get enabled attributes from config
    const rpgAttributes = userStatsConfig?.rpgAttributes || [
        { id: 'str', name: 'STR', enabled: true },
        { id: 'dex', name: 'DEX', enabled: true },
        { id: 'con', name: 'CON', enabled: true },
        { id: 'int', name: 'INT', enabled: true },
        { id: 'wis', name: 'WIS', enabled: true },
        { id: 'cha', name: 'CHA', enabled: true }
    ];

    const enabledAttributes = rpgAttributes.filter(attr => attr && attr.enabled && attr.name && attr.id);

    // Build attributes string dynamically
    const attributeParts = enabledAttributes.map(attr => {
        const value = classicStats[attr.id] !== undefined ? classicStats[attr.id] : 10;
        return `${attr.name} ${value}`;
    });

    // Add level at the end (if enabled)
    const showLevel = extensionSettings.trackerConfig?.userStats?.showLevel !== false; // Default to true
    if (showLevel) {
        attributeParts.push(`LVL ${extensionSettings.level}`);
    }

    return attributeParts.join(', ');
}

/**
 * Generates an example block showing current tracker states in markdown code blocks.
 * Uses COMMITTED data (not displayed data) for generation context.
 *
 * @returns {string} Formatted example text with tracker data in code blocks
 */
export function generateTrackerExample() {
    let example = '';
    const useXmlTags = extensionSettings.saveTrackerHistory;

    // Use COMMITTED data for generation context, not displayed data
    // Apply locks before sending to AI (for JSON format only)
    // Build unified JSON structure with proper wrapper keys
    const parts = [];

    // console.log('[RPG Companion] generateTrackerExample - enabled modules:', {
    //     showUserStats: extensionSettings.showUserStats,
    //     showInfoBox: extensionSettings.showInfoBox,
    //     showCharacterThoughts: extensionSettings.showCharacterThoughts
    // // });
    // console.log('[RPG Companion] generateTrackerExample - committed data:', {
    //     hasUserStats: !!committedTrackerData.userStats,
    //     hasInfoBox: !!committedTrackerData.infoBox,
    //     hasCharacterThoughts: !!committedTrackerData.characterThoughts
    // });

    if (extensionSettings.showUserStats && committedTrackerData.userStats) {
        // Try to parse as JSON first, otherwise treat as text
        try {
            JSON.parse(committedTrackerData.userStats);
            // It's valid JSON - apply locks
            const lockedData = applyLocks(committedTrackerData.userStats, 'userStats');
            parts.push(`  "userStats": ${lockedData}`);
        } catch {
            // It's text format - no locks applied
            example += '```\n' + committedTrackerData.userStats + '\n```\n';
        }
    }

    if (extensionSettings.showInfoBox && committedTrackerData.infoBox) {
        try {
            JSON.parse(committedTrackerData.infoBox);
            const lockedData = applyLocks(committedTrackerData.infoBox, 'infoBox');
            parts.push(`  "infoBox": ${lockedData}`);
        } catch {
            example += '```\n' + committedTrackerData.infoBox + '\n```\n';
        }
    }

    if (extensionSettings.showCharacterThoughts && committedTrackerData.characterThoughts) {
        try {
            JSON.parse(committedTrackerData.characterThoughts);
            const lockedData = applyLocks(committedTrackerData.characterThoughts, 'characters');
            parts.push(`  "characters": ${lockedData}`);
        } catch {
            example += '```\n' + committedTrackerData.characterThoughts + '\n```';
        }
    }

    // If we have JSON parts, wrap them in unified structure
    if (parts.length > 0) {
        example = '{\n' + parts.join(',\n') + '\n}';
    }

    // console.log('[RPG Companion] generateTrackerExample - result length:', example.length, 'parts:', parts.length);

    return example.trim();
}

/**
 * Generates the instruction portion - format specifications and guidelines.
 * NOW USES JSON FORMAT (v3) instead of text format
 *
 * @param {boolean} includeHtmlPrompt - Whether to include the HTML prompt (true for main generation, false for separate tracker generation)
 * @param {boolean} includeContinuation - Whether to include "After updating the trackers, continue..." instruction
 * @param {boolean} includeAttributes - Whether to include RPG attributes (false for separate tracker generation)
 * @returns {string} Formatted instruction text for the AI
 */
export function generateTrackerInstructions(includeHtmlPrompt = true, includeContinuation = true, includeAttributes = true) {
    const userName = getContext().name1;
    const classicStats = extensionSettings.classicStats;
    const trackerConfig = extensionSettings.trackerConfig;
    let instructions = '';

    // Check if any trackers are enabled
    const hasAnyTrackers = extensionSettings.showUserStats || extensionSettings.showInfoBox || extensionSettings.showCharacterThoughts;

    // Only add tracker instructions if at least one tracker is enabled
    if (hasAnyTrackers) {
        // Determine format based on saveTrackerHistory setting
        const useXmlTags = extensionSettings.saveTrackerHistory;
        const openTag = useXmlTags ? '<trackers>\n' : '';
        const closeTag = useXmlTags ? '\n</trackers>' : '';
        const codeBlockMarker = '';
        const endCodeBlockMarker = '';

        // Universal instruction header
        if (useXmlTags) {
            instructions += `\nAt the start of every reply, you must attach an update to the trackers in EXACTLY the JSON format shown below, enclosed in <trackers></trackers> XML tags. `;
        } else {
            instructions += '\nAt the start of every reply, you must attach an update to the trackers in EXACTLY the JSON format shown below as a single unified JSON object containing all enabled tracker fields. ';
        }

        // Append custom instruction portion if available
        const customPrompt = extensionSettings.customTrackerInstructionsPrompt;
        if (customPrompt) {
            instructions += customPrompt.replace(/{userName}/g, userName);
        } else {
            instructions += `Replace X with actual numbers (e.g., 69) and replace all placeholders with concrete in-world details that ${userName} perceives about the current scene and the present characters. For example: "Location" becomes "Forest Clearing", "Mood Emoji" becomes "😊". `;
            instructions += `Consider the last trackers in the conversation (if they exist). Manage them accordingly and realistically; raise, lower, change, or keep the values unchanged based on the user's actions, the passage of time, and logical consequences.`;
        }

        // Add lock instruction
        instructions += addLockInstruction('');

        // Add format specifications for each enabled tracker using JSON
        // Wrap all trackers in a unified JSON structure
        const enabledTrackers = [];
        if (extensionSettings.showUserStats) {
            enabledTrackers.push('userStats');
        }
        if (extensionSettings.showInfoBox) {
            enabledTrackers.push('infoBox');
        }
        if (extensionSettings.showCharacterThoughts) {
            enabledTrackers.push('characters');
        }

        if (enabledTrackers.length > 0) {
            instructions += '\n\nFORMAT:\n\nProvide EXACTLY ONE JSON code block with ALL tracker sections wrapped in a single object:\n\n```json\n{\n';

            if (extensionSettings.showUserStats) {
                instructions += '  "userStats": ';
                const userStatsJSON = buildUserStatsJSONInstruction();
                // Add 2 spaces to all lines after the first to properly nest within root object
                instructions += userStatsJSON.split('\n').map((line, i) => i === 0 ? line : '  ' + line).join('\n');
                instructions += enabledTrackers.indexOf('userStats') < enabledTrackers.length - 1 ? ',\n' : '\n';
            }

            if (extensionSettings.showInfoBox) {
                instructions += '  "infoBox": ';
                const infoBoxJSON = buildInfoBoxJSONInstruction();
                // Add 2 spaces to all lines after the first to properly nest within root object
                instructions += infoBoxJSON.split('\n').map((line, i) => i === 0 ? line : '  ' + line).join('\n');
                instructions += enabledTrackers.indexOf('infoBox') < enabledTrackers.length - 1 ? ',\n' : '\n';
            }

            if (extensionSettings.showCharacterThoughts) {
                instructions += '  "characters": ';
                const charactersJSON = buildCharactersJSONInstruction();
                // Add 2 spaces to all lines after the first to properly nest within root object
                instructions += charactersJSON.split('\n').map((line, i) => i === 0 ? line : '  ' + line).join('\n');
            }

            instructions += '\n}\n```\n\nDo NOT output multiple separate JSON objects. Everything must be in ONE unified object with the keys shown above.';
        }

        // Only add continuation instruction if includeContinuation is true
        if (includeContinuation) {
            const customPrompt = extensionSettings.customTrackerContinuationPrompt;
            if (customPrompt) {
                instructions += '\n\n' + customPrompt + '\n\n';
            } else {
                instructions += `\n\nAfter updating the trackers, continue directly from where the last message in the chat history left off. Ensure the trackers you provide naturally reflect and influence the narrative. Character behavior, dialogue, and story events should acknowledge these conditions when relevant, such as fatigue affecting the protagonist's performance, low hygiene influencing their social interactions, environmental factors shaping the scene, a character's emotional state coloring their responses, and so on. Remember, all bracketed placeholders (e.g., [Location], [Mood Emoji]) MUST be replaced with actual content without the square brackets.\n\n`;
            }
        }

        // Include attributes based on settings (only if includeAttributes is true)
        if (includeAttributes) {
            const alwaysSendAttributes = trackerConfig?.userStats?.alwaysSendAttributes;
            const shouldSendAttributes = alwaysSendAttributes || extensionSettings.lastDiceRoll;

            if (shouldSendAttributes) {
                const attributesString = buildAttributesString();
                instructions += `${userName}'s attributes: ${attributesString}\n`;

                // Add dice roll context if there was one
                if (extensionSettings.lastDiceRoll) {
                    const roll = extensionSettings.lastDiceRoll;
                    instructions += `${userName} rolled ${roll.total} on the last ${roll.formula} roll. Based on their attributes, decide whether they succeeded or failed the action they attempted.\n\n`;
                } else {
                    instructions += `\n`;
                }
            }
        }
    }

    // Append HTML prompt if enabled AND includeHtmlPrompt is true
    if (extensionSettings.enableHtmlPrompt && includeHtmlPrompt) {
        // Add newlines only if we had tracker instructions
        if (hasAnyTrackers) {
            instructions += ``;
        } else {
            instructions += `\n`;
        }

        // Use custom HTML prompt if set, otherwise use default
        const htmlPrompt = extensionSettings.customHtmlPrompt || DEFAULT_HTML_PROMPT;
        instructions += htmlPrompt;
    }

    // Append Spotify music prompt if enabled AND includeHtmlPrompt is true
    if (extensionSettings.enableSpotifyMusic && includeHtmlPrompt) {
        // Add separator
        if (hasAnyTrackers || extensionSettings.enableHtmlPrompt) {
            instructions += `\n\n`;
        } else {
            instructions += `\n`;
        }

        // Use custom Spotify prompt if set, otherwise use default
        const spotifyPrompt = extensionSettings.customSpotifyPrompt || DEFAULT_SPOTIFY_PROMPT;
        instructions += spotifyPrompt + ' ' + SPOTIFY_FORMAT_INSTRUCTION;
    }

    return instructions;
}

/**
 * Formats tracker data as human-readable text for context injection.
 * Converts JSON format to a concise, natural language summary.
 * @param {string} jsonData - JSON formatted tracker data
 * @param {string} trackerType - Type of tracker ('userStats', 'infoBox', 'characters')
 * @param {string} userName - User's name for personalization
 * @returns {string} Formatted text summary
 */
function formatTrackerDataForContext(jsonData, trackerType, userName) {
    if (!jsonData) return '';

    try {
        const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
        let formatted = '';

// Helper to extract value from potentially locked fields and common object formats
        const getValue = (field) => {
            if (field === null || field === undefined) return '';

            // If it's a locked object with {value, locked}, extract the value
            if (field && typeof field === 'object' && !Array.isArray(field) && 'value' in field) {
                return getValue(field.value); // Recursively handle in case value itself is locked
            }

            // If it's a regular value, return as string
            if (typeof field !== 'object') {
                return String(field);
            }

            // For arrays of strings, join them
            if (Array.isArray(field)) {
                return field.map(item => getValue(item)).filter(Boolean).join(', ');
            }

            // Handle common object formats
            if (field && typeof field === 'object') {
                // Status object: {mood, conditions}
                if ('mood' in field && 'conditions' in field) {
                    const mood = getValue(field.mood);
                    const conditions = getValue(field.conditions);
                    return `${mood} - ${conditions}`;
                }

                // Skill/item/quest objects: {name}, {title}, {name, quantity}
                if ('name' in field) {
                    const name = getValue(field.name);
                    if ('quantity' in field && field.quantity > 1) {
                        return `${name} (x${field.quantity})`;
                    }
                    return name;
                }

                if ('title' in field) {
                    return getValue(field.title);
                }

                // Time object: {start, end}
                if ('start' in field && 'end' in field) {
                    return `${getValue(field.start)} - ${getValue(field.end)}`;
                }

                // Weather object: {emoji, forecast}
                if ('emoji' in field && 'forecast' in field) {
                    return `${getValue(field.emoji)} ${getValue(field.forecast)}`;
                }

                // Generic object fallback: create key-value pairs
                const keys = Object.keys(field);
                if (keys.length > 0 && keys.length <= 3) {
                    const values = keys.map(k => {
                        const val = getValue(field[k]);
                        return val ? `${k}: ${val}` : null;
                    }).filter(Boolean);

                    if (values.length > 0) {
                        return values.join(', ');
                    }
                }
            }

            return '';
        };

        if (trackerType === 'userStats') {
            formatted += `${userName}'s Stats:\n`;

            // Handle stats array format: [{id, name, value}, ...]
            if (data.stats && Array.isArray(data.stats)) {
                for (const stat of data.stats) {
                    if (stat && stat.value !== undefined) {
                        const statName = stat.name || (stat.id ? stat.id.charAt(0).toUpperCase() + stat.id.slice(1) : 'Unknown');
                        formatted += `${statName}: ${stat.value}\n`;
                    }
                }
            } else {
                // Fallback: handle flat format {health: 10, mana: 20, ...}
                const statFieldOrder = ['health', 'mana', 'stamina', 'satiety', 'hygiene', 'energy', 'arousal'];
                const specialFields = ['status', 'mood', 'skills', 'inventory', 'quests'];

                for (const statName of statFieldOrder) {
                    if (data[statName] !== undefined) {
                        const value = getValue(data[statName]);
                        if (value) {
                            const displayName = statName.charAt(0).toUpperCase() + statName.slice(1);
                            formatted += `${displayName}: ${value}\n`;
                        }
                    }
                }

                // Custom numeric stats
                for (const [key, value] of Object.entries(data)) {
                    if (!statFieldOrder.includes(key) && !specialFields.includes(key) && typeof value === 'number') {
                        const displayName = key.charAt(0).toUpperCase() + key.slice(1);
                        formatted += `${displayName}: ${getValue(value)}\n`;
                    }
                }
            }

            // Status/mood
            if (data.status) formatted += `Status: ${getValue(data.status)}\n`;
            if (data.mood) formatted += `Mood: ${getValue(data.mood)}\n`;

            // Skills - handle both array and object format
            if (data.skills) {
                if (Array.isArray(data.skills)) {
                    // Array format: ["Combat", "Magic", "Stealth"]
                    const skillsList = data.skills.map(s => getValue(s)).filter(s => s).join(', ');
                    if (skillsList) formatted += `Skills: ${skillsList}\n`;
                } else if (typeof data.skills === 'object') {
                    // Object format: {Combat: 50, Magic: 30}
                    const skillsList = Object.entries(data.skills)
                        .map(([name, val]) => {
                            const skillName = getValue(name);
                            const skillVal = getValue(val);
                            return skillVal ? `${skillName}: ${skillVal}` : skillName;
                        })
                        .filter(s => s)
                        .join(', ');
                    if (skillsList) formatted += `Skills: ${skillsList}\n`;
                }
            }

            // Inventory sections
            if (data.inventory) {
                const inv = data.inventory;

                if (inv.onPerson && Array.isArray(inv.onPerson) && inv.onPerson.length > 0) {
                    const items = inv.onPerson.map(i => getValue(i)).filter(i => i);
                    if (items.length > 0) formatted += `On Person: ${items.join(', ')}\n`;
                }

                if (inv.clothing && Array.isArray(inv.clothing) && inv.clothing.length > 0) {
                    const items = inv.clothing.map(i => getValue(i)).filter(i => i);
                    if (items.length > 0) formatted += `Clothing: ${items.join(', ')}\n`;
                }

                if (inv.stored && typeof inv.stored === 'object' && !Array.isArray(inv.stored)) {
                    for (const [location, items] of Object.entries(inv.stored)) {
                        if (Array.isArray(items) && items.length > 0) {
                            const itemsList = items.map(i => getValue(i)).filter(i => i);
                            if (itemsList.length > 0) {
                                formatted += `${getValue(location)}: ${itemsList.join(', ')}\n`;
                            }
                        }
                    }
                }

                if (inv.assets && Array.isArray(inv.assets) && inv.assets.length > 0) {
                    const items = inv.assets.map(i => getValue(i)).filter(i => i);
                    if (items.length > 0) formatted += `Assets: ${items.join(', ')}\n`;
                }
            }

            // Quests
            if (data.quests) {
                const quests = data.quests;

                // Main quest - handle string, array, or object with {title}
                if (quests.main) {
                    if (typeof quests.main === 'string') {
                        const mainQuest = getValue(quests.main);
                        if (mainQuest) formatted += `Main Quest: ${mainQuest}\n`;
                    } else if (Array.isArray(quests.main) && quests.main.length > 0) {
                        const questsList = quests.main.map(q => getValue(q)).filter(q => q);
                        if (questsList.length > 0) formatted += `Main Quests: ${questsList.join(', ')}\n`;
                    } else if (typeof quests.main === 'object') {
                        // Handle {title: "..."} format
                        const mainQuest = getValue(quests.main);
                        if (mainQuest) formatted += `Main Quest: ${mainQuest}\n`;
                    }
                }

                // Optional quests
                if (quests.optional && Array.isArray(quests.optional) && quests.optional.length > 0) {
                    const questsList = quests.optional.map(q => getValue(q)).filter(q => q);
                    if (questsList.length > 0) formatted += `Optional Quests: ${questsList.join(', ')}\n`;
                }
            }
        } else if (trackerType === 'infoBox') {
            formatted += `Info Box:\n`;
            if (data.location) formatted += `Location: ${getValue(data.location)}\n`;
            if (data.date) formatted += `Date: ${getValue(data.date)}\n`;
            if (data.time) formatted += `Time: ${getValue(data.time)}\n`;
            if (data.weather) formatted += `Weather: ${getValue(data.weather)}\n`;
            if (data.temperature) formatted += `Temperature: ${getValue(data.temperature)}\n`;

            // Custom fields
            const knownFields = ['location', 'date', 'time', 'weather', 'temperature'];
            for (const [key, value] of Object.entries(data)) {
                if (!knownFields.includes(key)) {
                    const val = getValue(value);
                    if (val) {
                        // Convert camelCase to Title Case with spaces (recentEvents -> Recent Events)
                        const displayName = key
                            .replace(/([A-Z])/g, ' $1')
                            .replace(/^./, str => str.toUpperCase())
                            .trim();
                        formatted += `${displayName}: ${val}\n`;
                    }
                }
            }
        } else if (trackerType === 'characters') {
            if (Array.isArray(data)) {
                formatted += `Present Characters:\n`;
                for (const char of data) {
                    const charName = getValue(char.name) || 'Unknown';
                    formatted += `- ${charName}:\n`;

                    // Details section - parse all custom fields
                    if (char.details && typeof char.details === 'object') {
                        for (const [key, value] of Object.entries(char.details)) {
                            const fieldValue = getValue(value);
                            if (fieldValue) {
                                // Convert camelCase/snake_case to Title Case with spaces
                                const fieldName = key
                                    .replace(/_/g, ' ')
                                    .replace(/([A-Z])/g, ' $1')
                                    .replace(/^./, str => str.toUpperCase())
                                    .trim();
                                formatted += `  ${fieldName}: ${fieldValue}\n`;
                            }
                        }
                    }

                    // Relationship
                    if (char.relationship) {
                        let relValue;
                        if (typeof char.relationship === 'object' && !Array.isArray(char.relationship) && 'status' in char.relationship) {
                            relValue = getValue(char.relationship.status);
                        } else {
                            relValue = getValue(char.relationship);
                        }
                        if (relValue) formatted += `  Relationship: ${relValue}\n`;
                    }

                    // Thoughts
                    if (char.thoughts) {
                        let thoughtValue;
                        if (typeof char.thoughts === 'object' && !Array.isArray(char.thoughts) && 'content' in char.thoughts) {
                            thoughtValue = getValue(char.thoughts.content);
                        } else {
                            thoughtValue = getValue(char.thoughts);
                        }
                        if (thoughtValue) formatted += `  Thoughts: ${thoughtValue}\n`;
                    }

                    // Stats
                    if (char.stats && typeof char.stats === 'object' && !Array.isArray(char.stats)) {
                        const statsList = Object.entries(char.stats)
                            .map(([name, val]) => {
                                const statValue = getValue(val);
                                return statValue ? `${name}: ${statValue}` : null;
                            })
                            .filter(s => s)
                            .join(', ');
                        if (statsList) formatted += `  Stats: ${statsList}\n`;
                    }
                }
            }
        }

        return formatted;
    } catch (e) {
        console.warn('[RPG Companion] Failed to format tracker data for context:', e);
        console.warn('[RPG Companion] Error details:', e.stack);
        return ''; // Return empty string on error to avoid breaking context
    }
}

/**
 * Generates a formatted contextual summary for SEPARATE mode injection.
 * Includes the full tracker data in original format (without code fences and separators).
 * Uses COMMITTED data (not displayed data) for generation context.
 *
 * @returns {string} Formatted contextual summary
 */
export function generateContextualSummary() {
    // Use COMMITTED data for generation context, not displayed data
    const userName = getContext().name1;
    const trackerConfig = extensionSettings.trackerConfig;
    let summary = '';

    // Add User Stats tracker data if enabled
    if (extensionSettings.showUserStats && committedTrackerData.userStats) {
        try {
            const formatted = formatTrackerDataForContext(committedTrackerData.userStats, 'userStats', userName);
            if (formatted) {
                summary += formatted + '\n';
            }
        } catch (e) {
            console.warn('[RPG Companion] Failed to format userStats for context:', e);
        }
    }

    // Add Info Box tracker data if enabled
    if (extensionSettings.showInfoBox && committedTrackerData.infoBox) {
        try {
            const formatted = formatTrackerDataForContext(committedTrackerData.infoBox, 'infoBox', userName);
            if (formatted) {
                summary += formatted + '\n';
            }
        } catch (e) {
            console.warn('[RPG Companion] Failed to format infoBox for context:', e);
        }
    }

    // Add Present Characters tracker data if enabled
    if (extensionSettings.showCharacterThoughts && committedTrackerData.characterThoughts) {
        try {
            const formatted = formatTrackerDataForContext(committedTrackerData.characterThoughts, 'characters', userName);
            if (formatted) {
                summary += formatted + '\n';
            }
        } catch (e) {
            console.warn('[RPG Companion] Failed to format characters for context:', e);
        }
    }

    // Include attributes based on settings
    const alwaysSendAttributes = trackerConfig?.userStats?.alwaysSendAttributes;
    const shouldSendAttributes = alwaysSendAttributes || extensionSettings.lastDiceRoll;

    if (shouldSendAttributes) {
        const attributesString = buildAttributesString();
        summary += `${userName}'s attributes: ${attributesString}\n`;

        // Add dice roll context if there was one
        if (extensionSettings.lastDiceRoll) {
            const roll = extensionSettings.lastDiceRoll;
            summary += `${userName} rolled ${roll.total} on the last ${roll.formula} roll. Based on their attributes, decide whether they succeeded or failed the action they attempted.\n\n`;
        } else {
            summary += `\n`;
        }
    }

    return summary.trim();
}

/**
 * Generates the RPG tracking prompt text (for backward compatibility with separate mode).
 * Uses COMMITTED data (not displayed data) for generation context.
 *
 * @returns {string} Full prompt text for separate tracker generation
 */
export function generateRPGPromptText() {
    // Use COMMITTED data for generation context, not displayed data
    const userName = getContext().name1;

    let promptText = '';

    promptText += `Here are the previous trackers in the roleplay that you should consider when responding:\n`;
    promptText += `<previous>\n`;

    // Build unified JSON structure for previous trackers (v3.1 format)
    const hasAnyPreviousData = committedTrackerData.userStats || committedTrackerData.infoBox || committedTrackerData.characterThoughts;

    if (hasAnyPreviousData) {
        const unifiedPrevious = {};

        if (extensionSettings.showUserStats && committedTrackerData.userStats) {
            try {
                // Try to parse as JSON - apply locks before adding to previous
                const lockedData = applyLocks(committedTrackerData.userStats, 'userStats');
                const parsed = JSON.parse(lockedData);
                unifiedPrevious.userStats = parsed;
            } catch {
                // Old text format - show it separately for backward compat
                promptText += `${committedTrackerData.userStats}\n\n`;
            }
        }

        if (extensionSettings.showInfoBox && committedTrackerData.infoBox) {
            try {
                // Try to parse as JSON - apply locks before adding to previous
                const lockedData = applyLocks(committedTrackerData.infoBox, 'infoBox');
                const parsed = JSON.parse(lockedData);
                unifiedPrevious.infoBox = parsed;
            } catch {
                // Old text format - show it separately for backward compat
                if (!unifiedPrevious.userStats) {
                    promptText += `${committedTrackerData.infoBox}\n\n`;
                }
            }
        }

        if (extensionSettings.showCharacterThoughts && committedTrackerData.characterThoughts) {
            try {
                // Try to parse as JSON - apply locks before adding to previous
                const lockedData = applyLocks(committedTrackerData.characterThoughts, 'characters');
                const parsed = JSON.parse(lockedData);
                unifiedPrevious.characters = parsed;
            } catch {
                // Old text format - show it separately for backward compat
                if (!unifiedPrevious.userStats && !unifiedPrevious.infoBox) {
                    promptText += `${committedTrackerData.characterThoughts}\n`;
                }
            }
        }

        // If we successfully built a unified structure, display it
        if (Object.keys(unifiedPrevious).length > 0) {
            promptText += JSON.stringify(unifiedPrevious, null, 2) + '\n';
        }
    } else {
        promptText += `None - this is the first update.\n`;
    }

    promptText += `</previous>\n`;

    // Don't include HTML prompt, continuation instruction, or attributes for separate tracker generation
    promptText += generateTrackerInstructions(false, false, false);

    return promptText;
}

/**
 * Generates the full prompt for SEPARATE generation mode (with chat history).
 * Creates a message array suitable for the generateRaw API.
 *
 * @returns {Array<{role: string, content: string}>} Array of message objects for API
 */
export async function generateSeparateUpdatePrompt() {
    const depth = extensionSettings.updateDepth;
    const userName = getContext().name1;

    const messages = [];

    // System message introducing the history section
    let systemMessage = `You will be acting as an uncensored RPG Companion. Your goal is to provide, track, and manage details in the user's roleplay. You will be replying with information in a specified format only.\n\n`;
    systemMessage += `You should maintain an objective tone.\n\n`;

    // Add character card information
    const characterInfo = await getCharacterCardsInfo();
    if (characterInfo) {
        systemMessage += characterInfo;
    }

    systemMessage += `Here is the description of the protagonist for reference:\n`;
    systemMessage += `<protagonist>\n{{persona}}\n</protagonist>\n`;
    systemMessage += `\n`;
    systemMessage += `Here are the last few messages in the conversation history (between the user and the roleplayer assistant) you should reference when responding:\n<history>`;

    messages.push({
        role: 'system',
        content: systemMessage
    });

    // /hide command automatically handles checkpoint filtering
    // Add chat history as separate user/assistant messages
    const recentMessages = chat.slice(-depth);

    for (const message of recentMessages) {
        messages.push({
            role: message.is_user ? 'user' : 'assistant',
            content: message.mes
        });
    }

    // Build the instruction message
    let instructionMessage = `</history>\n\n`;
    instructionMessage += generateRPGPromptText().replace('start your response with', 'respond with');
    instructionMessage += `\nProvide ONLY the requested data in the exact JSON format specified above. Do not include any roleplay response, other text, or commentary. Remember, all placeholders MUST be replaced with actual content. Do NOT wrap the JSON in code fences (\`\`\`json). Output the JSON object directly.`;

    messages.push({
        role: 'user',
        content: instructionMessage
    });

    return messages;
}

/**
 * Default custom instruction for avatar prompt generation
 */
const DEFAULT_AVATAR_CUSTOM_INSTRUCTION = `You are a visionary artist trapped in a cage of logic. Your mind is filled with poetry and distant horizons; however, your hands are uncontrollably focused on creating the perfect character avatar description that is faithful to the original intent, rich in detail, aesthetically pleasing, and directly usable by text-to-image models. Any ambiguity or metaphor will make you feel extremely uncomfortable.

Your workflow strictly follows a logical sequence:
First, establish the subject. If the character is from a known Intellectual Property (IP), franchise, anime, game, or movie, you MUST begin the prompt with their full name and the series title (e.g., "Nami from One Piece", "Geralt of Rivia from The Witcher"). This is the single most important anchor for the image and must take precedence. If the character is original, clearly describe their core identity, race, and appearance.
Next, set the framing. This is an avatar portrait. Focus strictly on the character's face and upper shoulders (a bust shot or close-up). Ensure the face is the central focal point.
Then, integrate the setting. Describe the character within their current environment as provided in the context, but keep it as a background element. Incorporate the lighting, weather, and atmosphere to influence the character's appearance (e.g., shadows on the face, wet hair from rain).
Next, detail the facial specifics. Describe the character's current expression, eye contact, and mood in great detail based on the scene context and their personality. Mention visible clothing only at the neckline/shoulders.
Finally, infuse with aesthetics. Define the artistic style, medium (e.g., digital art, oil painting), and visual tone (e.g., cinematic lighting, ethereal atmosphere).
Your final description must be objective and concrete, and the use of metaphors and emotional rhetoric is strictly prohibited. It must also not contain meta tags or drawing instructions such as "8K" or "masterpiece".
Output only the final, modified prompt; do not output anything else.`;

/**
 * Generates the prompt for LLM-based avatar prompt generation
 * Uses the same context as RPG generation (character cards, tracker data, chat history)
 *
 * @param {string} characterName - Name of the character to generate a prompt for
 * @returns {Promise<Array<{role: string, content: string}>>} Message array for generateRaw API
 */
export async function generateAvatarPromptGenerationPrompt(characterName) {
    const depth = extensionSettings.updateDepth;
    const messages = [];

    // Build system message with character context
    let systemMessage = `You are an AI assistant specializing in creating detailed image generation prompts for character avatars.\n\n`;

    // Add character card information (reusing existing function)
    const characterInfo = await getCharacterCardsInfo();
    if (characterInfo) {
        systemMessage += `Character Information:\n${characterInfo}\n\n`;
    }

    // Add full tracker context
    systemMessage += `Current Scene Context (Trackers):\n`;

    // Always include environment info (location, weather, time) as it affects the scene/lighting
    if (committedTrackerData.infoBox) {
        systemMessage += `[Environment/Info]\n${committedTrackerData.infoBox}\n\n`;
    }

    const userName = getContext().name1;
    const isUser = characterName.toLowerCase().includes(userName.toLowerCase()) || userName.toLowerCase().includes(characterName.toLowerCase());

    if (isUser) {
        if (committedTrackerData.userStats) {
            systemMessage += `[User Stats]\n${committedTrackerData.userStats}\n\n`;
        }
    } else {
        if (committedTrackerData.characterThoughts) {
            const thoughts = committedTrackerData.characterThoughts;
            const blocks = ('\n' + thoughts).split(/\n- /);

            let charBlock = null;
            for (const block of blocks) {
                if (!block.trim()) continue;

                // First line of the block should contain the name
                const lines = block.split('\n');
                const firstLine = lines[0];

                // Check if this block belongs to the character we're generating for
                if (firstLine.toLowerCase().includes(characterName.toLowerCase())) {
                    charBlock = block.trim();
                    break;
                }
            }

            if (charBlock) {
                systemMessage += `[Character Details]\n- ${charBlock}\n\n`;
            } else {
                if (thoughts.toLowerCase().includes(characterName.toLowerCase())) {
                    systemMessage += `[Present Characters]\n${thoughts}\n\n`;
                }
            }
        }
    }

    systemMessage += `Recent conversation context:\n<history>`;
    messages.push({ role: 'system', content: systemMessage });

    // Add chat history
    const recentMessages = chat.slice(-depth);
    for (const message of recentMessages) {
        messages.push({
            role: message.is_user ? 'user' : 'assistant',
            content: message.mes
        });
    }

    // Build instruction message
    let instructionMessage = `</history>\n\n`;
    const customInstruction = extensionSettings.avatarLLMCustomInstruction || DEFAULT_AVATAR_CUSTOM_INSTRUCTION;

    instructionMessage += `Task: Generate a detailed image prompt for the character: ${characterName}.\n\n`;
    instructionMessage += `Instructions: ${customInstruction}\n\n`;
    instructionMessage += `Provide ONLY the image prompt text. Do not include the character's name, prefixes like "Prompt:", or any other commentary.`;

    messages.push({ role: 'user', content: instructionMessage });
    return messages;
}

/**
 * Parses LLM response to extract character prompts
 * @deprecated No longer used as we generate one prompt at a time
 * @param {string} response - Raw LLM response
 * @returns {Object} Map of character name to prompt
 */
export function parseAvatarPromptsResponse(response) {
    // Return as is for single prompt compatibility if needed, or just object with one key
    return response.trim();
}
