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

    const originalLength = text.length;
    debugLog('[RPG Parser] stripBrackets: Input length:', originalLength);
    debugLog('[RPG Parser] stripBrackets: Contains "Skills:":', text.includes('Skills:'));

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
        debugLog('[RPG Parser] stripBrackets: Removed wrapping brackets, new length:', text.length);
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
    let removedPlaceholders = [];
    text = text.replace(placeholderPattern, (match, content) => {
        if (isPlaceholder(match, content)) {
            removedPlaceholders.push(match);
            return ''; // Remove placeholder
        }
        return match; // Keep real bracketed content
    });
    if (removedPlaceholders.length > 0) {
        debugLog('[RPG Parser] stripBrackets: Removed placeholders:', removedPlaceholders.join(', '));
    }

    // Clean up any resulting empty labels (e.g., "Status: " with nothing after)
    // BUT: Don't remove structural section headers that have content on following lines
    const beforeCleanup = text.length;

    // Known section headers that should NEVER be removed (structural markers)
    const structuralHeaders = ['Skills', 'Status', 'Inventory', 'On Person', 'Stored', 'Assets', 'Main Quest', 'Main Quests', 'Optional Quest', 'Optional Quests'];

    // Split into lines to intelligently remove only truly empty labels
    const lines = text.split('\n');
    const filteredLines = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();

        // Check if this is a label line (ends with colon, no other content)
        const labelMatch = trimmedLine.match(/^([A-Za-z\s]+):\s*$/);

        if (labelMatch) {
            const labelName = labelMatch[1];

            // Never remove structural section headers
            if (structuralHeaders.includes(labelName)) {
                debugLog('[RPG Parser] stripBrackets: Keeping structural header:', trimmedLine);
                filteredLines.push(line);
                continue;
            }

            // Check if there's ANY content in the next few lines (look ahead up to 3 lines)
            let hasContentBelow = false;
            for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
                const futureLine = lines[j].trim();
                if (futureLine === '') continue; // Skip empty lines

                // If we find a line with content (not just another label), this label has content below
                if (futureLine && !/^([A-Za-z\s]+):\s*$/.test(futureLine)) {
                    hasContentBelow = true;
                    break;
                }
            }

            if (hasContentBelow) {
                // This label has content below (even if through other labels), keep it
                debugLog('[RPG Parser] stripBrackets: Keeping section header:', trimmedLine);
                filteredLines.push(line);
            } else {
                // This is a truly empty label with no content anywhere below, remove it
                debugLog('[RPG Parser] stripBrackets: Removing empty label:', trimmedLine);
            }
        } else {
            // Not a label line, keep it
            filteredLines.push(line);
        }
    }

    text = filteredLines.join('\n');

    if (text.length !== beforeCleanup) {
        debugLog('[RPG Parser] stripBrackets: Removed empty labels, chars removed:', beforeCleanup - text.length);
    }

    text = text.replace(/^([A-Za-z\s]+):\s*,/gm, '$1:'); // Fix "Label: ," patterns
    text = text.replace(/:\s*\|/g, ':'); // Fix ": |" patterns
    text = text.replace(/\|\s*\|/g, '|'); // Fix "| |" patterns (double pipes from removed content)
    text = text.replace(/\|\s*$/gm, ''); // Remove trailing pipes at end of lines

    // Clean up multiple spaces and empty lines
    const beforeSpaceCleanup = text.length;
    text = text.replace(/\s{2,}/g, ' '); // Multiple spaces to single space
    text = text.replace(/^\s*\n/gm, ''); // Remove empty lines
    if (text.length !== beforeSpaceCleanup) {
        debugLog('[RPG Parser] stripBrackets: Cleaned up spaces/newlines, chars removed:', beforeSpaceCleanup - text.length);
    }

    const finalLength = text.trim().length;
    debugLog('[RPG Parser] stripBrackets: Output length:', finalLength);
    debugLog('[RPG Parser] stripBrackets: Total chars removed:', originalLength - finalLength);
    debugLog('[RPG Parser] stripBrackets: Contains "Skills:" after processing:', text.includes('Skills:'));

    if (text.includes('Skills:')) {
        const skillsIndex = text.indexOf('Skills:');
        debugLog('[RPG Parser] stripBrackets: Text around Skills (index ' + skillsIndex + '):', text.substring(skillsIndex, skillsIndex + 200));
    } else if (originalLength !== finalLength) {
        debugLog('[RPG Parser] stripBrackets: WARNING - Skills section was removed! Last 200 chars:', text.substring(text.length - 200));
    }

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
 * Extract structured skills data from stats text
 * Parses format:
 * Skills:
 * CategoryName:
 * - SkillName (Lv X)
 * - SkillName (Lv X)
 * Uncategorized:
 * - SkillName (Lv X)
 *
 * @param {string} statsText - Stats section text containing skills
 * @returns {Object|null} Structured skills data or null if not found
 */
function extractSkills(statsText) {
    if (!statsText) {
        debugLog('[RPG Parser] extractSkills: No stats text provided');
        return null;
    }

    debugLog('[RPG Parser] extractSkills: Searching for Skills section in text length:', statsText.length);
    debugLog('[RPG Parser] extractSkills: Text contains "Skills:":', statsText.includes('Skills:'));

    // Find the Skills section
    const skillsMatch = statsText.match(/Skills:([\s\S]*?)(?=\n\n|On Person:|Stored|Assets:|Main Quest|Optional Quest|$)/i);
    if (!skillsMatch) {
        debugLog('[RPG Parser] extractSkills: Main regex did not match');
        debugLog('[RPG Parser] extractSkills: Checking if "On Person:" exists:', statsText.includes('On Person:'));
        debugLog('[RPG Parser] extractSkills: Text around Skills:', statsText.substring(statsText.indexOf('Skills:'), statsText.indexOf('Skills:') + 200));

        // Fallback: try simple format "Skills: skill1, skill2"
        const simpleMatch = statsText.match(/Skills:\s*(.+)/i);
        if (simpleMatch) {
            const skillsText = simpleMatch[1].trim();
            debugLog('[RPG Parser] extractSkills: Simple format matched:', skillsText);
            if (skillsText && skillsText !== 'None') {
                // Return as string for backward compatibility
                return skillsText;
            }
        }
        debugLog('[RPG Parser] extractSkills: No Skills section found');
        return null;
    }

    debugLog('[RPG Parser] extractSkills: Main regex matched, captured length:', skillsMatch[1].length);

    const skillsSection = skillsMatch[1];
    const skillsData = {
        version: 1,
        categories: {},
        uncategorized: []
    };

    // Split into lines and process
    const lines = skillsSection.split('\n').map(line => line.trim()).filter(line => line);

    debugLog('[RPG Parser] Skills section lines:', lines);

    let currentCategory = null;

    for (const line of lines) {
        // Check if this is a category header (ends with colon, no dash)
        if (line.endsWith(':') && !line.startsWith('-')) {
            currentCategory = line.slice(0, -1).trim();
            debugLog(`[RPG Parser] Found category header: "${currentCategory}"`);
            if (currentCategory !== 'Uncategorized' && !skillsData.categories[currentCategory]) {
                skillsData.categories[currentCategory] = [];
                debugLog(`[RPG Parser] Created category array for: "${currentCategory}"`);
            }
            continue;
        }

        // Check if this is a skill line (starts with -, has level info)
        // Try numeric format first: "- Skill Name (Lv 5)"
        let skillMatch = line.match(/^-\s*(.+?)\s*\(Lv\s*(\d+)\)/i);
        if (skillMatch) {
            const skillName = skillMatch[1].trim();
            const level = parseInt(skillMatch[2], 10) || 1;

            const skill = {
                name: skillName,
                level: level,
                xp: 0,
                maxXP: 100
            };

            if (currentCategory === 'Uncategorized' || currentCategory === null) {
                debugLog(`[RPG Parser] Adding "${skillName}" to uncategorized (currentCategory="${currentCategory}")`);
                skillsData.uncategorized.push(skill);
            } else if (currentCategory && skillsData.categories[currentCategory]) {
                debugLog(`[RPG Parser] Adding "${skillName}" to category "${currentCategory}"`);
                skillsData.categories[currentCategory].push(skill);
            } else {
                debugLog(`[RPG Parser] ERROR: Could not add "${skillName}" - currentCategory="${currentCategory}", categoryExists=${!!skillsData.categories[currentCategory]}`);
                // Fallback to uncategorized if category doesn't exist
                skillsData.uncategorized.push(skill);
            }
        } else {
            // Fallback: Try text-based proficiency format: "- Skill Name (Proficient)"
            const textMatch = line.match(/^-\s*(.+?)\s*\((.+?)\)/i);
            if (textMatch) {
                const skillName = textMatch[1].trim();
                const proficiencyText = textMatch[2].trim().toLowerCase();

                // Map text proficiency to numeric level
                const proficiencyMap = {
                    'initiated': 1,
                    'novice': 1,
                    'basic': 2,
                    'beginner': 2,
                    'intermediate': 4,
                    'proficient': 5,
                    'competent': 6,
                    'advanced': 7,
                    'expert': 8,
                    'mastered': 9,
                    'master': 9,
                    'grandmaster': 10,
                    'legendary': 10
                };

                const level = proficiencyMap[proficiencyText] || 5; // Default to 5 if unknown

                const skill = {
                    name: skillName,
                    level: level,
                    xp: 0,
                    maxXP: 100
                };

                if (currentCategory === 'Uncategorized' || currentCategory === null) {
                    debugLog(`[RPG Parser] Adding "${skillName}" to uncategorized (currentCategory="${currentCategory}")`);
                    skillsData.uncategorized.push(skill);
                } else if (currentCategory && skillsData.categories[currentCategory]) {
                    debugLog(`[RPG Parser] Adding "${skillName}" to category "${currentCategory}"`);
                    skillsData.categories[currentCategory].push(skill);
                } else {
                    debugLog(`[RPG Parser] ERROR: Could not add "${skillName}" - currentCategory="${currentCategory}", categoryExists=${!!skillsData.categories[currentCategory]}`);
                    // Fallback to uncategorized if category doesn't exist
                    skillsData.uncategorized.push(skill);
                }
            }
        }
    }

    // Return null if no skills were found
    if (Object.keys(skillsData.categories).length === 0 && skillsData.uncategorized.length === 0) {
        return null;
    }

    debugLog('[RPG Parser] Final skills data:', {
        categories: Object.keys(skillsData.categories),
        categoryCounts: Object.entries(skillsData.categories).map(([cat, skills]) => `${cat}: ${skills.length}`),
        uncategorizedCount: skillsData.uncategorized.length
    });

    return skillsData;
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
        debugLog('[RPG Parser] Content length:', content.length);
        debugLog('[RPG Parser] First 300 chars:', content.substring(0, 300));
        debugLog('[RPG Parser] Contains "Skills:":', content.includes('Skills:'));
        if (content.includes('Skills:')) {
            const skillsIndex = content.indexOf('Skills:');
            debugLog('[RPG Parser] Text around Skills (index ' + skillsIndex + '):', content.substring(skillsIndex, skillsIndex + 200));
        }

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
            const skillsData = extractSkills(statsText);
            if (skillsData) {
                extensionSettings.userStats.skills = skillsData;
                debugLog('[RPG Parser] Skills extracted:', skillsData);
            } else {
                debugLog('[RPG Parser] Skills extraction failed or none found');
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
