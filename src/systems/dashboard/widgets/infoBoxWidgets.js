/**
 * Info Box Widgets (Modular)
 *
 * Creates 5 separate, independently draggable widgets:
 * - Calendar Widget (date, weekday, month, year)
 * - Weather Widget (emoji + forecast)
 * - Temperature Widget (thermometer visualization)
 * - Clock Widget (analog clock + time display)
 * - Location Widget (map marker + location text)
 *
 * Each widget parses shared infoBox data and handles its own edits.
 * Users can arrange them independently or group them together.
 */

/**
 * Parse Info Box data from shared data source
 * @param {string} infoBoxText - Raw info box text
 * @returns {Object} Parsed data
 */
function parseInfoBoxData(infoBoxText) {
    if (!infoBoxText) {
        return {
            date: '', weekday: '', month: '', year: '',
            weatherEmoji: '', weatherForecast: '',
            temperature: '', tempValue: 0,
            timeStart: '', timeEnd: '',
            location: ''
        };
    }

    const lines = infoBoxText.split('\n');
    const data = {
        date: '', weekday: '', month: '', year: '',
        weatherEmoji: '', weatherForecast: '',
        temperature: '', tempValue: 0,
        timeStart: '', timeEnd: '',
        location: ''
    };

    for (const line of lines) {
        // Date parsing (text or emoji format)
        if (line.startsWith('Date:') || line.includes('🗓️:')) {
            const dateStr = line.replace(/^(Date:|🗓️:)/, '').trim();
            const dateParts = dateStr.split(',').map(p => p.trim());
            data.weekday = dateParts[0] || '';
            data.month = dateParts[1] || '';
            data.year = dateParts[2] || '';
            data.date = dateStr;
        }
        // Temperature parsing
        else if (line.startsWith('Temperature:') || line.includes('🌡️:')) {
            const tempStr = line.replace(/^(Temperature:|🌡️:)/, '').trim();
            data.temperature = tempStr;
            const tempMatch = tempStr.match(/(-?\d+)/);
            if (tempMatch) {
                data.tempValue = parseInt(tempMatch[1]);
            }
        }
        // Time parsing
        else if (line.startsWith('Time:') || line.includes('🕒:')) {
            const timeStr = line.replace(/^(Time:|🕒:)/, '').trim();
            data.time = timeStr;
            const timeParts = timeStr.split('→').map(t => t.trim());
            data.timeStart = timeParts[0] || '';
            data.timeEnd = timeParts[1] || '';
        }
        // Location parsing
        else if (line.startsWith('Location:') || line.includes('🗺️:')) {
            data.location = line.replace(/^(Location:|🗺️:)/, '').trim();
        }
        // Weather parsing (text format)
        else if (line.startsWith('Weather:')) {
            const weatherStr = line.replace('Weather:', '').trim();
            const weatherParts = weatherStr.split(',').map(p => p.trim());
            data.weatherEmoji = weatherParts[0] || '';
            data.weatherForecast = weatherParts[1] || '';
        }
        // Weather parsing (legacy emoji format)
        else if (!data.weatherEmoji && line.includes(':') && !line.includes('Info Box') && !line.includes('---')) {
            const weatherMatch = line.match(/^\s*([^:]+):\s*(.+)$/);
            if (weatherMatch) {
                const potentialEmoji = weatherMatch[1].trim();
                const forecast = weatherMatch[2].trim();
                if (potentialEmoji.length <= 5) {
                    data.weatherEmoji = potentialEmoji;
                    data.weatherForecast = forecast;
                }
            }
        }
    }

    return data;
}

/**
 * Update Info Box field in shared data
 * @param {Object} dependencies - External dependencies
 * @param {string} field - Field name
 * @param {string} value - New value
 */
function updateInfoBoxField(dependencies, field, value) {
    const { getInfoBoxData, setInfoBoxData, onDataChange } = dependencies;
    let infoBoxText = getInfoBoxData() || 'Info Box\n---\n';

    const lines = infoBoxText.split('\n');
    const updatedLines = [...lines];

    // Field-specific update logic
    if (field === 'weekday' || field === 'month' || field === 'year') {
        const dateLineIndex = lines.findIndex(l => l.startsWith('Date:') || l.includes('🗓️:'));
        if (dateLineIndex >= 0) {
            const parts = lines[dateLineIndex].split(',').map(p => p.trim());
            const prefix = lines[dateLineIndex].startsWith('Date:') ? 'Date:' : '🗓️:';
            const weekday = field === 'weekday' ? value : (parts[0] ? parts[0].replace(/^(Date:|🗓️:)/, '').trim() : 'Weekday');
            const month = field === 'month' ? value : (parts[1] || 'Month');
            const year = field === 'year' ? value : (parts[2] || 'YEAR');
            updatedLines[dateLineIndex] = `${prefix} ${weekday}, ${month}, ${year}`;
        } else {
            // Create new date line
            const dividerIndex = lines.findIndex(l => l.includes('---'));
            const weekday = field === 'weekday' ? value : 'Weekday';
            const month = field === 'month' ? value : 'Month';
            const year = field === 'year' ? value : 'YEAR';
            updatedLines.splice(dividerIndex + 1, 0, `Date: ${weekday}, ${month}, ${year}`);
        }
    }
    else if (field === 'weatherEmoji' || field === 'weatherForecast') {
        const weatherLineIndex = lines.findIndex(l => l.startsWith('Weather:') || (l.includes(':') && !l.includes('Date:') && !l.includes('Temperature:') && !l.includes('Time:') && !l.includes('Location:') && !l.includes('Info Box') && !l.includes('---')));
        if (weatherLineIndex >= 0) {
            const line = lines[weatherLineIndex];
            if (line.startsWith('Weather:')) {
                const parts = line.replace('Weather:', '').trim().split(',').map(p => p.trim());
                const emoji = field === 'weatherEmoji' ? value : (parts[0] || '🌤️');
                const forecast = field === 'weatherForecast' ? value : (parts[1] || 'Weather');
                updatedLines[weatherLineIndex] = `Weather: ${emoji}, ${forecast}`;
            } else {
                const parts = line.split(':');
                const emoji = field === 'weatherEmoji' ? value : parts[0].trim();
                const forecast = field === 'weatherForecast' ? value : parts[1].trim();
                updatedLines[weatherLineIndex] = `${emoji}: ${forecast}`;
            }
        } else {
            const dividerIndex = lines.findIndex(l => l.includes('---'));
            const emoji = field === 'weatherEmoji' ? value : '🌤️';
            const forecast = field === 'weatherForecast' ? value : 'Weather';
            updatedLines.splice(dividerIndex + 1, 0, `Weather: ${emoji}, ${forecast}`);
        }
    }
    else if (field === 'temperature') {
        const tempLineIndex = lines.findIndex(l => l.startsWith('Temperature:') || l.includes('🌡️:'));
        if (tempLineIndex >= 0) {
            const prefix = lines[tempLineIndex].startsWith('Temperature:') ? 'Temperature:' : '🌡️:';
            updatedLines[tempLineIndex] = `${prefix} ${value}`;
        } else {
            const dividerIndex = lines.findIndex(l => l.includes('---'));
            updatedLines.splice(dividerIndex + 1, 0, `Temperature: ${value}`);
        }
    }
    else if (field === 'timeStart') {
        const timeLineIndex = lines.findIndex(l => l.startsWith('Time:') || l.includes('🕒:'));
        if (timeLineIndex >= 0) {
            const prefix = lines[timeLineIndex].startsWith('Time:') ? 'Time:' : '🕒:';
            updatedLines[timeLineIndex] = `${prefix} ${value} → ${value}`;
        } else {
            const dividerIndex = lines.findIndex(l => l.includes('---'));
            updatedLines.splice(dividerIndex + 1, 0, `Time: ${value} → ${value}`);
        }
    }
    else if (field === 'location') {
        const locationLineIndex = lines.findIndex(l => l.startsWith('Location:') || l.includes('🗺️:'));
        if (locationLineIndex >= 0) {
            const prefix = lines[locationLineIndex].startsWith('Location:') ? 'Location:' : '🗺️:';
            updatedLines[locationLineIndex] = `${prefix} ${value}`;
        } else {
            updatedLines.push(`Location: ${value}`);
        }
    }

    const newInfoBoxText = updatedLines.join('\n');
    setInfoBoxData(newInfoBoxText);
    if (onDataChange) {
        onDataChange('infoBox', field, value);
    }
}

/**
 * Register Calendar Widget
 */
export function registerCalendarWidget(registry, dependencies) {
    registry.register('calendar', {
        name: 'Calendar',
        icon: '📅',
        description: 'Date, weekday, month, and year display',
        category: 'scene',
        minSize: { w: 1, h: 2 },
        defaultSize: { w: 1, h: 2 },
        requiresSchema: false,

        render(container, config = {}) {
            const { getInfoBoxData } = dependencies;
            const data = parseInfoBoxData(getInfoBoxData());

            const monthShort = data.month ? data.month.substring(0, 3).toUpperCase() : 'MON';
            const weekdayShort = data.weekday ? data.weekday.substring(0, 3).toUpperCase() : 'DAY';
            const yearDisplay = data.year || 'YEAR';

            const html = `
                <div class="rpg-dashboard-widget rpg-calendar-widget">
                    <div class="rpg-calendar-top rpg-editable" contenteditable="true" data-field="month" data-full-value="${data.month || ''}" title="Click to edit">${monthShort}</div>
                    <div class="rpg-calendar-day rpg-editable" contenteditable="true" data-field="weekday" data-full-value="${data.weekday || ''}" title="Click to edit">${weekdayShort}</div>
                    <div class="rpg-calendar-year rpg-editable" contenteditable="true" data-field="year" data-full-value="${data.year || ''}" title="Click to edit">${yearDisplay}</div>
                </div>
            `;

            container.innerHTML = html;
            attachCalendarHandlers(container, dependencies);
        }
    });
}

function attachCalendarHandlers(container, dependencies) {
    const editableFields = container.querySelectorAll('.rpg-editable');

    editableFields.forEach(field => {
        const fieldName = field.dataset.field;
        let originalValue = field.dataset.fullValue || field.textContent.trim();

        // Show full value on focus
        field.addEventListener('focus', () => {
            const fullValue = field.dataset.fullValue;
            if (fullValue) {
                field.textContent = fullValue;
            }
            originalValue = field.textContent.trim();

            const range = document.createRange();
            range.selectNodeContents(field);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
        });

        // Save on blur
        field.addEventListener('blur', () => {
            const value = field.textContent.trim();
            if (value && value !== originalValue) {
                field.dataset.fullValue = value;
                updateInfoBoxField(dependencies, fieldName, value);
            }

            // Update display to abbreviated version
            if (fieldName === 'month' || fieldName === 'weekday') {
                field.textContent = value.substring(0, 3).toUpperCase();
            } else {
                field.textContent = value;
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
    });
}

/**
 * Register Weather Widget
 */
export function registerWeatherWidget(registry, dependencies) {
    registry.register('weather', {
        category: 'scene',
        name: 'Weather',
        icon: '🌤️',
        description: 'Weather emoji and forecast',
        minSize: { w: 1, h: 2 },
        defaultSize: { w: 1, h: 2 },
        requiresSchema: false,

        render(container, config = {}) {
            const { getInfoBoxData } = dependencies;
            const data = parseInfoBoxData(getInfoBoxData());

            const weatherEmoji = data.weatherEmoji || '🌤️';
            const weatherForecast = data.weatherForecast || 'Weather';

            const html = `
                <div class="rpg-dashboard-widget rpg-weather-widget">
                    <div class="rpg-weather-icon rpg-editable" contenteditable="true" data-field="weatherEmoji" title="Click to edit emoji">${weatherEmoji}</div>
                    <div class="rpg-weather-forecast rpg-editable" contenteditable="true" data-field="weatherForecast" title="Click to edit">${weatherForecast}</div>
                </div>
            `;

            container.innerHTML = html;
            attachSimpleEditHandlers(container, dependencies);
        }
    });
}

/**
 * Register Temperature Widget
 */
export function registerTemperatureWidget(registry, dependencies) {
    registry.register('temperature', {
        category: 'scene',
        name: 'Temperature',
        icon: '🌡️',
        description: 'Temperature display with thermometer',
        minSize: { w: 1, h: 2 },
        defaultSize: { w: 1, h: 2 },
        requiresSchema: false,

        render(container, config = {}) {
            const { getInfoBoxData } = dependencies;
            const data = parseInfoBoxData(getInfoBoxData());

            const tempDisplay = data.temperature || '20°C';
            const tempValue = data.tempValue || 20;
            const tempPercent = Math.min(100, Math.max(0, ((tempValue + 20) / 60) * 100));
            const tempColor = tempValue < 10 ? '#4a90e2' : tempValue < 25 ? '#67c23a' : '#e94560';

            const html = `
                <div class="rpg-dashboard-widget rpg-temp-widget">
                    <div class="rpg-thermometer">
                        <div class="rpg-thermometer-bulb"></div>
                        <div class="rpg-thermometer-tube">
                            <div class="rpg-thermometer-fill" style="height: ${tempPercent}%; background: ${tempColor}"></div>
                        </div>
                    </div>
                    <div class="rpg-temp-value rpg-editable" contenteditable="true" data-field="temperature" title="Click to edit">${tempDisplay}</div>
                </div>
            `;

            container.innerHTML = html;
            attachSimpleEditHandlers(container, dependencies);
        }
    });
}

/**
 * Register Clock Widget
 */
export function registerClockWidget(registry, dependencies) {
    registry.register('clock', {
        category: 'scene',
        name: 'Clock',
        icon: '🕐',
        description: 'Analog clock with time display',
        minSize: { w: 1, h: 2 },
        defaultSize: { w: 1, h: 2 },
        requiresSchema: false,

        render(container, config = {}) {
            const { getInfoBoxData } = dependencies;
            const data = parseInfoBoxData(getInfoBoxData());

            const timeDisplay = data.timeEnd || data.timeStart || '12:00';

            // Parse time for clock hands
            const timeMatch = timeDisplay.match(/(\d+):(\d+)/);
            let hourAngle = 0;
            let minuteAngle = 0;
            if (timeMatch) {
                const hours = parseInt(timeMatch[1]);
                const minutes = parseInt(timeMatch[2]);
                hourAngle = (hours % 12) * 30 + minutes * 0.5;
                minuteAngle = minutes * 6;
            }

            const html = `
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
            `;

            container.innerHTML = html;
            attachSimpleEditHandlers(container, dependencies);
        }
    });
}

/**
 * Register Location Widget
 */
export function registerLocationWidget(registry, dependencies) {
    registry.register('location', {
        category: 'scene',
        name: 'Location',
        icon: '📍',
        description: 'Map with location display',
        minSize: { w: 1, h: 2 },
        defaultSize: { w: 2, h: 2 },
        requiresSchema: false,

        render(container, config = {}) {
            const { getInfoBoxData } = dependencies;
            const data = parseInfoBoxData(getInfoBoxData());

            const locationDisplay = data.location || 'Location';

            const html = `
                <div class="rpg-dashboard-widget rpg-location-widget">
                    <div class="rpg-map-bg">
                        <div class="rpg-map-marker">📍</div>
                    </div>
                    <div class="rpg-location-text rpg-editable" contenteditable="true" data-field="location" title="Click to edit">${locationDisplay}</div>
                </div>
            `;

            container.innerHTML = html;
            attachSimpleEditHandlers(container, dependencies);
        }
    });
}

/**
 * Attach simple edit handlers for single-field widgets
 */
function attachSimpleEditHandlers(container, dependencies) {
    const editableFields = container.querySelectorAll('.rpg-editable');

    editableFields.forEach(field => {
        const fieldName = field.dataset.field;
        let originalValue = field.textContent.trim();

        field.addEventListener('focus', () => {
            originalValue = field.textContent.trim();

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
