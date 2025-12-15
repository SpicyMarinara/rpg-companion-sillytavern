/**
 * RPG Companion Enhanced - Character State Manager
 * Handles loading, saving, and updating character state
 *
 * Based on KATHERINE_RPG_MASTER_SPECIFICATION.txt
 * Version: 2.0.0
 */

import {
    CharacterState,
    UniversalStats,
    RelationshipStats,
    HairGrowth,
    Outfit,
    BiologySystem,
    SceneContext
} from './dataStructures.js';

/**
 * CharacterStateManager - Manages all character state operations
 */
export class CharacterStateManager {
    /**
     * @param {Object} options - Configuration options
     * @param {Function} options.getContext - Function to get SillyTavern context
     * @param {Function} options.saveMetadata - Function to save chat metadata
     */
    constructor(options = {}) {
        this.getContext = options.getContext || (() => window.SillyTavern?.getContext?.() || {});
        this.saveMetadata = options.saveMetadata || (async () => {});

        this.currentState = null;
        this.chatMetadata = null;
        this.extensionKey = 'rpg-companion-enhanced';
        this.version = '2.0.0';

        // Event listeners
        this.listeners = {
            stateChanged: [],
            statUpdated: [],
            relationshipUpdated: [],
            sceneChanged: []
        };
    }

    /**
     * Initialize state for current character/chat
     * @returns {Promise<CharacterState>}
     */
    async initialize() {
        try {
            const context = this.getContext();

            if (!context) {
                console.warn('[RPG Enhanced] No SillyTavern context available');
                return null;
            }

            this.chatMetadata = context.chatMetadata || {};

            // Get character name
            const characterName = context.name2 || 'Unknown Character';

            // Try to load existing state
            const existingState = this.chatMetadata[this.extensionKey];

            if (existingState && existingState.version === this.version) {
                // Load existing state
                this.currentState = CharacterState.fromObject(existingState);
                console.log(`[RPG Enhanced] Loaded existing state for ${characterName}`);
            } else if (existingState) {
                // Migrate from older version
                this.currentState = this.migrateState(existingState, characterName);
                console.log(`[RPG Enhanced] Migrated state from v${existingState.version} to v${this.version}`);
                await this.saveState();
            } else {
                // Create new state
                this.currentState = new CharacterState(characterName);
                console.log(`[RPG Enhanced] Created new state for ${characterName}`);
                await this.saveState();
            }

            // Don't auto-create relationships - they should come from context/LLM analysis
            // const userName = context.name1 || 'User';
            // this.ensureUserRelationship(userName);

            this.emit('stateChanged', this.currentState);

            return this.currentState;
        } catch (error) {
            console.error('[RPG Enhanced] Failed to initialize state:', error);
            return null;
        }
    }

    /**
     * Migrate state from older version
     * @param {Object} oldState - Old state data
     * @param {string} characterName - Character name
     * @returns {CharacterState}
     */
    migrateState(oldState, characterName) {
        // For now, just create a new state and try to preserve what we can
        const newState = new CharacterState(characterName);

        // Attempt to migrate stats
        if (oldState.stats) {
            for (const stat in oldState.stats) {
                if (newState.stats[stat] !== undefined) {
                    newState.stats[stat] = oldState.stats[stat];
                }
            }
        }

        // Attempt to migrate relationships
        if (oldState.relationships) {
            for (const name in oldState.relationships) {
                newState.relationships[name] = new RelationshipStats(name, oldState.relationships[name]);
            }
        }

        return newState;
    }

    /**
     * Ensure the user has a relationship entry
     * @param {string} userName - User's name
     */
    ensureUserRelationship(userName) {
        if (!this.currentState) return;

        const rel = this.currentState.getRelationship(userName);

        // If this is a new relationship, give it some starting values
        if (rel.metadata.relationshipType === 'Stranger') {
            // Default to more intimate relationship with user
            rel.metadata.relationshipType = 'Partner';
            rel.core.trust = 80;
            rel.core.love = 75;
            rel.core.loyalty = 80;
            rel.emotional.comfort = 85;
            rel.emotional.openness = 80;
            rel.metadata.importance = 'Critical';
            rel.metadata.isActive = true;
        }
    }

    /**
     * Save current state to chat metadata
     * @returns {Promise<boolean>}
     */
    async saveState() {
        if (!this.currentState) {
            console.warn('[RPG Enhanced] No state to save');
            return false;
        }

        try {
            this.currentState.lastUpdated = new Date().toISOString();

            const context = this.getContext();
            if (!context || !context.chatMetadata) {
                console.warn('[RPG Enhanced] No chat metadata available');
                return false;
            }

            context.chatMetadata[this.extensionKey] = this.currentState.toObject();

            await this.saveMetadata();

            return true;
        } catch (error) {
            console.error('[RPG Enhanced] Failed to save state:', error);
            return false;
        }
    }

    /**
     * Get current state
     * @returns {CharacterState|null}
     */
    getState() {
        return this.currentState;
    }

    /**
     * Get a specific stat value
     * @param {string} statName - Stat name
     * @returns {number|null}
     */
    getStat(statName) {
        if (!this.currentState) return null;
        return this.currentState.stats.getStat(statName);
    }

    /**
     * Set a specific stat value
     * @param {string} statName - Stat name
     * @param {number} value - New value
     * @returns {boolean}
     */
    setStat(statName, value) {
        if (!this.currentState) return false;

        const oldValue = this.currentState.stats.getStat(statName);
        const result = this.currentState.stats.setStat(statName, value);

        if (result) {
            this.emit('statUpdated', {
                stat: statName,
                oldValue,
                newValue: this.currentState.stats.getStat(statName)
            });
            this.saveState();
        }

        return result;
    }

    /**
     * Change a stat by delta
     * @param {string} statName - Stat name
     * @param {number} delta - Change amount
     * @param {number} maxChange - Maximum change allowed
     * @returns {boolean}
     */
    changeStat(statName, delta, maxChange = 25) {
        if (!this.currentState) return false;

        const oldValue = this.currentState.stats.getStat(statName);
        const result = this.currentState.stats.changeStat(statName, delta, maxChange);

        if (result) {
            this.emit('statUpdated', {
                stat: statName,
                oldValue,
                newValue: this.currentState.stats.getStat(statName),
                delta
            });
            this.saveState();
        }

        return result;
    }

    /**
     * Apply multiple stat changes at once
     * @param {Object} changes - Object mapping stat names to {to: value} or {delta: value}
     * @returns {Promise<boolean>}
     */
    async applyStatChanges(changes) {
        if (!this.currentState) return false;

        const statChanges = [];

        for (const statName in changes) {
            const change = changes[statName];
            const oldValue = this.currentState.stats.getStat(statName);

            if (change.to !== undefined) {
                this.currentState.stats.setStat(statName, change.to);
            } else if (change.delta !== undefined) {
                this.currentState.stats.changeStat(statName, change.delta, change.maxChange || 25);
            }

            statChanges.push({
                stat: statName,
                oldValue,
                newValue: this.currentState.stats.getStat(statName)
            });
        }

        await this.saveState();

        for (const change of statChanges) {
            this.emit('statUpdated', change);
        }

        return true;
    }

    /**
     * Get relationship with an NPC
     * @param {string} npcName - NPC name
     * @returns {RelationshipStats|null}
     */
    getRelationship(npcName) {
        if (!this.currentState) return null;
        return this.currentState.getRelationship(npcName);
    }

    /**
     * Update a relationship stat
     * @param {string} npcName - NPC name
     * @param {string} category - Stat category
     * @param {string} stat - Stat name
     * @param {number} delta - Change amount
     * @returns {boolean}
     */
    updateRelationship(npcName, category, stat, delta) {
        if (!this.currentState) return false;

        const rel = this.currentState.getRelationship(npcName);
        const result = rel.updateStat(category, stat, delta);

        if (result) {
            this.emit('relationshipUpdated', {
                npcName,
                category,
                stat,
                delta
            });
            this.saveState();
        }

        return result;
    }

    /**
     * Set an NPC as active (in scene)
     * @param {string} npcName - NPC name
     * @param {boolean} active - Active state
     */
    setNPCActive(npcName, active = true) {
        if (!this.currentState) return;

        const rel = this.currentState.getRelationship(npcName);
        rel.metadata.isActive = active;

        if (active) {
            rel.metadata.lastSeen = 'Just now';
            this.currentState.scene.addPerson(npcName);
        } else {
            this.currentState.scene.removePerson(npcName);
        }

        this.saveState();
    }

    /**
     * Get all active relationships (NPCs in scene)
     * @returns {Object}
     */
    getActiveRelationships() {
        if (!this.currentState) return {};

        const active = {};
        for (const npcName in this.currentState.relationships) {
            const rel = this.currentState.relationships[npcName];
            if (rel.metadata.isActive) {
                active[npcName] = rel;
            }
        }

        return active;
    }

    /**
     * Advance time (triggers auto-stat changes)
     * @param {number} hours - Hours to advance
     * @returns {Promise<Object>} Changes that occurred
     */
    async advanceTime(hours) {
        if (!this.currentState) return {};

        const changes = {};
        const stats = this.currentState.stats;

        // Physical stat auto-changes
        const hungerBefore = stats.hunger;
        stats.changeStat('hunger', hours * 5, 100);
        changes.hunger = { from: hungerBefore, to: stats.hunger };

        const bladderBefore = stats.bladder;
        stats.changeStat('bladder', hours * 8, 100);
        changes.bladder = { from: bladderBefore, to: stats.bladder };

        const bowelBefore = stats.bowel;
        stats.changeStat('bowel', hours * 3, 100);
        changes.bowel = { from: bowelBefore, to: stats.bowel };

        const cleanlinessBefore = stats.cleanliness;
        stats.changeStat('cleanliness', -(hours * 2), 100);
        changes.cleanliness = { from: cleanlinessBefore, to: stats.cleanliness };

        // Energy drain
        const energyBefore = stats.energy;
        stats.changeStat('energy', -(hours * 4), 100);
        changes.energy = { from: energyBefore, to: stats.energy };

        // Day-based changes
        const days = Math.floor(hours / 24);
        if (days > 0) {
            // Hair growth
            this.currentState.hair.advanceDays(days);
            changes.hairGrowth = days;

            // Biology cycle
            this.currentState.biology.advanceDays(days);
            changes.biologyAdvanced = days;

            // Shame decay
            if (stats.shame > 0) {
                const shameBefore = stats.shame;
                stats.changeStat('shame', -(days * 2), 100);
                changes.shame = { from: shameBefore, to: stats.shame };
            }
        }

        await this.saveState();

        this.emit('stateChanged', this.currentState);

        return changes;
    }

    /**
     * Update scene context
     * @param {Object} sceneData - Scene data updates
     * @returns {Promise<void>}
     */
    async updateScene(sceneData) {
        if (!this.currentState) return;

        const scene = this.currentState.scene;

        if (sceneData.location !== undefined) {
            scene.setLocation(
                sceneData.location,
                sceneData.locationType || 'Other',
                sceneData.description || ''
            );
        }

        if (sceneData.time !== undefined) scene.setTime(sceneData.time);
        if (sceneData.date !== undefined) scene.date = sceneData.date;
        if (sceneData.dayOfWeek !== undefined) scene.dayOfWeek = sceneData.dayOfWeek;
        if (sceneData.season !== undefined) scene.season = sceneData.season;
        if (sceneData.privacy !== undefined) scene.privacy = sceneData.privacy;
        if (sceneData.safety !== undefined) scene.safety = sceneData.safety;
        if (sceneData.comfort !== undefined) scene.comfort = sceneData.comfort;
        if (sceneData.weather !== undefined) scene.weather = sceneData.weather;
        if (sceneData.temperature !== undefined) scene.temperature = sceneData.temperature;
        if (sceneData.lighting !== undefined) scene.lighting = sceneData.lighting;
        if (sceneData.noiseLevel !== undefined) scene.noiseLevel = sceneData.noiseLevel;

        if (sceneData.peoplePresent !== undefined) {
            scene.peoplePresent = [...sceneData.peoplePresent];
        }

        await this.saveState();

        this.emit('sceneChanged', scene);
    }

    /**
     * Update outfit
     * @param {Object} outfitData - Outfit data
     * @returns {Promise<void>}
     */
    async updateOutfit(outfitData) {
        if (!this.currentState) return;

        const outfit = this.currentState.outfit;

        for (const slot in outfitData) {
            if (outfit[slot] !== undefined && typeof outfitData[slot] === 'object') {
                outfit.setItem(slot, outfitData[slot].name || '', outfitData[slot].description || '');
            }
        }

        if (outfitData.overallDescription !== undefined) {
            outfit.overallDescription = outfitData.overallDescription;
        }

        await this.saveState();
    }

    /**
     * Shave hair area
     * @param {string} area - Area to shave
     * @returns {Promise<void>}
     */
    async shaveHair(area) {
        if (!this.currentState) return;

        this.currentState.hair.shave(area);
        await this.saveState();
    }

    /**
     * Add or update a belief
     * @param {string} name - Belief name
     * @param {number} strength - Strength (0-100)
     * @param {string} description - Description
     * @returns {Promise<void>}
     */
    async addBelief(name, strength, description = '') {
        if (!this.currentState) return;

        this.currentState.addBelief(name, strength, description);
        await this.saveState();
    }

    /**
     * Get all stats summary for display
     * @returns {Object}
     */
    getStatsSummary() {
        if (!this.currentState) return {};

        const stats = this.currentState.stats;

        return {
            physical: {
                hunger: stats.hunger,
                bladder: stats.bladder,
                bowel: stats.bowel,
                health: stats.health,
                cleanliness: stats.cleanliness,
                energy: stats.energy,
                sleep: stats.sleep
            },
            mental: {
                willpower: stats.willpower,
                confidence: stats.confidence,
                pride: stats.pride,
                shame: stats.shame,
                stress: stats.stress,
                anxiety: stats.anxiety
            },
            moral: {
                morality: stats.morality,
                corruption: stats.corruption,
                honesty: stats.honesty,
                loyalty: stats.loyalty
            },
            sexual: {
                arousal: stats.arousal,
                modesty: stats.modesty,
                lewdity: stats.lewdity,
                exhibitionism: stats.exhibitionism,
                dominance: stats.dominance,
                submissiveness: stats.submissiveness
            }
        };
    }

    /**
     * Get character state for prompt injection
     * @returns {Object}
     */
    getStateForPrompt() {
        if (!this.currentState) return {};

        return {
            characterName: this.currentState.characterName,
            stats: this.currentState.stats.toObject(),
            customStats: this.currentState.customStats,
            scene: this.currentState.scene.toObject(),
            activeRelationships: this.getActiveRelationships(),
            hair: this.currentState.hair.toObject(),
            outfit: this.currentState.outfit.toObject(),
            biology: this.currentState.biology.toObject(),
            beliefs: this.currentState.getProtectedBeliefs(),
            criticalStats: this.currentState.stats.getCriticalStats(),
            urgentStats: this.currentState.stats.getUrgentStats()
        };
    }

    /**
     * Parse and apply analysis response from LLM
     * @param {Object} analysisData - Parsed analysis data
     * @returns {Promise<boolean>}
     */
    async applyAnalysis(analysisData) {
        if (!this.currentState || !analysisData) return false;

        try {
            // Apply stat changes
            if (analysisData.statChanges) {
                await this.applyStatChanges(analysisData.statChanges);
            }

            // Apply relationship changes
            if (analysisData.relationshipChanges) {
                for (const npcName in analysisData.relationshipChanges) {
                    const changes = analysisData.relationshipChanges[npcName];
                    for (const category in changes) {
                        for (const stat in changes[category]) {
                            const delta = changes[category][stat];
                            this.updateRelationship(npcName, category, stat, delta);
                        }
                    }
                }
            }

            // Apply scene changes
            if (analysisData.sceneChanges) {
                await this.updateScene(analysisData.sceneChanges);
            }

            // Apply outfit changes
            if (analysisData.outfitChanges) {
                await this.updateOutfit(analysisData.outfitChanges);
            }

            return true;
        } catch (error) {
            console.error('[RPG Enhanced] Failed to apply analysis:', error);
            return false;
        }
    }

    /**
     * Register event listener
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     */
    on(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event].push(callback);
        }
    }

    /**
     * Remove event listener
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     */
    off(event, callback) {
        if (this.listeners[event]) {
            const index = this.listeners[event].indexOf(callback);
            if (index > -1) {
                this.listeners[event].splice(index, 1);
            }
        }
    }

    /**
     * Emit event
     * @param {string} event - Event name
     * @param {*} data - Event data
     */
    emit(event, data) {
        if (this.listeners[event]) {
            for (const callback of this.listeners[event]) {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`[RPG Enhanced] Error in ${event} listener:`, error);
                }
            }
        }
    }

    /**
     * Reset state to defaults
     * @returns {Promise<void>}
     */
    async resetState() {
        if (!this.currentState) return;

        const characterName = this.currentState.characterName;
        this.currentState = new CharacterState(characterName);

        await this.saveState();

        this.emit('stateChanged', this.currentState);
    }

    /**
     * Export state as JSON string
     * @returns {string}
     */
    exportState() {
        if (!this.currentState) return '{}';
        return JSON.stringify(this.currentState.toObject(), null, 2);
    }

    /**
     * Import state from JSON string
     * @param {string} jsonString - JSON state string
     * @returns {Promise<boolean>}
     */
    async importState(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            this.currentState = CharacterState.fromObject(data);
            await this.saveState();
            this.emit('stateChanged', this.currentState);
            return true;
        } catch (error) {
            console.error('[RPG Enhanced] Failed to import state:', error);
            return false;
        }
    }
}

// Export a factory function for creating managers
export function createCharacterStateManager(options = {}) {
    return new CharacterStateManager(options);
}
