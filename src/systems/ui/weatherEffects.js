/**
 * Dynamic Weather Effects Module
 * Creates weather effects based on the Info Box weather field
 */

import { extensionSettings, lastGeneratedData, committedTrackerData } from '../../core/state.js';

let weatherContainer = null;
let currentWeatherType = null;

/**
 * Parse weather text to determine effect type
 */
function parseWeatherType(weatherText) {
    if (!weatherText) return 'none';

    const text = weatherText.toLowerCase();

    // Check for specific weather conditions (order matters - check combined effects first)
    if (text.includes('blizzard')) {
        return 'blizzard'; // Snow + Wind
    }
    if (text.includes('storm') || text.includes('thunder') || text.includes('lightning')) {
        return 'storm'; // Rain + Lightning
    }
    if (text.includes('wind') || text.includes('breeze') || text.includes('gust') || text.includes('gale')) {
        return 'wind';
    }
    if (text.includes('snow') || text.includes('flurries')) {
        return 'snow';
    }
    if (text.includes('rain') || text.includes('drizzle') || text.includes('shower')) {
        return 'rain';
    }
    if (text.includes('mist') || text.includes('fog') || text.includes('haze')) {
        return 'mist';
    }
    if (text.includes('sunny') || text.includes('clear') || text.includes('bright')) {
        return 'sunny';
    }
    if (text.includes('cloud') || text.includes('overcast') || text.includes('indoor') || text.includes('inside')) {
        return 'none';
    }

    return 'none';
}

/**
 * Extract weather from Info Box data
 */
function getCurrentWeather() {
    const infoBoxData = lastGeneratedData.infoBox || committedTrackerData.infoBox || '';

    // Try to parse as JSON first (new format)
    try {
        const parsed = typeof infoBoxData === 'string' ? JSON.parse(infoBoxData) : infoBoxData;
        if (parsed && parsed.weather) {
            // Return the forecast text from the weather object
            return parsed.weather.forecast || parsed.weather.emoji || null;
        }
    } catch (e) {
        // Not JSON, try old text format
    }

    // Fallback: Parse the old text format to find Weather field
    const lines = infoBoxData.split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('Weather:')) {
            return trimmed.substring('Weather:'.length).trim();
        }
    }

    return null;
}

/**
 * Create snowflakes effect
 */
function createSnowflakes() {
    const container = document.createElement('div');
    container.className = 'rpg-weather-particles';

    // Create 50 snowflakes
    for (let i = 0; i < 50; i++) {
        const snowflake = document.createElement('div');
        snowflake.className = 'rpg-weather-particle rpg-snowflake';
        snowflake.textContent = '❄';
        snowflake.style.left = `${Math.random() * 100}%`;
        snowflake.style.animationDelay = `${Math.random() * 10}s`;
        snowflake.style.animationDuration = `${10 + Math.random() * 10}s`;
        container.appendChild(snowflake);
    }

    return container;
}

/**
 * Create rain effect
 */
function createRain() {
    const container = document.createElement('div');
    container.className = 'rpg-weather-particles';

    // Create 100 raindrops for heavier effect
    for (let i = 0; i < 100; i++) {
        const raindrop = document.createElement('div');
        raindrop.className = 'rpg-weather-particle rpg-raindrop';
        raindrop.style.left = `${Math.random() * 100}%`;
        raindrop.style.animationDelay = `${Math.random() * 2}s`;
        raindrop.style.animationDuration = `${0.5 + Math.random() * 0.5}s`;
        container.appendChild(raindrop);
    }

    return container;
}

/**
 * Create mist/fog effect
 */
function createMist() {
    const container = document.createElement('div');
    container.className = 'rpg-weather-particles';

    // Create 5 mist layers
    for (let i = 0; i < 5; i++) {
        const mist = document.createElement('div');
        mist.className = 'rpg-weather-particle rpg-mist';
        mist.style.animationDelay = `${i * 2}s`;
        mist.style.animationDuration = `${15 + i * 2}s`;
        mist.style.opacity = `${0.1 + Math.random() * 0.2}`;
        container.appendChild(mist);
    }

    return container;
}

/**
 * Create sunshine rays effect
 */
function createSunshine() {
    const container = document.createElement('div');
    container.className = 'rpg-weather-particles';

    // Create 8 sun rays
    for (let i = 0; i < 8; i++) {
        const ray = document.createElement('div');
        ray.className = 'rpg-weather-particle rpg-sunray';
        ray.style.left = `${10 + i * 12}%`;
        ray.style.animationDelay = `${i * 0.5}s`;
        ray.style.animationDuration = `${8 + Math.random() * 4}s`;
        container.appendChild(ray);
    }

    return container;
}

/**
 * Create lightning flash effect
 */
function createLightning() {
    const container = document.createElement('div');
    container.className = 'rpg-weather-particles';

    // Create lightning flash overlay
    const flash = document.createElement('div');
    flash.className = 'rpg-weather-particle rpg-lightning';
    container.appendChild(flash);

    return container;
}

/**
 * Create wind effect
 */
function createWind() {
    const container = document.createElement('div');
    container.className = 'rpg-weather-particles';

    // Create 30 wind streaks
    for (let i = 0; i < 30; i++) {
        const streak = document.createElement('div');
        streak.className = 'rpg-weather-particle rpg-wind-streak';
        streak.style.top = `${Math.random() * 100}%`;
        streak.style.animationDelay = `${Math.random() * 5}s`;
        streak.style.animationDuration = `${1.5 + Math.random() * 1}s`;
        container.appendChild(streak);
    }

    return container;
}

/**
 * Remove current weather effect
 */
function removeWeatherEffect() {
    if (weatherContainer) {
        weatherContainer.remove();
        weatherContainer = null;
        currentWeatherType = null;
    }
}

/**
 * Update weather effect based on current weather
 */
export function updateWeatherEffect() {
    // Check if dynamic weather is enabled
    if (!extensionSettings.enableDynamicWeather) {
        removeWeatherEffect();
        return;
    }

    const weather = getCurrentWeather();
    const weatherType = parseWeatherType(weather);

    // Don't recreate if weather hasn't changed
    if (weatherType === currentWeatherType) {
        return;
    }

    // Remove existing effect
    removeWeatherEffect();

    // Create new effect based on weather type
    if (weatherType === 'none') {
        return; // No effect
    }

    currentWeatherType = weatherType;

    switch (weatherType) {
        case 'snow':
            weatherContainer = createSnowflakes();
            break;
        case 'rain':
            weatherContainer = createRain();
            break;
        case 'mist':
            weatherContainer = createMist();
            break;
        case 'sunny':
            weatherContainer = createSunshine();
            break;
        case 'wind':
            weatherContainer = createWind();
            break;
        case 'storm': {
            // Storm = Rain + Lightning (combined effects)
            const rainContainer = createRain();
            const lightningContainer = createLightning();
            // Merge both containers
            weatherContainer = document.createElement('div');
            weatherContainer.className = 'rpg-weather-particles';
            weatherContainer.appendChild(rainContainer);
            weatherContainer.appendChild(lightningContainer);
            break;
        }
        case 'blizzard': {
            // Blizzard = Snow + Wind (combined effects)
            const snowContainer = createSnowflakes();
            const windContainer = createWind();
            // Merge both containers
            weatherContainer = document.createElement('div');
            weatherContainer.className = 'rpg-weather-particles';
            weatherContainer.appendChild(snowContainer);
            weatherContainer.appendChild(windContainer);
            break;
        }
    }

    if (weatherContainer) {
        // Apply foreground z-index if experimental setting is enabled
        if (extensionSettings.weatherEffectsForeground) {
            weatherContainer.style.zIndex = '9998';
        }

        document.body.appendChild(weatherContainer);
    }
}

/**
 * Initialize weather effects
 */
export function initWeatherEffects() {
    updateWeatherEffect();
}

/**
 * Toggle dynamic weather effects
 */
export function toggleDynamicWeather(enabled) {
    if (enabled) {
        updateWeatherEffect();
    } else {
        removeWeatherEffect();
    }
}

/**
 * Clean up weather effects
 */
export function cleanupWeatherEffects() {
    removeWeatherEffect();
}
