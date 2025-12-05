import { getContext, renderExtensionTemplateAsync, extension_settings as st_extension_settings } from '../../../extensions.js';
import { eventSource, event_types, substituteParams, chat, generateRaw, saveSettingsDebounced, chat_metadata, saveChatDebounced, user_avatar, getThumbnailUrl, characters, this_chid, extension_prompt_types, extension_prompt_roles, setExtensionPrompt, reloadCurrentChat, Generate, getRequestHeaders } from '../../../../script.js';
import { selected_group, getGroupMembers } from '../../../group-chats.js';
import { power_user } from '../../../power-user.js';

// Core modules
import { extensionName, extensionFolderPath } from './src/core/config.js';
import { i18n } from './src/core/i18n.js';
import {
    extensionSettings,
    lastGeneratedData,
    committedTrackerData,
    lastActionWasSwipe,
    isGenerating,
    isPlotProgression,
    pendingDiceRoll,
    FALLBACK_AVATAR_DATA_URI,
    $panelContainer,
    $userStatsContainer,
    $infoBoxContainer,
    $thoughtsContainer,
    $inventoryContainer,
    $questsContainer,
    setExtensionSettings,
    updateExtensionSettings,
    setLastGeneratedData,
    updateLastGeneratedData,
    setCommittedTrackerData,
    updateCommittedTrackerData,
    setLastActionWasSwipe,
    setIsGenerating,
    setIsPlotProgression,
    setPendingDiceRoll,
    setPanelContainer,
    setUserStatsContainer,
    setInfoBoxContainer,
    setThoughtsContainer,
    setInventoryContainer,
    setQuestsContainer
} from './src/core/state.js';
import { loadSettings, saveSettings, saveChatData, loadChatData, updateMessageSwipeData } from './src/core/persistence.js';
import { registerAllEvents } from './src/core/events.js';

// Generation & Parsing modules
import {
    generateTrackerExample,
    generateTrackerInstructions,
    generateContextualSummary,
    generateRPGPromptText,
    generateSeparateUpdatePrompt
} from './src/systems/generation/promptBuilder.js';
import { parseResponse, parseUserStats } from './src/systems/generation/parser.js';
import { updateRPGData } from './src/systems/generation/apiClient.js';
import { onGenerationStarted } from './src/systems/generation/injector.js';

// Rendering modules
import { getSafeThumbnailUrl } from './src/utils/avatars.js';
import { renderUserStats } from './src/systems/rendering/userStats.js';
import { renderInfoBox, updateInfoBoxField } from './src/systems/rendering/infoBox.js';
import {
    renderThoughts,
    updateCharacterField,
    updateChatThoughts,
    createThoughtPanel
} from './src/systems/rendering/thoughts.js';
import { renderInventory } from './src/systems/rendering/inventory.js';
import { renderQuests } from './src/systems/rendering/quests.js';

// Interaction modules
import { initInventoryEventListeners } from './src/systems/interaction/inventoryActions.js';

// UI Systems modules
import {
    applyTheme,
    applyCustomTheme,
    toggleCustomColors,
    toggleAnimations,
    updateSettingsPopupTheme,
    applyCustomThemeToSettingsPopup
} from './src/systems/ui/theme.js';
import {
    DiceModal,
    SettingsModal,
    setupDiceRoller,
    setupSettingsPopup,
    updateDiceDisplay,
    addDiceQuickReply,
    getSettingsModal
} from './src/systems/ui/modals.js';
import {
    initTrackerEditor
} from './src/systems/ui/trackerEditor.js';
import {
    togglePlotButtons,
    updateCollapseToggleIcon,
    setupCollapseToggle,
    updatePanelVisibility,
    updateSectionVisibility,
    applyPanelPosition,
    updateGenerationModeUI
} from './src/systems/ui/layout.js';
import {
    setupMobileToggle,
    constrainFabToViewport,
    setupMobileTabs,
    removeMobileTabs,
    setupMobileKeyboardHandling,
    setupContentEditableScrolling,
    updateMobileTabLabels
} from './src/systems/ui/mobile.js';
import {
    setupDesktopTabs,
    removeDesktopTabs
} from './src/systems/ui/desktop.js';

// Feature modules
import { setupPlotButtons, sendPlotProgression } from './src/systems/features/plotProgression.js';
import { setupClassicStatsButtons } from './src/systems/features/classicStats.js';
import { ensureHtmlCleaningRegex, detectConflictingRegexScripts } from './src/systems/features/htmlCleaning.js';
import { setupMemoryRecollectionButton, updateMemoryRecollectionButton } from './src/systems/features/memoryRecollection.js';
import { initLorebookLimiter } from './src/systems/features/lorebookLimiter.js';
import { DEFAULT_HTML_PROMPT } from './src/systems/generation/promptBuilder.js';

// Integration modules
import {
    commitTrackerData,
    onMessageSent,
    onMessageReceived,
    onCharacterChanged,
    onMessageSwiped,
    updatePersonaAvatar,
    clearExtensionPrompts
} from './src/systems/integration/sillytavern.js';

// Character State Tracking modules (NEW)
import {
    getCharacterState,
    updateCharacterState,
    setCharacterState
} from './src/core/characterState.js';
import {
    generateCharacterTrackingPrompt
} from './src/systems/generation/characterPromptBuilder.js';
import {
    parseAndApplyCharacterStateUpdate,
    removeCharacterStateBlock
} from './src/systems/generation/characterParser.js';
import {
    renderCharacterStateOverview,
    updateCharacterStateDisplay
} from './src/systems/rendering/characterStateRenderer.js';

console.log('[Character Tracking] ✅ All character tracking modules imported successfully');

// Old state variable declarations removed - now imported from core modules
// (extensionSettings, lastGeneratedData, committedTrackerData, etc. are now in src/core/state.js)

// Utility functions removed - now imported from src/utils/avatars.js
// (getSafeThumbnailUrl)

// Persistence functions removed - now imported from src/core/persistence.js
// (loadSettings, saveSettings, saveChatData, loadChatData, updateMessageSwipeData)

// Theme functions removed - now imported from src/systems/ui/theme.js
// (applyTheme, applyCustomTheme, toggleCustomColors, toggleAnimations,
//  updateSettingsPopupTheme, applyCustomThemeToSettingsPopup)

// Layout functions removed - now imported from src/systems/ui/layout.js
// (togglePlotButtons, updateCollapseToggleIcon, setupCollapseToggle,
//  updatePanelVisibility, updateSectionVisibility, applyPanelPosition)
// Note: closeMobilePanelWithAnimation is only used internally by mobile.js

// Mobile UI functions removed - now imported from src/systems/ui/mobile.js
// (setupMobileToggle, constrainFabToViewport, setupMobileTabs, removeMobileTabs,
//  setupMobileKeyboardHandling, setupContentEditableScrolling)

/**
 * Updates UI elements that are dynamically generated and not covered by data-i18n-key.
 */
function updateDynamicLabels() {
    // Update "Refresh RPG Info" button, but only if it's not disabled
    const refreshBtn = document.getElementById('rpg-manual-update');
    if (refreshBtn && !refreshBtn.disabled) {
        const refreshText = i18n.getTranslation('template.mainPanel.refreshRpgInfo') || 'Refresh RPG Info';
        refreshBtn.innerHTML = `<i class="fa-solid fa-sync"></i> ${refreshText}`;
    }

    // Update "Last Roll" label
    updateDiceDisplay();

    // Update mobile tab labels
    updateMobileTabLabels();
}

/**
 * Adds the extension settings to the Extensions tab.
 */
async function addExtensionSettings() {
    // Load the HTML template for the settings
    const settingsHtml = await renderExtensionTemplateAsync(extensionName, 'settings');
    $('#extensions_settings2').append(settingsHtml);

    // Set up the enable/disable toggle
    $('#rpg-extension-enabled').prop('checked', extensionSettings.enabled).on('change', async function() {
        const wasEnabled = extensionSettings.enabled;
        extensionSettings.enabled = $(this).prop('checked');
        saveSettings();

        if (!extensionSettings.enabled && wasEnabled) {
            // Disabling extension - remove UI elements
            clearExtensionPrompts();
            updateChatThoughts(); // Remove thought bubbles

            // Remove panel and toggle buttons
            $('#rpg-companion-panel').remove();
            $('#rpg-mobile-toggle').remove();
            $('#rpg-collapse-toggle').remove();
            $('#rpg-debug-toggle').remove();
            $('#rpg-debug-panel').remove();
        } else if (extensionSettings.enabled && !wasEnabled) {
            // Enabling extension - initialize UI
            await initUI();
            loadChatData(); // Load chat data for current chat
            updateChatThoughts(); // Create thought bubbles if data exists
        }

        // Update Memory Recollection button visibility
        updateMemoryRecollectionButton();
    });

    // Set up language selector
    const langSelect = $('#rpg-companion-language-select');
    if (langSelect.length) {
        langSelect.val(i18n.currentLanguage);
        langSelect.on('change', async function() {
            const selectedLanguage = $(this).val();
            await i18n.setLanguage(selectedLanguage);
            // We need to re-apply translations to the settings panel specifically
            i18n.applyTranslations(document.getElementById('extensions_settings2'));
        });
    }
}

/**
 * Initializes the UI for the extension.
 */
async function initUI() {
    // Initialize i18n
    await i18n.init();

    // Only initialize UI if extension is enabled
    if (!extensionSettings.enabled) {
        console.log('[RPG Companion] Extension disabled - skipping UI initialization');
        return;
    }

    // Load the HTML template using SillyTavern's template system
    const templateHtml = await renderExtensionTemplateAsync(extensionName, 'template');

    // Append panel to body - positioning handled by CSS
    $('body').append(templateHtml);

    // Add mobile toggle button (FAB - Floating Action Button)
    const mobileToggleHtml = `
        <button id="rpg-mobile-toggle" class="rpg-mobile-toggle" title="Toggle RPG Panel">
            <i class="fa-solid fa-dice-d20"></i>
        </button>
    `;
    $('body').append(mobileToggleHtml);

    // Hide mobile toggle on desktop viewport (> 1000px)
    if (window.innerWidth > 1000) {
        $('#rpg-mobile-toggle').hide();
    }

    // Cache UI elements using state setters
    setPanelContainer($('#rpg-companion-panel'));
    setUserStatsContainer($('#rpg-user-stats'));
    setInfoBoxContainer($('#rpg-info-box'));
    setThoughtsContainer($('#rpg-thoughts'));
    setInventoryContainer($('#rpg-inventory'));
    setQuestsContainer($('#rpg-quests'));

    // Re-apply translations to the entire body to catch all new elements from the template
    i18n.applyTranslations(document.body);

    // Set up event listeners (enable/disable is handled in Extensions tab)
    $('#rpg-toggle-auto-update').on('change', function() {
        extensionSettings.autoUpdate = $(this).prop('checked');
        saveSettings();
    });

    $('#rpg-position-select').on('change', function() {
        extensionSettings.panelPosition = String($(this).val());
        saveSettings();
        applyPanelPosition();
        // Recreate thought bubbles to update their position
        updateChatThoughts();
    });

    $('#rpg-update-depth').on('change', function() {
        const value = $(this).val();
        extensionSettings.updateDepth = parseInt(String(value));
        saveSettings();
    });

    $('#rpg-memory-messages').on('change', function() {
        const value = $(this).val();
        extensionSettings.memoryMessagesToProcess = parseInt(String(value));
        saveSettings();
    });

    $('#rpg-generation-mode').on('change', function() {
        extensionSettings.generationMode = String($(this).val());
        saveSettings();
        updateGenerationModeUI();
    });

    $('#rpg-use-separate-preset').on('change', function() {
        extensionSettings.useSeparatePreset = $(this).prop('checked');
        saveSettings();
    });

    $('#rpg-toggle-user-stats').on('change', function() {
        extensionSettings.showUserStats = $(this).prop('checked');
        saveSettings();
        updateSectionVisibility();
    });

    $('#rpg-toggle-info-box').on('change', function() {
        extensionSettings.showInfoBox = $(this).prop('checked');
        saveSettings();
        updateSectionVisibility();
    });

    $('#rpg-toggle-thoughts').on('change', function() {
        extensionSettings.showCharacterThoughts = $(this).prop('checked');
        saveSettings();
        updateSectionVisibility();
    });

    $('#rpg-toggle-inventory').on('change', function() {
        extensionSettings.showInventory = $(this).prop('checked');
        saveSettings();
        updateSectionVisibility();
    });

    $('#rpg-toggle-thoughts-in-chat').on('change', function() {
        extensionSettings.showThoughtsInChat = $(this).prop('checked');
        // console.log('[RPG Companion] Toggle showThoughtsInChat changed to:', extensionSettings.showThoughtsInChat);
        saveSettings();
        updateChatThoughts();
    });

    $('#rpg-toggle-always-show-bubble').on('change', function() {
        extensionSettings.alwaysShowThoughtBubble = $(this).prop('checked');
        saveSettings();
        // Force immediate save to ensure setting is persisted before any other code runs
        const context = getContext();
        const extension_settings = context.extension_settings || context.extensionSettings;
        extension_settings[extensionName] = extensionSettings;
        // Re-render thoughts to apply the setting
        updateChatThoughts();
    });

    $('#rpg-toggle-html-prompt').on('change', function() {
        extensionSettings.enableHtmlPrompt = $(this).prop('checked');
        // console.log('[RPG Companion] Toggle enableHtmlPrompt changed to:', extensionSettings.enableHtmlPrompt);
        saveSettings();
    });

    $('#rpg-custom-html-prompt').on('input', function() {
        extensionSettings.customHtmlPrompt = $(this).val().trim();
        saveSettings();
    });

    $('#rpg-restore-default-html-prompt').on('click', function() {
        extensionSettings.customHtmlPrompt = '';
        $('#rpg-custom-html-prompt').val('');
        saveSettings();
        toastr.success('HTML prompt restored to default');
    });

    $('#rpg-skip-guided-mode').on('change', function() {
        extensionSettings.skipInjectionsForGuided = String($(this).val());
        saveSettings();
    });

    $('#rpg-toggle-plot-buttons').on('change', function() {
        extensionSettings.enablePlotButtons = $(this).prop('checked');
        // console.log('[RPG Companion] Toggle enablePlotButtons changed to:', extensionSettings.enablePlotButtons);
        saveSettings();
        togglePlotButtons();
    });

    $('#rpg-toggle-animations').on('change', function() {
        extensionSettings.enableAnimations = $(this).prop('checked');
        saveSettings();
        toggleAnimations();
    });

    $('#rpg-manual-update').on('click', async function() {
        if (!extensionSettings.enabled) {
            // console.log('[RPG Companion] Extension is disabled. Please enable it in the Extensions tab.');
            return;
        }
        await updateRPGData(renderUserStats, renderInfoBox, renderThoughts, renderInventory);
    });

    $('#rpg-stat-bar-color-low').on('change', function() {
        extensionSettings.statBarColorLow = String($(this).val());
        saveSettings();
        renderUserStats(); // Re-render with new colors
    });

    $('#rpg-stat-bar-color-high').on('change', function() {
        extensionSettings.statBarColorHigh = String($(this).val());
        saveSettings();
        renderUserStats(); // Re-render with new colors
    });

    // Theme selection
    $('#rpg-theme-select').on('change', function() {
        extensionSettings.theme = String($(this).val());
        saveSettings();
        applyTheme();
        toggleCustomColors();
        updateSettingsPopupTheme(getSettingsModal()); // Update popup theme instantly
        updateChatThoughts(); // Recreate thought bubbles with new theme
    });

    // Custom color pickers
    $('#rpg-custom-bg').on('change', function() {
        extensionSettings.customColors.bg = String($(this).val());
        saveSettings();
        if (extensionSettings.theme === 'custom') {
            applyCustomTheme();
            updateSettingsPopupTheme(getSettingsModal()); // Update popup theme instantly
            updateChatThoughts(); // Update thought bubbles
        }
    });

    $('#rpg-custom-accent').on('change', function() {
        extensionSettings.customColors.accent = String($(this).val());
        saveSettings();
        if (extensionSettings.theme === 'custom') {
            applyCustomTheme();
            updateSettingsPopupTheme(getSettingsModal()); // Update popup theme instantly
            updateChatThoughts(); // Update thought bubbles
        }
    });

    $('#rpg-custom-text').on('change', function() {
        extensionSettings.customColors.text = String($(this).val());
        saveSettings();
        if (extensionSettings.theme === 'custom') {
            applyCustomTheme();
            updateSettingsPopupTheme(getSettingsModal()); // Update popup theme instantly
            updateChatThoughts(); // Update thought bubbles
        }
    });

    $('#rpg-custom-highlight').on('change', function() {
        extensionSettings.customColors.highlight = String($(this).val());
        saveSettings();
        if (extensionSettings.theme === 'custom') {
            applyCustomTheme();
            updateSettingsPopupTheme(getSettingsModal()); // Update popup theme instantly
            updateChatThoughts(); // Update thought bubbles
        }
    });

    // Initialize UI state (enable/disable is in Extensions tab)
    $('#rpg-toggle-auto-update').prop('checked', extensionSettings.autoUpdate);
    $('#rpg-position-select').val(extensionSettings.panelPosition);
    $('#rpg-update-depth').val(extensionSettings.updateDepth);
    $('#rpg-memory-messages').val(extensionSettings.memoryMessagesToProcess || 16);
    $('#rpg-use-separate-preset').prop('checked', extensionSettings.useSeparatePreset);
    $('#rpg-toggle-user-stats').prop('checked', extensionSettings.showUserStats);
    $('#rpg-toggle-info-box').prop('checked', extensionSettings.showInfoBox);
    $('#rpg-toggle-thoughts').prop('checked', extensionSettings.showCharacterThoughts);
    $('#rpg-toggle-inventory').prop('checked', extensionSettings.showInventory);
    $('#rpg-toggle-thoughts-in-chat').prop('checked', extensionSettings.showThoughtsInChat);
    $('#rpg-toggle-always-show-bubble').prop('checked', extensionSettings.alwaysShowThoughtBubble);
    $('#rpg-toggle-html-prompt').prop('checked', extensionSettings.enableHtmlPrompt);

    // Set default HTML prompt as actual text if no custom prompt exists
    $('#rpg-custom-html-prompt').val(extensionSettings.customHtmlPrompt || DEFAULT_HTML_PROMPT);

    $('#rpg-toggle-plot-buttons').prop('checked', extensionSettings.enablePlotButtons);    $('#rpg-toggle-plot-buttons').prop('checked', extensionSettings.enablePlotButtons);    $('#rpg-toggle-plot-buttons').prop('checked', extensionSettings.enablePlotButtons);
    $('#rpg-toggle-animations').prop('checked', extensionSettings.enableAnimations);
    $('#rpg-stat-bar-color-low').val(extensionSettings.statBarColorLow);
    $('#rpg-stat-bar-color-high').val(extensionSettings.statBarColorHigh);
    $('#rpg-theme-select').val(extensionSettings.theme);
    $('#rpg-custom-bg').val(extensionSettings.customColors.bg);
    $('#rpg-custom-accent').val(extensionSettings.customColors.accent);
    $('#rpg-custom-text').val(extensionSettings.customColors.text);
    $('#rpg-custom-highlight').val(extensionSettings.customColors.highlight);
    $('#rpg-generation-mode').val(extensionSettings.generationMode);
    $('#rpg-skip-guided-mode').val(extensionSettings.skipInjectionsForGuided);

    updatePanelVisibility();
    updateSectionVisibility();
    updateGenerationModeUI();
    applyTheme();
    applyPanelPosition();
    toggleCustomColors();
    toggleAnimations();

    // Setup mobile toggle button
    setupMobileToggle();

    // Setup desktop tabs (only on desktop viewport)
    if (window.innerWidth > 1000) {
        setupDesktopTabs();
    }

    // Setup collapse/expand toggle button
    setupCollapseToggle();

    // Render initial data if available
    renderUserStats();
    renderInfoBox();
    renderThoughts();
    renderInventory();
    renderQuests();
    updateDiceDisplay();
    setupDiceRoller();
    setupClassicStatsButtons();
    setupSettingsPopup();
    initTrackerEditor();
    addDiceQuickReply();
    setupPlotButtons(sendPlotProgression);
    setupMobileKeyboardHandling();
    setupContentEditableScrolling();
    initInventoryEventListeners();

    // Setup Memory Recollection button in World Info
    setupMemoryRecollectionButton();

    // Initialize Lorebook Limiter
    initLorebookLimiter();

    // Initialize character state display (NEW)
    // First, ensure the container exists (in case template.html didn't load)
    if ($('#rpg-character-state-container').length === 0) {
        console.log('[Character Tracking] Container not found, creating it dynamically...');

        // Try to add to existing content box
        const $contentBox = $('.rpg-content-box');
        if ($contentBox.length > 0) {
            $contentBox.append('<div id="rpg-character-state-container" class="rpg-section rpg-character-state-section"></div>');
            console.log('[Character Tracking] ✅ Container created dynamically');
        } else {
            console.warn('[Character Tracking] ❌ Could not find .rpg-content-box to add container');
        }
    }

    updateCharacterStateDisplay();
}





// Rendering functions removed - now imported from src/systems/rendering/*
// (renderUserStats, renderInfoBox, renderThoughts, updateInfoBoxField,
//  updateCharacterField, updateChatThoughts, createThoughtPanel)

// Event handlers removed - now imported from src/systems/integration/sillytavern.js
// (commitTrackerData, onMessageSent, onMessageReceived, onCharacterChanged,
//  onMessageSwiped, updatePersonaAvatar, clearExtensionPrompts)

// ============================================================================
// CHARACTER STATE TRACKING - Event Wrappers (NEW)
// ============================================================================

/**
 * Wrapper for onMessageReceived that adds character state tracking
 */
async function onMessageReceivedWithCharacterTracking(data) {
    // Call original handler first
    await onMessageReceived(data);

    // If extension is not enabled or character tracking not active, skip
    if (!extensionSettings.enabled) return;

    try {
        // Parse and apply character state updates from the LLM response
        const stateUpdate = parseAndApplyCharacterStateUpdate(data);

        if (stateUpdate) {
            console.log('[Character Tracking] State updated successfully');

            // Update the UI to show new character state
            updateCharacterStateDisplay();

            // Save character state to chat metadata
            saveCharacterStateToChat();

            // Optionally remove state block from displayed message
            // (uncomment if you want to hide the technical state blocks)
            // data.mes = removeCharacterStateBlock(data.mes);
        }
    } catch (error) {
        console.error('[Character Tracking] Error processing state update:', error);
    }
}

/**
 * Wrapper for onGenerationStarted that adds character state tracking prompt
 */
async function onGenerationStartedWithCharacterTracking(data) {
    // Call original handler first
    await onGenerationStarted(data);

    // If extension is not enabled, skip
    if (!extensionSettings.enabled) return;

    try {
        // Generate and inject character tracking prompt
        const trackingPrompt = generateCharacterTrackingPrompt();

        setExtensionPrompt(
            'RPG_CHARACTER_STATE_TRACKING',
            trackingPrompt,
            extension_prompt_types.IN_PROMPT,
            1000, // position (adjust as needed)
            false,
            extension_prompt_roles.SYSTEM
        );

        console.log('[Character Tracking] Tracking prompt injected');
    } catch (error) {
        console.error('[Character Tracking] Error injecting tracking prompt:', error);
    }
}

/**
 * Wrapper for onCharacterChanged that loads character state
 */
async function onCharacterChangedWithCharacterTracking(characterId) {
    // Call original handler first
    await onCharacterChanged(characterId);

    // If extension is not enabled, skip
    if (!extensionSettings.enabled) return;

    try {
        // Load character state from chat metadata
        loadCharacterStateFromChat();

        // Update display
        updateCharacterStateDisplay();

        console.log('[Character Tracking] Character state loaded for new chat');
    } catch (error) {
        console.error('[Character Tracking] Error loading character state:', error);
    }
}

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
    }
}

// ============================================================================
// END CHARACTER STATE TRACKING
// ============================================================================

/**
 * Ensures the "RPG Companion Trackers" preset exists in the user's OpenAI Settings.
 * Imports the preset file from the extension folder if it doesn't exist.
 */
async function ensureTrackerPresetExists() {
    try {
        const presetName = 'RPG Companion Trackers';

        // Check if preset already exists by fetching settings
        const checkResponse = await fetch('/api/settings/get', {
            method: 'POST',
            headers: getRequestHeaders()
        });

        if (checkResponse.ok) {
            const settings = await checkResponse.json();
            // openai_setting_names is an array of preset names
            if (settings.openai_setting_names && settings.openai_setting_names.includes(presetName)) {
                console.log(`[RPG Companion] Preset "${presetName}" already exists`);
                return;
            }
        }

        // Preset doesn't exist - import it from extension folder
        console.log(`[RPG Companion] Importing preset "${presetName}"...`);

        // Load preset from extension folder
        const extensionPresetPath = `${extensionFolderPath}/${presetName}.json`;
        const presetResponse = await fetch(`/${extensionPresetPath}`);

        if (!presetResponse.ok) {
            console.warn(`[RPG Companion] Could not load preset template from ${extensionPresetPath}`);
            return;
        }

        const presetData = await presetResponse.json();

        // Save preset to user's OpenAI Settings folder using SillyTavern's API
        const saveResponse = await fetch('/api/presets/save', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({
                apiId: 'openai',
                name: presetName,
                preset: presetData
            })
        });

        if (saveResponse.ok) {
            console.log(`[RPG Companion] ✅ Successfully imported preset "${presetName}"`);
            toastr.success(
                `The "RPG Companion Trackers" preset has been imported to your OpenAI Settings.`,
                'RPG Companion',
                { timeOut: 5000 }
            );
        } else {
            console.warn(`[RPG Companion] Failed to save preset: ${saveResponse.statusText}`);
        }
    } catch (error) {
        console.error('[RPG Companion] Error importing tracker preset:', error);
        // Non-critical - users can manually import if needed
    }
}

/**
 * Main initialization function.
 */
jQuery(async () => {
    try {
        console.log('========================================');
        console.log('🎭 RPG COMPANION v2.0.0 CHARACTER TRACKING');
        console.log('✅ NEW VERSION WITH CHARACTER STATE TRACKING LOADED!');
        console.log('========================================');
        console.log('[RPG Companion] Starting initialization...');

        // Load settings with validation
        try {
            loadSettings();
        } catch (error) {
            console.error('[RPG Companion] Settings load failed, continuing with defaults:', error);
        }

        // Initialize i18n early for the settings panel
        await i18n.init();

        // Set up a central listener for language changes to update dynamic UI parts
        i18n.addEventListener('languageChanged', updateDynamicLabels);

        // Add extension settings to Extensions tab
        try {
            await addExtensionSettings();
        } catch (error) {
            console.error('[RPG Companion] Failed to add extension settings tab:', error);
            // Don't throw - extension can still work without settings tab
        }

        // Initialize UI
        try {
            await initUI();
        } catch (error) {
            console.error('[RPG Companion] UI initialization failed:', error);
            throw error; // This is critical - can't continue without UI
        }

        // Load chat-specific data for current chat
        try {
            loadChatData();
        } catch (error) {
            console.error('[RPG Companion] Chat data load failed, using defaults:', error);
        }

        // Import the HTML cleaning regex if needed
        try {
            await ensureHtmlCleaningRegex(st_extension_settings, saveSettingsDebounced);
        } catch (error) {
            console.error('[RPG Companion] HTML regex import failed:', error);
            // Non-critical - continue without it
        }

        // Import the RPG Companion Trackers preset if needed
        try {
            await ensureTrackerPresetExists();
        } catch (error) {
            console.error('[RPG Companion] Preset import failed:', error);
            // Non-critical - users can manually import if needed
        }

        // Detect conflicting regex scripts from old manual formatters
        try {
            const conflicts = detectConflictingRegexScripts(st_extension_settings);
            if (conflicts.length > 0) {
                console.log('[RPG Companion] ⚠️ Detected old manual formatting regex scripts that may conflict:');
                conflicts.forEach(name => console.log(`  - ${name}`));
                console.log('[RPG Companion] Consider disabling these regexes as the extension now handles formatting automatically.');

                // Show user-friendly warning (non-blocking)
                // toastr.warning(
                //     `Found ${conflicts.length} old RPG formatting regex script(s). These may conflict with the extension. Check console for details.`,
                //     'RPG Companion Warning',
                //     { timeOut: 8000 }
                // );
            }
        } catch (error) {
            console.error('[RPG Companion] Conflict detection failed:', error);
            // Non-critical - continue anyway
        }

        // Register all event listeners (with character tracking wrappers)
        try {
            registerAllEvents({
                [event_types.MESSAGE_SENT]: onMessageSent,
                [event_types.GENERATION_STARTED]: onGenerationStartedWithCharacterTracking, // MODIFIED: Now uses character tracking wrapper
                [event_types.MESSAGE_RECEIVED]: onMessageReceivedWithCharacterTracking, // MODIFIED: Now uses character tracking wrapper
                [event_types.CHAT_CHANGED]: [onCharacterChangedWithCharacterTracking, updatePersonaAvatar], // MODIFIED: Now uses character tracking wrapper
                [event_types.MESSAGE_SWIPED]: onMessageSwiped,
                [event_types.USER_MESSAGE_RENDERED]: updatePersonaAvatar,
                [event_types.SETTINGS_UPDATED]: updatePersonaAvatar
            });
        } catch (error) {
            console.error('[RPG Companion] Event registration failed:', error);
            throw error; // This is critical - can't continue without events
        }

        console.log('[RPG Companion] ✅ Extension loaded successfully');
    } catch (error) {
        console.error('[RPG Companion] ❌ Critical initialization failure:', error);
        console.error('[RPG Companion] Error details:', error.message, error.stack);

        // Show user-friendly error message
        toastr.error(
            'RPG Companion failed to initialize. Check console for details. Please try refreshing the page or resetting extension settings.',
            'RPG Companion Error',
            { timeOut: 10000 }
        );
    }
});
