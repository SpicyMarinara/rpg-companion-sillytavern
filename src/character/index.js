/**
 * RPG Companion Enhanced - Character Module Index
 * Main entry point for the enhanced character system
 *
 * Based on KATHERINE_RPG_MASTER_SPECIFICATION.txt
 * Version: 2.0.0
 */

// Export data structures
export {
    UniversalStats,
    RelationshipStats,
    HairGrowth,
    Outfit,
    BiologySystem,
    SceneContext,
    Belief,
    CharacterState
} from './dataStructures.js';

// Export managers
export {
    CharacterStateManager,
    createCharacterStateManager
} from './characterStateManager.js';

export {
    PriorityEngine,
    createPriorityEngine,
    PRIORITY_LEVELS,
    PRIORITY_NAMES,
    DEFAULT_THRESHOLDS
} from './priorityEngine.js';

export {
    RelationshipManager,
    createRelationshipManager,
    RELATIONSHIP_TYPES,
    IMPORTANCE_LEVELS
} from './relationshipManager.js';

export {
    EnhancedPromptBuilder,
    createEnhancedPromptBuilder,
    DEFAULT_ANALYSIS_TEMPLATE,
    DEFAULT_ROLEPLAY_TEMPLATE
} from './enhancedPromptBuilder.js';

/**
 * CharacterSystem - Main coordinator for all character subsystems
 */
export class CharacterSystem {
    constructor(options = {}) {
        this.options = options;
        this.initialized = false;

        // Subsystems
        this.stateManager = null;
        this.priorityEngine = null;
        this.relationshipManager = null;
        this.promptBuilder = null;

        // Event listeners
        this.listeners = {
            initialized: [],
            stateChanged: [],
            error: []
        };
    }

    /**
     * Initialize the character system
     * @param {Object} context - SillyTavern context
     * @returns {Promise<boolean>}
     */
    async initialize(context = {}) {
        try {
            const { createCharacterStateManager } = await import('./characterStateManager.js');
            const { createPriorityEngine } = await import('./priorityEngine.js');
            const { createRelationshipManager } = await import('./relationshipManager.js');
            const { createEnhancedPromptBuilder } = await import('./enhancedPromptBuilder.js');

            // Create state manager
            this.stateManager = createCharacterStateManager({
                getContext: this.options.getContext || (() => context),
                saveMetadata: this.options.saveMetadata || (async () => {})
            });

            // Initialize state
            await this.stateManager.initialize();

            // Create subsystems
            this.priorityEngine = createPriorityEngine(
                this.stateManager,
                this.options.customThresholds || {}
            );

            this.relationshipManager = createRelationshipManager(this.stateManager);

            this.promptBuilder = createEnhancedPromptBuilder(
                this.stateManager,
                this.relationshipManager,
                this.priorityEngine,
                this.options.customPrompts || {}
            );

            // Wire up state change events
            this.stateManager.on('stateChanged', (state) => {
                this.emit('stateChanged', state);
            });

            this.initialized = true;
            this.emit('initialized', this);

            console.log('[RPG Enhanced] Character system initialized');

            return true;
        } catch (error) {
            console.error('[RPG Enhanced] Failed to initialize character system:', error);
            this.emit('error', error);
            return false;
        }
    }

    /**
     * Get current character state
     * @returns {CharacterState|null}
     */
    getState() {
        return this.stateManager?.getState?.() || null;
    }

    /**
     * Get state for prompt injection
     * @returns {Object}
     */
    getStateForPrompt() {
        return this.stateManager?.getStateForPrompt?.() || {};
    }

    /**
     * Get active priorities
     * @returns {Array}
     */
    getActivePriorities() {
        return this.priorityEngine?.checkActivePriorities?.() || [];
    }

    /**
     * Get highest active priority
     * @returns {Object|null}
     */
    getHighestPriority() {
        return this.priorityEngine?.getHighestPriority?.() || null;
    }

    /**
     * Build analysis prompt
     * @param {string} userMessage - User message
     * @param {string} charResponse - Character response
     * @param {Object} context - Context
     * @returns {string}
     */
    buildAnalysisPrompt(userMessage, charResponse, context = {}) {
        return this.promptBuilder?.buildAnalysisPrompt?.(userMessage, charResponse, context) || '';
    }

    /**
     * Build roleplay prompt
     * @param {Object} context - Context
     * @returns {string}
     */
    buildRoleplayPrompt(context = {}) {
        return this.promptBuilder?.buildRoleplayPrompt?.(context) || '';
    }

    /**
     * Build compact state summary for injection
     * @returns {string}
     */
    buildCompactStateSummary() {
        return this.promptBuilder?.buildCompactStateSummary?.() || '';
    }

    /**
     * Update stat
     * @param {string} statName - Stat name
     * @param {number} value - New value or delta
     * @param {boolean} isDelta - Whether value is delta
     * @returns {boolean}
     */
    updateStat(statName, value, isDelta = false) {
        if (!this.stateManager) return false;

        if (isDelta) {
            return this.stateManager.changeStat(statName, value);
        } else {
            return this.stateManager.setStat(statName, value);
        }
    }

    /**
     * Update relationship stat
     * @param {string} npcName - NPC name
     * @param {string} category - Category
     * @param {string} stat - Stat name
     * @param {number} delta - Change amount
     * @returns {boolean}
     */
    updateRelationship(npcName, category, stat, delta) {
        return this.relationshipManager?.updateStat?.(npcName, category, stat, delta) || false;
    }

    /**
     * Set NPC as active/inactive
     * @param {string} npcName - NPC name
     * @param {boolean} active - Active state
     */
    setNPCActive(npcName, active = true) {
        this.relationshipManager?.setActive?.(npcName, active);
    }

    /**
     * Update scene context
     * @param {Object} sceneData - Scene updates
     * @returns {Promise<void>}
     */
    async updateScene(sceneData) {
        await this.stateManager?.updateScene?.(sceneData);
    }

    /**
     * Advance time
     * @param {number} hours - Hours to advance
     * @returns {Promise<Object>}
     */
    async advanceTime(hours) {
        return await this.stateManager?.advanceTime?.(hours) || {};
    }

    /**
     * Apply analysis from LLM response
     * @param {Object} analysisData - Parsed analysis data
     * @returns {Promise<boolean>}
     */
    async applyAnalysis(analysisData) {
        return await this.stateManager?.applyAnalysis?.(analysisData) || false;
    }

    /**
     * Get stats summary for UI
     * @returns {Object}
     */
    getStatsSummary() {
        return this.stateManager?.getStatsSummary?.() || {};
    }

    /**
     * Get relationship details
     * @param {string} npcName - NPC name
     * @returns {Object|null}
     */
    getRelationshipDetails(npcName) {
        return this.relationshipManager?.getRelationshipDetails?.(npcName) || null;
    }

    /**
     * Get all active relationships
     * @returns {Object}
     */
    getActiveRelationships() {
        return this.relationshipManager?.getActiveRelationships?.() || {};
    }

    /**
     * Export state
     * @returns {string}
     */
    exportState() {
        return this.stateManager?.exportState?.() || '{}';
    }

    /**
     * Import state
     * @param {string} jsonString - JSON state
     * @returns {Promise<boolean>}
     */
    async importState(jsonString) {
        return await this.stateManager?.importState?.(jsonString) || false;
    }

    /**
     * Reset state
     * @returns {Promise<void>}
     */
    async resetState() {
        await this.stateManager?.resetState?.();
    }

    /**
     * Register event listener
     * @param {string} event - Event name
     * @param {Function} callback - Callback
     */
    on(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event].push(callback);
        }
    }

    /**
     * Remove event listener
     * @param {string} event - Event name
     * @param {Function} callback - Callback
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
}

/**
 * Create and initialize character system
 * @param {Object} options - Configuration options
 * @returns {CharacterSystem}
 */
export function createCharacterSystem(options = {}) {
    return new CharacterSystem(options);
}

// Singleton instance for global access
let globalCharacterSystem = null;

/**
 * Get or create global character system instance
 * @param {Object} options - Configuration options
 * @returns {CharacterSystem}
 */
export function getCharacterSystem(options = {}) {
    if (!globalCharacterSystem) {
        globalCharacterSystem = createCharacterSystem(options);
    }
    return globalCharacterSystem;
}

/**
 * Reset global character system (for testing/reinitialization)
 */
export function resetCharacterSystem() {
    globalCharacterSystem = null;
}
