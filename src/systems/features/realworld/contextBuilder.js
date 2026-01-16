/**
 * Real-World Context Builder
 * Combines all real-world data into context injection for companion prompts
 *
 * @module realworld/contextBuilder
 */

import { WeatherService } from './weatherService.js';
import { TimeService } from './timeService.js';
import { LocationService } from './locationService.js';
import { PrivacyManager } from './privacyManager.js';

/**
 * Built context data
 * @typedef {Object} RealWorldContext
 * @property {number} timestamp - When context was built
 * @property {string[]} parts - Array of context parts for prompt injection
 * @property {Object} [time] - Time data if enabled
 * @property {Object} [weather] - Weather data if enabled
 * @property {Object} [location] - Location data if enabled
 * @property {Object} [specialDate] - Special date info if any
 * @property {Object} [season] - Season info if enabled
 */

/**
 * Context builder options
 * @typedef {Object} ContextBuilderOptions
 * @property {Object} [time] - TimeService options
 * @property {Object} [weather] - WeatherService options
 * @property {Object} [location] - LocationService options
 */

/**
 * Builds real-world context for injection into companion prompts
 */
export class RealWorldContextBuilder {
    /**
     * Create a context builder
     * @param {ContextBuilderOptions} [options={}]
     */
    constructor(options = {}) {
        /** @type {WeatherService} */
        this.weather = new WeatherService();
        /** @type {TimeService} */
        this.time = new TimeService(options.time);
        /** @type {LocationService} */
        this.location = new LocationService();
        /** @type {PrivacyManager} */
        this.privacy = new PrivacyManager();

        // Apply temperature unit preference if set
        if (options.weather?.temperatureUnit) {
            this.weather.setTemperatureUnit(options.weather.temperatureUnit);
        }

        // Sync privacy settings to location service
        this.location.setPrivacyLevel(this.privacy.getLocationPrecision());

        // Listen for privacy changes
        this.privacy.addChangeListener((settings) => {
            this.location.setPrivacyLevel(
                settings.shareLocation ? settings.locationPrecision : 'none'
            );
        });

        /** @type {RealWorldContext|null} */
        this.cachedContext = null;
        /** @type {number} */
        this.lastBuild = 0;
        /** @type {number} Cache time in ms (5 minutes) */
        this.cacheTime = 5 * 60 * 1000;

        /** @type {boolean} */
        this.initialized = false;
    }

    /**
     * Initialize the context builder (request location if enabled)
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this.initialized) return;

        if (this.privacy.canShareLocation()) {
            try {
                await this.location.requestLocation();
            } catch (error) {
                console.warn('[RPG Companion] Could not get location:', error.message);
            }
        }

        this.initialized = true;
    }

    /**
     * Build real-world context for prompt injection
     * @param {boolean} [forceRefresh=false] - Force rebuild ignoring cache
     * @returns {Promise<RealWorldContext>}
     */
    async buildContext(forceRefresh = false) {
        // Check cache
        if (!forceRefresh && this.cachedContext && Date.now() - this.lastBuild < this.cacheTime) {
            return this.cachedContext;
        }

        const context = {
            timestamp: Date.now(),
            parts: []
        };

        // Add time context
        if (this.privacy.canShareTime()) {
            const timeData = this.time.getCurrentTime();
            context.time = timeData;
            context.parts.push(`Current time: ${timeData.timeFormatted} (${this.time.getTimeOfDayDescription()})`);
            context.parts.push(`Day: ${timeData.dayOfWeek}, ${timeData.date}`);
        }

        // Add timezone context
        if (this.privacy.canShareTimezone()) {
            context.timezone = this.time.timezone;
            context.parts.push(`Timezone: ${this.time.timezone}`);
        }

        // Add season context
        if (this.privacy.canShareSeason()) {
            const season = this.time.getSeason();
            context.season = season;
            context.parts.push(`Season: ${season.season} ${season.emoji}`);
        }

        // Check for special dates
        if (this.privacy.canShareCalendar()) {
            const special = this.time.checkSpecialDates();
            if (special) {
                context.specialDate = special;
                context.parts.push(`Special occasion: ${special.name} ${special.emoji || ''}`);
            }
        }

        // Add location context (if available)
        if (this.privacy.canShareLocation() && this.location.currentLocation) {
            const place = await this.location.getCurrentPlaceName();
            if (place) {
                context.location = place;
                const locationDesc = this.location.getLocationDescription();
                context.parts.push(`Location: ${locationDesc}`);
            }
        }

        // Add weather context (requires location)
        if (this.privacy.canShareWeather() && this.location.currentLocation) {
            try {
                const weatherData = await this.weather.getCurrentWeather(
                    this.location.currentLocation.latitude,
                    this.location.currentLocation.longitude
                );
                context.weather = weatherData;
                context.parts.push(
                    `Weather: ${weatherData.weatherEmoji} ${weatherData.weatherDescription}, ` +
                    `${weatherData.temperature}°${weatherData.temperatureUnit}`
                );
                if (weatherData.windSpeed > 10) {
                    context.parts.push(`Wind: ${weatherData.windSpeed} km/h`);
                }
            } catch (error) {
                console.warn('[RPG Companion] Weather fetch failed:', error.message);
            }
        }

        this.cachedContext = context;
        this.lastBuild = Date.now();

        return context;
    }

    /**
     * Build context synchronously (uses cached data only)
     * @returns {RealWorldContext}
     */
    buildContextSync() {
        const context = {
            timestamp: Date.now(),
            parts: []
        };

        // Add time context (always available synchronously)
        if (this.privacy.canShareTime()) {
            const timeData = this.time.getCurrentTime();
            context.time = timeData;
            context.parts.push(`Current time: ${timeData.timeFormatted} (${this.time.getTimeOfDayDescription()})`);
            context.parts.push(`Day: ${timeData.dayOfWeek}`);
        }

        // Add season context
        if (this.privacy.canShareSeason()) {
            const season = this.time.getSeason();
            context.season = season;
        }

        // Check for special dates
        if (this.privacy.canShareCalendar()) {
            const special = this.time.checkSpecialDates();
            if (special) {
                context.specialDate = special;
            }
        }

        // Use cached weather/location if available
        if (this.privacy.canShareWeather() && this.weather.cachedWeather) {
            context.weather = this.weather.cachedWeather;
        }

        if (this.privacy.canShareLocation() && this.location.cachedPlace) {
            context.location = this.location.cachedPlace;
        }

        return context;
    }

    /**
     * Format context for injection into system prompt
     * @param {RealWorldContext} context - Built context
     * @param {Object} [options={}] - Formatting options
     * @param {boolean} [options.minimal=false] - Use minimal format
     * @param {boolean} [options.includeGuidance=true] - Include usage guidance
     * @returns {string}
     */
    formatForPrompt(context, options = {}) {
        if (!context || context.parts.length === 0) {
            return '';
        }

        const { minimal = false, includeGuidance = true } = options;

        if (minimal) {
            return `[Real-world: ${context.parts.join(' | ')}]`;
        }

        let prompt = `
## Real-World Context
The following is information about the player's current real-world situation.
You may reference this to make the conversation feel more grounded and present.

${context.parts.join('\n')}`;

        if (includeGuidance) {
            prompt += `

Use this context naturally - don't force it into every response, but acknowledge it when relevant.
For example, if it's late at night, you might express concern about the player staying up late.
If it's a special occasion, you might wish them well.
Keep references subtle and character-appropriate.`;
        }

        return prompt;
    }

    /**
     * Get a random contextual dialogue line based on current conditions
     * @param {string} [characterPersonality='friendly'] - Character personality
     * @returns {Promise<string|null>}
     */
    async getContextualDialogue(characterPersonality = 'friendly') {
        const context = await this.buildContext();
        const dialogueOptions = [];

        // Special date takes priority
        if (context.specialDate) {
            return context.specialDate.message;
        }

        // Time-based dialogue
        if (context.time) {
            const timeDialogue = this.time.getTimeDialogue(characterPersonality);
            if (timeDialogue) {
                dialogueOptions.push(timeDialogue);
            }
        }

        // Weather-based dialogue
        if (context.weather) {
            const weatherDialogue = this.weather.getWeatherDialogue(context.weather, characterPersonality);
            if (weatherDialogue) {
                dialogueOptions.push(weatherDialogue);
            }
        }

        // Location-based dialogue
        if (context.location) {
            const locationDialogue = this.location.getLocationDialogue(context.location, characterPersonality);
            if (locationDialogue) {
                dialogueOptions.push(locationDialogue);
            }
        }

        if (dialogueOptions.length === 0) {
            return null;
        }

        // Return a random option
        return dialogueOptions[Math.floor(Math.random() * dialogueOptions.length)];
    }

    /**
     * Get atmospheric description for immersive context
     * @returns {Promise<string>}
     */
    async getAtmosphericDescription() {
        const context = await this.buildContext();
        const parts = [];

        // Time atmosphere
        if (context.time) {
            const timeAtmosphere = this.time.getAmbientDescription();
            if (timeAtmosphere) {
                parts.push(timeAtmosphere);
            }
        }

        // Weather atmosphere
        if (context.weather) {
            const weatherAtmosphere = this.weather.getAtmosphericDescription(context.weather);
            if (weatherAtmosphere) {
                parts.push(weatherAtmosphere);
            }
        }

        return parts.join(' ');
    }

    /**
     * Request location permission and initialize
     * @returns {Promise<boolean>} True if location was obtained
     */
    async requestLocationPermission() {
        if (!this.privacy.canShareLocation()) {
            return false;
        }

        try {
            await this.location.requestLocation();
            return this.location.currentLocation !== null;
        } catch (error) {
            console.warn('[RPG Companion] Location permission denied:', error.message);
            return false;
        }
    }

    /**
     * Set temperature unit preference
     * @param {'C'|'F'} unit
     */
    setTemperatureUnit(unit) {
        this.weather.setTemperatureUnit(unit);
        // Clear weather cache to get new data with correct unit
        this.weather.clearCache();
    }

    /**
     * Set player's birthday for special greetings
     * @param {number} month - Month (1-12)
     * @param {number} day - Day of month
     */
    setPlayerBirthday(month, day) {
        this.time.setPlayerBirthday(month, day);
    }

    /**
     * Clear all caches
     */
    clearCaches() {
        this.weather.clearCache();
        this.cachedContext = null;
        this.lastBuild = 0;
    }

    /**
     * Get current status for debugging/UI
     * @returns {Object}
     */
    getStatus() {
        return {
            initialized: this.initialized,
            hasLocation: this.location.currentLocation !== null,
            hasWeatherCache: this.weather.cachedWeather !== null,
            hasContextCache: this.cachedContext !== null,
            privacySummary: this.privacy.getPrivacySummary(),
            temperatureUnit: this.weather.temperatureUnit,
            timezone: this.time.timezone
        };
    }

    /**
     * Export all services for direct access
     * @returns {{ weather: WeatherService, time: TimeService, location: LocationService, privacy: PrivacyManager }}
     */
    getServices() {
        return {
            weather: this.weather,
            time: this.time,
            location: this.location,
            privacy: this.privacy
        };
    }
}

export default RealWorldContextBuilder;
