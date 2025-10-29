/**
 * Desktop UI Module
 * Handles desktop-specific UI functionality: tab navigation
 */

/**
 * Sets up desktop tab navigation for organizing content.
 * Only runs on desktop viewports (>1000px).
 * Creates two tabs: Status (Stats/Info/Thoughts) and Inventory.
 */
export function setupDesktopTabs() {
    const isDesktop = window.innerWidth > 1000;
    if (!isDesktop) return;

    // Check if tabs already exist
    if ($('.rpg-tabs-nav').length > 0) return;

    const $contentBox = $('.rpg-content-box');

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

    // Create tab navigation
    const $tabNav = $(`
        <div class="rpg-tabs-nav">
            <button class="rpg-tab-btn active" data-tab="status">
                <i class="fa-solid fa-chart-simple"></i>
                <span>Status</span>
            </button>
            <button class="rpg-tab-btn" data-tab="inventory">
                <i class="fa-solid fa-box"></i>
                <span>Inventory</span>
            </button>
            <button class="rpg-tab-btn" data-tab="quests">
                <i class="fa-solid fa-scroll"></i>
                <span>Quests</span>
            </button>
        </div>
    `);

    // Create tab content containers
    const $statusTab = $('<div class="rpg-tab-content active" data-tab-content="status"></div>');
    const $inventoryTab = $('<div class="rpg-tab-content" data-tab-content="inventory"></div>');
    const $questsTab = $('<div class="rpg-tab-content" data-tab-content="quests"></div>');

    // Move sections into their respective tabs (detach to preserve event handlers)
    if ($userStats.length > 0) {
        $statusTab.append($userStats.detach());
        $userStats.show();
    }
    if ($infoBox.length > 0) {
        $statusTab.append($infoBox.detach());
        $infoBox.show();
    }
    if ($thoughts.length > 0) {
        $statusTab.append($thoughts.detach());
        $thoughts.show();
    }
    if ($inventory.length > 0) {
        $inventoryTab.append($inventory.detach());
        $inventory.show();
    }
    if ($quests.length > 0) {
        $questsTab.append($quests.detach());
        $quests.show();
    }

    // Hide dividers on desktop tabs (tabs separate content naturally)
    $('.rpg-divider').hide();

    // Build desktop tab structure
    const $tabsContainer = $('<div class="rpg-tabs-container"></div>');
    $tabsContainer.append($tabNav);
    $tabsContainer.append($statusTab);
    $tabsContainer.append($inventoryTab);
    $tabsContainer.append($questsTab);

    // Replace content box with tabs container
    $contentBox.html('').append($tabsContainer);

    // Handle tab switching
    $tabNav.find('.rpg-tab-btn').on('click', function() {
        const tabName = $(this).data('tab');

        // Update active tab button
        $tabNav.find('.rpg-tab-btn').removeClass('active');
        $(this).addClass('active');

        // Update active tab content
        $('.rpg-tab-content').removeClass('active');
        $(`.rpg-tab-content[data-tab-content="${tabName}"]`).addClass('active');
    });

    console.log('[RPG Desktop] Desktop tabs initialized');
}

/**
 * Removes desktop tab navigation and restores original layout.
 * Used when transitioning from desktop to mobile.
 */
export function removeDesktopTabs() {
    // Get sections from tabs before removing
    const $userStats = $('#rpg-user-stats').detach();
    const $infoBox = $('#rpg-info-box').detach();
    const $thoughts = $('#rpg-thoughts').detach();
    const $inventory = $('#rpg-inventory').detach();
    const $quests = $('#rpg-quests').detach();

    // Remove tabs container
    $('.rpg-tabs-container').remove();

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
        $contentBox.append($userStats);
        $contentBox.append($infoBox);
        $contentBox.append($thoughts);
        $contentBox.append($inventory);
        $contentBox.append($quests);
    }

    // Show sections and dividers
    $userStats.show();
    $infoBox.show();
    $thoughts.show();
    $inventory.show();
    $('.rpg-divider').show();

    console.log('[RPG Desktop] Desktop tabs removed');
}
