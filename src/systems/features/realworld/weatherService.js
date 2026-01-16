/**
 * Real Weather Service
 * Fetches actual weather data from Open-Meteo API and syncs with game world
 *
 * @module realworld/weatherService
 */

const WEATHER_API = 'https://api.open-meteo.com/v1/forecast';

/**
 * Weather data returned from the service
 * @typedef {Object} WeatherData
 * @property {number} temperature - Current temperature
 * @property {string} temperatureUnit - Temperature unit (C or F)
 * @property {number} weatherCode - WMO weather code
 * @property {string} weatherDescription - Human-readable weather description
 * @property {string} weatherEmoji - Emoji representing the weather
 * @property {number} windSpeed - Wind speed in km/h
 * @property {boolean} isDay - Whether it's daytime
 * @property {number} humidity - Relative humidity percentage
 * @property {number} timestamp - When this data was fetched
 * @property {boolean} [isFallback] - True if this is fallback data
 */

/**
 * Weather code mappings to descriptions and emojis
 * Based on WMO Weather Interpretation Codes (WW)
 */
const WEATHER_CODES = {
    0: { description: 'Clear sky', emoji: '☀️', night_emoji: '🌙' },
    1: { description: 'Mainly clear', emoji: '🌤️', night_emoji: '🌙' },
    2: { description: 'Partly cloudy', emoji: '⛅', night_emoji: '☁️' },
    3: { description: 'Overcast', emoji: '☁️', night_emoji: '☁️' },
    45: { description: 'Foggy', emoji: '🌫️', night_emoji: '🌫️' },
    48: { description: 'Depositing rime fog', emoji: '🌫️', night_emoji: '🌫️' },
    51: { description: 'Light drizzle', emoji: '🌦️', night_emoji: '🌧️' },
    53: { description: 'Moderate drizzle', emoji: '🌧️', night_emoji: '🌧️' },
    55: { description: 'Dense drizzle', emoji: '🌧️', night_emoji: '🌧️' },
    56: { description: 'Light freezing drizzle', emoji: '🌨️', night_emoji: '🌨️' },
    57: { description: 'Dense freezing drizzle', emoji: '🌨️', night_emoji: '🌨️' },
    61: { description: 'Slight rain', emoji: '🌦️', night_emoji: '🌧️' },
    63: { description: 'Moderate rain', emoji: '🌧️', night_emoji: '🌧️' },
    65: { description: 'Heavy rain', emoji: '🌧️', night_emoji: '🌧️' },
    66: { description: 'Light freezing rain', emoji: '🌨️', night_emoji: '🌨️' },
    67: { description: 'Heavy freezing rain', emoji: '🌨️', night_emoji: '🌨️' },
    71: { description: 'Slight snow', emoji: '🌨️', night_emoji: '🌨️' },
    73: { description: 'Moderate snow', emoji: '❄️', night_emoji: '❄️' },
    75: { description: 'Heavy snow', emoji: '❄️', night_emoji: '❄️' },
    77: { description: 'Snow grains', emoji: '🌨️', night_emoji: '🌨️' },
    80: { description: 'Slight rain showers', emoji: '🌦️', night_emoji: '🌧️' },
    81: { description: 'Moderate rain showers', emoji: '🌧️', night_emoji: '🌧️' },
    82: { description: 'Violent rain showers', emoji: '⛈️', night_emoji: '⛈️' },
    85: { description: 'Slight snow showers', emoji: '🌨️', night_emoji: '🌨️' },
    86: { description: 'Heavy snow showers', emoji: '❄️', night_emoji: '❄️' },
    95: { description: 'Thunderstorm', emoji: '⛈️', night_emoji: '⛈️' },
    96: { description: 'Thunderstorm with slight hail', emoji: '⛈️', night_emoji: '⛈️' },
    99: { description: 'Thunderstorm with heavy hail', emoji: '⛈️', night_emoji: '⛈️' }
};

/**
 * Service for fetching and caching real-world weather data
 */
export class WeatherService {
    constructor() {
        /** @type {WeatherData|null} */
        this.cachedWeather = null;
        /** @type {number} */
        this.lastFetch = 0;
        /** @type {number} Cache duration in milliseconds (30 minutes) */
        this.cacheTime = 30 * 60 * 1000;
        /** @type {string} Temperature unit preference ('C' or 'F') */
        this.temperatureUnit = 'C';
    }

    /**
     * Set the preferred temperature unit
     * @param {'C'|'F'} unit - Temperature unit
     */
    setTemperatureUnit(unit) {
        this.temperatureUnit = unit === 'F' ? 'F' : 'C';
    }

    /**
     * Get current weather for the given coordinates
     * @param {number} lat - Latitude
     * @param {number} lon - Longitude
     * @param {boolean} [forceRefresh=false] - Force a fresh fetch ignoring cache
     * @returns {Promise<WeatherData>}
     */
    async getCurrentWeather(lat, lon, forceRefresh = false) {
        // Check cache first (unless force refresh)
        if (!forceRefresh && this.cachedWeather && Date.now() - this.lastFetch < this.cacheTime) {
            return this.cachedWeather;
        }

        try {
            const temperatureUnit = this.temperatureUnit === 'F' ? 'fahrenheit' : 'celsius';
            const url = new URL(WEATHER_API);
            url.searchParams.set('latitude', lat.toString());
            url.searchParams.set('longitude', lon.toString());
            url.searchParams.set('current_weather', 'true');
            url.searchParams.set('temperature_unit', temperatureUnit);
            url.searchParams.set('hourly', 'relativehumidity_2m');

            const response = await fetch(url.toString());

            if (!response.ok) {
                throw new Error(`Weather API returned ${response.status}`);
            }

            const data = await response.json();

            this.cachedWeather = this.parseWeather(data);
            this.lastFetch = Date.now();

            console.log('[RPG Companion] Weather fetched:', this.cachedWeather);
            return this.cachedWeather;
        } catch (error) {
            console.error('[RPG Companion] Weather fetch failed:', error);
            return this.getFallbackWeather();
        }
    }

    /**
     * Parse the API response into a WeatherData object
     * @param {Object} data - Raw API response
     * @returns {WeatherData}
     */
    parseWeather(data) {
        const current = data.current_weather;
        const isDay = current.is_day === 1;
        const weatherInfo = WEATHER_CODES[current.weathercode] || {
            description: 'Unknown',
            emoji: '❓',
            night_emoji: '❓'
        };

        // Get current hour's humidity if available
        let humidity = 50; // Default fallback
        if (data.hourly && data.hourly.relativehumidity_2m) {
            const currentHour = new Date().getHours();
            humidity = data.hourly.relativehumidity_2m[currentHour] || 50;
        }

        return {
            temperature: Math.round(current.temperature),
            temperatureUnit: this.temperatureUnit === 'F' ? 'F' : 'C',
            weatherCode: current.weathercode,
            weatherDescription: weatherInfo.description,
            weatherEmoji: isDay ? weatherInfo.emoji : weatherInfo.night_emoji,
            windSpeed: Math.round(current.windspeed),
            isDay: isDay,
            humidity: humidity,
            timestamp: Date.now()
        };
    }

    /**
     * Get fallback weather data when API fails
     * @returns {WeatherData}
     */
    getFallbackWeather() {
        const hour = new Date().getHours();
        const isDay = hour >= 6 && hour < 20;

        return {
            temperature: this.temperatureUnit === 'F' ? 68 : 20,
            temperatureUnit: this.temperatureUnit,
            weatherCode: 0,
            weatherDescription: 'Clear sky',
            weatherEmoji: isDay ? '☀️' : '🌙',
            windSpeed: 5,
            isDay: isDay,
            humidity: 50,
            timestamp: Date.now(),
            isFallback: true
        };
    }

    /**
     * Get the weather description for the given code
     * @param {number} code - WMO weather code
     * @returns {string}
     */
    getWeatherDescription(code) {
        return WEATHER_CODES[code]?.description || 'Unknown';
    }

    /**
     * Get the weather emoji for the given code
     * @param {number} code - WMO weather code
     * @param {boolean} isDay - Whether it's daytime
     * @returns {string}
     */
    getWeatherEmoji(code, isDay = true) {
        const info = WEATHER_CODES[code];
        if (!info) return '❓';
        return isDay ? info.emoji : info.night_emoji;
    }

    /**
     * Generate companion dialogue about weather based on conditions
     * @param {WeatherData} weather - Current weather data
     * @param {string} [characterPersonality='friendly'] - Character personality type
     * @returns {string|null} Weather-related dialogue or null
     */
    getWeatherDialogue(weather, characterPersonality = 'friendly') {
        if (!weather) return null;

        const dialogues = {
            // Thunderstorms (95-99)
            thunderstorm: [
                "That thunder is intense! Are you staying safe?",
                "Sounds like quite the storm out there... Perfect weather for staying in.",
                "I hope you're somewhere cozy - that lightning looks fierce!",
                "The thunder is making me a bit jumpy, not gonna lie."
            ],
            // Rain (61-82)
            rain: [
                "I can hear the rain... It's kind of cozy, isn't it?",
                "Rainy day vibes! Got a warm drink?",
                "The sound of rain is so peaceful.",
                "Hope you've got an umbrella if you're heading out!"
            ],
            // Snow (71-86)
            snow: [
                "It's snowing! I love watching the flakes fall.",
                "Bundle up, it's a winter wonderland out there!",
                "Snow always makes everything look so magical.",
                "Hot cocoa weather for sure!"
            ],
            // Fog (45-48)
            fog: [
                "It's pretty foggy out there... Drive safe if you're going anywhere.",
                "The fog gives everything such a mysterious vibe.",
                "I can barely see through this fog!"
            ],
            // Clear day
            clearDay: [
                "What a beautiful day outside!",
                "The sun is shining bright today!",
                "Perfect weather to enjoy some time outside.",
                "It's gorgeous out - hope you can get some fresh air!"
            ],
            // Clear night
            clearNight: [
                "It's a beautiful night... Can you see the stars?",
                "The night sky looks amazing right now.",
                "Such a peaceful night.",
                "Perfect stargazing weather!"
            ],
            // Cloudy (1-3)
            cloudy: [
                "It's a bit cloudy today.",
                "Overcast skies... Cozy indoor weather.",
                "The clouds are rolling in."
            ],
            // Hot weather
            hot: [
                "It's really warm out there! Stay hydrated!",
                "Whew, it's a hot one today!",
                "Don't forget to drink water in this heat!"
            ],
            // Cold weather
            cold: [
                "Brr, it's chilly! Bundle up!",
                "It's pretty cold out there - stay warm!",
                "Layer up, it's freezing!"
            ]
        };

        // Determine which dialogue category to use
        let category = null;

        // Check weather code first
        if (weather.weatherCode >= 95) {
            category = 'thunderstorm';
        } else if (weather.weatherCode >= 71 && weather.weatherCode <= 86) {
            category = 'snow';
        } else if ((weather.weatherCode >= 51 && weather.weatherCode <= 67) ||
                   (weather.weatherCode >= 80 && weather.weatherCode <= 82)) {
            category = 'rain';
        } else if (weather.weatherCode >= 45 && weather.weatherCode <= 48) {
            category = 'fog';
        } else if (weather.weatherCode <= 3) {
            // Clear or cloudy - check if day/night
            if (weather.weatherCode === 0) {
                category = weather.isDay ? 'clearDay' : 'clearNight';
            } else {
                category = 'cloudy';
            }
        }

        // Check temperature extremes (can override or supplement)
        const tempC = weather.temperatureUnit === 'F'
            ? (weather.temperature - 32) * 5/9
            : weather.temperature;

        if (tempC >= 30 && !category) {
            category = 'hot';
        } else if (tempC <= 5 && !category) {
            category = 'cold';
        }

        if (!category || !dialogues[category]) {
            return null;
        }

        // Pick a random dialogue from the category
        const options = dialogues[category];
        return options[Math.floor(Math.random() * options.length)];
    }

    /**
     * Clear the weather cache
     */
    clearCache() {
        this.cachedWeather = null;
        this.lastFetch = 0;
    }

    /**
     * Get atmospheric conditions description for immersive context
     * @param {WeatherData} weather - Current weather data
     * @returns {string} Atmospheric description
     */
    getAtmosphericDescription(weather) {
        if (!weather) return '';

        const parts = [];

        // Time of day atmosphere
        if (weather.isDay) {
            if (weather.weatherCode === 0) {
                parts.push('The sun casts bright light across the scene');
            } else if (weather.weatherCode <= 2) {
                parts.push('Soft sunlight filters through scattered clouds');
            }
        } else {
            if (weather.weatherCode === 0) {
                parts.push('Stars twinkle in the clear night sky');
            } else {
                parts.push('The night is dark and quiet');
            }
        }

        // Weather effects
        if (weather.weatherCode >= 95) {
            parts.push('Thunder rumbles in the distance as lightning illuminates the sky');
        } else if (weather.weatherCode >= 71) {
            parts.push('Snowflakes drift gently through the air');
        } else if (weather.weatherCode >= 61 || weather.weatherCode >= 80) {
            parts.push('Rain patters against surfaces, creating a rhythmic backdrop');
        } else if (weather.weatherCode >= 45) {
            parts.push('A thick fog blankets the surroundings, limiting visibility');
        }

        // Wind
        if (weather.windSpeed > 30) {
            parts.push('Strong winds howl and push against everything');
        } else if (weather.windSpeed > 15) {
            parts.push('A steady breeze rustles through');
        }

        return parts.join('. ') + (parts.length > 0 ? '.' : '');
    }
}

export default WeatherService;
