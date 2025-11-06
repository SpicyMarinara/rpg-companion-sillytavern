/**
 * Dashboard Integration Module
 *
 * Handles initialization and integration of the v2 dashboard system
 * with the main RPG Companion extension.
 */

import { extensionName } from '../../core/config.js';
import { extensionSettings } from '../../core/state.js';
import { saveSettings } from '../../core/persistence.js';
import { renderExtensionTemplateAsync } from '../../../../../../extensions.js';
import { DashboardManager } from './dashboardManager.js';
import { WidgetRegistry } from './widgetRegistry.js';
import { generateDefaultDashboard } from './defaultLayout.js';
import { TabScrollManager } from './tabScrollManager.js';
import { HeaderOverflowManager } from './headerOverflowManager.js';
import { TabContextMenu } from './tabContextMenu.js';
import { showConfirmDialog } from './confirmDialog.js';

// Widget imports
import { registerUserInfoWidget } from './widgets/userInfoWidget.js';
import { registerUserStatsWidget } from './widgets/userStatsWidget.js';
import { registerUserMoodWidget } from './widgets/userMoodWidget.js';
import { registerUserAttributesWidget } from './widgets/userAttributesWidget.js';
import { registerCalendarWidget, registerWeatherWidget, registerTemperatureWidget, registerClockWidget, registerLocationWidget, registerRecentEventsWidget } from './widgets/infoBoxWidgets.js';
import { registerSceneInfoWidget } from './widgets/sceneInfoWidget.js';
import { registerPresentCharactersWidget } from './widgets/presentCharactersWidget.js';
import { registerInventoryWidget } from './widgets/inventoryWidget.js';
import { registerQuestsWidget } from './widgets/questsWidget.js';

// Global dashboard manager instance
let dashboardManager = null;
let tabScrollManager = null;
let headerOverflowManager = null;
let tabContextMenu = null;

/**
 * Get the dashboard manager instance
 */
export function getDashboardManager() {
    return dashboardManager;
}

/**
 * Initialize the dashboard system
 * @param {Object} dependencies - Dependencies from main extension
 */
export async function initializeDashboard(dependencies) {
    console.log('[RPG Companion] Initializing Dashboard v2 System...');

    try {
        // Load dashboard template
        const dashboardHtml = await loadDashboardTemplate();

        // Find or create dashboard container in the panel
        const panelContent = document.querySelector('#rpg-panel-content');
        if (!panelContent) {
            console.error('[RPG Companion] Panel content container not found');
            return null;
        }

        // Insert dashboard HTML (replacing old content-box)
        const contentBox = panelContent.querySelector('.rpg-content-box');
        if (contentBox) {
            // Replace old content-box with dashboard
            contentBox.replaceWith(createDashboardContainer(dashboardHtml));
        } else {
            // If no content-box, insert dashboard after dice display
            const diceDisplay = panelContent.querySelector('#rpg-dice-display');
            if (diceDisplay) {
                diceDisplay.insertAdjacentHTML('afterend', dashboardHtml);
            } else {
                panelContent.insertAdjacentHTML('afterbegin', dashboardHtml);
            }
        }

        // Create widget registry
        const registry = new WidgetRegistry();

        // Register all widgets
        registerAllWidgets(registry, dependencies);

        // Initialize dashboard manager
        const container = document.querySelector('#rpg-dashboard-container');
        if (!container) {
            console.error('[RPG Companion] Dashboard container not found after template load');
            return null;
        }

        dashboardManager = new DashboardManager(container, {
            registry,
            autoSave: true,
            onChange: (data) => {
                // Handle dashboard changes
                console.log('[RPG Companion] Dashboard changed:', data);
                if (dependencies.onDashboardChange) {
                    dependencies.onDashboardChange(data);
                }
            }
        });

        // Initialize the dashboard
        await dashboardManager.init();

        // Set default layout (required for reset functionality)
        const defaultLayout = generateDefaultDashboard();
        dashboardManager.setDefaultLayout(defaultLayout);
        console.log('[RPG Companion] Default layout set with', defaultLayout.tabs.length, 'tabs');

        // Initialize previousTrackerConfig to enable widget detection on first load
        // Without this, detectConfigChanges() returns [] because oldConfig is null
        const settings = dependencies.getExtensionSettings();
        if (settings?.trackerConfig && dashboardManager) {
            dashboardManager.previousTrackerConfig = JSON.parse(JSON.stringify(settings.trackerConfig));
            console.log('[RPG Companion] Initialized previousTrackerConfig for widget detection');
        }

        // Set up dashboard event listeners
        setupDashboardEventListeners(dependencies);

        // Initialize tab scroll manager
        const tabsContainer = document.querySelector('#rpg-dashboard-tabs');
        if (tabsContainer) {
            tabScrollManager = new TabScrollManager(tabsContainer);
            tabScrollManager.init();
        }

        // Initialize tab context menu
        if (tabsContainer && dashboardManager?.tabManager) {
            tabContextMenu = new TabContextMenu({
                tabManager: dashboardManager.tabManager,
                onTabChange: (event, data) => {
                    console.log('[RPG Companion] Tab context menu event:', event, data);
                    // Re-render tabs after tab operations
                    dashboardManager.renderTabs();
                    // Save dashboard state
                    if (dashboardManager.autoSave) {
                        saveSettings();
                    }
                }
            });
            tabContextMenu.init(tabsContainer);
        }

        // Initialize header overflow manager
        const headerRight = document.querySelector('#rpg-dashboard-header-right');
        if (headerRight) {
            headerOverflowManager = new HeaderOverflowManager(headerRight);
            headerOverflowManager.init();

            // Wire up editModeManager for menu filtering
            if (dashboardManager?.editManager) {
                headerOverflowManager.setEditModeManager(dashboardManager.editManager);
            }
        }

        console.log('[RPG Companion] Dashboard v2 initialized successfully');
        return dashboardManager;

    } catch (error) {
        console.error('[RPG Companion] Failed to initialize dashboard:', error);
        return null;
    }
}

/**
 * Load dashboard template HTML
 */
async function loadDashboardTemplate() {
    try {
        // Try to load from dashboardTemplate.html
        const html = await renderExtensionTemplateAsync(extensionName, 'src/systems/dashboard/dashboardTemplate');
        return html;
    } catch (error) {
        console.warn('[RPG Companion] Could not load dashboard template, using inline HTML');
        // Fallback to inline template
        return getInlineDashboardTemplate();
    }
}

/**
 * Create dashboard container div
 */
function createDashboardContainer(dashboardHtml) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = dashboardHtml;
    return wrapper.firstElementChild;
}

/**
 * Get inline dashboard template (fallback)
 */
function getInlineDashboardTemplate() {
    return `
        <div id="rpg-dashboard-container" class="rpg-dashboard-container">
            <div class="rpg-dashboard-header">
                <div class="rpg-dashboard-header-left">
                    <div id="rpg-dashboard-tabs" class="rpg-dashboard-tabs"></div>
                </div>
                <div class="rpg-dashboard-header-right">
                    <button id="rpg-dashboard-reset-layout" class="rpg-dashboard-btn rpg-reset-layout-btn" title="Reset to Default Layout">
                        <i class="fa-solid fa-rotate-left"></i>
                    </button>
                    <button id="rpg-dashboard-auto-layout" class="rpg-dashboard-btn rpg-auto-layout-btn" title="Auto-Arrange Widgets">
                        <i class="fa-solid fa-table-cells-large"></i>
                    </button>
                    <button id="rpg-dashboard-edit-mode" class="rpg-dashboard-btn rpg-edit-mode-btn" title="Toggle Edit Mode">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button id="rpg-dashboard-add-widget" class="rpg-dashboard-btn rpg-add-widget-btn" style="display: none;" title="Add Widget">
                        <i class="fa-solid fa-plus"></i>
                    </button>
                    <button id="rpg-dashboard-export-layout" class="rpg-dashboard-btn rpg-export-btn" style="display: none;" title="Export Layout">
                        <i class="fa-solid fa-download"></i>
                    </button>
                    <button id="rpg-dashboard-import-layout" class="rpg-dashboard-btn rpg-import-btn" style="display: none;" title="Import Layout">
                        <i class="fa-solid fa-upload"></i>
                    </button>
                    <input type="file" id="rpg-dashboard-import-file" accept=".json" style="display: none;" />
                </div>
            </div>
            <div id="rpg-dashboard-grid" class="rpg-dashboard-grid" data-edit-mode="false"></div>
        </div>
    `;
}

/**
 * Register all available widgets
 */
function registerAllWidgets(registry, dependencies) {
    console.log('[RPG Companion] Registering widgets...');

    // User modular widgets
    registerUserInfoWidget(registry, dependencies);
    registerUserStatsWidget(registry, dependencies);
    registerUserMoodWidget(registry, dependencies);
    registerUserAttributesWidget(registry, dependencies);

    // Scene info widgets
    registerCalendarWidget(registry, dependencies);
    registerWeatherWidget(registry, dependencies);
    registerTemperatureWidget(registry, dependencies);
    registerClockWidget(registry, dependencies);
    registerLocationWidget(registry, dependencies);
    registerRecentEventsWidget(registry, dependencies);
    registerSceneInfoWidget(registry, dependencies); // Combined multi-view widget

    // Social widgets
    registerPresentCharactersWidget(registry, dependencies);

    // Inventory widget
    registerInventoryWidget(registry, dependencies);

    // Quest widget
    registerQuestsWidget(registry, dependencies);

    console.log(`[RPG Companion] Registered ${registry.getAll().length} widgets`);
}

/**
 * Set up dashboard event listeners
 */
function setupDashboardEventListeners(dependencies) {
    // Reset layout button
    const resetLayoutBtn = document.querySelector('#rpg-dashboard-reset-layout');
    if (resetLayoutBtn) {
        resetLayoutBtn.addEventListener('click', async () => {
            if (dashboardManager) {
                const confirmed = await showConfirmDialog({
                    title: 'Reset Layout?',
                    message: 'This will remove all widgets and reload the default layout. This action cannot be undone.',
                    variant: 'danger',
                    confirmText: 'Reset',
                    cancelText: 'Cancel'
                });

                if (confirmed) {
                    console.log('[RPG Companion] Reset layout button clicked');
                    dashboardManager.resetLayout();
                }
            }
        });
    }

    // Auto-layout button
    const autoLayoutBtn = document.querySelector('#rpg-dashboard-auto-layout');
    if (autoLayoutBtn) {
        autoLayoutBtn.addEventListener('click', async () => {
            if (dashboardManager) {
                const confirmed = await showConfirmDialog({
                    title: 'Auto-Arrange All Widgets?',
                    message: 'This will reorganize all widgets across all tabs and may change their positions. This action cannot be undone.',
                    variant: 'warning',
                    confirmText: 'Auto-Arrange',
                    cancelText: 'Cancel'
                });

                if (confirmed) {
                    dashboardManager.autoLayoutWidgets();
                }
            }
        });
    }

    // Sort Tab button (layout current tab only)
    const sortTabBtn = document.querySelector('#rpg-dashboard-sort-tab');
    if (sortTabBtn) {
        sortTabBtn.addEventListener('click', () => {
            if (dashboardManager) {
                console.log('[RPG Companion] Sort tab button clicked');
                dashboardManager.autoLayoutCurrentTab();
            }
        });
    }

    // Edit mode toggle
    const editModeBtn = document.querySelector('#rpg-dashboard-edit-mode');
    if (editModeBtn) {
        editModeBtn.addEventListener('click', () => {
            if (dashboardManager && dashboardManager.editManager) {
                console.log('[RPG Companion] Edit button clicked');
                dashboardManager.editManager.toggleEditMode();
                // Refresh header overflow menu to reflect edit mode button visibility changes
                if (headerOverflowManager) {
                    setTimeout(() => headerOverflowManager.refresh(), 50);
                }
            }
        });
    }

    // Lock/unlock widgets button
    const lockWidgetsBtn = document.querySelector('#rpg-dashboard-lock-widgets');
    if (lockWidgetsBtn) {
        lockWidgetsBtn.addEventListener('click', () => {
            if (dashboardManager && dashboardManager.editManager) {
                console.log('[RPG Companion] Lock button clicked');
                dashboardManager.editManager.toggleLock();
            }
        });
    }

    // Tracker Settings button (open tracker editor modal)
    const trackerSettingsBtn = document.querySelector('#rpg-dashboard-tracker-settings');
    if (trackerSettingsBtn) {
        trackerSettingsBtn.addEventListener('click', () => {
            console.log('[RPG Companion] Tracker Settings button clicked');
            // Trigger the tracker editor button from main UI
            const trackerEditorBtn = document.getElementById('rpg-open-tracker-editor');
            if (trackerEditorBtn) {
                trackerEditorBtn.click();
            } else {
                console.warn('[RPG Companion] Tracker editor button not found');
            }
        });
    }

    // Done button (exit edit mode)
    const doneBtn = document.querySelector('#rpg-dashboard-done-edit');
    if (doneBtn) {
        doneBtn.addEventListener('click', () => {
            if (dashboardManager && dashboardManager.editManager) {
                console.log('[RPG Companion] Done button clicked');
                dashboardManager.editManager.exitEditMode(true); // Save changes
                // Refresh header overflow menu to reflect edit mode button visibility changes
                if (headerOverflowManager) {
                    setTimeout(() => headerOverflowManager.refresh(), 50);
                }
            }
        });
    }

    // Add widget button - supports both desktop click and mobile touch
    const addWidgetBtn = document.querySelector('#rpg-dashboard-add-widget');
    if (addWidgetBtn) {
        // Use pointerdown for universal desktop/mobile support
        const openAddWidget = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (dashboardManager) {
                showAddWidgetDialog(dashboardManager);
            }
        };

        // Listen to both click (desktop) and pointerdown (mobile) for maximum compatibility
        addWidgetBtn.addEventListener('click', openAddWidget);
        addWidgetBtn.addEventListener('pointerdown', openAddWidget, { once: true });
    }

    // Export layout button
    const exportBtn = document.querySelector('#rpg-dashboard-export-layout');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            if (dashboardManager) {
                dashboardManager.exportLayout();
            }
        });
    }

    // Import layout button - trigger file input on click
    const importBtn = document.querySelector('#rpg-dashboard-import-layout');
    const importFile = document.querySelector('#rpg-dashboard-import-file');

    if (importBtn && importFile) {
        console.log('[RPG Companion] Import button and file input initialized');

        // Trigger file picker on button click
        importBtn.addEventListener('click', (e) => {
            console.log('[RPG Companion] Import button clicked, triggering file picker');
            console.log('[RPG Companion] File input element:', importFile);
            console.log('[RPG Companion] File input visible:', importFile.offsetParent !== null);

            try {
                // Direct click works on desktop and mobile when input is properly positioned
                importFile.click();
                console.log('[RPG Companion] File input click() called successfully');
            } catch (err) {
                console.error('[RPG Companion] Error triggering file input:', err);
            }
        });

        // Handle file selection
        importFile.addEventListener('change', (e) => {
            const file = e.target.files[0];
            console.log('[RPG Companion] File input change event fired');
            console.log('[RPG Companion] Selected file:', file);

            if (file) {
                if (dashboardManager) {
                    console.log('[RPG Companion] Importing layout from:', file.name);
                    dashboardManager.importLayout(file);
                } else {
                    console.error('[RPG Companion] Dashboard manager not available');
                }
                importFile.value = ''; // Reset file input
            } else {
                console.warn('[RPG Companion] No file selected');
            }
        });
    } else {
        console.error('[RPG Companion] Import button or file input not found!', {
            importBtn,
            importFile
        });
    }
}

/**
 * Show add widget dialog
 */
function showAddWidgetDialog(manager) {
    // Get all available widgets
    const registry = manager.registry;
    const widgets = registry.getAll();

    // Create widget cards HTML
    // Note: registry.getAll() returns [{type, definition}, ...] not [[type, definition], ...]
    const widgetCardsHtml = widgets.map(({type, definition}) => `
        <div class="rpg-widget-card" data-widget-type="${type}">
            <div class="rpg-widget-card-icon">${definition.icon}</div>
            <div class="rpg-widget-card-name">${definition.name}</div>
            <div class="rpg-widget-card-description">${definition.description}</div>
            <button class="rpg-widget-card-add" data-widget-type="${type}">
                <i class="fa-solid fa-plus"></i> Add
            </button>
        </div>
    `).join('');

    // Show modal
    const modal = document.querySelector('#rpg-add-widget-modal');
    if (!modal) {
        console.warn('[RPG Companion] Add widget modal not found');
        return;
    }

    // CRITICAL: Move modal to document.body on first use to escape panel constraints
    // The panel has transform in its transition which creates a containing block,
    // constraining position:fixed children to the panel instead of viewport
    if (modal.parentElement?.id !== 'document-body-modals') {
        // Create container for modals at body level (only once)
        let bodyModalsContainer = document.getElementById('document-body-modals');
        if (!bodyModalsContainer) {
            bodyModalsContainer = document.createElement('div');
            bodyModalsContainer.id = 'document-body-modals';
            bodyModalsContainer.style.cssText = 'position: fixed; inset: 0; pointer-events: none; z-index: 10000; display: flex; align-items: center; justify-content: center;';
            document.body.appendChild(bodyModalsContainer);
        }
        bodyModalsContainer.appendChild(modal);
        console.log('[RPG Companion] Moved Add Widget modal to document.body for proper viewport positioning');

        // Apply theme-aware solid background since modal is now outside panel
        const panel = document.querySelector('.rpg-panel');
        const modalContent = modal.querySelector('.rpg-modal-content');
        if (modalContent) {
            if (panel && panel.dataset.theme) {
                modalContent.dataset.theme = panel.dataset.theme;
            } else if (panel) {
                // For default theme: read computed colors from panel and apply as solid (1.0 opacity)
                const computedStyle = window.getComputedStyle(panel);
                const bgColor = computedStyle.getPropertyValue('--rpg-bg').trim();
                const accentColor = computedStyle.getPropertyValue('--rpg-accent').trim();

                // Convert rgba with 0.9 opacity to 1.0 opacity
                const solidBg = bgColor.replace(/rgba\(([^)]+),\s*[\d.]+\)/, 'rgba($1, 1)');
                const solidAccent = accentColor.replace(/rgba\(([^)]+),\s*[\d.]+\)/, 'rgba($1, 1)');

                modalContent.style.background = `linear-gradient(135deg, ${solidAccent} 0%, ${solidBg} 100%)`;
                modalContent.style.opacity = '1';
            }
        }
    }

    const widgetSelector = modal.querySelector('#rpg-widget-selector');
    if (widgetSelector) {
        widgetSelector.innerHTML = widgetCardsHtml;

        // Attach add button handlers
        widgetSelector.querySelectorAll('.rpg-widget-card-add').forEach(btn => {
            btn.addEventListener('click', () => {
                const widgetType = btn.dataset.widgetType;
                // Use activeTabId property instead of getActiveTabId() method
                const activeTab = manager.tabManager.activeTabId;

                manager.addWidget(widgetType, activeTab);
                hideModal('rpg-add-widget-modal');
            });
        });
    }

    // Show modal with proper pointer events (parent has pointer-events: none)
    modal.style.display = 'flex';
    modal.style.pointerEvents = 'auto';

    // Set up modal close handlers
    modal.querySelectorAll('[data-close="add-widget"]').forEach(btn => {
        btn.onclick = () => hideModal('rpg-add-widget-modal');
    });

    // Close on backdrop click
    modal.onclick = (e) => {
        if (e.target === modal) {
            hideModal('rpg-add-widget-modal');
        }
    };
}

/**
 * Hide modal by ID
 */
function hideModal(modalId) {
    const modal = document.querySelector(`#${modalId}`);
    if (modal) {
        modal.style.display = 'none';
    }
}

/**
 * Create default dashboard layout
 */
export function createDefaultLayout(manager) {
    if (!manager) {
        console.warn('[RPG Companion] Cannot create default layout - manager not initialized');
        return;
    }

    console.log('[RPG Companion] Creating default dashboard layout with modular widgets...');

    // Use activeTabId property instead of getActiveTabId() method
    const mainTab = manager.tabManager.activeTabId;

    // Add modular user widgets
    // Row 0: User Info (avatar, name, level) - full width
    manager.addWidget('userInfo', mainTab, { x: 0, y: 0, w: 2, h: 1 });

    // Row 1-2: User Stats (health/energy bars) - full width
    manager.addWidget('userStats', mainTab, { x: 0, y: 1, w: 2, h: 2 });

    // Row 3-4: User Mood (left) + User Attributes (right)
    manager.addWidget('userMood', mainTab, { x: 0, y: 3, w: 1, h: 1 });
    manager.addWidget('userAttributes', mainTab, { x: 1, y: 3, w: 1, h: 2 });

    // Row 5-6: Calendar (left) + Weather (right)
    manager.addWidget('calendar', mainTab, { x: 0, y: 5, w: 1, h: 2 });
    manager.addWidget('weather', mainTab, { x: 1, y: 5, w: 1, h: 2 });

    // Row 7-8: Temperature (left) + Clock (right)
    manager.addWidget('temperature', mainTab, { x: 0, y: 7, w: 1, h: 2 });
    manager.addWidget('clock', mainTab, { x: 1, y: 7, w: 1, h: 2 });

    // Row 9-10: Location (full width)
    manager.addWidget('location', mainTab, { x: 0, y: 9, w: 2, h: 2 });

    // Row 11-13: Present Characters (full width)
    manager.addWidget('presentCharacters', mainTab, { x: 0, y: 11, w: 2, h: 3 });

    console.log('[RPG Companion] Default layout created with modular widgets');
}

/**
 * Refresh all widgets (called after data updates)
 */
export function refreshDashboard() {
    if (dashboardManager && dashboardManager.widgets) {
        // Re-render all active widgets by accessing the widgets Map directly
        dashboardManager.widgets.forEach((widgetData, widgetId) => {
            // Get the widget definition from registry
            const definition = dashboardManager.registry.get(widgetData.widget.type);
            if (definition && widgetData.element) {
                // Re-render the widget content
                dashboardManager.renderWidgetContent(widgetData.element, widgetData.widget, definition);
            }
        });
    }
}

/**
 * Destroy dashboard instance
 */
export function destroyDashboard() {
    if (dashboardManager) {
        console.log('[RPG Companion] Destroying dashboard...');
        // Clean up would go here
        dashboardManager = null;
    }
}
