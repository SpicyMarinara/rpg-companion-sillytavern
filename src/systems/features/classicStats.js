/**
 * Classic Stats Module
 * Handles classic RPG stat buttons (STR, DEX, CON, INT, WIS, CHA) +/- controls
 */

import {
    lastGeneratedData,
    $userStatsContainer
} from '../../core/state.js';
import { saveChatData, updateMessageSwipeData } from '../../core/persistence.js';

/**
 * Sets up event listeners for classic stat +/- buttons using delegation.
 * Uses delegated events to persist across re-renders of the stats section.
 */
export function setupClassicStatsButtons() {
    if (!$userStatsContainer) return;

    // Delegated event listener for increase buttons
    $userStatsContainer.on('click', '.rpg-stat-increase', function() {
        const attrName = $(this).data('attr-name');
        if (!attrName) return;
        
        if (!lastGeneratedData.attributes) lastGeneratedData.attributes = {};
        const current = lastGeneratedData.attributes[attrName] ?? 10;
        if (current < 100) {
            lastGeneratedData.attributes[attrName] = current + 1;
            saveChatData();
            updateMessageSwipeData();
            $(this).closest('.rpg-classic-stat').find('.rpg-classic-stat-value').text(lastGeneratedData.attributes[attrName]);
        }
    });

    // Delegated event listener for decrease buttons
    $userStatsContainer.on('click', '.rpg-stat-decrease', function() {
        const attrName = $(this).data('attr-name');
        if (!attrName) return;
        
        if (!lastGeneratedData.attributes) lastGeneratedData.attributes = {};
        const current = lastGeneratedData.attributes[attrName] ?? 10;
        if (current > 1) {
            lastGeneratedData.attributes[attrName] = current - 1;
            saveChatData();
            updateMessageSwipeData();
            $(this).closest('.rpg-classic-stat').find('.rpg-classic-stat-value').text(lastGeneratedData.attributes[attrName]);
        }
    });
}
