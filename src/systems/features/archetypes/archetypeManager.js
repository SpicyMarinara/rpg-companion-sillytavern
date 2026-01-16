/**
 * Archetype Manager
 * Tracks character archetypes, evolution progress, and handles state transitions
 *
 * The evolution system tracks how a character's archetype develops based on
 * their interactions with the player. Positive interactions move toward
 * evolved states, negative interactions move toward shadow states.
 */

import {
    ARCHETYPES,
    SHADOW_ARCHETYPES,
    EVOLVED_ARCHETYPES,
    getArchetype,
    getShadowArchetype,
    getEvolvedArchetype,
    getCompatibility
} from './archetypeDefinitions.js';

// Evolution thresholds
const EVOLUTION_THRESHOLD = 100;
const DEVOLUTION_THRESHOLD = -100;

// Interaction impact values
const INTERACTION_IMPACTS = {
    // Positive interactions
    kindness: { base: 3, description: 'Showing kindness or compassion' },
    protection: { base: 4, description: 'Protecting or defending them' },
    trust: { base: 5, description: 'Showing trust and vulnerability' },
    appreciation: { base: 3, description: 'Expressing appreciation or gratitude' },
    challenge: { base: 2, description: 'Giving them a worthy challenge' },
    freedom: { base: 3, description: 'Giving them freedom and autonomy' },
    intimacy: { base: 4, description: 'Emotional or physical closeness' },
    respect: { base: 3, description: 'Showing respect for their abilities' },
    inclusion: { base: 4, description: 'Including them in activities' },
    playfulness: { base: 2, description: 'Engaging in play and fun' },
    learning: { base: 3, description: 'Learning together or teaching' },
    creation: { base: 3, description: 'Creating something together' },
    honesty: { base: 4, description: 'Being honest and truthful' },

    // Negative interactions
    cruelty: { base: -5, description: 'Being cruel or hurtful' },
    neglect: { base: -3, description: 'Ignoring or neglecting them' },
    betrayal: { base: -8, description: 'Betraying their trust' },
    mockery: { base: -4, description: 'Mocking or belittling them' },
    rejection: { base: -5, description: 'Rejecting them or their help' },
    abandonment: { base: -7, description: 'Abandoning them' },
    control: { base: -3, description: 'Being overly controlling' },
    deception: { base: -6, description: 'Lying or deceiving them' },
    exploitation: { base: -6, description: 'Exploiting their nature' },
    confinement: { base: -4, description: 'Trapping or confining them' },
    destruction: { base: -5, description: 'Destroying what they value' },
    silencing: { base: -4, description: 'Silencing or dismissing them' }
};

/**
 * ArchetypeManager Class
 * Manages the archetype state for a single character
 */
export class ArchetypeManager {
    /**
     * Create an ArchetypeManager instance
     * @param {string} characterId - Unique identifier for the character
     * @param {Object} [savedState] - Optional saved state to restore from
     */
    constructor(characterId, savedState = null) {
        this.characterId = characterId;
        this.archetype = null;
        this.archetypeKey = null;
        this.evolutionPoints = 0;
        this.state = 'base'; // 'base', 'evolved', 'shadow'
        this.interactionHistory = [];
        this.evolutionHistory = [];
        this.totalInteractions = 0;
        this.createdAt = Date.now();
        this.lastInteraction = null;

        // Restore from saved state if provided
        if (savedState) {
            this.restoreState(savedState);
        }
    }

    /**
     * Set the character's archetype
     * @param {string} archetypeKey - The archetype ID (e.g., 'HERO', 'SAGE')
     * @returns {Object} The archetype object
     */
    setArchetype(archetypeKey) {
        const archetype = getArchetype(archetypeKey);
        if (!archetype) {
            console.error(`[Archetype Manager] Invalid archetype key: ${archetypeKey}`);
            return null;
        }

        this.archetype = archetype;
        this.archetypeKey = archetypeKey;
        this.state = 'base';
        this.evolutionPoints = 0;

        // Record in evolution history
        this.evolutionHistory.push({
            type: 'set',
            archetype: archetypeKey,
            timestamp: Date.now()
        });

        return archetype;
    }

    /**
     * Record an interaction and adjust evolution points
     * @param {string} interactionType - Type of interaction (e.g., 'kindness', 'cruelty')
     * @param {number} [modifier=1] - Multiplier for the interaction impact
     * @param {string} [context=''] - Optional context description
     * @returns {Object} Result including any evolution changes
     */
    recordInteraction(interactionType, modifier = 1, context = '') {
        if (!this.archetype) {
            console.warn('[Archetype Manager] No archetype set for character');
            return { success: false, error: 'No archetype set' };
        }

        // Get base impact value
        const impactData = INTERACTION_IMPACTS[interactionType];
        if (!impactData) {
            console.warn(`[Archetype Manager] Unknown interaction type: ${interactionType}`);
            return { success: false, error: 'Unknown interaction type' };
        }

        // Calculate impact with archetype-specific bonuses
        let impact = impactData.base * modifier;

        // Apply archetype-specific interaction bonuses
        if (this.archetype.interactionBonuses && this.archetype.interactionBonuses[interactionType]) {
            impact += this.archetype.interactionBonuses[interactionType];
        }

        // Record the interaction
        const interaction = {
            type: interactionType,
            baseValue: impactData.base,
            modifier: modifier,
            finalValue: impact,
            context: context,
            timestamp: Date.now(),
            evolutionPointsBefore: this.evolutionPoints
        };

        this.interactionHistory.push(interaction);
        this.totalInteractions++;
        this.lastInteraction = Date.now();

        // Apply evolution points
        const previousPoints = this.evolutionPoints;
        this.evolutionPoints += impact;

        // Clamp to reasonable bounds (allows some overshoot for dramatic effect)
        this.evolutionPoints = Math.max(-150, Math.min(150, this.evolutionPoints));

        // Check for evolution/devolution
        const evolutionResult = this._checkEvolution();

        return {
            success: true,
            interaction: interaction,
            evolutionPointsDelta: this.evolutionPoints - previousPoints,
            currentPoints: this.evolutionPoints,
            evolutionProgress: this.getEvolutionProgress(),
            evolutionResult: evolutionResult
        };
    }

    /**
     * Check if the character should evolve or devolve
     * @returns {Object|null} Evolution result or null if no change
     * @private
     */
    _checkEvolution() {
        // Only check if in base state
        if (this.state !== 'base') {
            return null;
        }

        // Check for positive evolution
        if (this.evolutionPoints >= EVOLUTION_THRESHOLD) {
            return this._evolve();
        }

        // Check for negative evolution (shadow)
        if (this.evolutionPoints <= DEVOLUTION_THRESHOLD) {
            return this._devolve();
        }

        return null;
    }

    /**
     * Evolve the character to their positive form
     * @returns {Object} Evolution result
     * @private
     */
    _evolve() {
        const evolvedKey = this.archetype.evolution.positive;
        const evolved = getEvolvedArchetype(evolvedKey);

        if (!evolved) {
            console.error(`[Archetype Manager] Invalid evolved archetype: ${evolvedKey}`);
            return null;
        }

        const previousState = {
            archetype: this.archetypeKey,
            state: this.state,
            points: this.evolutionPoints
        };

        this.state = 'evolved';

        // Record evolution
        this.evolutionHistory.push({
            type: 'evolution',
            from: this.archetypeKey,
            to: evolvedKey,
            timestamp: Date.now(),
            points: this.evolutionPoints
        });

        return {
            type: 'evolution',
            previousState: previousState,
            newState: {
                name: evolved.name,
                id: evolvedKey,
                icon: evolved.icon,
                description: evolved.description,
                traits: evolved.traits,
                behavior: evolved.behavior
            },
            message: `${this.archetype.name} has evolved into ${evolved.name}!`
        };
    }

    /**
     * Devolve the character to their shadow form
     * @returns {Object} Devolution result
     * @private
     */
    _devolve() {
        const shadowKey = this.archetype.evolution.negative;
        const shadow = getShadowArchetype(shadowKey);

        if (!shadow) {
            console.error(`[Archetype Manager] Invalid shadow archetype: ${shadowKey}`);
            return null;
        }

        const previousState = {
            archetype: this.archetypeKey,
            state: this.state,
            points: this.evolutionPoints
        };

        this.state = 'shadow';

        // Record devolution
        this.evolutionHistory.push({
            type: 'devolution',
            from: this.archetypeKey,
            to: shadowKey,
            timestamp: Date.now(),
            points: this.evolutionPoints
        });

        return {
            type: 'devolution',
            previousState: previousState,
            newState: {
                name: shadow.name,
                id: shadowKey,
                icon: shadow.icon,
                description: shadow.description,
                traits: shadow.traits,
                behavior: shadow.behavior,
                redemptionPath: shadow.redemptionPath
            },
            message: `${this.archetype.name} has fallen into shadow, becoming ${shadow.name}...`
        };
    }

    /**
     * Attempt to redeem a shadow archetype back to base state
     * Requires specific positive interactions and significant effort
     * @returns {Object} Redemption result
     */
    attemptRedemption() {
        if (this.state !== 'shadow') {
            return {
                success: false,
                error: 'Character is not in shadow state'
            };
        }

        // Redemption requires evolution points to be back above a threshold
        const redemptionThreshold = -30;

        if (this.evolutionPoints < redemptionThreshold) {
            return {
                success: false,
                error: 'Not enough positive interactions for redemption',
                currentPoints: this.evolutionPoints,
                requiredPoints: redemptionThreshold
            };
        }

        // Successful redemption
        const shadowKey = this.archetype.evolution.negative;
        const shadow = getShadowArchetype(shadowKey);

        this.state = 'base';
        this.evolutionPoints = 0; // Reset points after redemption

        this.evolutionHistory.push({
            type: 'redemption',
            from: shadowKey,
            to: this.archetypeKey,
            timestamp: Date.now(),
            points: this.evolutionPoints
        });

        return {
            success: true,
            message: `Through patience and care, ${shadow.name} has found redemption, returning to ${this.archetype.name}.`,
            newState: 'base'
        };
    }

    /**
     * Get the current evolution status
     * @returns {Object} Evolution status information
     */
    getEvolutionStatus() {
        if (!this.archetype) {
            return null;
        }

        const evolved = getEvolvedArchetype(this.archetype.evolution.positive);
        const shadow = getShadowArchetype(this.archetype.evolution.negative);

        return {
            archetype: this.archetypeKey,
            archetypeName: this.archetype.name,
            state: this.state,
            points: this.evolutionPoints,
            progress: this.getEvolutionProgress(),
            nextEvolution: evolved ? {
                id: this.archetype.evolution.positive,
                name: evolved.name,
                icon: evolved.icon,
                condition: this.archetype.evolutionConditions.positive
            } : null,
            nextDevolution: shadow ? {
                id: this.archetype.evolution.negative,
                name: shadow.name,
                icon: shadow.icon,
                condition: this.archetype.evolutionConditions.negative
            } : null,
            totalInteractions: this.totalInteractions,
            lastInteraction: this.lastInteraction
        };
    }

    /**
     * Get evolution progress as a normalized value
     * @returns {number} Progress from -1 (full shadow) to 1 (full evolution)
     */
    getEvolutionProgress() {
        if (this.evolutionPoints >= 0) {
            return Math.min(1, this.evolutionPoints / EVOLUTION_THRESHOLD);
        } else {
            return Math.max(-1, this.evolutionPoints / Math.abs(DEVOLUTION_THRESHOLD));
        }
    }

    /**
     * Get prompt modifiers based on current archetype and state
     * @returns {Array<string>} Array of prompt modifier strings
     */
    getPromptModifiers() {
        if (!this.archetype) {
            return [];
        }

        const modifiers = [...(this.archetype.promptModifiers || [])];

        // Add state-specific modifiers
        if (this.state === 'evolved') {
            const evolved = getEvolvedArchetype(this.archetype.evolution.positive);
            if (evolved) {
                modifiers.push(`Has evolved into ${evolved.name}: ${evolved.behavior}`);
                modifiers.push(`Shows traits of: ${evolved.traits.join(', ')}`);
            }
        } else if (this.state === 'shadow') {
            const shadow = getShadowArchetype(this.archetype.evolution.negative);
            if (shadow) {
                modifiers.push(`Has fallen into shadow as ${shadow.name}: ${shadow.behavior}`);
                modifiers.push(`Shows dark traits of: ${shadow.traits.join(', ')}`);
                modifiers.push(`Path to redemption: ${shadow.redemptionPath}`);
            }
        }

        // Add evolution progress hints
        const progress = this.getEvolutionProgress();
        if (this.state === 'base') {
            if (progress > 0.5) {
                modifiers.push('Shows signs of growth and positive development');
            } else if (progress < -0.5) {
                modifiers.push('Shows signs of distress and negative patterns');
            }
        }

        return modifiers;
    }

    /**
     * Get dialogue pattern for a specific situation
     * @param {string} situation - The dialogue situation (greeting, encouragement, fear, affection)
     * @returns {string|null} A dialogue line or null if not available
     */
    getDialogue(situation) {
        if (!this.archetype || !this.archetype.dialoguePatterns) {
            return null;
        }

        const patterns = this.archetype.dialoguePatterns[situation];
        if (!patterns || patterns.length === 0) {
            return null;
        }

        return patterns[Math.floor(Math.random() * patterns.length)];
    }

    /**
     * Calculate compatibility with another character's archetype
     * @param {string} otherArchetypeKey - The other character's archetype ID
     * @returns {Object} Compatibility information
     */
    getCompatibilityWith(otherArchetypeKey) {
        if (!this.archetypeKey) {
            return { score: 0, description: 'No archetype set' };
        }

        const score = getCompatibility(this.archetypeKey, otherArchetypeKey);

        const descriptions = {
            '-2': 'Natural conflict - these archetypes fundamentally clash',
            '-1': 'Tension - these archetypes have friction but can coexist',
            '0': 'Neutral - no particular affinity or conflict',
            '1': 'Harmony - these archetypes complement each other',
            '2': 'Synergy - these archetypes deeply resonate together'
        };

        return {
            score: score,
            description: descriptions[score.toString()] || descriptions['0'],
            myArchetype: this.archetypeKey,
            theirArchetype: otherArchetypeKey
        };
    }

    /**
     * Get a summary of recent interactions
     * @param {number} [count=10] - Number of recent interactions to return
     * @returns {Array<Object>} Recent interaction objects
     */
    getRecentInteractions(count = 10) {
        return this.interactionHistory.slice(-count);
    }

    /**
     * Get full interaction statistics
     * @returns {Object} Interaction statistics
     */
    getInteractionStats() {
        const stats = {
            total: this.totalInteractions,
            positive: 0,
            negative: 0,
            byType: {}
        };

        for (const interaction of this.interactionHistory) {
            if (interaction.finalValue > 0) {
                stats.positive++;
            } else if (interaction.finalValue < 0) {
                stats.negative++;
            }

            if (!stats.byType[interaction.type]) {
                stats.byType[interaction.type] = { count: 0, totalImpact: 0 };
            }
            stats.byType[interaction.type].count++;
            stats.byType[interaction.type].totalImpact += interaction.finalValue;
        }

        return stats;
    }

    /**
     * Export the current state for saving
     * @returns {Object} Serializable state object
     */
    exportState() {
        return {
            characterId: this.characterId,
            archetypeKey: this.archetypeKey,
            evolutionPoints: this.evolutionPoints,
            state: this.state,
            interactionHistory: this.interactionHistory,
            evolutionHistory: this.evolutionHistory,
            totalInteractions: this.totalInteractions,
            createdAt: this.createdAt,
            lastInteraction: this.lastInteraction,
            version: 1
        };
    }

    /**
     * Restore state from a saved object
     * @param {Object} savedState - Previously exported state
     */
    restoreState(savedState) {
        if (!savedState) return;

        this.characterId = savedState.characterId || this.characterId;
        this.evolutionPoints = savedState.evolutionPoints || 0;
        this.state = savedState.state || 'base';
        this.interactionHistory = savedState.interactionHistory || [];
        this.evolutionHistory = savedState.evolutionHistory || [];
        this.totalInteractions = savedState.totalInteractions || 0;
        this.createdAt = savedState.createdAt || Date.now();
        this.lastInteraction = savedState.lastInteraction || null;

        // Restore archetype
        if (savedState.archetypeKey) {
            this.setArchetype(savedState.archetypeKey);
            // Restore state after setting archetype (setArchetype resets it)
            this.state = savedState.state || 'base';
            this.evolutionPoints = savedState.evolutionPoints || 0;
        }
    }
}

/**
 * Global registry for managing multiple character archetypes
 */
class ArchetypeRegistry {
    constructor() {
        this.managers = new Map();
    }

    /**
     * Get or create a manager for a character
     * @param {string} characterId - Character identifier
     * @returns {ArchetypeManager} The archetype manager
     */
    getManager(characterId) {
        if (!this.managers.has(characterId)) {
            this.managers.set(characterId, new ArchetypeManager(characterId));
        }
        return this.managers.get(characterId);
    }

    /**
     * Load managers from saved state
     * @param {Object} savedData - Saved registry data
     */
    loadFromSaved(savedData) {
        if (!savedData || !savedData.characters) return;

        for (const [characterId, state] of Object.entries(savedData.characters)) {
            const manager = new ArchetypeManager(characterId, state);
            this.managers.set(characterId, manager);
        }
    }

    /**
     * Export all managers for saving
     * @returns {Object} Serializable registry data
     */
    exportAll() {
        const characters = {};
        for (const [characterId, manager] of this.managers) {
            characters[characterId] = manager.exportState();
        }
        return { characters, version: 1 };
    }

    /**
     * Remove a manager
     * @param {string} characterId - Character identifier
     */
    removeManager(characterId) {
        this.managers.delete(characterId);
    }

    /**
     * Clear all managers
     */
    clear() {
        this.managers.clear();
    }

    /**
     * Get all managed character IDs
     * @returns {Array<string>} Array of character IDs
     */
    getAllCharacterIds() {
        return Array.from(this.managers.keys());
    }
}

// Singleton instance
export const archetypeRegistry = new ArchetypeRegistry();

// Export interaction types for external use
export { INTERACTION_IMPACTS };
