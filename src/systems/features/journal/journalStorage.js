/**
 * Journal Storage Module
 * Handles persistence of journal entries to chat metadata and localStorage
 */

import { chat_metadata, saveChatDebounced } from '../../../../../../../../script.js';
import { getContext } from '../../../../../../../extensions.js';

/**
 * Generates a unique storage key for a character's journal
 * @param {string} characterId - The character identifier
 * @param {string} chatId - Optional chat ID for chat-specific journals
 * @returns {string} Storage key
 */
export function getJournalStorageKey(characterId, chatId = null) {
    const baseKey = `rpg_journal_${characterId}`;
    if (chatId) {
        return `${baseKey}_${chatId}`;
    }
    return baseKey;
}

/**
 * Saves a journal to chat metadata
 * @param {string} characterId - Character identifier
 * @param {Object} journalData - Journal data to save
 */
export function saveJournal(characterId, journalData) {
    if (!chat_metadata) {
        console.warn('[RPG Journal] Cannot save - chat_metadata not available');
        return false;
    }

    // Initialize journals object if needed
    if (!chat_metadata.rpg_journals) {
        chat_metadata.rpg_journals = {};
    }

    // Save journal data
    chat_metadata.rpg_journals[characterId] = {
        ...journalData,
        lastUpdated: Date.now()
    };

    // Trigger debounced save
    saveChatDebounced();
    // console.log(`[RPG Journal] Saved journal for character: ${characterId}`);

    return true;
}

/**
 * Loads a journal from chat metadata
 * @param {string} characterId - Character identifier
 * @returns {Object|null} Journal data or null if not found
 */
export function loadJournal(characterId) {
    if (!chat_metadata || !chat_metadata.rpg_journals) {
        return null;
    }

    const journalData = chat_metadata.rpg_journals[characterId];
    if (!journalData) {
        return null;
    }

    // console.log(`[RPG Journal] Loaded journal for character: ${characterId}`);
    return journalData;
}

/**
 * Gets all journals for the current chat
 * @returns {Object} Map of characterId to journal data
 */
export function getAllJournals() {
    if (!chat_metadata || !chat_metadata.rpg_journals) {
        return {};
    }
    return chat_metadata.rpg_journals;
}

/**
 * Deletes a journal from storage
 * @param {string} characterId - Character identifier
 * @returns {boolean} True if deleted successfully
 */
export function deleteJournal(characterId) {
    if (!chat_metadata || !chat_metadata.rpg_journals) {
        return false;
    }

    if (chat_metadata.rpg_journals[characterId]) {
        delete chat_metadata.rpg_journals[characterId];
        saveChatDebounced();
        // console.log(`[RPG Journal] Deleted journal for character: ${characterId}`);
        return true;
    }

    return false;
}

/**
 * Exports a journal as formatted Markdown
 * @param {Object} journal - Journal object with entries
 * @param {string} characterName - Name of the character
 * @returns {string} Markdown formatted journal
 */
export function exportJournalAsMarkdown(journal, characterName) {
    if (!journal || !journal.entries || journal.entries.length === 0) {
        return `# ${characterName}'s Journal\n\n*No entries yet...*\n`;
    }

    let markdown = `# ${characterName}'s Journal\n\n`;
    markdown += `> *A personal diary documenting adventures and experiences*\n\n`;
    markdown += `---\n\n`;

    // Sort entries by timestamp (oldest first for reading order)
    const sortedEntries = [...journal.entries].sort((a, b) => a.timestamp - b.timestamp);

    for (const entry of sortedEntries) {
        const date = new Date(entry.timestamp);
        const dateStr = date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        const timeStr = date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });

        // Entry header with day number and date
        markdown += `## Day ${entry.day || '?'}\n`;
        markdown += `*${dateStr} at ${timeStr}*\n\n`;

        // Mood indicator if available
        if (entry.mood && entry.mood !== 'neutral') {
            const moodEmoji = getMoodEmoji(entry.mood);
            markdown += `**Mood:** ${moodEmoji} ${capitalizeFirst(entry.mood)}\n\n`;
        }

        // Entry content
        markdown += `${entry.content}\n\n`;

        // Topics/tags if available
        if (entry.topics && entry.topics.length > 0) {
            markdown += `*Topics: ${entry.topics.join(', ')}*\n\n`;
        }

        markdown += `---\n\n`;
    }

    // Footer with export info
    markdown += `\n*Exported on ${new Date().toLocaleDateString()}*\n`;
    markdown += `*Total entries: ${journal.entries.length}*\n`;

    return markdown;
}

/**
 * Exports a journal in a PDF-ready format (HTML that can be printed to PDF)
 * @param {Object} journal - Journal object with entries
 * @param {string} characterName - Name of the character
 * @returns {string} HTML content ready for PDF printing
 */
export function exportJournalAsPDF(journal, characterName) {
    if (!journal || !journal.entries || journal.entries.length === 0) {
        return generatePDFTemplate(characterName, '<p class="empty">No entries yet...</p>');
    }

    // Sort entries by timestamp (oldest first)
    const sortedEntries = [...journal.entries].sort((a, b) => a.timestamp - b.timestamp);

    let entriesHtml = '';

    for (const entry of sortedEntries) {
        const date = new Date(entry.timestamp);
        const dateStr = date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const moodEmoji = entry.mood ? getMoodEmoji(entry.mood) : '';
        const moodText = entry.mood ? capitalizeFirst(entry.mood) : '';

        entriesHtml += `
            <div class="journal-entry">
                <div class="entry-header">
                    <h2>Day ${entry.day || '?'}</h2>
                    <span class="entry-date">${dateStr}</span>
                </div>
                ${entry.mood && entry.mood !== 'neutral' ? `<div class="entry-mood">${moodEmoji} ${moodText}</div>` : ''}
                <div class="entry-content">${escapeHtml(entry.content)}</div>
                ${entry.topics && entry.topics.length > 0 ? `<div class="entry-topics">Topics: ${entry.topics.join(', ')}</div>` : ''}
            </div>
        `;
    }

    return generatePDFTemplate(characterName, entriesHtml);
}

/**
 * Generates the PDF HTML template
 * @param {string} characterName - Character name for title
 * @param {string} content - Inner content HTML
 * @returns {string} Complete HTML document
 */
function generatePDFTemplate(characterName, content) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(characterName)}'s Journal</title>
    <style>
        @page {
            margin: 1in;
            size: letter;
        }

        body {
            font-family: 'Georgia', 'Times New Roman', serif;
            line-height: 1.6;
            color: #333;
            background: #faf8f3;
            padding: 2rem;
        }

        .journal-title {
            text-align: center;
            font-size: 2rem;
            color: #4a3728;
            border-bottom: 2px solid #8b7355;
            padding-bottom: 1rem;
            margin-bottom: 2rem;
        }

        .journal-subtitle {
            text-align: center;
            font-style: italic;
            color: #666;
            margin-bottom: 2rem;
        }

        .journal-entry {
            background: #fff;
            border: 1px solid #d4c4a8;
            border-radius: 4px;
            padding: 1.5rem;
            margin-bottom: 1.5rem;
            page-break-inside: avoid;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .entry-header {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            border-bottom: 1px solid #e8e0d0;
            padding-bottom: 0.5rem;
            margin-bottom: 1rem;
        }

        .entry-header h2 {
            margin: 0;
            color: #5c4a3a;
            font-size: 1.3rem;
        }

        .entry-date {
            color: #888;
            font-style: italic;
            font-size: 0.9rem;
        }

        .entry-mood {
            background: #f5f0e8;
            padding: 0.25rem 0.75rem;
            border-radius: 1rem;
            display: inline-block;
            margin-bottom: 1rem;
            font-size: 0.9rem;
        }

        .entry-content {
            white-space: pre-wrap;
            text-align: justify;
        }

        .entry-topics {
            margin-top: 1rem;
            color: #888;
            font-size: 0.85rem;
            font-style: italic;
        }

        .empty {
            text-align: center;
            color: #888;
            font-style: italic;
            padding: 2rem;
        }

        .footer {
            text-align: center;
            margin-top: 2rem;
            color: #888;
            font-size: 0.85rem;
        }

        @media print {
            body {
                background: white;
                padding: 0;
            }

            .journal-entry {
                box-shadow: none;
                border: 1px solid #ccc;
            }
        }
    </style>
</head>
<body>
    <h1 class="journal-title">${escapeHtml(characterName)}'s Journal</h1>
    <p class="journal-subtitle">A personal diary documenting adventures and experiences</p>
    ${content}
    <div class="footer">
        <p>Exported on ${new Date().toLocaleDateString()}</p>
    </div>
</body>
</html>`;
}

/**
 * Gets an emoji for a mood
 * @param {string} mood - Mood string
 * @returns {string} Emoji representing the mood
 */
function getMoodEmoji(mood) {
    const moodEmojis = {
        'happy': '😊',
        'excited': '😄',
        'joyful': '😁',
        'content': '😌',
        'peaceful': '😇',
        'hopeful': '🌟',
        'curious': '🤔',
        'thoughtful': '💭',
        'neutral': '😐',
        'tired': '😴',
        'worried': '😟',
        'anxious': '😰',
        'sad': '😢',
        'melancholy': '😔',
        'angry': '😠',
        'frustrated': '😤',
        'scared': '😨',
        'confused': '😕',
        'nostalgic': '🥹',
        'loving': '🥰',
        'grateful': '🙏',
        'proud': '😤',
        'embarrassed': '😳',
        'surprised': '😲',
        'playful': '😜',
        'mischievous': '😈',
        'determined': '💪',
        'conflicted': '😣'
    };

    return moodEmojis[mood.toLowerCase()] || '📝';
}

/**
 * Capitalizes the first letter of a string
 * @param {string} str - String to capitalize
 * @returns {string} Capitalized string
 */
function capitalizeFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Escapes HTML special characters
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
