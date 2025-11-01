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
 * Helper to strip enclosing brackets from text and remove placeholder brackets
 * Removes [], {}, and () from the entire text if it's wrapped, plus removes
 * placeholder content like [Location], [Mood Emoji], etc.
 * @param {string} text - Text that may contain brackets
 * @returns {string} Text with brackets and placeholders removed
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

    // Remove placeholder text patterns like [Location], [Mood Emoji], [Name], etc.
    // Pattern matches: [anything with letters/spaces inside]
    // This preserves actual content while removing template placeholders
    const placeholderPattern = /\[([A-Za-z\s\/]+)\]/g;

    // Check if a bracketed text looks like a placeholder vs real content
    const isPlaceholder = (match, content) => {
        // Common placeholder words to detect
        const placeholderKeywords = [
            'location', 'mood', 'emoji', 'name', 'description', 'placeholder',
            'time', 'date', 'weather', 'temperature', 'action', 'appearance',
            'skill', 'quest', 'item', 'character', 'field', 'value', 'details',
            'relationship', 'thoughts', 'stat', 'status', 'lover', 'friend',
            'enemy', 'neutral', 'weekday', 'month', 'year', 'forecast'
        ];

        const lowerContent = content.toLowerCase().trim();

        // If it contains common placeholder keywords, it's likely a placeholder
        if (placeholderKeywords.some(keyword => lowerContent.includes(keyword))) {
            return true;
        }

        // If it's a short generic phrase (1-3 words) with only letters/spaces, might be placeholder
        const wordCount = content.trim().split(/\s+/).length;
        if (wordCount <= 3 && /^[A-Za-z\s\/]+$/.test(content)) {
            return true;
        }

        return false;
    };

    // Replace placeholders with empty string, keep real content
    text = text.replace(placeholderPattern, (match, content) => {
        if (isPlaceholder(match, content)) {
            return ''; // Remove placeholder
        }
        return match; // Keep real bracketed content
    });

    // Clean up any resulting empty labels (e.g., "Status: " with nothing after)
    text = text.replace(/^([A-Za-z\s]+):\s*$/gm, ''); // Remove lines that are just "Label: " with nothing
    text = text.replace(/^([A-Za-z\s]+):\s*,/gm, '$1:'); // Fix "Label: ," patterns
    text = text.replace(/:\s*\|/g, ':'); // Fix ": |" patterns
    text = text.replace(/\|\s*\|/g, '|'); // Fix "| |" patterns (double pipes from removed content)
    text = text.replace(/\|\s*$/gm, ''); // Remove trailing pipes at end of lines

    // Clean up multiple spaces and empty lines
    text = text.replace(/\s{2,}/g, ' '); // Multiple spaces to single space
    text = text.replace(/^\s*\n/gm, ''); // Remove empty lines

    return text.trim();
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
                // Fallback: look for new multi-line format patterns
                (content.match(/^-\s+\w+/m) && content.match(/Details:/i));

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
                debugLog('[RPG Parser]   - Has new format ("- Name" + "Details:")?', !!(content.match(/^-\s+\w+/m) && content.match(/Details:/i)));
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
        // Get custom stat configuration
        const trackerConfig = extensionSettings.trackerConfig;
        const customStats = trackerConfig?.userStats?.customStats || [];
        const enabledStats = customStats.filter(s => s && s.enabled && s.name && s.id);

        debugLog('[RPG Parser] Enabled custom stats:', enabledStats.map(s => s.name));

        // Dynamically parse custom stats
        for (const stat of enabledStats) {
            const statRegex = new RegExp(`${stat.name}:\\s*(\\d+)%`, 'i');
            const match = statsText.match(statRegex);
            if (match) {
                // Store using the stat ID (lowercase normalized name)
                const statId = stat.id;
                extensionSettings.userStats[statId] = parseInt(match[1]);
                debugLog(`[RPG Parser] Parsed ${stat.name}:`, match[1]);
            } else {
                debugLog(`[RPG Parser] ${stat.name} NOT FOUND`);
            }
        }

        // Parse RPG attributes if enabled
        if (trackerConfig?.userStats?.showRPGAttributes) {
            const strMatch = statsText.match(/STR:\s*(\d+)/i);
            const dexMatch = statsText.match(/DEX:\s*(\d+)/i);
            const conMatch = statsText.match(/CON:\s*(\d+)/i);
            const intMatch = statsText.match(/INT:\s*(\d+)/i);
            const wisMatch = statsText.match(/WIS:\s*(\d+)/i);
            const chaMatch = statsText.match(/CHA:\s*(\d+)/i);
            const lvlMatch = statsText.match(/LVL:\s*(\d+)/i);

            if (strMatch) extensionSettings.classicStats.str = parseInt(strMatch[1]);
            if (dexMatch) extensionSettings.classicStats.dex = parseInt(dexMatch[1]);
            if (conMatch) extensionSettings.classicStats.con = parseInt(conMatch[1]);
            if (intMatch) extensionSettings.classicStats.int = parseInt(intMatch[1]);
            if (wisMatch) extensionSettings.classicStats.wis = parseInt(wisMatch[1]);
            if (chaMatch) extensionSettings.classicStats.cha = parseInt(chaMatch[1]);
            if (lvlMatch) extensionSettings.level = parseInt(lvlMatch[1]);

            debugLog('[RPG Parser] RPG Attributes parsed');
        }

        // Match status section if enabled
        const statusConfig = trackerConfig?.userStats?.statusSection;
        if (statusConfig?.enabled) {
            let moodMatch = null;

            // Try Status: format
            const statusMatch = statsText.match(/Status:\s*(.+)/i);
            if (statusMatch) {
                const statusContent = statusMatch[1].trim();

                // Extract mood emoji if enabled
                if (statusConfig.showMoodEmoji) {
                    const { emoji, text } = separateEmojiFromText(statusContent);
                    if (emoji) {
                        extensionSettings.userStats.mood = emoji;
                        // Remaining text contains custom status fields
                        if (text) {
                            extensionSettings.userStats.conditions = text;
                        }
                        moodMatch = true;
                    }
                } else {
                    // No mood emoji, whole status is conditions
                    extensionSettings.userStats.conditions = statusContent;
                    moodMatch = true;
                }
            }

            debugLog('[RPG Parser] Status match:', {
                found: !!moodMatch,
                mood: extensionSettings.userStats.mood,
                conditions: extensionSettings.userStats.conditions
            });
        }

        // Parse skills section if enabled
        const skillsConfig = trackerConfig?.userStats?.skillsSection;
        if (skillsConfig?.enabled) {
            const skillsMatch = statsText.match(/Skills:\s*(.+)/i);
            if (skillsMatch) {
                extensionSettings.userStats.skills = skillsMatch[1].trim();
                debugLog('[RPG Parser] Skills extracted:', skillsMatch[1].trim());
            }
        }

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
