/**
 * Avatar Stats Rendering Module
 * Handles rendering of the secondary "game avatar" stat panel with progress bars.
 */

import {
    extensionSettings,
    lastGeneratedData,
    committedTrackerData,
    $avatarStatsContainer
} from '../../core/state.js';
import { i18n } from '../../core/i18n.js';
import {
    saveSettings,
    saveChatData,
    updateMessageSwipeData
} from '../../core/persistence.js';
import { isItemLocked, setItemLock } from '../generation/lockManager.js';
import { getStatBarColors } from '../ui/theme.js';

/**
 * Converts field name to snake_case JSON key.
 * @param {string} name
 * @returns {string}
 */
function toFieldKey(name) {
    const baseName = name.replace(/\s*\(.*\)\s*$/, '').trim();
    return baseName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

/**
 * Rebuilds the avatarStats JSON string from extensionSettings.avatarStats and
 * syncs it to lastGeneratedData.avatarStats and committedTrackerData.avatarStats.
 */
export function updateAvatarStatsData() {
    const stats = extensionSettings.avatarStats;
    const config = extensionSettings.trackerConfig?.avatarStats || {};
    const enabledStats = config.customStats?.filter(s => s && s.enabled && s.name && s.id) || [];

    const statsArray = [];
    const processedIds = new Set();

    for (const stat of enabledStats) {
        statsArray.push({
            id: stat.id,
            name: stat.name,
            value: stats[stat.id] !== undefined ? stats[stat.id] : 100
        });
        processedIds.add(stat.id);
    }

    const statusObj = {};
    const customFields = config.statusSection?.customFields || [];
    for (const fieldName of customFields) {
        const fieldKey = toFieldKey(fieldName);
        statusObj[fieldKey] = stats[fieldKey] || 'None';
    }

    const jsonData = { stats: statsArray };
    if (customFields.length > 0) {
        jsonData.status = statusObj;
    }

    const jsonStr = JSON.stringify(jsonData, null, 2);
    lastGeneratedData.avatarStats = jsonStr;
    committedTrackerData.avatarStats = jsonStr;
}

/**
 * Renders the avatar stats panel with health bars and status.
 */
export function renderAvatarStats() {
    if (!extensionSettings.showAvatarStats || !$avatarStatsContainer) {
        return;
    }

    const stats = extensionSettings.avatarStats;
    const config = extensionSettings.trackerConfig?.avatarStats || {
        customStats: [
            { id: 'hp', name: 'HP', enabled: true },
            { id: 'mp', name: 'MP', enabled: true }
        ],
        statsDisplayMode: 'percentage',
        statusSection: { enabled: true, customFields: ['Conditions'] }
    };
    const label = extensionSettings.avatarStatsLabel || 'Game Avatar';

    // Create gradient from low to high color with opacity
    const colors = getStatBarColors();
    const gradient = `linear-gradient(to right, ${colors.low}, ${colors.high})`;

    // Check stats lock state
    const isStatsLocked = isItemLocked('avatarStats', 'stats');
    const lockIcon = isStatsLocked ? '🔒' : '🔓';
    const lockTitle = isStatsLocked ? 'Stats locked' : 'Stats unlocked';
    const lockedClass = isStatsLocked ? ' locked' : '';

    const enabledStats = config.customStats.filter(s => s && s.enabled && s.name && s.id);
    const displayMode = config.statsDisplayMode || 'percentage';
    const showLockIcons = extensionSettings.showLockIcons ?? true;

    let html = '<div class="rpg-stats-content">';
    html += '<div class="rpg-stats-left">';

    // Section label row
    html += `<div class="rpg-user-info-row">
        <span class="rpg-avatar-section-label">${label}</span>
    </div>`;

    // Stats grid
    if (showLockIcons) {
        html += `<span class="rpg-section-lock-icon${lockedClass}" data-tracker="avatarStats" data-path="stats" title="${lockTitle}">${lockIcon}</span>`;
    }
    html += '<div class="rpg-stats-grid">';

    for (const stat of enabledStats) {
        const value = stats[stat.id] !== undefined ? stats[stat.id] : 100;
        const maxValue = stat.maxValue || 100;

        let percentage;
        let displayValue;

        if (displayMode === 'number') {
            percentage = maxValue > 0 ? (value / maxValue) * 100 : 100;
            displayValue = `${value}/${maxValue}`;
        } else {
            percentage = value;
            displayValue = `${value}%`;
        }

        html += `
            <div class="rpg-stat-row">
                <span class="rpg-stat-label rpg-avatar-stat-name" contenteditable="false">${stat.name}:</span>
                <div class="rpg-stat-bar" style="background: ${gradient}">
                    <div class="rpg-stat-fill" style="width: ${100 - percentage}%"></div>
                </div>
                <span class="rpg-stat-value rpg-avatar-editable-stat" contenteditable="true"
                    data-field="${stat.id}" data-max="${maxValue}" data-mode="${displayMode}"
                    title="Click to edit">${displayValue}</span>
            </div>
        `;
    }
    html += '</div>';

    // Status section
    if (config.statusSection?.enabled) {
        const isStatusLocked = isItemLocked('avatarStats', 'status');
        const statusLockIcon = isStatusLocked ? '🔒' : '🔓';
        const statusLockTitle = isStatusLocked ? 'Status locked' : 'Status unlocked';
        const statusLockedClass = isStatusLocked ? ' locked' : '';

        html += '<div class="rpg-mood">';
        if (showLockIcons) {
            html += `<span class="rpg-section-lock-icon${statusLockedClass}" data-tracker="avatarStats" data-path="status" title="${statusLockTitle}">${statusLockIcon}</span>`;
        }

        const customFields = config.statusSection.customFields || [];
        for (const fieldName of customFields) {
            const fieldKey = toFieldKey(fieldName);
            let fieldValue = stats[fieldKey] || 'None';
            if (Array.isArray(fieldValue)) {
                fieldValue = fieldValue.join(', ') || 'None';
            } else if (typeof fieldValue === 'string') {
                fieldValue = fieldValue.replace(/^\[|\]$/g, '').trim();
            }
            html += `<div class="rpg-mood-conditions rpg-avatar-status-field" contenteditable="true"
                data-field="${fieldKey}" title="Click to edit ${fieldName}">${fieldValue}</div>`;
        }
        html += '</div>';
    }

    html += '</div>'; // Close rpg-stats-left
    html += '</div>'; // Close rpg-stats-content

    $avatarStatsContainer.html(html);

    // Event listeners for stat value editing
    $avatarStatsContainer.find('.rpg-avatar-editable-stat').on('blur', function () {
        const field = $(this).data('field');
        const mode = $(this).data('mode');
        const maxValue = parseInt($(this).data('max')) || 100;
        const textValue = $(this).text().trim();
        let value;

        if (mode === 'number') {
            const parts = textValue.split('/');
            value = parseInt(parts[0]);
            if (isNaN(value)) value = 0;
            value = Math.max(0, Math.min(maxValue, value));
        } else {
            value = parseInt(textValue.replace('%', ''));
            if (isNaN(value)) value = 0;
            value = Math.max(0, Math.min(100, value));
        }

        extensionSettings.avatarStats[field] = value;
        updateAvatarStatsData();
        saveSettings();
        saveChatData();
        updateMessageSwipeData();
        renderAvatarStats();
    });

    // Event listeners for status field editing
    $avatarStatsContainer.find('.rpg-avatar-status-field').on('blur', function () {
        const fieldKey = $(this).data('field');
        const value = $(this).text().trim();
        extensionSettings.avatarStats[fieldKey] = value || 'None';
        updateAvatarStatsData();
        saveSettings();
        saveChatData();
        updateMessageSwipeData();
    });

    // Lock icon click handler
    $avatarStatsContainer.find('.rpg-section-lock-icon').on('click touchend', function (e) {
        e.preventDefault();
        e.stopPropagation();
        const $icon = $(this);
        const trackerType = $icon.data('tracker');
        const itemPath = $icon.data('path');
        const currentlyLocked = isItemLocked(trackerType, itemPath);

        setItemLock(trackerType, itemPath, !currentlyLocked);

        const newIcon = !currentlyLocked ? '🔒' : '🔓';
        const newTitle = !currentlyLocked ? 'Locked' : 'Unlocked';
        $icon.text(newIcon);
        $icon.attr('title', newTitle);
        $icon.toggleClass('locked', !currentlyLocked);

        saveSettings();
    });
}
