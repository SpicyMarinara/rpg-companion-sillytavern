/**
 * Default Dashboard Layout Generator
 *
 * Generates the default dashboard configuration for new users or when resetting layout.
 * Maps existing v1.x panel structure to v2.0 widget dashboard.
 */

/**
 * Generate default dashboard configuration
 *
 * Creates a two-tab layout optimized for 2-column side panel:
 * - "Status" tab: User stats, modular info widgets (calendar, weather, temp, clock, location), present characters
 * - "Inventory" tab: Full inventory widget
 *
 * All positions sized for 2-column grid (w: 1-2, full width = 2).
 * Layout will adapt if panel width increases to 3-4 columns.
 *
 * @returns {Object} Default dashboard configuration
 */
export function generateDefaultDashboard() {
    const dashboard = {
        version: 2,

        gridConfig: {
            // Columns calculated dynamically by GridEngine (2-4 based on panel width)
            // Mobile: always 2, Desktop: 2-4 based on width
            columns: 2, // Default to 2 columns (will be recalculated on init)
            rowHeight: 5, // rem units for responsive scaling (1080p → 4K → mobile)
            gap: 0.75, // rem units (scales with screen DPI)
            snapToGrid: true,
            showGrid: true
        },

        tabs: [
            // Tab 1: Status (User widgets only - compact and focused)
            {
                id: 'tab-status',
                name: 'Status',
                icon: 'fa-solid fa-user',
                order: 0,
                widgets: [
                    // Row 0: User Info (left) + User Mood (top right in 3-col)
                    {
                        id: 'widget-userinfo',
                        type: 'userInfo',
                        x: 0,
                        y: 0,
                        w: 2,
                        h: 1,
                        config: {}
                    },
                    {
                        id: 'widget-usermood',
                        type: 'userMood',
                        x: 2,
                        y: 0,
                        w: 1,
                        h: 1,
                        config: {}
                    },
                    // Row 1-2: User Stats (health/energy bars)
                    {
                        id: 'widget-userstats',
                        type: 'userStats',
                        x: 0,
                        y: 1,
                        w: 2,
                        h: 2,
                        config: {
                            statBarGradient: true
                        }
                    },
                    // Row 3-4: User Attributes
                    {
                        id: 'widget-userattributes',
                        type: 'userAttributes',
                        x: 0,
                        y: 3,
                        w: 2,
                        h: 2,
                        config: {}
                    }
                ]
            },
            // Tab 2: Scene (Scene info widgets + characters)
            {
                id: 'tab-scene',
                name: 'Scene',
                icon: 'fa-solid fa-map',
                order: 1,
                widgets: [
                    // Row 0: Calendar (left) + Weather (right)
                    {
                        id: 'widget-calendar',
                        type: 'calendar',
                        x: 0,
                        y: 0,
                        w: 1,
                        h: 1,
                        config: {}
                    },
                    {
                        id: 'widget-weather',
                        type: 'weather',
                        x: 1,
                        y: 0,
                        w: 1,
                        h: 1,
                        config: {
                            compact: false
                        }
                    },
                    // Row 1: Temperature (left) + Clock (right)
                    {
                        id: 'widget-temperature',
                        type: 'temperature',
                        x: 0,
                        y: 1,
                        w: 1,
                        h: 1,
                        config: {
                            unit: 'celsius'
                        }
                    },
                    {
                        id: 'widget-clock',
                        type: 'clock',
                        x: 1,
                        y: 1,
                        w: 1,
                        h: 1,
                        config: {
                            format: 'digital'
                        }
                    },
                    // Row 2-3: Location (full width)
                    {
                        id: 'widget-location',
                        type: 'location',
                        x: 0,
                        y: 2,
                        w: 2,
                        h: 2,
                        config: {}
                    },
                    // Row 4-6: Present Characters (full width, will expand with auto-layout)
                    {
                        id: 'widget-presentchars',
                        type: 'presentCharacters',
                        x: 0,
                        y: 4,
                        w: 2,
                        h: 3,
                        config: {
                            cardLayout: 'grid',
                            showThoughtBubbles: true
                        }
                    }
                ]
            },
            // Tab 3: Inventory (Full tab for inventory system)
            {
                id: 'tab-inventory',
                name: 'Inventory',
                icon: 'fa-solid fa-bag-shopping',
                order: 2,
                widgets: [
                    {
                        id: 'widget-inventory',
                        type: 'inventory',
                        x: 0,
                        y: 0,
                        w: 2,
                        h: 6,
                        config: {
                            defaultSubTab: 'onPerson',
                            defaultViewMode: 'list'
                        }
                    }
                ]
            }
        ],

        defaultTab: 'tab-status'
    };

    console.log('[DefaultLayout] Generated default dashboard configuration');
    return dashboard;
}

/**
 * Migrate v1.x settings to v2.0 dashboard
 *
 * Converts existing hardcoded panel structure to widget-based layout.
 * Preserves user's visibility preferences and data.
 *
 * @param {Object} oldSettings - v1.x extension settings
 * @returns {Object} Migrated dashboard configuration
 */
export function migrateV1ToV2Dashboard(oldSettings) {
    console.log('[DefaultLayout] Migrating v1.x settings to v2.0 dashboard');

    const dashboard = generateDefaultDashboard();

    // Respect user's visibility preferences from v1.x
    const statusTab = dashboard.tabs[0];

    // Remove widgets that were hidden in v1.x
    if (!oldSettings.showUserStats) {
        statusTab.widgets = statusTab.widgets.filter(w => w.type !== 'userStats');
        console.log('[DefaultLayout] Removed userStats widget (was hidden in v1.x)');
    }

    if (!oldSettings.showInfoBox) {
        statusTab.widgets = statusTab.widgets.filter(w => w.type !== 'infoBox');
        console.log('[DefaultLayout] Removed infoBox widget (was hidden in v1.x)');
    }

    if (!oldSettings.showCharacterThoughts) {
        statusTab.widgets = statusTab.widgets.filter(w => w.type !== 'presentCharacters');
        console.log('[DefaultLayout] Removed presentCharacters widget (was hidden in v1.x)');
    }

    // Remove inventory tab if it was hidden in v1.x
    if (!oldSettings.showInventory) {
        dashboard.tabs = dashboard.tabs.filter(t => t.id !== 'tab-inventory');
        console.log('[DefaultLayout] Removed inventory tab (was hidden in v1.x)');
    }

    // If all widgets were hidden on status tab, remove it too
    if (statusTab.widgets.length === 0) {
        dashboard.tabs = dashboard.tabs.filter(t => t.id !== 'tab-status');
        console.log('[DefaultLayout] Removed status tab (all widgets were hidden)');

        // If we still have inventory tab, make it default
        if (dashboard.tabs.length > 0) {
            dashboard.defaultTab = dashboard.tabs[0].id;
        }
    }

    console.log(`[DefaultLayout] Migration complete - ${dashboard.tabs.length} tabs, ${dashboard.tabs.reduce((sum, t) => sum + t.widgets.length, 0)} widgets`);

    return dashboard;
}

/**
 * Validate dashboard configuration
 *
 * Ensures dashboard config has all required fields and valid structure.
 *
 * @param {Object} dashboard - Dashboard configuration to validate
 * @returns {boolean} True if valid, false otherwise
 */
export function validateDashboardConfig(dashboard) {
    if (!dashboard) {
        console.error('[DefaultLayout] Dashboard config is null or undefined');
        return false;
    }

    if (!dashboard.version) {
        console.error('[DefaultLayout] Dashboard config missing version');
        return false;
    }

    if (!dashboard.gridConfig) {
        console.error('[DefaultLayout] Dashboard config missing gridConfig');
        return false;
    }

    if (!Array.isArray(dashboard.tabs)) {
        console.error('[DefaultLayout] Dashboard tabs is not an array');
        return false;
    }

    // Validate each tab
    for (const tab of dashboard.tabs) {
        if (!tab.id || !tab.name) {
            console.error('[DefaultLayout] Tab missing id or name:', tab);
            return false;
        }

        if (!Array.isArray(tab.widgets)) {
            console.error('[DefaultLayout] Tab widgets is not an array:', tab);
            return false;
        }

        // Validate each widget
        for (const widget of tab.widgets) {
            if (!widget.id || !widget.type) {
                console.error('[DefaultLayout] Widget missing id or type:', widget);
                return false;
            }

            if (typeof widget.x !== 'number' || typeof widget.y !== 'number') {
                console.error('[DefaultLayout] Widget position invalid:', widget);
                return false;
            }

            if (typeof widget.w !== 'number' || typeof widget.h !== 'number') {
                console.error('[DefaultLayout] Widget size invalid:', widget);
                return false;
            }
        }
    }

    return true;
}

/**
 * Get widget count in dashboard
 *
 * @param {Object} dashboard - Dashboard configuration
 * @returns {number} Total number of widgets across all tabs
 */
export function getWidgetCount(dashboard) {
    if (!dashboard || !Array.isArray(dashboard.tabs)) {
        return 0;
    }

    return dashboard.tabs.reduce((sum, tab) => {
        return sum + (Array.isArray(tab.widgets) ? tab.widgets.length : 0);
    }, 0);
}

/**
 * Find widget by ID across all tabs
 *
 * @param {Object} dashboard - Dashboard configuration
 * @param {string} widgetId - Widget ID to find
 * @returns {{tabIndex: number, widgetIndex: number, widget: Object}|null}
 */
export function findWidget(dashboard, widgetId) {
    if (!dashboard || !Array.isArray(dashboard.tabs)) {
        return null;
    }

    for (let tabIndex = 0; tabIndex < dashboard.tabs.length; tabIndex++) {
        const tab = dashboard.tabs[tabIndex];
        if (!Array.isArray(tab.widgets)) continue;

        for (let widgetIndex = 0; widgetIndex < tab.widgets.length; widgetIndex++) {
            const widget = tab.widgets[widgetIndex];
            if (widget.id === widgetId) {
                return { tabIndex, widgetIndex, widget };
            }
        }
    }

    return null;
}
