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
        defaultSize: { w: 2, h: 2 },
        maxAutoSize: { w: 3, h: 5 }, // Max size for auto-arrange expansion
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

            // Render HTML
            const html = `
                <div class="rpg-classic-stats">
                    <div class="rpg-classic-stats-grid">
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

            // Compact single-column layout for narrow widgets
            if (newW < 2) {
                statsGrid.style.gridTemplateColumns = '1fr';
            } else {
                // 2-column grid for wider widgets
                statsGrid.style.gridTemplateColumns = 'repeat(2, 1fr)';
            }
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

            // Each attribute needs ~0.35 rows in 2-column grid
            // For 6 attrs: 3 rows (0.5 row padding = 3.5 total)
            const optimalHeight = Math.ceil((visibleAttrCount / 2) * 0.7 + 0.5);

            return {
                w: 2, // Prefer 2-column grid layout
                h: Math.max(this.minSize.h, optimalHeight)
            };
        }
    });
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
