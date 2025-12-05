/**
 * Quests Rendering Module
 * Handles UI rendering for quests system (main and optional quests)
 * Uses the same structure and styling as items/skills
 */

import { extensionSettings, $questsContainer } from '../../core/state.js';
import { saveSettings, saveChatData } from '../../core/persistence.js';
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
 * Gets the main quest (migration handles legacy format conversion)
 * @returns {{name: string, description: string}|null}
 */
function getMainQuest() {
    if (extensionSettings.questsV2?.main) {
        return extensionSettings.questsV2.main;
    }
    return null;
}

/**
 * Gets optional quests (migration handles legacy format conversion)
 * @returns {Array<{name: string, description: string}>}
 */
function getOptionalQuests() {
    return extensionSettings.questsV2?.optional || [];
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
 * Renders the main quest view (matches items/skills structure)
 * @returns {string} HTML for main quest view
 */
export function renderMainQuestView() {
    const quest = getMainQuest();
    const hasQuest = quest !== null;
    const questName = quest?.name || '';
    const questDesc = quest?.description || '';
    
    // Track if add form is open
    const isFormOpen = openAddForms?.main || false;

    let itemsHtml = '';
    if (hasQuest) {
        // Render quest as item (list view style, matching items/skills)
        itemsHtml = `
            <div class="rpg-item-row" data-field="main">
                <div class="rpg-item-main-row">
                    <span class="rpg-item-name rpg-editable" contenteditable="true" data-field="main" data-prop="name" title="Click to edit">${escapeHtml(questName)}</span>
                    <button class="rpg-item-remove" data-action="remove-quest" data-field="main" title="Complete/Remove quest">
                        <i class="fa-solid fa-times"></i>
                    </button>
                </div>
                <div class="rpg-item-desc-row">
                    <span class="rpg-item-description rpg-editable" contenteditable="true" data-field="main" data-prop="description" title="Click to edit description">${escapeHtml(questDesc)}</span>
                </div>
            </div>
        `;
    }

    return `
        <div class="rpg-quest-section">
            <div class="rpg-quest-header">
                <h3 class="rpg-quest-section-title" data-i18n-key="quests.main.title">${i18n.getTranslation('quests.main.title')}</h3>
                <button class="rpg-inventory-add-btn" data-action="add-quest" data-field="main" title="${i18n.getTranslation('quests.main.addQuestTitle')}">
                    <i class="fa-solid fa-plus"></i> <span data-i18n-key="global.add">${i18n.getTranslation('global.add')}</span>
                </button>
            </div>
            <div class="rpg-quest-content">
                <div class="rpg-inline-form" id="rpg-add-quest-form-main" style="display: ${isFormOpen ? 'flex' : 'none'};">
                    <input type="text" class="rpg-inline-input" id="rpg-new-quest-main" placeholder="${i18n.getTranslation('quests.main.addQuestPlaceholder')}" data-i18n-placeholder-key="quests.main.addQuestPlaceholder" />
                    <div class="rpg-inline-buttons">
                        <button class="rpg-inline-btn rpg-inline-cancel" data-action="cancel-add-quest" data-field="main">
                            <i class="fa-solid fa-times"></i> <span data-i18n-key="global.cancel">${i18n.getTranslation('global.cancel')}</span>
                        </button>
                        <button class="rpg-inline-btn rpg-inline-save" data-action="save-add-quest" data-field="main">
                            <i class="fa-solid fa-check"></i> <span data-i18n-key="global.add">${i18n.getTranslation('global.add')}</span>
                        </button>
                    </div>
                </div>
                <div class="rpg-item-list rpg-item-list-view">
                    ${itemsHtml || `<div class="rpg-inventory-empty" data-i18n-key="quests.main.empty">${i18n.getTranslation('quests.main.empty')}</div>`}
                </div>
            </div>
        </div>
    `;
}

/**
 * Renders the optional quests view (matches items/skills structure)
 * @returns {string} HTML for optional quests view
 */
export function renderOptionalQuestsView() {
    const quests = getOptionalQuests().filter(q => q && q.name && q.name !== 'None');
    
    // Track if add form is open
    const isFormOpen = openAddForms?.optional || false;

    let itemsHtml = '';
    if (quests.length === 0) {
        itemsHtml = `<div class="rpg-inventory-empty" data-i18n-key="quests.optional.empty">${i18n.getTranslation('quests.optional.empty')}</div>`;
    } else {
        // Render quests as items (list view style, matching items/skills)
        itemsHtml = quests.map((quest, index) => `
            <div class="rpg-item-row" data-field="optional" data-index="${index}">
                <div class="rpg-item-main-row">
                    <span class="rpg-item-name rpg-editable" contenteditable="true" data-field="optional" data-index="${index}" data-prop="name" title="Click to edit">${escapeHtml(quest.name)}</span>
                    <button class="rpg-item-remove" data-action="remove-quest" data-field="optional" data-index="${index}" title="Complete/Remove quest">
                        <i class="fa-solid fa-times"></i>
                    </button>
                </div>
                <div class="rpg-item-desc-row">
                    <span class="rpg-item-description rpg-editable" contenteditable="true" data-field="optional" data-index="${index}" data-prop="description" title="Click to edit description">${escapeHtml(quest.description || '')}</span>
                </div>
            </div>
        `).join('');
    }

    return `
        <div class="rpg-quest-section">
            <div class="rpg-quest-header">
                <h3 class="rpg-quest-section-title" data-i18n-key="quests.optional.title">${i18n.getTranslation('quests.optional.title')}</h3>
                <button class="rpg-inventory-add-btn" data-action="add-quest" data-field="optional" title="${i18n.getTranslation('quests.optional.addQuestTitle')}">
                    <i class="fa-solid fa-plus"></i> <span data-i18n-key="global.add">${i18n.getTranslation('global.add')}</span>
                </button>
            </div>
            <div class="rpg-quest-content">
                <div class="rpg-inline-form" id="rpg-add-quest-form-optional" style="display: ${isFormOpen ? 'flex' : 'none'};">
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
                <div class="rpg-item-list rpg-item-list-view">
                    ${itemsHtml}
                </div>
            </div>
        </div>
    `;
}

// Track open add forms (matching items/skills pattern)
let openAddForms = {};

/**
 * Main render function for quests
 */
export function renderQuests() {
    if (!extensionSettings.showQuests || !$questsContainer) {
        return;
    }

    // Get current sub-tab from container or default to 'main'
    const activeSubTab = $questsContainer.data('active-subtab') || 'main';

    // Build HTML
    let html = '<div class="rpg-quests-wrapper">';
    html += renderQuestsSubTabs(activeSubTab);

    // Render active sub-tab
    html += '<div class="rpg-quests-panels">';
    if (activeSubTab === 'main') {
        html += renderMainQuestView();
    } else {
        html += renderOptionalQuestsView();
    }
    html += '</div></div>';

    $questsContainer.html(html);

    // Attach event handlers
    attachQuestEventHandlers();
}

/**
 * Attach event handlers for quest interactions (matching items/skills pattern)
 */
function attachQuestEventHandlers() {
    // Sub-tab switching
    $questsContainer.find('.rpg-quests-subtab').off('click').on('click', function() {
        const tab = $(this).data('tab');
        $questsContainer.data('active-subtab', tab);
        renderQuests();
    });

    // Add quest button
    $questsContainer.find('[data-action="add-quest"]').off('click').on('click', function() {
        const field = $(this).data('field');
        openAddForms[field] = true;
        renderQuests();
        setTimeout(() => {
            $(`#rpg-new-quest-${field}`).focus();
        }, 50);
    });

    // Cancel add quest
    $questsContainer.find('[data-action="cancel-add-quest"]').off('click').on('click', function() {
        const field = $(this).data('field');
        openAddForms[field] = false;
        $(`#rpg-new-quest-${field}`).val('');
        renderQuests();
    });

    // Save add quest
    $questsContainer.find('[data-action="save-add-quest"]').off('click').on('click', function() {
        const field = $(this).data('field');
        const nameInput = $(`#rpg-new-quest-${field}`);
        const questTitle = nameInput.val().trim();

        if (questTitle) {
            // Ensure structured format exists
            if (!extensionSettings.questsV2) {
                extensionSettings.questsV2 = { main: null, optional: [] };
            }
            
            if (field === 'main') {
                extensionSettings.questsV2.main = { name: questTitle, description: '' };
            } else {
                if (!extensionSettings.questsV2.optional) {
                    extensionSettings.questsV2.optional = [];
                }
                extensionSettings.questsV2.optional.push({ name: questTitle, description: '' });
            }
            
            openAddForms[field] = false;
            saveSettings();
            saveChatData();
            renderQuests();
        }
    });

    // Remove quest
    $questsContainer.find('[data-action="remove-quest"]').off('click').on('click', function() {
        const field = $(this).data('field');
        const index = $(this).data('index');

        if (field === 'main') {
            if (extensionSettings.questsV2) {
                extensionSettings.questsV2.main = null;
            }
        } else {
            if (extensionSettings.questsV2?.optional) {
                extensionSettings.questsV2.optional.splice(index, 1);
            }
        }
        saveSettings();
        saveChatData();
        renderQuests();
    });

    // Inline editing for quests (name and description) - matching items/skills pattern
    $questsContainer.off('blur', '.rpg-item-name.rpg-editable, .rpg-item-description.rpg-editable')
        .on('blur', '.rpg-item-name.rpg-editable, .rpg-item-description.rpg-editable', function() {
        const $this = $(this);
        const field = $this.data('field');
        const index = $this.data('index');
        const prop = $this.data('prop') || 'name';
        const newValue = $this.text().trim();

        // Ensure structured format exists
        if (!extensionSettings.questsV2) {
            extensionSettings.questsV2 = { main: null, optional: [] };
        }

        if (field === 'main') {
            // Update main quest
            if (!extensionSettings.questsV2.main) {
                extensionSettings.questsV2.main = { name: '', description: '' };
            }
            extensionSettings.questsV2.main[prop] = newValue;
        } else if (field === 'optional' && index !== undefined) {
            // Update optional quest
            if (!extensionSettings.questsV2.optional[index]) {
                extensionSettings.questsV2.optional[index] = { name: '', description: '' };
            }
            extensionSettings.questsV2.optional[index][prop] = newValue;
        }
        
        saveSettings();
        saveChatData();
    });

    // Enter key to save in forms (matching items/skills pattern)
    $questsContainer.find('.rpg-inline-input').off('keypress').on('keypress', function(e) {
        if (e.which === 13) {
            const field = $(this).attr('id').replace('rpg-new-quest-', '');
            $(`[data-action="save-add-quest"][data-field="${field}"]`).click();
        }
    });
}
