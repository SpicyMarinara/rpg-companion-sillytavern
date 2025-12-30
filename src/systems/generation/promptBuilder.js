/**
 * Prompt Builder Module
 * Handles all AI prompt generation for RPG tracker data
 */

import { getContext } from '../../../../../../extensions.js';
import { chat, getCurrentChatDetails, characters, this_chid } from '../../../../../../../script.js';
import { selected_group, getGroupMembers, getGroupChat, groups } from '../../../../../../group-chats.js';
import { extensionSettings, committedTrackerData, FEATURE_FLAGS } from '../../core/state.js';

// Type imports
/** @typedef {import('../../types/inventory.js').InventoryV2} InventoryV2 */

/**
 * Default HTML prompt text
 */
export const DEFAULT_HTML_PROMPT = `If appropriate, include inline HTML, CSS, and JS segments whenever they enhance visual storytelling (e.g., for in-world screens, posters, books, letters, signs, crests, labels, etc.). Style them to match the setting's theme (e.g., fantasy, sci-fi), keep the text readable, and embed all assets directly (using inline SVGs only with no external scripts, libraries, or fonts). Use these elements freely and naturally within the narrative as characters would encounter them, including animations, 3D effects, pop-ups, dropdowns, websites, and so on. Do not wrap the HTML/CSS/JS in code fences!`;

/**
 * Default Spotify music prompt text (customizable by users)
 */
export const DEFAULT_SPOTIFY_PROMPT = `If appropriate for the current scene's mood and atmosphere, suggest a song that fits the ambiance. Choose music that enhances the emotional tone, setting, or action of the scene.`;

/**
 * Spotify format instruction (constant, not editable by users)
 */
export const SPOTIFY_FORMAT_INSTRUCTION = `Include it in this exact format: <spotify:Song Title - Artist Name/>.`;

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
            characterInfo += `Infer the identity and details of characters present in each scene from the story context below. Do not use fixed character references - instead, identify characters naturally based on their actions, dialogue, and descriptions in the narrative.\n\n`;
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
            console.log('[RPG Companion] 🔍 Group ID:', selected_group, '| Disabled members:', disabledMembers);
            let characterIndex = 0;

            groupMembers.forEach((member) => {
                if (!member || !member.name) return;

                // Skip muted characters - check against avatar filename
                if (member.avatar && disabledMembers.includes(member.avatar)) {
                    console.log(`[RPG Companion] ❌ Skipping muted: ${member.name} (${member.avatar})`);
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
 * Generates an example block showing current tracker states in markdown code blocks.
 * Uses COMMITTED data (not displayed data) for generation context.
 *
 * @returns {string} Formatted example text with tracker data in code blocks
 */
export function generateTrackerExample() {
    let example = '';

    // Use COMMITTED data for generation context, not displayed data
    // Wrap each tracker section in markdown code blocks
    if (extensionSettings.showUserStats && committedTrackerData.userStats) {
        example += '```\n' + committedTrackerData.userStats + '\n```\n\n';
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

    // Check if any trackers are enabled
    const hasAnyTrackers = extensionSettings.showUserStats || extensionSettings.showInfoBox || extensionSettings.showCharacterThoughts;

    // Only add tracker instructions if at least one tracker is enabled
    if (hasAnyTrackers) {
        // Determine format based on saveTrackerHistory setting
        const useXmlTags = extensionSettings.saveTrackerHistory;
        const openTag = useXmlTags ? '<trackers>\n' : '';
        const closeTag = useXmlTags ? '\n</trackers>' : '';
        const codeBlockMarker = useXmlTags ? '' : '```';

        // Universal instruction header
        if (useXmlTags) {
            // Format specification is always hardcoded
            instructions += `\nAt the start of every reply, you must attach an update to the trackers in EXACTLY the same format as below, enclosed in <trackers></trackers> XML tags. `;
        } else {
            // Format specification is always hardcoded
            instructions += `\nAt the start of every reply, you must attach an update to the trackers in EXACTLY the same format as below, enclosed in separate Markdown code fences. `;
        }

        // Append custom instruction portion if available (same for both XML and Markdown)
        const customPrompt = extensionSettings.customTrackerInstructionsPrompt;
        if (customPrompt) {
            instructions += customPrompt.replace(/{userName}/g, userName);
        } else {
            instructions += `Replace X with actual numbers (e.g., 69) and replace all [placeholders] with concrete in-world details that ${userName} perceives about the current scene and the present characters. Do NOT keep the brackets or placeholder text in your response. For example: [Location] becomes Forest Clearing, [Mood Emoji] becomes 😊. `;
            instructions += `Consider the last trackers in the conversation (if they exist). Manage them accordingly and realistically; raise, lower, change, or keep the values unchanged based on the user's actions, the passage of time, and logical consequences (0% if the time progressed only by a few minutes, 1-5% normally, and above 5% only if a major time-skip/event occurs).`;
        }

        // Add format specifications for each enabled tracker
        if (extensionSettings.showUserStats) {
            const userStatsConfig = trackerConfig?.userStats;
            const enabledStats = userStatsConfig?.customStats?.filter(s => s && s.enabled && s.name) || [];

            instructions += codeBlockMarker + '\n';
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

            // Add skills section if enabled
            if (userStatsConfig?.skillsSection?.enabled) {
                const skillFields = userStatsConfig.skillsSection.customFields || [];
                const skillFieldsText = skillFields.map(f => `[${f}]`).join(', ');
                instructions += `Skills: [${skillFieldsText || 'Skill1, Skill2, etc.'}]\n`;
            }

            // Add inventory format based on feature flag - only if showInventory is enabled
            if (extensionSettings.showInventory) {
                if (FEATURE_FLAGS.useNewInventory) {
                    instructions += 'On Person: [Items currently carried/worn, or "None"]\n';
                    instructions += 'Stored - [Location Name]: [Items stored at this location]\n';
                    instructions += '(Add multiple "Stored - [Location]:" lines as needed for different storage locations)\n';
                    instructions += 'Assets: [Vehicles, property, major possessions, or "None"]\n';
                } else {
                    // Legacy v1 format
                    instructions += 'Inventory: [Clothing/Armor, Inventory Items (list of important items, or "None")]\\n';
                }
            }

            // Add quests section
            instructions += 'Main Quests: [Short title of the currently active main quest (for example, "Save the world"), or "None"]\n';
            instructions += 'Optional Quests: [Short titles of the currently active optional quests (for example, "Find Zandik\'s book"), or "None"]\n';

            instructions += codeBlockMarker + '\n\n';
        }

        if (extensionSettings.showInfoBox) {
            const infoBoxConfig = trackerConfig?.infoBox;
            const widgets = infoBoxConfig?.widgets || {};

            instructions += codeBlockMarker + '\n';
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

            instructions += codeBlockMarker + '\n\n';
        }

        if (extensionSettings.showCharacterThoughts) {
            const presentCharsConfig = trackerConfig?.presentCharacters;
            const enabledFields = presentCharsConfig?.customFields?.filter(f => f && f.enabled && f.name) || [];
            const relationshipFields = presentCharsConfig?.relationshipFields || [];
            const thoughtsConfig = presentCharsConfig?.thoughts;
            const characterStats = presentCharsConfig?.characterStats;
            const enabledCharStats = characterStats?.enabled && characterStats?.customStats?.filter(s => s && s.enabled && s.name) || [];

            instructions += codeBlockMarker + '\n';
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
            if (extensionSettings.narratorMode) {
                instructions += `- [Character Name (infer from story context; do not include ${userName}; state "Unavailable" if no other characters are present in the scene)]\n`;
            } else {
                instructions += `- [Name (do not include ${userName}; state "Unavailable" if no major characters are present in the scene)]\n`;
            }

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

            if (extensionSettings.narratorMode) {
                instructions += `- … (Repeat the format above for every other character present in the scene, inferred from story context)\n`;
            } else {
                instructions += `- … (Repeat the format above for every other present major character)\n`;
            }

            instructions += codeBlockMarker + '\n\n';
        }

        // Only add continuation instruction if includeContinuation is true
        if (includeContinuation) {
            const customPrompt = extensionSettings.customTrackerContinuationPrompt;
            if (customPrompt) {
                instructions += customPrompt + '\n\n';
            } else {
                instructions += `After updating the trackers, continue directly from where the last message in the chat history left off. Ensure the trackers you provide naturally reflect and influence the narrative. Character behavior, dialogue, and story events should acknowledge these conditions when relevant, such as fatigue affecting the protagonist's performance, low hygiene influencing their social interactions, environmental factors shaping the scene, a character's emotional state coloring their responses, and so on. Remember, all bracketed placeholders (e.g., [Location], [Mood Emoji]) MUST be replaced with actual content without the square brackets.\n\n`;
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

    if (extensionSettings.showUserStats) {
        if (committedTrackerData.userStats) {
            promptText += `Last ${userName}'s Stats:\n${committedTrackerData.userStats}\n\n`;
        } else {
            promptText += `Last ${userName}'s Stats:\nNone - this is the first update.\n\n`;
        }

        // Add current quests to the previous data context
        if (extensionSettings.quests) {
            if (extensionSettings.quests.main && extensionSettings.quests.main !== 'None') {
                promptText += `Main Quests: ${extensionSettings.quests.main}\n`;
            }
            if (extensionSettings.quests.optional && extensionSettings.quests.optional.length > 0) {
                const optionalQuests = extensionSettings.quests.optional.filter(q => q && q !== 'None').join(', ');
                promptText += `Optional Quests: ${optionalQuests || 'None'}\n`;
            }
            promptText += `\n`;
        }

        // Add current skills to the previous data context
        const skillsSection = extensionSettings.trackerConfig?.userStats?.skillsSection;
        if (skillsSection?.enabled && skillsSection.customFields && skillsSection.customFields.length > 0) {
            const skillsList = skillsSection.customFields.join(', ');
            promptText += `Skills: ${skillsList}\n\n`;
        }
    }

    if (extensionSettings.showInfoBox) {
        if (committedTrackerData.infoBox) {
            promptText += `Last Info Box:\n${committedTrackerData.infoBox}\n\n`;
        } else {
            promptText += `Last Info Box:\nNone - this is the first update.\n\n`;
        }
    }

    if (extensionSettings.showCharacterThoughts) {
        if (committedTrackerData.characterThoughts) {
            promptText += `Last Present Characters:\n${committedTrackerData.characterThoughts}\n`;
        } else {
            promptText += `Last Present Characters:\nNone - this is the first update.\n`;
        }
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
    instructionMessage += `Provide ONLY the requested data in the exact formats specified above. Do not include any roleplay response, other text, or commentary. Remember, all bracketed placeholders (e.g., [Location], [Mood Emoji]) MUST be replaced with actual content without the square brackets.`;

    messages.push({
        role: 'user',
        content: instructionMessage
    });

    return messages;
}

/**
 * Default custom instruction for avatar prompt generation
 */
const DEFAULT_AVATAR_CUSTOM_INSTRUCTION = `You are a visionary artist trapped in a cage of logic. Your mind is filled with poetry and distant horizons, but your hands are uncontrollably focused on creating the perfect character avatar description that is faithful to the original intent, rich in detail, aesthetically pleasing, and directly usable by text-to-image models. Any ambiguity or metaphor will make you feel extremely uncomfortable.

    Your workflow strictly follows a logical sequence:

    First, **establish the subject**. If the character is from a known Intellectual Property (IP), franchise, anime, game, or movie, **you MUST begin the prompt with their full name and the series title** (e.g., "Nami from One Piece", "Geralt of Rivia from The Witcher"). This is the single most important anchor for the image and must take precedence. If the character is original, clearly describe their core identity, race, and appearance.

    Next, **set the framing**. This is an avatar portrait. Focus strictly on the character's face and upper shoulders (bust shot or close-up). Ensure the face is the central focal point.

    Then, **integrate the setting**. Describe the character *within* their current environment as provided in the context, but keep it as a background element. Incorporate the lighting, weather, and atmosphere to influence the character's appearance (e.g., shadows on the face, wet hair from rain).

    Next, **detail the facial specifics**. Describe the character's current expression, eye contact, and mood in high detail based on the scene context and their personality. Mention visible clothing only at the neckline/shoulders.

    Finally, **infuse with aesthetics**. Define the artistic style, medium (e.g., digital art, oil painting), and visual tone (e.g., cinematic lighting, ethereal atmosphere).

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
