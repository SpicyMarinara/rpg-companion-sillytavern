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
 * @param {string} date - Date value
 * @param {string} month - Month name
 * @param {string} weekday - Weekday name
 * @returns {Object} Formatted date parts
 */
function formatDate(date, month, weekday) {
    if (!date && !month && !weekday) {
        return { icon: '📅', value: 'No Date', label: '' };
    }

    // Format: "15 Jan" on main line, "Monday" as label
    const monthShort = month ? month.substring(0, 3) : 'Mon';
    const dayNum = date || '1';
    const weekdayLabel = weekday || '';

    return {
        icon: '📅',
        value: `${dayNum} ${monthShort}`,
        label: weekdayLabel
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
 * @param {string} weatherEmoji - Weather emoji
 * @param {string} weatherForecast - Weather description
 * @returns {Object} Formatted weather parts
 */
function formatWeather(weatherEmoji, weatherForecast) {
    const emoji = weatherEmoji || '☀️';
    const forecast = weatherForecast || 'Clear';

    return {
        icon: '', // No icon on left
        value: `${forecast} ${emoji}`, // Forecast text with emoji on right
        label: ''
    };
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

    // Split on comma or dash for secondary text
    const parts = location.split(/[,\-]/);
    return {
        value: parts[0].trim(),
        label: parts.slice(1).join(', ').trim()
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
        defaultSize: { w: 2, h: 2 },
        maxAutoSize: { w: 2, h: 3 },
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
            const date = formatDate(data.date, data.month, data.weekday);
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
        }
    });
}
