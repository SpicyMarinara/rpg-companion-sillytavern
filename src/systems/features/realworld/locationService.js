/**
 * Location Service
 * GPS/location awareness with privacy controls
 *
 * @module realworld/locationService
 */

/**
 * Location data
 * @typedef {Object} LocationData
 * @property {number} latitude - Latitude coordinate
 * @property {number} longitude - Longitude coordinate
 * @property {number} [accuracy] - Accuracy in meters
 * @property {number} timestamp - When this location was captured
 */

/**
 * Place information from reverse geocoding
 * @typedef {Object} PlaceInfo
 * @property {string|null} city - City or town name
 * @property {string|null} neighborhood - Neighborhood or suburb
 * @property {string|null} region - State/province/county
 * @property {string|null} country - Country name
 * @property {string|null} countryCode - ISO country code
 * @property {string|null} displayName - Full formatted address
 */

/**
 * Privacy level settings
 * - 'exact': Full precision coordinates
 * - 'city': ~10km precision (city level)
 * - 'region': ~100km precision (regional level)
 * - 'none': No location data shared
 * @typedef {'exact'|'city'|'region'|'none'} PrivacyLevel
 */

const NOMINATIM_API = 'https://nominatim.openstreetmap.org/reverse';

/**
 * Service for location awareness with privacy controls
 */
export class LocationService {
    constructor() {
        /** @type {LocationData|null} */
        this.currentLocation = null;
        /** @type {LocationData[]} */
        this.locationHistory = [];
        /** @type {number} Maximum history entries */
        this.maxHistoryLength = 10;
        /** @type {PrivacyLevel} */
        this.privacyLevel = 'city';
        /** @type {PlaceInfo|null} */
        this.cachedPlace = null;
        /** @type {number} */
        this.lastGeocode = 0;
        /** @type {number} Geocode cache time in ms (1 hour) */
        this.geocodeCacheTime = 60 * 60 * 1000;
        /** @type {number|null} */
        this.watchId = null;
        /** @type {Function[]} */
        this.listeners = [];
    }

    /**
     * Set the privacy level for location data
     * @param {PrivacyLevel} level - Privacy level
     */
    setPrivacyLevel(level) {
        const validLevels = ['exact', 'city', 'region', 'none'];
        if (validLevels.includes(level)) {
            this.privacyLevel = level;
            // Clear cached data when privacy level changes
            this.cachedPlace = null;
        } else {
            console.warn('[RPG Companion] Invalid privacy level:', level);
        }
    }

    /**
     * Check if geolocation is available
     * @returns {boolean}
     */
    isGeolocationAvailable() {
        return typeof navigator !== 'undefined' && 'geolocation' in navigator;
    }

    /**
     * Request current location from the browser
     * @param {boolean} [highAccuracy=false] - Use high accuracy mode
     * @returns {Promise<LocationData|null>}
     */
    async requestLocation(highAccuracy = false) {
        if (this.privacyLevel === 'none') {
            console.log('[RPG Companion] Location disabled by privacy settings');
            return null;
        }

        if (!this.isGeolocationAvailable()) {
            console.error('[RPG Companion] Geolocation not supported');
            throw new Error('Geolocation is not supported by this browser');
        }

        return new Promise((resolve, reject) => {
            const options = {
                enableHighAccuracy: highAccuracy,
                timeout: 10000,
                maximumAge: 300000 // 5 minute cache
            };

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const location = this.processLocation(position);
                    if (location) {
                        this.currentLocation = location;
                        this.addToHistory(location);
                        this.notifyListeners(location);
                    }
                    resolve(location);
                },
                (error) => {
                    console.error('[RPG Companion] Location error:', error.message);
                    let errorMessage;
                    switch (error.code) {
                        case error.PERMISSION_DENIED:
                            errorMessage = 'Location permission denied';
                            break;
                        case error.POSITION_UNAVAILABLE:
                            errorMessage = 'Location information unavailable';
                            break;
                        case error.TIMEOUT:
                            errorMessage = 'Location request timed out';
                            break;
                        default:
                            errorMessage = 'Unknown location error';
                    }
                    reject(new Error(errorMessage));
                },
                options
            );
        });
    }

    /**
     * Start watching location changes
     * @param {Function} callback - Called when location updates
     * @param {boolean} [highAccuracy=false] - Use high accuracy mode
     * @returns {boolean} True if watch started successfully
     */
    startWatching(callback, highAccuracy = false) {
        if (this.privacyLevel === 'none') {
            return false;
        }

        if (!this.isGeolocationAvailable()) {
            return false;
        }

        if (this.watchId !== null) {
            this.stopWatching();
        }

        if (callback) {
            this.listeners.push(callback);
        }

        const options = {
            enableHighAccuracy: highAccuracy,
            timeout: 30000,
            maximumAge: 60000
        };

        this.watchId = navigator.geolocation.watchPosition(
            (position) => {
                const location = this.processLocation(position);
                if (location) {
                    this.currentLocation = location;
                    this.addToHistory(location);
                    this.notifyListeners(location);
                }
            },
            (error) => {
                console.error('[RPG Companion] Watch position error:', error.message);
            },
            options
        );

        return true;
    }

    /**
     * Stop watching location changes
     */
    stopWatching() {
        if (this.watchId !== null) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }
    }

    /**
     * Add a location update listener
     * @param {Function} callback - Called with LocationData when location updates
     */
    addListener(callback) {
        if (typeof callback === 'function') {
            this.listeners.push(callback);
        }
    }

    /**
     * Remove a location update listener
     * @param {Function} callback - The callback to remove
     */
    removeListener(callback) {
        const index = this.listeners.indexOf(callback);
        if (index !== -1) {
            this.listeners.splice(index, 1);
        }
    }

    /**
     * Notify all listeners of a location update
     * @param {LocationData} location
     */
    notifyListeners(location) {
        this.listeners.forEach(callback => {
            try {
                callback(location);
            } catch (error) {
                console.error('[RPG Companion] Location listener error:', error);
            }
        });
    }

    /**
     * Process raw geolocation position based on privacy settings
     * @param {GeolocationPosition} position - Raw browser geolocation position
     * @returns {LocationData|null}
     */
    processLocation(position) {
        if (this.privacyLevel === 'none') {
            return null;
        }

        let { latitude, longitude } = position.coords;

        // Apply privacy level precision reduction
        switch (this.privacyLevel) {
            case 'exact':
                // Full precision, no rounding
                break;
            case 'city':
                // Round to ~10km precision (1 decimal place)
                latitude = Math.round(latitude * 10) / 10;
                longitude = Math.round(longitude * 10) / 10;
                break;
            case 'region':
                // Round to ~100km precision (no decimals)
                latitude = Math.round(latitude);
                longitude = Math.round(longitude);
                break;
            default:
                return null;
        }

        return {
            latitude,
            longitude,
            accuracy: this.privacyLevel === 'exact' ? position.coords.accuracy : undefined,
            timestamp: Date.now()
        };
    }

    /**
     * Add a location to the history
     * @param {LocationData} location
     */
    addToHistory(location) {
        this.locationHistory.push({ ...location });
        if (this.locationHistory.length > this.maxHistoryLength) {
            this.locationHistory.shift();
        }
    }

    /**
     * Set a manual location (for users who prefer not to use GPS)
     * @param {number} latitude
     * @param {number} longitude
     */
    setManualLocation(latitude, longitude) {
        const location = {
            latitude,
            longitude,
            timestamp: Date.now()
        };

        this.currentLocation = location;
        this.addToHistory(location);
        this.cachedPlace = null; // Clear geocode cache
    }

    /**
     * Reverse geocode coordinates to get place name
     * Uses OpenStreetMap Nominatim (free, no API key required)
     * @param {number} lat - Latitude
     * @param {number} lon - Longitude
     * @returns {Promise<PlaceInfo|null>}
     */
    async getPlaceName(lat, lon) {
        // Check cache first
        if (this.cachedPlace && Date.now() - this.lastGeocode < this.geocodeCacheTime) {
            return this.cachedPlace;
        }

        try {
            const url = new URL(NOMINATIM_API);
            url.searchParams.set('lat', lat.toString());
            url.searchParams.set('lon', lon.toString());
            url.searchParams.set('format', 'json');
            url.searchParams.set('addressdetails', '1');

            const response = await fetch(url.toString(), {
                headers: {
                    // Nominatim requires a valid User-Agent
                    'User-Agent': 'RPG-Companion-SillyTavern/1.0'
                }
            });

            if (!response.ok) {
                throw new Error(`Geocoding failed: ${response.status}`);
            }

            const data = await response.json();
            const address = data.address || {};

            this.cachedPlace = {
                city: address.city || address.town || address.village || address.municipality || null,
                neighborhood: address.suburb || address.neighbourhood || address.hamlet || null,
                region: address.state || address.county || address.province || null,
                country: address.country || null,
                countryCode: address.country_code?.toUpperCase() || null,
                displayName: data.display_name || null
            };
            this.lastGeocode = Date.now();

            console.log('[RPG Companion] Geocoded location:', this.cachedPlace);
            return this.cachedPlace;
        } catch (error) {
            console.error('[RPG Companion] Geocoding error:', error);
            return null;
        }
    }

    /**
     * Get current place name (uses cached location)
     * @returns {Promise<PlaceInfo|null>}
     */
    async getCurrentPlaceName() {
        if (!this.currentLocation) {
            return null;
        }
        return this.getPlaceName(
            this.currentLocation.latitude,
            this.currentLocation.longitude
        );
    }

    /**
     * Generate location-aware dialogue
     * @param {PlaceInfo} placeName - Place information
     * @param {string} [characterPersonality='friendly'] - Character personality type
     * @returns {string|null}
     */
    getLocationDialogue(placeName, characterPersonality = 'friendly') {
        if (!placeName) return null;

        const dialogues = [];

        if (placeName.city) {
            dialogues.push(
                `${placeName.city} seems like an interesting place!`,
                `So you're in ${placeName.city}? How do you like it there?`,
                `${placeName.city}! I've always wanted to know what it's like there.`,
                `What's ${placeName.city} like this time of year?`
            );
        }

        if (placeName.country && placeName.country !== 'United States') {
            dialogues.push(
                `${placeName.country}! That sounds wonderful.`,
                `Oh, you're in ${placeName.country}? Tell me about it sometime!`
            );
        }

        if (dialogues.length === 0) {
            return null;
        }

        return dialogues[Math.floor(Math.random() * dialogues.length)];
    }

    /**
     * Get a privacy-friendly location description
     * @returns {string}
     */
    getLocationDescription() {
        if (!this.cachedPlace) {
            return 'Unknown location';
        }

        const parts = [];

        switch (this.privacyLevel) {
            case 'exact':
            case 'city':
                if (this.cachedPlace.city) {
                    parts.push(this.cachedPlace.city);
                }
                if (this.cachedPlace.region) {
                    parts.push(this.cachedPlace.region);
                }
                if (this.cachedPlace.country && !parts.length) {
                    parts.push(this.cachedPlace.country);
                }
                break;
            case 'region':
                if (this.cachedPlace.region) {
                    parts.push(this.cachedPlace.region);
                }
                if (this.cachedPlace.country) {
                    parts.push(this.cachedPlace.country);
                }
                break;
            default:
                return 'Location private';
        }

        return parts.join(', ') || 'Unknown location';
    }

    /**
     * Clear all location data
     */
    clearData() {
        this.stopWatching();
        this.currentLocation = null;
        this.locationHistory = [];
        this.cachedPlace = null;
        this.lastGeocode = 0;
    }

    /**
     * Export location data (respects privacy settings)
     * @returns {Object}
     */
    exportData() {
        if (this.privacyLevel === 'none') {
            return { privacyLevel: 'none', location: null };
        }

        return {
            privacyLevel: this.privacyLevel,
            location: this.currentLocation,
            place: this.cachedPlace
        };
    }
}

export default LocationService;
