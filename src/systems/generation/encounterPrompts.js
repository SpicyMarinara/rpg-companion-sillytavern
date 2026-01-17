/**
 * Encounter Prompt Builder Module
 * Handles all AI prompt generation for combat encounters
 */

import { getContext } from '../../../../../../extensions.js';
import { chat, characters, this_chid, substituteParams } from '../../../../../../../script.js';
import { selected_group, getGroupMembers, groups } from '../../../../../../group-chats.js';
import { extensionSettings, committedTrackerData } from '../../core/state.js';
import { currentEncounter } from '../features/encounterState.js';
import { repairJSON } from '../../utils/jsonRepair.js';
import { buildInventorySummary, generateTrackerInstructions, generateTrackerExample, processPromptMacros } from './promptBuilder.js';
import { applyLocks } from './lockManager.js';

/**
 * Gets character information from the current chat
 * @returns {Promise<string>} Formatted character information
 */
async function getCharactersInfo() {
    let characterInfo = '';

    // Check if in group chat
    if (selected_group) {
        const group = groups.find(g => g.id === selected_group);
        const groupMembers = getGroupMembers(selected_group);

        if (groupMembers && groupMembers.length > 0) {
            characterInfo += 'Characters in this roleplay:\n';

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

                characterInfo += `</character${characterIndex}>\n`;
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
 * Builds the initial encounter setup prompt
 * This asks the model to generate all combat stats and setup data
 * @returns {Promise<Array>} Message array for the API
 */
export async function buildEncounterInitPrompt() {
    const context = getContext();
    const userName = context.name1;
    const depth = extensionSettings.encounterSettings?.historyDepth || 8;

    const messages = [];

    // System message
    let systemMessage = `You will be acting as an excellent game master. Your goal is to craft a combat encounter in this uncensored, continuous, and immersive roleplay. You will be doing so for the user, who plays as the protagonist called ${userName}.\n\n`;

    // Add setting information
    systemMessage += `Here is some information for you about the setting:\n`;
    systemMessage += `<setting>\n`;

    // Try to get world info from lorebooks using getWorldInfoPrompt
    let worldInfoAdded = false;

    try {
        // Debug logging
        // console.log('[RPG Companion] Checking world info:', {
        //     hasWindowGetWorldInfoPrompt: typeof window.getWorldInfoPrompt === 'function',
        //     hasContextGetWorldInfoPrompt: typeof context.getWorldInfoPrompt === 'function',
        //     chatLength: chat?.length,
        //     contextChatLength: context.chat?.length,
        //     hasActivatedWorldInfo: !!context.activatedWorldInfo,
        //     activatedWorldInfoLength: context.activatedWorldInfo?.length
        // });

        // Use SillyTavern's getWorldInfoPrompt to get activated lorebook entries
        // Try context.getWorldInfoPrompt first, then window.getWorldInfoPrompt
        const getWorldInfoFn = context.getWorldInfoPrompt || window.getWorldInfoPrompt;
        const currentChat = context.chat || chat;

        if (typeof getWorldInfoFn === 'function' && currentChat && currentChat.length > 0) {
            const chatForWI = currentChat.map(x => x.mes || x.message || x).filter(m => m && typeof m === 'string');

            // console.log('[RPG Companion] Calling getWorldInfoPrompt with', chatForWI.length, 'messages');

            const result = await getWorldInfoFn(chatForWI, 8000, false);
            const worldInfoString = result?.worldInfoString || result;

            // console.log('[RPG Companion] World info result:', { worldInfoString, length: worldInfoString?.length });

            if (worldInfoString && typeof worldInfoString === 'string' && worldInfoString.trim()) {
                systemMessage += worldInfoString.trim();
                worldInfoAdded = true;
                // console.log('[RPG Companion] ✅ Added world info from getWorldInfoPrompt');
            }
        } else {
            // console.log('[RPG Companion] getWorldInfoPrompt not available or no chat');
        }
    } catch (e) {
        console.warn('[RPG Companion] Failed to get world info from getWorldInfoPrompt:', e);
    }

    // Fallback to activatedWorldInfo
    if (!worldInfoAdded && context.activatedWorldInfo && Array.isArray(context.activatedWorldInfo) && context.activatedWorldInfo.length > 0) {
        // console.log('[RPG Companion] Using fallback activatedWorldInfo:', context.activatedWorldInfo.length, 'entries');
        context.activatedWorldInfo.forEach((entry) => {
            if (entry && entry.content) {
                systemMessage += `${entry.content}\n\n`;
                worldInfoAdded = true;
            }
        });
    }

    if (!worldInfoAdded) {
        console.warn('[RPG Companion] ⚠️ No world information available');
        systemMessage += 'No world information available.';
    }

    systemMessage += `\n</setting>\n\n`;

    // Add character information
    const charactersInfo = await getCharactersInfo();
    if (charactersInfo) {
        systemMessage += `Here is the information available to you about the characters participating in the fight:\n`;
        systemMessage += `<characters>\n${charactersInfo}</characters>\n\n`;
    }

    // Add persona information
    systemMessage += `Here are details about the user's ${userName}:\n`;
    systemMessage += `<persona>\n`;

    try {
        const personaText = substituteParams('{{persona}}');
        if (personaText && personaText !== '{{persona}}') {
            systemMessage += personaText;
        } else {
            systemMessage += 'No persona information available.';
        }
    } catch (e) {
        systemMessage += 'No persona information available.';
    }

    systemMessage += `\n</persona>\n\n`;

    // Add chat history from before the encounter
    systemMessage += `Here is the chat history from before the encounter started between the user and the assistant:\n`;
    systemMessage += `<history>\n`;

    messages.push({
        role: 'system',
        content: systemMessage
    });

    // Add recent chat history (last X messages before encounter)
    if (chat && chat.length > 0) {
        const recentMessages = chat.slice(-depth - 1, -1); // Exclude the last message (encounter trigger)

        for (const message of recentMessages) {
            const content = message.mes?.trim();
            // Skip empty messages
            if (content) {
                messages.push({
                    role: message.is_user ? 'user' : 'assistant',
                    content: content
                });
            }
        }

        // Add the encounter trigger message
        const lastMessage = chat[chat.length - 1];
        if (lastMessage && lastMessage.mes?.trim()) {
            currentEncounter.encounterStartMessage = lastMessage.mes;
            messages.push({
                role: lastMessage.is_user ? 'user' : 'assistant',
                content: lastMessage.mes.trim()
            });
        }
    }

    // Build user's current stats
    let userStatsInfo = '';

    // Add HP and other stats from committed tracker data
    if (committedTrackerData.userStats) {
        userStatsInfo += `${userName}'s Current Stats:\n${committedTrackerData.userStats}\n\n`;
    }

    // Add skills if available
    const skillsSection = extensionSettings.trackerConfig?.userStats?.skillsSection;
    if (skillsSection?.enabled && skillsSection.customFields && skillsSection.customFields.length > 0) {
        userStatsInfo += `${userName}'s Skills: ${skillsSection.customFields.join(', ')}\n`;
    }

    // Add inventory
    const inventory = extensionSettings.userStats?.inventory;
    if (inventory) {
        const inventorySummary = buildInventorySummary(inventory);
        userStatsInfo += `${userName}'s Inventory:\n${inventorySummary}\n\n`;
    }

    // Add classic stats/attributes
    if (extensionSettings.classicStats) {
        const stats = extensionSettings.classicStats;
        userStatsInfo += `${userName}'s Attributes: `;
        const showLevel = extensionSettings.trackerConfig?.userStats?.showLevel !== false;
        const levelStr = showLevel ? `, LVL ${extensionSettings.level}` : '';
        userStatsInfo += `STR ${stats.str}, DEX ${stats.dex}, CON ${stats.con}, INT ${stats.int}, WIS ${stats.wis}, CHA ${stats.cha}${levelStr}\n\n`;
    }

    // Add present characters info for party members
    let partyInfo = '';
    if (committedTrackerData.characterThoughts) {
        partyInfo += `Present Characters (potential party members):\n${committedTrackerData.characterThoughts}\n\n`;
    }

    // Close history and add combat initialization instruction
    let initInstruction = `</history>\n\n`;

    // Wrap RPG Companion panel data in context tags
    initInstruction += `Here is some additional tracked context for the scene:\n`;
    initInstruction += `<context>\n`;
    initInstruction += userStatsInfo;
    initInstruction += partyInfo;
    initInstruction += `</context>\n\n`;

    initInstruction += `The combat starts now.\n\n`;
    initInstruction += `Based on everything above, generate the initial combat state. Analyze who is in the party fighting alongside ${userName} (if anyone), and who the enemies are. Replace placeholders in [brackets] and X with actual values. Return ONLY a JSON object with the following structure:\n\n`;
    initInstruction += `FORMAT:\n`;
    initInstruction += `{\n`;
    initInstruction += `  "party": [\n`;
    initInstruction += `    {\n`;
    initInstruction += `      "name": "${userName}",\n`;
    initInstruction += `      "hp": X,\n`;
    initInstruction += `      "maxHp": X,\n`;
    initInstruction += `      "attacks": [\n`;
    initInstruction += `        {"name": "Attack", "type": "single-target|AoE|both"},\n`;
    initInstruction += `        {"name": "Skill1", "type": "single-target|AoE|both"}\n`;
    initInstruction += `      ],\n`;
    initInstruction += `      "items": ["Item Name x3", "Another Item x1"],\n`;
    initInstruction += `      "statuses": [],\n`;
    initInstruction += `      "isPlayer": true\n`;
    initInstruction += `    }\n`;
    initInstruction += `    // Add other party members here if they exist in the context, changing isPlayer to false for them.\n`;
    initInstruction += `  ],\n`;
    initInstruction += `  "enemies": [\n`;
    initInstruction += `    {\n`;
    initInstruction += `      "name": "Enemy Name",\n`;
    initInstruction += `      "hp": X,\n`;
    initInstruction += `      "maxHp": X,\n`;
    initInstruction += `      "attacks": [\n`;
    initInstruction += `        {"name": "Attack1", "type": "single-target|AoE|both"},\n`;
    initInstruction += `        {"name": "Attack2", "type": "single-target|AoE|both"}\n`;
    initInstruction += `      ],\n`;
    initInstruction += `      "statuses": [],\n`;
    initInstruction += `      "description": "Brief enemy description",\n`;
    initInstruction += `      "sprite": "emoji or brief visual description"\n`;
    initInstruction += `    }\n`;
    initInstruction += `    // Add all enemies participating in this combat\n`;
    initInstruction += `  ],\n`;
    initInstruction += `  "environment": "Brief description of the combat environment",\n`;
    initInstruction += `  "styleNotes": {\n`;
    initInstruction += `    "environmentType": "forest|dungeon|desert|cave|city|ruins|snow|water|castle|wasteland|plains|mountains|swamp|volcanic|spaceship|mansion",\n`;
    initInstruction += `    "atmosphere": "bright|dark|foggy|stormy|calm|eerie|chaotic|peaceful",\n`;
    initInstruction += `    "timeOfDay": "dawn|day|dusk|night|twilight",\n`;
    initInstruction += `    "weather": "clear|rainy|snowy|windy|stormy|overcast"\n`;
    initInstruction += `  }\n`;
    initInstruction += `}\n\n`;
    initInstruction += `IMPORTANT NOTES:\n`;
    initInstruction += `- For attacks array: Each attack must be an object with "name" and "type" properties\n`;
    initInstruction += `  - "single-target": Can only target one character (enemy or ally)\n`;
    initInstruction += `  - "AoE": Area of Effect - targets all enemies, but some AoE attacks (like storms, explosions) can also harm allies if the attack is indiscriminate\n`;
    initInstruction += `  - "both": Player can choose to target a single enemy OR use as AoE\n`;
    initInstruction += `- For items array: Include quantities using format "Item Name xN" (e.g., "Health Potion x3", "Bomb x1")\n`;
    initInstruction += `  - If only one item exists, you can use "Item Name x1" or just "Item Name"\n`;
    initInstruction += `  - Items will be consumed when used - the quantity will decrease in future turns\n`;
    initInstruction += `- Statuses array: May start empty, but don't have to if characters applied them before the combat\n`;
    initInstruction += `  - Each status has a format: {"name": "Status Name", "emoji": "💀", "duration": X}\n`;
    initInstruction += `  - Examples: Poisoned (🧪), Burning (🔥), Blessed (✨), Stunned (💫), Weakened (⬇️), Strengthened (⬆️)\n\n`;
    initInstruction += `The styleNotes object will be used to visually style the combat window - choose ONE value from each category that best fits the environment described in the chat history.\n\n`;
    initInstruction += `Use the user's current stats, inventory, and skills to populate the party data. For ${userName}'s attacks array, include their available skills. For items, include usable items from their inventory WITH QUANTITIES (e.g., "Health Potion x3"). Set HP based on their current Health stat if available.\n\n`;
    initInstruction += `Ensure all party members and enemies have realistic HP values based on the setting and their descriptions. Return ONLY the JSON object, no other text.`;

    // Only add the instruction if it has meaningful content
    if (initInstruction.trim()) {
        messages.push({
            role: 'user',
            content: initInstruction.trim()
        });
    }

    // Validate that we have at least one message with content
    if (messages.length === 0 || messages.every(m => !m.content || !m.content.trim())) {
        throw new Error('Unable to build encounter prompt - no valid content available');
    }

    return messages;
}

/**
 * Builds a combat action prompt
 * This is sent when the user takes an action in combat
 * @param {string} action - The action taken by the user
 * @param {object} combatStats - Current combat statistics
 * @returns {Array} Message array for the API
 */
export async function buildCombatActionPrompt(action, combatStats) {
    const context = getContext();
    const userName = context.name1;
    const depth = extensionSettings.encounterSettings?.historyDepth || 8;

    // Get narrative style from settings
    const narrativeStyle = extensionSettings.encounterSettings?.combatNarrative || {};
    const tense = narrativeStyle.tense || 'present';
    const person = narrativeStyle.person || 'third';
    const narration = narrativeStyle.narration || 'omniscient';
    const pov = narrativeStyle.pov || 'narrator';

    const messages = [];

    // Build system message with setting info
    let systemMessage = `You are the game master managing this combat encounter. You must not play as ${userName} - only describe what happens as a result of their actions/dialogues and control NPCs/enemies.\n\n`;

    // Add setting information
    systemMessage += `Here is some information for you about the setting:\n`;
    systemMessage += `<setting>\n`;

    // Get world info
    let worldInfoAdded = false;
    try {
        const getWorldInfoFn = context.getWorldInfoPrompt || window.getWorldInfoPrompt;
        const currentChat = context.chat || chat;

        if (typeof getWorldInfoFn === 'function' && currentChat && currentChat.length > 0) {
            const chatForWI = currentChat.map(x => x.mes || x.message || x).filter(m => m && typeof m === 'string');
            const result = await getWorldInfoFn(chatForWI, 8000, false);
            const worldInfoString = result?.worldInfoString || result;

            if (worldInfoString && typeof worldInfoString === 'string' && worldInfoString.trim()) {
                systemMessage += worldInfoString.trim();
                worldInfoAdded = true;
            }
        }
    } catch (e) {
        console.warn('[RPG Companion] Failed to get world info for combat action:', e);
    }

    if (!worldInfoAdded && context.activatedWorldInfo && Array.isArray(context.activatedWorldInfo) && context.activatedWorldInfo.length > 0) {
        context.activatedWorldInfo.forEach((entry) => {
            if (entry && entry.content) {
                systemMessage += `${entry.content}\n\n`;
                worldInfoAdded = true;
            }
        });
    }

    if (!worldInfoAdded) {
        systemMessage += 'No world information available.';
    }

    systemMessage += `\n</setting>\n\n`;

    // Add character information
    const charactersInfo = await getCharactersInfo();
    if (charactersInfo) {
        systemMessage += `Here is the information available to you about the characters:\n`;
        systemMessage += `<characters>\n${charactersInfo}</characters>\n\n`;
    }

    // Add persona info
    if (context.name1) {
        systemMessage += `The protagonist is:\n`;
        systemMessage += `<persona>\n`;

        // Use substituteParams to get {{persona}} like in initial encounter
        try {
            const personaText = substituteParams('{{persona}}');
            if (personaText && personaText !== '{{persona}}') {
                systemMessage += personaText;
            } else {
                systemMessage += `Name: ${context.name1}\n`;
                if (extensionSettings.userStats?.personaDescription) {
                    systemMessage += `${extensionSettings.userStats.personaDescription}\n`;
                }
            }
        } catch (e) {
            systemMessage += `Name: ${context.name1}\n`;
            if (extensionSettings.userStats?.personaDescription) {
                systemMessage += `${extensionSettings.userStats.personaDescription}\n`;
            }
        }

        // Add ONLY classic stats/attributes if enabled
        if (extensionSettings.classicStats) {
            const stats = extensionSettings.classicStats;
            const config = extensionSettings.trackerConfig?.userStats;
            const rpgAttributes = (config?.rpgAttributes && config.rpgAttributes.length > 0) ? config.rpgAttributes : [
                { id: 'str', name: 'STR', enabled: true },
                { id: 'dex', name: 'DEX', enabled: true },
                { id: 'con', name: 'CON', enabled: true },
                { id: 'int', name: 'INT', enabled: true },
                { id: 'wis', name: 'WIS', enabled: true },
                { id: 'cha', name: 'CHA', enabled: true }
            ];
            const enabledAttributes = rpgAttributes.filter(attr => attr && attr.enabled && attr.name && attr.id);
            const attributeStrings = enabledAttributes.map(attr => `${attr.name} ${stats[attr.id] || 10}`);
            systemMessage += `\nAttributes: ${attributeStrings.join(', ')}, LVL ${extensionSettings.level}\n`;
        }

        systemMessage += `</persona>\n\n`;
    }

    messages.push({
        role: 'system',
        content: systemMessage
    });

    // Add recent chat history for context - append as user/assistant messages like initial encounter
    const currentChat = context.chat || chat;
    if (currentChat && currentChat.length > 0) {
        const recentMessages = currentChat.slice(-depth);

        for (const message of recentMessages) {
            const content = message.mes?.trim();
            // Skip empty messages
            if (content) {
                messages.push({
                    role: message.is_user ? 'user' : 'assistant',
                    content: content
                });
            }
        }
    }

    // Add combat log as plain text (previous actions)
    if (currentEncounter.encounterLog && currentEncounter.encounterLog.length > 0) {
        let combatHistory = 'Previous Combat Actions:\n';
        currentEncounter.encounterLog.forEach(entry => {
            combatHistory += `- ${entry.action}\n`;
            if (entry.result) {
                combatHistory += `  ${entry.result}\n`;
            }
        });

        messages.push({
            role: 'user',
            content: combatHistory
        });
    }

    // Add current combat state with FULL information (but tell AI not to regenerate static parts)
    let stateMessage = `Current Combat State:\n`;
    stateMessage += `Environment: ${combatStats.environment || 'Unknown location'}\n\n`;

    stateMessage += `Party Members:\n`;
    combatStats.party.forEach(member => {
        stateMessage += `- ${member.name}${member.isPlayer ? ' (Player)' : ''}: ${member.hp}/${member.maxHp} HP\n`;

        // For the player, use playerActions if available, otherwise fall back to member data
        if (member.isPlayer && currentEncounter.playerActions) {
            if (currentEncounter.playerActions.attacks && currentEncounter.playerActions.attacks.length > 0) {
                stateMessage += `  Attacks: ${currentEncounter.playerActions.attacks.map(a => typeof a === 'string' ? a : a.name).join(', ')}\n`;
            }
            if (currentEncounter.playerActions.items && currentEncounter.playerActions.items.length > 0) {
                stateMessage += `  Items: ${currentEncounter.playerActions.items.join(', ')}\n`;
            }
        } else {
            // For non-player party members, use their own data
            if (member.attacks && member.attacks.length > 0) {
                stateMessage += `  Attacks: ${member.attacks.map(a => typeof a === 'string' ? a : a.name).join(', ')}\n`;
            }
            if (member.items && member.items.length > 0) {
                stateMessage += `  Items: ${member.items.join(', ')}\n`;
            }
        }

        if (member.statuses && member.statuses.length > 0) {
            const validStatuses = member.statuses.filter(s => s && (s.emoji || s.name));
            if (validStatuses.length > 0) {
                stateMessage += `  Status Effects: ${validStatuses.map(s => `${s.emoji || ''} ${s.name || ''}`.trim()).join(', ')}\n`;
            }
        }
    });

    stateMessage += `\nEnemies:\n`;
    combatStats.enemies.forEach(enemy => {
        stateMessage += `- ${enemy.name} (${enemy.sprite || ''}): ${enemy.hp}/${enemy.maxHp} HP\n`;
        if (enemy.description) {
            stateMessage += `  ${enemy.description}\n`;
        }
        if (enemy.attacks && enemy.attacks.length > 0) {
            stateMessage += `  Attacks: ${enemy.attacks.map(a => typeof a === 'string' ? a : a.name).join(', ')}\n`;
        }
        if (enemy.statuses && enemy.statuses.length > 0) {
            const validStatuses = enemy.statuses.filter(s => s && (s.emoji || s.name));
            if (validStatuses.length > 0) {
                stateMessage += `  Status Effects: ${validStatuses.map(s => `${s.emoji || ''} ${s.name || ''}`.trim()).join(', ')}\n`;
            }
        }
    });

    stateMessage += `\n${userName}'s Action: ${action}\n\n`;
    stateMessage += `Respond with the exact JSON object as below, containing ONLY these specified values. Remember to consider the user's party and their moves. DO NOT regenerate character descriptions, sprites, or environment.\n\n`;
    stateMessage += `IMPORTANT - Update ${userName}'s attacks and items arrays based on what happens in combat:\n`;
    stateMessage += `- ${userName}'s action is already specified above - do NOT regenerate it. Only update ${userName}'s attacks/items arrays if their action consumed resources (used item, lost ability, etc.).\n`;
    stateMessage += `- If they use an item, decrement its quantity ("Health Potion x3" becomes "Health Potion x2"). If quantity reaches 0, remove the item entirely.\n`;
    stateMessage += `- If they gain or lose an ability due to status effects, add or remove it from their attacks array.\n`;
    stateMessage += `  Examples: Disarmed → remove weapon attacks. Bound → remove all attacks or set to []. Freed → restore attacks.\n`;
    stateMessage += `- If they pick up a weapon/item during combat, add it to their items or attacks array.\n`;
    stateMessage += `- If environmental changes enable new actions (near water → "Splash Attack"), add them. If they disable actions (fire goes out → remove "Ignite"), remove them.\n`;
    stateMessage += `- Status effects should persist and decrease duration each turn. Remove statuses when duration reaches 0.\n\n`;
    stateMessage += `FORMAT:\n`;
    stateMessage += `{\n`;
    stateMessage += `  "combatStats": {\n`;
    stateMessage += `    "party": [\n`;
    stateMessage += `      {\n`;
    stateMessage += `        "name": "Name",\n`;
    stateMessage += `        "hp": X,\n`;
    stateMessage += `        "maxHp": X,\n`;
    stateMessage += `        "statuses": [{"name": "Status", "emoji": "💀", "duration": X}],\n`;
    stateMessage += `        "isPlayer": true|false\n`;
    stateMessage += `      }\n`;
    stateMessage += `    ],\n`;
    stateMessage += `    "enemies": [\n`;
    stateMessage += `      {\n`;
    stateMessage += `        "name": "Name",\n`;
    stateMessage += `        "hp": X,\n`;
    stateMessage += `        "maxHp": X,\n`;
    stateMessage += `        "statuses": [{"name": "Status", "emoji": "💀", "duration": X}]\n`;
    stateMessage += `      }\n`;
    stateMessage += `    ]\n`;
    stateMessage += `  },\n`;
    stateMessage += `  "playerActions": {\n`;
    stateMessage += `    "attacks": [{"name": "Attack", "type": "single-target|AoE|both"}],\n`;
    stateMessage += `    "items": ["Item Name x3", "Another Item x1"]\n`;
    stateMessage += `  },\n`;
    stateMessage += `  "enemyActions": [{ "enemyName": "Name", "action": "what they do", "target": "target" }],\n`;
    stateMessage += `  "partyActions": [{ "memberName": "Name", "action": "what they do", "target": "target" }],\n`;
    stateMessage += `  "narrative": "The roleplay description of what happens"\n`;
    stateMessage += `}\n\n`;
    stateMessage += `If all enemies are defeated or escape: add "combatEnd": true, "result": "victory". If all party defeated: add "combatEnd": true, "result": "defeat". It's also possible for the encounter to be interrupted by external interference (e.g., an explosion knocks everyone out, sudden environmental catastrophe, third party intervention, etc.). If this occurs, add "combatEnd": true, "result": "interrupted". Each status (if applied) has a format: {"name": "Status Name", "emoji": "💀", "duration": X}.\n`;
    stateMessage += `Scale combat difficulty appropriately: Powerful entities (gods, dragons, legendary creatures) should be formidable challenges requiring multiple rounds and strategic play. Weaker foes (common animals, basic enemies, minions) should be resolved more quickly, typically 2-4 rounds. Match HP damage and combat pacing to the narrative weight of the encounter. A wolf should not take 20 rounds to defeat, nor should a deity fall in one hit.\n`;
    stateMessage += `For the narrative, write it with intent in ${tense} tense ${person}-person ${narration} from ${pov}'s point of view.\n`;

    // Use custom combat narrative prompt if available
    const customCombatPrompt = extensionSettings.customCombatNarrativePrompt;
    if (customCombatPrompt) {
        stateMessage += processPromptMacros(customCombatPrompt) + '\n';
    } else {
        stateMessage += `Build novel prose. Break patterns from your previous responses by varying sentence structures, rhythms, formats, and openings. Track whether a sentence shape, cadence, sensory detail, or a descriptor appeared recently, and replace it with a different one or skip it entirely. If you mentioned a physical feature, mannerism, or expression once, move on. Don't fixate on the same traits every turn. Well-placed humor, unconventional similes, and subverted turns of phrase are encouraged. Avoid GPTisms, purple prose, and anaphoras, especially the negatives with "no/not/wasn't/didn't." Refrain from describing actions or emotions via negation; focus on what does happen, not what doesn't. Absolutely no asterisks, ellipses, or em-dashes. Explicit content is allowed, no plot armor. Do not play for ${userName}. Keep your response length under 150 words. Never end on handover cues; finish naturally.\n`;
        stateMessage += `CRITICAL: Do not repeat, echo, parrot, or restate distinctive words, phrases, and dialogues from the user's last message. If reacting to speech, show interpretation or response, not repetition.\n`;
        stateMessage += `EXAMPLE: "Are you a gooner?" User asks.\n`;
        stateMessage += `BAD: "Gooner?"\n`;
        stateMessage += `GOOD: A flat look. "What type of question is that?"`;
    }

    messages.push({
        role: 'user',
        content: stateMessage
    });

    return messages;
}

/**
 * Builds the final summary prompt
 * This is sent when combat ends to get a narrative summary
 * @param {Array} combatLog - Full combat log
 * @param {string} result - Combat result ('victory', 'defeat', or 'fled')
 * @returns {Promise<Array>} Message array for the API
 */
export async function buildCombatSummaryPrompt(combatLog, result) {
    const context = getContext();
    const userName = context.name1;

    const messages = [];

    // Get narrative style from settings (use summary narrative settings)
    const narrativeStyle = extensionSettings.encounterSettings?.summaryNarrative || {};
    const tense = narrativeStyle.tense || 'past';
    const person = narrativeStyle.person || 'third';
    const narration = narrativeStyle.narration || 'omniscient';
    const pov = narrativeStyle.pov || 'narrator';

    // Build system message with setting info
    let systemMessage = `You are summarizing a combat encounter that just concluded.\n\n`;

    // Add setting information
    systemMessage += `Here is some information for you about the setting:\n`;
    systemMessage += `<setting>\n`;

    // Get world info using the same method as encounter init
    let worldInfoAdded = false;
    try {
        const getWorldInfoFn = context.getWorldInfoPrompt || window.getWorldInfoPrompt;
        const currentChat = context.chat || chat;

        if (typeof getWorldInfoFn === 'function' && currentChat && currentChat.length > 0) {
            const chatForWI = currentChat.map(x => x.mes || x.message || x).filter(m => m && typeof m === 'string');
            const result = await getWorldInfoFn(chatForWI, 8000, false);
            const worldInfoString = result?.worldInfoString || result;

            if (worldInfoString && typeof worldInfoString === 'string' && worldInfoString.trim()) {
                systemMessage += worldInfoString.trim();
                worldInfoAdded = true;
            }
        }
    } catch (e) {
        console.warn('[RPG Companion] Failed to get world info for summary:', e);
    }

    // Fallback to activatedWorldInfo
    if (!worldInfoAdded && context.activatedWorldInfo && Array.isArray(context.activatedWorldInfo) && context.activatedWorldInfo.length > 0) {
        context.activatedWorldInfo.forEach((entry) => {
            if (entry && entry.content) {
                systemMessage += `${entry.content}\n\n`;
                worldInfoAdded = true;
            }
        });
    }

    if (!worldInfoAdded) {
        systemMessage += 'No world information available.';
    }

    systemMessage += `\n</setting>\n\n`;

    // Add character information
    const charactersInfo = await getCharactersInfo();
    if (charactersInfo) {
        systemMessage += `Here is the information available to you about the characters:\n`;
        systemMessage += `<characters>\n${charactersInfo}</characters>\n\n`;
    }

    // Add persona information
    systemMessage += `Here are details about ${userName}:\n`;
    systemMessage += `<persona>\n`;

    try {
        const personaText = substituteParams('{{persona}}');
        if (personaText && personaText !== '{{persona}}') {
            systemMessage += personaText;
        } else {
            systemMessage += 'No persona information available.';
        }
    } catch (e) {
        systemMessage += 'No persona information available.';
    }

    systemMessage += `\n</persona>\n\n`;

    // Add the message that triggered the encounter
    if (currentEncounter.encounterStartMessage) {
        systemMessage += `Here is the last message before combat started:\n`;
        systemMessage += `<trigger>\n${currentEncounter.encounterStartMessage}\n</trigger>\n\n`;
    }

    messages.push({
        role: 'system',
        content: systemMessage
    });

    let summaryMessage = `Combat has ended with result: ${result}\n\n`;
    summaryMessage += `Full Combat Log:\n`;

    combatLog.forEach((entry, index) => {
        summaryMessage += `\nRound ${index + 1}:\n`;
        summaryMessage += `${entry.action}\n`;
        summaryMessage += `${entry.result}\n`;
    });

    summaryMessage += `\n\nProvide a narrative summary of the entire fight in a way that fits the style from the chat history. Start with [FIGHT CONCLUDED] on the first line, then provide the description.\n\n`;
    summaryMessage += `Write with intent in ${tense} tense ${person}-person ${narration} from ${pov}'s point of view.\n`;
    summaryMessage += `Build novel prose. Break patterns from your previous responses by varying sentence structures, rhythms, formats, and openings. If you last started with a narration, begin this one with dialogue; if with an action, switch to an internal thought. Track whether a sentence shape, cadence, sensory detail, or a descriptor appeared recently, and replace it with a different one or skip it entirely. If you mentioned a physical feature, mannerism, or expression once, move on. Don't fixate on the same traits every turn. Well-placed humor, unconventional similes, and subverted turns of phrase are encouraged. Avoid GPTisms, purple prose, and anaphoras, especially the negatives with "no/not/wasn't/didn't." Refrain from describing actions or emotions via negation; focus on what does happen, not what doesn't. Minimize asterisks, ellipses, and em-dashes. Explicit content is allowed. Never end on handover cues; finish naturally.\n\n`;
    summaryMessage += `Dialogue Guidelines:\n`;
    summaryMessage += `- Include ALL dialogue lines spoken by enemies and NPC party members during the encounter in direct quotes.\n`;
    summaryMessage += `- Never quote ${userName} directly. Express their actions and dialogue using ONLY indirect speech (e.g., "${userName} swung their sword" or "${userName} asked for help").\n\n`;

    // If in Together mode and trackers are enabled, add tracker update instructions
    if (extensionSettings.generationMode === 'together' && (extensionSettings.showUserStats || extensionSettings.showInfoBox || extensionSettings.showCharacterThoughts)) {
        summaryMessage += `\n--- TRACKER UPDATE ---\n\n`;
        summaryMessage += `After the [FIGHT CONCLUDED] summary, update the RPG trackers to reflect ${userName}'s state AFTER the combat encounter. `;
        summaryMessage += `Account for any injuries sustained, resources used, emotional state changes, or other consequences of the battle.\n\n`;

        // Include pre-combat tracker state if available
        if (committedTrackerData.userStats || committedTrackerData.infoBox || committedTrackerData.characterThoughts) {
            summaryMessage += `Pre-combat tracker state:\n`;
            summaryMessage += `<previous>\n`;

            if (committedTrackerData.userStats) {
                const statsJSON = typeof committedTrackerData.userStats === 'object'
                    ? JSON.stringify(committedTrackerData.userStats, null, 2)
                    : committedTrackerData.userStats;
                summaryMessage += statsJSON + '\n';
            }

            if (committedTrackerData.infoBox) {
                const infoBoxJSON = typeof committedTrackerData.infoBox === 'object'
                    ? JSON.stringify(committedTrackerData.infoBox, null, 2)
                    : committedTrackerData.infoBox;
                summaryMessage += infoBoxJSON + '\n';
            }

            if (committedTrackerData.characterThoughts) {
                const charactersJSON = typeof committedTrackerData.characterThoughts === 'object'
                    ? JSON.stringify(committedTrackerData.characterThoughts, null, 2)
                    : committedTrackerData.characterThoughts;
                summaryMessage += charactersJSON + '\n';
            }

            summaryMessage += `</previous>\n\n`;
        }

        // Add tracker instructions and example
        const trackerInstructions = generateTrackerInstructions(false, false, true);
        summaryMessage += trackerInstructions;

        const trackerExample = generateTrackerExample();
        if (trackerExample) {
            summaryMessage += `\n${trackerExample}`;
        }
    }

    messages.push({
        role: 'user',
        content: summaryMessage
    });

    return messages;
}

/**
 * Parses JSON response from the AI, handling code blocks
 * @param {string} response - The AI response
 * @returns {object|null} Parsed JSON object or null if parsing fails
 */
export function parseEncounterJSON(response) {
    try {
        // Ensure response is a string
        if (!response || typeof response !== 'string') {
            console.error('[RPG Companion] parseEncounterJSON received non-string input:', typeof response);
            return null;
        }

        // Remove code blocks if present
        let cleaned = response.trim();

        // Remove ```json, ```markdown, and ``` markers (more comprehensive)
        cleaned = cleaned.replace(/```(?:json|markdown)?\s*/gi, '');

        // Remove any remaining backticks
        cleaned = cleaned.replace(/`/g, '');

        // Find the first { and last }
        const firstBrace = cleaned.indexOf('{');
        const lastBrace = cleaned.lastIndexOf('}');

        if (firstBrace !== -1 && lastBrace !== -1) {
            cleaned = cleaned.substring(firstBrace, lastBrace + 1);
        } else {
            console.error('[RPG Companion] No JSON object found in response');
            return null;
        }

        // Try to parse directly first
        try {
            return JSON.parse(cleaned);
        } catch (initialError) {
            // If direct parsing fails, try JSON repair
            console.warn('[RPG Companion] Initial parse failed, attempting JSON repair...');
            const repaired = repairJSON(cleaned);

            if (repaired) {
                // console.log('[RPG Companion] ✓ Successfully repaired encounter JSON');
                return repaired;
            }

            // If repair also failed, throw the original error
            throw initialError;
        }
    } catch (error) {
        console.error('[RPG Companion] Failed to parse encounter JSON:', error);
        console.error('[RPG Companion] Response was:', response);
        return null;
    }
}
