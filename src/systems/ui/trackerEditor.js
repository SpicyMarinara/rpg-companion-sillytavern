/**
 * Tracker Editor Module
 * Provides UI for customizing tracker configurations
 */
import { i18n } from '../../core/i18n.js';
import { extensionSettings } from '../../core/state.js';
import { saveSettings } from '../../core/persistence.js';
import { renderUserStats } from '../rendering/userStats.js';
import { renderInfoBox } from '../rendering/infoBox.js';
import { renderThoughts } from '../rendering/thoughts.js';
import { renderSkills } from '../rendering/skills.js';

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
    saveSettings();

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
                { id: 'health', name: 'Health', enabled: true },
                { id: 'satiety', name: 'Satiety', enabled: true },
                { id: 'energy', name: 'Energy', enabled: true },
                { id: 'hygiene', name: 'Hygiene', enabled: true },
                { id: 'arousal', name: 'Arousal', enabled: true }
            ],
            showRPGAttributes: true,
            rpgAttributes: [
                { id: 'str', name: 'STR', description: '', enabled: true },
                { id: 'dex', name: 'DEX', description: '', enabled: true },
                { id: 'con', name: 'CON', description: '', enabled: true },
                { id: 'int', name: 'INT', description: '', enabled: true },
                { id: 'wis', name: 'WIS', description: '', enabled: true },
                { id: 'cha', name: 'CHA', description: '', enabled: true }
            ],
            statusSection: {
                enabled: true,
                showMoodEmoji: true,
                customFields: ['Conditions']
            },
            skillsSection: {
                enabled: false,
                label: 'Skills',
                customFields: []
            }
        },
        infoBox: {
            widgets: {
                date: { enabled: true, format: 'Weekday, Month, Year' },
                weather: { enabled: true },
                temperature: { enabled: true, unit: 'C' },
                time: { enabled: true },
                location: { enabled: true },
                recentEvents: { enabled: true }
            }
        },
        presentCharacters: {
            showEmoji: true,
            showName: true,
            relationshipFields: ['Lover', 'Friend', 'Ally', 'Enemy', 'Neutral'],
            relationshipEmojis: {
                'Lover': '❤️',
                'Friend': '⭐',
                'Ally': '🤝',
                'Enemy': '⚔️',
                'Neutral': '⚖️'
            },
            customFields: [
                { id: 'appearance', name: 'Appearance', enabled: true, description: 'Visible physical appearance (clothing, hair, notable features)' },
                { id: 'demeanor', name: 'Demeanor', enabled: true, description: 'Observable demeanor or emotional state' }
            ],
            thoughts: {
                enabled: true,
                name: 'Thoughts',
                description: 'Internal monologue (in first person POV, up to three sentences long)'
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
}

/**
 * Render the editor UI based on current config
 */
function renderEditorUI() {
    renderUserStatsTab();
    renderInfoBoxTab();
    renderPresentCharactersTab();
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
        const statDesc = stat.description || '';
        html += `
            <div class="rpg-editor-stat-item rpg-editor-item-with-desc" data-index="${index}">
                <input type="checkbox" ${stat.enabled ? 'checked' : ''} class="rpg-stat-toggle" data-index="${index}">
                <input type="text" value="${stat.name}" class="rpg-stat-name" data-index="${index}" placeholder="Stat Name">
                <input type="text" value="${statDesc}" class="rpg-stat-desc" data-index="${index}" placeholder="Description for AI">
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
            { id: 'str', name: 'STR', description: '', enabled: true },
            { id: 'dex', name: 'DEX', description: '', enabled: true },
            { id: 'con', name: 'CON', description: '', enabled: true },
            { id: 'int', name: 'INT', description: '', enabled: true },
            { id: 'wis', name: 'WIS', description: '', enabled: true },
            { id: 'cha', name: 'CHA', description: '', enabled: true }
        ];
        // Save the defaults back to the actual config
        extensionSettings.trackerConfig.userStats.rpgAttributes = config.rpgAttributes;
    }

    const rpgAttributes = config.rpgAttributes;

    rpgAttributes.forEach((attr, index) => {
        const attrDesc = attr.description || '';
        html += `
            <div class="rpg-editor-stat-item rpg-editor-item-with-desc" data-index="${index}">
                <input type="checkbox" ${attr.enabled ? 'checked' : ''} class="rpg-attr-toggle" data-index="${index}">
                <input type="text" value="${attr.name}" class="rpg-attr-name" data-index="${index}" placeholder="Attribute Name">
                <input type="text" value="${attrDesc}" class="rpg-attr-desc" data-index="${index}" placeholder="Description for AI">
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
    
    // Check if skills are shown as separate section - if so, disable the toggle
    const skillsInSeparateTab = extensionSettings.showSkills;
    const skillsToggleDisabled = skillsInSeparateTab ? 'disabled' : '';
    const skillsToggleStyle = skillsInSeparateTab ? 'style="opacity: 0.5; cursor: not-allowed;"' : '';
    
    html += `<div class="rpg-editor-toggle-row" ${skillsToggleStyle}>`;
    html += `<input type="checkbox" id="rpg-skills-enabled" ${config.skillsSection.enabled ? 'checked' : ''} ${skillsToggleDisabled}>`;
    html += `<label for="rpg-skills-enabled">${i18n.getTranslation('template.trackerEditorModal.userStatsTab.enableSkillsSection')}</label>`;
    html += '</div>';
    
    // Show note when skills are in separate tab
    if (skillsInSeparateTab) {
        html += `<small style="display: block; margin-top: -8px; margin-bottom: 12px; color: #888; font-size: 11px;" data-i18n-key="template.trackerEditorModal.userStatsTab.skillsInSeparateTabNote">${i18n.getTranslation('template.trackerEditorModal.userStatsTab.skillsInSeparateTabNote')}</small>`;
    }

    html += `<label>${i18n.getTranslation('template.trackerEditorModal.userStatsTab.skillsLabelLabel')}</label>`;
    html += `<input type="text" id="rpg-skills-label" value="${config.skillsSection.label}" class="rpg-text-input" placeholder="Skills">`;

    html += `<label>${i18n.getTranslation('template.trackerEditorModal.userStatsTab.skillsListLabel')}</label>`;
    html += '<div class="rpg-editor-stats-list" id="rpg-editor-skills-list">';
    
    // Handle both old format (string array) and new format (object array)
    const skillFields = config.skillsSection.customFields || [];
    skillFields.forEach((skill, index) => {
        // Support both old format (string) and new format (object)
        const skillName = typeof skill === 'string' ? skill : (skill.name || '');
        const skillDesc = typeof skill === 'string' ? '' : (skill.description || '');
        const skillEnabled = typeof skill === 'string' ? true : (skill.enabled !== false);
        
        html += `
            <div class="rpg-editor-stat-item rpg-editor-skill-item" data-index="${index}">
                <input type="checkbox" ${skillEnabled ? 'checked' : ''} class="rpg-skill-toggle" data-index="${index}">
                <input type="text" value="${skillName}" class="rpg-skill-name" data-index="${index}" placeholder="Skill Category Name">
                <input type="text" value="${skillDesc}" class="rpg-skill-desc" data-index="${index}" placeholder="Description for AI">
                <button class="rpg-skill-remove" data-index="${index}" title="Remove skill category"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
    });
    
    html += '</div>';
    html += `<button class="rpg-btn-secondary" id="rpg-add-skill"><i class="fa-solid fa-plus"></i> ${i18n.getTranslation('template.trackerEditorModal.userStatsTab.addSkillButton') || 'Add Skill Category'}</button>`;

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
            description: '',
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

    // Update stat description
    $('.rpg-stat-desc').off('blur').on('blur', function() {
        const index = $(this).data('index');
        extensionSettings.trackerConfig.userStats.customStats[index].description = $(this).val();
    });

    // Add attribute
    $('#rpg-add-attr').off('click').on('click', function() {
        // Ensure rpgAttributes array exists with defaults if needed
        if (!extensionSettings.trackerConfig.userStats.rpgAttributes || extensionSettings.trackerConfig.userStats.rpgAttributes.length === 0) {
            extensionSettings.trackerConfig.userStats.rpgAttributes = [
                { id: 'str', name: 'STR', description: '', enabled: true },
                { id: 'dex', name: 'DEX', description: '', enabled: true },
                { id: 'con', name: 'CON', description: '', enabled: true },
                { id: 'int', name: 'INT', description: '', enabled: true },
                { id: 'wis', name: 'WIS', description: '', enabled: true },
                { id: 'cha', name: 'CHA', description: '', enabled: true }
            ];
        }
        const newId = 'attr_' + Date.now();
        extensionSettings.trackerConfig.userStats.rpgAttributes.push({
            id: newId,
            name: 'NEW',
            description: '',
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

    // Update attribute description
    $('.rpg-attr-desc').off('blur').on('blur', function() {
        const index = $(this).data('index');
        extensionSettings.trackerConfig.userStats.rpgAttributes[index].description = $(this).val();
    });

    // Enable/disable RPG Attributes section toggle
    $('#rpg-show-rpg-attrs').off('change').on('change', function() {
        extensionSettings.trackerConfig.userStats.showRPGAttributes = $(this).is(':checked');
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
        saveSettings();
        // Re-render both user stats (if skills shown there) and skills section
        renderUserStats();
        renderSkills();
    });

    $('#rpg-skills-label').off('blur').on('blur', function() {
        const newLabel = $(this).val();
        extensionSettings.trackerConfig.userStats.skillsSection.label = newLabel;
        saveSettings();
        renderUserStats();
        renderSkills();
        // Update the skills tab button text if it exists
        $('.rpg-tab-btn[data-tab="skills"] span').text(newLabel);
    });

    // Add skill category
    $('#rpg-add-skill').off('click').on('click', function() {
        if (!extensionSettings.trackerConfig.userStats.skillsSection.customFields) {
            extensionSettings.trackerConfig.userStats.skillsSection.customFields = [];
        }
        extensionSettings.trackerConfig.userStats.skillsSection.customFields.push({
            id: 'skill_' + Date.now(),
            name: 'New Skill',
            description: '',
            enabled: true
        });
        renderUserStatsTab();
        saveSettings();
        renderSkills();
    });

    // Remove skill category
    $('.rpg-skill-remove').off('click').on('click', function() {
        const index = $(this).data('index');
        extensionSettings.trackerConfig.userStats.skillsSection.customFields.splice(index, 1);
        renderUserStatsTab();
        saveSettings();
        renderSkills();
    });

    // Toggle skill category
    $('.rpg-skill-toggle').off('change').on('change', function() {
        const index = $(this).data('index');
        ensureSkillIsObject(index);
        extensionSettings.trackerConfig.userStats.skillsSection.customFields[index].enabled = $(this).is(':checked');
        saveSettings();
        renderSkills();
    });

    // Rename skill category
    $('.rpg-skill-name').off('blur').on('blur', function() {
        const index = $(this).data('index');
        ensureSkillIsObject(index);
        extensionSettings.trackerConfig.userStats.skillsSection.customFields[index].name = $(this).val();
        saveSettings();
        renderSkills();
    });

    // Update skill description
    $('.rpg-skill-desc').off('blur').on('blur', function() {
        const index = $(this).data('index');
        ensureSkillIsObject(index);
        extensionSettings.trackerConfig.userStats.skillsSection.customFields[index].description = $(this).val();
        saveSettings();
    });
}

/**
 * Helper to convert old string-format skill to object format
 */
function ensureSkillIsObject(index) {
    const skill = extensionSettings.trackerConfig.userStats.skillsSection.customFields[index];
    if (typeof skill === 'string') {
        extensionSettings.trackerConfig.userStats.skillsSection.customFields[index] = {
            id: 'skill_' + Date.now(),
            name: skill,
            description: '',
            enabled: true
        };
    }
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
    html += `<p class="rpg-editor-hint">${i18n.getTranslation('template.trackerEditorModal.presentCharactersTab.relationshipStatusHint')}</p>`;

    html += '<div class="rpg-relationship-mapping-list" id="rpg-relationship-mapping-list">';
    // Show existing relationships as field → emoji pairs
    const relationshipEmojis = config.relationshipEmojis || {
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
    html += `<input type="text" id="rpg-thoughts-description" value="${config.thoughts?.description || 'Internal monologue (in first person POV, up to three sentences long)'}" placeholder="Description of what to generate">`;
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
    // Add new relationship
    $('#rpg-add-relationship').off('click').on('click', function() {
        if (!extensionSettings.trackerConfig.presentCharacters.relationshipEmojis) {
            extensionSettings.trackerConfig.presentCharacters.relationshipEmojis = {};
        }
        
        // Generate unique name to avoid overwriting existing "New Relationship" entries
        let newName = 'New Relationship';
        let counter = 1;
        while (extensionSettings.trackerConfig.presentCharacters.relationshipEmojis[newName]) {
            newName = `New Relationship ${counter}`;
            counter++;
        }
        extensionSettings.trackerConfig.presentCharacters.relationshipEmojis[newName] = '😊';

        // Sync relationshipFields
        extensionSettings.trackerConfig.presentCharacters.relationshipFields =
            Object.keys(extensionSettings.trackerConfig.presentCharacters.relationshipEmojis);

        renderPresentCharactersTab();
    });

    // Remove relationship
    $('.rpg-remove-relationship').off('click').on('click', function() {
        const relationship = $(this).data('relationship');
        if (extensionSettings.trackerConfig.presentCharacters.relationshipEmojis) {
            delete extensionSettings.trackerConfig.presentCharacters.relationshipEmojis[relationship];
        }

        // Sync relationshipFields
        extensionSettings.trackerConfig.presentCharacters.relationshipFields =
            Object.keys(extensionSettings.trackerConfig.presentCharacters.relationshipEmojis);

        renderPresentCharactersTab();
    });

    // Update relationship name
    $('.rpg-relationship-name').off('blur').on('blur', function() {
        const newName = $(this).val();
        const $item = $(this).closest('.rpg-relationship-item');
        const emoji = $item.find('.rpg-relationship-emoji').val();

        // Find the old name by matching the emoji
        const oldName = Object.keys(extensionSettings.trackerConfig.presentCharacters.relationshipEmojis).find(
            key => extensionSettings.trackerConfig.presentCharacters.relationshipEmojis[key] === emoji &&
                   key !== newName
        );

        if (oldName && oldName !== newName) {
            delete extensionSettings.trackerConfig.presentCharacters.relationshipEmojis[oldName];
            extensionSettings.trackerConfig.presentCharacters.relationshipEmojis[newName] = emoji;

            // Sync relationshipFields
            extensionSettings.trackerConfig.presentCharacters.relationshipFields =
                Object.keys(extensionSettings.trackerConfig.presentCharacters.relationshipEmojis);
        }
    });

    // Update relationship emoji
    $('.rpg-relationship-emoji').off('blur').on('blur', function() {
        const name = $(this).closest('.rpg-relationship-item').find('.rpg-relationship-name').val();
        if (!extensionSettings.trackerConfig.presentCharacters.relationshipEmojis) {
            extensionSettings.trackerConfig.presentCharacters.relationshipEmojis = {};
        }
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
