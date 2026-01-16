/**
 * Text Embedding Utilities
 * Convert text to vectors for similarity search
 *
 * Provides both simple TF-IDF based embedding (no external API)
 * and optional LLM-based embeddings when available.
 */

import { MEMORY_DEFAULTS } from './memoryTypes.js';

/**
 * Stop words to filter out for better embedding quality
 * @type {Set<string>}
 */
const STOP_WORDS = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need',
    'dare', 'ought', 'used', 'it', 'its', "it's", 'this', 'that', 'these',
    'those', 'i', 'you', 'he', 'she', 'we', 'they', 'me', 'him', 'her',
    'us', 'them', 'my', 'your', 'his', 'our', 'their', 'mine', 'yours',
    'hers', 'ours', 'theirs', 'what', 'which', 'who', 'whom', 'whose',
    'where', 'when', 'why', 'how', 'all', 'each', 'every', 'both', 'few',
    'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only',
    'own', 'same', 'so', 'than', 'too', 'very', 'just', 'also', 'now',
    'here', 'there', 'then', 'once', 'if', 'unless', 'until', 'while',
    'about', 'against', 'between', 'into', 'through', 'during', 'before',
    'after', 'above', 'below', 'up', 'down', 'out', 'off', 'over', 'under',
    'again', 'further', 'any', 'am', "i'm", "you're", "he's", "she's",
    "we're", "they're", "i've", "you've", "we've", "they've", "i'd",
    "you'd", "he'd", "she'd", "we'd", "they'd", "i'll", "you'll", "he'll",
    "she'll", "we'll", "they'll", "isn't", "aren't", "wasn't", "weren't",
    "hasn't", "haven't", "hadn't", "doesn't", "don't", "didn't", "won't",
    "wouldn't", "shan't", "shouldn't", "can't", "cannot", "couldn't",
    "mustn't", "let's", "that's", "who's", "what's", "here's", "there's",
    "when's", "where's", "why's", "how's", 'because', 'although', 'though'
]);

/**
 * Global vocabulary for TF-IDF (built from all processed texts)
 * Maps term to document frequency
 * @type {Map<string, number>}
 */
let globalVocabulary = new Map();

/**
 * Total number of documents processed (for IDF calculation)
 * @type {number}
 */
let totalDocuments = 0;

/**
 * Tokenizes text into words
 * @param {string} text - Text to tokenize
 * @returns {string[]} Array of tokens
 */
function tokenize(text) {
    if (!text || typeof text !== 'string') {
        return [];
    }

    return text
        .toLowerCase()
        // Remove special characters but keep apostrophes in contractions
        .replace(/[^\w\s'-]/g, ' ')
        // Split on whitespace
        .split(/\s+/)
        // Filter out empty strings and stop words
        .filter(word => word.length > 1 && !STOP_WORDS.has(word));
}

/**
 * Applies stemming to a word (simple suffix stripping)
 * @param {string} word - Word to stem
 * @returns {string} Stemmed word
 */
function stem(word) {
    // Simple Porter-like stemming rules
    if (word.length <= 3) return word;

    // Remove common suffixes
    const suffixes = [
        'ing', 'ed', 'ly', 'es', 's', 'ment', 'ness', 'tion', 'sion',
        'able', 'ible', 'ful', 'less', 'ous', 'ive', 'al', 'er', 'est'
    ];

    for (const suffix of suffixes) {
        if (word.endsWith(suffix) && word.length > suffix.length + 2) {
            return word.slice(0, -suffix.length);
        }
    }

    return word;
}

/**
 * Builds a term frequency map from tokens
 * @param {string[]} tokens - Array of tokens
 * @returns {Map<string, number>} Term frequency map
 */
function buildTermFrequency(tokens) {
    const tf = new Map();
    for (const token of tokens) {
        const stemmed = stem(token);
        tf.set(stemmed, (tf.get(stemmed) || 0) + 1);
    }
    return tf;
}

/**
 * Updates the global vocabulary with terms from a document
 * @param {Map<string, number>} termFrequency - Term frequency map
 */
export function updateVocabulary(termFrequency) {
    totalDocuments++;
    for (const term of termFrequency.keys()) {
        globalVocabulary.set(term, (globalVocabulary.get(term) || 0) + 1);
    }
}

/**
 * Resets the global vocabulary (call when clearing all memories)
 */
export function resetVocabulary() {
    globalVocabulary.clear();
    totalDocuments = 0;
}

/**
 * Creates a simple TF-IDF based embedding (no external API needed)
 * Uses a fixed-dimension sparse vector representation
 *
 * @param {string} text - Text to embed
 * @param {boolean} [updateVocab=true] - Whether to update global vocabulary
 * @returns {number[]} Vector embedding of fixed dimension
 */
export function simpleEmbed(text, updateVocab = true) {
    const tokens = tokenize(text);
    const tf = buildTermFrequency(tokens);

    if (updateVocab) {
        updateVocabulary(tf);
    }

    // Create a fixed-dimension vector using hashing trick
    const dimension = MEMORY_DEFAULTS.embeddingDimension;
    const vector = new Array(dimension).fill(0);

    for (const [term, freq] of tf) {
        // Calculate TF-IDF weight
        const tfWeight = 1 + Math.log(freq);
        const df = globalVocabulary.get(term) || 1;
        const idfWeight = Math.log((totalDocuments + 1) / (df + 1)) + 1;
        const weight = tfWeight * idfWeight;

        // Hash the term to get indices (use multiple hashes for better distribution)
        const hash1 = hashString(term) % dimension;
        const hash2 = hashString(term + '_2') % dimension;
        const hash3 = hashString(term + '_3') % dimension;

        // Add/subtract based on sign hash (feature hashing)
        const sign1 = hashString(term + '_s1') % 2 === 0 ? 1 : -1;
        const sign2 = hashString(term + '_s2') % 2 === 0 ? 1 : -1;
        const sign3 = hashString(term + '_s3') % 2 === 0 ? 1 : -1;

        vector[hash1] += weight * sign1;
        vector[hash2] += weight * sign2 * 0.5;
        vector[hash3] += weight * sign3 * 0.25;
    }

    // L2 normalize the vector
    return normalizeVector(vector);
}

/**
 * Simple string hash function
 * @param {string} str - String to hash
 * @returns {number} Hash value
 */
function hashString(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) + str.charCodeAt(i);
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
}

/**
 * L2 normalizes a vector
 * @param {number[]} vector - Vector to normalize
 * @returns {number[]} Normalized vector
 */
export function normalizeVector(vector) {
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (magnitude === 0) {
        return vector;
    }
    return vector.map(val => val / magnitude);
}

/**
 * Calculates cosine similarity between two vectors
 * @param {number[]} a - First vector
 * @param {number[]} b - Second vector
 * @returns {number} Similarity score between -1 and 1
 */
export function cosineSimilarity(a, b) {
    if (!a || !b || a.length !== b.length) {
        return 0;
    }

    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));

    if (magnitudeA === 0 || magnitudeB === 0) {
        return 0;
    }

    return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Calculates Euclidean distance between two vectors
 * @param {number[]} a - First vector
 * @param {number[]} b - Second vector
 * @returns {number} Distance (lower = more similar)
 */
export function euclideanDistance(a, b) {
    if (!a || !b || a.length !== b.length) {
        return Infinity;
    }

    return Math.sqrt(a.reduce((sum, val, i) => sum + Math.pow(val - b[i], 2), 0));
}

/**
 * Uses LLM embedding endpoint if available
 * Falls back to simple embedding if not available
 *
 * @param {string} text - Text to embed
 * @param {Object} [provider] - Provider configuration
 * @param {string} provider.baseUrl - API base URL
 * @param {string} provider.apiKey - API key
 * @param {string} provider.model - Embedding model name
 * @returns {Promise<number[]>} Vector embedding
 */
export async function llmEmbed(text, provider) {
    // If no provider or required fields missing, fall back to simple embedding
    if (!provider || !provider.baseUrl || !provider.apiKey) {
        console.log('[Memory] No LLM provider configured, using simple embedding');
        return simpleEmbed(text);
    }

    try {
        const response = await fetch(`${provider.baseUrl}/embeddings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${provider.apiKey}`
            },
            body: JSON.stringify({
                input: text,
                model: provider.model || 'text-embedding-ada-002'
            })
        });

        if (!response.ok) {
            throw new Error(`Embedding API error: ${response.status}`);
        }

        const data = await response.json();
        if (data.data && data.data[0] && data.data[0].embedding) {
            return data.data[0].embedding;
        }

        throw new Error('Invalid embedding response format');
    } catch (error) {
        console.warn('[Memory] LLM embedding failed, falling back to simple:', error.message);
        return simpleEmbed(text);
    }
}

/**
 * Batch embeds multiple texts efficiently
 * @param {string[]} texts - Array of texts to embed
 * @param {Object} [provider] - LLM provider configuration
 * @returns {Promise<number[][]>} Array of embeddings
 */
export async function batchEmbed(texts, provider) {
    if (!provider || !provider.baseUrl || !provider.apiKey) {
        // Use simple embedding for all
        return texts.map(text => simpleEmbed(text));
    }

    try {
        const response = await fetch(`${provider.baseUrl}/embeddings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${provider.apiKey}`
            },
            body: JSON.stringify({
                input: texts,
                model: provider.model || 'text-embedding-ada-002'
            })
        });

        if (!response.ok) {
            throw new Error(`Batch embedding API error: ${response.status}`);
        }

        const data = await response.json();
        if (data.data && Array.isArray(data.data)) {
            return data.data.map(d => d.embedding);
        }

        throw new Error('Invalid batch embedding response format');
    } catch (error) {
        console.warn('[Memory] Batch LLM embedding failed, falling back to simple:', error.message);
        return texts.map(text => simpleEmbed(text));
    }
}

/**
 * Extracts key phrases from text for better memory representation
 * @param {string} text - Text to extract phrases from
 * @returns {string[]} Array of key phrases
 */
export function extractKeyPhrases(text) {
    if (!text || typeof text !== 'string') {
        return [];
    }

    const tokens = tokenize(text);
    const phrases = [];

    // Single important words (nouns, verbs based on position/frequency)
    const wordFreq = new Map();
    for (const token of tokens) {
        wordFreq.set(token, (wordFreq.get(token) || 0) + 1);
    }

    // Get top words by frequency
    const sortedWords = [...wordFreq.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([word]) => word);

    phrases.push(...sortedWords);

    // Extract bigrams (two-word phrases)
    for (let i = 0; i < tokens.length - 1; i++) {
        const bigram = `${tokens[i]} ${tokens[i + 1]}`;
        phrases.push(bigram);
    }

    return [...new Set(phrases)].slice(0, 15);
}

/**
 * Computes semantic similarity using multiple methods and averages them
 * @param {number[]} embedding1 - First embedding
 * @param {number[]} embedding2 - Second embedding
 * @param {string} text1 - Original text 1 (for lexical comparison)
 * @param {string} text2 - Original text 2 (for lexical comparison)
 * @returns {number} Combined similarity score (0-1)
 */
export function combinedSimilarity(embedding1, embedding2, text1, text2) {
    // Vector similarity (primary)
    const vectorSim = (cosineSimilarity(embedding1, embedding2) + 1) / 2; // Normalize to 0-1

    // Jaccard similarity of key phrases (secondary)
    const phrases1 = new Set(extractKeyPhrases(text1));
    const phrases2 = new Set(extractKeyPhrases(text2));
    const intersection = new Set([...phrases1].filter(x => phrases2.has(x)));
    const union = new Set([...phrases1, ...phrases2]);
    const jaccardSim = union.size > 0 ? intersection.size / union.size : 0;

    // Weighted combination (70% vector, 30% lexical)
    return vectorSim * 0.7 + jaccardSim * 0.3;
}
