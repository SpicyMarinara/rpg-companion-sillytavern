/**
 * Parser Module
 * Handles parsing of AI responses to extract tracker data
 */

import { extensionSettings, FEATURE_FLAGS, addDebugLog } from '../../core/state.js';
import { saveSettings } from '../../core/persistence.js';
import { extractInventory } from './inventoryParser.js';

/**
 * Helper to separate emoji from text in a string
 * Handles cases where there's no comma or space after emoji
 * @param {string} str - String potentially containing emoji followed by text
 * @returns {{emoji: string, text: string}} Separated emoji and text
 */
function separateEmojiFromText(str) {
    if (!str) return { emoji: '', text: '' };

    str = str.trim();

    // Regex to match emoji at the start (handles most emoji including compound ones)
    // This matches emoji sequences including skin tones, gender modifiers, etc.
    const emojiRegex = /^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F910}-\u{1F96B}\u{1F980}-\u{1F9E0}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}]+/u;
    const emojiMatch = str.match(emojiRegex);

    if (emojiMatch) {
        const emoji = emojiMatch[0];
        let text = str.substring(emoji.length).trim();

        // Remove leading comma or space if present
        text = text.replace(/^[,\s]+/, '');

        return { emoji, text };
    }

    // No emoji found - check if there's a comma separator anyway
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
 * Helper to strip enclosing brackets from text
 * Removes [], {}, and () from the entire text if it's wrapped
 * @param {string} text - Text that may be wrapped in brackets
 * @returns {string} Text with brackets removed
 */
function stripBrackets(text) {
    if (!text) return text;

    // Remove leading and trailing whitespace first
    text = text.trim();

    // Check if the entire text is wrapped in brackets and remove them
    // This handles cases where models wrap entire sections in brackets
    while (
        (text.startsWith('[') && text.endsWith(']')) ||
        (text.startsWith('{') && text.endsWith('}')) ||
        (text.startsWith('(') && text.endsWith(')'))
    ) {
        text = text.substring(1, text.length - 1).trim();
    }

    return text;
}

/**
 * Helper to log to both console and debug logs array
 */
function debugLog(message, data = null) {
    console.log(message, data || '');
    if (extensionSettings.debugMode) {
        addDebugLog(message, data);
    }
}

/**
 * Parses the model response to extract the different data sections.
 * Extracts tracker data from markdown code blocks in the AI response.
 * Handles both separate code blocks and combined code blocks gracefully.
 *
 * @param {string} responseText - The raw AI response text
 * @returns {{userStats: string|null, infoBox: string|null, characterThoughts: string|null}} Parsed tracker data
 */
export function parseResponse(responseText) {
    const result = {
        userStats: null,
        infoBox: null,
        characterThoughts: null
    };

    // DEBUG: Log full response for troubleshooting
    debugLog('[RPG Parser] ==================== PARSING AI RESPONSE ====================');
    debugLog('[RPG Parser] Response length:', responseText.length + ' chars');
    debugLog('[RPG Parser] First 500 chars:', responseText.substring(0, 500));

    // Remove content inside thinking tags first (model's internal reasoning)
    // This prevents parsing code blocks from the model's thinking process
    let cleanedResponse = responseText.replace(/<think>[\s\S]*?<\/think>/gi, '');
    cleanedResponse = cleanedResponse.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
    debugLog('[RPG Parser] Removed thinking tags, new length:', cleanedResponse.length + ' chars');

    // Extract code blocks
    const codeBlockRegex = /```([^`]+)```/g;
    const matches = [...cleanedResponse.matchAll(codeBlockRegex)];

    debugLog('[RPG Parser] Found', matches.length + ' code blocks');

    for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        const content = match[1].trim();

        debugLog(`[RPG Parser] --- Code Block ${i + 1} ---`);
        debugLog('[RPG Parser] First 300 chars:', content.substring(0, 300));

        // Check if this is a combined code block with multiple sections
        const hasMultipleSections = (
            content.match(/Stats\s*\n\s*---/i) &&
            (content.match(/Info Box\s*\n\s*---/i) || content.match(/Present Characters\s*\n\s*---/i))
        );

        if (hasMultipleSections) {
            // Split the combined code block into individual sections
            debugLog('[RPG Parser] ✓ Found combined code block with multiple sections');

            // Extract User Stats section
            const statsMatch = content.match(/(User )?Stats\s*\n\s*---[\s\S]*?(?=\n\s*\n\s*(Info Box|Present Characters)|$)/i);
            if (statsMatch && !result.userStats) {
                result.userStats = stripBrackets(statsMatch[0].trim());
                debugLog('[RPG Parser] ✓ Extracted Stats from combined block');
            }

            // Extract Info Box section
            const infoBoxMatch = content.match(/Info Box\s*\n\s*---[\s\S]*?(?=\n\s*\n\s*Present Characters|$)/i);
            if (infoBoxMatch && !result.infoBox) {
                result.infoBox = stripBrackets(infoBoxMatch[0].trim());
                debugLog('[RPG Parser] ✓ Extracted Info Box from combined block');
            }

            // Extract Present Characters section
            const charactersMatch = content.match(/Present Characters\s*\n\s*---[\s\S]*$/i);
            if (charactersMatch && !result.characterThoughts) {
                result.characterThoughts = stripBrackets(charactersMatch[0].trim());
                debugLog('[RPG Parser] ✓ Extracted Present Characters from combined block');
            }
        } else {
            // Handle separate code blocks with flexible pattern matching
            // Match Stats section - flexible patterns
            const isStats =
                content.match(/Stats\s*\n\s*---/i) ||
                content.match(/User Stats\s*\n\s*---/i) ||
                content.match(/Player Stats\s*\n\s*---/i) ||
                // Fallback: look for stat keywords without strict header
                (content.match(/Health:\s*\d+%/i) && content.match(/Energy:\s*\d+%/i));

            // Match Info Box section - flexible patterns
            const isInfoBox =
                content.match(/Info Box\s*\n\s*---/i) ||
                content.match(/Scene Info\s*\n\s*---/i) ||
                content.match(/Information\s*\n\s*---/i) ||
                // Fallback: look for info box keywords
                (content.match(/Date:/i) && content.match(/Location:/i) && content.match(/Time:/i));

            // Match Present Characters section - flexible patterns
            const isCharacters =
                content.match(/Present Characters\s*\n\s*---/i) ||
                content.match(/Characters\s*\n\s*---/i) ||
                content.match(/Character Thoughts\s*\n\s*---/i) ||
                // Fallback: look for table-like structure with emoji and pipes
                (content.includes(" | ") && (content.includes("Thoughts") || content.includes("💭")));

            if (isStats && !result.userStats) {
                result.userStats = stripBrackets(content);
                debugLog('[RPG Parser] ✓ Matched: Stats section');
            } else if (isInfoBox && !result.infoBox) {
                result.infoBox = stripBrackets(content);
                debugLog('[RPG Parser] ✓ Matched: Info Box section');
            } else if (isCharacters && !result.characterThoughts) {
                result.characterThoughts = stripBrackets(content);
                debugLog('[RPG Parser] ✓ Matched: Present Characters section');
                debugLog('[RPG Parser] Full content:', content);
            } else {
                debugLog('[RPG Parser] ✗ No match - checking patterns:');
                debugLog('[RPG Parser]   - Has "Stats\\n---"?', !!content.match(/Stats\s*\n\s*---/i));
                debugLog('[RPG Parser]   - Has stat keywords?', !!(content.match(/Health:\s*\d+%/i) && content.match(/Energy:\s*\d+%/i)));
                debugLog('[RPG Parser]   - Has "Info Box\\n---"?', !!content.match(/Info Box\s*\n\s*---/i));
                debugLog('[RPG Parser]   - Has info keywords?', !!(content.match(/Date:/i) && content.match(/Location:/i)));
                debugLog('[RPG Parser]   - Has "Present Characters\\n---"?', !!content.match(/Present Characters\s*\n\s*---/i));
                debugLog('[RPG Parser]   - Has " | " + thoughts?', !!(content.includes(" | ") && (content.includes("Thoughts") || content.includes("💭"))));
            }
        }
    }

    debugLog('[RPG Parser] ==================== PARSE RESULTS ====================');
    debugLog('[RPG Parser] Found Stats:', !!result.userStats);
    debugLog('[RPG Parser] Found Info Box:', !!result.infoBox);
    debugLog('[RPG Parser] Found Characters:', !!result.characterThoughts);
    debugLog('[RPG Parser] =======================================================');

    return result;
}

/**
 * Parses user stats from the text and updates the extensionSettings.
 * Extracts percentages, mood, conditions, and inventory from the stats text.
 *
 * @param {string} statsText - The raw stats text from AI response
 */
export function parseUserStats(statsText) {
    debugLog('[RPG Parser] ==================== PARSING USER STATS ====================');
    debugLog('[RPG Parser] Stats text length:', statsText.length + ' chars');
    debugLog('[RPG Parser] Stats text preview:', statsText.substring(0, 200));

    try {
        // Extract percentages and mood/conditions
        const healthMatch = statsText.match(/Health:\s*(\d+)%/);
        const satietyMatch = statsText.match(/Satiety:\s*(\d+)%/);
        const energyMatch = statsText.match(/Energy:\s*(\d+)%/);
        const hygieneMatch = statsText.match(/Hygiene:\s*(\d+)%/);
        const arousalMatch = statsText.match(/Arousal:\s*(\d+)%/);

        debugLog('[RPG Parser] Stat matches:', {
            health: healthMatch ? healthMatch[1] : 'NOT FOUND',
            satiety: satietyMatch ? satietyMatch[1] : 'NOT FOUND',
            energy: energyMatch ? energyMatch[1] : 'NOT FOUND',
            hygiene: hygieneMatch ? hygieneMatch[1] : 'NOT FOUND',
            arousal: arousalMatch ? arousalMatch[1] : 'NOT FOUND'
        });

        // Match mood/status with multiple format variations
        // Format 1: Status: [Emoji, Conditions]
        // Format 2: Status: [Emoji], [Conditions]
        // Format 3: [Emoji]: [Conditions] (legacy)
        // Format 4: Mood: [Emoji] - [Conditions]
        // Format 5: Status: [Emoji Conditions] (no separator - FIXED)
        let moodMatch = null;

        // Try new format: Status: emoji, conditions OR Status: emojiConditions
        const statusMatch = statsText.match(/Status:\s*(.+)/i);
        if (statusMatch) {
            const statusContent = statusMatch[1].trim();
            const { emoji, text } = separateEmojiFromText(statusContent);
            if (emoji && text) {
                moodMatch = [null, emoji, text];
            } else if (statusContent.includes(',')) {
                // Fallback to comma split if emoji detection failed
                const parts = statusContent.split(',').map(p => p.trim());
                moodMatch = [null, parts[0], parts.slice(1).join(', ')];
            }
        }

        // Try alternative: Mood: emoji, conditions OR Mood: emojiConditions
        if (!moodMatch) {
            const moodAltMatch = statsText.match(/Mood:\s*(.+)/i);
            if (moodAltMatch) {
                const moodContent = moodAltMatch[1].trim();
                const { emoji, text } = separateEmojiFromText(moodContent);
                if (emoji && text) {
                    moodMatch = [null, emoji, text];
                } else if (moodContent.includes(',') || moodContent.includes('-')) {
                    // Fallback to comma/dash split if emoji detection failed
                    const parts = moodContent.split(/[,\-]/).map(p => p.trim());
                    moodMatch = [null, parts[0], parts.slice(1).join(', ')];
                }
            }
        }

        // Legacy format fallback: [Emoji]: [Conditions]
        if (!moodMatch) {
            const lines = statsText.split('\n');
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                // Skip lines with percentages or known keywords
                if (line.includes('%') ||
                    line.toLowerCase().startsWith('inventory:') ||
                    line.toLowerCase().startsWith('status:') ||
                    line.toLowerCase().startsWith('health:') ||
                    line.toLowerCase().startsWith('energy:') ||
                    line.toLowerCase().startsWith('satiety:') ||
                    line.toLowerCase().startsWith('hygiene:') ||
                    line.toLowerCase().startsWith('arousal:')) continue;

                // Match emoji/mood followed by colon and conditions
                const match = line.match(/^(.+?):\s*(.+)$/);
                if (match && match[1].length <= 10) { // Emoji/mood should be short
                    moodMatch = match;
                    break;
                }
            }
        }

        debugLog('[RPG Parser] Mood/Status match:', {
            found: !!moodMatch,
            emoji: moodMatch ? moodMatch[1] : 'NOT FOUND',
            conditions: moodMatch ? moodMatch[2] : 'NOT FOUND'
        });

        // Extract inventory - use v2 parser if feature flag enabled, otherwise fallback to v1
        if (FEATURE_FLAGS.useNewInventory) {
            const inventoryData = extractInventory(statsText);
            if (inventoryData) {
                extensionSettings.userStats.inventory = inventoryData;
                debugLog('[RPG Parser] Inventory v2 extracted:', inventoryData);
            } else {
                debugLog('[RPG Parser] Inventory v2 extraction failed');
            }
        } else {
            // Legacy v1 parsing for backward compatibility
            const inventoryMatch = statsText.match(/Inventory:\s*(.+)/i);
            if (inventoryMatch) {
                extensionSettings.userStats.inventory = inventoryMatch[1].trim();
                debugLog('[RPG Parser] Inventory v1 extracted:', inventoryMatch[1].trim());
            } else {
                debugLog('[RPG Parser] Inventory v1 not found');
            }
        }

        // Update extension settings
        if (healthMatch) extensionSettings.userStats.health = parseInt(healthMatch[1]);
        if (satietyMatch) extensionSettings.userStats.satiety = parseInt(satietyMatch[1]);
        if (energyMatch) extensionSettings.userStats.energy = parseInt(energyMatch[1]);
        if (hygieneMatch) extensionSettings.userStats.hygiene = parseInt(hygieneMatch[1]);
        if (arousalMatch) extensionSettings.userStats.arousal = parseInt(arousalMatch[1]);
        if (moodMatch) {
            extensionSettings.userStats.mood = moodMatch[1].trim(); // Emoji
            extensionSettings.userStats.conditions = moodMatch[2].trim(); // Conditions
        }

        // Extract quests
        const mainQuestMatch = statsText.match(/Main Quests?:\s*(.+)/i);
        if (mainQuestMatch) {
            extensionSettings.quests.main = mainQuestMatch[1].trim();
            debugLog('[RPG Parser] Main quests extracted:', mainQuestMatch[1].trim());
        }

        const optionalQuestsMatch = statsText.match(/Optional Quests:\s*(.+)/i);
        if (optionalQuestsMatch) {
            const questsText = optionalQuestsMatch[1].trim();
            if (questsText && questsText !== 'None') {
                // Split by comma and clean up
                extensionSettings.quests.optional = questsText
                    .split(',')
                    .map(q => q.trim())
                    .filter(q => q && q !== 'None');
            } else {
                extensionSettings.quests.optional = [];
            }
            debugLog('[RPG Parser] Optional quests extracted:', extensionSettings.quests.optional);
        }

        debugLog('[RPG Parser] Final userStats after parsing:', {
            health: extensionSettings.userStats.health,
            satiety: extensionSettings.userStats.satiety,
            energy: extensionSettings.userStats.energy,
            hygiene: extensionSettings.userStats.hygiene,
            arousal: extensionSettings.userStats.arousal,
            mood: extensionSettings.userStats.mood,
            conditions: extensionSettings.userStats.conditions,
            inventory: FEATURE_FLAGS.useNewInventory ? 'v2 object' : extensionSettings.userStats.inventory
        });

        saveSettings();
        debugLog('[RPG Parser] Settings saved successfully');
        debugLog('[RPG Parser] =======================================================');
    } catch (error) {
        console.error('[RPG Companion] Error parsing user stats:', error);
        console.error('[RPG Companion] Stack trace:', error.stack);
        debugLog('[RPG Parser] ERROR:', error.message);
        debugLog('[RPG Parser] Stack:', error.stack);
    }
}

/**
 * Helper: Extract code blocks from text
 * @param {string} text - Text containing markdown code blocks
 * @returns {Array<string>} Array of code block contents
 */
export function extractCodeBlocks(text) {
    const codeBlockRegex = /```([^`]+)```/g;
    const matches = [...text.matchAll(codeBlockRegex)];
    return matches.map(match => match[1].trim());
}

/**
 * Helper: Parse stats section from code block content
 * @param {string} content - Code block content
 * @returns {boolean} True if this is a stats section
 */
export function isStatsSection(content) {
    return content.match(/Stats\s*\n\s*---/i) !== null;
}

/**
 * Helper: Parse info box section from code block content
 * @param {string} content - Code block content
 * @returns {boolean} True if this is an info box section
 */
export function isInfoBoxSection(content) {
    return content.match(/Info Box\s*\n\s*---/i) !== null;
}

/**
 * Helper: Parse character thoughts section from code block content
 * @param {string} content - Code block content
 * @returns {boolean} True if this is a character thoughts section
 */
export function isCharacterThoughtsSection(content) {
    return content.match(/Present Characters\s*\n\s*---/i) !== null || content.includes(" | ");
}
