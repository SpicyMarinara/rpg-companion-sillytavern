/**
 * JSON Prompt Builder Helpers
 * Helper functions for building JSON format tracker prompts
 */

import { extensionSettings, committedTrackerData } from '../../core/state.js';
import { getContext } from '../../../../../../extensions.js';
import { getWeatherKeywordsAsPromptString } from '../ui/weatherEffects.js';
import { i18n } from '../../core/i18n.js';

/**
 * Converts a field name to snake_case for use as JSON key
 * Example: "Test Tracker" -> "test_tracker"
 * @param {string} name - Field name to convert
 * @returns {string} snake_case version
 */
function toSnakeCase(name) {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

/**
 * Extracts the base name (before parentheses) and converts to snake_case for use as JSON key.
 * Parenthetical content is treated as a description/hint, not part of the key.
 * Example: "Conditions (up to 5 traits)" -> "conditions"
 * Example: "Status Effects" -> "status_effects"
 * @param {string} name - Field name, possibly with parenthetical description
 * @returns {string} snake_case key from the base name only
 */
function toFieldKey(name) {
    const baseName = name.replace(/\s*\(.*\)\s*$/, '').trim();
    return toSnakeCase(baseName);
}

/**
 * Builds User Stats JSON format instruction
 * @returns {string} JSON format instruction for user stats
 */
export function buildUserStatsJSONInstruction() {
    const userName = getContext().name1;
    const trackerConfig = extensionSettings.trackerConfig;
    const userStatsConfig = trackerConfig?.userStats;
    const enabledStats = userStatsConfig?.customStats?.filter(s => s && s.enabled && s.name) || [];
    const displayMode = userStatsConfig?.statsDisplayMode || 'percentage';

    let instruction = '{\n';
    instruction += '  "stats": [\n';

    // Add stats dynamically
    for (let i = 0; i < enabledStats.length; i++) {
        const stat = enabledStats[i];
        const comma = i < enabledStats.length - 1 ? ',' : '';
        if (displayMode === 'number') {
            const maxValue = stat.maxValue || 100;
            instruction += `    {"id": "${stat.id}", "name": "${stat.name}", "value": X}${comma}  // 0 to ${maxValue}\n`;
        } else {
            instruction += `    {"id": "${stat.id}", "name": "${stat.name}", "value": X}${comma}  // 0 to 100 (percentage)\n`;
        }
    }

    instruction += '  ],\n';

    // Status section
    if (userStatsConfig?.statusSection?.enabled) {
        instruction += '  "status": {\n';
        if (userStatsConfig.statusSection.showMoodEmoji) {
            instruction += '    "mood": "Mood Emoji"';
        }
        // Add all custom status fields
        const customFields = userStatsConfig.statusSection.customFields || [];
        if (customFields.length > 0) {
            for (let i = 0; i < customFields.length; i++) {
                const fieldName = customFields[i].toLowerCase();
                const fieldKey = toFieldKey(fieldName);
                const comma = (i === customFields.length - 1 && !userStatsConfig.statusSection.showMoodEmoji) ? '' : (userStatsConfig.statusSection.showMoodEmoji || i < customFields.length - 1 ? ',\n' : '\n');
                if (i === 0 && userStatsConfig.statusSection.showMoodEmoji) {
                    instruction += ',\n';
                }
                instruction += `    "${fieldKey}": "[${fieldName}]"${comma}`;
            }
        }
        if (!userStatsConfig.statusSection.showMoodEmoji && customFields.length > 0) {
            instruction += '\n';
        }
        instruction += '  },\n';
    }

    // Skills section
    if (userStatsConfig?.skillsSection?.enabled) {
        instruction += '  "skills": [\n';
        instruction += '    {"name": "Skill1"},\n';
        instruction += '    {"name": "Skill2"}\n';
        instruction += '  ],\n';
    }

    // Inventory section
    if (extensionSettings.showInventory) {
        instruction += '  "inventory": {\n';
        instruction += '    "onPerson": [\n';
        instruction += '      {"name": "Item1", "quantity": X},\n';
        instruction += '      {"name": "Item2", "quantity": X}\n';
        instruction += '    ],\n';
        instruction += '    "clothing": [\n';
        instruction += '      {"name": "Clothing1"}\n';
        instruction += '    ],\n';
        instruction += '    "stored": {\n';
        instruction += '      "Location1": [\n';
        instruction += '        {"name": "Item", "quantity": X}\n';
        instruction += '      ]\n';
        instruction += '    },\n';
        instruction += '    "assets": [\n';
        instruction += '      {"name": "Asset1", "location": "Location"}\n';
        instruction += '    ]\n';
        instruction += '  },\n';
    }

    // Quests section
    instruction += '  "quests": {\n';
    instruction += '    "main": {"title": "Quest title"},\n';
    instruction += '    "optional": [\n';
    instruction += '      {"title": "Quest1"},\n';
    instruction += '      {"title": "Quest2"}\n';
    instruction += '    ]\n';
    instruction += '  }\n';
    instruction += '}';

    return instruction;
}

/**
 * Builds Avatar Stats JSON format instruction (for the secondary game-avatar stat panel)
 * @returns {string} JSON format instruction for avatar stats
 */
export function buildAvatarStatsJSONInstruction() {
    const avatarConfig = extensionSettings.trackerConfig?.avatarStats;
    const enabledStats = avatarConfig?.customStats?.filter(s => s && s.enabled && s.name) || [];
    const displayMode = avatarConfig?.statsDisplayMode || 'percentage';

    let instruction = '{\n';
    instruction += '  "stats": [\n';

    for (let i = 0; i < enabledStats.length; i++) {
        const stat = enabledStats[i];
        const comma = i < enabledStats.length - 1 ? ',' : '';
        if (displayMode === 'number') {
            const maxValue = stat.maxValue || 100;
            instruction += `    {"id": "${stat.id}", "name": "${stat.name}", "value": X}${comma}  // 0 to ${maxValue}\n`;
        } else {
            instruction += `    {"id": "${stat.id}", "name": "${stat.name}", "value": X}${comma}  // 0 to 100 (percentage)\n`;
        }
    }

    instruction += '  ]';

    if (avatarConfig?.statusSection?.enabled) {
        instruction += ',\n  "status": {\n';
        const customFields = avatarConfig.statusSection.customFields || [];
        for (let i = 0; i < customFields.length; i++) {
            const fieldName = customFields[i];
            const fieldKey = fieldName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
            const comma = i < customFields.length - 1 ? ',' : '';
            instruction += `    "${fieldKey}": "[${fieldName.toLowerCase()}]"${comma}\n`;
        }
        instruction += '  }';
    }

    instruction += '\n}';
    return instruction;
}

/**
 * Builds Info Box JSON format instruction
 * @returns {string} JSON format instruction for info box
 */
export function buildInfoBoxJSONInstruction() {
    const infoBoxConfig = extensionSettings.trackerConfig?.infoBox;
    const widgets = infoBoxConfig?.widgets || {};

    let instruction = '{\n';
    let hasFields = false;

    if (widgets.date?.enabled) {
        const dateFormat = widgets.date.format || 'Weekday, Month, Year';
        instruction += `  "date": {"value": "${dateFormat}"}`;
        hasFields = true;
    }

    if (widgets.weather?.enabled) {
        // Get valid weather keywords for the current language to guide LLM generation
        const currentLang = i18n.currentLanguage || 'en';
        const weatherHint = getWeatherKeywordsAsPromptString(currentLang);
        instruction += (hasFields ? ',\n' : '') + `  "weather": {"emoji": "Weather Emoji", "forecast": "Forecast"}  // ${weatherHint}`;
        hasFields = true;
    }

    if (widgets.temperature?.enabled) {
        const unit = widgets.temperature.unit === 'F' ? 'F' : 'C';
        instruction += (hasFields ? ',\n' : '') + `  "temperature": {"value": X, "unit": "${unit}"}`;
        hasFields = true;
    }

    if (widgets.time?.enabled) {
        instruction += (hasFields ? ',\n' : '') + '  "time": {"start": "TimeStart", "end": "TimeEnd"}';
        hasFields = true;
    }

    if (widgets.location?.enabled) {
        instruction += (hasFields ? ',\n' : '') + '  "location": {"value": "Location"}';
        hasFields = true;
    }

    if (widgets.recentEvents?.enabled) {
        instruction += (hasFields ? ',\n' : '') + '  "recentEvents": ["Only NEW important events from this message that are not already tracked. Use an empty array [] if nothing significant happened."]';
        hasFields = true;
    }

    if (widgets.storyArc?.enabled) {
        instruction += (hasFields ? ',\n' : '') + '  "storyArc": "A one-paragraph summary of the current story arc and main ongoing plot threads"';
        hasFields = true;
    }

    instruction += '\n}';
    return instruction;
}

/**
 * Builds Present Characters JSON format instruction
 * @returns {string} JSON format instruction for present characters
 */
export function buildCharactersJSONInstruction() {
    const userName = getContext().name1;
    const presentCharsConfig = extensionSettings.trackerConfig?.presentCharacters;
    const enabledFields = presentCharsConfig?.customFields?.filter(f => f && f.enabled && f.name) || [];
    const relationshipsEnabled = presentCharsConfig?.relationships?.enabled !== false;
    const thoughtsConfig = presentCharsConfig?.thoughts;
    const characterStats = presentCharsConfig?.characterStats;
    const enabledCharStats = characterStats?.enabled && characterStats?.customStats?.filter(s => s && s.enabled && s.name) || [];

    let instruction = '[\n';
    instruction += '  {\n';
    instruction += '    "name": "CharacterName",\n';
    instruction += '    "emoji": "Character Emoji"';

    // Details fields
    if (enabledFields.length > 0) {
        instruction += ',\n    "details": {\n';
        for (let i = 0; i < enabledFields.length; i++) {
            const field = enabledFields[i];
            const fieldKey = toSnakeCase(field.name);
            const comma = i < enabledFields.length - 1 ? ',' : '';
            instruction += `      "${fieldKey}": "${field.description}"${comma}\n`;
        }
        instruction += '    }';
    }

    // Relationship
    if (relationshipsEnabled) {
        const relationshipFields = presentCharsConfig?.relationshipFields || [];
        const options = relationshipFields.join('/');
        instruction += ',\n    "relationship": {"status": "(choose one: ' + options + ')"}';
    }

    // Stats
    if (enabledCharStats.length > 0) {
        instruction += ',\n    "stats": [\n';
        for (let i = 0; i < enabledCharStats.length; i++) {
            const stat = enabledCharStats[i];
            const comma = i < enabledCharStats.length - 1 ? ',' : '';
            instruction += `      {"name": "${stat.name}", "value": X}${comma}\n`;
        }
        instruction += '    ]';
    }

    // Thoughts
    if (thoughtsConfig?.enabled) {
        const thoughtsDescription = thoughtsConfig.description || 'Internal monologue';
        instruction += `,\n    "thoughts": {"content": "${thoughtsDescription}"}`;
    }

    instruction += '\n  }\n';
    instruction += ']';

    return instruction;
}

/**
 * Builds Party tracker JSON format instruction for the AI.
 * Only includes members with location === 'party' and status !== 'dead'.
 * Returns null if no active party members.
 * @returns {string|null} JSON format instruction for party tracker, or null
 */
export function buildPartyJSONInstruction() {
    const activeMembers = (extensionSettings.partyMembers || [])
        .filter(m => m.location === 'party' && m.status !== 'dead');
    if (activeMembers.length === 0) return null;

    let instruction = '[\n';
    for (let i = 0; i < activeMembers.length; i++) {
        const m = activeMembers[i];
        const comma = i < activeMembers.length - 1 ? ',' : '';
        const hpMax = m.hp?.max ?? 100;
        const mpMax = m.mp?.max ?? 50;
        const hpCurrent = m.hp?.current ?? hpMax;
        const mpCurrent = m.mp?.current ?? mpMax;
        instruction += `  {\n`;
        instruction += `    "name": "${m.name}",\n`;
        instruction += `    "hp": ${hpCurrent},\n`;
        instruction += `    "mp": ${mpCurrent},\n`;
        instruction += `    "conditions": "${m.conditions || 'None'}",\n`;
        instruction += `    "appearance": "${m.appearance || 'Current physical description'}",\n`;
        instruction += `    "clothing": "${m.clothing || 'Current clothing and equipment'}",\n`;
        instruction += `    "action": "What ${m.name} does or says this turn"\n`;
        instruction += `  }${comma}\n`;
    }
    instruction += ']';
    return instruction;
}

/**
 * Adds lock information to instruction text
 * @param {string} baseInstruction - Base instruction text
 * @returns {string} Instruction with lock information added
 */
export function addLockInstruction(baseInstruction) {
    return baseInstruction + '\n\nIMPORTANT: If an item, stat, quest, or field has "locked": true in its object, you MUST NOT change its value. Keep it exactly as it appears in the previous trackers. Only unlocked items can be modified. The "locked" field should ONLY be included if the item is actually locked - omit it for unlocked items.';
}
