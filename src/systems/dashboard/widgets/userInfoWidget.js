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
        getAvatarUrl,
        getFallbackAvatar,
        getExtensionSettings,
        onStatsChange
    } = dependencies;

    registry.register('userInfo', {
        name: 'User Info',
        icon: '👤',
        description: 'User avatar, name, and level display',
        category: 'user',
        minSize: { w: 1, h: 1 },
        defaultSize: { w: 1, h: 1 }, // Start compact (1x1), expansion will grow it based on columns
        // Column-aware max size: mobile (2-col) stays 1x1, desktop (3-4 col) expands vertically to 1x2
        maxAutoSize: (columns) => {
            if (columns <= 2) {
                return { w: 1, h: 1 }; // Mobile: stay compact to allow mood widget beside it
            }
            return { w: 1, h: 2 }; // Desktop: expand vertically, mood fits top-right
        },
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

            // Get user avatar - use getAvatarUrl to convert filename to proper thumbnail URL
            let userPortrait = getFallbackAvatar();
            const rawAvatar = getUserAvatar();

            // Convert raw avatar filename to proper thumbnail URL
            // getAvatarUrl calls getThumbnailUrl which generates URLs like /thumbnail?type=persona&file=...
            if (rawAvatar) {
                userPortrait = getAvatarUrl('persona', rawAvatar);
            }

            // Merge default config
            const finalConfig = {
                showAvatar: true,
                showName: true,
                showLevel: true,
                ...config
            };

            // Build HTML with flexible layout structure
            const html = `
                <div class="rpg-user-info-container">
                    ${finalConfig.showAvatar ? `<img src="${userPortrait}" alt="${userName}" class="rpg-user-portrait" onerror="this.style.opacity='0.5';this.onerror=null;" />` : ''}
                    <div class="rpg-user-info-text">
                        ${finalConfig.showName ? `<div class="rpg-user-name">${userName}</div>` : ''}
                        ${finalConfig.showLevel ? `
                            <div class="rpg-user-level">
                                <span class="rpg-level-label">LVL</span>
                                <span class="rpg-level-value rpg-editable" contenteditable="true" data-field="level" title="Click to edit level">${settings.level}</span>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;

            container.innerHTML = html;

            // Attach event handlers
            attachEventHandlers(container, settings, onStatsChange);

            // Set initial layout based on current config size
            if (config.w !== undefined && config.h !== undefined) {
                this.onResize(container, config.w, config.h);
            }
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
         * @param {number} newW - New width (grid columns)
         * @param {number} newH - New height (grid rows)
         */
        onResize(container, newW, newH) {
            const infoContainer = container.querySelector('.rpg-user-info-container');
            const portrait = container.querySelector('.rpg-user-portrait');
            if (!infoContainer) return;

            // Flexible hybrid layout based on width:
            // - 1 column (1x1, 1x2): Centered avatar with text below
            // - 2+ columns: Side-by-side (avatar left, text right)
            if (newW < 2) {
                // Compact vertical layout: centered large avatar with text below
                infoContainer.classList.add('rpg-layout-vertical');
                infoContainer.classList.remove('rpg-layout-horizontal');
                if (portrait) {
                    portrait.style.width = '3rem';
                    portrait.style.height = '3rem';
                }
            } else {
                // Horizontal layout: avatar left, text right
                infoContainer.classList.add('rpg-layout-horizontal');
                infoContainer.classList.remove('rpg-layout-vertical');
                if (portrait) {
                    portrait.style.width = '2.5rem';
                    portrait.style.height = '2.5rem';
                }
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
