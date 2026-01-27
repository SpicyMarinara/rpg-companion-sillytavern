/**
 * Desktop UI Module
 * Handles desktop-specific UI functionality: tab navigation and strip widgets
 */

import { i18n } from '../../core/i18n.js';
import { extensionSettings, lastGeneratedData, committedTrackerData } from '../../core/state.js';
import { hexToRgba } from './theme.js';

/**
 * Helper to parse time string and calculate clock hand angles
 */
function parseTimeForClock(timeStr) {
    const timeMatch = timeStr.match(/(\d+):(\d+)/);
    if (timeMatch) {
        const hours = parseInt(timeMatch[1]);
        const minutes = parseInt(timeMatch[2]);
        const hourAngle = (hours % 12) * 30 + minutes * 0.5; // 30° per hour + 0.5° per minute
        const minuteAngle = minutes * 6; // 6° per minute
        return { hourAngle, minuteAngle };
    }
    return { hourAngle: 0, minuteAngle: 0 };
}

/**
 * Updates the desktop strip widgets display based on current tracker data and settings.
 * Strip widgets are shown vertically in the collapsed panel strip.
 */
export function updateStripWidgets() {
    const $panel = $('#rpg-companion-panel');
    const $container = $('#rpg-strip-widget-container');

    if ($panel.length === 0 || $container.length === 0) return;

    // Check if strip widgets are enabled
    const widgetSettings = extensionSettings.desktopStripWidgets;
    if (!widgetSettings || !widgetSettings.enabled) {
        $panel.removeClass('rpg-strip-widgets-enabled');
        $container.find('.rpg-strip-widget').removeClass('rpg-strip-widget-visible');
        return;
    }

    // Add enabled class to panel for CSS styling (wider collapsed width)
    $panel.addClass('rpg-strip-widgets-enabled');

    // Get tracker data - use imported state directly
    const infoBox = lastGeneratedData?.infoBox || committedTrackerData?.infoBox;

    // Parse infoBox if it's a string
    let infoData = null;
    if (infoBox) {
        try {
            infoData = typeof infoBox === 'string' ? JSON.parse(infoBox) : infoBox;
        } catch (e) {
            console.warn('[RPG Strip Widgets] Failed to parse infoBox:', e);
        }
    }

    // Weather Icon Widget (with description)
    const $weatherWidget = $container.find('.rpg-strip-widget-weather');
    if (widgetSettings.weatherIcon?.enabled && infoData?.weather?.emoji) {
        $weatherWidget.find('.rpg-strip-widget-icon').text(infoData.weather.emoji);
        // Show weather description truncated
        const forecast = infoData.weather.forecast || '';
        const displayForecast = forecast.length > 12 ? forecast.substring(0, 10) + '…' : forecast;
        $weatherWidget.find('.rpg-strip-widget-desc').text(displayForecast);
        $weatherWidget.attr('title', forecast || 'Weather');
        $weatherWidget.addClass('rpg-strip-widget-visible');
    } else {
        $weatherWidget.removeClass('rpg-strip-widget-visible');
    }

    // Clock Widget with animated face
    const $clockWidget = $container.find('.rpg-strip-widget-clock');
    if (widgetSettings.clock?.enabled && infoData?.time) {
        const timeStr = infoData.time.end || infoData.time.value || infoData.time.start || '';
        if (timeStr) {
            // Update clock hands
            const { hourAngle, minuteAngle } = parseTimeForClock(timeStr);
            $clockWidget.find('.rpg-strip-clock-hour').css('transform', `rotate(${hourAngle}deg)`);
            $clockWidget.find('.rpg-strip-clock-minute').css('transform', `rotate(${minuteAngle}deg)`);
            $clockWidget.find('.rpg-strip-widget-value').text(timeStr);
            $clockWidget.attr('title', `Time: ${timeStr}`);
            $clockWidget.addClass('rpg-strip-widget-visible');
        } else {
            $clockWidget.removeClass('rpg-strip-widget-visible');
        }
    } else {
        $clockWidget.removeClass('rpg-strip-widget-visible');
    }

    // Date Widget
    const $dateWidget = $container.find('.rpg-strip-widget-date');
    if (widgetSettings.date?.enabled && infoData?.date?.value) {
        const dateVal = infoData.date.value;
        // Truncate long dates for display
        const displayDate = dateVal.length > 20 ? dateVal.substring(0, 18) + '…' : dateVal;
        $dateWidget.find('.rpg-strip-widget-value').text(displayDate);
        $dateWidget.attr('title', dateVal);
        $dateWidget.addClass('rpg-strip-widget-visible');
    } else {
        $dateWidget.removeClass('rpg-strip-widget-visible');
    }

    // Location Widget
    const $locationWidget = $container.find('.rpg-strip-widget-location');
    if (widgetSettings.location?.enabled && infoData?.location?.value) {
        const loc = infoData.location.value;
        // Truncate long locations for display
        const displayLoc = loc.length > 15 ? loc.substring(0, 13) + '…' : loc;
        $locationWidget.find('.rpg-strip-widget-value').text(displayLoc);
        $locationWidget.attr('title', loc);
        $locationWidget.addClass('rpg-strip-widget-visible');
    } else {
        $locationWidget.removeClass('rpg-strip-widget-visible');
    }

    // Stats Widget - get from lastGeneratedData or committedTrackerData first, fallback to extensionSettings
    const $statsWidget = $container.find('.rpg-strip-widget-stats');
    if (widgetSettings.stats?.enabled) {
        let allStats = [];

        // Try to get stats from tracker data first (most current)
        const userStatsData = lastGeneratedData?.userStats || committedTrackerData?.userStats;
        if (userStatsData) {
            try {
                const parsedStats = typeof userStatsData === 'string' ? JSON.parse(userStatsData) : userStatsData;
                if (parsedStats?.stats) {
                    allStats = parsedStats.stats;
                }
            } catch (e) {
                console.warn('[RPG Strip Widgets] Failed to parse tracker userStats:', e);
            }
        }

        // Fallback to extensionSettings.userStats
        if (allStats.length === 0 && extensionSettings.userStats) {
            try {
                const userStatsJson = extensionSettings.userStats;
                const parsedUserStats = typeof userStatsJson === 'string' ? JSON.parse(userStatsJson) : userStatsJson;
                if (parsedUserStats?.stats) {
                    allStats = parsedUserStats.stats;
                }
            } catch (e) {
                console.warn('[RPG Strip Widgets] Failed to parse extensionSettings.userStats:', e);
            }
        }

        if (allStats.length > 0) {
            // Get enabled stats from trackerConfig
            const configuredStats = extensionSettings.trackerConfig?.userStats?.customStats || [];
            const enabledStatMap = new Map();
            configuredStats.forEach(s => {
                if (s.enabled !== false) {
                    enabledStatMap.set(s.id?.toLowerCase(), true);
                    enabledStatMap.set(s.name?.toLowerCase(), true);
                }
            });

            const $statsList = $statsWidget.find('.rpg-strip-stats-list');
            $statsList.empty();

            allStats.forEach(stat => {
                // Filter by config if available - but if no config, show all
                if (configuredStats.length > 0) {
                    const statId = stat.id?.toLowerCase();
                    const statName = stat.name?.toLowerCase();
                    if (!enabledStatMap.has(statId) && !enabledStatMap.has(statName)) return;
                }

                const value = typeof stat.value === 'number' ? stat.value : parseInt(stat.value) || 0;
                const color = getStatColor(value);
                const abbr = stat.name.substring(0, 3).toUpperCase();

                const $item = $(`<div class="rpg-strip-stat-item" title="${stat.name}: ${value}">
                    <span class="rpg-strip-stat-name">${abbr}</span>
                    <span class="rpg-strip-stat-value" style="color: ${color};">${value}</span>
                </div>`);
                $statsList.append($item);
            });

            if ($statsList.children().length > 0) {
                $statsWidget.addClass('rpg-strip-widget-visible');
            } else {
                $statsWidget.removeClass('rpg-strip-widget-visible');
            }
        } else {
            $statsWidget.removeClass('rpg-strip-widget-visible');
        }
    } else {
        $statsWidget.removeClass('rpg-strip-widget-visible');
    }

    // Attributes Widget
    const $attrsWidget = $container.find('.rpg-strip-widget-attributes');
    if (widgetSettings.attributes?.enabled) {
        const showRPGAttributes = extensionSettings.trackerConfig?.userStats?.showRPGAttributes !== false;

        if (showRPGAttributes && extensionSettings.classicStats) {
            // Get enabled attributes from trackerConfig
            const configuredAttrs = extensionSettings.trackerConfig?.userStats?.rpgAttributes || [];
            const enabledAttrIds = configuredAttrs.filter(a => a.enabled !== false).map(a => a.id);

            const attrs = extensionSettings.classicStats;
            const $attrsGrid = $attrsWidget.find('.rpg-strip-attributes-grid');
            $attrsGrid.empty();

            Object.entries(attrs).forEach(([key, value]) => {
                // Filter by config if available
                if (enabledAttrIds.length > 0 && !enabledAttrIds.includes(key.toLowerCase())) {
                    return;
                }

                const $item = $(`<div class="rpg-strip-attr-item" title="${key.toUpperCase()}: ${value}">
                    <span class="rpg-strip-attr-name">${key.toUpperCase()}</span>
                    <span class="rpg-strip-attr-value">${value}</span>
                </div>`);
                $attrsGrid.append($item);
            });

            if ($attrsGrid.children().length > 0) {
                $attrsWidget.addClass('rpg-strip-widget-visible');
            } else {
                $attrsWidget.removeClass('rpg-strip-widget-visible');
            }
        } else {
            $attrsWidget.removeClass('rpg-strip-widget-visible');
        }
    } else {
        $attrsWidget.removeClass('rpg-strip-widget-visible');
    }
}

/**
 * Gets a color interpolated between low and high based on stat value (0-100).
 * @param {number} value - The stat value (0-100)
 * @returns {string} CSS color value
 */
function getStatColor(value) {
    const lowColor = extensionSettings.statBarColorLow || '#cc3333';
    const lowOpacity = extensionSettings.statBarColorLowOpacity ?? 100;
    const highColor = extensionSettings.statBarColorHigh || '#33cc66';
    const highOpacity = extensionSettings.statBarColorHighOpacity ?? 100;

    // Simple linear interpolation between low and high colors
    const percent = Math.min(100, Math.max(0, value)) / 100;

    // Parse colors
    const lowRGB = hexToRgb(lowColor);
    const highRGB = hexToRgb(highColor);

    if (!lowRGB || !highRGB) return value > 50 ? hexToRgba(highColor, highOpacity) : hexToRgba(lowColor, lowOpacity);

    const r = Math.round(lowRGB.r + (highRGB.r - lowRGB.r) * percent);
    const g = Math.round(lowRGB.g + (highRGB.g - lowRGB.g) * percent);
    const b = Math.round(lowRGB.b + (highRGB.b - lowRGB.b) * percent);
    const a = (lowOpacity + (highOpacity - lowOpacity) * percent) / 100;

    return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/**
 * Converts a hex color to RGB object.
 * @param {string} hex - Hex color string (e.g., "#cc3333")
 * @returns {{r: number, g: number, b: number}|null}
 */
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

/**
 * Sets up desktop tab navigation for organizing content.
 * Only runs on desktop viewports (>1000px).
 * Creates two tabs: Status (Stats/Info/Thoughts) and Inventory.
 */
export function setupDesktopTabs() {
    const isDesktop = window.innerWidth > 1000;
    if (!isDesktop) return;

    // Check if tabs already exist
    if ($('.rpg-tabs-nav').length > 0) return;

    const $contentBox = $('.rpg-content-box');

    // Get existing sections
    const $userStats = $('#rpg-user-stats');
    const $infoBox = $('#rpg-info-box');
    const $thoughts = $('#rpg-thoughts');
    const $inventory = $('#rpg-inventory');
    const $quests = $('#rpg-quests');

    // If no sections exist, nothing to organize
    if ($userStats.length === 0 && $infoBox.length === 0 && $thoughts.length === 0 && $inventory.length === 0 && $quests.length === 0) {
        return;
    }

    // Build tab navigation dynamically based on enabled settings
    const tabButtons = [];
    const hasInventory = $inventory.length > 0 && extensionSettings.showInventory;
    const hasQuests = $quests.length > 0 && extensionSettings.showQuests;

    // Status tab (always present if any status content exists)
    tabButtons.push(`
        <button class="rpg-tab-btn active" data-tab="status">
            <i class="fa-solid fa-chart-simple"></i>
            <span data-i18n-key="global.status">Status</span>
        </button>
    `);

    // Inventory tab (only if enabled in settings)
    if (hasInventory) {
        tabButtons.push(`
            <button class="rpg-tab-btn" data-tab="inventory">
                <i class="fa-solid fa-box"></i>
                <span data-i18n-key="global.inventory">Inventory</span>
            </button>
        `);
    }

    // Quests tab (only if enabled in settings)
    if (hasQuests) {
        tabButtons.push(`
            <button class="rpg-tab-btn" data-tab="quests">
                <i class="fa-solid fa-scroll"></i>
                <span data-i18n-key="global.quests">Quests</span>
            </button>
        `);
    }

    const $tabNav = $(`<div class="rpg-tabs-nav">${tabButtons.join('')}</div>`);

    // Create tab content containers
    const $statusTab = $('<div class="rpg-tab-content active" data-tab-content="status"></div>');
    const $inventoryTab = $('<div class="rpg-tab-content" data-tab-content="inventory"></div>');
    const $questsTab = $('<div class="rpg-tab-content" data-tab-content="quests"></div>');

    // Move sections into their respective tabs (detach to preserve event handlers)
    if ($userStats.length > 0) {
        $statusTab.append($userStats.detach());
        if (extensionSettings.showUserStats) $userStats.show();
    }
    if ($infoBox.length > 0) {
        $statusTab.append($infoBox.detach());
        // Only show if enabled and has data
        if (extensionSettings.showInfoBox) {
            const infoBoxData = window.lastGeneratedData?.infoBox || window.committedTrackerData?.infoBox;
            if (infoBoxData) $infoBox.show();
        }
    }
    if ($thoughts.length > 0) {
        $statusTab.append($thoughts.detach());
        if (extensionSettings.showCharacterThoughts) $thoughts.show();
    }
    if ($inventory.length > 0) {
        $inventoryTab.append($inventory.detach());
        // Only show if enabled (will be part of tab structure)
        if (hasInventory) $inventory.show();
    }
    if ($quests.length > 0) {
        $questsTab.append($quests.detach());
        // Only show if enabled (will be part of tab structure)
        if (hasQuests) $quests.show();
    }

    // Hide dividers on desktop tabs (tabs separate content naturally)
    $('.rpg-divider').hide();

    // Build desktop tab structure
    const $tabsContainer = $('<div class="rpg-tabs-container"></div>');
    $tabsContainer.append($tabNav);
    $tabsContainer.append($statusTab);

    // Always append inventory and quests tabs to preserve the elements
    // But they'll only show if enabled (via tab button visibility)
    $tabsContainer.append($inventoryTab);
    $tabsContainer.append($questsTab);

    // Replace content box with tabs container
    $contentBox.html('').append($tabsContainer);
    i18n.applyTranslations($tabsContainer[0]);

    // Handle tab switching
    $tabNav.find('.rpg-tab-btn').on('click', function() {
        const tabName = $(this).data('tab');

        // Update active tab button
        $tabNav.find('.rpg-tab-btn').removeClass('active');
        $(this).addClass('active');

        // Update active tab content
        $('.rpg-tab-content').removeClass('active');
        $(`.rpg-tab-content[data-tab-content="${tabName}"]`).addClass('active');
    });


}

/**
 * Removes desktop tab navigation and restores original layout.
 * Used when transitioning from desktop to mobile.
 */
export function removeDesktopTabs() {
    // Get sections from tabs before removing
    const $userStats = $('#rpg-user-stats').detach();
    const $infoBox = $('#rpg-info-box').detach();
    const $thoughts = $('#rpg-thoughts').detach();
    const $inventory = $('#rpg-inventory').detach();
    const $quests = $('#rpg-quests').detach();

    // Remove tabs container
    $('.rpg-tabs-container').remove();

    // Get dividers
    const $dividerStats = $('#rpg-divider-stats');
    const $dividerInfo = $('#rpg-divider-info');
    const $dividerThoughts = $('#rpg-divider-thoughts');

    // Restore original sections to content box in correct order
    const $contentBox = $('.rpg-content-box');

    // Re-insert sections in original order: User Stats, Info Box, Thoughts, Inventory, Quests
    if ($dividerStats.length) {
        $dividerStats.before($userStats);
        $dividerInfo.before($infoBox);
        $dividerThoughts.before($thoughts);
        $contentBox.append($inventory);
        $contentBox.append($quests);
    } else {
        // Fallback if dividers don't exist
        $contentBox.append($userStats);
        $contentBox.append($infoBox);
        $contentBox.append($thoughts);
        $contentBox.append($inventory);
        $contentBox.append($quests);
    }

    // Show/hide sections based on settings (respect visibility settings)
    if (extensionSettings.showUserStats) $userStats.show();
    if (extensionSettings.showInfoBox) {
        const infoBoxData = window.lastGeneratedData?.infoBox || window.committedTrackerData?.infoBox;
        if (infoBoxData) $infoBox.show();
    }
    if (extensionSettings.showCharacterThoughts) $thoughts.show();
    if (extensionSettings.showInventory) $inventory.show();
    if (extensionSettings.showQuests) $quests.show();
    $('.rpg-divider').show();
}
