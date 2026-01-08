/**
 * Info Box Rendering Module
 * Handles rendering of the info box dashboard with weather, date, time, and location widgets
 */

import { getContext } from '../../../../../../extensions.js';
import {
    extensionSettings,
    lastGeneratedData,
    committedTrackerData,
    $infoBoxContainer
} from '../../core/state.js';
import { saveChatData } from '../../core/persistence.js';
import { i18n } from '../../core/i18n.js';
import { isItemLocked } from '../generation/lockManager.js';
import { repairJSON } from '../../utils/jsonRepair.js';

/**
 * Helper to generate lock icon HTML if setting is enabled
 * @param {string} tracker - Tracker name
 * @param {string} path - Item path
 * @returns {string} Lock icon HTML or empty string
 */
function getLockIconHtml(tracker, path) {
    const showLockIcons = extensionSettings.showLockIcons ?? true;
    if (!showLockIcons) return '';

    const isLocked = isItemLocked(tracker, path);
    const lockIcon = isLocked ? '🔒' : '🔓';
    const lockTitle = isLocked ? 'Locked' : 'Unlocked';
    const lockedClass = isLocked ? ' locked' : '';
    return `<span class="rpg-section-lock-icon${lockedClass}" data-tracker="${tracker}" data-path="${path}" title="${lockTitle}">${lockIcon}</span>`;
}

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
 * Renders the info box as a visual dashboard with calendar, weather, temperature, clock, and map widgets.
 * Includes event listeners for editable fields.
 */
export function renderInfoBox() {
    // console.log('[RPG InfoBox Render] ==================== RENDERING INFO BOX ====================');
    // console.log('[RPG InfoBox Render] showInfoBox setting:', extensionSettings.showInfoBox);
    // console.log('[RPG InfoBox Render] Container exists:', !!$infoBoxContainer);

    if (!extensionSettings.showInfoBox || !$infoBoxContainer) {
        // console.log('[RPG InfoBox Render] Exiting: showInfoBox or container is false');
        return;
    }

    // Use committedTrackerData as fallback if lastGeneratedData is empty (e.g., after page refresh)
    const infoBoxData = lastGeneratedData.infoBox || committedTrackerData.infoBox;
    // console.log('[RPG InfoBox Render] infoBoxData length:', infoBoxData ? infoBoxData.length : 'null');
    // console.log('[RPG InfoBox Render] infoBoxData preview:', infoBoxData ? infoBoxData.substring(0, 200) : 'null');

    // If no data yet, hide the container (e.g., after cache clear)
    if (!infoBoxData) {
        // console.log('[RPG InfoBox Render] No data, hiding container');
        $infoBoxContainer.empty().hide();
        return;
    }

    // Show container and add updating class for animation
    $infoBoxContainer.show();
    if (extensionSettings.enableAnimations) {
        $infoBoxContainer.addClass('rpg-content-updating');
    }

    // console.log('[RPG Companion] renderInfoBox called with data:', infoBoxData);

    let data = {
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

    // Check if data is v3 JSON format
    const trimmed = infoBoxData.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        const jsonData = repairJSON(infoBoxData);
        if (jsonData) {
            // Extract from v3 JSON structure
            data.weatherEmoji = jsonData.weather?.emoji || '';
            data.weatherForecast = jsonData.weather?.forecast || '';
            data.temperature = jsonData.temperature ? `${jsonData.temperature.value}°${jsonData.temperature.unit}` : '';
            data.tempValue = jsonData.temperature?.value || 0;
            data.timeStart = jsonData.time?.start || '';
            data.timeEnd = jsonData.time?.end || '';
            data.location = jsonData.location?.value || '';

            // Parse date string to extract weekday, month, year
            if (jsonData.date?.value) {
                data.date = jsonData.date.value;
                // Expected format: "Tuesday, October 17th, 2023"
                const dateParts = data.date.split(',').map(p => p.trim());
                data.weekday = dateParts[0] || '';
                data.month = dateParts[1] || '';
                data.year = dateParts[2] || '';
            }

            // Skip to rendering
        } else {
            // JSON parsing failed, fall back to text parsing
            parseTextFormat();
        }
    } else {
        // Text format
        parseTextFormat();
    }

    function parseTextFormat() {
        // Parse the info box data
        const lines = infoBoxData.split('\n');
        // console.log('[RPG Companion] Info Box split into lines:', lines);

    // Track which fields we've already parsed to avoid duplicates from mixed formats
    const parsedFields = {
        date: false,
        temperature: false,
        time: false,
        location: false,
        weather: false
    };

    for (const line of lines) {
        // console.log('[RPG Companion] Processing line:', line);

        // Support both new text format (Date:) and legacy emoji format (🗓️:)
        // Prioritize text format over emoji format
        if (line.startsWith('Date:')) {
            if (!parsedFields.date) {
                // console.log('[RPG Companion] → Matched DATE (text format)');
                const dateStr = line.replace('Date:', '').trim();
                const dateParts = dateStr.split(',').map(p => p.trim());
                data.weekday = dateParts[0] || '';
                data.month = dateParts[1] || '';
                data.year = dateParts[2] || '';
                data.date = dateStr;
                parsedFields.date = true;
            }
        } else if (line.includes('🗓️:')) {
            if (!parsedFields.date) {
                // console.log('[RPG Companion] → Matched DATE (emoji format)');
                const dateStr = line.replace('🗓️:', '').trim();
                const dateParts = dateStr.split(',').map(p => p.trim());
                data.weekday = dateParts[0] || '';
                data.month = dateParts[1] || '';
                data.year = dateParts[2] || '';
                data.date = dateStr;
                parsedFields.date = true;
            }
        } else if (line.startsWith('Temperature:')) {
            if (!parsedFields.temperature) {
                // console.log('[RPG Companion] → Matched TEMPERATURE (text format)');
                const tempStr = line.replace('Temperature:', '').trim();
                data.temperature = tempStr;
                const tempMatch = tempStr.match(/(-?\d+)/);
                if (tempMatch) {
                    data.tempValue = parseInt(tempMatch[1]);
                }
                parsedFields.temperature = true;
            }
        } else if (line.includes('🌡️:')) {
            if (!parsedFields.temperature) {
                // console.log('[RPG Companion] → Matched TEMPERATURE (emoji format)');
                const tempStr = line.replace('🌡️:', '').trim();
                data.temperature = tempStr;
                const tempMatch = tempStr.match(/(-?\d+)/);
                if (tempMatch) {
                    data.tempValue = parseInt(tempMatch[1]);
                }
                parsedFields.temperature = true;
            }
        } else if (line.startsWith('Time:')) {
            if (!parsedFields.time) {
                // console.log('[RPG Companion] → Matched TIME (text format)');
                const timeStr = line.replace('Time:', '').trim();
                data.time = timeStr;
                const timeParts = timeStr.split('→').map(t => t.trim());
                data.timeStart = timeParts[0] || '';
                data.timeEnd = timeParts[1] || '';
                parsedFields.time = true;
            }
        } else if (line.includes('🕒:')) {
            if (!parsedFields.time) {
                // console.log('[RPG Companion] → Matched TIME (emoji format)');
                const timeStr = line.replace('🕒:', '').trim();
                data.time = timeStr;
                const timeParts = timeStr.split('→').map(t => t.trim());
                data.timeStart = timeParts[0] || '';
                data.timeEnd = timeParts[1] || '';
                parsedFields.time = true;
            }
        } else if (line.startsWith('Location:')) {
            if (!parsedFields.location) {
                // console.log('[RPG Companion] → Matched LOCATION (text format)');
                data.location = line.replace('Location:', '').trim();
                parsedFields.location = true;
            }
        } else if (line.includes('🗺️:')) {
            if (!parsedFields.location) {
                // console.log('[RPG Companion] → Matched LOCATION (emoji format)');
                data.location = line.replace('🗺️:', '').trim();
                parsedFields.location = true;
            }
        } else if (line.startsWith('Weather:')) {
            if (!parsedFields.weather) {
                // New text format: Weather: [Emoji], [Forecast] OR Weather: [Emoji][Forecast] (no separator - FIXED)
                const weatherStr = line.replace('Weather:', '').trim();
                const { emoji, text } = separateEmojiFromText(weatherStr);

                if (emoji && text) {
                    data.weatherEmoji = emoji;
                    data.weatherForecast = text;
                } else if (weatherStr.includes(',')) {
                    // Fallback to comma split if emoji detection failed - split only on FIRST comma
                    const firstCommaIndex = weatherStr.indexOf(',');
                    data.weatherEmoji = weatherStr.substring(0, firstCommaIndex).trim();
                    data.weatherForecast = weatherStr.substring(firstCommaIndex + 1).trim();
                } else {
                    // No clear separation - assume it's all forecast text
                    data.weatherEmoji = '🌤️'; // Default emoji
                    data.weatherForecast = weatherStr;
                }

                parsedFields.weather = true;
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

                // console.log('[RPG Companion] → Checking weather conditions:', {
                //     line: line,
                //     hasColon: hasColon,
                //     notInfoBox: notInfoBox,
                //     notDivider: notDivider
                // });

                if (hasColon && notInfoBox && notDivider && notCodeFence && line.trim().length > 0) {
                    // Match format: [Weather Emoji]: [Forecast]
                    // Capture everything before colon as emoji, everything after as forecast
                    // console.log('[RPG Companion] → Testing WEATHER match for:', line);
                    const weatherMatch = line.match(/^\s*([^:]+):\s*(.+)$/);
                    if (weatherMatch) {
                        const potentialEmoji = weatherMatch[1].trim();
                        const forecast = weatherMatch[2].trim();

                        // If the first part is short (likely emoji), treat as weather
                        if (potentialEmoji.length <= 5) {
                            data.weatherEmoji = potentialEmoji;
                            data.weatherForecast = forecast;
                            parsedFields.weather = true;
                            // console.log('[RPG Companion] ✓ Weather parsed:', data.weatherEmoji, data.weatherForecast);
                        } else {
                            // console.log('[RPG Companion] ✗ First part too long for emoji:', potentialEmoji);
                        }
                    } else {
                        // console.log('[RPG Companion] ✗ Weather regex did not match');
                    }
                } else {
                    // console.log('[RPG Companion] → No match for this line');
                }
            }
        }
    }

    // console.log('[RPG Companion] Parsed Info Box data:', {
    //     date: data.date,
    //     weatherEmoji: data.weatherEmoji,
    //     weatherForecast: data.weatherForecast,
    //     temperature: data.temperature,
    //     timeStart: data.timeStart,
    //     location: data.location
    // });
    }

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
        let yearDisplay = data.year || 'YEAR';

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

        const dateLockIconHtml = getLockIconHtml('infoBox', 'date');

        row1Widgets.push(`
            <div class="rpg-dashboard-widget rpg-calendar-widget">
                ${dateLockIconHtml}
                <div class="rpg-calendar-top rpg-editable" contenteditable="true" data-field="month" data-full-value="${data.month || ''}" title="Click to edit">${monthDisplay}</div>
                <div class="rpg-calendar-day" title="Click to edit"><span class="rpg-calendar-day-text rpg-editable" contenteditable="true" data-field="weekday" data-full-value="${data.weekday || ''}">${weekdayDisplay}</span></div>
                <div class="rpg-calendar-year rpg-editable" contenteditable="true" data-field="year" data-full-value="${data.year || ''}" title="Click to edit">${yearDisplay}</div>
            </div>
        `);
    }

    // Weather widget - show if enabled
    if (config?.widgets?.weather?.enabled) {
        const weatherEmoji = data.weatherEmoji || '🌤️';
        const weatherForecast = data.weatherForecast || 'Weather';
        const weatherLockIconHtml = getLockIconHtml('infoBox', 'weather');

        row1Widgets.push(`
            <div class="rpg-dashboard-widget rpg-weather-widget">
                ${weatherLockIconHtml}
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
        const tempLockIconHtml = getLockIconHtml('infoBox', 'temperature');

        row1Widgets.push(`
            <div class="rpg-dashboard-widget rpg-temp-widget">
                ${tempLockIconHtml}
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
        // Determine which time value to display and edit
        const hasTimeEnd = Boolean(data.timeEnd);
        const hasTimeStart = Boolean(data.timeStart);
        const timeDisplay = data.timeEnd || data.timeStart || '12:00';
        const timeField = hasTimeEnd ? 'timeEnd' : 'timeStart';

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

        const timeLockIconHtml = getLockIconHtml('infoBox', 'time');

        row1Widgets.push(`
            <div class="rpg-dashboard-widget rpg-clock-widget">
                ${timeLockIconHtml}
                <div class="rpg-clock">
                    <div class="rpg-clock-face">
                        <div class="rpg-clock-hour" style="transform: rotate(${hourAngle}deg)"></div>
                        <div class="rpg-clock-minute" style="transform: rotate(${minuteAngle}deg)"></div>
                        <div class="rpg-clock-center"></div>
                    </div>
                </div>
                <div class="rpg-time-value rpg-editable" contenteditable="true" data-field="${timeField}" title="Click to edit">${timeDisplay}</div>
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
        const locationLockIconHtml = getLockIconHtml('infoBox', 'location');

        html += `
            <div class="rpg-dashboard rpg-dashboard-row-2">
                <div class="rpg-dashboard-widget rpg-location-widget">
                    ${locationLockIconHtml}
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
        // Parse Recent Events from infoBox (supports both JSON and text formats)
        let recentEvents = [];
        if (infoBoxData) {
            // Try JSON format first
            try {
                const parsed = typeof infoBoxData === 'string'
                    ? JSON.parse(infoBoxData)
                    : infoBoxData;

                if (parsed && Array.isArray(parsed.recentEvents)) {
                    recentEvents = parsed.recentEvents;
                }
            } catch (e) {
                // Fall back to old text format
                const recentEventsLine = infoBoxData.split('\n').find(line => line.startsWith('Recent Events:'));
                if (recentEventsLine) {
                    const eventsString = recentEventsLine.replace('Recent Events:', '').trim();
                    if (eventsString) {
                        recentEvents = eventsString.split(',').map(e => e.trim()).filter(e => e);
                    }
                }
            }
        }

        const validEvents = recentEvents.filter(e => e && e.trim() && e !== 'Event 1' && e !== 'Event 2' && e !== 'Event 3');

        // If no valid events, show at least one placeholder
        if (validEvents.length === 0) {
            validEvents.push('Click to add event');
        }

        const eventsLockIconHtml = getLockIconHtml('infoBox', 'recentEvents');

        html += `
            <div class="rpg-dashboard rpg-dashboard-row-3">
                <div class="rpg-dashboard-widget rpg-events-widget">
                    ${eventsLockIconHtml}
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

    // Add dynamic text scaling for location field
    const updateLocationTextSize = ($element) => {
        const text = $element.text();
        const charCount = text.length;
        $element.css('--char-count', Math.min(charCount, 100));
    };

    // Initial size update for location
    const $locationText = $infoBoxContainer.find('[data-field="location"]');
    if ($locationText.length) {
        updateLocationTextSize($locationText);
    }

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

        // Update location text size dynamically
        if (field === 'location') {
            updateLocationTextSize($this);
        }

        // Handle recent events separately
        if (field === 'event1' || field === 'event2' || field === 'event3') {
            updateRecentEvent(field, value);
        } else {
            updateInfoBoxField(field, value);
        }
    });

    // Update location size on input as well (real-time)
    $infoBoxContainer.find('[data-field="location"]').on('input', function() {
        updateLocationTextSize($(this));
    });

    // For date fields, show full value on focus
    $infoBoxContainer.find('[data-field="month"], [data-field="weekday"], [data-field="year"]').on('focus', function() {
        const fullValue = $(this).data('full-value');
        if (fullValue) {
            $(this).text(fullValue);
        }
    });

    // Add event handler for lock icons (support both click and touch)
    $infoBoxContainer.find('.rpg-section-lock-icon').on('click touchend', function(e) {
        e.preventDefault();
        e.stopPropagation();
        const $lockIcon = $(this);
        const tracker = $lockIcon.data('tracker');
        const path = $lockIcon.data('path');

        // Import lockManager dynamically to avoid circular dependencies
        import('../generation/lockManager.js').then(({ setItemLock, isItemLocked }) => {
            const isLocked = isItemLocked(tracker, path);
            const newLockState = !isLocked;
            setItemLock(tracker, path, newLockState);

            // Update icon
            $lockIcon.text(newLockState ? '🔒' : '🔓');
            $lockIcon.attr('title', newLockState ? 'Locked - AI cannot change this' : 'Unlocked - AI can change this');
            $lockIcon.toggleClass('locked', newLockState);

            // Save settings to persist lock state
            saveSettings();
        });
    });

    // Remove updating class after animation
    if (extensionSettings.enableAnimations) {
        setTimeout(() => $infoBoxContainer.removeClass('rpg-content-updating'), 500);
    }

    // Update weather effect after rendering
    if (window.RPGCompanion?.updateWeatherEffect) {
        window.RPGCompanion.updateWeatherEffect();
    }
}

/**
 * Updates a specific field in the Info Box data and re-renders.
 * Handles complex field reconstruction logic for date parts, weather, temperature, time, and location.
 *
 * @param {string} field - Field name to update
 * @param {string} value - New value for the field
 */
export function updateInfoBoxField(field, value) {
    if (!lastGeneratedData.infoBox) {
        // Initialize with empty info box if it doesn't exist
        lastGeneratedData.infoBox = 'Info Box\n---\n';
    }

    // Check if data is in v3 JSON format
    const trimmed = lastGeneratedData.infoBox.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        // Handle v3 JSON format
        const jsonData = repairJSON(lastGeneratedData.infoBox);
        if (jsonData) {
            // Update the appropriate field based on v3 structure
            if (field === 'weatherEmoji') {
                if (!jsonData.weather) jsonData.weather = {};
                jsonData.weather.emoji = value;
            } else if (field === 'weatherForecast') {
                if (!jsonData.weather) jsonData.weather = {};
                jsonData.weather.forecast = value;
            } else if (field === 'temperature') {
                // Parse temperature value and unit
                const tempMatch = value.match(/(-?\d+)\s*°?\s*([CF]?)/i);
                if (tempMatch) {
                    if (!jsonData.temperature) jsonData.temperature = {};
                    jsonData.temperature.value = parseInt(tempMatch[1]);
                    jsonData.temperature.unit = (tempMatch[2] || 'C').toUpperCase();
                }
            } else if (field === 'timeStart') {
                if (!jsonData.time) jsonData.time = {};
                jsonData.time.start = value;
            } else if (field === 'timeEnd') {
                if (!jsonData.time) jsonData.time = {};
                jsonData.time.end = value;
            } else if (field === 'location') {
                if (!jsonData.location) jsonData.location = {};
                jsonData.location.value = value;
            } else if (field === 'weekday' || field === 'month' || field === 'year') {
                // Update date components
                if (!jsonData.date) jsonData.date = {};
                let currentDate = jsonData.date.value || '';
                const dateParts = currentDate.split(',').map(p => p.trim());

                if (field === 'weekday') {
                    dateParts[0] = value;
                } else if (field === 'month') {
                    dateParts[1] = value;
                } else if (field === 'year') {
                    dateParts[2] = value;
                }

                jsonData.date.value = dateParts.filter(p => p).join(', ');
            }

            // Save back as JSON
            lastGeneratedData.infoBox = JSON.stringify(jsonData, null, 2);
            committedTrackerData.infoBox = lastGeneratedData.infoBox;
            saveChatData();
            renderInfoBox();
            // console.log('[RPG Companion] Updated info box field (v3 JSON):', { field, value });
            return;
        }
    }

    // Fall back to text format handling
    // Reconstruct the Info Box text with updated field
    const lines = lastGeneratedData.infoBox.split('\n');
    let dateLineFound = false;
    let dateLineIndex = -1;
    let weatherLineIndex = -1;

    // Find the date line
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('🗓️:') || lines[i].startsWith('Date:')) {
            dateLineFound = true;
            dateLineIndex = i;
            break;
        }
    }

    // Find the weather line (look for a line that's not date/temp/time/location)
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.match(/^[^:]+:\s*.+$/) &&
            !line.includes('🗓️') &&
            !line.startsWith('Date:') &&
            !line.includes('🌡️') &&
            !line.startsWith('Temperature:') &&
            !line.includes('🕒') &&
            !line.startsWith('Time:') &&
            !line.includes('🗺️') &&
            !line.startsWith('Location:') &&
            !line.includes('Info Box') &&
            !line.includes('---')) {
            weatherLineIndex = i;
            break;
        }
    }

    const updatedLines = lines.map((line, index) => {
        if (field === 'month' && (line.includes('🗓️:') || line.startsWith('Date:'))) {
            const parts = line.split(',');
            if (parts.length >= 2) {
                // parts[0] = "Date: Weekday" or "🗓️: Weekday", parts[1] = " Month", parts[2] = " Year"
                parts[1] = ' ' + value;
                return parts.join(',');
            } else if (parts.length === 1) {
                // No existing month/year, add them
                return `${parts[0]}, ${value}, YEAR`;
            }
        } else if (field === 'weekday' && (line.includes('🗓️:') || line.startsWith('Date:'))) {
            const parts = line.split(',');
            // Keep the format (text or emoji), just update the weekday
            const month = parts[1] ? parts[1].trim() : 'Month';
            const year = parts[2] ? parts[2].trim() : 'YEAR';
            if (line.startsWith('Date:')) {
                return `Date: ${value}, ${month}, ${year}`;
            } else {
                return `🗓️: ${value}, ${month}, ${year}`;
            }
        } else if (field === 'year' && (line.includes('🗓️:') || line.startsWith('Date:'))) {
            const parts = line.split(',');
            if (parts.length >= 3) {
                parts[2] = ' ' + value;
                return parts.join(',');
            } else if (parts.length === 2) {
                // No existing year, add it
                return `${parts[0]}, ${parts[1]}, ${value}`;
            } else if (parts.length === 1) {
                // No existing month/year, add them
                return `${parts[0]}, Month, ${value}`;
            }
        } else if (field === 'weatherEmoji' && index === weatherLineIndex) {
            // Only update the specific weather line we found
            if (line.startsWith('Weather:')) {
                // New format: Weather: emoji, forecast
                const weatherContent = line.replace('Weather:', '').trim();
                // Split only on first comma to get emoji and rest
                const firstCommaIndex = weatherContent.indexOf(',');
                const forecast = firstCommaIndex > 0 ? weatherContent.substring(firstCommaIndex + 1).trim() : 'Weather';
                return `Weather: ${value}, ${forecast}`;
            } else {
                // Legacy format: emoji: forecast
                const firstColonIndex = line.indexOf(':');
                if (firstColonIndex >= 0) {
                    const forecast = line.substring(firstColonIndex + 1).trim();
                    return `${value}: ${forecast}`;
                }
            }
        } else if (field === 'weatherForecast' && index === weatherLineIndex) {
            // Only update the specific weather line we found
            if (line.startsWith('Weather:')) {
                // New format: Weather: emoji, forecast
                const weatherContent = line.replace('Weather:', '').trim();
                // Split only on first comma to get emoji and rest
                const firstCommaIndex = weatherContent.indexOf(',');
                const emoji = firstCommaIndex > 0 ? weatherContent.substring(0, firstCommaIndex).trim() : '🌤️';
                return `Weather: ${emoji}, ${value}`;
            } else {
                // Legacy format: emoji: forecast
                const firstColonIndex = line.indexOf(':');
                if (firstColonIndex >= 0) {
                    const emoji = line.substring(0, firstColonIndex).trim();
                    return `${emoji}: ${value}`;
                }
            }
        } else if (field === 'temperature' && (line.includes('🌡️:') || line.startsWith('Temperature:'))) {
            // Support both emoji and text formats
            if (line.startsWith('Temperature:')) {
                return `Temperature: ${value}`;
            } else {
                return `🌡️: ${value}`;
            }
        } else if (field === 'timeStart' && (line.includes('🕒:') || line.startsWith('Time:'))) {
            // Update time format: "HH:MM → HH:MM"
            // When user edits, set both start and end time to the new value
            if (line.startsWith('Time:')) {
                return `Time: ${value} → ${value}`;
            } else {
                return `🕒: ${value} → ${value}`;
            }
        } else if (field === 'location' && (line.includes('🗺️:') || line.startsWith('Location:'))) {
            // Support both emoji and text formats
            if (line.startsWith('Location:')) {
                return `Location: ${value}`;
            } else {
                return `🗺️: ${value}`;
            }
        }
        return line;
    });

    // If editing a date field but no date line exists, create one after the divider
    if ((field === 'month' || field === 'weekday' || field === 'year') && !dateLineFound) {
        // Find the divider line
        const dividerIndex = updatedLines.findIndex(line => line.includes('---'));
        if (dividerIndex >= 0) {
            // Create initial date line with the edited field (use text format to match current standard)
            let newDateLine = '';
            if (field === 'weekday') {
                newDateLine = `Date: ${value}, Month, YEAR`;
            } else if (field === 'month') {
                newDateLine = `Date: Weekday, ${value}, YEAR`;
            } else if (field === 'year') {
                newDateLine = `Date: Weekday, Month, ${value}`;
            }
            // Insert after the divider
            updatedLines.splice(dividerIndex + 1, 0, newDateLine);
        }
    }

    // If editing weather but no weather line exists, create one
    if ((field === 'weatherEmoji' || field === 'weatherForecast')) {
        let weatherLineFound = false;
        for (const line of updatedLines) {
            // Check if this is a weather line (has emoji and forecast, not one of the special fields)
            if (line.match(/^[^:]+:\s*.+$/) && !line.includes('🗓️') && !line.startsWith('Date:') && !line.includes('🌡️') && !line.startsWith('Temperature:') && !line.includes('🕒') && !line.startsWith('Time:') && !line.includes('🗺️') && !line.startsWith('Location:') && !line.includes('Info Box') && !line.includes('---')) {
                weatherLineFound = true;
                break;
            }
        }

        if (!weatherLineFound) {
            const dividerIndex = updatedLines.findIndex(line => line.includes('---'));
            if (dividerIndex >= 0) {
                let newWeatherLine = '';
                if (field === 'weatherEmoji') {
                    newWeatherLine = `Weather: ${value}, Weather`;
                } else if (field === 'weatherForecast') {
                    newWeatherLine = `Weather: 🌤️, ${value}`;
                }
                // Insert after date line if it exists, otherwise after divider
                const dateIndex = updatedLines.findIndex(line => line.includes('🗓️:') || line.startsWith('Date:'));
                const insertIndex = dateIndex >= 0 ? dateIndex + 1 : dividerIndex + 1;
                updatedLines.splice(insertIndex, 0, newWeatherLine);
            }
        }
    }

    // If editing temperature but no temperature line exists, create one
    if (field === 'temperature') {
        const tempLineFound = updatedLines.some(line => line.includes('🌡️:') || line.startsWith('Temperature:'));
        if (!tempLineFound) {
            const dividerIndex = updatedLines.findIndex(line => line.includes('---'));
            if (dividerIndex >= 0) {
                const newTempLine = `Temperature: ${value}`;
                // Find last non-empty line before creating position
                let insertIndex = dividerIndex + 1;
                for (let i = 0; i < updatedLines.length; i++) {
                    if (updatedLines[i].includes('🗓️:') || updatedLines[i].startsWith('Date:') || updatedLines[i].match(/^[^:]+:\s*.+$/)) {
                        insertIndex = i + 1;
                    }
                }
                updatedLines.splice(insertIndex, 0, newTempLine);
            }
        }
    }

    // If editing time but no time line exists, create one
    if (field === 'timeStart') {
        const timeLineFound = updatedLines.some(line => line.includes('🕒:') || line.startsWith('Time:'));
        if (!timeLineFound) {
            const dividerIndex = updatedLines.findIndex(line => line.includes('---'));
            if (dividerIndex >= 0) {
                const newTimeLine = `Time: ${value} → ${value}`;
                // Find last non-empty line before creating position
                let insertIndex = dividerIndex + 1;
                for (let i = 0; i < updatedLines.length; i++) {
                    if (updatedLines[i].includes('🗓️:') || updatedLines[i].startsWith('Date:') || updatedLines[i].includes('🌡️:') || updatedLines[i].startsWith('Temperature:') || updatedLines[i].match(/^[^:]+:\s*.+$/)) {
                        insertIndex = i + 1;
                    }
                }
                updatedLines.splice(insertIndex, 0, newTimeLine);
            }
        }
    }

    // If editing location but no location line exists, create one
    if (field === 'location') {
        const locationLineFound = updatedLines.some(line => line.includes('🗺️:') || line.startsWith('Location:'));
        if (!locationLineFound) {
            const dividerIndex = updatedLines.findIndex(line => line.includes('---'));
            if (dividerIndex >= 0) {
                const newLocationLine = `Location: ${value}`;
                // Insert at the end (before any empty lines)
                let insertIndex = updatedLines.length;
                for (let i = updatedLines.length - 1; i >= 0; i--) {
                    if (updatedLines[i].trim() !== '') {
                        insertIndex = i + 1;
                        break;
                    }
                }
                updatedLines.splice(insertIndex, 0, newLocationLine);
            }
        }
    }

    lastGeneratedData.infoBox = updatedLines.join('\n');

    // Update BOTH lastGeneratedData AND committedTrackerData
    // This makes manual edits immediately visible to AI
    committedTrackerData.infoBox = updatedLines.join('\n');

    // Update the message's swipe data
    const chat = getContext().chat;
    if (chat && chat.length > 0) {
        for (let i = chat.length - 1; i >= 0; i--) {
            const message = chat[i];
            if (!message.is_user) {
                if (message.extra && message.extra.rpg_companion_swipes) {
                    const swipeId = message.swipe_id || 0;
                    if (message.extra.rpg_companion_swipes[swipeId]) {
                        message.extra.rpg_companion_swipes[swipeId].infoBox = updatedLines.join('\n');
                        // console.log('[RPG Companion] Updated infoBox in message swipe data');
                    }
                }
                break;
            }
        }
    }

    saveChatData();

    // Only re-render if NOT editing date fields
    // Date fields will update on next tracker generation to avoid losing user input
    if (field !== 'month' && field !== 'weekday' && field !== 'year') {
        renderInfoBox();
    }
}

/**
 * Update a recent event in the committed tracker data
 * @param {string} field - event1, event2, or event3
 * @param {string} value - New event text
 */
function updateRecentEvent(field, value) {
    // Map field to index
    const eventIndex = {
        'event1': 0,
        'event2': 1,
        'event3': 2
    }[field];

    if (eventIndex !== undefined) {
        // Parse current infoBox to get existing events
        const lines = (committedTrackerData.infoBox || '').split('\n');
        let recentEvents = [];

        // Find existing Recent Events line
        const recentEventsLine = lines.find(line => line.startsWith('Recent Events:'));
        if (recentEventsLine) {
            const eventsString = recentEventsLine.replace('Recent Events:', '').trim();
            if (eventsString) {
                recentEvents = eventsString.split(',').map(e => e.trim()).filter(e => e);
            }
        }

        // Ensure array has enough slots
        while (recentEvents.length <= eventIndex) {
            recentEvents.push('');
        }

        // Update the specific event
        recentEvents[eventIndex] = value;

        // Filter out empty events and rebuild the line
        const validEvents = recentEvents.filter(e => e && e.trim());
        const newRecentEventsLine = validEvents.length > 0
            ? `Recent Events: ${validEvents.join(', ')}`
            : '';

        // Update infoBox with new Recent Events line
        const updatedLines = lines.filter(line => !line.startsWith('Recent Events:'));
        if (newRecentEventsLine) {
            // Add Recent Events line at the end (before any empty lines)
            let insertIndex = updatedLines.length;
            for (let i = updatedLines.length - 1; i >= 0; i--) {
                if (updatedLines[i].trim() !== '') {
                    insertIndex = i + 1;
                    break;
                }
            }
            updatedLines.splice(insertIndex, 0, newRecentEventsLine);
        }

        committedTrackerData.infoBox = updatedLines.join('\n');
        lastGeneratedData.infoBox = updatedLines.join('\n');

        // Update the message's swipe data
        const chat = getContext().chat;
        if (chat && chat.length > 0) {
            for (let i = chat.length - 1; i >= 0; i--) {
                const message = chat[i];
                if (!message.is_user) {
                    if (message.extra && message.extra.rpg_companion_swipes) {
                        const swipeId = message.swipe_id || 0;
                        if (message.extra.rpg_companion_swipes[swipeId]) {
                            message.extra.rpg_companion_swipes[swipeId].infoBox = updatedLines.join('\n');
                        }
                    }
                    break;
                }
            }
        }

        saveChatData();
        renderInfoBox();

        // Update weather effect after rendering
        if (window.RPGCompanion?.updateWeatherEffect) {
            window.RPGCompanion.updateWeatherEffect();
        }

        // console.log(`[RPG Companion] Updated recent event ${field}:`, value);
    }
}
