/**
 * Dynamic Weather Effects Module
 * Creates weather effects based on the Info Box weather field
 */

import { extensionSettings, lastGeneratedData, committedTrackerData } from '../../core/state.js';
import { repairJSON } from '../../utils/jsonRepair.js';

let weatherContainer = null;
let currentWeatherType = null;
let currentTimeOfDay = null;
let currentHour = null;

/**
 * Parse time string to extract hour (24-hour format)
 * Supports formats like "3:00 PM", "15:00", "3 PM", "Evening", etc.
 */
function parseHourFromTime(timeStr) {
    if (!timeStr) return null;

    const text = timeStr.toLowerCase().trim();

    // Check for descriptive time words first
    if (text.includes('dawn') || text.includes('sunrise')) return 6;
    if (text.includes('early morning')) return 7;
    if (text.includes('morning')) return 9;
    if (text.includes('midday') || text.includes('noon') || text.includes('mid-day')) return 12;
    if (text.includes('afternoon')) return 14;
    if (text.includes('late afternoon')) return 16;
    if (text.includes('evening') || text.includes('dusk') || text.includes('sunset')) return 19;
    if (text.includes('twilight')) return 20;
    if (text.includes('night') || text.includes('nighttime')) return 22;
    if (text.includes('midnight')) return 0;
    if (text.includes('late night')) return 2;

    // Try to parse numeric time formats
    // Format: "3:00 PM" or "3:00PM" or "3 PM"
    const ampmMatch = text.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
    if (ampmMatch) {
        let hour = parseInt(ampmMatch[1], 10);
        const isPM = ampmMatch[3].toLowerCase() === 'pm';
        if (isPM && hour !== 12) hour += 12;
        if (!isPM && hour === 12) hour = 0;
        return hour;
    }

    // Format: "15:00" (24-hour)
    const militaryMatch = text.match(/(\d{1,2}):(\d{2})/);
    if (militaryMatch) {
        return parseInt(militaryMatch[1], 10);
    }

    return null;
}

/**
 * Determine time of day based on hour
 */
function getTimeOfDay(hour) {
    if (hour === null) return 'unknown';

    // Night: 8 PM (20:00) to 5 AM (05:00)
    if (hour >= 20 || hour < 5) return 'night';

    // Dawn/Dusk: 5 AM - 7 AM and 6 PM - 8 PM
    if (hour >= 5 && hour < 7) return 'dawn';
    if (hour >= 18 && hour < 20) return 'dusk';

    // Day: 7 AM to 6 PM
    return 'day';
}

/**
 * Extract time from Info Box data
 */
function getCurrentTime() {
    const infoBoxData = lastGeneratedData.infoBox || committedTrackerData.infoBox || '';

    // Try to parse as JSON first (new format)
    try {
        const parsed = typeof infoBoxData === 'string' ? repairJSON(infoBoxData) : infoBoxData;
        if (parsed && parsed.time) {
            // Use the end time if available (current time), otherwise start time
            return parsed.time.end || parsed.time.start || null;
        }
    } catch (e) {
        // Not JSON, try old text format
    }

    // Fallback: Parse the old text format to find Time field
    const lines = infoBoxData.split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('Time:')) {
            const timeStr = trimmed.substring('Time:'.length).trim();
            // If it contains →, take the end time (after arrow)
            if (timeStr.includes('→')) {
                const parts = timeStr.split('→');
                return parts[1]?.trim() || parts[0]?.trim();
            }
            return timeStr;
        }
    }

    return null;
}

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
 * Calculate sun position based on hour (arc across sky)
 * Returns { left: vw%, top: dvh% }
 */
function calculateSunPosition(hour) {
    // Daytime is roughly 5 AM to 8 PM (5-20)
    // Map hour to position along an arc
    // 5 AM = far left, low | 12 PM = center, high | 8 PM = far right, low
    
    if (hour === null) hour = 12; // Default to noon if unknown
    
    // Clamp to daytime hours
    const clampedHour = Math.max(5, Math.min(20, hour));
    
    // Normalize to 0-1 range (5 AM = 0, 20 PM = 1)
    const progress = (clampedHour - 5) / 15;
    
    // Horizontal position: 3% to 92% (left to right, wider range)
    const left = 3 + progress * 89;
    
    // Vertical position: parabolic arc (high at noon, low at dawn/dusk)
    // At progress 0.5 (noon), top should be ~8% (high)
    // At progress 0 or 1, top should be ~40% (low, near horizon)
    const normalizedProgress = (progress - 0.5) * 2; // -1 to 1
    const top = 8 + 32 * (normalizedProgress * normalizedProgress);
    
    return { left, top };
}

/**
 * Create clear/sunny weather effect with floating particles and warm glow
 */
function createSunshine(hour) {
    const container = document.createElement('div');
    container.className = 'rpg-weather-particles rpg-clear-weather';

    // Create the sun based on current hour
    const sunPos = calculateSunPosition(hour);
    
    const sun = document.createElement('div');
    sun.className = 'rpg-weather-particle rpg-clear-sun';
    sun.style.left = `${sunPos.left}vw`;
    sun.style.top = `${sunPos.top}dvh`;
    container.appendChild(sun);

    // Create sun glow
    const sunGlow = document.createElement('div');
    sunGlow.className = 'rpg-weather-particle rpg-clear-sun-glow';
    sunGlow.style.left = `${sunPos.left}vw`;
    sunGlow.style.top = `${sunPos.top}dvh`;
    container.appendChild(sunGlow);

    // Create warm ambient glow overlay
    const ambientGlow = document.createElement('div');
    ambientGlow.className = 'rpg-weather-particle rpg-clear-ambient-glow';
    container.appendChild(ambientGlow);

    // Create floating dust motes / pollen particles (golden sparkles)
    for (let i = 0; i < 25; i++) {
        const particle = document.createElement('div');
        particle.className = 'rpg-weather-particle rpg-clear-dust-mote';
        particle.style.left = `${Math.random() * 100}vw`;
        particle.style.top = `${Math.random() * 100}dvh`;
        particle.style.animationDelay = `${Math.random() * 15}s`;
        particle.style.animationDuration = `${12 + Math.random() * 8}s`;
        // Vary the size slightly
        const size = 2 + Math.random() * 4;
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        container.appendChild(particle);
    }

    // Create soft light orbs that drift gently
    for (let i = 0; i < 6; i++) {
        const orb = document.createElement('div');
        orb.className = 'rpg-weather-particle rpg-clear-light-orb';
        orb.style.left = `${10 + Math.random() * 80}vw`;
        orb.style.top = `${10 + Math.random() * 80}dvh`;
        orb.style.animationDelay = `${i * 2}s`;
        orb.style.animationDuration = `${20 + Math.random() * 10}s`;
        // Vary the size
        const size = 80 + Math.random() * 120;
        orb.style.width = `${size}px`;
        orb.style.height = `${size}px`;
        container.appendChild(orb);
    }

    // Create lens flare effect in corner
    const lensFlare = document.createElement('div');
    lensFlare.className = 'rpg-weather-particle rpg-clear-lens-flare';
    container.appendChild(lensFlare);

    return container;
}

/**
 * Create sunrise effect (dawn - warm orange/pink sky gradient with low sun)
 */
function createSunrise(hour) {
    const container = document.createElement('div');
    container.className = 'rpg-weather-particles rpg-sunrise-weather';

    // Create sunrise gradient overlay
    const sunriseOverlay = document.createElement('div');
    sunriseOverlay.className = 'rpg-weather-particle rpg-sunrise-overlay';
    container.appendChild(sunriseOverlay);

    // Calculate sun position (rising from left horizon)
    const sunPos = calculateSunPosition(hour);

    // Create the rising sun
    const sun = document.createElement('div');
    sun.className = 'rpg-weather-particle rpg-clear-sun rpg-sunrise-sun';
    sun.style.left = `${sunPos.left}vw`;
    sun.style.top = `${sunPos.top}dvh`;
    container.appendChild(sun);

    // Create sun glow (more orange during sunrise)
    const sunGlow = document.createElement('div');
    sunGlow.className = 'rpg-weather-particle rpg-clear-sun-glow rpg-sunrise-glow';
    sunGlow.style.left = `${sunPos.left}vw`;
    sunGlow.style.top = `${sunPos.top}dvh`;
    container.appendChild(sunGlow);

    // Create horizon glow
    const horizonGlow = document.createElement('div');
    horizonGlow.className = 'rpg-weather-particle rpg-sunrise-horizon-glow';
    container.appendChild(horizonGlow);

    // Add some fading stars (still visible at dawn)
    for (let i = 0; i < 15; i++) {
        const star = document.createElement('div');
        star.className = 'rpg-weather-particle rpg-night-star rpg-sunrise-fading-star';
        star.style.left = `${Math.random() * 100}vw`;
        star.style.top = `${Math.random() * 40}dvh`;
        star.style.animationDelay = `${Math.random() * 3}s`;
        const size = 1 + Math.random() * 1.5;
        star.style.width = `${size}px`;
        star.style.height = `${size}px`;
        container.appendChild(star);
    }

    // Add some golden dust motes
    for (let i = 0; i < 12; i++) {
        const particle = document.createElement('div');
        particle.className = 'rpg-weather-particle rpg-clear-dust-mote';
        particle.style.left = `${Math.random() * 100}vw`;
        particle.style.top = `${Math.random() * 100}dvh`;
        particle.style.animationDelay = `${Math.random() * 15}s`;
        particle.style.animationDuration = `${12 + Math.random() * 8}s`;
        const size = 2 + Math.random() * 3;
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        container.appendChild(particle);
    }

    return container;
}

/**
 * Create sunset effect (dusk - warm red/purple sky gradient with low sun)
 */
function createSunset(hour) {
    const container = document.createElement('div');
    container.className = 'rpg-weather-particles rpg-sunset-weather';

    // Create sunset gradient overlay
    const sunsetOverlay = document.createElement('div');
    sunsetOverlay.className = 'rpg-weather-particle rpg-sunset-overlay';
    container.appendChild(sunsetOverlay);

    // Calculate sun position (setting on right horizon)
    const sunPos = calculateSunPosition(hour);

    // Create the setting sun
    const sun = document.createElement('div');
    sun.className = 'rpg-weather-particle rpg-clear-sun rpg-sunset-sun';
    sun.style.left = `${sunPos.left}vw`;
    sun.style.top = `${sunPos.top}dvh`;
    container.appendChild(sun);

    // Create sun glow (more red during sunset)
    const sunGlow = document.createElement('div');
    sunGlow.className = 'rpg-weather-particle rpg-clear-sun-glow rpg-sunset-glow';
    sunGlow.style.left = `${sunPos.left}vw`;
    sunGlow.style.top = `${sunPos.top}dvh`;
    container.appendChild(sunGlow);

    // Create horizon glow
    const horizonGlow = document.createElement('div');
    horizonGlow.className = 'rpg-weather-particle rpg-sunset-horizon-glow';
    container.appendChild(horizonGlow);

    // Add some early stars (appearing at dusk)
    for (let i = 0; i < 20; i++) {
        const star = document.createElement('div');
        star.className = 'rpg-weather-particle rpg-night-star rpg-sunset-emerging-star';
        star.style.left = `${Math.random() * 100}vw`;
        star.style.top = `${Math.random() * 50}dvh`;
        star.style.animationDelay = `${Math.random() * 5}s`;
        const size = 1 + Math.random() * 1.5;
        star.style.width = `${size}px`;
        star.style.height = `${size}px`;
        container.appendChild(star);
    }

    // Add some golden/pink dust motes
    for (let i = 0; i < 12; i++) {
        const particle = document.createElement('div');
        particle.className = 'rpg-weather-particle rpg-clear-dust-mote rpg-sunset-dust';
        particle.style.left = `${Math.random() * 100}vw`;
        particle.style.top = `${Math.random() * 100}dvh`;
        particle.style.animationDelay = `${Math.random() * 15}s`;
        particle.style.animationDuration = `${12 + Math.random() * 8}s`;
        const size = 2 + Math.random() * 3;
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        container.appendChild(particle);
    }

    return container;
}

/**
 * Create clear nighttime weather effect with moon, stars, and fireflies
 */
function createNighttime(hour) {
    const container = document.createElement('div');
    container.className = 'rpg-weather-particles rpg-night-weather';

    // Create dark blue ambient overlay
    const nightOverlay = document.createElement('div');
    nightOverlay.className = 'rpg-weather-particle rpg-night-overlay';
    container.appendChild(nightOverlay);

    // Calculate moon position based on hour
    const moonPos = calculateMoonPosition(hour);

    // Create the moon
    const moon = document.createElement('div');
    moon.className = 'rpg-weather-particle rpg-night-moon';
    moon.style.left = `${moonPos.left}vw`;
    moon.style.top = `${moonPos.top}dvh`;
    container.appendChild(moon);

    // Create moon glow
    const moonGlow = document.createElement('div');
    moonGlow.className = 'rpg-weather-particle rpg-night-moon-glow';
    moonGlow.style.left = `${moonPos.left - 3}vw`;
    moonGlow.style.top = `${moonPos.top - 3}dvh`;
    container.appendChild(moonGlow);

    // Create twinkling stars
    for (let i = 0; i < 60; i++) {
        const star = document.createElement('div');
        star.className = 'rpg-weather-particle rpg-night-star';
        star.style.left = `${Math.random() * 100}vw`;
        star.style.top = `${Math.random() * 60}dvh`; // Stars mostly in upper portion
        star.style.animationDelay = `${Math.random() * 5}s`;
        star.style.animationDuration = `${2 + Math.random() * 3}s`;
        // Vary the size
        const size = 1 + Math.random() * 2;
        star.style.width = `${size}px`;
        star.style.height = `${size}px`;
        container.appendChild(star);
    }

    // Create a few brighter stars
    for (let i = 0; i < 8; i++) {
        const brightStar = document.createElement('div');
        brightStar.className = 'rpg-weather-particle rpg-night-star rpg-night-star-bright';
        brightStar.style.left = `${Math.random() * 100}vw`;
        brightStar.style.top = `${Math.random() * 50}dvh`;
        brightStar.style.animationDelay = `${Math.random() * 4}s`;
        brightStar.style.animationDuration = `${3 + Math.random() * 2}s`;
        container.appendChild(brightStar);
    }

    // Create fireflies / floating light particles
    for (let i = 0; i < 15; i++) {
        const firefly = document.createElement('div');
        firefly.className = 'rpg-weather-particle rpg-night-firefly';
        firefly.style.left = `${Math.random() * 100}vw`;
        firefly.style.top = `${40 + Math.random() * 55}dvh`; // Fireflies in lower portion
        firefly.style.animationDelay = `${Math.random() * 10}s`;
        firefly.style.animationDuration = `${8 + Math.random() * 7}s`;
        container.appendChild(firefly);
    }

    // Create subtle shooting star occasionally
    const shootingStar = document.createElement('div');
    shootingStar.className = 'rpg-weather-particle rpg-night-shooting-star';
    container.appendChild(shootingStar);

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
 * Calculate moon position based on hour (arc across sky at night)
 * Returns { left: vw%, top: dvh% }
 */
function calculateMoonPosition(hour) {
    // Nighttime is roughly 8 PM to 5 AM (20-5)
    // Map hour to position along an arc
    // 8 PM = far left, low | midnight = center-left, high | 5 AM = far right, low
    
    if (hour === null) hour = 0; // Default to midnight if unknown
    
    // Normalize night hours to 0-1 range
    // 20 (8 PM) = 0, 0 (midnight) = ~0.44, 5 (5 AM) = 1
    let progress;
    if (hour >= 20) {
        // 8 PM to midnight: 20-24 maps to 0-0.44
        progress = (hour - 20) / 9;
    } else {
        // Midnight to 5 AM: 0-5 maps to 0.44-1
        progress = (hour + 4) / 9;
    }
    
    // Horizontal position: 10% to 80% (left to right)
    const left = 10 + progress * 70;
    
    // Vertical position: parabolic arc (high at ~2 AM, low at dusk/dawn)
    // Peak should be around progress 0.67 (~2 AM)
    const peakProgress = 0.5;
    const normalizedProgress = (progress - peakProgress) * 2; // -1 to 1
    const top = 8 + 25 * (normalizedProgress * normalizedProgress);
    
    return { left, top };
}

/**
 * Update sun/moon position without recreating the whole effect
 */
function updateCelestialPosition(hour) {
    if (!weatherContainer) return false;

    // Update sun position if it exists
    const sun = weatherContainer.querySelector('.rpg-clear-sun');
    const sunGlow = weatherContainer.querySelector('.rpg-clear-sun-glow');
    
    if (sun && sunGlow) {
        const sunPos = calculateSunPosition(hour);
        sun.style.left = `${sunPos.left}vw`;
        sun.style.top = `${sunPos.top}dvh`;
        sunGlow.style.left = `${sunPos.left}vw`;
        sunGlow.style.top = `${sunPos.top}dvh`;
        return true;
    }

    // Update moon position if it exists
    const moon = weatherContainer.querySelector('.rpg-night-moon');
    const moonGlow = weatherContainer.querySelector('.rpg-night-moon-glow');
    
    if (moon && moonGlow) {
        const moonPos = calculateMoonPosition(hour);
        moon.style.left = `${moonPos.left}vw`;
        moon.style.top = `${moonPos.top}dvh`;
        moonGlow.style.left = `${moonPos.left - 3}vw`;
        moonGlow.style.top = `${moonPos.top - 3}dvh`;
        return true;
    }

    return false;
}

/**
 * Remove current weather effect
 */
function removeWeatherEffect() {
    if (weatherContainer) {
        weatherContainer.remove();
        weatherContainer = null;
        currentWeatherType = null;
        currentTimeOfDay = null;
        currentHour = null;
    }
}

/**
 * Update weather effect based on current weather and time
 */
export function updateWeatherEffect() {
    // Check if dynamic weather is enabled
    if (!extensionSettings.enableDynamicWeather) {
        removeWeatherEffect();
        return;
    }

    const weather = getCurrentWeather();
    const weatherType = parseWeatherType(weather);

    // Get current time of day
    const timeStr = getCurrentTime();
    const hour = parseHourFromTime(timeStr);
    const timeOfDay = getTimeOfDay(hour);

    // If only the hour changed (same weather and time of day), just update celestial position
    if (weatherType === currentWeatherType && timeOfDay === currentTimeOfDay && hour !== currentHour) {
        if (updateCelestialPosition(hour)) {
            currentHour = hour;
            return; // Successfully updated position without recreating
        }
    }

    // Don't recreate if nothing has changed
    if (weatherType === currentWeatherType && timeOfDay === currentTimeOfDay && hour === currentHour) {
        return;
    }

    // Remove existing effect
    removeWeatherEffect();

    // Create new effect based on weather type
    if (weatherType === 'none') {
        return; // No effect
    }

    currentWeatherType = weatherType;
    currentTimeOfDay = timeOfDay;
    currentHour = hour;

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
            // Use appropriate effect based on time of day
            if (timeOfDay === 'night') {
                weatherContainer = createNighttime(hour);
            } else if (timeOfDay === 'dawn') {
                weatherContainer = createSunrise(hour);
            } else if (timeOfDay === 'dusk') {
                weatherContainer = createSunset(hour);
            } else {
                weatherContainer = createSunshine(hour);
            }
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
        // Apply z-index based on background/foreground settings
        if (extensionSettings.weatherForeground) {
            weatherContainer.style.zIndex = '9998'; // In front of chat
            weatherContainer.classList.add('rpg-weather-foreground');
        } else if (extensionSettings.weatherBackground) {
            weatherContainer.style.zIndex = '1'; // Behind chat (default)
            weatherContainer.classList.remove('rpg-weather-foreground');
        } else {
            // Both disabled - don't show weather
            return;
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
