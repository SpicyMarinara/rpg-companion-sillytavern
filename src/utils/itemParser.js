/**
 * Item Parser Module
 * Utilities for parsing item strings into arrays and vice versa
 */

import { sanitizeItemName, MAX_ITEMS_PER_SECTION } from './security.js';

/**
 * Parses item strings from AI responses into clean arrays.
 * Handles numerous AI formatting quirks and edge cases.
 *
 * Smart handling:
 * - Strips wrapping brackets/braces: [], {}, [[]]
 * - Strips wrapping quotes: "...", '...'
 * - Converts newlines to commas (newline-based lists)
 * - Strips markdown: **bold**, *italic*, `code`, ~~strikethrough~~
 * - Strips list markers: -, •, 1., 2., etc.
 * - Collapses newlines inside parentheses to spaces
 * - Only splits on commas OUTSIDE parentheses (preserves commas in descriptions)
 * - Preserves commas in numbers (decimal separators like 4443,445)
 * - Gracefully handles unmatched parentheses
 *
 * @param {string} itemString - Item string from AI (various formats supported)
 * @returns {string[]} Array of clean item names, or empty array if none
 *
 * @example
 * // Standard comma-separated
 * parseItems("Sword, Shield, 3x Potions") // ["Sword", "Shield", "3x Potions"]
 *
 * // Newline-based lists
 * parseItems("Sword\nShield\nPotion") // ["Sword", "Shield", "Potion"]
 * parseItems("- Sword\n- Shield") // ["Sword", "Shield"]
 * parseItems("1. Sword\n2. Shield") // ["Sword", "Shield"]
 *
 * // Commas in parentheses (preserved)
 * parseItems("Potato (Cursed, Sexy, Your Mum & Dick, Etc), Sword")
 * // → ["Potato (Cursed, Sexy, Your Mum & Dick, Etc)", "Sword"]
 *
 * // Decimal commas in numbers (preserved)
 * parseItems("4443,445 gold coins, Sword, 1,234,567 credits")
 * // → ["4443,445 gold coins", "Sword", "1,234,567 credits"]
 *
 * // Markdown formatting (stripped)
 * parseItems("**Sword** (equipped), *Shield*") // ["Sword (equipped)", "Shield"]
 *
 * // Various brackets (stripped)
 * parseItems("[Sword, Shield]") // ["Sword", "Shield"]
 * parseItems("{Sword, Shield}") // ["Sword", "Shield"]
 *
 * // Edge cases
 * parseItems("None") // []
 * parseItems("") // []
 * parseItems(null) // []
 */
export function parseItems(itemString) {
    // Handle null/undefined/non-string
    if (!itemString || typeof itemString !== 'string') {
        return [];
    }

    let processed = itemString.trim();

    // Quick check for "None" or empty
    if (processed === '' || processed.toLowerCase() === 'none') {
        return [];
    }

    // STEP 1: Strip wrapping brackets/braces (AI sometimes wraps entire lists)
    // Handle: [], {}, [[]], etc.
    while (
        (processed.startsWith('[') && processed.endsWith(']')) ||
        (processed.startsWith('{') && processed.endsWith('}'))
    ) {
        processed = processed.slice(1, -1).trim();
        if (processed === '' || processed.toLowerCase() === 'none') {
            return [];
        }
    }

    // STEP 2: Strip wrapping quotes (AI sometimes quotes entire lists)
    // Handle: "...", '...'
    if ((processed.startsWith('"') && processed.endsWith('"')) ||
        (processed.startsWith("'") && processed.endsWith("'"))) {
        processed = processed.slice(1, -1).trim();
        if (processed === '' || processed.toLowerCase() === 'none') {
            return [];
        }
    }

    // STEP 3: Convert newlines to commas (OUTSIDE parentheses)
    // Handles newline-based lists: "Sword\nShield\nPotion" → "Sword, Shield, Potion"
    let withCommas = '';
    let parenDepth = 0;

    for (let i = 0; i < processed.length; i++) {
        const char = processed[i];

        if (char === '(') {
            parenDepth++;
            withCommas += char;
        } else if (char === ')') {
            parenDepth--;
            withCommas += char;
        } else if ((char === '\n' || char === '\r') && parenDepth === 0) {
            // Newline outside parentheses - convert to comma separator
            // Don't add if previous char was already a separator
            const prevChar = withCommas[withCommas.length - 1];
            if (prevChar && prevChar !== ',' && prevChar !== '\n') {
                withCommas += ',';
            }
        } else if ((char === '\n' || char === '\r') && parenDepth > 0) {
            // Newline inside parentheses - convert to space
            if (withCommas[withCommas.length - 1] !== ' ') {
                withCommas += ' ';
            }
        } else {
            withCommas += char;
        }
    }
    processed = withCommas;

    // STEP 4: Strip markdown formatting
    // Remove: **bold**, *italic*, `code`, ~~strikethrough~~
    processed = processed
        .replace(/\*\*(.+?)\*\*/g, '$1')  // **bold** → bold
        .replace(/\*(.+?)\*/g, '$1')      // *italic* → italic
        .replace(/`(.+?)`/g, '$1')        // `code` → code
        .replace(/~~(.+?)~~/g, '$1');     // ~~strike~~ → strike

    // STEP 5: Normalize whitespace
    processed = processed.replace(/\s+/g, ' ');

    // STEP 6: Smart comma splitting (only split on commas OUTSIDE parentheses and NOT in numbers)
    // Also handles list markers, quotes, and security validation per-item
    const items = [];
    let currentItem = '';
    parenDepth = 0;

    for (let i = 0; i < processed.length; i++) {
        const char = processed[i];

        if (char === '(') {
            parenDepth++;
            currentItem += char;
        } else if (char === ')') {
            parenDepth--;
            // Graceful handling: don't let depth go negative
            if (parenDepth < 0) {
                console.warn('[RPG Companion] Unmatched closing parenthesis in item parsing');
                parenDepth = 0;
            }
            currentItem += char;
        } else if (char === ',' && parenDepth === 0) {
            // Check if this comma is between digits (decimal separator like 4443,445)
            const prevChar = i > 0 ? processed[i - 1] : '';
            const nextChar = i < processed.length - 1 ? processed[i + 1] : '';
            const isDecimalComma = /\d/.test(prevChar) && /\d/.test(nextChar);

            if (isDecimalComma) {
                // This is a decimal comma, not a separator - keep it
                currentItem += char;
            } else {
                // Comma outside parentheses and not in a number - this is a separator
                const cleaned = cleanSingleItem(currentItem);
                if (cleaned) {
                    // Security check: validate and sanitize item name
                    const sanitized = sanitizeItemName(cleaned);
                    if (sanitized) {
                        items.push(sanitized);
                    }

                    // DoS protection: enforce max items limit
                    if (items.length >= MAX_ITEMS_PER_SECTION) {
                        console.warn(`[RPG Companion] Reached max items limit (${MAX_ITEMS_PER_SECTION}), truncating list`);
                        return items;
                    }
                }
                currentItem = ''; // Start new item
            }
        } else {
            currentItem += char;
        }
    }

    // Don't forget the last item
    const cleaned = cleanSingleItem(currentItem);
    if (cleaned) {
        // Security check: validate and sanitize item name
        const sanitized = sanitizeItemName(cleaned);
        if (sanitized) {
            items.push(sanitized);
        }
    }

    // Warn if parentheses were unmatched
    if (parenDepth > 0) {
        console.warn('[RPG Companion] Unmatched opening parenthesis in item parsing');
    }

    return items;
}

/**
 * Cleans a single item string (helper for parseItems)
 * Removes list markers, wrapping quotes, trims, and capitalizes first letter
 *
 * @param {string} item - Single item string to clean
 * @returns {string|null} Cleaned item or null if empty/invalid
 * @private
 */
function cleanSingleItem(item) {
    if (!item || typeof item !== 'string') {
        return null;
    }

    let cleaned = item.trim();

    // Filter "None"
    if (cleaned === '' || cleaned.toLowerCase() === 'none') {
        return null;
    }

    // Strip list markers: "- Item", "• Item", "1. Item", "2. Item", etc.
    // Matches: -, •, *, 1., 2., a), etc.
    cleaned = cleaned.replace(/^[-•*]\s+/, '');           // "- Item" → "Item"
    cleaned = cleaned.replace(/^\d+\.\s+/, '');           // "1. Item" → "Item"
    cleaned = cleaned.replace(/^[a-z]\)\s+/i, '');        // "a) Item" → "Item"

    // Strip wrapping quotes from individual items
    if ((cleaned.startsWith('"') && cleaned.endsWith('"')) ||
        (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
        cleaned = cleaned.slice(1, -1).trim();
    }

    // Final empty check
    if (cleaned === '' || cleaned.toLowerCase() === 'none') {
        return null;
    }

    // Capitalize first letter for consistency
    // Preserves rest of string case (e.g., "iPhone" stays "iPhone", not "Iphone")
    if (cleaned.length > 0) {
        cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }

    return cleaned;
}

/**
 * Serializes an array of items back into a comma-separated string.
 * Returns "None" for empty arrays.
 *
 * @param {string[]} itemArray - Array of item names
 * @returns {string} Comma-separated string, or "None" if empty
 *
 * @example
 * serializeItems(["Sword", "Shield", "3x Potions"]) // "Sword, Shield, 3x Potions"
 * serializeItems([]) // "None"
 * serializeItems(["Sword"]) // "Sword"
 */
export function serializeItems(itemArray) {
    // Handle null/undefined/non-array
    if (!itemArray || !Array.isArray(itemArray)) {
        return 'None';
    }

    // Filter out empty strings and trim
    const cleaned = itemArray
        .filter(item => item && typeof item === 'string' && item.trim() !== '')
        .map(item => item.trim());

    // Return "None" if array is empty after cleaning
    if (cleaned.length === 0) {
        return 'None';
    }

    // Join with comma and space
    return cleaned.join(', ');
}
