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
 * Default extension settings
 */
export const defaultSettings = {
    enabled: true,
    autoUpdate: true,
    updateDepth: 4, // How many messages to include in the context
    generationMode: 'together', // 'separate' or 'together' - whether to generate with main response or separately
    useSeparatePreset: false, // Use 'RPG Companion Trackers' preset for tracker generation instead of main API model
    showUserStats: true,
    showInfoBox: true,
    showCharacterThoughts: true,
    showInventory: true, // Show inventory section (v2 system)
    showThoughtsInChat: true, // Show thoughts overlay in chat
    enableHtmlPrompt: false, // Enable immersive HTML prompt injection
    enablePlotButtons: true, // Show plot progression buttons above chat input
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
    debugMode: false, // Enable debug logging visible in UI (for mobile debugging)
    memoryMessagesToProcess: 16 // Number of messages to process per batch in memory recollection
};
