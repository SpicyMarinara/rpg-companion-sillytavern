/**
 * Core State Management Module
 * Centralizes all extension state variables
 */

// Type imports
/** @typedef {import('../types/inventory.js').InventoryV2} InventoryV2 */

/**
 * Extension settings - persisted to SillyTavern settings
 */
export let extensionSettings = {
    settingsVersion: 3, // Version number for settings migrations (v3 = JSON format)
    enabled: true,
    autoUpdate: false,
    updateDepth: 4, // How many messages to include in the context
    generationMode: 'together', // 'separate' or 'together' - whether to generate with main response or separately
    showUserStats: true,
    showInfoBox: true,
    showCharacterThoughts: true,
    showInventory: true, // Show inventory section (v2 system)
    showQuests: true, // Show quests section
    showThoughtsInChat: true, // Show thoughts overlay in chat
    narratorMode: false, // Use character card as narrator instead of fixed character references
    customNarratorPrompt: '', // Custom narrator mode prompt text (empty = use default)
    enableHtmlPrompt: false, // Enable immersive HTML prompt injection
    customHtmlPrompt: '', // Custom HTML prompt text (empty = use default)
    enableDialogueColoring: false, // Enable dialogue coloring prompt injection
    customDialogueColoringPrompt: '', // Custom dialogue coloring prompt text (empty = use default)
    enableSpotifyMusic: false, // Enable Spotify music integration (asks AI for Spotify URLs)
    customSpotifyPrompt: '', // Custom Spotify prompt text (empty = use default)

    enableDynamicWeather: true, // Enable dynamic weather effects based on Info Box weather field (v2: enabled by default)
    dismissedHolidayPromo: false, // User dismissed the holiday promotion banner
    showHtmlToggle: true, // Show Immersive HTML toggle in main panel
    showDialogueColoringToggle: true, // Show Dialogue Coloring toggle in main panel (enabled by default)
    showSpotifyToggle: true, // Show Spotify Music toggle in main panel

    showDynamicWeatherToggle: true, // Show Dynamic Weather Effects toggle in main panel
    showNarratorMode: true, // Show Narrator Mode toggle in main panel
    showAutoAvatars: true, // Show Auto-generate Avatars toggle in main panel
    skipInjectionsForGuided: 'none', // skip injections for instruct injections and quiet prompts (GuidedGenerations compatibility)
    enableRandomizedPlot: true, // Show randomized plot progression button above chat input
    enableNaturalPlot: true, // Show natural plot progression button above chat input
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
    userStats: JSON.stringify({
        stats: [
            { id: 'health', name: 'Health', value: 100 },
            { id: 'satiety', name: 'Satiety', value: 100 },
            { id: 'energy', name: 'Energy', value: 100 },
            { id: 'hygiene', name: 'Hygiene', value: 100 },
            { id: 'arousal', name: 'Arousal', value: 0 }
        ],
        status: {
            mood: '😐',
            conditions: 'None'
        },
        inventory: {
            onPerson: [],
            stored: []
        },
        quests: {
            active: [],
            completed: []
        }
    }, null, 2),
    statNames: {
        health: 'Health',
        satiety: 'Satiety',
        energy: 'Energy',
        hygiene: 'Hygiene',
        arousal: 'Arousal'
    },
    // Tracker customization configuration
    trackerConfig: {
        userStats: {
            // Array of custom stats (allows add/remove/rename)
            customStats: [
                { id: 'health', name: 'Health', enabled: true },
                { id: 'satiety', name: 'Satiety', enabled: true },
                { id: 'energy', name: 'Energy', enabled: true },
                { id: 'hygiene', name: 'Hygiene', enabled: true },
                { id: 'arousal', name: 'Arousal', enabled: true }
            ],
            // RPG Attributes (customizable D&D-style attributes)
            showRPGAttributes: true,
            showLevel: true, // Show/hide level in UI and prompts
            alwaysSendAttributes: false, // If true, always send attributes; if false, only send with dice rolls
            rpgAttributes: [
                { id: 'str', name: 'STR', enabled: true },
                { id: 'dex', name: 'DEX', enabled: true },
                { id: 'con', name: 'CON', enabled: true },
                { id: 'int', name: 'INT', enabled: true },
                { id: 'wis', name: 'WIS', enabled: true },
                { id: 'cha', name: 'CHA', enabled: true }
            ],
            // Status section config
            statusSection: {
                enabled: true,
                showMoodEmoji: true,
                customFields: ['Conditions'] // User can edit what to track
            },
            // Optional skills field
            skillsSection: {
                enabled: false,
                label: 'Skills', // User-editable
                customFields: [] // Array of skill names
            }
        },
        infoBox: {
            widgets: {
                date: { enabled: true, format: 'Weekday, Month, Year' }, // Format options in UI
                weather: { enabled: true },
                temperature: { enabled: true, unit: 'C' }, // 'C' or 'F'
                time: { enabled: true },
                location: { enabled: true },
                recentEvents: { enabled: true }
            }
        },
        presentCharacters: {
            // Fixed fields (always shown)
            showEmoji: true,
            showName: true,
            // Relationship fields configuration
            relationships: {
                enabled: true,
                // Relationship to emoji mapping (shown on character portraits)
                relationshipEmojis: {
                    'Lover': '❤️',
                    'Friend': '⭐',
                    'Ally': '🤝',
                    'Enemy': '⚔️',
                    'Neutral': '⚖️'
                }
            },
            // Legacy fields kept for backward compatibility
            relationshipFields: ['Lover', 'Friend', 'Ally', 'Enemy', 'Neutral'],
            relationshipEmojis: {
                'Lover': '❤️',
                'Friend': '⭐',
                'Ally': '🤝',
                'Enemy': '⚔️',
                'Neutral': '⚖️'
            },
            // Custom fields (appearance, demeanor, etc. - shown after relationship, separated by |)
            customFields: [
                { id: 'appearance', name: 'Appearance', enabled: true, description: 'Visible physical appearance (clothing, hair, notable features)' },
                { id: 'demeanor', name: 'Demeanor', enabled: true, description: 'Observable demeanor or emotional state' }
            ],
            // Thoughts configuration (separate line)
            thoughts: {
                enabled: true,
                name: 'Thoughts',
                description: 'Internal monologue (in first person POV, up to three sentences long)'
            },
            // Character stats toggle (optional feature)
            characterStats: {
                enabled: false,
                customStats: [
                    { id: 'health', name: 'Health', enabled: true },
                    { id: 'arousal', name: 'Arousal', enabled: true }
                ]
            }
        }
    },
    quests: {
        main: "None",        // Current main quest title
        optional: []         // Array of optional quest titles
    },
    infoBox: JSON.stringify({
        date: { value: new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) },
        weather: { emoji: '☀️', forecast: 'Clear skies' },
        temperature: { value: 20, unit: 'C' },
        time: { start: '00:00', end: '00:00' },
        location: { value: 'Unknown Location' }
    }, null, 2),
    characterThoughts: JSON.stringify({
        characters: []
    }, null, 2),
    level: 1, // User's character level
    classicStats: {
        str: 10,
        dex: 10,
        con: 10,
        int: 10,
        wis: 10,
        cha: 10
    },
    lastDiceRoll: null, // Store last dice roll result
    showDiceDisplay: true, // Show the "Last Roll" display in the panel
    collapsedInventoryLocations: [], // Array of collapsed storage location names
    inventoryViewModes: {
        onPerson: 'list', // 'list' or 'grid' view mode for On Person section
        stored: 'list',   // 'list' or 'grid' view mode for Stored section
        assets: 'list'    // 'list' or 'grid' view mode for Assets section
    },
    npcAvatars: {}, // Store custom avatar images for NPCs (key: character name, value: base64 data URI)
    // Combat encounter settings
    encounterSettings: {
        enabled: true, // Show Start Encounter button above chat input
        historyDepth: 8, // Number of recent messages to include in combat initialization
        autoSaveLogs: false // Save detailed combat logs to file
    },
    // Auto avatar generation settings
    autoGenerateAvatars: true, // Master toggle for auto-generating avatars
    avatarLLMCustomInstruction: '', // Custom instruction for LLM prompt generation
    // External API settings for 'external' generation mode
    externalApiSettings: {
        baseUrl: '',           // OpenAI-compatible API base URL (e.g., "https://api.openai.com/v1")
        // apiKey is NOT stored here for security. It is stored in localStorage('rpg_companion_api_key')
        model: '',             // Model identifier (e.g., "gpt-4o-mini")
        maxTokens: 8192,       // Maximum tokens for generation
        temperature: 0.7       // Temperature setting for generation
    },
    // Lock state for tracker items (v3 JSON format feature)
    lockedItems: {
        stats: [],              // Array of locked stat IDs (e.g., ["health", "satiety"])
        skills: [],             // Array of locked skill names (e.g., ["Cooking", "Swordsmanship"])
        inventory: {
            onPerson: [],       // Array of locked item indices (e.g., [0, 2])
            clothing: [],       // Array of locked item indices
            stored: {},         // Object with location keys, each containing array of locked indices (e.g., {"Home": [0, 1]})
            assets: []          // Array of locked asset indices
        },
        quests: {
            main: false,        // Boolean for main quest lock
            optional: []        // Array of locked optional quest indices (e.g., [0, 2])
        },
        infoBox: {
            date: false,        // Boolean for date widget lock
            weather: false,     // Boolean for weather widget lock
            temperature: false, // Boolean for temperature widget lock
            time: false,        // Boolean for time widget lock
            location: false,    // Boolean for location widget lock
            recentEvents: false // Boolean for recent events widget lock
        },
        characters: {}          // Object mapping character names to their locked fields (e.g., {"Sarah": {relationship: true, thoughts: false}})
    }
};

/**
 * Last generated data from AI response
 */
export let lastGeneratedData = {
    userStats: null,
    infoBox: null,
    characterThoughts: null,
    html: null
};

/**
 * Tracks the "committed" tracker data that should be used as source for next generation
 * This gets updated when user sends a new message or first time generation
 */
export let committedTrackerData = {
    userStats: null,
    infoBox: null,
    characterThoughts: null
};

/**
 * Session-only storage for LLM-generated avatar prompts
 * Maps character names to their generated prompts
 * Resets on new chat (not persisted to extensionSettings)
 */
export let sessionAvatarPrompts = {};

export function setSessionAvatarPrompt(characterName, prompt) {
    sessionAvatarPrompts[characterName] = prompt;
}

export function getSessionAvatarPrompt(characterName) {
    return sessionAvatarPrompts[characterName] || null;
}

export function clearSessionAvatarPrompts() {
    sessionAvatarPrompts = {};
}

/**
 * Tracks whether the last action was a swipe (for separate mode)
 * Used to determine whether to commit lastGeneratedData to committedTrackerData
 */
export let lastActionWasSwipe = false;

/**
 * Flag indicating if generation is in progress
 */
export let isGenerating = false;

/**
 * Tracks if we're currently doing a plot progression
 */
export let isPlotProgression = false;

/**
 * Temporary storage for pending dice roll (not saved until user clicks "Save Roll")
 */
export let pendingDiceRoll = null;

/**
 * Debug logs array for troubleshooting
 */
export let debugLogs = [];

/**
 * Add a debug log entry
 * @param {string} message - The log message
 * @param {any} data - Optional data to log
 */
export function addDebugLog(message, data = null) {
    const timestamp = new Date().toISOString();
    debugLogs.push({ timestamp, message, data });
    // Keep only last 100 logs
    if (debugLogs.length > 100) {
        debugLogs.shift();
    }
}

/**
 * Feature flags for gradual rollout of new features
 */
export const FEATURE_FLAGS = {
    useNewInventory: true // Enable v2 inventory system with categorized storage
};

/**
 * Fallback avatar image (base64-encoded SVG with "?" icon)
 * Using base64 to avoid quote-encoding issues in HTML attributes
 */
export const FALLBACK_AVATAR_DATA_URI = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2NjY2NjYyIgb3BhY2l0eT0iMC4zIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIiBmaWxsPSIjNjY2IiBmb250LXNpemU9IjQwIj4/PC90ZXh0Pjwvc3ZnPg==';

/**
 * UI Element References (jQuery objects)
 */
export let $panelContainer = null;
export let $userStatsContainer = null;
export let $infoBoxContainer = null;
export let $thoughtsContainer = null;
export let $inventoryContainer = null;
export let $questsContainer = null;
export let $musicPlayerContainer = null;

/**
 * State setters - provide controlled mutation of state variables
 */
export function setExtensionSettings(newSettings) {
    extensionSettings = newSettings;
}

export function updateExtensionSettings(updates) {
    Object.assign(extensionSettings, updates);
}

export function setLastGeneratedData(data) {
    lastGeneratedData = data;
}

export function updateLastGeneratedData(updates) {
    Object.assign(lastGeneratedData, updates);
}

export function setCommittedTrackerData(data) {
    // console.log('[RPG State] setCommittedTrackerData called with:', data);
    // console.log('[RPG State] Type check on input:', {
    //     userStatsType: typeof data.userStats,
    //     infoBoxType: typeof data.infoBox,
    //     characterThoughtsType: typeof data.characterThoughts,
    //     userStatsValue: data.userStats,
    //     infoBoxValue: data.infoBox,
    //     characterThoughtsValue: data.characterThoughts
    // });
    committedTrackerData = data;
    // console.log('[RPG State] committedTrackerData after assignment:', committedTrackerData);
}

export function updateCommittedTrackerData(updates) {
    // console.log('[RPG State] updateCommittedTrackerData called with:', updates);
    // console.log('[RPG State] committedTrackerData before update:', committedTrackerData);
    Object.assign(committedTrackerData, updates);
    // console.log('[RPG State] committedTrackerData after update:', committedTrackerData);
}

export function setLastActionWasSwipe(value) {
    lastActionWasSwipe = value;
}

export function setIsGenerating(value) {
    isGenerating = value;
}

export function setIsPlotProgression(value) {
    isPlotProgression = value;
}

export function setPendingDiceRoll(roll) {
    pendingDiceRoll = roll;
}

export function getPendingDiceRoll() {
    return pendingDiceRoll;
}

export function setPanelContainer($element) {
    $panelContainer = $element;
}

export function setUserStatsContainer($element) {
    $userStatsContainer = $element;
}

export function setInfoBoxContainer($element) {
    $infoBoxContainer = $element;
}

export function setThoughtsContainer($element) {
    $thoughtsContainer = $element;
}

export function setInventoryContainer($element) {
    $inventoryContainer = $element;
}

export function setQuestsContainer($element) {
    $questsContainer = $element;
}

export function setMusicPlayerContainer($element) {
    $musicPlayerContainer = $element;
}
