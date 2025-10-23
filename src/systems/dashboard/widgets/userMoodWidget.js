/**
 * User Mood Widget
 *
 * Displays user's current mood emoji and active conditions.
 * Compact widget showing emotional state and status effects.
 *
 * Features:
 * - Large mood emoji (editable)
 * - Conditions/status effects text (editable)
 * - Responsive layout
 */

/**
 * Register User Mood Widget
 * @param {WidgetRegistry} registry - Widget registry instance
 * @param {Object} dependencies - External dependencies
 * @param {Function} dependencies.getExtensionSettings - Get extension settings
 * @param {Function} dependencies.onStatsChange - Callback when stats change
 */
export function registerUserMoodWidget(registry, dependencies) {
    const {
        getExtensionSettings,
        onStatsChange
    } = dependencies;

    registry.register('userMood', {
        name: 'User Mood',
        icon: '😊',
        description: 'Mood emoji and active conditions',
        category: 'user',
        minSize: { w: 1, h: 1 },
        defaultSize: { w: 2, h: 1 },
        requiresSchema: false,

        /**
         * Render widget content
         * @param {HTMLElement} container - Widget container
         * @param {Object} config - Widget configuration
         */
        render(container, config = {}) {
            const settings = getExtensionSettings();
            const stats = settings.userStats;

            // Merge default config
            const finalConfig = {
                showMoodEmoji: true,
                showConditions: true,
                ...config
            };

            // Build HTML
            const html = `
                <div class="rpg-mood">
                    ${finalConfig.showMoodEmoji ? `<div class="rpg-mood-emoji rpg-editable" contenteditable="true" data-field="mood" title="Click to edit emoji">${stats.mood}</div>` : ''}
                    ${finalConfig.showConditions ? `<div class="rpg-mood-conditions rpg-editable" contenteditable="true" data-field="conditions" title="Click to edit conditions">${stats.conditions}</div>` : ''}
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
                showMoodEmoji: {
                    type: 'boolean',
                    label: 'Show Mood Emoji',
                    default: true
                },
                showConditions: {
                    type: 'boolean',
                    label: 'Show Conditions',
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
            const mood = container.querySelector('.rpg-mood');
            if (!mood) return;

            // Adjust layout for narrow widgets
            if (newW < 2) {
                mood.style.flexDirection = 'column';
            } else {
                mood.style.flexDirection = 'row';
            }
        }
    });
}

/**
 * Attach event handlers to widget
 * @private
 */
function attachEventHandlers(container, settings, onStatsChange) {
    // Handle mood emoji editing
    const moodEmoji = container.querySelector('.rpg-mood-emoji.rpg-editable');
    if (moodEmoji) {
        let originalMood = moodEmoji.textContent.trim();

        moodEmoji.addEventListener('focus', () => {
            originalMood = moodEmoji.textContent.trim();
            const range = document.createRange();
            range.selectNodeContents(moodEmoji);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
        });

        moodEmoji.addEventListener('blur', () => {
            const value = moodEmoji.textContent.trim() || '😐';
            moodEmoji.textContent = value;

            if (value !== originalMood) {
                settings.userStats.mood = value;
                if (onStatsChange) {
                    onStatsChange('userStats', 'mood', value);
                }
            }
        });

        moodEmoji.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                moodEmoji.blur();
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                moodEmoji.textContent = originalMood;
                moodEmoji.blur();
            }
        });

        // Prevent paste with formatting
        moodEmoji.addEventListener('paste', (e) => {
            e.preventDefault();
            const text = (e.clipboardData || window.clipboardData).getData('text/plain');
            document.execCommand('insertText', false, text);
        });
    }

    // Handle conditions editing
    const moodConditions = container.querySelector('.rpg-mood-conditions.rpg-editable');
    if (moodConditions) {
        let originalConditions = moodConditions.textContent.trim();

        moodConditions.addEventListener('focus', () => {
            originalConditions = moodConditions.textContent.trim();
            const range = document.createRange();
            range.selectNodeContents(moodConditions);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
        });

        moodConditions.addEventListener('blur', () => {
            const value = moodConditions.textContent.trim() || 'None';
            moodConditions.textContent = value;

            if (value !== originalConditions) {
                settings.userStats.conditions = value;
                if (onStatsChange) {
                    onStatsChange('userStats', 'conditions', value);
                }
            }
        });

        moodConditions.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                moodConditions.blur();
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                moodConditions.textContent = originalConditions;
                moodConditions.blur();
            }
        });

        // Prevent paste with formatting
        moodConditions.addEventListener('paste', (e) => {
            e.preventDefault();
            const text = (e.clipboardData || window.clipboardData).getData('text/plain');
            document.execCommand('insertText', false, text);
        });
    }
}
