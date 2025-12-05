/**
 * INTEGRATION EXAMPLE
 * This file shows how to integrate the Character State Tracking system
 * into the main RPG Companion extension
 *
 * Copy the relevant parts into your index.js or create a new integration module
 */

// ============================================================================
// STEP 1: Add imports to the top of index.js
// ============================================================================

import {
    getCharacterState,
    updateCharacterState,
    setCharacterState,
    initializeRelationship,
    getRelationship,
    updateRelationship
} from './src/core/characterState.js';

import {
    generateCharacterTrackingPrompt,
    generateSeparateCharacterTrackingPrompt,
    generateCharacterInitializationPrompt,
    generateRelationshipAnalysisPrompt,
    generateCharacterStateSummary
} from './src/systems/generation/characterPromptBuilder.js';

import {
    parseAndApplyCharacterStateUpdate,
    removeCharacterStateBlock,
    parseCharacterInitialization,
    parseRelationshipAnalysis
} from './src/systems/generation/characterParser.js';

import {
    renderCharacterStateOverview,
    updateCharacterStateDisplay,
    renderEmotionalState,
    renderPhysicalCondition,
    renderRelationships,
    renderInternalThoughts
} from './src/systems/rendering/characterStateRenderer.js';

// ============================================================================
// STEP 2: Add character state container to UI initialization
// ============================================================================

async function initUI() {
    // ... existing UI initialization code ...

    // Add character state container to the panel
    const characterStateHtml = `
        <div class="rpg-section" id="rpg-character-state-section">
            <div id="rpg-character-state-container"></div>
        </div>
    `;

    // Append to panel (adjust selector based on your structure)
    $('#rpg-companion-panel .rpg-panel-content').append(characterStateHtml);

    // ... rest of UI initialization ...
}

// ============================================================================
// STEP 3: Hook into message received event
// ============================================================================

async function onMessageReceived(data) {
    if (!extensionSettings.enabled) return;

    console.log('[Character Tracking] Processing message:', data.mes.substring(0, 100));

    try {
        // Parse and apply character state updates from the LLM response
        const stateUpdate = parseAndApplyCharacterStateUpdate(data.mes);

        if (stateUpdate) {
            console.log('[Character Tracking] State updated successfully');

            // Update the UI to reflect new character state
            updateCharacterStateDisplay();

            // Optionally remove the state block from the displayed message
            // so users don't see the raw tracking data
            if (extensionSettings.hideStateBlocks) {
                data.mes = removeCharacterStateBlock(data.mes);
            }

            // Save character state to chat metadata for persistence
            saveCharacterStateToChat();
        }
    } catch (error) {
        console.error('[Character Tracking] Error processing state update:', error);
    }

    // ... existing message received logic ...
}

// ============================================================================
// STEP 4: Hook into generation started event
// ============================================================================

async function onGenerationStarted(data) {
    if (!extensionSettings.enabled) return;

    try {
        // Get current character state summary
        const stateSummary = generateCharacterStateSummary();
        console.log('[Character Tracking] Current state summary:', stateSummary.substring(0, 200));

        // Generate character tracking instructions
        const trackingPrompt = generateCharacterTrackingPrompt();

        // Inject into the generation using SillyTavern's extension prompt system
        // This adds the character state context and tracking instructions to the LLM
        setExtensionPrompt(
            'RPG_CHARACTER_STATE_TRACKING',
            trackingPrompt,
            extension_prompt_types.IN_PROMPT, // or AFTER_SCENARIO depending on preference
            1000, // position (higher = later in prompt)
            false, // scan depth
            extension_prompt_roles.SYSTEM
        );

        console.log('[Character Tracking] Tracking prompt injected');
    } catch (error) {
        console.error('[Character Tracking] Error injecting tracking prompt:', error);
    }

    // ... existing generation started logic ...
}

// ============================================================================
// STEP 5: Chat changed event - load character state
// ============================================================================

async function onChatChanged() {
    if (!extensionSettings.enabled) return;

    try {
        // Load character state from chat metadata
        loadCharacterStateFromChat();

        // Render the loaded state
        updateCharacterStateDisplay();

        console.log('[Character Tracking] Character state loaded for new chat');
    } catch (error) {
        console.error('[Character Tracking] Error loading character state:', error);
    }

    // ... existing chat changed logic ...
}

// ============================================================================
// STEP 6: Persistence functions
// ============================================================================

/**
 * Save character state to chat metadata
 */
function saveCharacterStateToChat() {
    const charState = getCharacterState();

    // Store in SillyTavern's chat metadata
    if (!chat_metadata.rpg_extension) {
        chat_metadata.rpg_extension = {};
    }

    chat_metadata.rpg_extension.character_state = charState;

    // Save chat metadata
    saveChatDebounced();

    console.log('[Character Tracking] Character state saved to chat metadata');
}

/**
 * Load character state from chat metadata
 */
function loadCharacterStateFromChat() {
    if (chat_metadata.rpg_extension && chat_metadata.rpg_extension.character_state) {
        const savedState = chat_metadata.rpg_extension.character_state;
        setCharacterState(savedState);
        console.log('[Character Tracking] Character state loaded from chat metadata');
    } else {
        console.log('[Character Tracking] No saved character state found, using defaults');
        // Optionally initialize from character card
        // initializeCharacterFromCard();
    }
}

// ============================================================================
// STEP 7: Optional - Initialize character from card
// ============================================================================

/**
 * Initialize character personality traits from their character card
 * Call this when starting a new chat or when no state exists
 */
async function initializeCharacterFromCard() {
    try {
        console.log('[Character Tracking] Initializing character from card...');

        // Generate initialization prompt
        const prompt = await generateCharacterInitializationPrompt();

        // Send to LLM (adjust based on your API setup)
        const messages = [{ role: 'user', content: prompt }];
        const response = await generateRaw(messages, 'openai', false); // or your API

        // Parse response
        const traits = parseCharacterInitialization(response);

        if (traits) {
            // Apply to character state
            updateCharacterState({ primaryTraits: traits });
            console.log('[Character Tracking] Character initialized with traits:', traits);

            // Save and update display
            saveCharacterStateToChat();
            updateCharacterStateDisplay();
        }
    } catch (error) {
        console.error('[Character Tracking] Failed to initialize character:', error);
    }
}

// ============================================================================
// STEP 8: Optional - Settings UI additions
// ============================================================================

/**
 * Add character tracking settings to the extension settings panel
 * Add this to your addExtensionSettings() function
 */
function addCharacterTrackingSettings() {
    const settingsHtml = `
        <div class="rpg-settings-section">
            <h3>Character State Tracking</h3>

            <label class="checkbox_label" for="rpg-enable-character-tracking">
                <input type="checkbox" id="rpg-enable-character-tracking" />
                <span>Enable Character State Tracking</span>
            </label>

            <label class="checkbox_label" for="rpg-hide-state-blocks">
                <input type="checkbox" id="rpg-hide-state-blocks" />
                <span>Hide state update blocks from messages</span>
            </label>

            <label class="checkbox_label" for="rpg-auto-init-character">
                <input type="checkbox" id="rpg-auto-init-character" />
                <span>Auto-initialize character from card on new chats</span>
            </label>

            <div class="rpg-settings-row">
                <button id="rpg-init-character-now" class="menu_button">
                    Initialize Character Now
                </button>
                <button id="rpg-reset-character-state" class="menu_button">
                    Reset Character State
                </button>
            </div>
        </div>
    `;

    // Append to settings (adjust selector)
    $('#rpg-extension-settings').append(settingsHtml);

    // Set up event listeners
    $('#rpg-enable-character-tracking').prop('checked', extensionSettings.enableCharacterTracking || false)
        .on('change', function() {
            extensionSettings.enableCharacterTracking = $(this).prop('checked');
            saveSettings();
        });

    $('#rpg-hide-state-blocks').prop('checked', extensionSettings.hideStateBlocks || true)
        .on('change', function() {
            extensionSettings.hideStateBlocks = $(this).prop('checked');
            saveSettings();
        });

    $('#rpg-auto-init-character').prop('checked', extensionSettings.autoInitCharacter || false)
        .on('change', function() {
            extensionSettings.autoInitCharacter = $(this).prop('checked');
            saveSettings();
        });

    $('#rpg-init-character-now').on('click', function() {
        initializeCharacterFromCard();
    });

    $('#rpg-reset-character-state').on('click', function() {
        if (confirm('Are you sure you want to reset the character state? This cannot be undone.')) {
            resetCharacterState();
            saveCharacterStateToChat();
            updateCharacterStateDisplay();
            toastr.success('Character state reset');
        }
    });
}

// ============================================================================
// STEP 9: Register events in main initialization
// ============================================================================

jQuery(async () => {
    // ... existing initialization ...

    // Register character tracking events
    registerAllEvents({
        [event_types.MESSAGE_RECEIVED]: onMessageReceived,
        [event_types.GENERATION_STARTED]: onGenerationStarted,
        [event_types.CHAT_CHANGED]: onChatChanged,
        // ... other events ...
    });

    // Initialize character state display
    if (extensionSettings.enableCharacterTracking) {
        updateCharacterStateDisplay();
    }

    console.log('[Character Tracking] ✅ Character tracking system initialized');
});

// ============================================================================
// USAGE EXAMPLES
// ============================================================================

// Example 1: Get current character emotional state
function getCurrentMood() {
    const charState = getCharacterState();
    const emotions = charState.secondaryStates;

    // Find dominant emotion
    let dominantEmotion = 'neutral';
    let highestValue = 50;

    for (const [emotion, value] of Object.entries(emotions)) {
        if (value > highestValue) {
            dominantEmotion = emotion;
            highestValue = value;
        }
    }

    return { emotion: dominantEmotion, intensity: highestValue };
}

// Example 2: Check relationship with user
function getRelationshipWithUser() {
    const userName = getContext().name1;
    const relationship = getRelationship(userName);

    return {
        trust: relationship.trust,
        love: relationship.love,
        attraction: relationship.attraction,
        thoughts: relationship.currentThoughts,
        status: relationship.relationshipStatus
    };
}

// Example 3: Manually update character state
function makeCharacterHappy(amount, reason) {
    const charState = getCharacterState();
    const currentHappy = charState.secondaryStates.happy || 0;
    const newHappy = Math.min(100, currentHappy + amount);

    updateCharacterState({
        secondaryStates: {
            ...charState.secondaryStates,
            happy: newHappy
        }
    });

    console.log(`[Character Tracking] Happiness increased by ${amount}: ${reason}`);
    saveCharacterStateToChat();
    updateCharacterStateDisplay();
}

// Example 4: Check if character is in specific emotional state
function isCharacterEmotionallyAvailable() {
    const charState = getCharacterState();
    const states = charState.secondaryStates;

    // Character is emotionally available if:
    // - Not too stressed or anxious
    // - Not too sad or angry
    // - Has some positive emotions

    const stressed = states.stressed || 0;
    const anxious = states.anxious || 0;
    const sad = states.sad || 0;
    const angry = states.angry || 0;
    const happy = states.happy || 0;

    const negativeEmotions = stressed + anxious + sad + angry;
    const isAvailable = negativeEmotions < 150 && happy > 20;

    return isAvailable;
}

// ============================================================================
// ADVANCED: Separate mode for character tracking
// ============================================================================

/**
 * If you want to use SEPARATE mode (track character state in a separate API call)
 * instead of TOGETHER mode (track in same generation)
 */
async function updateCharacterStatesSeparately() {
    try {
        // Generate separate tracking prompt with chat history
        const messages = await generateSeparateCharacterTrackingPrompt();

        // Call LLM with tracking-specific preset
        const response = await generateRaw(messages, 'openai', false);

        // Parse and apply updates
        const stateUpdate = parseAndApplyCharacterStateUpdate(response);

        if (stateUpdate) {
            saveCharacterStateToChat();
            updateCharacterStateDisplay();
        }
    } catch (error) {
        console.error('[Character Tracking] Separate update failed:', error);
    }
}

// Call this after each message if using separate mode
// onMessageReceived -> updateCharacterStatesSeparately()
