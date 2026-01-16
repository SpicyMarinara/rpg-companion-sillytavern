/**
 * Privacy Manager
 * Controls what real-world data is shared with companions
 *
 * @module realworld/privacyManager
 */

/**
 * Privacy settings structure
 * @typedef {Object} PrivacySettings
 * @property {boolean} shareWeather - Share weather information
 * @property {boolean} shareTime - Share time information
 * @property {boolean} shareLocation - Share location information
 * @property {'exact'|'city'|'region'|'none'} locationPrecision - Location precision level
 * @property {boolean} shareCalendar - Share calendar/special dates (future feature)
 * @property {boolean} shareTimezone - Share timezone information
 * @property {boolean} shareSeason - Share seasonal information
 * @property {boolean} consentGiven - User has given explicit consent
 * @property {number} consentTimestamp - When consent was given
 */

const STORAGE_KEY = 'rpg_companion_privacy_settings';

/**
 * Default privacy settings (privacy-first defaults)
 * @type {PrivacySettings}
 */
const DEFAULT_SETTINGS = {
    shareWeather: true,
    shareTime: true,
    shareLocation: false,  // Off by default for privacy
    locationPrecision: 'city',
    shareCalendar: true,
    shareTimezone: true,
    shareSeason: true,
    consentGiven: false,
    consentTimestamp: 0
};

/**
 * Privacy Manager for controlling real-world data sharing
 */
export class PrivacyManager {
    constructor() {
        /** @type {PrivacySettings} */
        this.settings = this.loadSettings();
        /** @type {Function[]} */
        this.changeListeners = [];
    }

    /**
     * Load settings from storage
     * @returns {PrivacySettings}
     */
    loadSettings() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                // Merge with defaults to ensure all fields exist
                return { ...DEFAULT_SETTINGS, ...parsed };
            }
        } catch (error) {
            console.error('[RPG Companion] Failed to load privacy settings:', error);
        }
        return { ...DEFAULT_SETTINGS };
    }

    /**
     * Save settings to storage
     */
    saveSettings() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
            this.notifyListeners();
        } catch (error) {
            console.error('[RPG Companion] Failed to save privacy settings:', error);
        }
    }

    /**
     * Add a listener for settings changes
     * @param {Function} callback - Called when settings change
     */
    addChangeListener(callback) {
        if (typeof callback === 'function') {
            this.changeListeners.push(callback);
        }
    }

    /**
     * Remove a change listener
     * @param {Function} callback
     */
    removeChangeListener(callback) {
        const index = this.changeListeners.indexOf(callback);
        if (index !== -1) {
            this.changeListeners.splice(index, 1);
        }
    }

    /**
     * Notify all change listeners
     */
    notifyListeners() {
        this.changeListeners.forEach(callback => {
            try {
                callback(this.settings);
            } catch (error) {
                console.error('[RPG Companion] Privacy listener error:', error);
            }
        });
    }

    /**
     * Get current privacy settings
     * @returns {PrivacySettings}
     */
    getSettings() {
        return { ...this.settings };
    }

    /**
     * Update a single setting
     * @param {keyof PrivacySettings} key - Setting key
     * @param {*} value - New value
     */
    setSetting(key, value) {
        if (key in this.settings) {
            this.settings[key] = value;
            this.saveSettings();
        }
    }

    /**
     * Update multiple settings at once
     * @param {Partial<PrivacySettings>} updates - Settings to update
     */
    updateSettings(updates) {
        Object.assign(this.settings, updates);
        this.saveSettings();
    }

    /**
     * Check if weather sharing is enabled
     * @returns {boolean}
     */
    canShareWeather() {
        return this.settings.shareWeather && this.settings.consentGiven;
    }

    /**
     * Check if time sharing is enabled
     * @returns {boolean}
     */
    canShareTime() {
        return this.settings.shareTime && this.settings.consentGiven;
    }

    /**
     * Check if location sharing is enabled
     * @returns {boolean}
     */
    canShareLocation() {
        return this.settings.shareLocation && this.settings.consentGiven;
    }

    /**
     * Check if calendar/special dates sharing is enabled
     * @returns {boolean}
     */
    canShareCalendar() {
        return this.settings.shareCalendar && this.settings.consentGiven;
    }

    /**
     * Check if timezone sharing is enabled
     * @returns {boolean}
     */
    canShareTimezone() {
        return this.settings.shareTimezone && this.settings.consentGiven;
    }

    /**
     * Check if season sharing is enabled
     * @returns {boolean}
     */
    canShareSeason() {
        return this.settings.shareSeason && this.settings.consentGiven;
    }

    /**
     * Get the current location precision setting
     * @returns {'exact'|'city'|'region'|'none'}
     */
    getLocationPrecision() {
        if (!this.settings.shareLocation) {
            return 'none';
        }
        return this.settings.locationPrecision;
    }

    /**
     * Record user consent
     * @param {boolean} given - Whether consent was given
     */
    recordConsent(given) {
        this.settings.consentGiven = given;
        this.settings.consentTimestamp = given ? Date.now() : 0;
        this.saveSettings();
    }

    /**
     * Check if user has given consent
     * @returns {boolean}
     */
    hasConsent() {
        return this.settings.consentGiven;
    }

    /**
     * Revoke all consent and disable sharing
     */
    revokeConsent() {
        this.settings.consentGiven = false;
        this.settings.consentTimestamp = 0;
        this.settings.shareLocation = false;
        this.saveSettings();
    }

    /**
     * Enable everything (for users who want full integration)
     */
    enableAll() {
        this.settings.shareWeather = true;
        this.settings.shareTime = true;
        this.settings.shareLocation = true;
        this.settings.locationPrecision = 'city';
        this.settings.shareCalendar = true;
        this.settings.shareTimezone = true;
        this.settings.shareSeason = true;
        this.settings.consentGiven = true;
        this.settings.consentTimestamp = Date.now();
        this.saveSettings();
    }

    /**
     * Disable everything (privacy mode)
     */
    disableAll() {
        this.settings.shareWeather = false;
        this.settings.shareTime = false;
        this.settings.shareLocation = false;
        this.settings.shareCalendar = false;
        this.settings.shareTimezone = false;
        this.settings.shareSeason = false;
        this.saveSettings();
    }

    /**
     * Reset to default settings
     */
    resetToDefaults() {
        this.settings = { ...DEFAULT_SETTINGS };
        this.saveSettings();
    }

    /**
     * Get a human-readable privacy summary
     * @returns {string}
     */
    getPrivacySummary() {
        if (!this.settings.consentGiven) {
            return 'Real-world integration disabled (no consent given)';
        }

        const shared = [];

        if (this.settings.shareTime) shared.push('time');
        if (this.settings.shareWeather) shared.push('weather');
        if (this.settings.shareLocation) {
            shared.push(`location (${this.settings.locationPrecision} precision)`);
        }
        if (this.settings.shareCalendar) shared.push('special dates');
        if (this.settings.shareSeason) shared.push('season');
        if (this.settings.shareTimezone) shared.push('timezone');

        if (shared.length === 0) {
            return 'No real-world data shared';
        }

        return `Sharing: ${shared.join(', ')}`;
    }

    /**
     * Get detailed privacy information for UI display
     * @returns {Array<{name: string, enabled: boolean, description: string}>}
     */
    getPrivacyDetails() {
        return [
            {
                key: 'shareTime',
                name: 'Time of Day',
                enabled: this.settings.shareTime,
                description: 'Share current time so companions can reference morning/evening/etc.'
            },
            {
                key: 'shareWeather',
                name: 'Weather',
                enabled: this.settings.shareWeather,
                description: 'Share current weather conditions for immersive context'
            },
            {
                key: 'shareLocation',
                name: 'Location',
                enabled: this.settings.shareLocation,
                description: `Share your location (${this.settings.locationPrecision} precision)`
            },
            {
                key: 'shareTimezone',
                name: 'Timezone',
                enabled: this.settings.shareTimezone,
                description: 'Share your timezone for accurate time references'
            },
            {
                key: 'shareSeason',
                name: 'Season',
                enabled: this.settings.shareSeason,
                description: 'Share current season for seasonal references'
            },
            {
                key: 'shareCalendar',
                name: 'Special Dates',
                enabled: this.settings.shareCalendar,
                description: 'Share holidays and special occasions'
            }
        ];
    }

    /**
     * Export settings for backup
     * @returns {string} JSON string of settings
     */
    exportSettings() {
        return JSON.stringify(this.settings, null, 2);
    }

    /**
     * Import settings from backup
     * @param {string} jsonString - JSON string of settings
     * @returns {boolean} Success
     */
    importSettings(jsonString) {
        try {
            const imported = JSON.parse(jsonString);
            this.settings = { ...DEFAULT_SETTINGS, ...imported };
            this.saveSettings();
            return true;
        } catch (error) {
            console.error('[RPG Companion] Failed to import privacy settings:', error);
            return false;
        }
    }

    /**
     * Get data retention information
     * @returns {Object}
     */
    getDataRetentionInfo() {
        return {
            storageType: 'localStorage',
            dataStored: [
                'Privacy preference settings',
                'Consent timestamp'
            ],
            notStored: [
                'GPS coordinates (only used temporarily)',
                'Weather data (only cached in memory)',
                'No data sent to external servers except weather/geocoding APIs'
            ],
            canDelete: true,
            deleteMethod: 'Use "Reset to Defaults" or clear browser storage'
        };
    }
}

export default PrivacyManager;
