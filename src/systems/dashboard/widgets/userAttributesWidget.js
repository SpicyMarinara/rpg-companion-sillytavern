/**
 * User Attributes Widget
 *
 * Displays customizable RPG attribute scores with +/- adjustment buttons.
 * Integrates with Tracker Settings for full attribute customization.
 *
 * Features:
 * - Fully customizable attributes (add/remove/rename via Tracker Settings)
 * - Custom attribute names (e.g., "STRENGTH" instead of "STR", or add "LCK")
 * - Widget-level filtering (show subset of globally enabled attributes)
 * - +/- buttons for quick adjustments (1-20 range)
 * - Responsive 2-column grid layout
 * - Smart sizing: auto-adjusts height based on attribute count
 * - Bi-directional sync with Tracker Editor
 */

import { parseNumber } from '../widgetBase.js';

/**
 * Register User Attributes Widget
 * @param {WidgetRegistry} registry - Widget registry instance
 * @param {Object} dependencies - External dependencies
 * @param {Function} dependencies.getExtensionSettings - Get extension settings
 * @param {Function} dependencies.onStatsChange - Callback when stats change
 */
export function registerUserAttributesWidget(registry, dependencies) {
    const {
        getExtensionSettings,
        onStatsChange
    } = dependencies;

    registry.register('userAttributes', {
        name: 'User Attributes',
        icon: '⚔️',
        description: 'Customizable RPG attributes with +/- buttons (STR, DEX, etc.)',
        category: 'user',
        minSize: { w: 2, h: 2 },
        // Column-aware sizing: full width at each column count
        defaultSize: (columns) => {
            if (columns <= 2) {
                return { w: 2, h: 4 }; // Mobile: 2 cols wide (full), 4 rows tall
            }
            return { w: 3, h: 4 }; // Desktop: 3 cols wide (full), 4 rows tall
        },
        // Column-aware max size: same as default
        maxAutoSize: (columns) => {
            if (columns <= 2) {
                return { w: 2, h: 4 };
            }
            return { w: 3, h: 4 };
        },
        requiresSchema: false,

        /**
         * Render widget content
         * @param {HTMLElement} container - Widget container
         * @param {Object} config - Widget configuration
         */
        render(container, config = {}) {
            const settings = getExtensionSettings();
            const classicStats = settings.classicStats;
            const trackerConfig = settings.trackerConfig?.userStats;

            // Get globally enabled attributes from trackerConfig
            const globallyEnabledAttrs = trackerConfig?.rpgAttributes
                ?.filter(attr => attr.enabled)
                .map(attr => ({ id: attr.id, name: attr.name })) || [];

            // If no globally enabled attrs, fall back to defaults
            const availableAttrs = globallyEnabledAttrs.length > 0
                ? globallyEnabledAttrs
                : [
                    { id: 'str', name: 'STR' },
                    { id: 'dex', name: 'DEX' },
                    { id: 'con', name: 'CON' },
                    { id: 'int', name: 'INT' },
                    { id: 'wis', name: 'WIS' },
                    { id: 'cha', name: 'CHA' }
                ];

            // Apply widget-level filter if specified (support both visibleAttrs and legacy visibleStats)
            let visibleAttrs = availableAttrs;
            const filterList = config.visibleAttrs || config.visibleStats;
            if (filterList && filterList.length > 0) {
                visibleAttrs = availableAttrs.filter(attr =>
                    filterList.includes(attr.id)
                );
            }

            // Merge default config
            const finalConfig = {
                showLabels: true,
                ...config
            };

            // Build stats HTML using custom names from trackerConfig
            const statsHtml = visibleAttrs.map(attr => `
                <div class="rpg-classic-stat" data-stat="${attr.id}">
                    ${finalConfig.showLabels ? `<span class="rpg-classic-stat-label">${attr.name}</span>` : ''}
                    <div class="rpg-classic-stat-buttons">
                        <button class="rpg-classic-stat-btn rpg-stat-decrease" data-stat="${attr.id}">−</button>
                        <span class="rpg-classic-stat-value">${classicStats[attr.id] || 10}</span>
                        <button class="rpg-classic-stat-btn rpg-stat-increase" data-stat="${attr.id}">+</button>
                    </div>
                </div>
            `).join('');

            // Calculate optimal column count based on visible attributes and widget width
            const attrCount = visibleAttrs.length;
            const widgetWidth = config._width || this.defaultSize.w;  // Get from config or default
            const optimalCols = calculateOptimalColumns(attrCount, widgetWidth);

            // Render HTML with dynamic grid columns
            const html = `
                <div class="rpg-classic-stats">
                    <div class="rpg-classic-stats-grid" style="grid-template-columns: repeat(${optimalCols}, 1fr);">
                        ${statsHtml}
                    </div>
                </div>
            `;

            container.innerHTML = html;

            // Attach event handlers
            attachEventHandlers(container, settings, onStatsChange);
        },

        /**
         * Get configuration options
         * @returns {Object} Configuration schema
         */
        getConfig() {
            const settings = getExtensionSettings();
            const trackerConfig = settings.trackerConfig?.userStats;

            // Get enabled attributes from trackerConfig for options
            const enabledAttrs = trackerConfig?.rpgAttributes
                ?.filter(attr => attr.enabled)
                .map(attr => ({ value: attr.id, label: attr.name })) || [
                { value: 'str', label: 'STR' },
                { value: 'dex', label: 'DEX' },
                { value: 'con', label: 'CON' },
                { value: 'int', label: 'INT' },
                { value: 'wis', label: 'WIS' },
                { value: 'cha', label: 'CHA' }
            ];

            return {
                visibleAttrs: {
                    type: 'multiselect',
                    label: 'Visible Attributes',
                    default: null, // null means "show all enabled attributes"
                    options: enabledAttrs,
                    description: 'Select which attributes to show in this widget (leave empty to show all enabled attributes)',
                    hint: 'To add/remove/rename attributes globally, use Tracker Settings'
                },
                showLabels: {
                    type: 'boolean',
                    label: 'Show Stat Labels',
                    default: true
                }
            };
        },

        /**
         * Handle configuration changes
         * @param {HTMLElement} container - Widget container
         * @param {Object} newConfig - New configuration
         */
        onConfigChange(container, newConfig) {
            this.render(container, newConfig);
        },

        /**
         * Handle widget resize
         * @param {HTMLElement} container - Widget container
         * @param {number} newW - New width
         * @param {number} newH - New height
         */
        onResize(container, newW, newH) {
            const statsGrid = container.querySelector('.rpg-classic-stats-grid');
            if (!statsGrid) return;

            // Count visible attributes from DOM
            const attrCount = statsGrid.querySelectorAll('.rpg-classic-stat').length;

            // Get actual pixel width of container (not grid units)
            // calculateOptimalColumns expects pixel width to determine if 3 columns fit
            const containerWidth = container.offsetWidth;

            console.log('[UserAttributes] onResize called:', {
                gridUnits: `${newW}x${newH}`,
                pixelWidth: containerWidth,
                attrCount: attrCount
            });

            // Recalculate optimal columns based on actual pixel width
            const optimalCols = calculateOptimalColumns(attrCount, containerWidth);

            console.log('[UserAttributes] Calculated optimal columns:', optimalCols);

            // Apply new grid layout
            statsGrid.style.gridTemplateColumns = `repeat(${optimalCols}, 1fr)`;
        },

        /**
         * Calculate optimal size based on content
         * Used by smart auto-layout to determine ideal widget dimensions
         * @param {Object} config - Widget configuration
         * @returns {Object} Optimal size { w, h }
         */
        getOptimalSize(config = {}) {
            const settings = getExtensionSettings();
            const trackerConfig = settings.trackerConfig?.userStats;

            // Count globally enabled attributes
            const globallyEnabledCount = trackerConfig?.rpgAttributes
                ?.filter(attr => attr.enabled).length || 6;

            // If widget has visibleAttrs override, use that count (support legacy visibleStats too)
            const filterList = config.visibleAttrs || config.visibleStats;
            const visibleAttrCount = filterList?.length || globallyEnabledCount;

            // Determine optimal width and columns based on attribute count
            // For 9 attributes: prefer 3 columns (3×3 grid)
            // For 6 attributes: prefer 2 columns (3×2 grid)
            // For 12 attributes: prefer 3 columns (4×3 grid)
            let optimalWidth = 2;  // Default
            if (visibleAttrCount >= 9) {
                optimalWidth = 3;  // Need wider widget for 3+ columns
            }

            // Calculate optimal columns for this width
            const optimalCols = calculateOptimalColumns(visibleAttrCount, optimalWidth);
            const rows = Math.ceil(visibleAttrCount / optimalCols);

            // Each row needs ~0.7 grid units height
            const optimalHeight = Math.ceil(rows * 0.7 + 0.5);

            return {
                w: optimalWidth,
                h: Math.max(this.minSize.h, optimalHeight)
            };
        }
    });
}

/**
 * Calculate optimal column count for attribute grid
 * Balances visual layout to minimize orphaned items and create square-ish grids
 *
 * @param {number} attrCount - Number of attributes to display
 * @param {number} widgetWidth - Widget width in grid units (1-4)
 * @returns {number} Optimal column count (1-4)
 * @private
 */
function calculateOptimalColumns(attrCount, widgetWidth) {
    // Special cases
    if (attrCount === 0) return 1;
    if (attrCount === 1) return 1;
    if (widgetWidth < 2) return 1;  // Too narrow for multi-column

    // Cap at 4 columns or attrCount (don't create more columns than items)
    const maxCols = Math.min(4, widgetWidth, attrCount);

    // Try to find a column count that divides evenly (no orphans)
    for (let cols = maxCols; cols >= 2; cols--) {
        if (attrCount % cols === 0) {
            return cols;  // Perfect division!
        }
    }

    // No perfect division - use heuristic to minimize orphans and prefer square-ish layouts
    let bestCols = 2;
    let bestScore = -Infinity;

    for (let cols = 2; cols <= maxCols; cols++) {
        const rows = Math.ceil(attrCount / cols);
        const orphans = (cols * rows) - attrCount;  // Empty cells in last row
        const aspectRatio = rows / cols;  // Ideal is ~1.0 (square)

        // Score: prefer fewer orphans (heavily weighted) and square-ish layout
        // orphanPenalty: 1/(orphans+1) gives 1.0 for no orphans, 0.5 for 1 orphan, 0.33 for 2, etc.
        // aspectScore: 1/(|aspectRatio-1.0|+0.1) gives higher score for square-ish layouts
        const orphanPenalty = 1 / (orphans + 1);
        const aspectScore = 1 / (Math.abs(aspectRatio - 1.0) + 0.1);
        const score = orphanPenalty * 10 + aspectScore;  // Weight orphans heavily

        if (score > bestScore) {
            bestScore = score;
            bestCols = cols;
        }
    }

    return bestCols;
}

/**
 * Attach event handlers to widget
 * @private
 */
function attachEventHandlers(container, settings, onStatsChange) {
    // Handle classic stat +/- buttons
    const increaseButtons = container.querySelectorAll('.rpg-stat-increase');
    const decreaseButtons = container.querySelectorAll('.rpg-stat-decrease');

    increaseButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const statName = btn.dataset.stat;
            const valueSpan = btn.parentElement.querySelector('.rpg-classic-stat-value');
            const currentValue = parseNumber(valueSpan.textContent, 10, 1, 20);
            const newValue = Math.min(20, currentValue + 1);

            valueSpan.textContent = newValue;
            settings.classicStats[statName] = newValue;

            if (onStatsChange) {
                onStatsChange('classicStats', statName, newValue);
            }
        });
    });

    decreaseButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const statName = btn.dataset.stat;
            const valueSpan = btn.parentElement.querySelector('.rpg-classic-stat-value');
            const currentValue = parseNumber(valueSpan.textContent, 10, 1, 20);
            const newValue = Math.max(1, currentValue - 1);

            valueSpan.textContent = newValue;
            settings.classicStats[statName] = newValue;

            if (onStatsChange) {
                onStatsChange('classicStats', statName, newValue);
            }
        });
    });
}
