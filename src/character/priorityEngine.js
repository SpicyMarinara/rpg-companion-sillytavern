/**
 * RPG Companion Enhanced - Priority Engine
 * Implements the 7-level priority decision system
 *
 * Based on KATHERINE_RPG_MASTER_SPECIFICATION.txt
 * Version: 2.0.0
 *
 * PRIORITY LEVELS:
 * Level 1: SURVIVAL - Life-threatening situations (highest)
 * Level 2: IDENTITY - Core beliefs and values
 * Level 3: URGENT NEEDS - Strong physical discomfort
 * Level 4: EMOTIONAL STATES - Strong emotions affecting judgment
 * Level 5: RELATIONSHIP DYNAMICS - Trust, loyalty, love, fear
 * Level 6: SOCIAL NORMS - Context-dependent behavior
 * Level 7: PREFERENCES - Personal likes/dislikes (lowest)
 */

/**
 * Priority levels enum
 */
export const PRIORITY_LEVELS = {
    SURVIVAL: 1,
    IDENTITY: 2,
    URGENT_NEEDS: 3,
    EMOTIONAL: 4,
    RELATIONSHIP: 5,
    SOCIAL_NORMS: 6,
    PREFERENCES: 7
};

/**
 * Priority level names
 */
export const PRIORITY_NAMES = {
    1: 'SURVIVAL',
    2: 'IDENTITY',
    3: 'URGENT NEEDS',
    4: 'EMOTIONAL',
    5: 'RELATIONSHIP',
    6: 'SOCIAL NORMS',
    7: 'PREFERENCES'
};

/**
 * Default threshold configuration
 */
export const DEFAULT_THRESHOLDS = {
    level1: {
        bladder: 95,        // Accident imminent
        bowel: 95,          // Accident imminent
        hunger: 90,         // Starvation
        health: 20,         // Critical condition (below this)
        pain: 80,           // Debilitating pain
        safety: 10          // Life-threatening danger (below this)
    },
    level2: {
        beliefStrength: 85  // Protected belief threshold
    },
    level3: {
        bladder: 70,        // Noticeable urgency
        bowel: 70,          // Noticeable urgency
        hunger: 70,         // Very hungry
        cleanliness: 30,    // Feeling dirty (below this)
        sleep: 20,          // Exhausted (below this)
        energy: 20          // Depleted (below this)
    },
    level4: {
        stress: 70,         // Very stressed
        anxiety: 70,        // Very anxious
        shame: 60,          // High embarrassment
        arousal: 70,        // Affecting judgment
        loneliness: 70,     // Desperate for connection
        jealousy: 70        // Possessive behavior
    },
    level5: {
        trustHigh: 80,      // Strong trust
        loyaltyHigh: 80,    // Strong loyalty
        loveHigh: 80,       // Deep love
        fearHigh: 60,       // Intimidated
        trustLow: 30        // Distrusts (below this)
    }
};

/**
 * Active priority result
 * @typedef {Object} ActivePriority
 * @property {number} level - Priority level (1-7)
 * @property {string} name - Priority name
 * @property {string} reason - Why this priority is active
 * @property {string[]} affectedStats - Which stats triggered this
 * @property {number} intensity - How strong (0-100)
 */

/**
 * PriorityEngine - Handles priority checking and resolution
 */
export class PriorityEngine {
    /**
     * @param {CharacterStateManager} stateManager - Character state manager
     * @param {Object} customThresholds - Custom threshold overrides
     */
    constructor(stateManager, customThresholds = {}) {
        this.stateManager = stateManager;
        this.thresholds = this.mergeThresholds(DEFAULT_THRESHOLDS, customThresholds);
    }

    /**
     * Merge custom thresholds with defaults
     * @param {Object} defaults - Default thresholds
     * @param {Object} custom - Custom overrides
     * @returns {Object} Merged thresholds
     */
    mergeThresholds(defaults, custom) {
        const merged = JSON.parse(JSON.stringify(defaults));

        for (const level in custom) {
            if (merged[level]) {
                Object.assign(merged[level], custom[level]);
            }
        }

        return merged;
    }

    /**
     * Update threshold values
     * @param {string} level - Level key (e.g., 'level1')
     * @param {string} stat - Stat name
     * @param {number} value - New threshold value
     */
    setThreshold(level, stat, value) {
        if (this.thresholds[level] && this.thresholds[level][stat] !== undefined) {
            this.thresholds[level][stat] = value;
        }
    }

    /**
     * Check all active priorities and return them sorted
     * @returns {ActivePriority[]} Array of active priorities, sorted by level (1 = highest)
     */
    checkActivePriorities() {
        const state = this.stateManager?.getState?.();
        if (!state) return [];

        const stats = state.stats;
        const scene = state.scene;
        const active = [];

        // LEVEL 1: SURVIVAL
        const survival = this.checkSurvival(stats, scene);
        if (survival) active.push(survival);

        // LEVEL 2: IDENTITY
        const identity = this.checkIdentity(state.beliefs);
        if (identity) active.push(identity);

        // LEVEL 3: URGENT NEEDS
        const urgentNeeds = this.checkUrgentNeeds(stats);
        if (urgentNeeds) active.push(urgentNeeds);

        // LEVEL 4: EMOTIONAL STATES
        const emotional = this.checkEmotional(stats);
        if (emotional) active.push(emotional);

        // LEVEL 5: RELATIONSHIP DYNAMICS
        const relationship = this.checkRelationship(state);
        if (relationship) active.push(relationship);

        // LEVEL 6: SOCIAL NORMS
        const socialNorms = this.checkSocialNorms(stats, scene);
        if (socialNorms) active.push(socialNorms);

        // LEVEL 7: PREFERENCES (always active but lowest)
        active.push({
            level: PRIORITY_LEVELS.PREFERENCES,
            name: PRIORITY_NAMES[7],
            reason: 'Personal likes and dislikes',
            affectedStats: [],
            intensity: 30
        });

        // Sort by level (lowest number = highest priority)
        return active.sort((a, b) => a.level - b.level);
    }

    /**
     * Check Level 1: SURVIVAL priorities
     * @param {UniversalStats} stats - Character stats
     * @param {SceneContext} scene - Scene context
     * @returns {ActivePriority|null}
     */
    checkSurvival(stats, scene) {
        const t = this.thresholds.level1;
        const affectedStats = [];
        let intensity = 0;

        if (stats.bladder >= t.bladder) {
            affectedStats.push(`bladder: ${stats.bladder} (accident imminent)`);
            intensity = Math.max(intensity, (stats.bladder - t.bladder + 5) * 10);
        }
        if (stats.bowel >= t.bowel) {
            affectedStats.push(`bowel: ${stats.bowel} (accident imminent)`);
            intensity = Math.max(intensity, (stats.bowel - t.bowel + 5) * 10);
        }
        if (stats.hunger >= t.hunger) {
            affectedStats.push(`hunger: ${stats.hunger} (starving)`);
            intensity = Math.max(intensity, (stats.hunger - t.hunger + 10) * 5);
        }
        if (stats.health <= t.health) {
            affectedStats.push(`health: ${stats.health} (critical condition)`);
            intensity = Math.max(intensity, (t.health - stats.health + 20) * 5);
        }
        if (stats.pain >= t.pain) {
            affectedStats.push(`pain: ${stats.pain} (debilitating)`);
            intensity = Math.max(intensity, (stats.pain - t.pain + 20) * 5);
        }
        if (scene && scene.safety <= t.safety) {
            affectedStats.push(`safety: ${scene.safety} (life-threatening)`);
            intensity = Math.max(intensity, (t.safety - scene.safety + 10) * 10);
        }

        if (affectedStats.length === 0) return null;

        return {
            level: PRIORITY_LEVELS.SURVIVAL,
            name: PRIORITY_NAMES[1],
            reason: affectedStats.join(', '),
            affectedStats,
            intensity: Math.min(100, intensity)
        };
    }

    /**
     * Check Level 2: IDENTITY priorities
     * @param {Belief[]} beliefs - Character beliefs
     * @returns {ActivePriority|null}
     */
    checkIdentity(beliefs) {
        if (!beliefs || beliefs.length === 0) return null;

        const t = this.thresholds.level2;
        const protectedBeliefs = beliefs.filter(b => b.strength >= t.beliefStrength);

        if (protectedBeliefs.length === 0) return null;

        const beliefNames = protectedBeliefs.map(b => `"${b.name}" (${b.strength})`);
        const maxStrength = Math.max(...protectedBeliefs.map(b => b.strength));

        return {
            level: PRIORITY_LEVELS.IDENTITY,
            name: PRIORITY_NAMES[2],
            reason: `Protected beliefs: ${beliefNames.join(', ')}`,
            affectedStats: beliefNames,
            intensity: maxStrength
        };
    }

    /**
     * Check Level 3: URGENT NEEDS priorities
     * @param {UniversalStats} stats - Character stats
     * @returns {ActivePriority|null}
     */
    checkUrgentNeeds(stats) {
        const t = this.thresholds.level3;
        const affectedStats = [];
        let intensity = 0;

        // Check "too high" stats
        if (stats.bladder >= t.bladder && stats.bladder < this.thresholds.level1.bladder) {
            affectedStats.push(`bladder: ${stats.bladder}`);
            intensity = Math.max(intensity, stats.bladder - t.bladder);
        }
        if (stats.bowel >= t.bowel && stats.bowel < this.thresholds.level1.bowel) {
            affectedStats.push(`bowel: ${stats.bowel}`);
            intensity = Math.max(intensity, stats.bowel - t.bowel);
        }
        if (stats.hunger >= t.hunger && stats.hunger < this.thresholds.level1.hunger) {
            affectedStats.push(`hunger: ${stats.hunger}`);
            intensity = Math.max(intensity, (stats.hunger - t.hunger) * 0.75);
        }

        // Check "too low" stats
        if (stats.cleanliness <= t.cleanliness) {
            affectedStats.push(`cleanliness: ${stats.cleanliness} (feeling dirty)`);
            intensity = Math.max(intensity, t.cleanliness - stats.cleanliness);
        }
        if (stats.sleep <= t.sleep) {
            affectedStats.push(`sleep: ${stats.sleep} (exhausted)`);
            intensity = Math.max(intensity, (t.sleep - stats.sleep) * 2);
        }
        if (stats.energy <= t.energy) {
            affectedStats.push(`energy: ${stats.energy} (depleted)`);
            intensity = Math.max(intensity, (t.energy - stats.energy) * 2);
        }

        if (affectedStats.length === 0) return null;

        return {
            level: PRIORITY_LEVELS.URGENT_NEEDS,
            name: PRIORITY_NAMES[3],
            reason: affectedStats.join(', '),
            affectedStats,
            intensity: Math.min(100, intensity)
        };
    }

    /**
     * Check Level 4: EMOTIONAL STATES priorities
     * @param {UniversalStats} stats - Character stats
     * @returns {ActivePriority|null}
     */
    checkEmotional(stats) {
        const t = this.thresholds.level4;
        const affectedStats = [];
        let intensity = 0;

        if (stats.stress >= t.stress) {
            affectedStats.push(`stress: ${stats.stress} (very stressed)`);
            intensity = Math.max(intensity, stats.stress - t.stress + 30);
        }
        if (stats.anxiety >= t.anxiety) {
            affectedStats.push(`anxiety: ${stats.anxiety} (very anxious)`);
            intensity = Math.max(intensity, stats.anxiety - t.anxiety + 30);
        }
        if (stats.shame >= t.shame) {
            affectedStats.push(`shame: ${stats.shame} (embarrassed)`);
            intensity = Math.max(intensity, stats.shame - t.shame + 40);
        }
        if (stats.arousal >= t.arousal) {
            affectedStats.push(`arousal: ${stats.arousal} (clouding judgment)`);
            intensity = Math.max(intensity, stats.arousal - t.arousal + 30);
        }
        if (stats.loneliness >= t.loneliness) {
            affectedStats.push(`loneliness: ${stats.loneliness} (desperate for connection)`);
            intensity = Math.max(intensity, stats.loneliness - t.loneliness + 30);
        }
        if (stats.jealousy >= t.jealousy) {
            affectedStats.push(`jealousy: ${stats.jealousy} (possessive)`);
            intensity = Math.max(intensity, stats.jealousy - t.jealousy + 30);
        }

        if (affectedStats.length === 0) return null;

        return {
            level: PRIORITY_LEVELS.EMOTIONAL,
            name: PRIORITY_NAMES[4],
            reason: affectedStats.join(', '),
            affectedStats,
            intensity: Math.min(100, intensity)
        };
    }

    /**
     * Check Level 5: RELATIONSHIP DYNAMICS priorities
     * @param {CharacterState} state - Full character state
     * @returns {ActivePriority|null}
     */
    checkRelationship(state) {
        const t = this.thresholds.level5;
        const activeRelationships = [];
        let intensity = 0;

        for (const npcName in state.relationships) {
            const rel = state.relationships[npcName];
            if (!rel.metadata.isActive) continue;

            const relationshipFactors = [];

            // High positive factors
            if (rel.core.trust >= t.trustHigh) {
                relationshipFactors.push(`high trust (${rel.core.trust})`);
                intensity = Math.max(intensity, rel.core.trust - t.trustHigh + 20);
            }
            if (rel.core.loyalty >= t.loyaltyHigh) {
                relationshipFactors.push(`strong loyalty (${rel.core.loyalty})`);
                intensity = Math.max(intensity, rel.core.loyalty - t.loyaltyHigh + 20);
            }
            if (rel.core.love >= t.loveHigh) {
                relationshipFactors.push(`deep love (${rel.core.love})`);
                intensity = Math.max(intensity, rel.core.love - t.loveHigh + 20);
            }

            // Negative factors
            if (rel.core.fear >= t.fearHigh) {
                relationshipFactors.push(`intimidated (fear: ${rel.core.fear})`);
                intensity = Math.max(intensity, rel.core.fear - t.fearHigh + 40);
            }
            if (rel.core.trust <= t.trustLow) {
                relationshipFactors.push(`distrusts (trust: ${rel.core.trust})`);
                intensity = Math.max(intensity, t.trustLow - rel.core.trust + 40);
            }

            if (relationshipFactors.length > 0) {
                activeRelationships.push({
                    name: npcName,
                    factors: relationshipFactors,
                    summary: rel.getSummary()
                });
            }
        }

        if (activeRelationships.length === 0) return null;

        const reasonParts = activeRelationships.map(r =>
            `${r.name}: ${r.factors.join(', ')}`
        );

        return {
            level: PRIORITY_LEVELS.RELATIONSHIP,
            name: PRIORITY_NAMES[5],
            reason: reasonParts.join('; '),
            affectedStats: activeRelationships.map(r => r.name),
            intensity: Math.min(100, intensity),
            relationships: activeRelationships
        };
    }

    /**
     * Check Level 6: SOCIAL NORMS priorities
     * @param {UniversalStats} stats - Character stats
     * @param {SceneContext} scene - Scene context
     * @returns {ActivePriority|null}
     */
    checkSocialNorms(stats, scene) {
        if (!scene || scene.privacy >= 80) {
            // Very private - social norms barely apply
            return null;
        }

        const affectedStats = [];
        let intensity = 0;

        // Modesty becomes more important in public
        const effectiveModesty = this.calculateEffectiveModesty(stats.modesty, scene.privacy);

        if (effectiveModesty >= 50) {
            const publicLevel = scene.privacy < 20 ? 'very public' :
                               scene.privacy < 40 ? 'public' : 'semi-private';

            affectedStats.push(`modesty: ${stats.modesty} in ${publicLevel} (effective: ${effectiveModesty})`);
            intensity = effectiveModesty;
        }

        // Honesty social expectation
        if (stats.honesty >= 60) {
            affectedStats.push(`honesty: ${stats.honesty} (social expectation)`);
            intensity = Math.max(intensity, stats.honesty * 0.5);
        }

        if (affectedStats.length === 0) return null;

        const privacyDesc = scene.privacy < 20 ? 'Very public setting' :
                           scene.privacy < 40 ? 'Public setting' :
                           'Semi-private setting';

        return {
            level: PRIORITY_LEVELS.SOCIAL_NORMS,
            name: PRIORITY_NAMES[6],
            reason: `${privacyDesc} (privacy: ${scene.privacy}). ${affectedStats.join(', ')}`,
            affectedStats,
            intensity: Math.min(100, intensity),
            privacy: scene.privacy
        };
    }

    /**
     * Get the highest active priority
     * @returns {ActivePriority|null}
     */
    getHighestPriority() {
        const active = this.checkActivePriorities();
        return active.length > 0 ? active[0] : null;
    }

    /**
     * Calculate effective modesty based on privacy
     * @param {number} modesty - Base modesty stat
     * @param {number} privacy - Privacy level
     * @returns {number} Effective modesty
     */
    calculateEffectiveModesty(modesty, privacy) {
        if (privacy >= 80) {
            // Very private - modesty reduced 80%
            return Math.round(modesty * 0.2);
        } else if (privacy >= 40) {
            // Semi-private - modesty reduced 40%
            return Math.round(modesty * 0.6);
        } else if (privacy < 20) {
            // Very public - modesty amplified 50%
            return Math.min(100, Math.round(modesty * 1.5));
        } else {
            // Public - full modesty
            return modesty;
        }
    }

    /**
     * Calculate effective arousal after considering other stats
     * @param {UniversalStats} stats - All stats
     * @returns {number} Effective arousal
     */
    calculateEffectiveArousal(stats) {
        let value = stats.arousal;

        // Hunger reduces arousal
        if (stats.hunger >= 80) value *= 0.7;
        if (stats.hunger >= 90) value *= 0.5;

        // Stress reduces arousal
        if (stats.stress >= 70) value *= 0.5;
        else if (stats.stress >= 50) value *= 0.75;

        // Pain reduces arousal
        if (stats.pain >= 50) value *= 0.5;

        // Sleep deprivation
        if (stats.sleep <= 20) value *= 0.6;

        // Energy depletion
        if (stats.energy <= 20) value *= 0.6;

        // Bladder urgency
        if (stats.bladder >= 80) value *= 0.7;

        return Math.round(value);
    }

    /**
     * Evaluate if a request can be fulfilled given current priorities
     * @param {Object} request - Request object with type and details
     * @returns {Object} Evaluation result with canFulfill, reason, alternatives
     */
    evaluateRequest(request) {
        const priorities = this.checkActivePriorities();
        const highest = priorities[0];

        // If no high priorities active, request can proceed
        if (!highest || highest.level > 5) {
            return {
                canFulfill: true,
                reason: 'No blocking priorities',
                conflictingPriority: null
            };
        }

        // Check specific request types against priorities
        const result = {
            canFulfill: true,
            reason: '',
            conflictingPriority: null,
            alternatives: [],
            internalConflict: 0
        };

        // Level 1: SURVIVAL blocks almost everything
        if (highest.level === PRIORITY_LEVELS.SURVIVAL) {
            result.canFulfill = false;
            result.reason = `SURVIVAL priority blocks request: ${highest.reason}`;
            result.conflictingPriority = highest;
            result.alternatives = ['Address survival need first', 'Request help with survival need'];
            return result;
        }

        // Level 2: IDENTITY blocks things that violate core beliefs
        if (highest.level === PRIORITY_LEVELS.IDENTITY && request.violatesIdentity) {
            result.canFulfill = false;
            result.reason = `Request violates protected belief: ${highest.reason}`;
            result.conflictingPriority = highest;
            result.internalConflict = 80;
            return result;
        }

        // Level 3: URGENT NEEDS may delay but not block
        if (highest.level === PRIORITY_LEVELS.URGENT_NEEDS) {
            result.canFulfill = true;
            result.reason = `Character will want to address urgent need: ${highest.reason}`;
            result.conflictingPriority = highest;
            result.alternatives = ['Address need first, then fulfill request'];
            result.internalConflict = 40;
        }

        // Level 4: EMOTIONAL states affect behavior but rarely block
        if (highest.level === PRIORITY_LEVELS.EMOTIONAL) {
            result.canFulfill = true;
            result.reason = `Emotional state affects response: ${highest.reason}`;
            result.conflictingPriority = highest;
            result.internalConflict = highest.intensity * 0.5;
        }

        return result;
    }

    /**
     * Generate priority guidance for LLM prompt
     * @returns {string} Priority guidance text
     */
    generatePriorityGuidance() {
        const priorities = this.checkActivePriorities();

        if (priorities.length === 0) {
            return 'No special priority considerations active.';
        }

        let guidance = 'ACTIVE PRIORITY GUIDANCE:\n\n';

        for (const priority of priorities) {
            const levelName = PRIORITY_NAMES[priority.level];
            guidance += `Level ${priority.level} (${levelName}): ${priority.reason}\n`;

            // Add behavior guidance based on level
            switch (priority.level) {
                case 1:
                    guidance += '  -> MUST address immediately. Cannot be delayed or overridden.\n';
                    break;
                case 2:
                    guidance += '  -> Core identity at stake. Strong resistance if violated.\n';
                    break;
                case 3:
                    guidance += '  -> Character is uncomfortable and wants to address soon.\n';
                    break;
                case 4:
                    guidance += '  -> Emotional state colors all responses and decisions.\n';
                    break;
                case 5:
                    guidance += '  -> Relationship dynamics influence willingness and behavior.\n';
                    break;
                case 6:
                    guidance += '  -> Social context affects appropriate behavior.\n';
                    break;
                case 7:
                    guidance += '  -> Personal preference, easily overridden.\n';
                    break;
            }
            guidance += '\n';
        }

        // Add resolution rule
        guidance += 'RESOLUTION RULE: Lower level number always wins in conflicts.\n';

        return guidance;
    }

    /**
     * Get stat interactions summary
     * @param {UniversalStats} stats - Character stats
     * @returns {Object} Stat interactions
     */
    getStatInteractions(stats) {
        return {
            effectiveArousal: this.calculateEffectiveArousal(stats),
            arousalModifiers: this.getArousalModifiers(stats),
            hasStatConflicts: this.hasStatConflicts(stats)
        };
    }

    /**
     * Get modifiers affecting arousal
     * @param {UniversalStats} stats - Character stats
     * @returns {string[]} Array of modifier descriptions
     */
    getArousalModifiers(stats) {
        const modifiers = [];

        if (stats.hunger >= 80) modifiers.push(`Hunger ${stats.hunger} reducing arousal`);
        if (stats.stress >= 50) modifiers.push(`Stress ${stats.stress} reducing arousal`);
        if (stats.pain >= 50) modifiers.push(`Pain ${stats.pain} reducing arousal`);
        if (stats.sleep <= 20) modifiers.push(`Exhaustion (sleep ${stats.sleep}) reducing arousal`);
        if (stats.energy <= 20) modifiers.push(`Low energy ${stats.energy} reducing arousal`);
        if (stats.bladder >= 80) modifiers.push(`Bladder urgency ${stats.bladder} reducing arousal`);

        return modifiers;
    }

    /**
     * Check if stats are in conflict
     * @param {UniversalStats} stats - Character stats
     * @returns {boolean}
     */
    hasStatConflicts(stats) {
        // Check for stat combinations that create internal conflict
        const conflicts = [];

        // High arousal but high stress
        if (stats.arousal >= 70 && stats.stress >= 70) {
            conflicts.push('arousal vs stress');
        }

        // High modesty but high exhibitionism
        if (stats.modesty >= 60 && stats.exhibitionism >= 40) {
            conflicts.push('modesty vs exhibitionism');
        }

        // High dominance but high submissiveness
        if (stats.dominance >= 60 && stats.submissiveness >= 60) {
            conflicts.push('dominance vs submissiveness');
        }

        return conflicts.length > 0;
    }
}

/**
 * Create priority engine with SillyTavern integration
 * @param {CharacterStateManager} stateManager - State manager
 * @param {Object} customThresholds - Custom thresholds
 * @returns {PriorityEngine}
 */
export function createPriorityEngine(stateManager, customThresholds = {}) {
    return new PriorityEngine(stateManager, customThresholds);
}
