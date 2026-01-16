/**
 * Jungian Archetype System - Main Entry Point
 *
 * A psychological archetype system for RPG companions based on Carl Jung's
 * theory of 12 primary archetypes. This system replaces/complements traditional
 * elemental types, providing deep psychological modeling for character
 * personality, evolution, and player interaction.
 *
 * Features:
 * - 12 primary archetypes (Hero, Caregiver, Explorer, Rebel, Lover, Creator,
 *   Jester, Sage, Magician, Ruler, Innocent, Orphan)
 * - Evolution system: Characters can evolve positively or fall into shadow
 * - Interaction tracking: Player actions affect archetype development
 * - Prompt modification: Archetypes affect AI-generated character behavior
 * - Compatibility matrix: Defines how archetypes interact with each other
 * - Rich UI components for visualization and interaction
 *
 * Usage:
 * ```javascript
 * import {
 *     archetypeRegistry,
 *     ArchetypeManager,
 *     ARCHETYPES,
 *     applyArchetypeToPrompt,
 *     renderArchetypeBadge
 * } from './archetypes/index.js';
 *
 * // Get or create manager for a character
 * const manager = archetypeRegistry.getManager('character_123');
 *
 * // Assign an archetype
 * manager.setArchetype('HERO');
 *
 * // Record an interaction
 * const result = manager.recordInteraction('protection', 1.5, 'Defended the party');
 *
 * // Check for evolution
 * if (result.evolutionResult) {
 *     console.log(result.evolutionResult.message);
 * }
 *
 * // Apply to character prompt
 * const modifiedPrompt = applyArchetypeToPrompt(
 *     basePrompt,
 *     manager.archetype,
 *     manager.state,
 *     manager.getEvolutionProgress()
 * );
 *
 * // Render UI badge
 * const badgeHtml = renderArchetypeBadge(manager);
 * ```
 *
 * @module archetypes
 * @author RPG Companion Team
 * @version 1.0.0
 */

// ═══════════════════════════════════════════════════════════════════════════
// ARCHETYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

export {
    // Core archetype data
    ARCHETYPES,
    SHADOW_ARCHETYPES,
    EVOLVED_ARCHETYPES,
    ARCHETYPE_CATEGORIES,
    ARCHETYPE_COMPATIBILITY,

    // Utility functions
    getAllArchetypes,
    getArchetype,
    getShadowArchetype,
    getEvolvedArchetype,
    getCompatibility,
    getRandomArchetype
} from './archetypeDefinitions.js';

// ═══════════════════════════════════════════════════════════════════════════
// ARCHETYPE MANAGER
// ═══════════════════════════════════════════════════════════════════════════

export {
    // Main manager class
    ArchetypeManager,

    // Global registry singleton
    archetypeRegistry,

    // Interaction configuration
    INTERACTION_IMPACTS
} from './archetypeManager.js';

// ═══════════════════════════════════════════════════════════════════════════
// ARCHETYPE EFFECTS
// ═══════════════════════════════════════════════════════════════════════════

export {
    // Prompt modification
    applyArchetypeToPrompt,

    // Behavior and reactions
    getArchetypeReaction,
    generateBehaviorSuggestions,
    getDialogueFlavor,

    // Summaries and relationships
    getArchetypeSummary,
    getRelationshipDynamics
} from './archetypeEffects.js';

// ═══════════════════════════════════════════════════════════════════════════
// UI COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

export {
    // Render functions
    renderArchetypeBadge,
    renderEvolutionProgressBar,
    renderArchetypeDetailsModal,
    renderArchetypeSelector,
    renderArchetypeCard,
    renderInteractionRecorder,

    // Styles
    getArchetypeStyles,
    injectArchetypeStyles,

    // Event handlers
    initArchetypeUIHandlers
} from './archetypeUI.js';

// ═══════════════════════════════════════════════════════════════════════════
// CONVENIENCE / QUICK ACCESS
// ═══════════════════════════════════════════════════════════════════════════

import { archetypeRegistry } from './archetypeManager.js';
import { ARCHETYPES } from './archetypeDefinitions.js';
import { injectArchetypeStyles } from './archetypeUI.js';

/**
 * Quick initialization function for the archetype system
 * Sets up styles and returns the registry for immediate use
 *
 * @returns {Object} The archetype registry
 */
export function initArchetypeSystem() {
    // Inject CSS styles
    injectArchetypeStyles();

    console.log('[Archetype System] Initialized with', Object.keys(ARCHETYPES).length, 'archetypes');

    return archetypeRegistry;
}

/**
 * Create a new archetype manager for a character with an assigned archetype
 *
 * @param {string} characterId - Unique character identifier
 * @param {string} archetypeKey - The archetype to assign (e.g., 'HERO')
 * @returns {Object} The initialized archetype manager
 */
export function createArchetypedCharacter(characterId, archetypeKey) {
    const manager = archetypeRegistry.getManager(characterId);
    manager.setArchetype(archetypeKey);
    return manager;
}

/**
 * Get archetype manager for a character, or null if not registered
 *
 * @param {string} characterId - Character identifier
 * @returns {Object|null} The archetype manager or null
 */
export function getCharacterArchetype(characterId) {
    if (!archetypeRegistry.managers.has(characterId)) {
        return null;
    }
    return archetypeRegistry.getManager(characterId);
}

/**
 * Load archetype data from saved state (e.g., from chat metadata)
 *
 * @param {Object} savedData - Previously saved archetype data
 */
export function loadArchetypeData(savedData) {
    if (savedData) {
        archetypeRegistry.loadFromSaved(savedData);
        console.log('[Archetype System] Loaded data for', archetypeRegistry.getAllCharacterIds().length, 'characters');
    }
}

/**
 * Save all archetype data for persistence
 *
 * @returns {Object} Serializable archetype data
 */
export function saveArchetypeData() {
    return archetypeRegistry.exportAll();
}

// ═══════════════════════════════════════════════════════════════════════════
// MODULE INFO
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Module version information
 */
export const VERSION = '1.0.0';

/**
 * Module description
 */
export const DESCRIPTION = 'Jungian Archetype System for RPG Companion characters';

/**
 * Quick reference for all available archetypes
 */
export const ARCHETYPE_QUICK_REF = Object.values(ARCHETYPES).map(a => ({
    id: a.id,
    name: a.name,
    icon: a.icon,
    core: a.core,
    category: a.category
}));
