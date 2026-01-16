/**
 * Journal UI Module
 * Beautiful interface for viewing and managing companion journals
 */

import { extensionSettings } from '../../../core/state.js';
import { getJournalManager, getAllJournalManagers } from './journalManager.js';
import { generateJournalEntry, triggerJournalGeneration } from './journalGenerator.js';
import { exportJournalAsMarkdown, exportJournalAsPDF } from './journalStorage.js';

// Modal state
let currentJournalModal = null;
let currentCharacterId = null;
let currentEntryIndex = 0;

/**
 * Gets the mood emoji for display
 * @param {string} mood - Mood string
 * @returns {string} Emoji for the mood
 */
function getMoodEmoji(mood) {
    const moodEmojis = {
        'happy': '\u{1F60A}',      // smiling face with smiling eyes
        'excited': '\u{1F604}',    // grinning face with smiling eyes
        'joyful': '\u{1F601}',     // beaming face with smiling eyes
        'content': '\u{1F60C}',    // relieved face
        'peaceful': '\u{1F607}',   // smiling face with halo
        'hopeful': '\u{1F31F}',    // glowing star
        'curious': '\u{1F914}',    // thinking face
        'thoughtful': '\u{1F4AD}', // thought balloon
        'neutral': '\u{1F610}',    // neutral face
        'tired': '\u{1F634}',      // sleeping face
        'worried': '\u{1F61F}',    // worried face
        'anxious': '\u{1F630}',    // anxious face with sweat
        'sad': '\u{1F622}',        // crying face
        'melancholy': '\u{1F614}', // pensive face
        'angry': '\u{1F620}',      // angry face
        'frustrated': '\u{1F624}', // face with steam from nose
        'scared': '\u{1F628}',     // fearful face
        'confused': '\u{1F615}',   // confused face
        'nostalgic': '\u{1F979}',  // face holding back tears
        'loving': '\u{1F970}',     // smiling face with hearts
        'grateful': '\u{1F64F}',   // folded hands
        'proud': '\u{1F60E}',      // smiling face with sunglasses
        'embarrassed': '\u{1F633}',// flushed face
        'surprised': '\u{1F632}',  // astonished face
        'playful': '\u{1F61C}',    // winking face with tongue
        'mischievous': '\u{1F608}',// smiling face with horns
        'determined': '\u{1F4AA}', // flexed biceps
        'conflicted': '\u{1F623}'  // persevering face
    };

    return moodEmojis[mood?.toLowerCase()] || '\u{1F4DD}'; // memo default
}

/**
 * Formats a date for display
 * @param {number} timestamp - Unix timestamp
 * @returns {string} Formatted date string
 */
function formatDate(timestamp) {
    return new Date(timestamp).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

/**
 * Formats time for display
 * @param {number} timestamp - Unix timestamp
 * @returns {string} Formatted time string
 */
function formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    });
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
 * Renders a single journal entry
 * @param {Object} entry - Journal entry object
 * @returns {string} HTML for the entry
 */
export function renderJournalEntry(entry) {
    if (!entry) {
        return `
            <div class="rpg-journal-entry rpg-journal-empty">
                <p class="rpg-journal-empty-text">No entries yet...</p>
                <p class="rpg-journal-empty-hint">Click "Generate Entry" to create the first diary entry.</p>
            </div>
        `;
    }

    const moodEmoji = getMoodEmoji(entry.mood);
    const moodText = entry.mood ? capitalizeFirst(entry.mood) : 'Unknown';

    return `
        <div class="rpg-journal-entry" data-entry-id="${entry.id}">
            <div class="rpg-journal-entry-date">
                <span class="rpg-journal-date-text">${formatDate(entry.timestamp)}</span>
                <span class="rpg-journal-time-text">${formatTime(entry.timestamp)}</span>
            </div>
            <div class="rpg-journal-entry-mood">
                <span class="rpg-journal-mood-emoji">${moodEmoji}</span>
                <span class="rpg-journal-mood-text">${moodText}</span>
            </div>
            <div class="rpg-journal-entry-content">
                ${escapeHtml(entry.content)}
            </div>
            ${entry.topics && entry.topics.length > 0 ? `
                <div class="rpg-journal-entry-topics">
                    ${entry.topics.map(t => `<span class="rpg-journal-topic">${escapeHtml(t)}</span>`).join('')}
                </div>
            ` : ''}
            ${entry.location ? `
                <div class="rpg-journal-entry-location">
                    <i class="fa-solid fa-location-dot"></i> ${escapeHtml(entry.location)}
                </div>
            ` : ''}
        </div>
    `;
}

/**
 * Creates the journal modal HTML
 * @param {string} characterId - Character identifier
 * @returns {string} Modal HTML
 */
export function createJournalModal(characterId) {
    const journal = getJournalManager(characterId);
    const entries = journal.entries;
    const stats = journal.getStats();

    // Get current entry
    const currentEntry = entries.length > 0
        ? entries[Math.min(currentEntryIndex, entries.length - 1)]
        : null;

    // Get theme
    const theme = extensionSettings.theme || 'default';

    const html = `
        <div id="rpg-journal-modal" class="rpg-journal-modal" data-theme="${theme}" data-character="${characterId}">
            <div class="rpg-journal-backdrop"></div>
            <div class="rpg-journal-container">
                <div class="rpg-journal-header">
                    <div class="rpg-journal-title">
                        <i class="fa-solid fa-book"></i>
                        <span>${escapeHtml(journal.characterName)}'s Journal</span>
                    </div>
                    <button class="rpg-journal-close" title="Close">
                        <i class="fa-solid fa-times"></i>
                    </button>
                </div>

                <div class="rpg-journal-stats-bar">
                    <span class="rpg-journal-stat">
                        <i class="fa-solid fa-scroll"></i>
                        ${stats.totalEntries} entries
                    </span>
                    <span class="rpg-journal-stat">
                        <i class="fa-solid fa-calendar-day"></i>
                        Day ${journal.currentDay}
                    </span>
                    ${stats.mostCommonMood ? `
                        <span class="rpg-journal-stat">
                            <span class="rpg-journal-stat-emoji">${getMoodEmoji(stats.mostCommonMood)}</span>
                            Usually ${stats.mostCommonMood}
                        </span>
                    ` : ''}
                </div>

                <div class="rpg-journal-nav">
                    <button class="rpg-journal-nav-btn rpg-journal-prev" ${currentEntryIndex <= 0 ? 'disabled' : ''}>
                        <i class="fa-solid fa-chevron-left"></i>
                    </button>
                    <span class="rpg-journal-nav-info">
                        ${entries.length > 0 ? `Entry ${currentEntryIndex + 1} of ${entries.length}` : 'No entries'}
                    </span>
                    <button class="rpg-journal-nav-btn rpg-journal-next" ${currentEntryIndex >= entries.length - 1 ? 'disabled' : ''}>
                        <i class="fa-solid fa-chevron-right"></i>
                    </button>
                </div>

                <div class="rpg-journal-content">
                    ${renderJournalEntry(currentEntry)}
                </div>

                <div class="rpg-journal-footer">
                    <button class="rpg-journal-btn rpg-journal-generate" title="Generate new entry">
                        <i class="fa-solid fa-wand-magic-sparkles"></i>
                        <span>Generate Entry</span>
                    </button>
                    <div class="rpg-journal-export-group">
                        <button class="rpg-journal-btn rpg-journal-export-md" title="Export as Markdown">
                            <i class="fa-solid fa-file-lines"></i>
                            <span>Export MD</span>
                        </button>
                        <button class="rpg-journal-btn rpg-journal-export-pdf" title="Export as PDF">
                            <i class="fa-solid fa-file-pdf"></i>
                            <span>Export PDF</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    return html;
}

/**
 * Opens the journal modal for a character
 * @param {string} characterId - Character identifier
 * @param {string} characterName - Character display name (optional)
 */
export function openJournalModal(characterId, characterName = null) {
    // Close any existing modal
    closeJournalModal();

    // Reset entry index
    currentEntryIndex = 0;
    currentCharacterId = characterId;

    // Ensure journal manager exists
    const journal = getJournalManager(characterId, characterName || characterId);

    // Set to latest entry
    if (journal.entries.length > 0) {
        currentEntryIndex = journal.entries.length - 1;
    }

    // Create and append modal
    const modalHtml = createJournalModal(characterId);
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    currentJournalModal = document.getElementById('rpg-journal-modal');

    // Apply custom theme if needed
    if (extensionSettings.theme === 'custom' && extensionSettings.customColors) {
        const container = currentJournalModal.querySelector('.rpg-journal-container');
        if (container) {
            container.style.setProperty('--rpg-bg', extensionSettings.customColors.bg);
            container.style.setProperty('--rpg-accent', extensionSettings.customColors.accent);
            container.style.setProperty('--rpg-text', extensionSettings.customColors.text);
            container.style.setProperty('--rpg-highlight', extensionSettings.customColors.highlight);
        }
    }

    // Show modal with animation
    requestAnimationFrame(() => {
        currentJournalModal.classList.add('is-open');
    });

    // Attach event listeners
    attachJournalEventListeners();
}

/**
 * Closes the journal modal
 */
export function closeJournalModal() {
    if (!currentJournalModal) return;

    currentJournalModal.classList.add('is-closing');
    currentJournalModal.classList.remove('is-open');

    setTimeout(() => {
        if (currentJournalModal && currentJournalModal.parentNode) {
            currentJournalModal.parentNode.removeChild(currentJournalModal);
        }
        currentJournalModal = null;
        currentCharacterId = null;
    }, 200);
}

/**
 * Updates the journal modal content
 */
function updateJournalModal() {
    if (!currentJournalModal || !currentCharacterId) return;

    const journal = getJournalManager(currentCharacterId);
    const entries = journal.entries;
    const currentEntry = entries.length > 0
        ? entries[Math.min(currentEntryIndex, entries.length - 1)]
        : null;

    // Update navigation
    const navInfo = currentJournalModal.querySelector('.rpg-journal-nav-info');
    if (navInfo) {
        navInfo.textContent = entries.length > 0
            ? `Entry ${currentEntryIndex + 1} of ${entries.length}`
            : 'No entries';
    }

    // Update prev/next buttons
    const prevBtn = currentJournalModal.querySelector('.rpg-journal-prev');
    const nextBtn = currentJournalModal.querySelector('.rpg-journal-next');
    if (prevBtn) prevBtn.disabled = currentEntryIndex <= 0;
    if (nextBtn) nextBtn.disabled = currentEntryIndex >= entries.length - 1;

    // Update content
    const content = currentJournalModal.querySelector('.rpg-journal-content');
    if (content) {
        content.innerHTML = renderJournalEntry(currentEntry);
    }

    // Update stats
    const stats = journal.getStats();
    const statsBar = currentJournalModal.querySelector('.rpg-journal-stats-bar');
    if (statsBar) {
        statsBar.innerHTML = `
            <span class="rpg-journal-stat">
                <i class="fa-solid fa-scroll"></i>
                ${stats.totalEntries} entries
            </span>
            <span class="rpg-journal-stat">
                <i class="fa-solid fa-calendar-day"></i>
                Day ${journal.currentDay}
            </span>
            ${stats.mostCommonMood ? `
                <span class="rpg-journal-stat">
                    <span class="rpg-journal-stat-emoji">${getMoodEmoji(stats.mostCommonMood)}</span>
                    Usually ${stats.mostCommonMood}
                </span>
            ` : ''}
        `;
    }
}

/**
 * Attaches event listeners to the journal modal
 */
function attachJournalEventListeners() {
    if (!currentJournalModal) return;

    // Close button
    const closeBtn = currentJournalModal.querySelector('.rpg-journal-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeJournalModal);
    }

    // Backdrop click
    const backdrop = currentJournalModal.querySelector('.rpg-journal-backdrop');
    if (backdrop) {
        backdrop.addEventListener('click', closeJournalModal);
    }

    // Navigation
    const prevBtn = currentJournalModal.querySelector('.rpg-journal-prev');
    const nextBtn = currentJournalModal.querySelector('.rpg-journal-next');

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentEntryIndex > 0) {
                currentEntryIndex--;
                updateJournalModal();
            }
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            const journal = getJournalManager(currentCharacterId);
            if (currentEntryIndex < journal.entries.length - 1) {
                currentEntryIndex++;
                updateJournalModal();
            }
        });
    }

    // Generate button
    const generateBtn = currentJournalModal.querySelector('.rpg-journal-generate');
    if (generateBtn) {
        generateBtn.addEventListener('click', async () => {
            await handleGenerateEntry();
        });
    }

    // Export Markdown
    const exportMdBtn = currentJournalModal.querySelector('.rpg-journal-export-md');
    if (exportMdBtn) {
        exportMdBtn.addEventListener('click', () => {
            handleExportMarkdown();
        });
    }

    // Export PDF
    const exportPdfBtn = currentJournalModal.querySelector('.rpg-journal-export-pdf');
    if (exportPdfBtn) {
        exportPdfBtn.addEventListener('click', () => {
            handleExportPDF();
        });
    }

    // Keyboard navigation
    document.addEventListener('keydown', handleKeyboardNav);
}

/**
 * Handles keyboard navigation
 * @param {KeyboardEvent} e - Keyboard event
 */
function handleKeyboardNav(e) {
    if (!currentJournalModal) return;

    if (e.key === 'Escape') {
        closeJournalModal();
        document.removeEventListener('keydown', handleKeyboardNav);
    } else if (e.key === 'ArrowLeft') {
        if (currentEntryIndex > 0) {
            currentEntryIndex--;
            updateJournalModal();
        }
    } else if (e.key === 'ArrowRight') {
        const journal = getJournalManager(currentCharacterId);
        if (currentEntryIndex < journal.entries.length - 1) {
            currentEntryIndex++;
            updateJournalModal();
        }
    }
}

/**
 * Handles generate entry button click
 */
async function handleGenerateEntry() {
    if (!currentCharacterId) return;

    const generateBtn = currentJournalModal?.querySelector('.rpg-journal-generate');
    if (generateBtn) {
        generateBtn.disabled = true;
        generateBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Generating...</span>';
    }

    try {
        const journal = getJournalManager(currentCharacterId);
        const entry = await triggerJournalGeneration(currentCharacterId, 'manual', {
            characterName: journal.characterName,
            forceGenerate: true
        });

        if (entry) {
            // Jump to new entry
            currentEntryIndex = journal.entries.length - 1;
            updateJournalModal();

            // Show success notification
            if (window.toastr) {
                toastr.success(`New journal entry created for ${journal.characterName}!`);
            }
        } else {
            if (window.toastr) {
                toastr.warning('Could not generate entry. Rate limit may have been reached.');
            }
        }
    } catch (error) {
        console.error('[RPG Journal] Error generating entry:', error);
        if (window.toastr) {
            toastr.error('Failed to generate journal entry. Check console for details.');
        }
    } finally {
        if (generateBtn) {
            generateBtn.disabled = false;
            generateBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> <span>Generate Entry</span>';
        }
    }
}

/**
 * Handles export to Markdown
 */
function handleExportMarkdown() {
    if (!currentCharacterId) return;

    const journal = getJournalManager(currentCharacterId);
    const markdown = exportJournalAsMarkdown(journal.toJSON(), journal.characterName);

    // Create download
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${journal.characterName.replace(/\s+/g, '_')}_Journal.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    if (window.toastr) {
        toastr.success('Journal exported as Markdown!');
    }
}

/**
 * Handles export to PDF
 */
function handleExportPDF() {
    if (!currentCharacterId) return;

    const journal = getJournalManager(currentCharacterId);
    const html = exportJournalAsPDF(journal.toJSON(), journal.characterName);

    // Open in new window for printing
    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();

        // Trigger print dialog
        setTimeout(() => {
            printWindow.print();
        }, 500);

        if (window.toastr) {
            toastr.success('PDF print dialog opened!');
        }
    } else {
        if (window.toastr) {
            toastr.error('Could not open print window. Check popup blocker settings.');
        }
    }
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

/**
 * Creates a journal button for a character panel
 * @param {string} characterId - Character identifier
 * @param {string} characterName - Character display name
 * @returns {string} Button HTML
 */
export function createJournalButton(characterId, characterName) {
    return `
        <button class="rpg-journal-btn-small"
                data-character-id="${characterId}"
                data-character-name="${escapeHtml(characterName)}"
                title="View ${escapeHtml(characterName)}'s Journal">
            <i class="fa-solid fa-book-open"></i>
        </button>
    `;
}

/**
 * Initializes journal UI event listeners
 * Call this once during extension initialization
 */
export function initJournalUI() {
    // Delegate journal button clicks
    document.addEventListener('click', (e) => {
        const journalBtn = e.target.closest('.rpg-journal-btn-small');
        if (journalBtn) {
            const characterId = journalBtn.dataset.characterId;
            const characterName = journalBtn.dataset.characterName;
            if (characterId) {
                openJournalModal(characterId, characterName);
            }
        }
    });

    // console.log('[RPG Journal] Journal UI initialized');
}
