/**
 * Mobile UI Module
 * Handles mobile-specific UI functionality: FAB dragging, tabs, keyboard handling
 */

import { extensionSettings, committedTrackerData, lastGeneratedData } from '../../core/state.js';
import { saveSettings } from '../../core/persistence.js';
import { closeMobilePanelWithAnimation, updateCollapseToggleIcon } from './layout.js';
import { setupDesktopTabs, removeDesktopTabs } from './desktop.js';
import { i18n } from '../../core/i18n.js';
import { hexToRgba } from './theme.js';

/**
 * Updates the text labels of the mobile navigation tabs based on the current language.
 */
export function updateMobileTabLabels() {
    const $tabs = $('.rpg-mobile-tabs .rpg-mobile-tab');
    if ($tabs.length === 0) return;

    $tabs.each(function() {
        const $tab = $(this);
        const tabName = $tab.data('tab');
        let translationKey = '';

        switch (tabName) {
            case 'stats':
                translationKey = 'global.status';
                break;
            case 'info':
                translationKey = 'global.info';
                break;
            case 'inventory':
                translationKey = 'global.inventory';
                break;
            case 'quests':
                translationKey = 'global.quests';
                break;
        }

        if (translationKey) {
            const translation = i18n.getTranslation(translationKey);
            if (translation) {
                $tab.find('span').text(translation);
            }
        }
    });
}

/**
 * Sets up the mobile toggle button (FAB) with drag functionality.
 * Handles touch/mouse events for positioning and panel toggling.
 */
export function setupMobileToggle() {
    const $mobileToggle = $('#rpg-mobile-toggle');
    const $panel = $('#rpg-companion-panel');
    const $overlay = $('<div class="rpg-mobile-overlay"></div>');

    // DIAGNOSTIC: Check if elements exist and log setup state
    // console.log('[RPG Mobile] ========================================');
    // console.log('[RPG Mobile] setupMobileToggle called');
    // console.log('[RPG Mobile] Button exists:', $mobileToggle.length > 0, 'jQuery object:', $mobileToggle);
    // console.log('[RPG Mobile] Panel exists:', $panel.length > 0);
    // console.log('[RPG Mobile] Window width:', window.innerWidth);
    // console.log('[RPG Mobile] Is mobile viewport (<=1000):', window.innerWidth <= 1000);
    // console.log('[RPG Mobile] ========================================');

    if ($mobileToggle.length === 0) {
        console.error('[RPG Mobile] ERROR: Mobile toggle button not found in DOM!');
        console.error('[RPG Mobile] Cannot attach event handlers - button does not exist');
        return; // Exit early if button doesn't exist
    }

    // Load and apply saved FAB position
    if (extensionSettings.mobileFabPosition) {
        const pos = extensionSettings.mobileFabPosition;
        // console.log('[RPG Mobile] Loading saved FAB position:', pos);

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
            // Also update widget container position during drag
            const $container = $('#rpg-fab-widget-container');
            if ($container.length > 0) {
                $container.css({
                    top: pendingY + 'px',
                    left: pendingX + 'px'
                });
            }
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

            // console.log('[RPG Mobile] Saved new FAB position (mouse):', newPosition);

            // Constrain to viewport bounds (now that position is saved)
            setTimeout(() => {
                constrainFabToViewport();
                updateFabWidgetPosition(); // Update widget container position
            }, 10);

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

            // console.log('[RPG Mobile] Saved new FAB position:', newPosition);

            // Constrain to viewport bounds (now that position is saved)
            setTimeout(() => {
                constrainFabToViewport();
                updateFabWidgetPosition(); // Update widget container position
            }, 10);

            // Re-enable transitions with smooth animation
            setTimeout(() => {
                $mobileToggle.removeClass('dragging');
            }, 50);

            isDragging = false;
        } else {
            // Was a tap - toggle panel
            // console.log('[RPG Mobile] Quick tap detected - toggling panel');

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
            // console.log('[RPG Mobile] Click blocked - just finished dragging');
            return;
        }

        // console.log('[RPG Mobile] >>> CLICK EVENT FIRED <<<', {
        //     windowWidth: window.innerWidth,
        //     isMobileViewport: window.innerWidth <= 1000,
        //     panelOpen: $panel.hasClass('rpg-mobile-open')
        // });

        // Work on both mobile and desktop (removed viewport check)
        if ($panel.hasClass('rpg-mobile-open')) {
            // console.log('[RPG Mobile] Click: Closing panel');
            closeMobilePanelWithAnimation();
        } else {
            // console.log('[RPG Mobile] Click: Opening panel');
            $panel.addClass('rpg-mobile-open');
            $('body').append($overlay);
            $mobileToggle.addClass('active');

            $overlay.on('click', function() {
                // console.log('[RPG Mobile] Overlay clicked - closing panel');
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
            // console.log('[RPG Mobile] Transitioning desktop -> mobile');

            // Show mobile toggle button
            $mobileToggle.show();

            // Remove desktop tabs first
            removeDesktopTabs();

            // Apply mobile positioning based on panelPosition setting
            $panel.removeClass('rpg-position-right rpg-position-left rpg-position-top');
            $('body').removeClass('rpg-panel-position-right rpg-panel-position-left rpg-panel-position-top');
            const position = extensionSettings.panelPosition || 'right';
            $panel.addClass('rpg-position-' + position);
            $('body').addClass('rpg-panel-position-' + position);

            // Clear collapsed state - mobile doesn't use collapse
            $panel.removeClass('rpg-collapsed');

            // Close panel on mobile with animation
            closeMobilePanelWithAnimation();

            // Clear any inline styles that might be overriding CSS
            $panel.attr('style', '');

            // console.log('[RPG Mobile] After cleanup:', {
            //     panelClasses: $panel.attr('class'),
            //     inlineStyles: $panel.attr('style'),
            //     panelPosition: {
            //         top: $panel.css('top'),
            //         bottom: $panel.css('bottom'),
            //         transform: $panel.css('transform'),
            //         visibility: $panel.css('visibility')
            //     }
            // });

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

                // Hide mobile toggle button on desktop
                $mobileToggle.hide();

                // Restore desktop positioning class and remove body mobile classes
                $('body').removeClass('rpg-panel-position-right rpg-panel-position-left rpg-panel-position-top');
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

        // console.log('[RPG Mobile] Initial load on mobile viewport:', {
        //     panelClasses: $panel.attr('class'),
        //     inlineStyles: $panel.attr('style'),
        //     panelPosition: {
        //         top: $panel.css('top'),
        //         bottom: $panel.css('top'),
        //         transform: $panel.css('transform'),
        //         visibility: $panel.css('visibility')\n        //     }\n        // });\n        setupMobileTabs();
        // Set initial icon for mobile
        updateCollapseToggleIcon();
        // Show mobile toggle on mobile viewport
        $mobileToggle.show();
    } else {
        // Hide mobile toggle on desktop viewport
        $mobileToggle.hide();
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
        // console.log('[RPG Mobile] Skipping viewport constraint - using CSS defaults');
        return;
    }

    const $mobileToggle = $('#rpg-mobile-toggle');
    if ($mobileToggle.length === 0) return;

    // Skip if button is not visible
    if (!$mobileToggle.is(':visible')) {
        // console.log('[RPG Mobile] Skipping viewport constraint - button not visible');
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
        // console.log('[RPG Mobile] Constraining FAB to viewport:', {
        //     old: { x: currentX, y: currentY },
        //     new: { x: newX, y: newY },
        //     viewport: { width: window.innerWidth, height: window.innerHeight },
        //     topBarHeight
        // });

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

    // Apply mobile positioning based on panelPosition setting
    $panel.removeClass('rpg-position-right rpg-position-left rpg-position-top');
    $('body').removeClass('rpg-panel-position-right rpg-panel-position-left rpg-panel-position-top');
    const position = extensionSettings.panelPosition || 'right';
    $panel.addClass('rpg-position-' + position);
    $('body').addClass('rpg-panel-position-' + position);

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
    const hasInventory = $inventory.length > 0 && extensionSettings.showInventory;
    const hasQuests = $quests.length > 0 && extensionSettings.showQuests;

    // Tab 1: Stats (User Stats only)
    if (hasStats) {
        tabs.push('<button class="rpg-mobile-tab active" data-tab="stats"><i class="fa-solid fa-chart-bar"></i><span>' + i18n.getTranslation('global.status') + '</span></button>');
    }
    // Tab 2: Info (Info Box + Character Thoughts)
    if (hasInfo) {
        tabs.push('<button class="rpg-mobile-tab ' + (tabs.length === 0 ? 'active' : '') + '" data-tab="info"><i class="fa-solid fa-book"></i><span>' + i18n.getTranslation('global.info') + '</span></button>');
    }
    // Tab 3: Inventory
    if (hasInventory) {
        tabs.push('<button class="rpg-mobile-tab ' + (tabs.length === 0 ? 'active' : '') + '" data-tab="inventory"><i class="fa-solid fa-box"></i><span>' + i18n.getTranslation('global.inventory') + '</span></button>');
    }
    // Tab 4: Quests
    if (hasQuests) {
        tabs.push('<button class="rpg-mobile-tab ' + (tabs.length === 0 ? 'active' : '') + '" data-tab="quests"><i class="fa-solid fa-scroll"></i><span>' + i18n.getTranslation('global.quests') + '</span></button>');
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
        // Only show if has data
        const infoBoxData = window.lastGeneratedData?.infoBox || window.committedTrackerData?.infoBox;
        if (infoBoxData) $infoBox.show();
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

    // Always append all tab content wrappers to preserve elements
    // Tab buttons control visibility
    $mobileContainer.append($statsTab);
    $mobileContainer.append($infoTab);
    $mobileContainer.append($inventoryTab);
    $mobileContainer.append($questsTab);

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

    // Show/hide sections based on settings (respect visibility settings)
    if (extensionSettings.showUserStats) $userStats.show();
    if (extensionSettings.showInfoBox) {
        const infoBoxData = window.lastGeneratedData?.infoBox || window.committedTrackerData?.infoBox;
        if (infoBoxData) $infoBox.show();
    }
    if (extensionSettings.showCharacterThoughts) $thoughts.show();
    if (extensionSettings.showInventory) $inventory.show();
    if (extensionSettings.showQuests) $quests.show();
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

    // console.log('[RPG Mobile] setupRefreshButtonDrag called');

    // Load and apply saved position
    if (extensionSettings.mobileRefreshPosition) {
        const pos = extensionSettings.mobileRefreshPosition;
        // console.log('[RPG Mobile] Loading saved refresh button position:', pos);

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

    // console.log('[RPG Mobile] setupDebugButtonDrag called');

    // Load and apply saved position
    if (extensionSettings.debugFabPosition) {
        const pos = extensionSettings.debugFabPosition;
        // console.log('[RPG Mobile] Loading saved debug button position:', pos);

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

// ============================================
// FAB WIDGETS - Info display around FAB button
// ============================================

/**
 * Updates the FAB widgets display based on current tracker data and settings.
 * Widgets are positioned in 8 positions around the FAB (N, NE, E, SE, S, SW, W, NW).
 */
export function updateFabWidgets() {
    const $fab = $('#rpg-mobile-toggle');
    if ($fab.length === 0) return;

    // Remove existing widget container and clean up event listeners
    $('#rpg-fab-widget-container').remove();
    $(document).off('click.fabWidgets touchstart.fabWidgets');

    // Check if widgets are enabled
    const widgetSettings = extensionSettings.mobileFabWidgets;
    if (!widgetSettings || !widgetSettings.enabled) return;

    // Don't show widgets on desktop or when panel is open
    if (window.innerWidth > 1000) return;

    // Get tracker data - prefer lastGeneratedData (most recent) over committedTrackerData
    const infoBox = lastGeneratedData?.infoBox || committedTrackerData?.infoBox;
    const userStats = lastGeneratedData?.userStats || committedTrackerData?.userStats;

    // Parse infoBox if it's a string
    let infoData = null;
    if (infoBox) {
        try {
            infoData = typeof infoBox === 'string' ? JSON.parse(infoBox) : infoBox;
        } catch (e) {
            console.warn('[RPG FAB Widgets] Failed to parse infoBox:', e);
        }
    }

    // Parse userStats if it's a string
    let statsData = null;
    if (userStats) {
        try {
            statsData = typeof userStats === 'string' ? JSON.parse(userStats) : userStats;
        } catch (e) {
            console.warn('[RPG FAB Widgets] Failed to parse userStats:', e);
        }
    }

    // Create widget container positioned at FAB location
    const fabOffset = $fab.offset();
    const fabWidth = $fab.outerWidth();
    const fabHeight = $fab.outerHeight();

    const $container = $('<div id="rpg-fab-widget-container" class="rpg-fab-widget-container"></div>');
    $container.css({
        top: fabOffset.top + 'px',
        left: fabOffset.left + 'px',
        width: fabWidth + 'px',
        height: fabHeight + 'px'
    });

    // Build widgets based on settings - auto-assign positions sequentially
    const widgets = [];

    // Collect enabled widgets in display priority order
    // Large widgets (Stats, Attributes) go to West/Northwest
    // Small widgets spread around other positions

    // Weather Icon (small)
    if (widgetSettings.weatherIcon?.enabled && infoData?.weather?.emoji) {
        widgets.push({
            type: 'small',
            html: `<div class="rpg-fab-widget rpg-fab-widget-weather-icon" title="Weather">${infoData.weather.emoji}</div>`
        });
    }

    // Weather Description (small)
    if (widgetSettings.weatherDesc?.enabled && infoData?.weather?.forecast) {
        const desc = infoData.weather.forecast.length > 15 ? infoData.weather.forecast.substring(0, 13) + '…' : infoData.weather.forecast;
        widgets.push({
            type: 'small',
            html: `<div class="rpg-fab-widget rpg-fab-widget-weather-desc" title="${infoData.weather.forecast}">${desc}</div>`
        });
    }

    // Helper to create expandable text widget HTML
    const createExpandableText = (fullText, maxLen, emoji) => {
        if (fullText.length <= maxLen) {
            return `${emoji} ${fullText}`;
        }
        const truncated = fullText.substring(0, maxLen - 2) + '…';
        return `${emoji} <span class="rpg-truncated">${truncated}</span><span class="rpg-full-text">${fullText}</span>`;
    };

    // Check if text needs truncation for data attribute
    const needsExpand = (text, maxLen) => text.length > maxLen;

    // Helper to parse time string and calculate clock hand angles
    const parseTimeForClock = (timeStr) => {
        const timeMatch = timeStr.match(/(\d+):(\d+)/);
        if (timeMatch) {
            const hours = parseInt(timeMatch[1]);
            const minutes = parseInt(timeMatch[2]);
            const hourAngle = (hours % 12) * 30 + minutes * 0.5; // 30° per hour + 0.5° per minute
            const minuteAngle = minutes * 6; // 6° per minute
            return { hourAngle, minuteAngle };
        }
        return { hourAngle: 0, minuteAngle: 0 };
    };

    // Clock/Time (bottom position with animated clock face)
    if (widgetSettings.clock?.enabled && infoData?.time) {
        const timeStr = infoData.time.end || infoData.time.value || infoData.time.start || '';
        if (timeStr) {
            const { hourAngle, minuteAngle } = parseTimeForClock(timeStr);
            widgets.push({
                type: 'bottom', // Special type for bottom position
                html: `<div class="rpg-fab-widget rpg-fab-widget-clock" title="${timeStr}">
                    <div class="rpg-fab-clock-face">
                        <div class="rpg-fab-clock-hour" style="transform: rotate(${hourAngle}deg)"></div>
                        <div class="rpg-fab-clock-minute" style="transform: rotate(${minuteAngle}deg)"></div>
                        <div class="rpg-fab-clock-center"></div>
                    </div>
                    <span class="rpg-fab-clock-time">${timeStr}</span>
                </div>`
            });
        }
    }

    // Date (small)
    if (widgetSettings.date?.enabled && infoData?.date?.value) {
        const dateVal = infoData.date.value;
        const expandAttr = needsExpand(dateVal, 12) ? ' data-full-text="true"' : '';
        widgets.push({
            type: 'small',
            html: `<div class="rpg-fab-widget rpg-fab-widget-date"${expandAttr} title="${dateVal}">${createExpandableText(dateVal, 12, '📅')}</div>`
        });
    }

    // Location (small)
    if (widgetSettings.location?.enabled && infoData?.location?.value) {
        const loc = infoData.location.value;
        const expandAttr = needsExpand(loc, 14) ? ' data-full-text="true"' : '';
        widgets.push({
            type: 'small',
            html: `<div class="rpg-fab-widget rpg-fab-widget-location"${expandAttr} title="${loc}">${createExpandableText(loc, 14, '📍')}</div>`
        });
    }

    // Stats (large - goes to West) - respects trackerConfig.userStats.customStats
    // Use extensionSettings.userStats as primary source (contains all stats), fallback to committedTrackerData
    let allStats = [];
    try {
        const userStatsJson = extensionSettings.userStats;
        const parsedUserStats = typeof userStatsJson === 'string' ? JSON.parse(userStatsJson) : userStatsJson;
        if (parsedUserStats?.stats) {
            allStats = parsedUserStats.stats;
        }
    } catch (e) {
        console.warn('[RPG FAB Widgets] Failed to parse extensionSettings.userStats:', e);
    }
    // Fallback to statsData if extensionSettings.userStats is empty
    if (allStats.length === 0 && statsData?.stats) {
        allStats = statsData.stats;
    }

    if (widgetSettings.stats?.enabled && allStats.length > 0) {
        // Get enabled stats from trackerConfig - match by id (lowercase)
        const configuredStats = extensionSettings.trackerConfig?.userStats?.customStats || [];
        const enabledStatMap = new Map();
        configuredStats.forEach(s => {
            if (s.enabled !== false) {
                enabledStatMap.set(s.id?.toLowerCase(), true);
                enabledStatMap.set(s.name?.toLowerCase(), true);
            }
        });

        const statsHtml = allStats
            .filter(s => {
                // If no config, show all stats
                if (configuredStats.length === 0) return true;
                // Check if stat is enabled in trackerConfig (match by id or name, case-insensitive)
                const statId = s.id?.toLowerCase();
                const statName = s.name?.toLowerCase();
                return enabledStatMap.has(statId) || enabledStatMap.has(statName);
            })
            .map(stat => {
                const value = typeof stat.value === 'number' ? stat.value : parseInt(stat.value) || 0;
                const color = getStatColor(value);
                const abbr = stat.name.substring(0, 3).toUpperCase();
                return `<span class="rpg-fab-widget-stat-item" title="${stat.name}: ${value}" style="color: ${color};">${abbr}:${value}</span>`;
            })
            .join('');

        if (statsHtml) {
            widgets.push({
                type: 'large',
                preferredPos: 6, // West
                html: `<div class="rpg-fab-widget rpg-fab-widget-stats"><div class="rpg-fab-widget-stats-row">${statsHtml}</div></div>`
            });
        }
    }

    // RPG Attributes (large - goes to Northwest) - respects trackerConfig.userStats.rpgAttributes
    if (widgetSettings.attributes?.enabled) {
        // Check if RPG attributes are enabled in trackerConfig
        const showRPGAttributes = extensionSettings.trackerConfig?.userStats?.showRPGAttributes !== false;

        if (showRPGAttributes && extensionSettings.classicStats) {
            // Get enabled attributes from trackerConfig
            const configuredAttrs = extensionSettings.trackerConfig?.userStats?.rpgAttributes || [];
            const enabledAttrIds = configuredAttrs.filter(a => a.enabled !== false).map(a => a.id);

            const attrs = extensionSettings.classicStats;
            const attrItems = Object.entries(attrs)
                .filter(([key]) => {
                    // Check if attribute is enabled in trackerConfig
                    if (enabledAttrIds.length > 0) {
                        return enabledAttrIds.includes(key.toLowerCase());
                    }
                    return true;
                })
                .map(([key, value]) => `<div class="rpg-fab-widget-attr-item"><span class="rpg-fab-widget-attr-name">${key.toUpperCase()}</span><span class="rpg-fab-widget-attr-value">${value}</span></div>`)
                .join('');

            if (attrItems) {
                widgets.push({
                    type: 'large',
                    preferredPos: 7, // Northwest
                    html: `<div class="rpg-fab-widget rpg-fab-widget-attributes" title="Attributes"><div class="rpg-fab-widget-attr-grid">${attrItems}</div></div>`
                });
            }
        }
    }

    // Auto-assign positions intelligently
    // Large widgets get their preferred positions first (West=6, Northwest=7)
    // Bottom widgets get position 4 (South)
    // Small widgets fill remaining positions clockwise from North (0)
    const usedPositions = new Set();
    const positionedWidgets = [];

    // Position order for small widgets: N(0), NE(1), E(2), SE(3), SW(5) - skip S(4) for bottom/clock
    const smallPositionOrder = [0, 1, 2, 3, 5];
    let smallPosIndex = 0;

    // Check if only one large widget exists (for centering)
    const largeWidgets = widgets.filter(w => w.type === 'large');
    const singleLargeWidget = largeWidgets.length === 1;

    // First: assign bottom widgets to position 4 (South)
    widgets.filter(w => w.type === 'bottom').forEach(w => {
        const pos = 4; // South position
        usedPositions.add(pos);
        const finalHtml = w.html.replace('class="rpg-fab-widget', `class="rpg-fab-widget rpg-fab-widget-pos-${pos}`);
        positionedWidgets.push({ position: pos, html: finalHtml });
    });

    // Second: assign large widgets to their preferred positions
    largeWidgets.forEach(w => {
        let pos = w.preferredPos;
        // If preferred position is taken, find next available from large positions
        if (usedPositions.has(pos)) {
            pos = pos === 6 ? 7 : 6; // Try the other large position
        }
        usedPositions.add(pos);
        // Add centered class if this is the only large widget
        const centeredClass = singleLargeWidget ? ' rpg-fab-widget-centered' : '';
        const finalHtml = w.html.replace('class="rpg-fab-widget', `class="rpg-fab-widget rpg-fab-widget-pos-${pos}${centeredClass}`);
        positionedWidgets.push({ position: pos, html: finalHtml });
    });

    // Third: assign small widgets to remaining positions
    widgets.filter(w => w.type === 'small').forEach(w => {
        // Find next available position from small position order
        while (smallPosIndex < smallPositionOrder.length && usedPositions.has(smallPositionOrder[smallPosIndex])) {
            smallPosIndex++;
        }
        const pos = smallPosIndex < smallPositionOrder.length ? smallPositionOrder[smallPosIndex] : (smallPosIndex % 8);
        usedPositions.add(pos);
        smallPosIndex++;
        const finalHtml = w.html.replace('class="rpg-fab-widget', `class="rpg-fab-widget rpg-fab-widget-pos-${pos}`);
        positionedWidgets.push({ position: pos, html: finalHtml });
    });

    // Add widgets to container
    positionedWidgets.forEach(w => $container.append(w.html));

    // Append container to body
    if (positionedWidgets.length > 0) {
        $('body').append($container);

        // Add mobile tap handler for expandable widgets
        $container.find('.rpg-fab-widget[data-full-text]').on('click touchstart', function(e) {
            e.stopPropagation();
            const $this = $(this);
            const wasExpanded = $this.hasClass('expanded');

            // Collapse all other expanded widgets
            $container.find('.rpg-fab-widget.expanded').removeClass('expanded');

            // Toggle this one
            if (!wasExpanded) {
                $this.addClass('expanded');
            }
        });

        // Collapse on tap outside
        $(document).on('click.fabWidgets touchstart.fabWidgets', function(e) {
            if (!$(e.target).closest('.rpg-fab-widget').length) {
                $container.find('.rpg-fab-widget.expanded').removeClass('expanded');
            }
        });
    }
}

/**
 * Gets a color for a stat value (0-100) using a gradient from low to high.
 * @param {number} value - The stat value (0-100)
 * @returns {string} CSS color value
 */
function getStatColor(value) {
    const lowColor = extensionSettings.statBarColorLow || '#cc3333';
    const lowOpacity = extensionSettings.statBarColorLowOpacity ?? 100;
    const highColor = extensionSettings.statBarColorHigh || '#33cc66';
    const highOpacity = extensionSettings.statBarColorHighOpacity ?? 100;

    // Simple linear interpolation between low and high colors
    const percent = Math.min(100, Math.max(0, value)) / 100;

    // Parse colors
    const lowRGB = hexToRgb(lowColor);
    const highRGB = hexToRgb(highColor);

    if (!lowRGB || !highRGB) return value > 50 ? hexToRgba(highColor, highOpacity) : hexToRgba(lowColor, lowOpacity);

    const r = Math.round(lowRGB.r + (highRGB.r - lowRGB.r) * percent);
    const g = Math.round(lowRGB.g + (highRGB.g - lowRGB.g) * percent);
    const b = Math.round(lowRGB.b + (highRGB.b - lowRGB.b) * percent);
    const a = (lowOpacity + (highOpacity - lowOpacity) * percent) / 100;

    return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/**
 * Converts a hex color to RGB object.
 * @param {string} hex - Hex color string (e.g., "#cc3333")
 * @returns {{r: number, g: number, b: number}|null}
 */
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

/**
 * Updates the FAB widget container position to match FAB button position.
 * Call this after FAB is dragged.
 */
export function updateFabWidgetPosition() {
    const $fab = $('#rpg-mobile-toggle');
    const $container = $('#rpg-fab-widget-container');

    if ($fab.length === 0 || $container.length === 0) return;

    const fabOffset = $fab.offset();
    $container.css({
        top: fabOffset.top + 'px',
        left: fabOffset.left + 'px'
    });
}

/**
 * Sets the FAB loading state (spinning animation during API requests).
 * @param {boolean} loading - Whether to show loading state
 */
export function setFabLoadingState(loading) {
    const $fab = $('#rpg-mobile-toggle');
    if ($fab.length === 0) return;

    if (loading) {
        $fab.addClass('rpg-fab-loading');
    } else {
        $fab.removeClass('rpg-fab-loading');
    }
}

