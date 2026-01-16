/**
 * Creature Journal System
 * Companions write diary entries about their experiences with the player
 *
 * This module provides a complete journal system where companion characters
 * maintain personal diaries about their adventures and interactions.
 */

export { JournalManager, getJournalManager, initializeJournalManager } from './journalManager.js';
export { generateJournalEntry, buildJournalPrompt } from './journalGenerator.js';
export {
    createJournalModal,
    openJournalModal,
    closeJournalModal,
    renderJournalEntry,
    initJournalUI
} from './journalUI.js';
export {
    saveJournal,
    loadJournal,
    exportJournalAsMarkdown,
    exportJournalAsPDF,
    getJournalStorageKey
} from './journalStorage.js';
