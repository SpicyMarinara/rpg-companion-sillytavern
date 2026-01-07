/**
 * JSON Repair Utilities
 * Handles parsing and repairing malformed JSON from AI responses
 */

/**
 * Repairs malformed JSON from AI responses
 * Handles common AI mistakes like trailing commas, missing commas, wrong quotes, etc.
 *
 * @param {string} jsonString - Potentially malformed JSON string
 * @returns {object|null} Repaired JSON object or null if repair fails
 */
export function repairJSON(jsonString) {
    if (!jsonString || typeof jsonString !== 'string') {
        console.warn('[RPG JSON Repair] Invalid input:', typeof jsonString);
        return null;
    }

    let cleaned = jsonString.trim();

    // Remove markdown code fences
    cleaned = cleaned.replace(/```json\s*/gi, '');
    cleaned = cleaned.replace(/```\s*/g, '');

    // Remove thinking tags (model's internal reasoning)
    cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '');
    cleaned = cleaned.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');

    // Fix common JSON errors:

    // 1. Trailing commas before closing brackets
    cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');

    // 2. Missing commas between properties - DISABLED because it corrupts valid JSON
    // Modern AI models send properly formatted JSON, so this aggressive repair is not needed
    // cleaned = cleaned.replace(/("\s*:\s*(?:"[^"]*"|[^,}\]]+))(\s+")/g, '$1,$2');

    // 3. Single quotes to double quotes - DISABLED because it corrupts apostrophes in text
    // Apostrophes in strings like "Zandik's Office" would become "Zandik"s Office" (invalid JSON)
    // Modern AI models already use double quotes for JSON strings
    // cleaned = cleaned.replace(/'/g, '"');

    // 4. Unquoted keys - DISABLED because it corrupts valid JSON string values
    // The AI models already send properly quoted JSON, so this is not needed
    // cleaned = cleaned.replace(/(\{|,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');

    // 5. Remove JavaScript comments
    cleaned = cleaned.replace(/\/\/.*$/gm, '');
    cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');

    // Attempt 1: Standard JSON.parse
    try {
        return JSON.parse(cleaned);
    } catch (e) {
    }

    // Attempt 2: Extract JSON object between first { and last }
    const objectMatch = cleaned.match(/\{[\s\S]*\}/);
    if (objectMatch) {
        try {
            return JSON.parse(objectMatch[0]);
        } catch (e) {
            // Silent fail, try next method
        }
    }

    // Attempt 3: Try to extract JSON array between first [ and last ]
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
        try {
            return JSON.parse(arrayMatch[0]);
        } catch (e) {
            // Silent fail, try next method
        }
    }

    // Attempt 4: Use Function constructor (safer than eval, still controlled)
    // Only as last resort for trusted AI output
    try {
        const fn = new Function(`"use strict"; return (${cleaned});`);
        const result = fn();
        // Validate it's actually an object or array
        if (result && (typeof result === 'object')) {
            // console.log('[RPG JSON Repair] ✓ Repaired using Function constructor');
            return result;
        }
    } catch (e) {
        console.error('[RPG JSON Repair] ✗ All repair attempts failed:', e.message);
    }

    return null;
}

/**
 * Validates JSON structure matches expected schema for a tracker type
 *
 * @param {object} data - Parsed JSON data to validate
 * @param {string} type - Type of tracker ('userStats', 'infoBox', 'characters')
 * @returns {boolean} True if valid, false otherwise
 */
export function validateJSONSchema(data, type) {
    if (!data || typeof data !== 'object') {
        return false;
    }

    try {
        switch (type) {
            case 'userStats':
                return Array.isArray(data.stats) &&
                       data.stats.every(s =>
                           s &&
                           typeof s === 'object' &&
                           s.id &&
                           s.name &&
                           typeof s.value === 'number'
                       );

            case 'infoBox':
                return (data.date || data.weather || data.time || data.location || data.temperature || data.recentEvents);

            case 'characters':
                return Array.isArray(data.characters) &&
                       data.characters.every(c => c && c.name);

            default:
                console.warn('[RPG JSON Validation] Unknown tracker type:', type);
                return false;
        }
    } catch (e) {
        console.error('[RPG JSON Validation] Error during validation:', e);
        return false;
    }
}

/**
 * Extracts JSON from text that may contain other content
 * Looks for JSON blocks within ```json fences or standalone JSON objects
 *
 * @param {string} text - Text potentially containing JSON
 * @returns {string|null} Extracted JSON string or null
 */
export function extractJSONFromText(text) {
    if (!text || typeof text !== 'string') {
        return null;
    }

    // Try to extract from ```json code fence
    const fenceMatch = text.match(/```json\s*([\s\S]*?)```/i);
    if (fenceMatch && fenceMatch[1]) {
        return fenceMatch[1].trim();
    }

    // Try to extract from ``` code fence (without json label)
    const genericFenceMatch = text.match(/```\s*([\s\S]*?)```/);
    if (genericFenceMatch && genericFenceMatch[1]) {
        const content = genericFenceMatch[1].trim();
        // Check if it looks like JSON (starts with { or [)
        if (content.startsWith('{') || content.startsWith('[')) {
            return content;
        }
    }

    // Try to find standalone JSON object
    const objectMatch = text.match(/\{[\s\S]*\}/);
    if (objectMatch) {
        return objectMatch[0];
    }

    // Try to find standalone JSON array
    const arrayMatch = text.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
        return arrayMatch[0];
    }

    return null;
}

/**
 * Safely parses JSON with automatic repair attempts
 * Combines extraction, repair, and validation in one call
 *
 * @param {string} text - Text containing JSON (with or without code fences)
 * @param {string} expectedType - Expected tracker type for validation ('userStats', 'infoBox', 'characters')
 * @returns {{data: object|null, success: boolean, error: string|null}} Result object
 */
export function safeParseJSON(text, expectedType = null) {
    const result = {
        data: null,
        success: false,
        error: null
    };

    // Extract JSON from text
    const jsonString = extractJSONFromText(text);
    if (!jsonString) {
        result.error = 'No JSON found in text';
        return result;
    }

    // Attempt to repair and parse
    const parsed = repairJSON(jsonString);
    if (!parsed) {
        result.error = 'Failed to parse JSON after repair attempts';
        return result;
    }

    // Validate schema if type specified
    if (expectedType) {
        const valid = validateJSONSchema(parsed, expectedType);
        if (!valid) {
            result.error = `JSON does not match expected schema for type: ${expectedType}`;
            result.data = parsed; // Return data anyway, might be partially useful
            return result;
        }
    }

    result.data = parsed;
    result.success = true;
    return result;
}
