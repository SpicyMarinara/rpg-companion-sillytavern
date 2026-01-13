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
import { isItemLocked, setItemLock } from '../generation/lockManager.js';
import { updateFabWidgets } from '../ui/mobile.js';

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
 * Updates lastGeneratedData.userStats and committedTrackerData.userStats
 * Maintains JSON format if current data is JSON, otherwise uses text format.
 * @private
 */
function updateUserStatsData() {
    // Check if current data is in JSON format
    const currentData = lastGeneratedData.userStats || committedTrackerData.userStats;
    if (currentData) {
        const trimmed = currentData.trim();
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            // Maintain JSON format
            try {
                const jsonData = JSON.parse(currentData);
                if (jsonData && typeof jsonData === 'object') {
                    const stats = extensionSettings.userStats;
                    const config = extensionSettings.trackerConfig?.userStats || {};
                    const enabledStats = config.customStats?.filter(stat => stat && stat.enabled && stat.name && stat.id) || [];

                    // Build stats array - include all stats from extensionSettings, not just enabled ones
                    // This preserves custom stats that AI might have added or that user has disabled
                    const statsArray = [];
                    const processedIds = new Set();

                    // First, add all enabled stats from config (maintains order)
                    enabledStats.forEach(stat => {
                        statsArray.push({
                            id: stat.id,
                            name: stat.name,
                            value: stats[stat.id] !== undefined ? stats[stat.id] : 100
                        });
                        processedIds.add(stat.id);
                    });

                    // Then, add any other numeric stats from extensionSettings that aren't in config
                    // (these could be custom stats the AI added or disabled stats)
                    const customFields = config.statusSection?.customFields || [];
                    const excludeFields = new Set(['mood', ...customFields.map(f => f.toLowerCase()), 'inventory', 'skills', 'level']);
                    Object.entries(stats).forEach(([key, value]) => {
                        if (!processedIds.has(key) && !excludeFields.has(key) && typeof value === 'number') {
                            statsArray.push({
                                id: key,
                                name: key.charAt(0).toUpperCase() + key.slice(1),
                                value: value
                            });
                        }
                    });

                    jsonData.stats = statsArray;

                    // Update status - include all custom status fields
                    jsonData.status = {
                        mood: stats.mood || '😐'
                    };

                    // Add all custom status fields
                    for (const fieldName of customFields) {
                        const fieldKey = fieldName.toLowerCase();
                        jsonData.status[fieldKey] = stats[fieldKey] || 'None';
                    }

                    // Update inventory (convert to v3 format)
                    const convertToV3Items = (itemString) => {
                        if (!itemString) return [];
                        const items = itemString.split(',').map(s => s.trim()).filter(s => s);
                        return items.map(item => {
                            const qtyMatch = item.match(/^(\\d+)x\\s+(.+)$/);
                            if (qtyMatch) {
                                return { name: qtyMatch[2].trim(), quantity: parseInt(qtyMatch[1]) };
                            }
                            return { name: item, quantity: 1 };
                        });
                    };

                    jsonData.inventory = {
                        onPerson: convertToV3Items(stats.inventory?.onPerson),
                        clothing: convertToV3Items(stats.inventory?.clothing),
                        stored: stats.inventory?.stored || {},
                        assets: convertToV3Items(stats.inventory?.assets)
                    };

                    // Update quests
                    jsonData.quests = extensionSettings.quests || { main: '', optional: [] };

                    // Update skills if present
                    if (stats.skills) {
                        jsonData.skills = Array.isArray(stats.skills) ? stats.skills :
                            stats.skills.split(',').map(s => s.trim()).filter(s => s);
                    }

                    const updatedJSON = JSON.stringify(jsonData, null, 2);
                    lastGeneratedData.userStats = updatedJSON;
                    committedTrackerData.userStats = updatedJSON;
                    return;
                }
            } catch (e) {
                console.warn('[RPG Companion] Failed to parse JSON, falling back to text format:', e);
            }
        }
    }

    // Fall back to text format
    const statsText = buildUserStatsText();
    lastGeneratedData.userStats = statsText;
    committedTrackerData.userStats = statsText;
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

    // Don't render if no data exists (e.g., after cache clear)
    // Check both lastGeneratedData and committedTrackerData
    // console.log('[RPG UserStats Render] Checking data:', {
    //     hasLastGenerated: !!lastGeneratedData.userStats,
    //     hasCommitted: !!committedTrackerData.userStats,
    //     lastGeneratedPreview: lastGeneratedData.userStats ? lastGeneratedData.userStats.substring(0, 100) : 'null',
    //     committedPreview: committedTrackerData.userStats ? committedTrackerData.userStats.substring(0, 100) : 'null'
    // });

    if (!lastGeneratedData.userStats && !committedTrackerData.userStats) {
        // Always render to the #rpg-user-stats container (mobile layout just moves it around in DOM)
        $userStatsContainer.html('<div class="rpg-inventory-empty">No statuses generated yet</div>');
        return;
    }

    // Use lastGeneratedData if available, otherwise fall back to committed data
    if (!lastGeneratedData.userStats && committedTrackerData.userStats) {
        lastGeneratedData.userStats = committedTrackerData.userStats;
    }

    const stats = extensionSettings.userStats;
    // console.log('[RPG UserStats Render] Current extensionSettings.userStats:', {
    //     health: stats.health,
    //     satiety: stats.satiety,
    //     energy: stats.energy,
    //     hygiene: stats.hygiene,
    //     arousal: stats.arousal,
    //     mood: stats.mood,
    //     conditions: stats.conditions
    // });
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

    // Check if stats bars section is locked
    const isStatsLocked = isItemLocked('userStats', 'stats');
    const lockIcon = isStatsLocked ? '🔒' : '🔓';
    const lockTitle = isStatsLocked ? 'Locked - AI cannot change stats' : 'Unlocked - AI can change stats';
    const lockedClass = isStatsLocked ? ' locked' : '';

    let html = '<div class="rpg-stats-content">';
    html += '<div class="rpg-stats-left">';

    // User info row
    const showLevel = extensionSettings.trackerConfig?.userStats?.showLevel !== false;
    html += `
        <div class="rpg-user-info-row">
            <img src="${userPortrait}" alt="${userName}" class="rpg-user-portrait" onerror="this.style.opacity='0.5';this.onerror=null;" />
            <span class="rpg-user-name">${userName}</span>
            ${showLevel ? `<span style="opacity: 0.5;">|</span>
            <span class="rpg-level-label">LVL</span>
            <span class="rpg-level-value rpg-editable" contenteditable="true" data-field="level" title="Click to edit level">${extensionSettings.level}</span>` : ''}
        </div>
    `;

    // Dynamic stats grid - only show enabled stats
    const showLockIcons = extensionSettings.showLockIcons ?? true;
    if (showLockIcons) {
        html += `<span class="rpg-section-lock-icon${lockedClass}" data-tracker="userStats" data-path="stats" title="${lockTitle}">${lockIcon}</span>`;
    }
    html += '<div class="rpg-stats-grid">';
    const enabledStats = config.customStats.filter(stat => stat && stat.enabled && stat.name && stat.id);
    const displayMode = config.statsDisplayMode || 'percentage';

    for (const stat of enabledStats) {
        const value = stats[stat.id] !== undefined ? stats[stat.id] : 100;
        const maxValue = stat.maxValue || 100;

        // Calculate percentage for bar fill
        let percentage;
        let displayValue;

        if (displayMode === 'number') {
            // In number mode, value is already the number (0 to maxValue)
            percentage = maxValue > 0 ? (value / maxValue) * 100 : 100;
            displayValue = `${value}/${maxValue}`;
        } else {
            // In percentage mode, value is 0-100
            percentage = value;
            displayValue = `${value}%`;
        }

        html += `
            <div class="rpg-stat-row">
                <span class="rpg-stat-label rpg-editable-stat-name" contenteditable="true" data-field="${stat.id}" title="Click to edit stat name">${stat.name}:</span>
                <div class="rpg-stat-bar" style="background: ${gradient}">
                    <div class="rpg-stat-fill" style="width: ${100 - percentage}%"></div>
                </div>
                <span class="rpg-stat-value rpg-editable-stat" contenteditable="true" data-field="${stat.id}" data-max="${maxValue}" data-mode="${displayMode}" title="Click to edit">${displayValue}</span>
            </div>
        `;
    }
    html += '</div>';

    // Status section (conditionally rendered)
    if (config.statusSection.enabled) {
        const isMoodLocked = isItemLocked('userStats', 'status');
        const moodLockIcon = isMoodLocked ? '🔒' : '🔓';
        const moodLockTitle = isMoodLocked ? 'Locked - AI cannot change mood' : 'Unlocked - AI can change mood';
        const moodLockedClass = isMoodLocked ? ' locked' : '';
        html += '<div class="rpg-mood">';
        if (showLockIcons) {
            html += `<span class="rpg-section-lock-icon${moodLockedClass}" data-tracker="userStats" data-path="status" title="${moodLockTitle}">${moodLockIcon}</span>`;
        }

        if (config.statusSection.showMoodEmoji) {
            html += `<div class="rpg-mood-emoji rpg-editable" contenteditable="true" data-field="mood" title="Click to edit emoji">${stats.mood}</div>`;
        }

        // Render custom status fields
        if (config.statusSection.customFields && config.statusSection.customFields.length > 0) {
            for (const fieldName of config.statusSection.customFields) {
                const fieldKey = fieldName.toLowerCase();
                let fieldValue = stats[fieldKey] || 'None';
                // Strip brackets if present (from JSON array format)
                if (typeof fieldValue === 'string') {
                    fieldValue = fieldValue.replace(/^\[|\]$/g, '').trim();
                }
                html += `<div class="rpg-mood-conditions rpg-editable" contenteditable="true" data-field="${fieldKey}" title="Click to edit ${fieldName}">${fieldValue}</div>`;
            }
        }

        html += '</div>';
    }

    // Skills section (conditionally rendered)
    if (config.skillsSection.enabled) {
        const isSkillsLocked = isItemLocked('userStats', 'skills');
        const skillsLockIcon = isSkillsLocked ? '🔒' : '🔓';
        const skillsLockTitle = isSkillsLocked ? 'Locked - AI cannot change skills' : 'Unlocked - AI can change skills';
        const skillsLockedClass = isSkillsLocked ? ' locked' : '';
        let skillsValue = 'None';
        // Handle JSON array format: [{name: "Art"}, {name: "Coding"}]
        if (Array.isArray(stats.skills)) {
            skillsValue = stats.skills.map(s => s.name || s).join(', ') || 'None';
        } else if (stats.skills) {
            skillsValue = stats.skills;
        }
        html += `
            <div class="rpg-skills-section">`;
        if (showLockIcons) {
            html += `
                <span class="rpg-section-lock-icon${skillsLockedClass}" data-tracker="userStats" data-path="skills" title="${skillsLockTitle}">${skillsLockIcon}</span>`;
        }
        html += `
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

    // console.log('[RPG UserStats Render] Generated HTML length:', html.length);
    // console.log('[RPG UserStats Render] HTML preview:', html.substring(0, 300));
    // console.log('[RPG UserStats Render] Container exists:', !!$userStatsContainer, '$userStatsContainer length:', $userStatsContainer?.length);

    // Always render to the #rpg-user-stats container (mobile layout just moves it around in DOM)
    $userStatsContainer.html(html);
    // console.log('[RPG UserStats Render] ✓ HTML rendered to #rpg-user-stats container');

    // Add event listeners for editable stat values
    $('.rpg-editable-stat').on('blur', function() {
        const field = $(this).data('field');
        const mode = $(this).data('mode');
        const maxValue = parseInt($(this).data('max')) || 100;
        const textValue = $(this).text().trim();
        let value;

        if (mode === 'number') {
            // In number mode, parse "X/MAX" or just "X"
            const parts = textValue.split('/');
            value = parseInt(parts[0]);

            // Validate and clamp value between 0 and maxValue
            if (isNaN(value)) {
                value = 0;
            }
            value = Math.max(0, Math.min(maxValue, value));
        } else {
            // In percentage mode, parse "X%" or just "X"
            value = parseInt(textValue.replace('%', ''));

            // Validate and clamp value between 0 and 100
            if (isNaN(value)) {
                value = 0;
            }
            value = Math.max(0, Math.min(100, value));
        }

        // Update the setting
        extensionSettings.userStats[field] = value;

        // Update userStats data (maintains JSON or text format)
        updateUserStatsData();

        saveSettings();
        saveChatData();
        updateMessageSwipeData();

        // Re-render to update the bar and FAB widgets
        renderUserStats();
        updateFabWidgets();
    });

    // Add event listeners for mood/conditions editing
    $('.rpg-mood-emoji.rpg-editable').on('blur', function() {
        const value = $(this).text().trim();
        extensionSettings.userStats.mood = value || '😐';

        // Update userStats data (maintains JSON or text format)
        updateUserStatsData();

        saveSettings();
        saveChatData();
        updateMessageSwipeData();
    });

    $('.rpg-mood-conditions.rpg-editable').on('blur', function() {
        const value = $(this).text().trim();
        const fieldKey = $(this).data('field');
        extensionSettings.userStats[fieldKey] = value || 'None';

        // Update userStats data (maintains JSON or text format)
        updateUserStatsData();

        saveSettings();
        saveChatData();
        updateMessageSwipeData();
    });

    // Add event listener for skills editing
    $('.rpg-skills-value.rpg-editable').on('blur', function() {
        const value = $(this).text().trim();
        extensionSettings.userStats.skills = value || 'None';

        // Update userStats data (maintains JSON or text format)
        updateUserStatsData();

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

// Add event listener for section lock icon clicks (support both click and touch)
    $('.rpg-section-lock-icon').on('click touchend', function(e) {
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
        const newTitle = !currentlyLocked ? 'Locked - AI cannot change this section' : 'Unlocked - AI can change this section';
        $icon.text(newIcon);
        $icon.attr('title', newTitle);

        // Toggle 'locked' class for persistent visibility
        $icon.toggleClass('locked', !currentlyLocked);

        // Save settings
        saveSettings();
    });
}
