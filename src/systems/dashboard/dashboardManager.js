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

import { GridEngine } from './gridEngine.js';
import { WidgetRegistry } from './widgetRegistry.js';
import { TabManager } from './tabManager.js';
import { DragDropHandler } from './dragDrop.js';
import { ResizeHandler } from './resizeHandler.js';
import { EditModeManager } from './editModeManager.js';
import { LayoutPersistence } from './layoutPersistence.js';

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
            rowHeight: config.rowHeight || 80,
            gap: config.gap || 12,
            debounceMs: config.debounceMs || 500,
            onSave: config.onSave,
            onLoad: config.onLoad,
            onError: config.onError,
            ...config
        };

        // Dashboard state
        this.currentTabId = null;
        this.widgets = new Map(); // widgetId => { widget data, element, tab }
        this.defaultLayout = null;

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

        // Initialize Grid Engine (columns calculated dynamically)
        this.gridEngine = new GridEngine({
            rowHeight: this.config.rowHeight,
            gap: this.config.gap,
            container: this.gridContainer,
            onColumnsChange: (newCols, oldCols) => {
                console.log('[DashboardManager] Grid columns changed:', oldCols, '→', newCols);
                // Re-render all widgets when column count changes
                this.renderAllWidgets();
            }
        });

        // Initialize Widget Registry (use provided registry or create new one)
        this.registry = this.config.registry || new WidgetRegistry();

        // Initialize Tab Manager with dashboard data structure
        // Create default tab if no tabs exist
        if (this.dashboard.tabs.length === 0) {
            this.dashboard.tabs.push({
                id: 'main',
                name: 'Main',
                icon: '🏠',
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

        // Initialize Drag & Drop
        this.dragHandler = new DragDropHandler(this.gridEngine, {
            showGrid: true,
            enableSnap: true
        });

        // Initialize Resize Handler
        this.resizeHandler = new ResizeHandler(this.gridEngine, {
            minWidth: 1,
            minHeight: 2,
            maxWidth: 4, // Max 4 columns (will be clamped to actual column count)
            maxHeight: 10
        });

        // Initialize Edit Mode Manager
        this.editManager = new EditModeManager({
            container: this.container,
            onSave: () => this.handleEditSave(),
            onCancel: (originalLayout) => this.handleEditCancel(originalLayout),
            onWidgetAdd: (type) => this.addWidget(type),
            onWidgetDelete: (widgetId) => this.removeWidget(widgetId),
            onWidgetSettings: (widgetId) => this.openWidgetSettings(widgetId)
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

        console.log('[DashboardManager] Container structure ready');
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

        // Position widget using grid engine (responsive units for scaling)
        const pos = this.gridEngine.getWidgetPosition(widget);
        element.style.position = 'absolute';
        element.style.left = pos.left;    // % of container (e.g., "5.23%")
        element.style.top = pos.top;      // vh units (e.g., "10.45vh")
        element.style.width = pos.width;  // % of container (e.g., "45.67%")
        element.style.height = pos.height; // vh units (e.g., "20.12vh")

        // Add to grid
        this.gridContainer.appendChild(element);

        // Render widget content
        this.renderWidgetContent(element, widget, definition);

        // Initialize drag & drop
        this.dragHandler.initWidget(element, widget, (updated, newX, newY) => {
            widget.x = newX;
            widget.y = newY;
            this.repositionWidget(element, widget);
            this.triggerAutoSave();
        });

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
        });

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
            definition.render(element, widget.config || {});
            console.log(`[DashboardManager] After render, element children:`, element.children.length);
        } else {
            console.warn(`[DashboardManager] No render function for ${widget.type}`);
        }
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
     * Find available position for new widget
     * @param {Object} size - Widget size { w, h }
     * @returns {Object} Position { x, y }
     */
    findAvailablePosition(size) {
        // Simple algorithm: try to place at top-left, move right, then down
        const tab = this.tabManager.getTab(this.currentTabId);
        const widgets = tab?.widgets || [];

        for (let y = 0; y < 20; y++) {
            for (let x = 0; x <= this.config.columns - size.w; x++) {
                const position = { x, y };
                const testWidget = { ...position, w: size.w, h: size.h };

                // Check if position is free
                const hasCollision = widgets.some(w =>
                    this.gridEngine.detectCollision(testWidget, [w])
                );

                if (!hasCollision) {
                    return position;
                }
            }
        }

        // Fallback: place at bottom
        const maxY = Math.max(...widgets.map(w => w.y + w.h), 0);
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
        return {
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
    }

    /**
     * Apply dashboard configuration
     * @param {Object} config - Dashboard configuration
     */
    applyDashboardConfig(config) {
        console.log('[DashboardManager] Applying dashboard config');

        // Clear existing
        this.clearGrid();

        // Clear tabs directly (we have access to shared dashboard object)
        this.dashboard.tabs = [];

        // Recreate tabs from config (preserve IDs and widgets)
        config.tabs.forEach(tabConfig => {
            this.dashboard.tabs.push({
                id: tabConfig.id,
                name: tabConfig.name,
                icon: tabConfig.icon || '📄',
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

        // Switch to first tab
        if (config.tabs.length > 0) {
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
                console.log('[DashboardManager] No saved layout, using default');
                this.applyDashboardConfig(this.defaultLayout);
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
        if (!this.defaultLayout) {
            console.warn('[DashboardManager] No default layout defined');
            return;
        }

        await this.persistence.resetToDefault(this.defaultLayout);
        this.applyDashboardConfig(this.defaultLayout);
    }

    /**
     * Set default layout
     * @param {Object} layout - Default layout configuration
     */
    setDefaultLayout(layout) {
        this.defaultLayout = layout;
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
     */
    autoLayoutWidgets(options = {}) {
        console.log('[DashboardManager] Auto-layout widgets requested');

        // Get current tab
        const currentTab = this.tabManager.getTab(this.currentTabId);
        if (!currentTab || !currentTab.widgets || currentTab.widgets.length === 0) {
            console.warn('[DashboardManager] No widgets to auto-layout');
            return;
        }

        // Run auto-layout algorithm on widgets
        const widgetsToLayout = [...currentTab.widgets];
        this.gridEngine.autoLayout(widgetsToLayout, options);

        // Update tab widgets with new positions
        currentTab.widgets = widgetsToLayout;

        // Re-render all widgets with new positions
        this.clearGrid();
        widgetsToLayout.forEach(widget => {
            const definition = this.registry.get(widget.type);
            if (definition) {
                this.renderWidget(widget, definition);
            }
        });

        console.log('[DashboardManager] Auto-layout complete, re-rendered widgets');

        // Save changes
        this.triggerAutoSave();
        this.notifyChange('autoLayoutApplied', { tabId: this.currentTabId });
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
