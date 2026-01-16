/**
 * Real-World Integration System
 * Main exports for weather, time, location, and privacy services
 *
 * This module provides real-world data integration for RPG companions,
 * allowing them to be aware of the player's actual context (time of day,
 * weather conditions, location, special dates, etc.)
 *
 * @module realworld
 *
 * @example
 * // Basic usage
 * import { RealWorldContextBuilder } from './realworld/index.js';
 *
 * const contextBuilder = new RealWorldContextBuilder();
 * await contextBuilder.initialize();
 *
 * // Get context for prompt injection
 * const context = await contextBuilder.buildContext();
 * const promptText = contextBuilder.formatForPrompt(context);
 *
 * @example
 * // Get contextual dialogue
 * const dialogue = await contextBuilder.getContextualDialogue('friendly');
 * console.log(dialogue); // "It's really late... Maybe you should get some rest?"
 *
 * @example
 * // Access individual services
 * const { weather, time, location, privacy } = contextBuilder.getServices();
 *
 * // Check current time
 * const timeData = time.getCurrentTime();
 * console.log(timeData.period); // "evening"
 *
 * // Configure privacy
 * privacy.setSetting('shareWeather', true);
 * privacy.setSetting('locationPrecision', 'city');
 */

// Core services
export { WeatherService } from './weatherService.js';
export { TimeService } from './timeService.js';
export { LocationService } from './locationService.js';
export { PrivacyManager } from './privacyManager.js';

// Main context builder (recommended for most use cases)
export { RealWorldContextBuilder } from './contextBuilder.js';

// Default export is the context builder
export { RealWorldContextBuilder as default } from './contextBuilder.js';

/**
 * Create a pre-configured context builder instance
 * @param {Object} [options] - Configuration options
 * @param {string} [options.temperatureUnit='C'] - Temperature unit ('C' or 'F')
 * @param {number} [options.timeOffset=0] - Hours to offset from real time
 * @param {boolean} [options.autoInitialize=false] - Automatically initialize (request location)
 * @returns {Promise<import('./contextBuilder.js').RealWorldContextBuilder>}
 */
export async function createRealWorldContext(options = {}) {
    const { RealWorldContextBuilder } = await import('./contextBuilder.js');

    const builder = new RealWorldContextBuilder({
        time: {
            timeOffset: options.timeOffset || 0
        },
        weather: {
            temperatureUnit: options.temperatureUnit || 'C'
        }
    });

    if (options.autoInitialize) {
        await builder.initialize();
    }

    return builder;
}

/**
 * Quick function to get current real-world context as a string
 * Useful for one-off context generation without managing an instance
 * @param {Object} [options] - Options
 * @param {boolean} [options.includeWeather=true] - Include weather data
 * @param {boolean} [options.includeLocation=false] - Include location data
 * @returns {Promise<string>}
 */
export async function getQuickContext(options = {}) {
    const { TimeService } = await import('./timeService.js');

    const time = new TimeService();
    const timeData = time.getCurrentTime();
    const parts = [];

    // Time is always included
    parts.push(`Time: ${timeData.timeFormatted} (${time.getTimeOfDayDescription()})`);
    parts.push(`Day: ${timeData.dayOfWeek}`);

    // Check for special dates
    const special = time.checkSpecialDates();
    if (special) {
        parts.push(`Special: ${special.name}`);
    }

    // Season
    const season = time.getSeason();
    parts.push(`Season: ${season.season}`);

    return parts.join(' | ');
}

/**
 * Get the privacy summary without creating a full context builder
 * @returns {string}
 */
export function getPrivacySummary() {
    // PrivacyManager is already imported at module level
    const privacy = new PrivacyManager();
    return privacy.getPrivacySummary();
}

/**
 * Version information
 */
export const VERSION = '1.0.0';

/**
 * Feature capabilities of this module
 */
export const CAPABILITIES = {
    weather: {
        provider: 'Open-Meteo',
        features: ['current conditions', 'temperature', 'wind speed', 'humidity'],
        cacheTime: '30 minutes'
    },
    time: {
        features: ['real-time sync', 'time offset', 'special dates', 'seasons'],
        timezones: 'IANA timezone support'
    },
    location: {
        provider: 'OpenStreetMap Nominatim',
        features: ['GPS', 'reverse geocoding', 'privacy levels'],
        privacyLevels: ['exact', 'city (~10km)', 'region (~100km)', 'none']
    },
    privacy: {
        storage: 'localStorage',
        defaultPrivacy: 'Location off by default, weather/time on',
        consentRequired: true
    }
};
