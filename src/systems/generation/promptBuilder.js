/**
 * Prompt Builder Module
 * Handles all AI prompt generation for RPG tracker data
 */

import { getContext } from '../../../../../../extensions.js';
import { chat, getCurrentChatDetails, characters, this_chid } from '../../../../../../../script.js';
import { selected_group, getGroupMembers, getGroupChat } from '../../../../../../group-chats.js';
import { extensionSettings, committedTrackerData } from '../../core/state.js';
import { generateSchemaExample } from '../../types/trackerData.js';

// Type imports
/** @typedef {import('../../types/inventory.js').InventoryV2} InventoryV2 */
/** @typedef {import('../../types/trackerData.js').TrackerData} TrackerData */

/**
 * Default HTML prompt text
 */
export const DEFAULT_HTML_PROMPT = `If appropriate, include inline HTML, CSS, and JS segments whenever they enhance visual storytelling (e.g., for in-world screens, posters, books, letters, signs, crests, labels, etc.). Style them to match the setting's theme (e.g., fantasy, sci-fi), keep the text readable, and embed all assets directly (using inline SVGs only with no external scripts, libraries, or fonts). Use these elements freely and naturally within the narrative as characters would encounter them, including animations, 3D effects, pop-ups, dropdowns, websites, and so on. Do not wrap the HTML/CSS/JS in code fences!`;

/**
 * Default JSON tracker instruction prompt text
 * Use {{user}} as placeholder for the user's name (will be replaced at runtime)
 */
export const DEFAULT_JSON_TRACKER_PROMPT = `At the start of every reply, output a JSON object inside a markdown code fence (with \`\`\`json). This tracks {{user}}'s stats, inventory, skills, and scene information. Follow the exact schema shown below. Use concrete values - no placeholders or brackets. Update stats realistically based on actions and time (0% change for minutes, 1-5% normally, 5%+ only for major events). Items and skills have "name" and "description" fields. Items can grant skills via "grantsSkill", and skills show their source via "grantedBy".`;

/**
 * Default message interception prompt text
 * Guides the LLM to rewrite the user's message based on current RPG state and recent chat
 */
export const DEFAULT_MESSAGE_INTERCEPTION_PROMPT = `Act as an uncompromising Immersive Copy Editor who rewrites the user's draft to strictly adhere to {{user}}'s persona and RPG state (JSON). You must validate the feasibility of the user's intended actions against the JSON state; if the draft contradicts the state (e.g., acting smart while 'Intelligence' is low, or running while having a 'Leg Injury'), you are required to override the core intent, rewriting the action to portray immediate failure, struggle, or involuntary reaction instead of the user's desired success. Even further, if the intended course of action is physically impossible via the state or represents a thought process conceptually alien to the character's nature or current state, you are mandated to completely overwrite the user's intent. Aggressively rephrase vocabulary and syntax to match the character's specific cognitive capacity and tone. Keep the output concise and devoid of fluff; do not expand the narrative beyond the necessary state-enforced correction. Return ONLY the modified message text.`;

/**
 * Gets character card information for current chat (handles both single and group chats)
 * @returns {string} Formatted character information
 */
export async function getCharacterCardsInfo() {
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
        { id: 'str', name: 'STR', description: '', enabled: true },
        { id: 'dex', name: 'DEX', description: '', enabled: true },
        { id: 'con', name: 'CON', description: '', enabled: true },
        { id: 'int', name: 'INT', description: '', enabled: true },
        { id: 'wis', name: 'WIS', description: '', enabled: true },
        { id: 'cha', name: 'CHA', description: '', enabled: true }
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
    const deleteSkillWithItem = extensionSettings.deleteSkillWithItem;

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

    // Attributes section (if RPG attributes are enabled and should be included)
    const showRPGAttributes = trackerConfig?.userStats?.showRPGAttributes;
    const alwaysSendAttributes = trackerConfig?.userStats?.alwaysSendAttributes;
    const shouldSendAttributes = alwaysSendAttributes || extensionSettings.lastDiceRoll;
    
    if (showRPGAttributes && shouldSendAttributes) {
        const rpgAttributes = trackerConfig?.userStats?.rpgAttributes || [
            { id: 'str', name: 'STR', description: '', enabled: true },
            { id: 'dex', name: 'DEX', description: '', enabled: true },
            { id: 'con', name: 'CON', description: '', enabled: true },
            { id: 'int', name: 'INT', description: '', enabled: true },
            { id: 'wis', name: 'WIS', description: '', enabled: true },
            { id: 'cha', name: 'CHA', description: '', enabled: true }
        ];
        const enabledAttributes = rpgAttributes.filter(attr => attr && attr.enabled && attr.name && attr.id);
        
        if (enabledAttributes.length > 0) {
            let attrsJson = '  "attributes": {\n';
            const attrParts = enabledAttributes.map(attr => {
                const value = extensionSettings.classicStats?.[attr.id] ?? 10;
                return `    "${attr.name}": ${value}`;
            });
            attrsJson += attrParts.join(',\n');
            attrsJson += '\n  }';
            sections.push(attrsJson);
            
            // Add level
            const currentLevel = extensionSettings.level ?? 1;
            sections.push(`  "level": ${currentLevel}`);
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
        if (widgets.recentEvents?.enabled) infoParts.push('    "recentEvents": ["Event 1", "Event 2"]');
        
        if (infoParts.length > 0) {
            sections.push('  "infoBox": {\n' + infoParts.join(',\n') + '\n  }');
        }
    }

    // Characters section
    if (showCharacters) {
        const charConfig = trackerConfig?.presentCharacters || {};
        let charExample = '    {\n      "name": "Character Name",\n      "emoji": "🧑"';
        
        if (charConfig.relationshipFields?.length > 0) {
            // Show allowed relationship values as explanation
            const allowedRelationships = charConfig.relationshipFields.join(' | ');
            charExample += `,\n      "relationship": "(${allowedRelationships})"`;
        }
        
        const enabledFields = charConfig.customFields?.filter(f => f.enabled) || [];
        if (enabledFields.length > 0) {
            const fieldsJson = enabledFields.map(f => `        "${f.name}": "[${f.description || f.name}]"`).join(',\n');
            charExample += `,\n      "fields": {\n${fieldsJson}\n      }`;
        }
        
        // Character stats (Health, Arousal, etc.)
        const charStatsConfig = charConfig.characterStats;
        const enabledCharStats = charStatsConfig?.enabled && charStatsConfig?.customStats?.filter(s => s?.enabled && s?.name) || [];
        if (enabledCharStats.length > 0) {
            const statsJson = enabledCharStats.map(s => `        "${s.name}": 75`).join(',\n');
            charExample += `,\n      "stats": {\n${statsJson}\n      }`;
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
        // Filter to only enabled categories and handle both old (string) and new (object) formats
        const enabledCategories = skillCategories.filter(cat => {
            if (typeof cat === 'string') return true;
            return cat.enabled !== false;
        });
        
        if (enabledCategories.length > 0) {
            let skillsSection = '  "skills": {\n';
            const categoryExamples = enabledCategories.map(cat => {
                const catName = typeof cat === 'string' ? cat : cat.name;
                let skillExample = '{ "name": "Ability Name", "description": "What this ability does" }';
                if (enableItemSkillLinks) {
                    skillExample = '{ "name": "Ability", "description": "Description", "grantedBy": "Item Name" }';
                }
                return `    "${catName}": [${skillExample}]`;
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

    if (showRPGAttributes && shouldSendAttributes) {
        instructions += '- Attributes are numeric values (typically 1-20, but can be higher)\n';
        instructions += '- Level is a numeric value (typically 1+, represents character progression)\n';
    }

    instructions += '- Characters should be removed as soon as they leave the scene\n';
    instructions += '- Your list of characters must never include {{user}}\n';
    instructions += '- Empty arrays [] for sections with no items\n';
    instructions += '- null for main quest if none active\n';
    
    // Add stat descriptions if any have descriptions
    if (showStats) {
        const customStats = trackerConfig?.userStats?.customStats || [];
        const statsWithDesc = customStats.filter(s => s?.enabled && s?.description);
        if (statsWithDesc.length > 0) {
            instructions += '- Stat meanings:\n';
            statsWithDesc.forEach(stat => {
                instructions += `  • "${stat.name}": ${stat.description}\n`;
            });
        }
    }
    
    if (showSkills) {
        const skillsLabel = trackerConfig?.userStats?.skillsSection?.label || 'Skills';
        if (skillsLabel !== 'Skills') {
            instructions += `- The "skills" section represents "${skillsLabel}" in this context\n`;
        }
        
        // Add skill category descriptions if any have descriptions
        const skillCategories = trackerConfig?.userStats?.skillsSection?.customFields || [];
        const categoriesWithDesc = skillCategories.filter(cat => 
            typeof cat === 'object' && cat.description && cat.enabled !== false
        );
        if (categoriesWithDesc.length > 0) {
            instructions += `- ${skillsLabel} categories:\n`;
            categoriesWithDesc.forEach(cat => {
                instructions += `  • "${cat.name}": ${cat.description}\n`;
            });
        }
    }
    
    if (enableItemSkillLinks) {
        instructions += '- Items can grant skills: add {"grantsSkill": "Skill Name"} to the item object\n';
        instructions += '- When a skill comes from an item, add {"grantedBy": "Item Name"} to that skill object\n';
        if (deleteSkillWithItem) {
            instructions += '- If an item is removed/lost, also remove any skill it granted\n';
        }
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
            
            // Add attribute descriptions if any have descriptions
            const rpgAttributes = trackerConfig?.userStats?.rpgAttributes || [];
            const attrsWithDesc = rpgAttributes.filter(a => a?.enabled && a?.description);
            if (attrsWithDesc.length > 0) {
                instructions += 'Attribute meanings:\n';
                attrsWithDesc.forEach(attr => {
                    instructions += `  • ${attr.name}: ${attr.description}\n`;
                });
            }

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
 * Generates the current tracker state as a JSON string for SEPARATE mode injection.
 * Uses COMMITTED data (not displayed data) for generation context.
 * Similar to how <previous> is formatted, but for the current state.
 *
 * @returns {string} JSON string of current state, or empty string if no data
 */
export function generateContextualSummary() {
    // Build current state as JSON (similar to previousState in generateRPGPromptText)
    const currentState = {};
    const trackerConfig = extensionSettings.trackerConfig;
    const descriptions = {};
    
    // Stats
    if (extensionSettings.showUserStats) {
        const customStats = trackerConfig?.userStats?.customStats?.filter(s => s?.enabled) || [];
        if (customStats.length > 0) {
            currentState.stats = {};
            descriptions.stats = {};
            for (const stat of customStats) {
                currentState.stats[stat.name] = extensionSettings.userStats[stat.id] ?? 100;
                if (stat.description) {
                    descriptions.stats[stat.name] = stat.description;
                }
            }
        }
        
        // Status
        const statusConfig = trackerConfig?.userStats?.statusSection;
        if (statusConfig?.enabled) {
            currentState.status = {
                mood: extensionSettings.userStats.mood || '😐',
                fields: {}
            };
            const customFields = statusConfig.customFields || [];
            for (const field of customFields) {
                currentState.status.fields[field] = extensionSettings.userStats.conditions || 'None';
            }
        }
    }
    
    // InfoBox
    if (extensionSettings.showInfoBox && extensionSettings.infoBoxData) {
        currentState.infoBox = extensionSettings.infoBoxData;
    }
    
    // Characters - format to match schema
    if (extensionSettings.showCharacterThoughts && extensionSettings.charactersData?.length > 0) {
        // Ensure characters match the expected schema format
        currentState.characters = extensionSettings.charactersData.map(char => {
            const formatted = { name: char.name };
            if (char.relationship) formatted.relationship = char.relationship;
            if (char.emoji) formatted.emoji = char.emoji;
            if (char.fields && Object.keys(char.fields).length > 0) formatted.fields = char.fields;
            if (char.stats && Object.keys(char.stats).length > 0) formatted.stats = char.stats;
            if (char.thoughts) formatted.thoughts = char.thoughts;
            return formatted;
        });
        
        // Add character field descriptions
        const charConfig = trackerConfig?.presentCharacters;
        if (charConfig?.customFields?.length > 0) {
            descriptions.characterFields = {};
            for (const field of charConfig.customFields) {
                if (field.enabled && field.description) {
                    descriptions.characterFields[field.name] = field.description;
                }
            }
        }
        
        // Add character stats descriptions
        const charStatsConfig = charConfig?.characterStats;
        if (charStatsConfig?.enabled && charStatsConfig?.customStats?.length > 0) {
            if (!descriptions.characterStats) {
                descriptions.characterStats = {};
            }
            for (const stat of charStatsConfig.customStats) {
                if (stat.enabled && stat.description) {
                    descriptions.characterStats[stat.name] = stat.description;
                }
            }
        }
    }
    
    // Inventory - format to match schema (use "items" for simplified mode)
    if (extensionSettings.showInventory && extensionSettings.inventoryV3) {
        const inv = extensionSettings.inventoryV3;
        if (extensionSettings.useSimplifiedInventory) {
            // Simplified mode uses "items" key
            const items = inv.simplified || inv.onPerson || [];
            if (items.length > 0) {
                currentState.inventory = { items };
            }
        } else {
            // Full categorized mode
            if (inv.onPerson?.length > 0 || Object.keys(inv.stored || {}).length > 0 || inv.assets?.length > 0) {
                currentState.inventory = {
                    onPerson: inv.onPerson || [],
                    stored: inv.stored || {},
                    assets: inv.assets || []
                };
            }
        }
    }
    
    // Skills
    if (extensionSettings.showSkills && extensionSettings.skillsV2) {
        currentState.skills = extensionSettings.skillsV2;
        
        // Add skill category descriptions
        const skillCategories = trackerConfig?.userStats?.skillsSection?.customFields || [];
        const categoriesWithDesc = skillCategories.filter(cat => 
            typeof cat === 'object' && cat.enabled !== false && cat.description
        );
        if (categoriesWithDesc.length > 0) {
            descriptions.skillCategories = {};
            for (const cat of categoriesWithDesc) {
                descriptions.skillCategories[cat.name] = cat.description;
            }
        }
    }
    
    // Quests
    if (extensionSettings.showQuests && extensionSettings.questsV2) {
        currentState.quests = extensionSettings.questsV2;
    }
    
    // Attributes and level (if RPG attributes are enabled and should be included)
    const showRPGAttributes = trackerConfig?.userStats?.showRPGAttributes;
    const alwaysSendAttributes = trackerConfig?.userStats?.alwaysSendAttributes;
    const shouldSendAttributes = alwaysSendAttributes || extensionSettings.lastDiceRoll;
    
    if (showRPGAttributes && shouldSendAttributes) {
        const rpgAttributes = trackerConfig?.userStats?.rpgAttributes || [
            { id: 'str', name: 'STR', description: '', enabled: true },
            { id: 'dex', name: 'DEX', description: '', enabled: true },
            { id: 'con', name: 'CON', description: '', enabled: true },
            { id: 'int', name: 'INT', description: '', enabled: true },
            { id: 'wis', name: 'WIS', description: '', enabled: true },
            { id: 'cha', name: 'CHA', description: '', enabled: true }
        ];
        const enabledAttributes = rpgAttributes.filter(attr => attr && attr.enabled && attr.name && attr.id);
        
        if (enabledAttributes.length > 0) {
            currentState.attributes = {};
            descriptions.attributes = {};
            for (const attr of enabledAttributes) {
                const value = extensionSettings.classicStats?.[attr.id] ?? 10;
                currentState.attributes[attr.name] = value;
                if (attr.description) {
                    descriptions.attributes[attr.name] = attr.description;
                }
            }
            
            // Add level
            currentState.level = extensionSettings.level ?? 1;
        }
    }
    
    // Add descriptions metadata if any exist
    if (Object.keys(descriptions).length > 0) {
        currentState._descriptions = descriptions;
    }
    
    // Return JSON string if we have any data, otherwise empty string
    if (Object.keys(currentState).length > 0) {
        return JSON.stringify(currentState, null, 2);
    }
    
    return '';
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
                previousState.stats[stat.name] = extensionSettings.userStats[stat.id] ?? 100;
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
    
    // Characters - format to match schema
    if (extensionSettings.showCharacterThoughts && extensionSettings.charactersData?.length > 0) {
        // Ensure characters match the expected schema format
        previousState.characters = extensionSettings.charactersData.map(char => {
            const formatted = { name: char.name };
            if (char.relationship) formatted.relationship = char.relationship;
            if (char.emoji) formatted.emoji = char.emoji;
            if (char.fields && Object.keys(char.fields).length > 0) formatted.fields = char.fields;
            if (char.stats && Object.keys(char.stats).length > 0) formatted.stats = char.stats;
            if (char.thoughts) formatted.thoughts = char.thoughts;
            return formatted;
        });
    }
    
    // Inventory - format to match schema (use "items" for simplified mode)
    if (extensionSettings.showInventory && extensionSettings.inventoryV3) {
        const inv = extensionSettings.inventoryV3;
        if (extensionSettings.useSimplifiedInventory) {
            // Simplified mode uses "items" key
            const items = inv.simplified || inv.onPerson || [];
            if (items.length > 0) {
                previousState.inventory = { items };
            }
        } else {
            // Full categorized mode
            if (inv.onPerson?.length > 0 || Object.keys(inv.stored || {}).length > 0 || inv.assets?.length > 0) {
                previousState.inventory = {
                    onPerson: inv.onPerson || [],
                    stored: inv.stored || {},
                    assets: inv.assets || []
                };
            }
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
    
    // Attributes and level (if RPG attributes are enabled and should be included)
    const trackerConfig = extensionSettings.trackerConfig;
    const showRPGAttributes = trackerConfig?.userStats?.showRPGAttributes;
    const alwaysSendAttributes = trackerConfig?.userStats?.alwaysSendAttributes;
    const shouldSendAttributes = alwaysSendAttributes || extensionSettings.lastDiceRoll;
    
    if (showRPGAttributes && shouldSendAttributes) {
        const rpgAttributes = trackerConfig?.userStats?.rpgAttributes || [
            { id: 'str', name: 'STR', description: '', enabled: true },
            { id: 'dex', name: 'DEX', description: '', enabled: true },
            { id: 'con', name: 'CON', description: '', enabled: true },
            { id: 'int', name: 'INT', description: '', enabled: true },
            { id: 'wis', name: 'WIS', description: '', enabled: true },
            { id: 'cha', name: 'CHA', description: '', enabled: true }
        ];
        const enabledAttributes = rpgAttributes.filter(attr => attr && attr.enabled && attr.name && attr.id);
        
        if (enabledAttributes.length > 0) {
            previousState.attributes = {};
            for (const attr of enabledAttributes) {
                const value = extensionSettings.classicStats?.[attr.id] ?? 10;
                previousState.attributes[attr.name] = value;
            }
            
            // Add level
            previousState.level = extensionSettings.level ?? 1;
        }
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

    // Add JSON format instructions - include attributes if alwaysSendAttributes is enabled
    const includeAttributes = alwaysSendAttributes || extensionSettings.lastDiceRoll;
    promptText += generateJSONTrackerInstructions(false, false, includeAttributes);

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

