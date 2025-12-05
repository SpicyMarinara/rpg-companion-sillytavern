/**
 * Character State Management Module
 * Tracks comprehensive character states based on Katherine RPG system
 */

/**
 * Complete character state structure
 * This represents the {{char}}'s current state across all systems
 */
export let characterState = {
    // Basic info
    characterName: null,

    // PRIMARY TRAITS (The DNA Layer) - Permanent personality traits (0-100 scale)
    primaryTraits: {
        // Core Disposition
        dominance: 50,              // 0=Pure submissive, 50=Switch, 100=Pure dominant
        introversion: 50,           // 0=Extreme introvert, 100=Extreme extrovert
        openness: 50,               // How curious and adaptable
        emotionalStability: 50,     // 0=Volatile, 100=Stable
        conscientiousness: 50,      // How organized and reliable
        agreeableness: 50,          // How cooperative vs competitive
        neuroticism: 50,            // Baseline anxiety level
        riskTaking: 50,             // 0=Cautious, 100=Reckless

        // Sexual Personality
        perversion: 50,             // Comfort with taboo sexuality
        exhibitionism: 50,          // Desire to be seen/watched
        voyeurism: 50,              // Desire to watch others
        sadism: 50,                 // Pleasure from giving pain
        masochism: 50,              // Pleasure from receiving pain
        sexualAggression: 50,       // Intensity in sex
        romanticOrientation: 50,    // Need for emotional connection with sex
        loyalty: 50,                // Monogamous vs polyamorous tendency
        sexualCreativity: 50,       // Imagination in sexual scenarios
        modesty: 50,                // 0=Shameless, 100=Modest
        fertilityInstinct: 50,      // Biological drive toward reproduction
        sexualInitiative: 50,       // How often initiates vs waits

        // Moral Core
        honesty: 50,                // 0=Pathological liar, 100=Brutally honest
        empathy: 50,                // Ability to feel others' emotions
        selfishness: 50,            // 0=Pure altruism, 100=Pure selfishness
        kindness: 50,               // 0=Cruel, 100=Kind
        justice: 50,                // 0=Always merciful, 100=Strict justice
        moralLoyalty: 50,           // Devotion to person/group
        integrity: 50,              // 0=Pragmatic, 100=Principled
        corruption: 50,             // Moral degradation level
        shameSensitivity: 50,       // How much shame affects them
        authorityRespect: 50,       // Deference to hierarchy
        vengefulness: 50,           // Holds grudges and seeks revenge
        materialismSpiritualism: 50, // 0=Pure materialism, 100=Pure spiritualism

        // Intellectual Traits
        intelligence: 50,           // General cognitive ability
        wisdom: 50,                 // Practical judgment
        creativity: 50,             // Original thinking
        logicIntuition: 50,         // 0=Pure intuition, 100=Pure logic
        analyticalThinking: 50,     // Breaking problems into components
        memory: 50,                 // Recall ability
        perception: 50,             // Noticing details
        curiosity: 50               // Drive to learn and explore
    },

    // SECONDARY STATES (The Weather Layer) - Temporary emotional states (0-100 intensity)
    secondaryStates: {
        // Core Emotions
        happy: 50,
        sad: 0,
        angry: 0,
        anxious: 0,
        stressed: 0,
        scared: 0,
        disgusted: 0,
        surprised: 0,
        ashamed: 0,
        guilty: 0,
        proud: 0,
        jealous: 0,

        // Arousal & Sexual States
        horny: 0,
        sexuallyFrustrated: 0,
        arousedNonSexual: 0,
        cravingTouch: 0,
        sensuallyStimulated: 0,
        seductive: 0,
        submissiveSexual: 0,
        dominantSexual: 0,

        // Social States
        seekingValidation: 0,
        lonely: 0,
        needy: 0,
        confident: 50,
        insecure: 0,
        defensive: 0,
        vulnerable: 0,
        aggressive: 0,
        playful: 0,
        curious: 50,
        competitive: 0,
        grateful: 0,

        // Energy & Altered States
        drunk: 0,
        high: 0,
        exhausted: 0,
        energized: 50,
        overstimulated: 0,
        dissociating: 0,
        manic: 0,
        melancholic: 0,
        euphoric: 0,
        numb: 0
    },

    // BELIEFS & WORLDVIEW (The Filter Layer)
    beliefs: [
        // Example format:
        // {
        //     belief: "Loyalty matters more than truth",
        //     strength: 85,
        //     stability: 75,
        //     category: "moral"
        // }
    ],

    // PHYSICAL STATS (The Body's Needs)
    physicalStats: {
        // Survival Needs
        bladder: 20,               // 0-100 urge to urinate
        hunger: 40,                // 0-100 need to eat
        thirst: 30,                // 0-100 need to drink
        energy: 70,                // 0-100 physical energy level
        sleepNeed: 20,             // 0-100 tiredness

        // Physical Condition
        health: 100,               // 0-100 overall wellbeing
        pain: 0,                   // 0-100 current pain level
        arousal: 0,                // 0-100 sexual arousal (detailed below)
        temperatureComfort: 50,    // 0=Freezing, 50=Perfect, 100=Overheating
        cleanliness: 80,           // 0-100 how clean they feel

        // Physical Attributes (rarely change)
        strength: 50,
        stamina: 50,
        agility: 50,
        coordination: 50,
        flexibility: 50
    },

    // SEXUAL BIOLOGY (Detailed Arousal System)
    sexualBiology: {
        arousalLevel: 0,           // 0-100 current arousal
        refractoryPeriod: false,   // Currently in refractory period?
        refractoryUntil: null,     // Timestamp when refractory ends
        ovulationDay: null,        // Day of cycle (for female chars)
        menstrualPhase: null,      // 'menstruation', 'follicular', 'ovulation', 'luteal'
        dayOfCycle: 1,             // 1-28 day of menstrual cycle
        lastOrgasm: null,          // Timestamp of last orgasm
        orgasmIntensity: 0,        // 0-100 intensity of last orgasm
        deprivationDays: 0         // Days since last sexual release
    },

    // OUTFIT/CLOTHING SYSTEM (Dynamic tracking)
    clothing: {
        underwear: {
            bra: { worn: true, type: 'Regular bra', description: '', status: 'Worn normally', coverage: 15 },
            panties: { worn: true, type: 'Regular panties', description: '', status: 'Worn normally', coverage: 10 }
        },
        upperBody: {
            shirt: { worn: true, type: 'Blouse', description: '', status: 'Worn properly', coverage: 30 }
        },
        lowerBody: {
            pants: { worn: true, type: 'Jeans', description: '', status: 'Worn properly', coverage: 30 }
        },
        outerwear: {
            jacket: { worn: false, type: '', description: '', status: '', coverage: 0 }
        },
        footwear: {
            shoes: { worn: true, type: 'Sneakers', description: '', status: 'On', coverage: 5 },
            socks: { worn: true, type: 'Regular socks', description: '', status: 'On', coverage: 2 }
        },
        accessories: [],
        totalCoverage: 92,         // Sum of all coverage percentages
        lastChange: null           // Timestamp of last clothing change
    },

    // PHYSICAL STATE (Sweat, Temperature, Cleanliness)
    physicalState: {
        bodyTemperature: 37.0,     // Celsius
        heartRate: 70,             // BPM
        breathingRate: 14,         // breaths per minute
        sweatLevel: 10,            // 0-100
        hairCondition: 'Clean, styled',
        makeupState: 'Fresh',
        skinCondition: 'Soft, smooth',
        marks: [],                 // Hickeys, bruises, scratches
        scent: 'Natural (clean)'
    },

    // RELATIONSHIP TRACKING (Per-NPC detailed stats)
    relationships: {
        // Example format:
        // "NPC_Name": {
        //     // Core Metrics
        //     trust: 50,
        //     love: 0,
        //     loyalty: null,         // null until unlocked
        //     attraction: 0,
        //     respect: 50,
        //     fear: 0,
        //
        //     // Social Dynamics
        //     closeness: 20,
        //     openness: 20,
        //     comfort: 50,
        //     dependency: 0,
        //
        //     // Attraction Breakdown
        //     physicalAttraction: 0,
        //     emotionalAttraction: 0,
        //     intellectualAttraction: 0,
        //
        //     // Sexual Dynamics
        //     flirtiness: 0,
        //     sexualCompatibility: 50,
        //     sexualSatisfaction: 50,
        //
        //     // Power Dynamics
        //     dominanceOverThem: 50,      // How dominant char is over them
        //     submissivenessToThem: 0,    // How submissive char is to them
        //     possessivenessToward: 0,
        //
        //     // Negative Feelings
        //     jealousyOf: 0,
        //     resentment: 0,
        //
        //     // Thoughts & Notes
        //     currentThoughts: '',         // What char is thinking about this person
        //     relationshipStatus: 'Acquaintance',
        //     lastInteraction: null
        // }
    },

    // CONTEXTUAL INFO (Extracted from scene)
    contextInfo: {
        location: '',
        timeOfDay: '',
        weather: '',
        presentCharacters: [],     // List of characters currently present
        recentEvents: '',
        currentActivity: ''
    },

    // INTERNAL THOUGHTS (Character's current thoughts)
    thoughts: {
        internalMonologue: '',     // What they're thinking right now
        desires: '',               // What they want in this moment
        fears: '',                 // What they're afraid of
        plans: ''                  // What they're planning to do
    }
};

/**
 * Initialize a new relationship entry for an NPC
 * @param {string} npcName - Name of the NPC
 * @returns {Object} Default relationship data
 */
export function initializeRelationship(npcName) {
    return {
        // Core Metrics
        trust: 50,
        love: 0,
        loyalty: null,
        attraction: 0,
        respect: 50,
        fear: 0,

        // Social Dynamics
        closeness: 20,
        openness: 20,
        comfort: 50,
        dependency: 0,

        // Attraction Breakdown
        physicalAttraction: 0,
        emotionalAttraction: 0,
        intellectualAttraction: 0,

        // Sexual Dynamics
        flirtiness: 0,
        sexualCompatibility: 50,
        sexualSatisfaction: 50,

        // Power Dynamics
        dominanceOverThem: 50,
        submissivenessToThem: 0,
        possessivenessToward: 0,

        // Negative Feelings
        jealousyOf: 0,
        resentment: 0,

        // Thoughts & Notes
        currentThoughts: '',
        relationshipStatus: 'Stranger',
        lastInteraction: new Date().toISOString()
    };
}

/**
 * Get or create relationship data for an NPC
 * @param {string} npcName - Name of the NPC
 * @returns {Object} Relationship data
 */
export function getRelationship(npcName) {
    if (!characterState.relationships[npcName]) {
        characterState.relationships[npcName] = initializeRelationship(npcName);
    }
    return characterState.relationships[npcName];
}

/**
 * Update relationship data for an NPC
 * @param {string} npcName - Name of the NPC
 * @param {Object} updates - Partial relationship data to update
 */
export function updateRelationship(npcName, updates) {
    const relationship = getRelationship(npcName);
    Object.assign(relationship, updates);
    relationship.lastInteraction = new Date().toISOString();
}

/**
 * Set the entire character state
 * @param {Object} newState - New character state object
 */
export function setCharacterState(newState) {
    characterState = newState;
}

/**
 * Update specific parts of character state
 * @param {Object} updates - Partial character state to update
 */
export function updateCharacterState(updates) {
    // Deep merge for nested objects
    if (updates.primaryTraits) {
        Object.assign(characterState.primaryTraits, updates.primaryTraits);
    }
    if (updates.secondaryStates) {
        Object.assign(characterState.secondaryStates, updates.secondaryStates);
    }
    if (updates.physicalStats) {
        Object.assign(characterState.physicalStats, updates.physicalStats);
    }
    if (updates.sexualBiology) {
        Object.assign(characterState.sexualBiology, updates.sexualBiology);
    }
    if (updates.clothing) {
        Object.assign(characterState.clothing, updates.clothing);
    }
    if (updates.physicalState) {
        Object.assign(characterState.physicalState, updates.physicalState);
    }
    if (updates.contextInfo) {
        Object.assign(characterState.contextInfo, updates.contextInfo);
    }
    if (updates.thoughts) {
        Object.assign(characterState.thoughts, updates.thoughts);
    }
    if (updates.beliefs !== undefined) {
        characterState.beliefs = updates.beliefs;
    }
    if (updates.relationships) {
        Object.assign(characterState.relationships, updates.relationships);
    }
    if (updates.characterName !== undefined) {
        characterState.characterName = updates.characterName;
    }
}

/**
 * Get current character state
 * @returns {Object} Current character state
 */
export function getCharacterState() {
    return characterState;
}

/**
 * Reset character state to defaults
 */
export function resetCharacterState() {
    characterState = {
        characterName: null,
        primaryTraits: {},
        secondaryStates: {},
        beliefs: [],
        physicalStats: {},
        sexualBiology: {},
        clothing: {},
        physicalState: {},
        relationships: {},
        contextInfo: {},
        thoughts: {}
    };
}

/**
 * Export character state as JSON
 * @returns {string} JSON string of character state
 */
export function exportCharacterState() {
    return JSON.stringify(characterState, null, 2);
}

/**
 * Import character state from JSON
 * @param {string} jsonData - JSON string of character state
 */
export function importCharacterState(jsonData) {
    try {
        const imported = JSON.parse(jsonData);
        characterState = imported;
        return true;
    } catch (error) {
        console.error('[Character State] Import failed:', error);
        return false;
    }
}
