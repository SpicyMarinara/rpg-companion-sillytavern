/**
 * Journal Generator Module
 * AI-powered journal entry generation using the companion's personality
 */

import { generateRaw, chat } from '../../../../../../../../script.js';
import { getContext } from '../../../../../../../extensions.js';
import { extensionSettings, lastGeneratedData } from '../../../core/state.js';
import { getJournalManager } from './journalManager.js';
import { generateWithExternalAPI } from '../../generation/apiClient.js';

/**
 * Extracts the player's name from context
 * @returns {string} Player name or 'the player'
 */
function getPlayerName() {
    const context = getContext();
    // Try to get persona name first
    if (context.name1 && context.name1.trim()) {
        return context.name1;
    }
    return 'the player';
}

/**
 * Extracts recent significant events from messages
 * @param {Array} messages - Recent chat messages
 * @param {number} maxEvents - Maximum events to extract
 * @returns {Array<string>} Array of event summaries
 */
function extractRecentEvents(messages, maxEvents = 5) {
    if (!messages || messages.length === 0) return [];

    const events = [];

    // Look for action markers, significant dialogue, or narrative beats
    for (const msg of messages) {
        if (!msg.mes) continue;

        const content = msg.mes;

        // Look for action asterisks (*action*)
        const actionMatches = content.match(/\*[^*]+\*/g);
        if (actionMatches) {
            for (const action of actionMatches.slice(0, 2)) {
                events.push(action.replace(/\*/g, ''));
                if (events.length >= maxEvents) break;
            }
        }

        // Look for dialogue with strong emotions
        const dialogueMatches = content.match(/"[^"]+[!?]"/g);
        if (dialogueMatches && events.length < maxEvents) {
            events.push(dialogueMatches[0]);
        }

        if (events.length >= maxEvents) break;
    }

    return events;
}

/**
 * Gets the current world state from info box data
 * @returns {Object} World state object
 */
function getWorldState() {
    const worldState = {
        location: 'Unknown',
        time: 'Unknown',
        weather: 'Unknown',
        date: 'Unknown'
    };

    // Try to parse from lastGeneratedData.infoBox
    if (lastGeneratedData.infoBox) {
        try {
            let infoBox = lastGeneratedData.infoBox;

            // Parse if it's a JSON string
            if (typeof infoBox === 'string') {
                try {
                    infoBox = JSON.parse(infoBox);
                } catch {
                    // Try to parse text format
                    const lines = infoBox.split('\n');
                    for (const line of lines) {
                        if (line.includes('Location:')) {
                            worldState.location = line.split('Location:')[1]?.trim() || worldState.location;
                        }
                        if (line.includes('Time:')) {
                            worldState.time = line.split('Time:')[1]?.trim() || worldState.time;
                        }
                        if (line.includes('Weather:')) {
                            worldState.weather = line.split('Weather:')[1]?.trim() || worldState.weather;
                        }
                        if (line.includes('Date:')) {
                            worldState.date = line.split('Date:')[1]?.trim() || worldState.date;
                        }
                    }
                    return worldState;
                }
            }

            // Extract from parsed JSON object
            if (infoBox.location?.value) worldState.location = infoBox.location.value;
            if (infoBox.time?.start) worldState.time = `${infoBox.time.start} - ${infoBox.time.end || infoBox.time.start}`;
            if (infoBox.weather?.forecast) worldState.weather = `${infoBox.weather.emoji || ''} ${infoBox.weather.forecast}`.trim();
            if (infoBox.date?.value) worldState.date = infoBox.date.value;

        } catch (e) {
            console.warn('[RPG Journal] Could not parse world state from infoBox:', e);
        }
    }

    return worldState;
}

/**
 * Gets character's current mood from thoughts data
 * @param {string} characterName - The character's name
 * @returns {string} Current mood or 'neutral'
 */
function getCharacterMood(characterName) {
    if (!lastGeneratedData.characterThoughts) return 'neutral';

    try {
        let thoughts = lastGeneratedData.characterThoughts;

        if (typeof thoughts === 'string') {
            try {
                thoughts = JSON.parse(thoughts);
            } catch {
                // Text format - look for mood indicators
                if (thoughts.toLowerCase().includes('happy') || thoughts.includes('smile')) return 'happy';
                if (thoughts.toLowerCase().includes('sad') || thoughts.includes('tear')) return 'sad';
                if (thoughts.toLowerCase().includes('angry') || thoughts.includes('frown')) return 'angry';
                if (thoughts.toLowerCase().includes('worried') || thoughts.includes('concern')) return 'worried';
                return 'neutral';
            }
        }

        // Find character in thoughts array
        const characters = thoughts.characters || thoughts;
        if (Array.isArray(characters)) {
            const char = characters.find(c =>
                c.name && c.name.toLowerCase() === characterName.toLowerCase()
            );
            if (char) {
                // Look for demeanor or mood field
                if (char.demeanor) return char.demeanor.toLowerCase();
                if (char.mood) return char.mood.toLowerCase();

                // Analyze internal monologue for mood
                const monologue = char.internalMonologue || char.thoughts || '';
                if (monologue.includes('happy') || monologue.includes('joy')) return 'happy';
                if (monologue.includes('worry') || monologue.includes('concern')) return 'worried';
                if (monologue.includes('sad') || monologue.includes('miss')) return 'melancholy';
                if (monologue.includes('excit') || monologue.includes('thrill')) return 'excited';
                if (monologue.includes('love') || monologue.includes('care')) return 'loving';
            }
        }
    } catch (e) {
        console.warn('[RPG Journal] Could not parse character mood:', e);
    }

    return 'neutral';
}

/**
 * Summarizes recent events for the journal prompt
 * @param {Array} messages - Recent chat messages
 * @returns {string} Event summary text
 */
function summarizeRecentEvents(messages) {
    if (!messages || messages.length === 0) {
        return 'A quiet day with little of note happening.';
    }

    const playerName = getPlayerName();
    const events = extractRecentEvents(messages, 6);

    if (events.length === 0) {
        // Fallback: summarize last few messages
        const summaries = [];
        for (const msg of messages.slice(-3)) {
            if (msg.mes) {
                // Get first sentence or truncate
                const firstSentence = msg.mes.split(/[.!?]/)[0];
                if (firstSentence.length > 10) {
                    summaries.push(firstSentence.substring(0, 100) + (firstSentence.length > 100 ? '...' : ''));
                }
            }
        }
        return summaries.length > 0
            ? summaries.join(' Then, ')
            : `Spent time with ${playerName} today.`;
    }

    return events.map(e => `- ${e}`).join('\n');
}

/**
 * Builds the journal prompt for AI generation
 * @param {Object} characterInfo - Character information
 * @param {Array} recentMessages - Recent chat messages
 * @param {Object} worldState - Current world state
 * @returns {string} The constructed prompt
 */
export function buildJournalPrompt(characterInfo, recentMessages, worldState) {
    const eventSummary = summarizeRecentEvents(recentMessages);
    const playerName = getPlayerName();

    return `Recent events to reflect on:
${eventSummary}

Current location: ${worldState.location}
Current time of day: ${worldState.time}
Weather: ${worldState.weather}
Date: ${worldState.date}
Your current mood: ${characterInfo.currentMood || 'thoughtful'}

Player's name: ${playerName}

Write your journal entry now. Be introspective, emotional, and authentic to your personality.
Write in first person. Include your thoughts, feelings, and reflections about ${playerName}.
Length: 150-300 words.`;
}

/**
 * Generates a journal entry using AI
 * @param {string} characterId - Character identifier
 * @param {Object} context - Generation context
 * @returns {Promise<Object>} Generated entry data
 */
export async function generateJournalEntry(characterId, context = {}) {
    const {
        recentMessages = [],
        characterInfo = {},
        worldState = getWorldState(),
        forceGenerate = false
    } = context;

    // Get the journal manager
    const journal = getJournalManager(characterId, characterInfo.name || characterId);

    // Check rate limiting unless forced
    if (!forceGenerate && !journal.canGenerateNewEntry()) {
        console.warn(`[RPG Journal] Rate limit reached for ${characterInfo.name || characterId}`);
        return null;
    }

    // Get recent messages from chat if not provided
    let messages = recentMessages;
    if (messages.length === 0 && chat && chat.length > 0) {
        // Get last 10 messages for context
        messages = chat.slice(-10);
    }

    // Get character's current mood
    const currentMood = characterInfo.currentMood || getCharacterMood(characterInfo.name || characterId);

    // Build the prompt
    const userPrompt = buildJournalPrompt(
        { ...characterInfo, currentMood },
        messages,
        worldState
    );

    const systemPrompt = `You are ${characterInfo.name || characterId}, writing in your private journal.
This is your personal diary where you record your thoughts, feelings, and experiences.
Write a heartfelt, introspective diary entry about your recent experiences with ${getPlayerName()}.

Guidelines:
- Write in first person as ${characterInfo.name || characterId}
- Be emotionally authentic and vulnerable
- Reflect on your relationship with ${getPlayerName()}
- Include specific details from recent events
- Express hopes, fears, or desires if appropriate
- Your personality should shine through in your writing style
- Length: 150-300 words
- Do not use markdown formatting
- Write as a natural diary entry, starting with "Dear Diary," or similar if that fits your character

${characterInfo.personality ? `Your personality: ${characterInfo.personality}` : ''}`;

    try {
        let response;

        // Use external API if configured, otherwise use SillyTavern's generateRaw
        if (extensionSettings.generationMode === 'external') {
            const apiMessages = [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ];
            response = await generateWithExternalAPI(apiMessages);
        } else {
            // Use generateRaw for separate mode or together mode
            response = await generateRaw({
                prompt: `${systemPrompt}\n\n${userPrompt}`,
                quietToLoud: false
            });
        }

        if (!response) {
            console.error('[RPG Journal] No response from AI');
            return null;
        }

        // Clean up the response
        let content = response.trim();

        // Remove any XML-like tags that might have leaked through
        content = content.replace(/<[^>]*>/g, '');

        // Extract topics from the content
        const topics = extractTopics(content);

        // Determine mood from content if not already set
        const detectedMood = detectMoodFromContent(content) || currentMood;

        // Create the entry
        const entry = await journal.addEntry(content, {
            mood: detectedMood,
            topics: topics,
            location: worldState.location,
            triggerEvent: context.triggerEvent || 'manual',
            charactersInvolved: [getPlayerName()],
            generatedBy: 'ai'
        });

        // console.log(`[RPG Journal] Generated entry for ${characterInfo.name}: "${content.substring(0, 50)}..."`);

        return entry;

    } catch (error) {
        console.error('[RPG Journal] Error generating journal entry:', error);
        throw error;
    }
}

/**
 * Extracts potential topics from journal content
 * @param {string} content - Journal entry content
 * @returns {Array<string>} Extracted topics
 */
function extractTopics(content) {
    const topics = [];
    const contentLower = content.toLowerCase();

    // Common topic keywords
    const topicKeywords = {
        'adventure': ['adventure', 'quest', 'journey', 'travel', 'explore'],
        'combat': ['fight', 'battle', 'attack', 'defend', 'enemy', 'sword', 'magic'],
        'romance': ['love', 'heart', 'kiss', 'romantic', 'affection', 'feelings'],
        'friendship': ['friend', 'companion', 'trust', 'together', 'bond'],
        'danger': ['danger', 'risk', 'threat', 'scared', 'afraid', 'peril'],
        'discovery': ['discover', 'found', 'learn', 'realize', 'understand'],
        'loss': ['lose', 'lost', 'miss', 'gone', 'grief', 'mourn'],
        'hope': ['hope', 'future', 'dream', 'wish', 'believe'],
        'fear': ['fear', 'worry', 'anxious', 'nervous', 'dread'],
        'growth': ['grow', 'change', 'become', 'learn', 'improve'],
        'home': ['home', 'safe', 'comfort', 'belong', 'family'],
        'mystery': ['mystery', 'strange', 'curious', 'wonder', 'secret'],
        'celebration': ['celebrate', 'happy', 'joy', 'victory', 'success'],
        'reflection': ['think', 'reflect', 'remember', 'past', 'memory']
    };

    for (const [topic, keywords] of Object.entries(topicKeywords)) {
        if (keywords.some(kw => contentLower.includes(kw))) {
            topics.push(topic);
        }
    }

    return topics.slice(0, 5); // Limit to 5 topics
}

/**
 * Detects mood from journal content
 * @param {string} content - Journal entry content
 * @returns {string} Detected mood
 */
function detectMoodFromContent(content) {
    const contentLower = content.toLowerCase();

    // Mood keywords with priority (first match wins)
    const moodPatterns = [
        { mood: 'joyful', patterns: ['overjoyed', 'ecstatic', 'elated', 'thrilled'] },
        { mood: 'happy', patterns: ['happy', 'glad', 'pleased', 'delighted', 'smile'] },
        { mood: 'loving', patterns: ['love', 'adore', 'cherish', 'heart full'] },
        { mood: 'excited', patterns: ['excited', 'eager', 'can\'t wait', 'anticipat'] },
        { mood: 'hopeful', patterns: ['hope', 'optimistic', 'looking forward'] },
        { mood: 'grateful', patterns: ['grateful', 'thankful', 'blessed', 'appreciate'] },
        { mood: 'content', patterns: ['content', 'peaceful', 'calm', 'serene'] },
        { mood: 'thoughtful', patterns: ['wonder', 'ponder', 'think about', 'curious'] },
        { mood: 'nostalgic', patterns: ['remember', 'miss', 'used to', 'nostalg'] },
        { mood: 'melancholy', patterns: ['sad', 'melanchol', 'blue', 'down'] },
        { mood: 'worried', patterns: ['worry', 'concern', 'anxious', 'nervous'] },
        { mood: 'scared', patterns: ['scared', 'afraid', 'fear', 'terrif'] },
        { mood: 'frustrated', patterns: ['frustrat', 'annoy', 'irritat'] },
        { mood: 'angry', patterns: ['angry', 'furious', 'rage', 'mad'] },
        { mood: 'confused', patterns: ['confus', 'uncertain', 'don\'t understand'] },
        { mood: 'determined', patterns: ['determined', 'resolve', 'must', 'will'] }
    ];

    for (const { mood, patterns } of moodPatterns) {
        if (patterns.some(p => contentLower.includes(p))) {
            return mood;
        }
    }

    return 'thoughtful'; // Default mood
}

/**
 * Triggers journal generation based on story events
 * @param {string} characterId - Character identifier
 * @param {string} eventType - Type of event that triggered generation
 * @param {Object} eventData - Additional event data
 */
export async function triggerJournalGeneration(characterId, eventType, eventData = {}) {
    const {
        characterName = characterId,
        characterPersonality = '',
        forceGenerate = false
    } = eventData;

    const journal = getJournalManager(characterId, characterName);

    // Check if auto-generation is enabled for this trigger type
    switch (eventType) {
        case 'day_end':
            if (!journal.settings.generateOnDayEnd) return null;
            break;
        case 'relationship_change':
            if (!journal.settings.generateOnRelationshipChange) return null;
            break;
        case 'major_event':
            if (!journal.settings.generateOnMajorEvent) return null;
            break;
        case 'manual':
            // Always allow manual triggers
            break;
        default:
            if (!journal.settings.autoGenerate) return null;
    }

    // Generate the entry
    return generateJournalEntry(characterId, {
        characterInfo: {
            name: characterName,
            personality: characterPersonality
        },
        triggerEvent: eventType,
        forceGenerate
    });
}
