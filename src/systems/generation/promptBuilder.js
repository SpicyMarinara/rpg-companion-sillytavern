/**
 * Prompt Builder Module
 * Handles all AI prompt generation for RPG tracker data
 */

import { getContext } from '../../../../../../extensions.js';
import { chat, characters, this_chid } from '../../../../../../../script.js';
import { selected_group, getGroupMembers, getGroupChat } from '../../../../../../group-chats.js';
import { extensionSettings, committedTrackerData } from '../../core/state.js';

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
export const DEFAULT_MESSAGE_INTERCEPTION_PROMPT = `Act as an uncompromising Immersive Copy Editor who rewrites the user's draft to strictly adhere to {{user}}'s persona and RPG state (JSON). You must validate the feasibility of the user's intended thoughts, actions and speech for {{user}} to take against {{user}}'s JSON state; if the draft contradicts said state (e.g. having good ideas while 'Intelligence' is low, or running while having a 'Leg Injury', or clearly enunciating when having a 'Lisp'), you are required to override the draft, rewriting the message to make it more realistic, instead adhering exactly to the user's desires. Be careful not apply speech modifications to narration or thoughts (e.g. a 'Lisp' would only be reflected in spoken words, not in thoughts or narration). Aggressively rephrase vocabulary and syntax to match the character's specific cognitive capacity and tone. Keep the output concise and devoid of fluff; do not expand the narrative beyond the necessary state-enforced correction. Never include information that was not already present in the original draft. Never narrate the consequences of {{user}}'s actions, only what they are. You are not contributing to the narrative, you are editing what the next message is going to be. Return ONLY the modified message text. Make sure to format your message appropriately, using the correct punctuation and signs, whether it's speech, thoughts, or plain narrative text.`;

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
// buildInventorySummary removed; structured inventory is used directly

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

    const sections = [];

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
                statusParts.push(`    "mood": "😊"`);
            }
            const customFields = statusConfig.customFields || [];
            if (customFields.length > 0) {
                const fieldsJson = customFields.map(f => `      "${f}": "[${f} value]"`).join(',\n');
                statusParts.push(`    "fields": {\n${fieldsJson}\n    }`);
            }
            statusJson += statusParts.join(',\n');
            statusJson += '\n  }';
            sections.push(statusJson);
        }

        // Skills section
        const skillsSectionEnabled = trackerConfig?.userStats?.skillsSection?.enabled || false;
        if (skillsSectionEnabled && !extensionSettings.showSkills) {
            const skillCategories = trackerConfig?.userStats?.skillsSection?.customFields || [];
            const enabledCategories = skillCategories.filter(cat => cat.enabled !== false);
            if (enabledCategories.length > 0) {
                const skillLines = enabledCategories.map(cat => `    "${cat.name}": "Skill 1, Skill 2"`).join(',\n');
                sections.push(`  "skills": {\n${skillLines}\n  }`);
            } else {
                sections.push(`  "skills": "None"`);
            }
        }
    }

    // Attributes section
    const showRPGAttributes = trackerConfig?.userStats?.showRPGAttributes;
    const alwaysSendAttributes = trackerConfig?.userStats?.alwaysSendAttributes;
    const shouldSendAttributes = showRPGAttributes && (alwaysSendAttributes || extensionSettings.lastDiceRoll);
    
    if (shouldSendAttributes) {
        const rpgAttributes = trackerConfig?.userStats?.rpgAttributes || [];
        const enabledAttributes = rpgAttributes.filter(attr => attr && attr.enabled && attr.name && attr.id);
        
        if (enabledAttributes.length > 0) {
            let attrsJson = '  "attributes": {\n';
            const attrParts = enabledAttributes.map(attr => `    "${attr.name}": 10`);
            attrsJson += attrParts.join(',\n');
            attrsJson += '\n  }';
            sections.push(attrsJson);
            
            // Add level
            sections.push(`  "level": 1`);
        }
    }

    // Info Box section
    if (showInfoBox) {
        const widgets = trackerConfig?.infoBox?.widgets || {};
        const infoParts = [];
        if (widgets.date?.enabled) infoParts.push(`    "date": "Monday, March 15, 1242"`);
        if (widgets.time?.enabled) infoParts.push(`    "time": "14:00 → 15:30"`);
        if (widgets.weather?.enabled) infoParts.push(`    "weather": "☀️ Sunny"`);
        if (widgets.temperature?.enabled) {
            const unit = widgets.temperature.unit === 'F' ? '°F' : '°C';
            infoParts.push(`    "temperature": "22${unit}"`);
        }
        if (widgets.location?.enabled) infoParts.push(`    "location": "Forest Clearing"`);
        if (widgets.recentEvents?.enabled) {
            infoParts.push(`    "recentEvents": ["Event 1", "Event 2"]`);
        }
        
        if (infoParts.length > 0) {
            sections.push('  "infoBox": {\n' + infoParts.join(',\n') + '\n  }');
        }
    }

    // Characters section
    if (showCharacters) {
        const charConfig = trackerConfig?.presentCharacters || {};
        let charExample = `    {\n      "name": "Character Name",\n      "emoji": "🧑"`;
        
        if (charConfig.relationshipFields?.length > 0) {
            const allowedRelationships = charConfig.relationshipFields.join(' | ');
            charExample += `,\n      "relationship": "(${allowedRelationships})"`;
        }
        
        const enabledFields = charConfig.customFields?.filter(f => f.enabled) || [];
        if (enabledFields.length > 0) {
            const fieldsJson = enabledFields.map(f => `        "${f.name}": "[${f.description || f.name}]"`).join(',\n');
            charExample += `,\n      "fields": {\n${fieldsJson}\n      }`;
        }
        
        // Character stats
        const charStatsConfig = charConfig.characterStats;
        const enabledCharStats = charStatsConfig?.enabled && charStatsConfig?.customStats?.filter(s => s?.enabled && s?.name) || [];
        if (enabledCharStats.length > 0) {
            const statsJson = enabledCharStats.map(s => `        "${s.name}": 75`).join(',\n');
            charExample += `,\n      "stats": {\n${statsJson}\n      }`;
        }
        
        if (charConfig.thoughts?.enabled) {
            charExample += `,\n      "thoughts": "Character's inner thoughts in first person..."`;
        }
        
        charExample += '\n    }';
        sections.push('  "characters": [\n' + charExample + '\n  ]');
    }

    // Inventory section
    if (showInventory) {
        let invSection = '  "inventory": {\n';
        
        const exampleItem = enableItemSkillLinks 
            ? '{ "name": "Item Name", "description": "Description", "grantsSkill": "Skill Name" }'
            : '{ "name": "Item Name", "description": "Description" }';
        
        if (extensionSettings.useSimplifiedInventory) {
            invSection += `    "items": [${exampleItem}]\n`;
        } else {
            invSection += `    "onPerson": [${exampleItem}],\n`;
            invSection += `    "stored": {\n      "Location Name": [${exampleItem}]\n    },\n`;
            invSection += `    "assets": [{ "name": "Property/Vehicle", "description": "Description" }]\n`;
        }
        
        invSection += '  }';
        sections.push(invSection);
    }

    // Skills section
    if (showSkills) {
        const skillCategories = trackerConfig?.userStats?.skillsSection?.customFields || [];
        // Migration function handles string array → object array conversion on load
        const enabledCategories = skillCategories.filter(cat => cat.enabled !== false);
        
        if (enabledCategories.length > 0) {
            let skillsSection = '  "skills": {\n';
            const categoryExamples = enabledCategories.map(cat => {
                const catName = cat.name;
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

    if (showQuests) {
        instructions += '- A main quest can be created when the current main objective changes\n';
        instructions += '- Optional quests can be created for smaller matters that need to be resolved\n';
    }

    instructions += '- Items, equipment and possessions should be placeed in the inventory section\n';
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
        const showRPGAttributes = trackerConfig?.userStats?.showRPGAttributes;
        const alwaysSendAttributes = trackerConfig?.userStats?.alwaysSendAttributes;
        const shouldSendAttributes = showRPGAttributes && (alwaysSendAttributes || extensionSettings.lastDiceRoll);

        if (shouldSendAttributes) {
            // Attributes are already included in the JSON schema above; no extra text needed.
            if (extensionSettings.lastDiceRoll) {
                const roll = extensionSettings.lastDiceRoll;
                instructions += `${userName} rolled ${roll.total} on ${roll.formula}. Determine success/failure based on attributes.\n\n`;
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
    const tracker = committedTrackerData;
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
                currentState.stats[stat.name] = tracker.stats?.[stat.name] ?? 100;
                if (stat.description) {
                    descriptions.stats[stat.name] = stat.description;
                }
            }
        }
        
        // Status
        const statusConfig = trackerConfig?.userStats?.statusSection;
        if (statusConfig?.enabled) {
            currentState.status = {
                mood: tracker.status?.mood || '😐',
                fields: {}
            };
            const customFields = statusConfig.customFields || [];
            for (const field of customFields) {
                currentState.status.fields[field] = tracker.status?.fields?.[field] ?? 'None';
            }
        }

        // Skills section (inline when separate tab off)
        const skillsSectionEnabled = trackerConfig?.userStats?.skillsSection?.enabled || false;
        if (skillsSectionEnabled && !extensionSettings.showSkills) {
            currentState.skills = tracker.skills || {};
        }
    }
    
    // InfoBox
    if (extensionSettings.showInfoBox && tracker.infoBox) {
        currentState.infoBox = tracker.infoBox;
    }
    
    // Characters
    if (extensionSettings.showCharacterThoughts && tracker.characters?.length > 0) {
        currentState.characters = tracker.characters.map(char => ({ ...char }));
        
        const charConfig = trackerConfig?.presentCharacters;
        if (charConfig?.customFields?.length > 0) {
            descriptions.characterFields = {};
            for (const field of charConfig.customFields) {
                if (field.enabled && field.description) {
                    descriptions.characterFields[field.name] = field.description;
                }
            }
        }
        
        const charStatsConfig = charConfig?.characterStats;
        if (charStatsConfig?.enabled && charStatsConfig?.customStats?.length > 0) {
            descriptions.characterStats = descriptions.characterStats || {};
            for (const stat of charStatsConfig.customStats) {
                if (stat.enabled && stat.description) {
                    descriptions.characterStats[stat.name] = stat.description;
                }
            }
        }
    }
    
    // Inventory
    if (extensionSettings.showInventory && tracker.inventory) {
        currentState.inventory = tracker.inventory;
    }
    
    // Skills (separate tab)
    if (extensionSettings.showSkills && tracker.skills) {
        currentState.skills = tracker.skills;
        const skillCategories = trackerConfig?.userStats?.skillsSection?.customFields || [];
        const categoriesWithDesc = skillCategories.filter(cat => typeof cat === 'object' && cat.enabled !== false && cat.description);
        if (categoriesWithDesc.length > 0) {
            descriptions.skillCategories = {};
            for (const cat of categoriesWithDesc) {
                descriptions.skillCategories[cat.name] = cat.description;
            }
        }
    }
    
    // Quests
    if (extensionSettings.showQuests && tracker.quests) {
        currentState.quests = tracker.quests;
    }
    
    // Attributes / Level
    const showRPGAttributes = trackerConfig?.userStats?.showRPGAttributes;
    const alwaysSendAttributes = trackerConfig?.userStats?.alwaysSendAttributes;
    const shouldSendAttributes = showRPGAttributes && (alwaysSendAttributes || extensionSettings.lastDiceRoll);
    if (shouldSendAttributes) {
        const rpgAttributes = trackerConfig?.userStats?.rpgAttributes || [];
        const enabledAttributes = rpgAttributes.filter(attr => attr && attr.enabled && attr.name && attr.id);
        if (enabledAttributes.length > 0) {
            currentState.attributes = {};
            for (const attr of enabledAttributes) {
                currentState.attributes[attr.name] = tracker.attributes?.[attr.name] ?? 10;
                if (attr.description) {
                    descriptions.attributes = descriptions.attributes || {};
                    descriptions.attributes[attr.name] = attr.description;
                }
            }
        }
        currentState.level = tracker.level ?? 1;
    }
    
    if (Object.keys(descriptions).length > 0) {
        currentState._descriptions = descriptions;
    }
    
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
    const trackerConfig = extensionSettings.trackerConfig;
    let promptText = '';

    promptText += `Here are the previous trackers in JSON format that you should consider when responding:\n`;
    promptText += `<previous>\n`;

    // Build previous state as JSON
    const previousState = {};
    const tracker = committedTrackerData;
    
    // Stats
    if (extensionSettings.showUserStats) {
        const customStats = extensionSettings.trackerConfig?.userStats?.customStats?.filter(s => s?.enabled) || [];
        if (customStats.length > 0) {
            previousState.stats = {};
            for (const stat of customStats) {
                previousState.stats[stat.name] = tracker.stats?.[stat.name] ?? 100;
            }
        }
        
        // Status
        const statusConfig = extensionSettings.trackerConfig?.userStats?.statusSection;
        if (statusConfig?.enabled) {
            previousState.status = {
                mood: tracker.status?.mood || '😐',
                fields: {}
            };
            const customFields = statusConfig.customFields || [];
            for (const field of customFields) {
                previousState.status.fields[field] = tracker.status?.fields?.[field] ?? 'None';
            }
        }

        // Skills
        const skillsSectionEnabled = trackerConfig?.userStats?.skillsSection?.enabled || false;
        if (skillsSectionEnabled && !extensionSettings.showSkills) {
            previousState.skills = tracker.skills || {};
        }
    }
    
    // InfoBox
    if (extensionSettings.showInfoBox && tracker.infoBox) {
        previousState.infoBox = tracker.infoBox;
    }
    
    // Characters - format to match schema
    if (extensionSettings.showCharacterThoughts && tracker.characters?.length > 0) {
        previousState.characters = tracker.characters.map(char => ({ ...char }));
    }
    
    // Inventory - format to match schema (use "items" for simplified mode)
    if (extensionSettings.showInventory && tracker.inventory) {
        const inv = tracker.inventory;
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
    if (extensionSettings.showSkills && tracker.skills) {
        previousState.skills = tracker.skills;
    }
    
    // Quests
    if (extensionSettings.showQuests && tracker.quests) {
        previousState.quests = tracker.quests;
    }
    
    // Attributes and level (if RPG attributes are enabled and should be included)
    const showRPGAttributes = trackerConfig?.userStats?.showRPGAttributes;
    const alwaysSendAttributes = trackerConfig?.userStats?.alwaysSendAttributes;
    const shouldSendAttributes = showRPGAttributes && (alwaysSendAttributes || extensionSettings.lastDiceRoll);
    
    if (shouldSendAttributes) {
        const rpgAttributes = trackerConfig?.userStats?.rpgAttributes || [];
        const enabledAttributes = rpgAttributes.filter(attr => attr && attr.enabled && attr.name && attr.id);
        
        if (enabledAttributes.length > 0) {
            previousState.attributes = {};
            for (const attr of enabledAttributes) {
                const value = tracker.attributes?.[attr.name] ?? 10;
                previousState.attributes[attr.name] = value;
            }
            
            // Add level
            previousState.level = tracker.level ?? 1;
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

