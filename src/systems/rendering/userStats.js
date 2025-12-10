/**
 * User Stats Rendering Module
 * Handles rendering of the user stats panel with progress bars and classic RPG stats
 */

import { getContext } from '../../../../../../extensions.js';
import { user_avatar } from '../../../../../../../script.js';
import {
    extensionSettings,
    lastGeneratedData,
    committedTrackerData,
    $userStatsContainer,
    FALLBACK_AVATAR_DATA_URI
} from '../../core/state.js';
import {
    saveSettings,
    saveChatData,
    updateMessageSwipeData
} from '../../core/persistence.js';
import { getSafeThumbnailUrl } from '../../utils/avatars.js';
import { buildInventorySummary } from '../generation/promptBuilder.js';

/**
 * Builds the user stats text string using custom stat names
 * @returns {string} Formatted stats text for tracker
 */
export function buildUserStatsText() {
    const stats = extensionSettings.userStats;
    const config = extensionSettings.trackerConfig?.userStats || {
        customStats: [
            { id: 'health', name: 'Health', enabled: true },
            { id: 'satiety', name: 'Satiety', enabled: true },
            { id: 'energy', name: 'Energy', enabled: true },
            { id: 'hygiene', name: 'Hygiene', enabled: true },
            { id: 'arousal', name: 'Arousal', enabled: true }
        ],
        statusSection: { enabled: true, showMoodEmoji: true, customFields: ['Conditions'] },
        skillsSection: { enabled: false, label: 'Skills' }
    };

    let text = '';

    // Add enabled custom stats
    const enabledStats = config.customStats.filter(stat => stat && stat.enabled && stat.name && stat.id);
    for (const stat of enabledStats) {
        const value = stats[stat.id] !== undefined ? stats[stat.id] : 100;
        const useCurrentMax = stat.useCurrentMax || false;
        const maxValue = stat.maxValue || 100;
        
        if (useCurrentMax) {
            text += `${stat.name}: ${value}/${maxValue}\n`;
        } else {
            text += `${stat.name}: ${value}%\n`;
        }
    }

    // Add status section if enabled
    if (config.statusSection.enabled) {
        if (config.statusSection.showMoodEmoji) {
            text += `${stats.mood}: `;
        }
        text += `${stats.conditions || 'None'}\n`;
    }

    // Add inventory summary
    const inventorySummary = buildInventorySummary(stats.inventory);
    text += inventorySummary;

    return text.trim();
}

/**
 * Renders the user stats panel with health bars, mood, inventory, and classic stats.
 * Includes event listeners for editable fields.
```
 */
export function renderUserStats() {
    if (!extensionSettings.showUserStats || !$userStatsContainer) {
        return;
    }

    const stats = extensionSettings.userStats;
    const config = extensionSettings.trackerConfig?.userStats || {
        customStats: [
            { id: 'health', name: 'Health', enabled: true },
            { id: 'satiety', name: 'Satiety', enabled: true },
            { id: 'energy', name: 'Energy', enabled: true },
            { id: 'hygiene', name: 'Hygiene', enabled: true },
            { id: 'arousal', name: 'Arousal', enabled: true }
        ],
        rpgAttributes: [
            { id: 'str', name: 'STR', enabled: true },
            { id: 'dex', name: 'DEX', enabled: true },
            { id: 'con', name: 'CON', enabled: true },
            { id: 'int', name: 'INT', enabled: true },
            { id: 'wis', name: 'WIS', enabled: true },
            { id: 'cha', name: 'CHA', enabled: true }
        ],
        statusSection: { enabled: true, showMoodEmoji: true, customFields: ['Conditions'] },
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
    };
    const userName = getContext().name1;

    // Initialize lastGeneratedData.userStats if it doesn't exist
    if (!lastGeneratedData.userStats) {
        lastGeneratedData.userStats = buildUserStatsText();
    }

    // Get user portrait
    let userPortrait = FALLBACK_AVATAR_DATA_URI;
    if (user_avatar) {
        const thumbnailUrl = getSafeThumbnailUrl('persona', user_avatar);
        if (thumbnailUrl) {
            userPortrait = thumbnailUrl;
        }
    }

    // Create gradient from low to high color
    const gradient = `linear-gradient(to right, ${extensionSettings.statBarColorLow}, ${extensionSettings.statBarColorHigh})`;

    let html = '<div class="rpg-stats-content"><div class="rpg-stats-left">';

    // User info row
    html += `
        <div class="rpg-user-info-row">
            <img src="${userPortrait}" alt="${userName}" class="rpg-user-portrait" onerror="this.style.opacity='0.5';this.onerror=null;" />
            <span class="rpg-user-name">${userName}</span>
            <span style="opacity: 0.5;">|</span>
            <span class="rpg-level-label">LVL</span>
            <span class="rpg-level-value rpg-editable" contenteditable="true" data-field="level" title="Click to edit level">${extensionSettings.level}</span>
        </div>
    `;

    // Dynamic stats grid - only show enabled stats
    html += '<div class="rpg-stats-grid">';
    const enabledStats = config.customStats.filter(stat => stat && stat.enabled && stat.name && stat.id);

    for (const stat of enabledStats) {
        const value = stats[stat.id] !== undefined ? stats[stat.id] : 100;
        const useCurrentMax = stat.useCurrentMax || false;
        const maxValue = stat.maxValue || 100;
        
        let displayValue, fillPercentage;
        if (useCurrentMax) {
            displayValue = `${value}/${maxValue}`;
            fillPercentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
        } else {
            displayValue = `${value}%`;
            fillPercentage = value;
        }
        
        html += `
            <div class="rpg-stat-row">
                <span class="rpg-stat-label rpg-editable-stat-name" contenteditable="true" data-field="${stat.id}" title="Click to edit stat name">${stat.name}:</span>
                <div class="rpg-stat-bar" style="background: ${gradient}">
                    <div class="rpg-stat-fill" style="width: ${100 - fillPercentage}%"></div>
                </div>
                <span class="rpg-stat-value rpg-editable-stat" contenteditable="true" data-field="${stat.id}" data-use-current-max="${useCurrentMax}" data-max-value="${maxValue}" title="Click to edit">${displayValue}</span>
            </div>
        `;
    }
    html += '</div>';

    // Status section (conditionally rendered)
    if (config.statusSection.enabled) {
        html += '<div class="rpg-mood">';

        if (config.statusSection.showMoodEmoji) {
            html += `<div class="rpg-mood-emoji rpg-editable" contenteditable="true" data-field="mood" title="Click to edit emoji">${stats.mood}</div>`;
        }

        // Render custom status fields
        if (config.statusSection.customFields && config.statusSection.customFields.length > 0) {
            // For now, use first field as "conditions" for backward compatibility
            const conditionsValue = stats.conditions || 'None';
            html += `<div class="rpg-mood-conditions rpg-editable" contenteditable="true" data-field="conditions" title="Click to edit conditions">${conditionsValue}</div>`;
        }

        html += '</div>';
    }

    html += '</div>'; // Close rpg-stats-left

    // RPG Attributes section (dynamically generated from config)
    // Check if RPG Attributes section is enabled
    const showRPGAttributes = config.showRPGAttributes !== undefined ? config.showRPGAttributes : true;

    if (showRPGAttributes) {
        // Use attributes from config, with fallback to defaults if not configured
        const rpgAttributes = (config.rpgAttributes && config.rpgAttributes.length > 0) ? config.rpgAttributes : [
            { id: 'str', name: 'STR', enabled: true },
            { id: 'dex', name: 'DEX', enabled: true },
            { id: 'con', name: 'CON', enabled: true },
            { id: 'int', name: 'INT', enabled: true },
            { id: 'wis', name: 'WIS', enabled: true },
            { id: 'cha', name: 'CHA', enabled: true }
        ];
        const enabledAttributes = rpgAttributes.filter(attr => attr && attr.enabled && attr.name && attr.id);

        if (enabledAttributes.length > 0) {
        html += `
            <div class="rpg-stats-right">
                <div class="rpg-classic-stats">
                    <div class="rpg-classic-stats-grid">
        `;

        enabledAttributes.forEach(attr => {
            const value = extensionSettings.classicStats[attr.id] !== undefined ? extensionSettings.classicStats[attr.id] : 10;
            html += `
                        <div class="rpg-classic-stat" data-stat="${attr.id}">
                            <span class="rpg-classic-stat-label">${attr.name}</span>
                            <div class="rpg-classic-stat-buttons">
                                <button class="rpg-classic-stat-btn rpg-stat-decrease" data-stat="${attr.id}">−</button>
                                <span class="rpg-classic-stat-value">${value}</span>
                                <button class="rpg-classic-stat-btn rpg-stat-increase" data-stat="${attr.id}">+</button>
                            </div>
                        </div>
            `;
        });

        html += `
                    </div>
                </div>
            </div>
        `;
        }
    }

    html += '</div>'; // Close rpg-stats-content

    // Skills Section (collapsible, spans full width below stats)
    const dndSkillsConfig = config.dndSkills;
    console.log('D&D Skills Config:', dndSkillsConfig);
    console.log('Config object:', config);
    if (dndSkillsConfig && dndSkillsConfig.enabled) {
        console.log('Skills section is enabled, rendering...');
        // Initialize dndSkills storage if it doesn't exist
        if (!extensionSettings.userStats.dndSkills) {
            extensionSettings.userStats.dndSkills = {
                athletics: 0, acrobatics: 0, sleightOfHand: 0, stealth: 0,
                arcana: 0, history: 0, investigation: 0, nature: 0, religion: 0,
                animalHandling: 0, insight: 0, medicine: 0, perception: 0, survival: 0,
                deception: 0, intimidation: 0, performance: 0, persuasion: 0
            };
        }
        
        const isCollapsed = dndSkillsConfig.collapsed !== false; // Default to collapsed
        const chevronClass = isCollapsed ? 'fa-chevron-down' : 'fa-chevron-up';
        const contentClass = isCollapsed ? 'rpg-dnd-skills-content-collapsed' : '';
        
        html += `
            <div class="rpg-dnd-skills-section">
                <div class="rpg-dnd-skills-header" id="rpg-dnd-skills-toggle">
                    <span class="rpg-dnd-skills-title">
                        <i class="fa-solid ${chevronClass}"></i> Skills
                    </span>
                </div>
                <div class="rpg-dnd-skills-content ${contentClass}">
        `;

        // Render all skills in a flat list
        const skillsByAbility = {
            'STR': ['athletics'],
            'DEX': ['acrobatics', 'sleightOfHand', 'stealth'],
            'INT': ['arcana', 'history', 'investigation', 'nature', 'religion'],
            'WIS': ['animalHandling', 'insight', 'medicine', 'perception', 'survival'],
            'CHA': ['deception', 'intimidation', 'performance', 'persuasion']
        };

        const renderedSkills = new Set();
        
        // Render hardcoded skills in order
        for (const [ability, skillIds] of Object.entries(skillsByAbility)) {
            skillIds.forEach(skillId => {
                const skillConfig = dndSkillsConfig.skills[skillId];
                const skillValue = extensionSettings.userStats.dndSkills[skillId] !== undefined 
                    ? extensionSettings.userStats.dndSkills[skillId] 
                    : 0;
                
                html += `
                    <div class="rpg-dnd-skill-row">
                        <span class="rpg-dnd-skill-name">${skillConfig.name}</span>
                        <div class="rpg-dnd-skill-controls">
                            <input type="number" 
                                   class="rpg-dnd-skill-value rpg-editable-skill" 
                                   data-skill="${skillId}" 
                                   value="${skillValue}"
                                   title="Click to edit skill modifier">
                            <button class="rpg-skill-roll-btn" 
                                    data-skill="${skillId}" 
                                    data-skill-name="${skillConfig.name}" 
                                    data-skill-value="${skillValue}"
                                    title="Roll d20 + ${skillValue} for ${skillConfig.name}">
                                <i class="fa-solid fa-dice-d20"></i>
                            </button>
                        </div>
                    </div>
                `;
                renderedSkills.add(skillId);
            });
        }

        // Render any custom/new skills that were added dynamically
        if (dndSkillsConfig.skills) {
            for (const [skillId, skillConfig] of Object.entries(dndSkillsConfig.skills)) {
                if (!renderedSkills.has(skillId)) {
                    const skillValue = extensionSettings.userStats.dndSkills[skillId] !== undefined 
                        ? extensionSettings.userStats.dndSkills[skillId] 
                        : 0;
                    
                    html += `
                        <div class="rpg-dnd-skill-row">
                            <span class="rpg-dnd-skill-name">${skillConfig.name}</span>
                            <div class="rpg-dnd-skill-controls">
                                <input type="number" 
                                       class="rpg-dnd-skill-value rpg-editable-skill" 
                                       data-skill="${skillId}" 
                                       value="${skillValue}"
                                       title="Click to edit skill modifier">
                                <button class="rpg-skill-roll-btn" 
                                        data-skill="${skillId}" 
                                        data-skill-name="${skillConfig.name}" 
                                        data-skill-value="${skillValue}"
                                        title="Roll d20 + ${skillValue} for ${skillConfig.name}">
                                    <i class="fa-solid fa-dice-d20"></i>
                                </button>
                            </div>
                        </div>
                    `;
                }
            }
        }

        html += `
                </div>
            </div>
        `;
    }

    $userStatsContainer.html(html);

    // Add event listeners for editable stat values
    $('.rpg-editable-stat').on('blur', function() {
        const field = $(this).data('field');
        const useCurrentMax = $(this).data('use-current-max') === 'true' || $(this).data('use-current-max') === true;
        const maxValue = parseInt($(this).data('max-value')) || 100;
        const textValue = $(this).text().trim();
        let value;

        if (useCurrentMax) {
            // Parse "X/Y" format
            const match = textValue.match(/^(\d+)\/(\d+)$/);
            if (match) {
                value = parseInt(match[1]);
                const newMax = parseInt(match[2]);
                
                // Update max value in config if changed
                const config = extensionSettings.trackerConfig?.userStats;
                const stat = config?.customStats?.find(s => s.id === field);
                if (stat && newMax !== stat.maxValue) {
                    stat.maxValue = newMax;
                }
                
                // Clamp current value to max
                value = Math.max(0, Math.min(newMax, value));
            } else {
                // If format is wrong, just parse as number
                value = parseInt(textValue.replace(/[^\d]/g, ''));
                if (isNaN(value)) value = 0;
                value = Math.max(0, Math.min(maxValue, value));
            }
        } else {
            // Parse percentage format
            value = parseInt(textValue.replace('%', '').trim());
            if (isNaN(value)) value = 0;
            value = Math.max(0, Math.min(100, value));
        }

        // Update the setting
        extensionSettings.userStats[field] = value;

        // Rebuild userStats text with custom stat names
        const statsText = buildUserStatsText();

        // Update BOTH lastGeneratedData AND committedTrackerData
        // This makes manual edits immediately visible to AI
        lastGeneratedData.userStats = statsText;
        committedTrackerData.userStats = statsText;

        saveSettings();
        saveChatData();
        updateMessageSwipeData();

        // Re-render to update the bar
        renderUserStats();
    });

    // Add event listeners for mood/conditions editing
    $('.rpg-mood-emoji.rpg-editable').on('blur', function() {
        const value = $(this).text().trim();
        extensionSettings.userStats.mood = value || '😐';

        // Rebuild userStats text with custom stat names
        const statsText = buildUserStatsText();

        // Update BOTH lastGeneratedData AND committedTrackerData
        // This makes manual edits immediately visible to AI
        lastGeneratedData.userStats = statsText;
        committedTrackerData.userStats = statsText;

        saveSettings();
        saveChatData();
        updateMessageSwipeData();
    });

    $('.rpg-mood-conditions.rpg-editable').on('blur', function() {
        const value = $(this).text().trim();
        extensionSettings.userStats.conditions = value || 'None';

        // Rebuild userStats text with custom stat names
        const statsText = buildUserStatsText();

        // Update BOTH lastGeneratedData AND committedTrackerData
        // This makes manual edits immediately visible to AI
        lastGeneratedData.userStats = statsText;
        committedTrackerData.userStats = statsText;

        saveSettings();
        saveChatData();
        updateMessageSwipeData();
    });

    // Add event listeners for stat name editing
    $('.rpg-editable-stat-name').on('blur', function() {
        const field = $(this).data('field');
        const value = $(this).text().trim().replace(':', '');

        if (!extensionSettings.statNames) {
            extensionSettings.statNames = {
                health: 'Health',
                satiety: 'Satiety',
                energy: 'Energy',
                hygiene: 'Hygiene',
                arousal: 'Arousal'
            };
        }

        extensionSettings.statNames[field] = value || extensionSettings.statNames[field];

        saveSettings();
        saveChatData();

        // Re-render to update the display
        renderUserStats();
    });

    // Add event listener for level editing
    $('.rpg-level-value.rpg-editable').on('blur', function() {
        let value = parseInt($(this).text().trim());
        if (isNaN(value) || value < 1) {
            value = 1;
        }
        // Set reasonable max level
        value = Math.min(100, value);

        extensionSettings.level = value;
        saveSettings();
        saveChatData();
        updateMessageSwipeData();

        // Re-render to update the display
        renderUserStats();
    });

    // Prevent line breaks in level field
    $('.rpg-level-value.rpg-editable').on('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            $(this).blur();
        }
    });

    // Add event listeners for D&D skills editing
    $('.rpg-editable-skill').on('change blur', function() {
        const skillId = $(this).data('skill');
        let value = parseInt($(this).val());
        
        // Allow negative and positive values
        if (isNaN(value)) {
            value = 0;
        }
        
        // Update the setting
        if (!extensionSettings.userStats.dndSkills) {
            extensionSettings.userStats.dndSkills = {};
        }
        extensionSettings.userStats.dndSkills[skillId] = value;
        
        saveSettings();
        saveChatData();
        updateMessageSwipeData();
    });

    // Add toggle for D&D Skills section
    $('#rpg-dnd-skills-toggle').on('click', function() {
        const $content = $('.rpg-dnd-skills-content');
        const $icon = $(this).find('i');
        
        if ($content.hasClass('rpg-dnd-skills-content-collapsed')) {
            $content.removeClass('rpg-dnd-skills-content-collapsed');
            $icon.removeClass('fa-chevron-down').addClass('fa-chevron-up');
            if (extensionSettings.trackerConfig.userStats.dndSkills) {
                extensionSettings.trackerConfig.userStats.dndSkills.collapsed = false;
            }
        } else {
            $content.addClass('rpg-dnd-skills-content-collapsed');
            $icon.removeClass('fa-chevron-up').addClass('fa-chevron-down');
            if (extensionSettings.trackerConfig.userStats.dndSkills) {
                extensionSettings.trackerConfig.userStats.dndSkills.collapsed = true;
            }
        }
        
        saveSettings();
    });

    // Add skill roll button handler
    $('.rpg-skill-roll-btn').on('click', async function() {
        const skillId = $(this).data('skill');
        const skillName = $(this).data('skill-name');
        
        // Get the CURRENT value from the input field, not the stale data attribute
        const $skillInput = $(this).siblings('.rpg-dnd-skill-value');
        const skillModifier = parseInt($skillInput.val()) || 0;
        
        // Roll d20
        const d20Roll = Math.floor(Math.random() * 20) + 1;
        const totalRoll = d20Roll + skillModifier;
        
        // Format the message
        const message = `I rolled a ${skillName} Check: ${totalRoll}`;
        
        // Insert into chat input
        const chatInput = $('#send_textarea');
        if (chatInput.length) {
            const currentText = chatInput.val();
            const newText = currentText ? currentText + '\n' + message : message;
            chatInput.val(newText);
            chatInput.trigger('input'); // Trigger input event to update character count, etc.
        }
    });
}
