/**
 * Prompt Builder Module
 * Handles all AI prompt generation for RPG tracker data
 */

import { getContext } from '../../../../../../extensions.js';
import { chat, getCurrentChatDetails, characters, this_chid } from '../../../../../../../script.js';
import { selected_group, getGroupMembers, getGroupChat } from '../../../../../../group-chats.js';
import { extensionSettings, committedTrackerData, FEATURE_FLAGS } from '../../core/state.js';
import { generateSchemaExample } from '../../types/trackerData.js';

// Type imports
/** @typedef {import('../../types/inventory.js').InventoryV2} InventoryV2 */
/** @typedef {import('../../types/trackerData.js').TrackerData} TrackerData */

/**
 * Default HTML prompt text
 */
export const DEFAULT_HTML_PROMPT = `If appropriate, include inline HTML, CSS, and JS segments whenever they enhance visual storytelling (e.g., for in-world screens, posters, books, letters, signs, crests, labels, etc.). Style them to match the setting's theme (e.g., fantasy, sci-fi), keep the text readable, and embed all assets directly (using inline SVGs only with no external scripts, libraries, or fonts). Use these elements freely and naturally within the narrative as characters would encounter them, including animations, 3D effects, pop-ups, dropdowns, websites, and so on. Do not wrap the HTML/CSS/JS in code fences!`;

/**
 * Default tracker instruction prompt text (legacy text format)
 * Use {{user}} as placeholder for the user's name (will be replaced at runtime)
 */
export const DEFAULT_TRACKER_PROMPT = `At the start of every reply, you must attach an update to the trackers in EXACTLY the same format as below, enclosed in separate Markdown code fences. Replace X with actual numbers (e.g., 69) and replace all [placeholders] with concrete in-world details that {{user}} perceives about the current scene and the present characters. Do NOT keep the brackets or placeholder text in your response. For example: [Location] becomes Forest Clearing, [Mood Emoji] becomes 😊. Consider the last trackers in the conversation (if they exist). Manage them accordingly and realistically; raise, lower, change, or keep the values unchanged based on the user's actions, the passage of time, and logical consequences (0% if the time progressed only by a few minutes, 1-5% normally, and above 5% only if a major time-skip/event occurs).`;

/**
 * Default JSON tracker instruction prompt text
 * Use {{user}} as placeholder for the user's name (will be replaced at runtime)
 */
export const DEFAULT_JSON_TRACKER_PROMPT = `At the start of every reply, output a JSON object inside a markdown code fence (with \`\`\`json). This tracks {{user}}'s stats, inventory, skills, and scene information. Follow the exact schema shown below. Use concrete values - no placeholders or brackets. Update stats realistically based on actions and time (0% change for minutes, 1-5% normally, 5%+ only for major events). Items and skills have "name" and "description" fields. Items can grant skills via "grantsSkill", and skills show their source via "grantedBy".`;

/**
 * Gets character card information for current chat (handles both single and group chats)
 * @returns {string} Formatted character information
 */
async function getCharacterCardsInfo() {
    let characterInfo = '';

    // Check if in group chat
    if (selected_group) {
        const group = await getGroupChat(selected_group);
        const groupMembers = getGroupMembers(selected_group);

        if (groupMembers && groupMembers.length > 0) {
            characterInfo += 'Characters in this roleplay:\n\n';

            // Filter out disabled (muted) members
            const disabledMembers = group?.disabled_members || [];
            let characterIndex = 0;

            groupMembers.forEach((member) => {
                if (!member || !member.name) return;

                // Skip muted characters
                if (member.avatar && disabledMembers.includes(member.avatar)) {
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
        return `Inventory: ${inventory}`;
    }

    // Handle v2 object format
    if (inventory && typeof inventory === 'object' && inventory.version === 2) {
        // Check for simplified inventory mode
        if (inventory.simplified || extensionSettings.useSimplifiedInventory) {
            const items = inventory.items || inventory.onPerson || 'None';
            return `Inventory: ${items}`;
        }

        // Full categorized format
        let summary = '';

        // Add On Person section
        if (inventory.onPerson && inventory.onPerson !== 'None') {
            summary += `On Person: ${inventory.onPerson}\n`;
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

    // Add level at the end
    attributeParts.push(`LVL ${extensionSettings.level}`);

    return attributeParts.join(', ');
}

/**
 * @deprecated Use generateJSONTrackerInstructions instead. This legacy text format
 * is kept for backwards compatibility with older LLM responses.
 * 
 * Generates an example block showing current tracker states in markdown code blocks.
 * Uses COMMITTED data (not displayed data) for generation context.
 *
 * @returns {string} Formatted example text with tracker data in code blocks
 */
export function generateTrackerExample() {
    let example = '';

    // Use COMMITTED data for generation context, not displayed data
    // Wrap each tracker section in markdown code blocks
    
    // Build a combined stats/inventory/quests block if any are enabled
    let statsBlock = '';
    
    if (extensionSettings.showUserStats && committedTrackerData.userStats) {
        statsBlock += committedTrackerData.userStats;
    }

    // Add inventory example if enabled (and not already in userStats) - case-insensitive check
    if (extensionSettings.showInventory && extensionSettings.userStats?.inventory) {
        const inventorySummary = buildInventorySummary(extensionSettings.userStats.inventory);
        if (inventorySummary && inventorySummary !== 'None') {
            // Only add if not already present in userStats (case-insensitive)
            const statsBlockLower = statsBlock.toLowerCase();
            if (!statsBlockLower.includes('on person:') && !statsBlockLower.includes('inventory:')) {
                if (statsBlock) statsBlock += '\n';
                statsBlock += inventorySummary;
            }
        }
    }

    // Add quests example if enabled - case-insensitive check
    if (extensionSettings.showQuests && extensionSettings.quests) {
        let questsText = '';
        if (extensionSettings.quests.main && extensionSettings.quests.main !== 'None') {
            questsText += `Main Quests: ${extensionSettings.quests.main}\n`;
        }
        if (extensionSettings.quests.optional && extensionSettings.quests.optional.length > 0) {
            const optionalQuests = extensionSettings.quests.optional.filter(q => q && q !== 'None').join(', ');
            if (optionalQuests) {
                questsText += `Optional Quests: ${optionalQuests}`;
            }
        }
        // Only add if not already present in userStats (case-insensitive)
        const statsBlockLower = statsBlock.toLowerCase();
        if (questsText && !statsBlockLower.includes('main quest') && !statsBlockLower.includes('optional quest')) {
            if (statsBlock) statsBlock += '\n';
            statsBlock += questsText;
        }
    }

    if (statsBlock) {
        example += '```\n' + statsBlock.trim() + '\n```\n\n';
    }

    if (extensionSettings.showInfoBox && committedTrackerData.infoBox) {
        example += '```\n' + committedTrackerData.infoBox + '\n```\n\n';
    }

    if (extensionSettings.showCharacterThoughts && committedTrackerData.characterThoughts) {
        example += '```\n' + committedTrackerData.characterThoughts + '\n```';
    }

    return example.trim();
}

/**
 * @deprecated Use generateJSONTrackerInstructions instead. This legacy text format
 * is kept for backwards compatibility with older LLM responses.
 * 
 * Generates the instruction portion - format specifications and guidelines.
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

    // Check if any trackers are enabled (including inventory, skills and quests as independent sections)
    const hasAnyTrackers = extensionSettings.showUserStats || extensionSettings.showInfoBox || 
                           extensionSettings.showCharacterThoughts || extensionSettings.showSkills ||
                           extensionSettings.showInventory || extensionSettings.showQuests;

    // Only add tracker instructions if at least one tracker is enabled
    if (hasAnyTrackers) {
        // Universal instruction header - use custom prompt if set, otherwise use default
        const trackerPrompt = (extensionSettings.customTrackerPrompt || DEFAULT_TRACKER_PROMPT).replace(/\{\{user\}\}/g, userName);
        instructions += `\n${trackerPrompt}\n`;

        // Check if we need a combined stats/inventory/quests code block
        const hasStatsBlock = extensionSettings.showUserStats || extensionSettings.showInventory || extensionSettings.showQuests;

        if (hasStatsBlock) {
            const userStatsConfig = trackerConfig?.userStats;
            const enabledStats = userStatsConfig?.customStats?.filter(s => s && s.enabled && s.name) || [];

            instructions += '```\n';
            
            // Add user stats section if enabled
            if (extensionSettings.showUserStats) {
                instructions += `${userName}'s Stats\n`;
                instructions += '---\n';

                // Add custom stats dynamically
                for (const stat of enabledStats) {
                    instructions += `- ${stat.name}: X%\n`;
                }

                // Add status section if enabled
                if (userStatsConfig?.statusSection?.enabled) {
                    const statusFields = userStatsConfig.statusSection.customFields || [];
                    const statusFieldsText = statusFields.map(f => `${f}`).join(', ');

                    if (userStatsConfig.statusSection.showMoodEmoji) {
                        instructions += `Status: [Mood Emoji${statusFieldsText ? ', ' + statusFieldsText : ''}]\n`;
                    } else if (statusFieldsText) {
                        instructions += `Status: [${statusFieldsText}]\n`;
                    }
                }

                // Add skills section if enabled in config AND NOT shown as separate section
                // When showSkills is true, skills are in their own tab and have their own code block
                if (userStatsConfig?.skillsSection?.enabled && !extensionSettings.showSkills) {
                    const skillFields = userStatsConfig.skillsSection.customFields || [];
                    const skillFieldsText = skillFields.map(f => `[${f}]`).join(', ');
                    instructions += `Skills: [${skillFieldsText || 'Skill1, Skill2, etc.'}]\n`;
                }
            }

            // Add inventory format - independent of showUserStats
            if (extensionSettings.showInventory) {
                if (extensionSettings.useSimplifiedInventory) {
                    // Simplified single-line inventory format
                    instructions += 'Inventory: [Items currently carried/worn/owned, or "None"]\n';
                } else if (FEATURE_FLAGS.useNewInventory) {
                    // Full v2 categorized inventory format
                    instructions += 'On Person: [Items currently carried/worn, or "None"]\n';
                    instructions += 'Stored - [Location Name]: [Items stored at this location]\n';
                    instructions += '(Add multiple "Stored - [Location]:" lines as needed for different storage locations)\n';
                    instructions += 'Assets: [Vehicles, property, major possessions, or "None"]\n';
                } else {
                    // Legacy v1 format
                    instructions += 'Inventory: [Clothing/Armor, Inventory Items (list of important items, or "None")]\\n';
                }
            }

            // Add quests section - independent of showUserStats
            if (extensionSettings.showQuests) {
                instructions += 'Main Quests: [Short title of the currently active main quest (for example, "Save the world"), or "None"]\n';
                instructions += 'Optional Quests: [Short titles of the currently active optional quests (for example, "Find Zandik\'s book"), or "None"]\n';
            }

            instructions += '```\n\n';
        }

        // Add separate skills section when showSkills is enabled
        if (extensionSettings.showSkills) {
            const skillsConfig = trackerConfig?.userStats?.skillsSection;
            const skillFields = skillsConfig?.customFields || [];
            
            if (skillFields.length > 0) {
                instructions += '```\n';
                instructions += 'Skills\n';
                instructions += '---\n';
                
                // Each skill category contains a list of abilities
                for (const skillName of skillFields) {
                    if (extensionSettings.enableItemSkillLinks) {
                        instructions += `${skillName}: [Abilities in this category, e.g. "Sword Fighting (Iron Sword), Parry" or "None"]\n`;
                    } else {
                        instructions += `${skillName}: [Abilities in this category, e.g. "Lockpicking, Sneaking" or "None"]\n`;
                    }
                }
                
                if (extensionSettings.enableItemSkillLinks) {
                    instructions += '\n(Abilities from items use parentheses: "Skill (Item)". Remove if item is removed or unequipped.)\n';
                }
                
                instructions += '```\n\n';
            }
        }

        if (extensionSettings.showInfoBox) {
            const infoBoxConfig = trackerConfig?.infoBox;
            const widgets = infoBoxConfig?.widgets || {};

            instructions += '```\n';
            instructions += 'Info Box\n';
            instructions += '---\n';

            // Add only enabled widgets
            if (widgets.date?.enabled) {
                instructions += 'Date: [Weekday, Month, Year]\n';
            }
            if (widgets.weather?.enabled) {
                instructions += 'Weather: [Weather Emoji, Forecast]\n';
            }
            if (widgets.temperature?.enabled) {
                const unit = widgets.temperature.unit === 'F' ? '°F' : '°C';
                instructions += `Temperature: [Temperature in ${unit}]\n`;
            }
            if (widgets.time?.enabled) {
                instructions += 'Time: [Time Start → Time End]\n';
            }
            if (widgets.location?.enabled) {
                instructions += 'Location: [Location]\n';
            }
            if (widgets.recentEvents?.enabled) {
                instructions += 'Recent Events: [Up to three past events leading to the ongoing scene (short descriptors with no details, for example, "last-night date with Mary")]\n';
            }

            instructions += '```\n\n';
        }

        if (extensionSettings.showCharacterThoughts) {
            const presentCharsConfig = trackerConfig?.presentCharacters;
            const enabledFields = presentCharsConfig?.customFields?.filter(f => f && f.enabled && f.name) || [];
            const relationshipFields = presentCharsConfig?.relationshipFields || [];
            const thoughtsConfig = presentCharsConfig?.thoughts;
            const characterStats = presentCharsConfig?.characterStats;
            const enabledCharStats = characterStats?.enabled && characterStats?.customStats?.filter(s => s && s.enabled && s.name) || [];

            instructions += '```\n';
            instructions += 'Present Characters\n';
            instructions += '---\n';

            // Build relationship placeholders (e.g., "Lover/Friend")
            const relationshipPlaceholders = relationshipFields
                .filter(r => r && r.trim())
                .map(r => `${r}`)
                .join('/');

            // Build custom field placeholders (e.g., "[Appearance] | [Current Action]")
            const fieldPlaceholders = enabledFields
                .map(f => `[${f.name}]`)
                .join(' | ');

            // Character block format
            instructions += `- [Name (do not include ${userName}; state "Unavailable" if no major characters are present in the scene)]\n`;

            // Details line with emoji and custom fields
            if (fieldPlaceholders) {
                instructions += `Details: [Present Character's Emoji] | ${fieldPlaceholders}\n`;
            } else {
                instructions += `Details: [Present Character's Emoji]\n`;
            }

            // Relationship line (only if relationships are enabled)
            if (relationshipPlaceholders) {
                instructions += `Relationship: [(choose one: ${relationshipPlaceholders})]\n`;
            }

            // Stats line (if enabled)
            if (enabledCharStats.length > 0) {
                const statPlaceholders = enabledCharStats.map(s => `${s.name}: X%`).join(' | ');
                instructions += `Stats: ${statPlaceholders}\n`;
            }

            // Thoughts line (if enabled)
            if (thoughtsConfig?.enabled) {
                const thoughtsName = thoughtsConfig.name || 'Thoughts';
                const thoughtsDescription = thoughtsConfig.description || 'Internal monologue (in first person POV, up to three sentences long)';
                instructions += `${thoughtsName}: [${thoughtsDescription}]\n`;
            }

            instructions += `- … (Repeat the format above for every other present major character)\n`;

            instructions += '```\n\n';
        }

        // Only add continuation instruction if includeContinuation is true
        if (includeContinuation) {
            instructions += `After updating the trackers, continue directly from where the last message in the chat history left off. Ensure the trackers you provide naturally reflect and influence the narrative. Character behavior, dialogue, and story events should acknowledge these conditions when relevant, such as fatigue affecting the protagonist's performance, low hygiene influencing their social interactions, environmental factors shaping the scene, a character's emotional state coloring their responses, and so on. Remember, all bracketed placeholders (e.g., [Location], [Mood Emoji]) MUST be replaced with actual content without the square brackets.\n\n`;
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

    return instructions;
}

/**
 * Generates JSON-based tracker instructions.
 * Creates a prompt asking the LLM to output structured JSON data.
 * 
 * @param {boolean} includeHtmlPrompt - Whether to include the HTML prompt
 * @param {boolean} includeContinuation - Whether to include continuation instruction
 * @param {boolean} includeAttributes - Whether to include RPG attributes
 * @returns {string} Formatted JSON instruction text for the AI
 */
export function generateJSONTrackerInstructions(includeHtmlPrompt = true, includeContinuation = true, includeAttributes = true) {
    const userName = getContext().name1;
    const trackerConfig = extensionSettings.trackerConfig;
    let instructions = '';

    // Check which sections are enabled
    const showStats = extensionSettings.showUserStats;
    const showInfoBox = extensionSettings.showInfoBox;
    const showCharacters = extensionSettings.showCharacterThoughts;
    const showInventory = extensionSettings.showInventory;
    const showSkills = extensionSettings.showSkills;
    const showQuests = extensionSettings.showQuests;
    const enableItemSkillLinks = extensionSettings.enableItemSkillLinks;

    const hasAnyTrackers = showStats || showInfoBox || showCharacters || showInventory || showSkills || showQuests;

    if (!hasAnyTrackers) {
        return instructions;
    }

    // JSON instruction header
    const jsonPrompt = (extensionSettings.customTrackerPrompt || DEFAULT_JSON_TRACKER_PROMPT).replace(/\{\{user\}\}/g, userName);
    instructions += `\n${jsonPrompt}\n\n`;

    // Build the JSON schema example based on enabled sections
    instructions += '```json\n';
    instructions += '{\n';

    let sections = [];

    // Stats section
    if (showStats) {
        const enabledStats = trackerConfig?.userStats?.customStats?.filter(s => s?.enabled && s?.name) || [];
        if (enabledStats.length > 0) {
            let statsJson = '  "stats": {\n';
            statsJson += enabledStats.map(s => `    "${s.name}": 75`).join(',\n');
            statsJson += '\n  }';
            sections.push(statsJson);
        }

        // Status section
        const statusConfig = trackerConfig?.userStats?.statusSection;
        if (statusConfig?.enabled) {
            let statusJson = '  "status": {\n';
            const statusParts = [];
            if (statusConfig.showMoodEmoji) {
                statusParts.push('    "mood": "😊"');
            }
            const customFields = statusConfig.customFields || [];
            if (customFields.length > 0) {
                const fieldsJson = customFields.map(f => `      "${f}": "[${f} description]"`).join(',\n');
                statusParts.push(`    "fields": {\n${fieldsJson}\n    }`);
            }
            statusJson += statusParts.join(',\n');
            statusJson += '\n  }';
            sections.push(statusJson);
        }
    }

    // Info Box section
    if (showInfoBox) {
        const widgets = trackerConfig?.infoBox?.widgets || {};
        const infoParts = [];
        if (widgets.date?.enabled) infoParts.push('    "date": "Monday, March 15, 1242"');
        if (widgets.time?.enabled) infoParts.push('    "time": "14:00 → 15:30"');
        if (widgets.weather?.enabled) infoParts.push('    "weather": "☀️ Sunny"');
        if (widgets.temperature?.enabled) {
            const unit = widgets.temperature.unit === 'F' ? '°F' : '°C';
            infoParts.push(`    "temperature": "22${unit}"`);
        }
        if (widgets.location?.enabled) infoParts.push('    "location": "Forest Clearing"');
        if (widgets.recentEvents?.enabled) infoParts.push('    "recentEvents": "Brief summary of recent events"');
        
        if (infoParts.length > 0) {
            sections.push('  "infoBox": {\n' + infoParts.join(',\n') + '\n  }');
        }
    }

    // Characters section
    if (showCharacters) {
        const charConfig = trackerConfig?.presentCharacters || {};
        let charExample = '    {\n      "name": "Character Name"';
        
        if (charConfig.relationshipFields?.length > 0) {
            charExample += `,\n      "relationship": "${charConfig.relationshipFields[0]}"`;
        }
        
        const enabledFields = charConfig.customFields?.filter(f => f.enabled) || [];
        if (enabledFields.length > 0) {
            const fieldsJson = enabledFields.map(f => `        "${f.name}": "[${f.description || f.name}]"`).join(',\n');
            charExample += `,\n      "fields": {\n${fieldsJson}\n      }`;
        }
        
        if (charConfig.thoughts?.enabled) {
            charExample += ',\n      "thoughts": "Character\'s inner thoughts in first person..."';
        }
        
        charExample += '\n    }';
        sections.push('  "characters": [\n' + charExample + '\n  ]');
    }

    // Inventory section
    if (showInventory) {
        let invSection = '  "inventory": {\n';
        
        if (extensionSettings.useSimplifiedInventory) {
            // Simplified: single list
            let itemExample = '{ "name": "Item Name", "description": "What it is" }';
            if (enableItemSkillLinks) {
                itemExample = '{ "name": "Iron Sword", "description": "A sturdy blade", "grantsSkill": "Sword Fighting" }';
            }
            invSection += `    "items": [${itemExample}]\n`;
        } else {
            // Full categorized inventory
            let itemExample = '{ "name": "Item", "description": "Description" }';
            if (enableItemSkillLinks) {
                itemExample = '{ "name": "Iron Sword", "description": "A sturdy blade", "grantsSkill": "Sword Fighting" }';
            }
            invSection += `    "onPerson": [${itemExample}],\n`;
            invSection += '    "stored": { "Location Name": [{ "name": "Stored Item", "description": "Description" }] },\n';
            invSection += '    "assets": [{ "name": "Property/Vehicle", "description": "Description" }]\n';
        }
        
        invSection += '  }';
        sections.push(invSection);
    }

    // Skills section
    if (showSkills) {
        const skillCategories = trackerConfig?.userStats?.skillsSection?.customFields || [];
        if (skillCategories.length > 0) {
            let skillsSection = '  "skills": {\n';
            const categoryExamples = skillCategories.map(cat => {
                let skillExample = '{ "name": "Ability Name", "description": "What this ability does" }';
                if (enableItemSkillLinks) {
                    skillExample = '{ "name": "Ability", "description": "Description", "grantedBy": "Item Name" }';
                }
                return `    "${cat}": [${skillExample}]`;
            });
            skillsSection += categoryExamples.join(',\n');
            skillsSection += '\n  }';
            sections.push(skillsSection);
        }
    }

    // Quests section
    if (showQuests) {
        let questsSection = '  "quests": {\n';
        questsSection += '    "main": { "name": "Main Quest Title", "description": "Primary objective" },\n';
        questsSection += '    "optional": [{ "name": "Side Quest", "description": "Optional objective" }]\n';
        questsSection += '  }';
        sections.push(questsSection);
    }

    instructions += sections.join(',\n');
    instructions += '\n}\n```\n\n';

    // Add notes about the format
    instructions += 'Important:\n';
    instructions += '- Output ONLY valid JSON inside the code fence\n';
    instructions += '- Use actual values, not placeholders like [Location]\n';
    instructions += '- Stats are percentages (0-100)\n';
    instructions += '- Empty arrays [] for sections with no items\n';
    instructions += '- null for main quest if none active\n';
    
    if (enableItemSkillLinks) {
        instructions += '- Items can grant skills: add "grantsSkill": "Skill Name" to the item\n';
        instructions += '- Skills from items: add "grantedBy": "Item Name" to the skill\n';
        instructions += '- If an item is removed/lost, remove its linked skill too\n';
    }
    
    instructions += '\n';

    // Continuation instruction
    if (includeContinuation) {
        instructions += `After the JSON block, continue the story naturally from where the last message left off. The tracker data should reflect and influence the narrative - fatigue affects performance, mood colors dialogue, etc.\n\n`;
    }

    // Attributes
    if (includeAttributes) {
        const alwaysSendAttributes = trackerConfig?.userStats?.alwaysSendAttributes;
        const shouldSendAttributes = alwaysSendAttributes || extensionSettings.lastDiceRoll;

        if (shouldSendAttributes) {
            const attributesString = buildAttributesString();
            instructions += `${userName}'s attributes: ${attributesString}\n`;

            if (extensionSettings.lastDiceRoll) {
                const roll = extensionSettings.lastDiceRoll;
                instructions += `${userName} rolled ${roll.total} on ${roll.formula}. Determine success/failure based on attributes.\n\n`;
            } else {
                instructions += '\n';
            }
        }
    }

    // HTML prompt
    if (extensionSettings.enableHtmlPrompt && includeHtmlPrompt) {
        const htmlPrompt = extensionSettings.customHtmlPrompt || DEFAULT_HTML_PROMPT;
        instructions += htmlPrompt;
    }

    return instructions;
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

    // Helper function to clean tracker data (remove code fences and separator lines)
    const cleanTrackerData = (data) => {
        if (!data) return '';
        return data
            .split('\n')
            .filter(line => {
                const trimmed = line.trim();
                return trimmed &&
                       !trimmed.startsWith('```') &&
                       trimmed !== '---';
            })
            .join('\n');
    };

    // Add User Stats tracker data if enabled
    if (extensionSettings.showUserStats && committedTrackerData.userStats) {
        const cleanedStats = cleanTrackerData(committedTrackerData.userStats);
        if (cleanedStats) {
            summary += cleanedStats + '\n\n';
        }
    }

    // Add Info Box tracker data if enabled
    if (extensionSettings.showInfoBox && committedTrackerData.infoBox) {
        const cleanedInfoBox = cleanTrackerData(committedTrackerData.infoBox);
        if (cleanedInfoBox) {
            summary += cleanedInfoBox + '\n\n';
        }
    }

    // Add Present Characters tracker data if enabled
    if (extensionSettings.showCharacterThoughts && committedTrackerData.characterThoughts) {
        const cleanedThoughts = cleanTrackerData(committedTrackerData.characterThoughts);
        if (cleanedThoughts) {
            summary += cleanedThoughts + '\n\n';
        }
    }

    // Add inventory context if enabled (only if not already present in cleaned stats)
    if (extensionSettings.showInventory && extensionSettings.userStats?.inventory) {
        const inventorySummary = buildInventorySummary(extensionSettings.userStats.inventory);
        if (inventorySummary && inventorySummary !== 'None') {
            // Check if inventory is already in the summary (case-insensitive)
            const summaryLower = summary.toLowerCase();
            if (!summaryLower.includes('inventory:') && !summaryLower.includes('on person:')) {
                summary += inventorySummary + '\n\n';
            }
        }
    }

    // Add quests context if enabled (only if not already present in cleaned stats)
    if (extensionSettings.showQuests && extensionSettings.quests) {
        const summaryLower = summary.toLowerCase();
        // Only add if not already present
        if (!summaryLower.includes('main quest') && !summaryLower.includes('optional quest')) {
            if (extensionSettings.quests.main && extensionSettings.quests.main !== 'None') {
                summary += `Main Quests: ${extensionSettings.quests.main}\n`;
            }
            if (extensionSettings.quests.optional && extensionSettings.quests.optional.length > 0) {
                const optionalQuests = extensionSettings.quests.optional.filter(q => q && q !== 'None').join(', ');
                if (optionalQuests) {
                    summary += `Optional Quests: ${optionalQuests}\n`;
                }
            }
            summary += '\n';
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
 * Generates the RPG tracking prompt text for separate mode.
 * Shows previous data in JSON format and requests JSON response.
 *
 * @returns {string} Full prompt text for separate tracker generation
 */
export function generateRPGPromptText() {
    const userName = getContext().name1;

    let promptText = '';

    promptText += `Here are the previous trackers in JSON format that you should consider when responding:\n`;
    promptText += `<previous>\n`;

    // Build previous state as JSON
    const previousState = {};
    
    // Stats
    if (extensionSettings.showUserStats) {
        const customStats = extensionSettings.trackerConfig?.userStats?.customStats?.filter(s => s?.enabled) || [];
        if (customStats.length > 0) {
            previousState.stats = {};
            for (const stat of customStats) {
                previousState.stats[stat.name] = extensionSettings.userStats[stat.id] || 100;
            }
        }
        
        // Status
        const statusConfig = extensionSettings.trackerConfig?.userStats?.statusSection;
        if (statusConfig?.enabled) {
            previousState.status = {
                mood: extensionSettings.userStats.mood || '😐',
                fields: {}
            };
            const customFields = statusConfig.customFields || [];
            for (const field of customFields) {
                previousState.status.fields[field] = extensionSettings.userStats.conditions || 'None';
            }
        }
    }
    
    // InfoBox
    if (extensionSettings.showInfoBox && extensionSettings.infoBoxData) {
        previousState.infoBox = extensionSettings.infoBoxData;
    }
    
    // Characters
    if (extensionSettings.showCharacterThoughts && extensionSettings.charactersData?.length > 0) {
        previousState.characters = extensionSettings.charactersData;
    }
    
    // Inventory
    if (extensionSettings.showInventory) {
        if (extensionSettings.inventoryV3 && (extensionSettings.inventoryV3.onPerson?.length > 0 || 
            Object.keys(extensionSettings.inventoryV3.stored || {}).length > 0 ||
            extensionSettings.inventoryV3.assets?.length > 0)) {
            previousState.inventory = extensionSettings.inventoryV3;
        }
    }
    
    // Skills
    if (extensionSettings.showSkills && extensionSettings.skillsV2) {
        previousState.skills = extensionSettings.skillsV2;
    }
    
    // Quests
    if (extensionSettings.showQuests && extensionSettings.questsV2) {
        previousState.quests = extensionSettings.questsV2;
    }
    
    // Output as JSON if we have any data, otherwise indicate first update
    if (Object.keys(previousState).length > 0) {
        promptText += '```json\n';
        promptText += JSON.stringify(previousState, null, 2);
        promptText += '\n```\n';
    } else {
        promptText += 'None - this is the first update.\n';
    }

    promptText += `</previous>\n`;

    // Add JSON format instructions
    promptText += generateJSONTrackerInstructions(false, false, false);

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
        systemMessage += characterInfo + '\n\n';
    }

    systemMessage += `Here is the description of the protagonist for reference:\n`;
    systemMessage += `<protagonist>\n{{persona}}\n</protagonist>\n`;
    systemMessage += `\n\n`;
    systemMessage += `Here are the last few messages in the conversation history (between the user and the roleplayer assistant) you should reference when responding:\n<history>`;

    messages.push({
        role: 'system',
        content: systemMessage
    });

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
    instructionMessage += `Provide ONLY the requested data in the exact formats specified above. Do not include any roleplay response, other text, or commentary. Remember, all bracketed placeholders (e.g., [Location], [Mood Emoji]) MUST be replaced with actual content without the square brackets.`;

    messages.push({
        role: 'user',
        content: instructionMessage
    });

    return messages;
}
