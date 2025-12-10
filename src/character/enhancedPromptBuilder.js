/**
 * RPG Companion Enhanced - Enhanced Prompt Builder
 * Builds character-focused LLM prompts with all state information
 *
 * Based on KATHERINE_RPG_MASTER_SPECIFICATION.txt
 * Version: 2.0.0
 */

import { PRIORITY_NAMES } from './priorityEngine.js';

/**
 * Default analysis prompt template
 */
export const DEFAULT_ANALYSIS_TEMPLATE = `You are analyzing character state changes for {{char}}.

=== CURRENT CHARACTER STATE ===

STATS:
{{statsSection}}

SCENE CONTEXT:
{{sceneSection}}

ACTIVE PRIORITIES:
{{prioritiesSection}}

RELATIONSHIPS:
{{relationshipsSection}}

HAIR:
{{hairSection}}

OUTFIT:
{{outfitSection}}

BIOLOGY:
{{biologySection}}

=== INTERACTION ===

{{user}}: "{{userMessage}}"

{{char}}'s response: "{{charResponse}}"

=== ANALYSIS TASK ===

Based on this interaction, analyze what stat changes should occur.

Return ONLY a JSON object in this exact format:
{
  "statChanges": {
    "statName": { "to": newValue, "reason": "why" }
  },
  "relationshipChanges": {
    "npcName": {
      "category": {
        "stat": delta
      }
    }
  },
  "sceneChanges": {
    "location": "new location if changed",
    "privacy": newPrivacyValue,
    "time": "new time if changed"
  },
  "internalThoughts": "{{char}}'s internal thoughts about this interaction",
  "emotionalState": "current emotional summary"
}

Guidelines:
- Stats should change realistically (max 25 per event usually)
- Consider priority system (survival > identity > needs > emotions > relationships > social > preferences)
- Physical stats change slowly unless action directly affects them
- Emotional stats can change more dramatically
- Relationship changes depend on interaction quality
- Include internal thoughts showing character's genuine reaction`;

/**
 * Default roleplay guidance template
 */
export const DEFAULT_ROLEPLAY_TEMPLATE = `You are {{char}}.

=== YOUR CURRENT STATE ===

{{statsSection}}

{{prioritiesSection}}

{{sceneSection}}

{{relationshipsSection}}

=== BEHAVIORAL GUIDANCE ===

{{behaviorGuidance}}

=== PRIORITY RESOLUTION ===

When responding, follow the priority hierarchy:
1. SURVIVAL needs override everything (if active)
2. IDENTITY beliefs are protected - resist if violated
3. URGENT NEEDS should be mentioned/addressed
4. EMOTIONAL states color all responses
5. RELATIONSHIP dynamics affect willingness
6. SOCIAL NORMS depend on context (public vs private)
7. PREFERENCES are easily overridden

Current highest priority: {{highestPriority}}

=== RESPONSE GUIDELINES ===

- Stay consistent with your stats
- Reference relevant physical states naturally
- Show emotions appropriate to current emotional stats
- Relationship stats determine how you treat {{user}}
- Privacy level affects modesty behavior
- Consider hair, outfit, and biology if relevant

Remember: You ARE {{char}}. Respond as she would, considering all the above.`;

/**
 * EnhancedPromptBuilder - Builds comprehensive prompts for LLM
 */
export class EnhancedPromptBuilder {
    /**
     * @param {CharacterStateManager} stateManager - State manager
     * @param {RelationshipManager} relationshipManager - Relationship manager
     * @param {PriorityEngine} priorityEngine - Priority engine
     * @param {Object} customPrompts - Custom prompt templates
     */
    constructor(stateManager, relationshipManager, priorityEngine, customPrompts = {}) {
        this.stateManager = stateManager;
        this.relationshipManager = relationshipManager;
        this.priorityEngine = priorityEngine;
        this.customPrompts = customPrompts;
    }

    /**
     * Build complete analysis prompt
     * @param {string} userMessage - User's message
     * @param {string} charResponse - Character's response
     * @param {Object} context - SillyTavern context
     * @returns {string}
     */
    buildAnalysisPrompt(userMessage, charResponse, context = {}) {
        const state = this.stateManager?.getState?.();
        if (!state) return '';

        const template = this.customPrompts.analysisPrompt || DEFAULT_ANALYSIS_TEMPLATE;

        const replacements = {
            char: state.characterName,
            user: context.name1 || 'User',
            userMessage: userMessage || '',
            charResponse: charResponse || '',
            statsSection: this.buildStatsSection(state.stats),
            sceneSection: this.buildSceneSection(state.scene),
            prioritiesSection: this.buildPrioritiesSection(),
            relationshipsSection: this.buildRelationshipsSection(),
            hairSection: this.buildHairSection(state.hair),
            outfitSection: this.buildOutfitSection(state.outfit),
            biologySection: this.buildBiologySection(state.biology)
        };

        return this.replacePlaceholders(template, replacements);
    }

    /**
     * Build roleplay guidance prompt
     * @param {Object} context - SillyTavern context
     * @returns {string}
     */
    buildRoleplayPrompt(context = {}) {
        const state = this.stateManager?.getState?.();
        if (!state) return '';

        const template = this.customPrompts.roleplayPrompt || DEFAULT_ROLEPLAY_TEMPLATE;
        const priorities = this.priorityEngine?.checkActivePriorities?.() || [];
        const highestPriority = priorities[0];

        const replacements = {
            char: state.characterName,
            user: context.name1 || 'User',
            statsSection: this.buildStatsSection(state.stats),
            sceneSection: this.buildSceneSection(state.scene),
            prioritiesSection: this.buildPrioritiesSection(),
            relationshipsSection: this.buildRelationshipsSection(),
            behaviorGuidance: this.buildBehaviorGuidance(state, priorities),
            highestPriority: highestPriority ?
                `Level ${highestPriority.level} (${highestPriority.name}): ${highestPriority.reason}` :
                'No special priorities active'
        };

        return this.replacePlaceholders(template, replacements);
    }

    /**
     * Build stats section for prompts
     * @param {UniversalStats} stats - Character stats
     * @returns {string}
     */
    buildStatsSection(stats) {
        if (!stats) return 'Stats unavailable';

        const critical = stats.getCriticalStats?.() || [];
        const urgent = stats.getUrgentStats?.() || [];

        let section = '';

        // Show critical stats first with warnings
        if (critical.length > 0) {
            section += '*** CRITICAL (Survival Priority) ***\n';
            for (const stat of critical) {
                section += `  ${stat.name}: ${stat.value}/100 [CRITICAL]\n`;
            }
            section += '\n';
        }

        // Show urgent stats with warnings
        if (urgent.length > 0) {
            section += '** Urgent Needs **\n';
            for (const stat of urgent) {
                section += `  ${stat.name}: ${stat.value}/100 [URGENT]\n`;
            }
            section += '\n';
        }

        // Physical stats
        section += 'Physical:\n';
        section += `  hunger: ${stats.hunger}, bladder: ${stats.bladder}, bowel: ${stats.bowel}\n`;
        section += `  health: ${stats.health}, cleanliness: ${stats.cleanliness}\n`;
        section += `  energy: ${stats.energy}, sleep: ${stats.sleep}, pain: ${stats.pain}\n\n`;

        // Mental stats
        section += 'Mental:\n';
        section += `  willpower: ${stats.willpower}, confidence: ${stats.confidence}, pride: ${stats.pride}\n`;
        section += `  shame: ${stats.shame}, stress: ${stats.stress}, anxiety: ${stats.anxiety}\n`;
        section += `  loneliness: ${stats.loneliness}, jealousy: ${stats.jealousy}\n\n`;

        // Moral stats
        section += 'Moral:\n';
        section += `  morality: ${stats.morality}, corruption: ${stats.corruption}\n`;
        section += `  honesty: ${stats.honesty}, loyalty: ${stats.loyalty ?? 'not earned'}\n\n`;

        // Sexual stats
        section += 'Sexual:\n';
        section += `  arousal: ${stats.arousal}, modesty: ${stats.modesty}, lewdity: ${stats.lewdity}\n`;
        section += `  exhibitionism: ${stats.exhibitionism}, perversion: ${stats.perversion}\n`;
        section += `  dominance: ${stats.dominance}, submissiveness: ${stats.submissiveness}\n`;

        return section;
    }

    /**
     * Build scene section for prompts
     * @param {SceneContext} scene - Scene context
     * @returns {string}
     */
    buildSceneSection(scene) {
        if (!scene) return 'Scene context unavailable';

        let section = `Location: ${scene.location} (${scene.locationType})\n`;

        if (scene.description) {
            section += `Description: ${scene.description}\n`;
        }

        section += `\nTime: ${scene.time}, ${scene.dayOfWeek}, ${scene.season}\n`;
        section += `Time of Day: ${scene.timeOfDay}\n\n`;

        section += `Privacy: ${scene.privacy}/100`;
        if (scene.privacy < 20) section += ' [VERY PUBLIC]';
        else if (scene.privacy < 40) section += ' [PUBLIC]';
        else if (scene.privacy < 60) section += ' [SEMI-PRIVATE]';
        else if (scene.privacy < 80) section += ' [MOSTLY PRIVATE]';
        else section += ' [PRIVATE]';
        section += '\n';

        section += `Safety: ${scene.safety}/100\n`;
        section += `Comfort: ${scene.comfort}/100\n\n`;

        section += `People Present: ${scene.peoplePresent.length > 0 ? scene.peoplePresent.join(', ') : 'None'}\n\n`;

        section += `Environment:\n`;
        section += `  Weather: ${scene.weather}\n`;
        section += `  Temperature: ${scene.temperature}\n`;
        section += `  Lighting: ${scene.lighting}\n`;
        section += `  Noise Level: ${scene.noiseLevel}\n`;

        if (scene.specialNotes) {
            section += `\nNotes: ${scene.specialNotes}\n`;
        }

        return section;
    }

    /**
     * Build priorities section for prompts
     * @returns {string}
     */
    buildPrioritiesSection() {
        const priorities = this.priorityEngine?.checkActivePriorities?.() || [];

        if (priorities.length === 0) {
            return 'No special priorities active.\n';
        }

        let section = '';

        for (const priority of priorities) {
            section += `Level ${priority.level} (${priority.name}):\n`;
            section += `  Reason: ${priority.reason}\n`;
            section += `  Intensity: ${priority.intensity}/100\n`;

            // Add behavior guidance based on level
            switch (priority.level) {
                case 1:
                    section += '  Behavior: MUST address immediately. Overrides everything.\n';
                    break;
                case 2:
                    section += '  Behavior: Core identity. Strong resistance if violated.\n';
                    break;
                case 3:
                    section += '  Behavior: Uncomfortable. Will mention and want to address.\n';
                    break;
                case 4:
                    section += '  Behavior: Emotional state colors all responses.\n';
                    break;
                case 5:
                    section += '  Behavior: Relationship dynamics affect decisions.\n';
                    break;
                case 6:
                    section += '  Behavior: Social context affects appropriate behavior.\n';
                    break;
            }
            section += '\n';
        }

        return section;
    }

    /**
     * Build relationships section for prompts
     * @returns {string}
     */
    buildRelationshipsSection() {
        if (!this.relationshipManager) return 'Relationships unavailable\n';
        return this.relationshipManager.generatePromptSection();
    }

    /**
     * Build hair section for prompts
     * @param {HairGrowth} hair - Hair growth data
     * @returns {string}
     */
    buildHairSection(hair) {
        if (!hair) return 'Hair data unavailable';

        let section = 'Current Hair Growth:\n';
        section += `  Pubic: ${hair.pubic?.value ?? 0}/100 - ${hair.getDescription?.('pubic') || 'Unknown'}\n`;
        section += `  Armpits: ${hair.armpits?.value ?? 0}/100 - ${hair.getDescription?.('armpits') || 'Unknown'}\n`;
        section += `  Legs: ${hair.legs?.value ?? 0}/100 - ${hair.getDescription?.('legs') || 'Unknown'}\n`;
        section += `  Arms: ${hair.arms?.value ?? 0}/100 - ${hair.getDescription?.('arms') || 'Unknown'}\n`;
        section += `  Ass Crack: ${hair.assCrack?.value ?? 0}/100 - ${hair.getDescription?.('assCrack') || 'Unknown'}\n`;

        return section;
    }

    /**
     * Build outfit section for prompts
     * @param {Outfit} outfit - Outfit data
     * @returns {string}
     */
    buildOutfitSection(outfit) {
        if (!outfit) return 'Outfit data unavailable';

        let section = 'Current Outfit:\n';

        if (outfit.overallDescription) {
            section += `  ${outfit.overallDescription}\n`;
        } else {
            if (outfit.top?.name) section += `  Top: ${outfit.top.name}${outfit.top.description ? ` (${outfit.top.description})` : ''}\n`;
            if (outfit.bottom?.name) section += `  Bottom: ${outfit.bottom.name}${outfit.bottom.description ? ` (${outfit.bottom.description})` : ''}\n`;
            if (outfit.bra?.name) section += `  Bra: ${outfit.bra.name}${outfit.bra.description ? ` (${outfit.bra.description})` : ''}\n`;
            if (outfit.underwear?.name) section += `  Underwear: ${outfit.underwear.name}${outfit.underwear.description ? ` (${outfit.underwear.description})` : ''}\n`;
            if (outfit.shoes?.name) section += `  Shoes: ${outfit.shoes.name}${outfit.shoes.description ? ` (${outfit.shoes.description})` : ''}\n`;
            if (outfit.accessories?.name) section += `  Accessories: ${outfit.accessories.name}\n`;

            if (!outfit.top?.name && !outfit.bottom?.name) {
                section += '  [No outfit information available]\n';
            }
        }

        return section;
    }

    /**
     * Build biology section for prompts
     * @param {BiologySystem} biology - Biology data
     * @returns {string}
     */
    buildBiologySection(biology) {
        if (!biology || !biology.cycleEnabled) return 'Biology tracking disabled';

        let section = '';

        if (biology.pregnant) {
            section += `Pregnant: Day ${biology.pregnancyDay}, Trimester ${biology.pregnancyTrimester}\n`;
        } else {
            section += `Cycle: Day ${biology.dayOfCycle}/${biology.cycleLength}\n`;
            section += `Phase: ${biology.currentPhase}\n`;
            section += `Fertility Window: ${biology.fertilityWindow ? 'YES' : 'No'}\n`;

            if (biology.symptoms && biology.symptoms.length > 0) {
                section += `Symptoms: ${biology.symptoms.join(', ')}\n`;
            }

            const daysUntilPeriod = biology.getDaysUntilPeriod?.() || 0;
            if (daysUntilPeriod > 0) {
                section += `Days until next period: ${daysUntilPeriod}\n`;
            }
        }

        return section;
    }

    /**
     * Build behavior guidance based on state
     * @param {CharacterState} state - Character state
     * @param {ActivePriority[]} priorities - Active priorities
     * @returns {string}
     */
    buildBehaviorGuidance(state, priorities) {
        let guidance = '';

        // Check for stat-based behavior modifications
        const stats = state.stats;

        // High arousal guidance
        if (stats.arousal >= 70) {
            const effectiveArousal = this.priorityEngine?.calculateEffectiveArousal?.(stats) || stats.arousal;
            guidance += `High arousal (${stats.arousal}, effective: ${effectiveArousal}): May cloud judgment, more easily persuaded for intimate activities.\n`;
        }

        // High stress/anxiety
        if (stats.stress >= 60 || stats.anxiety >= 60) {
            guidance += `High stress/anxiety: Irritable, short-tempered, difficulty focusing.\n`;
        }

        // Low energy
        if (stats.energy <= 30) {
            guidance += `Low energy (${stats.energy}): Sluggish, may want to rest, less enthusiastic.\n`;
        }

        // Hunger
        if (stats.hunger >= 60) {
            guidance += `Hungry (${stats.hunger}): May mention food, decreased patience.\n`;
        }

        // Bladder urgency
        if (stats.bladder >= 60) {
            guidance += `Bladder urgency (${stats.bladder}): Fidgeting, distracted, may need to excuse self.\n`;
        }

        // Privacy-based modesty
        const scene = state.scene;
        if (scene && scene.privacy < 60 && stats.modesty >= 50) {
            const effectiveModesty = this.priorityEngine?.calculateEffectiveModesty?.(stats.modesty, scene.privacy) || stats.modesty;
            guidance += `Modesty in ${scene.privacy < 40 ? 'public' : 'semi-private'} (modesty ${stats.modesty}, effective: ${effectiveModesty}): Will resist exposure, feel embarrassed.\n`;
        }

        // High shame
        if (stats.shame >= 40) {
            guidance += `Shame (${stats.shame}): Embarrassed, may avoid eye contact, self-conscious.\n`;
        }

        // Dominance/submissiveness balance
        if (stats.submissiveness > stats.dominance + 20) {
            guidance += `Submissive tendency: More likely to comply, seeks approval.\n`;
        } else if (stats.dominance > stats.submissiveness + 20) {
            guidance += `Dominant tendency: More assertive, may take charge.\n`;
        }

        // Biology affects
        if (state.biology?.cycleEnabled) {
            switch (state.biology.currentPhase) {
                case 'menstruating':
                    guidance += `Menstruating: May experience cramps, mood swings, prefer comfort.\n`;
                    break;
                case 'ovulating':
                    guidance += `Ovulating: Increased libido, peak fertility, more flirtatious.\n`;
                    break;
                case 'luteal':
                    guidance += `Luteal phase: PMS possible, bloating, irritability.\n`;
                    break;
            }
        }

        return guidance || 'No special behavioral modifications.\n';
    }

    /**
     * Replace placeholders in template
     * @param {string} template - Template string
     * @param {Object} replacements - Replacement values
     * @returns {string}
     */
    replacePlaceholders(template, replacements) {
        let result = template;

        for (const key in replacements) {
            const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
            result = result.replace(regex, replacements[key] || '');
        }

        return result;
    }

    /**
     * Build compact state summary for injection
     * @returns {string}
     */
    buildCompactStateSummary() {
        const state = this.stateManager?.getState?.();
        if (!state) return '';

        const stats = state.stats;
        const scene = state.scene;

        let summary = `[${state.characterName} State: `;

        // Critical stats only
        const critical = [];
        if (stats.hunger >= 70) critical.push(`hungry:${stats.hunger}`);
        if (stats.bladder >= 70) critical.push(`bladder:${stats.bladder}`);
        if (stats.arousal >= 50) critical.push(`aroused:${stats.arousal}`);
        if (stats.stress >= 50) critical.push(`stress:${stats.stress}`);
        if (stats.energy <= 40) critical.push(`energy:${stats.energy}`);

        if (critical.length > 0) {
            summary += critical.join(', ');
        } else {
            summary += 'stable';
        }

        summary += ` | Privacy:${scene?.privacy ?? 50}]`;

        return summary;
    }

    /**
     * Build output format instructions
     * @returns {string}
     */
    buildOutputFormatInstructions() {
        return `
IMPORTANT: Include a JSON block at the end of your response with stat updates.
Format your response like this:

[Your narrative response here]

\`\`\`json
{
  "statChanges": {
    "arousal": { "to": 45, "reason": "flirtatious interaction" },
    "stress": { "to": 30, "reason": "relaxing conversation" }
  },
  "thoughts": "Internal monologue about what just happened"
}
\`\`\`

Only include stats that actually changed. Be consistent with your narrative.`;
    }

    /**
     * Set custom prompt template
     * @param {string} type - Template type (analysisPrompt, roleplayPrompt)
     * @param {string} template - Template string
     */
    setCustomPrompt(type, template) {
        this.customPrompts[type] = template;
    }

    /**
     * Get custom prompt template
     * @param {string} type - Template type
     * @returns {string}
     */
    getCustomPrompt(type) {
        return this.customPrompts[type] || '';
    }

    /**
     * Reset to default prompts
     */
    resetToDefaults() {
        this.customPrompts = {};
    }
}

/**
 * Create enhanced prompt builder
 * @param {CharacterStateManager} stateManager - State manager
 * @param {RelationshipManager} relationshipManager - Relationship manager
 * @param {PriorityEngine} priorityEngine - Priority engine
 * @param {Object} customPrompts - Custom prompts
 * @returns {EnhancedPromptBuilder}
 */
export function createEnhancedPromptBuilder(stateManager, relationshipManager, priorityEngine, customPrompts = {}) {
    return new EnhancedPromptBuilder(stateManager, relationshipManager, priorityEngine, customPrompts);
}
