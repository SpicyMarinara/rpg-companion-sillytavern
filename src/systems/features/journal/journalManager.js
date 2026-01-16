/**
 * Journal Manager Module
 * Core journal functionality - manages entries, CRUD operations, and state
 */

import { saveJournal, loadJournal } from './journalStorage.js';
import { getContext } from '../../../../../../../extensions.js';
import { chat_metadata } from '../../../../../../../../script.js';

/**
 * Generates a unique ID for journal entries
 * @returns {string} Unique identifier
 */
function generateId() {
    return `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * JournalManager class
 * Manages a single character's journal with all entries and metadata
 */
export class JournalManager {
    /**
     * Creates a new JournalManager instance
     * @param {string} characterId - Unique identifier for the character
     * @param {string} characterName - Display name of the character
     */
    constructor(characterId, characterName = 'Unknown') {
        this.characterId = characterId;
        this.characterName = characterName;
        this.entries = [];
        this.createdAt = Date.now();
        this.currentDay = 1;
        this.settings = {
            autoGenerate: true,
            generateOnDayEnd: true,
            generateOnRelationshipChange: true,
            generateOnMajorEvent: true,
            maxEntriesPerDay: 3
        };

        // Load existing journal if available
        this.load();
    }

    /**
     * Loads the journal from storage
     * @returns {boolean} True if journal was loaded successfully
     */
    load() {
        const savedData = loadJournal(this.characterId);
        if (savedData) {
            this.entries = savedData.entries || [];
            this.createdAt = savedData.createdAt || this.createdAt;
            this.currentDay = savedData.currentDay || this.currentDay;
            this.settings = { ...this.settings, ...savedData.settings };
            this.characterName = savedData.characterName || this.characterName;
            // console.log(`[RPG Journal] Loaded ${this.entries.length} entries for ${this.characterName}`);
            return true;
        }
        return false;
    }

    /**
     * Saves the journal to storage
     * @returns {boolean} True if save was successful
     */
    save() {
        return saveJournal(this.characterId, {
            characterId: this.characterId,
            characterName: this.characterName,
            entries: this.entries,
            createdAt: this.createdAt,
            currentDay: this.currentDay,
            settings: this.settings
        });
    }

    /**
     * Calculates the in-game day based on session history
     * @returns {number} Current in-game day
     */
    calculateInGameDay() {
        // If we have entries, increment from the last entry's day
        if (this.entries.length > 0) {
            const lastEntry = this.entries[this.entries.length - 1];
            const lastEntryDate = new Date(lastEntry.timestamp);
            const now = new Date();

            // If it's a new real-world day, increment the in-game day
            if (lastEntryDate.toDateString() !== now.toDateString()) {
                this.currentDay = (lastEntry.day || 1) + 1;
            } else {
                this.currentDay = lastEntry.day || 1;
            }
        }

        return this.currentDay;
    }

    /**
     * Adds a new journal entry
     * @param {string} content - The entry content
     * @param {Object} metadata - Additional metadata for the entry
     * @returns {Object} The created entry
     */
    async addEntry(content, metadata = {}) {
        const entry = {
            id: generateId(),
            content: content,
            timestamp: Date.now(),
            day: metadata.day || this.calculateInGameDay(),
            mood: metadata.mood || 'neutral',
            topics: metadata.topics || [],
            location: metadata.location || null,
            charactersInvolved: metadata.charactersInvolved || [],
            triggerEvent: metadata.triggerEvent || null, // What triggered this entry
            wordCount: content.split(/\s+/).length,
            ...metadata
        };

        this.entries.push(entry);
        this.save();

        // console.log(`[RPG Journal] Added entry for ${this.characterName} (Day ${entry.day})`);

        return entry;
    }

    /**
     * Updates an existing entry
     * @param {string} entryId - The entry ID to update
     * @param {Object} updates - Fields to update
     * @returns {Object|null} Updated entry or null if not found
     */
    updateEntry(entryId, updates) {
        const index = this.entries.findIndex(e => e.id === entryId);
        if (index === -1) {
            console.warn(`[RPG Journal] Entry not found: ${entryId}`);
            return null;
        }

        // Don't allow changing id or timestamp
        const { id, timestamp, ...allowedUpdates } = updates;

        this.entries[index] = {
            ...this.entries[index],
            ...allowedUpdates,
            lastModified: Date.now()
        };

        // Recalculate word count if content changed
        if (allowedUpdates.content) {
            this.entries[index].wordCount = allowedUpdates.content.split(/\s+/).length;
        }

        this.save();
        return this.entries[index];
    }

    /**
     * Deletes an entry by ID
     * @param {string} entryId - The entry ID to delete
     * @returns {boolean} True if deleted successfully
     */
    deleteEntry(entryId) {
        const index = this.entries.findIndex(e => e.id === entryId);
        if (index === -1) {
            return false;
        }

        this.entries.splice(index, 1);
        this.save();
        return true;
    }

    /**
     * Gets an entry by ID
     * @param {string} entryId - The entry ID
     * @returns {Object|null} The entry or null if not found
     */
    getEntry(entryId) {
        return this.entries.find(e => e.id === entryId) || null;
    }

    /**
     * Gets entries by date range
     * @param {Date|number} startDate - Start date (Date object or timestamp)
     * @param {Date|number} endDate - End date (Date object or timestamp)
     * @returns {Array} Entries within the date range
     */
    getEntriesByDateRange(startDate, endDate) {
        const start = startDate instanceof Date ? startDate.getTime() : startDate;
        const end = endDate instanceof Date ? endDate.getTime() : endDate;

        return this.entries.filter(entry =>
            entry.timestamp >= start && entry.timestamp <= end
        );
    }

    /**
     * Gets entries for a specific in-game day
     * @param {number} day - The in-game day number
     * @returns {Array} Entries for that day
     */
    getEntriesForDay(day) {
        return this.entries.filter(entry => entry.day === day);
    }

    /**
     * Gets the most recent entries
     * @param {number} count - Number of entries to return (default: 5)
     * @returns {Array} Most recent entries
     */
    getRecentEntries(count = 5) {
        return [...this.entries]
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, count);
    }

    /**
     * Gets the latest entry
     * @returns {Object|null} The most recent entry or null
     */
    getLatestEntry() {
        if (this.entries.length === 0) return null;
        return this.entries.reduce((latest, entry) =>
            entry.timestamp > latest.timestamp ? entry : latest
        );
    }

    /**
     * Searches entries by content
     * @param {string} query - Search query
     * @param {Object} options - Search options
     * @returns {Array} Matching entries
     */
    searchEntries(query, options = {}) {
        const {
            caseSensitive = false,
            searchTopics = true,
            searchMood = false
        } = options;

        const normalizedQuery = caseSensitive ? query : query.toLowerCase();

        return this.entries.filter(entry => {
            const content = caseSensitive ? entry.content : entry.content.toLowerCase();

            // Search in content
            if (content.includes(normalizedQuery)) {
                return true;
            }

            // Search in topics
            if (searchTopics && entry.topics) {
                const topicMatch = entry.topics.some(topic => {
                    const t = caseSensitive ? topic : topic.toLowerCase();
                    return t.includes(normalizedQuery);
                });
                if (topicMatch) return true;
            }

            // Search in mood
            if (searchMood && entry.mood) {
                const mood = caseSensitive ? entry.mood : entry.mood.toLowerCase();
                if (mood.includes(normalizedQuery)) return true;
            }

            return false;
        });
    }

    /**
     * Gets entries filtered by mood
     * @param {string} mood - Mood to filter by
     * @returns {Array} Entries with the specified mood
     */
    getEntriesByMood(mood) {
        return this.entries.filter(entry =>
            entry.mood && entry.mood.toLowerCase() === mood.toLowerCase()
        );
    }

    /**
     * Gets entries filtered by topic
     * @param {string} topic - Topic to filter by
     * @returns {Array} Entries containing the topic
     */
    getEntriesByTopic(topic) {
        return this.entries.filter(entry =>
            entry.topics && entry.topics.some(t =>
                t.toLowerCase().includes(topic.toLowerCase())
            )
        );
    }

    /**
     * Gets statistics about the journal
     * @returns {Object} Journal statistics
     */
    getStats() {
        const totalEntries = this.entries.length;
        const totalWords = this.entries.reduce((sum, e) => sum + (e.wordCount || 0), 0);
        const uniqueDays = [...new Set(this.entries.map(e => e.day))].length;
        const moodCounts = {};
        const topicCounts = {};

        for (const entry of this.entries) {
            // Count moods
            if (entry.mood) {
                moodCounts[entry.mood] = (moodCounts[entry.mood] || 0) + 1;
            }
            // Count topics
            if (entry.topics) {
                for (const topic of entry.topics) {
                    topicCounts[topic] = (topicCounts[topic] || 0) + 1;
                }
            }
        }

        return {
            totalEntries,
            totalWords,
            averageWordsPerEntry: totalEntries > 0 ? Math.round(totalWords / totalEntries) : 0,
            uniqueDays,
            currentDay: this.currentDay,
            firstEntryDate: this.entries.length > 0
                ? new Date(Math.min(...this.entries.map(e => e.timestamp)))
                : null,
            lastEntryDate: this.entries.length > 0
                ? new Date(Math.max(...this.entries.map(e => e.timestamp)))
                : null,
            moodCounts,
            topicCounts,
            mostCommonMood: Object.entries(moodCounts)
                .sort((a, b) => b[1] - a[1])[0]?.[0] || null,
            mostCommonTopics: Object.entries(topicCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([topic]) => topic)
        };
    }

    /**
     * Checks if a new entry should be generated (rate limiting)
     * @returns {boolean} True if a new entry can be generated
     */
    canGenerateNewEntry() {
        const todayEntries = this.getEntriesForDay(this.currentDay);
        return todayEntries.length < this.settings.maxEntriesPerDay;
    }

    /**
     * Updates journal settings
     * @param {Object} newSettings - Settings to update
     */
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        this.save();
    }

    /**
     * Clears all entries (use with caution)
     */
    clearAllEntries() {
        this.entries = [];
        this.currentDay = 1;
        this.save();
    }

    /**
     * Exports the journal data as a JSON object
     * @returns {Object} Complete journal data
     */
    toJSON() {
        return {
            characterId: this.characterId,
            characterName: this.characterName,
            entries: this.entries,
            createdAt: this.createdAt,
            currentDay: this.currentDay,
            settings: this.settings,
            stats: this.getStats()
        };
    }
}

// Global journal manager instances (one per character)
const journalManagers = new Map();

/**
 * Gets or creates a JournalManager for a character
 * @param {string} characterId - Character identifier
 * @param {string} characterName - Character display name
 * @returns {JournalManager} The journal manager instance
 */
export function getJournalManager(characterId, characterName = 'Unknown') {
    if (!journalManagers.has(characterId)) {
        const manager = new JournalManager(characterId, characterName);
        journalManagers.set(characterId, manager);
    }
    return journalManagers.get(characterId);
}

/**
 * Initializes journal managers for all known characters in the current chat
 * @param {Array} characters - Array of character objects with id and name
 */
export function initializeJournalManager(characters = []) {
    for (const char of characters) {
        if (char.id || char.name) {
            const id = char.id || char.name.toLowerCase().replace(/\s+/g, '_');
            getJournalManager(id, char.name);
        }
    }
    // console.log(`[RPG Journal] Initialized journals for ${characters.length} characters`);
}

/**
 * Gets all active journal managers
 * @returns {Map} Map of characterId to JournalManager
 */
export function getAllJournalManagers() {
    return journalManagers;
}

/**
 * Clears all journal managers (useful when switching chats)
 */
export function clearJournalManagers() {
    journalManagers.clear();
}
