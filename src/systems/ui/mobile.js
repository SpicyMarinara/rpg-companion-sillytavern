/**
 * Mobile UI Module
 * Handles mobile-specific UI functionality: FAB dragging, tabs, keyboard handling
 */

import { extensionSettings } from '../../core/state.js';
import { saveSettings } from '../../core/persistence.js';
import { closeMobilePanelWithAnimation, updateCollapseToggleIcon } from './layout.js';
import { setupDesktopTabs, removeDesktopTabs } from './desktop.js';

/**
 * Sets up the mobile toggle button (FAB) with drag functionality.
 * Handles touch/mouse events for positioning and panel toggling.
 */
export function setupMobileToggle() {
    const $mobileToggle = $('#rpg-mobile-toggle');
    const $panel = $('#rpg-companion-panel');
    const $overlay = $('<div class="rpg-mobile-overlay"></div>');

    // DIAGNOSTIC: Check if elements exist and log setup state
    console.log('[RPG Mobile] ========================================');
    console.log('[RPG Mobile] setupMobileToggle called');
    console.log('[RPG Mobile] Button exists:', $mobileToggle.length > 0, 'jQuery object:', $mobileToggle);
    console.log('[RPG Mobile] Panel exists:', $panel.length > 0);
    console.log('[RPG Mobile] Window width:', window.innerWidth);
    console.log('[RPG Mobile] Is mobile viewport (<=1000):', window.innerWidth <= 1000);
    console.log('[RPG Mobile] ========================================');

    if ($mobileToggle.length === 0) {
        console.error('[RPG Mobile] ERROR: Mobile toggle button not found in DOM!');
        console.error('[RPG Mobile] Cannot attach event handlers - button does not exist');
        return; // Exit early if button doesn't exist
    }

    // Load and apply saved FAB position
    if (extensionSettings.mobileFabPosition) {
        const pos = extensionSettings.mobileFabPosition;
        console.log('[RPG Mobile] Loading saved FAB position:', pos);

        // Apply saved position
        if (pos.top) $mobileToggle.css('top', pos.top);
        if (pos.right) $mobileToggle.css('right', pos.right);
        if (pos.bottom) $mobileToggle.css('bottom', pos.bottom);
        if (pos.left) $mobileToggle.css('left', pos.left);

        // Constrain to viewport after position is applied
        requestAnimationFrame(() => constrainFabToViewport());
    }

    // Touch/drag state
    let isDragging = false;
    let touchStartTime = 0;
    let touchStartX = 0;
    let touchStartY = 0;
    let buttonStartX = 0;
    let buttonStartY = 0;
    const LONG_PRESS_DURATION = 200; // ms to hold before enabling drag
    const MOVE_THRESHOLD = 10; // px to move before enabling drag
    let rafId = null; // RequestAnimationFrame ID for smooth updates
    let pendingX = null;
    let pendingY = null;

    // Update position using requestAnimationFrame for smooth rendering
    function updateFabPosition() {
        if (pendingX !== null && pendingY !== null) {
            $mobileToggle.css({
                left: pendingX + 'px',
                top: pendingY + 'px',
                right: 'auto',
                bottom: 'auto'
            });
            pendingX = null;
            pendingY = null;
        }
        rafId = null;
    }

    // Touch start - begin tracking
    $mobileToggle.on('touchstart', function(e) {
        const touch = e.originalEvent.touches[0];

        touchStartTime = Date.now();
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;

        const offset = $mobileToggle.offset();
        buttonStartX = offset.left;
        buttonStartY = offset.top;

        isDragging = false;
    });

    // Touch move - check if should start dragging
    $mobileToggle.on('touchmove', function(e) {
        const touch = e.originalEvent.touches[0];
        const deltaX = touch.clientX - touchStartX;
        const deltaY = touch.clientY - touchStartY;
        const timeSinceStart = Date.now() - touchStartTime;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        // Start dragging if held long enough OR moved far enough
        if (!isDragging && (timeSinceStart > LONG_PRESS_DURATION || distance > MOVE_THRESHOLD)) {
            isDragging = true;
            $mobileToggle.addClass('dragging'); // Disable transitions while dragging
        }

        if (isDragging) {
            e.preventDefault(); // Prevent scrolling while dragging

            // Calculate new position
            let newX = buttonStartX + deltaX;
            let newY = buttonStartY + deltaY;

            // Get button dimensions
            const buttonWidth = $mobileToggle.outerWidth();
            const buttonHeight = $mobileToggle.outerHeight();

            // Constrain to viewport with 10px padding
            const minX = 10;
            const maxX = window.innerWidth - buttonWidth - 10;
            const minY = 10;
            const maxY = window.innerHeight - buttonHeight - 10;

            newX = Math.max(minX, Math.min(maxX, newX));
            newY = Math.max(minY, Math.min(maxY, newY));

            // Store pending position and request animation frame for smooth update
            pendingX = newX;
            pendingY = newY;
            if (!rafId) {
                rafId = requestAnimationFrame(updateFabPosition);
            }
        }
    });

    // Mouse drag support for desktop
    let mouseDown = false;

    $mobileToggle.on('mousedown', function(e) {
        // Prevent default to avoid text selection
        e.preventDefault();

        touchStartTime = Date.now();
        touchStartX = e.clientX;
        touchStartY = e.clientY;

        const offset = $mobileToggle.offset();
        buttonStartX = offset.left;
        buttonStartY = offset.top;

        isDragging = false;
        mouseDown = true;
    });

    // Mouse move - only track if mouse is down
    $(document).on('mousemove', function(e) {
        if (!mouseDown) return;

        const deltaX = e.clientX - touchStartX;
        const deltaY = e.clientY - touchStartY;
        const timeSinceStart = Date.now() - touchStartTime;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        // Start dragging if held long enough OR moved far enough
        if (!isDragging && (timeSinceStart > LONG_PRESS_DURATION || distance > MOVE_THRESHOLD)) {
            isDragging = true;
            $mobileToggle.addClass('dragging'); // Disable transitions while dragging
        }

        if (isDragging) {
            e.preventDefault();

            // Calculate new position
            let newX = buttonStartX + deltaX;
            let newY = buttonStartY + deltaY;

            // Get button dimensions
            const buttonWidth = $mobileToggle.outerWidth();
            const buttonHeight = $mobileToggle.outerHeight();

            // Constrain to viewport with 10px padding
            const minX = 10;
            const maxX = window.innerWidth - buttonWidth - 10;
            const minY = 10;
            const maxY = window.innerHeight - buttonHeight - 10;

            newX = Math.max(minX, Math.min(maxX, newX));
            newY = Math.max(minY, Math.min(maxY, newY));

            // Store pending position and request animation frame for smooth update
            pendingX = newX;
            pendingY = newY;
            if (!rafId) {
                rafId = requestAnimationFrame(updateFabPosition);
            }
        }
    });

    // Mouse up - save position or let click handler toggle
    $(document).on('mouseup', function(e) {
        if (!mouseDown) return;

        mouseDown = false;

        if (isDragging) {
            // Was dragging - save new position
            const offset = $mobileToggle.offset();
            const newPosition = {
                left: offset.left + 'px',
                top: offset.top + 'px'
            };

            extensionSettings.mobileFabPosition = newPosition;
            saveSettings();

            console.log('[RPG Mobile] Saved new FAB position (mouse):', newPosition);

            // Constrain to viewport bounds (now that position is saved)
            setTimeout(() => constrainFabToViewport(), 10);

            // Re-enable transitions with smooth animation
            setTimeout(() => {
                $mobileToggle.removeClass('dragging');
            }, 50);

            isDragging = false;

            // Prevent click from firing after drag
            e.preventDefault();
            e.stopPropagation();

            // Add flag to prevent click handler from firing
            $mobileToggle.data('just-dragged', true);
            setTimeout(() => {
                $mobileToggle.data('just-dragged', false);
            }, 100);
        }
        // If not dragging, let the click handler toggle the panel
    });

    // Touch end - save position or toggle panel
    $mobileToggle.on('touchend', function(e) {
        // TEMPORARILY COMMENTED FOR DIAGNOSIS - might be blocking click fallback
        // e.preventDefault();

        if (isDragging) {
            // Was dragging - save new position
            const offset = $mobileToggle.offset();
            const newPosition = {
                left: offset.left + 'px',
                top: offset.top + 'px'
            };

            extensionSettings.mobileFabPosition = newPosition;
            saveSettings();

            console.log('[RPG Mobile] Saved new FAB position:', newPosition);

            // Constrain to viewport bounds (now that position is saved)
            setTimeout(() => constrainFabToViewport(), 10);

            // Re-enable transitions with smooth animation
            setTimeout(() => {
                $mobileToggle.removeClass('dragging');
            }, 50);

            isDragging = false;
        } else {
            // Was a tap - toggle panel
            console.log('[RPG Mobile] Quick tap detected - toggling panel');

            if ($panel.hasClass('rpg-mobile-open')) {
                // Close panel with animation
                closeMobilePanelWithAnimation();
            } else {
                // Open panel
                $panel.addClass('rpg-mobile-open');
                $('body').append($overlay);
                $mobileToggle.addClass('active');

                // Close when clicking overlay
                $overlay.on('click', function() {
                    closeMobilePanelWithAnimation();
                });
            }
        }
    });

    // Click handler - works on both mobile and desktop
    $mobileToggle.on('click', function(e) {
        // Skip if we just finished dragging
        if ($mobileToggle.data('just-dragged')) {
            console.log('[RPG Mobile] Click blocked - just finished dragging');
            return;
        }

        console.log('[RPG Mobile] >>> CLICK EVENT FIRED <<<', {
            windowWidth: window.innerWidth,
            isMobileViewport: window.innerWidth <= 1000,
            panelOpen: $panel.hasClass('rpg-mobile-open')
        });

        // Work on both mobile and desktop (removed viewport check)
        if ($panel.hasClass('rpg-mobile-open')) {
            console.log('[RPG Mobile] Click: Closing panel');
            closeMobilePanelWithAnimation();
        } else {
            console.log('[RPG Mobile] Click: Opening panel');
            $panel.addClass('rpg-mobile-open');
            $('body').append($overlay);
            $mobileToggle.addClass('active');

            $overlay.on('click', function() {
                console.log('[RPG Mobile] Overlay clicked - closing panel');
                closeMobilePanelWithAnimation();
            });
        }
    });

    // Handle viewport resize to manage desktop/mobile transitions
    let wasMobile = window.innerWidth <= 1000;
    let resizeTimer;

    $(window).on('resize', function() {
        clearTimeout(resizeTimer);

        const isMobile = window.innerWidth <= 1000;
        const $panel = $('#rpg-companion-panel');
        const $mobileToggle = $('#rpg-mobile-toggle');

        // Transitioning from desktop to mobile - handle immediately for smooth transition
        if (!wasMobile && isMobile) {
            console.log('[RPG Mobile] Transitioning desktop -> mobile');

            // Remove desktop tabs first
            removeDesktopTabs();

            // Remove desktop positioning classes
            $panel.removeClass('rpg-position-right rpg-position-left rpg-position-top');

            // Clear collapsed state - mobile doesn't use collapse
            $panel.removeClass('rpg-collapsed');

            // Close panel on mobile with animation
            closeMobilePanelWithAnimation();

            // Clear any inline styles that might be overriding CSS
            $panel.attr('style', '');

            console.log('[RPG Mobile] After cleanup:', {
                panelClasses: $panel.attr('class'),
                inlineStyles: $panel.attr('style'),
                panelPosition: {
                    top: $panel.css('top'),
                    bottom: $panel.css('bottom'),
                    transform: $panel.css('transform'),
                    visibility: $panel.css('visibility')
                }
            });

            // Set up mobile tabs IMMEDIATELY (no debounce delay)
            setupMobileTabs();

            // Update icon for mobile state
            updateCollapseToggleIcon();

            wasMobile = isMobile;
            return;
        }

        // For mobile to desktop transition, use debounce
        resizeTimer = setTimeout(function() {
            const isMobile = window.innerWidth <= 1000;

            // Transitioning from mobile to desktop
            if (wasMobile && !isMobile) {
                // Disable transitions to prevent left→right slide animation
                $panel.css('transition', 'none');

                $panel.removeClass('rpg-mobile-open rpg-mobile-closing');
                $mobileToggle.removeClass('active');
                $('.rpg-mobile-overlay').remove();

                // Restore desktop positioning class
                const position = extensionSettings.panelPosition || 'right';
                $panel.addClass('rpg-position-' + position);

                // Remove mobile tabs structure
                removeMobileTabs();

                // Setup desktop tabs
                setupDesktopTabs();

                // Force reflow to apply position instantly
                $panel[0].offsetHeight;

                // Re-enable transitions after positioned
                setTimeout(function() {
                    $panel.css('transition', '');
                }, 50);
            }

            wasMobile = isMobile;

            // Constrain FAB to viewport after resize (only if user has positioned it)
            constrainFabToViewport();
        }, 150); // Debounce only for mobile→desktop
    });

    // Initialize mobile tabs if starting on mobile
    const isMobile = window.innerWidth <= 1000;
    if (isMobile) {
        const $panel = $('#rpg-companion-panel');
        // Clear any inline styles
        $panel.attr('style', '');

        console.log('[RPG Mobile] Initial load on mobile viewport:', {
            panelClasses: $panel.attr('class'),
            inlineStyles: $panel.attr('style'),
            panelPosition: {
                top: $panel.css('top'),
                bottom: $panel.css('top'),
                transform: $panel.css('transform'),
                visibility: $panel.css('visibility')
            }
        });
        setupMobileTabs();
        // Set initial icon for mobile
        updateCollapseToggleIcon();
    }
}

/**
 * Constrains the mobile FAB button to viewport bounds with top-bar awareness.
 * Only runs when button is in user-controlled state (mobileFabPosition exists).
 * Ensures button never goes behind the top bar or outside viewport edges.
 */
export function constrainFabToViewport() {
    // Only constrain if user has set a custom position
    if (!extensionSettings.mobileFabPosition) {
        console.log('[RPG Mobile] Skipping viewport constraint - using CSS defaults');
        return;
    }

    const $mobileToggle = $('#rpg-mobile-toggle');
    if ($mobileToggle.length === 0) return;

    // Skip if button is not visible
    if (!$mobileToggle.is(':visible')) {
        console.log('[RPG Mobile] Skipping viewport constraint - button not visible');
        return;
    }

    // Get current position
    const offset = $mobileToggle.offset();
    if (!offset) return;

    let currentX = offset.left;
    let currentY = offset.top;

    const buttonWidth = $mobileToggle.outerWidth();
    const buttonHeight = $mobileToggle.outerHeight();

    // Get top bar height from CSS variable (fallback to 50px if not set)
    const topBarHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--topBarBlockSize')) || 50;

    // Calculate viewport bounds with padding
    // Use top bar height + extra padding for top bound
    const minX = 10;
    const maxX = window.innerWidth - buttonWidth - 10;
    const minY = topBarHeight + 60; // Top bar + extra space for visibility
    const maxY = window.innerHeight - buttonHeight - 10;

    // Constrain to bounds
    let newX = Math.max(minX, Math.min(maxX, currentX));
    let newY = Math.max(minY, Math.min(maxY, currentY));

    // Only update if position changed
    if (newX !== currentX || newY !== currentY) {
        console.log('[RPG Mobile] Constraining FAB to viewport:', {
            old: { x: currentX, y: currentY },
            new: { x: newX, y: newY },
            viewport: { width: window.innerWidth, height: window.innerHeight },
            topBarHeight
        });

        // Apply new position
        $mobileToggle.css({
            left: newX + 'px',
            top: newY + 'px',
            right: 'auto',
            bottom: 'auto'
        });

        // Save corrected position
        extensionSettings.mobileFabPosition = {
            left: newX + 'px',
            top: newY + 'px'
        };
        saveSettings();
    }
}

/**
 * Sets up mobile tab navigation for organizing content.
 * Only runs on mobile viewports (<=1000px).
 */
export function setupMobileTabs() {
    const isMobile = window.innerWidth <= 1000;
    if (!isMobile) return;

    // Check if tabs already exist
    if ($('.rpg-mobile-tabs').length > 0) return;

    const $panel = $('#rpg-companion-panel');
    const $contentBox = $panel.find('.rpg-content-box');

    // Get existing sections
    const $userStats = $('#rpg-user-stats');
    const $infoBox = $('#rpg-info-box');
    const $thoughts = $('#rpg-thoughts');
    const $inventory = $('#rpg-inventory');
    const $quests = $('#rpg-quests');

    // If no sections exist, nothing to organize
    if ($userStats.length === 0 && $infoBox.length === 0 && $thoughts.length === 0 && $inventory.length === 0 && $quests.length === 0) {
        return;
    }

    // Create tab navigation (3 tabs for mobile)
    const tabs = [];
    const hasStats = $userStats.length > 0;
    const hasInfo = $infoBox.length > 0 || $thoughts.length > 0;
    const hasInventory = $inventory.length > 0;
    const hasQuests = $quests.length > 0;

    // Tab 1: Stats (User Stats only)
    if (hasStats) {
        tabs.push('<button class="rpg-mobile-tab active" data-tab="stats"><i class="fa-solid fa-chart-bar"></i><span>Stats</span></button>');
    }
    // Tab 2: Info (Info Box + Character Thoughts)
    if (hasInfo) {
        tabs.push('<button class="rpg-mobile-tab ' + (tabs.length === 0 ? 'active' : '') + '" data-tab="info"><i class="fa-solid fa-book"></i><span>Info</span></button>');
    }
    // Tab 3: Inventory
    if (hasInventory) {
        tabs.push('<button class="rpg-mobile-tab ' + (tabs.length === 0 ? 'active' : '') + '" data-tab="inventory"><i class="fa-solid fa-box"></i><span>Inventory</span></button>');
    }
    // Tab 4: Quests
    if (hasQuests) {
        tabs.push('<button class="rpg-mobile-tab ' + (tabs.length === 0 ? 'active' : '') + '" data-tab="quests"><i class="fa-solid fa-scroll"></i><span>Quests</span></button>');
    }

    const $tabNav = $('<div class="rpg-mobile-tabs">' + tabs.join('') + '</div>');

    // Determine which tab should be active
    let firstTab = '';
    if (hasStats) firstTab = 'stats';
    else if (hasInfo) firstTab = 'info';
    else if (hasInventory) firstTab = 'inventory';
    else if (hasQuests) firstTab = 'quests';

    // Create tab content wrappers
    const $statsTab = $('<div class="rpg-mobile-tab-content ' + (firstTab === 'stats' ? 'active' : '') + '" data-tab-content="stats"></div>');
    const $infoTab = $('<div class="rpg-mobile-tab-content ' + (firstTab === 'info' ? 'active' : '') + '" data-tab-content="info"></div>');
    const $inventoryTab = $('<div class="rpg-mobile-tab-content ' + (firstTab === 'inventory' ? 'active' : '') + '" data-tab-content="inventory"></div>');
    const $questsTab = $('<div class="rpg-mobile-tab-content ' + (firstTab === 'quests' ? 'active' : '') + '" data-tab-content="quests"></div>');

    // Move sections into their respective tabs (detach to preserve event handlers)
    // Stats tab: User Stats only
    if ($userStats.length > 0) {
        $statsTab.append($userStats.detach());
        $userStats.show();
    }

    // Info tab: Info Box + Character Thoughts
    if ($infoBox.length > 0) {
        $infoTab.append($infoBox.detach());
        $infoBox.show();
    }
    if ($thoughts.length > 0) {
        $infoTab.append($thoughts.detach());
        $thoughts.show();
    }

    // Inventory tab: Inventory only
    if ($inventory.length > 0) {
        $inventoryTab.append($inventory.detach());
        $inventory.show();
    }

    // Quests tab: Quests only
    if ($quests.length > 0) {
        $questsTab.append($quests.detach());
        $quests.show();
    }

    // Hide dividers on mobile
    $('.rpg-divider').hide();

    // Build mobile tab structure
    const $mobileContainer = $('<div class="rpg-mobile-container"></div>');
    $mobileContainer.append($tabNav);

    // Only append tab content wrappers that have content
    if (hasStats) $mobileContainer.append($statsTab);
    if (hasInfo) $mobileContainer.append($infoTab);
    if (hasInventory) $mobileContainer.append($inventoryTab);
    if (hasQuests) $mobileContainer.append($questsTab);
    if (hasInventory) $mobileContainer.append($inventoryTab);

    // Insert mobile tab structure at the beginning of content box
    $contentBox.prepend($mobileContainer);

    // Handle tab switching
    $tabNav.find('.rpg-mobile-tab').on('click', function() {
        const tabName = $(this).data('tab');

        // Update active tab button
        $tabNav.find('.rpg-mobile-tab').removeClass('active');
        $(this).addClass('active');

        // Update active tab content
        $mobileContainer.find('.rpg-mobile-tab-content').removeClass('active');
        $mobileContainer.find('[data-tab-content="' + tabName + '"]').addClass('active');
    });
}

/**
 * Removes mobile tab navigation and restores desktop layout.
 */
export function removeMobileTabs() {
    // Get sections from tabs before removing
    const $userStats = $('#rpg-user-stats').detach();
    const $infoBox = $('#rpg-info-box').detach();
    const $thoughts = $('#rpg-thoughts').detach();
    const $inventory = $('#rpg-inventory').detach();
    const $quests = $('#rpg-quests').detach();

    // Remove mobile tab container
    $('.rpg-mobile-container').remove();

    // Get dividers
    const $dividerStats = $('#rpg-divider-stats');
    const $dividerInfo = $('#rpg-divider-info');
    const $dividerThoughts = $('#rpg-divider-thoughts');

    // Restore original sections to content box in correct order
    const $contentBox = $('.rpg-content-box');

    // Re-insert sections in original order: User Stats, Info Box, Thoughts, Inventory, Quests
    if ($dividerStats.length) {
        $dividerStats.before($userStats);
        $dividerInfo.before($infoBox);
        $dividerThoughts.before($thoughts);
        $contentBox.append($inventory);
        $contentBox.append($quests);
    } else {
        // Fallback if dividers don't exist
        $contentBox.prepend($quests);
        $contentBox.prepend($inventory);
        $contentBox.prepend($thoughts);
        $contentBox.prepend($infoBox);
        $contentBox.prepend($userStats);
    }

    // Show sections and dividers
    $userStats.show();
    $infoBox.show();
    $thoughts.show();
    $inventory.show();
    $('.rpg-divider').show();
}

/**
 * Sets up mobile keyboard handling using Visual Viewport API.
 * Prevents layout squashing when keyboard appears by detecting
 * viewport changes and adding CSS classes for adjustment.
 */
export function setupMobileKeyboardHandling() {
    if (!window.visualViewport) {
        // console.log('[RPG Mobile] Visual Viewport API not supported');
        return;
    }

    const $panel = $('#rpg-companion-panel');
    let keyboardVisible = false;

    // Listen for viewport resize (keyboard show/hide)
    window.visualViewport.addEventListener('resize', () => {
        // Only handle if panel is open on mobile
        if (!$panel.hasClass('rpg-mobile-open')) return;

        const viewportHeight = window.visualViewport.height;
        const windowHeight = window.innerHeight;

        // Keyboard visible if viewport significantly smaller than window
        // Using 75% threshold to account for browser UI variations
        const isKeyboardShowing = viewportHeight < windowHeight * 0.75;

        if (isKeyboardShowing && !keyboardVisible) {
            // Keyboard just appeared
            keyboardVisible = true;
            $panel.addClass('rpg-keyboard-visible');
            // console.log('[RPG Mobile] Keyboard opened');
        } else if (!isKeyboardShowing && keyboardVisible) {
            // Keyboard just disappeared
            keyboardVisible = false;
            $panel.removeClass('rpg-keyboard-visible');
            // console.log('[RPG Mobile] Keyboard closed');
        }
    });
}

/**
 * Handles focus on contenteditable fields to ensure they're visible when keyboard appears.
 * Uses smooth scrolling to bring focused field into view with proper padding.
 */
export function setupContentEditableScrolling() {
    const $panel = $('#rpg-companion-panel');

    // Use event delegation for all contenteditable fields
    $panel.on('focusin', '[contenteditable="true"]', function(e) {
        const $field = $(this);

        // Small delay to let keyboard animate in
        setTimeout(() => {
            // Scroll field into view with padding
            // Using 'center' to ensure field is in middle of viewport
            $field[0].scrollIntoView({
                behavior: 'smooth',
                block: 'center',
                inline: 'nearest'
            });
        }, 300);
    });
}

/**
 * Sets up the mobile refresh button with drag functionality.
 * Same pattern as mobile toggle button.
 * Tap = refresh, drag = reposition
 */
export function setupRefreshButtonDrag() {
    const $refreshBtn = $('#rpg-manual-update-mobile');

    if ($refreshBtn.length === 0) {
        console.warn('[RPG Mobile] Refresh button not found in DOM');
        return;
    }

    console.log('[RPG Mobile] setupRefreshButtonDrag called');

    // Load and apply saved position
    if (extensionSettings.mobileRefreshPosition) {
        const pos = extensionSettings.mobileRefreshPosition;
        console.log('[RPG Mobile] Loading saved refresh button position:', pos);

        // Apply saved position
        if (pos.top) $refreshBtn.css('top', pos.top);
        if (pos.right) $refreshBtn.css('right', pos.right);
        if (pos.bottom) $refreshBtn.css('bottom', pos.bottom);
        if (pos.left) $refreshBtn.css('left', pos.left);

        // Constrain to viewport after position is applied
        requestAnimationFrame(() => constrainFabToViewport($refreshBtn));
    }

    // Touch/drag state
    let isDragging = false;
    let touchStartTime = 0;
    let touchStartX = 0;
    let touchStartY = 0;
    let buttonStartX = 0;
    let buttonStartY = 0;
    const LONG_PRESS_DURATION = 200;
    const MOVE_THRESHOLD = 10;
    let rafId = null;
    let pendingX = null;
    let pendingY = null;

    // Update position using requestAnimationFrame
    function updatePosition() {
        if (pendingX !== null && pendingY !== null) {
            $refreshBtn.css({
                left: pendingX + 'px',
                top: pendingY + 'px',
                right: 'auto',
                bottom: 'auto'
            });
            pendingX = null;
            pendingY = null;
        }
        rafId = null;
    }

    // Touch start
    $refreshBtn.on('touchstart', function(e) {
        const touch = e.originalEvent.touches[0];
        touchStartTime = Date.now();
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;

        const offset = $refreshBtn.offset();
        buttonStartX = offset.left;
        buttonStartY = offset.top;

        isDragging = false;
    });

    // Touch move
    $refreshBtn.on('touchmove', function(e) {
        const touch = e.originalEvent.touches[0];
        const deltaX = touch.clientX - touchStartX;
        const deltaY = touch.clientY - touchStartY;
        const timeSinceStart = Date.now() - touchStartTime;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        if (!isDragging && (timeSinceStart > LONG_PRESS_DURATION || distance > MOVE_THRESHOLD)) {
            isDragging = true;
            $refreshBtn.addClass('dragging');
        }

        if (isDragging) {
            e.preventDefault();

            let newX = buttonStartX + deltaX;
            let newY = buttonStartY + deltaY;

            const buttonWidth = $refreshBtn.outerWidth();
            const buttonHeight = $refreshBtn.outerHeight();

            const minX = 10;
            const maxX = window.innerWidth - buttonWidth - 10;
            const minY = 10;
            const maxY = window.innerHeight - buttonHeight - 10;

            newX = Math.max(minX, Math.min(maxX, newX));
            newY = Math.max(minY, Math.min(maxY, newY));

            pendingX = newX;
            pendingY = newY;
            if (!rafId) {
                rafId = requestAnimationFrame(updatePosition);
            }
        }
    });

    // Touch end
    $refreshBtn.on('touchend', function(e) {
        if (isDragging) {
            // Save new position
            const offset = $refreshBtn.offset();
            const newPosition = {
                left: offset.left + 'px',
                top: offset.top + 'px'
            };

            extensionSettings.mobileRefreshPosition = newPosition;
            saveSettings();

            setTimeout(() => {
                $refreshBtn.removeClass('dragging');
            }, 50);

            // Set flag to prevent click handler from firing
            $refreshBtn.data('just-dragged', true);
            setTimeout(() => {
                $refreshBtn.data('just-dragged', false);
            }, 100);

            isDragging = false;
        }
    });

    // Mouse support for desktop
    let mouseDown = false;

    $refreshBtn.on('mousedown', function(e) {
        e.preventDefault();
        touchStartTime = Date.now();
        touchStartX = e.clientX;
        touchStartY = e.clientY;

        const offset = $refreshBtn.offset();
        buttonStartX = offset.left;
        buttonStartY = offset.top;

        mouseDown = true;
        isDragging = false;
    });

    $(document).on('mousemove', function(e) {
        if (!mouseDown) return;

        const deltaX = e.clientX - touchStartX;
        const deltaY = e.clientY - touchStartY;
        const timeSinceStart = Date.now() - touchStartTime;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        if (!isDragging && (timeSinceStart > LONG_PRESS_DURATION || distance > MOVE_THRESHOLD)) {
            isDragging = true;
            $refreshBtn.addClass('dragging');
        }

        if (isDragging) {
            let newX = buttonStartX + deltaX;
            let newY = buttonStartY + deltaY;

            const buttonWidth = $refreshBtn.outerWidth();
            const buttonHeight = $refreshBtn.outerHeight();

            const minX = 10;
            const maxX = window.innerWidth - buttonWidth - 10;
            const minY = 10;
            const maxY = window.innerHeight - buttonHeight - 10;

            newX = Math.max(minX, Math.min(maxX, newX));
            newY = Math.max(minY, Math.min(maxY, newY));

            pendingX = newX;
            pendingY = newY;
            if (!rafId) {
                rafId = requestAnimationFrame(updatePosition);
            }
        }
    });

    $(document).on('mouseup', function(e) {
        if (mouseDown && isDragging) {
            const offset = $refreshBtn.offset();
            const newPosition = {
                left: offset.left + 'px',
                top: offset.top + 'px'
            };

            extensionSettings.mobileRefreshPosition = newPosition;
            saveSettings();

            setTimeout(() => {
                $refreshBtn.removeClass('dragging');
            }, 50);

            $refreshBtn.data('just-dragged', true);
            setTimeout(() => {
                $refreshBtn.data('just-dragged', false);
            }, 100);
        }

        mouseDown = false;
        isDragging = false;
    });
}

/**
 * Sets up drag functionality for the debug toggle FAB button
 * Same pattern as refresh button drag
 */
export function setupDebugButtonDrag() {
    const $debugBtn = $('#rpg-debug-toggle');

    if ($debugBtn.length === 0) {
        console.warn('[RPG Mobile] Debug button not found in DOM');
        return;
    }

    console.log('[RPG Mobile] setupDebugButtonDrag called');

    // Load and apply saved position
    if (extensionSettings.debugFabPosition) {
        const pos = extensionSettings.debugFabPosition;
        console.log('[RPG Mobile] Loading saved debug button position:', pos);

        // Apply saved position
        if (pos.top) $debugBtn.css('top', pos.top);
        if (pos.right) $debugBtn.css('right', pos.right);
        if (pos.bottom) $debugBtn.css('bottom', pos.bottom);
        if (pos.left) $debugBtn.css('left', pos.left);

        // Constrain to viewport after position is applied
        requestAnimationFrame(() => constrainFabToViewport($debugBtn));
    }

    // Touch/drag state
    let isDragging = false;
    let touchStartTime = 0;
    let touchStartX = 0;
    let touchStartY = 0;
    let buttonStartX = 0;
    let buttonStartY = 0;
    const LONG_PRESS_DURATION = 200;
    const MOVE_THRESHOLD = 10;
    let rafId = null;
    let pendingX = null;
    let pendingY = null;

    // Update position using requestAnimationFrame
    function updatePosition() {
        if (pendingX !== null && pendingY !== null) {
            $debugBtn.css({
                left: pendingX + 'px',
                top: pendingY + 'px',
                right: 'auto',
                bottom: 'auto'
            });
            pendingX = null;
            pendingY = null;
        }
        rafId = null;
    }

    // Touch start
    $debugBtn.on('touchstart', function(e) {
        const touch = e.originalEvent.touches[0];
        touchStartTime = Date.now();
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;

        const offset = $debugBtn.offset();
        buttonStartX = offset.left;
        buttonStartY = offset.top;

        isDragging = false;
    });

    // Touch move
    $debugBtn.on('touchmove', function(e) {
        const touch = e.originalEvent.touches[0];
        const deltaX = touch.clientX - touchStartX;
        const deltaY = touch.clientY - touchStartY;
        const timeSinceStart = Date.now() - touchStartTime;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        if (!isDragging && (timeSinceStart > LONG_PRESS_DURATION || distance > MOVE_THRESHOLD)) {
            isDragging = true;
            $debugBtn.addClass('dragging');
        }

        if (isDragging) {
            e.preventDefault();

            let newX = buttonStartX + deltaX;
            let newY = buttonStartY + deltaY;

            const buttonWidth = $debugBtn.outerWidth();
            const buttonHeight = $debugBtn.outerHeight();

            const minX = 10;
            const maxX = window.innerWidth - buttonWidth - 10;
            const minY = 10;
            const maxY = window.innerHeight - buttonHeight - 10;

            newX = Math.max(minX, Math.min(maxX, newX));
            newY = Math.max(minY, Math.min(maxY, newY));

            pendingX = newX;
            pendingY = newY;
            if (!rafId) {
                rafId = requestAnimationFrame(updatePosition);
            }
        }
    });

    // Touch end
    $debugBtn.on('touchend', function(e) {
        if (isDragging) {
            // Save new position
            const offset = $debugBtn.offset();
            const newPosition = {
                left: offset.left + 'px',
                top: offset.top + 'px'
            };

            extensionSettings.debugFabPosition = newPosition;
            saveSettings();

            setTimeout(() => {
                $debugBtn.removeClass('dragging');
            }, 50);

            // Set flag to prevent click handler from firing
            $debugBtn.data('just-dragged', true);
            setTimeout(() => {
                $debugBtn.data('just-dragged', false);
            }, 100);

            isDragging = false;
        }
    });

    // Mouse support for desktop
    let mouseDown = false;

    $debugBtn.on('mousedown', function(e) {
        e.preventDefault();
        touchStartTime = Date.now();
        touchStartX = e.clientX;
        touchStartY = e.clientY;

        const offset = $debugBtn.offset();
        buttonStartX = offset.left;
        buttonStartY = offset.top;

        mouseDown = true;
        isDragging = false;
    });

    $(document).on('mousemove.rpgDebugDrag', function(e) {
        if (!mouseDown) return;

        const deltaX = e.clientX - touchStartX;
        const deltaY = e.clientY - touchStartY;
        const timeSinceStart = Date.now() - touchStartTime;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        if (!isDragging && (timeSinceStart > LONG_PRESS_DURATION || distance > MOVE_THRESHOLD)) {
            isDragging = true;
            $debugBtn.addClass('dragging');
        }

        if (isDragging) {
            let newX = buttonStartX + deltaX;
            let newY = buttonStartY + deltaY;

            const buttonWidth = $debugBtn.outerWidth();
            const buttonHeight = $debugBtn.outerHeight();

            const minX = 10;
            const maxX = window.innerWidth - buttonWidth - 10;
            const minY = 10;
            const maxY = window.innerHeight - buttonHeight - 10;

            newX = Math.max(minX, Math.min(maxX, newX));
            newY = Math.max(minY, Math.min(maxY, newY));

            pendingX = newX;
            pendingY = newY;
            if (!rafId) {
                rafId = requestAnimationFrame(updatePosition);
            }
        }
    });

    $(document).on('mouseup.rpgDebugDrag', function(e) {
        if (mouseDown && isDragging) {
            const offset = $debugBtn.offset();
            const newPosition = {
                left: offset.left + 'px',
                top: offset.top + 'px'
            };

            extensionSettings.debugFabPosition = newPosition;
            saveSettings();

            setTimeout(() => {
                $debugBtn.removeClass('dragging');
            }, 50);

            $debugBtn.data('just-dragged', true);
            setTimeout(() => {
                $debugBtn.data('just-dragged', false);
            }, 100);
        }

        mouseDown = false;
        isDragging = false;
    });
}
