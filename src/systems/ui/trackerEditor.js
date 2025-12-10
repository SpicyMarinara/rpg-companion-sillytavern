/**
 * Tracker Editor Module
 * Provides UI for customizing tracker configurations
 */

import { extensionSettings } from '../../core/state.js';
import { saveSettings, saveChatData } from '../../core/persistence.js';
import { renderUserStats } from '../rendering/userStats.js';
import { renderInfoBox } from '../rendering/infoBox.js';
import { renderThoughts } from '../rendering/thoughts.js';
import { renderSpellbook } from '../rendering/spellbook.js';
import { addSpellToLorebook } from '../../utils/lorekeeper.js';
import { showImportDialog } from '../../utils/lorebookImporter.js';

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
    $editorModal.addClass('is-open').removeClass('is-closing');
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

    $editorModal.addClass('is-closing');
    $editorModal.removeClass('is-open');
    setTimeout(() => {
        $editorModal.removeClass('is-closing');
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
                { id: 'str', name: 'STR', enabled: true },
                { id: 'dex', name: 'DEX', enabled: true },
                { id: 'con', name: 'CON', enabled: true },
                { id: 'int', name: 'INT', enabled: true },
                { id: 'wis', name: 'WIS', enabled: true },
                { id: 'cha', name: 'CHA', enabled: true }
            ],
            statusSection: {
                enabled: true,
                showMoodEmoji: true,
                customFields: ['Conditions']
            },
            dndSkills: {
                enabled: true,
                collapsed: true,
                skills: {
                    athletics: { name: 'Athletics', ability: 'STR', value: 0 },
                    acrobatics: { name: 'Acrobatics', ability: 'DEX', value: 0 },
                    sleightOfHand: { name: 'Sleight of Hand', ability: 'DEX', value: 0 },
                    stealth: { name: 'Stealth', ability: 'DEX', value: 0 },
                    arcana: { name: 'Arcana', ability: 'INT', value: 0 },
                    history: { name: 'History', ability: 'INT', value: 0 },
                    investigation: { name: 'Investigation', ability: 'INT', value: 0 },
                    nature: { name: 'Nature', ability: 'INT', value: 0 },
                    religion: { name: 'Religion', ability: 'INT', value: 0 },
                    animalHandling: { name: 'Animal Handling', ability: 'WIS', value: 0 },
                    insight: { name: 'Insight', ability: 'WIS', value: 0 },
                    medicine: { name: 'Medicine', ability: 'WIS', value: 0 },
                    perception: { name: 'Perception', ability: 'WIS', value: 0 },
                    survival: { name: 'Survival', ability: 'WIS', value: 0 },
                    deception: { name: 'Deception', ability: 'CHA', value: 0 },
                    intimidation: { name: 'Intimidation', ability: 'CHA', value: 0 },
                    performance: { name: 'Performance', ability: 'CHA', value: 0 },
                    persuasion: { name: 'Persuasion', ability: 'CHA', value: 0 }
                }
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
    renderSpellbookTab();
}

/**
 * Render User Stats configuration tab
 */
function renderUserStatsTab() {
    const config = extensionSettings.trackerConfig.userStats;

    // Ensure Skills config exists (fallback if missing in saved settings)
    if (!config.dndSkills || !config.dndSkills.skills) {
        config.dndSkills = {
            enabled: true,
            collapsed: true,
            skills: {
                athletics: { name: 'Athletics', ability: 'STR', value: 0 },
                acrobatics: { name: 'Acrobatics', ability: 'DEX', value: 0 },
                sleightOfHand: { name: 'Sleight of Hand', ability: 'DEX', value: 0 },
                stealth: { name: 'Stealth', ability: 'DEX', value: 0 },
                arcana: { name: 'Arcana', ability: 'INT', value: 0 },
                history: { name: 'History', ability: 'INT', value: 0 },
                investigation: { name: 'Investigation', ability: 'INT', value: 0 },
                nature: { name: 'Nature', ability: 'INT', value: 0 },
                religion: { name: 'Religion', ability: 'INT', value: 0 },
                animalHandling: { name: 'Animal Handling', ability: 'WIS', value: 0 },
                insight: { name: 'Insight', ability: 'WIS', value: 0 },
                medicine: { name: 'Medicine', ability: 'WIS', value: 0 },
                perception: { name: 'Perception', ability: 'WIS', value: 0 },
                survival: { name: 'Survival', ability: 'WIS', value: 0 },
                deception: { name: 'Deception', ability: 'CHA', value: 0 },
                intimidation: { name: 'Intimidation', ability: 'CHA', value: 0 },
                performance: { name: 'Performance', ability: 'CHA', value: 0 },
                persuasion: { name: 'Persuasion', ability: 'CHA', value: 0 }
            }
        };
        extensionSettings.trackerConfig.userStats.dndSkills = config.dndSkills;
    }
    let html = '<div class="rpg-editor-section">';

    // Custom Stats section
    html += '<h4><i class="fa-solid fa-heart-pulse"></i> Custom Stats</h4>';
    html += '<div class="rpg-editor-stats-list" id="rpg-editor-stats-list">';

    config.customStats.forEach((stat, index) => {
        const useCurrentMax = stat.useCurrentMax || false;
        html += `
            <div class="rpg-editor-stat-item" data-index="${index}">
                <input type="checkbox" ${stat.enabled ? 'checked' : ''} class="rpg-stat-toggle" data-index="${index}">
                <input type="text" value="${stat.name}" class="rpg-stat-name" data-index="${index}" placeholder="Stat Name">
                <select class="rpg-stat-display-mode" data-index="${index}" title="Display mode">
                    <option value="percentage" ${!useCurrentMax ? 'selected' : ''}>Percentage (X%)</option>
                    <option value="currentmax" ${useCurrentMax ? 'selected' : ''}>Current/Max (X/Y)</option>
                </select>
                <button class="rpg-stat-remove" data-index="${index}" title="Remove stat"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
    });

    html += '</div>';
    html += '<button class="rpg-btn-secondary" id="rpg-add-stat"><i class="fa-solid fa-plus"></i> Add Custom Stat</button>';

    // RPG Attributes section
    html += '<h4><i class="fa-solid fa-dice-d20"></i> RPG Attributes</h4>';

    // Enable/disable toggle for entire RPG Attributes section
    const showRPGAttributes = config.showRPGAttributes !== undefined ? config.showRPGAttributes : true;
    html += '<div class="rpg-editor-toggle-row">';
    html += `<input type="checkbox" id="rpg-show-rpg-attrs" ${showRPGAttributes ? 'checked' : ''}>`;
    html += '<label for="rpg-show-rpg-attrs">Enable RPG Attributes Section</label>';
    html += '</div>';

    // Always send attributes toggle
    const alwaysSendAttributes = config.alwaysSendAttributes !== undefined ? config.alwaysSendAttributes : false;
    html += '<div class="rpg-editor-toggle-row">';
    html += `<input type="checkbox" id="rpg-always-send-attrs" ${alwaysSendAttributes ? 'checked' : ''}>`;
    html += '<label for="rpg-always-send-attrs">Always Include Attributes in Prompt</label>';
    html += '</div>';
    html += '<small class="rpg-editor-note">If disabled, attributes are only sent when a dice roll is active.</small>';

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
    html += '<button class="rpg-btn-secondary" id="rpg-add-attr"><i class="fa-solid fa-plus"></i> Add Attribute</button>';

    // Skills Section
    html += '<h4><i class="fa-solid fa-dice-d20"></i> Skills</h4>';
    html += '<div class="rpg-editor-toggle-row">';
    html += `<input type="checkbox" id="rpg-dndskills-enabled" ${config.dndSkills.enabled ? 'checked' : ''}>`;
    html += '<label for="rpg-dndskills-enabled">Enable Skills</label>';
    html += '</div>';

    html += '<div class="rpg-editor-toggle-row">';
    html += `<input type="checkbox" id="rpg-dndskills-collapsed" ${config.dndSkills.collapsed ? 'checked' : ''}>`;
    html += '<label for="rpg-dndskills-collapsed">Start Collapsed</label>';
    html += '</div>';

    const skillsByAbility = {
        'STR': ['athletics'],
        'DEX': ['acrobatics', 'sleightOfHand', 'stealth'],
        'INT': ['arcana', 'history', 'investigation', 'nature', 'religion'],
        'WIS': ['animalHandling', 'insight', 'medicine', 'perception', 'survival'],
        'CHA': ['deception', 'intimidation', 'performance', 'persuasion']
    };

    html += '<div class="rpg-editor-stats-list" id="rpg-editor-skills-list">';
    let skillIndex = 0;
    
    // Track which skills we've already rendered
    const renderedSkills = new Set();
    
    // First render skills in ability order (hardcoded ones)
    for (const [ability, skillIds] of Object.entries(skillsByAbility)) {
        skillIds.forEach(skillId => {
            const skill = config.dndSkills.skills[skillId];
            const label = skill?.name || skillId;
            html += `
                <div class="rpg-editor-stat-item">
                    <input type="text" class="rpg-dndskill-name" data-skill="${skillId}" value="${label}" placeholder="Skill name">
                    <button class="rpg-skill-remove" data-skill="${skillId}" title="Remove skill"><i class="fa-solid fa-trash"></i></button>
                </div>
            `;
            renderedSkills.add(skillId);
            skillIndex++;
        });
    }
    
    // Then render any custom/new skills that were added dynamically
    if (config.dndSkills.skills) {
        for (const [skillId, skill] of Object.entries(config.dndSkills.skills)) {
            if (!renderedSkills.has(skillId)) {
                const label = skill?.name || skillId;
                html += `
                    <div class="rpg-editor-stat-item">
                        <input type="text" class="rpg-dndskill-name" data-skill="${skillId}" value="${label}" placeholder="Skill name">
                        <button class="rpg-skill-remove" data-skill="${skillId}" title="Remove skill"><i class="fa-solid fa-trash"></i></button>
                    </div>
                `;
                skillIndex++;
            }
        }
    }
    html += '</div>';
    html += '<button class="rpg-btn-secondary" id="rpg-add-skill"><i class="fa-solid fa-plus"></i> Add Skill</button>';

    // Status Section
    html += '<h4><i class="fa-solid fa-face-smile"></i> Status Section</h4>';
    html += '<div class="rpg-editor-toggle-row">';
    html += `<input type="checkbox" id="rpg-status-enabled" ${config.statusSection.enabled ? 'checked' : ''}>`;
    html += '<label for="rpg-status-enabled">Enable Status Section</label>';
    html += '</div>';

    html += '<div class="rpg-editor-toggle-row">';
    html += `<input type="checkbox" id="rpg-mood-emoji" ${config.statusSection.showMoodEmoji ? 'checked' : ''}>`;
    html += '<label for="rpg-mood-emoji">Show Mood Emoji</label>';
    html += '</div>';

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
            enabled: true,
            useCurrentMax: false,
            maxValue: 100
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

    // Change stat display mode
    $('.rpg-stat-display-mode').off('change').on('change', function() {
        const index = $(this).data('index');
        const useCurrentMax = $(this).val() === 'currentmax';
        extensionSettings.trackerConfig.userStats.customStats[index].useCurrentMax = useCurrentMax;
        if (!extensionSettings.trackerConfig.userStats.customStats[index].maxValue) {
            extensionSettings.trackerConfig.userStats.customStats[index].maxValue = 100;
        }
        saveSettings();
        renderUserStats();
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

    // D&D Skills toggles
    $('#rpg-dndskills-enabled').off('change').on('change', function() {
        if (!extensionSettings.trackerConfig.userStats.dndSkills) {
            extensionSettings.trackerConfig.userStats.dndSkills = { enabled: true, collapsed: true, skills: {} };
        }
        extensionSettings.trackerConfig.userStats.dndSkills.enabled = $(this).is(':checked');
        saveSettings();
        renderUserStats();
    });

    $('#rpg-dndskills-collapsed').off('change').on('change', function() {
        if (!extensionSettings.trackerConfig.userStats.dndSkills) {
            extensionSettings.trackerConfig.userStats.dndSkills = { enabled: true, collapsed: true, skills: {} };
        }
        extensionSettings.trackerConfig.userStats.dndSkills.collapsed = $(this).is(':checked');
        saveSettings();
    });

    // D&D Skills name edits
    $('.rpg-dndskill-name').off('blur').on('blur', function() {
        const skillId = $(this).data('skill');
        const value = $(this).val().trim() || skillId;

        if (!extensionSettings.trackerConfig.userStats.dndSkills) {
            extensionSettings.trackerConfig.userStats.dndSkills = { enabled: true, collapsed: true, skills: {} };
        }
        if (!extensionSettings.trackerConfig.userStats.dndSkills.skills) {
            extensionSettings.trackerConfig.userStats.dndSkills.skills = {};
        }
        if (!extensionSettings.trackerConfig.userStats.dndSkills.skills[skillId]) {
            extensionSettings.trackerConfig.userStats.dndSkills.skills[skillId] = { name: value, ability: '', value: 0 };
        }

        extensionSettings.trackerConfig.userStats.dndSkills.skills[skillId].name = value;

        saveSettings();
        renderUserStats();
    });

    // D&D Skills remove button
    $('.rpg-skill-remove').off('click').on('click', function() {
        const skillId = $(this).data('skill');
        
        if (extensionSettings.trackerConfig.userStats.dndSkills && extensionSettings.trackerConfig.userStats.dndSkills.skills) {
            delete extensionSettings.trackerConfig.userStats.dndSkills.skills[skillId];
        }
        if (extensionSettings.userStats.dndSkills) {
            delete extensionSettings.userStats.dndSkills[skillId];
        }
        
        saveSettings();
        renderUserStatsTab();
        renderUserStats();
    });

    // Add skill
    $('#rpg-add-skill').off('click').on('click', function() {
        // Ensure dndSkills config exists with defaults if needed
        if (!extensionSettings.trackerConfig.userStats.dndSkills || !extensionSettings.trackerConfig.userStats.dndSkills.skills) {
            extensionSettings.trackerConfig.userStats.dndSkills = {
                enabled: true,
                collapsed: true,
                skills: {
                    athletics: { name: 'Athletics', ability: 'STR', value: 0 },
                    acrobatics: { name: 'Acrobatics', ability: 'DEX', value: 0 },
                    sleightOfHand: { name: 'Sleight of Hand', ability: 'DEX', value: 0 },
                    stealth: { name: 'Stealth', ability: 'DEX', value: 0 },
                    arcana: { name: 'Arcana', ability: 'INT', value: 0 },
                    history: { name: 'History', ability: 'INT', value: 0 },
                    investigation: { name: 'Investigation', ability: 'INT', value: 0 },
                    nature: { name: 'Nature', ability: 'INT', value: 0 },
                    religion: { name: 'Religion', ability: 'INT', value: 0 },
                    animalHandling: { name: 'Animal Handling', ability: 'WIS', value: 0 },
                    insight: { name: 'Insight', ability: 'WIS', value: 0 },
                    medicine: { name: 'Medicine', ability: 'WIS', value: 0 },
                    perception: { name: 'Perception', ability: 'WIS', value: 0 },
                    survival: { name: 'Survival', ability: 'WIS', value: 0 },
                    deception: { name: 'Deception', ability: 'CHA', value: 0 },
                    intimidation: { name: 'Intimidation', ability: 'CHA', value: 0 },
                    performance: { name: 'Performance', ability: 'CHA', value: 0 },
                    persuasion: { name: 'Persuasion', ability: 'CHA', value: 0 }
                }
            };
        }
        const newId = 'skill_' + Date.now();
        extensionSettings.trackerConfig.userStats.dndSkills.skills[newId] = {
            name: 'New Skill',
            ability: 'STR',
            value: 0
        };
        // Initialize value in userStats if doesn't exist
        if (extensionSettings.userStats.dndSkills === undefined) {
            extensionSettings.userStats.dndSkills = {};
        }
        extensionSettings.userStats.dndSkills[newId] = 0;
        
        saveSettings();
        renderUserStatsTab();
        renderUserStats();
    });
}

/**
 * Render Info Box configuration tab
 */
function renderInfoBoxTab() {
    const config = extensionSettings.trackerConfig.infoBox;
    let html = '<div class="rpg-editor-section">';

    html += '<h4><i class="fa-solid fa-info-circle"></i> Widgets</h4>';

    // Date widget
    html += '<div class="rpg-editor-widget-row">';
    html += `<input type="checkbox" id="rpg-widget-date" ${config.widgets.date.enabled ? 'checked' : ''}>`;
    html += '<label for="rpg-widget-date">Date</label>';
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
    html += '<label for="rpg-widget-weather">Weather</label>';
    html += '</div>';

    // Temperature widget
    html += '<div class="rpg-editor-widget-row">';
    html += `<input type="checkbox" id="rpg-widget-temperature" ${config.widgets.temperature.enabled ? 'checked' : ''}>`;
    html += '<label for="rpg-widget-temperature">Temperature</label>';
    html += '<div class="rpg-radio-group">';
    html += `<label><input type="radio" name="temp-unit" value="C" ${config.widgets.temperature.unit === 'C' ? 'checked' : ''}> °C</label>`;
    html += `<label><input type="radio" name="temp-unit" value="F" ${config.widgets.temperature.unit === 'F' ? 'checked' : ''}> °F</label>`;
    html += '</div>';

    html += '</div>';

    // Time widget
    html += '<div class="rpg-editor-widget-row">';
    html += `<input type="checkbox" id="rpg-widget-time" ${config.widgets.time.enabled ? 'checked' : ''}>`;
    html += '<label for="rpg-widget-time">Time</label>';
    html += '</div>';

    // Location widget
    html += '<div class="rpg-editor-widget-row">';
    html += `<input type="checkbox" id="rpg-widget-location" ${config.widgets.location.enabled ? 'checked' : ''}>`;
    html += '<label for="rpg-widget-location">Location</label>';
    html += '</div>';

    // Recent Events widget
    html += '<div class="rpg-editor-widget-row">';
    html += `<input type="checkbox" id="rpg-widget-events" ${config.widgets.recentEvents.enabled ? 'checked' : ''}>`;
    html += '<label for="rpg-widget-events">Recent Events</label>';
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
    html += '<h4><i class="fa-solid fa-heart"></i> Relationship Status Fields</h4>';
    html += '<p class="rpg-editor-hint">Define relationship types with corresponding emojis shown on character portraits</p>';

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
    html += '<button class="rpg-btn-secondary" id="rpg-add-relationship"><i class="fa-solid fa-plus"></i> New Relationship</button>';

    // Custom Fields Section
    html += '<h4><i class="fa-solid fa-list"></i> Appearance/Demeanor Fields</h4>';
    html += '<p class="rpg-editor-hint">Fields shown below character name, separated by |</p>';

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
    html += '<button class="rpg-btn-secondary" id="rpg-add-field"><i class="fa-solid fa-plus"></i> Add Custom Field</button>';

    // Thoughts Section
    html += '<h4><i class="fa-solid fa-comment-dots"></i> Thoughts Configuration</h4>';
    html += '<div class="rpg-editor-toggle-row">';
    html += `<input type="checkbox" id="rpg-thoughts-enabled" ${config.thoughts?.enabled ? 'checked' : ''}>`;
    html += '<label for="rpg-thoughts-enabled">Enable Character Thoughts</label>';
    html += '</div>';

    html += '<div class="rpg-thoughts-config">';
    html += '<div class="rpg-editor-input-group">';
    html += '<label>Thoughts Label:</label>';
    html += `<input type="text" id="rpg-thoughts-name" value="${config.thoughts?.name || 'Thoughts'}" placeholder="e.g., Thoughts, Inner Voice, Feelings">`;
    html += '</div>';
    html += '<div class="rpg-editor-input-group">';
    html += '<label>AI Instruction:</label>';
    html += `<input type="text" id="rpg-thoughts-description" value="${config.thoughts?.description || 'Internal monologue (in first person POV, up to three sentences long)'}" placeholder="Description of what to generate">`;
    html += '</div>';
    html += '</div>';

    // Character Stats
    html += '<h4><i class="fa-solid fa-chart-bar"></i> Character Stats</h4>';
    html += '<div class="rpg-editor-toggle-row">';
    html += `<input type="checkbox" id="rpg-char-stats-enabled" ${config.characterStats?.enabled ? 'checked' : ''}>`;
    html += '<label for="rpg-char-stats-enabled">Track Character Stats</label>';
    html += '</div>';

    html += '<p class="rpg-editor-hint">Create stats to track for each character (displayed as colored bars)</p>';
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
    html += '<button class="rpg-btn-secondary" id="rpg-add-char-stat"><i class="fa-solid fa-plus"></i> Add Character Stat</button>';

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
        extensionSettings.trackerConfig.presentCharacters.relationshipEmojis['New Relationship'] = '😊';

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

/**
 * Render Spellbook configuration tab
 */
function renderSpellbookTab() {
    const spellbook = extensionSettings.spellbook || { spellSlots: {} };
    let html = '<div class="rpg-editor-section">';
    
    // Spell Slots section with collapsible header
    html += '<h4><i class="fa-solid fa-book-spells"></i> Spell Slots</h4>';
    html += '<div class="rpg-editor-toggle-row">';
    html += '<input type="checkbox" id="rpg-spellslots-enabled" checked>';
    html += '<label for="rpg-spellslots-enabled">Enable Spell Slots</label>';
    html += '</div>';

    html += '<div class="rpg-editor-stats-list" id="rpg-editor-spellslots-list">';
    
    // Render spell slots - only show levels that have been added
    const spellSlotLevels = spellbook.spellSlots ? Object.keys(spellbook.spellSlots).map(k => parseInt(k)).sort((a, b) => a - b) : [];
    
    // If no slots added, show levels 1-9 by default
    if (spellSlotLevels.length === 0) {
        for (let lvl = 1; lvl <= 9; lvl++) {
            html += `
                <div class="rpg-editor-stat-item" data-level="${lvl}">
                    <input type="text" class="rpg-spellslot-name" data-level="${lvl}" value="Level ${lvl}" placeholder="Slot name">
                    <div style="display: flex; gap: 0.5em; align-items: center;">
                        <input type="number" min="0" class="rpg-spellslot-max" data-level="${lvl}" value="0" placeholder="Max slots" style="width: 70px;">
                        <button class="rpg-spellslot-remove" data-level="${lvl}" title="Remove spell level"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
            `;
        }
    } else {
        // Render only the levels that exist
        spellSlotLevels.forEach(lvl => {
            const slot = spellbook.spellSlots[lvl];
            const displayName = slot.name || `Level ${lvl}`;
            html += `
                <div class="rpg-editor-stat-item" data-level="${lvl}">
                    <input type="text" class="rpg-spellslot-name" data-level="${lvl}" value="${displayName}" placeholder="Slot name">
                    <div style="display: flex; gap: 0.5em; align-items: center;">
                        <input type="number" min="0" class="rpg-spellslot-max" data-level="${lvl}" value="${slot.max || 0}" placeholder="Max slots" style="width: 70px;">
                        <button class="rpg-spellslot-remove" data-level="${lvl}" title="Remove spell level"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
            `;
        });
    }
    
    html += '</div>';
    html += '<button class="rpg-btn-secondary" id="rpg-add-spellslot"><i class="fa-solid fa-plus"></i> Add Spell Level</button>';

    // Utility buttons section
    html += `
        <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid var(--rpg-border);">
            <button id="rpg-clear-spellbook-cache-editor" class="rpg-btn-small" style="width: 100%; margin-bottom: 10px;">
                <i class="fa-solid fa-broom"></i> Clear Spellbook Cache
            </button>
            <small style="display: block; margin-top: 8px; margin-bottom: 15px; opacity: 0.7; font-size: 0.85em;">
                Clears cached lorebook entries. Use if old deleted spells keep reappearing.
            </small>
            <button id="rpg-import-lorebook-btn" class="rpg-btn-secondary" style="width: 100%;">
                <i class="fa-solid fa-file-import"></i> Import from Lorebook
            </button>
            <small style="display: block; margin-top: 8px; opacity: 0.7; font-size: 0.85em;">
                Import spells, cantrips, and abilities from a SillyTavern lorebook JSON file.
            </small>
        </div>
    `;

    html += '</div>';

    $('#rpg-editor-tab-spellbook').html(html);
    setupSpellbookEditorListeners();
}

function setupSpellbookEditorListeners() {
    // Update spell slot name
    $('.rpg-spellslot-name').off('blur').on('blur', function() {
        const lvl = parseInt($(this).data('level'));
        const name = String($(this).val() || '').trim();
        if (!extensionSettings.spellbook) extensionSettings.spellbook = { spellSlots: {} };
        extensionSettings.spellbook.spellSlots[lvl] = extensionSettings.spellbook.spellSlots[lvl] || { max: 0 };
        extensionSettings.spellbook.spellSlots[lvl].name = name;
        saveSettings();
        saveChatData();
    });

    // Update max slots
    $('.rpg-spellslot-max').off('change').on('change', function() {
        const lvl = parseInt($(this).data('level'));
        const val = parseInt($(this).val()) || 0;
        if (!extensionSettings.spellbook) extensionSettings.spellbook = { spellSlots: {} };
        extensionSettings.spellbook.spellSlots[lvl] = extensionSettings.spellbook.spellSlots[lvl] || { max: 0 };
        extensionSettings.spellbook.spellSlots[lvl].max = val;
        saveSettings();
        saveChatData();
        renderSpellbook();
    });

    // Remove spell level
    $('.rpg-spellslot-remove').off('click').on('click', function() {
        const lvl = parseInt($(this).data('level'));
        if (extensionSettings.spellbook && extensionSettings.spellbook.spellSlots) {
            delete extensionSettings.spellbook.spellSlots[lvl];
        }
        saveSettings();
        saveChatData();
        renderEditorUI();
    });

    // Add spell level button
    $('#rpg-add-spellslot').off('click').on('click', function() {
        if (!extensionSettings.spellbook) extensionSettings.spellbook = { spellSlots: {} };
        // Find the next available level
        let nextLevel = 1;
        while (extensionSettings.spellbook.spellSlots[nextLevel]) {
            nextLevel++;
        }
        if (nextLevel > 9) nextLevel = 10; // Allow custom levels beyond 9
        extensionSettings.spellbook.spellSlots[nextLevel] = { max: 0 };
        saveSettings();
        saveChatData();
        renderEditorUI();
    });

    // Clear spellbook cache button
    $('#rpg-clear-spellbook-cache-editor').off('click').on('click', function() {
        if (confirm('Clear the spellbook lorebook cache? This will remove all cached spell entries. The lorebook file will be rebuilt from your current spellbook on next spell addition.')) {
            localStorage.removeItem('rpg_companion_spell_entries_cache');
            console.log('[RPG Companion] Spellbook cache cleared');
            alert('Spellbook cache cleared! Old spell entries will no longer reappear.');
        }
    });

    // Import from lorebook button
    $('#rpg-import-lorebook-btn').off('click').on('click', async function() {
        try {
            const results = await showImportDialog();
            
            // Show results to user
            const message = `Import completed!\n\nSpells: ${results.spells}\nCantrips: ${results.cantrips}\nAbilities: ${results.abilities}\nSkipped: ${results.skipped}`;
            alert(message);
            
            // Re-render UI
            renderSpellbook();
            renderEditorUI();
        } catch (error) {
            console.error('[RPG Companion] Import error:', error);
            alert(`Import failed: ${error.message}`);
        }
    });
}
