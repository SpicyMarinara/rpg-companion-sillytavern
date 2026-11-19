/**
 * Mobile UI Module
 * The floating action button (FAB) that opens the panel on narrow screens,
 * its optional info widgets, and virtual-keyboard handling.
 *
 * Panel open/close state is owned by layout.js; this module only drives the FAB.
 */

import { extensionSettings, committedTrackerData, lastGeneratedData } from '../../core/state.js';
import { saveSettings } from '../../core/persistence.js';
import { isMobileLayout, togglePanelCollapsed } from './layout.js';
import { i18n } from '../../core/i18n.js';
import { hexToRgba } from './theme.js';

/**
 * Re-applies translations to the panel tab bar (tabs are static markup now).
 */
export function updateMobileTabLabels() {
    const nav = document.querySelector('#rpg-companion-panel .rpg-tabs-nav');
    if (nav) i18n.applyTranslations(nav);
}

/**
 * Sets up the FAB: tap toggles the panel, drag repositions it (position is saved).
 * Uses Pointer Events so touch, pen and mouse share one code path.
 */
export function setupMobileToggle() {
    const fab = document.getElementById('rpg-mobile-toggle');
    if (!fab) return;

    const pos = extensionSettings.mobileFabPosition;
    if (pos) {
        for (const side of ['top', 'right', 'bottom', 'left']) {
            if (pos[side]) fab.style[side] = pos[side];
        }
        requestAnimationFrame(() => constrainFabToViewport());
    }

    const MOVE_THRESHOLD = 8; // px of movement before a press becomes a drag
    let start = null;
    let dragging = false;

    fab.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        const rect = fab.getBoundingClientRect();
        start = { x: e.clientX, y: e.clientY, left: rect.left, top: rect.top };
        dragging = false;
        fab.setPointerCapture(e.pointerId);
    });

    fab.addEventListener('pointermove', (e) => {
        if (!start) return;
        const dx = e.clientX - start.x;
        const dy = e.clientY - start.y;
        if (!dragging && Math.hypot(dx, dy) < MOVE_THRESHOLD) return;
        dragging = true;
        fab.classList.add('dragging');
        const maxX = window.innerWidth - fab.offsetWidth - 8;
        const maxY = window.innerHeight - fab.offsetHeight - 8;
        const left = Math.max(8, Math.min(maxX, start.left + dx));
        const top = Math.max(8, Math.min(maxY, start.top + dy));
        Object.assign(fab.style, { left: `${left}px`, top: `${top}px`, right: 'auto', bottom: 'auto' });
        updateFabWidgetPosition();
    });

    const end = () => {
        if (!start) return;
        start = null;
        if (dragging) {
            extensionSettings.mobileFabPosition = { left: fab.style.left, top: fab.style.top };
            saveSettings();
            constrainFabToViewport();
            updateFabWidgetPosition();
            fab.classList.remove('dragging');
            // Swallow the click that follows a drag.
            fab.dataset.justDragged = '1';
            setTimeout(() => delete fab.dataset.justDragged, 50);
        }
        dragging = false;
    };
    fab.addEventListener('pointerup', end);
    fab.addEventListener('pointercancel', end);

    fab.addEventListener('click', (e) => {
        e.preventDefault();
        if (fab.dataset.justDragged) return;
        togglePanelCollapsed();
    });

    window.addEventListener('resize', () => constrainFabToViewport());
}

/**
 * Keeps a user-positioned FAB inside the viewport and below the top bar.
 */
export function constrainFabToViewport() {
    if (!extensionSettings.mobileFabPosition) return;
    const fab = document.getElementById('rpg-mobile-toggle');
    if (!fab || fab.offsetParent === null) return;

    const rect = fab.getBoundingClientRect();
    const topBar = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--topBarBlockSize')) || 50;
    const left = Math.max(8, Math.min(window.innerWidth - rect.width - 8, rect.left));
    const top = Math.max(topBar + 8, Math.min(window.innerHeight - rect.height - 8, rect.top));

    if (left !== rect.left || top !== rect.top) {
        Object.assign(fab.style, { left: `${left}px`, top: `${top}px`, right: 'auto', bottom: 'auto' });
        extensionSettings.mobileFabPosition = { left: fab.style.left, top: fab.style.top };
        saveSettings();
    }
}

/**
 * Flags the panel while the on-screen keyboard is visible so CSS can compact it.
 */
export function setupMobileKeyboardHandling() {
    if (!window.visualViewport) return;
    const panel = document.getElementById('rpg-companion-panel');
    window.visualViewport.addEventListener('resize', () => {
        if (!panel || !isMobileLayout()) return;
        const keyboardShowing = window.visualViewport.height < window.innerHeight * 0.75;
        panel.classList.toggle('rpg-keyboard-visible', keyboardShowing);
    });
}

/**
 * On mobile, scrolls a focused editable field into view once the keyboard has opened.
 */
export function setupContentEditableScrolling() {
    $('#rpg-companion-panel').on('focusin', '[contenteditable="true"]', function () {
        if (!isMobileLayout()) return;
        setTimeout(() => this.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' }), 300);
    });
}

// FAB WIDGETS - Info display around FAB button
// ============================================

/**
 * Updates the FAB widgets display based on current tracker data and settings.
 * Widgets are positioned in 8 positions around the FAB (N, NE, E, SE, S, SW, W, NW).
 */
export function updateFabWidgets() {
    const $fab = $('#rpg-mobile-toggle');
    if ($fab.length === 0) return;

    // Remove existing widget container and clean up event listeners
    $('#rpg-fab-widget-container').remove();
    $(document).off('click.fabWidgets touchstart.fabWidgets');

    // Check if widgets are enabled
    const widgetSettings = extensionSettings.mobileFabWidgets;
    if (!widgetSettings || !widgetSettings.enabled) return;

    // Don't show widgets on desktop or when panel is open
    if (!isMobileLayout()) return;

    // Get tracker data - prefer lastGeneratedData (most recent) over committedTrackerData
    const infoBox = lastGeneratedData?.infoBox || committedTrackerData?.infoBox;
    const userStats = lastGeneratedData?.userStats || committedTrackerData?.userStats;

    // Parse infoBox if it's a string
    let infoData = null;
    if (infoBox) {
        try {
            infoData = typeof infoBox === 'string' ? JSON.parse(infoBox) : infoBox;
        } catch (e) {
            console.warn('[RPG FAB Widgets] Failed to parse infoBox:', e);
        }
    }

    // Parse userStats if it's a string
    let statsData = null;
    if (userStats) {
        try {
            statsData = typeof userStats === 'string' ? JSON.parse(userStats) : userStats;
        } catch (e) {
            console.warn('[RPG FAB Widgets] Failed to parse userStats:', e);
        }
    }

    // Create widget container positioned at FAB location
    const fabOffset = $fab.offset();
    const fabWidth = $fab.outerWidth();
    const fabHeight = $fab.outerHeight();

    const $container = $('<div id="rpg-fab-widget-container" class="rpg-fab-widget-container"></div>');
    $container.css({
        top: fabOffset.top + 'px',
        left: fabOffset.left + 'px',
        width: fabWidth + 'px',
        height: fabHeight + 'px'
    });

    // Build widgets based on settings - auto-assign positions sequentially
    const widgets = [];

    // Collect enabled widgets in display priority order
    // Large widgets (Stats, Attributes) go to West/Northwest
    // Small widgets spread around other positions

    // Weather Icon (small)
    if (widgetSettings.weatherIcon?.enabled && infoData?.weather?.emoji) {
        widgets.push({
            type: 'small',
            html: `<div class="rpg-fab-widget rpg-fab-widget-weather-icon" title="Weather">${infoData.weather.emoji}</div>`
        });
    }

    // Weather Description (small)
    if (widgetSettings.weatherDesc?.enabled && infoData?.weather?.forecast) {
        const desc = infoData.weather.forecast.length > 15 ? infoData.weather.forecast.substring(0, 13) + '…' : infoData.weather.forecast;
        widgets.push({
            type: 'small',
            html: `<div class="rpg-fab-widget rpg-fab-widget-weather-desc" title="${infoData.weather.forecast}">${desc}</div>`
        });
    }

    // Helper to create expandable text widget HTML
    const createExpandableText = (fullText, maxLen, emoji) => {
        if (fullText.length <= maxLen) {
            return `${emoji} ${fullText}`;
        }
        const truncated = fullText.substring(0, maxLen - 2) + '…';
        return `${emoji} <span class="rpg-truncated">${truncated}</span><span class="rpg-full-text">${fullText}</span>`;
    };

    // Check if text needs truncation for data attribute
    const needsExpand = (text, maxLen) => text.length > maxLen;

    // Helper to parse time string and calculate clock hand angles
    const parseTimeForClock = (timeStr) => {
        const timeMatch = timeStr.match(/(\d+):(\d+)/);
        if (timeMatch) {
            const hours = parseInt(timeMatch[1]);
            const minutes = parseInt(timeMatch[2]);
            const hourAngle = (hours % 12) * 30 + minutes * 0.5; // 30° per hour + 0.5° per minute
            const minuteAngle = minutes * 6; // 6° per minute
            return { hourAngle, minuteAngle };
        }
        return { hourAngle: 0, minuteAngle: 0 };
    };

    // Clock/Time (bottom position with animated clock face)
    if (widgetSettings.clock?.enabled && infoData?.time) {
        const timeStr = infoData.time.end || infoData.time.value || infoData.time.start || '';
        if (timeStr) {
            const { hourAngle, minuteAngle } = parseTimeForClock(timeStr);
            widgets.push({
                type: 'bottom', // Special type for bottom position
                html: `<div class="rpg-fab-widget rpg-fab-widget-clock" title="${timeStr}">
                    <div class="rpg-fab-clock-face">
                        <div class="rpg-fab-clock-hour" style="transform: rotate(${hourAngle}deg)"></div>
                        <div class="rpg-fab-clock-minute" style="transform: rotate(${minuteAngle}deg)"></div>
                        <div class="rpg-fab-clock-center"></div>
                    </div>
                    <span class="rpg-fab-clock-time">${timeStr}</span>
                </div>`
            });
        }
    }

    // Date (small)
    if (widgetSettings.date?.enabled && infoData?.date?.value) {
        const dateVal = infoData.date.value;
        const expandAttr = needsExpand(dateVal, 12) ? ' data-full-text="true"' : '';
        widgets.push({
            type: 'small',
            html: `<div class="rpg-fab-widget rpg-fab-widget-date"${expandAttr} title="${dateVal}">${createExpandableText(dateVal, 12, '📅')}</div>`
        });
    }

    // Location (small)
    if (widgetSettings.location?.enabled && infoData?.location?.value) {
        const loc = infoData.location.value;
        const expandAttr = needsExpand(loc, 14) ? ' data-full-text="true"' : '';
        widgets.push({
            type: 'small',
            html: `<div class="rpg-fab-widget rpg-fab-widget-location"${expandAttr} title="${loc}">${createExpandableText(loc, 14, '📍')}</div>`
        });
    }

    // Stats (large - goes to West) - respects trackerConfig.userStats.customStats
    // Use extensionSettings.userStats as primary source (contains all stats), fallback to committedTrackerData
    let allStats = [];
    try {
        const userStatsJson = extensionSettings.userStats;
        const parsedUserStats = typeof userStatsJson === 'string' ? JSON.parse(userStatsJson) : userStatsJson;
        if (parsedUserStats?.stats) {
            allStats = parsedUserStats.stats;
        }
    } catch (e) {
        console.warn('[RPG FAB Widgets] Failed to parse extensionSettings.userStats:', e);
    }
    // Fallback to statsData if extensionSettings.userStats is empty
    if (allStats.length === 0 && statsData?.stats) {
        allStats = statsData.stats;
    }

    if (widgetSettings.stats?.enabled && allStats.length > 0) {
        // Get enabled stats from trackerConfig - match by id (lowercase)
        const configuredStats = extensionSettings.trackerConfig?.userStats?.customStats || [];
        const enabledStatMap = new Map();
        configuredStats.forEach(s => {
            if (s.enabled !== false) {
                enabledStatMap.set(s.id?.toLowerCase(), true);
                enabledStatMap.set(s.name?.toLowerCase(), true);
            }
        });

        const statsHtml = allStats
            .filter(s => {
                // If no config, show all stats
                if (configuredStats.length === 0) return true;
                // Check if stat is enabled in trackerConfig (match by id or name, case-insensitive)
                const statId = s.id?.toLowerCase();
                const statName = s.name?.toLowerCase();
                return enabledStatMap.has(statId) || enabledStatMap.has(statName);
            })
            .map(stat => {
                const value = typeof stat.value === 'number' ? stat.value : parseInt(stat.value) || 0;
                const color = getStatColor(value);
                const abbr = stat.name.substring(0, 3).toUpperCase();
                return `<span class="rpg-fab-widget-stat-item" title="${stat.name}: ${value}" style="color: ${color};">${abbr}:${value}</span>`;
            })
            .join('');

        if (statsHtml) {
            widgets.push({
                type: 'large',
                preferredPos: 6, // West
                html: `<div class="rpg-fab-widget rpg-fab-widget-stats"><div class="rpg-fab-widget-stats-row">${statsHtml}</div></div>`
            });
        }
    }

    // RPG Attributes (large - goes to Northwest) - respects trackerConfig.userStats.rpgAttributes
    if (widgetSettings.attributes?.enabled) {
        // Check if RPG attributes are enabled in trackerConfig
        const showRPGAttributes = extensionSettings.trackerConfig?.userStats?.showRPGAttributes !== false;

        if (showRPGAttributes && extensionSettings.classicStats) {
            // Get enabled attributes from trackerConfig
            const configuredAttrs = extensionSettings.trackerConfig?.userStats?.rpgAttributes || [];
            const enabledAttrIds = configuredAttrs.filter(a => a.enabled !== false).map(a => a.id);

            const attrs = extensionSettings.classicStats;
            const attrItems = Object.entries(attrs)
                .filter(([key]) => {
                    // Check if attribute is enabled in trackerConfig
                    if (enabledAttrIds.length > 0) {
                        return enabledAttrIds.includes(key.toLowerCase());
                    }
                    return true;
                })
                .map(([key, value]) => `<div class="rpg-fab-widget-attr-item"><span class="rpg-fab-widget-attr-name">${key.toUpperCase()}</span><span class="rpg-fab-widget-attr-value">${value}</span></div>`)
                .join('');

            if (attrItems) {
                widgets.push({
                    type: 'large',
                    preferredPos: 7, // Northwest
                    html: `<div class="rpg-fab-widget rpg-fab-widget-attributes" title="Attributes"><div class="rpg-fab-widget-attr-grid">${attrItems}</div></div>`
                });
            }
        }
    }

    // Auto-assign positions intelligently
    // Large widgets get their preferred positions first (West=6, Northwest=7)
    // Bottom widgets get position 4 (South)
    // Small widgets fill remaining positions clockwise from North (0)
    const usedPositions = new Set();
    const positionedWidgets = [];

    // Position order for small widgets: N(0), NE(1), E(2), SE(3), SW(5) - skip S(4) for bottom/clock
    const smallPositionOrder = [0, 1, 2, 3, 5];
    let smallPosIndex = 0;

    // Check if only one large widget exists (for centering)
    const largeWidgets = widgets.filter(w => w.type === 'large');
    const singleLargeWidget = largeWidgets.length === 1;

    // First: assign bottom widgets to position 4 (South)
    widgets.filter(w => w.type === 'bottom').forEach(w => {
        const pos = 4; // South position
        usedPositions.add(pos);
        const finalHtml = w.html.replace('class="rpg-fab-widget', `class="rpg-fab-widget rpg-fab-widget-pos-${pos}`);
        positionedWidgets.push({ position: pos, html: finalHtml });
    });

    // Second: assign large widgets to their preferred positions
    largeWidgets.forEach(w => {
        let pos = w.preferredPos;
        // If preferred position is taken, find next available from large positions
        if (usedPositions.has(pos)) {
            pos = pos === 6 ? 7 : 6; // Try the other large position
        }
        usedPositions.add(pos);
        // Add centered class if this is the only large widget
        const centeredClass = singleLargeWidget ? ' rpg-fab-widget-centered' : '';
        const finalHtml = w.html.replace('class="rpg-fab-widget', `class="rpg-fab-widget rpg-fab-widget-pos-${pos}${centeredClass}`);
        positionedWidgets.push({ position: pos, html: finalHtml });
    });

    // Third: assign small widgets to remaining positions
    widgets.filter(w => w.type === 'small').forEach(w => {
        // Find next available position from small position order
        while (smallPosIndex < smallPositionOrder.length && usedPositions.has(smallPositionOrder[smallPosIndex])) {
            smallPosIndex++;
        }
        const pos = smallPosIndex < smallPositionOrder.length ? smallPositionOrder[smallPosIndex] : (smallPosIndex % 8);
        usedPositions.add(pos);
        smallPosIndex++;
        const finalHtml = w.html.replace('class="rpg-fab-widget', `class="rpg-fab-widget rpg-fab-widget-pos-${pos}`);
        positionedWidgets.push({ position: pos, html: finalHtml });
    });

    // Add widgets to container
    positionedWidgets.forEach(w => $container.append(w.html));

    // Append container to body
    if (positionedWidgets.length > 0) {
        $('body').append($container);
        layoutFabWidgets($container);

        // Add mobile tap handler for expandable widgets
        $container.find('.rpg-fab-widget[data-full-text]').on('click touchstart', function(e) {
            e.stopPropagation();
            const $this = $(this);
            const wasExpanded = $this.hasClass('expanded');

            // Collapse all other expanded widgets
            $container.find('.rpg-fab-widget.expanded').removeClass('expanded');

            // Toggle this one
            if (!wasExpanded) {
                $this.addClass('expanded');
            }
        });

        // Collapse on tap outside
        $(document).on('click.fabWidgets touchstart.fabWidgets', function(e) {
            if (!$(e.target).closest('.rpg-fab-widget').length) {
                $container.find('.rpg-fab-widget.expanded').removeClass('expanded');
            }
        });
    }
}

/**
 * Gets a color for a stat value (0-100) using a gradient from low to high.
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
 * Updates the FAB widget container position to match FAB button position.
 * Call this after FAB is dragged.
 */
export function updateFabWidgetPosition() {
    const $fab = $('#rpg-mobile-toggle');
    const $container = $('#rpg-fab-widget-container');

    if ($fab.length === 0 || $container.length === 0) return;

    const fabOffset = $fab.offset();
    $container.css({
        top: fabOffset.top + 'px',
        left: fabOffset.left + 'px'
    });
    layoutFabWidgets($container);
}

/**
 * Lays the FAB widgets out as one column beside the FAB, on whichever side of
 * the screen has room, capped to the viewport so they never widen the page.
 */
function layoutFabWidgets($container) {
    const fab = document.getElementById('rpg-mobile-toggle');
    const container = $container[0];
    if (!fab || !container) return;

    const rect = fab.getBoundingClientRect();
    const gap = 8;
    const growLeft = rect.left + rect.width / 2 > window.innerWidth / 2;
    container.classList.add('rpg-fab-widgets-stacked');
    container.classList.toggle('rpg-fab-widgets-left', growLeft);
    Object.assign(container.style, {
        top: `${Math.round(rect.top)}px`,
        width: '',
        height: '',
        left: growLeft ? 'auto' : `${Math.round(rect.right + gap)}px`,
        right: growLeft ? `${Math.round(window.innerWidth - rect.left + gap)}px` : 'auto',
        maxWidth: `${Math.round((growLeft ? rect.left : window.innerWidth - rect.right) - gap * 2)}px`,
        maxHeight: `${Math.round(window.innerHeight - rect.top - gap)}px`
    });
}

/**
 * Sets the FAB loading state (spinning animation during API requests).
 * @param {boolean} loading - Whether to show loading state
 */
export function setFabLoadingState(loading) {
    const $fab = $('#rpg-mobile-toggle');
    if ($fab.length === 0) return;

    if (loading) {
        $fab.addClass('rpg-fab-loading');
    } else {
        $fab.removeClass('rpg-fab-loading');
    }
}

