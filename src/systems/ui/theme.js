/**
 * Theme Management Module
 * Handles theme application, custom colors, and animations
 */

import { extensionSettings, $panelContainer } from '../../core/state.js';

/**
 * Applies the selected theme to the panel.
 */
export function applyTheme() {
    if (!$panelContainer) return;

    const theme = extensionSettings.theme;

    // Remove all theme attributes first
    $panelContainer.removeAttr('data-theme');

    // Clear any inline CSS variable overrides
    $panelContainer.css({
        '--rpg-bg': '',
        '--rpg-accent': '',
        '--rpg-text': '',
        '--rpg-highlight': '',
        '--rpg-border': '',
        '--rpg-shadow': ''
    });

    // Apply the selected theme
    if (theme === 'custom') {
        applyCustomTheme();
    } else if (theme !== 'default') {
        // For non-default themes, set the data-theme attribute
        // which will trigger the CSS theme rules
        $panelContainer.attr('data-theme', theme);
    }
    // For 'default', we do nothing - it will use the CSS variables from .rpg-panel class
    // which fall back to SillyTavern's theme variables
}

/**
 * Applies custom colors when custom theme is selected.
 */
export function applyCustomTheme() {
    if (!$panelContainer) return;

    const colors = extensionSettings.customColors;

    // Apply custom CSS variables as inline styles
    $panelContainer.css({
        '--rpg-bg': colors.bg,
        '--rpg-accent': colors.accent,
        '--rpg-text': colors.text,
        '--rpg-highlight': colors.highlight,
        '--rpg-border': colors.highlight,
        '--rpg-shadow': `${colors.highlight}80` // Add alpha for shadow
    });
}

/**
 * Toggles visibility of custom color pickers.
 */
export function toggleCustomColors() {
    const isCustom = extensionSettings.theme === 'custom';
    $('#rpg-custom-colors').toggle(isCustom);
}

/**
 * Toggles animations on/off by adding/removing a class to the panel.
 */
export function toggleAnimations() {
    if (extensionSettings.enableAnimations) {
        $panelContainer.addClass('rpg-animations-enabled');
    } else {
        $panelContainer.removeClass('rpg-animations-enabled');
    }
}

/**
 * Updates visibility of feature toggles in main panel based on settings
 */
export function updateFeatureTogglesVisibility() {
    const $featuresRow = $('#rpg-features-row');
    const $htmlToggle = $('#rpg-html-toggle-wrapper');
    const $spotifyToggle = $('#rpg-spotify-toggle-wrapper');
    const $snowflakesToggle = $('#rpg-snowflakes-toggle-wrapper');
    const $dynamicWeatherToggle = $('#rpg-dynamic-weather-toggle-wrapper');

    // Show/hide individual toggles
    $htmlToggle.toggle(extensionSettings.showHtmlToggle);
    $spotifyToggle.toggle(extensionSettings.showSpotifyToggle);
    $snowflakesToggle.toggle(extensionSettings.showSnowflakesToggle);
    $dynamicWeatherToggle.toggle(extensionSettings.showDynamicWeatherToggle);

    // Hide entire row if all toggles are hidden
    const anyVisible = extensionSettings.showHtmlToggle ||
                      extensionSettings.showSpotifyToggle ||
                      extensionSettings.showSnowflakesToggle ||
                      extensionSettings.showDynamicWeatherToggle;
    $featuresRow.toggle(anyVisible);
}

/**
 * Updates the settings popup theme in real-time.
 * Backwards compatible wrapper for SettingsModal class.
 * @param {Object} settingsModal - The SettingsModal instance (passed as parameter to avoid circular dependency)
 */
export function updateSettingsPopupTheme(settingsModal) {
    if (settingsModal) {
        settingsModal.updateTheme();
    }
}

/**
 * Applies custom theme colors to the settings popup.
 * Backwards compatible wrapper for SettingsModal class.
 * @deprecated Use settingsModal.updateTheme() instead
 * @param {Object} settingsModal - The SettingsModal instance (passed as parameter to avoid circular dependency)
 */
export function applyCustomThemeToSettingsPopup(settingsModal) {
    if (settingsModal) {
        settingsModal._applyCustomTheme();
    }
}
