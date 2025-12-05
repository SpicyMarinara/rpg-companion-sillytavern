/**
 * Character Prompt Builder Module
 * Handles AI prompt generation for character state tracking
 * Based on Katherine RPG System - tracks {{char}} states instead of {{user}}
 */

import { getContext } from '../../../../../../extensions.js';
import { chat, characters, this_chid } from '../../../../../../../script.js';
import { selected_group, getGroupMembers, getGroupChat } from '../../../../../../group-chats.js';
import { extensionSettings } from '../../core/state.js';
import { getCharacterState } from '../../core/characterState.js';

/**
 * Gets the main character name from the current chat
 * @returns {string} Character name
 */
function getCharacterName() {
    if (selected_group) {
        // For group chats, we'll need to track multiple characters
        // For now, return the first active character
        const groupMembers = getGroupMembers(selected_group);
        if (groupMembers && groupMembers.length > 0) {
            return groupMembers[0].name;
        }
    } else if (this_chid !== undefined && characters && characters[this_chid]) {
        return characters[this_chid].name;
    }
    return 'Character';
}

/**
 * Generates a summary of the current character states for LLM context
 * @returns {string} Formatted character state summary
 */
export function generateCharacterStateSummary() {
    const charState = getCharacterState();
    const charName = charState.characterName || getCharacterName();

    let summary = `=== ${charName}'s Current State ===\n\n`;

    // Primary Traits (most important personality traits only)
    summary += `**Core Personality Traits** (0-100 scale):\n`;
    const keyTraits = {
        dominance: charState.primaryTraits.dominance,
        introversion: charState.primaryTraits.introversion,
        emotionalStability: charState.primaryTraits.emotionalStability,
        honesty: charState.primaryTraits.honesty,
        empathy: charState.primaryTraits.empathy,
        corruption: charState.primaryTraits.corruption
    };
    for (const [trait, value] of Object.entries(keyTraits)) {
        if (value !== undefined && value !== null) {
            summary += `- ${trait}: ${value}\n`;
        }
    }
    summary += `\n`;

    // Secondary States (current emotions)
    summary += `**Current Emotional States** (0-100 intensity):\n`;
    const activeStates = Object.entries(charState.secondaryStates)
        .filter(([key, value]) => value > 10) // Only show non-trivial states
        .sort((a, b) => b[1] - a[1]) // Sort by intensity
        .slice(0, 10); // Top 10 states

    if (activeStates.length > 0) {
        for (const [state, value] of activeStates) {
            summary += `- ${state}: ${value}\n`;
        }
    } else {
        summary += `- (Emotionally neutral)\n`;
    }
    summary += `\n`;

    // Physical Stats
    summary += `**Physical Condition**:\n`;
    summary += `- Health: ${charState.physicalStats.health || 100}%\n`;
    summary += `- Energy: ${charState.physicalStats.energy || 70}%\n`;
    summary += `- Hunger: ${charState.physicalStats.hunger || 40}%\n`;
    summary += `- Arousal: ${charState.physicalStats.arousal || 0}%\n`;
    summary += `\n`;

    // Clothing Summary
    if (charState.clothing && charState.clothing.totalCoverage !== undefined) {
        summary += `**Current Outfit**: `;
        const outfit = [];
        if (charState.clothing.upperBody?.shirt?.worn) {
            outfit.push(charState.clothing.upperBody.shirt.type);
        }
        if (charState.clothing.lowerBody?.pants?.worn) {
            outfit.push(charState.clothing.lowerBody.pants.type);
        }
        if (outfit.length > 0) {
            summary += outfit.join(', ');
        } else {
            summary += 'Minimal clothing';
        }
        summary += ` (${charState.clothing.totalCoverage}% coverage)\n\n`;
    }

    // Context Info
    if (charState.contextInfo.location || charState.contextInfo.timeOfDay) {
        summary += `**Scene Context**:\n`;
        if (charState.contextInfo.location) {
            summary += `- Location: ${charState.contextInfo.location}\n`;
        }
        if (charState.contextInfo.timeOfDay) {
            summary += `- Time: ${charState.contextInfo.timeOfDay}\n`;
        }
        if (charState.contextInfo.presentCharacters && charState.contextInfo.presentCharacters.length > 0) {
            summary += `- Present: ${charState.contextInfo.presentCharacters.join(', ')}\n`;
        }
        summary += `\n`;
    }

    // Relationships (active ones only)
    const activeRelationships = Object.entries(charState.relationships)
        .filter(([name, data]) => data.trust > 30 || data.love > 10 || data.attraction > 10);

    if (activeRelationships.length > 0) {
        summary += `**Key Relationships**:\n`;
        for (const [name, rel] of activeRelationships) {
            summary += `- ${name}: Trust ${rel.trust}, Love ${rel.love}, Attraction ${rel.attraction}\n`;
            if (rel.currentThoughts) {
                summary += `  Thoughts: "${rel.currentThoughts}"\n`;
            }
        }
        summary += `\n`;
    }

    // Current Thoughts
    if (charState.thoughts.internalMonologue) {
        summary += `**Internal Thoughts**: "${charState.thoughts.internalMonologue}"\n\n`;
    }

    return summary;
}

/**
 * Generates the tracking prompt for character state updates
 * @returns {string} Formatted instruction text for the AI
 */
export function generateCharacterTrackingInstructions() {
    const charName = getCharacterName();
    const charState = getCharacterState();

    let instructions = `\n=== CHARACTER STATE TRACKING ===\n\n`;
    instructions += `After your response, you MUST update ${charName}'s state based on what happened in your response.\n\n`;
    instructions += `Provide the updates in this exact format:\n\n`;

    instructions += `\`\`\`character-state\n`;
    instructions += `${charName}'s State Update\n`;
    instructions += `---\n\n`;

    // Emotional States Changes
    instructions += `**Emotional Changes**:\n`;
    instructions += `- [Emotion]: [+/- amount] (reason: [brief explanation])\n`;
    instructions += `Example: "happy: +15 (reason: received compliment from {{user}})"\n`;
    instructions += `Example: "anxious: -10 (reason: situation resolved peacefully)"\n`;
    instructions += `(Only list emotions that changed. Use +/- notation.)\n\n`;

    // Physical State Changes
    instructions += `**Physical Changes**:\n`;
    instructions += `- Energy: [+/- amount] (reason: [brief])\n`;
    instructions += `- Arousal: [+/- amount] (reason: [brief])\n`;
    instructions += `- [Other stats if changed]: [+/- amount] (reason: [brief])\n\n`;

    // Relationship Changes (if applicable)
    instructions += `**Relationship Updates** (if any character interactions occurred):\n`;
    instructions += `- [Character Name]:\n`;
    instructions += `  - Trust: [+/- amount] (reason: [brief])\n`;
    instructions += `  - Love: [+/- amount] (reason: [brief])\n`;
    instructions += `  - Attraction: [+/- amount] (reason: [brief])\n`;
    instructions += `  - Thoughts: "[what ${charName} is thinking about this person now]"\n\n`;

    // Context Updates
    instructions += `**Scene Context**:\n`;
    instructions += `- Location: [current location]\n`;
    instructions += `- Time: [current time of day]\n`;
    instructions += `- Present: [list of characters currently in scene]\n\n`;

    // Internal Thoughts
    instructions += `**${charName}'s Thoughts**:\n`;
    instructions += `"[${charName}'s internal monologue in first person, 1-3 sentences]"\n\n`;

    // Clothing Changes (if applicable)
    instructions += `**Outfit Changes** (only if clothing changed):\n`;
    instructions += `- [Item]: [removed/added/changed to X]\n`;
    instructions += `Example: "shirt: removed", "dress: added (red cocktail dress)"\n\n`;

    instructions += `\`\`\`\n\n`;

    instructions += `IMPORTANT GUIDELINES:\n`;
    instructions += `1. All changes should be REALISTIC and GRADUAL (+/- 1-15 for normal events, +/- 20+ only for major events)\n`;
    instructions += `2. Consider ${charName}'s personality traits when determining emotional reactions\n`;
    instructions += `3. Track physical needs realistically (energy decreases with activity, arousal changes with context)\n`;
    instructions += `4. Relationship changes require INTERACTION - don't change relationships with characters not in the scene\n`;
    instructions += `5. Internal thoughts should reflect ${charName}'s true feelings, even if different from what they say\n`;
    instructions += `6. If nothing significant happened, you can note "No significant state changes"\n\n`;

    return instructions;
}

/**
 * Generates the full prompt for character state tracking in TOGETHER mode
 * This is injected as part of the main generation
 * @returns {string} Prompt text to inject
 */
export function generateCharacterTrackingPrompt() {
    const charName = getCharacterName();
    const stateSummary = generateCharacterStateSummary();
    const instructions = generateCharacterTrackingInstructions();

    let prompt = `\n--- CHARACTER STATE TRACKING ---\n\n`;
    prompt += stateSummary;
    prompt += instructions;

    return prompt;
}

/**
 * Generates the full prompt for SEPARATE character state tracking mode
 * Creates a message array suitable for the generateRaw API
 * @returns {Array<{role: string, content: string}>} Array of message objects for API
 */
export async function generateSeparateCharacterTrackingPrompt() {
    const depth = extensionSettings.updateDepth || 4;
    const charName = getCharacterName();
    const userName = getContext().name1;
    const charState = getCharacterState();

    const messages = [];

    // System message
    let systemMessage = `You are a character state tracking system for an AI roleplay.\n\n`;
    systemMessage += `Your ONLY job is to analyze the most recent response from ${charName} and update their internal states accordingly.\n\n`;
    systemMessage += `You must track:\n`;
    systemMessage += `- Emotional states (happiness, arousal, stress, etc.)\n`;
    systemMessage += `- Physical condition (energy, health, hunger, etc.)\n`;
    systemMessage += `- Relationships (how ${charName} feels about other characters)\n`;
    systemMessage += `- Internal thoughts (what ${charName} is truly thinking)\n`;
    systemMessage += `- Context (location, time, who's present)\n\n`;
    systemMessage += `Be realistic and consider ${charName}'s personality when determining state changes.\n\n`;

    messages.push({
        role: 'system',
        content: systemMessage
    });

    // Add current character state
    const stateSummary = generateCharacterStateSummary();
    messages.push({
        role: 'user',
        content: `Current ${charName}'s state:\n\n${stateSummary}`
    });

    // Add recent chat history for context
    messages.push({
        role: 'user',
        content: `Recent conversation history (for context):\n\n`
    });

    const recentMessages = chat.slice(-depth);
    for (const message of recentMessages) {
        messages.push({
            role: message.is_user ? 'user' : 'assistant',
            content: `[${message.is_user ? userName : charName}]: ${message.mes}`
        });
    }

    // Add tracking instructions
    const instructions = generateCharacterTrackingInstructions();
    messages.push({
        role: 'user',
        content: instructions + `\nProvide ONLY the character state update in the exact format specified above. Do not include any other commentary.`
    });

    return messages;
}

/**
 * Generates a prompt for initializing character state from character card
 * This is used when starting a new chat or resetting state
 * @returns {string} Prompt for initialization
 */
export async function generateCharacterInitializationPrompt() {
    const charName = getCharacterName();
    let character = null;

    if (this_chid !== undefined && characters && characters[this_chid]) {
        character = characters[this_chid];
    }

    let prompt = `You are analyzing a character card to initialize state tracking.\n\n`;

    if (character) {
        prompt += `Character: ${character.name}\n\n`;

        if (character.description) {
            prompt += `Description:\n${character.description}\n\n`;
        }

        if (character.personality) {
            prompt += `Personality:\n${character.personality}\n\n`;
        }

        if (character.scenario) {
            prompt += `Scenario:\n${character.scenario}\n\n`;
        }
    }

    prompt += `Based on this character information, provide reasonable initial values (0-100 scale) for these personality traits:\n\n`;
    prompt += `\`\`\`json\n`;
    prompt += `{\n`;
    prompt += `  "dominance": 50,\n`;
    prompt += `  "introversion": 50,\n`;
    prompt += `  "emotionalStability": 50,\n`;
    prompt += `  "honesty": 50,\n`;
    prompt += `  "empathy": 50,\n`;
    prompt += `  "corruption": 10,\n`;
    prompt += `  "intelligence": 50,\n`;
    prompt += `  "confidence": 50\n`;
    prompt += `}\n`;
    prompt += `\`\`\`\n\n`;
    prompt += `Consider the character's description and personality when setting these values.\n`;
    prompt += `For example:\n`;
    prompt += `- A shy character would have high introversion (70-90)\n`;
    prompt += `- A leader would have high dominance (70-90)\n`;
    prompt += `- A kind character would have high empathy (70-90)\n\n`;
    prompt += `Provide ONLY the JSON object with your estimated values.`;

    return prompt;
}

/**
 * Generates a relationship analysis prompt for a specific character
 * Used when a new character is introduced or to analyze existing relationships
 * @param {string} targetCharacterName - Name of the character to analyze relationship with
 * @returns {string} Prompt for relationship analysis
 */
export function generateRelationshipAnalysisPrompt(targetCharacterName) {
    const charName = getCharacterName();
    const charState = getCharacterState();

    let prompt = `Analyze ${charName}'s relationship with ${targetCharacterName} based on recent interactions.\n\n`;

    // Add chat context
    const recentMessages = chat.slice(-10).filter(msg => {
        return msg.mes.toLowerCase().includes(targetCharacterName.toLowerCase());
    });

    if (recentMessages.length > 0) {
        prompt += `Recent interactions:\n\n`;
        for (const msg of recentMessages) {
            prompt += `- ${msg.mes.substring(0, 200)}${msg.mes.length > 200 ? '...' : ''}\n`;
        }
        prompt += `\n`;
    }

    prompt += `Provide relationship stats (0-100 scale) in this format:\n\n`;
    prompt += `\`\`\`json\n`;
    prompt += `{\n`;
    prompt += `  "trust": 50,\n`;
    prompt += `  "love": 0,\n`;
    prompt += `  "attraction": 0,\n`;
    prompt += `  "respect": 50,\n`;
    prompt += `  "closeness": 20,\n`;
    prompt += `  "currentThoughts": "[What ${charName} thinks about ${targetCharacterName}]",\n`;
    prompt += `  "relationshipStatus": "Stranger|Acquaintance|Friend|Close Friend|Lover|Enemy"\n`;
    prompt += `}\n`;
    prompt += `\`\`\`\n\n`;
    prompt += `Consider:\n`;
    prompt += `- How long they've known each other\n`;
    prompt += `- Quality of interactions (positive/negative)\n`;
    prompt += `- ${charName}'s personality (empathy: ${charState.primaryTraits.empathy}, trust tendency, etc.)\n`;
    prompt += `- Current emotional state of ${charName}\n\n`;
    prompt += `Provide ONLY the JSON object.`;

    return prompt;
}
