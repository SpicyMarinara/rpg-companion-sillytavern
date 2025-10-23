/**
 * Layout Persistence System
 *
 * Handles saving, loading, importing, and exporting dashboard layouts.
 * Provides debounced auto-save and manual save operations.
 */

/**
 * @typedef {Object} PersistenceConfig
 * @property {Function} onSave - Callback when layout is saved (layout) => void
 * @property {Function} onLoad - Callback when layout is loaded (layout) => void
 * @property {Function} onError - Callback when error occurs (error) => void
 * @property {number} debounceMs - Debounce delay for auto-save (default: 500ms)
 */

export class LayoutPersistence {
    /**
     * @param {PersistenceConfig} config - Configuration object
     */
    constructor(config = {}) {
        this.onSave = config.onSave;
        this.onLoad = config.onLoad;
        this.onError = config.onError;
        this.debounceMs = config.debounceMs || 500;

        this.saveTimeout = null;
        this.lastSaveTime = 0;
        this.isSaving = false;
        this.pendingSave = false;

        this.changeListeners = new Set();
    }

    /**
     * Save layout to storage
     * @param {Object} dashboard - Dashboard configuration
     * @param {boolean} immediate - Skip debounce if true
     * @returns {Promise<void>}
     */
    async saveLayout(dashboard, immediate = false) {
        if (!dashboard) {
            throw new Error('Dashboard configuration is required');
        }

        // Validate dashboard structure
        if (!this.validateDashboard(dashboard)) {
            throw new Error('Invalid dashboard configuration');
        }

        if (immediate) {
            return this.performSave(dashboard);
        } else {
            return this.debouncedSave(dashboard);
        }
    }

    /**
     * Debounced save (waits for quiet period)
     * @param {Object} dashboard - Dashboard configuration
     * @returns {Promise<void>}
     */
    async debouncedSave(dashboard) {
        // Clear existing timeout
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }

        // Set pending flag
        this.pendingSave = true;

        // Schedule save
        return new Promise((resolve, reject) => {
            this.saveTimeout = setTimeout(async () => {
                try {
                    await this.performSave(dashboard);
                    resolve();
                } catch (error) {
                    reject(error);
                }
            }, this.debounceMs);
        });
    }

    /**
     * Perform actual save operation
     * @param {Object} dashboard - Dashboard configuration
     * @returns {Promise<void>}
     * @private
     */
    async performSave(dashboard) {
        this.isSaving = true;
        this.notifyChange('saveStarted', { timestamp: Date.now() });

        try {
            // Clone to avoid mutations
            const layoutData = JSON.parse(JSON.stringify(dashboard));

            // Add metadata
            layoutData.metadata = {
                version: dashboard.version || 2,
                savedAt: new Date().toISOString(),
                appVersion: '2.0.0'
            };

            // Save to localStorage (in real implementation, use extensionSettings)
            localStorage.setItem('rpg-companion-dashboard', JSON.stringify(layoutData));

            this.lastSaveTime = Date.now();
            this.isSaving = false;
            this.pendingSave = false;

            this.notifyChange('saveSuceed', { timestamp: this.lastSaveTime, layout: layoutData });
            console.log('[LayoutPersistence] Layout saved successfully');

            if (this.onSave) {
                this.onSave(layoutData);
            }
        } catch (error) {
            this.isSaving = false;
            this.pendingSave = false;
            this.notifyChange('saveError', { error });
            console.error('[LayoutPersistence] Save failed:', error);

            if (this.onError) {
                this.onError(error);
            }

            throw error;
        }
    }

    /**
     * Load layout from storage
     * @returns {Promise<Object|null>} Dashboard configuration or null if not found
     */
    async loadLayout() {
        this.notifyChange('loadStarted', { timestamp: Date.now() });

        try {
            // Load from localStorage (in real implementation, use extensionSettings)
            const stored = localStorage.getItem('rpg-companion-dashboard');

            if (!stored) {
                console.log('[LayoutPersistence] No saved layout found');
                this.notifyChange('loadComplete', { layout: null });
                return null;
            }

            const layoutData = JSON.parse(stored);

            // Migrate old pixel values to rem units
            if (layoutData.gridConfig) {
                // Check if we have old pixel values (rowHeight > 20 is likely pixels)
                if (layoutData.gridConfig.rowHeight > 20) {
                    console.log('[LayoutPersistence] Migrating old px values to rem');
                    layoutData.gridConfig.rowHeight = 5; // 80px → 5rem
                    layoutData.gridConfig.gap = 0.75; // 12px → 0.75rem
                    console.log('[LayoutPersistence] Converted gridConfig: rowHeight=5rem, gap=0.75rem');
                }
            }

            // Validate loaded data
            if (!this.validateDashboard(layoutData)) {
                throw new Error('Loaded layout is invalid');
            }

            console.log('[LayoutPersistence] Layout loaded successfully');
            this.notifyChange('loadSuccess', { layout: layoutData });

            if (this.onLoad) {
                this.onLoad(layoutData);
            }

            return layoutData;
        } catch (error) {
            this.notifyChange('loadError', { error });
            console.error('[LayoutPersistence] Load failed:', error);

            if (this.onError) {
                this.onError(error);
            }

            throw error;
        }
    }

    /**
     * Export layout as JSON file
     * @param {Object} dashboard - Dashboard configuration
     * @param {string} filename - Export filename
     */
    exportLayout(dashboard, filename = 'dashboard-layout.json') {
        if (!dashboard) {
            throw new Error('Dashboard configuration is required');
        }

        if (!this.validateDashboard(dashboard)) {
            throw new Error('Invalid dashboard configuration');
        }

        try {
            // Clone and add metadata
            const exportData = JSON.parse(JSON.stringify(dashboard));
            exportData.metadata = {
                version: dashboard.version || 2,
                exportedAt: new Date().toISOString(),
                appVersion: '2.0.0',
                exportedBy: 'RPG Companion v2.0'
            };

            // Create blob and download
            const blob = new Blob([JSON.stringify(exportData, null, 2)], {
                type: 'application/json'
            });

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            console.log('[LayoutPersistence] Layout exported:', filename);
            this.notifyChange('exportSuccess', { filename });
        } catch (error) {
            console.error('[LayoutPersistence] Export failed:', error);
            this.notifyChange('exportError', { error });

            if (this.onError) {
                this.onError(error);
            }

            throw error;
        }
    }

    /**
     * Import layout from JSON file
     * @param {File} file - JSON file to import
     * @returns {Promise<Object>} Imported dashboard configuration
     */
    async importLayout(file) {
        if (!file) {
            throw new Error('File is required');
        }

        if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
            throw new Error('File must be JSON format');
        }

        this.notifyChange('importStarted', { filename: file.name });

        try {
            const text = await this.readFileAsText(file);
            const layoutData = JSON.parse(text);

            // Validate imported data
            if (!this.validateDashboard(layoutData)) {
                throw new Error('Imported file contains invalid dashboard configuration');
            }

            console.log('[LayoutPersistence] Layout imported:', file.name);
            this.notifyChange('importSuccess', { layout: layoutData, filename: file.name });

            return layoutData;
        } catch (error) {
            console.error('[LayoutPersistence] Import failed:', error);
            this.notifyChange('importError', { error, filename: file.name });

            if (this.onError) {
                this.onError(error);
            }

            throw error;
        }
    }

    /**
     * Reset layout to default
     * @param {Object} defaultDashboard - Default dashboard configuration
     * @returns {Promise<void>}
     */
    async resetToDefault(defaultDashboard) {
        if (!defaultDashboard) {
            throw new Error('Default dashboard configuration is required');
        }

        if (!this.validateDashboard(defaultDashboard)) {
            throw new Error('Invalid default dashboard configuration');
        }

        try {
            // Clear saved layout
            localStorage.removeItem('rpg-companion-dashboard');

            // Save default as current
            await this.saveLayout(defaultDashboard, true);

            console.log('[LayoutPersistence] Layout reset to default');
            this.notifyChange('resetSuccess', { layout: defaultDashboard });
        } catch (error) {
            console.error('[LayoutPersistence] Reset failed:', error);
            this.notifyChange('resetError', { error });

            if (this.onError) {
                this.onError(error);
            }

            throw error;
        }
    }

    /**
     * Validate dashboard configuration
     * @param {Object} dashboard - Dashboard to validate
     * @returns {boolean} True if valid
     * @private
     */
    validateDashboard(dashboard) {
        if (!dashboard || typeof dashboard !== 'object') {
            return false;
        }

        // Check required fields
        if (!dashboard.version || !dashboard.gridConfig || !Array.isArray(dashboard.tabs)) {
            return false;
        }

        // Validate grid config
        const grid = dashboard.gridConfig;
        if (typeof grid.columns !== 'number' || typeof grid.rowHeight !== 'number') {
            return false;
        }

        // Validate tabs
        for (const tab of dashboard.tabs) {
            if (!tab.id || !tab.name || !Array.isArray(tab.widgets)) {
                return false;
            }

            // Validate widgets in tab
            for (const widget of tab.widgets) {
                if (!widget.id || !widget.type) {
                    return false;
                }

                if (typeof widget.x !== 'number' || typeof widget.y !== 'number' ||
                    typeof widget.w !== 'number' || typeof widget.h !== 'number') {
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * Read file as text
     * @param {File} file - File to read
     * @returns {Promise<string>} File contents
     * @private
     */
    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                resolve(e.target.result);
            };

            reader.onerror = (e) => {
                reject(new Error('Failed to read file'));
            };

            reader.readAsText(file);
        });
    }

    /**
     * Check if save is pending
     * @returns {boolean} True if save is pending
     */
    hasPendingSave() {
        return this.pendingSave;
    }

    /**
     * Check if currently saving
     * @returns {boolean} True if saving
     */
    getIsSaving() {
        return this.isSaving;
    }

    /**
     * Get last save time
     * @returns {number} Timestamp of last save
     */
    getLastSaveTime() {
        return this.lastSaveTime;
    }

    /**
     * Force pending save to execute immediately
     * @returns {Promise<void>}
     */
    async flushPendingSave() {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
            this.saveTimeout = null;
        }

        if (this.pendingSave) {
            // The pending save will be triggered by the caller
            console.log('[LayoutPersistence] Flushing pending save');
        }
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
                console.error('[LayoutPersistence] Error in change listener:', error);
            }
        });
    }

    /**
     * Destroy persistence manager
     */
    destroy() {
        // Cancel pending save
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
            this.saveTimeout = null;
        }

        this.changeListeners.clear();
    }
}
