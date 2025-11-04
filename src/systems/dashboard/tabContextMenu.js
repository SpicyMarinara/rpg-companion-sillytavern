/**
 * Tab Context Menu System
 *
 * Provides right-click context menu for tab management operations.
 * Integrates with TabManager for create, rename, duplicate, delete, and icon change.
 */

import { showConfirmDialog } from './confirmDialog.js';
import { showPromptDialog } from './promptDialog.js';

export class TabContextMenu {
    /**
     * @param {Object} config - Configuration
     * @param {TabManager} config.tabManager - Tab manager instance
     * @param {Function} config.onTabChange - Callback when tabs change
     */
    constructor(config) {
        this.tabManager = config.tabManager;
        this.onTabChange = config.onTabChange;
        this.menu = null;
        this.currentTabId = null;
    }

    /**
     * Initialize context menu system
     * @param {HTMLElement} tabsContainer - Container with tab elements
     */
    init(tabsContainer) {
        if (!tabsContainer) {
            console.error('[TabContextMenu] Tabs container not provided');
            return;
        }

        this.tabsContainer = tabsContainer;

        // Attach context menu handlers to tabs
        this.attachHandlers();

        console.log('[TabContextMenu] Initialized');
    }

    /**
     * Attach context menu event handlers to all tabs
     */
    attachHandlers() {
        if (!this.tabsContainer) return;

        // Use event delegation for dynamically added tabs
        this.tabsContainer.addEventListener('contextmenu', (e) => {
            // Find closest tab element
            const tabElement = e.target.closest('.rpg-dashboard-tab');
            if (!tabElement) return;

            e.preventDefault();
            e.stopPropagation();

            const tabId = tabElement.dataset.tabId;
            if (!tabId) return;

            this.showMenu(e.pageX, e.pageY, tabId);
        });

        // Close menu on any click outside
        document.addEventListener('click', () => this.hideMenu());
        document.addEventListener('contextmenu', (e) => {
            // Only hide if right-clicking outside tabs
            if (!e.target.closest('.rpg-dashboard-tab')) {
                this.hideMenu();
            }
        });
    }

    /**
     * Show context menu at position
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {string} tabId - Tab ID
     */
    showMenu(x, y, tabId) {
        this.hideMenu(); // Remove existing menu

        this.currentTabId = tabId;
        const tab = this.tabManager.getTab(tabId);
        if (!tab) return;

        // Create menu container
        this.menu = document.createElement('div');
        this.menu.className = 'rpg-tab-context-menu';
        this.menu.style.cssText = `
            position: fixed;
            left: ${x}px;
            top: ${y}px;
            background: #16213e;
            border: 1px solid #0f3460;
            border-radius: 6px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
            z-index: 10002;
            min-width: 180px;
            padding: 6px 0;
        `;

        // Menu items
        const items = [
            { icon: 'fa-plus', label: 'Add New Tab', action: () => this.handleAddTab() },
            { type: 'separator' },
            { icon: 'fa-pencil', label: 'Rename Tab', action: () => this.handleRenameTab(tabId) },
            { icon: 'fa-icons', label: 'Change Icon', action: () => this.handleChangeIcon(tabId) },
            { icon: 'fa-copy', label: 'Duplicate Tab', action: () => this.handleDuplicateTab(tabId) },
            { type: 'separator' },
            { icon: 'fa-trash', label: 'Delete Tab', action: () => this.handleDeleteTab(tabId), disabled: this.tabManager.getTabCount() === 1, danger: true }
        ];

        items.forEach(item => {
            if (item.type === 'separator') {
                const separator = document.createElement('div');
                separator.style.cssText = `
                    height: 1px;
                    background: #0f3460;
                    margin: 6px 0;
                `;
                this.menu.appendChild(separator);
                return;
            }

            const menuItem = this.createMenuItem(item);
            this.menu.appendChild(menuItem);
        });

        // Append to body
        document.body.appendChild(this.menu);

        // Adjust position if menu goes off-screen
        this.adjustMenuPosition();
    }

    /**
     * Create menu item element
     * @param {Object} item - Item config
     * @returns {HTMLElement} Menu item element
     */
    createMenuItem(item) {
        const menuItem = document.createElement('div');
        menuItem.className = 'rpg-tab-context-menu-item';

        const baseColor = item.danger ? '#e94560' : '#eeeeee';
        const hoverBg = item.danger ? '#8b2a3a' : '#0f3460';

        menuItem.style.cssText = `
            padding: 10px 16px;
            display: flex;
            align-items: center;
            gap: 12px;
            color: ${baseColor};
            font-size: 14px;
            cursor: ${item.disabled ? 'not-allowed' : 'pointer'};
            transition: background 0.2s;
            opacity: ${item.disabled ? '0.5' : '1'};
        `;

        if (!item.disabled) {
            menuItem.onmouseenter = () => menuItem.style.background = hoverBg;
            menuItem.onmouseleave = () => menuItem.style.background = 'transparent';
            menuItem.onclick = (e) => {
                e.stopPropagation();
                this.hideMenu();
                item.action();
            };
        }

        const icon = document.createElement('i');
        icon.className = `fa-solid ${item.icon}`;
        icon.style.cssText = `
            width: 16px;
            text-align: center;
            color: ${item.danger ? '#e94560' : '#4ecca3'};
        `;

        const label = document.createElement('span');
        label.textContent = item.label;

        menuItem.appendChild(icon);
        menuItem.appendChild(label);

        return menuItem;
    }

    /**
     * Adjust menu position to stay within viewport
     */
    adjustMenuPosition() {
        if (!this.menu) return;

        const rect = this.menu.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        let left = parseInt(this.menu.style.left);
        let top = parseInt(this.menu.style.top);

        // Adjust horizontal position
        if (rect.right > viewportWidth) {
            left = viewportWidth - rect.width - 10;
        }

        // Adjust vertical position
        if (rect.bottom > viewportHeight) {
            top = viewportHeight - rect.height - 10;
        }

        this.menu.style.left = `${Math.max(10, left)}px`;
        this.menu.style.top = `${Math.max(10, top)}px`;
    }

    /**
     * Hide context menu
     */
    hideMenu() {
        if (this.menu) {
            this.menu.remove();
            this.menu = null;
        }
        this.currentTabId = null;
    }

    /**
     * Handle: Add New Tab
     */
    async handleAddTab() {
        const tabName = await showPromptDialog({
            title: 'Add New Tab',
            message: 'Enter a name for the new tab:',
            placeholder: 'e.g., Combat, Exploration, Social',
            confirmText: 'Create',
            validator: (value) => {
                if (!value || value.trim().length === 0) {
                    return { valid: false, error: 'Tab name cannot be empty' };
                }
                if (value.trim().length > 30) {
                    return { valid: false, error: 'Tab name too long (max 30 characters)' };
                }
                return { valid: true, error: '' };
            }
        });

        if (tabName) {
            const tab = this.tabManager.createTab({
                name: tabName.trim(),
                icon: 'fa-solid fa-file'
            });

            console.log('[TabContextMenu] Created new tab:', tab.name);
            if (this.onTabChange) this.onTabChange('tabCreated', { tab });
        }
    }

    /**
     * Handle: Rename Tab
     * @param {string} tabId - Tab ID
     */
    async handleRenameTab(tabId) {
        const tab = this.tabManager.getTab(tabId);
        if (!tab) return;

        const newName = await showPromptDialog({
            title: 'Rename Tab',
            message: `Rename "${tab.name}":`,
            defaultValue: tab.name,
            placeholder: 'Enter new tab name',
            confirmText: 'Rename',
            validator: (value) => {
                if (!value || value.trim().length === 0) {
                    return { valid: false, error: 'Tab name cannot be empty' };
                }
                if (value.trim().length > 30) {
                    return { valid: false, error: 'Tab name too long (max 30 characters)' };
                }
                return { valid: true, error: '' };
            }
        });

        if (newName && newName.trim() !== tab.name) {
            const success = this.tabManager.renameTab(tabId, newName.trim());
            if (success) {
                console.log('[TabContextMenu] Renamed tab:', tab.name, '→', newName.trim());
                if (this.onTabChange) this.onTabChange('tabRenamed', { tabId, newName: newName.trim() });
            }
        }
    }

    /**
     * Handle: Change Icon
     * @param {string} tabId - Tab ID
     */
    async handleChangeIcon(tabId) {
        const tab = this.tabManager.getTab(tabId);
        if (!tab) return;

        // Common FontAwesome icon options
        const iconOptions = [
            { icon: 'fa-file', label: 'Document' },
            { icon: 'fa-home', label: 'Home' },
            { icon: 'fa-user', label: 'User' },
            { icon: 'fa-users', label: 'Group' },
            { icon: 'fa-heart', label: 'Heart' },
            { icon: 'fa-star', label: 'Star' },
            { icon: 'fa-flag', label: 'Flag' },
            { icon: 'fa-bookmark', label: 'Bookmark' },
            { icon: 'fa-map', label: 'Map' },
            { icon: 'fa-compass', label: 'Compass' },
            { icon: 'fa-shield', label: 'Shield' },
            { icon: 'fa-sword', label: 'Sword' },
            { icon: 'fa-wand-magic-sparkles', label: 'Magic' },
            { icon: 'fa-scroll', label: 'Scroll' },
            { icon: 'fa-book', label: 'Book' },
            { icon: 'fa-dragon', label: 'Dragon' },
            { icon: 'fa-dice-d20', label: 'D20' },
            { icon: 'fa-fire', label: 'Fire' },
            { icon: 'fa-bolt', label: 'Lightning' },
            { icon: 'fa-crown', label: 'Crown' }
        ];

        // Create icon picker modal
        const newIcon = await this.showIconPicker(iconOptions, tab.icon);
        if (newIcon && newIcon !== tab.icon) {
            const success = this.tabManager.changeTabIcon(tabId, `fa-solid ${newIcon}`);
            if (success) {
                console.log('[TabContextMenu] Changed tab icon:', tab.name);
                if (this.onTabChange) this.onTabChange('tabIconChanged', { tabId, newIcon });
            }
        }
    }

    /**
     * Show icon picker modal
     * @param {Array} iconOptions - Array of icon options
     * @param {string} currentIcon - Currently selected icon
     * @returns {Promise<string|null>} Selected icon class or null
     */
    showIconPicker(iconOptions, currentIcon) {
        return new Promise((resolve) => {
            // Create modal
            const modal = document.createElement('div');
            modal.className = 'rpg-modal';
            modal.style.cssText = `
                position: fixed;
                inset: 0;
                background: rgba(0,0,0,0.7);
                z-index: 10001;
                display: flex;
                align-items: center;
                justify-content: center;
            `;

            const content = document.createElement('div');
            content.className = 'rpg-modal-content';
            content.style.cssText = `
                background: #16213e;
                border-radius: 8px;
                padding: 24px;
                max-width: 500px;
                max-height: 80vh;
                overflow-y: auto;
            `;

            const title = document.createElement('h3');
            title.textContent = 'Choose Icon';
            title.style.cssText = `
                margin: 0 0 20px 0;
                color: #eeeeee;
                font-size: 18px;
            `;

            const grid = document.createElement('div');
            grid.style.cssText = `
                display: grid;
                grid-template-columns: repeat(5, 1fr);
                gap: 12px;
                margin-bottom: 20px;
            `;

            // Extract icon name without fa-solid prefix for comparison
            const currentIconName = currentIcon.replace('fa-solid ', '');

            iconOptions.forEach(option => {
                const iconBtn = document.createElement('button');
                const isSelected = option.icon === currentIconName;

                iconBtn.style.cssText = `
                    padding: 16px;
                    background: ${isSelected ? '#4ecca3' : '#0f3460'};
                    border: 2px solid ${isSelected ? '#4ecca3' : '#1a4d7a'};
                    border-radius: 6px;
                    color: ${isSelected ? '#16213e' : '#eeeeee'};
                    font-size: 24px;
                    cursor: pointer;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                `;

                iconBtn.innerHTML = `<i class="fa-solid ${option.icon}"></i>`;
                iconBtn.title = option.label;

                iconBtn.onmouseenter = () => {
                    if (!isSelected) {
                        iconBtn.style.background = '#1a4d7a';
                        iconBtn.style.borderColor = '#4ecca3';
                    }
                };
                iconBtn.onmouseleave = () => {
                    if (!isSelected) {
                        iconBtn.style.background = '#0f3460';
                        iconBtn.style.borderColor = '#1a4d7a';
                    }
                };

                iconBtn.onclick = () => {
                    modal.remove();
                    resolve(option.icon);
                };

                grid.appendChild(iconBtn);
            });

            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = 'Cancel';
            cancelBtn.style.cssText = `
                padding: 10px 20px;
                background: #0f3460;
                border: none;
                border-radius: 6px;
                color: #eeeeee;
                font-size: 14px;
                cursor: pointer;
                width: 100%;
            `;
            cancelBtn.onclick = () => {
                modal.remove();
                resolve(null);
            };

            content.appendChild(title);
            content.appendChild(grid);
            content.appendChild(cancelBtn);
            modal.appendChild(content);
            document.body.appendChild(modal);

            // Close on backdrop click
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.remove();
                    resolve(null);
                }
            });

            // Close on Escape
            const handleKeyDown = (e) => {
                if (e.key === 'Escape') {
                    modal.remove();
                    document.removeEventListener('keydown', handleKeyDown);
                    resolve(null);
                }
            };
            document.addEventListener('keydown', handleKeyDown);
        });
    }

    /**
     * Handle: Duplicate Tab
     * @param {string} tabId - Tab ID
     */
    async handleDuplicateTab(tabId) {
        const newTab = this.tabManager.duplicateTab(tabId);
        if (newTab) {
            console.log('[TabContextMenu] Duplicated tab:', newTab.name);
            if (this.onTabChange) this.onTabChange('tabDuplicated', { sourceTabId: tabId, newTab });
        }
    }

    /**
     * Handle: Delete Tab
     * @param {string} tabId - Tab ID
     */
    async handleDeleteTab(tabId) {
        const tab = this.tabManager.getTab(tabId);
        if (!tab) return;

        // Prevent deleting last tab
        if (this.tabManager.getTabCount() === 1) {
            await showConfirmDialog({
                title: 'Cannot Delete',
                message: 'You cannot delete the last remaining tab.',
                variant: 'warning',
                confirmText: 'OK',
                cancelText: ''
            });
            return;
        }

        const confirmed = await showConfirmDialog({
            title: 'Delete Tab?',
            message: `Are you sure you want to delete "${tab.name}"? All widgets in this tab will be removed.`,
            variant: 'danger',
            confirmText: 'Delete',
            cancelText: 'Cancel'
        });

        if (confirmed) {
            const success = this.tabManager.deleteTab(tabId);
            if (success) {
                console.log('[TabContextMenu] Deleted tab:', tab.name);
                if (this.onTabChange) this.onTabChange('tabDeleted', { tabId, tab });
            }
        }
    }

    /**
     * Destroy context menu system
     */
    destroy() {
        this.hideMenu();
        // Event delegation means no need to remove individual handlers
        console.log('[TabContextMenu] Destroyed');
    }
}
