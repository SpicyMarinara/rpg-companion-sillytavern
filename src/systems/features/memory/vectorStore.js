/**
 * Vector Store Abstraction
 * Supports multiple backends: in-memory, IndexedDB, or external (Chroma, Pinecone)
 */

import { cosineSimilarity } from './embedding.js';
import { MEMORY_DEFAULTS } from './memoryTypes.js';

/**
 * Base class for vector stores
 * @abstract
 */
export class VectorStoreBase {
    /**
     * Add an item to the store
     * @abstract
     * @param {Object} item - Item with embedding and metadata
     * @returns {Promise<void>}
     */
    async add(item) {
        throw new Error('Method not implemented');
    }

    /**
     * Search for similar items
     * @abstract
     * @param {number[]} queryVector - Query embedding
     * @param {number} limit - Maximum results to return
     * @param {Object} [filter] - Optional filter criteria
     * @returns {Promise<Object[]>}
     */
    async search(queryVector, limit, filter) {
        throw new Error('Method not implemented');
    }

    /**
     * Delete an item by ID
     * @abstract
     * @param {string} id - Item ID
     * @returns {Promise<boolean>}
     */
    async delete(id) {
        throw new Error('Method not implemented');
    }

    /**
     * Clear all items
     * @abstract
     * @returns {Promise<void>}
     */
    async clear() {
        throw new Error('Method not implemented');
    }

    /**
     * Get total count of items
     * @abstract
     * @returns {Promise<number>}
     */
    async count() {
        throw new Error('Method not implemented');
    }

    /**
     * Export all data
     * @abstract
     * @returns {Promise<Object[]>}
     */
    async export() {
        throw new Error('Method not implemented');
    }

    /**
     * Import data
     * @abstract
     * @param {Object[]} data - Data to import
     * @returns {Promise<void>}
     */
    async import(data) {
        throw new Error('Method not implemented');
    }
}

/**
 * In-Memory Vector Store
 * Fast but not persistent across sessions
 */
export class InMemoryVectorStore extends VectorStoreBase {
    constructor() {
        super();
        /** @type {Map<string, Object>} */
        this.vectors = new Map();
    }

    /**
     * Add an item to the store
     * @param {Object} item - Item with id, embedding, and metadata
     * @returns {Promise<void>}
     */
    async add(item) {
        if (!item || !item.id) {
            throw new Error('Item must have an id');
        }
        this.vectors.set(item.id, { ...item });
    }

    /**
     * Update an existing item
     * @param {string} id - Item ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<boolean>}
     */
    async update(id, updates) {
        const item = this.vectors.get(id);
        if (!item) {
            return false;
        }
        this.vectors.set(id, { ...item, ...updates });
        return true;
    }

    /**
     * Get an item by ID
     * @param {string} id - Item ID
     * @returns {Promise<Object|null>}
     */
    async get(id) {
        return this.vectors.get(id) || null;
    }

    /**
     * Search for similar items using cosine similarity
     * @param {number[]} queryVector - Query embedding
     * @param {number} [limit=5] - Maximum results to return
     * @param {Object} [filter={}] - Optional filter criteria
     * @returns {Promise<Object[]>} Sorted by similarity (highest first)
     */
    async search(queryVector, limit = 5, filter = {}) {
        const results = [];

        for (const item of this.vectors.values()) {
            // Apply filters
            if (filter.type && item.metadata?.type !== filter.type) {
                continue;
            }
            if (filter.minImportance && (item.metadata?.importance || 0) < filter.minImportance) {
                continue;
            }
            if (filter.characterId && item.characterId !== filter.characterId) {
                continue;
            }
            if (filter.tags && filter.tags.length > 0) {
                const itemTags = item.metadata?.tags || [];
                if (!filter.tags.some(tag => itemTags.includes(tag))) {
                    continue;
                }
            }
            if (filter.afterTimestamp && item.timestamp < filter.afterTimestamp) {
                continue;
            }
            if (filter.beforeTimestamp && item.timestamp > filter.beforeTimestamp) {
                continue;
            }

            // Calculate similarity
            const score = cosineSimilarity(queryVector, item.embedding);

            // Apply minimum threshold
            if (score < (filter.minSimilarity || MEMORY_DEFAULTS.minSimilarityThreshold)) {
                continue;
            }

            results.push({
                ...item,
                score
            });
        }

        // Sort by score descending and apply limit
        return results
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    }

    /**
     * Delete an item by ID
     * @param {string} id - Item ID
     * @returns {Promise<boolean>}
     */
    async delete(id) {
        return this.vectors.delete(id);
    }

    /**
     * Delete multiple items by IDs
     * @param {string[]} ids - Array of IDs
     * @returns {Promise<number>} Number of items deleted
     */
    async deleteMany(ids) {
        let count = 0;
        for (const id of ids) {
            if (this.vectors.delete(id)) {
                count++;
            }
        }
        return count;
    }

    /**
     * Clear all items
     * @returns {Promise<void>}
     */
    async clear() {
        this.vectors.clear();
    }

    /**
     * Get total count of items
     * @returns {Promise<number>}
     */
    async count() {
        return this.vectors.size;
    }

    /**
     * Get all items (for iteration)
     * @returns {Promise<Object[]>}
     */
    async getAll() {
        return Array.from(this.vectors.values());
    }

    /**
     * Export all data
     * @returns {Promise<Object[]>}
     */
    async export() {
        return Array.from(this.vectors.values());
    }

    /**
     * Import data
     * @param {Object[]} data - Data to import
     * @returns {Promise<void>}
     */
    async import(data) {
        for (const item of data) {
            if (item && item.id) {
                this.vectors.set(item.id, item);
            }
        }
    }
}

/**
 * IndexedDB Vector Store
 * Persistent storage using browser IndexedDB
 */
export class IndexedDBVectorStore extends VectorStoreBase {
    /**
     * @param {string} dbName - Database name
     * @param {string} storeName - Object store name
     */
    constructor(dbName = 'rpg-companion-memory', storeName = 'vectors') {
        super();
        this.dbName = dbName;
        this.storeName = storeName;
        this.db = null;
        this._initPromise = null;
    }

    /**
     * Initialize the database
     * @returns {Promise<IDBDatabase>}
     */
    async init() {
        if (this.db) {
            return this.db;
        }

        if (this._initPromise) {
            return this._initPromise;
        }

        this._initPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);

            request.onerror = () => {
                reject(new Error(`Failed to open IndexedDB: ${request.error}`));
            };

            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Create object store if it doesn't exist
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const store = db.createObjectStore(this.storeName, { keyPath: 'id' });

                    // Create indexes for common queries
                    store.createIndex('characterId', 'characterId', { unique: false });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                    store.createIndex('type', 'metadata.type', { unique: false });
                    store.createIndex('importance', 'metadata.importance', { unique: false });
                }
            };
        });

        return this._initPromise;
    }

    /**
     * Get a transaction and object store
     * @param {string} mode - 'readonly' or 'readwrite'
     * @returns {Promise<IDBObjectStore>}
     */
    async getStore(mode = 'readonly') {
        await this.init();
        const transaction = this.db.transaction(this.storeName, mode);
        return transaction.objectStore(this.storeName);
    }

    /**
     * Add an item to the store
     * @param {Object} item - Item with id, embedding, and metadata
     * @returns {Promise<void>}
     */
    async add(item) {
        const store = await this.getStore('readwrite');
        return new Promise((resolve, reject) => {
            const request = store.put(item);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Update an existing item
     * @param {string} id - Item ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<boolean>}
     */
    async update(id, updates) {
        const store = await this.getStore('readwrite');
        return new Promise((resolve, reject) => {
            const getRequest = store.get(id);
            getRequest.onsuccess = () => {
                if (!getRequest.result) {
                    resolve(false);
                    return;
                }
                const updated = { ...getRequest.result, ...updates };
                const putRequest = store.put(updated);
                putRequest.onsuccess = () => resolve(true);
                putRequest.onerror = () => reject(putRequest.error);
            };
            getRequest.onerror = () => reject(getRequest.error);
        });
    }

    /**
     * Get an item by ID
     * @param {string} id - Item ID
     * @returns {Promise<Object|null>}
     */
    async get(id) {
        const store = await this.getStore('readonly');
        return new Promise((resolve, reject) => {
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Search for similar items
     * Note: IndexedDB doesn't support vector search natively,
     * so we load all items and compute similarity in memory
     * @param {number[]} queryVector - Query embedding
     * @param {number} [limit=5] - Maximum results
     * @param {Object} [filter={}] - Filter criteria
     * @returns {Promise<Object[]>}
     */
    async search(queryVector, limit = 5, filter = {}) {
        const store = await this.getStore('readonly');
        const items = await new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });

        const results = [];

        for (const item of items) {
            // Apply filters
            if (filter.type && item.metadata?.type !== filter.type) {
                continue;
            }
            if (filter.minImportance && (item.metadata?.importance || 0) < filter.minImportance) {
                continue;
            }
            if (filter.characterId && item.characterId !== filter.characterId) {
                continue;
            }
            if (filter.tags && filter.tags.length > 0) {
                const itemTags = item.metadata?.tags || [];
                if (!filter.tags.some(tag => itemTags.includes(tag))) {
                    continue;
                }
            }
            if (filter.afterTimestamp && item.timestamp < filter.afterTimestamp) {
                continue;
            }
            if (filter.beforeTimestamp && item.timestamp > filter.beforeTimestamp) {
                continue;
            }

            const score = cosineSimilarity(queryVector, item.embedding);

            if (score < (filter.minSimilarity || MEMORY_DEFAULTS.minSimilarityThreshold)) {
                continue;
            }

            results.push({ ...item, score });
        }

        return results
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    }

    /**
     * Delete an item by ID
     * @param {string} id - Item ID
     * @returns {Promise<boolean>}
     */
    async delete(id) {
        const store = await this.getStore('readwrite');
        return new Promise((resolve, reject) => {
            const request = store.delete(id);
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Delete multiple items by IDs
     * @param {string[]} ids - Array of IDs
     * @returns {Promise<number>}
     */
    async deleteMany(ids) {
        const store = await this.getStore('readwrite');
        let count = 0;
        for (const id of ids) {
            await new Promise((resolve, reject) => {
                const request = store.delete(id);
                request.onsuccess = () => {
                    count++;
                    resolve();
                };
                request.onerror = () => reject(request.error);
            });
        }
        return count;
    }

    /**
     * Clear all items
     * @returns {Promise<void>}
     */
    async clear() {
        const store = await this.getStore('readwrite');
        return new Promise((resolve, reject) => {
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get total count
     * @returns {Promise<number>}
     */
    async count() {
        const store = await this.getStore('readonly');
        return new Promise((resolve, reject) => {
            const request = store.count();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get all items
     * @returns {Promise<Object[]>}
     */
    async getAll() {
        const store = await this.getStore('readonly');
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Export all data
     * @returns {Promise<Object[]>}
     */
    async export() {
        return this.getAll();
    }

    /**
     * Import data
     * @param {Object[]} data - Data to import
     * @returns {Promise<void>}
     */
    async import(data) {
        const store = await this.getStore('readwrite');
        for (const item of data) {
            await new Promise((resolve, reject) => {
                const request = store.put(item);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        }
    }

    /**
     * Close the database connection
     */
    close() {
        if (this.db) {
            this.db.close();
            this.db = null;
            this._initPromise = null;
        }
    }
}

/**
 * Chroma Vector Store (external)
 * For use with self-hosted Chroma DB
 */
export class ChromaVectorStore extends VectorStoreBase {
    /**
     * @param {Object} config - Configuration
     * @param {string} config.baseUrl - Chroma server URL
     * @param {string} config.collectionName - Collection name
     */
    constructor(config = {}) {
        super();
        this.baseUrl = config.baseUrl || 'http://localhost:8000';
        this.collectionName = config.collectionName || 'rpg-companion-memory';
        this.collectionId = null;
    }

    /**
     * Initialize collection
     * @returns {Promise<void>}
     */
    async init() {
        if (this.collectionId) return;

        try {
            // Get or create collection
            const response = await fetch(`${this.baseUrl}/api/v1/collections`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: this.collectionName,
                    get_or_create: true
                })
            });

            if (!response.ok) {
                throw new Error(`Chroma API error: ${response.status}`);
            }

            const data = await response.json();
            this.collectionId = data.id;
        } catch (error) {
            console.error('[Memory] Chroma init failed:', error);
            throw error;
        }
    }

    /**
     * Add an item
     * @param {Object} item - Item to add
     * @returns {Promise<void>}
     */
    async add(item) {
        await this.init();

        const response = await fetch(`${this.baseUrl}/api/v1/collections/${this.collectionId}/add`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ids: [item.id],
                embeddings: [item.embedding],
                documents: [item.content],
                metadatas: [{
                    ...item.metadata,
                    characterId: item.characterId,
                    timestamp: item.timestamp
                }]
            })
        });

        if (!response.ok) {
            throw new Error(`Chroma add error: ${response.status}`);
        }
    }

    /**
     * Search for similar items
     * @param {number[]} queryVector - Query embedding
     * @param {number} [limit=5] - Maximum results
     * @param {Object} [filter={}] - Filter criteria
     * @returns {Promise<Object[]>}
     */
    async search(queryVector, limit = 5, filter = {}) {
        await this.init();

        const whereFilter = {};
        if (filter.characterId) {
            whereFilter.characterId = filter.characterId;
        }
        if (filter.type) {
            whereFilter.type = filter.type;
        }

        const response = await fetch(`${this.baseUrl}/api/v1/collections/${this.collectionId}/query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query_embeddings: [queryVector],
                n_results: limit,
                where: Object.keys(whereFilter).length > 0 ? whereFilter : undefined
            })
        });

        if (!response.ok) {
            throw new Error(`Chroma query error: ${response.status}`);
        }

        const data = await response.json();

        // Transform Chroma results to our format
        const results = [];
        if (data.ids && data.ids[0]) {
            for (let i = 0; i < data.ids[0].length; i++) {
                results.push({
                    id: data.ids[0][i],
                    content: data.documents?.[0]?.[i],
                    embedding: data.embeddings?.[0]?.[i],
                    metadata: data.metadatas?.[0]?.[i],
                    score: data.distances?.[0]?.[i]
                        ? 1 - data.distances[0][i] // Convert distance to similarity
                        : 1
                });
            }
        }

        return results;
    }

    /**
     * Delete an item
     * @param {string} id - Item ID
     * @returns {Promise<boolean>}
     */
    async delete(id) {
        await this.init();

        const response = await fetch(`${this.baseUrl}/api/v1/collections/${this.collectionId}/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: [id] })
        });

        return response.ok;
    }

    /**
     * Delete multiple items
     * @param {string[]} ids - Array of item IDs to delete
     * @returns {Promise<boolean>}
     */
    async deleteMany(ids) {
        if (!ids || ids.length === 0) return true;
        await this.init();

        const response = await fetch(`${this.baseUrl}/api/v1/collections/${this.collectionId}/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids })
        });

        return response.ok;
    }

    /**
     * Get all items (alias for export for API consistency)
     * @returns {Promise<Object[]>}
     */
    async getAll() {
        return this.export();
    }

    /**
     * Clear all items
     * @returns {Promise<void>}
     */
    async clear() {
        // Delete and recreate collection
        await fetch(`${this.baseUrl}/api/v1/collections/${this.collectionName}`, {
            method: 'DELETE'
        });
        this.collectionId = null;
        await this.init();
    }

    /**
     * Get count
     * @returns {Promise<number>}
     */
    async count() {
        await this.init();

        const response = await fetch(`${this.baseUrl}/api/v1/collections/${this.collectionId}/count`);
        if (!response.ok) return 0;

        const data = await response.json();
        return data.count || 0;
    }

    /**
     * Export all data
     * @returns {Promise<Object[]>}
     */
    async export() {
        await this.init();

        const response = await fetch(`${this.baseUrl}/api/v1/collections/${this.collectionId}/get`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });

        if (!response.ok) return [];

        const data = await response.json();
        const results = [];

        if (data.ids) {
            for (let i = 0; i < data.ids.length; i++) {
                results.push({
                    id: data.ids[i],
                    content: data.documents?.[i],
                    embedding: data.embeddings?.[i],
                    metadata: data.metadatas?.[i]
                });
            }
        }

        return results;
    }

    /**
     * Import data
     * @param {Object[]} data - Data to import
     * @returns {Promise<void>}
     */
    async import(data) {
        for (const item of data) {
            await this.add(item);
        }
    }
}

/**
 * Factory function to create the appropriate vector store
 * @param {string} type - Store type: 'memory', 'indexeddb', or 'chroma'
 * @param {Object} [config] - Configuration options
 * @returns {VectorStoreBase}
 */
export function createVectorStore(type = 'indexeddb', config = {}) {
    switch (type.toLowerCase()) {
        case 'memory':
        case 'inmemory':
            return new InMemoryVectorStore();

        case 'indexeddb':
        case 'idb':
            return new IndexedDBVectorStore(config.dbName, config.storeName);

        case 'chroma':
            return new ChromaVectorStore(config);

        default:
            console.warn(`[Memory] Unknown store type "${type}", defaulting to IndexedDB`);
            return new IndexedDBVectorStore();
    }
}
