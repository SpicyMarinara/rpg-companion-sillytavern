/**
 * Tracker Editor Module
 * Provides UI for customizing tracker configurations
 */
import { i18n } from '../../core/i18n.js';
import { extensionSettings } from '../../core/state.js';
import {
    saveSettings,
    getPresets,
    getPreset,
    getActivePresetId,
    getDefaultPresetId,
    setDefaultPreset,
    isDefaultPreset,
    createPreset,
    saveToPreset,
    loadPreset,
    renamePreset,
    deletePreset,
    associatePresetWithCurrentEntity,
    removePresetAssociationForCurrentEntity,
    getPresetForCurrentEntity,
    hasPresetAssociation,
    getCurrentEntityName,
    exportPresets,
    importPresets
} from '../../core/persistence.js';
import { renderUserStats } from '../rendering/userStats.js';
import { renderInfoBox } from '../rendering/infoBox.js';
import { renderThoughts } from '../rendering/thoughts.js';

let $editorModal = null;
let activeTab = 'userStats';
let tempConfig = null; // Temporary config for cancel functionality

/**
 * Initialize the tracker editor modal
 */
export function initTrackerEditor() {
    // Modal will be in template.html, just set up event listeners
    $editorModal = $('#rpg-tracker-editor-popup');

    if (!$editorModal.length) {
        console.error('[RPG Companion] Tracker editor modal not found in template');
        return;
    }

    // Tab switching
    $(document).on('click', '.rpg-editor-tab', function() {
        $('.rpg-editor-tab').removeClass('active');
        $(this).addClass('active');

        activeTab = $(this).data('tab');
        $('.rpg-editor-tab-content').hide();
        $(`#rpg-editor-tab-${activeTab}`).show();
    });

    // Save button
    $(document).on('click', '#rpg-editor-save', function() {
        applyTrackerConfig();
        closeTrackerEditor();
    });

    // Cancel button
    $(document).on('click', '#rpg-editor-cancel', function() {
        closeTrackerEditor();
    });

    // Close X button
    $(document).on('click', '#rpg-close-tracker-editor', function() {
        closeTrackerEditor();
    });

    // Reset button
    $(document).on('click', '#rpg-editor-reset', function() {
        resetToDefaults();
        renderEditorUI();
    });

    // Close on background click
    $(document).on('click', '#rpg-tracker-editor-popup', function(e) {
        if (e.target.id === 'rpg-tracker-editor-popup') {
            closeTrackerEditor();
        }
    });

    // Open button
    $(document).on('click', '#rpg-open-tracker-editor', function() {
        openTrackerEditor();
    });

    // Export button
    $(document).on('click', '#rpg-editor-export', function() {
        exportTrackerPreset();
    });

    // Import button
    $(document).on('click', '#rpg-editor-import', function() {
        importTrackerPreset();
    });

    // Preset select change
    $(document).on('change', '#rpg-preset-select', function() {
        const presetId = $(this).val();
        if (presetId && presetId !== getActivePresetId()) {
            // Save current changes to the old preset before switching
            const currentPresetId = getActivePresetId();
            if (currentPresetId) {
                saveToPreset(currentPresetId);
            }
            // Load the new preset
            if (loadPreset(presetId)) {
                tempConfig = JSON.parse(JSON.stringify(extensionSettings.trackerConfig));
                renderEditorUI();
                updatePresetUI();
                toastr.success(`Switched to preset "${getPreset(presetId)?.name || 'Unknown'}".`);
            }
        }
    });

    // New preset button
    $(document).on('click', '#rpg-preset-new', function() {
        const name = prompt('Enter a name for the new preset:');
        if (name && name.trim()) {
            const newId = createPreset(name.trim());
            updatePresetUI();
            $('#rpg-preset-select').val(newId);
            toastr.success(`Created preset "${name.trim()}".`);
        }
    });

    // Set as default preset button
    $(document).on('click', '#rpg-preset-default', function() {
        const currentPresetId = getActivePresetId();
        if (currentPresetId) {
            setDefaultPreset(currentPresetId);
            updatePresetUI();
            const preset = getPreset(currentPresetId);
            toastr.success(`"${preset?.name || 'Unknown'}" is now the default preset.`);
        }
    });

    // Delete preset button
    $(document).on('click', '#rpg-preset-delete', function() {
        const currentPresetId = getActivePresetId();
        const presets = getPresets();
        if (Object.keys(presets).length <= 1) {
            toastr.warning('Cannot delete the last preset.');
            return;
        }
        const preset = getPreset(currentPresetId);
        if (confirm(`Are you sure you want to delete the preset "${preset?.name || 'Unknown'}"?`)) {
            if (deletePreset(currentPresetId)) {
                tempConfig = JSON.parse(JSON.stringify(extensionSettings.trackerConfig));
                renderEditorUI();
                updatePresetUI();
                toastr.success('Preset deleted.');
            }
        }
    });

    // Associate preset checkbox
    $(document).on('change', '#rpg-preset-associate', function() {
        if ($(this).is(':checked')) {
            associatePresetWithCurrentEntity();
            toastr.info(`This preset will be used for ${getCurrentEntityName()}.`);
        } else {
            removePresetAssociationForCurrentEntity();
            toastr.info(`Preset association removed for ${getCurrentEntityName()}.`);
        }
    });
}

/**
 * Updates the preset management UI (dropdown, association checkbox, entity name)
 */
function updatePresetUI() {
    const presets = getPresets();
    const activePresetId = getActivePresetId();
    const defaultPresetId = getDefaultPresetId();
    const $select = $('#rpg-preset-select');

    // Populate the dropdown
    $select.empty();
    for (const [id, preset] of Object.entries(presets)) {
        const isDefault = id === defaultPresetId;
        const starPrefix = isDefault ? '★ ' : '';
        $select.append(`<option value="${id}">${starPrefix}${preset.name}</option>`);
    }
    $select.val(activePresetId);

    // Update the default button appearance
    const $defaultBtn = $('#rpg-preset-default');
    if (isDefaultPreset(activePresetId)) {
        $defaultBtn.addClass('rpg-btn-active').attr('title', 'This is the default preset');
    } else {
        $defaultBtn.removeClass('rpg-btn-active').attr('title', 'Set as Default Preset');
    }

    // Update the entity name display
    const entityName = getCurrentEntityName();
    $('#rpg-preset-entity-name').text(entityName);

    // Update the association checkbox
    const isAssociated = hasPresetAssociation();
    $('#rpg-preset-associate').prop('checked', isAssociated);
}

/**
 * Open the tracker editor modal
 */
function openTrackerEditor() {
    // Create temporary copy for cancel functionality
    tempConfig = JSON.parse(JSON.stringify(extensionSettings.trackerConfig));

    // Set theme to match current extension theme
    const theme = extensionSettings.theme || 'modern';
    $editorModal.attr('data-theme', theme);

    // Update preset UI
    updatePresetUI();

    renderEditorUI();
    $editorModal.addClass('is-open').css('display', '');
}

/**
 * Close the tracker editor modal
 */
function closeTrackerEditor() {
    // Restore from temp if canceling
    if (tempConfig) {
        extensionSettings.trackerConfig = tempConfig;
        tempConfig = null;
    }

    $editorModal.removeClass('is-open').addClass('is-closing');
    setTimeout(() => {
        $editorModal.removeClass('is-closing').hide();
    }, 200);
}

/**
 * Apply the tracker configuration and refresh all trackers
 */
function applyTrackerConfig() {
    tempConfig = null; // Clear temp config

    // Save to the current preset
    const currentPresetId = getActivePresetId();
    if (currentPresetId) {
        saveToPreset(currentPresetId);
    } else {
        saveSettings();
    }

    // Re-render all trackers with new config
    renderUserStats();
    renderInfoBox();
    renderThoughts();
}

/**
 * Reset configuration to defaults
 */
function resetToDefaults() {
    extensionSettings.trackerConfig = {
        userStats: {
            customStats: [
                { id: 'health', name: 'Health', enabled: true, persistInHistory: false },
                { id: 'satiety', name: 'Satiety', enabled: true, persistInHistory: false },
                { id: 'energy', name: 'Energy', enabled: true, persistInHistory: false },
                { id: 'hygiene', name: 'Hygiene', enabled: true, persistInHistory: false },
                { id: 'arousal', name: 'Arousal', enabled: true, persistInHistory: false }
            ],
            showRPGAttributes: true,
            rpgAttributes: [
                { id: 'str', name: 'STR', enabled: true, persistInHistory: false },
                { id: 'dex', name: 'DEX', enabled: true, persistInHistory: false },
                { id: 'con', name: 'CON', enabled: true, persistInHistory: false },
                { id: 'int', name: 'INT', enabled: true, persistInHistory: false },
                { id: 'wis', name: 'WIS', enabled: true, persistInHistory: false },
                { id: 'cha', name: 'CHA', enabled: true, persistInHistory: false }
            ],
            statusSection: {
                enabled: true,
                showMoodEmoji: true,
                customFields: ['Conditions'],
                persistInHistory: false
            },
            skillsSection: {
                enabled: false,
                label: 'Skills',
                customFields: [],
                persistInHistory: false
            },
            inventoryPersistInHistory: false,
            questsPersistInHistory: false
        },
        infoBox: {
            widgets: {
                date: { enabled: true, format: 'Weekday, Month, Year', persistInHistory: true },
                weather: { enabled: true, persistInHistory: true },
                temperature: { enabled: true, unit: 'C', persistInHistory: false },
                time: { enabled: true, persistInHistory: true },
                location: { enabled: true, persistInHistory: true },
                recentEvents: { enabled: true, persistInHistory: false }
            }
        },
        presentCharacters: {
            showEmoji: true,
            showName: true,
            relationships: {
                enabled: true,
                relationshipEmojis: {
                    'Lover': '❤️',
                    'Friend': '⭐',
                    'Ally': '🤝',
                    'Enemy': '⚔️',
                    'Neutral': '⚖️'
                }
            },
            relationshipFields: ['Lover', 'Friend', 'Ally', 'Enemy', 'Neutral'],
            relationshipEmojis: {
                'Lover': '❤️',
                'Friend': '⭐',
                'Ally': '🤝',
                'Enemy': '⚔️',
                'Neutral': '⚖️'
            },
            customFields: [
                { id: 'appearance', name: 'Appearance', enabled: true, description: 'Visible physical appearance (clothing, hair, notable features)', persistInHistory: false },
                { id: 'demeanor', name: 'Demeanor', enabled: true, description: 'Observable demeanor or emotional state', persistInHistory: false }
            ],
            thoughts: {
                enabled: true,
                name: 'Thoughts',
                description: 'Internal Monologue (in first person from character\'s POV, up to three sentences long)',
                persistInHistory: false
            },
            characterStats: {
                enabled: false,
                customStats: [
                    { id: 'health', name: 'Health', enabled: true, colorLow: '#ff4444', colorHigh: '#44ff44' },
                    { id: 'energy', name: 'Energy', enabled: true, colorLow: '#ffaa00', colorHigh: '#44ffff' }
                ]
            }
        }
    };
    // Reset history persistence settings
    extensionSettings.historyPersistence = {
        enabled: false,
        messageCount: 5,
        injectionPosition: 'assistant_message_end',
        contextPreamble: ''
    };
}

/**
 * Export current tracker configuration to a JSON file
 */
function exportTrackerPreset() {
    try {
        // Get the current tracker configuration
        const config = extensionSettings.trackerConfig;
        const historyPersistence = extensionSettings.historyPersistence;

        // Create a preset object with metadata
        const preset = {
            name: 'Custom Tracker Preset',
            version: '1.1', // Bumped version for historyPersistence support
            exportDate: new Date().toISOString(),
            trackerConfig: JSON.parse(JSON.stringify(config)), // Deep copy
            historyPersistence: historyPersistence ? JSON.parse(JSON.stringify(historyPersistence)) : null // Include history persistence settings
        };

        // Convert to JSON
        const jsonString = JSON.stringify(preset, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });

        // Create download link
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;

        // Generate filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        link.download = `rpg-tracker-preset-${timestamp}.json`;

        // Trigger download
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        // console.log('[RPG Companion] Tracker preset exported successfully');
        toastr.success(i18n.getTranslation('template.trackerEditorModal.messages.exportSuccess') || 'Tracker preset exported successfully!');
    } catch (error) {
        console.error('[RPG Companion] Error exporting tracker preset:', error);
        toastr.error(i18n.getTranslation('template.trackerEditorModal.messages.exportError') || 'Failed to export tracker preset. Check console for details.');
    }
}

/**
 * Migrates old tracker preset format to current format
 * @param {Object} config - The tracker config to migrate
 * @returns {Object} - Migrated tracker config
 */
function migrateTrackerPreset(config) {
    // Create a deep copy to avoid modifying the original
    const migrated = JSON.parse(JSON.stringify(config));

    // Migrate relationships structure (v3.0.0 -> v3.1.0)
    if (migrated.presentCharacters) {
        // Old format: relationshipEmojis directly on presentCharacters
        // New format: relationships.relationshipEmojis
        if (migrated.presentCharacters.relationshipEmojis &&
            !migrated.presentCharacters.relationships) {
            migrated.presentCharacters.relationships = {
                enabled: migrated.presentCharacters.enableRelationships || true,
                relationshipEmojis: migrated.presentCharacters.relationshipEmojis
            };
            // Keep legacy fields for backward compatibility
            migrated.presentCharacters.relationshipFields = Object.keys(migrated.presentCharacters.relationshipEmojis);
        }

        // Ensure relationships object exists
        if (!migrated.presentCharacters.relationships) {
            migrated.presentCharacters.relationships = {
                enabled: false,
                relationshipEmojis: {}
            };
        }

        // Ensure relationshipEmojis exists within relationships
        if (!migrated.presentCharacters.relationships.relationshipEmojis) {
            migrated.presentCharacters.relationships.relationshipEmojis = {};
        }

        // Add persistInHistory to customFields if missing (v3.4.0)
        if (migrated.presentCharacters.customFields) {
            migrated.presentCharacters.customFields = migrated.presentCharacters.customFields.map(field => ({
                ...field,
                persistInHistory: field.persistInHistory ?? false
            }));
        }

        // Add persistInHistory to thoughts if missing (v3.4.0)
        if (migrated.presentCharacters.thoughts && migrated.presentCharacters.thoughts.persistInHistory === undefined) {
            migrated.presentCharacters.thoughts.persistInHistory = false;
        }
    }

    // Add persistInHistory to userStats fields if missing (v3.4.0)
    if (migrated.userStats) {
        // Custom stats
        if (migrated.userStats.customStats) {
            migrated.userStats.customStats = migrated.userStats.customStats.map(stat => ({
                ...stat,
                persistInHistory: stat.persistInHistory ?? false
            }));
        }

        // RPG Attributes
        if (migrated.userStats.rpgAttributes) {
            migrated.userStats.rpgAttributes = migrated.userStats.rpgAttributes.map(attr => ({
                ...attr,
                persistInHistory: attr.persistInHistory ?? false
            }));
        }

        // Status section
        if (migrated.userStats.statusSection && migrated.userStats.statusSection.persistInHistory === undefined) {
            migrated.userStats.statusSection.persistInHistory = false;
        }

        // Skills section
        if (migrated.userStats.skillsSection && migrated.userStats.skillsSection.persistInHistory === undefined) {
            migrated.userStats.skillsSection.persistInHistory = false;
        }

        // Inventory and quests persistence
        if (migrated.userStats.inventoryPersistInHistory === undefined) {
            migrated.userStats.inventoryPersistInHistory = false;
        }
        if (migrated.userStats.questsPersistInHistory === undefined) {
            migrated.userStats.questsPersistInHistory = false;
        }
    }

    // Add persistInHistory to infoBox widgets if missing (v3.4.0)
    if (migrated.infoBox && migrated.infoBox.widgets) {
        const defaultPersistence = {
            date: true,
            weather: true,
            temperature: false,
            time: true,
            location: true,
            recentEvents: false
        };

        for (const [widgetId, widget] of Object.entries(migrated.infoBox.widgets)) {
            if (widget.persistInHistory === undefined) {
                widget.persistInHistory = defaultPersistence[widgetId] ?? false;
            }
        }
    }

    return migrated;
}

/**
 * Import tracker configuration from a JSON file
 */
function importTrackerPreset() {
    // Create file input
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const data = JSON.parse(text);

            // Validate the imported data
            if (!data.trackerConfig) {
                throw new Error('Invalid preset file: missing trackerConfig');
            }

            // Validate required sections
            if (!data.trackerConfig.userStats || !data.trackerConfig.infoBox || !data.trackerConfig.presentCharacters) {
                throw new Error('Invalid preset file: missing required configuration sections');
            }

            // Migrate old preset format to current format
            const migratedConfig = migrateTrackerPreset(data.trackerConfig);

            // Extract historyPersistence if present in the import file
            const historyPersistence = data.historyPersistence || null;

            // Show import mode selection dialog
            showImportModeDialog(migratedConfig, data.name || file.name.replace('.json', ''), historyPersistence);
        } catch (error) {
            console.error('[RPG Companion] Error importing tracker preset:', error);
            toastr.error(i18n.getTranslation('template.trackerEditorModal.messages.importError') ||
                `Failed to import tracker preset: ${error.message}`);
        }
    };

    // Trigger file selection
    input.click();
}

/**
 * Show dialog to choose import mode
 * @param {Object} migratedConfig - The migrated tracker config
 * @param {string} suggestedName - Suggested name for new preset
 * @param {Object|null} historyPersistence - The history persistence settings from import (if any)
 */
function showImportModeDialog(migratedConfig, suggestedName, historyPersistence = null) {
    // Create dialog overlay
    const dialogHtml = `
        <div id="rpg-import-mode-dialog" class="rpg-import-dialog-overlay">
            <div class="rpg-import-dialog">
                <h4><i class="fa-solid fa-file-import"></i> Import Configuration</h4>
                <p>How would you like to import this configuration?</p>
                <div class="rpg-import-dialog-buttons">
                    <button id="rpg-import-to-current" class="rpg-btn-secondary">
                        <i class="fa-solid fa-arrow-right-to-bracket"></i>
                        Apply to Current Preset
                    </button>
                    <button id="rpg-import-as-new" class="rpg-btn-primary">
                        <i class="fa-solid fa-plus"></i>
                        Create New Preset
                    </button>
                </div>
                <button id="rpg-import-cancel" class="rpg-btn-cancel">Cancel</button>
            </div>
        </div>
    `;

    $('body').append(dialogHtml);
    const $dialog = $('#rpg-import-mode-dialog');

    // Import to current preset
    $('#rpg-import-to-current').on('click', () => {
        $dialog.remove();

        // Apply the migrated configuration to current
        extensionSettings.trackerConfig = migratedConfig;

        // Apply historyPersistence settings if present in import
        if (historyPersistence) {
            extensionSettings.historyPersistence = historyPersistence;
        }

        // Save to the active preset (saveToPreset uses current trackerConfig)
        const activePresetId = getActivePresetId();
        if (activePresetId) {
            saveToPreset(activePresetId);
        }

        // Re-render the editor UI
        renderEditorUI();

        toastr.success('Configuration applied to current preset.');
    });

    // Import as new preset
    $('#rpg-import-as-new').on('click', () => {
        $dialog.remove();

        // Prompt for preset name
        const presetName = prompt('Enter a name for the new preset:', suggestedName);
        if (!presetName) return;

        // Set the migrated config as current first
        extensionSettings.trackerConfig = migratedConfig;

        // Apply historyPersistence settings if present in import
        if (historyPersistence) {
            extensionSettings.historyPersistence = historyPersistence;
        }

        // Create new preset (createPreset uses current trackerConfig)
        const newPresetId = createPreset(presetName);
        if (newPresetId) {
            // Load the new preset
            loadPreset(newPresetId);
            renderEditorUI();
            updatePresetUI();
            toastr.success(`Created new preset: ${presetName}.`);
        }
    });

    // Cancel
    $('#rpg-import-cancel').on('click', () => {
        $dialog.remove();
    });

    // Close on overlay click
    $dialog.on('click', (e) => {
        if (e.target === $dialog[0]) {
            $dialog.remove();
        }
    });
}

/**
 * Render the editor UI based on current config
 */
function renderEditorUI() {
    renderUserStatsTab();
    renderInfoBoxTab();
    renderPresentCharactersTab();
    renderHistoryPersistenceTab();
}

/**
 * Render User Stats configuration tab
 */
function renderUserStatsTab() {
    const config = extensionSettings.trackerConfig.userStats;
    let html = '<div class="rpg-editor-section">';

    // Custom Stats section
    html += `<h4><i class="fa-solid fa-heart-pulse"></i> ${i18n.getTranslation('template.trackerEditorModal.userStatsTab.customStatsTitle')}</h4>`;
    html += '<div class="rpg-editor-stats-list" id="rpg-editor-stats-list">';

    config.customStats.forEach((stat, index) => {
        html += `
            <div class="rpg-editor-stat-item" data-index="${index}">
                <input type="checkbox" ${stat.enabled ? 'checked' : ''} class="rpg-stat-toggle" data-index="${index}">
                <input type="text" value="${stat.name}" class="rpg-stat-name" data-index="${index}" placeholder="Stat Name">
                <button class="rpg-stat-remove" data-index="${index}" title="Remove stat"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
    });

    html += '</div>';
    html += `<button class="rpg-btn-secondary" id="rpg-add-stat"><i class="fa-solid fa-plus"></i> ${i18n.getTranslation('template.trackerEditorModal.userStatsTab.addCustomStatButton')}</button>`;

    // RPG Attributes section
    html += `<h4><i class="fa-solid fa-dice-d20"></i> ${i18n.getTranslation('template.trackerEditorModal.userStatsTab.rpgAttributesTitle')}</h4>`;

    // Enable/disable toggle for entire RPG Attributes section
    const showRPGAttributes = config.showRPGAttributes !== undefined ? config.showRPGAttributes : true;
    html += '<div class="rpg-editor-toggle-row">';
    html += `<input type="checkbox" id="rpg-show-rpg-attrs" ${showRPGAttributes ? 'checked' : ''}>`;
    html += `<label for="rpg-show-rpg-attrs">${i18n.getTranslation('template.trackerEditorModal.userStatsTab.enableRpgAttributes')}</label>`;
    html += '</div>';

    // Show/hide level toggle
    const showLevel = config.showLevel !== undefined ? config.showLevel : true;
    html += '<div class="rpg-editor-toggle-row">';
    html += `<input type="checkbox" id="rpg-show-level" ${showLevel ? 'checked' : ''}>`;
    html += `<label for="rpg-show-level">Show Level</label>`;
    html += '</div>';

    // Always send attributes toggle
    const alwaysSendAttributes = config.alwaysSendAttributes !== undefined ? config.alwaysSendAttributes : false;
    html += '<div class="rpg-editor-toggle-row">';
    html += `<input type="checkbox" id="rpg-always-send-attrs" ${alwaysSendAttributes ? 'checked' : ''}>`;
    html += `<label for="rpg-always-send-attrs">${i18n.getTranslation('template.trackerEditorModal.userStatsTab.alwaysIncludeAttributes')}</label>`;
    html += '</div>';
    html += `<small class="rpg-editor-note">${i18n.getTranslation('template.trackerEditorModal.userStatsTab.alwaysIncludeAttributesNote')}</small>`;

    html += '<div class="rpg-editor-stats-list" id="rpg-editor-attrs-list">';

    // Ensure rpgAttributes exists in the actual config (not just local fallback)
    if (!config.rpgAttributes || config.rpgAttributes.length === 0) {
        config.rpgAttributes = [
            { id: 'str', name: 'STR', enabled: true },
            { id: 'dex', name: 'DEX', enabled: true },
            { id: 'con', name: 'CON', enabled: true },
            { id: 'int', name: 'INT', enabled: true },
            { id: 'wis', name: 'WIS', enabled: true },
            { id: 'cha', name: 'CHA', enabled: true }
        ];
        // Save the defaults back to the actual config
        extensionSettings.trackerConfig.userStats.rpgAttributes = config.rpgAttributes;
    }

    const rpgAttributes = config.rpgAttributes;

    rpgAttributes.forEach((attr, index) => {
        html += `
            <div class="rpg-editor-stat-item" data-index="${index}">
                <input type="checkbox" ${attr.enabled ? 'checked' : ''} class="rpg-attr-toggle" data-index="${index}">
                <input type="text" value="${attr.name}" class="rpg-attr-name" data-index="${index}" placeholder="Attribute Name">
                <button class="rpg-attr-remove" data-index="${index}" title="Remove attribute"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
    });

    html += '</div>';
    html += `<button class="rpg-btn-secondary" id="rpg-add-attr"><i class="fa-solid fa-plus"></i> ${i18n.getTranslation('template.trackerEditorModal.userStatsTab.addAttributeButton')}</button>`;

    // Status Section
    html += `<h4><i class="fa-solid fa-face-smile"></i> ${i18n.getTranslation('template.trackerEditorModal.userStatsTab.statusSectionTitle')}</h4>`;
    html += '<div class="rpg-editor-toggle-row">';
    html += `<input type="checkbox" id="rpg-status-enabled" ${config.statusSection.enabled ? 'checked' : ''}>`;
    html += `<label for="rpg-status-enabled">${i18n.getTranslation('template.trackerEditorModal.userStatsTab.enableStatusSection')}</label>`;
    html += '</div>';

    html += '<div class="rpg-editor-toggle-row">';
    html += `<input type="checkbox" id="rpg-mood-emoji" ${config.statusSection.showMoodEmoji ? 'checked' : ''}>`;
    html += `<label for="rpg-mood-emoji">${i18n.getTranslation('template.trackerEditorModal.userStatsTab.showMoodEmoji')}</label>`;
    html += '</div>';

    html += `<label>${i18n.getTranslation('template.trackerEditorModal.userStatsTab.statusFieldsLabel')}</label>`;
    html += `<input type="text" id="rpg-status-fields" value="${config.statusSection.customFields.join(', ')}" class="rpg-text-input" placeholder="e.g., Conditions, Appearance">`;

    // Skills Section
    html += `<h4><i class="fa-solid fa-star"></i> ${i18n.getTranslation('template.trackerEditorModal.userStatsTab.skillsSectionTitle')}</h4>`;
    html += '<div class="rpg-editor-toggle-row">';
    html += `<input type="checkbox" id="rpg-skills-enabled" ${config.skillsSection.enabled ? 'checked' : ''}>`;
    html += `<label for="rpg-skills-enabled">${i18n.getTranslation('template.trackerEditorModal.userStatsTab.enableSkillsSection')}</label>`;
    html += '</div>';

    html += `<label>${i18n.getTranslation('template.trackerEditorModal.userStatsTab.skillsLabelLabel')}</label>`;
    html += `<input type="text" id="rpg-skills-label" value="${config.skillsSection.label}" class="rpg-text-input" placeholder="Skills">`;

    html += `<label>${i18n.getTranslation('template.trackerEditorModal.userStatsTab.skillsListLabel')}</label>`;
    const skillFields = config.skillsSection.customFields || [];
    html += `<input type="text" id="rpg-skills-fields" value="${skillFields.join(', ')}" class="rpg-text-input" placeholder="e.g., Stealth, Persuasion, Combat">`;

    html += '</div>';

    $('#rpg-editor-tab-userStats').html(html);
    setupUserStatsListeners();
}

/**
 * Set up event listeners for User Stats tab
 */
function setupUserStatsListeners() {
    // Add stat
    $('#rpg-add-stat').off('click').on('click', function() {
        const newId = 'custom_' + Date.now();
        extensionSettings.trackerConfig.userStats.customStats.push({
            id: newId,
            name: 'New Stat',
            enabled: true
        });
        // Initialize value if doesn't exist
        if (extensionSettings.userStats[newId] === undefined) {
            extensionSettings.userStats[newId] = 100;
        }
        renderUserStatsTab();
    });

    // Remove stat
    $('.rpg-stat-remove').off('click').on('click', function() {
        const index = $(this).data('index');
        extensionSettings.trackerConfig.userStats.customStats.splice(index, 1);
        renderUserStatsTab();
    });

    // Toggle stat
    $('.rpg-stat-toggle').off('change').on('change', function() {
        const index = $(this).data('index');
        extensionSettings.trackerConfig.userStats.customStats[index].enabled = $(this).is(':checked');
    });

    // Rename stat
    $('.rpg-stat-name').off('blur').on('blur', function() {
        const index = $(this).data('index');
        extensionSettings.trackerConfig.userStats.customStats[index].name = $(this).val();
    });

    // Add attribute
    $('#rpg-add-attr').off('click').on('click', function() {
        // Ensure rpgAttributes array exists with defaults if needed
        if (!extensionSettings.trackerConfig.userStats.rpgAttributes || extensionSettings.trackerConfig.userStats.rpgAttributes.length === 0) {
            extensionSettings.trackerConfig.userStats.rpgAttributes = [
                { id: 'str', name: 'STR', enabled: true },
                { id: 'dex', name: 'DEX', enabled: true },
                { id: 'con', name: 'CON', enabled: true },
                { id: 'int', name: 'INT', enabled: true },
                { id: 'wis', name: 'WIS', enabled: true },
                { id: 'cha', name: 'CHA', enabled: true }
            ];
        }
        const newId = 'attr_' + Date.now();
        extensionSettings.trackerConfig.userStats.rpgAttributes.push({
            id: newId,
            name: 'NEW',
            enabled: true
        });
        // Initialize value in classicStats if doesn't exist
        if (extensionSettings.classicStats[newId] === undefined) {
            extensionSettings.classicStats[newId] = 10;
        }
        renderUserStatsTab();
    });

    // Remove attribute
    $('.rpg-attr-remove').off('click').on('click', function() {
        const index = $(this).data('index');
        extensionSettings.trackerConfig.userStats.rpgAttributes.splice(index, 1);
        renderUserStatsTab();
    });

    // Toggle attribute
    $('.rpg-attr-toggle').off('change').on('change', function() {
        const index = $(this).data('index');
        extensionSettings.trackerConfig.userStats.rpgAttributes[index].enabled = $(this).is(':checked');
    });

    // Rename attribute
    $('.rpg-attr-name').off('blur').on('blur', function() {
        const index = $(this).data('index');
        extensionSettings.trackerConfig.userStats.rpgAttributes[index].name = $(this).val();
    });

    // Enable/disable RPG Attributes section toggle
    $('#rpg-show-rpg-attrs').off('change').on('change', function() {
        extensionSettings.trackerConfig.userStats.showRPGAttributes = $(this).is(':checked');
    });

    // Show/hide level toggle
    $('#rpg-show-level').off('change').on('change', function() {
        extensionSettings.trackerConfig.userStats.showLevel = $(this).is(':checked');
    });

    // Always send attributes toggle
    $('#rpg-always-send-attrs').off('change').on('change', function() {
        extensionSettings.trackerConfig.userStats.alwaysSendAttributes = $(this).is(':checked');
    });

    // Status section toggles
    $('#rpg-status-enabled').off('change').on('change', function() {
        extensionSettings.trackerConfig.userStats.statusSection.enabled = $(this).is(':checked');
    });

    $('#rpg-mood-emoji').off('change').on('change', function() {
        extensionSettings.trackerConfig.userStats.statusSection.showMoodEmoji = $(this).is(':checked');
    });

    $('#rpg-status-fields').off('blur').on('blur', function() {
        const fields = $(this).val().split(',').map(f => f.trim()).filter(f => f);
        extensionSettings.trackerConfig.userStats.statusSection.customFields = fields;
    });

    // Skills section toggles
    $('#rpg-skills-enabled').off('change').on('change', function() {
        extensionSettings.trackerConfig.userStats.skillsSection.enabled = $(this).is(':checked');
    });

    $('#rpg-skills-label').off('blur').on('blur', function() {
        extensionSettings.trackerConfig.userStats.skillsSection.label = $(this).val();
        saveSettings();
    });

    $('#rpg-skills-fields').off('blur').on('blur', function() {
        const fields = $(this).val().split(',').map(f => f.trim()).filter(f => f);
        extensionSettings.trackerConfig.userStats.skillsSection.customFields = fields;
        saveSettings();
    });
}

/**
 * Render Info Box configuration tab
 */
function renderInfoBoxTab() {
    const config = extensionSettings.trackerConfig.infoBox;
    let html = '<div class="rpg-editor-section">';

    html += `<h4><i class="fa-solid fa-info-circle"></i> ${i18n.getTranslation('template.trackerEditorModal.infoBoxTab.widgetsTitle')}</h4>`;

    // Date widget
    html += '<div class="rpg-editor-widget-row">';
    html += `<input type="checkbox" id="rpg-widget-date" ${config.widgets.date.enabled ? 'checked' : ''}>`;
    html += `<label for="rpg-widget-date">${i18n.getTranslation('template.trackerEditorModal.infoBoxTab.dateWidget')}</label>`;
    html += '<select id="rpg-date-format" class="rpg-select-mini">';
    html += `<option value="Weekday, Month, Year" ${config.widgets.date.format === 'Weekday, Month, Year' ? 'selected' : ''}>Weekday, Month, Year</option>`;
    html += `<option value="dd/mm/yyyy" ${config.widgets.date.format === 'dd/mm/yyyy' ? 'selected' : ''}>dd/mm/yyyy</option>`;
    html += `<option value="mm/dd/yyyy" ${config.widgets.date.format === 'mm/dd/yyyy' ? 'selected' : ''}>mm/dd/yyyy</option>`;
    html += `<option value="yyyy-mm-dd" ${config.widgets.date.format === 'yyyy-mm-dd' ? 'selected' : ''}>yyyy-mm-dd</option>`;
    html += '</select>';
    html += '</div>';

    // Weather widget
    html += '<div class="rpg-editor-widget-row">';
    html += `<input type="checkbox" id="rpg-widget-weather" ${config.widgets.weather.enabled ? 'checked' : ''}>`;
    html += `<label for="rpg-widget-weather">${i18n.getTranslation('template.trackerEditorModal.infoBoxTab.weatherWidget')}</label>`;
    html += '</div>';

    // Temperature widget
    html += '<div class="rpg-editor-widget-row">';
    html += `<input type="checkbox" id="rpg-widget-temperature" ${config.widgets.temperature.enabled ? 'checked' : ''}>`;
    html += `<label for="rpg-widget-temperature">${i18n.getTranslation('template.trackerEditorModal.infoBoxTab.temperatureWidget')}</label>`;
    html += '<div class="rpg-radio-group">';
    html += `<label><input type="radio" name="temp-unit" value="C" ${config.widgets.temperature.unit === 'C' ? 'checked' : ''}> °C</label>`;
    html += `<label><input type="radio" name="temp-unit" value="F" ${config.widgets.temperature.unit === 'F' ? 'checked' : ''}> °F</label>`;
    html += '</div>';
    html += '</div>';

    // Time widget
    html += '<div class="rpg-editor-widget-row">';
    html += `<input type="checkbox" id="rpg-widget-time" ${config.widgets.time.enabled ? 'checked' : ''}>`;
    html += `<label for="rpg-widget-time">${i18n.getTranslation('template.trackerEditorModal.infoBoxTab.timeWidget')}</label>`;
    html += '</div>';

    // Location widget
    html += '<div class="rpg-editor-widget-row">';
    html += `<input type="checkbox" id="rpg-widget-location" ${config.widgets.location.enabled ? 'checked' : ''}>`;
    html += `<label for="rpg-widget-location">${i18n.getTranslation('template.trackerEditorModal.infoBoxTab.locationWidget')}</label>`;
    html += '</div>';

    // Recent Events widget
    html += '<div class="rpg-editor-widget-row">';
    html += `<input type="checkbox" id="rpg-widget-events" ${config.widgets.recentEvents.enabled ? 'checked' : ''}>`;
    html += `<label for="rpg-widget-events">${i18n.getTranslation('template.trackerEditorModal.infoBoxTab.recentEventsWidget')}</label>`;
    html += '</div>';

    html += '</div>';

    $('#rpg-editor-tab-infoBox').html(html);
    setupInfoBoxListeners();
}

/**
 * Set up event listeners for Info Box tab
 */
function setupInfoBoxListeners() {
    const widgets = extensionSettings.trackerConfig.infoBox.widgets;

    $('#rpg-widget-date').off('change').on('change', function() {
        widgets.date.enabled = $(this).is(':checked');
    });

    $('#rpg-date-format').off('change').on('change', function() {
        widgets.date.format = $(this).val();
    });

    $('#rpg-widget-weather').off('change').on('change', function() {
        widgets.weather.enabled = $(this).is(':checked');
    });

    $('#rpg-widget-temperature').off('change').on('change', function() {
        widgets.temperature.enabled = $(this).is(':checked');
    });

    $('input[name="temp-unit"]').off('change').on('change', function() {
        widgets.temperature.unit = $(this).val();
    });

    $('#rpg-widget-time').off('change').on('change', function() {
        widgets.time.enabled = $(this).is(':checked');
    });

    $('#rpg-widget-location').off('change').on('change', function() {
        widgets.location.enabled = $(this).is(':checked');
    });

    $('#rpg-widget-events').off('change').on('change', function() {
        widgets.recentEvents.enabled = $(this).is(':checked');
    });
}

/**
 * Render Present Characters configuration tab
 */
function renderPresentCharactersTab() {
    const config = extensionSettings.trackerConfig.presentCharacters;
    let html = '<div class="rpg-editor-section">';

    // Relationship Fields Section
    html += `<h4><i class="fa-solid fa-heart"></i> ${i18n.getTranslation('template.trackerEditorModal.presentCharactersTab.relationshipStatusTitle')}</h4>`;

    // Toggle for enabling/disabling relationships
    const relationshipsEnabled = config.relationships?.enabled !== false; // Default to true if not set
    html += '<div class="rpg-editor-toggle-row">';
    html += `<input type="checkbox" id="rpg-relationships-enabled" ${relationshipsEnabled ? 'checked' : ''}>`;
    html += `<label for="rpg-relationships-enabled">${i18n.getTranslation('template.trackerEditorModal.presentCharactersTab.enableRelationshipStatus')}</label>`;
    html += '</div>';

    html += `<p class="rpg-editor-hint">${i18n.getTranslation('template.trackerEditorModal.presentCharactersTab.relationshipStatusHint')}</p>`;

    html += '<div class="rpg-relationship-mapping-list" id="rpg-relationship-mapping-list">';
    // Show existing relationships as field → emoji pairs
    const relationshipEmojis = config.relationships?.relationshipEmojis || config.relationshipEmojis || {
        'Lover': '❤️',
        'Friend': '⭐',
        'Ally': '🤝',
        'Enemy': '⚔️',
        'Neutral': '⚖️'
    };

    for (const [relationship, emoji] of Object.entries(relationshipEmojis)) {
        html += `
            <div class="rpg-relationship-item">
                <input type="text" value="${relationship}" class="rpg-relationship-name" placeholder="Relationship type">
                <span class="rpg-arrow">→</span>
                <input type="text" value="${emoji}" class="rpg-relationship-emoji" placeholder="Emoji" maxlength="4">
                <button class="rpg-remove-relationship" data-relationship="${relationship}" title="Remove"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
    }
    html += '</div>';
    html += `<button class="rpg-btn-secondary" id="rpg-add-relationship"><i class="fa-solid fa-plus"></i> ${i18n.getTranslation('template.trackerEditorModal.presentCharactersTab.newRelationshipButton')}</button>`;

    // Custom Fields Section
    html += `<h4><i class="fa-solid fa-list"></i> ${i18n.getTranslation('template.trackerEditorModal.presentCharactersTab.appearanceDemeanorTitle')}</h4>`;
    html += `<p class="rpg-editor-hint">${i18n.getTranslation('template.trackerEditorModal.presentCharactersTab.appearanceDemeanorHint')}</p>`;

    html += '<div class="rpg-editor-fields-list" id="rpg-editor-fields-list">';

    config.customFields.forEach((field, index) => {
        html += `
            <div class="rpg-editor-field-item" data-index="${index}">
                <div class="rpg-field-controls">
                    <button class="rpg-field-move-up" data-index="${index}" ${index === 0 ? 'disabled' : ''} title="Move up"><i class="fa-solid fa-arrow-up"></i></button>
                    <button class="rpg-field-move-down" data-index="${index}" ${index === config.customFields.length - 1 ? 'disabled' : ''} title="Move down"><i class="fa-solid fa-arrow-down"></i></button>
                </div>
                <input type="checkbox" ${field.enabled ? 'checked' : ''} class="rpg-field-toggle" data-index="${index}">
                <input type="text" value="${field.name}" class="rpg-field-label" data-index="${index}" placeholder="Field Name">
                <input type="text" value="${field.description || ''}" class="rpg-field-placeholder" data-index="${index}" placeholder="AI Instruction">
                <button class="rpg-field-remove" data-index="${index}" title="Remove field"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
    });

    html += '</div>';
    html += `<button class="rpg-btn-secondary" id="rpg-add-field"><i class="fa-solid fa-plus"></i> ${i18n.getTranslation('template.trackerEditorModal.presentCharactersTab.addCustomFieldButton')}</button>`;

    // Thoughts Section
    html += `<h4><i class="fa-solid fa-comment-dots"></i> ${i18n.getTranslation('template.trackerEditorModal.presentCharactersTab.thoughtsConfigTitle')}</h4>`;
    html += '<div class="rpg-editor-toggle-row">';
    html += `<input type="checkbox" id="rpg-thoughts-enabled" ${config.thoughts?.enabled ? 'checked' : ''}>`;
    html += `<label for="rpg-thoughts-enabled">${i18n.getTranslation('template.trackerEditorModal.presentCharactersTab.enableCharacterThoughts')}</label>`;
    html += '</div>';

    html += '<div class="rpg-thoughts-config">';
    html += '<div class="rpg-editor-input-group">';
    html += `<label>${i18n.getTranslation('template.trackerEditorModal.presentCharactersTab.thoughtsLabelLabel')}</label>`;
    html += `<input type="text" id="rpg-thoughts-name" value="${config.thoughts?.name || 'Thoughts'}" placeholder="e.g., Thoughts, Inner Voice, Feelings">`;
    html += '</div>';
    html += '<div class="rpg-editor-input-group">';
    html += `<label>${i18n.getTranslation('template.trackerEditorModal.presentCharactersTab.aiInstructionLabel')}</label>`;
    html += `<input type="text" id="rpg-thoughts-description" value="${config.thoughts?.description || 'Internal Monologue (in first person from character\'s POV, up to three sentences long)'}" placeholder="Description of what to generate">`;
    html += '</div>';
    html += '</div>';

    // Character Stats
    html += `<h4><i class="fa-solid fa-chart-bar"></i> ${i18n.getTranslation('template.trackerEditorModal.presentCharactersTab.characterStatsTitle')}</h4>`;
    html += '<div class="rpg-editor-toggle-row">';
    html += `<input type="checkbox" id="rpg-char-stats-enabled" ${config.characterStats?.enabled ? 'checked' : ''}>`;
    html += `<label for="rpg-char-stats-enabled">${i18n.getTranslation('template.trackerEditorModal.presentCharactersTab.trackCharacterStats')}</label>`;
    html += '</div>';

    html += `<p class="rpg-editor-hint">${i18n.getTranslation('template.trackerEditorModal.presentCharactersTab.characterStatsHint')}</p>`;
    html += '<div class="rpg-editor-fields-list" id="rpg-char-stats-list">';

    const charStats = config.characterStats?.customStats || [];
    charStats.forEach((stat, index) => {
        html += `
            <div class="rpg-editor-field-item" data-index="${index}">
                <input type="checkbox" ${stat.enabled ? 'checked' : ''} class="rpg-char-stat-toggle" data-index="${index}">
                <input type="text" value="${stat.name}" class="rpg-char-stat-label" data-index="${index}" placeholder="Stat Name (e.g., Health)">
                <button class="rpg-field-remove rpg-char-stat-remove" data-index="${index}" title="Remove stat"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
    });

    html += '</div>';
    html += `<button class="rpg-btn-secondary" id="rpg-add-char-stat"><i class="fa-solid fa-plus"></i> ${i18n.getTranslation('template.trackerEditorModal.presentCharactersTab.addCharacterStatButton')}</button>`;

    html += '</div>';

    $('#rpg-editor-tab-presentCharacters').html(html);
    setupPresentCharactersListeners();
}

/**
 * Set up event listeners for Present Characters tab
 */
function setupPresentCharactersListeners() {
    // Relationships enabled toggle
    $('#rpg-relationships-enabled').off('change').on('change', function() {
        if (!extensionSettings.trackerConfig.presentCharacters.relationships) {
            extensionSettings.trackerConfig.presentCharacters.relationships = { enabled: true, relationshipEmojis: {} };
        }
        extensionSettings.trackerConfig.presentCharacters.relationships.enabled = $(this).is(':checked');
    });

    // Add new relationship
    $('#rpg-add-relationship').off('click').on('click', function() {
        // Ensure relationships object exists
        if (!extensionSettings.trackerConfig.presentCharacters.relationships) {
            extensionSettings.trackerConfig.presentCharacters.relationships = { enabled: true, relationshipEmojis: {} };
        }
        if (!extensionSettings.trackerConfig.presentCharacters.relationships.relationshipEmojis) {
            extensionSettings.trackerConfig.presentCharacters.relationships.relationshipEmojis = {};
        }

        // Generate a unique relationship name
        let baseName = 'New Relationship';
        let relationshipName = baseName;
        let counter = 1;
        const existingRelationships = extensionSettings.trackerConfig.presentCharacters.relationships.relationshipEmojis;

        while (existingRelationships[relationshipName]) {
            counter++;
            relationshipName = `${baseName} ${counter}`;
        }

        // Add to new structure
        extensionSettings.trackerConfig.presentCharacters.relationships.relationshipEmojis[relationshipName] = '😊';

        // Also update legacy fields for backward compatibility
        if (!extensionSettings.trackerConfig.presentCharacters.relationshipEmojis) {
            extensionSettings.trackerConfig.presentCharacters.relationshipEmojis = {};
        }
        extensionSettings.trackerConfig.presentCharacters.relationshipEmojis[relationshipName] = '😊';

        // Sync relationshipFields
        const emojis = extensionSettings.trackerConfig.presentCharacters.relationships.relationshipEmojis;
        extensionSettings.trackerConfig.presentCharacters.relationshipFields = Object.keys(emojis);

        renderPresentCharactersTab();
    });

    // Remove relationship
    $('.rpg-remove-relationship').off('click').on('click', function() {
        const relationship = $(this).data('relationship');

        // Remove from new structure
        if (extensionSettings.trackerConfig.presentCharacters.relationships?.relationshipEmojis) {
            delete extensionSettings.trackerConfig.presentCharacters.relationships.relationshipEmojis[relationship];
        }

        // Remove from legacy structure
        if (extensionSettings.trackerConfig.presentCharacters.relationshipEmojis) {
            delete extensionSettings.trackerConfig.presentCharacters.relationshipEmojis[relationship];
        }

        // Sync relationshipFields
        const emojis = extensionSettings.trackerConfig.presentCharacters.relationships?.relationshipEmojis || {};
        extensionSettings.trackerConfig.presentCharacters.relationshipFields = Object.keys(emojis);

        renderPresentCharactersTab();
    });

    // Update relationship name
    $('.rpg-relationship-name').off('blur').on('blur', function() {
        const newName = $(this).val();
        const $item = $(this).closest('.rpg-relationship-item');
        const emoji = $item.find('.rpg-relationship-emoji').val();

        // Ensure structures exist
        if (!extensionSettings.trackerConfig.presentCharacters.relationships) {
            extensionSettings.trackerConfig.presentCharacters.relationships = { enabled: true, relationshipEmojis: {} };
        }
        if (!extensionSettings.trackerConfig.presentCharacters.relationshipEmojis) {
            extensionSettings.trackerConfig.presentCharacters.relationshipEmojis = {};
        }

        // Find the old name by matching the emoji in new structure
        const emojis = extensionSettings.trackerConfig.presentCharacters.relationships.relationshipEmojis;
        const oldName = Object.keys(emojis).find(
            key => emojis[key] === emoji && key !== newName
        );

        if (oldName && oldName !== newName) {
            // Update new structure
            delete emojis[oldName];
            emojis[newName] = emoji;

            // Update legacy structure
            delete extensionSettings.trackerConfig.presentCharacters.relationshipEmojis[oldName];
            extensionSettings.trackerConfig.presentCharacters.relationshipEmojis[newName] = emoji;

            // Sync relationshipFields
            extensionSettings.trackerConfig.presentCharacters.relationshipFields = Object.keys(emojis);
        }
    });

    // Update relationship emoji
    $('.rpg-relationship-emoji').off('blur').on('blur', function() {
        const name = $(this).closest('.rpg-relationship-item').find('.rpg-relationship-name').val();

        // Ensure structures exist
        if (!extensionSettings.trackerConfig.presentCharacters.relationships) {
            extensionSettings.trackerConfig.presentCharacters.relationships = { enabled: true, relationshipEmojis: {} };
        }
        if (!extensionSettings.trackerConfig.presentCharacters.relationshipEmojis) {
            extensionSettings.trackerConfig.presentCharacters.relationshipEmojis = {};
        }

        // Update both structures
        extensionSettings.trackerConfig.presentCharacters.relationships.relationshipEmojis[name] = $(this).val();
        extensionSettings.trackerConfig.presentCharacters.relationshipEmojis[name] = $(this).val();
    });

    // Thoughts configuration
    $('#rpg-thoughts-enabled').off('change').on('change', function() {
        if (!extensionSettings.trackerConfig.presentCharacters.thoughts) {
            extensionSettings.trackerConfig.presentCharacters.thoughts = {};
        }
        extensionSettings.trackerConfig.presentCharacters.thoughts.enabled = $(this).is(':checked');
    });

    $('#rpg-thoughts-name').off('blur').on('blur', function() {
        if (!extensionSettings.trackerConfig.presentCharacters.thoughts) {
            extensionSettings.trackerConfig.presentCharacters.thoughts = {};
        }
        extensionSettings.trackerConfig.presentCharacters.thoughts.name = $(this).val();
    });

    $('#rpg-thoughts-description').off('blur').on('blur', function() {
        if (!extensionSettings.trackerConfig.presentCharacters.thoughts) {
            extensionSettings.trackerConfig.presentCharacters.thoughts = {};
        }
        extensionSettings.trackerConfig.presentCharacters.thoughts.description = $(this).val();
    });

    // Add field
    $('#rpg-add-field').off('click').on('click', function() {
        extensionSettings.trackerConfig.presentCharacters.customFields.push({
            id: 'custom_' + Date.now(),
            name: 'New Field',
            enabled: true,
            description: 'Description for AI'
        });
        renderPresentCharactersTab();
    });

    // Remove field
    $('.rpg-field-remove').off('click').on('click', function() {
        const index = $(this).data('index');
        extensionSettings.trackerConfig.presentCharacters.customFields.splice(index, 1);
        renderPresentCharactersTab();
    });

    // Move field up
    $('.rpg-field-move-up').off('click').on('click', function() {
        const index = $(this).data('index');
        if (index > 0) {
            const fields = extensionSettings.trackerConfig.presentCharacters.customFields;
            [fields[index - 1], fields[index]] = [fields[index], fields[index - 1]];
            renderPresentCharactersTab();
        }
    });

    // Move field down
    $('.rpg-field-move-down').off('click').on('click', function() {
        const index = $(this).data('index');
        const fields = extensionSettings.trackerConfig.presentCharacters.customFields;
        if (index < fields.length - 1) {
            [fields[index], fields[index + 1]] = [fields[index + 1], fields[index]];
            renderPresentCharactersTab();
        }
    });

    // Toggle field
    $('.rpg-field-toggle').off('change').on('change', function() {
        const index = $(this).data('index');
        extensionSettings.trackerConfig.presentCharacters.customFields[index].enabled = $(this).is(':checked');
    });

    // Rename field
    $('.rpg-field-label').off('blur').on('blur', function() {
        const index = $(this).data('index');
        extensionSettings.trackerConfig.presentCharacters.customFields[index].name = $(this).val();
    });

    // Update description
    $('.rpg-field-placeholder').off('blur').on('blur', function() {
        const index = $(this).data('index');
        extensionSettings.trackerConfig.presentCharacters.customFields[index].description = $(this).val();
    });

    // Character stats toggle
    $('#rpg-char-stats-enabled').off('change').on('change', function() {
        if (!extensionSettings.trackerConfig.presentCharacters.characterStats) {
            extensionSettings.trackerConfig.presentCharacters.characterStats = { enabled: false, customStats: [] };
        }
        extensionSettings.trackerConfig.presentCharacters.characterStats.enabled = $(this).is(':checked');
    });

    // Add character stat
    $('#rpg-add-char-stat').off('click').on('click', function() {
        if (!extensionSettings.trackerConfig.presentCharacters.characterStats) {
            extensionSettings.trackerConfig.presentCharacters.characterStats = { enabled: false, customStats: [] };
        }
        if (!extensionSettings.trackerConfig.presentCharacters.characterStats.customStats) {
            extensionSettings.trackerConfig.presentCharacters.characterStats.customStats = [];
        }
        extensionSettings.trackerConfig.presentCharacters.characterStats.customStats.push({
            id: `stat-${Date.now()}`,
            name: 'New Stat',
            enabled: true
        });
        renderPresentCharactersTab();
    });

    // Remove character stat
    $('.rpg-char-stat-remove').off('click').on('click', function() {
        const index = $(this).data('index');
        extensionSettings.trackerConfig.presentCharacters.characterStats.customStats.splice(index, 1);
        renderPresentCharactersTab();
    });

    // Toggle character stat
    $('.rpg-char-stat-toggle').off('change').on('change', function() {
        const index = $(this).data('index');
        extensionSettings.trackerConfig.presentCharacters.characterStats.customStats[index].enabled = $(this).is(':checked');
    });

    // Rename character stat
    $('.rpg-char-stat-label').off('blur').on('blur', function() {
        const index = $(this).data('index');
        extensionSettings.trackerConfig.presentCharacters.characterStats.customStats[index].name = $(this).val();
    });
}

/**
 * Render History Persistence configuration tab
 * Allows users to select which tracker data should be injected into historical messages
 */
function renderHistoryPersistenceTab() {
    const historyPersistence = extensionSettings.historyPersistence || {
        enabled: false,
        messageCount: 5,
        injectionPosition: 'assistant_message_end',
        contextPreamble: ''
    };
    const userStatsConfig = extensionSettings.trackerConfig.userStats;
    const infoBoxConfig = extensionSettings.trackerConfig.infoBox;
    const presentCharsConfig = extensionSettings.trackerConfig.presentCharacters;

    let html = '<div class="rpg-editor-section">';

    // Main toggle and settings
    html += `<h4><i class="fa-solid fa-clock-rotate-left"></i> History Persistence Settings</h4>`;
    html += `<p class="rpg-editor-hint">Inject selected tracker data into historical messages to help the AI maintain continuity for time-sensitive events, weather changes, and location tracking.</p>`;

    // Enable toggle
    html += '<div class="rpg-editor-toggle-row">';
    html += `<input type="checkbox" id="rpg-history-persistence-enabled" ${historyPersistence.enabled ? 'checked' : ''}>`;
    html += `<label for="rpg-history-persistence-enabled">Enable History Persistence</label>`;
    html += '</div>';

    // Message count
    html += '<div class="rpg-editor-input-row" style="margin-top: 12px;">';
    html += `<label for="rpg-history-message-count">Number of messages to include (0 = all available):</label>`;
    html += `<input type="number" id="rpg-history-message-count" min="0" max="50" value="${historyPersistence.messageCount}" class="rpg-input" style="width: 80px; margin-left: 8px;">`;
    html += '</div>';

    // Injection position
    html += '<div class="rpg-editor-input-row" style="margin-top: 12px;">';
    html += `<label for="rpg-history-injection-position">Injection Position:</label>`;
    html += `<select id="rpg-history-injection-position" class="rpg-select" style="margin-left: 8px;">`;
    html += `<option value="user_message_end" ${historyPersistence.injectionPosition === 'user_message_end' ? 'selected' : ''}>End of User Message</option>`;
    html += `<option value="assistant_message_end" ${historyPersistence.injectionPosition === 'assistant_message_end' ? 'selected' : ''}>End of Assistant Message</option>`;
    html += `<option value="extra_user_message" ${historyPersistence.injectionPosition === 'extra_user_message' ? 'selected' : ''}>Extra User Message</option>`;
    html += `<option value="extra_assistant_message" ${historyPersistence.injectionPosition === 'extra_assistant_message' ? 'selected' : ''}>Extra Assistant Message</option>`;
    html += `</select>`;
    html += '</div>';

    // Custom preamble
    html += '<div class="rpg-editor-input-row" style="margin-top: 12px;">';
    html += `<label for="rpg-history-context-preamble">Custom Context Preamble (optional):</label>`;
    html += `<input type="text" id="rpg-history-context-preamble" value="${historyPersistence.contextPreamble || ''}" class="rpg-text-input" placeholder="Leave empty for default: [Context at this point:]" style="width: 100%; margin-top: 4px;">`;
    html += '</div>';

    // User Stats section - which stats to persist
    html += `<h4 style="margin-top: 20px;"><i class="fa-solid fa-heart-pulse"></i> User Stats</h4>`;
    html += `<p class="rpg-editor-hint">Select which stats should be included in historical messages.</p>`;

    // Custom stats
    html += '<div class="rpg-history-persist-list">';
    userStatsConfig.customStats.forEach((stat, index) => {
        if (stat.enabled) {
            html += `
                <div class="rpg-editor-toggle-row">
                    <input type="checkbox" id="rpg-history-stat-${stat.id}" class="rpg-history-stat-toggle" data-index="${index}" ${stat.persistInHistory ? 'checked' : ''}>
                    <label for="rpg-history-stat-${stat.id}">${stat.name}</label>
                </div>
            `;
        }
    });

    // Status section
    if (userStatsConfig.statusSection?.enabled) {
        html += `
            <div class="rpg-editor-toggle-row">
                <input type="checkbox" id="rpg-history-status" ${userStatsConfig.statusSection.persistInHistory ? 'checked' : ''}>
                <label for="rpg-history-status">Status (Mood/Conditions)</label>
            </div>
        `;
    }

    // Skills section
    if (userStatsConfig.skillsSection?.enabled) {
        html += `
            <div class="rpg-editor-toggle-row">
                <input type="checkbox" id="rpg-history-skills" ${userStatsConfig.skillsSection.persistInHistory ? 'checked' : ''}>
                <label for="rpg-history-skills">${userStatsConfig.skillsSection.label || 'Skills'}</label>
            </div>
        `;
    }

    // Inventory
    html += `
        <div class="rpg-editor-toggle-row">
            <input type="checkbox" id="rpg-history-inventory" ${userStatsConfig.inventoryPersistInHistory ? 'checked' : ''}>
            <label for="rpg-history-inventory">Inventory</label>
        </div>
    `;

    // Quests
    html += `
        <div class="rpg-editor-toggle-row">
            <input type="checkbox" id="rpg-history-quests" ${userStatsConfig.questsPersistInHistory ? 'checked' : ''}>
            <label for="rpg-history-quests">Quests</label>
        </div>
    `;
    html += '</div>';

    // Info Box section - which widgets to persist
    html += `<h4 style="margin-top: 20px;"><i class="fa-solid fa-info-circle"></i> Info Box</h4>`;
    html += `<p class="rpg-editor-hint">Select which info box fields should be included in historical messages. These are recommended for time tracking.</p>`;

    html += '<div class="rpg-history-persist-list">';
    const widgetLabels = {
        date: 'Date',
        weather: 'Weather',
        temperature: 'Temperature',
        time: 'Time',
        location: 'Location',
        recentEvents: 'Recent Events'
    };

    for (const [widgetId, widget] of Object.entries(infoBoxConfig.widgets)) {
        if (widget.enabled) {
            html += `
                <div class="rpg-editor-toggle-row">
                    <input type="checkbox" id="rpg-history-widget-${widgetId}" class="rpg-history-widget-toggle" data-widget="${widgetId}" ${widget.persistInHistory ? 'checked' : ''}>
                    <label for="rpg-history-widget-${widgetId}">${widgetLabels[widgetId] || widgetId}</label>
                </div>
            `;
        }
    }
    html += '</div>';

    // Present Characters section
    html += `<h4 style="margin-top: 20px;"><i class="fa-solid fa-users"></i> Present Characters</h4>`;
    html += `<p class="rpg-editor-hint">Select which character fields should be included in historical messages.</p>`;

    html += '<div class="rpg-history-persist-list">';

    // Custom fields (appearance, demeanor, etc.)
    presentCharsConfig.customFields.forEach((field, index) => {
        if (field.enabled) {
            html += `
                <div class="rpg-editor-toggle-row">
                    <input type="checkbox" id="rpg-history-charfield-${field.id}" class="rpg-history-charfield-toggle" data-index="${index}" ${field.persistInHistory ? 'checked' : ''}>
                    <label for="rpg-history-charfield-${field.id}">${field.name}</label>
                </div>
            `;
        }
    });

    // Thoughts
    if (presentCharsConfig.thoughts?.enabled) {
        html += `
            <div class="rpg-editor-toggle-row">
                <input type="checkbox" id="rpg-history-thoughts" ${presentCharsConfig.thoughts.persistInHistory ? 'checked' : ''}>
                <label for="rpg-history-thoughts">${presentCharsConfig.thoughts.name || 'Thoughts'}</label>
            </div>
        `;
    }
    html += '</div>';

    html += '</div>';

    $('#rpg-editor-tab-historyPersistence').html(html);
    setupHistoryPersistenceListeners();
}

/**
 * Set up event listeners for History Persistence tab
 */
function setupHistoryPersistenceListeners() {
    // Ensure historyPersistence object exists
    if (!extensionSettings.historyPersistence) {
        extensionSettings.historyPersistence = {
            enabled: false,
            messageCount: 5,
            injectionPosition: 'assistant_message_end',
            contextPreamble: ''
        };
    }

    // Main toggle
    $('#rpg-history-persistence-enabled').off('change').on('change', function() {
        extensionSettings.historyPersistence.enabled = $(this).is(':checked');
    });

    // Message count
    $('#rpg-history-message-count').off('change').on('change', function() {
        extensionSettings.historyPersistence.messageCount = parseInt($(this).val()) || 0;
    });

    // Injection position
    $('#rpg-history-injection-position').off('change').on('change', function() {
        extensionSettings.historyPersistence.injectionPosition = $(this).val();
    });

    // Context preamble
    $('#rpg-history-context-preamble').off('blur').on('blur', function() {
        extensionSettings.historyPersistence.contextPreamble = $(this).val();
    });

    // User Stats toggles
    $('.rpg-history-stat-toggle').off('change').on('change', function() {
        const index = $(this).data('index');
        extensionSettings.trackerConfig.userStats.customStats[index].persistInHistory = $(this).is(':checked');
    });

    // Status section
    $('#rpg-history-status').off('change').on('change', function() {
        extensionSettings.trackerConfig.userStats.statusSection.persistInHistory = $(this).is(':checked');
    });

    // Skills section
    $('#rpg-history-skills').off('change').on('change', function() {
        extensionSettings.trackerConfig.userStats.skillsSection.persistInHistory = $(this).is(':checked');
    });

    // Inventory
    $('#rpg-history-inventory').off('change').on('change', function() {
        extensionSettings.trackerConfig.userStats.inventoryPersistInHistory = $(this).is(':checked');
    });

    // Quests
    $('#rpg-history-quests').off('change').on('change', function() {
        extensionSettings.trackerConfig.userStats.questsPersistInHistory = $(this).is(':checked');
    });

    // Info Box widget toggles
    $('.rpg-history-widget-toggle').off('change').on('change', function() {
        const widgetId = $(this).data('widget');
        extensionSettings.trackerConfig.infoBox.widgets[widgetId].persistInHistory = $(this).is(':checked');
    });

    // Present Characters field toggles
    $('.rpg-history-charfield-toggle').off('change').on('change', function() {
        const index = $(this).data('index');
        extensionSettings.trackerConfig.presentCharacters.customFields[index].persistInHistory = $(this).is(':checked');
    });

    // Thoughts
    $('#rpg-history-thoughts').off('change').on('change', function() {
        extensionSettings.trackerConfig.presentCharacters.thoughts.persistInHistory = $(this).is(':checked');
    });
}
