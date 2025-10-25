/**
 * Edit Mode Manager
 *
 * Manages dashboard edit mode state and UI.
 * Handles edit controls, widget library, and layout modifications.
 */

/**
 * @typedef {Object} EditModeConfig
 * @property {HTMLElement} container - Dashboard container element
 * @property {Function} onSave - Callback when saving layout
 * @property {Function} onCancel - Callback when canceling edit
 * @property {Function} onWidgetAdd - Callback when adding widget
 * @property {Function} onWidgetDelete - Callback when deleting widget
 * @property {Function} onWidgetSettings - Callback when opening widget settings
 */

export class EditModeManager {
    /**
     * @param {EditModeConfig} config - Configuration object
     */
    constructor(config) {
        this.container = config.container;
        this.onSave = config.onSave;
        this.onCancel = config.onCancel;
        this.onWidgetAdd = config.onWidgetAdd;
        this.onWidgetDelete = config.onWidgetDelete;
        this.onWidgetSettings = config.onWidgetSettings;

        this.isEditMode = false;
        this.originalLayout = null;
        this.editControls = null;
        this.gridOverlay = null;
        this.widgetLibrary = null;
        this.widgetControlsMap = new Map();

        this.changeListeners = new Set();
    }

    /**
     * Enter edit mode
     */
    enterEditMode() {
        if (this.isEditMode) return;

        this.isEditMode = true;

        // Store original layout for cancel
        this.originalLayout = this.captureLayout();

        // Create edit controls
        this.createEditControls();

        // Show grid overlay
        this.showGridOverlay();

        // Show widget library
        this.showWidgetLibrary();

        // Add edit class to container
        this.container.classList.add('edit-mode');

        this.notifyChange('editModeEntered');
        console.log('[EditModeManager] Entered edit mode');
    }

    /**
     * Exit edit mode
     * @param {boolean} save - Whether to save changes
     */
    exitEditMode(save = false) {
        if (!this.isEditMode) return;

        if (save) {
            // Save changes
            if (this.onSave) {
                this.onSave();
            }
            console.log('[EditModeManager] Saved layout changes');
        } else {
            // Revert to original layout
            if (this.onCancel && this.originalLayout) {
                this.onCancel(this.originalLayout);
            }
            console.log('[EditModeManager] Cancelled edit mode');
        }

        this.isEditMode = false;
        this.originalLayout = null;

        // Remove edit controls
        this.removeEditControls();

        // Hide grid overlay
        this.hideGridOverlay();

        // Hide widget library
        this.hideWidgetLibrary();

        // Remove edit class from container
        this.container.classList.remove('edit-mode');

        this.notifyChange('editModeExited', { saved: save });
    }

    /**
     * Toggle edit mode
     */
    toggleEditMode() {
        if (this.isEditMode) {
            this.confirmCancel(() => this.exitEditMode(false));
        } else {
            this.enterEditMode();
        }
    }

    /**
     * Create edit control buttons
     */
    createEditControls() {
        if (this.editControls) return;

        this.editControls = document.createElement('div');
        this.editControls.className = 'edit-controls';
        this.editControls.style.position = 'absolute';
        this.editControls.style.top = '10px';
        this.editControls.style.right = '10px';
        this.editControls.style.display = 'flex';
        this.editControls.style.gap = '8px';
        this.editControls.style.zIndex = '10000';

        // Save button
        const saveBtn = document.createElement('button');
        saveBtn.className = 'edit-btn edit-btn-save';
        saveBtn.textContent = '💾 Save';
        saveBtn.onclick = () => this.exitEditMode(true);
        this.styleButton(saveBtn, '#4ecca3', '#1a1a2e');

        // Cancel button
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'edit-btn edit-btn-cancel';
        cancelBtn.textContent = '✖ Cancel';
        cancelBtn.onclick = () => this.confirmCancel(() => this.exitEditMode(false));
        this.styleButton(cancelBtn, '#e94560', 'white');

        this.editControls.appendChild(saveBtn);
        this.editControls.appendChild(cancelBtn);

        this.container.appendChild(this.editControls);
    }

    /**
     * Remove edit control buttons
     */
    removeEditControls() {
        if (this.editControls) {
            this.editControls.remove();
            this.editControls = null;
        }
    }

    /**
     * Show grid overlay (now handled via CSS on container)
     */
    showGridOverlay() {
        // Grid overlay is now pure CSS via .rpg-dashboard-grid[data-edit-mode="true"]
        // No DOM manipulation needed
    }

    /**
     * Hide grid overlay (now handled via CSS on container)
     */
    hideGridOverlay() {
        // Grid overlay is now pure CSS via .rpg-dashboard-grid[data-edit-mode="true"]
        // No DOM manipulation needed
    }

    /**
     * Show widget library sidebar
     */
    showWidgetLibrary() {
        if (this.widgetLibrary) return;

        this.widgetLibrary = document.createElement('div');
        this.widgetLibrary.className = 'widget-library';
        this.widgetLibrary.style.position = 'fixed';
        this.widgetLibrary.style.left = '20px';
        this.widgetLibrary.style.top = '50%';
        this.widgetLibrary.style.transform = 'translateY(-50%)';
        this.widgetLibrary.style.background = '#16213e';
        this.widgetLibrary.style.borderRadius = '8px';
        this.widgetLibrary.style.padding = '15px';
        this.widgetLibrary.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
        this.widgetLibrary.style.zIndex = '10001';
        this.widgetLibrary.style.maxWidth = '200px';

        const title = document.createElement('div');
        title.textContent = 'Widget Library';
        title.style.fontSize = '14px';
        title.style.fontWeight = 'bold';
        title.style.marginBottom = '10px';
        title.style.color = '#4ecca3';

        this.widgetLibrary.appendChild(title);

        // Widget types
        const widgetTypes = [
            { type: 'userStats', icon: '📊', name: 'User Stats' },
            { type: 'infoBox', icon: '📝', name: 'Info Box' },
            { type: 'presentCharacters', icon: '👥', name: 'Characters' },
            { type: 'inventory', icon: '🎒', name: 'Inventory' },
            { type: 'notes', icon: '📔', name: 'Notes' },
            { type: 'map', icon: '🗺️', name: 'Map' }
        ];

        widgetTypes.forEach(widget => {
            const item = document.createElement('div');
            item.className = 'widget-library-item';
            item.style.display = 'flex';
            item.style.alignItems = 'center';
            item.style.gap = '8px';
            item.style.padding = '10px';
            item.style.marginBottom = '8px';
            item.style.background = '#0f3460';
            item.style.borderRadius = '6px';
            item.style.cursor = 'pointer';
            item.style.transition = 'all 0.2s';
            item.style.userSelect = 'none';

            item.innerHTML = `
                <span style="font-size: 20px;">${widget.icon}</span>
                <span style="font-size: 12px;">${widget.name}</span>
            `;

            item.onmouseenter = () => {
                item.style.background = '#1a3a5a';
                item.style.transform = 'scale(1.05)';
            };

            item.onmouseleave = () => {
                item.style.background = '#0f3460';
                item.style.transform = 'scale(1)';
            };

            item.onclick = () => {
                if (this.onWidgetAdd) {
                    this.onWidgetAdd(widget.type);
                }
            };

            this.widgetLibrary.appendChild(item);
        });

        document.body.appendChild(this.widgetLibrary);
    }

    /**
     * Hide widget library sidebar
     */
    hideWidgetLibrary() {
        if (this.widgetLibrary) {
            this.widgetLibrary.remove();
            this.widgetLibrary = null;
        }
    }

    /**
     * Add widget controls to a widget element
     * @param {HTMLElement} element - Widget DOM element
     * @param {string} widgetId - Widget ID
     */
    addWidgetControls(element, widgetId) {
        if (this.widgetControlsMap.has(widgetId)) return;

        const controls = document.createElement('div');
        controls.className = 'widget-edit-controls';
        controls.style.position = 'absolute';
        controls.style.top = '4px';
        controls.style.right = '4px';
        controls.style.display = 'flex';
        controls.style.gap = '4px';
        controls.style.zIndex = '100';
        controls.style.opacity = '0';
        controls.style.transition = 'opacity 0.2s';

        // Settings button
        const settingsBtn = this.createControlButton('⚙', 'Settings');
        settingsBtn.onclick = (e) => {
            e.stopPropagation();
            if (this.onWidgetSettings) {
                this.onWidgetSettings(widgetId);
            }
        };

        // Delete button
        const deleteBtn = this.createControlButton('×', 'Delete');
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            this.confirmDeleteWidget(widgetId);
        };
        deleteBtn.style.background = '#e94560';

        controls.appendChild(settingsBtn);
        controls.appendChild(deleteBtn);

        element.appendChild(controls);

        // Show controls on hover
        element.addEventListener('mouseenter', () => {
            if (this.isEditMode) {
                controls.style.opacity = '1';
            }
        });

        element.addEventListener('mouseleave', () => {
            controls.style.opacity = '0';
        });

        this.widgetControlsMap.set(widgetId, controls);
    }

    /**
     * Remove widget controls from a widget element
     * @param {string} widgetId - Widget ID
     */
    removeWidgetControls(widgetId) {
        const controls = this.widgetControlsMap.get(widgetId);
        if (controls) {
            controls.remove();
            this.widgetControlsMap.delete(widgetId);
        }
    }

    /**
     * Create a control button
     * @param {string} icon - Button icon/text
     * @param {string} title - Button title
     * @returns {HTMLElement} Button element
     */
    createControlButton(icon, title) {
        const btn = document.createElement('button');
        btn.className = 'widget-control-btn';
        btn.textContent = icon;
        btn.title = title;
        btn.style.width = '24px';
        btn.style.height = '24px';
        btn.style.padding = '0';
        btn.style.background = '#4ecca3';
        btn.style.color = 'white';
        btn.style.border = 'none';
        btn.style.borderRadius = '4px';
        btn.style.cursor = 'pointer';
        btn.style.fontSize = '16px';
        btn.style.display = 'flex';
        btn.style.alignItems = 'center';
        btn.style.justifyContent = 'center';
        btn.style.transition = 'all 0.2s';

        btn.onmouseenter = () => {
            btn.style.transform = 'scale(1.1)';
            btn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
        };

        btn.onmouseleave = () => {
            btn.style.transform = 'scale(1)';
            btn.style.boxShadow = 'none';
        };

        return btn;
    }

    /**
     * Style a button element
     * @param {HTMLElement} btn - Button element
     * @param {string} bg - Background color
     * @param {string} color - Text color
     */
    styleButton(btn, bg, color) {
        btn.style.background = bg;
        btn.style.color = color;
        btn.style.border = 'none';
        btn.style.padding = '10px 20px';
        btn.style.borderRadius = '6px';
        btn.style.fontSize = '14px';
        btn.style.fontWeight = 'bold';
        btn.style.cursor = 'pointer';
        btn.style.transition = 'all 0.2s';
        btn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';

        btn.onmouseenter = () => {
            btn.style.transform = 'translateY(-2px)';
            btn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
        };

        btn.onmouseleave = () => {
            btn.style.transform = 'translateY(0)';
            btn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
        };
    }

    /**
     * Show confirmation dialog before canceling
     * @param {Function} onConfirm - Callback if confirmed
     */
    confirmCancel(onConfirm) {
        const message = 'You have unsaved changes. Are you sure you want to cancel?';
        if (confirm(message)) {
            onConfirm();
        }
    }

    /**
     * Show confirmation dialog before deleting widget
     * @param {string} widgetId - Widget ID to delete
     */
    confirmDeleteWidget(widgetId) {
        const message = 'Are you sure you want to delete this widget?';
        if (confirm(message)) {
            if (this.onWidgetDelete) {
                this.onWidgetDelete(widgetId);
            }
        }
    }

    /**
     * Show confirmation dialog before resetting layout
     * @param {Function} onConfirm - Callback if confirmed
     */
    confirmReset(onConfirm) {
        const message = 'This will reset the layout to default. Are you sure?';
        if (confirm(message)) {
            onConfirm();
        }
    }

    /**
     * Capture current layout state
     * @returns {Object} Layout snapshot
     */
    captureLayout() {
        // This should capture the current dashboard state
        // Implementation depends on how dashboard state is stored
        return {
            timestamp: Date.now(),
            // Add actual layout data here
        };
    }

    /**
     * Check if currently in edit mode
     * @returns {boolean} True if in edit mode
     */
    getIsEditMode() {
        return this.isEditMode;
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
     * Notify all listeners of a change
     * @private
     */
    notifyChange(event, data) {
        this.changeListeners.forEach(callback => {
            try {
                callback(event, data);
            } catch (error) {
                console.error('[EditModeManager] Error in change listener:', error);
            }
        });
    }

    /**
     * Destroy edit mode manager
     */
    destroy() {
        // Exit edit mode if active
        if (this.isEditMode) {
            this.exitEditMode(false);
        }

        // Remove all widget controls
        for (const widgetId of this.widgetControlsMap.keys()) {
            this.removeWidgetControls(widgetId);
        }

        this.changeListeners.clear();
    }
}
