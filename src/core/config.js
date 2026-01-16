/**
 * Core Configuration Module
 * Extension metadata and configuration constants
 */

// Type imports
/** @typedef {import('../types/inventory.js').InventoryV2} InventoryV2 */

export const extensionName = 'third-party/rpg-companion-sillytavern';

/**
 * Dynamically determine extension path based on current location
 * This supports both global (public/extensions) and user-specific (data/default-user/extensions) installations
 */
const currentScriptPath = import.meta.url;
const isUserExtension = currentScriptPath.includes('/data/') || currentScriptPath.includes('\\data\\');
export const extensionFolderPath = isUserExtension
    ? `data/default-user/extensions/${extensionName}`
    : `scripts/extensions/${extensionName}`;

/**
 * Default character brain configuration
 * Used when creating new character brains
 */
export const defaultBrainConfig = {
    provider: 'default',        // 'default' uses main chat model, or: 'openai', 'anthropic', 'local', 'custom'
    model: '',                  // Model name/ID (e.g., 'gpt-4o-mini', 'claude-3-haiku')
    apiKeyEnvVar: '',           // localStorage key for API key
    endpoint: '',               // Custom endpoint URL
    temperature: 0.7,           // Generation temperature
    maxTokens: 2048,            // Maximum tokens for generation
    systemPromptOverride: '',   // Optional custom system prompt
    memoryEnabled: true,        // Use vector memory
    journalEnabled: false,      // Character keeps a journal
    contextWindow: 4096,        // Context window size
    presencePenalty: 0,         // Presence penalty
    frequencyPenalty: 0,        // Frequency penalty
    topP: 1.0,                  // Top-p sampling
    stopSequences: [],          // Custom stop sequences
    enabled: false              // Whether custom brain is active
};

/**
 * Default extension settings
 */
export const defaultSettings = {
    enabled: true,
    autoUpdate: true,
    updateDepth: 4, // How many messages to include in the context
    generationMode: 'together', // 'separate' or 'together' - whether to generate with main response or separately
    showUserStats: true,
    showInfoBox: true,
    showCharacterThoughts: true,
    showInventory: true, // Show inventory section (v2 system)
    showQuests: true, // Show quests section
    showLockIcons: true, // Show lock/unlock icons on tracker items
    showThoughtsInChat: true, // Show thoughts overlay in chat
    enableHtmlPrompt: false, // Enable immersive HTML prompt injection
    enableSpotifyMusic: false, // Enable Spotify music integration (asks AI for Spotify URLs)
    customSpotifyPrompt: '', // Custom Spotify prompt text (empty = use default)
    // Controls when the extension skips injecting tracker instructions/examples/HTML
    // into generations that appear to be user-injected instructions. Valid values:
    //  - 'none'          -> never skip (legacy behavior: always inject)
    //  - 'guided'        -> skip for any guided / instruct or quiet_prompt generation
    //  - 'impersonation' -> skip only for impersonation-style guided generations
    // This setting helps compatibility with other extensions like GuidedGenerations.
    skipInjectionsForGuided: 'none',
    enablePlotButtons: true, // Show plot progression buttons above chat input
    saveTrackerHistory: false, // Save tracker data in chat history for each message
    panelPosition: 'right', // 'left', 'right', or 'top'
    theme: 'default', // Theme: default, sci-fi, fantasy, cyberpunk, custom
    customColors: {
        bg: '#1a1a2e',
        accent: '#16213e',
        text: '#eaeaea',
        highlight: '#e94560'
    },
    statBarColorLow: '#cc3333', // Color for low stat values (red)
    statBarColorHigh: '#33cc66', // Color for high stat values (green)
    enableAnimations: true, // Enable smooth animations for stats and content updates
    mobileFabPosition: {
        top: 'calc(var(--topBarBlockSize) + 60px)',
        right: '12px'
    }, // Saved position for mobile FAB button
    userStats: {
        health: 100,
        satiety: 100,
        energy: 100,
        hygiene: 100,
        arousal: 0,
        mood: '😐',
        conditions: 'None',
        /** @type {InventoryV2} */
        inventory: {
            version: 2,
            onPerson: "None",
            stored: {},
            assets: "None"
        }
    },
    classicStats: {
        str: 10,
        dex: 10,
        con: 10,
        int: 10,
        wis: 10,
        cha: 10
    },
    lastDiceRoll: null, // Store last dice roll result
    collapsedInventoryLocations: [], // Array of collapsed storage location names
    // Character Brain Configuration System
    enableMultiLLM: true, // Master toggle for multi-LLM feature
    characterBrains: {}, // Stored brain configs per character ID
    characterBrainPresets: {}, // Saved brain presets for quick application
    defaultBrainConfig: defaultBrainConfig // Default config for new brains
};
