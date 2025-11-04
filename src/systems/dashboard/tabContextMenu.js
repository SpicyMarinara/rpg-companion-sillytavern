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

        // Long press support for mobile
        let longPressTimer = null;
        let longPressTarget = null;
        let touchStartPos = { x: 0, y: 0 };

        // Desktop: Right-click context menu
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

        // Mobile: Long press support (touch and hold)
        this.tabsContainer.addEventListener('touchstart', (e) => {
            const tabElement = e.target.closest('.rpg-dashboard-tab');
            if (!tabElement) return;

            const tabId = tabElement.dataset.tabId;
            if (!tabId) return;

            // Store touch position
            const touch = e.touches[0];
            touchStartPos = { x: touch.pageX, y: touch.pageY };
            longPressTarget = { tabId, x: touch.pageX, y: touch.pageY };

            // Start long press timer (500ms)
            longPressTimer = setTimeout(() => {
                if (longPressTarget) {
                    // Prevent default touch behavior
                    e.preventDefault();
                    // Show context menu at touch position
                    this.showMenu(longPressTarget.x, longPressTarget.y, longPressTarget.tabId);
                    // Provide haptic feedback if available
                    if (navigator.vibrate) {
                        navigator.vibrate(50);
                    }
                    longPressTarget = null;
                }
            }, 500);
        }, { passive: false });

        // Cancel long press on touch move (if moved too far)
        this.tabsContainer.addEventListener('touchmove', (e) => {
            if (!longPressTimer) return;

            const touch = e.touches[0];
            const deltaX = Math.abs(touch.pageX - touchStartPos.x);
            const deltaY = Math.abs(touch.pageY - touchStartPos.y);

            // Cancel if moved more than 10px
            if (deltaX > 10 || deltaY > 10) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
                longPressTarget = null;
            }
        });

        // Cancel long press on touch end (if timer still running)
        this.tabsContainer.addEventListener('touchend', () => {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
                longPressTarget = null;
            }
        });

        // Cancel long press on touch cancel
        this.tabsContainer.addEventListener('touchcancel', () => {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
                longPressTarget = null;
            }
        });

        // Close menu on any click/touch outside
        document.addEventListener('click', () => this.hideMenu());
        document.addEventListener('touchstart', (e) => {
            // Close menu if touching outside context menu
            if (this.menu && !this.menu.contains(e.target)) {
                this.hideMenu();
            }
        });
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

        // Create menu container (matches widget styling with solid background)
        this.menu = document.createElement('div');
        this.menu.className = 'rpg-tab-context-menu';
        this.menu.style.cssText = `
            position: fixed;
            left: ${x}px;
            top: ${y}px;
            background: linear-gradient(135deg, rgba(22, 33, 62, 1) 0%, rgba(26, 26, 46, 1) 100%);
            border: 2px solid var(--rpg-border);
            border-radius: 6px;
            box-shadow: 0 4px 18px var(--rpg-shadow), inset 0 0 12px rgba(0, 0, 0, 0.3);
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
                    background: var(--rpg-border);
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

        const baseColor = item.danger ? 'var(--rpg-highlight)' : 'var(--rpg-text)';
        const hoverBg = item.danger ? 'rgba(233, 69, 96, 0.2)' : 'var(--rpg-accent)';

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
            color: ${item.danger ? 'var(--rpg-highlight)' : 'var(--rpg-border)'};
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
            // Create modal (uses .rpg-modal class for theming)
            const modal = document.createElement('div');
            modal.className = 'rpg-modal';
            modal.style.display = 'flex';

            // Modal content (uses .rpg-modal-content class for theming)
            const content = document.createElement('div');
            content.className = 'rpg-modal-content';
            content.style.padding = '1.5rem';
            content.style.maxWidth = '500px';

            const title = document.createElement('h3');
            title.textContent = 'Choose Icon';
            title.style.cssText = `
                margin: 0 0 1.25rem 0;
                color: var(--rpg-text);
                font-size: 1.25rem;
            `;

            const grid = document.createElement('div');
            grid.style.cssText = `
                display: grid;
                grid-template-columns: repeat(5, 1fr);
                gap: 0.75rem;
                margin-bottom: 1.25rem;
            `;

            // Extract icon name without fa-solid prefix for comparison
            const currentIconName = currentIcon.replace('fa-solid ', '');

            iconOptions.forEach(option => {
                const iconBtn = document.createElement('button');
                const isSelected = option.icon === currentIconName;

                iconBtn.style.cssText = `
                    padding: 1rem;
                    background: ${isSelected ? 'var(--rpg-highlight)' : 'var(--rpg-accent)'};
                    border: 2px solid ${isSelected ? 'var(--rpg-highlight)' : 'var(--rpg-border)'};
                    border-radius: 6px;
                    color: ${isSelected ? 'white' : 'var(--rpg-text)'};
                    font-size: 1.5rem;
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
                        iconBtn.style.borderColor = 'var(--rpg-highlight)';
                        iconBtn.style.transform = 'scale(1.05)';
                    }
                };
                iconBtn.onmouseleave = () => {
                    if (!isSelected) {
                        iconBtn.style.borderColor = 'var(--rpg-border)';
                        iconBtn.style.transform = 'scale(1)';
                    }
                };

                iconBtn.onclick = () => {
                    modal.remove();
                    resolve(option.icon);
                };

                grid.appendChild(iconBtn);
            });

            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'rpg-btn-secondary';
            cancelBtn.innerHTML = '<i class="fa-solid fa-times"></i> Cancel';
            cancelBtn.style.width = '100%';
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
