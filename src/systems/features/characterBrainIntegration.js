/**
 * Character Brain Integration Module
 * Hooks into SillyTavern's generation flow to route requests through character-specific LLMs
 *
 * This module provides the integration layer between the character brain system
 * and SillyTavern's existing message generation flow.
 */

import { getContext } from '../../../../../../extensions.js';
import { chat, eventSource, event_types } from '../../../../../../../script.js';
import { extensionSettings } from '../../core/state.js';
import {
    getCharacterBrain,
    hasCustomBrain,
    generateForCharacter,
    detectCurrentSpeaker,
    initCharacterBrains,
    PROVIDERS
} from './characterBrain.js';

/**
 * Flag to track if brain integration is initialized
 * @type {boolean}
 */
let isInitialized = false;

/**
 * Stores the last detected speaker for debugging
 * @type {string|null}
 */
let lastDetectedSpeaker = null;

/**
 * Initializes the character brain integration
 * Sets up event listeners for generation interception
 */
export function initBrainIntegration() {
    if (isInitialized) {
        // console.log('[Character Brain Integration] Already initialized');
        return;
    }

    // Initialize the brain system
    initCharacterBrains();

    // Listen for generation events to potentially intercept
    eventSource.on(event_types.GENERATION_STARTED, onGenerationStarted);
    eventSource.on(event_types.CHAT_CHANGED, onChatChanged);

    isInitialized = true;
    // console.log('[Character Brain Integration] Initialized');
}

/**
 * Cleans up the character brain integration
 */
export function cleanupBrainIntegration() {
    if (!isInitialized) return;

    eventSource.off(event_types.GENERATION_STARTED, onGenerationStarted);
    eventSource.off(event_types.CHAT_CHANGED, onChatChanged);

    isInitialized = false;
    // console.log('[Character Brain Integration] Cleaned up');
}

/**
 * Handler for generation started events
 * Determines if the generation should be routed through a character brain
 * @param {Object} data - Generation event data
 */
function onGenerationStarted(data) {
    // Skip if multi-LLM is disabled
    if (!extensionSettings.enableMultiLLM) {
        return;
    }

    // Detect who is speaking
    const speaker = detectCurrentSpeaker();
    lastDetectedSpeaker = speaker;

    if (!speaker) {
        // console.log('[Character Brain Integration] Could not detect speaker');
        return;
    }

    // Check if this character has a custom brain
    if (!hasCustomBrain(speaker)) {
        // console.log('[Character Brain Integration] No custom brain for:', speaker);
        return;
    }

    // Log that we would intercept (actual interception requires deeper integration)
    // console.log('[Character Brain Integration] Would route generation through custom brain for:', speaker);

    // Note: Full interception would require patching SillyTavern's generateQuietPrompt
    // or using extension_prompt injection to influence the generation
}

/**
 * Handler for chat changed events
 * Logs brain status for the new chat context
 */
function onChatChanged() {
    // Reset speaker detection
    lastDetectedSpeaker = null;

    // Skip if multi-LLM is disabled
    if (!extensionSettings.enableMultiLLM) {
        return;
    }

    const context = getContext();

    // Log brain status for debugging
    if (context.characterId !== undefined || context.groupId) {
        const speaker = detectCurrentSpeaker();
        if (speaker && hasCustomBrain(speaker)) {
            // console.log('[Character Brain Integration] Character has custom brain:', speaker);
        }
    }
}

/**
 * Generates a response using the appropriate brain for the current context
 * This is the main entry point for character-specific generation
 *
 * @param {Array<{role: string, content: string}>} messages - Messages to send
 * @param {Object} options - Generation options
 * @returns {Promise<string|null>} Generated response or null if using default
 */
export async function generateWithCharacterBrain(messages, options = {}) {
    // Skip if multi-LLM is disabled
    if (!extensionSettings.enableMultiLLM) {
        return null;
    }

    // Use provided character ID or detect from context
    const characterId = options.characterId || detectCurrentSpeaker();

    if (!characterId) {
        // console.log('[Character Brain Integration] No character ID for generation');
        return null;
    }

    // Check if this character has a custom brain
    if (!hasCustomBrain(characterId)) {
        // console.log('[Character Brain Integration] Using default model for:', characterId);
        return null;
    }

    // console.log('[Character Brain Integration] Using custom brain for:', characterId);

    try {
        const response = await generateForCharacter(characterId, messages, options);
        return response;
    } catch (error) {
        console.error('[Character Brain Integration] Generation failed:', error);
        // Return null to fall back to default behavior
        return null;
    }
}

/**
 * Checks if the current speaking character has a custom brain
 * @returns {boolean} True if current speaker has custom brain
 */
export function currentSpeakerHasCustomBrain() {
    if (!extensionSettings.enableMultiLLM) {
        return false;
    }

    const speaker = detectCurrentSpeaker();
    return speaker ? hasCustomBrain(speaker) : false;
}

/**
 * Gets the brain configuration for the current speaker
 * @returns {Object|null} Brain config or null
 */
export function getCurrentSpeakerBrain() {
    const speaker = detectCurrentSpeaker();
    if (!speaker) return null;

    return getCharacterBrain(speaker);
}

/**
 * Gets information about the last detected speaker
 * Useful for debugging
 * @returns {Object} Speaker info
 */
export function getLastSpeakerInfo() {
    return {
        id: lastDetectedSpeaker,
        hasCustomBrain: lastDetectedSpeaker ? hasCustomBrain(lastDetectedSpeaker) : false,
        brain: lastDetectedSpeaker ? getCharacterBrain(lastDetectedSpeaker) : null
    };
}

/**
 * Wrapper for external API generation that considers character brains
 * Can be used as a drop-in replacement for generateWithExternalAPI
 *
 * @param {Array<{role: string, content: string}>} messages - Messages to send
 * @param {Object} options - Generation options including characterId
 * @returns {Promise<string>} Generated response
 */
export async function generateWithBrainAwareness(messages, options = {}) {
    // First, try to use character brain
    const brainResponse = await generateWithCharacterBrain(messages, options);

    if (brainResponse !== null) {
        return brainResponse;
    }

    // Fall back to the original external API if available
    // This requires the caller to provide a fallback function
    if (options.fallbackGenerator && typeof options.fallbackGenerator === 'function') {
        return await options.fallbackGenerator(messages);
    }

    // If no fallback, throw an error or return null depending on strictMode
    if (options.strictMode) {
        throw new Error('No brain configured and no fallback generator provided');
    }

    return null;
}

/**
 * Creates a generation function bound to a specific character
 * Useful for creating character-specific API clients
 *
 * @param {string} characterId - Character ID to bind to
 * @returns {Function} Bound generation function
 */
export function createCharacterGenerator(characterId) {
    return async function(messages, options = {}) {
        return await generateWithCharacterBrain(messages, {
            ...options,
            characterId: characterId
        });
    };
}

/**
 * Gets a summary of all configured character brains
 * @returns {Object} Summary of brain configurations
 */
export function getBrainsSummary() {
    const brains = {};
    const allBrains = extensionSettings.characterBrains || {};

    for (const [id, brain] of Object.entries(allBrains)) {
        if (brain && brain.enabled) {
            brains[id] = {
                provider: brain.provider,
                model: brain.model,
                enabled: brain.enabled
            };
        }
    }

    return {
        multiLLMEnabled: extensionSettings.enableMultiLLM,
        configuredBrains: Object.keys(brains).length,
        brains: brains
    };
}

/**
 * Validates that a character brain is properly configured
 * @param {string} characterId - Character ID to validate
 * @returns {Object} Validation result with status and issues
 */
export function validateCharacterBrain(characterId) {
    const brain = getCharacterBrain(characterId);
    const issues = [];

    if (!brain.enabled) {
        return { valid: true, issues: ['Brain not enabled (using default)'] };
    }

    // Check provider
    if (brain.provider === PROVIDERS.DEFAULT) {
        return { valid: true, issues: [] };
    }

    // Check model
    if (!brain.model || !brain.model.trim()) {
        issues.push('No model specified');
    }

    // Check endpoint for local/custom
    if ((brain.provider === PROVIDERS.LOCAL || brain.provider === PROVIDERS.CUSTOM) &&
        (!brain.endpoint || !brain.endpoint.trim())) {
        issues.push('No endpoint specified for local/custom provider');
    }

    // Check API key for providers that require it
    if (brain.provider === PROVIDERS.OPENAI || brain.provider === PROVIDERS.ANTHROPIC) {
        // Note: We can't check localStorage here, but the generation will fail if missing
        // Just flag it as a potential issue
        issues.push('Ensure API key is configured in browser storage');
    }

    return {
        valid: issues.length === 0,
        issues: issues
    };
}
