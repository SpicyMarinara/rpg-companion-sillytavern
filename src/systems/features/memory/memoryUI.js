/**
 * Memory UI Module
 * Provides visualization and management UI for character memories
 */

import { getMemoryManager } from './memoryManager.js';
import { MEMORY_TYPES, IMPORTANCE_LEVELS } from './memoryTypes.js';
import { summarizeMemories } from './memoryInjector.js';

/**
 * CSS styles for memory UI components
 */
const MEMORY_UI_STYLES = `
.rpg-memory-panel {
    background: var(--SmartThemeBlurTintColor, rgba(20, 20, 30, 0.9));
    border-radius: 8px;
    padding: 12px;
    margin: 8px 0;
    max-height: 400px;
    overflow-y: auto;
}

.rpg-memory-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--SmartThemeBorderColor, #444);
}

.rpg-memory-header h3 {
    margin: 0;
    font-size: 14px;
    color: var(--SmartThemeBodyColor, #eee);
}

.rpg-memory-stats {
    font-size: 11px;
    color: var(--SmartThemeQuoteColor, #aaa);
}

.rpg-memory-controls {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
}

.rpg-memory-controls button {
    padding: 4px 8px;
    font-size: 11px;
    border-radius: 4px;
    border: 1px solid var(--SmartThemeBorderColor, #444);
    background: var(--SmartThemeBlurTintColor, rgba(30, 30, 40, 0.8));
    color: var(--SmartThemeBodyColor, #eee);
    cursor: pointer;
    transition: background 0.2s;
}

.rpg-memory-controls button:hover {
    background: var(--SmartThemeEmColor, #4a90d9);
}

.rpg-memory-search {
    width: 100%;
    padding: 8px;
    margin-bottom: 12px;
    border-radius: 4px;
    border: 1px solid var(--SmartThemeBorderColor, #444);
    background: var(--SmartThemeBlurTintColor, rgba(30, 30, 40, 0.8));
    color: var(--SmartThemeBodyColor, #eee);
    font-size: 12px;
}

.rpg-memory-search::placeholder {
    color: var(--SmartThemeQuoteColor, #888);
}

.rpg-memory-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.rpg-memory-item {
    background: var(--SmartThemeBlurTintColor, rgba(40, 40, 50, 0.8));
    border-radius: 6px;
    padding: 10px;
    border-left: 3px solid var(--SmartThemeEmColor, #4a90d9);
    transition: transform 0.2s, box-shadow 0.2s;
}

.rpg-memory-item:hover {
    transform: translateX(2px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.rpg-memory-item.type-fact { border-left-color: #4a90d9; }
.rpg-memory-item.type-emotion { border-left-color: #d94a7a; }
.rpg-memory-item.type-event { border-left-color: #4ad97a; }
.rpg-memory-item.type-relationship { border-left-color: #d9a74a; }
.rpg-memory-item.type-preference { border-left-color: #a74ad9; }
.rpg-memory-item.type-character { border-left-color: #4ad9d9; }
.rpg-memory-item.type-location { border-left-color: #7ad94a; }
.rpg-memory-item.type-quest { border-left-color: #d94ad9; }

.rpg-memory-content {
    font-size: 12px;
    color: var(--SmartThemeBodyColor, #eee);
    margin-bottom: 6px;
    line-height: 1.4;
}

.rpg-memory-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 10px;
    color: var(--SmartThemeQuoteColor, #888);
}

.rpg-memory-tags {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
}

.rpg-memory-tag {
    background: var(--SmartThemeEmColor, #4a90d9);
    color: white;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 9px;
    text-transform: uppercase;
}

.rpg-memory-importance {
    display: flex;
    align-items: center;
    gap: 4px;
}

.rpg-memory-importance-bar {
    width: 50px;
    height: 4px;
    background: var(--SmartThemeBorderColor, #444);
    border-radius: 2px;
    overflow: hidden;
}

.rpg-memory-importance-fill {
    height: 100%;
    background: linear-gradient(90deg, #4a90d9, #4ad97a);
    transition: width 0.3s;
}

.rpg-memory-actions {
    display: flex;
    gap: 4px;
    margin-top: 6px;
}

.rpg-memory-actions button {
    padding: 2px 6px;
    font-size: 10px;
    border-radius: 3px;
    border: none;
    cursor: pointer;
    opacity: 0.7;
    transition: opacity 0.2s;
}

.rpg-memory-actions button:hover {
    opacity: 1;
}

.rpg-memory-actions .edit-btn { background: #4a90d9; color: white; }
.rpg-memory-actions .delete-btn { background: #d94a4a; color: white; }
.rpg-memory-actions .boost-btn { background: #4ad97a; color: white; }

.rpg-memory-empty {
    text-align: center;
    padding: 20px;
    color: var(--SmartThemeQuoteColor, #888);
    font-style: italic;
}

.rpg-memory-add-form {
    background: var(--SmartThemeBlurTintColor, rgba(30, 30, 40, 0.8));
    border-radius: 6px;
    padding: 12px;
    margin-top: 12px;
}

.rpg-memory-add-form textarea {
    width: 100%;
    min-height: 60px;
    padding: 8px;
    margin-bottom: 8px;
    border-radius: 4px;
    border: 1px solid var(--SmartThemeBorderColor, #444);
    background: var(--SmartThemeBlurTintColor, rgba(20, 20, 30, 0.9));
    color: var(--SmartThemeBodyColor, #eee);
    font-size: 12px;
    resize: vertical;
}

.rpg-memory-add-form select {
    padding: 4px 8px;
    border-radius: 4px;
    border: 1px solid var(--SmartThemeBorderColor, #444);
    background: var(--SmartThemeBlurTintColor, rgba(30, 30, 40, 0.8));
    color: var(--SmartThemeBodyColor, #eee);
    font-size: 11px;
    margin-right: 8px;
}

.rpg-memory-add-form .form-row {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-bottom: 8px;
}

.rpg-memory-score {
    background: var(--SmartThemeEmColor, #4a90d9);
    color: white;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 10px;
    font-weight: bold;
}
`;

/**
 * Inject CSS styles into the document
 */
function injectStyles() {
    if (document.getElementById('rpg-memory-styles')) return;

    const styleEl = document.createElement('style');
    styleEl.id = 'rpg-memory-styles';
    styleEl.textContent = MEMORY_UI_STYLES;
    document.head.appendChild(styleEl);
}

/**
 * Format relative time for display
 * @param {number} timestamp - Unix timestamp
 * @returns {string}
 */
function formatTime(timestamp) {
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
 * Create a memory item element
 * @param {Object} memory - Memory object
 * @param {Object} callbacks - Callback functions
 * @returns {HTMLElement}
 */
function createMemoryItem(memory, callbacks = {}) {
    const item = document.createElement('div');
    item.className = `rpg-memory-item type-${memory.metadata?.type || 'unknown'}`;
    item.dataset.memoryId = memory.id;

    const importance = memory.metadata?.importance || 5;
    const importancePercent = (importance / 10) * 100;

    item.innerHTML = `
        <div class="rpg-memory-content">${escapeHtml(memory.content)}</div>
        <div class="rpg-memory-meta">
            <div class="rpg-memory-tags">
                <span class="rpg-memory-tag">${memory.metadata?.type || 'memory'}</span>
                ${memory.score !== undefined ? `<span class="rpg-memory-score">${(memory.score * 100).toFixed(0)}% match</span>` : ''}
            </div>
            <div class="rpg-memory-importance">
                <span>${formatTime(memory.timestamp)}</span>
                <div class="rpg-memory-importance-bar">
                    <div class="rpg-memory-importance-fill" style="width: ${importancePercent}%"></div>
                </div>
            </div>
        </div>
        <div class="rpg-memory-actions">
            <button class="boost-btn" title="Increase importance">+</button>
            <button class="edit-btn" title="Edit memory">Edit</button>
            <button class="delete-btn" title="Delete memory">Delete</button>
        </div>
    `;

    // Add event listeners
    item.querySelector('.delete-btn').addEventListener('click', () => {
        if (callbacks.onDelete) callbacks.onDelete(memory.id);
    });

    item.querySelector('.edit-btn').addEventListener('click', () => {
        if (callbacks.onEdit) callbacks.onEdit(memory);
    });

    item.querySelector('.boost-btn').addEventListener('click', () => {
        if (callbacks.onBoost) callbacks.onBoost(memory.id);
    });

    return item;
}

/**
 * Escape HTML special characters
 * @param {string} text - Text to escape
 * @returns {string}
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Create the add memory form
 * @param {Function} onAdd - Callback when memory is added
 * @returns {HTMLElement}
 */
function createAddForm(onAdd) {
    const form = document.createElement('div');
    form.className = 'rpg-memory-add-form';

    form.innerHTML = `
        <textarea placeholder="Enter a new memory..."></textarea>
        <div class="form-row">
            <select class="type-select">
                ${Object.entries(MEMORY_TYPES).map(([key, value]) =>
                    `<option value="${value}">${key.charAt(0) + key.slice(1).toLowerCase()}</option>`
                ).join('')}
            </select>
            <select class="importance-select">
                ${Object.entries(IMPORTANCE_LEVELS).map(([key, value]) =>
                    `<option value="${value}" ${value === 5 ? 'selected' : ''}>${key.charAt(0) + key.slice(1).toLowerCase()} (${value})</option>`
                ).join('')}
            </select>
            <button class="add-btn">Add Memory</button>
        </div>
    `;

    const textarea = form.querySelector('textarea');
    const typeSelect = form.querySelector('.type-select');
    const importanceSelect = form.querySelector('.importance-select');
    const addBtn = form.querySelector('.add-btn');

    addBtn.addEventListener('click', () => {
        const content = textarea.value.trim();
        if (!content) return;

        onAdd({
            content,
            type: typeSelect.value,
            importance: parseInt(importanceSelect.value, 10)
        });

        textarea.value = '';
    });

    return form;
}

/**
 * Memory Panel UI Component
 */
export class MemoryPanel {
    /**
     * @param {string} characterId - Character identifier
     * @param {HTMLElement} container - Container element
     */
    constructor(characterId, container) {
        this.characterId = characterId;
        this.container = container;
        this.manager = getMemoryManager(characterId);
        this.searchQuery = '';
        this.currentMemories = [];

        injectStyles();
        this.render();
    }

    /**
     * Render the panel
     */
    async render() {
        const stats = await this.manager.getStats();

        this.container.innerHTML = `
            <div class="rpg-memory-panel">
                <div class="rpg-memory-header">
                    <h3>Character Memories</h3>
                    <span class="rpg-memory-stats">${stats.totalCount} memories</span>
                </div>
                <div class="rpg-memory-controls">
                    <button class="consolidate-btn" title="Merge similar memories">Consolidate</button>
                    <button class="decay-btn" title="Apply importance decay">Apply Decay</button>
                    <button class="export-btn" title="Export memories">Export</button>
                    <button class="import-btn" title="Import memories">Import</button>
                    <button class="clear-btn" title="Clear all memories">Clear All</button>
                </div>
                <input type="text" class="rpg-memory-search" placeholder="Search memories...">
                <div class="rpg-memory-list"></div>
            </div>
        `;

        // Add form
        const addForm = createAddForm((data) => this.addMemory(data));
        this.container.querySelector('.rpg-memory-panel').appendChild(addForm);

        // Bind events
        this.bindEvents();

        // Load memories
        await this.loadMemories();
    }

    /**
     * Bind event listeners
     */
    bindEvents() {
        const panel = this.container.querySelector('.rpg-memory-panel');

        // Search
        panel.querySelector('.rpg-memory-search').addEventListener('input', (e) => {
            this.searchQuery = e.target.value;
            this.loadMemories();
        });

        // Controls
        panel.querySelector('.consolidate-btn').addEventListener('click', () => this.consolidate());
        panel.querySelector('.decay-btn').addEventListener('click', () => this.applyDecay());
        panel.querySelector('.export-btn').addEventListener('click', () => this.exportMemories());
        panel.querySelector('.import-btn').addEventListener('click', () => this.importMemories());
        panel.querySelector('.clear-btn').addEventListener('click', () => this.clearAll());
    }

    /**
     * Load and display memories
     */
    async loadMemories() {
        const list = this.container.querySelector('.rpg-memory-list');

        try {
            let memories;

            if (this.searchQuery.trim()) {
                // Search mode
                memories = await this.manager.recall(this.searchQuery, 20);
            } else {
                // Show recent memories
                memories = await this.manager.getRecentMemories(168, 20); // Last week
            }

            this.currentMemories = memories;

            if (memories.length === 0) {
                list.innerHTML = '<div class="rpg-memory-empty">No memories found</div>';
                return;
            }

            list.innerHTML = '';
            for (const memory of memories) {
                const item = createMemoryItem(memory, {
                    onDelete: (id) => this.deleteMemory(id),
                    onEdit: (mem) => this.editMemory(mem),
                    onBoost: (id) => this.boostImportance(id)
                });
                list.appendChild(item);
            }
        } catch (error) {
            console.error('[Memory UI] Error loading memories:', error);
            list.innerHTML = '<div class="rpg-memory-empty">Error loading memories</div>';
        }
    }

    /**
     * Add a new memory
     */
    async addMemory(data) {
        try {
            await this.manager.addMemory(data.content, {
                type: data.type,
                importance: data.importance
            });
            await this.loadMemories();
            this.updateStats();
        } catch (error) {
            console.error('[Memory UI] Error adding memory:', error);
            alert('Failed to add memory: ' + error.message);
        }
    }

    /**
     * Delete a memory
     */
    async deleteMemory(id) {
        if (!confirm('Are you sure you want to delete this memory?')) return;

        try {
            await this.manager.deleteMemory(id);
            await this.loadMemories();
            this.updateStats();
        } catch (error) {
            console.error('[Memory UI] Error deleting memory:', error);
        }
    }

    /**
     * Edit a memory
     */
    async editMemory(memory) {
        const newContent = prompt('Edit memory content:', memory.content);
        if (newContent === null || newContent === memory.content) return;

        try {
            // Delete old and create new (simplest approach for now)
            await this.manager.deleteMemory(memory.id);
            await this.manager.addMemory(newContent, memory.metadata);
            await this.loadMemories();
        } catch (error) {
            console.error('[Memory UI] Error editing memory:', error);
        }
    }

    /**
     * Boost memory importance
     */
    async boostImportance(id) {
        try {
            const memory = this.currentMemories.find(m => m.id === id);
            if (!memory) return;

            const currentImportance = memory.metadata?.importance || 5;
            const newImportance = Math.min(10, currentImportance + 1);

            await this.manager.vectorStore.update(id, {
                metadata: {
                    ...memory.metadata,
                    importance: newImportance
                }
            });

            await this.loadMemories();
        } catch (error) {
            console.error('[Memory UI] Error boosting importance:', error);
        }
    }

    /**
     * Consolidate similar memories
     */
    async consolidate() {
        if (!confirm('This will merge similar memories. Continue?')) return;

        try {
            const result = await this.manager.consolidate();
            alert(`Consolidated ${result.merged} memories. ${result.remaining} remaining.`);
            await this.loadMemories();
            this.updateStats();
        } catch (error) {
            console.error('[Memory UI] Error consolidating:', error);
            alert('Failed to consolidate: ' + error.message);
        }
    }

    /**
     * Apply decay to old memories
     */
    async applyDecay() {
        if (!confirm('This will reduce importance of old, unused memories. Continue?')) return;

        try {
            const result = await this.manager.applyDecay();
            alert(`Decayed ${result.decayed} memories, removed ${result.removed}.`);
            await this.loadMemories();
            this.updateStats();
        } catch (error) {
            console.error('[Memory UI] Error applying decay:', error);
            alert('Failed to apply decay: ' + error.message);
        }
    }

    /**
     * Export memories to file
     */
    async exportMemories() {
        try {
            const data = await this.manager.export();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = `memories-${this.characterId}-${Date.now()}.json`;
            a.click();

            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('[Memory UI] Error exporting:', error);
            alert('Failed to export: ' + error.message);
        }
    }

    /**
     * Import memories from file
     */
    async importMemories() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';

        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const text = await file.text();
                const data = JSON.parse(text);

                const merge = confirm('Merge with existing memories? (Cancel to replace)');
                const result = await this.manager.import(data, merge);

                alert(`Imported ${result.imported} memories, skipped ${result.skipped}.`);
                await this.loadMemories();
                this.updateStats();
            } catch (error) {
                console.error('[Memory UI] Error importing:', error);
                alert('Failed to import: ' + error.message);
            }
        };

        input.click();
    }

    /**
     * Clear all memories
     */
    async clearAll() {
        if (!confirm('Are you sure you want to delete ALL memories? This cannot be undone!')) return;
        if (!confirm('Really delete everything?')) return;

        try {
            await this.manager.clearAllMemories();
            await this.loadMemories();
            this.updateStats();
        } catch (error) {
            console.error('[Memory UI] Error clearing:', error);
            alert('Failed to clear: ' + error.message);
        }
    }

    /**
     * Update stats display
     */
    async updateStats() {
        const stats = await this.manager.getStats();
        const statsEl = this.container.querySelector('.rpg-memory-stats');
        if (statsEl) {
            statsEl.textContent = `${stats.totalCount} memories`;
        }
    }

    /**
     * Destroy the panel
     */
    destroy() {
        this.container.innerHTML = '';
    }
}

/**
 * Create a memory panel for a character
 * @param {string} characterId - Character identifier
 * @param {HTMLElement} container - Container element
 * @returns {MemoryPanel}
 */
export function createMemoryPanel(characterId, container) {
    return new MemoryPanel(characterId, container);
}

/**
 * Show a quick memory summary popup
 * @param {string} characterId - Character identifier
 */
export async function showMemorySummary(characterId) {
    const summary = await summarizeMemories(characterId);
    alert(summary);
}
