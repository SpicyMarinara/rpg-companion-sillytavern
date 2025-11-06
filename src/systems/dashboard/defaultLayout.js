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
                    // Row 0-1: User Info (left column, vertical)
                    {
                        id: 'widget-userinfo',
                        type: 'userInfo',
                        x: 0,
                        y: 0,
                        w: 1,
                        h: 2,
                        config: {}
                    },
                    // Row 0-2: User Stats (right side, tall, 2 cols wide)
                    {
                        id: 'widget-userstats',
                        type: 'userStats',
                        x: 1,
                        y: 0,
                        w: 2,
                        h: 3,
                        config: {
                            statBarGradient: true
                        }
                    },
                    // Row 2: User Mood (below user info, left column)
                    {
                        id: 'widget-usermood',
                        type: 'userMood',
                        x: 0,
                        y: 2,
                        w: 1,
                        h: 1,
                        config: {}
                    },
                    // Row 3-6: User Attributes (full width below everything, 3 cols wide)
                    {
                        id: 'widget-userattributes',
                        type: 'userAttributes',
                        x: 0,
                        y: 3,
                        w: 3,
                        h: 4,
                        config: {}
                    }
                ]
            },
            // Tab 2: Scene (Combined scene info widget + events + characters)
            {
                id: 'tab-scene',
                name: 'Scene',
                icon: 'fa-solid fa-map',
                order: 1,
                widgets: [
                    // Row 0-2: Scene Info (combined: calendar, weather, temp, clock, location)
                    {
                        id: 'widget-sceneinfo',
                        type: 'sceneInfo',
                        x: 0,
                        y: 0,
                        w: 3,
                        h: 3,
                        config: {}
                    },
                    // Row 3-4: Recent Events (notebook style, full width)
                    {
                        id: 'widget-recentevents',
                        type: 'recentEvents',
                        x: 0,
                        y: 3,
                        w: 3,
                        h: 2,
                        config: {
                            maxEvents: 3
                        }
                    },
                    // Row 5-8: Present Characters (full width, tall for cards)
                    {
                        id: 'widget-presentchars',
                        type: 'presentCharacters',
                        x: 0,
                        y: 5,
                        w: 3,
                        h: 4,
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
            },
            // Tab 4: Quests (Full tab for quest system)
            {
                id: 'tab-quests',
                name: 'Quests',
                icon: 'fa-solid fa-scroll',
                order: 3,
                widgets: [
                    {
                        id: 'widget-quests',
                        type: 'quests',
                        x: 0,
                        y: 0,
                        w: 2,
                        h: 5,
                        config: {
                            defaultSubTab: 'main'
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

    // Check trackerConfig for field-level disabling
    const trackerConfig = oldSettings.trackerConfig;

    // Remove userStats widget if hidden in v1.x OR all stats disabled in trackerConfig
    const allStatsDisabled = trackerConfig?.userStats?.customStats
        ?.every(stat => !stat.enabled) ?? false;

    if (!oldSettings.showUserStats || allStatsDisabled) {
        statusTab.widgets = statusTab.widgets.filter(w => w.type !== 'userStats');
        console.log('[DefaultLayout] Removed userStats widget', allStatsDisabled ? '(all stats disabled in trackerConfig)' : '(was hidden in v1.x)');
    }

    // Remove infoBox widget if hidden in v1.x
    // Note: We keep individual info widgets (calendar, weather, etc.) even if fields are disabled
    // because widgets will show disabled state with link to Tracker Settings
    if (!oldSettings.showInfoBox) {
        statusTab.widgets = statusTab.widgets.filter(w => w.type !== 'infoBox');
        console.log('[DefaultLayout] Removed infoBox widget (was hidden in v1.x)');
    }

    // Remove presentCharacters widget if hidden in v1.x OR thoughts disabled in trackerConfig
    const thoughtsDisabled = trackerConfig?.presentCharacters?.thoughts?.enabled === false;

    if (!oldSettings.showCharacterThoughts || thoughtsDisabled) {
        statusTab.widgets = statusTab.widgets.filter(w => w.type !== 'presentCharacters');
        console.log('[DefaultLayout] Removed presentCharacters widget', thoughtsDisabled ? '(thoughts disabled in trackerConfig)' : '(was hidden in v1.x)');
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
