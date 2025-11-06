/**
 * User Stats Widget (Refactored - Modular)
 *
 * Displays user vital statistics as progress bars:
 * - Health, Satiety, Energy, Hygiene, Arousal
 *
 * Features:
 * - Editable stat values with live update
 * - Progress bars with customizable colors
 * - Configurable visible stats
 * - Smart content-aware sizing (more bars = needs more height)
 */

import { createProgressBar, attachEditableHandlers, parseNumber } from '../widgetBase.js';

/**
 * Register User Stats Widget
 * @param {WidgetRegistry} registry - Widget registry instance
 * @param {Object} dependencies - External dependencies
 * @param {Function} dependencies.getContext - Get SillyTavern context
 * @param {Function} dependencies.getExtensionSettings - Get extension settings
 * @param {Function} dependencies.onStatsChange - Callback when stats change
 */
export function registerUserStatsWidget(registry, dependencies) {
    const {
        getExtensionSettings,
        onStatsChange
    } = dependencies;

    registry.register('userStats', {
        name: 'User Stats',
        icon: '❤️',
        description: 'Health, energy, satiety bars',
        category: 'user',
        minSize: { w: 1, h: 2 },
        defaultSize: { w: 2, h: 2 },
        // Column-aware max size: full width in 3-4 col for horizontal spread
        maxAutoSize: (columns) => {
            if (columns <= 2) {
                return { w: 2, h: 2 }; // Mobile: use full 2-col width
            }
            return { w: 3, h: 3 }; // Desktop: span 3 columns horizontally
        },
        requiresSchema: false,

        /**
         * Render widget content
         * @param {HTMLElement} container - Widget container
         * @param {Object} config - Widget configuration
         */
        render(container, config = {}) {
            const settings = getExtensionSettings();
            const stats = settings.userStats;
            const trackerConfig = settings.trackerConfig?.userStats;

            // Get globally enabled stats from trackerConfig
            const globallyEnabledStats = trackerConfig?.customStats
                ?.filter(stat => stat.enabled)
                .map(stat => ({ id: stat.id, name: stat.name })) || [];

            // If no globally enabled stats, fall back to defaults
            const availableStats = globallyEnabledStats.length > 0
                ? globallyEnabledStats
                : [
                    { id: 'health', name: 'Health' },
                    { id: 'satiety', name: 'Satiety' },
                    { id: 'energy', name: 'Energy' },
                    { id: 'hygiene', name: 'Hygiene' },
                    { id: 'arousal', name: 'Arousal' }
                ];

            // Apply widget-level filter if specified (config.visibleStats overrides)
            let visibleStats = availableStats;
            if (config.visibleStats && config.visibleStats.length > 0) {
                visibleStats = availableStats.filter(stat =>
                    config.visibleStats.includes(stat.id)
                );
            }

            // Merge default config with user config
            const finalConfig = {
                statBarGradient: true,
                ...config
            };

            // Create gradient for stat bars
            const gradient = finalConfig.statBarGradient
                ? `linear-gradient(to right, ${settings.statBarColorLow}, ${settings.statBarColorHigh})`
                : settings.statBarColorHigh;

            // Build progress bars HTML using trackerConfig names
            const progressBarsHtml = visibleStats.map(stat => {
                return createProgressBar({
                    label: stat.name,
                    value: stats[stat.id] || 0,
                    gradient,
                    editable: true,
                    field: stat.id
                });
            }).join('');

            // Render HTML
            const html = `
                <div class="rpg-stats-content rpg-stats-modular">
                    <div class="rpg-stats-grid">
                        ${progressBarsHtml}
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

            // Get enabled stats from trackerConfig for options
            const enabledStats = trackerConfig?.customStats
                ?.filter(stat => stat.enabled)
                .map(stat => ({ value: stat.id, label: stat.name })) || [
                { value: 'health', label: 'Health' },
                { value: 'satiety', label: 'Satiety' },
                { value: 'energy', label: 'Energy' },
                { value: 'hygiene', label: 'Hygiene' },
                { value: 'arousal', label: 'Arousal' }
            ];

            return {
                statBarGradient: {
                    type: 'boolean',
                    label: 'Use Gradient for Stat Bars',
                    default: true,
                    description: 'Show progress bars with color gradient from low to high'
                },
                visibleStats: {
                    type: 'multiselect',
                    label: 'Visible Stats',
                    default: null, // null means "show all enabled stats"
                    options: enabledStats,
                    description: 'Select which stats to show in this widget (leave empty to show all enabled stats)',
                    hint: 'To add/remove/rename stats globally, use Tracker Settings'
                }
            };
        },

        /**
         * Handle configuration changes
         * @param {HTMLElement} container - Widget container
         * @param {Object} newConfig - New configuration
         */
        onConfigChange(container, newConfig) {
            // Re-render with new config
            this.render(container, newConfig);
        },

        /**
         * Handle widget resize
         * @param {HTMLElement} container - Widget container
         * @param {number} newW - New width
         * @param {number} newH - New height
         */
        onResize(container, newW, newH) {
            // Layout adjustments if needed (currently none)
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

            // Count globally enabled stats
            const globallyEnabledCount = trackerConfig?.customStats
                ?.filter(stat => stat.enabled).length || 5;

            // If widget has visibleStats override, use that count
            const visibleStatCount = config.visibleStats?.length || globallyEnabledCount;

            // Each stat bar needs ~0.4 rows of height
            // Add 0.5 row for padding/margins
            const optimalHeight = Math.ceil(visibleStatCount * 0.4 + 0.5);

            return {
                w: 2, // Prefer full width for readability
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
    // Handle editable stat value changes (health, satiety, etc.)
    const editableStats = container.querySelectorAll('.rpg-editable-stat');
    editableStats.forEach(field => {
        const fieldName = field.dataset.field;
        let originalValue = parseNumber(field.textContent.replace('%', '').trim(), 0, 0, 100);

        field.addEventListener('focus', () => {
            originalValue = parseNumber(field.textContent.replace('%', '').trim(), 0, 0, 100);
            // Select all text
            const range = document.createRange();
            range.selectNodeContents(field);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
        });

        field.addEventListener('blur', () => {
            const textValue = field.textContent.replace('%', '').trim();
            const value = parseNumber(textValue, originalValue, 0, 100);

            // Update display
            field.textContent = `${value}%`;

            // Update settings if changed
            if (value !== originalValue) {
                settings.userStats[fieldName] = value;

                // Update the bar fill
                const bar = field.parentElement.querySelector('.rpg-stat-fill');
                if (bar) {
                    bar.style.width = `${100 - value}%`;
                }

                // Trigger change callback
                if (onStatsChange) {
                    onStatsChange('userStats', fieldName, value);
                }
            }
        });

        field.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                field.blur();
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                field.textContent = `${originalValue}%`;
                field.blur();
            }
        });

        // Prevent paste with formatting
        field.addEventListener('paste', (e) => {
            e.preventDefault();
            const text = (e.clipboardData || window.clipboardData).getData('text/plain');
            document.execCommand('insertText', false, text);
        });
    });
}
