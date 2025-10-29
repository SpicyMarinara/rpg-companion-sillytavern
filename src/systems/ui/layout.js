/**
 * Layout Management Module
 * Handles panel visibility, section visibility, collapse/expand toggle, and panel positioning
 */

import {
    extensionSettings,
    $panelContainer,
    $userStatsContainer,
    $infoBoxContainer,
    $thoughtsContainer,
    $inventoryContainer
} from '../../core/state.js';

/**
 * Toggles the visibility of plot buttons based on settings.
 */
export function togglePlotButtons() {
    if (extensionSettings.enablePlotButtons && extensionSettings.enabled) {
        $('#rpg-plot-buttons').show();
    } else {
        $('#rpg-plot-buttons').hide();
    }
}

/**
 * Helper function to close the mobile panel with animation.
 */
export function closeMobilePanelWithAnimation() {
    const $panel = $('#rpg-companion-panel');
    const $mobileToggle = $('#rpg-mobile-toggle');

    // Add closing class to trigger slide-out animation
    $panel.removeClass('rpg-mobile-open').addClass('rpg-mobile-closing');
    $mobileToggle.removeClass('active');

    // Wait for animation to complete before hiding
    $panel.one('animationend', function() {
        $panel.removeClass('rpg-mobile-closing');
        $('.rpg-mobile-overlay').remove();
    });
}

/**
 * Updates the collapse toggle icon direction based on panel position.
 */
export function updateCollapseToggleIcon() {
    const $collapseToggle = $('#rpg-collapse-toggle');
    const $panel = $('#rpg-companion-panel');
    const $icon = $collapseToggle.find('i');
    const isMobile = window.innerWidth <= 1000;

    if (isMobile) {
        // Mobile: slides from right, use same icon logic as desktop right panel
        const isOpen = $panel.hasClass('rpg-mobile-open');
        console.log('[RPG Mobile] updateCollapseToggleIcon:', {
            isMobile: true,
            isOpen,
            settingIcon: isOpen ? 'chevron-left' : 'chevron-right'
        });
        if (isOpen) {
            // Panel open - chevron points left (to close/slide back right)
            $icon.removeClass('fa-chevron-down fa-chevron-up fa-chevron-right').addClass('fa-chevron-left');
        } else {
            // Panel closed - chevron points right (to open/slide in from right)
            $icon.removeClass('fa-chevron-down fa-chevron-up fa-chevron-left').addClass('fa-chevron-right');
        }
    } else {
        // Desktop: icon direction based on panel position and collapsed state
        const isCollapsed = $panel.hasClass('rpg-collapsed');

        if (isCollapsed) {
            // When collapsed, arrow points inward (to expand)
            if ($panel.hasClass('rpg-position-right')) {
                $icon.removeClass('fa-chevron-right').addClass('fa-chevron-left');
            } else if ($panel.hasClass('rpg-position-left')) {
                $icon.removeClass('fa-chevron-left').addClass('fa-chevron-right');
            }
        } else {
            // When expanded, arrow points outward (to collapse)
            if ($panel.hasClass('rpg-position-right')) {
                $icon.removeClass('fa-chevron-left').addClass('fa-chevron-right');
            } else if ($panel.hasClass('rpg-position-left')) {
                $icon.removeClass('fa-chevron-right').addClass('fa-chevron-left');
            }
        }
    }
}

/**
 * Sets up the collapse/expand toggle button for side panels.
 */
export function setupCollapseToggle() {
    const $collapseToggle = $('#rpg-collapse-toggle');
    const $panel = $('#rpg-companion-panel');
    const $icon = $collapseToggle.find('i');

    $collapseToggle.on('click', function(e) {
        e.preventDefault();
        e.stopPropagation();

        const isMobile = window.innerWidth <= 1000;

        // On mobile: button toggles panel open/closed (same as desktop behavior)
        if (isMobile) {
            const isOpen = $panel.hasClass('rpg-mobile-open');
            console.log('[RPG Mobile] Collapse toggle clicked. Current state:', {
                isOpen,
                panelClasses: $panel.attr('class'),
                inlineStyles: $panel.attr('style'),
                panelPosition: {
                    top: $panel.css('top'),
                    bottom: $panel.css('bottom'),
                    transform: $panel.css('transform'),
                    visibility: $panel.css('visibility')
                }
            });

            if (isOpen) {
                // Close panel with animation
                console.log('[RPG Mobile] Closing panel');
                closeMobilePanelWithAnimation();
            } else {
                // Open panel
                console.log('[RPG Mobile] Opening panel');
                $panel.addClass('rpg-mobile-open');
                const $overlay = $('<div class="rpg-mobile-overlay"></div>');
                $('body').append($overlay);

                // Debug: Check state after animation should complete
                setTimeout(() => {
                    console.log('[RPG Mobile] 500ms after opening:', {
                        panelClasses: $panel.attr('class'),
                        hasOpenClass: $panel.hasClass('rpg-mobile-open'),
                        visibility: $panel.css('visibility'),
                        transform: $panel.css('transform'),
                        display: $panel.css('display'),
                        opacity: $panel.css('opacity')
                    });
                }, 500);

                // Close when clicking overlay
                $overlay.on('click', function() {
                    console.log('[RPG Mobile] Overlay clicked - closing panel');
                    closeMobilePanelWithAnimation();
                    updateCollapseToggleIcon();
                });
            }

            // Update icon to reflect new state
            updateCollapseToggleIcon();

            console.log('[RPG Mobile] After toggle:', {
                panelClasses: $panel.attr('class'),
                inlineStyles: $panel.attr('style'),
                panelPosition: {
                    top: $panel.css('top'),
                    bottom: $panel.css('bottom'),
                    transform: $panel.css('transform'),
                    visibility: $panel.css('visibility')
                },
                gameContainer: {
                    opacity: $('.rpg-game-container').css('opacity'),
                    visibility: $('.rpg-game-container').css('visibility')
                }
            });
            return;
        }

        // Desktop behavior: collapse/expand side panel
        const isCollapsed = $panel.hasClass('rpg-collapsed');

        if (isCollapsed) {
            // Expand panel
            $panel.removeClass('rpg-collapsed');

            // Update icon based on position
            if ($panel.hasClass('rpg-position-right')) {
                $icon.removeClass('fa-chevron-left').addClass('fa-chevron-right');
            } else if ($panel.hasClass('rpg-position-left')) {
                $icon.removeClass('fa-chevron-right').addClass('fa-chevron-left');
            }
        } else {
            // Collapse panel
            $panel.addClass('rpg-collapsed');

            // Update icon based on position
            if ($panel.hasClass('rpg-position-right')) {
                $icon.removeClass('fa-chevron-right').addClass('fa-chevron-left');
            } else if ($panel.hasClass('rpg-position-left')) {
                $icon.removeClass('fa-chevron-left').addClass('fa-chevron-right');
            }
        }
    });

    // Set initial icon direction based on panel position
    updateCollapseToggleIcon();
}

/**
 * Updates the visibility of the entire panel.
 */
export function updatePanelVisibility() {
    if (extensionSettings.enabled) {
        $panelContainer.show();
        togglePlotButtons(); // Update plot button visibility
    } else {
        $panelContainer.hide();
        $('#rpg-plot-buttons').hide(); // Hide plot buttons when disabled
    }
}

/**
 * Updates the visibility of individual sections.
 */
export function updateSectionVisibility() {
    // Show/hide sections based on settings
    $userStatsContainer.toggle(extensionSettings.showUserStats);
    $infoBoxContainer.toggle(extensionSettings.showInfoBox);
    $thoughtsContainer.toggle(extensionSettings.showCharacterThoughts);
    if ($inventoryContainer) {
        $inventoryContainer.toggle(extensionSettings.showInventory);
    }

    // Show/hide dividers intelligently
    // Divider after User Stats: shown if User Stats is visible AND at least one section after it is visible
    const showDividerAfterStats = extensionSettings.showUserStats &&
        (extensionSettings.showInfoBox || extensionSettings.showCharacterThoughts || extensionSettings.showInventory);
    $('#rpg-divider-stats').toggle(showDividerAfterStats);

    // Divider after Info Box: shown if Info Box is visible AND at least one section after it is visible
    const showDividerAfterInfo = extensionSettings.showInfoBox &&
        (extensionSettings.showCharacterThoughts || extensionSettings.showInventory);
    $('#rpg-divider-info').toggle(showDividerAfterInfo);

    // Divider after Thoughts: shown if Thoughts is visible AND Inventory is visible
    const showDividerAfterThoughts = extensionSettings.showCharacterThoughts &&
        extensionSettings.showInventory;
    $('#rpg-divider-thoughts').toggle(showDividerAfterThoughts);
}

/**
 * Applies the selected panel position.
 */
export function applyPanelPosition() {
    if (!$panelContainer) return;

    const isMobile = window.innerWidth <= 1000;

    // Remove all position classes
    $panelContainer.removeClass('rpg-position-left rpg-position-right rpg-position-top');

    // On mobile, don't apply desktop position classes
    if (isMobile) {
        return;
    }

    // Desktop: Add the appropriate position class
    $panelContainer.addClass(`rpg-position-${extensionSettings.panelPosition}`);

    // Update collapse toggle icon direction for new position
    updateCollapseToggleIcon();
}

/**
 * Updates the UI based on generation mode selection.
 */
export function updateGenerationModeUI() {
    if (extensionSettings.generationMode === 'together') {
        // In "together" mode, manual update button is hidden
        $('#rpg-manual-update').hide();
    } else {
        // In "separate" mode, manual update button is visible
        $('#rpg-manual-update').show();
    }
}
