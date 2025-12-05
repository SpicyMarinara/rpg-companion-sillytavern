/**
 * Character State Parser Module
 * Extracts and applies character state updates from LLM responses
 */

import {
    getCharacterState,
    updateCharacterState,
    updateRelationship,
    getRelationship
} from '../../core/characterState.js';

/**
 * Extracts character state update block from LLM response
 * @param {string} text - Full LLM response text
 * @returns {string|null} Extracted state update block or null if not found
 */
export function extractCharacterStateBlock(text) {
    if (!text) return null;

    // Look for character-state code block
    const stateBlockRegex = /```character-state\s*([\s\S]*?)```/i;
    const match = text.match(stateBlockRegex);

    if (match && match[1]) {
        return match[1].trim();
    }

    // Fallback: look for "State Update" section
    const fallbackRegex = /State Update\s*---\s*([\s\S]*?)(?=```|$)/i;
    const fallbackMatch = text.match(fallbackRegex);

    if (fallbackMatch && fallbackMatch[1]) {
        return fallbackMatch[1].trim();
    }

    return null;
}

/**
 * Parses emotional changes from state update text
 * @param {string} stateText - State update text
 * @returns {Object} Emotional state changes
 */
export function parseEmotionalChanges(stateText) {
    const changes = {};

    // Look for Emotional Changes section
    const emotionalSection = extractSection(stateText, 'Emotional Changes');
    if (!emotionalSection) return changes;

    // Parse lines like "happy: +15 (reason: received compliment)"
    const changeRegex = /-\s*(\w+):\s*([+-]?\d+)\s*(?:\(reason:\s*([^)]+)\))?/gi;
    let match;

    while ((match = changeRegex.exec(emotionalSection)) !== null) {
        const emotion = match[1].toLowerCase();
        const delta = parseInt(match[2]);
        const reason = match[3] || '';

        changes[emotion] = {
            delta: delta,
            reason: reason.trim()
        };
    }

    return changes;
}

/**
 * Parses physical state changes from state update text
 * @param {string} stateText - State update text
 * @returns {Object} Physical state changes
 */
export function parsePhysicalChanges(stateText) {
    const changes = {};

    // Look for Physical Changes section
    const physicalSection = extractSection(stateText, 'Physical Changes');
    if (!physicalSection) return changes;

    // Parse lines like "Energy: -20 (reason: exhausting activity)"
    const changeRegex = /-\s*(\w+):\s*([+-]?\d+)\s*(?:\(reason:\s*([^)]+)\))?/gi;
    let match;

    while ((match = changeRegex.exec(physicalSection)) !== null) {
        const stat = match[1].toLowerCase();
        const delta = parseInt(match[2]);
        const reason = match[3] || '';

        changes[stat] = {
            delta: delta,
            reason: reason.trim()
        };
    }

    return changes;
}

/**
 * Parses relationship updates from state update text
 * @param {string} stateText - State update text
 * @returns {Object} Relationship updates by character name
 */
export function parseRelationshipUpdates(stateText) {
    const updates = {};

    // Look for Relationship Updates section
    const relationshipSection = extractSection(stateText, 'Relationship Updates');
    if (!relationshipSection) return updates;

    // Split by character entries (lines starting with "- CharacterName:")
    const characterEntries = relationshipSection.split(/(?=^- )/m);

    for (const entry of characterEntries) {
        if (!entry.trim()) continue;

        // Extract character name
        const nameMatch = entry.match(/^-\s*([^:]+):/);
        if (!nameMatch) continue;

        const characterName = nameMatch[1].trim();
        const relationshipData = {};

        // Parse relationship stat changes
        // Format: "  - Trust: +10 (reason: showed vulnerability)"
        const statRegex = /^\s*-\s*(\w+):\s*([+-]?\d+)\s*(?:\(reason:\s*([^)]+)\))?/gim;
        let statMatch;

        while ((statMatch = statRegex.exec(entry)) !== null) {
            const stat = statMatch[1].toLowerCase();
            const delta = parseInt(statMatch[2]);
            const reason = statMatch[3] || '';

            relationshipData[stat] = {
                delta: delta,
                reason: reason.trim()
            };
        }

        // Extract thoughts
        const thoughtsMatch = entry.match(/Thoughts:\s*"([^"]+)"/i);
        if (thoughtsMatch) {
            relationshipData.currentThoughts = thoughtsMatch[1].trim();
        }

        if (Object.keys(relationshipData).length > 0) {
            updates[characterName] = relationshipData;
        }
    }

    return updates;
}

/**
 * Parses scene context updates from state update text
 * @param {string} stateText - State update text
 * @returns {Object} Context updates
 */
export function parseContextUpdates(stateText) {
    const context = {};

    // Look for Scene Context section
    const contextSection = extractSection(stateText, 'Scene Context');
    if (!contextSection) return context;

    // Parse location
    const locationMatch = contextSection.match(/Location:\s*([^\n]+)/i);
    if (locationMatch) {
        context.location = locationMatch[1].trim();
    }

    // Parse time
    const timeMatch = contextSection.match(/Time:\s*([^\n]+)/i);
    if (timeMatch) {
        context.timeOfDay = timeMatch[1].trim();
    }

    // Parse present characters
    const presentMatch = contextSection.match(/Present:\s*([^\n]+)/i);
    if (presentMatch) {
        const presentText = presentMatch[1].trim();
        context.presentCharacters = presentText.split(',').map(s => s.trim()).filter(s => s);
    }

    return context;
}

/**
 * Parses internal thoughts from state update text
 * @param {string} stateText - State update text
 * @returns {Object} Thoughts object
 */
export function parseThoughts(stateText) {
    const thoughts = {};

    // Look for Thoughts section
    // Format: **Character's Thoughts**:\n"thought text here"
    const thoughtsRegex = /\*\*[^*]+'s Thoughts\*\*:\s*"([^"]+)"/i;
    const match = stateText.match(thoughtsRegex);

    if (match) {
        thoughts.internalMonologue = match[1].trim();
    }

    return thoughts;
}

/**
 * Parses outfit/clothing changes from state update text
 * @param {string} stateText - State update text
 * @returns {Object} Clothing changes
 */
export function parseClothingChanges(stateText) {
    const changes = {};

    // Look for Outfit Changes section
    const outfitSection = extractSection(stateText, 'Outfit Changes');
    if (!outfitSection) return changes;

    // Parse lines like "- shirt: removed" or "- dress: added (red cocktail dress)"
    const changeRegex = /-\s*([^:]+):\s*([^\n(]+)(?:\(([^)]+)\))?/gi;
    let match;

    while ((match = changeRegex.exec(outfitSection)) !== null) {
        const item = match[1].trim();
        const action = match[2].trim();
        const description = match[3] ? match[3].trim() : '';

        changes[item] = {
            action: action,
            description: description
        };
    }

    return changes;
}

/**
 * Helper function to extract a section from state update text
 * @param {string} text - Full state update text
 * @param {string} sectionName - Name of section to extract
 * @returns {string} Section content or empty string
 */
function extractSection(text, sectionName) {
    // Match section with various formats:
    // **Section Name**:
    // **Section Name**
    const sectionRegex = new RegExp(`\\*\\*${sectionName}\\*\\*:?\\s*([\\s\\S]*?)(?=\\*\\*|$)`, 'i');
    const match = text.match(sectionRegex);

    if (match && match[1]) {
        return match[1].trim();
    }

    return '';
}

/**
 * Applies emotional state changes to character state
 * @param {Object} emotionalChanges - Emotional changes to apply
 */
export function applyEmotionalChanges(emotionalChanges) {
    const charState = getCharacterState();
    const newStates = { ...charState.secondaryStates };

    for (const [emotion, change] of Object.entries(emotionalChanges)) {
        if (newStates[emotion] !== undefined) {
            let newValue = (newStates[emotion] || 0) + change.delta;
            // Clamp between 0-100
            newValue = Math.max(0, Math.min(100, newValue));
            newStates[emotion] = newValue;

            console.log(`[Character State] ${emotion}: ${newStates[emotion]} (${change.delta > 0 ? '+' : ''}${change.delta}) - ${change.reason}`);
        }
    }

    updateCharacterState({ secondaryStates: newStates });
}

/**
 * Applies physical state changes to character state
 * @param {Object} physicalChanges - Physical changes to apply
 */
export function applyPhysicalChanges(physicalChanges) {
    const charState = getCharacterState();
    const newStats = { ...charState.physicalStats };

    for (const [stat, change] of Object.entries(physicalChanges)) {
        if (newStats[stat] !== undefined) {
            let newValue = (newStats[stat] || 50) + change.delta;
            // Clamp between 0-100 (or appropriate range)
            newValue = Math.max(0, Math.min(100, newValue));
            newStats[stat] = newValue;

            console.log(`[Character State] ${stat}: ${newStats[stat]} (${change.delta > 0 ? '+' : ''}${change.delta}) - ${change.reason}`);
        }
    }

    updateCharacterState({ physicalStats: newStats });
}

/**
 * Applies relationship updates to character state
 * @param {Object} relationshipUpdates - Relationship updates by character name
 */
export function applyRelationshipUpdates(relationshipUpdates) {
    for (const [characterName, updates] of Object.entries(relationshipUpdates)) {
        const relationship = getRelationship(characterName);
        const newRelationship = { ...relationship };

        // Apply delta changes
        for (const [stat, change] of Object.entries(updates)) {
            if (stat === 'currentThoughts') {
                newRelationship.currentThoughts = change;
            } else if (typeof change === 'object' && change.delta !== undefined) {
                if (newRelationship[stat] !== undefined && newRelationship[stat] !== null) {
                    let newValue = (newRelationship[stat] || 0) + change.delta;
                    newValue = Math.max(0, Math.min(100, newValue));
                    newRelationship[stat] = newValue;

                    console.log(`[Character State] Relationship with ${characterName} - ${stat}: ${newValue} (${change.delta > 0 ? '+' : ''}${change.delta}) - ${change.reason}`);
                }
            }
        }

        // Update thoughts if provided
        if (updates.currentThoughts) {
            newRelationship.currentThoughts = updates.currentThoughts;
        }

        // Update the relationship
        updateRelationship(characterName, newRelationship);
    }
}

/**
 * Main function to parse and apply all character state updates
 * @param {string} responseText - Full LLM response text
 * @returns {Object} Parsed state data
 */
export function parseAndApplyCharacterStateUpdate(responseText) {
    console.log('[Character Parser] Parsing character state update...');

    // Extract state update block
    const stateBlock = extractCharacterStateBlock(responseText);
    if (!stateBlock) {
        console.log('[Character Parser] No character state update block found');
        return null;
    }

    console.log('[Character Parser] Found state update block:', stateBlock.substring(0, 200));

    // Parse all sections
    const emotionalChanges = parseEmotionalChanges(stateBlock);
    const physicalChanges = parsePhysicalChanges(stateBlock);
    const relationshipUpdates = parseRelationshipUpdates(stateBlock);
    const contextUpdates = parseContextUpdates(stateBlock);
    const thoughts = parseThoughts(stateBlock);
    const clothingChanges = parseClothingChanges(stateBlock);

    // Apply changes to character state
    if (Object.keys(emotionalChanges).length > 0) {
        console.log('[Character Parser] Applying emotional changes:', Object.keys(emotionalChanges));
        applyEmotionalChanges(emotionalChanges);
    }

    if (Object.keys(physicalChanges).length > 0) {
        console.log('[Character Parser] Applying physical changes:', Object.keys(physicalChanges));
        applyPhysicalChanges(physicalChanges);
    }

    if (Object.keys(relationshipUpdates).length > 0) {
        console.log('[Character Parser] Applying relationship updates for:', Object.keys(relationshipUpdates));
        applyRelationshipUpdates(relationshipUpdates);
    }

    if (Object.keys(contextUpdates).length > 0) {
        console.log('[Character Parser] Updating context:', contextUpdates);
        updateCharacterState({ contextInfo: contextUpdates });
    }

    if (Object.keys(thoughts).length > 0) {
        console.log('[Character Parser] Updating thoughts');
        updateCharacterState({ thoughts: thoughts });
    }

    // Return parsed data for display
    return {
        emotionalChanges,
        physicalChanges,
        relationshipUpdates,
        contextUpdates,
        thoughts,
        clothingChanges,
        rawStateBlock: stateBlock
    };
}

/**
 * Parses character initialization data from JSON
 * Used when initializing character state from character card analysis
 * @param {string} responseText - LLM response with JSON data
 * @returns {Object|null} Parsed trait data or null if failed
 */
export function parseCharacterInitialization(responseText) {
    try {
        // Extract JSON block
        const jsonMatch = responseText.match(/```json\s*([\s\S]*?)```/);
        if (!jsonMatch) {
            // Try to find JSON without code blocks
            const jsonObjectMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonObjectMatch) {
                return JSON.parse(jsonObjectMatch[0]);
            }
            return null;
        }

        const jsonData = JSON.parse(jsonMatch[1]);
        return jsonData;
    } catch (error) {
        console.error('[Character Parser] Failed to parse initialization data:', error);
        return null;
    }
}

/**
 * Parses relationship analysis data from JSON
 * @param {string} responseText - LLM response with JSON data
 * @returns {Object|null} Parsed relationship data or null if failed
 */
export function parseRelationshipAnalysis(responseText) {
    try {
        // Extract JSON block
        const jsonMatch = responseText.match(/```json\s*([\s\S]*?)```/);
        if (!jsonMatch) {
            // Try to find JSON without code blocks
            const jsonObjectMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonObjectMatch) {
                return JSON.parse(jsonObjectMatch[0]);
            }
            return null;
        }

        const jsonData = JSON.parse(jsonMatch[1]);
        return jsonData;
    } catch (error) {
        console.error('[Character Parser] Failed to parse relationship analysis:', error);
        return null;
    }
}

/**
 * Cleans the LLM response by removing the character state update block
 * This leaves only the actual roleplay response
 * @param {string} responseText - Full LLM response
 * @returns {string} Cleaned response without state update block
 */
export function removeCharacterStateBlock(responseText) {
    if (!responseText) return '';

    // Remove character-state code block
    let cleaned = responseText.replace(/```character-state\s*[\s\S]*?```/gi, '');

    // Clean up extra whitespace
    cleaned = cleaned.trim();

    return cleaned;
}
