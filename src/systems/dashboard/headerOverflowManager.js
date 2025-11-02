/**
 * Header Overflow Manager
 *
 * Manages responsive button overflow behavior with three modes:
 * - Full Mode (>900px): All buttons visible
 * - Overflow Mode (500-900px): Priority buttons + "More" menu
 * - Compact Mode (<500px): Priority buttons + Hamburger menu
 *
 * Uses ResizeObserver for accurate width detection and smooth transitions.
 */

export class HeaderOverflowManager {
    /**
     * @param {HTMLElement} headerContainer - The header right container
     * @param {Object} options - Configuration options
     */
    constructor(headerContainer, options = {}) {
        this.headerContainer = headerContainer;
        this.options = {
            fullModeWidth: 900, // px
            compactModeWidth: 500, // px
            debounceDelay: 100, // ms
            ...options
        };

        this.currentMode = 'full';
        this.menuOpen = false;
        this.resizeObserver = null;
        this.resizeTimeout = null;
        this.editModeManager = null; // Reference to EditModeManager for menu filtering

        // Element references
        this.priorityButtons = null;
        this.overflowButtons = null;
        this.overflowMenuBtn = null;
        this.hamburgerMenuBtn = null;
        this.dropdownMenu = null;

        // Bound event handlers
        this.boundMenuToggle = this.toggleMenu.bind(this);
        this.boundCloseMenu = this.closeMenu.bind(this);
        this.boundKeyHandler = this.handleKeyDown.bind(this);
        this.boundClickOutside = this.handleClickOutside.bind(this);
    }

    /**
     * Set EditModeManager reference for menu filtering
     * @param {EditModeManager} editModeManager - Edit mode manager instance
     */
    setEditModeManager(editModeManager) {
        this.editModeManager = editModeManager;
    }

    /**
     * Initialize the overflow manager
     */
    init() {
        console.log('[HeaderOverflowManager] Initializing...');

        // Get element references
        this.priorityButtons = Array.from(this.headerContainer.querySelectorAll('.rpg-priority-btn'));
        this.overflowButtons = Array.from(this.headerContainer.querySelectorAll('.rpg-overflow-btn'));
        this.overflowMenuBtn = this.headerContainer.querySelector('#rpg-dashboard-overflow-menu');
        this.hamburgerMenuBtn = this.headerContainer.querySelector('#rpg-dashboard-hamburger-menu');
        this.dropdownMenu = this.headerContainer.querySelector('#rpg-dashboard-dropdown-menu');

        if (!this.overflowMenuBtn || !this.hamburgerMenuBtn || !this.dropdownMenu) {
            console.error('[HeaderOverflowManager] Required elements not found');
            return;
        }

        // Set up menu toggle listeners
        this.overflowMenuBtn.addEventListener('click', this.boundMenuToggle);
        this.hamburgerMenuBtn.addEventListener('click', this.boundMenuToggle);

        // Set up resize observer
        this.setupResizeObserver();

        // Initial mode detection
        this.updateMode();

        console.log('[HeaderOverflowManager] Initialized');
    }

    /**
     * Set up ResizeObserver to monitor container width
     */
    setupResizeObserver() {
        this.resizeObserver = new ResizeObserver((entries) => {
            // Debounce resize events
            if (this.resizeTimeout) {
                clearTimeout(this.resizeTimeout);
            }

            this.resizeTimeout = setTimeout(() => {
                for (const entry of entries) {
                    const width = entry.contentRect.width;
                    this.handleResize(width);
                }
            }, this.options.debounceDelay);
        });

        this.resizeObserver.observe(this.headerContainer);
        console.log('[HeaderOverflowManager] ResizeObserver set up');
    }

    /**
     * Handle container resize
     * @param {number} width - Container width in pixels
     */
    handleResize(width) {
        let newMode = 'full';

        if (width < this.options.compactModeWidth) {
            newMode = 'compact';
        } else if (width < this.options.fullModeWidth) {
            newMode = 'overflow';
        }

        if (newMode !== this.currentMode) {
            console.log(`[HeaderOverflowManager] Mode change: ${this.currentMode} → ${newMode} (width: ${width}px)`);
            this.currentMode = newMode;
            this.updateMode();
        }
    }

    /**
     * Update UI based on current mode
     */
    updateMode() {
        // Close menu if open
        if (this.menuOpen) {
            this.closeMenu();
        }

        switch (this.currentMode) {
            case 'full':
                this.setFullMode();
                break;
            case 'overflow':
                this.setOverflowMode();
                break;
            case 'compact':
                this.setCompactMode();
                break;
        }
    }

    /**
     * Full Mode: Show all buttons except menu-only
     */
    setFullMode() {
        // Show all overflow buttons except menu-only ones
        this.overflowButtons.forEach(btn => {
            // Menu-only buttons always stay hidden (managed by menu)
            if (btn.classList.contains('rpg-menu-only-btn')) {
                btn.style.display = 'none';
                btn.dataset.wasVisible = 'true'; // Mark as available for menu
            } else {
                // Only show buttons that don't have inline display:none in the template
                const inlineStyle = btn.getAttribute('style');
                if (!inlineStyle || !inlineStyle.includes('display: none')) {
                    btn.style.display = '';
                }
                // Clear the wasVisible flag for non-menu-only buttons
                delete btn.dataset.wasVisible;
            }
        });

        // Hide menu buttons
        this.overflowMenuBtn.style.display = 'none';
        this.hamburgerMenuBtn.style.display = 'none';
    }

    /**
     * Overflow Mode: Priority buttons + "More" menu
     */
    setOverflowMode() {
        // Hide overflow buttons (will be in dropdown)
        // Store original visibility before hiding
        this.overflowButtons.forEach(btn => {
            // Menu-only buttons are always available in menu
            if (btn.classList.contains('rpg-menu-only-btn')) {
                btn.dataset.wasVisible = 'true';
            } else {
                const computedStyle = window.getComputedStyle(btn);
                btn.dataset.wasVisible = computedStyle.display !== 'none' ? 'true' : 'false';
            }
            btn.style.display = 'none';
        });

        // Show overflow menu button
        this.overflowMenuBtn.style.display = '';
        this.hamburgerMenuBtn.style.display = 'none';

        // Build menu with overflow buttons only
        this.buildDropdownMenu(false);
    }

    /**
     * Compact Mode: Priority buttons + Hamburger menu
     */
    setCompactMode() {
        // Hide all overflow buttons
        // Store original visibility before hiding
        this.overflowButtons.forEach(btn => {
            // Menu-only buttons are always available in menu
            if (btn.classList.contains('rpg-menu-only-btn')) {
                btn.dataset.wasVisible = 'true';
            } else {
                const computedStyle = window.getComputedStyle(btn);
                btn.dataset.wasVisible = computedStyle.display !== 'none' ? 'true' : 'false';
            }
            btn.style.display = 'none';
        });

        // Show hamburger menu button
        this.overflowMenuBtn.style.display = 'none';
        this.hamburgerMenuBtn.style.display = '';

        // Build menu with all buttons (including visible ones for context)
        this.buildDropdownMenu(true);
    }

    /**
     * Build dropdown menu content
     * @param {boolean} includeAll - Include priority buttons in menu
     */
    buildDropdownMenu(includeAll) {
        this.dropdownMenu.innerHTML = '';

        const buttonsToShow = includeAll
            ? [...this.overflowButtons]
            : this.overflowButtons;

        // Filter visible buttons (only include buttons that were visible before being hidden)
        // Also filter menu-only buttons based on edit mode state
        const isEditMode = this.editModeManager?.isEditMode || false;
        const visibleButtons = buttonsToShow.filter(btn => {
            // Check if button was marked as visible
            if (btn.dataset.wasVisible !== 'true') {
                return false;
            }

            // Menu-only buttons only show when in edit mode
            if (btn.classList.contains('rpg-menu-only-btn')) {
                return isEditMode;
            }

            return true;
        });

        if (visibleButtons.length === 0) {
            this.dropdownMenu.innerHTML = '<div class="rpg-dropdown-empty">No actions available</div>';
            return;
        }

        // Create menu items
        visibleButtons.forEach(btn => {
            const menuItem = this.createMenuItem(btn);
            this.dropdownMenu.appendChild(menuItem);
        });
    }

    /**
     * Create a menu item from a button
     * @param {HTMLElement} button - Button element to convert
     * @returns {HTMLElement} Menu item element
     */
    createMenuItem(button) {
        const item = document.createElement('button');
        item.className = 'rpg-dropdown-item';
        item.setAttribute('role', 'menuitem');

        // Copy icon
        const icon = button.querySelector('i');
        if (icon) {
            item.innerHTML = icon.outerHTML;
        }

        // Add label
        const label = document.createElement('span');
        label.textContent = button.getAttribute('title') || button.getAttribute('aria-label') || 'Action';
        item.appendChild(label);

        // Copy click handler
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            button.click();
            this.closeMenu();
        });

        return item;
    }

    /**
     * Toggle menu open/closed
     */
    toggleMenu() {
        if (this.menuOpen) {
            this.closeMenu();
        } else {
            this.openMenu();
        }
    }

    /**
     * Open dropdown menu
     */
    openMenu() {
        if (this.menuOpen) return;

        this.menuOpen = true;
        this.dropdownMenu.style.display = 'block';

        // Update aria-expanded
        const menuBtn = this.currentMode === 'compact' ? this.hamburgerMenuBtn : this.overflowMenuBtn;
        menuBtn.setAttribute('aria-expanded', 'true');

        // Add close listeners
        setTimeout(() => {
            document.addEventListener('click', this.boundClickOutside);
            document.addEventListener('keydown', this.boundKeyHandler);
        }, 10);

        // Focus first menu item
        const firstItem = this.dropdownMenu.querySelector('.rpg-dropdown-item');
        if (firstItem) {
            firstItem.focus();
        }

        console.log('[HeaderOverflowManager] Menu opened');
    }

    /**
     * Close dropdown menu
     */
    closeMenu() {
        if (!this.menuOpen) return;

        this.menuOpen = false;
        this.dropdownMenu.style.display = 'none';

        // Update aria-expanded
        this.overflowMenuBtn.setAttribute('aria-expanded', 'false');
        this.hamburgerMenuBtn.setAttribute('aria-expanded', 'false');

        // Remove close listeners
        document.removeEventListener('click', this.boundClickOutside);
        document.removeEventListener('keydown', this.boundKeyHandler);

        console.log('[HeaderOverflowManager] Menu closed');
    }

    /**
     * Handle click outside menu
     * @param {MouseEvent} e - Click event
     */
    handleClickOutside(e) {
        if (!this.dropdownMenu.contains(e.target) &&
            !this.overflowMenuBtn.contains(e.target) &&
            !this.hamburgerMenuBtn.contains(e.target)) {
            this.closeMenu();
        }
    }

    /**
     * Handle keyboard navigation
     * @param {KeyboardEvent} e - Keyboard event
     */
    handleKeyDown(e) {
        if (!this.menuOpen) return;

        switch (e.key) {
            case 'Escape':
                e.preventDefault();
                this.closeMenu();
                // Return focus to menu button
                const menuBtn = this.currentMode === 'compact' ? this.hamburgerMenuBtn : this.overflowMenuBtn;
                menuBtn.focus();
                break;

            case 'ArrowDown':
                e.preventDefault();
                this.focusNextItem();
                break;

            case 'ArrowUp':
                e.preventDefault();
                this.focusPreviousItem();
                break;

            case 'Home':
                e.preventDefault();
                this.focusFirstItem();
                break;

            case 'End':
                e.preventDefault();
                this.focusLastItem();
                break;
        }
    }

    /**
     * Focus management helpers
     */
    focusNextItem() {
        const items = Array.from(this.dropdownMenu.querySelectorAll('.rpg-dropdown-item'));
        const currentIndex = items.indexOf(document.activeElement);
        const nextIndex = (currentIndex + 1) % items.length;
        items[nextIndex]?.focus();
    }

    focusPreviousItem() {
        const items = Array.from(this.dropdownMenu.querySelectorAll('.rpg-dropdown-item'));
        const currentIndex = items.indexOf(document.activeElement);
        const prevIndex = currentIndex <= 0 ? items.length - 1 : currentIndex - 1;
        items[prevIndex]?.focus();
    }

    focusFirstItem() {
        const firstItem = this.dropdownMenu.querySelector('.rpg-dropdown-item');
        firstItem?.focus();
    }

    focusLastItem() {
        const items = this.dropdownMenu.querySelectorAll('.rpg-dropdown-item');
        items[items.length - 1]?.focus();
    }

    /**
     * Refresh menu (called when edit mode changes)
     */
    refresh() {
        console.log('[HeaderOverflowManager] Refreshing menu...');
        if (this.currentMode === 'overflow' || this.currentMode === 'compact') {
            this.buildDropdownMenu(this.currentMode === 'compact');
        }
    }

    /**
     * Destroy the overflow manager
     */
    destroy() {
        console.log('[HeaderOverflowManager] Destroying...');

        // Disconnect resize observer
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }

        // Clear timeout
        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
        }

        // Remove event listeners
        this.overflowMenuBtn?.removeEventListener('click', this.boundMenuToggle);
        this.hamburgerMenuBtn?.removeEventListener('click', this.boundMenuToggle);
        document.removeEventListener('click', this.boundClickOutside);
        document.removeEventListener('keydown', this.boundKeyHandler);

        // Close menu
        if (this.menuOpen) {
            this.closeMenu();
        }

        console.log('[HeaderOverflowManager] Destroyed');
    }
}
