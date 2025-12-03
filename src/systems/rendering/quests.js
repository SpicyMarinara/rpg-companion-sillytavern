/**
 * Quests Rendering Module
 * Handles UI rendering for quests system (main and optional quests)
 */

import { extensionSettings, $questsContainer } from '../../core/state.js';
import { saveSettings } from '../../core/persistence.js';
import { i18n } from '../../core/i18n.js';

/**
 * HTML escape helper
 * @param {string} text - Text to escape
 * @returns {string} Escaped HTML
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Checks if we have structured quests data (v2 format with name + description)
 * @returns {boolean}
 */
function hasStructuredQuests() {
    const q = extensionSettings.questsV2;
    return q && (q.main !== undefined || q.optional !== undefined);
}

/**
 * Gets the main quest (supports both legacy and structured format)
 * @returns {{name: string, description: string}|null}
 */
function getMainQuest() {
    if (hasStructuredQuests() && extensionSettings.questsV2.main) {
        return extensionSettings.questsV2.main;
    }
    // Legacy format
    const title = extensionSettings.quests?.main;
    if (title && title !== 'None') {
        return { name: title, description: extensionSettings.quests?.mainDescription || '' };
    }
    return null;
}

/**
 * Gets optional quests (supports both legacy and structured format)
 * @returns {Array<{name: string, description: string}>}
 */
function getOptionalQuests() {
    if (hasStructuredQuests() && extensionSettings.questsV2.optional) {
        return extensionSettings.questsV2.optional;
    }
    // Legacy format
    const titles = extensionSettings.quests?.optional || [];
    const descriptions = extensionSettings.quests?.optionalDescriptions || [];
    return titles.map((title, i) => ({
        name: title,
        description: descriptions[i] || ''
    }));
}

/**
 * Renders the quests sub-tab navigation (Main, Optional)
 * @param {string} activeTab - Currently active sub-tab ('main', 'optional')
 * @returns {string} HTML for sub-tab navigation
 */
export function renderQuestsSubTabs(activeTab = 'main') {
    return `
        <div class="rpg-quests-subtabs">
            <button class="rpg-quests-subtab ${activeTab === 'main' ? 'active' : ''}" data-tab="main" data-i18n-key="quests.section.main">
                ${i18n.getTranslation('quests.section.main')}
            </button>
            <button class="rpg-quests-subtab ${activeTab === 'optional' ? 'active' : ''}" data-tab="optional" data-i18n-key="quests.section.optional">
                ${i18n.getTranslation('quests.section.optional')}
            </button>
        </div>
    `;
}

/**
 * Renders the main quest view
 * @param {string} mainQuest - Current main quest title (legacy param, ignored if structured)
 * @returns {string} HTML for main quest view
 */
export function renderMainQuestView(mainQuest) {
    // Use structured data helpers
    const quest = getMainQuest();
    const hasQuest = quest !== null;
    const questName = quest?.name || '';
    const questDesc = quest?.description || '';

    return `
        <div class="rpg-quest-section">
            <div class="rpg-quest-header">
                <h3 class="rpg-quest-section-title" data-i18n-key="quests.main.title">${i18n.getTranslation('quests.main.title')}</h3>
                ${!hasQuest ? `<button class="rpg-add-quest-btn" data-action="add-quest" data-field="main" title="${i18n.getTranslation('quests.main.addQuestTitle')}">
                    <i class="fa-solid fa-plus"></i> <span data-i18n-key="global.add">${i18n.getTranslation('global.add')}</span>
                </button>` : ''}
            </div>
            <div class="rpg-quest-content">
                ${hasQuest ? `
                    <div class="rpg-inline-form" id="rpg-edit-quest-form-main" style="display: none;">
                        <input type="text" class="rpg-inline-input" id="rpg-edit-quest-main" value="${escapeHtml(questName)}" placeholder="Quest name" />
                        <input type="text" class="rpg-inline-input" id="rpg-edit-quest-desc-main" value="${escapeHtml(questDesc)}" placeholder="Description (optional)" />
                        <div class="rpg-inline-buttons">
                            <button class="rpg-inline-btn rpg-inline-cancel" data-action="cancel-edit-quest" data-field="main">
                                <i class="fa-solid fa-times"></i> <span data-i18n-key="global.cancel">${i18n.getTranslation('global.cancel')}</span>
                            </button>
                            <button class="rpg-inline-btn rpg-inline-save" data-action="save-edit-quest" data-field="main">
                                <i class="fa-solid fa-check"></i> <span data-i18n-key="global.save">${i18n.getTranslation('global.save')}</span>
                            </button>
                        </div>
                    </div>
                    <div class="rpg-quest-item" data-field="main">
                        <div class="rpg-quest-title">${escapeHtml(questName)}</div>
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
                        <input type="text" class="rpg-inline-input" id="rpg-new-quest-main" placeholder="${i18n.getTranslation('quests.main.addQuestPlaceholder')}" data-i18n-placeholder-key="quests.main.addQuestPlaceholder" />
                        <div class="rpg-inline-actions">
                            <button class="rpg-inline-btn rpg-inline-cancel" data-action="cancel-add-quest" data-field="main">
                                <i class="fa-solid fa-times"></i> <span data-i18n-key="global.cancel">${i18n.getTranslation('global.cancel')}</span>
                            </button>
                            <button class="rpg-inline-btn rpg-inline-save" data-action="save-add-quest" data-field="main">
                                <i class="fa-solid fa-check"></i> <span data-i18n-key="global.add">${i18n.getTranslation('global.add')}</span>
                            </button>
                        </div>
                    </div>
                    <div class="rpg-quest-empty" data-i18n-key="quests.main.empty">${i18n.getTranslation('quests.main.empty')}</div>
                `}
            </div>
            <div class="rpg-quest-hint">
                <i class="fa-solid fa-lightbulb"></i>
                <span data-i18n-key="quests.main.hint">${i18n.getTranslation('quests.main.hint')}</span>
            </div>
        </div>
    `;
}

/**
 * Renders the optional quests view
 * @param {string[]} optionalQuests - Array of optional quest titles
 * @returns {string} HTML for optional quests view
 */
export function renderOptionalQuestsView(optionalQuests) {
    // Use structured data helpers
    const quests = getOptionalQuests().filter(q => q && q.name && q.name !== 'None');

    let questsHtml = '';
    if (quests.length === 0) {
        questsHtml = `<div class="rpg-quest-empty" data-i18n-key="quests.optional.empty">${i18n.getTranslation('quests.optional.empty')}</div>`;
    } else {
        questsHtml = quests.map((quest, index) => `
            <div class="rpg-quest-item" data-field="optional" data-index="${index}">
                <div class="rpg-quest-title rpg-editable" contenteditable="true" data-field="optional" data-index="${index}" title="Click to edit">${escapeHtml(quest.name)}</div>
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
                <h3 class="rpg-quest-section-title" data-i18n-key="quests.optional.title">${i18n.getTranslation('quests.optional.title')}</h3>
                <button class="rpg-add-quest-btn" data-action="add-quest" data-field="optional" title="${i18n.getTranslation('quests.optional.addQuestTitle')}">
                    <i class="fa-solid fa-plus"></i> <span data-i18n-key="global.add">${i18n.getTranslation('global.add')}</span>
                </button>
            </div>
            <div class="rpg-quest-content">
                <div class="rpg-inline-form" id="rpg-add-quest-form-optional" style="display: none;">
                    <input type="text" class="rpg-inline-input" id="rpg-new-quest-optional" placeholder="${i18n.getTranslation('quests.optional.addQuestPlaceholder')}" data-i18n-placeholder-key="quests.optional.addQuestPlaceholder" />
                    <div class="rpg-inline-buttons">
                        <button class="rpg-inline-btn rpg-inline-cancel" data-action="cancel-add-quest" data-field="optional">
                            <i class="fa-solid fa-times"></i> <span data-i18n-key="global.cancel">${i18n.getTranslation('global.cancel')}</span>
                        </button>
                        <button class="rpg-inline-btn rpg-inline-save" data-action="save-add-quest" data-field="optional">
                            <i class="fa-solid fa-check"></i> <span data-i18n-key="global.add">${i18n.getTranslation('global.add')}</span>
                        </button>
                    </div>
                </div>
                <div class="rpg-quest-list">
                    ${questsHtml}
                </div>
                <div class="rpg-quest-hint">
                    <i class="fa-solid fa-info-circle"></i>
                    <span data-i18n-key="quests.optional.hint">${i18n.getTranslation('quests.optional.hint')}</span>
                </div>
            </div>
        </div>
    `;
}

/**
 * Main render function for quests
 */
export function renderQuests() {
    if (!extensionSettings.showQuests || !$questsContainer) {
        return;
    }

    // Get current sub-tab from container or default to 'main'
    const activeSubTab = $questsContainer.data('active-subtab') || 'main';

    // Get quests data
    const mainQuest = extensionSettings.quests.main || 'None';
    const optionalQuests = extensionSettings.quests.optional || [];

    // Build HTML
    let html = '<div class="rpg-quests-wrapper">';
    html += renderQuestsSubTabs(activeSubTab);

    // Render active sub-tab
    html += '<div class="rpg-quests-panels">';
    if (activeSubTab === 'main') {
        html += renderMainQuestView(mainQuest);
    } else {
        html += renderOptionalQuestsView(optionalQuests);
    }
    html += '</div></div>';

    $questsContainer.html(html);

    // Attach event handlers
    attachQuestEventHandlers();
}

/**
 * Attach event handlers for quest interactions
 */
function attachQuestEventHandlers() {
    // Sub-tab switching
    $questsContainer.find('.rpg-quests-subtab').on('click', function() {
        const tab = $(this).data('tab');
        $questsContainer.data('active-subtab', tab);
        renderQuests();
    });

    // Add quest button
    $questsContainer.find('[data-action="add-quest"]').on('click', function() {
        const field = $(this).data('field');
        $(`#rpg-add-quest-form-${field}`).show();
        $(`#rpg-new-quest-${field}`).focus();
    });

    // Cancel add quest
    $questsContainer.find('[data-action="cancel-add-quest"]').on('click', function() {
        const field = $(this).data('field');
        $(`#rpg-add-quest-form-${field}`).hide();
        $(`#rpg-new-quest-${field}`).val('');
    });

    // Save add quest
    $questsContainer.find('[data-action="save-add-quest"]').on('click', function() {
        const field = $(this).data('field');
        const nameInput = $(`#rpg-new-quest-${field}`);
        const descInput = $(`#rpg-new-quest-desc-${field}`);
        const questTitle = nameInput.val().trim();
        const questDesc = descInput?.val()?.trim() || '';

        if (questTitle) {
            // Ensure structured format exists
            if (!extensionSettings.questsV2) {
                extensionSettings.questsV2 = { main: null, optional: [] };
            }
            
            if (field === 'main') {
                extensionSettings.quests.main = questTitle;
                extensionSettings.questsV2.main = { name: questTitle, description: questDesc };
            } else {
                if (!extensionSettings.quests.optional) {
                    extensionSettings.quests.optional = [];
                }
                if (!extensionSettings.questsV2.optional) {
                    extensionSettings.questsV2.optional = [];
                }
                extensionSettings.quests.optional.push(questTitle);
                extensionSettings.questsV2.optional.push({ name: questTitle, description: questDesc });
            }
            saveSettings();
            renderQuests();
        }
    });

    // Edit quest (main only)
    $questsContainer.find('[data-action="edit-quest"]').on('click', function() {
        const field = $(this).data('field');
        $(`#rpg-edit-quest-form-${field}`).show();
        $('.rpg-quest-item[data-field="main"]').hide();
        $(`#rpg-edit-quest-${field}`).focus();
    });

    // Cancel edit quest
    $questsContainer.find('[data-action="cancel-edit-quest"]').on('click', function() {
        const field = $(this).data('field');
        $(`#rpg-edit-quest-form-${field}`).hide();
        $('.rpg-quest-item[data-field="main"]').show();
    });

    // Save edit quest (main)
    $questsContainer.find('[data-action="save-edit-quest"]').on('click', function() {
        const field = $(this).data('field');
        const nameInput = $(`#rpg-edit-quest-${field}`);
        const descInput = $(`#rpg-edit-quest-desc-${field}`);
        const questTitle = nameInput.val().trim();
        const questDesc = descInput.val()?.trim() || '';

        if (questTitle) {
            // Use structured format
            if (!extensionSettings.questsV2) {
                extensionSettings.questsV2 = { main: null, optional: [] };
            }
            extensionSettings.questsV2.main = { name: questTitle, description: questDesc };
            // Also update legacy for backwards compatibility
            extensionSettings.quests.main = questTitle;
            saveSettings();
            renderQuests();
        }
    });

    // Remove quest
    $questsContainer.find('[data-action="remove-quest"]').on('click', function() {
        const field = $(this).data('field');
        const index = $(this).data('index');

        if (field === 'main') {
            extensionSettings.quests.main = 'None';
            if (extensionSettings.questsV2) {
                extensionSettings.questsV2.main = null;
            }
        } else {
            extensionSettings.quests.optional.splice(index, 1);
            if (extensionSettings.questsV2?.optional) {
                extensionSettings.questsV2.optional.splice(index, 1);
            }
        }
        saveSettings();
        renderQuests();
    });

    // Inline editing for optional quests (name and description)
    $questsContainer.find('.rpg-quest-title.rpg-editable, .rpg-quest-description.rpg-editable').on('blur', function() {
        const $this = $(this);
        const field = $this.data('field');
        const index = $this.data('index');
        const prop = $this.data('prop') || 'name';
        const newValue = $this.text().trim();

        if (field === 'optional' && index !== undefined) {
            // Ensure structured format exists
            if (!extensionSettings.questsV2) {
                extensionSettings.questsV2 = { main: null, optional: [] };
            }
            if (!extensionSettings.questsV2.optional[index]) {
                extensionSettings.questsV2.optional[index] = { name: '', description: '' };
            }
            extensionSettings.questsV2.optional[index][prop] = newValue;
            
            // Also update legacy for backwards compatibility
            if (prop === 'name') {
                extensionSettings.quests.optional[index] = newValue;
            }
            saveSettings();
        }
    });

    // Enter key to save in forms
    $questsContainer.find('.rpg-inline-input').on('keypress', function(e) {
        if (e.which === 13) {
            const field = $(this).attr('id').includes('edit') ?
                $(this).attr('id').replace('rpg-edit-quest-', '') :
                $(this).attr('id').replace('rpg-new-quest-', '');

            if ($(this).attr('id').includes('edit')) {
                $(`[data-action="save-edit-quest"][data-field="${field}"]`).click();
            } else {
                $(`[data-action="save-add-quest"][data-field="${field}"]`).click();
            }
        }
    });
}
