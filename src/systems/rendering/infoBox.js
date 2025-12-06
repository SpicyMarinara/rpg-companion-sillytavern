/**
 * Info Box Rendering Module
 * Handles rendering of the info box dashboard with weather, date, time, and location widgets
 */

import {
    extensionSettings,
    lastGeneratedData,
    committedTrackerData,
    $infoBoxContainer
} from '../../core/state.js';
import { saveChatData, updateMessageSwipeData } from '../../core/persistence.js';
import { i18n } from '../../core/i18n.js';

/**
 * Helper to separate emoji from text in a string
 * Handles cases where there's no comma or space after emoji
 * @param {string} str - String potentially containing emoji followed by text
 * @returns {{emoji: string, text: string}} Separated emoji and text
 */
function separateEmojiFromText(str) {
    if (!str) return { emoji: '', text: '' };

    str = str.trim();

    // Regex to match emoji at the start (handles most emoji including compound ones)
    const emojiRegex = /^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F910}-\u{1F96B}\u{1F980}-\u{1F9E0}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}]+/u;
    const emojiMatch = str.match(emojiRegex);

    if (emojiMatch) {
        const emoji = emojiMatch[0];
        let text = str.substring(emoji.length).trim();

        // Remove leading comma or space if present
        text = text.replace(/^[,\s]+/, '');

        return { emoji, text };
    }

    // No emoji found - check if there's a comma separator anyway
    const commaParts = str.split(',');
    if (commaParts.length >= 2) {
        return {
            emoji: commaParts[0].trim(),
            text: commaParts.slice(1).join(',').trim()
        };
    }

    // No clear separation - return original as text
    return { emoji: '', text: str };
}

/**
 * Checks if a value is valid (not null, undefined, or the string "null")
 */
function isValidValue(val) {
    return val !== null && val !== undefined && val !== 'null' && val !== '';
}

/**
 * Checks if we have valid structured infoBox data
 * @param {Object} data - The infoBoxData object
 * @returns {boolean}
 */
function hasStructuredInfoBoxData(data) {
    if (!data) return false;
    // Handle recentEvents as either string or array
    const hasEvents = data.recentEvents && (
        (Array.isArray(data.recentEvents) && data.recentEvents.length > 0) ||
        (typeof data.recentEvents === 'string' && data.recentEvents.length > 0 && data.recentEvents !== 'null')
    );
    return isValidValue(data.date) || isValidValue(data.weather) || isValidValue(data.temperature) || 
           isValidValue(data.time) || isValidValue(data.location) || hasEvents;
}

/**
 * Renders the info box as a visual dashboard with calendar, weather, temperature, clock, and map widgets.
 * Includes event listeners for editable fields.
 */
export function renderInfoBox() {
    if (!extensionSettings.showInfoBox || !$infoBoxContainer) {
        return;
    }

    // Add updating class for animation
    if (extensionSettings.enableAnimations) {
        $infoBoxContainer.addClass('rpg-content-updating');
    }

    // Get structured data - prefer lastGeneratedData, fall back to committedTrackerData
    const structuredData = lastGeneratedData.infoBox || committedTrackerData.infoBox;
    let infoBoxData = null;
    
    // Convert structured data to text format for the fancy renderer
    if (structuredData && hasStructuredInfoBoxData(structuredData)) {
        const lines = [];
        if (isValidValue(structuredData.date)) lines.push(`Date: ${structuredData.date}`);
        if (isValidValue(structuredData.time)) lines.push(`Time: ${structuredData.time}`);
        if (isValidValue(structuredData.weather)) lines.push(`Weather: ${structuredData.weather}`);
        if (isValidValue(structuredData.temperature)) lines.push(`Temperature: ${structuredData.temperature}`);
        if (isValidValue(structuredData.location)) lines.push(`Location: ${structuredData.location}`);
        if (structuredData.recentEvents) {
            const events = Array.isArray(structuredData.recentEvents) 
                ? structuredData.recentEvents 
                : [structuredData.recentEvents];
            events.filter(e => e && e !== 'null').forEach(e => lines.push(`Recent Events: ${e}`));
        }
        if (lines.length > 0) {
            infoBoxData = lines.join('\n');
        }
    }

    // If no data yet, show placeholder
    if (!infoBoxData) {
        const placeholderHtml = `
            <div class="rpg-dashboard rpg-dashboard-row-1">
                <div class="rpg-dashboard-widget rpg-placeholder-widget">
                    <div class="rpg-placeholder-text" data-i18n-key="infobox.noData.title">${i18n.getTranslation('infobox.noData.title')}</div>
                    <div class="rpg-placeholder-hint" data-i18n-key="infobox.noData.instruction">${i18n.getTranslation('infobox.noData.instruction')}</div>
                </div>
            </div>
        `;
        $infoBoxContainer.html(placeholderHtml);
        if (extensionSettings.enableAnimations) {
            setTimeout(() => $infoBoxContainer.removeClass('rpg-content-updating'), 500);
        }
        return;
    }

    const lines = infoBoxData.split('\n');
    const data = {
        date: '',
        weekday: '',
        month: '',
        year: '',
        weatherEmoji: '',
        weatherForecast: '',
        temperature: '',
        tempValue: 0,
        timeStart: '',
        timeEnd: '',
        location: '',
        characters: []
    };

    // Track which fields we've already parsed to avoid duplicates from mixed formats
    const parsedFields = {
        date: false,
        temperature: false,
        time: false,
        location: false,
        weather: false
    };

    for (const line of lines) {
        // Helper to check if a value is valid (not null/empty)
        const isValidParsedValue = (val) => val && val !== 'null' && val !== 'undefined' && val.toLowerCase() !== 'none';
        
        // Support both new text format (Date:) and legacy emoji format (🗓️:)
        // Prioritize text format over emoji format
        if (line.startsWith('Date:')) {
            if (!parsedFields.date) {
                const dateStr = line.replace('Date:', '').trim();
                if (isValidParsedValue(dateStr)) {
                    const dateParts = dateStr.split(',').map(p => p.trim());
                    data.weekday = dateParts[0] || '';
                    data.month = dateParts[1] || '';
                    data.year = dateParts[2] || '';
                    data.date = dateStr;
                    parsedFields.date = true;
                }
            }
        } else if (line.includes('🗓️:')) {
            if (!parsedFields.date) {
                const dateStr = line.replace('🗓️:', '').trim();
                if (isValidParsedValue(dateStr)) {
                    const dateParts = dateStr.split(',').map(p => p.trim());
                    data.weekday = dateParts[0] || '';
                    data.month = dateParts[1] || '';
                    data.year = dateParts[2] || '';
                    data.date = dateStr;
                    parsedFields.date = true;
                }
            }
        } else if (line.startsWith('Temperature:')) {
            if (!parsedFields.temperature) {
                const tempStr = line.replace('Temperature:', '').trim();
                if (isValidParsedValue(tempStr)) {
                    data.temperature = tempStr;
                    const tempMatch = tempStr.match(/(-?\d+)/);
                    if (tempMatch) {
                        data.tempValue = parseInt(tempMatch[1]);
                    }
                    parsedFields.temperature = true;
                }
            }
        } else if (line.includes('🌡️:')) {
            if (!parsedFields.temperature) {
                const tempStr = line.replace('🌡️:', '').trim();
                if (isValidParsedValue(tempStr)) {
                    data.temperature = tempStr;
                    const tempMatch = tempStr.match(/(-?\d+)/);
                    if (tempMatch) {
                        data.tempValue = parseInt(tempMatch[1]);
                    }
                    parsedFields.temperature = true;
                }
            }
        } else if (line.startsWith('Time:')) {
            if (!parsedFields.time) {
                const timeStr = line.replace('Time:', '').trim();
                if (isValidParsedValue(timeStr)) {
                    data.time = timeStr;
                    const timeParts = timeStr.split('→').map(t => t.trim());
                    data.timeStart = timeParts[0] || '';
                    data.timeEnd = timeParts[1] || '';
                    parsedFields.time = true;
                }
            }
        } else if (line.includes('🕒:')) {
            if (!parsedFields.time) {
                const timeStr = line.replace('🕒:', '').trim();
                if (isValidParsedValue(timeStr)) {
                    data.time = timeStr;
                    const timeParts = timeStr.split('→').map(t => t.trim());
                    data.timeStart = timeParts[0] || '';
                    data.timeEnd = timeParts[1] || '';
                    parsedFields.time = true;
                }
            }
        } else if (line.startsWith('Location:')) {
            if (!parsedFields.location) {
                const locStr = line.replace('Location:', '').trim();
                if (isValidParsedValue(locStr)) {
                    data.location = locStr;
                    parsedFields.location = true;
                }
            }
        } else if (line.includes('🗺️:')) {
            if (!parsedFields.location) {
                const locStr = line.replace('🗺️:', '').trim();
                if (isValidParsedValue(locStr)) {
                    data.location = locStr;
                    parsedFields.location = true;
                }
            }
        } else if (line.startsWith('Weather:')) {
            if (!parsedFields.weather) {
                // New text format: Weather: [Emoji], [Forecast] OR Weather: [Emoji][Forecast] (no separator - FIXED)
                const weatherStr = line.replace('Weather:', '').trim();
                
                // Skip null/invalid values
                if (!isValidParsedValue(weatherStr)) {
                    parsedFields.weather = true; // Mark as parsed so we don't try again
                } else {
                    const { emoji, text } = separateEmojiFromText(weatherStr);

                    if (emoji && text) {
                        data.weatherEmoji = emoji;
                        data.weatherForecast = text;
                    } else if (weatherStr.includes(',')) {
                        // Fallback to comma split if emoji detection failed
                        const weatherParts = weatherStr.split(',').map(p => p.trim());
                        data.weatherEmoji = weatherParts[0] || '';
                        data.weatherForecast = weatherParts[1] || '';
                    } else {
                        // No clear separation - assume it's all forecast text
                        data.weatherEmoji = '🌤️'; // Default emoji
                        data.weatherForecast = weatherStr;
                    }

                    parsedFields.weather = true;
                }
            }
        } else {
            // Check if it's a legacy weather line (emoji format)
            // Only parse if we haven't already found weather in text format
            if (!parsedFields.weather) {
                // Since \p{Emoji} doesn't work reliably, use a simpler approach
                const hasColon = line.includes(':');
                const notInfoBox = !line.includes('Info Box');
                const notDivider = !line.includes('---');
                const notCodeFence = !line.trim().startsWith('```');

                if (hasColon && notInfoBox && notDivider && notCodeFence && line.trim().length > 0) {
                    const weatherMatch = line.match(/^\s*([^:]+):\s*(.+)$/);
                    if (weatherMatch) {
                        const potentialEmoji = weatherMatch[1].trim();
                        const forecast = weatherMatch[2].trim();

                        if (potentialEmoji.length <= 5) {
                            data.weatherEmoji = potentialEmoji;
                            data.weatherForecast = forecast;
                            parsedFields.weather = true;
                        }
                    }
                }
            }
        }
    }
    //     temperature: data.temperature,
    //     timeStart: data.timeStart,
    //     location: data.location
    // });

    // Sanitize parsed values - filter out "null" strings and invalid values
    const sanitize = (val) => (val && val !== 'null' && val !== 'undefined' && val.toLowerCase() !== 'none') ? val : '';
    data.date = sanitize(data.date);
    data.weekday = sanitize(data.weekday);
    data.month = sanitize(data.month);
    data.year = sanitize(data.year);
    data.weatherEmoji = sanitize(data.weatherEmoji);
    data.weatherForecast = sanitize(data.weatherForecast);
    data.temperature = sanitize(data.temperature);
    data.time = sanitize(data.time);
    data.timeStart = sanitize(data.timeStart);
    data.timeEnd = sanitize(data.timeEnd);
    data.location = sanitize(data.location);

    // Get tracker configuration
    const config = extensionSettings.trackerConfig?.infoBox;

    // Build visual dashboard HTML
    // Wrap all content in a scrollable container
    let html = '<div class="rpg-info-content">';

    // Row 1: Date, Weather, Temperature, Time widgets
    const row1Widgets = [];

    // Calendar widget - show if enabled
    if (config?.widgets?.date?.enabled) {
        // Apply date format conversion
        let monthDisplay = data.month || 'MON';
        let weekdayDisplay = data.weekday || 'DAY';
        const yearDisplay = data.year || 'YEAR';

        // Apply format based on config
        const dateFormat = config.widgets.date.format || 'dd/mm/yy';
        if (dateFormat === 'dd/mm/yy') {
            monthDisplay = monthDisplay.substring(0, 3).toUpperCase();
            weekdayDisplay = weekdayDisplay.substring(0, 3).toUpperCase();
        } else if (dateFormat === 'mm/dd/yy') {
            // For US format, show month first, day second
            monthDisplay = monthDisplay.substring(0, 3).toUpperCase();
            weekdayDisplay = weekdayDisplay.substring(0, 3).toUpperCase();
        } else if (dateFormat === 'yyyy-mm-dd') {
            // ISO format - show full names
            monthDisplay = monthDisplay;
            weekdayDisplay = weekdayDisplay;
        }

        row1Widgets.push(`
            <div class="rpg-dashboard-widget rpg-calendar-widget">
                <div class="rpg-calendar-top rpg-editable" contenteditable="true" data-field="month" data-full-value="${data.month || ''}" title="Click to edit">${monthDisplay}</div>
                <div class="rpg-calendar-day rpg-editable" contenteditable="true" data-field="weekday" data-full-value="${data.weekday || ''}" title="Click to edit">${weekdayDisplay}</div>
                <div class="rpg-calendar-year rpg-editable" contenteditable="true" data-field="year" data-full-value="${data.year || ''}" title="Click to edit">${yearDisplay}</div>
            </div>
        `);
    }

    // Weather widget - show if enabled
    if (config?.widgets?.weather?.enabled) {
        const weatherEmoji = data.weatherEmoji || '🌤️';
        const weatherForecast = data.weatherForecast || 'Weather';
        row1Widgets.push(`
            <div class="rpg-dashboard-widget rpg-weather-widget">
                <div class="rpg-weather-icon rpg-editable" contenteditable="true" data-field="weatherEmoji" title="Click to edit emoji">${weatherEmoji}</div>
                <div class="rpg-weather-forecast rpg-editable" contenteditable="true" data-field="weatherForecast" title="Click to edit">${weatherForecast}</div>
            </div>
        `);
    }

    // Temperature widget - show if enabled
    if (config?.widgets?.temperature?.enabled) {
        let tempDisplay = data.temperature || '20°C';
        let tempValue = data.tempValue || 20;

        // Apply temperature unit conversion
        const preferredUnit = config.widgets.temperature.unit || 'C';
        if (data.temperature) {
            // Detect current unit in the data
            const isCelsius = tempDisplay.includes('°C');
            const isFahrenheit = tempDisplay.includes('°F');

            if (preferredUnit === 'F' && isCelsius) {
                // Convert C to F
                const fahrenheit = Math.round((tempValue * 9/5) + 32);
                tempDisplay = `${fahrenheit}°F`;
                tempValue = fahrenheit;
            } else if (preferredUnit === 'C' && isFahrenheit) {
                // Convert F to C
                const celsius = Math.round((tempValue - 32) * 5/9);
                tempDisplay = `${celsius}°C`;
                tempValue = celsius;
            }
        } else {
            // No data yet, use default for preferred unit
            tempDisplay = preferredUnit === 'F' ? '68°F' : '20°C';
            tempValue = preferredUnit === 'F' ? 68 : 20;
        }

        // Calculate thermometer display (convert to Celsius for consistent thresholds)
        const tempInCelsius = preferredUnit === 'F' ? Math.round((tempValue - 32) * 5/9) : tempValue;
        const tempPercent = Math.min(100, Math.max(0, ((tempInCelsius + 20) / 60) * 100));
        const tempColor = tempInCelsius < 10 ? '#4a90e2' : tempInCelsius < 25 ? '#67c23a' : '#e94560';
        row1Widgets.push(`
            <div class="rpg-dashboard-widget rpg-temp-widget">
                <div class="rpg-thermometer">
                    <div class="rpg-thermometer-bulb"></div>
                    <div class="rpg-thermometer-tube">
                        <div class="rpg-thermometer-fill" style="height: ${tempPercent}%; background: ${tempColor}"></div>
                    </div>
                </div>
                <div class="rpg-temp-value rpg-editable" contenteditable="true" data-field="temperature" title="Click to edit">${tempDisplay}</div>
            </div>
        `);
    }

    // Time widget - show if enabled
    if (config?.widgets?.time?.enabled) {
        const timeDisplay = data.timeEnd || data.timeStart || '12:00';
        // Parse time for clock hands
        const timeMatch = timeDisplay.match(/(\d+):(\d+)/);
        let hourAngle = 0;
        let minuteAngle = 0;
        if (timeMatch) {
            const hours = parseInt(timeMatch[1]);
            const minutes = parseInt(timeMatch[2]);
            hourAngle = (hours % 12) * 30 + minutes * 0.5; // 30° per hour + 0.5° per minute
            minuteAngle = minutes * 6; // 6° per minute
        }
        row1Widgets.push(`
            <div class="rpg-dashboard-widget rpg-clock-widget">
                <div class="rpg-clock">
                    <div class="rpg-clock-face">
                        <div class="rpg-clock-hour" style="transform: rotate(${hourAngle}deg)"></div>
                        <div class="rpg-clock-minute" style="transform: rotate(${minuteAngle}deg)"></div>
                        <div class="rpg-clock-center"></div>
                    </div>
                </div>
                <div class="rpg-time-value rpg-editable" contenteditable="true" data-field="timeStart" title="Click to edit">${timeDisplay}</div>
            </div>
        `);
    }

    // Only create row 1 if there are widgets to show
    if (row1Widgets.length > 0) {
        html += '<div class="rpg-dashboard rpg-dashboard-row-1">';
        html += row1Widgets.join('');
        html += '</div>';
    }

    // Row 2: Location widget (full width) - show if enabled
    if (config?.widgets?.location?.enabled) {
        const locationDisplay = data.location || 'Location';
        html += `
            <div class="rpg-dashboard rpg-dashboard-row-2">
                <div class="rpg-dashboard-widget rpg-location-widget">
                    <div class="rpg-map-bg">
                        <div class="rpg-map-marker">📍</div>
                    </div>
                    <div class="rpg-location-text rpg-editable" contenteditable="true" data-field="location" title="Click to edit">${locationDisplay}</div>
                </div>
            </div>
        `;
    }

    // Row 3: Recent Events widget (notebook style) - show if enabled
    if (config?.widgets?.recentEvents?.enabled) {
        // Get Recent Events from structured data
        let recentEvents = [];
        if (structuredData?.recentEvents) {
            const events = structuredData.recentEvents;
            if (Array.isArray(events)) {
                recentEvents = events.filter(e => e && e !== 'null');
            } else if (typeof events === 'string' && events !== 'null') {
                recentEvents = [events];
            }
        }

        const validEvents = recentEvents.filter(e => e && e.trim() && e !== 'Event 1' && e !== 'Event 2' && e !== 'Event 3');

        // If no valid events, show at least one placeholder
        if (validEvents.length === 0) {
            validEvents.push('Click to add event');
        }

        html += `
            <div class="rpg-dashboard rpg-dashboard-row-3">
                <div class="rpg-dashboard-widget rpg-events-widget">
                    <div class="rpg-notebook-header">
                        <div class="rpg-notebook-ring"></div>
                        <div class="rpg-notebook-ring"></div>
                        <div class="rpg-notebook-ring"></div>
                    </div>
                    <div class="rpg-notebook-title" data-i18n-key="infobox.recentEvents.title">${i18n.getTranslation('infobox.recentEvents.title')}</div>
                    <div class="rpg-notebook-lines">
        `;

        // Dynamically generate event lines (max 3)
        for (let i = 0; i < Math.min(validEvents.length, 3); i++) {
            html += `
                        <div class="rpg-notebook-line">
                            <span class="rpg-bullet">•</span>
                            <span class="rpg-event-text rpg-editable" contenteditable="true" data-field="event${i + 1}" title="Click to edit">${validEvents[i]}</span>
                        </div>
            `;
        }

        // If we have less than 3 events, add empty placeholders with + icon
        for (let i = validEvents.length; i < 3; i++) {
            html += `
                        <div class="rpg-notebook-line rpg-event-add">
                            <span class="rpg-bullet">+</span>
                            <span class="rpg-event-text rpg-editable rpg-event-placeholder" contenteditable="true" data-field="event${i + 1}" title="Click to add event" data-i18n-key="infobox.recentEvents.addEventPlaceholder">${i18n.getTranslation('infobox.recentEvents.addEventPlaceholder')}</span>
                        </div>
            `;
        }

        html += `
                    </div>
                </div>
            </div>
        `;
    }

    // Close the scrollable content wrapper
    html += '</div>';

    $infoBoxContainer.html(html);

    // Add event handlers for editable Info Box fields
    $infoBoxContainer.find('.rpg-editable').on('blur', function() {
        const $this = $(this);
        const field = $this.data('field');
        const value = $this.text().trim();

        // For date fields, update the data-full-value immediately
        if (field === 'month' || field === 'weekday' || field === 'year') {
            $this.data('full-value', value);
            // Update the display to show abbreviated version
            if (field === 'month' || field === 'weekday') {
                $this.text(value.substring(0, 3).toUpperCase());
            } else {
                $this.text(value);
            }
        }

        // Handle recent events separately
        if (field === 'event1' || field === 'event2' || field === 'event3') {
            updateRecentEvent(field, value);
        } else {
            updateInfoBoxField(field, value);
        }
    });

    // For date fields, show full value on focus
    $infoBoxContainer.find('[data-field="month"], [data-field="weekday"], [data-field="year"]').on('focus', function() {
        const fullValue = $(this).data('full-value');
        if (fullValue) {
            $(this).text(fullValue);
        }
    });

    // Remove updating class after animation
    if (extensionSettings.enableAnimations) {
        setTimeout(() => $infoBoxContainer.removeClass('rpg-content-updating'), 500);
    }
}

/**
 * Updates a specific field in the Info Box structured data
 *
 * @param {string} field - Field name to update
 * @param {string} value - New value for the field
 */
export function updateInfoBoxField(field, value) {
    if (!lastGeneratedData.infoBox || typeof lastGeneratedData.infoBox !== 'object') {
        lastGeneratedData.infoBox = {};
    }

    const infoBox = lastGeneratedData.infoBox;

    // Map UI field names to structured data fields
    if (field === 'weekday' || field === 'month' || field === 'year') {
        // Parse existing date or create new one
        let weekday = '', month = '', year = '';
        if (infoBox.date) {
            const parts = infoBox.date.split(',').map(p => p.trim());
            weekday = parts[0] || '';
            month = parts[1] || '';
            year = parts[2] || '';
        }
        if (field === 'weekday') weekday = value;
        else if (field === 'month') month = value;
        else if (field === 'year') year = value;
        infoBox.date = `${weekday}, ${month}, ${year}`;
    } else if (field === 'weatherEmoji' || field === 'weatherForecast') {
        // Parse existing weather or create new one
        let emoji = '🌤️', forecast = '';
        if (infoBox.weather) {
            const match = infoBox.weather.match(/^(\S+)\s*(.*)$/);
            if (match) {
                emoji = match[1] || '🌤️';
                forecast = match[2] || '';
            }
        }
        if (field === 'weatherEmoji') emoji = value;
        else if (field === 'weatherForecast') forecast = value;
        infoBox.weather = `${emoji} ${forecast}`.trim();
    } else if (field === 'temperature') {
        infoBox.temperature = value;
    } else if (field === 'timeStart') {
        infoBox.time = `${value} → ${value}`;
    } else if (field === 'location') {
        infoBox.location = value;
    }

    // Update swipe data and save
    updateMessageSwipeData();
    saveChatData();
}

/**
 * Update a recent event in the tracker data
 * @param {string} field - event1, event2, or event3
 * @param {string} value - New event text
 */
function updateRecentEvent(field, value) {
    const eventIndex = { 'event1': 0, 'event2': 1, 'event3': 2 }[field];
    if (eventIndex === undefined) return;

    // Get existing events from structured data
    const infoBox = lastGeneratedData.infoBox || committedTrackerData.infoBox || {};
    let recentEvents = [];
    
    if (infoBox.recentEvents) {
        if (Array.isArray(infoBox.recentEvents)) {
            recentEvents = infoBox.recentEvents.filter(e => e && e !== 'null').slice(0, 3);
        } else if (typeof infoBox.recentEvents === 'string' && infoBox.recentEvents !== 'null') {
            recentEvents = [infoBox.recentEvents];
        }
    }

    // Filter out placeholder text
    const placeholderText = i18n.getTranslation('infobox.recentEvents.addEventPlaceholder');
    const cleanedValue = (value === placeholderText || value === 'Add event...' || value === 'Click to add event') ? '' : value.trim();

    // Update the specific event
    while (recentEvents.length <= eventIndex) {
        recentEvents.push('');
    }
    recentEvents[eventIndex] = cleanedValue;
    
    // Filter out empty events
    const validEvents = recentEvents.filter(e => e && e.trim());

    // Update structured infoBox in lastGeneratedData
    if (!lastGeneratedData.infoBox) {
        lastGeneratedData.infoBox = {};
    }
    lastGeneratedData.infoBox.recentEvents = validEvents;

    // Update swipe data and save
    updateMessageSwipeData();
    saveChatData();
}
