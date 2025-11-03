/**
 * Dashboard Manager
 *
 * Orchestrates the complete dashboard system by integrating:
 * - GridEngine (positioning)
 * - WidgetRegistry (widget definitions)
 * - TabManager (multi-tab support)
 * - DragDropHandler (drag widgets)
 * - ResizeHandler (resize widgets)
 * - EditModeManager (edit/view modes)
 * - LayoutPersistence (save/load)
 *
 * Provides high-level API for widget and tab management.
 */

// Performance: Disable console logging (console.error still active)
const DEBUG = false;
const console = DEBUG ? window.console : {
    log: () => {},
    warn: () => {},
    error: window.console.error.bind(window.console)
};

import { GridEngine } from './gridEngine.js';
import { WidgetRegistry } from './widgetRegistry.js';
import { TabManager } from './tabManager.js';
import { DragDropHandler } from './dragDrop.js';
import { ResizeHandler } from './resizeHandler.js';
import { EditModeManager } from './editModeManager.js';
import { LayoutPersistence } from './layoutPersistence.js';
import { generateDefaultDashboard } from './defaultLayout.js';

/**
 * @typedef {Object} DashboardConfig
 * @property {number} columns - Grid column count (default: 12)
 * @property {number} rowHeight - Grid row height in pixels (default: 80)
 * @property {number} gap - Gap between widgets in pixels (default: 12)
 * @property {number} debounceMs - Auto-save debounce delay (default: 500)
 * @property {Function} onSave - Callback when layout saved
 * @property {Function} onLoad - Callback when layout loaded
 * @property {Function} onError - Callback on errors
 */

/**
 * DashboardManager - Complete dashboard system orchestrator
 */
export class DashboardManager {
    /**
     * @param {HTMLElement} container - Main dashboard container element
     * @param {DashboardConfig} config - Configuration options
     */
    constructor(container, config = {}) {
        if (!container) {
            throw new Error('[DashboardManager] Container element is required');
        }

        this.container = container;
        this.config = {
            columns: config.columns || 12,
            rowHeight: config.rowHeight || 5, // rem units for responsive scaling
            gap: config.gap || 0.75, // rem units for responsive scaling
            debounceMs: config.debounceMs || 500,
            onSave: config.onSave,
            onLoad: config.onLoad,
            onError: config.onError,
            ...config
        };

        console.log('[DashboardManager] Constructor config:', {
            rowHeight: this.config.rowHeight,
            gap: this.config.gap,
            columns: this.config.columns
        });

        // Dashboard state
        this.currentTabId = null;
        this.widgets = new Map(); // widgetId => { widget data, element, tab }
        this.defaultLayout = null;
        this.previousTrackerConfig = null; // For detecting config changes

        // Dashboard data structure (for TabManager)
        this.dashboard = {
            tabs: [],
            defaultTab: null
        };

        // System instances
        this.gridEngine = null;
        this.registry = null;
        this.tabManager = null;
        this.dragHandler = null;
        this.resizeHandler = null;
        this.editManager = null;
        this.persistence = null;

        // Container elements
        this.gridContainer = null;
        this.tabContainer = null;
        this.resizeHandlesOverlay = null;
        this.editControlsOverlay = null;

        this.changeListeners = new Set();

        console.log('[DashboardManager] Initialized');
    }

    /**
     * Initialize all dashboard systems
     */
    async init() {
        console.log('[DashboardManager] Initializing systems...');

        // Create container structure
        this.createContainerStructure();

        // Initialize Widget Registry (use provided registry or create new one)
        this.registry = this.config.registry || new WidgetRegistry();

        // Initialize Grid Engine (columns calculated dynamically)
        this.gridEngine = new GridEngine({
            rowHeight: this.config.rowHeight,
            gap: this.config.gap,
            container: this.gridContainer,
            registry: this.registry, // Pass registry for maxAutoSize lookups
            onColumnsChange: (newCols, oldCols) => {
                console.log('[DashboardManager] Grid columns changed:', oldCols, '→', newCols);

                // Auto-reflow current tab to optimize for new column count
                const currentTab = this.tabManager.getTab(this.currentTabId);
                if (currentTab && currentTab.widgets && currentTab.widgets.length > 0) {
                    console.log(`[DashboardManager] Auto-reflowing ${currentTab.widgets.length} widgets for ${newCols} columns`);

                    // Run auto-layout to reflow and expand widgets for new grid
                    // This prevents overlap and optimizes space usage
                    this.gridEngine.autoLayout(currentTab.widgets, { preserveOrder: true });

                    // Save changes
                    this.triggerAutoSave();
                }

                // Re-render all widgets with new layout
                this.renderAllWidgets();
            }
        });

        // Initialize Tab Manager with dashboard data structure
        // Create default tab if no tabs exist
        if (this.dashboard.tabs.length === 0) {
            this.dashboard.tabs.push({
                id: 'main',
                name: 'Main',
                icon: 'fa-solid fa-house',
                order: 0,
                widgets: []
            });
            this.dashboard.defaultTab = 'main';
        }

        this.tabManager = new TabManager(this.dashboard);

        // Set current tab to active tab from TabManager
        this.currentTabId = this.tabManager.activeTabId;

        // Register tab change listener
        this.tabManager.onChange((event, data) => {
            if (event === 'activeTabChanged') {
                this.onTabChange(data.tabId);
            }
        });

        // Initialize Edit Mode Manager first (needed by drag/resize handlers)
        this.editManager = new EditModeManager({
            container: this.container,
            editControlsOverlay: this.editControlsOverlay,
            onSave: () => this.handleEditSave(),
            onCancel: (originalLayout) => this.handleEditCancel(originalLayout),
            onWidgetAdd: (type) => this.addWidget(type),
            onWidgetDelete: (widgetId) => this.removeWidget(widgetId),
            onWidgetSettings: (widgetId) => this.openWidgetSettings(widgetId)
        });

        // Initialize Drag & Drop (with editManager and dashboardManager references)
        this.dragHandler = new DragDropHandler(this.gridEngine, {
            showGrid: true,
            enableSnap: true,
            editManager: this.editManager,
            dashboardManager: this
        });

        // Initialize Resize Handler (with editManager and overlay references)
        this.resizeHandler = new ResizeHandler(this.gridEngine, {
            minWidth: 1,
            minHeight: 2,
            maxWidth: 4, // Max 4 columns (will be clamped to actual column count)
            maxHeight: 10,
            editManager: this.editManager,
            resizeHandlesOverlay: this.resizeHandlesOverlay
        });

        // Initialize Layout Persistence
        this.persistence = new LayoutPersistence({
            debounceMs: this.config.debounceMs,
            onSave: (layout) => {
                console.log('[DashboardManager] Layout saved');
                if (this.config.onSave) this.config.onSave(layout);
            },
            onLoad: (layout) => {
                console.log('[DashboardManager] Layout loaded');
                if (this.config.onLoad) this.config.onLoad(layout);
            },
            onError: (error) => {
                console.error('[DashboardManager] Error:', error);
                if (this.config.onError) this.config.onError(error);
            }
        });

        // Try to load saved layout
        await this.loadLayout();

        // Measure container width and set up responsive sizing
        this.setupContainerSizing();

        // Listen for tracker config changes (reactive integration)
        document.addEventListener('rpg:trackerConfigChanged', (e) => {
            console.log('[DashboardManager] Tracker config changed, refreshing widgets');
            this.onTrackerConfigChanged(e.detail.config);
        });

        // Render tab navigation
        this.renderTabs();

        console.log('[DashboardManager] All systems initialized');
        this.notifyChange('initialized');
    }

    /**
     * Create dashboard container structure
     */
    createContainerStructure() {
        // Check if tabs and grid containers already exist (from template)
        this.tabContainer = this.container.querySelector('#rpg-dashboard-tabs');
        this.gridContainer = this.container.querySelector('#rpg-dashboard-grid');

        // If they don't exist, create them (fallback for legacy/minimal setup)
        if (!this.tabContainer) {
            console.warn('[DashboardManager] Tab container not found in template, creating...');
            this.tabContainer = document.createElement('div');
            this.tabContainer.className = 'rpg-dashboard-tabs';
            this.tabContainer.id = 'rpg-dashboard-tabs';
            this.container.appendChild(this.tabContainer);
        }

        if (!this.gridContainer) {
            console.warn('[DashboardManager] Grid container not found in template, creating...');
            this.gridContainer = document.createElement('div');
            this.gridContainer.className = 'rpg-dashboard-grid';
            this.gridContainer.id = 'rpg-dashboard-grid';
            this.gridContainer.style.position = 'relative';
            this.gridContainer.style.minHeight = '600px';
            this.container.appendChild(this.gridContainer);
        }

        // Create overlay containers for resize handles and edit controls
        // These are positioned outside the widget DOM to prevent overflow/scrollbar issues
        this.resizeHandlesOverlay = document.createElement('div');
        this.resizeHandlesOverlay.id = 'rpg-resize-handles-overlay';
        this.resizeHandlesOverlay.className = 'rpg-overlay-container';
        this.resizeHandlesOverlay.style.cssText = 'position: absolute; inset: 0; pointer-events: none; z-index: 9999;';
        this.gridContainer.appendChild(this.resizeHandlesOverlay);

        this.editControlsOverlay = document.createElement('div');
        this.editControlsOverlay.id = 'rpg-edit-controls-overlay';
        this.editControlsOverlay.className = 'rpg-overlay-container';
        this.editControlsOverlay.style.cssText = 'position: absolute; inset: 0; pointer-events: none; z-index: 10000;';
        this.gridContainer.appendChild(this.editControlsOverlay);

        console.log('[DashboardManager] Container structure ready (including overlays)');
    }

    /**
     * Set up container sizing and responsive behavior
     * Measures container width and sets up ResizeObserver
     * Also listens for viewport resize to recalculate vw/vh positions
     */
    setupContainerSizing() {
        // Measure actual container width
        const width = this.gridContainer.clientWidth || this.gridContainer.offsetWidth || 350;
        console.log('[DashboardManager] Measured container width:', width);

        // Set container width in GridEngine (triggers column calculation)
        this.gridEngine.setContainerWidth(width);

        // Set up ResizeObserver to track container width changes
        if (typeof ResizeObserver !== 'undefined') {
            this.resizeObserver = new ResizeObserver((entries) => {
                for (const entry of entries) {
                    const newWidth = entry.contentRect.width;
                    console.log('[DashboardManager] Container resized to:', newWidth);
                    this.gridEngine.setContainerWidth(newWidth);
                }
            });

            this.resizeObserver.observe(this.gridContainer);
            console.log('[DashboardManager] ResizeObserver set up');
        } else {
            console.warn('[DashboardManager] ResizeObserver not supported, responsive sizing disabled');
        }

        // Listen for window resize to recalculate vh positions
        // Viewport height changes affect vh calculations for vertical positioning
        // Horizontal (%) automatically adapts to container width changes via ResizeObserver
        this.viewportResizeHandler = () => {
            console.log('[DashboardManager] Viewport resized, recalculating vh positions');
            this.renderAllWidgets(); // Re-render with new vh values
        };
        window.addEventListener('resize', this.viewportResizeHandler);
        console.log('[DashboardManager] Viewport resize listener added');
    }

    /**
     * Migrate old 12-column layouts to new responsive grid
     * Detects if any widgets have widths exceeding current column count
     * and automatically runs auto-layout to fix them
     */
    migrateOldLayouts() {
        console.log('[DashboardManager] Checking for old layouts to migrate...');

        let needsMigration = false;

        // Check all tabs
        this.dashboard.tabs.forEach(tab => {
            if (!tab.widgets || tab.widgets.length === 0) return;

            // Check if any widget has width exceeding current column count
            tab.widgets.forEach(widget => {
                if (widget.w > this.gridEngine.columns) {
                    console.warn(`[DashboardManager] Widget ${widget.id} has width ${widget.w} exceeding column count ${this.gridEngine.columns}`);
                    needsMigration = true;
                }
            });

            if (needsMigration) {
                console.log(`[DashboardManager] Migrating tab ${tab.id} to new responsive grid...`);
                // Run auto-layout on this tab's widgets
                this.gridEngine.autoLayout(tab.widgets, { preferFullWidth: true });
                console.log(`[DashboardManager] Tab ${tab.id} migrated successfully`);
            }
        });

        if (needsMigration) {
            // Save migrated layout
            this.triggerAutoSave();

            // Re-render current tab with new positions
            this.clearGrid();
            const currentTab = this.tabManager.getTab(this.currentTabId);
            if (currentTab && currentTab.widgets) {
                currentTab.widgets.forEach(widget => {
                    const definition = this.registry.get(widget.type);
                    if (definition) {
                        this.renderWidget(widget, definition);
                    }
                });
            }

            console.log('[DashboardManager] Old layouts migrated, saved, and re-rendered');
        } else {
            console.log('[DashboardManager] No migration needed');
        }
    }

    /**
     * Render tab navigation UI
     */
    renderTabs() {
        if (!this.tabContainer) {
            console.warn('[DashboardManager] Tab container not found');
            return;
        }

        // Clear existing tabs
        this.tabContainer.innerHTML = '';

        // Get all tabs sorted by order
        const tabs = this.tabManager.getTabs();

        if (tabs.length === 0) {
            console.warn('[DashboardManager] No tabs to render');
            return;
        }

        // Create tab buttons
        tabs.forEach(tab => {
            const button = document.createElement('button');
            button.className = 'rpg-dashboard-tab';
            button.dataset.tabId = tab.id;
            button.innerHTML = `
                <span class="rpg-tab-icon"><i class="${tab.icon}"></i></span>
                <span class="rpg-tab-name">${tab.name}</span>
            `;

            // Mark active tab
            if (tab.id === this.currentTabId) {
                button.classList.add('active');
            }

            // Tab click handler
            button.addEventListener('click', () => {
                this.switchTab(tab.id);
            });

            this.tabContainer.appendChild(button);
        });

        // Icon-only mode when 4+ tabs to prevent header wrapping on hover
        if (tabs.length > 3) {
            this.tabContainer.classList.add('rpg-tabs-icon-only');
        } else {
            this.tabContainer.classList.remove('rpg-tabs-icon-only');
        }

        console.log(`[DashboardManager] Rendered ${tabs.length} tabs`);
    }

    /**
     * Add a new widget to the dashboard
     * @param {string} type - Widget type (must be registered)
     * @param {string} [tabId] - Tab ID (default: current tab)
     * @param {Object} [config] - Widget configuration
     * @returns {string} Widget ID
     */
    addWidget(type, tabId = null, config = {}) {
        const targetTabId = tabId || this.currentTabId;
        if (!targetTabId) {
            throw new Error('[DashboardManager] No tab selected');
        }

        // Get widget definition from registry
        const definition = this.registry.get(type);
        if (!definition) {
            throw new Error(`[DashboardManager] Widget type "${type}" not registered`);
        }

        // Generate unique widget ID
        const widgetId = `widget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Find available position in grid
        const position = this.findAvailablePosition(definition.defaultSize);

        // Create widget data
        const widget = {
            id: widgetId,
            type,
            x: position.x,
            y: position.y,
            w: definition.defaultSize.w,
            h: definition.defaultSize.h,
            config: config || {}
        };

        // Add to tab
        const tab = this.tabManager.getTab(targetTabId);
        if (!tab) {
            throw new Error(`[DashboardManager] Tab "${targetTabId}" not found`);
        }

        if (!tab.widgets) {
            tab.widgets = [];
        }
        tab.widgets.push(widget);

        // Render widget if on current tab
        if (targetTabId === this.currentTabId) {
            this.renderWidget(widget, definition);
        }

        // Trigger auto-save
        this.triggerAutoSave();

        console.log(`[DashboardManager] Added widget: ${widgetId} (${type}) to tab: ${targetTabId}`);
        this.notifyChange('widgetAdded', { widgetId, type, tabId: targetTabId });

        return widgetId;
    }

    /**
     * Remove a widget from the dashboard
     * @param {string} widgetId - Widget ID to remove
     */
    removeWidget(widgetId) {
        // Find widget in current tab
        const tab = this.tabManager.getTab(this.currentTabId);
        if (!tab || !tab.widgets) {
            console.warn(`[DashboardManager] Widget ${widgetId} not found in current tab`);
            return;
        }

        const index = tab.widgets.findIndex(w => w.id === widgetId);
        if (index === -1) {
            console.warn(`[DashboardManager] Widget ${widgetId} not found`);
            return;
        }

        // Get widget element and definition
        const widgetData = this.widgets.get(widgetId);
        if (widgetData) {
            // Call widget cleanup
            const definition = this.registry.get(widgetData.widget.type);
            if (definition && definition.onRemove) {
                definition.onRemove(widgetData.element, widgetData.widget.config);
            }

            // Destroy drag/resize handlers
            this.dragHandler.destroyWidget(widgetData.element);
            this.resizeHandler.destroyWidget(widgetData.element);

            // Remove element
            widgetData.element.remove();

            // Remove from map
            this.widgets.delete(widgetId);
        }

        // Remove from tab
        tab.widgets.splice(index, 1);

        // Trigger auto-save
        this.triggerAutoSave();

        console.log(`[DashboardManager] Removed widget: ${widgetId}`);
        this.notifyChange('widgetRemoved', { widgetId });
    }

    /**
     * Move a widget from one tab to another
     * @param {string} widgetId - Widget ID to move
     * @param {string} targetTabId - Target tab ID
     */
    moveWidgetToTab(widgetId, targetTabId) {
        console.log(`[DashboardManager] Moving widget ${widgetId} to tab ${targetTabId}`);

        // Find which tab currently contains the widget
        let sourceTab = null;
        let widgetData = null;

        for (const tab of this.dashboard.tabs) {
            if (tab.widgets) {
                const index = tab.widgets.findIndex(w => w.id === widgetId);
                if (index !== -1) {
                    sourceTab = tab;
                    widgetData = tab.widgets[index];
                    break;
                }
            }
        }

        if (!sourceTab || !widgetData) {
            console.warn(`[DashboardManager] Widget ${widgetId} not found in any tab`);
            return;
        }

        // Get target tab
        const targetTab = this.tabManager.getTab(targetTabId);
        if (!targetTab) {
            console.warn(`[DashboardManager] Target tab ${targetTabId} not found`);
            return;
        }

        // Don't move if already in target tab
        if (sourceTab.id === targetTabId) {
            console.log(`[DashboardManager] Widget ${widgetId} already in tab ${targetTabId}`);
            return;
        }

        // Remove from source tab
        const index = sourceTab.widgets.findIndex(w => w.id === widgetId);
        sourceTab.widgets.splice(index, 1);

        // Find available position in target tab (collision detection)
        if (!targetTab.widgets) {
            targetTab.widgets = [];
        }

        // Find available position explicitly checking against target tab widgets
        const availablePosition = this.findAvailablePositionInWidgets(
            { w: widgetData.w, h: widgetData.h },
            targetTab.widgets
        );

        widgetData.x = availablePosition.x;
        widgetData.y = availablePosition.y;

        console.log(`[DashboardManager] Found available position in target tab: (${availablePosition.x}, ${availablePosition.y})`);

        // Add to target tab
        targetTab.widgets.push(widgetData);

        // Update runtime widget data if it exists
        const runtimeData = this.widgets.get(widgetId);
        if (runtimeData) {
            runtimeData.tabId = targetTabId;
        }

        // Update DOM if source or target is current tab
        if (sourceTab.id === this.currentTabId || targetTabId === this.currentTabId) {
            // If widget is being moved from current tab, remove its element
            if (sourceTab.id === this.currentTabId && runtimeData) {
                const definition = this.registry.get(widgetData.type);
                if (definition && definition.onRemove) {
                    definition.onRemove(runtimeData.element, widgetData.config);
                }
                this.dragHandler.destroyWidget(runtimeData.element);
                this.resizeHandler.destroyWidget(runtimeData.element);
                runtimeData.element.remove();
                this.widgets.delete(widgetId);
            }

            // If widget is being moved to current tab, render it
            if (targetTabId === this.currentTabId) {
                const definition = this.registry.get(widgetData.type);
                if (definition) {
                    this.renderWidget(widgetData, definition);
                }
            }
        }

        // Trigger auto-save
        this.triggerAutoSave();

        console.log(`[DashboardManager] Moved widget ${widgetId} from ${sourceTab.id} to ${targetTabId} at position (${widgetData.x}, ${widgetData.y})`);
        this.notifyChange('widgetMoved', { widgetId, sourceTabId: sourceTab.id, targetTabId });
    }

    /**
     * Update a widget's configuration
     * @param {string} widgetId - Widget ID
     * @param {Object} updates - Configuration updates
     */
    updateWidget(widgetId, updates) {
        const widgetData = this.widgets.get(widgetId);
        if (!widgetData) {
            console.warn(`[DashboardManager] Widget ${widgetId} not found`);
            return;
        }

        // Update widget config
        Object.assign(widgetData.widget.config, updates);

        // Get widget definition
        const definition = this.registry.get(widgetData.widget.type);

        // Call onConfigChange if defined
        if (definition && definition.onConfigChange) {
            definition.onConfigChange(widgetData.element, widgetData.widget.config);
        }

        // Re-render widget
        this.renderWidgetContent(widgetData.element, widgetData.widget, definition);

        // Trigger auto-save
        this.triggerAutoSave();

        console.log(`[DashboardManager] Updated widget: ${widgetId}`);
        this.notifyChange('widgetUpdated', { widgetId, updates });
    }

    /**
     * Render a single widget
     * @param {Object} widget - Widget data
     * @param {Object} definition - Widget definition
     */
    renderWidget(widget, definition) {
        // Create widget element
        const element = document.createElement('div');
        element.className = 'rpg-widget';
        element.id = `widget-${widget.id}`;
        element.dataset.widgetId = widget.id;
        element.dataset.widgetType = widget.type;

        // Validate widget dimensions (defensive check - shouldn't be needed if onColumnsChange works)
        const validated = this.gridEngine.validateWidget(widget, definition.minSize || { w: 1, h: 1 });

        // Position widget using validated dimensions
        const pos = this.gridEngine.getWidgetPosition(validated);
        element.style.position = 'absolute';
        element.style.left = pos.left;    // % of container (e.g., "5.23%")
        element.style.top = pos.top;      // vh units (e.g., "10.45vh")
        element.style.width = pos.width;  // % of container (e.g., "45.67%")
        element.style.height = pos.height; // vh units (e.g., "20.12vh")

        // Add to grid
        this.gridContainer.appendChild(element);

        // Render widget content
        this.renderWidgetContent(element, widget, definition);

        // Get current tab's widgets for collision detection
        const currentTab = this.tabManager.getTab(this.currentTabId);
        const allWidgets = currentTab ? currentTab.widgets : [];

        // Initialize drag & drop
        this.dragHandler.initWidget(element, widget, (updated, newX, newY) => {
            widget.x = newX;
            widget.y = newY;

            // After drag (which may have triggered reflow), reposition ALL widgets
            // because reflow may have moved other widgets
            this.repositionAllWidgetsInCurrentTab();

            this.triggerAutoSave();
        }, allWidgets);

        // Initialize resize
        this.resizeHandler.initWidget(element, widget, (updated, newW, newH, newX, newY) => {
            widget.w = newW;
            widget.h = newH;
            widget.x = newX;
            widget.y = newY;
            this.repositionWidget(element, widget);

            // Call onResize if defined
            if (definition.onResize) {
                definition.onResize(element, newW, newH);
            }

            this.triggerAutoSave();
        }, {
            minW: definition.minSize.w,
            minH: definition.minSize.h
        }, allWidgets);

        // Add edit mode controls
        if (this.editManager) {
            this.editManager.addWidgetControls(element, widget.id);
        }

        // Store widget data
        this.widgets.set(widget.id, {
            widget,
            element,
            definition,
            tabId: this.currentTabId
        });
    }

    /**
     * Render widget content (called by widget render function)
     * @param {HTMLElement} element - Widget element
     * @param {Object} widget - Widget data
     * @param {Object} definition - Widget definition
     */
    renderWidgetContent(element, widget, definition) {
        console.log(`[DashboardManager] renderWidgetContent called for ${widget.type}`);

        // Clear existing content (except resize handles and controls)
        const handles = element.querySelector('.resize-handles');
        const controls = element.querySelector('.widget-edit-controls');
        element.innerHTML = '';
        if (handles) element.appendChild(handles);
        if (controls) element.appendChild(controls);

        // Call widget render function
        if (definition && definition.render) {
            console.log(`[DashboardManager] Calling render for ${widget.type}`, element);
            // Pass widget dimensions along with config for layout calculations
            definition.render(element, {
                ...widget.config,
                _width: widget.w,
                _height: widget.h
            });
            console.log(`[DashboardManager] After render, element children:`, element.children.length);
        } else {
            console.warn(`[DashboardManager] No render function for ${widget.type}`);
        }

        // Note: Content editing will be disabled in bulk after all widgets are rendered
        // (see onTabChange for global disable pass)
    }

    /**
     * Reposition widget element
     * @param {HTMLElement} element - Widget element
     * @param {Object} widget - Widget data
     */
    repositionWidget(element, widget) {
        const pos = this.gridEngine.getWidgetPosition(widget);
        element.style.left = pos.left;
        element.style.top = pos.top;
        element.style.width = pos.width;
        element.style.height = pos.height;

        // Update overlay positions (resize handles and edit controls) to match new widget position
        this.syncOverlaysForWidget(element, widget.id);
    }

    /**
     * Sync overlay elements (handles and controls) for a specific widget
     * @param {HTMLElement} element - Widget element
     * @param {string} widgetId - Widget ID
     */
    syncOverlaysForWidget(element, widgetId) {
        // Update resize handles position
        if (this.resizeHandler) {
            const handlerData = this.resizeHandler.resizeHandlers.get(element);
            if (handlerData && handlerData.handles) {
                this.resizeHandler.updateHandlePosition(handlerData.handles, element);
            }
        }

        // Update edit controls position
        if (this.editManager && this.editManager.isEditMode) {
            const controlData = this.editManager.widgetControlsMap.get(widgetId);
            if (controlData && controlData.controls) {
                this.editManager.updateControlPosition(controlData.controls, element);
            }
        }
    }

    /**
     * Re-render all widgets (repositions all widgets with current grid calculations)
     */
    renderAllWidgets() {
        this.widgets.forEach((widgetData) => {
            this.repositionWidget(widgetData.element, widgetData.widget);
        });
        console.log('[DashboardManager] Repositioned all widgets');
    }

    /**
     * Reposition all widgets in the current tab
     * Used after drag/drop reflow to update positions of all affected widgets
     */
    repositionAllWidgetsInCurrentTab() {
        const currentTab = this.tabManager.getTab(this.currentTabId);
        if (!currentTab) return;

        // Reposition each widget in the current tab
        currentTab.widgets.forEach((widget) => {
            const widgetData = this.widgets.get(widget.id);
            if (widgetData && widgetData.element) {
                this.repositionWidget(widgetData.element, widget);
            }
        });

        console.log('[DashboardManager] Repositioned all widgets in current tab after reflow');
    }

    /**
     * Estimate total height needed for widgets if laid out
     * Simple estimation: sum all widget heights + gaps
     *
     * @param {Array<Object>} widgets - Widgets to estimate
     * @returns {number} Estimated height in rem
     */
    estimateLayoutHeight(widgets) {
        if (widgets.length === 0) return 0;

        // Sum all heights (widgets are already in rem units)
        const totalHeight = widgets.reduce((sum, w) => sum + w.h, 0);

        // Add gaps (rowHeight + gap between each widget)
        const gaps = (widgets.length - 1) * this.gridEngine.gap;

        return totalHeight * this.gridEngine.rowHeight + gaps;
    }

    /**
     * Distribute widgets across multiple tabs by category
     * Creates category-based tabs: Status, Social, Inventory
     *
     * @param {Array<Object>} widgets - All widgets to distribute
     */
    distributeWidgetsByCategory(widgets) {
        console.log('[DashboardManager] Distributing widgets across multiple tabs');

        // Group widgets by category
        const groups = {
            user: [],
            scene: [],
            social: [],
            inventory: [],
            quests: []
        };

        widgets.forEach(widget => {
            const def = this.registry.get(widget.type);
            const category = def?.category || 'user';
            if (groups[category]) {
                groups[category].push(widget);
            } else {
                groups.user.push(widget); // Fallback to user
            }
        });

        // Clear existing tabs
        this.dashboard.tabs = [];

        // Create Status tab (user widgets ONLY - prioritized)
        if (groups.user.length > 0) {
            this.dashboard.tabs.push({
                id: 'tab-status',
                name: 'Status',
                icon: 'fa-solid fa-user',
                order: 0,
                widgets: groups.user
            });

            // Auto-layout status widgets
            this.gridEngine.autoLayout(groups.user, { preserveOrder: true });
        }

        // Create Scene/Info tab if there are scene widgets (overflow from Status)
        if (groups.scene.length > 0) {
            this.dashboard.tabs.push({
                id: 'tab-scene',
                name: 'Scene',
                icon: 'fa-solid fa-map',
                order: 1,
                widgets: groups.scene
            });

            // Auto-layout scene widgets
            this.gridEngine.autoLayout(groups.scene, { preserveOrder: true });
        }

        // Create Social tab if there are social widgets
        if (groups.social.length > 0) {
            this.dashboard.tabs.push({
                id: 'tab-social',
                name: 'Social',
                icon: 'fa-solid fa-users',
                order: 2,
                widgets: groups.social
            });

            // Auto-layout social widgets
            this.gridEngine.autoLayout(groups.social, { preserveOrder: true });
        }

        // Create Inventory tab if there are inventory widgets
        if (groups.inventory.length > 0) {
            this.dashboard.tabs.push({
                id: 'tab-inventory',
                name: 'Inventory',
                icon: 'fa-solid fa-bag-shopping',
                order: 3,
                widgets: groups.inventory
            });

            // Auto-layout inventory widgets
            this.gridEngine.autoLayout(groups.inventory, { preserveOrder: true });
        }

        // Create Quests tab if there are quest widgets
        if (groups.quests.length > 0) {
            this.dashboard.tabs.push({
                id: 'tab-quests',
                name: 'Quests',
                icon: 'fa-solid fa-scroll',
                order: 4,
                widgets: groups.quests
            });

            // Auto-layout quest widgets
            this.gridEngine.autoLayout(groups.quests, { preserveOrder: true });
        }

        console.log('[DashboardManager] Created', this.dashboard.tabs.length, 'tabs');

        // Re-render tabs and switch to first tab
        this.renderTabs();
        if (this.dashboard.tabs.length > 0) {
            this.switchTab(this.dashboard.tabs[0].id);
        }

        // Save layout
        this.triggerAutoSave();
    }

    /**
     * Sort widgets by category for logical auto-layout
     * Groups: user → scene → social → inventory
     * Within groups, maintains smart ordering (e.g., userInfo before userStats)
     *
     * @param {Array<Object>} widgets - Widgets to sort
     * @returns {Array<Object>} Sorted widgets
     */
    sortWidgetsByCategory(widgets) {
        // Category priority order
        const categoryOrder = {
            'user': 1,
            'scene': 2,
            'social': 3,
            'inventory': 4,
            'quests': 5,
            'other': 6
        };

        // Specific widget type ordering within user category
        const userWidgetOrder = {
            'userInfo': 1,      // Name/level at top-left
            'userMood': 2,      // Mood at top-right (before stats so it sits beside userInfo)
            'userStats': 3,     // Health/energy bars (after mood, goes below userInfo+mood)
            'userAttributes': 4 // STR/DEX/etc
        };

        return [...widgets].sort((a, b) => {
            // Get widget definitions from registry
            const defA = this.registry.get(a.type);
            const defB = this.registry.get(b.type);

            const catA = defA?.category || 'other';
            const catB = defB?.category || 'other';

            // Sort by category first
            const catOrderA = categoryOrder[catA] || 999;
            const catOrderB = categoryOrder[catB] || 999;

            if (catOrderA !== catOrderB) {
                return catOrderA - catOrderB;
            }

            // Within user category, use specific ordering
            if (catA === 'user' && catB === 'user') {
                const orderA = userWidgetOrder[a.type] || 999;
                const orderB = userWidgetOrder[b.type] || 999;
                if (orderA !== orderB) {
                    return orderA - orderB;
                }
            }

            // Otherwise maintain original order
            return 0;
        });
    }

    /**
     * Find available position for new widget
     * @param {Object} size - Widget size { w, h }
     * @returns {Object} Position { x, y }
     */
    findAvailablePosition(size) {
        // Simple algorithm: try to place at top-left, move right, then down
        const tab = this.tabManager.getTab(this.currentTabId);
        const widgets = tab?.widgets || [];
        return this.findAvailablePositionInWidgets(size, widgets);
    }

    /**
     * Find available position for widget in a specific widgets array
     * @param {Object} size - Widget size { w, h }
     * @param {Array<Object>} widgets - Array of existing widgets to check against
     * @returns {Object} Position { x, y }
     */
    findAvailablePositionInWidgets(size, widgets) {
        console.log(`[DashboardManager] Finding available position for ${size.w}x${size.h} widget among ${widgets.length} existing widgets`);

        // Try to place at top-left, move right, then down
        for (let y = 0; y < 20; y++) {
            for (let x = 0; x <= this.gridEngine.columns - size.w; x++) {
                const testWidget = { x, y, w: size.w, h: size.h };

                // Check if position overlaps with any existing widget
                const hasCollision = widgets.some(existingWidget => {
                    const overlapsX = testWidget.x < existingWidget.x + existingWidget.w &&
                                     testWidget.x + testWidget.w > existingWidget.x;
                    const overlapsY = testWidget.y < existingWidget.y + existingWidget.h &&
                                     testWidget.y + testWidget.h > existingWidget.y;
                    return overlapsX && overlapsY;
                });

                if (!hasCollision) {
                    console.log(`[DashboardManager] Found available position: (${x}, ${y})`);
                    return { x, y };
                }
            }
        }

        // Fallback: place at bottom
        const maxY = widgets.length > 0
            ? Math.max(...widgets.map(w => w.y + w.h))
            : 0;
        console.log(`[DashboardManager] No free space found, placing at bottom: (0, ${maxY})`);
        return { x: 0, y: maxY };
    }

    /**
     * Create a new tab
     * @param {string} name - Tab name
     * @returns {string} Tab ID
     */
    createTab(name) {
        const tabId = this.tabManager.createTab(name);
        this.triggerAutoSave();
        return tabId;
    }

    /**
     * Switch to a different tab
     * @param {string} tabId - Tab ID to switch to
     */
    switchTab(tabId) {
        this.tabManager.setActiveTab(tabId);
    }

    /**
     * Handle tab change event
     * @param {string} tabId - New active tab ID
     */
    onTabChange(tabId) {
        console.log(`[DashboardManager] Switching to tab: ${tabId}`);
        this.currentTabId = tabId;

        // Re-render tabs to update active state
        this.renderTabs();

        // Clear grid
        this.clearGrid();

        // Render all widgets in this tab
        const tab = this.tabManager.getTab(tabId);
        console.log(`[DashboardManager] Tab data:`, tab);
        console.log(`[DashboardManager] Tab has ${tab?.widgets?.length || 0} widgets`);

        if (tab && tab.widgets) {
            tab.widgets.forEach(widget => {
                console.log(`[DashboardManager] Rendering widget:`, widget.type, widget.id);
                const definition = this.registry.get(widget.type);
                if (definition) {
                    this.renderWidget(widget, definition);
                } else {
                    console.warn(`[DashboardManager] Widget type "${widget.type}" not found in registry`);
                }
            });
        }

        // Disable content editing once for all widgets if in edit mode
        // (More efficient than per-widget queries - 2 queries vs 2N queries)
        if (this.editManager && this.editManager.isEditMode) {
            this.editManager.disableContentEditing();
        }

        this.notifyChange('tabChanged', { tabId });
    }

    /**
     * Handle tab creation
     */
    onTabCreate(tab) {
        console.log(`[DashboardManager] Tab created: ${tab.id}`);
        this.triggerAutoSave();
    }

    /**
     * Handle tab deletion
     */
    onTabDelete(tabId) {
        console.log(`[DashboardManager] Tab deleted: ${tabId}`);
        this.triggerAutoSave();
    }

    /**
     * Handle tab rename
     */
    onTabRename(tabId, newName) {
        console.log(`[DashboardManager] Tab renamed: ${tabId} -> ${newName}`);
        this.triggerAutoSave();
    }

    /**
     * Handle tab reorder
     */
    onTabReorder(fromIndex, toIndex) {
        console.log(`[DashboardManager] Tabs reordered: ${fromIndex} -> ${toIndex}`);
        this.triggerAutoSave();
    }

    /**
     * Clear all widgets from grid
     */
    clearGrid() {
        // Clean up edit controls overlay first
        if (this.editManager) {
            this.editManager.removeAllControls();
        }

        // Destroy all widgets
        this.widgets.forEach((widgetData, widgetId) => {
            const definition = this.registry.get(widgetData.widget.type);
            if (definition && definition.onRemove) {
                definition.onRemove(widgetData.element, widgetData.widget.config);
            }
            this.dragHandler.destroyWidget(widgetData.element);
            this.resizeHandler.destroyWidget(widgetData.element);
            widgetData.element.remove();
        });

        this.widgets.clear();
    }

    /**
     * Enter edit mode
     */
    enterEditMode() {
        this.editManager.enterEditMode();
    }

    /**
     * Exit edit mode
     * @param {boolean} save - Whether to save changes
     */
    exitEditMode(save = false) {
        this.editManager.exitEditMode(save);
    }

    /**
     * Handle edit mode save
     */
    handleEditSave() {
        console.log('[DashboardManager] Edit mode saved');
        this.triggerAutoSave();
    }

    /**
     * Handle edit mode cancel
     */
    handleEditCancel(originalLayout) {
        console.log('[DashboardManager] Edit mode cancelled');
        // Could restore original layout here if needed
    }

    /**
     * Open widget settings dialog
     * @param {string} widgetId - Widget ID
     */
    openWidgetSettings(widgetId) {
        const widgetData = this.widgets.get(widgetId);
        if (!widgetData) return;

        const definition = this.registry.get(widgetData.widget.type);
        if (definition && definition.getConfig) {
            // Get config schema
            const configSchema = definition.getConfig();
            // TODO: Show config dialog
            console.log('[DashboardManager] Widget settings:', widgetId, configSchema);
        }
    }

    /**
     * Get current dashboard configuration
     * @returns {Object} Dashboard configuration
     */
    getDashboardConfig() {
        const config = {
            version: 2,
            gridConfig: {
                columns: this.config.columns,
                rowHeight: this.config.rowHeight,
                gap: this.config.gap
            },
            tabs: this.tabManager.getTabs().map(tab => ({
                id: tab.id,
                name: tab.name,
                icon: tab.icon,
                order: tab.order,
                widgets: tab.widgets || []
            })),
            defaultTab: this.dashboard.defaultTab
        };
        console.log('[DashboardManager] getDashboardConfig() returning:', {
            rowHeight: config.gridConfig.rowHeight,
            gap: config.gridConfig.gap,
            columns: config.gridConfig.columns
        });
        return config;
    }

    /**
     * Migrate emoji icons to Font Awesome
     * @param {Object} config - Dashboard configuration
     * @returns {Object} Migrated configuration
     */
    migrateEmojiIcons(config) {
        // Map of common emojis to Font Awesome classes
        const emojiToFontAwesome = {
            '📊': 'fa-solid fa-chart-line',
            '🌍': 'fa-solid fa-map',
            '🎒': 'fa-solid fa-bag-shopping',
            '🏠': 'fa-solid fa-house',
            '📄': 'fa-solid fa-file',
            '⚙️': 'fa-solid fa-gear',
            '👤': 'fa-solid fa-user',
            '📝': 'fa-solid fa-note-sticky',
            '🗂️': 'fa-solid fa-folder',
            '📁': 'fa-solid fa-folder-open'
        };

        if (config && config.tabs) {
            config.tabs.forEach(tab => {
                // Check if icon is an emoji (contains emoji characters)
                if (tab.icon && /[\u{1F300}-\u{1F9FF}]/u.test(tab.icon)) {
                    // Convert to Font Awesome if we have a mapping
                    const faIcon = emojiToFontAwesome[tab.icon];
                    if (faIcon) {
                        console.log(`[DashboardManager] Migrating emoji icon "${tab.icon}" → "${faIcon}" for tab "${tab.name}"`);
                        tab.icon = faIcon;
                    } else {
                        // Fallback to generic file icon
                        console.warn(`[DashboardManager] Unknown emoji icon "${tab.icon}", using fa-solid fa-file for tab "${tab.name}"`);
                        tab.icon = 'fa-solid fa-file';
                    }
                }
            });
        }

        return config;
    }

    /**
     * Apply dashboard configuration
     * @param {Object} config - Dashboard configuration
     * @param {Object} options - Optional parameters
     * @param {boolean} options.skipInitialSwitch - Skip switching to first tab (caller will handle)
     */
    applyDashboardConfig(config, options = {}) {
        console.log('[DashboardManager] Applying dashboard config');

        // Migrate emoji icons to Font Awesome
        config = this.migrateEmojiIcons(config);

        // Update grid config from dashboard config
        if (config.gridConfig) {
            this.config.rowHeight = config.gridConfig.rowHeight || this.config.rowHeight;
            this.config.gap = config.gridConfig.gap || this.config.gap;

            // Update gridEngine with new config
            if (this.gridEngine) {
                this.gridEngine.rowHeight = this.config.rowHeight;
                this.gridEngine.gap = this.config.gap;
                console.log('[DashboardManager] Updated grid config:', {
                    rowHeight: this.config.rowHeight + 'rem',
                    gap: this.config.gap + 'rem'
                });
            }
        }

        // Clear existing
        this.clearGrid();

        // Clear tabs directly (we have access to shared dashboard object)
        this.dashboard.tabs = [];

        // Recreate tabs from config (preserve IDs and widgets)
        config.tabs.forEach(tabConfig => {
            this.dashboard.tabs.push({
                id: tabConfig.id,
                name: tabConfig.name,
                icon: tabConfig.icon || 'fa-solid fa-file',
                order: tabConfig.order || 0,
                widgets: tabConfig.widgets || []
            });
        });

        // Update default tab
        if (config.defaultTab) {
            this.dashboard.defaultTab = config.defaultTab;
        } else if (this.dashboard.tabs.length > 0) {
            this.dashboard.defaultTab = this.dashboard.tabs[0].id;
        }

        // Switch to first tab (unless caller will handle it)
        if (!options.skipInitialSwitch && config.tabs.length > 0) {
            this.switchTab(config.tabs[0].id);
        }

        this.notifyChange('configApplied', { config });
    }

    /**
     * Save current layout
     * @param {boolean} immediate - Skip debounce
     */
    async saveLayout(immediate = false) {
        const config = this.getDashboardConfig();
        await this.persistence.saveLayout(config, immediate);
    }

    /**
     * Load saved layout
     */
    async loadLayout() {
        try {
            const saved = await this.persistence.loadLayout();
            if (saved) {
                this.applyDashboardConfig(saved);
            } else if (this.defaultLayout) {
                console.log('[DashboardManager] No saved layout, using default with auto-layout');
                this.applyDashboardConfig(this.defaultLayout);

                // Auto-layout each tab to prevent overlap (default positions may not fit screen)
                this.dashboard.tabs.forEach(tab => {
                    if (tab.widgets && tab.widgets.length > 0) {
                        console.log(`[DashboardManager] Auto-laying out default tab "${tab.name}" (${tab.widgets.length} widgets)`);
                        this.gridEngine.autoLayout(tab.widgets, { preserveOrder: true });
                    }
                });

                // Save the auto-laid-out default as the initial saved layout
                await this.saveLayout(true);
            }
        } catch (error) {
            console.error('[DashboardManager] Failed to load layout:', error);
            if (this.defaultLayout) {
                this.applyDashboardConfig(this.defaultLayout);
            }
        }
    }

    /**
     * Export layout as JSON
     * @param {string} filename - Export filename
     */
    exportLayout(filename = 'dashboard-layout.json') {
        const config = this.getDashboardConfig();
        this.persistence.exportLayout(config, filename);
    }

    /**
     * Import layout from JSON file
     * @param {File} file - JSON file
     */
    async importLayout(file) {
        const config = await this.persistence.importLayout(file);
        this.applyDashboardConfig(config);
        await this.saveLayout(true);
    }

    /**
     * Reset to default layout
     */
    async resetLayout() {
        // Regenerate fresh default layout to ensure all original widgets are restored
        // This ensures deleted widgets come back on reset
        console.log('[DashboardManager] Regenerating fresh default layout...');
        this.defaultLayout = generateDefaultDashboard();

        // Reset previousTrackerConfig for fresh widget detection
        // This ensures the comparison logic works correctly after reset
        this.previousTrackerConfig = null;
        console.log('[DashboardManager] Reset previousTrackerConfig for fresh widget detection');

        if (!this.defaultLayout) {
            console.warn('[DashboardManager] Failed to generate default layout');
            return;
        }

        console.log('[DashboardManager] Resetting to default layout...');
        console.log('[DashboardManager] Default layout has:', this.defaultLayout.tabs.length, 'tabs');
        this.defaultLayout.tabs.forEach(tab => {
            console.log(`[DashboardManager]   Tab "${tab.name}" (${tab.id}):`, tab.widgets.length, 'widgets');
        });

        await this.persistence.resetToDefault(this.defaultLayout);
        // Skip initial switch in applyDashboardConfig since we'll switch after layout calculations
        this.applyDashboardConfig(this.defaultLayout, { skipInitialSwitch: true });

        // Reset all widgets to default sizes
        const allWidgets = [];
        this.dashboard.tabs.forEach(tab => {
            if (tab.widgets && tab.widgets.length > 0) {
                allWidgets.push(...tab.widgets);
            }
        });
        this.resetWidgetSizesToDefault(allWidgets);

        // Auto-layout each tab to prevent overlap (default positions may have changed)
        this.dashboard.tabs.forEach(tab => {
            if (tab.widgets && tab.widgets.length > 0) {
                console.log(`[DashboardManager] Auto-laying out tab "${tab.name}" (${tab.widgets.length} widgets)`);
                this.gridEngine.autoLayout(tab.widgets, { preserveOrder: true });
            }
        });

        // Force re-render tabs
        this.renderTabs();

        // Re-render current tab's widgets
        if (this.currentTabId) {
            this.switchTab(this.currentTabId);
        } else if (this.dashboard.tabs.length > 0) {
            this.switchTab(this.dashboard.tabs[0].id);
        }

        console.log('[DashboardManager] Reset complete with auto-layout');
    }

    /**
     * Set default layout
     * @param {Object} layout - Default layout configuration
     */
    setDefaultLayout(layout) {
        this.defaultLayout = layout;
    }

    /**
     * Reset all widgets to their default sizes
     * @param {Array} widgets - Widgets to reset
     */
    resetWidgetSizesToDefault(widgets) {
        let resetCount = 0;
        widgets.forEach(widget => {
            const definition = this.registry.get(widget.type);
            if (definition && definition.defaultSize) {
                const oldSize = `${widget.w}x${widget.h}`;

                // Support defaultSize as function (column-aware sizing)
                let defaultSize;
                if (typeof definition.defaultSize === 'function') {
                    defaultSize = definition.defaultSize(this.gridEngine.columns);
                } else {
                    defaultSize = definition.defaultSize;
                }

                widget.w = defaultSize.w;
                widget.h = defaultSize.h;
                const newSize = `${widget.w}x${widget.h}`;
                if (oldSize !== newSize) {
                    console.log(`[DashboardManager] Reset ${widget.type} from ${oldSize} to ${newSize}`);
                    resetCount++;
                }
            }
        });
        console.log(`[DashboardManager] Reset ${resetCount} widgets to default sizes`);
    }

    /**
     * Auto-layout widgets on current tab only
     * Sorts and arranges widgets on the current tab to maximize space usage
     *
     * @param {Object} options - Layout options
     * @param {boolean} [options.preserveOrder=true] - Maintain widget order during layout
     * @param {boolean} [options.resetSizes=true] - Reset widgets to default sizes before layout
     */
    autoLayoutCurrentTab(options = {}) {
        console.log('[DashboardManager] Auto-layout current tab requested');

        // Get current tab
        const currentTab = this.tabManager.getTab(this.currentTabId);
        if (!currentTab) {
            console.warn('[DashboardManager] No current tab found');
            return;
        }

        if (!currentTab.widgets || currentTab.widgets.length === 0) {
            console.warn('[DashboardManager] Current tab has no widgets to layout');
            return;
        }

        console.log(`[DashboardManager] Laying out ${currentTab.widgets.length} widgets on tab "${currentTab.name}"`);

        // Reset widget sizes to defaults (unless explicitly disabled)
        if (options.resetSizes !== false) {
            this.resetWidgetSizesToDefault(currentTab.widgets);
        }

        // Sort widgets by category for better organization
        const sortedWidgets = this.sortWidgetsByCategory(currentTab.widgets);

        // Update tab's widgets array with sorted order
        currentTab.widgets = sortedWidgets;

        // Auto-layout widgets on the current tab
        this.gridEngine.autoLayout(currentTab.widgets, {
            preserveOrder: options.preserveOrder !== false
        });

        // Re-render all widgets with new positions
        this.clearGrid();
        currentTab.widgets.forEach(widget => {
            const definition = this.registry.get(widget.type);
            if (definition) {
                this.renderWidget(widget, definition);
            }
        });

        // Save layout
        this.triggerAutoSave();

        console.log('[DashboardManager] Current tab layout complete');
    }

    /**
     * Auto-layout widgets on current tab to efficiently use all available space
     *
     * Sorts and packs widgets to maximize space usage with no gaps.
     * Respects current panel width (responsive column count).
     * Re-renders all widgets after repositioning.
     *
     * @param {Object} options - Layout options
     * @param {boolean} [options.preferFullWidth=true] - Prefer full-width widgets when possible
     * @param {boolean} [options.resetSizes=true] - Reset widgets to default sizes before layout
     */
    autoLayoutWidgets(options = {}) {
        console.log('[DashboardManager] Auto-layout widgets requested');

        // Gather ALL widgets from ALL tabs (don't lose inventory, social, etc.)
        const allWidgets = [];
        this.dashboard.tabs.forEach(tab => {
            if (tab.widgets && tab.widgets.length > 0) {
                console.log(`[DashboardManager] Gathering ${tab.widgets.length} widgets from tab "${tab.name}"`);
                allWidgets.push(...tab.widgets);
            }
        });

        if (allWidgets.length === 0) {
            console.warn('[DashboardManager] No widgets to auto-layout');
            return;
        }

        console.log(`[DashboardManager] Total widgets to layout: ${allWidgets.length}`);

        // Reset widget sizes to defaults (unless explicitly disabled)
        if (options.resetSizes !== false) {
            this.resetWidgetSizesToDefault(allWidgets);
        }

        // Smart category-aware sorting BEFORE auto-layout
        const widgetsToLayout = this.sortWidgetsByCategory(allWidgets);

        // Calculate estimated height to determine if multi-tab distribution is needed
        const estimatedHeight = this.estimateLayoutHeight(widgetsToLayout);
        const heightThreshold = 80; // rem - reasonable max height for single tab

        console.log('[DashboardManager] Estimated height:', estimatedHeight + 'rem', 'Threshold:', heightThreshold + 'rem');

        // Always use multi-tab distribution when we have many widgets
        // This preserves all widgets (inventory, social, etc.)
        console.log('[DashboardManager] Using multi-tab distribution to preserve all widgets');
        this.distributeWidgetsByCategory(widgetsToLayout);

        // distributeWidgetsByCategory handles rendering and tab switching
    }

    /**
     * Trigger auto-save
     */
    triggerAutoSave() {
        const config = this.getDashboardConfig();
        this.persistence.saveLayout(config).catch(err => {
            console.error('[DashboardManager] Auto-save failed:', err);
        });
    }

    /**
     * Register change listener
     * @param {Function} callback - Callback function (event, data) => void
     */
    onChange(callback) {
        this.changeListeners.add(callback);
    }

    /**
     * Unregister change listener
     * @param {Function} callback - Callback to remove
     */
    offChange(callback) {
        this.changeListeners.delete(callback);
    }

    /**
     * Notify change listeners
     * @private
     */
    notifyChange(event, data) {
        this.changeListeners.forEach(callback => {
            try {
                callback(event, data);
            } catch (error) {
                console.error('[DashboardManager] Error in change listener:', error);
            }
        });
    }

    /**
     * Widget-to-tab mapping for smart widget placement
     * Maps widget types to their preferred tab IDs
     */
    static WIDGET_TO_TAB_MAP = {
        'calendar': 'tab-scene',
        'weather': 'tab-scene',
        'temperature': 'tab-scene',
        'clock': 'tab-scene',
        'location': 'tab-scene',
        'recentEvents': 'tab-scene',
        'presentCharacters': 'tab-scene',
        'userStats': 'tab-status',
        'userInfo': 'tab-status',
        'userMood': 'tab-status',
        'userAttributes': 'tab-status',
        'inventory': 'tab-inventory',
        'quests': 'tab-quests'
    };

    /**
     * Detect config changes between old and new tracker configs
     * Identifies fields that transitioned from disabled to enabled
     * @param {Object} oldConfig - Previous tracker configuration
     * @param {Object} newConfig - New tracker configuration
     * @returns {Array<string>} Array of widget types that should be re-added
     */
    detectConfigChanges(oldConfig, newConfig) {
        if (!oldConfig) {
            // First run, no changes to detect
            return [];
        }

        const widgetsToAdd = [];

        // Check infoBox widgets (calendar, weather, temperature, clock, location, recentEvents)
        const infoBoxWidgetMap = {
            'date': 'calendar',
            'weather': 'weather',
            'temperature': 'temperature',
            'time': 'clock',
            'location': 'location',
            'recentEvents': 'recentEvents'
        };

        Object.entries(infoBoxWidgetMap).forEach(([fieldKey, widgetType]) => {
            const wasDisabled = oldConfig.infoBox?.widgets?.[fieldKey]?.enabled === false;
            const isNowEnabled = newConfig.infoBox?.widgets?.[fieldKey]?.enabled !== false;

            if (wasDisabled && isNowEnabled) {
                widgetsToAdd.push(widgetType);
                console.log(`[DashboardManager] Detected re-enabled field: ${fieldKey} → widget: ${widgetType}`);
            }
        });

        // Check userStats widget (enabled when at least one stat is enabled)
        const oldStatsEnabled = oldConfig.userStats?.customStats?.filter(s => s.enabled).length > 0;
        const newStatsEnabled = newConfig.userStats?.customStats?.filter(s => s.enabled).length > 0;

        if (!oldStatsEnabled && newStatsEnabled) {
            widgetsToAdd.push('userStats');
            console.log('[DashboardManager] Detected re-enabled userStats widget');
        }

        // Check userAttributes widget (enabled when RPG Attributes section is enabled AND at least one attribute is enabled)
        const oldAttrsDisabled = oldConfig.userStats?.showRPGAttributes === false ||
            (oldConfig.userStats?.rpgAttributes?.filter(a => a.enabled).length || 0) === 0;
        const newAttrsEnabled = newConfig.userStats?.showRPGAttributes !== false &&
            (newConfig.userStats?.rpgAttributes?.filter(a => a.enabled).length || 0) > 0;

        if (oldAttrsDisabled && newAttrsEnabled) {
            widgetsToAdd.push('userAttributes');
            console.log('[DashboardManager] Detected re-enabled userAttributes widget');
        }

        // Check presentCharacters widget
        const wasThoughtsDisabled = oldConfig.presentCharacters?.thoughts?.enabled === false;
        const isThoughtsEnabled = newConfig.presentCharacters?.thoughts?.enabled !== false;

        if (wasThoughtsDisabled && isThoughtsEnabled) {
            widgetsToAdd.push('presentCharacters');
            console.log('[DashboardManager] Detected re-enabled presentCharacters widget');
        }

        return widgetsToAdd;
    }

    /**
     * Add widgets that were re-enabled in tracker config
     * @param {Array<string>} widgetTypes - Array of widget types to add
     */
    addEnabledWidgets(widgetTypes) {
        if (widgetTypes.length === 0) {
            return;
        }

        console.log(`[DashboardManager] Adding ${widgetTypes.length} re-enabled widgets:`, widgetTypes);

        const addedWidgets = [];

        widgetTypes.forEach(widgetType => {
            // Get widget definition
            const definition = this.registry.get(widgetType);
            if (!definition) {
                console.warn(`[DashboardManager] Widget type "${widgetType}" not found in registry`);
                return;
            }

            // Determine target tab using mapping
            const preferredTabId = DashboardManager.WIDGET_TO_TAB_MAP[widgetType] || 'tab-status';
            const targetTab = this.tabManager.getTab(preferredTabId);

            // Fallback to first tab if preferred tab doesn't exist
            const tab = targetTab || this.dashboard.tabs[0];
            if (!tab) {
                console.warn(`[DashboardManager] No tab available to add widget ${widgetType}`);
                return;
            }

            // Check for duplicates - don't add if widget type already exists in this tab
            const alreadyExists = tab.widgets?.some(w => w.type === widgetType);
            if (alreadyExists) {
                console.log(`[DashboardManager] Widget ${widgetType} already exists in tab ${tab.id}, skipping`);
                return;
            }

            // Generate unique widget ID
            const widgetId = `widget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

            // Find available position in the target tab
            const position = this.findAvailablePositionInWidgets(
                definition.defaultSize,
                tab.widgets || []
            );

            // Create widget data
            const widget = {
                id: widgetId,
                type: widgetType,
                x: position.x,
                y: position.y,
                w: definition.defaultSize.w,
                h: definition.defaultSize.h,
                config: {}
            };

            // Add to tab
            if (!tab.widgets) {
                tab.widgets = [];
            }
            tab.widgets.push(widget);

            console.log(`[DashboardManager] Added widget ${widgetType} (${widgetId}) to tab ${tab.id} at (${position.x}, ${position.y})`);

            addedWidgets.push({
                widgetId,
                widgetType,
                tabId: tab.id
            });
        });

        // Auto-layout affected tabs to optimize positioning
        if (addedWidgets.length > 0) {
            const affectedTabs = new Set(addedWidgets.map(w => w.tabId));
            affectedTabs.forEach(tabId => {
                const tab = this.tabManager.getTab(tabId);
                if (tab && tab.widgets && tab.widgets.length > 0) {
                    console.log(`[DashboardManager] Auto-layouting tab ${tabId} after widget addition`);
                    this.gridEngine.autoLayout(tab.widgets, { preserveOrder: true });
                }
            });
        }

        console.log(`[DashboardManager] Added ${addedWidgets.length} widgets`);
    }

    /**
     * Handle tracker configuration changes from editor
     * Removes disabled widgets and refreshes remaining widgets
     * @param {Object} config - New tracker configuration
     */
    onTrackerConfigChanged(config) {
        console.log('[DashboardManager] Processing tracker config changes...');

        // Step 1: Detect config changes (disabled → enabled)
        const widgetsToAdd = this.detectConfigChanges(this.previousTrackerConfig, config);

        // Step 2: Remove widgets that are now disabled
        const removedWidgets = this.removeDisabledWidgets(config);

        // Step 3: Add widgets that were re-enabled
        this.addEnabledWidgets(widgetsToAdd);

        // Step 4: If widgets were removed or added, auto-layout affected tabs
        const allAffectedTabs = new Set([
            ...removedWidgets.map(w => w.tabId),
            // Note: addEnabledWidgets already handles auto-layout for added widgets
        ]);

        if (removedWidgets.length > 0) {
            allAffectedTabs.forEach(tabId => {
                const tab = this.tabManager.getTab(tabId);
                if (tab && tab.widgets && tab.widgets.length > 0) {
                    console.log(`[DashboardManager] Auto-layouting tab ${tabId} after changes`);
                    this.gridEngine.autoLayout(tab.widgets, { preserveOrder: true });
                }
            });
        }

        // Step 5: Refresh all widgets (re-render with new config)
        // This updates widget content (e.g., renamed stats) without repositioning
        this.refreshAllWidgets();

        // Step 6: If widgets were added to current tab, re-render to show them
        if (widgetsToAdd.length > 0) {
            const currentTab = this.tabManager.getTab(this.currentTabId);
            if (currentTab) {
                // Re-render current tab to show newly added widgets
                this.clearGrid();
                currentTab.widgets.forEach(widget => {
                    const definition = this.registry.get(widget.type);
                    if (definition) {
                        this.renderWidget(widget, definition);
                    }
                });
            }
        }

        // Step 7: Store current config for next comparison
        this.previousTrackerConfig = JSON.parse(JSON.stringify(config)); // Deep clone

        // Step 8: Save layout changes
        this.triggerAutoSave();

        console.log('[DashboardManager] Tracker config refresh complete');
    }

    /**
     * Remove widgets that should no longer be shown based on config
     * @param {Object} config - Tracker configuration
     * @returns {Array} Array of removed widget info {widgetId, tabId, type}
     */
    removeDisabledWidgets(config) {
        const removed = [];

        // Iterate through all tabs
        this.dashboard.tabs.forEach(tab => {
            if (!tab.widgets) return;

            // Find widgets to remove
            const toRemove = tab.widgets.filter(widget =>
                this.shouldWidgetBeRemoved(widget.type, config)
            );

            // Remove each widget
            toRemove.forEach(widget => {
                console.log(`[DashboardManager] Removing disabled widget: ${widget.type} (${widget.id})`);

                // If widget is in current tab and rendered, clean it up
                if (tab.id === this.currentTabId) {
                    const widgetData = this.widgets.get(widget.id);
                    if (widgetData) {
                        const definition = this.registry.get(widget.type);
                        if (definition && definition.onRemove) {
                            definition.onRemove(widgetData.element, widget.config);
                        }
                        this.dragHandler.destroyWidget(widgetData.element);
                        this.resizeHandler.destroyWidget(widgetData.element);
                        widgetData.element.remove();
                        this.widgets.delete(widget.id);
                    }
                }

                removed.push({
                    widgetId: widget.id,
                    tabId: tab.id,
                    type: widget.type
                });
            });

            // Remove from tab's widget array
            tab.widgets = tab.widgets.filter(widget =>
                !toRemove.some(r => r.id === widget.id)
            );
        });

        console.log(`[DashboardManager] Removed ${removed.length} disabled widgets`);
        return removed;
    }

    /**
     * Determine if widget should be removed based on tracker config
     * @param {string} widgetType - Widget type
     * @param {Object} config - Tracker configuration
     * @returns {boolean} True if widget should be removed
     */
    shouldWidgetBeRemoved(widgetType, config) {
        const rules = {
            'calendar': () => config.infoBox?.widgets?.date?.enabled === false,
            'weather': () => config.infoBox?.widgets?.weather?.enabled === false,
            'temperature': () => config.infoBox?.widgets?.temperature?.enabled === false,
            'clock': () => config.infoBox?.widgets?.time?.enabled === false,
            'location': () => config.infoBox?.widgets?.location?.enabled === false,
            'recentEvents': () => config.infoBox?.widgets?.recentEvents?.enabled === false,
            'userStats': () => {
                const customStats = config.userStats?.customStats || [];
                return customStats.filter(s => s.enabled).length === 0;
            },
            'userAttributes': () => {
                // Remove if RPG Attributes section is disabled
                if (config.userStats?.showRPGAttributes === false) {
                    return true;
                }
                // Remove if all attributes are disabled
                const rpgAttrs = config.userStats?.rpgAttributes || [];
                return rpgAttrs.filter(attr => attr.enabled).length === 0;
            },
            'presentCharacters': () => config.presentCharacters?.thoughts?.enabled === false
        };

        const rule = rules[widgetType];
        return rule ? rule() : false;
    }

    /**
     * Refresh all rendered widgets (re-render with current data)
     */
    refreshAllWidgets() {
        console.log('[DashboardManager] Refreshing all widgets...');
        this.widgets.forEach((widgetData) => {
            const definition = this.registry.get(widgetData.widget.type);
            if (definition && widgetData.element) {
                this.renderWidgetContent(widgetData.element, widgetData.widget, definition);
            }
        });
        console.log('[DashboardManager] All widgets refreshed');
    }

    /**
     * Destroy dashboard and cleanup
     */
    destroy() {
        console.log('[DashboardManager] Destroying dashboard');

        // Clear grid
        this.clearGrid();

        // Disconnect ResizeObserver
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }

        // Remove viewport resize listener
        if (this.viewportResizeHandler) {
            window.removeEventListener('resize', this.viewportResizeHandler);
            this.viewportResizeHandler = null;
        }

        // Destroy systems
        if (this.editManager) this.editManager.destroy();
        if (this.dragHandler) this.dragHandler.destroy();
        if (this.persistence) this.persistence.destroy();

        // Clear listeners
        this.changeListeners.clear();

        // Clear container
        this.container.innerHTML = '';
    }
}
