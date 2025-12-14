/**
 * Enhanced RPG Settings Module
 * Settings UI for the Katherine RPG character system
 *
 * Based on KATHERINE_RPG_MASTER_SPECIFICATION.txt
 * Version: 2.0.0
 */

import { extensionSettings, updateExtensionSettings } from '../../core/state.js';
import { saveSettings } from '../../core/persistence.js';
import {
    initializeCharacterSystem,
    renderEnhancedPanels,
    exportCharacterState,
    importCharacterState,
    resetCharacterState
} from '../integration/characterIntegration.js';
import { updateEnhancedTabVisibility } from './desktop.js';
import { DEFAULT_ANALYSIS_TEMPLATE, DEFAULT_ROLEPLAY_TEMPLATE } from '../../character/enhancedPromptBuilder.js';

/**
 * Default enhanced RPG settings
 */
export const DEFAULT_ENHANCED_SETTINGS = {
    enabled: true,  // Enabled by default to show the enhanced panels
    showEnhancedStats: true,
    showRelationships: true,
    showPriorities: true,
    showBiology: false,
    showHairGrowth: false,
    showOutfit: true,
    autoAnalyze: true,
    injectContext: true,
    compactMode: false,
    customThresholds: {},
    customPrompts: {
        analysisTemplate: '',
        roleplayTemplate: ''
    }
};

/**
 * Initialize enhanced settings with defaults
 */
export function initEnhancedSettings() {
    if (!extensionSettings.enhancedRPG) {
        extensionSettings.enhancedRPG = { ...DEFAULT_ENHANCED_SETTINGS };
        saveSettings();
    } else {
        // Merge with defaults to ensure all keys exist
        extensionSettings.enhancedRPG = {
            ...DEFAULT_ENHANCED_SETTINGS,
            ...extensionSettings.enhancedRPG
        };
    }
}

/**
 * Generate the enhanced settings HTML
 * @returns {string} HTML string
 */
export function generateEnhancedSettingsHTML() {
    const settings = extensionSettings.enhancedRPG || DEFAULT_ENHANCED_SETTINGS;

    return `
        <div class="rpg-enhanced-settings">
            <div class="enhanced-settings-header">
                <h4>Enhanced Character System</h4>
                <small>Based on Katherine RPG Master Specification v2.0</small>
            </div>

            <div class="enhanced-settings-section">
                <h5>Core Settings</h5>

                <label class="checkbox_label">
                    <input type="checkbox" id="rpg-enhanced-enabled" ${settings.enabled ? 'checked' : ''} />
                    <span>Enable Enhanced Character System</span>
                </label>

                <label class="checkbox_label">
                    <input type="checkbox" id="rpg-enhanced-auto-analyze" ${settings.autoAnalyze ? 'checked' : ''} />
                    <span>Auto-analyze responses for stat changes</span>
                </label>

                <label class="checkbox_label">
                    <input type="checkbox" id="rpg-enhanced-inject-context" ${settings.injectContext ? 'checked' : ''} />
                    <span>Inject character context into prompts</span>
                </label>

                <label class="checkbox_label">
                    <input type="checkbox" id="rpg-enhanced-compact-mode" ${settings.compactMode ? 'checked' : ''} />
                    <span>Use compact display mode</span>
                </label>
            </div>

            <div class="enhanced-settings-section">
                <h5>Display Options</h5>

                <label class="checkbox_label">
                    <input type="checkbox" id="rpg-show-enhanced-stats" ${settings.showEnhancedStats ? 'checked' : ''} />
                    <span>Show Enhanced Stats Panel (30 stats)</span>
                </label>

                <label class="checkbox_label">
                    <input type="checkbox" id="rpg-show-relationships" ${settings.showRelationships ? 'checked' : ''} />
                    <span>Show NPC Relationships Panel</span>
                </label>

                <label class="checkbox_label">
                    <input type="checkbox" id="rpg-show-priorities" ${settings.showPriorities ? 'checked' : ''} />
                    <span>Show Active Priorities</span>
                </label>

                <label class="checkbox_label">
                    <input type="checkbox" id="rpg-show-outfit" ${settings.showOutfit ? 'checked' : ''} />
                    <span>Show Outfit Tracking</span>
                </label>

                <label class="checkbox_label">
                    <input type="checkbox" id="rpg-show-biology" ${settings.showBiology ? 'checked' : ''} />
                    <span>Show Biology System (18+ content)</span>
                </label>

                <label class="checkbox_label">
                    <input type="checkbox" id="rpg-show-hair-growth" ${settings.showHairGrowth ? 'checked' : ''} />
                    <span>Show Hair Growth Tracking</span>
                </label>
            </div>

            <div class="enhanced-settings-section">
                <h5>Custom Prompts</h5>

                <div class="form-group">
                    <label for="rpg-custom-analysis-prompt">Analysis Prompt Template</label>
                    <textarea id="rpg-custom-analysis-prompt" class="text_pole" rows="6"
                        placeholder="Leave empty for default template...">${settings.customPrompts?.analysisTemplate || ''}</textarea>
                    <button id="rpg-restore-analysis-prompt" class="menu_button">Restore Default</button>
                </div>

                <div class="form-group">
                    <label for="rpg-custom-roleplay-prompt">Roleplay Context Template</label>
                    <textarea id="rpg-custom-roleplay-prompt" class="text_pole" rows="6"
                        placeholder="Leave empty for default template...">${settings.customPrompts?.roleplayTemplate || ''}</textarea>
                    <button id="rpg-restore-roleplay-prompt" class="menu_button">Restore Default</button>
                </div>
            </div>

            <div class="enhanced-settings-section">
                <h5>Data Management</h5>

                <div class="enhanced-data-buttons">
                    <button id="rpg-export-character-state" class="menu_button">
                        <i class="fa-solid fa-download"></i> Export State
                    </button>
                    <button id="rpg-import-character-state" class="menu_button">
                        <i class="fa-solid fa-upload"></i> Import State
                    </button>
                    <button id="rpg-reset-character-state" class="menu_button caution">
                        <i class="fa-solid fa-trash"></i> Reset State
                    </button>
                </div>

                <input type="file" id="rpg-import-file" accept=".json" style="display: none;" />
            </div>
        </div>
    `;
}

/**
 * Set up enhanced settings event listeners
 */
export function setupEnhancedSettingsListeners() {
    // Core settings
    $('#rpg-enhanced-enabled').on('change', async function() {
        extensionSettings.enhancedRPG.enabled = $(this).prop('checked');
        saveSettings();

        if (extensionSettings.enhancedRPG.enabled) {
            await initializeCharacterSystem();
        }

        // Update tab visibility and render panels
        updateEnhancedTabVisibility();
        renderEnhancedPanels();
    });

    $('#rpg-enhanced-auto-analyze').on('change', function() {
        extensionSettings.enhancedRPG.autoAnalyze = $(this).prop('checked');
        saveSettings();
    });

    $('#rpg-enhanced-inject-context').on('change', function() {
        extensionSettings.enhancedRPG.injectContext = $(this).prop('checked');
        saveSettings();
    });

    $('#rpg-enhanced-compact-mode').on('change', function() {
        extensionSettings.enhancedRPG.compactMode = $(this).prop('checked');
        saveSettings();
        renderEnhancedPanels({ compact: extensionSettings.enhancedRPG.compactMode });
    });

    // Display options
    $('#rpg-show-enhanced-stats').on('change', function() {
        extensionSettings.enhancedRPG.showEnhancedStats = $(this).prop('checked');
        saveSettings();
        renderEnhancedPanels();
    });

    $('#rpg-show-relationships').on('change', function() {
        extensionSettings.enhancedRPG.showRelationships = $(this).prop('checked');
        saveSettings();
        renderEnhancedPanels();
    });

    $('#rpg-show-priorities').on('change', function() {
        extensionSettings.enhancedRPG.showPriorities = $(this).prop('checked');
        saveSettings();
        renderEnhancedPanels();
    });

    $('#rpg-show-outfit').on('change', function() {
        extensionSettings.enhancedRPG.showOutfit = $(this).prop('checked');
        saveSettings();
        renderEnhancedPanels();
    });

    $('#rpg-show-biology').on('change', function() {
        extensionSettings.enhancedRPG.showBiology = $(this).prop('checked');
        saveSettings();
        renderEnhancedPanels();
    });

    $('#rpg-show-hair-growth').on('change', function() {
        extensionSettings.enhancedRPG.showHairGrowth = $(this).prop('checked');
        saveSettings();
        renderEnhancedPanels();
    });

    // Custom prompts
    $('#rpg-custom-analysis-prompt').on('change', function() {
        if (!extensionSettings.enhancedRPG.customPrompts) {
            extensionSettings.enhancedRPG.customPrompts = {};
        }
        extensionSettings.enhancedRPG.customPrompts.analysisTemplate = $(this).val().trim();
        saveSettings();
    });

    $('#rpg-custom-roleplay-prompt').on('change', function() {
        if (!extensionSettings.enhancedRPG.customPrompts) {
            extensionSettings.enhancedRPG.customPrompts = {};
        }
        extensionSettings.enhancedRPG.customPrompts.roleplayTemplate = $(this).val().trim();
        saveSettings();
    });

    $('#rpg-restore-analysis-prompt').on('click', function() {
        $('#rpg-custom-analysis-prompt').val('');
        extensionSettings.enhancedRPG.customPrompts.analysisTemplate = '';
        saveSettings();
        toastr.success('Analysis prompt restored to default');
    });

    $('#rpg-restore-roleplay-prompt').on('click', function() {
        $('#rpg-custom-roleplay-prompt').val('');
        extensionSettings.enhancedRPG.customPrompts.roleplayTemplate = '';
        saveSettings();
        toastr.success('Roleplay prompt restored to default');
    });

    // Data management
    $('#rpg-export-character-state').on('click', function() {
        const stateJson = exportCharacterState();
        const blob = new Blob([stateJson], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rpg-enhanced-state-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toastr.success('Character state exported');
    });

    $('#rpg-import-character-state').on('click', function() {
        $('#rpg-import-file').click();
    });

    $('#rpg-import-file').on('change', async function(e) {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const success = await importCharacterState(text);

            if (success) {
                toastr.success('Character state imported successfully');
                renderEnhancedPanels();
            } else {
                toastr.error('Failed to import character state');
            }
        } catch (error) {
            console.error('[RPG Enhanced] Import error:', error);
            toastr.error('Error reading import file');
        }

        // Reset file input
        $(this).val('');
    });

    $('#rpg-reset-character-state').on('click', async function() {
        if (confirm('Are you sure you want to reset all character state? This cannot be undone.')) {
            await resetCharacterState();
            toastr.success('Character state reset to defaults');
        }
    });
}

/**
 * Generate CSS for enhanced settings
 * @returns {string} CSS string
 */
export function generateEnhancedSettingsCSS() {
    return `
        .rpg-enhanced-settings {
            padding: 10px;
        }

        .enhanced-settings-header {
            margin-bottom: 15px;
            border-bottom: 1px solid var(--SmartThemeBorderColor);
            padding-bottom: 10px;
        }

        .enhanced-settings-header h4 {
            margin: 0 0 5px 0;
            color: var(--SmartThemeBodyColor);
        }

        .enhanced-settings-header small {
            color: var(--SmartThemeQuoteColor);
        }

        .enhanced-settings-section {
            margin-bottom: 20px;
        }

        .enhanced-settings-section h5 {
            margin: 0 0 10px 0;
            color: var(--SmartThemeBodyColor);
            font-size: 0.9em;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .enhanced-settings-section .checkbox_label {
            display: flex;
            align-items: center;
            margin-bottom: 8px;
        }

        .enhanced-settings-section .form-group {
            margin-bottom: 15px;
        }

        .enhanced-settings-section .form-group label {
            display: block;
            margin-bottom: 5px;
            color: var(--SmartThemeBodyColor);
        }

        .enhanced-settings-section textarea.text_pole {
            width: 100%;
            resize: vertical;
            font-family: monospace;
            font-size: 12px;
        }

        .enhanced-data-buttons {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }

        .enhanced-data-buttons .menu_button {
            flex: 1;
            min-width: 120px;
        }

        .enhanced-data-buttons .menu_button.caution {
            background-color: var(--warning-color, #cc3333);
        }

        .enhanced-data-buttons .menu_button.caution:hover {
            background-color: var(--warning-color-dark, #aa2222);
        }
    `;
}
