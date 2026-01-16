/**
 * Memory System - Main Entry Point
 * Vector-based persistent memory for RPG characters
 *
 * This module provides:
 * - Semantic search over character memories using vector embeddings
 * - Multiple storage backends (in-memory, IndexedDB, external vector DBs)
 * - Memory types and importance levels for organization
 * - Auto-extraction of memorable content from conversations
 * - Memory consolidation and decay for long-term management
 * - UI components for memory visualization and management
 *
 * Usage:
 * ```javascript
 * import { getMemoryManager, buildMemoryContext, autoExtractMemories } from './memory';
 *
 * // Get or create manager for a character
 * const manager = getMemoryManager('character-123');
 *
 * // Store a memory
 * await manager.addMemory('The player revealed their true name is Alex', {
 *   type: 'fact',
 *   importance: 8
 * });
 *
 * // Recall relevant memories
 * const memories = await manager.recall('What is the player\'s name?');
 *
 * // Build context for prompt injection
 * const context = await buildMemoryContext('character-123', recentMessages);
 *
 * // Auto-extract memories from a message
 * await autoExtractMemories('character-123', assistantMessage, { source: messageId });
 * ```
 */

// Core types and constants
export {
    MEMORY_TYPES,
    IMPORTANCE_LEVELS,
    DECAY_RATES,
    MEMORY_DEFAULTS,
    getDefaultImportanceForType,
    getDefaultDecayRateForType
} from './memoryTypes.js';

// Embedding utilities
export {
    simpleEmbed,
    llmEmbed,
    batchEmbed,
    cosineSimilarity,
    euclideanDistance,
    normalizeVector,
    extractKeyPhrases,
    combinedSimilarity,
    updateVocabulary,
    resetVocabulary
} from './embedding.js';

// Vector store implementations
export {
    VectorStoreBase,
    InMemoryVectorStore,
    IndexedDBVectorStore,
    ChromaVectorStore,
    createVectorStore
} from './vectorStore.js';

// Memory manager
export {
    MemoryManager,
    getMemoryManager,
    removeMemoryManager,
    clearAllManagers
} from './memoryManager.js';

// Memory injection utilities
export {
    buildMemoryContext,
    formatMemoriesForPrompt,
    extractMemorableContent,
    autoExtractMemories,
    summarizeMemories,
    INJECTION_CONFIG,
    updateInjectionConfig
} from './memoryInjector.js';

// UI components
export {
    MemoryPanel,
    createMemoryPanel,
    showMemorySummary
} from './memoryUI.js';

/**
 * Initialize memory system for a character
 * Convenience function that sets up the manager and returns it ready to use
 *
 * @param {string} characterId - Unique identifier for the character
 * @param {Object} [options={}] - Configuration options
 * @param {string} [options.storeType='indexeddb'] - Storage backend type
 * @param {boolean} [options.useLLMEmbeddings=false] - Use LLM for embeddings
 * @param {Object} [options.embeddingProvider] - LLM provider configuration
 * @returns {Promise<import('./memoryManager.js').MemoryManager>}
 */
export async function initializeMemorySystem(characterId, options = {}) {
    const { getMemoryManager } = await import('./memoryManager.js');
    const manager = getMemoryManager(characterId, options);

    // If using IndexedDB, ensure it's initialized
    if (options.storeType === 'indexeddb' || !options.storeType) {
        if (manager.vectorStore.init) {
            await manager.vectorStore.init();
        }
    }

    console.log(`[Memory] Initialized memory system for character: ${characterId}`);
    return manager;
}

/**
 * Hook into generation flow to inject memories
 * Call this before each generation to add relevant memories to context
 *
 * @param {string} characterId - Character identifier
 * @param {Object[]} messages - Recent chat messages
 * @param {Object} [options={}] - Options
 * @returns {Promise<string>} Memory context to inject
 */
export async function getMemoryContextForGeneration(characterId, messages, options = {}) {
    const { INJECTION_CONFIG, buildMemoryContext } = await import('./memoryInjector.js');

    if (!INJECTION_CONFIG.enabled) {
        return '';
    }

    return buildMemoryContext(characterId, messages, {
        limit: INJECTION_CONFIG.maxMemories,
        format: {
            includeImportance: INJECTION_CONFIG.showImportance,
            includeTimestamp: INJECTION_CONFIG.showTimestamp
        },
        types: INJECTION_CONFIG.includeTypes
    });
}

/**
 * Process a new message and extract memories
 * Call this after receiving a new message to auto-store relevant info
 *
 * @param {string} characterId - Character identifier
 * @param {string} message - Message content
 * @param {Object} [metadata={}] - Additional metadata
 * @returns {Promise<Object[]>} Extracted memories
 */
export async function processMessageForMemories(characterId, message, metadata = {}) {
    const { autoExtractMemories } = await import('./memoryInjector.js');
    return autoExtractMemories(characterId, message, metadata);
}

/**
 * Version information
 */
export const VERSION = '1.0.0';

/**
 * Feature capabilities
 */
export const CAPABILITIES = {
    vectorSearch: true,
    persistentStorage: true,
    llmEmbeddings: true,
    memoryDecay: true,
    memoryConsolidation: true,
    autoExtraction: true,
    externalVectorDB: true,
    uiComponents: true
};

console.log(`[Memory] Memory system module loaded (v${VERSION})`);
