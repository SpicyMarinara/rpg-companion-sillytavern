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

/**
 * Renders the user stats panel with health bars, mood, inventory, and classic stats.
 * Includes event listeners for editable fields.
 */
export function renderUserStats() {
    if (!extensionSettings.showUserStats || !$userStatsContainer) {
        return;
    }

    // Get tracker data - prefer lastGeneratedData, fallback to committedTrackerData
    const tracker = lastGeneratedData || committedTrackerData || {};
    const config = extensionSettings.trackerConfig?.userStats || {
        customStats: [
            { id: 'health', name: 'Health', description: '', enabled: true },
            { id: 'satiety', name: 'Satiety', description: '', enabled: true },
            { id: 'energy', name: 'Energy', description: '', enabled: true },
            { id: 'hygiene', name: 'Hygiene', description: '', enabled: true },
            { id: 'arousal', name: 'Arousal', description: '', enabled: true }
        ],
        rpgAttributes: [
            { id: 'str', name: 'STR', description: '', enabled: true },
            { id: 'dex', name: 'DEX', description: '', enabled: true },
            { id: 'con', name: 'CON', description: '', enabled: true },
            { id: 'int', name: 'INT', description: '', enabled: true },
            { id: 'wis', name: 'WIS', description: '', enabled: true },
            { id: 'cha', name: 'CHA', description: '', enabled: true }
        ],
        statusSection: { enabled: true, showMoodEmoji: true, customFields: ['Conditions'] },
        skillsSection: { enabled: false, label: 'Skills' }
    };
    const userName = getContext().name1;

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
            <span class="rpg-level-value rpg-editable" contenteditable="true" data-field="level" title="Click to edit level">${tracker.level ?? 1}</span>
        </div>
    `;

    // Dynamic stats grid - only show enabled stats (keyed by name in tracker data)
    html += '<div class="rpg-stats-grid">';
    const enabledStats = config.customStats.filter(stat => stat && stat.enabled && stat.name);

    for (const stat of enabledStats) {
        const value = tracker.stats?.[stat.name] ?? 100;
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
            const mood = tracker.status?.mood || '😐';
            html += `<div class="rpg-mood-emoji rpg-editable" contenteditable="true" data-field="mood" title="Click to edit emoji">${mood}</div>`;
        }

        // Render custom status fields
        if (config.statusSection.customFields && config.statusSection.customFields.length > 0) {
            const conditionsValue = tracker.status?.fields 
                ? Object.values(tracker.status.fields).filter(Boolean).join(', ') || 'None'
                : 'None';
            html += `<div class="rpg-mood-conditions rpg-editable" contenteditable="true" data-field="conditions" title="Click to edit conditions">${conditionsValue}</div>`;
        }

        html += '</div>';
    }

    // Skills section (conditionally rendered) - only if NOT shown in separate tab
    if (config.skillsSection.enabled && !extensionSettings.showSkills) {
        const skillNames = Object.values(tracker.skills || {})
            .flat()
            .map(s => s?.name)
            .filter(Boolean)
            .join(', ') || 'None';
        html += `
            <div class="rpg-skills-section">
                <span class="rpg-skills-label">${config.skillsSection.label}:</span>
                <div class="rpg-skills-value rpg-editable" contenteditable="true" data-field="skills" title="Click to edit skills">${skillNames}</div>
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
            { id: 'str', name: 'STR', description: '', enabled: true },
            { id: 'dex', name: 'DEX', description: '', enabled: true },
            { id: 'con', name: 'CON', description: '', enabled: true },
            { id: 'int', name: 'INT', description: '', enabled: true },
            { id: 'wis', name: 'WIS', description: '', enabled: true },
            { id: 'cha', name: 'CHA', description: '', enabled: true }
        ];
        const enabledAttributes = rpgAttributes.filter(attr => attr && attr.enabled && attr.name && attr.id);

        if (enabledAttributes.length > 0) {
        html += `
            <div class="rpg-stats-right">
                <div class="rpg-classic-stats">
                    <div class="rpg-classic-stats-grid">
        `;

        enabledAttributes.forEach(attr => {
            // Attributes are keyed by name in tracker data
            const value = tracker.attributes?.[attr.name] ?? 10;
            html += `
                        <div class="rpg-classic-stat" data-stat="${attr.id}" data-attr-name="${attr.name}">
                            <span class="rpg-classic-stat-label">${attr.name}</span>
                            <div class="rpg-classic-stat-buttons">
                                <button class="rpg-classic-stat-btn rpg-stat-decrease" data-stat="${attr.id}" data-attr-name="${attr.name}">−</button>
                                <span class="rpg-classic-stat-value">${value}</span>
                                <button class="rpg-classic-stat-btn rpg-stat-increase" data-stat="${attr.id}" data-attr-name="${attr.name}">+</button>
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
        const statId = $(this).data('field');
        const textValue = $(this).text().replace('%', '').trim();
        let value = parseInt(textValue);

        // Validate and clamp value between 0 and 100
        if (isNaN(value)) value = 0;
        value = Math.max(0, Math.min(100, value));

        // Find stat name from config
        const config = extensionSettings.trackerConfig?.userStats;
        const stat = config?.customStats?.find(s => s.id === statId);
        const statName = stat?.name || statId;

        // Update tracker data (keyed by stat name)
        if (!lastGeneratedData.stats) lastGeneratedData.stats = {};
        lastGeneratedData.stats[statName] = value;

        saveChatData();
        updateMessageSwipeData();
        renderUserStats();
    });

    // Add event listeners for mood editing
    $('.rpg-mood-emoji.rpg-editable').on('blur', function() {
        const value = $(this).text().trim() || '😐';

        if (!lastGeneratedData.status) lastGeneratedData.status = {};
        lastGeneratedData.status.mood = value;

        saveChatData();
        updateMessageSwipeData();
    });

    // Add event listeners for conditions editing
    $('.rpg-mood-conditions.rpg-editable').on('blur', function() {
        const value = $(this).text().trim() || 'None';

        if (!lastGeneratedData.status) lastGeneratedData.status = {};
        if (!lastGeneratedData.status.fields) lastGeneratedData.status.fields = {};
        lastGeneratedData.status.fields.Conditions = value;

        saveChatData();
        updateMessageSwipeData();
    });

    // Add event listener for skills editing (inline skills section)
    $('.rpg-skills-value.rpg-editable').on('blur', function() {
        // This is a simplified text edit - for complex skill editing, use the skills panel
        saveChatData();
        updateMessageSwipeData();
    });

    // Add event listeners for stat name editing
    $('.rpg-editable-stat-name').on('blur', function() {
        const field = $(this).data('field');
        const value = $(this).text().trim().replace(':', '');

        // Update the stat name in customStats array (new format)
        const config = extensionSettings.trackerConfig?.userStats;
        if (config && config.customStats) {
            const stat = config.customStats.find(s => s.id === field);
            if (stat && value) {
                stat.name = value;
                saveSettings();
                saveChatData();

                // Re-render to update the display
                renderUserStats();
            }
        }
    });

    // Add event listener for level editing
    $('.rpg-level-value.rpg-editable').on('blur', function() {
        let value = parseInt($(this).text().trim());
        if (isNaN(value) || value < 1) value = 1;
        value = Math.min(100, value);

        lastGeneratedData.level = value;
        saveChatData();
        updateMessageSwipeData();
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
