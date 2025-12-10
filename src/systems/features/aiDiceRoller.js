/**
 * AI Dice Roller - Processes dice roll syntax in AI messages
 * Replaces [ROLL:XdY+Z] patterns with actual dice results client-side (zero API cost)
 */

import { extensionSettings } from '../../core/state.js';
import { executeRollCommand } from './dice.js';

/**
 * Processes AI message text to replace [ROLL:...] patterns with actual dice results
 * @param {string} messageText - The AI message text to process
 * @returns {Promise<string>} - Processed message with dice rolls replaced
 */
export async function processAIRolls(messageText) {
    if (!messageText || !extensionSettings.autoRollAIDice) {
        return messageText;
    }

    // Regex to match [ROLL:...] patterns with support for keep highest/lowest
    // Examples: [ROLL:1d20], [ROLL:2d20kh1+5], [ROLL:2d20kl1+3], [ROLL:3d6+2]
    const rollPattern = /\[ROLL:([0-9]+d[0-9]+(?:k[hl][0-9]+)?[\d+\-\s]*)\]/gi;

    let processedText = messageText;
    let matches = [];
    let match;
    
    // Find all roll patterns and replace them
    const messageRegex = /\[ROLL:([0-9]+d[0-9]+(?:k[hl][0-9]+)?[\d+\-\s]*)\]/gi;
    while ((match = messageRegex.exec(messageText)) !== null) {
        matches.push({ fullMatch: match[0], formula: match[1].trim() });
    }
    
    // Log detected rolls for debugging
    if (matches.length > 0) {
        console.log('[RPG Companion] Detected AI rolls in message:', matches);
    } else if (messageText.includes('[ROLL:')) {
        console.log('[RPG Companion] Found [ROLL: pattern but failed to parse. Message:', messageText);
    }
    
    // Process each match
    for (const { fullMatch, formula } of matches) {
        try {
            // Execute the roll using existing dice system
            // Need to await since executeRollCommand is async
            const result = await executeRollCommand(formula);
            
            console.log('[RPG Companion] Processed roll:', formula, '→', result);
            
            // Show toast notification if enabled
            if (extensionSettings.showAutoRollNotifications) {
                if (typeof toastr !== 'undefined') {
                    toastr.info(`🎲 Auto-rolled ${formula} → ${result.total}`, 'RPG Companion', {
                        timeOut: 4000,
                        positionClass: 'toast-top-center'
                    });
                }
            }
            
            if (!result || typeof result.total === 'undefined') {
                console.warn('[RPG Companion] Invalid roll result for formula:', formula);
                continue;
            }

            // Parse modifiers from formula so we can show +5 / -2 in the breakdown
            const modifiers = (formula.match(/([+-]\d+)/g) || []).map((m) => m.trim());
            const modifierString = modifiers
                .map((m) => (m.startsWith('-') ? m : `+${parseInt(m, 10)}`))
                .join('');

            const rolls = Array.isArray(result.rolls) ? result.rolls : [];
            const hasRolls = rolls.length > 0;

            // Build concise breakdowns:
            // - Single die, no modifier: "🎲 1"
            // - Single/multi die with modifiers: "🎲 1+5=6" or "🎲 3+4+2=9"
            // - Multiple dice without modifier: "🎲 3+4=7"
            let rollBreakdown = '';

            if (hasRolls) {
                const rollsPart = rolls.join('+');
                const expr = modifierString ? `${rollsPart}${modifierString}` : rollsPart;

                if (!modifierString && rolls.length === 1) {
                    rollBreakdown = `🎲 ${rolls[0]}`;
                } else {
                    rollBreakdown = `🎲 ${expr}=${result.total}`;
                }
            } else {
                // Fallback if rolls are missing
                rollBreakdown = `🎲 ${result.total}`;
            }
            
            // Replace the [ROLL:...] pattern with the formatted result
            processedText = processedText.replace(fullMatch, rollBreakdown);
            
        } catch (error) {
            console.warn('[RPG Companion] Failed to process AI roll:', formula, error);
            console.warn('[RPG Companion] Error details:', error.stack);
            // Leave the original pattern if roll fails
        }
    }
    
    return processedText;
}

/**
 * Gets a template prompt for AI to use the auto-roll syntax
 * @returns {string} - Instruction text for AI
 */
export function getAIRollPromptTemplate() {
    return `When describing combat or chance-based events, use the dice roll syntax to automatically generate results. The system will instantly calculate and display the roll result.

SYNTAX: [ROLL:XdY+Z] or [ROLL:XdYkh#+Z] or [ROLL:XdYkl#+Z]
- X = number of dice
- Y = sides per die  
- kh# = keep highest (e.g., kh1 for advantage, roll 2 dice keep highest 1)
- kl# = keep lowest (e.g., kl1 for disadvantage, roll 2 dice keep lowest 1)
- Z = bonus/penalty modifier (optional)

IMPORTANT: Write ONLY the [ROLL:...] syntax - do NOT manually add a number. The system automatically replaces it with the calculated result.

CORRECT EXAMPLES:
- Normal roll: "The goblin attacks! [ROLL:1d20+5]" → displays as "The goblin attacks! **18** (🎲 18, 5)"
- With advantage: "The hero attacks with advantage! [ROLL:2d20kh1+5]" → displays as "The hero attacks with advantage! **19** (🎲 18, 5)"
- With disadvantage: "The hero attacks with disadvantage! [ROLL:2d20kl1+5]" → displays as "The hero attacks with disadvantage! **12** (🎲 7, 5)"
- Damage roll: "You take damage: [ROLL:2d6+3]" → displays as "You take damage: **11** (🎲 6, 5, 3)"
- Multiple dice: "The wizard casts Magic Missile: [ROLL:3d4+1]" → displays as "The wizard casts Magic Missile: **8** (🎲 2, 3, 2, 1)"

INCORRECT (do NOT do this):
- "The goblin attacks! [ROLL:1d20+5] and gets 18" ❌ (don't add the number)
- "You roll [ROLL:2d6] which is 9" ❌ (let the system display the result)

Just write the [ROLL:...] and the system handles everything else.`;
}
