/**
 * Classic Stats Module
 * Handles classic RPG stat buttons (STR, DEX, CON, INT, WIS, CHA) +/- controls
 */

import {
    extensionSettings,
    $userStatsContainer
} from '../../core/state.js';
import { saveSettings, saveChatData } from '../../core/persistence.js';
import { updateFabWidgets } from '../ui/mobile.js';

/**
 * Sets up event listeners for classic stat +/- buttons using delegation.
 * Uses delegated events to persist across re-renders of the stats section.
 */
export function setupClassicStatsButtons() {
    if (!$userStatsContainer) return;

    // Delegated event listener for increase buttons
    $userStatsContainer.on('click', '.rpg-stat-increase', function() {
        const stat = $(this).data('stat');
        // Initialize custom attributes if they don't exist
        if (extensionSettings.classicStats[stat] === undefined) {
            extensionSettings.classicStats[stat] = 10;
        }
        if (extensionSettings.classicStats[stat] < 999) {
            extensionSettings.classicStats[stat]++;
            saveSettings();
            saveChatData();
            // Update only the specific stat value, not the entire stats panel
            $(this).closest('.rpg-classic-stat').find('.rpg-classic-stat-value').text(extensionSettings.classicStats[stat]);
            updateFabWidgets();
        }
    });

    // Delegated event listener for decrease buttons
    $userStatsContainer.on('click', '.rpg-stat-decrease', function() {
        const stat = $(this).data('stat');
        // Initialize custom attributes if they don't exist
        if (extensionSettings.classicStats[stat] === undefined) {
            extensionSettings.classicStats[stat] = 10;
        }
        if (extensionSettings.classicStats[stat] > 1) {
            extensionSettings.classicStats[stat]--;
            saveSettings();
            saveChatData();
            // Update only the specific stat value, not the entire stats panel
            $(this).closest('.rpg-classic-stat').find('.rpg-classic-stat-value').text(extensionSettings.classicStats[stat]);
            updateFabWidgets();
        }
    });
}
