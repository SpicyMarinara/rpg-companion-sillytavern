/**
 * RPG Companion Enhanced - Data Structures
 * Complete data models for character-focused roleplay system
 *
 * Based on KATHERINE_RPG_MASTER_SPECIFICATION.txt
 * Version: 2.0.0
 */

/**
 * Universal Stats Data Structure
 * 30 core stats that exist for every character
 * ALL stats start as null - only populated from actual context/conversation
 */
export class UniversalStats {
    constructor(defaults = {}) {
        // Physical stats (5) - ALL start null, populated by LLM analysis
        this.hunger = defaults.hunger ?? null;        // Need to eat (0=full, 100=starving)
        this.bladder = defaults.bladder ?? null;      // Need to urinate (0=empty, 100=desperate)
        this.bowel = defaults.bowel ?? null;          // Need to defecate (0=empty, 100=desperate)
        this.health = defaults.health ?? null;        // Overall wellness (0=dying, 100=peak)
        this.cleanliness = defaults.cleanliness ?? null; // How clean (0=filthy, 100=fresh)

        // Mental stats (6) - ALL start null
        this.willpower = defaults.willpower ?? null;      // Self-control, resistance
        this.confidence = defaults.confidence ?? null;    // Self-belief
        this.pride = defaults.pride ?? null;              // Self-satisfaction, dignity
        this.shame = defaults.shame ?? null;              // Self-directed embarrassment
        this.jealousy = defaults.jealousy ?? null;        // Envy toward others
        this.loneliness = defaults.loneliness ?? null;    // Feeling of isolation

        // Moral stats (4) - ALL start null
        this.morality = defaults.morality ?? null;    // Adherence to moral code
        this.corruption = defaults.corruption ?? null;  // Moral degradation
        this.honesty = defaults.honesty ?? null;      // Truthfulness commitment
        this.loyalty = defaults.loyalty ?? null;     // Devotion (null = not earned)

        // Sexual stats (6) - ALL start null
        this.perversion = defaults.perversion ?? null;        // Interest in unusual acts
        this.lewdity = defaults.lewdity ?? null;              // Comfort with sexual topics
        this.exhibitionism = defaults.exhibitionism ?? null;   // Desire to be seen
        this.modesty = defaults.modesty ?? null;              // Preference for privacy
        this.dominance = defaults.dominance ?? null;          // Desire to control
        this.submissiveness = defaults.submissiveness ?? null; // Desire to submit
        this.arousal = defaults.arousal ?? null;              // Sexual excitement

        // Additional stats (9) - ALL start null
        this.stress = defaults.stress ?? null;        // Mental pressure
        this.anxiety = defaults.anxiety ?? null;      // Worry, nervousness
        this.energy = defaults.energy ?? null;        // Physical energy
        this.sleep = defaults.sleep ?? null;          // Rest level
        this.pain = defaults.pain ?? null;             // Physical pain
        this.comfort = defaults.comfort ?? null;      // Physical/mental ease
        this.patience = defaults.patience ?? null;    // Tolerance for waiting
        this.focus = defaults.focus ?? null;          // Concentration ability

        // Track which stats have been confirmed from context
        this._confirmed = defaults._confirmed ?? {};
    }

    /**
     * Get stat value safely
     * @param {string} statName - Name of the stat
     * @returns {number|null} Stat value or null if doesn't exist
     */
    getStat(statName) {
        return this[statName] !== undefined ? this[statName] : null;
    }

    /**
     * Set stat value with bounds checking (0-100)
     * @param {string} statName - Name of the stat
     * @param {number} value - New value
     * @returns {boolean} Success
     */
    setStat(statName, value) {
        if (this[statName] === undefined) {
            console.warn(`[RPG Enhanced] Stat "${statName}" does not exist`);
            return false;
        }

        // Handle null loyalty specially
        if (statName === 'loyalty' && value === null) {
            this.loyalty = null;
            return true;
        }

        // Clamp between 0 and 100
        this[statName] = Math.max(0, Math.min(100, value));
        return true;
    }

    /**
     * Change stat by delta with maximum change limit
     * @param {string} statName - Name of the stat
     * @param {number} delta - Amount to change (positive or negative)
     * @param {number} maxChange - Maximum allowed change per event (default 25)
     * @returns {boolean} Success
     */
    changeStat(statName, delta, maxChange = 25) {
        const current = this.getStat(statName);
        if (current === null) return false;

        // Limit delta to maxChange
        const limitedDelta = Math.max(-maxChange, Math.min(maxChange, delta));

        return this.setStat(statName, current + limitedDelta);
    }

    /**
     * Get all stats as plain object
     * @returns {Object} All stats
     */
    toObject() {
        return {
            hunger: this.hunger,
            bladder: this.bladder,
            bowel: this.bowel,
            health: this.health,
            cleanliness: this.cleanliness,
            willpower: this.willpower,
            confidence: this.confidence,
            pride: this.pride,
            shame: this.shame,
            jealousy: this.jealousy,
            loneliness: this.loneliness,
            morality: this.morality,
            corruption: this.corruption,
            honesty: this.honesty,
            loyalty: this.loyalty,
            perversion: this.perversion,
            lewdity: this.lewdity,
            exhibitionism: this.exhibitionism,
            modesty: this.modesty,
            dominance: this.dominance,
            submissiveness: this.submissiveness,
            arousal: this.arousal,
            stress: this.stress,
            anxiety: this.anxiety,
            energy: this.energy,
            sleep: this.sleep,
            pain: this.pain,
            comfort: this.comfort,
            patience: this.patience,
            focus: this.focus
        };
    }

    /**
     * Get critical stats that need immediate attention
     * @returns {Array} Array of critical stat objects
     */
    getCriticalStats() {
        const critical = [];

        if (this.hunger >= 90) critical.push({ name: 'hunger', value: this.hunger, level: 'survival' });
        if (this.bladder >= 95) critical.push({ name: 'bladder', value: this.bladder, level: 'survival' });
        if (this.bowel >= 95) critical.push({ name: 'bowel', value: this.bowel, level: 'survival' });
        if (this.health <= 20) critical.push({ name: 'health', value: this.health, level: 'survival' });
        if (this.pain >= 80) critical.push({ name: 'pain', value: this.pain, level: 'survival' });

        return critical;
    }

    /**
     * Get urgent stats that need attention soon
     * @returns {Array} Array of urgent stat objects
     */
    getUrgentStats() {
        const urgent = [];

        if (this.hunger >= 70 && this.hunger < 90) urgent.push({ name: 'hunger', value: this.hunger });
        if (this.bladder >= 70 && this.bladder < 95) urgent.push({ name: 'bladder', value: this.bladder });
        if (this.bowel >= 70 && this.bowel < 95) urgent.push({ name: 'bowel', value: this.bowel });
        if (this.cleanliness <= 30) urgent.push({ name: 'cleanliness', value: this.cleanliness });
        if (this.sleep <= 20) urgent.push({ name: 'sleep', value: this.sleep });
        if (this.energy <= 20) urgent.push({ name: 'energy', value: this.energy });

        return urgent;
    }
}

/**
 * Relationship Stats Structure
 * 18 stats per NPC across 4 categories
 * ALL stats start null - only populated from actual context/conversation
 */
export class RelationshipStats {
    /**
     * @param {string} npcName - Name of the NPC
     * @param {Object} defaults - Default values
     */
    constructor(npcName, defaults = {}) {
        this.npcName = npcName;

        // Core relationship (5 stats) - ALL start null
        this.core = {
            trust: defaults.trust ?? null,           // Can I rely on them?
            love: defaults.love ?? null,              // Romantic/deep love
            respect: defaults.respect ?? null,       // Do I admire them?
            fear: defaults.fear ?? null,              // Am I scared of them?
            loyalty: defaults.loyalty ?? null      // Am I devoted? (null = not earned)
        };

        // Emotional connection (5 stats) - ALL start null
        this.emotional = {
            closeness: defaults.closeness ?? null,        // Emotional intimacy
            comfort: defaults.comfort ?? null,            // At ease around them
            openness: defaults.openness ?? null,          // Will share secrets
            vulnerability: defaults.vulnerability ?? null,  // Will show weakness
            dependence: defaults.dependence ?? null        // Rely on them
        };

        // Social dynamics (4 stats) - ALL start null
        this.social = {
            dominance: defaults.dominance ?? null,         // Lead in relationship
            submissiveness: defaults.submissiveness ?? null, // Follow in relationship
            assertiveness: defaults.assertiveness ?? null,   // Speak up with them
            flirtiness: defaults.flirtiness ?? null          // Flirtatious behavior
        };

        // Attraction (4 stats) - ALL start null
        this.attraction = {
            physical: defaults.physical ?? null,      // Body attraction
            emotional: defaults.emotional ?? null,   // Personality attraction
            intellectual: defaults.intellectual ?? null, // Mind attraction
            sexual: defaults.sexual ?? null          // Sexual desire
        };

        // Metadata - only type/importance start with defaults
        this.metadata = {
            relationshipType: defaults.relationshipType ?? 'Unknown',
            firstMet: defaults.firstMet ?? null,
            importance: defaults.importance ?? 'Unknown',
            isActive: defaults.isActive ?? false,
            lastSeen: defaults.lastSeen ?? null,
            interactionCount: defaults.interactionCount ?? 0,
            notes: defaults.notes ?? '',
            confirmed: defaults.confirmed ?? false  // Whether this relationship is confirmed from context
        };
    }

    /**
     * Update a relationship stat
     * @param {string} category - core, emotional, social, or attraction
     * @param {string} stat - Stat name
     * @param {number} delta - Change amount
     * @param {number} maxChange - Maximum change allowed
     * @returns {boolean} Success
     */
    updateStat(category, stat, delta, maxChange = 25) {
        if (!this[category] || this[category][stat] === undefined) {
            console.warn(`[RPG Enhanced] Invalid relationship stat: ${category}.${stat}`);
            return false;
        }

        const current = this[category][stat];

        // Handle null loyalty specially
        if (stat === 'loyalty' && current === null) {
            // Check if loyalty should unlock
            if (this.core.trust >= 80 && this.core.love >= 60) {
                this.core.loyalty = 50 + delta; // Start at 50 + change
                return true;
            }
            console.log(`[RPG Enhanced] Loyalty not yet unlocked for ${this.npcName}`);
            return false;
        }

        // Limit change
        const limitedDelta = Math.max(-maxChange, Math.min(maxChange, delta));
        const newValue = Math.max(0, Math.min(100, current + limitedDelta));
        this[category][stat] = newValue;

        return true;
    }

    /**
     * Set a stat directly
     * @param {string} category - Category name
     * @param {string} stat - Stat name
     * @param {number} value - New value
     */
    setStat(category, stat, value) {
        if (!this[category] || this[category][stat] === undefined) {
            return false;
        }

        if (value === null && stat === 'loyalty') {
            this[category][stat] = null;
            return true;
        }

        this[category][stat] = Math.max(0, Math.min(100, value));
        return true;
    }

    /**
     * Get relationship summary description
     * @returns {string} Human-readable summary
     */
    getSummary() {
        const trust = this.core.trust;
        const love = this.core.love;
        const fear = this.core.fear;
        const loyalty = this.core.loyalty;

        if (love >= 80 && trust >= 80) return 'Very close, deeply loving relationship';
        if (love >= 60 && trust >= 60) return 'Strong affectionate bond';
        if (loyalty >= 80) return 'Deeply devoted and loyal';
        if (trust >= 70 && love < 30) return 'Trusted friend (platonic)';
        if (fear >= 60) return 'Intimidated and fearful';
        if (trust <= 30 && fear <= 30) return 'Cautious and guarded';
        if (trust <= 20) return 'Distrustful and wary';

        return 'Developing relationship';
    }

    /**
     * Convert to plain object
     * @returns {Object}
     */
    toObject() {
        return {
            npcName: this.npcName,
            core: { ...this.core },
            emotional: { ...this.emotional },
            social: { ...this.social },
            attraction: { ...this.attraction },
            metadata: { ...this.metadata }
        };
    }
}

/**
 * Hair Growth System
 * Tracks hair in body areas - ALL start null until confirmed from context
 */
export class HairGrowth {
    constructor(defaults = {}) {
        // Only track relevant areas - all start null
        this.pubic = {
            value: defaults.pubic?.value ?? null,
            lastShaved: defaults.pubic?.lastShaved ?? null,
            growthRate: defaults.pubic?.growthRate ?? null
        };
        this.armpits = {
            value: defaults.armpits?.value ?? null,
            lastShaved: defaults.armpits?.lastShaved ?? null,
            growthRate: defaults.armpits?.growthRate ?? null
        };
        this.assCrack = {
            value: defaults.assCrack?.value ?? null,
            lastShaved: defaults.assCrack?.lastShaved ?? null,
            growthRate: defaults.assCrack?.growthRate ?? null
        };
        // Track if hair system is enabled/relevant for this character
        this._enabled = defaults._enabled ?? null;
    }

    /**
     * Advance hair growth by specified days
     * @param {number} days - Number of days to advance
     */
    advanceDays(days) {
        if (!this._enabled) return;
        const areas = ['pubic', 'armpits', 'assCrack'];
        for (const area of areas) {
            if (this[area]?.value !== null && this[area]?.growthRate !== null) {
                const growth = this[area].growthRate * days;
                this[area].value = Math.min(100, this[area].value + growth);
            }
        }
    }

    /**
     * Shave an area
     * @param {string} area - Area to shave
     */
    shave(area) {
        if (this[area]) {
            this[area].value = 0;
            this[area].lastShaved = new Date().toISOString();
        }
    }

    /**
     * Trim an area to a specific level
     * @param {string} area - Area to trim
     * @param {number} targetValue - Target value (0-100)
     */
    trim(area, targetValue) {
        if (this[area] && targetValue < this[area].value) {
            this[area].value = Math.max(0, Math.min(100, targetValue));
            this[area].lastShaved = new Date().toISOString();
        }
    }

    /**
     * Get description for a hair area based on value
     * @param {string} area - Area name
     * @param {Object} customDescriptions - Custom descriptions (optional)
     * @returns {string} Description
     */
    getDescription(area, customDescriptions = null) {
        const value = this[area]?.value ?? 0;

        // Use custom descriptions if provided
        if (customDescriptions && customDescriptions[area]) {
            const desc = customDescriptions[area];
            if (value <= 10) return desc['0-10'] ?? this.getDefaultDescription(area, value);
            if (value <= 30) return desc['11-30'] ?? this.getDefaultDescription(area, value);
            if (value <= 60) return desc['31-60'] ?? this.getDefaultDescription(area, value);
            if (value <= 80) return desc['61-80'] ?? this.getDefaultDescription(area, value);
            return desc['81-100'] ?? this.getDefaultDescription(area, value);
        }

        return this.getDefaultDescription(area, value);
    }

    /**
     * Get default description for hair area
     * @param {string} area - Area name
     * @param {number} value - Current value
     * @returns {string} Description
     */
    getDefaultDescription(area, value) {
        const descriptions = {
            pubic: {
                '0-10': 'Completely smooth, freshly shaved',
                '11-30': 'Light stubble, few days growth',
                '31-60': 'Moderate growth, visible but neat',
                '61-80': 'Full bush, thick coverage',
                '81-100': 'Very thick bush, extends beyond underwear line'
            },
            armpits: {
                '0-10': 'Completely smooth',
                '11-30': 'Light stubble visible',
                '31-60': 'Noticeable hair, few centimeters',
                '61-80': 'Full armpit hair',
                '81-100': 'Very thick, long armpit hair'
            },
            assCrack: {
                '0-10': 'Smooth, no hair',
                '11-30': 'Light fuzz',
                '31-60': 'Moderate hair growth',
                '61-80': 'Hairy',
                '81-100': 'Very hairy'
            },
            arms: {
                '0-10': 'Bare arms',
                '11-30': 'Light, barely visible hair',
                '31-60': 'Normal arm hair',
                '61-80': 'Noticeable arm hair',
                '81-100': 'Very hairy arms'
            },
            legs: {
                '0-10': 'Completely smooth legs',
                '11-30': 'Light stubble',
                '31-60': 'Moderate leg hair',
                '61-80': 'Hairy legs',
                '81-100': 'Very hairy legs'
            }
        };

        const areaDesc = descriptions[area] || descriptions.legs;

        if (value <= 10) return areaDesc['0-10'];
        if (value <= 30) return areaDesc['11-30'];
        if (value <= 60) return areaDesc['31-60'];
        if (value <= 80) return areaDesc['61-80'];
        return areaDesc['81-100'];
    }

    /**
     * Convert to plain object
     * @returns {Object}
     */
    toObject() {
        return {
            pubic: { ...this.pubic },
            armpits: { ...this.armpits },
            assCrack: { ...this.assCrack },
            _enabled: this._enabled
        };
    }
}

/**
 * Outfit System
 * Tracks current clothing with descriptions
 */
export class Outfit {
    constructor(defaults = {}) {
        this.top = {
            name: defaults.top?.name ?? '',
            description: defaults.top?.description ?? '',
            lastUpdated: defaults.top?.lastUpdated ?? null
        };
        this.bottom = {
            name: defaults.bottom?.name ?? '',
            description: defaults.bottom?.description ?? '',
            lastUpdated: defaults.bottom?.lastUpdated ?? null
        };
        this.underwear = {
            name: defaults.underwear?.name ?? '',
            description: defaults.underwear?.description ?? '',
            lastUpdated: defaults.underwear?.lastUpdated ?? null
        };
        this.bra = {
            name: defaults.bra?.name ?? '',
            description: defaults.bra?.description ?? '',
            lastUpdated: defaults.bra?.lastUpdated ?? null
        };
        this.shoes = {
            name: defaults.shoes?.name ?? '',
            description: defaults.shoes?.description ?? '',
            lastUpdated: defaults.shoes?.lastUpdated ?? null
        };
        this.accessories = {
            name: defaults.accessories?.name ?? '',
            description: defaults.accessories?.description ?? '',
            lastUpdated: defaults.accessories?.lastUpdated ?? null
        };
        this.overallDescription = defaults.overallDescription ?? '';
    }

    /**
     * Update a clothing item
     * @param {string} slot - Clothing slot
     * @param {string} name - Item name
     * @param {string} description - Item description
     */
    setItem(slot, name, description = '') {
        if (this[slot]) {
            this[slot].name = name;
            this[slot].description = description;
            this[slot].lastUpdated = new Date().toISOString();
        }
    }

    /**
     * Remove a clothing item
     * @param {string} slot - Clothing slot
     */
    removeItem(slot) {
        if (this[slot]) {
            this[slot].name = '';
            this[slot].description = '';
            this[slot].lastUpdated = new Date().toISOString();
        }
    }

    /**
     * Get full outfit description
     * @returns {string}
     */
    getFullDescription() {
        if (this.overallDescription) {
            return this.overallDescription;
        }

        const parts = [];
        if (this.top.name) parts.push(`${this.top.name} (${this.top.description})`);
        if (this.bottom.name) parts.push(`${this.bottom.name} (${this.bottom.description})`);
        if (this.underwear.name) parts.push(`${this.underwear.name}`);
        if (this.bra.name) parts.push(`${this.bra.name}`);
        if (this.shoes.name) parts.push(`${this.shoes.name}`);
        if (this.accessories.name) parts.push(`Accessories: ${this.accessories.name}`);

        return parts.join(', ') || 'No outfit description';
    }

    /**
     * Check if wearing specific item type
     * @param {string} slot - Slot to check
     * @returns {boolean}
     */
    isWearing(slot) {
        return !!(this[slot] && this[slot].name);
    }

    /**
     * Convert to plain object
     * @returns {Object}
     */
    toObject() {
        return {
            top: { ...this.top },
            bottom: { ...this.bottom },
            underwear: { ...this.underwear },
            bra: { ...this.bra },
            shoes: { ...this.shoes },
            accessories: { ...this.accessories },
            overallDescription: this.overallDescription
        };
    }
}

/**
 * Biology System
 * Tracks menstrual cycle and pregnancy - ALL start null until character context confirms
 */
export class BiologySystem {
    constructor(defaults = {}) {
        // All start null - only enabled if character context indicates relevance
        this.cycleEnabled = defaults.cycleEnabled ?? null;  // null = unknown, false = not applicable
        this.currentPhase = defaults.currentPhase ?? null;
        this.dayOfCycle = defaults.dayOfCycle ?? null;
        this.cycleLength = defaults.cycleLength ?? null;
        this.lastPeriodStart = defaults.lastPeriodStart ?? null;
        this.nextPeriodStart = defaults.nextPeriodStart ?? null;
        this.pregnant = defaults.pregnant ?? null;
        this.pregnancyDay = defaults.pregnancyDay ?? null;
        this.pregnancyTrimester = defaults.pregnancyTrimester ?? null;
        this.fertilityWindow = defaults.fertilityWindow ?? null;
        this.symptoms = defaults.symptoms ?? [];
    }

    /**
     * Advance cycle by days
     * @param {number} days - Days to advance
     */
    advanceDays(days) {
        if (!this.cycleEnabled) return;

        // Handle pregnancy
        if (this.pregnant) {
            this.pregnancyDay += days;
            this.updatePregnancyTrimester();
            return;
        }

        // Advance cycle
        this.dayOfCycle += days;

        // Wrap around cycle
        while (this.dayOfCycle > this.cycleLength) {
            this.dayOfCycle -= this.cycleLength;
            this.lastPeriodStart = new Date().toISOString();
        }

        this.updatePhase();
        this.updateSymptoms();
    }

    /**
     * Update current phase based on cycle day
     */
    updatePhase() {
        this.fertilityWindow = false;

        if (this.dayOfCycle <= 5) {
            this.currentPhase = 'menstruating';
        } else if (this.dayOfCycle <= 13) {
            this.currentPhase = 'follicular';
        } else if (this.dayOfCycle <= 16) {
            this.currentPhase = 'ovulating';
            this.fertilityWindow = true;
        } else {
            this.currentPhase = 'luteal';
        }
    }

    /**
     * Update pregnancy trimester
     */
    updatePregnancyTrimester() {
        if (this.pregnancyDay <= 84) { // ~12 weeks
            this.pregnancyTrimester = 1;
        } else if (this.pregnancyDay <= 182) { // ~26 weeks
            this.pregnancyTrimester = 2;
        } else {
            this.pregnancyTrimester = 3;
        }
    }

    /**
     * Update symptoms based on cycle phase
     */
    updateSymptoms() {
        this.symptoms = [];

        switch (this.currentPhase) {
            case 'menstruating':
                this.symptoms = ['cramps', 'fatigue', 'mood swings'];
                break;
            case 'follicular':
                this.symptoms = ['increased energy', 'positive mood'];
                break;
            case 'ovulating':
                this.symptoms = ['increased libido', 'mild cramping', 'fertile'];
                break;
            case 'luteal':
                this.symptoms = ['PMS symptoms', 'bloating', 'irritability'];
                break;
        }
    }

    /**
     * Get current phase description
     * @returns {string}
     */
    getPhaseDescription() {
        const descriptions = {
            menstruating: 'Menstruating - experiencing period',
            follicular: 'Follicular phase - building up to ovulation',
            ovulating: 'Ovulating - peak fertility window',
            luteal: 'Luteal phase - approaching next period'
        };

        if (this.pregnant) {
            return `Pregnant - Day ${this.pregnancyDay}, Trimester ${this.pregnancyTrimester}`;
        }

        return descriptions[this.currentPhase] || 'Unknown phase';
    }

    /**
     * Start pregnancy
     */
    becomePregnant() {
        this.pregnant = true;
        this.pregnancyDay = 1;
        this.pregnancyTrimester = 1;
        this.currentPhase = 'pregnant';
        this.symptoms = [];
    }

    /**
     * End pregnancy
     * @param {boolean} birth - Whether ending due to birth
     */
    endPregnancy(birth = true) {
        this.pregnant = false;
        this.pregnancyDay = 0;
        this.pregnancyTrimester = 0;
        this.dayOfCycle = 1;
        this.currentPhase = 'menstruating';

        if (birth) {
            // Post-birth recovery
            this.symptoms = ['recovering', 'fatigue'];
        }
    }

    /**
     * Get days until next period
     * @returns {number}
     */
    getDaysUntilPeriod() {
        if (this.pregnant) return -1;
        return this.cycleLength - this.dayOfCycle + 1;
    }

    /**
     * Convert to plain object
     * @returns {Object}
     */
    toObject() {
        return {
            cycleEnabled: this.cycleEnabled,
            currentPhase: this.currentPhase,
            dayOfCycle: this.dayOfCycle,
            cycleLength: this.cycleLength,
            lastPeriodStart: this.lastPeriodStart,
            nextPeriodStart: this.nextPeriodStart,
            pregnant: this.pregnant,
            pregnancyDay: this.pregnancyDay,
            pregnancyTrimester: this.pregnancyTrimester,
            fertilityWindow: this.fertilityWindow,
            symptoms: [...this.symptoms]
        };
    }
}

/**
 * Scene Context
 * Tracks current environment - ALL start null until determined from context
 */
export class SceneContext {
    constructor(defaults = {}) {
        // Location - all null until determined
        this.location = defaults.location ?? null;
        this.locationType = defaults.locationType ?? null;
        this.description = defaults.description ?? null;

        // Time - all null until determined
        this.time = defaults.time ?? null;
        this.date = defaults.date ?? null;
        this.dayOfWeek = defaults.dayOfWeek ?? null;
        this.season = defaults.season ?? null;
        this.timeOfDay = defaults.timeOfDay ?? null;

        // People
        this.peoplePresent = defaults.peoplePresent ?? [];

        // Conditions (0-100) - null until determined
        this.privacy = defaults.privacy ?? null;
        this.safety = defaults.safety ?? null;
        this.comfort = defaults.comfort ?? null;

        // Environment - null until determined
        this.weather = defaults.weather ?? null;
        this.temperature = defaults.temperature ?? null;
        this.lighting = defaults.lighting ?? null;
        this.noiseLevel = defaults.noiseLevel ?? null;

        // Special
        this.specialNotes = defaults.specialNotes ?? null;
    }

    /**
     * Update location
     * @param {string} location - Location name
     * @param {string} type - Location type
     * @param {string} description - Description
     */
    setLocation(location, type = 'Other', description = '') {
        this.location = location;
        this.locationType = type;
        this.description = description;
        this.updatePrivacyForLocationType();
    }

    /**
     * Auto-adjust privacy based on location type
     */
    updatePrivacyForLocationType() {
        const basePrivacy = {
            'Home': 85,
            'Public': 20,
            'Workplace': 40,
            'Outdoor': 30,
            'Vehicle': 50,
            'Other': 50
        };

        this.privacy = basePrivacy[this.locationType] ?? 50;
    }

    /**
     * Add person to scene
     * @param {string} name - Person's name
     */
    addPerson(name) {
        if (!this.peoplePresent.includes(name)) {
            this.peoplePresent.push(name);
            // More people = less privacy
            this.privacy = Math.max(5, this.privacy - 10);
        }
    }

    /**
     * Remove person from scene
     * @param {string} name - Person's name
     */
    removePerson(name) {
        const index = this.peoplePresent.indexOf(name);
        if (index > -1) {
            this.peoplePresent.splice(index, 1);
            // Less people = more privacy
            this.privacy = Math.min(100, this.privacy + 10);
        }
    }

    /**
     * Update time
     * @param {string} time - Time string (e.g., "7:30 PM")
     */
    setTime(time) {
        this.time = time;
        this.updateTimeOfDay();
    }

    /**
     * Update time of day category based on time
     */
    updateTimeOfDay() {
        // Parse hour from time string
        const match = this.time.match(/(\d+):(\d+)\s*(AM|PM)?/i);
        if (!match) return;

        let hour = parseInt(match[1]);
        const isPM = match[3]?.toUpperCase() === 'PM';

        if (isPM && hour !== 12) hour += 12;
        if (!isPM && hour === 12) hour = 0;

        if (hour >= 5 && hour < 8) this.timeOfDay = 'Early Morning';
        else if (hour >= 8 && hour < 11) this.timeOfDay = 'Morning';
        else if (hour >= 11 && hour < 14) this.timeOfDay = 'Midday';
        else if (hour >= 14 && hour < 17) this.timeOfDay = 'Afternoon';
        else if (hour >= 17 && hour < 20) this.timeOfDay = 'Evening';
        else if (hour >= 20 || hour < 0) this.timeOfDay = 'Night';
        else this.timeOfDay = 'Late Night';
    }

    /**
     * Get context summary for prompts
     * @returns {string}
     */
    getSummary() {
        let summary = `Location: ${this.location} (${this.locationType})\n`;
        summary += `Time: ${this.time}, ${this.dayOfWeek}, ${this.season}\n`;
        summary += `Privacy: ${this.privacy}/100, Safety: ${this.safety}/100\n`;
        summary += `People present: ${this.peoplePresent.join(', ') || 'None'}\n`;
        summary += `Environment: ${this.weather}, ${this.temperature}, ${this.lighting}, ${this.noiseLevel}`;

        if (this.specialNotes) {
            summary += `\nNotes: ${this.specialNotes}`;
        }

        return summary;
    }

    /**
     * Convert to plain object
     * @returns {Object}
     */
    toObject() {
        return {
            location: this.location,
            locationType: this.locationType,
            description: this.description,
            time: this.time,
            date: this.date,
            dayOfWeek: this.dayOfWeek,
            season: this.season,
            timeOfDay: this.timeOfDay,
            peoplePresent: [...this.peoplePresent],
            privacy: this.privacy,
            safety: this.safety,
            comfort: this.comfort,
            weather: this.weather,
            temperature: this.temperature,
            lighting: this.lighting,
            noiseLevel: this.noiseLevel,
            specialNotes: this.specialNotes
        };
    }
}

/**
 * Character Belief
 * Represents a core belief that can trigger identity protection
 */
export class Belief {
    constructor(name, strength = 50, description = '') {
        this.name = name;
        this.strength = Math.max(0, Math.min(100, strength));
        this.description = description;
        this.isProtected = strength >= 85; // Level 2 identity protection threshold
    }

    /**
     * Update belief strength
     * @param {number} delta - Change amount
     */
    updateStrength(delta) {
        this.strength = Math.max(0, Math.min(100, this.strength + delta));
        this.isProtected = this.strength >= 85;
    }
}

/**
 * Complete Character State
 * Master container for all character data
 */
export class CharacterState {
    /**
     * @param {string} characterName - Name of the character
     * @param {Object} defaults - Default values for all systems
     */
    constructor(characterName, defaults = {}) {
        this.version = '2.0.0';
        this.characterName = characterName;

        // Core systems
        this.stats = new UniversalStats(defaults.stats);
        this.customStats = defaults.customStats ?? {};
        this.relationships = {};
        this.hair = new HairGrowth(defaults.hair);
        this.outfit = new Outfit(defaults.outfit);
        this.biology = new BiologySystem(defaults.biology);
        this.scene = new SceneContext(defaults.scene);

        // Beliefs for identity protection
        this.beliefs = defaults.beliefs?.map(b => new Belief(b.name, b.strength, b.description)) ?? [];

        // Metadata
        this.lastUpdated = new Date().toISOString();
        this.createdAt = defaults.createdAt ?? new Date().toISOString();
    }

    /**
     * Get or create relationship with NPC
     * @param {string} npcName - NPC name
     * @returns {RelationshipStats}
     */
    getRelationship(npcName) {
        if (!this.relationships[npcName]) {
            this.relationships[npcName] = new RelationshipStats(npcName);
        }
        return this.relationships[npcName];
    }

    /**
     * Set custom stat
     * @param {string} statName - Stat name
     * @param {number} value - Value
     * @param {string} description - Optional description
     */
    setCustomStat(statName, value, description = '') {
        this.customStats[statName] = {
            value: Math.max(0, Math.min(100, value)),
            description
        };
    }

    /**
     * Add a belief
     * @param {string} name - Belief name
     * @param {number} strength - Belief strength
     * @param {string} description - Description
     */
    addBelief(name, strength, description = '') {
        // Check if belief already exists
        const existing = this.beliefs.find(b => b.name === name);
        if (existing) {
            existing.strength = strength;
            existing.description = description;
            existing.isProtected = strength >= 85;
        } else {
            this.beliefs.push(new Belief(name, strength, description));
        }
    }

    /**
     * Get protected beliefs (Level 2 identity)
     * @returns {Array<Belief>}
     */
    getProtectedBeliefs() {
        return this.beliefs.filter(b => b.isProtected);
    }

    /**
     * Convert to plain object for storage
     * @returns {Object}
     */
    toObject() {
        const relationships = {};
        for (const name in this.relationships) {
            relationships[name] = this.relationships[name].toObject();
        }

        return {
            version: this.version,
            characterName: this.characterName,
            stats: this.stats.toObject(),
            customStats: { ...this.customStats },
            relationships,
            hair: this.hair.toObject(),
            outfit: this.outfit.toObject(),
            biology: this.biology.toObject(),
            scene: this.scene.toObject(),
            beliefs: this.beliefs.map(b => ({
                name: b.name,
                strength: b.strength,
                description: b.description,
                isProtected: b.isProtected
            })),
            lastUpdated: this.lastUpdated,
            createdAt: this.createdAt
        };
    }

    /**
     * Create from stored object
     * @param {Object} data - Stored data
     * @returns {CharacterState}
     */
    static fromObject(data) {
        const state = new CharacterState(data.characterName, data);

        // Restore relationships
        if (data.relationships) {
            for (const name in data.relationships) {
                const relData = data.relationships[name];
                state.relationships[name] = new RelationshipStats(name, {
                    ...relData.core,
                    ...relData.emotional,
                    ...relData.social,
                    ...relData.attraction,
                    ...relData.metadata
                });
            }
        }

        state.lastUpdated = data.lastUpdated;
        state.createdAt = data.createdAt;

        return state;
    }
}
