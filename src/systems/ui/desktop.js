/**
 * Desktop UI Module
 * Handles desktop-specific UI functionality: tab navigation
 */

import { i18n } from '../../core/i18n.js';
import { extensionSettings } from '../../core/state.js';

/**
 * Sets up desktop tab navigation for organizing content.
 * Only runs on desktop viewports (>1000px).
 * Creates tabs: Status, Character (enhanced), Relations, Inventory, Quests
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
    const $enhancedStats = $('#rpg-enhanced-stats');
    const $enhancedRelationships = $('#rpg-enhanced-relationships');

    // If no sections exist, nothing to organize
    if ($userStats.length === 0 && $infoBox.length === 0 && $thoughts.length === 0 && $inventory.length === 0 && $quests.length === 0) {
        return;
    }

    // Create tab navigation with enhanced tabs
    const $tabNav = $(`
        <div class="rpg-tabs-nav">
            <button class="rpg-tab-btn active" data-tab="status">
                <i class="fa-solid fa-chart-simple"></i>
                <span data-i18n-key="global.status">Status</span>
            </button>
            <button class="rpg-tab-btn rpg-enhanced-tab" data-tab="character">
                <i class="fa-solid fa-user-gear"></i>
                <span>Character</span>
            </button>
            <button class="rpg-tab-btn rpg-enhanced-tab" data-tab="relations">
                <i class="fa-solid fa-heart"></i>
                <span>Relations</span>
            </button>
            <button class="rpg-tab-btn" data-tab="inventory">
                <i class="fa-solid fa-box"></i>
                <span data-i18n-key="global.inventory">Inventory</span>
            </button>
            <button class="rpg-tab-btn" data-tab="quests">
                <i class="fa-solid fa-scroll"></i>
                <span data-i18n-key="global.quests">Quests</span>
            </button>
        </div>
    `);

    // Create tab content containers
    const $statusTab = $('<div class="rpg-tab-content active" data-tab-content="status"></div>');
    const $characterTab = $('<div class="rpg-tab-content rpg-enhanced-tab-content" data-tab-content="character"></div>');
    const $relationsTab = $('<div class="rpg-tab-content rpg-enhanced-tab-content" data-tab-content="relations"></div>');
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

    // Move enhanced sections into their tabs
    if ($enhancedStats.length > 0) {
        $characterTab.append($enhancedStats.detach());
        $enhancedStats.show();
    }
    if ($enhancedRelationships.length > 0) {
        $relationsTab.append($enhancedRelationships.detach());
        $enhancedRelationships.show();
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
    $tabsContainer.append($characterTab);
    $tabsContainer.append($relationsTab);
    $tabsContainer.append($inventoryTab);
    $tabsContainer.append($questsTab);

    // Replace content box with tabs container
    $contentBox.html('').append($tabsContainer);
    i18n.applyTranslations($tabsContainer[0]);

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

    // Update enhanced tab visibility based on settings
    updateEnhancedTabVisibility();

    console.log('[RPG Desktop] Desktop tabs initialized with enhanced tabs');
}

/**
 * Update visibility of enhanced tabs based on settings
 * When enhanced mode is ON: hide vanilla Status tab, show Character/Relations
 * When enhanced mode is OFF: show vanilla Status tab, hide Character/Relations
 */
export function updateEnhancedTabVisibility() {
    const isEnhancedEnabled = extensionSettings.enhancedRPG?.enabled;

    if (isEnhancedEnabled) {
        // Show enhanced tabs
        $('.rpg-enhanced-tab').show();
        $('.rpg-enhanced-tab-content').addClass('enhanced-active');

        // Hide vanilla status tab and content when enhanced is enabled
        $('.rpg-tab-btn[data-tab="status"]').hide();
        $('.rpg-tab-content[data-tab-content="status"]').removeClass('active');

        // Make Character tab active by default when enhanced is enabled
        if (!$('.rpg-tab-btn.active:visible').length) {
            $('.rpg-tab-btn[data-tab="character"]').addClass('active');
            $('.rpg-tab-content[data-tab-content="character"]').addClass('active');
        }
    } else {
        // Hide enhanced tabs
        $('.rpg-enhanced-tab').hide();
        $('.rpg-enhanced-tab-content').removeClass('enhanced-active');

        // Show vanilla status tab when enhanced is disabled
        $('.rpg-tab-btn[data-tab="status"]').show();

        // Make Status tab active by default when enhanced is disabled
        if (!$('.rpg-tab-btn.active:visible').length) {
            $('.rpg-tab-btn[data-tab="status"]').addClass('active');
            $('.rpg-tab-content[data-tab-content="status"]').addClass('active');
        }
    }
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
    const $enhancedStats = $('#rpg-enhanced-stats').detach();
    const $enhancedRelationships = $('#rpg-enhanced-relationships').detach();

    // Remove tabs container
    $('.rpg-tabs-container').remove();

    // Get dividers
    const $dividerStats = $('#rpg-divider-stats');
    const $dividerInfo = $('#rpg-divider-info');
    const $dividerThoughts = $('#rpg-divider-thoughts');

    // Restore original sections to content box in correct order
    const $contentBox = $('.rpg-content-box');

    // Re-insert sections in original order
    if ($dividerStats.length) {
        $dividerStats.before($userStats);
        $dividerInfo.before($infoBox);
        $dividerThoughts.before($thoughts);
        $contentBox.append($inventory);
        $contentBox.append($quests);
        $contentBox.append($enhancedStats);
        $contentBox.append($enhancedRelationships);
    } else {
        // Fallback if dividers don't exist
        $contentBox.append($userStats);
        $contentBox.append($infoBox);
        $contentBox.append($thoughts);
        $contentBox.append($inventory);
        $contentBox.append($quests);
        $contentBox.append($enhancedStats);
        $contentBox.append($enhancedRelationships);
    }

    // Show sections and dividers
    $userStats.show();
    $infoBox.show();
    $thoughts.show();
    $inventory.show();
    $('.rpg-divider').show();

    console.log('[RPG Desktop] Desktop tabs removed');
}
