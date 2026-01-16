/**
 * Character Brain UI Module
 * Provides user interface for managing per-character LLM configurations
 */

import { getContext } from '../../../../../../extensions.js';
import { extensionSettings } from '../../core/state.js';
import { saveSettings } from '../../core/persistence.js';
import { i18n } from '../../core/i18n.js';
import {
    getCharacterBrain,
    setCharacterBrain,
    removeCharacterBrain,
    getAllCharacterBrains,
    hasCustomBrain,
    testCharacterBrain,
    initCharacterBrains,
    PROVIDERS,
    PROVIDER_CONFIGS,
    defaultBrainConfig,
    getProviderApiKey,
    setProviderApiKey,
    getBrainPresets,
    createBrainPreset,
    applyBrainPreset,
    deleteBrainPreset
} from '../features/characterBrain.js';
import {
    getCurrentContextCharacters,
    exportCharacterBrains,
    importCharacterBrains,
    exportBrainPresets,
    importBrainPresets
} from '../features/characterBrainStorage.js';

/**
 * Currently selected character ID in the brain editor
 * @type {string|null}
 */
let selectedCharacterId = null;

/**
 * Initializes the character brain UI
 * Should be called during extension initialization
 */
export function initCharacterBrainUI() {
    // Initialize the brain system
    initCharacterBrains();

    // Set up event listeners for the brain configuration modal
    setupBrainModalListeners();

    // console.log('[Character Brain UI] Initialized');
}

/**
 * Sets up event listeners for the brain configuration modal
 */
function setupBrainModalListeners() {
    // Provider dropdown change
    $(document).on('change', '#rpg-brain-provider', function() {
        const provider = $(this).val();
        updateProviderFields(provider);
    });

    // Enable toggle change
    $(document).on('change', '#rpg-brain-enabled', function() {
        const enabled = $(this).prop('checked');
        toggleBrainFields(enabled);
    });

    // Test connection button
    $(document).on('click', '#rpg-brain-test-connection', async function() {
        await testBrainConnection();
    });

    // Save button
    $(document).on('click', '#rpg-brain-save', function() {
        saveBrainConfiguration();
    });

    // Reset button
    $(document).on('click', '#rpg-brain-reset', function() {
        resetBrainConfiguration();
    });

    // Character selector change
    $(document).on('change', '#rpg-brain-character-select', function() {
        selectedCharacterId = $(this).val();
        loadBrainConfiguration(selectedCharacterId);
    });

    // API key visibility toggle
    $(document).on('click', '#rpg-brain-toggle-key-visibility', function() {
        const $input = $('#rpg-brain-api-key');
        const type = $input.attr('type') === 'password' ? 'text' : 'password';
        $input.attr('type', type);
        $(this).find('i').toggleClass('fa-eye fa-eye-slash');
    });

    // Preset save button
    $(document).on('click', '#rpg-brain-save-preset', function() {
        saveAsPreset();
    });

    // Preset apply button
    $(document).on('click', '#rpg-brain-apply-preset', function() {
        const presetId = $('#rpg-brain-preset-select').val();
        if (presetId) {
            applyPresetToCharacter(presetId);
        }
    });

    // Export brains button
    $(document).on('click', '#rpg-brain-export', function() {
        exportBrains();
    });

    // Import brains button
    $(document).on('click', '#rpg-brain-import', function() {
        $('#rpg-brain-import-file').click();
    });

    // Import file change
    $(document).on('change', '#rpg-brain-import-file', function(e) {
        importBrainsFromFile(e.target.files[0]);
    });
}

/**
 * Opens the character brain configuration modal
 * @param {string} characterId - Optional character ID to pre-select
 */
export function openBrainConfigModal(characterId = null) {
    // Create modal HTML
    const modalHtml = createBrainModalHtml();

    // Remove existing modal if present
    $('#rpg-brain-config-modal').remove();

    // Append modal to body
    $('body').append(modalHtml);

    // Initialize character selector
    populateCharacterSelector();

    // Load presets
    populatePresetSelector();

    // Select character if provided
    if (characterId) {
        $('#rpg-brain-character-select').val(characterId);
        selectedCharacterId = characterId;
    } else {
        selectedCharacterId = $('#rpg-brain-character-select').val();
    }

    // Load configuration for selected character
    loadBrainConfiguration(selectedCharacterId);

    // Show modal
    $('#rpg-brain-config-modal').fadeIn(200);
}

/**
 * Closes the brain configuration modal
 */
export function closeBrainConfigModal() {
    $('#rpg-brain-config-modal').fadeOut(200, function() {
        $(this).remove();
    });
}

/**
 * Creates the HTML for the brain configuration modal
 * @returns {string} Modal HTML
 */
function createBrainModalHtml() {
    const providers = Object.entries(PROVIDER_CONFIGS).map(([key, config]) => {
        return `<option value="${key}">${config.name}</option>`;
    }).join('');

    return `
    <div id="rpg-brain-config-modal" class="rpg-modal-overlay" style="display: none;">
        <div class="rpg-modal rpg-brain-modal">
            <div class="rpg-modal-header">
                <h3><i class="fa-solid fa-brain"></i> Character Brain Configuration</h3>
                <button class="rpg-modal-close" onclick="document.getElementById('rpg-brain-config-modal').remove();">
                    <i class="fa-solid fa-times"></i>
                </button>
            </div>
            <div class="rpg-modal-body">
                <!-- Character Selector -->
                <div class="rpg-form-group">
                    <label for="rpg-brain-character-select">Select Character:</label>
                    <select id="rpg-brain-character-select" class="rpg-select">
                        <!-- Populated dynamically -->
                    </select>
                </div>

                <!-- Enable Toggle -->
                <div class="rpg-form-group rpg-form-inline">
                    <label for="rpg-brain-enabled">Enable Custom Brain:</label>
                    <input type="checkbox" id="rpg-brain-enabled" />
                    <span class="rpg-help-text">When enabled, this character uses their own LLM instead of the default.</span>
                </div>

                <div id="rpg-brain-config-fields" style="display: none;">
                    <!-- Provider Selection -->
                    <div class="rpg-form-group">
                        <label for="rpg-brain-provider">Provider:</label>
                        <select id="rpg-brain-provider" class="rpg-select">
                            <option value="default">Use Default (SillyTavern)</option>
                            ${providers}
                        </select>
                    </div>

                    <!-- Endpoint (for local/custom) -->
                    <div class="rpg-form-group" id="rpg-brain-endpoint-group" style="display: none;">
                        <label for="rpg-brain-endpoint">API Endpoint:</label>
                        <input type="text" id="rpg-brain-endpoint" class="rpg-input"
                               placeholder="http://localhost:1234/v1" />
                        <span class="rpg-help-text">OpenAI-compatible API endpoint URL</span>
                    </div>

                    <!-- API Key -->
                    <div class="rpg-form-group" id="rpg-brain-api-key-group" style="display: none;">
                        <label for="rpg-brain-api-key">API Key:</label>
                        <div class="rpg-input-group">
                            <input type="password" id="rpg-brain-api-key" class="rpg-input"
                                   placeholder="sk-..." />
                            <button id="rpg-brain-toggle-key-visibility" class="rpg-btn rpg-btn-icon" type="button">
                                <i class="fa-solid fa-eye"></i>
                            </button>
                        </div>
                        <span class="rpg-help-text">Stored securely in browser localStorage</span>
                    </div>

                    <!-- Model Selection -->
                    <div class="rpg-form-group">
                        <label for="rpg-brain-model">Model:</label>
                        <input type="text" id="rpg-brain-model" class="rpg-input"
                               placeholder="gpt-4o-mini" />
                        <span class="rpg-help-text">Model identifier (e.g., gpt-4o-mini, claude-3-haiku)</span>
                    </div>

                    <!-- Temperature -->
                    <div class="rpg-form-row">
                        <div class="rpg-form-group rpg-form-half">
                            <label for="rpg-brain-temperature">Temperature:</label>
                            <input type="number" id="rpg-brain-temperature" class="rpg-input"
                                   min="0" max="2" step="0.1" value="0.7" />
                        </div>
                        <div class="rpg-form-group rpg-form-half">
                            <label for="rpg-brain-max-tokens">Max Tokens:</label>
                            <input type="number" id="rpg-brain-max-tokens" class="rpg-input"
                                   min="100" max="128000" step="100" value="2048" />
                        </div>
                    </div>

                    <!-- Advanced Settings Collapsible -->
                    <details class="rpg-details">
                        <summary>Advanced Settings</summary>
                        <div class="rpg-form-row">
                            <div class="rpg-form-group rpg-form-half">
                                <label for="rpg-brain-top-p">Top P:</label>
                                <input type="number" id="rpg-brain-top-p" class="rpg-input"
                                       min="0" max="1" step="0.05" value="1" />
                            </div>
                            <div class="rpg-form-group rpg-form-half">
                                <label for="rpg-brain-context-window">Context Window:</label>
                                <input type="number" id="rpg-brain-context-window" class="rpg-input"
                                       min="512" max="200000" step="512" value="4096" />
                            </div>
                        </div>
                        <div class="rpg-form-row">
                            <div class="rpg-form-group rpg-form-half">
                                <label for="rpg-brain-presence-penalty">Presence Penalty:</label>
                                <input type="number" id="rpg-brain-presence-penalty" class="rpg-input"
                                       min="-2" max="2" step="0.1" value="0" />
                            </div>
                            <div class="rpg-form-group rpg-form-half">
                                <label for="rpg-brain-frequency-penalty">Frequency Penalty:</label>
                                <input type="number" id="rpg-brain-frequency-penalty" class="rpg-input"
                                       min="-2" max="2" step="0.1" value="0" />
                            </div>
                        </div>
                    </details>

                    <!-- System Prompt Override -->
                    <div class="rpg-form-group">
                        <label for="rpg-brain-system-prompt">System Prompt Override:</label>
                        <textarea id="rpg-brain-system-prompt" class="rpg-textarea" rows="4"
                                  placeholder="Optional: Override the system prompt for this character..."></textarea>
                        <span class="rpg-help-text">Leave empty to use the default system prompt</span>
                    </div>

                    <!-- Memory Options -->
                    <div class="rpg-form-row">
                        <div class="rpg-form-group rpg-form-half rpg-form-inline">
                            <input type="checkbox" id="rpg-brain-memory-enabled" checked />
                            <label for="rpg-brain-memory-enabled">Enable Memory</label>
                        </div>
                        <div class="rpg-form-group rpg-form-half rpg-form-inline">
                            <input type="checkbox" id="rpg-brain-journal-enabled" />
                            <label for="rpg-brain-journal-enabled">Enable Journal</label>
                        </div>
                    </div>
                </div>

                <!-- Presets Section -->
                <details class="rpg-details">
                    <summary>Brain Presets</summary>
                    <div class="rpg-form-group">
                        <label for="rpg-brain-preset-select">Apply Preset:</label>
                        <div class="rpg-input-group">
                            <select id="rpg-brain-preset-select" class="rpg-select">
                                <option value="">-- Select a Preset --</option>
                            </select>
                            <button id="rpg-brain-apply-preset" class="rpg-btn rpg-btn-sm">Apply</button>
                        </div>
                    </div>
                    <div class="rpg-form-group">
                        <button id="rpg-brain-save-preset" class="rpg-btn rpg-btn-secondary rpg-btn-sm">
                            <i class="fa-solid fa-save"></i> Save Current as Preset
                        </button>
                    </div>
                </details>

                <!-- Import/Export Section -->
                <details class="rpg-details">
                    <summary>Import / Export</summary>
                    <div class="rpg-form-row">
                        <button id="rpg-brain-export" class="rpg-btn rpg-btn-secondary rpg-btn-sm">
                            <i class="fa-solid fa-file-export"></i> Export All Brains
                        </button>
                        <button id="rpg-brain-import" class="rpg-btn rpg-btn-secondary rpg-btn-sm">
                            <i class="fa-solid fa-file-import"></i> Import Brains
                        </button>
                        <input type="file" id="rpg-brain-import-file" accept=".json" style="display: none;" />
                    </div>
                </details>

                <!-- Test Result -->
                <div id="rpg-brain-test-result" class="rpg-message" style="display: none;"></div>
            </div>
            <div class="rpg-modal-footer">
                <button id="rpg-brain-test-connection" class="rpg-btn rpg-btn-secondary">
                    <i class="fa-solid fa-plug"></i> Test Connection
                </button>
                <button id="rpg-brain-reset" class="rpg-btn rpg-btn-danger">
                    <i class="fa-solid fa-trash"></i> Reset
                </button>
                <button id="rpg-brain-save" class="rpg-btn rpg-btn-primary">
                    <i class="fa-solid fa-save"></i> Save
                </button>
            </div>
        </div>
    </div>`;
}

/**
 * Populates the character selector with available characters
 */
function populateCharacterSelector() {
    const $select = $('#rpg-brain-character-select');
    $select.empty();

    const characters = getCurrentContextCharacters();

    if (characters.length === 0) {
        $select.append('<option value="">No characters available</option>');
        return;
    }

    for (const char of characters) {
        const hasBrain = hasCustomBrain(char.id);
        const suffix = hasBrain ? ' [Custom Brain]' : '';
        $select.append(`<option value="${char.id}">${char.name}${suffix}</option>`);
    }

    // Also add option to configure a custom character by name
    $select.append('<option value="_custom_">-- Enter Custom Name --</option>');
}

/**
 * Populates the preset selector with available presets
 */
function populatePresetSelector() {
    const $select = $('#rpg-brain-preset-select');
    $select.empty();
    $select.append('<option value="">-- Select a Preset --</option>');

    const presets = getBrainPresets();

    for (const [id, preset] of Object.entries(presets)) {
        $select.append(`<option value="${id}">${preset.name}</option>`);
    }
}

/**
 * Loads brain configuration for a character into the form
 * @param {string} characterId - Character ID
 */
function loadBrainConfiguration(characterId) {
    if (!characterId) return;

    const brain = getCharacterBrain(characterId);

    // Set enabled state
    $('#rpg-brain-enabled').prop('checked', brain.enabled);
    toggleBrainFields(brain.enabled);

    // Set provider
    $('#rpg-brain-provider').val(brain.provider);
    updateProviderFields(brain.provider);

    // Set fields
    $('#rpg-brain-endpoint').val(brain.endpoint);
    $('#rpg-brain-model').val(brain.model);
    $('#rpg-brain-temperature').val(brain.temperature);
    $('#rpg-brain-max-tokens').val(brain.maxTokens);
    $('#rpg-brain-top-p').val(brain.topP);
    $('#rpg-brain-context-window').val(brain.contextWindow);
    $('#rpg-brain-presence-penalty').val(brain.presencePenalty);
    $('#rpg-brain-frequency-penalty').val(brain.frequencyPenalty);
    $('#rpg-brain-system-prompt').val(brain.systemPromptOverride);
    $('#rpg-brain-memory-enabled').prop('checked', brain.memoryEnabled);
    $('#rpg-brain-journal-enabled').prop('checked', brain.journalEnabled);

    // Load API key if available
    if (brain.provider !== PROVIDERS.DEFAULT) {
        const apiKey = getProviderApiKey(brain.provider, brain.apiKeyEnvVar);
        $('#rpg-brain-api-key').val(apiKey);
    }

    // Clear test result
    $('#rpg-brain-test-result').hide();
}

/**
 * Saves the current brain configuration
 */
function saveBrainConfiguration() {
    if (!selectedCharacterId) {
        toastr.warning('Please select a character first');
        return;
    }

    const enabled = $('#rpg-brain-enabled').prop('checked');
    const provider = $('#rpg-brain-provider').val();

    // Build configuration object
    const config = {
        enabled: enabled,
        provider: provider,
        endpoint: $('#rpg-brain-endpoint').val().trim(),
        model: $('#rpg-brain-model').val().trim(),
        temperature: parseFloat($('#rpg-brain-temperature').val()) || 0.7,
        maxTokens: parseInt($('#rpg-brain-max-tokens').val()) || 2048,
        topP: parseFloat($('#rpg-brain-top-p').val()) || 1.0,
        contextWindow: parseInt($('#rpg-brain-context-window').val()) || 4096,
        presencePenalty: parseFloat($('#rpg-brain-presence-penalty').val()) || 0,
        frequencyPenalty: parseFloat($('#rpg-brain-frequency-penalty').val()) || 0,
        systemPromptOverride: $('#rpg-brain-system-prompt').val(),
        memoryEnabled: $('#rpg-brain-memory-enabled').prop('checked'),
        journalEnabled: $('#rpg-brain-journal-enabled').prop('checked')
    };

    // Save API key if provided
    const apiKey = $('#rpg-brain-api-key').val();
    if (apiKey && provider !== PROVIDERS.DEFAULT) {
        setProviderApiKey(provider, apiKey);
    }

    // Save configuration
    setCharacterBrain(selectedCharacterId, config);

    // Update character selector to show brain status
    populateCharacterSelector();
    $('#rpg-brain-character-select').val(selectedCharacterId);

    toastr.success('Brain configuration saved!');
}

/**
 * Resets brain configuration for the selected character
 */
function resetBrainConfiguration() {
    if (!selectedCharacterId) return;

    if (confirm('Are you sure you want to reset this character\'s brain configuration?')) {
        removeCharacterBrain(selectedCharacterId);
        loadBrainConfiguration(selectedCharacterId);
        populateCharacterSelector();
        $('#rpg-brain-character-select').val(selectedCharacterId);
        toastr.info('Brain configuration reset to default');
    }
}

/**
 * Tests the brain connection for the selected character
 */
async function testBrainConnection() {
    if (!selectedCharacterId) {
        toastr.warning('Please select a character first');
        return;
    }

    const $result = $('#rpg-brain-test-result');
    const $btn = $('#rpg-brain-test-connection');
    const originalHtml = $btn.html();

    // Save current config first
    saveBrainConfiguration();

    $btn.html('<i class="fa-solid fa-spinner fa-spin"></i> Testing...').prop('disabled', true);
    $result.hide().removeClass('rpg-success-message rpg-error-message');

    try {
        const result = await testCharacterBrain(selectedCharacterId);

        if (result.success) {
            $result.addClass('rpg-success-message')
                .html(`<i class="fa-solid fa-check-circle"></i> ${result.message}`)
                .slideDown();
            toastr.success(result.message);
        } else {
            $result.addClass('rpg-error-message')
                .html(`<i class="fa-solid fa-exclamation-circle"></i> ${result.message}`)
                .slideDown();
            toastr.error(result.message);
        }
    } catch (error) {
        $result.addClass('rpg-error-message')
            .html(`<i class="fa-solid fa-exclamation-circle"></i> Error: ${error.message}`)
            .slideDown();
    } finally {
        $btn.html(originalHtml).prop('disabled', false);
    }
}

/**
 * Updates the visibility of provider-specific fields
 * @param {string} provider - Selected provider
 */
function updateProviderFields(provider) {
    const config = PROVIDER_CONFIGS[provider];

    // Show/hide endpoint field
    if (provider === PROVIDERS.LOCAL || provider === PROVIDERS.CUSTOM) {
        $('#rpg-brain-endpoint-group').show();
        if (config?.endpoint) {
            $('#rpg-brain-endpoint').attr('placeholder', config.endpoint);
        }
    } else {
        $('#rpg-brain-endpoint-group').hide();
    }

    // Show/hide API key field
    if (config?.requiresKey) {
        $('#rpg-brain-api-key-group').show();
    } else {
        $('#rpg-brain-api-key-group').hide();
    }

    // Update model placeholder with common models
    if (config?.models && config.models.length > 0) {
        $('#rpg-brain-model').attr('placeholder', config.models[0]);
    }
}

/**
 * Toggles visibility of brain configuration fields
 * @param {boolean} enabled - Whether brain is enabled
 */
function toggleBrainFields(enabled) {
    if (enabled) {
        $('#rpg-brain-config-fields').slideDown(200);
    } else {
        $('#rpg-brain-config-fields').slideUp(200);
    }
}

/**
 * Saves current configuration as a preset
 */
function saveAsPreset() {
    const presetName = prompt('Enter a name for this preset:');
    if (!presetName || !presetName.trim()) return;

    const config = {
        provider: $('#rpg-brain-provider').val(),
        endpoint: $('#rpg-brain-endpoint').val().trim(),
        model: $('#rpg-brain-model').val().trim(),
        temperature: parseFloat($('#rpg-brain-temperature').val()) || 0.7,
        maxTokens: parseInt($('#rpg-brain-max-tokens').val()) || 2048,
        topP: parseFloat($('#rpg-brain-top-p').val()) || 1.0,
        contextWindow: parseInt($('#rpg-brain-context-window').val()) || 4096,
        presencePenalty: parseFloat($('#rpg-brain-presence-penalty').val()) || 0,
        frequencyPenalty: parseFloat($('#rpg-brain-frequency-penalty').val()) || 0,
        systemPromptOverride: $('#rpg-brain-system-prompt').val(),
        memoryEnabled: $('#rpg-brain-memory-enabled').prop('checked'),
        journalEnabled: $('#rpg-brain-journal-enabled').prop('checked')
    };

    createBrainPreset(presetName.trim(), config);
    populatePresetSelector();
    toastr.success(`Preset "${presetName}" saved!`);
}

/**
 * Applies a preset to the current character
 * @param {string} presetId - Preset ID to apply
 */
function applyPresetToCharacter(presetId) {
    if (!selectedCharacterId) {
        toastr.warning('Please select a character first');
        return;
    }

    applyBrainPreset(selectedCharacterId, presetId);
    loadBrainConfiguration(selectedCharacterId);
    toastr.success('Preset applied!');
}

/**
 * Exports all brain configurations to a JSON file
 */
function exportBrains() {
    const exportData = exportCharacterBrains();
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `character_brains_${Date.now()}.json`;
    a.click();

    URL.revokeObjectURL(url);
    toastr.success('Brain configurations exported!');
}

/**
 * Imports brain configurations from a file
 * @param {File} file - JSON file to import
 */
async function importBrainsFromFile(file) {
    if (!file) return;

    try {
        const text = await file.text();
        const importData = JSON.parse(text);

        const overwrite = confirm('Overwrite existing brain configurations with the same character?');
        const count = importCharacterBrains(importData, overwrite);

        populateCharacterSelector();
        toastr.success(`Imported ${count} brain configuration(s)!`);
    } catch (error) {
        toastr.error(`Import failed: ${error.message}`);
    }
}

/**
 * Adds the Character Brain button to the main panel settings
 */
export function addBrainConfigButton() {
    const buttonHtml = `
        <button id="rpg-open-brain-config" class="rpg-btn rpg-btn-secondary rpg-btn-sm" title="Configure per-character LLM brains">
            <i class="fa-solid fa-brain"></i> Character Brains
        </button>
    `;

    // Add to settings popup or main panel
    const $container = $('#rpg-settings-actions, #rpg-main-panel-actions');
    if ($container.length > 0 && !$('#rpg-open-brain-config').length) {
        $container.append(buttonHtml);
    }

    // Event listener
    $(document).on('click', '#rpg-open-brain-config', function() {
        openBrainConfigModal();
    });
}

// CSS styles for the brain configuration modal
const brainModalStyles = `
<style>
.rpg-brain-modal {
    max-width: 600px;
    width: 90%;
}

.rpg-brain-modal .rpg-form-group {
    margin-bottom: 12px;
}

.rpg-brain-modal .rpg-form-row {
    display: flex;
    gap: 12px;
}

.rpg-brain-modal .rpg-form-half {
    flex: 1;
}

.rpg-brain-modal .rpg-form-inline {
    display: flex;
    align-items: center;
    gap: 8px;
}

.rpg-brain-modal .rpg-input-group {
    display: flex;
    gap: 4px;
}

.rpg-brain-modal .rpg-input-group .rpg-input,
.rpg-brain-modal .rpg-input-group .rpg-select {
    flex: 1;
}

.rpg-brain-modal .rpg-help-text {
    display: block;
    font-size: 11px;
    opacity: 0.7;
    margin-top: 4px;
}

.rpg-brain-modal .rpg-details {
    margin: 12px 0;
    padding: 8px;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 4px;
}

.rpg-brain-modal .rpg-details summary {
    cursor: pointer;
    font-weight: 500;
    padding: 4px;
}

.rpg-brain-modal .rpg-details[open] summary {
    margin-bottom: 8px;
}

.rpg-brain-modal .rpg-message {
    padding: 8px 12px;
    border-radius: 4px;
    margin-top: 12px;
}

.rpg-brain-modal .rpg-success-message {
    background: rgba(51, 204, 102, 0.2);
    border: 1px solid #33cc66;
    color: #33cc66;
}

.rpg-brain-modal .rpg-error-message {
    background: rgba(204, 51, 51, 0.2);
    border: 1px solid #cc3333;
    color: #cc3333;
}

.rpg-brain-modal .rpg-btn-icon {
    padding: 8px;
    min-width: 36px;
}

.rpg-brain-modal .rpg-textarea {
    width: 100%;
    min-height: 80px;
    resize: vertical;
}
</style>
`;

// Inject styles when module loads
if (!document.getElementById('rpg-brain-modal-styles')) {
    const styleElement = document.createElement('div');
    styleElement.id = 'rpg-brain-modal-styles';
    styleElement.innerHTML = brainModalStyles;
    document.head.appendChild(styleElement);
}
