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
        text += `${stat.name}: ${value}%\n`;
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

    // Add skills if enabled
    if (config.skillsSection.enabled && stats.skills) {
        text += `\n${config.skillsSection.label}: ${stats.skills}`;
    }

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
        skillsSection: { enabled: false, label: 'Skills' }
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
        html += `
            <div class="rpg-stat-row">
                <span class="rpg-stat-label rpg-editable-stat-name" contenteditable="true" data-field="${stat.id}" title="Click to edit stat name">${stat.name}:</span>
                <div class="rpg-stat-bar" style="background: ${gradient}">
                    <div class="rpg-stat-fill" style="width: ${100 - value}%"></div>
                </div>
                <span class="rpg-stat-value rpg-editable-stat" contenteditable="true" data-field="${stat.id}" title="Click to edit">${value}%</span>
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

    // Skills section (conditionally rendered)
    if (config.skillsSection.enabled) {
        const skillsValue = stats.skills || 'None';
        html += `
            <div class="rpg-skills-section">
                <span class="rpg-skills-label">${config.skillsSection.label}:</span>
                <div class="rpg-skills-value rpg-editable" contenteditable="true" data-field="skills" title="Click to edit skills">${skillsValue}</div>
            </div>
        `;
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

    $userStatsContainer.html(html);

    // Add event listeners for editable stat values
    $('.rpg-editable-stat').on('blur', function() {
        const field = $(this).data('field');
        const textValue = $(this).text().replace('%', '').trim();
        let value = parseInt(textValue);

        // Validate and clamp value between 0 and 100
        if (isNaN(value)) {
            value = 0;
        }
        value = Math.max(0, Math.min(100, value));

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
}
