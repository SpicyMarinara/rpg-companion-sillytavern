/**
 * Memory Manager
 * Handles storage and retrieval of character memories using vectors
 */

import { createVectorStore, IndexedDBVectorStore } from './vectorStore.js';
import { simpleEmbed, llmEmbed, resetVocabulary } from './embedding.js';
import {
    MEMORY_TYPES,
    IMPORTANCE_LEVELS,
    MEMORY_DEFAULTS,
    getDefaultImportanceForType,
    getDefaultDecayRateForType
} from './memoryTypes.js';

/**
 * Generates a unique ID
 * @returns {string}
 */
function generateId() {
    return `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Memory Manager class
 * Core interface for storing and retrieving character memories
 */
export class MemoryManager {
    /**
     * @param {string} characterId - Unique identifier for the character
     * @param {Object} [options={}] - Configuration options
     * @param {VectorStoreBase} [options.vectorStore] - Custom vector store instance
     * @param {string} [options.storeType='indexeddb'] - Store type if no custom store provided
     * @param {Object} [options.embeddingProvider] - LLM embedding provider config
     * @param {boolean} [options.useLLMEmbeddings=false] - Whether to use LLM embeddings
     */
    constructor(characterId, options = {}) {
        this.characterId = characterId;
        this.options = options;

        // Create or use provided vector store
        this.vectorStore = options.vectorStore || createVectorStore(
            options.storeType || 'indexeddb',
            { dbName: `rpg-memory-${characterId}` }
        );

        // Embedding configuration
        this.useLLMEmbeddings = options.useLLMEmbeddings || false;
        this.embeddingProvider = options.embeddingProvider || null;

        // Cache for recent memories (quick access)
        this.recentCache = new Map();
        this.maxCacheSize = 50;
    }

    /**
     * Generate embedding for text
     * @param {string} content - Text to embed
     * @returns {Promise<number[]>}
     */
    async embed(content) {
        if (this.useLLMEmbeddings && this.embeddingProvider) {
            return llmEmbed(content, this.embeddingProvider);
        }
        return simpleEmbed(content);
    }

    /**
     * Store a new memory
     * @param {string} content - The memory content/text
     * @param {Object} [metadata={}] - Additional metadata
     * @param {string} [metadata.type] - Memory type (from MEMORY_TYPES)
     * @param {number} [metadata.importance] - Importance level (1-10)
     * @param {string[]} [metadata.tags] - Tags for categorization
     * @param {string} [metadata.source] - Source identifier (e.g., message ID)
     * @param {string} [metadata.relatedCharacter] - Related character name
     * @param {string} [metadata.location] - Location where memory was formed
     * @returns {Promise<Object>} The created memory object
     */
    async addMemory(content, metadata = {}) {
        if (!content || typeof content !== 'string' || content.trim().length === 0) {
            throw new Error('Memory content cannot be empty');
        }

        // Generate embedding
        const embedding = await this.embed(content);

        // Determine type and defaults
        const type = metadata.type || MEMORY_DEFAULTS.defaultType;
        const importance = metadata.importance ?? getDefaultImportanceForType(type);
        const decayRate = metadata.decayRate ?? getDefaultDecayRateForType(type);

        // Create memory object
        const memory = {
            id: generateId(),
            characterId: this.characterId,
            content: content.trim(),
            embedding,
            timestamp: Date.now(),
            lastAccessed: Date.now(),
            accessCount: 0,
            metadata: {
                type,
                importance,
                decayRate,
                tags: metadata.tags || [],
                source: metadata.source || null,
                relatedCharacter: metadata.relatedCharacter || null,
                location: metadata.location || null,
                custom: metadata.custom || {}
            }
        };

        // Store in vector store
        await this.vectorStore.add(memory);

        // Update cache
        this._updateCache(memory);

        console.log(`[Memory] Added memory for ${this.characterId}: "${content.substring(0, 50)}..."`);

        return memory;
    }

    /**
     * Add multiple memories at once (batch operation)
     * @param {Array<{content: string, metadata?: Object}>} memories - Array of memory objects
     * @returns {Promise<Object[]>} Array of created memories
     */
    async addMemories(memories) {
        const results = [];
        for (const { content, metadata } of memories) {
            try {
                const memory = await this.addMemory(content, metadata);
                results.push(memory);
            } catch (error) {
                console.warn(`[Memory] Failed to add memory: ${error.message}`);
            }
        }
        return results;
    }

    /**
     * Retrieve relevant memories for a query
     * @param {string} query - Search query
     * @param {number} [limit=5] - Maximum memories to return
     * @param {Object} [filter={}] - Filter criteria
     * @returns {Promise<Object[]>} Array of relevant memories with scores
     */
    async recall(query, limit = MEMORY_DEFAULTS.defaultRecallLimit, filter = {}) {
        if (!query || typeof query !== 'string') {
            return [];
        }

        // Generate query embedding
        const queryEmbedding = await this.embed(query);

        // Add character filter
        const searchFilter = {
            ...filter,
            characterId: this.characterId
        };

        // Search vector store
        const results = await this.vectorStore.search(queryEmbedding, limit, searchFilter);

        // Update access metadata for recalled memories
        for (const memory of results) {
            await this._recordAccess(memory.id);
        }

        return results;
    }

    /**
     * Get memories by time range
     * @param {number} [hours=24] - Hours to look back
     * @param {number} [limit=10] - Maximum memories to return
     * @returns {Promise<Object[]>}
     */
    async getRecentMemories(hours = 24, limit = 10) {
        const afterTimestamp = Date.now() - (hours * 60 * 60 * 1000);

        const filter = {
            characterId: this.characterId,
            afterTimestamp,
            minSimilarity: 0 // Return all regardless of similarity
        };

        // Use a dummy query to get all recent memories
        const dummyEmbedding = new Array(MEMORY_DEFAULTS.embeddingDimension).fill(0);

        const allMemories = await this.vectorStore.search(dummyEmbedding, 1000, filter);

        // Sort by timestamp descending and limit
        return allMemories
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, limit);
    }

    /**
     * Get memories by type
     * @param {string} type - Memory type (from MEMORY_TYPES)
     * @param {number} [limit=10] - Maximum memories to return
     * @returns {Promise<Object[]>}
     */
    async getMemoriesByType(type, limit = 10) {
        const filter = {
            characterId: this.characterId,
            type,
            minSimilarity: 0
        };

        const dummyEmbedding = new Array(MEMORY_DEFAULTS.embeddingDimension).fill(0);
        const memories = await this.vectorStore.search(dummyEmbedding, 1000, filter);

        return memories
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, limit);
    }

    /**
     * Get the most important memories
     * @param {number} [limit=10] - Maximum memories to return
     * @param {number} [minImportance=7] - Minimum importance threshold
     * @returns {Promise<Object[]>}
     */
    async getImportantMemories(limit = 10, minImportance = IMPORTANCE_LEVELS.HIGH) {
        const filter = {
            characterId: this.characterId,
            minImportance,
            minSimilarity: 0
        };

        const dummyEmbedding = new Array(MEMORY_DEFAULTS.embeddingDimension).fill(0);
        const memories = await this.vectorStore.search(dummyEmbedding, 1000, filter);

        return memories
            .sort((a, b) => (b.metadata?.importance || 0) - (a.metadata?.importance || 0))
            .slice(0, limit);
    }

    /**
     * Memory consolidation - merge similar memories
     * Finds clusters of similar memories and consolidates them
     * @param {number} [similarityThreshold=0.85] - Threshold for considering memories similar
     * @returns {Promise<{merged: number, remaining: number}>}
     */
    async consolidate(similarityThreshold = 0.85) {
        const allMemories = await this.vectorStore.export();
        const characterMemories = allMemories.filter(m => m.characterId === this.characterId);

        if (characterMemories.length < 2) {
            return { merged: 0, remaining: characterMemories.length };
        }

        const toDelete = new Set();
        const toUpdate = new Map();

        // Find similar memory pairs
        for (let i = 0; i < characterMemories.length; i++) {
            if (toDelete.has(characterMemories[i].id)) continue;

            for (let j = i + 1; j < characterMemories.length; j++) {
                if (toDelete.has(characterMemories[j].id)) continue;

                const similarity = this._computeSimilarity(
                    characterMemories[i].embedding,
                    characterMemories[j].embedding
                );

                if (similarity >= similarityThreshold) {
                    // Keep the one with higher importance or more recent
                    const [keeper, toRemove] = this._selectKeeperMemory(
                        characterMemories[i],
                        characterMemories[j]
                    );

                    toDelete.add(toRemove.id);

                    // Merge content and boost importance
                    if (!toUpdate.has(keeper.id)) {
                        toUpdate.set(keeper.id, {
                            accessCount: keeper.accessCount + toRemove.accessCount,
                            metadata: {
                                ...keeper.metadata,
                                importance: Math.min(10, (keeper.metadata?.importance || 5) + 1),
                                tags: [...new Set([
                                    ...(keeper.metadata?.tags || []),
                                    ...(toRemove.metadata?.tags || [])
                                ])]
                            }
                        });
                    }
                }
            }
        }

        // Apply updates and deletions
        for (const [id, updates] of toUpdate) {
            await this.vectorStore.update(id, updates);
        }

        for (const id of toDelete) {
            await this.vectorStore.delete(id);
        }

        console.log(`[Memory] Consolidated ${toDelete.size} memories for ${this.characterId}`);

        return {
            merged: toDelete.size,
            remaining: characterMemories.length - toDelete.size
        };
    }

    /**
     * Apply decay to old memories
     * Reduces importance of old, infrequently accessed memories
     * @returns {Promise<{decayed: number, removed: number}>}
     */
    async applyDecay() {
        const allMemories = await this.vectorStore.export();
        const characterMemories = allMemories.filter(m => m.characterId === this.characterId);

        const now = Date.now();
        const decayStartMs = MEMORY_DEFAULTS.decayStartHours * 60 * 60 * 1000;

        let decayed = 0;
        let removed = 0;

        for (const memory of characterMemories) {
            const age = now - memory.timestamp;
            if (age < decayStartMs) continue;

            const decayRate = memory.metadata?.decayRate || MEMORY_DEFAULTS.defaultDecayRate;
            if (decayRate >= 1.0) continue; // Permanent memories don't decay

            // Calculate decay factor based on age and access frequency
            const daysSinceCreation = age / (24 * 60 * 60 * 1000);
            const accessBoost = Math.log(1 + (memory.accessCount || 0));
            const decayFactor = Math.pow(decayRate, daysSinceCreation / 30) * (1 + accessBoost * 0.1);

            const currentImportance = memory.metadata?.importance || MEMORY_DEFAULTS.defaultImportance;
            const newImportance = Math.max(1, Math.floor(currentImportance * decayFactor));

            if (newImportance < currentImportance) {
                if (newImportance <= IMPORTANCE_LEVELS.TRIVIAL) {
                    // Remove very low importance memories
                    await this.vectorStore.delete(memory.id);
                    removed++;
                } else {
                    // Update importance
                    await this.vectorStore.update(memory.id, {
                        metadata: {
                            ...memory.metadata,
                            importance: newImportance
                        }
                    });
                    decayed++;
                }
            }
        }

        console.log(`[Memory] Decay applied: ${decayed} decayed, ${removed} removed`);

        return { decayed, removed };
    }

    /**
     * Delete a specific memory
     * @param {string} memoryId - Memory ID to delete
     * @returns {Promise<boolean>}
     */
    async deleteMemory(memoryId) {
        this.recentCache.delete(memoryId);
        return this.vectorStore.delete(memoryId);
    }

    /**
     * Delete memories matching criteria
     * @param {Object} criteria - Deletion criteria
     * @param {string} [criteria.type] - Memory type to delete
     * @param {number} [criteria.olderThanDays] - Delete memories older than X days
     * @param {number} [criteria.belowImportance] - Delete memories below importance level
     * @returns {Promise<number>} Number of memories deleted
     */
    async deleteMemoriesMatching(criteria) {
        const allMemories = await this.vectorStore.export();
        const toDelete = [];

        for (const memory of allMemories) {
            if (memory.characterId !== this.characterId) continue;

            let shouldDelete = false;

            if (criteria.type && memory.metadata?.type === criteria.type) {
                shouldDelete = true;
            }

            if (criteria.olderThanDays) {
                const cutoff = Date.now() - (criteria.olderThanDays * 24 * 60 * 60 * 1000);
                if (memory.timestamp < cutoff) {
                    shouldDelete = true;
                }
            }

            if (criteria.belowImportance) {
                if ((memory.metadata?.importance || 5) < criteria.belowImportance) {
                    shouldDelete = true;
                }
            }

            if (shouldDelete) {
                toDelete.push(memory.id);
            }
        }

        if (toDelete.length > 0) {
            await this.vectorStore.deleteMany(toDelete);
        }

        return toDelete.length;
    }

    /**
     * Clear all memories for this character
     * @returns {Promise<void>}
     */
    async clearAllMemories() {
        const allMemories = await this.vectorStore.export();
        const characterMemoryIds = allMemories
            .filter(m => m.characterId === this.characterId)
            .map(m => m.id);

        if (characterMemoryIds.length > 0) {
            await this.vectorStore.deleteMany(characterMemoryIds);
        }

        this.recentCache.clear();
        resetVocabulary();

        console.log(`[Memory] Cleared all memories for ${this.characterId}`);
    }

    /**
     * Export all memories for backup/transfer
     * @returns {Promise<Object>}
     */
    async export() {
        const allMemories = await this.vectorStore.export();
        const characterMemories = allMemories.filter(m => m.characterId === this.characterId);

        return {
            version: '1.0',
            characterId: this.characterId,
            exportDate: new Date().toISOString(),
            memoryCount: characterMemories.length,
            memories: characterMemories
        };
    }

    /**
     * Import memories from backup
     * @param {Object} data - Export data object
     * @param {boolean} [merge=true] - If true, merge with existing; if false, replace
     * @returns {Promise<{imported: number, skipped: number}>}
     */
    async import(data, merge = true) {
        if (!data || !data.memories || !Array.isArray(data.memories)) {
            throw new Error('Invalid import data format');
        }

        // Verify character ID matches
        if (data.characterId && data.characterId !== this.characterId) {
            console.warn(`[Memory] Import character ID mismatch: ${data.characterId} vs ${this.characterId}`);
        }

        if (!merge) {
            await this.clearAllMemories();
        }

        let imported = 0;
        let skipped = 0;

        for (const memory of data.memories) {
            try {
                // Update character ID to current
                memory.characterId = this.characterId;

                // Check for duplicates if merging
                if (merge) {
                    const existing = await this.vectorStore.get(memory.id);
                    if (existing) {
                        skipped++;
                        continue;
                    }
                }

                await this.vectorStore.add(memory);
                imported++;
            } catch (error) {
                console.warn(`[Memory] Failed to import memory: ${error.message}`);
                skipped++;
            }
        }

        console.log(`[Memory] Imported ${imported} memories, skipped ${skipped}`);

        return { imported, skipped };
    }

    /**
     * Get memory statistics
     * @returns {Promise<Object>}
     */
    async getStats() {
        const allMemories = await this.vectorStore.export();
        const characterMemories = allMemories.filter(m => m.characterId === this.characterId);

        const stats = {
            totalCount: characterMemories.length,
            byType: {},
            byImportance: {},
            averageImportance: 0,
            oldestMemory: null,
            newestMemory: null,
            mostAccessed: null
        };

        let totalImportance = 0;
        let oldestTimestamp = Infinity;
        let newestTimestamp = 0;
        let maxAccessCount = 0;

        for (const memory of characterMemories) {
            // By type
            const type = memory.metadata?.type || 'unknown';
            stats.byType[type] = (stats.byType[type] || 0) + 1;

            // By importance
            const importance = memory.metadata?.importance || 5;
            stats.byImportance[importance] = (stats.byImportance[importance] || 0) + 1;
            totalImportance += importance;

            // Timestamps
            if (memory.timestamp < oldestTimestamp) {
                oldestTimestamp = memory.timestamp;
                stats.oldestMemory = memory;
            }
            if (memory.timestamp > newestTimestamp) {
                newestTimestamp = memory.timestamp;
                stats.newestMemory = memory;
            }

            // Access count
            if ((memory.accessCount || 0) > maxAccessCount) {
                maxAccessCount = memory.accessCount;
                stats.mostAccessed = memory;
            }
        }

        stats.averageImportance = characterMemories.length > 0
            ? totalImportance / characterMemories.length
            : 0;

        return stats;
    }

    // Private helper methods

    /**
     * Update the recent cache
     * @private
     */
    _updateCache(memory) {
        this.recentCache.set(memory.id, memory);

        // Enforce cache size limit
        if (this.recentCache.size > this.maxCacheSize) {
            const oldest = this.recentCache.keys().next().value;
            this.recentCache.delete(oldest);
        }
    }

    /**
     * Record memory access
     * @private
     */
    async _recordAccess(memoryId) {
        try {
            await this.vectorStore.update(memoryId, {
                lastAccessed: Date.now(),
                accessCount: (await this.vectorStore.get(memoryId))?.accessCount + 1 || 1
            });
        } catch (error) {
            // Non-critical error
            console.debug(`[Memory] Failed to record access for ${memoryId}`);
        }
    }

    /**
     * Compute similarity between embeddings
     * @private
     */
    _computeSimilarity(embedding1, embedding2) {
        if (!embedding1 || !embedding2 || embedding1.length !== embedding2.length) {
            return 0;
        }

        const dotProduct = embedding1.reduce((sum, val, i) => sum + val * embedding2[i], 0);
        const mag1 = Math.sqrt(embedding1.reduce((sum, val) => sum + val * val, 0));
        const mag2 = Math.sqrt(embedding2.reduce((sum, val) => sum + val * val, 0));

        if (mag1 === 0 || mag2 === 0) return 0;

        return dotProduct / (mag1 * mag2);
    }

    /**
     * Select which memory to keep when consolidating
     * @private
     */
    _selectKeeperMemory(memory1, memory2) {
        const imp1 = memory1.metadata?.importance || 5;
        const imp2 = memory2.metadata?.importance || 5;

        // Prefer higher importance
        if (imp1 !== imp2) {
            return imp1 > imp2 ? [memory1, memory2] : [memory2, memory1];
        }

        // Prefer more recently accessed
        if (memory1.lastAccessed !== memory2.lastAccessed) {
            return memory1.lastAccessed > memory2.lastAccessed
                ? [memory1, memory2]
                : [memory2, memory1];
        }

        // Prefer more accessed
        if (memory1.accessCount !== memory2.accessCount) {
            return memory1.accessCount > memory2.accessCount
                ? [memory1, memory2]
                : [memory2, memory1];
        }

        // Default: keep newer
        return memory1.timestamp > memory2.timestamp
            ? [memory1, memory2]
            : [memory2, memory1];
    }
}

// Global manager instances cache
const managerInstances = new Map();

/**
 * Get or create a MemoryManager for a character
 * @param {string} characterId - Character identifier
 * @param {Object} [options] - Options for new manager
 * @returns {MemoryManager}
 */
export function getMemoryManager(characterId, options = {}) {
    if (!managerInstances.has(characterId)) {
        managerInstances.set(characterId, new MemoryManager(characterId, options));
    }
    return managerInstances.get(characterId);
}

/**
 * Remove a manager instance from cache
 * @param {string} characterId - Character identifier
 */
export function removeMemoryManager(characterId) {
    managerInstances.delete(characterId);
}

/**
 * Clear all manager instances
 */
export function clearAllManagers() {
    managerInstances.clear();
}
