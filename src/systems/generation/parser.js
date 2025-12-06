/**
 * Parser Module
 * Handles parsing of AI responses to extract structured tracker data
 */

import { 
    extensionSettings, 
    addDebugLog, 
    committedTrackerData,
    setLastGeneratedData,
    createFreshTrackerData
} from '../../core/state.js';
import { saveChatData } from '../../core/persistence.js';
import { validateTrackerData } from '../../types/trackerData.js';
import { handleItemRemoved } from '../rendering/skills.js';
import { markdownToJson, extractMarkdownBlock } from '../../utils/markdownFormat.js';

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
    const placeholderPattern = /\[([A-Za-z\s/]+)\]/g;

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
        if (wordCount <= 3 && /^[A-Za-z\s/]+$/.test(content)) {
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
 * Extracts JSON from a code block (handles ```json ... ``` format)
 * @param {string} text - Text that may contain JSON code blocks
 * @returns {Object|null} Parsed JSON object or null
 */
function extractJSONFromCodeBlock(text) {
    if (!text) return null;
    
    // Match ```json ... ``` or ``` ... ``` blocks
    const jsonBlockRegex = /```(?:json)?\s*([\s\S]*?)```/gi;
    const matches = [...text.matchAll(jsonBlockRegex)];
    
    for (const match of matches) {
        const content = match[1].trim();
        // Check if content looks like JSON (starts with { or [)
        if (content.startsWith('{') || content.startsWith('[')) {
            try {
                return JSON.parse(content);
            } catch (e) {
                debugLog('[RPG Parser] JSON parse failed:', e.message);
                // Try to fix common JSON issues
                const fixed = tryFixJSON(content);
                if (fixed) return fixed;
            }
        }
    }
    
    return null;
}

/**
 * Attempts to fix common JSON formatting issues
 * @param {string} jsonStr - Potentially malformed JSON string
 * @returns {Object|null} Fixed JSON object or null
 */
function tryFixJSON(jsonStr) {
    try {
        // Remove trailing commas
        let fixed = jsonStr.replace(/,(\s*[}\]])/g, '$1');
        // Fix unquoted keys
        fixed = fixed.replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3');
        return JSON.parse(fixed);
    } catch (e) {
        return null;
    }
}

/**
 * Parses JSON tracker data and populates structured lastGeneratedData
 * @param {Object} jsonData - Parsed JSON tracker data
 * @returns {boolean} Whether parsing was successful
 */
export function parseJSONTrackerData(jsonData) {
    debugLog('[RPG Parser] ==================== JSON PARSING ====================');
    
    const validation = validateTrackerData(jsonData);
    if (!validation.valid) {
        debugLog('[RPG Parser] JSON validation failed:', validation.errors);
        return false;
    }
    
    const trackerConfig = extensionSettings.trackerConfig;
    const tracker = createFreshTrackerData();
    const allowAIUpdateAttributes = trackerConfig?.userStats?.allowAIUpdateAttributes !== false;
    
    // Parse stats
    if (jsonData.stats) {
        debugLog('[RPG Parser] Parsing stats:', Object.keys(jsonData.stats));
        for (const [statName, value] of Object.entries(jsonData.stats)) {
            if (typeof value === 'number') {
                tracker.stats[statName] = Math.max(0, Math.min(100, value));
                debugLog(`[RPG Parser] Stat ${statName}: ${value}%`);
            }
        }
    }
    
    // Parse status
    if (jsonData.status) {
        if (jsonData.status.mood) {
            tracker.status.mood = jsonData.status.mood;
            debugLog('[RPG Parser] Mood:', jsonData.status.mood);
        }
        if (jsonData.status.fields) {
            const configuredFields = trackerConfig?.userStats?.statusSection?.customFields || [];
            for (const [key, value] of Object.entries(jsonData.status.fields)) {
                const isConfigured = configuredFields.some(f => f.toLowerCase() === key.toLowerCase());
                if (isConfigured && value && value !== 'None' && value !== 'null') {
                    tracker.status.fields[key] = value;
                }
            }
            debugLog('[RPG Parser] Status fields:', Object.keys(tracker.status.fields));
        }
    }
    
    // Parse attributes
    if (jsonData.attributes && typeof jsonData.attributes === 'object' && allowAIUpdateAttributes) {
        debugLog('[RPG Parser] Parsing attributes:', Object.keys(jsonData.attributes));
        for (const [attrName, value] of Object.entries(jsonData.attributes)) {
            if (typeof value === 'number') {
                tracker.attributes[attrName] = Math.max(1, value);
                debugLog(`[RPG Parser] Attribute ${attrName}: ${value}`);
            }
        }
    } else if (jsonData.attributes && !allowAIUpdateAttributes) {
        debugLog('[RPG Parser] Attributes found but allowAIUpdateAttributes disabled - keeping existing');
        tracker.attributes = { ...committedTrackerData.attributes };
    }
    
    // Parse level
    if (jsonData.level !== undefined && typeof jsonData.level === 'number' && allowAIUpdateAttributes) {
        tracker.level = Math.max(1, jsonData.level);
        debugLog(`[RPG Parser] Level: ${tracker.level}`);
    } else {
        tracker.level = committedTrackerData.level ?? 1;
    }
    
    // Parse infoBox
    if (jsonData.infoBox) {
        const infoBox = {};
        for (const [key, val] of Object.entries(jsonData.infoBox)) {
            if (val !== null && val !== undefined && val !== 'null') {
                infoBox[key] = val;
            }
        }
        if (infoBox.recentEvents && typeof infoBox.recentEvents === 'string') {
            infoBox.recentEvents = [infoBox.recentEvents];
        } else if (!Array.isArray(infoBox.recentEvents)) {
            infoBox.recentEvents = [];
        }
        infoBox.recentEvents = infoBox.recentEvents.filter(e => e && e !== 'null');
        tracker.infoBox = infoBox;
        debugLog('[RPG Parser] InfoBox:', Object.keys(infoBox));
    }
    
    // Parse characters
    tracker.characters = Array.isArray(jsonData.characters) ? jsonData.characters : [];
    debugLog('[RPG Parser] Characters:', tracker.characters.length);
    
    // Parse inventory
    if (jsonData.inventory) {
        const normalizeArray = (val) => {
            if (Array.isArray(val)) return val;
            if (val && typeof val === 'object' && Object.keys(val).length === 0) return [];
            return [];
        };
        
        const itemsArray = normalizeArray(jsonData.inventory.items);
        const onPersonArray = normalizeArray(jsonData.inventory.onPerson);
        const simplifiedArray = normalizeArray(jsonData.inventory.simplified);
        
        const allItems = [...simplifiedArray, ...itemsArray];
        const simplifiedItems = allItems.length > 0 ? allItems : onPersonArray;
        const onPersonItems = onPersonArray.length > 0 ? onPersonArray : allItems;
        
        tracker.inventory = {
            onPerson: extensionSettings.useSimplifiedInventory ? [] : onPersonItems,
            stored: jsonData.inventory.stored && typeof jsonData.inventory.stored === 'object' 
                ? jsonData.inventory.stored : {},
            assets: normalizeArray(jsonData.inventory.assets),
            simplified: extensionSettings.useSimplifiedInventory ? simplifiedItems : []
        };
        
        debugLog('[RPG Parser] Inventory - onPerson:', tracker.inventory.onPerson.length,
            'simplified:', tracker.inventory.simplified.length);
        
        // Detect removed items
        const getItemNames = (inv) => {
            const names = new Set();
            const addItems = (items) => {
                if (!Array.isArray(items)) return;
                items.forEach(item => {
                    const name = typeof item === 'string' ? item : item?.name;
                    if (name) names.add(name.toLowerCase());
                });
            };
            addItems(inv?.onPerson);
            addItems(inv?.assets);
            addItems(inv?.simplified);
            if (inv?.stored) Object.values(inv.stored).forEach(addItems);
            return names;
        };
        
        const previousItemNames = getItemNames(committedTrackerData.inventory);
        const newItemNames = getItemNames(tracker.inventory);
        previousItemNames.forEach(itemName => {
            if (!newItemNames.has(itemName)) {
                debugLog('[RPG Parser] Item removed:', itemName);
                handleItemRemoved(itemName);
            }
        });
    }
    
    // Parse skills
    if (jsonData.skills && typeof jsonData.skills === 'object') {
        for (const [category, abilities] of Object.entries(jsonData.skills)) {
            if (Array.isArray(abilities)) {
                tracker.skills[category] = abilities.map(a => ({
                    name: a.name || a,
                    description: a.description || '',
                    grantedBy: a.grantedBy || undefined
                })).filter(a => a.name);
            } else if (typeof abilities === 'string') {
                tracker.skills[category] = abilities.split(',')
                    .map(a => ({ name: a.trim(), description: '' }))
                    .filter(a => a.name);
            }
        }
        debugLog('[RPG Parser] Skills:', Object.keys(tracker.skills));
        
        // Validate grantedBy references
        const validItemNames = new Set();
        const addItems = (items) => {
            if (!Array.isArray(items)) return;
            items.forEach(item => {
                const name = typeof item === 'string' ? item : item?.name;
                if (name) validItemNames.add(name.toLowerCase());
            });
        };
        addItems(tracker.inventory.onPerson);
        addItems(tracker.inventory.assets);
        addItems(tracker.inventory.simplified);
        if (tracker.inventory.stored) Object.values(tracker.inventory.stored).forEach(addItems);
        
        for (const abilities of Object.values(tracker.skills)) {
            for (const ability of abilities) {
                if (ability.grantedBy && !validItemNames.has(ability.grantedBy.toLowerCase())) {
                    debugLog('[RPG Parser] Removing invalid grantedBy:', ability.grantedBy);
                    delete ability.grantedBy;
                }
            }
        }
    }
    
    // Parse quests
    if (jsonData.quests) {
        let main = null;
        if (jsonData.quests.main) {
            if (typeof jsonData.quests.main === 'string') {
                main = { name: jsonData.quests.main, description: '' };
            } else if (jsonData.quests.main.name) {
                main = { name: jsonData.quests.main.name, description: jsonData.quests.main.description || '' };
            }
        }
        
        const optional = (Array.isArray(jsonData.quests.optional) ? jsonData.quests.optional : [])
            .map(q => typeof q === 'string' ? { name: q, description: '' } : { name: q?.name || '', description: q?.description || '' })
            .filter(q => q.name);
        
        tracker.quests = { main, optional };
        debugLog('[RPG Parser] Quests - main:', main?.name || 'None');
    }
    
    // Set lastGeneratedData
    setLastGeneratedData(tracker);
    saveChatData();
    
    debugLog('[RPG Parser] JSON parsing complete');
    debugLog('[RPG Parser] =======================================================');
    
    return true;
}

/**
 * Main entry point for parsing responses - tries JSON first, then markdown, falls back to text
 * @param {string} responseText - The raw AI response
 * @returns {boolean} Whether parsing was successful
 */
export function tryParseJSONResponse(responseText) {
    // Try JSON first (works regardless of format setting)
    const jsonData = extractJSONFromCodeBlock(responseText);
    if (jsonData) {
        return parseJSONTrackerData(jsonData);
    }
    
    // Try markdown format if enabled
    if (extensionSettings.useMarkdownFormat) {
        const markdownData = tryParseMarkdownResponse(responseText);
        if (markdownData) {
            debugLog('[RPG Parser] Successfully parsed markdown format');
            return parseJSONTrackerData(markdownData);
        }
    }
    
    debugLog('[RPG Parser] No valid JSON or markdown found, falling back to text parsing');
    return false;
}

/**
 * Attempts to parse markdown format tracker data from response
 * @param {string} responseText - The raw AI response
 * @returns {Object|null} Parsed tracker data or null
 */
function tryParseMarkdownResponse(responseText) {
    const markdownContent = extractMarkdownBlock(responseText);
    if (markdownContent) {
        debugLog('[RPG Parser] Found markdown block, attempting to parse');
        try {
            const data = markdownToJson(markdownContent);
            if (data && Object.keys(data).length > 0) {
                return data;
            }
        } catch (e) {
            debugLog('[RPG Parser] Markdown parse failed:', e.message);
        }
    }
    return null;
}

/**
 * Parses the model response to extract the different data sections.
 * Extracts tracker data from markdown code blocks in the AI response.
 * Handles both separate code blocks and combined code blocks gracefully.
 *
 * @param {string} responseText - The raw AI response text
 * @returns {{userStats: string|null, infoBox: string|null, characterThoughts: string|null, skills: string|null}} Parsed tracker data
 */
export function parseResponse(responseText) {
    const result = {
        userStats: null,
        infoBox: null,
        characterThoughts: null,
        skills: null
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
                (content.match(/Health:\s*\d+%/i) && content.match(/Energy:\s*\d+%/i)) ||
                // Fallback: inventory-only or quests-only blocks (no stats header)
                (content.match(/^(On Person:|Inventory:|Main Quests?:|Optional Quests:)/im) && 
                 !content.match(/Info Box/i) && !content.match(/Present Characters/i) && !content.match(/Skills\s*\n\s*---/i));

            // Match Skills section (separate from stats when showSkills is enabled)
            const isSkills =
                content.match(/Skills\s*\n\s*---/i) &&
                !content.match(/Stats\s*\n\s*---/i); // Make sure it's not a combined block

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
            } else if (isSkills && !result.skills) {
                result.skills = stripBrackets(content);
                debugLog('[RPG Parser] ✓ Matched: Skills section');
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
                debugLog('[RPG Parser]   - Has "Skills\\n---"?', !!content.match(/Skills\s*\n\s*---/i));
            }
        }
    }

    debugLog('[RPG Parser] ==================== PARSE RESULTS ====================');
    debugLog('[RPG Parser] Found Stats:', !!result.userStats);
    debugLog('[RPG Parser] Found Skills:', !!result.skills);
    debugLog('[RPG Parser] Found Info Box:', !!result.infoBox);
    debugLog('[RPG Parser] Found Characters:', !!result.characterThoughts);
    debugLog('[RPG Parser] =======================================================');

    return result;
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
