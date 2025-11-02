/**
 * Scene Info Multi-View Widget
 *
 * Combines Calendar, Weather, Temperature, Clock, and Location widgets into one
 * tabbed interface to reduce vertical scroll on mobile.
 *
 * Features:
 * - Tab switching between different scene info views
 * - Reuses existing infoBox widget render functions (no code duplication)
 * - Smart empty state detection (hides tabs for widgets with no data)
 * - Configurable view selection
 * - Per-instance state management
 */

import { parseInfoBoxData } from './infoBoxWidgets.js';

// Per-widget instance state
const widgetStates = new Map();

/**
 * Get or create widget state
 * @param {string} widgetId - Widget instance ID
 * @returns {Object} Widget state
 */
function getWidgetState(widgetId) {
    if (!widgetStates.has(widgetId)) {
        widgetStates.set(widgetId, {
            activeSubTab: 'calendar' // Default view
        });
    }
    return widgetStates.get(widgetId);
}

/**
 * View metadata (icons, labels, etc.)
 */
const VIEW_META = {
    calendar: { icon: '📅', label: 'Cal', fullLabel: 'Calendar' },
    weather: { icon: '🌤️', label: 'Wea', fullLabel: 'Weather' },
    temperature: { icon: '🌡️', label: 'Tmp', fullLabel: 'Temperature' },
    clock: { icon: '🕐', label: 'Clk', fullLabel: 'Clock' },
    location: { icon: '📍', label: 'Loc', fullLabel: 'Location' }
};

/**
 * Check if a view has data
 * @param {string} viewType - Widget type (calendar, weather, etc.)
 * @param {Object} data - Parsed info box data
 * @returns {boolean} True if view has data
 */
function hasViewData(viewType, data) {
    switch (viewType) {
        case 'calendar':
            return !!(data.date && data.date !== '');
        case 'weather':
            return !!(data.weatherEmoji || data.weatherForecast);
        case 'temperature':
            return !!(data.temperature && data.temperature !== '');
        case 'clock':
            return !!(data.timeStart || data.timeEnd);
        case 'location':
            return !!(data.location && data.location !== 'Location' && data.location !== '');
        default:
            return true;
    }
}

/**
 * Filter views based on data availability
 * @param {Array<string>} views - List of view types
 * @param {Object} data - Parsed info box data
 * @param {Object} config - Widget configuration
 * @returns {Array<string>} Filtered views
 */
function filterEmptyViews(views, data, config) {
    if (config.showEmptyViews) {
        return views;
    }

    return views.filter(viewType => hasViewData(viewType, data));
}

/**
 * Render tab bar
 * @param {Array<string>} views - List of view types
 * @param {string} activeView - Currently active view
 * @returns {string} Tab bar HTML
 */
function renderViewTabs(views, activeView) {
    if (views.length === 0) {
        return '';
    }

    return `
        <div class="rpg-inventory-subtabs">
            ${views.map(viewType => {
                const meta = VIEW_META[viewType] || { icon: '📄', label: viewType };
                const isActive = activeView === viewType;

                return `
                    <button class="rpg-inventory-subtab ${isActive ? 'active' : ''}"
                            data-tab="${viewType}"
                            title="${meta.fullLabel}"
                            aria-label="Switch to ${meta.fullLabel}">
                        <span style="font-size: 1.2rem;">${meta.icon}</span>
                        <span class="rpg-subtab-label">${meta.label}</span>
                    </button>
                `;
            }).join('')}
        </div>
    `;
}

/**
 * Render all views (hidden initially, toggle visibility)
 * @param {Array<string>} views - List of view types
 * @param {string} activeView - Currently active view
 * @param {Object} registry - Widget registry
 * @param {Object} dependencies - Widget dependencies
 * @returns {string} Views container HTML
 */
function renderAllViews(views, activeView, registry, dependencies) {
    const viewsHtml = views.map(viewType => {
        const widgetDef = registry.get(viewType);
        if (!widgetDef) {
            console.warn(`[SceneInfoWidget] Widget type "${viewType}" not found in registry`);
            return `
                <div class="rpg-scene-info-view" data-view="${viewType}" style="display: none;">
                    <div class="rpg-scene-empty">Widget "${viewType}" not available</div>
                </div>
            `;
        }

        // Create temporary container for widget render
        const tempContainer = document.createElement('div');
        tempContainer.className = 'rpg-scene-info-view';
        tempContainer.dataset.view = viewType;
        tempContainer.style.display = viewType === activeView ? 'block' : 'none';

        // Call existing widget's render function
        try {
            widgetDef.render(tempContainer, {});
        } catch (error) {
            console.error(`[SceneInfoWidget] Error rendering ${viewType}:`, error);
            tempContainer.innerHTML = `<div class="rpg-scene-empty">Error rendering ${viewType}</div>`;
        }

        return tempContainer.outerHTML;
    }).join('');

    return `<div class="rpg-scene-info-views">${viewsHtml}</div>`;
}

/**
 * Attach tab switching event handlers
 * @param {HTMLElement} container - Widget container
 * @param {string} widgetId - Widget instance ID
 */
function attachTabHandlers(container, widgetId) {
    const widget = container.querySelector('.rpg-scene-info-widget');
    if (!widget) return;

    const state = getWidgetState(widgetId);

    // Tab click handlers
    widget.querySelectorAll('.rpg-inventory-subtab').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;

            // Update state
            state.activeSubTab = tab;

            // Toggle view visibility
            widget.querySelectorAll('.rpg-scene-info-view').forEach(view => {
                view.style.display = view.dataset.view === tab ? 'block' : 'none';
            });

            // Update active tab styling
            widget.querySelectorAll('.rpg-inventory-subtab').forEach(b =>
                b.classList.remove('active'));
            btn.classList.add('active');
        });
    });
}

/**
 * Register Scene Info Widget
 */
export function registerSceneInfoWidget(registry, dependencies) {
    registry.register('sceneInfo', {
        name: 'Scene Info',
        icon: '🗺️',
        description: 'Multi-view scene information (calendar, weather, time, location)',
        category: 'scene',
        minSize: { w: 2, h: 2 },
        defaultSize: { w: 2, h: 3 },
        maxAutoSize: { w: 2, h: 4 },
        requiresSchema: false,

        /**
         * Render the widget
         * @param {HTMLElement} container - Widget container
         * @param {Object} config - Widget configuration
         */
        render(container, config = {}) {
            // Get widget ID from parent element
            const widgetElement = container.closest('.rpg-widget');
            const widgetId = widgetElement?.dataset?.widgetId || 'scene-info-default';

            // Get or create widget state
            const state = getWidgetState(widgetId);

            // Default configuration
            const defaultViews = ['calendar', 'weather', 'temperature', 'clock', 'location'];
            const views = config.views || defaultViews;

            // Get data and filter empty views
            const { getInfoBoxData } = dependencies;
            const data = parseInfoBoxData(getInfoBoxData());
            const availableViews = filterEmptyViews(views, data, config);

            // Handle case where no views are available
            if (availableViews.length === 0) {
                container.innerHTML = `
                    <div class="rpg-dashboard-widget">
                        <div class="rpg-scene-empty" style="padding: 1rem; text-align: center; color: var(--rpg-text); opacity: 0.6;">
                            No scene information available
                        </div>
                    </div>
                `;
                return;
            }

            // Ensure active tab is valid
            if (!availableViews.includes(state.activeSubTab)) {
                state.activeSubTab = config.defaultView || availableViews[0];
            }

            // Render widget HTML
            const html = `
                <div class="rpg-dashboard-widget">
                    <div class="rpg-scene-info-widget" data-widget-id="${widgetId}">
                        ${renderViewTabs(availableViews, state.activeSubTab)}
                        ${renderAllViews(availableViews, state.activeSubTab, registry, dependencies)}
                    </div>
                </div>
            `;

            container.innerHTML = html;

            // Attach event handlers
            attachTabHandlers(container, widgetId);
        },

        /**
         * Get configuration options
         * @returns {Object} Configuration schema
         */
        getConfig() {
            return {
                views: {
                    type: 'multiselect',
                    label: 'Visible Views',
                    default: ['calendar', 'weather', 'temperature', 'clock', 'location'],
                    options: [
                        { value: 'calendar', label: 'Calendar' },
                        { value: 'weather', label: 'Weather' },
                        { value: 'temperature', label: 'Temperature' },
                        { value: 'clock', label: 'Clock' },
                        { value: 'location', label: 'Location' }
                    ],
                    description: 'Select which views to show in the widget'
                },
                defaultView: {
                    type: 'select',
                    label: 'Default View',
                    default: 'calendar',
                    options: [
                        { value: 'calendar', label: 'Calendar' },
                        { value: 'weather', label: 'Weather' },
                        { value: 'temperature', label: 'Temperature' },
                        { value: 'clock', label: 'Clock' },
                        { value: 'location', label: 'Location' }
                    ],
                    description: 'Which view to show by default'
                },
                showEmptyViews: {
                    type: 'boolean',
                    label: 'Show Empty Views',
                    default: false,
                    description: 'Show tabs even when they have no data'
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
        }
    });
}
