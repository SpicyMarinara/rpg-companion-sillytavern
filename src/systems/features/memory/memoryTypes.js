/**
 * Memory Types and Constants
 * Defines the different types of memories and their importance levels
 */

/**
 * Types of memories that can be stored
 * @readonly
 * @enum {string}
 */
export const MEMORY_TYPES = {
    /** Things said in chat conversations */
    CONVERSATION: 'conversation',
    /** Facts about the player character or world */
    FACT: 'fact',
    /** Emotional memories and reactions */
    EMOTION: 'emotion',
    /** Story events and plot points */
    EVENT: 'event',
    /** Relationship developments between characters */
    RELATIONSHIP: 'relationship',
    /** Player preferences and choices */
    PREFERENCE: 'preference',
    /** Character-specific information */
    CHARACTER: 'character',
    /** Location or setting information */
    LOCATION: 'location',
    /** Items, equipment, or possessions */
    ITEM: 'item',
    /** Quest or objective related */
    QUEST: 'quest'
};

/**
 * Importance levels for memories (1-10 scale)
 * Higher importance = more likely to be recalled
 * @readonly
 * @enum {number}
 */
export const IMPORTANCE_LEVELS = {
    /** Trivial details that can be forgotten */
    TRIVIAL: 1,
    /** Minor details with some relevance */
    MINOR: 2,
    /** Low importance, background information */
    LOW: 3,
    /** Slightly below average importance */
    BELOW_AVERAGE: 4,
    /** Standard importance for most memories */
    MEDIUM: 5,
    /** Above average importance */
    ABOVE_AVERAGE: 6,
    /** High importance, significant events */
    HIGH: 7,
    /** Very high importance, major plot points */
    VERY_HIGH: 8,
    /** Essential information, critical details */
    ESSENTIAL: 9,
    /** Critical memories that should never be forgotten */
    CRITICAL: 10
};

/**
 * Memory decay rates (how quickly memories fade)
 * Lower = faster decay, Higher = slower decay
 * @readonly
 * @enum {number}
 */
export const DECAY_RATES = {
    /** Memories that fade very quickly (ephemeral) */
    FAST: 0.1,
    /** Normal decay rate for most memories */
    NORMAL: 0.5,
    /** Slower decay for important memories */
    SLOW: 0.8,
    /** Memories that persist indefinitely */
    PERMANENT: 1.0
};

/**
 * Default configuration for memory system
 * @readonly
 */
export const MEMORY_DEFAULTS = {
    /** Default importance for new memories */
    defaultImportance: IMPORTANCE_LEVELS.MEDIUM,
    /** Default memory type */
    defaultType: MEMORY_TYPES.CONVERSATION,
    /** Default decay rate */
    defaultDecayRate: DECAY_RATES.NORMAL,
    /** Maximum memories to keep per character */
    maxMemoriesPerCharacter: 1000,
    /** Default number of memories to recall */
    defaultRecallLimit: 5,
    /** Minimum similarity score for recall (0-1) */
    minSimilarityThreshold: 0.3,
    /** Hours before memory importance starts to decay */
    decayStartHours: 24,
    /** Vector dimension for embeddings */
    embeddingDimension: 384
};

/**
 * Memory metadata schema
 * @typedef {Object} MemoryMetadata
 * @property {string} type - The type of memory (from MEMORY_TYPES)
 * @property {number} importance - Importance level (1-10)
 * @property {number} decayRate - How quickly the memory fades
 * @property {string[]} tags - Additional tags for categorization
 * @property {string} [source] - Where the memory came from (e.g., message ID)
 * @property {string} [relatedCharacter] - Character this memory relates to
 * @property {string} [location] - Location where this memory was formed
 * @property {Object} [custom] - Custom metadata fields
 */

/**
 * Memory record schema
 * @typedef {Object} Memory
 * @property {string} id - Unique identifier
 * @property {string} characterId - Character this memory belongs to
 * @property {string} content - The memory content/text
 * @property {number[]} embedding - Vector embedding of the content
 * @property {number} timestamp - When the memory was created
 * @property {number} lastAccessed - When the memory was last recalled
 * @property {number} accessCount - How many times this memory was recalled
 * @property {MemoryMetadata} metadata - Additional metadata
 */

/**
 * Determines the default importance based on memory type
 * @param {string} type - The memory type
 * @returns {number} The default importance level
 */
export function getDefaultImportanceForType(type) {
    switch (type) {
        case MEMORY_TYPES.EVENT:
        case MEMORY_TYPES.QUEST:
            return IMPORTANCE_LEVELS.HIGH;
        case MEMORY_TYPES.RELATIONSHIP:
        case MEMORY_TYPES.CHARACTER:
            return IMPORTANCE_LEVELS.ABOVE_AVERAGE;
        case MEMORY_TYPES.FACT:
        case MEMORY_TYPES.PREFERENCE:
            return IMPORTANCE_LEVELS.MEDIUM;
        case MEMORY_TYPES.EMOTION:
        case MEMORY_TYPES.LOCATION:
            return IMPORTANCE_LEVELS.BELOW_AVERAGE;
        case MEMORY_TYPES.CONVERSATION:
        case MEMORY_TYPES.ITEM:
        default:
            return IMPORTANCE_LEVELS.LOW;
    }
}

/**
 * Determines the default decay rate based on memory type
 * @param {string} type - The memory type
 * @returns {number} The default decay rate
 */
export function getDefaultDecayRateForType(type) {
    switch (type) {
        case MEMORY_TYPES.FACT:
        case MEMORY_TYPES.CHARACTER:
            return DECAY_RATES.PERMANENT;
        case MEMORY_TYPES.EVENT:
        case MEMORY_TYPES.QUEST:
        case MEMORY_TYPES.RELATIONSHIP:
            return DECAY_RATES.SLOW;
        case MEMORY_TYPES.PREFERENCE:
        case MEMORY_TYPES.LOCATION:
        case MEMORY_TYPES.ITEM:
            return DECAY_RATES.NORMAL;
        case MEMORY_TYPES.CONVERSATION:
        case MEMORY_TYPES.EMOTION:
        default:
            return DECAY_RATES.FAST;
    }
}
