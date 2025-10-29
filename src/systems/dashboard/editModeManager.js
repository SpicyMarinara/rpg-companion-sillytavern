/**
 * Edit Mode Manager
 *
 * Manages dashboard edit mode state and UI.
 * Handles edit controls, widget library, and layout modifications.
 */

import { showConfirmDialog } from './confirmDialog.js';

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
        this.editControlsOverlay = config.editControlsOverlay || null; // Overlay container for edit controls
        this.onSave = config.onSave;
        this.onCancel = config.onCancel;
        this.onWidgetAdd = config.onWidgetAdd;
        this.onWidgetDelete = config.onWidgetDelete;
        this.onWidgetSettings = config.onWidgetSettings;

        this.isEditMode = false;
        this.isLocked = true; // Start locked to prevent accidental widget moves
        this.originalLayout = null;
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

        // Hide edit mode button, show done button and edit mode controls
        const editModeBtn = document.querySelector('#rpg-dashboard-edit-mode');
        const doneBtn = document.querySelector('#rpg-dashboard-done-edit');
        const addWidgetBtn = document.querySelector('#rpg-dashboard-add-widget');
        const exportBtn = document.querySelector('#rpg-dashboard-export-layout');
        const importBtn = document.querySelector('#rpg-dashboard-import-layout');

        if (editModeBtn) editModeBtn.style.display = 'none';
        if (doneBtn) doneBtn.style.display = '';
        if (addWidgetBtn) addWidgetBtn.style.display = '';
        if (exportBtn) exportBtn.style.display = '';
        if (importBtn) importBtn.style.display = '';

        // Disable content editing to prevent keyboard from messing up layout
        this.disableContentEditing();

        // Add edit class to container
        this.container.classList.add('edit-mode');

        // Add controls to all currently rendered widgets
        this.syncAllControls();

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

        // Re-enable content editing
        this.enableContentEditing();

        // Show edit mode button, hide done button and edit controls
        const editModeBtn = document.querySelector('#rpg-dashboard-edit-mode');
        const doneBtn = document.querySelector('#rpg-dashboard-done-edit');
        const addWidgetBtn = document.querySelector('#rpg-dashboard-add-widget');
        const exportBtn = document.querySelector('#rpg-dashboard-export-layout');
        const importBtn = document.querySelector('#rpg-dashboard-import-layout');

        if (editModeBtn) editModeBtn.style.display = '';
        if (doneBtn) doneBtn.style.display = 'none';
        if (addWidgetBtn) addWidgetBtn.style.display = 'none';
        if (exportBtn) exportBtn.style.display = 'none';
        if (importBtn) importBtn.style.display = 'none';

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
     * Toggle lock state
     */
    toggleLock() {
        this.isLocked = !this.isLocked;

        // Update button appearance
        const lockBtn = document.querySelector('#rpg-dashboard-lock-widgets');
        if (lockBtn) {
            const icon = lockBtn.querySelector('i');
            if (this.isLocked) {
                icon.className = 'fa-solid fa-lock';
                lockBtn.title = 'Unlock Widgets';
            } else {
                icon.className = 'fa-solid fa-lock-open';
                lockBtn.title = 'Lock Widgets';
            }
        }

        // Add/remove locked class to container for CSS styling
        if (this.isLocked) {
            this.container.classList.add('widgets-locked');
        } else {
            this.container.classList.remove('widgets-locked');
        }

        // Notify listeners
        this.notifyChange('lockStateChanged', { locked: this.isLocked });
        console.log('[EditModeManager] Lock state:', this.isLocked ? 'LOCKED' : 'UNLOCKED');
    }

    /**
     * Check if widgets are currently locked
     * @returns {boolean} True if locked
     */
    isWidgetsLocked() {
        return this.isLocked;
    }

    /**
     * Disable content editing (prevent keyboard popup in edit mode)
     */
    disableContentEditing() {
        // Find all contenteditable elements within widgets
        const editableElements = this.container.querySelectorAll('[contenteditable="true"]');
        editableElements.forEach(element => {
            element.dataset.wasEditable = 'true';
            element.contentEditable = 'false';
        });

        // Also disable input fields (except file inputs which should remain functional)
        const inputElements = this.container.querySelectorAll('input:not([type="file"]), textarea');
        inputElements.forEach(element => {
            element.dataset.wasEnabled = element.disabled ? 'false' : 'true';
            element.disabled = true;
        });

        console.log('[EditModeManager] Content editing disabled');
    }

    /**
     * Re-enable content editing
     */
    enableContentEditing() {
        // Re-enable contenteditable elements
        const editableElements = this.container.querySelectorAll('[data-was-editable="true"]');
        editableElements.forEach(element => {
            element.contentEditable = 'true';
            delete element.dataset.wasEditable;
        });

        // Re-enable input fields
        const inputElements = this.container.querySelectorAll('[data-was-enabled="true"]');
        inputElements.forEach(element => {
            element.disabled = false;
            delete element.dataset.wasEnabled;
        });

        console.log('[EditModeManager] Content editing enabled');
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

        // Store reference to widget element for positioning
        controls.dataset.widgetId = widgetId;

        // Append to overlay instead of widget to prevent overflow/scrollbar issues
        if (this.editControlsOverlay) {
            this.editControlsOverlay.appendChild(controls);
            // Position controls to match widget bounds
            this.updateControlPosition(controls, element);
        } else {
            // Fallback to old behavior if overlay not available
            element.appendChild(controls);
        }

        // Show controls on hover - keep visible when hovering controls themselves
        let isHoveringWidget = false;
        let isHoveringControls = false;
        let hideTimeout = null;

        const checkAndHideControls = () => {
            // Clear any existing timeout
            if (hideTimeout) {
                clearTimeout(hideTimeout);
            }

            // Add small delay to allow mouse to move between widget and controls
            hideTimeout = setTimeout(() => {
                if (!isHoveringWidget && !isHoveringControls) {
                    controls.style.opacity = '0';
                }
            }, 100);
        };

        // Widget hover
        element.addEventListener('mouseenter', () => {
            isHoveringWidget = true;
            if (this.isEditMode) {
                controls.style.opacity = '1';
            }
        });

        element.addEventListener('mouseleave', () => {
            isHoveringWidget = false;
            checkAndHideControls();
        });

        // Controls hover - keep visible when hovering the buttons
        controls.addEventListener('mouseenter', () => {
            isHoveringControls = true;
            controls.style.opacity = '1';
        });

        controls.addEventListener('mouseleave', () => {
            isHoveringControls = false;
            checkAndHideControls();
        });

        this.widgetControlsMap.set(widgetId, { controls, element });
    }

    /**
     * Update control position to match widget bounds
     * @param {HTMLElement} controls - Edit controls container
     * @param {HTMLElement} element - Widget element
     */
    updateControlPosition(controls, element) {
        if (!controls || !element) return;

        const overlay = this.editControlsOverlay;
        if (!overlay) return;

        // Use offset properties for parent-relative positioning
        // Both widget and overlay are children of the same grid container
        const widgetLeft = element.offsetLeft;
        const widgetTop = element.offsetTop;
        const widgetWidth = element.offsetWidth;

        // Position controls at top-right of widget (4px from top, 4px from right)
        controls.style.left = `${widgetLeft + widgetWidth - 60}px`; // 60px approximate width of controls
        controls.style.top = `${widgetTop + 4}px`;
        controls.style.pointerEvents = 'auto'; // Ensure controls are clickable
    }

    /**
     * Remove widget controls from a widget element
     * @param {string} widgetId - Widget ID
     */
    removeWidgetControls(widgetId) {
        const data = this.widgetControlsMap.get(widgetId);
        if (data) {
            if (data.controls) {
                data.controls.remove();
            }
            this.widgetControlsMap.delete(widgetId);
        }
    }

    /**
     * Sync controls for all currently rendered widgets
     * Adds controls to widgets that don't have them yet
     */
    syncAllControls() {
        // Find all widget elements in the grid
        const gridContainer = this.container.querySelector('#rpg-dashboard-grid');
        if (!gridContainer) return;

        const widgets = gridContainer.querySelectorAll('.rpg-widget');
        widgets.forEach(widgetElement => {
            const widgetId = widgetElement.dataset.widgetId;
            if (!widgetId) return;

            // Add controls if they don't exist yet
            if (!this.widgetControlsMap.has(widgetId)) {
                this.addWidgetControls(widgetElement, widgetId);
            } else {
                // Update position if controls already exist
                const data = this.widgetControlsMap.get(widgetId);
                if (data && data.controls) {
                    this.updateControlPosition(data.controls, widgetElement);
                }
            }
        });

        console.log('[EditModeManager] Synced controls for', widgets.length, 'widgets');
    }

    /**
     * Remove all widget controls
     * Called when clearing the grid or switching tabs
     */
    removeAllControls() {
        this.widgetControlsMap.forEach((data, widgetId) => {
            if (data.controls) {
                data.controls.remove();
            }
        });
        this.widgetControlsMap.clear();
        console.log('[EditModeManager] Removed all widget controls');
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
    async confirmCancel(onConfirm) {
        const confirmed = await showConfirmDialog({
            title: 'Discard Changes?',
            message: 'You have unsaved changes. Are you sure you want to discard them?',
            variant: 'warning',
            confirmText: 'Discard',
            cancelText: 'Keep Editing'
        });

        if (confirmed) {
            onConfirm();
        }
    }

    /**
     * Show confirmation dialog before deleting widget
     * @param {string} widgetId - Widget ID to delete
     */
    async confirmDeleteWidget(widgetId) {
        const confirmed = await showConfirmDialog({
            title: 'Delete Widget?',
            message: 'Are you sure you want to delete this widget? This action cannot be undone.',
            variant: 'danger',
            confirmText: 'Delete',
            cancelText: 'Cancel'
        });

        if (confirmed) {
            if (this.onWidgetDelete) {
                this.onWidgetDelete(widgetId);
            }
        }
    }

    /**
     * Show confirmation dialog before resetting layout
     * @param {Function} onConfirm - Callback if confirmed
     */
    async confirmReset(onConfirm) {
        const confirmed = await showConfirmDialog({
            title: 'Reset Layout?',
            message: 'This will reset the layout to default. All widgets will be removed and the default layout will be restored.',
            variant: 'danger',
            confirmText: 'Reset',
            cancelText: 'Cancel'
        });

        if (confirmed) {
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
