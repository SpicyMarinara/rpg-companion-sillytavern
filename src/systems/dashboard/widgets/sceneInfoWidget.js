/**
 * Scene Info Grid Widget
 *
 * Displays calendar, weather, temperature, clock, and location in a compact
 * information-dense grid layout. All data points visible at once for maximum
 * scannability.
 *
 * Design: 2-column grid with location header + 4 data cards
 * Inspiration: Apple Widgets, Material Design, modern dashboard patterns
 */

import { parseInfoBoxData } from './infoBoxWidgets.js';

/**
 * Format date for display
 * @param {string} fullDate - Full date string from infoBox
 * @param {string} weekday - Weekday name
 * @param {string} month - Month/day description (e.g. "3rd Day of the Ninth Month")
 * @returns {Object} Formatted date parts
 */
function formatDate(fullDate, weekday, month) {
    if (!fullDate && !month) {
        return { icon: '📅', value: 'No Date', label: '' };
    }

    // parseInfoBoxData splits date on commas:
    // "Tuesday, 3rd Day of the Ninth Month, Autumn, Year..." becomes:
    //   weekday = "Tuesday"
    //   month = "3rd Day of the Ninth Month"
    //   year = "Autumn"
    // Display the most important part (month/day) with weekday as label

    const displayValue = month || fullDate;
    const displayLabel = weekday || '';

    return {
        icon: '📅',
        value: displayValue,
        label: displayLabel
    };
}

/**
 * Format time for display
 * @param {string} timeStart - Start time
 * @param {string} timeEnd - End time
 * @returns {Object} Formatted time parts
 */
function formatTime(timeStart, timeEnd) {
    const timeDisplay = timeEnd || timeStart || '12:00';

    return {
        icon: '🕐',
        value: timeDisplay,
        label: '' // Could add timezone if available
    };
}

/**
 * Format weather for display
 * @param {string} weatherEmoji - Weather emoji or symbol string
 * @param {string} weatherForecast - Weather description
 * @returns {Object} Formatted weather parts
 */
function formatWeather(weatherEmoji, weatherForecast) {
    const forecast = weatherForecast || 'Clear';

    // If no emoji provided, display forecast text only
    if (!weatherEmoji) {
        return {
            icon: '',
            value: forecast,
            label: ''
        };
    }

    // Validate emoji/symbol (relaxed check)
    // Allow: actual emojis, custom symbols (+++, ***, etc.)
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    const symbolRegex = /^[+*#~\-=_]+$/;  // Custom weather symbols
    const looksLikeEmojiOrSymbol = weatherEmoji.length <= 5 && (
        emojiRegex.test(weatherEmoji) ||
        symbolRegex.test(weatherEmoji)
    );

    if (looksLikeEmojiOrSymbol) {
        // Valid emoji or symbol - append to forecast
        return {
            icon: '',
            value: `${forecast} ${weatherEmoji}`,
            label: ''
        };
    } else {
        // weatherEmoji is actually text (e.g., "Clear") - combine with forecast
        // Handles: prose weather like "The air crackles with magical energy"
        return {
            icon: '',
            value: `${weatherEmoji} ${forecast}`.trim(),
            label: ''
        };
    }
}

/**
 * Format temperature for display
 * @param {string} temperature - Temperature value
 * @returns {Object} Formatted temperature parts
 */
function formatTemp(temperature) {
    if (!temperature) {
        return { icon: '🌡️', value: '20°C', label: '' };
    }

    return {
        icon: '🌡️',
        value: temperature,
        label: '' // Could add "Feels like" if available
    };
}

/**
 * Format location for display
 * @param {string} location - Location name
 * @returns {Object} Formatted location parts
 */
function formatLocation(location) {
    if (!location || location === 'Location') {
        return { value: 'No Location', label: '' };
    }

    // Split on FIRST comma only to get primary location + context
    // Preserves hyphens in names (e.g., "Seol Yi-hwan")
    // Example: "The Winding Stair, Third Floor, East Wing, Palace, City"
    // -> value: "The Winding Stair", label: "Third Floor, East Wing, Palace, City"
    const firstCommaIndex = location.indexOf(',');
    if (firstCommaIndex !== -1 && firstCommaIndex < location.length - 1) {
        return {
            value: location.substring(0, firstCommaIndex).trim(),
            label: location.substring(firstCommaIndex + 1).trim()  // Keep all remaining text
        };
    }

    // No comma or comma at end - display full text
    return {
        value: location,
        label: ''
    };
}

/**
 * Render info grid item
 * @param {Object} item - Item data
 * @param {string} item.icon - Icon emoji (optional)
 * @param {string} item.value - Primary value
 * @param {string} item.label - Secondary label
 * @param {string} field - Field name for editing
 * @param {string} gridArea - CSS grid area name
 * @returns {string} HTML for grid item
 */
function renderInfoItem(item, field, gridArea) {
    const hasLabel = item.label && item.label !== '';
    const hasIcon = item.icon && item.icon !== '';
    const areaClass = gridArea ? `rpg-info-${gridArea}` : '';

    return `
        <div class="rpg-info-item ${areaClass}" data-field="${field}">
            ${hasIcon ? `<span class="item-icon">${item.icon}</span>` : ''}
            <div class="item-content">
                <span class="item-value rpg-editable" contenteditable="true" data-field="${field}" title="Click to edit">${item.value}</span>
                ${hasLabel ? `<span class="item-label">${item.label}</span>` : ''}
            </div>
        </div>
    `;
}

/**
 * Render location header (full width)
 * @param {Object} location - Location data
 * @returns {string} HTML for location header
 */
function renderLocationHeader(location) {
    const hasDescription = location.label && location.label !== '';

    return `
        <div class="rpg-info-item rpg-info-location" data-field="location">
            <span class="item-icon">📍</span>
            <div class="item-content">
                <span class="item-value rpg-editable" contenteditable="true" data-field="location" title="Click to edit">${location.value}</span>
                ${hasDescription ? `<span class="item-label">${location.label}</span>` : ''}
            </div>
        </div>
    `;
}

/**
 * Attach edit handlers to editable fields
 * @param {HTMLElement} container - Widget container
 * @param {Object} dependencies - Widget dependencies
 */
function attachEditHandlers(container, dependencies) {
    const editableFields = container.querySelectorAll('.rpg-editable');

    editableFields.forEach(field => {
        const fieldName = field.dataset.field;
        let originalValue = field.textContent.trim();

        field.addEventListener('focus', () => {
            originalValue = field.textContent.trim();

            // Select all text on focus
            const range = document.createRange();
            range.selectNodeContents(field);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
        });

        field.addEventListener('blur', () => {
            const value = field.textContent.trim();
            if (value && value !== originalValue) {
                updateInfoBoxField(dependencies, fieldName, value);
            }
        });

        field.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                field.blur();
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                field.textContent = originalValue;
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
}

/**
 * Update info box field in shared data
 * @param {Object} dependencies - Widget dependencies
 * @param {string} field - Field name
 * @param {string} value - New value
 */
function updateInfoBoxField(dependencies, field, value) {
    const { getInfoBoxData, setInfoBoxData, onDataChange } = dependencies;
    let infoBoxData = getInfoBoxData() || '';

    // Simple replace for now - could be more sophisticated
    const fieldMap = {
        'date': /Date: [^\n]+/,
        'time': /Time: [^\n]+/,
        'weather': /Weather: [^\n]+/,
        'temperature': /Temperature: [^\n]+/,
        'location': /Location: [^\n]+/
    };

    const pattern = fieldMap[field];
    if (pattern) {
        const replacement = `${field.charAt(0).toUpperCase() + field.slice(1)}: ${value}`;
        if (pattern.test(infoBoxData)) {
            infoBoxData = infoBoxData.replace(pattern, replacement);
        } else {
            infoBoxData += `\n${replacement}`;
        }

        setInfoBoxData(infoBoxData);
        if (onDataChange) {
            onDataChange('infoBox', field, value);
        }
    }
}

/**
 * Register Scene Info Widget
 */
export function registerSceneInfoWidget(registry, dependencies) {
    registry.register('sceneInfo', {
        name: 'Scene Info',
        icon: '🗺️',
        description: 'Compact scene information grid (calendar, weather, time, location)',
        category: 'scene',
        minSize: { w: 2, h: 2 },
        // Column-aware sizing: compact on mobile, spacious on desktop
        defaultSize: (columns) => {
            if (columns <= 2) {
                return { w: 2, h: 2 }; // Mobile: 2×2 (compact, full width)
            }
            return { w: 3, h: 3 }; // Desktop: 3×3 (spacious)
        },
        maxAutoSize: (columns) => {
            if (columns <= 2) {
                return { w: 2, h: 3 }; // Mobile: 2×3 max (full width)
            }
            return { w: 3, h: 3 }; // Desktop: 3×3 max
        },
        requiresSchema: false,

        /**
         * Render the widget
         * @param {HTMLElement} container - Widget container
         * @param {Object} config - Widget configuration
         */
        render(container, config = {}) {
            const { getInfoBoxData } = dependencies;
            const data = parseInfoBoxData(getInfoBoxData());

            // Format data for display
            const date = formatDate(data.date, data.weekday, data.month);
            const time = formatTime(data.timeStart, data.timeEnd);
            const weather = formatWeather(data.weatherEmoji, data.weatherForecast);
            const temp = formatTemp(data.temperature);
            const location = formatLocation(data.location);

            // Build grid HTML
            const html = `
                <div class="rpg-scene-info-grid">
                    ${renderLocationHeader(location)}
                    ${renderInfoItem(date, 'date', 'calendar')}
                    ${renderInfoItem(time, 'time', 'clock')}
                    ${renderInfoItem(weather, 'weather', 'weather')}
                    ${renderInfoItem(temp, 'temperature', 'temperature')}
                </div>
            `;

            container.innerHTML = html;
            attachEditHandlers(container, dependencies);
        },

        /**
         * Get configuration options
         * @returns {Object} Configuration schema
         */
        getConfig() {
            return {
                showLabels: {
                    type: 'boolean',
                    label: 'Show Secondary Labels',
                    default: true,
                    description: 'Show secondary text (weekday, timezone, etc.)'
                },
                compactMode: {
                    type: 'boolean',
                    label: 'Compact Mode',
                    default: false,
                    description: 'Reduce padding and font sizes'
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
         * @param {number} newW - New width in grid units
         * @param {number} newH - New height in grid units
         */
        onResize(container, newW, newH) {
            // Apply compact mode styling at narrow widths (mirrors mobile layout)
            const grid = container.querySelector('.rpg-scene-info-grid');
            if (grid) {
                if (newW < 3) {
                    // Narrow layout: use mobile-like compact sizing
                    grid.classList.add('rpg-scene-info-compact');
                } else {
                    // Wide layout: use standard sizing
                    grid.classList.remove('rpg-scene-info-compact');
                }
            }
        }
    });
}
