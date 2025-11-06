/**
 * Quests Widget
 *
 * Quest tracking system with two sub-tabs:
 * - Main Quest: Single primary objective
 * - Optional Quests: Multiple side objectives
 *
 * Features:
 * - Add/edit/remove quests
 * - Inline editing for quest titles
 * - Sub-tab navigation
 */

import { showAlertDialog } from '../confirmDialog.js';

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Renders the quests sub-tab navigation
 */
function renderQuestsSubTabs(activeTab = 'main') {
    return `
        <div class="rpg-inventory-subtabs">
            <button class="rpg-inventory-subtab ${activeTab === 'main' ? 'active' : ''}" data-tab="main">
                <i class="fa-solid fa-scroll"></i>
                <span class="rpg-subtab-label">Main Quest</span>
            </button>
            <button class="rpg-inventory-subtab ${activeTab === 'optional' ? 'active' : ''}" data-tab="optional">
                <i class="fa-solid fa-list-check"></i>
                <span class="rpg-subtab-label">Optional</span>
            </button>
        </div>
    `;
}

/**
 * Renders the main quest view
 */
function renderMainQuestView(mainQuest) {
    const questDisplay = (mainQuest && mainQuest !== 'None') ? mainQuest : '';
    const hasQuest = questDisplay.length > 0;

    return `
        <div class="rpg-quest-section">
            <div class="rpg-quest-header">
                <h3 class="rpg-quest-section-title">Main Quest</h3>
                ${!hasQuest ? `<button class="rpg-add-quest-btn" data-action="add-quest" data-field="main" title="Add main quest">
                    <i class="fa-solid fa-plus"></i><span class="rpg-btn-label"> Add Quest</span>
                </button>` : ''}
            </div>
            <div class="rpg-quest-content">
                ${hasQuest ? `
                    <div class="rpg-inline-form" id="rpg-edit-quest-form-main" style="display: none;">
                        <input type="text" class="rpg-inline-input" id="rpg-edit-quest-main" value="${escapeHtml(questDisplay)}" />
                        <div class="rpg-inline-buttons">
                            <button class="rpg-inline-btn rpg-inline-cancel" data-action="cancel-edit-quest" data-field="main">
                                <i class="fa-solid fa-times"></i> Cancel
                            </button>
                            <button class="rpg-inline-btn rpg-inline-save" data-action="save-edit-quest" data-field="main">
                                <i class="fa-solid fa-check"></i> Save
                            </button>
                        </div>
                    </div>
                    <div class="rpg-quest-item" data-field="main">
                        <div class="rpg-quest-title">${escapeHtml(questDisplay)}</div>
                        <div class="rpg-quest-actions">
                            <button class="rpg-quest-edit" data-action="edit-quest" data-field="main" title="Edit quest">
                                <i class="fa-solid fa-edit"></i>
                            </button>
                            <button class="rpg-quest-remove" data-action="remove-quest" data-field="main" title="Complete/Remove quest">
                                <i class="fa-solid fa-check"></i>
                            </button>
                        </div>
                    </div>
                ` : `
                    <div class="rpg-inline-form" id="rpg-add-quest-form-main" style="display: none;">
                        <input type="text" class="rpg-inline-input" id="rpg-new-quest-main" placeholder="Enter main quest title..." />
                        <div class="rpg-inline-buttons">
                            <button class="rpg-inline-btn rpg-inline-cancel" data-action="cancel-add-quest" data-field="main">
                                <i class="fa-solid fa-times"></i> Cancel
                            </button>
                            <button class="rpg-inline-btn rpg-inline-save" data-action="save-add-quest" data-field="main">
                                <i class="fa-solid fa-check"></i> Add
                            </button>
                        </div>
                    </div>
                    <div class="rpg-quest-empty">No active main quest</div>
                `}
            </div>
            <div class="rpg-quest-hint">
                <i class="fa-solid fa-lightbulb"></i>
                The main quest represents your primary objective in the story.
            </div>
        </div>
    `;
}

/**
 * Renders the optional quests view
 */
function renderOptionalQuestsView(optionalQuests) {
    const quests = optionalQuests.filter(q => q && q !== 'None');

    let questsHtml = '';
    if (quests.length === 0) {
        questsHtml = '<div class="rpg-quest-empty">No active optional quests</div>';
    } else {
        questsHtml = quests.map((quest, index) => `
            <div class="rpg-quest-item" data-field="optional" data-index="${index}">
                <div class="rpg-quest-title rpg-editable" contenteditable="true" data-field="optional" data-index="${index}" title="Click to edit">${escapeHtml(quest)}</div>
                <div class="rpg-quest-actions">
                    <button class="rpg-quest-remove" data-action="remove-quest" data-field="optional" data-index="${index}" title="Complete/Remove quest">
                        <i class="fa-solid fa-check"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    return `
        <div class="rpg-quest-section">
            <div class="rpg-quest-header">
                <h3 class="rpg-quest-section-title">Optional Quests</h3>
                <button class="rpg-add-quest-btn" data-action="add-quest" data-field="optional" title="Add optional quest">
                    <i class="fa-solid fa-plus"></i><span class="rpg-btn-label"> Add Quest</span>
                </button>
            </div>
            <div class="rpg-quest-content">
                <div class="rpg-inline-form" id="rpg-add-quest-form-optional" style="display: none;">
                    <input type="text" class="rpg-inline-input" id="rpg-new-quest-optional" placeholder="Enter optional quest title..." />
                    <div class="rpg-inline-buttons">
                        <button class="rpg-inline-btn rpg-inline-cancel" data-action="cancel-add-quest" data-field="optional">
                            <i class="fa-solid fa-times"></i> Cancel
                        </button>
                        <button class="rpg-inline-btn rpg-inline-save" data-action="save-add-quest" data-field="optional">
                            <i class="fa-solid fa-check"></i> Add
                        </button>
                    </div>
                </div>
                <div class="rpg-quest-list">
                    ${questsHtml}
                </div>
            </div>
            <div class="rpg-quest-hint">
                <i class="fa-solid fa-info-circle"></i>
                Optional quests are side objectives that complement your main story.
            </div>
        </div>
    `;
}

/**
 * Attach handlers for quest content (buttons, inputs)
 * Separated so it can be re-attached after tab switching
 */
function attachQuestContentHandlers(container, widgetId, state, dependencies) {
    const { getExtensionSettings, onDataChange } = dependencies;
    const widgetContainer = container.querySelector('.rpg-quests-widget');

    if (!widgetContainer) return;

    // Add quest button
    widgetContainer.querySelectorAll('[data-action="add-quest"]').forEach(btn => {
        btn.addEventListener('click', () => {
            const field = btn.dataset.field;
            const form = widgetContainer.querySelector(`#rpg-add-quest-form-${field}`);
            const input = widgetContainer.querySelector(`#rpg-new-quest-${field}`);
            if (form) form.style.display = 'block';
            if (input) input.focus();
        });
    });

    // Cancel add quest
    widgetContainer.querySelectorAll('[data-action="cancel-add-quest"]').forEach(btn => {
        btn.addEventListener('click', () => {
            const field = btn.dataset.field;
            const form = widgetContainer.querySelector(`#rpg-add-quest-form-${field}`);
            const input = widgetContainer.querySelector(`#rpg-new-quest-${field}`);
            if (form) form.style.display = 'none';
            if (input) input.value = '';
        });
    });

    // Save add quest
    widgetContainer.querySelectorAll('[data-action="save-add-quest"]').forEach(btn => {
        btn.addEventListener('click', () => {
            const field = btn.dataset.field;
            const input = widgetContainer.querySelector(`#rpg-new-quest-${field}`);
            const questTitle = input?.value.trim();

            if (questTitle) {
                const settings = getExtensionSettings();
                if (field === 'main') {
                    settings.quests.main = questTitle;
                } else {
                    if (!settings.quests.optional) {
                        settings.quests.optional = [];
                    }
                    settings.quests.optional.push(questTitle);
                }

                // Trigger data change callback
                onDataChange('quests', field, questTitle);

                // Re-render the widget
                const widgetEl = container.closest('.dashboard-widget');
                if (widgetEl && widgetEl._widgetInstance) {
                    widgetEl._widgetInstance.render(container, widgetEl._widgetInstance.config);
                }
            }
        });
    });

    // Edit quest (main only)
    widgetContainer.querySelectorAll('[data-action="edit-quest"]').forEach(btn => {
        btn.addEventListener('click', () => {
            const field = btn.dataset.field;
            const form = widgetContainer.querySelector(`#rpg-edit-quest-form-${field}`);
            const questItem = widgetContainer.querySelector('.rpg-quest-item[data-field="main"]');
            const input = widgetContainer.querySelector(`#rpg-edit-quest-${field}`);

            if (form) form.style.display = 'block';
            if (questItem) questItem.style.display = 'none';
            if (input) input.focus();
        });
    });

    // Cancel edit quest
    widgetContainer.querySelectorAll('[data-action="cancel-edit-quest"]').forEach(btn => {
        btn.addEventListener('click', () => {
            const field = btn.dataset.field;
            const form = widgetContainer.querySelector(`#rpg-edit-quest-form-${field}`);
            const questItem = widgetContainer.querySelector('.rpg-quest-item[data-field="main"]');

            if (form) form.style.display = 'none';
            if (questItem) questItem.style.display = 'flex';
        });
    });

    // Save edit quest
    widgetContainer.querySelectorAll('[data-action="save-edit-quest"]').forEach(btn => {
        btn.addEventListener('click', () => {
            const field = btn.dataset.field;
            const input = widgetContainer.querySelector(`#rpg-edit-quest-${field}`);
            const questTitle = input?.value.trim();

            if (questTitle) {
                const settings = getExtensionSettings();
                settings.quests.main = questTitle;

                // Trigger data change callback
                onDataChange('quests', 'main', questTitle);

                // Re-render the widget
                const widgetEl = container.closest('.dashboard-widget');
                if (widgetEl && widgetEl._widgetInstance) {
                    widgetEl._widgetInstance.render(container, widgetEl._widgetInstance.config);
                }
            }
        });
    });

    // Remove quest
    widgetContainer.querySelectorAll('[data-action="remove-quest"]').forEach(btn => {
        btn.addEventListener('click', () => {
            const field = btn.dataset.field;
            const index = parseInt(btn.dataset.index);
            const settings = getExtensionSettings();

            if (field === 'main') {
                settings.quests.main = 'None';
                onDataChange('quests', 'main', 'None');
            } else {
                if (settings.quests.optional && index !== undefined && !isNaN(index)) {
                    settings.quests.optional.splice(index, 1);
                    onDataChange('quests', 'optional', settings.quests.optional);
                }
            }

            // Re-render the widget
            const widgetEl = container.closest('.dashboard-widget');
            if (widgetEl && widgetEl._widgetInstance) {
                widgetEl._widgetInstance.render(container, widgetEl._widgetInstance.config);
            }
        });
    });

    // Inline editing for optional quests
    widgetContainer.querySelectorAll('.rpg-quest-title.rpg-editable').forEach(el => {
        el.addEventListener('blur', () => {
            const field = el.dataset.field;
            const index = parseInt(el.dataset.index);
            const newTitle = el.textContent.trim();
            const settings = getExtensionSettings();

            if (newTitle && field === 'optional' && index !== undefined && !isNaN(index)) {
                if (settings.quests.optional && settings.quests.optional[index] !== undefined) {
                    settings.quests.optional[index] = newTitle;
                    onDataChange('quests', 'optional', settings.quests.optional);
                }
            }
        });
    });

    // Enter key to save in forms
    widgetContainer.querySelectorAll('.rpg-inline-input').forEach(input => {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const inputId = input.id;
                const isEdit = inputId.includes('edit');
                const field = inputId.replace('rpg-edit-quest-', '').replace('rpg-new-quest-', '');

                const actionBtn = widgetContainer.querySelector(
                    isEdit
                        ? `[data-action="save-edit-quest"][data-field="${field}"]`
                        : `[data-action="save-add-quest"][data-field="${field}"]`
                );

                if (actionBtn) actionBtn.click();
            }
        });
    });
}

/**
 * Attach all event handlers for quest widget
 */
function attachQuestHandlers(container, widgetId, quests, state, dependencies) {
    const { getExtensionSettings } = dependencies;
    const widgetContainer = container.querySelector('.rpg-quests-widget');

    if (!widgetContainer) return;

    // Sub-tab switching
    widgetContainer.querySelectorAll('.rpg-inventory-subtab').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            state.activeSubTab = tab;

            // Re-render the views container inline
            const settings = getExtensionSettings();
            const questData = settings.quests || { main: 'None', optional: [] };

            let contentHtml = '';
            if (tab === 'main') {
                contentHtml = renderMainQuestView(questData.main);
            } else {
                contentHtml = renderOptionalQuestsView(questData.optional || []);
            }

            widgetContainer.querySelector('.rpg-quests-views').innerHTML = contentHtml;

            // Update active tab styling
            widgetContainer.querySelectorAll('.rpg-inventory-subtab').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Re-attach handlers for the new content
            attachQuestContentHandlers(container, widgetId, state, dependencies);
        });
    });

    // Attach content handlers initially
    attachQuestContentHandlers(container, widgetId, state, dependencies);
}

/**
 * Register Quests Widget
 */
export function registerQuestsWidget(registry, dependencies) {
    const { getExtensionSettings } = dependencies;

    // Widget state (per-instance)
    const widgetStates = new Map();

    function getWidgetState(widgetId) {
        if (!widgetStates.has(widgetId)) {
            widgetStates.set(widgetId, {
                activeSubTab: 'main'
            });
        }
        return widgetStates.get(widgetId);
    }

    registry.register('quests', {
        name: 'Quests',
        icon: '<i class="fa-solid fa-scroll"></i>',
        description: 'Quest tracking with main and optional quests',
        category: 'quests',
        minSize: { w: 2, h: 4 },
        // Column-aware sizing: compact on mobile, full width on desktop
        defaultSize: (columns) => {
            if (columns <= 2) {
                return { w: 2, h: 5 }; // Mobile: 2×5 (full width, compact)
            }
            return { w: 3, h: 7 }; // Desktop: 3×7 (full width, spacious for 1080p)
        },
        maxAutoSize: (columns) => {
            if (columns <= 2) {
                return { w: 2, h: 8 }; // Mobile: 2×8 max
            }
            return { w: 3, h: 10 }; // Desktop: 3×10 max (can expand)
        },
        requiresSchema: false,

        render(container, config = {}) {
            const settings = getExtensionSettings();
            const quests = settings.quests || {
                main: 'None',
                optional: []
            };

            // Get or create widget state
            const widgetId = container.closest('.dashboard-widget')?.dataset?.widgetId || 'default';
            const state = getWidgetState(widgetId);

            // Build HTML
            let contentHtml = '';
            if (state.activeSubTab === 'main') {
                contentHtml = renderMainQuestView(quests.main);
            } else {
                contentHtml = renderOptionalQuestsView(quests.optional || []);
            }

            const html = `
                <div class="rpg-quests-widget" data-widget-id="${widgetId}">
                    ${renderQuestsSubTabs(state.activeSubTab)}
                    <div class="rpg-quests-views">
                        ${contentHtml}
                    </div>
                </div>
            `;

            container.innerHTML = html;

            // Attach event handlers
            attachQuestHandlers(container, widgetId, quests, state, dependencies);
        },

        // Called when widget data changes externally
        onDataUpdate(container, config = {}) {
            this.render(container, config);
        },

        // Called when widget is resized
        onResize(container, newW, newH) {
            // Re-render widget to update layout for new dimensions
            this.render(container, this.config || {});

            // Apply width-aware styling
            const widget = container.querySelector('.rpg-quests-widget');
            if (widget) {
                if (newW >= 3) {
                    // Wide layout: constrain title width
                    widget.classList.add('rpg-quests-wide');
                    widget.classList.remove('rpg-quests-compact');
                } else {
                    // Narrow layout: compact mode with truncated headers
                    widget.classList.remove('rpg-quests-wide');
                    widget.classList.add('rpg-quests-compact');
                }
            }
        }
    });
}
