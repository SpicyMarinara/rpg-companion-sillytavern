/**
 * Quests Rendering Module
 * Handles UI rendering for quests system (main and optional quests)
 */

import { extensionSettings, $questsContainer, committedTrackerData, lastGeneratedData } from '../../core/state.js';
import { saveSettings, saveChatData } from '../../core/persistence.js';
import { isItemLocked, setItemLock } from '../generation/lockManager.js';

/**
 * Syncs the current extensionSettings.quests to committedTrackerData.userStats
 * This ensures quest changes made via UI are reflected in the data sent to AI
 */
function syncQuestsToCommittedData() {
    const currentData = committedTrackerData.userStats || lastGeneratedData.userStats;
    if (!currentData) return;

    const trimmed = currentData.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
            const jsonData = JSON.parse(currentData);
            if (jsonData && typeof jsonData === 'object') {
                // Update quests in the JSON data
                jsonData.quests = extensionSettings.quests || { main: 'None', optional: [] };
                const updatedJSON = JSON.stringify(jsonData, null, 2);
                committedTrackerData.userStats = updatedJSON;
                lastGeneratedData.userStats = updatedJSON;
            }
        } catch (e) {
            console.warn('[RPG Quests] Failed to sync quests to committed data:', e);
        }
    }
}

/**
 * Helper to generate lock icon HTML if setting is enabled
 * @param {string} tracker - Tracker name
 * @param {string} path - Item path
 * @returns {string} Lock icon HTML or empty string
 */
function getLockIconHtml(tracker, path) {
    const showLockIcons = extensionSettings.showLockIcons ?? true;
    if (!showLockIcons) return '';

    const isLocked = isItemLocked(tracker, path);
    const lockIcon = isLocked ? '🔒' : '🔓';
    const lockTitle = isLocked ? 'Locked' : 'Unlocked';
    const lockedClass = isLocked ? ' locked' : '';
    return `<span class="rpg-section-lock-icon${lockedClass}" data-tracker="${tracker}" data-path="${path}" title="${lockTitle}">${lockIcon}</span>`;
}

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
 * Renders the quests sub-tab navigation (Main, Optional)
 * @param {string} activeTab - Currently active sub-tab ('main', 'optional')
 * @returns {string} HTML for sub-tab navigation
 */
export function renderQuestsSubTabs(activeTab = 'main') {
    return `
        <div class="rpg-quests-subtabs">
            <button class="rpg-quests-subtab ${activeTab === 'main' ? 'active' : ''}" data-tab="main">
                Main Quest
            </button>
            <button class="rpg-quests-subtab ${activeTab === 'optional' ? 'active' : ''}" data-tab="optional">
                Optional Quests
            </button>
        </div>
    `;
}

/**
 * Renders the main quest view
 * @param {string} mainQuest - Current main quest title
 * @returns {string} HTML for main quest view
 */
export function renderMainQuestView(mainQuest) {
    const questDisplay = (mainQuest && mainQuest !== 'None') ? mainQuest : '';
    const hasQuest = questDisplay.length > 0;

    return `
        <div class="rpg-quest-section">
            <div class="rpg-quest-header">
                <h3 class="rpg-quest-section-title">Main Quests</h3>
                ${!hasQuest ? `<button class="rpg-add-quest-btn" data-action="add-quest" data-field="main" title="Add main quests">
                    <i class="fa-solid fa-plus"></i> Add Quest
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
                        ${getLockIconHtml('userStats', 'quests.main')}
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
                        <input type="text" class="rpg-inline-input" id="rpg-new-quest-main" placeholder="Enter main quests title..." />
                        <div class="rpg-inline-actions">
                            <button class="rpg-inline-btn rpg-inline-cancel" data-action="cancel-add-quest" data-field="main">
                                <i class="fa-solid fa-times"></i> Cancel
                            </button>
                            <button class="rpg-inline-btn rpg-inline-save" data-action="save-add-quest" data-field="main">
                                <i class="fa-solid fa-check"></i> Add
                            </button>
                        </div>
                    </div>
                    <div class="rpg-quest-empty">No active main quests</div>
                `}
            </div>
            <div class="rpg-quest-hint">
                <i class="fa-solid fa-lightbulb"></i>
                The main quests represent your primary objective in the story.
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
    const quests = optionalQuests.filter(q => q && q !== 'None');

    let questsHtml = '';
    if (quests.length === 0) {
        questsHtml = '<div class="rpg-quest-empty">No active optional quests</div>';
    } else {
        questsHtml = quests.map((quest, index) => {
            return `
            <div class="rpg-quest-item" data-field="optional" data-index="${index}">
                ${getLockIconHtml('userStats', `quests.optional[${index}]`)}
                <div class="rpg-quest-title rpg-editable" contenteditable="true" data-field="optional" data-index="${index}" title="Click to edit">${escapeHtml(quest)}</div>
                <div class="rpg-quest-actions">
                    <button class="rpg-quest-remove" data-action="remove-quest" data-field="optional" data-index="${index}" title="Complete/Remove quest">
                        <i class="fa-solid fa-check"></i>
                    </button>
                </div>
            </div>
        `}).join('');
    }

    return `
        <div class="rpg-quest-section">
            <div class="rpg-quest-header">
                <h3 class="rpg-quest-section-title">Optional Quests</h3>
                <button class="rpg-add-quest-btn" data-action="add-quest" data-field="optional" title="Add optional quest">
                    <i class="fa-solid fa-plus"></i> Add Quest
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
                <div class="rpg-quest-hint">
                    <i class="fa-solid fa-info-circle"></i>
                    Optional quests are side objectives that complement your main story.
                </div>
            </div>
        </div>
    `;
}

/**
 * Main render function for quests
 */
export function renderQuests() {
    if (!extensionSettings.showInventory || !$questsContainer) {
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
        const input = $(`#rpg-new-quest-${field}`);
        const questTitle = input.val().trim();

        if (questTitle) {
            if (field === 'main') {
                extensionSettings.quests.main = questTitle;
            } else {
                if (!extensionSettings.quests.optional) {
                    extensionSettings.quests.optional = [];
                }
                extensionSettings.quests.optional.push(questTitle);
            }
            // Sync quest changes to committedTrackerData so AI sees the addition
            syncQuestsToCommittedData();
            saveSettings();
            saveChatData();
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

    // Save edit quest
    $questsContainer.find('[data-action="save-edit-quest"]').on('click', function() {
        const field = $(this).data('field');
        const input = $(`#rpg-edit-quest-${field}`);
        const questTitle = input.val().trim();

        if (questTitle) {
            extensionSettings.quests.main = questTitle;
            // Sync quest changes to committedTrackerData so AI sees the edit
            syncQuestsToCommittedData();
            saveSettings();
            saveChatData();
            renderQuests();
        }
    });

    // Remove quest
    $questsContainer.find('[data-action="remove-quest"]').on('click', function() {
        const field = $(this).data('field');
        const index = $(this).data('index');

        if (field === 'main') {
            extensionSettings.quests.main = 'None';
        } else {
            extensionSettings.quests.optional.splice(index, 1);
        }
        // Sync quest changes to committedTrackerData so AI sees the removal
        syncQuestsToCommittedData();
        saveSettings();
        saveChatData();
        renderQuests();
    });

    // Inline editing for optional quests
    $questsContainer.find('.rpg-quest-title.rpg-editable').on('blur', function() {
        const $this = $(this);
        const field = $this.data('field');
        const index = $this.data('index');
        const newTitle = $this.text().trim();

        if (newTitle && field === 'optional' && index !== undefined) {
            extensionSettings.quests.optional[index] = newTitle;
            // Sync quest changes to committedTrackerData so AI sees the edit
            syncQuestsToCommittedData();
            saveSettings();
            saveChatData();
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

    // Add event listener for section lock icon clicks (support both click and touch)
    $questsContainer.find('.rpg-section-lock-icon').on('click touchend', function(e) {
        e.preventDefault();
        e.stopPropagation();
        const $icon = $(this);
        const trackerType = $icon.data('tracker');
        const itemPath = $icon.data('path');
        const currentlyLocked = isItemLocked(trackerType, itemPath);

        // Toggle lock state
        setItemLock(trackerType, itemPath, !currentlyLocked);

        // Update icon
        const newIcon = !currentlyLocked ? '🔒' : '🔓';
        const newTitle = !currentlyLocked ? 'Locked' : 'Unlocked';
        $icon.text(newIcon);
        $icon.attr('title', newTitle);

        // Toggle 'locked' class for persistent visibility
        $icon.toggleClass('locked', !currentlyLocked);

        // Save settings
        saveSettings();
    });
}
