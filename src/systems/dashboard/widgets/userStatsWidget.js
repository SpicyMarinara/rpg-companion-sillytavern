/**
 * User Stats Widget
 *
 * Displays user health/satiety/energy/hygiene/arousal bars,
 * mood/conditions, and classic D&D stats (STR/DEX/CON/INT/WIS/CHA).
 *
 * Features:
 * - Editable stat values with live update
 * - Progress bars with customizable colors
 * - User portrait and level display
 * - Classic stats with +/- buttons
 * - Mobile-responsive layout
 */

import { createProgressBar, attachEditableHandlers, parseNumber } from '../widgetBase.js';

/**
 * Register User Stats Widget
 * @param {WidgetRegistry} registry - Widget registry instance
 * @param {Object} dependencies - External dependencies
 * @param {Function} dependencies.getContext - Get SillyTavern context
 * @param {Function} dependencies.getUserAvatar - Get user avatar URL
 * @param {Function} dependencies.getExtensionSettings - Get extension settings
 * @param {Function} dependencies.onStatsChange - Callback when stats change
 */
export function registerUserStatsWidget(registry, dependencies) {
    const {
        getContext,
        getUserAvatar,
        getExtensionSettings,
        onStatsChange
    } = dependencies;

    registry.register('userStats', {
        name: 'User Stats',
        icon: '❤️',
        description: 'Health, energy, satiety bars and classic RPG stats',
        minSize: { w: 1, h: 2 },
        defaultSize: { w: 2, h: 3 },
        requiresSchema: false,

        /**
         * Render widget content
         * @param {HTMLElement} container - Widget container
         * @param {Object} config - Widget configuration
         */
        render(container, config = {}) {
            const settings = getExtensionSettings();
            const stats = settings.userStats;
            const classicStats = settings.classicStats;
            const context = getContext();
            const userName = context.name1;
            const userPortrait = getUserAvatar();

            // Merge default config with user config
            const finalConfig = {
                showClassicStats: true,
                showMood: true,
                showPortrait: true,
                statBarGradient: true,
                visibleStats: ['health', 'satiety', 'energy', 'hygiene', 'arousal'],
                ...config
            };

            // Create gradient for stat bars
            const gradient = finalConfig.statBarGradient
                ? `linear-gradient(to right, ${settings.statBarColorLow}, ${settings.statBarColorHigh})`
                : settings.statBarColorHigh;

            // Build progress bars HTML
            const progressBarsHtml = finalConfig.visibleStats.map(statName => {
                const label = statName.charAt(0).toUpperCase() + statName.slice(1);
                return createProgressBar({
                    label,
                    value: stats[statName],
                    gradient,
                    editable: true,
                    field: statName
                });
            }).join('');

            // Build classic stats HTML
            const classicStatsHtml = finalConfig.showClassicStats ? `
                <div class="rpg-stats-right">
                    <div class="rpg-classic-stats">
                        <div class="rpg-classic-stats-grid">
                            ${['str', 'dex', 'con', 'int', 'wis', 'cha'].map(stat => `
                                <div class="rpg-classic-stat" data-stat="${stat}">
                                    <span class="rpg-classic-stat-label">${stat.toUpperCase()}</span>
                                    <div class="rpg-classic-stat-buttons">
                                        <button class="rpg-classic-stat-btn rpg-stat-decrease" data-stat="${stat}">−</button>
                                        <span class="rpg-classic-stat-value">${classicStats[stat]}</span>
                                        <button class="rpg-classic-stat-btn rpg-stat-increase" data-stat="${stat}">+</button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            ` : '';

            // Build mood section HTML
            const moodHtml = finalConfig.showMood ? `
                <div class="rpg-mood">
                    <div class="rpg-mood-emoji rpg-editable" contenteditable="true" data-field="mood" title="Click to edit emoji">${stats.mood}</div>
                    <div class="rpg-mood-conditions rpg-editable" contenteditable="true" data-field="conditions" title="Click to edit conditions">${stats.conditions}</div>
                </div>
            ` : '';

            // Build portrait section HTML
            const portraitHtml = finalConfig.showPortrait ? `
                <div class="rpg-user-info-row">
                    <img src="${userPortrait}" alt="${userName}" class="rpg-user-portrait" onerror="this.style.opacity='0.5';this.onerror=null;" />
                    <span class="rpg-user-name">${userName}</span>
                    <span style="opacity: 0.5;">|</span>
                    <span class="rpg-level-label">LVL</span>
                    <span class="rpg-level-value rpg-editable" contenteditable="true" data-field="level" title="Click to edit level">${settings.level}</span>
                </div>
            ` : '';

            // Render complete HTML
            const html = `
                <div class="rpg-stats-content">
                    <div class="rpg-stats-left">
                        ${portraitHtml}
                        <div class="rpg-stats-grid">
                            ${progressBarsHtml}
                        </div>
                        ${moodHtml}
                    </div>
                    ${classicStatsHtml}
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
                showClassicStats: {
                    type: 'boolean',
                    label: 'Show Classic Stats (STR/DEX/etc)',
                    default: true
                },
                showMood: {
                    type: 'boolean',
                    label: 'Show Mood & Conditions',
                    default: true
                },
                showPortrait: {
                    type: 'boolean',
                    label: 'Show User Portrait',
                    default: true
                },
                statBarGradient: {
                    type: 'boolean',
                    label: 'Use Gradient for Stat Bars',
                    default: true
                },
                visibleStats: {
                    type: 'multiselect',
                    label: 'Visible Stats',
                    default: ['health', 'satiety', 'energy', 'hygiene', 'arousal'],
                    options: [
                        { value: 'health', label: 'Health' },
                        { value: 'satiety', label: 'Satiety' },
                        { value: 'energy', label: 'Energy' },
                        { value: 'hygiene', label: 'Hygiene' },
                        { value: 'arousal', label: 'Arousal' }
                    ]
                }
            };
        },

        /**
         * Handle configuration changes
         * @param {HTMLElement} container - Widget container
         * @param {Object} newConfig - New configuration
         */
        onConfigChange(container, newConfig) {
            // Re-render with new config
            this.render(container, newConfig);
        },

        /**
         * Handle widget resize
         * @param {HTMLElement} container - Widget container
         * @param {number} newW - New width
         * @param {number} newH - New height
         */
        onResize(container, newW, newH) {
            // Adjust layout based on size
            const statsContent = container.querySelector('.rpg-stats-content');
            if (!statsContent) return;

            // Stack vertically on narrow widgets
            if (newW < 5) {
                statsContent.style.flexDirection = 'column';
            } else {
                statsContent.style.flexDirection = 'row';
            }
        }
    });
}

/**
 * Attach event handlers to widget
 * @private
 */
function attachEventHandlers(container, settings, onStatsChange) {
    // Handle editable stat value changes (health, satiety, etc.)
    const editableStats = container.querySelectorAll('.rpg-editable-stat');
    editableStats.forEach(field => {
        const fieldName = field.dataset.field;
        let originalValue = parseNumber(field.textContent.replace('%', '').trim(), 0, 0, 100);

        field.addEventListener('focus', () => {
            originalValue = parseNumber(field.textContent.replace('%', '').trim(), 0, 0, 100);
            // Select all text
            const range = document.createRange();
            range.selectNodeContents(field);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
        });

        field.addEventListener('blur', () => {
            const textValue = field.textContent.replace('%', '').trim();
            const value = parseNumber(textValue, originalValue, 0, 100);

            // Update display
            field.textContent = `${value}%`;

            // Update settings if changed
            if (value !== originalValue) {
                settings.userStats[fieldName] = value;

                // Update the bar fill
                const bar = field.parentElement.querySelector('.rpg-stat-fill');
                if (bar) {
                    bar.style.width = `${100 - value}%`;
                }

                // Trigger change callback
                if (onStatsChange) {
                    onStatsChange('userStats', fieldName, value);
                }
            }
        });

        field.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                field.blur();
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                field.textContent = `${originalValue}%`;
                field.blur();
            }
        });

        // Prevent paste with formatting
        field.addEventListener('paste', (e) => {
            e.preventDefault();
            const text = (e.clipboardData || window.clipboardData).getData('text/plain');
            document.execCommand('insertText', false, text);
        });
    });

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
    }

    // Handle level editing
    const levelValue = container.querySelector('.rpg-level-value.rpg-editable');
    if (levelValue) {
        let originalLevel = parseNumber(levelValue.textContent.trim(), 1, 1, 100);

        levelValue.addEventListener('focus', () => {
            originalLevel = parseNumber(levelValue.textContent.trim(), 1, 1, 100);
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
    }

    // Handle classic stat +/- buttons
    const increaseButtons = container.querySelectorAll('.rpg-stat-increase');
    const decreaseButtons = container.querySelectorAll('.rpg-stat-decrease');

    increaseButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const statName = btn.dataset.stat;
            const valueSpan = btn.parentElement.querySelector('.rpg-classic-stat-value');
            const currentValue = parseNumber(valueSpan.textContent, 10, 1, 20);
            const newValue = Math.min(20, currentValue + 1);

            valueSpan.textContent = newValue;
            settings.classicStats[statName] = newValue;

            if (onStatsChange) {
                onStatsChange('classicStats', statName, newValue);
            }
        });
    });

    decreaseButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const statName = btn.dataset.stat;
            const valueSpan = btn.parentElement.querySelector('.rpg-classic-stat-value');
            const currentValue = parseNumber(valueSpan.textContent, 10, 1, 20);
            const newValue = Math.max(1, currentValue - 1);

            valueSpan.textContent = newValue;
            settings.classicStats[statName] = newValue;

            if (onStatsChange) {
                onStatsChange('classicStats', statName, newValue);
            }
        });
    });
}
