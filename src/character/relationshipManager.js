/**
 * RPG Companion Enhanced - Relationship Manager
 * Handles all NPC relationship operations
 *
 * Based on KATHERINE_RPG_MASTER_SPECIFICATION.txt
 * Version: 2.0.0
 */

import { RelationshipStats } from './dataStructures.js';

/**
 * Relationship type definitions
 */
export const RELATIONSHIP_TYPES = {
    STRANGER: 'Stranger',
    ACQUAINTANCE: 'Acquaintance',
    COWORKER: 'Coworker',
    FRIEND: 'Friend',
    CLOSE_FRIEND: 'Close Friend',
    BEST_FRIEND: 'Best Friend',
    ROMANTIC_INTEREST: 'Romantic Interest',
    DATING: 'Dating',
    PARTNER: 'Partner',
    FIANCE: 'Fiance',
    SPOUSE: 'Spouse',
    FAMILY: 'Family',
    ENEMY: 'Enemy',
    RIVAL: 'Rival'
};

/**
 * Importance levels
 */
export const IMPORTANCE_LEVELS = {
    CRITICAL: 'Critical',
    HIGH: 'High',
    MEDIUM: 'Medium',
    LOW: 'Low'
};

/**
 * RelationshipManager - Manages all NPC relationships
 */
export class RelationshipManager {
    /**
     * @param {CharacterStateManager} stateManager - Character state manager
     */
    constructor(stateManager) {
        this.stateManager = stateManager;
    }

    /**
     * Get or create relationship with NPC
     * @param {string} npcName - NPC name
     * @returns {RelationshipStats}
     */
    getRelationship(npcName) {
        const state = this.stateManager?.getState?.();
        if (!state) return null;
        return state.getRelationship(npcName);
    }

    /**
     * Update a relationship stat
     * @param {string} npcName - NPC name
     * @param {string} category - Stat category (core, emotional, social, attraction)
     * @param {string} stat - Stat name
     * @param {number} delta - Change amount
     * @param {number} maxChange - Maximum change allowed
     * @returns {boolean}
     */
    updateStat(npcName, category, stat, delta, maxChange = 25) {
        const rel = this.getRelationship(npcName);
        if (!rel) return false;

        const result = rel.updateStat(category, stat, delta, maxChange);

        if (result) {
            this.stateManager.saveState();
            this.updateRelationshipType(npcName);
        }

        return result;
    }

    /**
     * Set a relationship stat directly
     * @param {string} npcName - NPC name
     * @param {string} category - Stat category
     * @param {string} stat - Stat name
     * @param {number} value - New value
     * @returns {boolean}
     */
    setStat(npcName, category, stat, value) {
        const rel = this.getRelationship(npcName);
        if (!rel) return false;

        const result = rel.setStat(category, stat, value);

        if (result) {
            this.stateManager.saveState();
            this.updateRelationshipType(npcName);
        }

        return result;
    }

    /**
     * Set NPC as active (present in scene)
     * @param {string} npcName - NPC name
     * @param {boolean} active - Active state
     */
    setActive(npcName, active = true) {
        const rel = this.getRelationship(npcName);
        if (!rel) return;

        rel.metadata.isActive = active;

        if (active) {
            rel.metadata.lastSeen = 'Just now';
            rel.metadata.interactionCount++;
        }

        this.stateManager.saveState();
    }

    /**
     * Get all active relationships (NPCs in current scene)
     * @returns {Object} Map of npcName -> RelationshipStats
     */
    getActiveRelationships() {
        const state = this.stateManager?.getState?.();
        if (!state) return {};

        const active = {};
        for (const npcName in state.relationships) {
            if (state.relationships[npcName].metadata.isActive) {
                active[npcName] = state.relationships[npcName];
            }
        }

        return active;
    }

    /**
     * Get all relationships
     * @returns {Object} Map of npcName -> RelationshipStats
     */
    getAllRelationships() {
        const state = this.stateManager?.getState?.();
        if (!state) return {};
        return state.relationships;
    }

    /**
     * Get relationships by importance
     * @param {string} importance - Importance level
     * @returns {Object} Map of npcName -> RelationshipStats
     */
    getByImportance(importance) {
        const state = this.stateManager?.getState?.();
        if (!state) return {};

        const filtered = {};
        for (const npcName in state.relationships) {
            if (state.relationships[npcName].metadata.importance === importance) {
                filtered[npcName] = state.relationships[npcName];
            }
        }

        return filtered;
    }

    /**
     * Get relationships by type
     * @param {string} type - Relationship type
     * @returns {Object} Map of npcName -> RelationshipStats
     */
    getByType(type) {
        const state = this.stateManager?.getState?.();
        if (!state) return {};

        const filtered = {};
        for (const npcName in state.relationships) {
            if (state.relationships[npcName].metadata.relationshipType === type) {
                filtered[npcName] = state.relationships[npcName];
            }
        }

        return filtered;
    }

    /**
     * Auto-detect relationship type based on stats
     * @param {string} npcName - NPC name
     */
    updateRelationshipType(npcName) {
        const rel = this.getRelationship(npcName);
        if (!rel) return;

        const trust = rel.core.trust;
        const love = rel.core.love;
        const loyalty = rel.core.loyalty;
        const fear = rel.core.fear;
        const closeness = rel.emotional.closeness;

        // Determine type based on stats
        let newType = RELATIONSHIP_TYPES.STRANGER;

        // Check for romantic relationships first
        if (love >= 90 && trust >= 80) {
            newType = RELATIONSHIP_TYPES.SPOUSE;
        } else if (love >= 80 && trust >= 70) {
            newType = RELATIONSHIP_TYPES.PARTNER;
        } else if (love >= 60 && trust >= 50) {
            newType = RELATIONSHIP_TYPES.DATING;
        } else if (love >= 40 && closeness >= 40) {
            newType = RELATIONSHIP_TYPES.ROMANTIC_INTEREST;
        }
        // Check for friendship levels
        else if (trust >= 80 && closeness >= 80) {
            newType = RELATIONSHIP_TYPES.BEST_FRIEND;
        } else if (trust >= 60 && closeness >= 50) {
            newType = RELATIONSHIP_TYPES.CLOSE_FRIEND;
        } else if (trust >= 40 && closeness >= 30) {
            newType = RELATIONSHIP_TYPES.FRIEND;
        } else if (trust >= 20) {
            newType = RELATIONSHIP_TYPES.ACQUAINTANCE;
        }
        // Check for negative relationships
        else if (fear >= 60 || trust <= 10) {
            newType = RELATIONSHIP_TYPES.ENEMY;
        }

        // Don't override manually set types unless stats are dramatically different
        const currentType = rel.metadata.relationshipType;
        const isRomanticCurrent = [
            RELATIONSHIP_TYPES.ROMANTIC_INTEREST,
            RELATIONSHIP_TYPES.DATING,
            RELATIONSHIP_TYPES.PARTNER,
            RELATIONSHIP_TYPES.FIANCE,
            RELATIONSHIP_TYPES.SPOUSE
        ].includes(currentType);

        const isRomanticNew = [
            RELATIONSHIP_TYPES.ROMANTIC_INTEREST,
            RELATIONSHIP_TYPES.DATING,
            RELATIONSHIP_TYPES.PARTNER,
            RELATIONSHIP_TYPES.SPOUSE
        ].includes(newType);

        // If currently romantic, only update to another romantic type or if love drops significantly
        if (isRomanticCurrent && !isRomanticNew && love >= 30) {
            return; // Keep current romantic type
        }

        rel.metadata.relationshipType = newType;
    }

    /**
     * Set relationship type manually
     * @param {string} npcName - NPC name
     * @param {string} type - Relationship type
     */
    setRelationshipType(npcName, type) {
        const rel = this.getRelationship(npcName);
        if (!rel) return;

        rel.metadata.relationshipType = type;
        this.stateManager.saveState();
    }

    /**
     * Set relationship importance
     * @param {string} npcName - NPC name
     * @param {string} importance - Importance level
     */
    setImportance(npcName, importance) {
        const rel = this.getRelationship(npcName);
        if (!rel) return;

        rel.metadata.importance = importance;
        this.stateManager.saveState();
    }

    /**
     * Add note to relationship
     * @param {string} npcName - NPC name
     * @param {string} note - Note to add
     */
    addNote(npcName, note) {
        const rel = this.getRelationship(npcName);
        if (!rel) return;

        if (rel.metadata.notes) {
            rel.metadata.notes += '\n' + note;
        } else {
            rel.metadata.notes = note;
        }

        this.stateManager.saveState();
    }

    /**
     * Get relationship summary for prompts
     * @param {string} npcName - NPC name
     * @returns {string}
     */
    getRelationshipSummary(npcName) {
        const rel = this.getRelationship(npcName);
        if (!rel) return 'Unknown relationship';

        return rel.getSummary();
    }

    /**
     * Get detailed relationship for prompts
     * @param {string} npcName - NPC name
     * @returns {Object}
     */
    getRelationshipDetails(npcName) {
        const rel = this.getRelationship(npcName);
        if (!rel) return null;

        return {
            name: npcName,
            type: rel.metadata.relationshipType,
            importance: rel.metadata.importance,
            summary: rel.getSummary(),
            core: {
                trust: rel.core.trust,
                love: rel.core.love,
                respect: rel.core.respect,
                fear: rel.core.fear,
                loyalty: rel.core.loyalty
            },
            emotional: {
                closeness: rel.emotional.closeness,
                comfort: rel.emotional.comfort,
                openness: rel.emotional.openness,
                vulnerability: rel.emotional.vulnerability,
                dependence: rel.emotional.dependence
            },
            social: {
                dominance: rel.social.dominance,
                submissiveness: rel.social.submissiveness,
                assertiveness: rel.social.assertiveness,
                flirtiness: rel.social.flirtiness
            },
            attraction: {
                physical: rel.attraction.physical,
                emotional: rel.attraction.emotional,
                intellectual: rel.attraction.intellectual,
                sexual: rel.attraction.sexual
            }
        };
    }

    /**
     * Check if character has strong feelings for NPC
     * @param {string} npcName - NPC name
     * @returns {Object} Feelings summary
     */
    checkFeelings(npcName) {
        const rel = this.getRelationship(npcName);
        if (!rel) return { hasStrongFeelings: false };

        const feelings = {
            hasStrongFeelings: false,
            isInLove: rel.core.love >= 70,
            isTrusted: rel.core.trust >= 80,
            isLoyal: rel.core.loyalty >= 80,
            isFeared: rel.core.fear >= 60,
            isAttracted: rel.attraction.sexual >= 50 || rel.attraction.physical >= 60,
            isDependent: rel.emotional.dependence >= 50
        };

        feelings.hasStrongFeelings = feelings.isInLove || feelings.isFeared ||
                                      feelings.isLoyal || feelings.isDependent;

        return feelings;
    }

    /**
     * Apply multiple relationship changes at once
     * @param {string} npcName - NPC name
     * @param {Object} changes - Changes object {category: {stat: delta}}
     * @returns {boolean}
     */
    applyChanges(npcName, changes) {
        const rel = this.getRelationship(npcName);
        if (!rel) return false;

        for (const category in changes) {
            for (const stat in changes[category]) {
                const delta = changes[category][stat];
                rel.updateStat(category, stat, delta);
            }
        }

        this.stateManager.saveState();
        this.updateRelationshipType(npcName);

        return true;
    }

    /**
     * Generate relationship prompt section
     * @returns {string}
     */
    generatePromptSection() {
        const activeRelationships = this.getActiveRelationships();

        if (Object.keys(activeRelationships).length === 0) {
            return 'RELATIONSHIPS: No active relationships in current scene.\n';
        }

        let section = 'ACTIVE RELATIONSHIPS:\n\n';

        for (const npcName in activeRelationships) {
            const rel = activeRelationships[npcName];
            const details = this.getRelationshipDetails(npcName);

            section += `${npcName}:\n`;
            section += `  Type: ${rel.metadata.relationshipType}\n`;
            section += `  Summary: ${rel.getSummary()}\n`;
            section += `  Core: trust ${rel.core.trust}, love ${rel.core.love}, `;
            section += `respect ${rel.core.respect}, fear ${rel.core.fear}, `;
            section += `loyalty ${rel.core.loyalty ?? 'not earned'}\n`;
            section += `  Emotional: closeness ${rel.emotional.closeness}, `;
            section += `comfort ${rel.emotional.comfort}, openness ${rel.emotional.openness}\n`;
            section += `  Social: dominance ${rel.social.dominance}, `;
            section += `submissiveness ${rel.social.submissiveness}\n`;

            if (rel.attraction.sexual > 0 || rel.attraction.physical > 0) {
                section += `  Attraction: physical ${rel.attraction.physical}, `;
                section += `sexual ${rel.attraction.sexual}\n`;
            }

            section += '\n';
        }

        return section;
    }

    /**
     * Remove a relationship
     * @param {string} npcName - NPC name
     */
    removeRelationship(npcName) {
        const state = this.stateManager?.getState?.();
        if (!state) return;

        if (state.relationships[npcName]) {
            delete state.relationships[npcName];
            this.stateManager.saveState();
        }
    }

    /**
     * Merge two NPC relationships (e.g., if character was renamed)
     * @param {string} oldName - Old NPC name
     * @param {string} newName - New NPC name
     */
    mergeRelationships(oldName, newName) {
        const state = this.stateManager?.getState?.();
        if (!state) return;

        const oldRel = state.relationships[oldName];
        if (!oldRel) return;

        // If new name doesn't exist, just rename
        if (!state.relationships[newName]) {
            oldRel.npcName = newName;
            state.relationships[newName] = oldRel;
            delete state.relationships[oldName];
        } else {
            // Merge stats (average them)
            const newRel = state.relationships[newName];

            for (const category of ['core', 'emotional', 'social', 'attraction']) {
                for (const stat in oldRel[category]) {
                    if (oldRel[category][stat] !== null && newRel[category][stat] !== null) {
                        newRel[category][stat] = Math.round(
                            (oldRel[category][stat] + newRel[category][stat]) / 2
                        );
                    }
                }
            }

            // Keep higher interaction count
            newRel.metadata.interactionCount = Math.max(
                oldRel.metadata.interactionCount,
                newRel.metadata.interactionCount
            );

            delete state.relationships[oldName];
        }

        this.stateManager.saveState();
    }
}

/**
 * Create relationship manager
 * @param {CharacterStateManager} stateManager - State manager
 * @returns {RelationshipManager}
 */
export function createRelationshipManager(stateManager) {
    return new RelationshipManager(stateManager);
}
