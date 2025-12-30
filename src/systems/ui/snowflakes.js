/**
 * Snowflakes Effect Module
 * Creates and manages animated snowflakes overlay
 */

import { extensionSettings } from '../../core/state.js';

let snowflakesContainer = null;

/**
 * Create snowflakes container and snowflakes
 */
function createSnowflakes() {
    if (snowflakesContainer) return; // Already created

    // Create container
    snowflakesContainer = document.createElement('div');
    snowflakesContainer.className = 'rpg-snowflakes-container';

    // Create 50 snowflakes with random positions
    for (let i = 0; i < 50; i++) {
        const snowflake = document.createElement('div');
        snowflake.className = 'rpg-snowflake';
        snowflake.textContent = '❄';

        // Random horizontal position
        snowflake.style.left = `${Math.random() * 100}%`;

        // Random animation delay for staggered effect
        snowflake.style.animationDelay = `${Math.random() * 10}s`;

        // Random animation duration (between 10-20s)
        snowflake.style.animationDuration = `${10 + Math.random() * 10}s`;

        snowflakesContainer.appendChild(snowflake);
    }

    document.body.appendChild(snowflakesContainer);
}

/**
 * Remove snowflakes container
 */
function removeSnowflakes() {
    if (snowflakesContainer) {
        snowflakesContainer.remove();
        snowflakesContainer = null;
    }
}

/**
 * Toggle snowflakes effect
 */
export function toggleSnowflakes(enabled) {
    if (enabled) {
        createSnowflakes();
    } else {
        removeSnowflakes();
    }
}

/**
 * Initialize snowflakes based on saved state
 */
export function initSnowflakes() {
    const enabled = extensionSettings.enableSnowflakes || false;

    if (enabled) {
        createSnowflakes();
    }
}

/**
 * Clean up snowflakes
 */
export function cleanupSnowflakes() {
    removeSnowflakes();
}
