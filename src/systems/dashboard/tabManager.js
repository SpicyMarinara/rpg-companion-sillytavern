/**
 * Tab Management System
 *
 * Handles creation, deletion, reordering, and navigation of dashboard tabs.
 * Provides methods for tab lifecycle management and active tab tracking.
 */

/**
 * @typedef {Object} Tab
 * @property {string} id - Unique tab identifier
 * @property {string} name - Display name
 * @property {string} icon - Emoji/icon
 * @property {number} order - Sort order
 * @property {Array<Object>} widgets - Widgets in this tab
 */

/**
 * @typedef {Object} TabConfig
 * @property {string} name - Tab name
 * @property {string} [icon] - Tab icon (default: 📄)
 * @property {number} [order] - Tab order (default: append to end)
 */

export class TabManager {
    /**
     * @param {Object} dashboard - Dashboard configuration object
     */
    constructor(dashboard) {
        if (!dashboard || !Array.isArray(dashboard.tabs)) {
            throw new Error('TabManager requires a valid dashboard with tabs array');
        }

        this.dashboard = dashboard;
        this.activeTabId = dashboard.defaultTab || (dashboard.tabs[0]?.id || null);
        this.changeListeners = new Set();
    }

    /**
     * Get all tabs
     * @returns {Array<Tab>} Array of tabs sorted by order
     */
    getTabs() {
        return [...this.dashboard.tabs].sort((a, b) => a.order - b.order);
    }

    /**
     * Get active tab
     * @returns {Tab|null} Active tab or null
     */
    getActiveTab() {
        return this.dashboard.tabs.find(t => t.id === this.activeTabId) || null;
    }

    /**
     * Set active tab
     * @param {string} tabId - Tab ID to activate
     * @returns {boolean} True if successful
     */
    setActiveTab(tabId) {
        const tab = this.dashboard.tabs.find(t => t.id === tabId);
        if (!tab) {
            console.error(`[TabManager] Tab not found: ${tabId}`);
            return false;
        }

        this.activeTabId = tabId;
        this.dashboard.defaultTab = tabId;
        this.notifyChange('activeTabChanged', { tabId });
        console.log(`[TabManager] Active tab set to: ${tab.name}`);
        return true;
    }

    /**
     * Create new tab
     * @param {TabConfig} config - Tab configuration
     * @returns {Tab} Created tab
     */
    createTab(config) {
        if (!config.name || typeof config.name !== 'string') {
            throw new Error('Tab name is required');
        }

        // Generate unique ID
        const baseId = `tab-${config.name.toLowerCase().replace(/\s+/g, '-')}`;
        let id = baseId;
        let counter = 1;
        while (this.dashboard.tabs.some(t => t.id === id)) {
            id = `${baseId}-${counter++}`;
        }

        // Determine order
        const order = typeof config.order === 'number'
            ? config.order
            : Math.max(0, ...this.dashboard.tabs.map(t => t.order)) + 1;

        // Create tab
        const tab = {
            id,
            name: config.name,
            icon: config.icon || '📄',
            order,
            widgets: []
        };

        this.dashboard.tabs.push(tab);
        this.notifyChange('tabCreated', { tab });
        console.log(`[TabManager] Created tab: ${tab.name} (${id})`);
        return tab;
    }

    /**
     * Rename tab
     * @param {string} tabId - Tab ID
     * @param {string} newName - New tab name
     * @returns {boolean} True if successful
     */
    renameTab(tabId, newName) {
        if (!newName || typeof newName !== 'string') {
            throw new Error('New name is required');
        }

        const tab = this.dashboard.tabs.find(t => t.id === tabId);
        if (!tab) {
            console.error(`[TabManager] Tab not found: ${tabId}`);
            return false;
        }

        const oldName = tab.name;
        tab.name = newName;
        this.notifyChange('tabRenamed', { tabId, oldName, newName });
        console.log(`[TabManager] Renamed tab: ${oldName} → ${newName}`);
        return true;
    }

    /**
     * Change tab icon
     * @param {string} tabId - Tab ID
     * @param {string} newIcon - New icon
     * @returns {boolean} True if successful
     */
    changeTabIcon(tabId, newIcon) {
        const tab = this.dashboard.tabs.find(t => t.id === tabId);
        if (!tab) {
            console.error(`[TabManager] Tab not found: ${tabId}`);
            return false;
        }

        const oldIcon = tab.icon;
        tab.icon = newIcon;
        this.notifyChange('tabIconChanged', { tabId, oldIcon, newIcon });
        console.log(`[TabManager] Changed icon for ${tab.name}: ${oldIcon} → ${newIcon}`);
        return true;
    }

    /**
     * Delete tab
     * @param {string} tabId - Tab ID to delete
     * @param {boolean} [force=false] - Skip confirmation for single tab
     * @returns {boolean} True if successful
     */
    deleteTab(tabId, force = false) {
        const tabIndex = this.dashboard.tabs.findIndex(t => t.id === tabId);
        if (tabIndex === -1) {
            console.error(`[TabManager] Tab not found: ${tabId}`);
            return false;
        }

        // Prevent deleting last tab unless forced
        if (this.dashboard.tabs.length === 1 && !force) {
            console.warn('[TabManager] Cannot delete last tab');
            return false;
        }

        const tab = this.dashboard.tabs[tabIndex];

        // If deleting active tab, switch to another
        if (this.activeTabId === tabId) {
            // Try next tab, then previous, then first available
            const nextTab = this.dashboard.tabs[tabIndex + 1]
                || this.dashboard.tabs[tabIndex - 1]
                || this.dashboard.tabs.find(t => t.id !== tabId);

            if (nextTab) {
                this.setActiveTab(nextTab.id);
            }
        }

        this.dashboard.tabs.splice(tabIndex, 1);
        this.notifyChange('tabDeleted', { tabId, tab });
        console.log(`[TabManager] Deleted tab: ${tab.name}`);
        return true;
    }

    /**
     * Duplicate tab
     * @param {string} tabId - Tab ID to duplicate
     * @returns {Tab|null} Duplicated tab or null
     */
    duplicateTab(tabId) {
        const sourceTab = this.dashboard.tabs.find(t => t.id === tabId);
        if (!sourceTab) {
            console.error(`[TabManager] Tab not found: ${tabId}`);
            return null;
        }

        // Create new tab with copied name
        const copyName = `${sourceTab.name} (Copy)`;
        const newTab = this.createTab({
            name: copyName,
            icon: sourceTab.icon
        });

        // Deep copy widgets
        newTab.widgets = sourceTab.widgets.map(widget => {
            const newWidget = { ...widget };

            // Generate unique widget ID
            const baseId = widget.id.replace(/-copy-\d+$/, '');
            let newId = `${baseId}-copy`;
            let counter = 1;
            while (this.dashboard.tabs.some(t =>
                t.widgets.some(w => w.id === newId)
            )) {
                newId = `${baseId}-copy-${counter++}`;
            }
            newWidget.id = newId;

            // Deep copy config
            newWidget.config = JSON.parse(JSON.stringify(widget.config || {}));

            return newWidget;
        });

        this.notifyChange('tabDuplicated', { sourceTabId: tabId, newTab });
        console.log(`[TabManager] Duplicated tab: ${sourceTab.name} → ${copyName}`);
        return newTab;
    }

    /**
     * Reorder tabs
     * @param {Array<string>} tabIds - Ordered array of tab IDs
     * @returns {boolean} True if successful
     */
    reorderTabs(tabIds) {
        if (!Array.isArray(tabIds)) {
            throw new Error('tabIds must be an array');
        }

        // Validate all tabs exist
        if (tabIds.length !== this.dashboard.tabs.length) {
            console.error('[TabManager] Invalid tab count for reordering');
            return false;
        }

        for (const id of tabIds) {
            if (!this.dashboard.tabs.some(t => t.id === id)) {
                console.error(`[TabManager] Unknown tab ID: ${id}`);
                return false;
            }
        }

        // Update order property
        tabIds.forEach((id, index) => {
            const tab = this.dashboard.tabs.find(t => t.id === id);
            if (tab) {
                tab.order = index;
            }
        });

        this.notifyChange('tabsReordered', { tabIds });
        console.log('[TabManager] Tabs reordered:', tabIds);
        return true;
    }

    /**
     * Get tab by ID
     * @param {string} tabId - Tab ID
     * @returns {Tab|null} Tab or null
     */
    getTab(tabId) {
        return this.dashboard.tabs.find(t => t.id === tabId) || null;
    }

    /**
     * Get tab count
     * @returns {number} Number of tabs
     */
    getTabCount() {
        return this.dashboard.tabs.length;
    }

    /**
     * Check if tab exists
     * @param {string} tabId - Tab ID
     * @returns {boolean} True if exists
     */
    hasTab(tabId) {
        return this.dashboard.tabs.some(t => t.id === tabId);
    }

    /**
     * Get tab index (in sorted order)
     * @param {string} tabId - Tab ID
     * @returns {number} Index or -1 if not found
     */
    getTabIndex(tabId) {
        const sorted = this.getTabs();
        return sorted.findIndex(t => t.id === tabId);
    }

    /**
     * Switch to tab by index (for keyboard shortcuts)
     * @param {number} index - Tab index (0-based)
     * @returns {boolean} True if successful
     */
    switchToTabByIndex(index) {
        const sorted = this.getTabs();
        if (index < 0 || index >= sorted.length) {
            return false;
        }

        return this.setActiveTab(sorted[index].id);
    }

    /**
     * Switch to next tab
     * @returns {boolean} True if successful
     */
    switchToNextTab() {
        const sorted = this.getTabs();
        const currentIndex = sorted.findIndex(t => t.id === this.activeTabId);
        const nextIndex = (currentIndex + 1) % sorted.length;
        return this.setActiveTab(sorted[nextIndex].id);
    }

    /**
     * Switch to previous tab
     * @returns {boolean} True if successful
     */
    switchToPreviousTab() {
        const sorted = this.getTabs();
        const currentIndex = sorted.findIndex(t => t.id === this.activeTabId);
        const prevIndex = (currentIndex - 1 + sorted.length) % sorted.length;
        return this.setActiveTab(sorted[prevIndex].id);
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
                console.error('[TabManager] Error in change listener:', error);
            }
        });
    }

    /**
     * Get statistics
     * @returns {Object} Tab statistics
     */
    getStats() {
        return {
            totalTabs: this.dashboard.tabs.length,
            activeTab: this.activeTabId,
            totalWidgets: this.dashboard.tabs.reduce((sum, t) => sum + t.widgets.length, 0),
            tabsWithWidgets: this.dashboard.tabs.filter(t => t.widgets.length > 0).length,
            emptyTabs: this.dashboard.tabs.filter(t => t.widgets.length === 0).length,
            averageWidgetsPerTab: (
                this.dashboard.tabs.reduce((sum, t) => sum + t.widgets.length, 0) /
                this.dashboard.tabs.length
            ).toFixed(1)
        };
    }
}
