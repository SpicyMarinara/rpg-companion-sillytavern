/**
 * Memory Injector
 * Handles injection of relevant memories into character prompts
 */

import { getMemoryManager } from './memoryManager.js';
import { MEMORY_TYPES, IMPORTANCE_LEVELS } from './memoryTypes.js';

/**
 * Default formatting templates for memory injection
 */
const FORMATTING_TEMPLATES = {
    /** Header for memory section */
    header: '[Relevant Character Memories]',
    /** Footer for memory section */
    footer: '[End of Memories]',
    /** Separator between memories */
    separator: '\n',
    /** Format for individual memory */
    memoryFormat: '- {content} (importance: {importance})',
    /** Format for memory with timestamp */
    memoryFormatWithTime: '- [{time}] {content}',
    /** Wrapper for the entire section */
    wrapper: '\n{header}\n{memories}\n{footer}\n'
};

/**
 * Format options for memory injection
 * @typedef {Object} FormatOptions
 * @property {boolean} [includeImportance=false] - Include importance level
 * @property {boolean} [includeTimestamp=false] - Include relative timestamp
 * @property {boolean} [includeType=false] - Include memory type
 * @property {boolean} [groupByType=false] - Group memories by type
 * @property {string} [header] - Custom header text
 * @property {string} [footer] - Custom footer text
 */

/**
 * Format a relative time string
 * @param {number} timestamp - Unix timestamp
 * @returns {string} Relative time string
 */
function formatRelativeTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;

    const minutes = Math.floor(diff / (60 * 1000));
    const hours = Math.floor(diff / (60 * 60 * 1000));
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return `${Math.floor(days / 30)}mo ago`;
}

/**
 * Format a single memory for display
 * @param {Object} memory - Memory object
 * @param {FormatOptions} options - Formatting options
 * @returns {string}
 */
function formatMemory(memory, options = {}) {
    let formatted = '- ';

    if (options.includeTimestamp) {
        formatted += `[${formatRelativeTime(memory.timestamp)}] `;
    }

    if (options.includeType) {
        formatted += `(${memory.metadata?.type || 'memory'}) `;
    }

    formatted += memory.content;

    if (options.includeImportance) {
        const importance = memory.metadata?.importance || 5;
        const importanceLabel = importance >= 8 ? 'critical' :
            importance >= 6 ? 'important' :
            importance >= 4 ? 'normal' : 'minor';
        formatted += ` [${importanceLabel}]`;
    }

    return formatted;
}

/**
 * Format an array of memories for prompt injection
 * @param {Object[]} memories - Array of memory objects
 * @param {FormatOptions} [options={}] - Formatting options
 * @returns {string}
 */
export function formatMemoriesForPrompt(memories, options = {}) {
    if (!memories || memories.length === 0) {
        return '';
    }

    const header = options.header || FORMATTING_TEMPLATES.header;
    const footer = options.footer || FORMATTING_TEMPLATES.footer;

    let formattedMemories;

    if (options.groupByType) {
        // Group by type
        const grouped = {};
        for (const memory of memories) {
            const type = memory.metadata?.type || 'other';
            if (!grouped[type]) {
                grouped[type] = [];
            }
            grouped[type].push(memory);
        }

        const sections = [];
        for (const [type, typeMemories] of Object.entries(grouped)) {
            const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
            sections.push(`[${typeLabel}]`);
            for (const memory of typeMemories) {
                sections.push(formatMemory(memory, options));
            }
        }
        formattedMemories = sections.join('\n');
    } else {
        // Simple list
        formattedMemories = memories
            .map(m => formatMemory(m, options))
            .join('\n');
    }

    return `\n${header}\n${formattedMemories}\n${footer}\n`;
}

/**
 * Build memory context for character prompt
 * Main function for injecting relevant memories
 *
 * @param {string} characterId - Character identifier
 * @param {string[]|Object[]} currentMessages - Recent messages for context
 * @param {Object} [options={}] - Configuration options
 * @param {number} [options.limit=5] - Max memories to include
 * @param {boolean} [options.includeRecent=true] - Include recent memories
 * @param {boolean} [options.includeImportant=true] - Include important memories
 * @param {string[]} [options.types] - Filter by memory types
 * @param {FormatOptions} [options.format] - Formatting options
 * @returns {Promise<string>} Formatted memory context
 */
export async function buildMemoryContext(characterId, currentMessages, options = {}) {
    const manager = getMemoryManager(characterId);

    const {
        limit = 5,
        includeRecent = true,
        includeImportant = true,
        types = null,
        format = {}
    } = options;

    // Extract text from messages for query
    const messageTexts = currentMessages.map(m => {
        if (typeof m === 'string') return m;
        return m.content || m.mes || m.message || '';
    });

    // Use recent messages as query
    const recentContext = messageTexts.slice(-3).join(' ');

    // Collect memories from different sources
    const collectedMemories = new Map();

    // 1. Query-relevant memories
    if (recentContext.trim()) {
        const queryMemories = await manager.recall(recentContext, limit, {
            type: types ? types[0] : undefined
        });

        for (const memory of queryMemories) {
            collectedMemories.set(memory.id, { ...memory, source: 'query' });
        }
    }

    // 2. Recent memories (last 24 hours)
    if (includeRecent && collectedMemories.size < limit) {
        const recentMemories = await manager.getRecentMemories(24, limit - collectedMemories.size);

        for (const memory of recentMemories) {
            if (!collectedMemories.has(memory.id)) {
                collectedMemories.set(memory.id, { ...memory, source: 'recent' });
            }
        }
    }

    // 3. Important memories
    if (includeImportant && collectedMemories.size < limit) {
        const importantMemories = await manager.getImportantMemories(
            limit - collectedMemories.size,
            IMPORTANCE_LEVELS.HIGH
        );

        for (const memory of importantMemories) {
            if (!collectedMemories.has(memory.id)) {
                collectedMemories.set(memory.id, { ...memory, source: 'important' });
            }
        }
    }

    // Convert to array and sort by relevance
    const memories = Array.from(collectedMemories.values())
        .sort((a, b) => {
            // Prioritize query matches, then importance, then recency
            if (a.source === 'query' && b.source !== 'query') return -1;
            if (b.source === 'query' && a.source !== 'query') return 1;

            const impA = a.metadata?.importance || 5;
            const impB = b.metadata?.importance || 5;
            if (impA !== impB) return impB - impA;

            return b.timestamp - a.timestamp;
        })
        .slice(0, limit);

    // Format for prompt injection
    return formatMemoriesForPrompt(memories, format);
}

/**
 * Extract facts from a message for memory storage
 * Uses simple heuristics to identify memorable content
 *
 * @param {string} message - Message to analyze
 * @param {Object} [context={}] - Additional context
 * @returns {Array<{content: string, type: string, importance: number}>}
 */
export function extractMemorableContent(message, context = {}) {
    if (!message || typeof message !== 'string') {
        return [];
    }

    const extracted = [];

    // Clean the message
    const cleanMessage = message
        .replace(/<[^>]+>/g, ' ')  // Remove HTML
        .replace(/\s+/g, ' ')       // Normalize whitespace
        .trim();

    if (cleanMessage.length < 10) {
        return [];
    }

    // Split into sentences
    const sentences = cleanMessage.split(/[.!?]+/).filter(s => s.trim().length > 10);

    for (const sentence of sentences) {
        const trimmed = sentence.trim();

        // Detect facts (statements with "is", "are", "was", "were")
        if (/\b(is|are|was|were|has|have|had)\b/i.test(trimmed)) {
            // Look for named entities (capitalized words)
            const namedEntities = trimmed.match(/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g);

            if (namedEntities && namedEntities.length > 0) {
                extracted.push({
                    content: trimmed,
                    type: MEMORY_TYPES.FACT,
                    importance: IMPORTANCE_LEVELS.MEDIUM
                });
            }
        }

        // Detect emotions (feeling words)
        const emotionPatterns = [
            /\b(feel|felt|feeling)\s+(\w+)/i,
            /\b(happy|sad|angry|scared|excited|worried|nervous|anxious)\b/i,
            /\b(love|hate|like|dislike)\b/i
        ];

        for (const pattern of emotionPatterns) {
            if (pattern.test(trimmed)) {
                extracted.push({
                    content: trimmed,
                    type: MEMORY_TYPES.EMOTION,
                    importance: IMPORTANCE_LEVELS.ABOVE_AVERAGE
                });
                break;
            }
        }

        // Detect relationships
        const relationshipPatterns = [
            /\b(friend|enemy|ally|lover|partner|rival)\b/i,
            /\b(trust|distrust|betrayed|loyal)\b/i,
            /\brelationship\b/i
        ];

        for (const pattern of relationshipPatterns) {
            if (pattern.test(trimmed)) {
                extracted.push({
                    content: trimmed,
                    type: MEMORY_TYPES.RELATIONSHIP,
                    importance: IMPORTANCE_LEVELS.HIGH
                });
                break;
            }
        }

        // Detect events (action verbs in past tense)
        const eventPatterns = [
            /\b(discovered|found|learned|realized|decided|agreed|promised)\b/i,
            /\b(arrived|left|went|came|returned)\b/i,
            /\b(started|began|ended|finished|completed)\b/i,
            /\b(won|lost|defeated|escaped|survived)\b/i
        ];

        for (const pattern of eventPatterns) {
            if (pattern.test(trimmed)) {
                extracted.push({
                    content: trimmed,
                    type: MEMORY_TYPES.EVENT,
                    importance: IMPORTANCE_LEVELS.HIGH
                });
                break;
            }
        }

        // Detect preferences
        const preferencePatterns = [
            /\b(prefer|favorite|favourite|like|enjoy)\b/i,
            /\bwant(s|ed)?\s+to\b/i,
            /\bneed(s|ed)?\s+to\b/i
        ];

        for (const pattern of preferencePatterns) {
            if (pattern.test(trimmed)) {
                extracted.push({
                    content: trimmed,
                    type: MEMORY_TYPES.PREFERENCE,
                    importance: IMPORTANCE_LEVELS.MEDIUM
                });
                break;
            }
        }

        // Detect location mentions
        if (/\b(at|in|near|inside|outside|around)\s+(the\s+)?[A-Z]/i.test(trimmed)) {
            extracted.push({
                content: trimmed,
                type: MEMORY_TYPES.LOCATION,
                importance: IMPORTANCE_LEVELS.LOW
            });
        }
    }

    // Deduplicate by content
    const seen = new Set();
    return extracted.filter(item => {
        const key = item.content.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

/**
 * Auto-extract and store memories from a conversation message
 *
 * @param {string} characterId - Character identifier
 * @param {string} message - Message to process
 * @param {Object} [options={}] - Options
 * @param {string} [options.source] - Source identifier (e.g., message ID)
 * @param {string} [options.speaker] - Who said the message
 * @param {boolean} [options.autoImportance=true] - Auto-calculate importance
 * @returns {Promise<Object[]>} Array of created memories
 */
export async function autoExtractMemories(characterId, message, options = {}) {
    const manager = getMemoryManager(characterId);
    const extracted = extractMemorableContent(message, options);

    if (extracted.length === 0) {
        return [];
    }

    const memories = [];

    for (const item of extracted) {
        try {
            const memory = await manager.addMemory(item.content, {
                type: item.type,
                importance: item.importance,
                source: options.source,
                relatedCharacter: options.speaker,
                tags: [item.type, options.speaker].filter(Boolean)
            });
            memories.push(memory);
        } catch (error) {
            console.warn(`[Memory] Failed to auto-extract memory: ${error.message}`);
        }
    }

    if (memories.length > 0) {
        console.log(`[Memory] Auto-extracted ${memories.length} memories from message`);
    }

    return memories;
}

/**
 * Summarize a character's memories for display
 *
 * @param {string} characterId - Character identifier
 * @param {Object} [options={}] - Options
 * @returns {Promise<string>}
 */
export async function summarizeMemories(characterId, options = {}) {
    const manager = getMemoryManager(characterId);
    const stats = await manager.getStats();

    if (stats.totalCount === 0) {
        return 'No memories stored.';
    }

    const lines = [
        `Total memories: ${stats.totalCount}`,
        `Average importance: ${stats.averageImportance.toFixed(1)}`,
        '',
        'By type:'
    ];

    for (const [type, count] of Object.entries(stats.byType)) {
        lines.push(`  ${type}: ${count}`);
    }

    if (stats.newestMemory) {
        lines.push('');
        lines.push(`Most recent: "${stats.newestMemory.content.substring(0, 50)}..."`);
    }

    if (stats.mostAccessed) {
        lines.push(`Most recalled: "${stats.mostAccessed.content.substring(0, 50)}..."`);
    }

    return lines.join('\n');
}

/**
 * Configuration for memory injection in generation flow
 */
export const INJECTION_CONFIG = {
    /** Whether memory injection is enabled */
    enabled: true,
    /** Maximum memories to inject */
    maxMemories: 5,
    /** Include importance labels */
    showImportance: false,
    /** Include timestamps */
    showTimestamp: false,
    /** Memory types to include (null = all) */
    includeTypes: null,
    /** Minimum importance to include */
    minImportance: IMPORTANCE_LEVELS.LOW,
    /** Injection position in prompt */
    position: 'before_last_message'
};

/**
 * Update injection configuration
 * @param {Partial<typeof INJECTION_CONFIG>} updates - Configuration updates
 */
export function updateInjectionConfig(updates) {
    Object.assign(INJECTION_CONFIG, updates);
}
