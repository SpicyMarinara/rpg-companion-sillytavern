/**
 * Enhanced Character System Integration
 * Integrates the Katherine RPG character system with SillyTavern
 *
 * Based on KATHERINE_RPG_MASTER_SPECIFICATION.txt
 * Version: 2.1.0 - Added LLM analysis
 */

import { getContext } from '../../../../../../extensions.js';
import {
    chat,
    chat_metadata,
    saveChatDebounced,
    setExtensionPrompt,
    extension_prompt_types,
    generateRaw,
    characters,
    this_chid
} from '../../../../../../../script.js';

import { extensionSettings } from '../../core/state.js';
import { CharacterSystem, getCharacterSystem, resetCharacterSystem } from '../../character/index.js';
import { renderCharacterStatsPanel, renderCompactStats } from '../rendering/characterStats.js';
import { renderRelationshipsPanel, renderCompactRelationships } from '../rendering/relationships.js';

// Singleton character system instance
let characterSystemInstance = null;
let isAnalyzing = false;

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
    const $statsContainer = $('#rpg-enhanced-stats');
    const $relationshipsContainer = $('#rpg-enhanced-relationships');
    const $panel = $('#rpg-companion-panel');

    // Always add the enabled class when rendering is called and setting is enabled
    if (extensionSettings.enhancedRPG?.enabled) {
        $panel.addClass('rpg-enhanced-enabled');
    } else {
        $panel.removeClass('rpg-enhanced-enabled');
        // Clear containers if disabled
        if ($statsContainer.length) $statsContainer.html('');
        if ($relationshipsContainer.length) $relationshipsContainer.html('');
        return;
    }

    // Render stats panel - always render, even without system instance (shows sample data)
    if ($statsContainer.length) {
        $statsContainer.html(renderCharacterStatsPanel(characterSystemInstance, options));
    }

    // Render relationships panel
    if ($relationshipsContainer.length) {
        if (characterSystemInstance) {
            $relationshipsContainer.html(renderRelationshipsPanel(characterSystemInstance, options));
        } else {
            $relationshipsContainer.html(renderSampleRelationshipsPanel());
        }
    }

    console.log('[RPG Enhanced] Panels rendered, system instance:', !!characterSystemInstance);
}

/**
 * Render initializing/waiting state for stats panel
 * @returns {string} HTML string
 */
function renderInitializingPanel() {
    return `
        <div class="rpg-enhanced-stats-panel initializing">
            <div class="panel-header">
                <span class="panel-title">Enhanced Character Stats</span>
            </div>
            <div class="initializing-message">
                <i class="fa-solid fa-spinner fa-spin"></i>
                <span>Waiting for chat to initialize...</span>
                <small>Open a chat to see character stats</small>
            </div>
        </div>
    `;
}

/**
 * Render sample relationships panel (for preview when no chat)
 * @returns {string} HTML string
 */
function renderSampleRelationshipsPanel() {
    return `
        <div class="rpg-enhanced-relationships-panel preview-mode">
            <div class="panel-header">
                <span class="panel-title">NPC Relationships (Preview)</span>
            </div>
            <div class="preview-notice">
                <i class="fa-solid fa-info-circle"></i>
                <span>Open a chat to track relationships</span>
            </div>
            <div class="sample-relationships">
                <div class="relationship-card sample">
                    <div class="rel-header">
                        <div class="rel-header-main">
                            <span class="rel-type-icon" style="color: #ff66aa">💖</span>
                            <span class="rel-name">Sample NPC</span>
                        </div>
                        <div class="rel-header-info">
                            <span class="rel-type" style="color: #ff66aa">Dating</span>
                        </div>
                    </div>
                    <div class="rel-summary">Strong affectionate bond</div>
                    <div class="rel-quick-stats">
                        <div class="rel-stat">
                            <span class="rel-stat-name">Trust</span>
                            <span class="rel-stat-value">65</span>
                        </div>
                        <div class="rel-stat">
                            <span class="rel-stat-name">Love</span>
                            <span class="rel-stat-value">55</span>
                        </div>
                        <div class="rel-stat">
                            <span class="rel-stat-name">Respect</span>
                            <span class="rel-stat-value">70</span>
                        </div>
                        <div class="rel-stat">
                            <span class="rel-stat-name">Fear</span>
                            <span class="rel-stat-value">5</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
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
 * Build the context analysis prompt for extracting character state from conversation
 * @returns {string} Analysis prompt
 */
function buildContextAnalysisPrompt() {
    const context = getContext();
    const charName = context.name2 || 'Character';
    const userName = context.name1 || 'User';

    // Get character description from character card
    let charDescription = '';
    if (this_chid !== undefined && characters[this_chid]) {
        const charData = characters[this_chid];
        charDescription = charData.description || charData.personality || '';
        if (charDescription.length > 1500) {
            charDescription = charDescription.substring(0, 1500) + '...';
        }
    }

    // Get last few messages for context (up to 6 messages)
    const recentMessages = chat.slice(-6).map(msg => {
        const speaker = msg.is_user ? userName : charName;
        const text = msg.mes?.substring(0, 500) || '';
        return `${speaker}: "${text}"`;
    }).join('\n\n');

    return `You are an RPG game master analyzing a roleplay conversation to extract character state.

CHARACTER: ${charName}
USER: ${userName}

CHARACTER DESCRIPTION:
${charDescription || 'No description available.'}

RECENT CONVERSATION:
${recentMessages}

=== ANALYSIS TASK ===

Analyze this conversation and extract ${charName}'s current state. Focus on:
1. Their relationship with ${userName} (how do they feel about them?)
2. Any emotional states shown (stressed, happy, aroused, anxious, etc.)
3. Physical states if mentioned (tired, hungry, etc.)
4. Location/scene if described
5. ${charName}'s current thoughts/feelings about ${userName}

Return ONLY valid JSON in this exact format:
{
  "characterName": "${charName}",
  "userName": "${userName}",
  "relationship": {
    "type": "partner/friend/stranger/family/colleague/etc",
    "trust": 0-100 or null if unknown,
    "love": 0-100 or null if unknown,
    "respect": 0-100 or null if unknown,
    "comfort": 0-100 or null if unknown,
    "thoughts": "${charName}'s thoughts about ${userName}"
  },
  "stats": {
    "arousal": 0-100 or null,
    "stress": 0-100 or null,
    "happiness": 0-100 or null,
    "energy": 0-100 or null,
    "confidence": 0-100 or null
  },
  "scene": {
    "location": "where they are or null",
    "timeOfDay": "morning/afternoon/evening/night or null",
    "privacy": 0-100 or null
  },
  "internalThoughts": "What ${charName} is thinking right now"
}

Rules:
- Use null for any values you cannot determine from the conversation
- Only include stats that are actually evident from the text
- Be conservative - don't assume stats, only include what's clearly shown
- Relationship type should match what's evident (if they call each other 'babe', probably partner)

Respond with ONLY the JSON, no other text.`;
}

/**
 * Analyze the current conversation context using LLM
 * @returns {Promise<Object|null>} Analysis results
 */
async function analyzeConversationContext() {
    if (isAnalyzing || !chat || chat.length === 0) {
        return null;
    }

    try {
        isAnalyzing = true;
        console.log('[RPG Enhanced] Starting LLM context analysis...');

        const prompt = buildContextAnalysisPrompt();

        // Call the LLM for analysis
        const response = await generateRaw(prompt, null, false, false);

        if (!response) {
            console.log('[RPG Enhanced] No response from LLM analysis');
            return null;
        }

        console.log('[RPG Enhanced] Raw LLM analysis response:', response.substring(0, 200));

        // Try to extract JSON from response
        let jsonStr = response;

        // Check if response contains JSON block
        const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
            jsonStr = jsonMatch[1];
        } else {
            // Try to find raw JSON object
            const objectMatch = response.match(/\{[\s\S]*\}/);
            if (objectMatch) {
                jsonStr = objectMatch[0];
            }
        }

        const analysisData = JSON.parse(jsonStr.trim());
        console.log('[RPG Enhanced] Parsed analysis:', analysisData);

        return analysisData;
    } catch (error) {
        console.error('[RPG Enhanced] LLM analysis failed:', error);
        return null;
    } finally {
        isAnalyzing = false;
    }
}

/**
 * Apply LLM analysis results to character state
 * @param {Object} analysis - Analysis data from LLM
 */
async function applyAnalysisToState(analysis) {
    if (!characterSystemInstance || !analysis) return;

    const stateManager = characterSystemInstance.stateManager;
    const state = stateManager?.currentState;
    if (!state) return;

    console.log('[RPG Enhanced] Applying analysis to state...');

    // Apply stats that were determined
    if (analysis.stats) {
        for (const [statName, value] of Object.entries(analysis.stats)) {
            if (value !== null && value !== undefined && typeof value === 'number') {
                // Set stat directly on the stats object
                if (state.stats && state.stats[statName] !== undefined) {
                    state.stats[statName] = Math.max(0, Math.min(100, value));
                    console.log(`[RPG Enhanced] Set ${statName} = ${value}`);
                }
            }
        }
    }

    // Apply relationship data
    if (analysis.relationship && analysis.userName) {
        // getRelationship creates the relationship if it doesn't exist
        const rel = state.getRelationship(analysis.userName);

        // Set relationship type
        if (analysis.relationship.type) {
            // Map common types
            const typeMap = {
                'partner': 'Partner',
                'dating': 'Dating',
                'friend': 'Friend',
                'stranger': 'Stranger',
                'family': 'Family',
                'colleague': 'Coworker',
                'romantic': 'Romantic Interest',
                'spouse': 'Spouse',
                'fiance': 'Fiance'
            };
            const type = analysis.relationship.type.toLowerCase();
            rel.metadata.relationshipType = typeMap[type] || analysis.relationship.type;
            rel.metadata.confirmed = true;
        }

        // Set relationship stats
        if (analysis.relationship.trust !== null && analysis.relationship.trust !== undefined) {
            rel.core.trust = analysis.relationship.trust;
        }
        if (analysis.relationship.love !== null && analysis.relationship.love !== undefined) {
            rel.core.love = analysis.relationship.love;
        }
        if (analysis.relationship.respect !== null && analysis.relationship.respect !== undefined) {
            rel.core.respect = analysis.relationship.respect;
        }
        if (analysis.relationship.comfort !== null && analysis.relationship.comfort !== undefined) {
            rel.emotional.comfort = analysis.relationship.comfort;
        }

        // Store thoughts
        if (analysis.relationship.thoughts) {
            rel.metadata.notes = analysis.relationship.thoughts;
        }

        rel.metadata.isActive = true;
        rel.metadata.lastSeen = 'Just now';
        rel.metadata.importance = 'High';

        console.log(`[RPG Enhanced] Updated relationship with ${analysis.userName}:`, rel.metadata.relationshipType);
    }

    // Apply scene data
    if (analysis.scene) {
        if (analysis.scene.location && state.scene) {
            state.scene.location = analysis.scene.location;
        }
        if (analysis.scene.timeOfDay && state.scene) {
            state.scene.timeOfDay = analysis.scene.timeOfDay;
        }
        if (analysis.scene.privacy !== null && analysis.scene.privacy !== undefined && state.scene) {
            state.scene.privacy = analysis.scene.privacy;
        }
        console.log('[RPG Enhanced] Updated scene');
    }

    // Mark state as updated and emit event
    state.lastUpdated = new Date().toISOString();
    stateManager.emit('stateChanged', state);

    // Save state
    await saveCharacterState();
}

/**
 * Handle message received event
 * @param {Object} data - Message data
 */
export async function onEnhancedMessageReceived(data) {
    if (!extensionSettings.enhancedRPG?.enabled) {
        return;
    }

    const lastMessage = chat[chat.length - 1];
    if (!lastMessage || lastMessage.is_user) {
        return;
    }

    // Initialize character system if needed
    if (!characterSystemInstance) {
        await initializeCharacterSystem();
    }

    // Check for analysis data in the response first
    const analysisMatch = lastMessage.mes.match(/```json\s*\n?([\s\S]*?)\n?```/);

    if (analysisMatch) {
        try {
            const analysisData = JSON.parse(analysisMatch[1]);

            // Apply analysis to character state
            if (analysisData.statChanges || analysisData.relationshipChanges) {
                await characterSystemInstance?.applyAnalysis(analysisData);

                // Clean the analysis from the message
                lastMessage.mes = lastMessage.mes.replace(/```json\s*\n?[\s\S]*?\n?```\s*/g, '').trim();
            }
        } catch (error) {
            // Not valid JSON or not analysis data - ignore
        }
    }

    // Always run LLM analysis to extract context
    console.log('[RPG Enhanced] Running LLM analysis for message...');
    const analysis = await analyzeConversationContext();

    if (analysis) {
        await applyAnalysisToState(analysis);
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
