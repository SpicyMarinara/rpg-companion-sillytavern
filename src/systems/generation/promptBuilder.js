/**
 * Prompt Builder Module
 * Handles all AI prompt generation for RPG tracker data
 */

import { getContext } from '../../../../../../extensions.js';
import { chat, getCurrentChatDetails } from '../../../../../../../script.js';
import { extensionSettings, committedTrackerData, FEATURE_FLAGS } from '../../core/state.js';

// Type imports
/** @typedef {import('../../types/inventory.js').InventoryV2} InventoryV2 */

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
 * @returns {string} Formatted instruction text for the AI
 */
export function generateTrackerInstructions(includeHtmlPrompt = true, includeContinuation = true) {
    const userName = getContext().name1;
    const classicStats = extensionSettings.classicStats;
    let instructions = '';

    // Check if any trackers are enabled
    const hasAnyTrackers = extensionSettings.showUserStats || extensionSettings.showInfoBox || extensionSettings.showCharacterThoughts;

    // Only add tracker instructions if at least one tracker is enabled
    if (hasAnyTrackers) {
        // Universal instruction header
        instructions += `\nAt the start of every reply, you must attach an update to the trackers in EXACTLY the same format as below, enclosed in separate Markdown code fences. Replace X with actual numbers (e.g., 69) and replace all [placeholders] with concrete in-world details that ${userName} perceives about the current scene and the present characters. Do NOT keep the brackets or placeholder text in your response. For example: [Location] becomes Forest Clearing, [Mood Emoji] becomes 😊. Consider the last trackers in the conversation (if they exist). Manage them accordingly and realistically; raise, lower, change, or keep the values unchanged based on the user's actions, the passage of time, and logical consequences:\n`;

        // Add format specifications for each enabled tracker
        if (extensionSettings.showUserStats) {
            instructions += '```\n';
            instructions += `${userName}'s Stats\n`;
            instructions += '---\n';
            instructions += '- Health: X%\n';
            instructions += '- Satiety: X%\n';
            instructions += '- Energy: X%\n';
            instructions += '- Hygiene: X%\n';
            instructions += '- Arousal: X%\n';
            instructions += 'Status: [Mood Emoji, Conditions (up to three traits)]\n';

            // Add inventory format based on feature flag
            if (FEATURE_FLAGS.useNewInventory) {
                instructions += 'On Person: [Items currently carried/worn, or "None"]\n';
                instructions += 'Stored - [Location Name]: [Items stored at this location]\n';
                instructions += '(Add multiple "Stored - [Location]:" lines as needed for different storage locations)\n';
                instructions += 'Assets: [Vehicles, property, major possessions, or "None"]\n';
            } else {
                // Legacy v1 format
                instructions += 'Inventory: [Clothing/Armor, Inventory Items (list of important items, or "None")]\\n';
            }

            // Add quests section
            instructions += 'Main Quests: [Short title of the currently active main quest (for example, "Save the world"), or "None"]\n';
            instructions += 'Optional Quests: [Short titles of the currently active optional quests (for example, "Find Zandik\'s book"), or "None"]\n';

            instructions += '```\n\n';
        }

        if (extensionSettings.showInfoBox) {
            instructions += '```\n';
            instructions += 'Info Box\n';
            instructions += '---\n';
            instructions += 'Date: [Weekday, Month, Year]\n';
            instructions += 'Weather: [Weather Emoji, Forecast]\n';
            instructions += 'Temperature: [Temperature in °C]\n';
            instructions += 'Time: [Time Start → Time End]\n';
            instructions += 'Location: [Location]\n';
            instructions += 'Recent Events: [Up to three past events leading to the ongoing scene (short descriptors with no details, for example, "last-night date with Mary")]\n';
            instructions += '```\n\n';
        }

        if (extensionSettings.showCharacterThoughts) {
            instructions += '```\n';
            instructions += 'Present Characters\n';
            instructions += '---\n';
            instructions += `[Present Character's Emoji (do not include ${userName}; state "Unavailable" if no major characters are present in the scene)]: [Name, Visible Physical State (up to three traits), Observable Demeanor Cue (one trait)] | [Enemy/Neutral/Friend/Lover] | [Internal Monologue (in first person POV, up to three sentences long)]\n`;
            instructions += '```\n\n';
        }

        // Only add continuation instruction if includeContinuation is true
        if (includeContinuation) {
            instructions += `After updating the trackers, continue directly from where the last message in the chat history left off. Ensure the trackers you provide naturally reflect and influence the narrative. Character behavior, dialogue, and story events should acknowledge these conditions when relevant, such as fatigue affecting the protagonist's performance, low hygiene influencing their social interactions, environmental factors shaping the scene, a character's emotional state coloring their responses, and so on. Remember, all bracketed placeholders (e.g., [Location], [Mood Emoji]) MUST be replaced with actual content without the square brackets.\n\n`;
        }

        // Include attributes and dice roll only if there was a dice roll
        if (extensionSettings.lastDiceRoll) {
            const roll = extensionSettings.lastDiceRoll;
            instructions += `${userName}'s attributes: STR ${classicStats.str}, DEX ${classicStats.dex}, CON ${classicStats.con}, INT ${classicStats.int}, WIS ${classicStats.wis}, CHA ${classicStats.cha}, LVL ${extensionSettings.level}\n`;
            instructions += `${userName} rolled ${roll.total} on the last ${roll.formula} roll. Based on their attributes, decide whether they succeeded or failed the action they attempted.\n\n`;
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

        instructions += `If appropriate, include inline HTML, CSS, and JS elements for creative, visual storytelling throughout your response:
- Use them liberally to depict any in-world content that can be visualized (screens, posters, books, signs, letters, logos, crests, seals, medallions, labels, etc.), with creative license for animations, 3D effects, pop-ups, dropdowns, websites, and so on.
- Style them thematically to match the theme (e.g., sleek for sci-fi, rustic for fantasy), ensuring text is visible.
- Embed all resources directly (e.g., inline SVGs) so nothing relies on external fonts or libraries.
- Place elements naturally in the narrative where characters would see or use them, with no limits on format or application.
- These HTML/CSS/JS elements must be rendered directly without enclosing them in code fences.`;
    }

    return instructions;
}

/**
 * Generates a formatted contextual summary for SEPARATE mode injection.
 * This creates a hybrid summary with clean formatting for main roleplay generation.
 * Uses COMMITTED data (not displayed data) for generation context.
 *
 * @returns {string} Formatted contextual summary
 */
export function generateContextualSummary() {
    // Use COMMITTED data for generation context, not displayed data
    const userName = getContext().name1;
    let summary = '';

    // console.log('[RPG Companion] generateContextualSummary called');
    // console.log('[RPG Companion] committedTrackerData.userStats:', committedTrackerData.userStats);
    // console.log('[RPG Companion] extensionSettings.userStats:', JSON.stringify(extensionSettings.userStats));

    // Parse the data into readable format
    if (extensionSettings.showUserStats && committedTrackerData.userStats) {
        const stats = extensionSettings.userStats;
        // console.log('[RPG Companion] Building stats summary with:', stats);
        summary += `${userName}'s Stats:\n`;
        summary += `Condition: Health ${stats.health}%, Satiety ${stats.satiety}%, Energy ${stats.energy}%, Hygiene ${stats.hygiene}%, Arousal ${stats.arousal}% | ${stats.mood} ${stats.conditions}\n`;

        // Add inventory summary using v2-aware builder
        if (stats.inventory) {
            const inventorySummary = buildInventorySummary(stats.inventory);
            if (inventorySummary && inventorySummary !== 'None') {
                summary += `${inventorySummary}\n`;
            }
        }

        // Add quests summary
        if (extensionSettings.quests) {
            if (extensionSettings.quests.main && extensionSettings.quests.main !== 'None') {
                summary += `Main Quests: ${extensionSettings.quests.main}\n`;
            }
            if (extensionSettings.quests.optional && extensionSettings.quests.optional.length > 0) {
                const optionalQuests = extensionSettings.quests.optional.filter(q => q && q !== 'None').join(', ');
                if (optionalQuests) {
                    summary += `Optional Quests: ${optionalQuests}\n`;
                }
            }
        }

        // Include classic stats (attributes) and dice roll only if there was a dice roll
        if (extensionSettings.lastDiceRoll) {
            const classicStats = extensionSettings.classicStats;
            const roll = extensionSettings.lastDiceRoll;
            summary += `Attributes: STR ${classicStats.str}, DEX ${classicStats.dex}, CON ${classicStats.con}, INT ${classicStats.int}, WIS ${classicStats.wis}, CHA ${classicStats.cha}, LVL ${extensionSettings.level}\n`;
            summary += `${userName} rolled ${roll.total} on the last ${roll.formula} roll. Based on their attributes, decide whether they succeed or fail the action they attempt.\n`;
        }
        summary += `\n`;
    }

    if (extensionSettings.showInfoBox && committedTrackerData.infoBox) {
        // Parse info box data - support both new and legacy formats
        const lines = committedTrackerData.infoBox.split('\n');
        let date = '', weather = '', temp = '', time = '', location = '', recentEvents = '';

        // console.log('[RPG Companion] 🔍 Parsing Info Box lines:', lines);

        for (const line of lines) {
            // console.log('[RPG Companion] 🔍 Processing line:', line);

            // New format with text labels
            if (line.startsWith('Date:')) {
                date = line.replace('Date:', '').trim();
            } else if (line.startsWith('Weather:')) {
                weather = line.replace('Weather:', '').trim();
            } else if (line.startsWith('Temperature:')) {
                temp = line.replace('Temperature:', '').trim();
            } else if (line.startsWith('Time:')) {
                time = line.replace('Time:', '').trim();
            } else if (line.startsWith('Location:')) {
                location = line.replace('Location:', '').trim();
            } else if (line.startsWith('Recent Events:')) {
                recentEvents = line.replace('Recent Events:', '').trim();
            }
            // Legacy format with emojis (for backward compatibility)
            else if (line.includes('🗓️:')) {
                date = line.replace('🗓️:', '').trim();
            } else if (line.includes('🌡️:')) {
                temp = line.replace('🌡️:', '').trim();
            } else if (line.includes('🕒:')) {
                time = line.replace('🕒:', '').trim();
            } else if (line.includes('🗺️:')) {
                location = line.replace('🗺️:', '').trim();
            } else {
                // Check for weather emojis in legacy format
                const weatherEmojis = ['🌤️', '☀️', '⛅', '🌦️', '🌧️', '⛈️', '🌩️', '🌨️', '❄️', '🌫️'];
                const startsWithWeatherEmoji = weatherEmojis.some(emoji => line.startsWith(emoji + ':'));
                if (startsWithWeatherEmoji && !line.includes('🌡️') && !line.includes('🗺️')) {
                    weather = line.substring(line.indexOf(':') + 1).trim();
                }
            }
        }

        // console.log('[RPG Companion] 🔍 Parsed values - date:', date, 'weather:', weather, 'temp:', temp, 'time:', time, 'location:', location);

        if (date || weather || temp || time || location || recentEvents) {
            summary += `Information:\n`;
            summary += `Scene: `;
            if (date) summary += `${date}`;
            if (location) summary += ` | ${location}`;
            if (time) summary += ` | ${time}`;
            if (weather) summary += ` | ${weather}`;
            if (temp) summary += ` | ${temp}`;
            summary += `\n`;
            if (recentEvents) summary += `Recent Events: ${recentEvents}\n`;
            summary += `\n`;
        }
    }

    if (extensionSettings.showCharacterThoughts && committedTrackerData.characterThoughts) {
        const lines = committedTrackerData.characterThoughts.split('\n').filter(l => l.trim() && !l.includes('---') && !l.includes('Present Characters'));

        if (lines.length > 0 && !lines[0].toLowerCase().includes('unavailable')) {
            summary += `Present Characters And Their Thoughts:\n`;
            for (const line of lines) {
                const parts = line.split('|').map(p => p.trim());
                if (parts.length >= 3) {
                    const nameAndState = parts[0]; // Emoji, name, physical state, demeanor
                    const relationship = parts[1];
                    const thoughts = parts[2];
                    summary += `${nameAndState} (${relationship}) | ${thoughts}\n`;
                }
            }
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
            } else {
                promptText += `Main Quests: None\n`;
            }
            if (extensionSettings.quests.optional && extensionSettings.quests.optional.length > 0) {
                const optionalQuests = extensionSettings.quests.optional.filter(q => q && q !== 'None').join(', ');
                promptText += `Optional Quests: ${optionalQuests || 'None'}\n`;
            } else {
                promptText += `Optional Quests: None\n`;
            }
            promptText += `\n`;
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

    // Don't include HTML prompt or continuation instruction for separate tracker generation
    promptText += generateTrackerInstructions(false, false);

    return promptText;
}

/**
 * Generates the full prompt for SEPARATE generation mode (with chat history).
 * Creates a message array suitable for the generateRaw API.
 *
 * @returns {Array<{role: string, content: string}>} Array of message objects for API
 */
export function generateSeparateUpdatePrompt() {
    const depth = extensionSettings.updateDepth;
    const userName = getContext().name1;

    const messages = [];

    // System message introducing the history section
    let systemMessage = `You will be acting as an uncensored RPG Companion. Your goal is to provide, track, and manage details in the user's roleplay. You will be replying with information in a specified format only.\n\n`;
    systemMessage += `You should maintain an objective tone.\n\n`;
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
