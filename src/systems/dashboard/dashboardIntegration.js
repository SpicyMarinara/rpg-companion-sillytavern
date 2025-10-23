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

// Widget imports
import { registerUserInfoWidget } from './widgets/userInfoWidget.js';
import { registerUserStatsWidget } from './widgets/userStatsWidget.js';
import { registerUserMoodWidget } from './widgets/userMoodWidget.js';
import { registerUserAttributesWidget } from './widgets/userAttributesWidget.js';
import { registerCalendarWidget, registerWeatherWidget, registerTemperatureWidget, registerClockWidget, registerLocationWidget } from './widgets/infoBoxWidgets.js';
import { registerPresentCharactersWidget } from './widgets/presentCharactersWidget.js';
import { registerInventoryWidget } from './widgets/inventoryWidget.js';

// Global dashboard manager instance
let dashboardManager = null;

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

        // Set up dashboard event listeners
        setupDashboardEventListeners(dependencies);

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

    // Social widgets
    registerPresentCharactersWidget(registry, dependencies);

    // Inventory widget
    registerInventoryWidget(registry, dependencies);

    console.log(`[RPG Companion] Registered ${registry.getAll().length} widgets`);
}

/**
 * Set up dashboard event listeners
 */
function setupDashboardEventListeners(dependencies) {
    // Reset layout button
    const resetLayoutBtn = document.querySelector('#rpg-dashboard-reset-layout');
    if (resetLayoutBtn) {
        resetLayoutBtn.addEventListener('click', () => {
            if (dashboardManager) {
                if (confirm('Reset dashboard to default layout? This will remove all widgets and reload the defaults.')) {
                    console.log('[RPG Companion] Reset layout button clicked');
                    dashboardManager.resetLayout();
                }
            }
        });
    }

    // Auto-layout button
    const autoLayoutBtn = document.querySelector('#rpg-dashboard-auto-layout');
    if (autoLayoutBtn) {
        autoLayoutBtn.addEventListener('click', () => {
            if (dashboardManager) {
                console.log('[RPG Companion] Auto-layout button clicked');
                dashboardManager.autoLayoutWidgets();
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
            }
        });
    }

    // Add widget button
    const addWidgetBtn = document.querySelector('#rpg-dashboard-add-widget');
    if (addWidgetBtn) {
        addWidgetBtn.addEventListener('click', () => {
            if (dashboardManager) {
                showAddWidgetDialog(dashboardManager);
            }
        });
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

    // Import layout button
    const importBtn = document.querySelector('#rpg-dashboard-import-layout');
    const importFile = document.querySelector('#rpg-dashboard-import-file');

    if (importBtn && importFile) {
        importBtn.addEventListener('click', () => {
            importFile.click();
        });

        importFile.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file && dashboardManager) {
                dashboardManager.importLayout(file);
                importFile.value = ''; // Reset file input
            }
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
    const widgetCardsHtml = widgets.map(([type, definition]) => `
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

    const widgetSelector = modal.querySelector('#rpg-widget-selector');
    if (widgetSelector) {
        widgetSelector.innerHTML = widgetCardsHtml;

        // Attach add button handlers
        widgetSelector.querySelectorAll('.rpg-widget-card-add').forEach(btn => {
            btn.addEventListener('click', () => {
                const widgetType = btn.dataset.widgetType;
                const activeTab = manager.tabManager.getActiveTabId();

                manager.addWidget(widgetType, activeTab);
                hideModal('rpg-add-widget-modal');
            });
        });
    }

    modal.style.display = 'flex';

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

    const mainTab = manager.tabManager.getActiveTabId();

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
    if (dashboardManager) {
        // Get all active widgets and re-render them
        const widgets = dashboardManager.getAllWidgets();
        widgets.forEach(widget => {
            dashboardManager.renderWidget(widget.id);
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
