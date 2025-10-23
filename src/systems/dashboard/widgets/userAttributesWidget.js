/**
 * User Attributes Widget
 *
 * Displays classic D&D-style attribute scores with +/- adjustment buttons.
 * Shows STR, DEX, CON, INT, WIS, CHA stats.
 *
 * Features:
 * - 6 classic RPG attributes
 * - +/- buttons for quick adjustments (1-20 range)
 * - Responsive grid layout
 * - Smart sizing: compact for narrow, grid for wide
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
        description: 'Classic RPG stats (STR, DEX, CON, INT, WIS, CHA)',
        category: 'user',
        minSize: { w: 1, h: 2 },
        defaultSize: { w: 2, h: 2 },
        requiresSchema: false,

        /**
         * Render widget content
         * @param {HTMLElement} container - Widget container
         * @param {Object} config - Widget configuration
         */
        render(container, config = {}) {
            const settings = getExtensionSettings();
            const classicStats = settings.classicStats;

            // Merge default config
            const finalConfig = {
                visibleStats: ['str', 'dex', 'con', 'int', 'wis', 'cha'],
                showLabels: true,
                ...config
            };

            // Build stats HTML
            const statsHtml = finalConfig.visibleStats.map(stat => `
                <div class="rpg-classic-stat" data-stat="${stat}">
                    ${finalConfig.showLabels ? `<span class="rpg-classic-stat-label">${stat.toUpperCase()}</span>` : ''}
                    <div class="rpg-classic-stat-buttons">
                        <button class="rpg-classic-stat-btn rpg-stat-decrease" data-stat="${stat}">−</button>
                        <span class="rpg-classic-stat-value">${classicStats[stat]}</span>
                        <button class="rpg-classic-stat-btn rpg-stat-increase" data-stat="${stat}">+</button>
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
            return {
                visibleStats: {
                    type: 'multiselect',
                    label: 'Visible Attributes',
                    default: ['str', 'dex', 'con', 'int', 'wis', 'cha'],
                    options: [
                        { value: 'str', label: 'Strength (STR)' },
                        { value: 'dex', label: 'Dexterity (DEX)' },
                        { value: 'con', label: 'Constitution (CON)' },
                        { value: 'int', label: 'Intelligence (INT)' },
                        { value: 'wis', label: 'Wisdom (WIS)' },
                        { value: 'cha', label: 'Charisma (CHA)' }
                    ]
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
            const visibleStatCount = config.visibleStats?.length || 6;

            // Each stat needs ~0.35 rows in 2-column grid
            // For 6 stats: 3 rows (0.5 row padding = 3.5 total)
            const optimalHeight = Math.ceil((visibleStatCount / 2) * 0.7 + 0.5);

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
