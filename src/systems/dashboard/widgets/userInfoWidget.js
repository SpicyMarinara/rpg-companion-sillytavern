/**
 * User Info Widget
 *
 * Displays user avatar, name, and level.
 * Compact widget showing basic user identity with editable level.
 *
 * Features:
 * - User portrait/avatar display
 * - User name from SillyTavern context
 * - Editable level field (1-100)
 * - Compact horizontal layout
 */

import { parseNumber } from '../widgetBase.js';

/**
 * Register User Info Widget
 * @param {WidgetRegistry} registry - Widget registry instance
 * @param {Object} dependencies - External dependencies
 * @param {Function} dependencies.getContext - Get SillyTavern context
 * @param {Function} dependencies.getUserAvatar - Get user avatar URL
 * @param {Function} dependencies.getExtensionSettings - Get extension settings
 * @param {Function} dependencies.onStatsChange - Callback when stats change
 */
export function registerUserInfoWidget(registry, dependencies) {
    const {
        getContext,
        getUserAvatar,
        getExtensionSettings,
        onStatsChange
    } = dependencies;

    registry.register('userInfo', {
        name: 'User Info',
        icon: '👤',
        description: 'User avatar, name, and level display',
        category: 'user',
        minSize: { w: 1, h: 1 },
        defaultSize: { w: 2, h: 1 },
        maxAutoSize: { w: 2, h: 1 }, // Max size for auto-arrange expansion
        requiresSchema: false,

        /**
         * Render widget content
         * @param {HTMLElement} container - Widget container
         * @param {Object} config - Widget configuration
         */
        render(container, config = {}) {
            const settings = getExtensionSettings();
            const context = getContext();
            const userName = context.name1;
            const userPortrait = getUserAvatar();

            // Merge default config
            const finalConfig = {
                showAvatar: true,
                showName: true,
                showLevel: true,
                ...config
            };

            // Build HTML
            const html = `
                <div class="rpg-user-info-row">
                    ${finalConfig.showAvatar ? `<img src="${userPortrait}" alt="${userName}" class="rpg-user-portrait" onerror="this.style.opacity='0.5';this.onerror=null;" />` : ''}
                    ${finalConfig.showName ? `<span class="rpg-user-name">${userName}</span>` : ''}
                    ${finalConfig.showLevel ? `
                        <span style="opacity: 0.5;">|</span>
                        <span class="rpg-level-label">LVL</span>
                        <span class="rpg-level-value rpg-editable" contenteditable="true" data-field="level" title="Click to edit level">${settings.level}</span>
                    ` : ''}
                </div>
            `;

            container.innerHTML = html;

            // Attach event handlers
            attachEventHandlers(container, settings, onStatsChange);
        },

        /**
         * Get configuration options
         * @returns {Object} Configuration schema
         */
        getConfig() {
            return {
                showAvatar: {
                    type: 'boolean',
                    label: 'Show Avatar',
                    default: true
                },
                showName: {
                    type: 'boolean',
                    label: 'Show User Name',
                    default: true
                },
                showLevel: {
                    type: 'boolean',
                    label: 'Show Level',
                    default: true
                }
            };
        },

        /**
         * Handle configuration changes
         * @param {HTMLElement} container - Widget container
         * @param {Object} newConfig - New configuration
         */
        onConfigChange(container, newConfig) {
            this.render(container, newConfig);
        },

        /**
         * Handle widget resize
         * @param {HTMLElement} container - Widget container
         * @param {number} newW - New width
         * @param {number} newH - New height
         */
        onResize(container, newW, newH) {
            // Responsive adjustments if needed
            const infoRow = container.querySelector('.rpg-user-info-row');
            if (!infoRow) return;

            // Stack vertically on very narrow widgets
            if (newW < 2) {
                infoRow.style.flexDirection = 'column';
                infoRow.style.alignItems = 'center';
            } else {
                infoRow.style.flexDirection = 'row';
                infoRow.style.alignItems = 'center';
            }
        }
    });
}

/**
 * Attach event handlers to widget
 * @private
 */
function attachEventHandlers(container, settings, onStatsChange) {
    // Handle level editing
    const levelValue = container.querySelector('.rpg-level-value.rpg-editable');
    if (!levelValue) return;

    let originalLevel = parseNumber(levelValue.textContent.trim(), 1, 1, 100);

    levelValue.addEventListener('focus', () => {
        originalLevel = parseNumber(levelValue.textContent.trim(), 1, 1, 100);
        // Select all text
        const range = document.createRange();
        range.selectNodeContents(levelValue);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
    });

    levelValue.addEventListener('blur', () => {
        const value = parseNumber(levelValue.textContent.trim(), originalLevel, 1, 100);
        levelValue.textContent = value;

        if (value !== originalLevel) {
            settings.level = value;
            if (onStatsChange) {
                onStatsChange('level', null, value);
            }
        }
    });

    levelValue.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            levelValue.blur();
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            levelValue.textContent = originalLevel;
            levelValue.blur();
        }
    });

    // Prevent paste with formatting
    levelValue.addEventListener('paste', (e) => {
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData).getData('text/plain');
        document.execCommand('insertText', false, text);
    });
}
