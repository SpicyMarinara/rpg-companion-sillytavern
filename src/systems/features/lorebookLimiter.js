/**
 * Lorebook Limiter Module
 * Adds maximum activation limit to SillyTavern's World Info system
 */

import { eventSource, event_types } from '../../../../../../../script.js';

let maxActivations = 0; // 0 = unlimited
let settingsInitialized = false;
let activatedEntriesThisGeneration = [];

/**
 * Initialize the lorebook limiter
 */
export function initLorebookLimiter() {
    console.log('[Lorebook Limiter] Initializing...');

    // Load saved setting
    const saved = localStorage.getItem('rpg_max_lorebook_activations');
    if (saved !== null) {
        maxActivations = parseInt(saved, 10);
    }

    // Wait for World Info settings to be ready
    eventSource.on('worldInfoSettings', () => {
        setTimeout(() => {
            if (!settingsInitialized) {
                injectMaxActivationsUI();
                settingsInitialized = true;
            }
        }, 100);
    });

    // Try when the WI drawer is opened
    const tryInjectOnClick = () => {
        const wiButton = document.querySelector('#WIDrawerIcon');
        if (wiButton) {
            wiButton.addEventListener('click', () => {
                setTimeout(() => {
                    if (!settingsInitialized) {
                        injectMaxActivationsUI();
                        settingsInitialized = true;
                    }
                }, 300);
            });
            console.log('[Lorebook Limiter] Attached to WI drawer button');
        }
    };

    // Also try on app ready
    eventSource.on('app_ready', () => {
        setTimeout(() => {
            tryInjectOnClick();
            if (!settingsInitialized) {
                injectMaxActivationsUI();
                settingsInitialized = true;
            }
        }, 1000);
    });

    // Patch the world info activation system
    patchWorldInfoActivation();
}

/**
 * Inject the Maximum Activations UI into World Info settings
 */
function injectMaxActivationsUI() {
    console.log('[Lorebook Limiter] Injecting UI...');

    // Check if already injected
    if (document.querySelector('#rpg-max-lorebook-activations-container')) {
        console.log('[Lorebook Limiter] UI already injected');
        return;
    }

    // Find the Memory Recollection button - we'll add our UI right after it
    const memoryButton = document.querySelector('.rpg-memory-recollection-btn');

    if (!memoryButton) {
        console.log('[Lorebook Limiter] Memory Recollection button not found yet');
        return;
    }

    const container = memoryButton.parentElement;
    if (!container) {
        console.log('[Lorebook Limiter] Could not find button container');
        return;
    }

    console.log('[Lorebook Limiter] Found Memory Recollection button, injecting slider after it');

    // Create the UI - styled to match the extension's theme
    const settingHTML = `
        <div id="rpg-max-lorebook-activations-container" class="rpg-lorebook-limiter-container">
            <label class="rpg-lorebook-limiter-label">
                <span class="rpg-lorebook-limiter-title">Max Lorebook Activations</span>
                <input type="number"
                       id="rpg-max-activations-input"
                       class="rpg-lorebook-limiter-input"
                       min="0"
                       max="9999"
                       step="1"
                       value="${maxActivations}"
                       placeholder="0 = unlimited" />
            </label>
            <small class="rpg-lorebook-limiter-hint">Limit entries per generation (0 = unlimited)</small>
        </div>
    `;

    // Insert after the Memory Recollection button
    memoryButton.insertAdjacentHTML('afterend', settingHTML);

    // Add event listener
    const input = document.querySelector('#rpg-max-activations-input');

    if (input) {
        input.addEventListener('input', (e) => {
            let value = parseInt(e.target.value, 10);
            if (isNaN(value) || value < 0) value = 0;
            if (value > 9999) value = 9999;

            maxActivations = value;
            e.target.value = value;
            localStorage.setItem('rpg_max_lorebook_activations', value.toString());
            console.log(`[Lorebook Limiter] Max activations set to: ${value}`);
        });

        console.log('[Lorebook Limiter] ✅ UI injected successfully');
    }
}

/**
 * Patch the world info activation system to enforce the limit
 */
function patchWorldInfoActivation() {
    console.log('[Lorebook Limiter] Setting up activation limiter...');

    // We need to intercept at the module level
    // Use a Proxy on the module loader
    const originalDefine = window.define;
    const originalRequire = window.require;

    // Try multiple approaches to hook into the WI system
    const attemptPatch = () => {
        // Approach 1: Direct window access
        if (window.getWorldInfoPrompt) {
            const original = window.getWorldInfoPrompt;
            window.getWorldInfoPrompt = async function(...args) {
                const result = await original.apply(this, args);

                if (maxActivations > 0 && result) {
                    // Count entries in the worldInfoString
                    const lines = (result.worldInfoBefore + result.worldInfoAfter).split('\n').filter(l => l.trim());
                    if (lines.length > maxActivations) {
                        console.log(`[Lorebook Limiter] Limiting ${lines.length} WI lines to ${maxActivations}`);

                        // Trim the strings
                        const limitedLines = lines.slice(0, maxActivations);
                        result.worldInfoBefore = limitedLines.join('\n');
                        result.worldInfoAfter = '';
                        result.worldInfoString = result.worldInfoBefore;

                        console.log(`[Lorebook Limiter] ✅ Limited from ${lines.length} to ${limitedLines.length} entries`);
                    }
                }

                return result;
            };

            console.log('[Lorebook Limiter] ✅ Patched window.getWorldInfoPrompt');
            return true;
        }

        // Approach 2: Through SillyTavern context
        if (window.SillyTavern?.getContext) {
            const ctx = window.SillyTavern.getContext();
            if (ctx.getWorldInfoPrompt) {
                const original = ctx.getWorldInfoPrompt;
                ctx.getWorldInfoPrompt = async function(...args) {
                    const result = await original.apply(this, args);

                    if (maxActivations > 0 && result) {
                        const lines = (result.worldInfoBefore + result.worldInfoAfter).split('\n').filter(l => l.trim());
                        if (lines.length > maxActivations) {
                            console.log(`[Lorebook Limiter] Limiting ${lines.length} WI entries to ${maxActivations}`);
                            const limitedLines = lines.slice(0, maxActivations);
                            result.worldInfoBefore = limitedLines.join('\n');
                            result.worldInfoAfter = '';
                            result.worldInfoString = result.worldInfoBefore;
                        }
                    }

                    return result;
                };

                console.log('[Lorebook Limiter] ✅ Patched SillyTavern.getContext().getWorldInfoPrompt');
                return true;
            }

            // Try checkWorldInfo instead
            if (ctx.checkWorldInfo) {
                const original = ctx.checkWorldInfo;
                ctx.checkWorldInfo = async function(...args) {
                    const result = await original.apply(this, args);

                    if (maxActivations > 0 && result?.allActivatedEntries?.size > maxActivations) {
                        console.log(`[Lorebook Limiter] Limiting ${result.allActivatedEntries.size} entries to ${maxActivations}`);

                        // Keep only first N entries
                        const entries = Array.from(result.allActivatedEntries.entries());
                        result.allActivatedEntries = new Map(entries.slice(0, maxActivations));

                        // Also limit the string output
                        const lines = (result.worldInfoBefore + result.worldInfoAfter).split('\n').filter(l => l.trim());
                        if (lines.length > maxActivations) {
                            const limitedLines = lines.slice(0, maxActivations);
                            result.worldInfoBefore = limitedLines.join('\n');
                            result.worldInfoAfter = '';
                        }

                        console.log(`[Lorebook Limiter] ✅ Limited to ${result.allActivatedEntries.size} entries`);
                    }

                    return result;
                };

                console.log('[Lorebook Limiter] ✅ Patched SillyTavern.getContext().checkWorldInfo');
                return true;
            }
        }

        return false;
    };

    // Try immediately
    if (!attemptPatch()) {
        // Retry after delays
        setTimeout(() => attemptPatch() || setTimeout(() => attemptPatch(), 2000), 1000);
    }
}

/**
 * Update the maximum activations limit
 */
export function setMaxActivations(value) {
    maxActivations = parseInt(value, 10);
    localStorage.setItem('rpg_max_lorebook_activations', value.toString());

    // Update UI if it exists
    const valueDisplay = document.querySelector('#rpg-max-activations-value');
    const slider = document.querySelector('#rpg-max-activations-slider');

    if (valueDisplay) {
        valueDisplay.textContent = value;
    }
    if (slider) {
        slider.value = value;
    }
}

/**
 * Get current maximum activations limit
 */
export function getMaxActivations() {
    return maxActivations;
}
