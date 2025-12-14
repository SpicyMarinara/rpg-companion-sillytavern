/**
 * Enhanced Character System Integration
 * Integrates the Katherine RPG character system with SillyTavern
 *
 * Based on KATHERINE_RPG_MASTER_SPECIFICATION.txt
 * Version: 2.0.0
 */

import { getContext } from '../../../../../../extensions.js';
import {
    chat,
    chat_metadata,
    saveChatDebounced,
    setExtensionPrompt,
    extension_prompt_types
} from '../../../../../../../script.js';

import { extensionSettings } from '../../core/state.js';
import { CharacterSystem, getCharacterSystem, resetCharacterSystem } from '../../character/index.js';
import { renderCharacterStatsPanel, renderCompactStats } from '../rendering/characterStats.js';
import { renderRelationshipsPanel, renderCompactRelationships } from '../rendering/relationships.js';

// Singleton character system instance
let characterSystemInstance = null;

/**
 * Initialize the enhanced character system
 * @returns {Promise<CharacterSystem|null>}
 */
export async function initializeCharacterSystem() {
    try {
        const context = getContext();

        // Create character system with SillyTavern integration
        characterSystemInstance = getCharacterSystem({
            getContext: () => getContext(),
            saveMetadata: async (data) => {
                if (!chat_metadata) return;

                // Store enhanced character data in chat metadata
                if (!chat_metadata.rpg_enhanced) {
                    chat_metadata.rpg_enhanced = {};
                }

                chat_metadata.rpg_enhanced.characterState = data;
                saveChatDebounced();
            },
            customThresholds: extensionSettings.enhancedRPG?.customThresholds || {},
            customPrompts: extensionSettings.enhancedRPG?.customPrompts || {}
        });

        // Initialize the system
        const success = await characterSystemInstance.initialize(context);

        if (success) {
            console.log('[RPG Enhanced] Character system initialized successfully');

            // Add enhanced-enabled class to panel
            $('#rpg-companion-panel').addClass('rpg-enhanced-enabled');

            // Set up event listeners
            characterSystemInstance.on('stateChanged', onCharacterStateChanged);
            characterSystemInstance.on('error', onCharacterSystemError);

            // Load saved state from chat metadata
            await loadCharacterState();

            return characterSystemInstance;
        } else {
            console.error('[RPG Enhanced] Failed to initialize character system');
            return null;
        }
    } catch (error) {
        console.error('[RPG Enhanced] Error initializing character system:', error);
        return null;
    }
}

/**
 * Get the current character system instance
 * @returns {CharacterSystem|null}
 */
export function getCharacterSystemInstance() {
    return characterSystemInstance;
}

/**
 * Load character state from chat metadata
 * @returns {Promise<boolean>}
 */
export async function loadCharacterState() {
    if (!characterSystemInstance || !chat_metadata?.rpg_enhanced?.characterState) {
        return false;
    }

    try {
        const savedState = JSON.stringify(chat_metadata.rpg_enhanced.characterState);
        return await characterSystemInstance.importState(savedState);
    } catch (error) {
        console.error('[RPG Enhanced] Error loading character state:', error);
        return false;
    }
}

/**
 * Save character state to chat metadata
 * @returns {Promise<void>}
 */
export async function saveCharacterState() {
    if (!characterSystemInstance || !chat_metadata) {
        return;
    }

    try {
        const stateJson = characterSystemInstance.exportState();
        const stateData = JSON.parse(stateJson);

        if (!chat_metadata.rpg_enhanced) {
            chat_metadata.rpg_enhanced = {};
        }

        chat_metadata.rpg_enhanced.characterState = stateData;
        saveChatDebounced();
    } catch (error) {
        console.error('[RPG Enhanced] Error saving character state:', error);
    }
}

/**
 * Handle character state changes
 * @param {Object} state - New character state
 */
function onCharacterStateChanged(state) {
    // Re-render UI panels
    renderEnhancedPanels();

    // Save state
    saveCharacterState();
}

/**
 * Handle character system errors
 * @param {Error} error - Error object
 */
function onCharacterSystemError(error) {
    console.error('[RPG Enhanced] Character system error:', error);
}

/**
 * Render enhanced UI panels
 * @param {Object} options - Rendering options
 */
export function renderEnhancedPanels(options = {}) {
    if (!characterSystemInstance) return;

    const $statsContainer = $('#rpg-enhanced-stats');
    const $relationshipsContainer = $('#rpg-enhanced-relationships');

    if ($statsContainer.length) {
        $statsContainer.html(renderCharacterStatsPanel(characterSystemInstance, options));
    }

    if ($relationshipsContainer.length) {
        $relationshipsContainer.html(renderRelationshipsPanel(characterSystemInstance, options));
    }
}

/**
 * Render compact stats for sidebar
 * @param {Object} options - Rendering options
 * @returns {string} HTML string
 */
export function renderEnhancedCompactStats(options = {}) {
    if (!characterSystemInstance) return '';
    return renderCompactStats(characterSystemInstance, options);
}

/**
 * Render compact relationships for sidebar
 * @param {Object} options - Rendering options
 * @returns {string} HTML string
 */
export function renderEnhancedCompactRelationships(options = {}) {
    if (!characterSystemInstance) return '';
    return renderCompactRelationships(characterSystemInstance, options);
}

/**
 * Build and inject enhanced prompts for LLM
 * @param {Object} context - Generation context
 */
export function injectEnhancedPrompts(context = {}) {
    if (!characterSystemInstance || !extensionSettings.enhancedRPG?.enabled) {
        return;
    }

    try {
        // Build compact state summary for injection
        const stateSummary = characterSystemInstance.buildCompactStateSummary();

        if (stateSummary) {
            setExtensionPrompt(
                'rpg-enhanced-state',
                stateSummary,
                extension_prompt_types.IN_CHAT,
                0, // Depth
                false // Not scannable
            );
        }

        // Build priority-based behavior guidance
        const highestPriority = characterSystemInstance.getHighestPriority();
        if (highestPriority) {
            const priorityPrompt = buildPriorityPrompt(highestPriority);
            setExtensionPrompt(
                'rpg-enhanced-priority',
                priorityPrompt,
                extension_prompt_types.IN_CHAT,
                0,
                false
            );
        }
    } catch (error) {
        console.error('[RPG Enhanced] Error injecting prompts:', error);
    }
}

/**
 * Build priority-based prompt injection
 * @param {Object} priority - Highest active priority
 * @returns {string} Prompt text
 */
function buildPriorityPrompt(priority) {
    if (!priority) return '';

    return `[CHARACTER PRIORITY]
Current highest priority: ${priority.name} (Level ${priority.level})
Trigger: ${priority.trigger}
This should influence the character's current focus and decision-making.
`;
}

/**
 * Handle message sent event
 */
export function onEnhancedMessageSent() {
    if (!characterSystemInstance || !extensionSettings.enhancedRPG?.enabled) {
        return;
    }

    // Inject enhanced prompts for the LLM
    injectEnhancedPrompts();
}

/**
 * Handle message received event
 * @param {Object} data - Message data
 */
export async function onEnhancedMessageReceived(data) {
    if (!characterSystemInstance || !extensionSettings.enhancedRPG?.enabled) {
        return;
    }

    const lastMessage = chat[chat.length - 1];
    if (!lastMessage || lastMessage.is_user) {
        return;
    }

    // Check for analysis data in the response
    const analysisMatch = lastMessage.mes.match(/```json\s*\n?([\s\S]*?)\n?```/);

    if (analysisMatch) {
        try {
            const analysisData = JSON.parse(analysisMatch[1]);

            // Apply analysis to character state
            if (analysisData.statChanges || analysisData.relationshipChanges) {
                await characterSystemInstance.applyAnalysis(analysisData);

                // Clean the analysis from the message
                lastMessage.mes = lastMessage.mes.replace(/```json\s*\n?[\s\S]*?\n?```\s*/g, '').trim();
            }
        } catch (error) {
            // Not valid JSON or not analysis data - ignore
        }
    }

    // Update scene context from response if available
    if (lastMessage.mes) {
        await updateSceneFromResponse(lastMessage.mes);
    }

    // Re-render panels
    renderEnhancedPanels();
}

/**
 * Update scene context from LLM response
 * @param {string} responseText - LLM response text
 */
async function updateSceneFromResponse(responseText) {
    if (!characterSystemInstance) return;

    // Extract scene information from response (this is a simplified version)
    // In practice, you might parse specific markers or use structured output

    const sceneUpdates = {};

    // Detect time of day mentions
    const timePatterns = [
        { pattern: /\b(morning|dawn|sunrise)\b/i, value: 'morning' },
        { pattern: /\b(afternoon|midday|noon)\b/i, value: 'afternoon' },
        { pattern: /\b(evening|dusk|sunset)\b/i, value: 'evening' },
        { pattern: /\b(night|midnight|dark)\b/i, value: 'night' }
    ];

    for (const { pattern, value } of timePatterns) {
        if (pattern.test(responseText)) {
            sceneUpdates.timeOfDay = value;
            break;
        }
    }

    // Detect privacy level mentions
    if (/\b(alone|solitude|private|empty)\b/i.test(responseText)) {
        sceneUpdates.privacy = 100;
    } else if (/\b(crowded|public|busy|many people)\b/i.test(responseText)) {
        sceneUpdates.privacy = 10;
    }

    // Apply scene updates if any
    if (Object.keys(sceneUpdates).length > 0) {
        await characterSystemInstance.updateScene(sceneUpdates);
    }
}

/**
 * Handle character/chat change event
 */
export async function onEnhancedCharacterChanged() {
    // Reset the character system for the new chat
    resetCharacterSystem();
    characterSystemInstance = null;

    // Reinitialize for the new chat
    await initializeCharacterSystem();

    // Re-render panels
    renderEnhancedPanels();
}

/**
 * Build analysis prompt for the LLM
 * @param {string} userMessage - User message
 * @param {string} charResponse - Character response
 * @returns {string} Analysis prompt
 */
export function buildEnhancedAnalysisPrompt(userMessage, charResponse) {
    if (!characterSystemInstance) return '';
    return characterSystemInstance.buildAnalysisPrompt(userMessage, charResponse, {});
}

/**
 * Build roleplay context prompt
 * @returns {string} Roleplay prompt
 */
export function buildEnhancedRoleplayPrompt() {
    if (!characterSystemInstance) return '';
    return characterSystemInstance.buildRoleplayPrompt({});
}

/**
 * Update character stat
 * @param {string} statName - Stat name
 * @param {number} value - New value or delta
 * @param {boolean} isDelta - Whether value is delta
 * @returns {boolean} Success
 */
export function updateCharacterStat(statName, value, isDelta = false) {
    if (!characterSystemInstance) return false;
    return characterSystemInstance.updateStat(statName, value, isDelta);
}

/**
 * Update NPC relationship stat
 * @param {string} npcName - NPC name
 * @param {string} category - Stat category
 * @param {string} stat - Stat name
 * @param {number} delta - Change amount
 * @returns {boolean} Success
 */
export function updateNPCRelationship(npcName, category, stat, delta) {
    if (!characterSystemInstance) return false;
    return characterSystemInstance.updateRelationship(npcName, category, stat, delta);
}

/**
 * Set NPC as active in current scene
 * @param {string} npcName - NPC name
 * @param {boolean} active - Active state
 */
export function setNPCActive(npcName, active = true) {
    if (!characterSystemInstance) return;
    characterSystemInstance.setNPCActive(npcName, active);
}

/**
 * Get character stats summary
 * @returns {Object} Stats summary
 */
export function getCharacterStatsSummary() {
    if (!characterSystemInstance) return {};
    return characterSystemInstance.getStatsSummary();
}

/**
 * Get relationship details for an NPC
 * @param {string} npcName - NPC name
 * @returns {Object|null} Relationship details
 */
export function getNPCRelationshipDetails(npcName) {
    if (!characterSystemInstance) return null;
    return characterSystemInstance.getRelationshipDetails(npcName);
}

/**
 * Get all active relationships
 * @returns {Object} Active relationships map
 */
export function getActiveRelationships() {
    if (!characterSystemInstance) return {};
    return characterSystemInstance.getActiveRelationships();
}

/**
 * Advance game time
 * @param {number} hours - Hours to advance
 * @returns {Promise<Object>} Time advance results
 */
export async function advanceGameTime(hours) {
    if (!characterSystemInstance) return {};
    return await characterSystemInstance.advanceTime(hours);
}

/**
 * Clear enhanced extension prompts
 */
export function clearEnhancedPrompts() {
    setExtensionPrompt('rpg-enhanced-state', '', extension_prompt_types.IN_CHAT, 0, false);
    setExtensionPrompt('rpg-enhanced-priority', '', extension_prompt_types.IN_CHAT, 0, false);
}

/**
 * Export current character state as JSON
 * @returns {string} JSON string
 */
export function exportCharacterState() {
    if (!characterSystemInstance) return '{}';
    return characterSystemInstance.exportState();
}

/**
 * Import character state from JSON
 * @param {string} jsonString - JSON state
 * @returns {Promise<boolean>} Success
 */
export async function importCharacterState(jsonString) {
    if (!characterSystemInstance) return false;
    return await characterSystemInstance.importState(jsonString);
}

/**
 * Reset character state to defaults
 * @returns {Promise<void>}
 */
export async function resetCharacterState() {
    if (!characterSystemInstance) return;
    await characterSystemInstance.resetState();
    renderEnhancedPanels();
}
