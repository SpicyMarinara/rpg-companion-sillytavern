/**
 * Core State Management Module
 * Centralizes all extension state variables
 */

import { createEmptyTrackerData } from '../types/trackerData.js';

/**
 * Extension settings - persisted to SillyTavern settings.
 * Holds configuration and UI preferences only (no tracker payloads).
 */
export let extensionSettings = {
    enabled: true,
    autoUpdate: true,
    updateDepth: 4,
    messageInterceptionContextDepth: 4,
    generationMode: 'together',
    useSeparatePreset: false,
    showUserStats: true,
    showInfoBox: true,
    showCharacterThoughts: true,
    showInventory: true,
    useSimplifiedInventory: false,
    showSkills: false,
    enableItemSkillLinks: false,
    deleteSkillWithItem: false,
    showQuests: true,
    showThoughtsInChat: true,
    enableHtmlPrompt: false,
    customHtmlPrompt: '',
    customTrackerPrompt: '',
    enableMessageInterception: false,
    messageInterceptionActive: true,
    customMessageInterceptionPrompt: '',
    enableSecretPrompt: false,
    secretPromptText: '',
    perCharacterConfig: false,
    skipInjectionsForGuided: 'none',
    enablePlotButtons: true,
    panelPosition: 'right',
    theme: 'default',
    customColors: {
        bg: '#1a1a2e',
        accent: '#16213e',
        text: '#eaeaea',
        highlight: '#e94560'
    },
    statBarColorLow: '#cc3333',
    statBarColorHigh: '#33cc66',
    enableAnimations: true,
    mobileFabPosition: {
        top: 'calc(var(--topBarBlockSize) + 60px)',
        right: '12px'
    },
    trackerConfig: {
        userStats: {
            customStats: [
                { id: 'health', name: 'Health', description: '', enabled: true, default: 100 },
                { id: 'satiety', name: 'Satiety', description: '', enabled: true, default: 100 },
                { id: 'energy', name: 'Energy', description: '', enabled: true, default: 100 },
                { id: 'hygiene', name: 'Hygiene', description: '', enabled: true, default: 100 },
                { id: 'arousal', name: 'Arousal', description: '', enabled: true, default: 0 }
            ],
            showRPGAttributes: true,
            alwaysSendAttributes: false,
            allowAIUpdateAttributes: true,
            rpgAttributes: [
                { id: 'str', name: 'STR', description: '', enabled: true },
                { id: 'dex', name: 'DEX', description: '', enabled: true },
                { id: 'con', name: 'CON', description: '', enabled: true },
                { id: 'int', name: 'INT', description: '', enabled: true },
                { id: 'wis', name: 'WIS', description: '', enabled: true },
                { id: 'cha', name: 'CHA', description: '', enabled: true }
            ],
            statusSection: {
                enabled: true,
                showMoodEmoji: true,
                customFields: ['Conditions']
            },
            skillsSection: {
                enabled: false,
                label: 'Skills',
                customFields: []
            }
        },
        infoBox: {
            widgets: {
                date: { enabled: true, format: 'Weekday, Month, Year' },
                weather: { enabled: true },
                temperature: { enabled: true, unit: 'C' },
                time: { enabled: true },
                location: { enabled: true },
                recentEvents: { enabled: true }
            }
        },
        presentCharacters: {
            showEmoji: true,
            showName: true,
            relationshipFields: ['Lover', 'Friend', 'Ally', 'Enemy', 'Neutral'],
            relationshipEmojis: {
                'Lover': '❤️',
                'Friend': '⭐',
                'Ally': '🤝',
                'Enemy': '⚔️',
                'Neutral': '⚖️'
            },
            customFields: [
                { id: 'appearance', name: 'Appearance', enabled: true, description: 'Visible physical appearance (clothing, hair, notable features)' },
                { id: 'demeanor', name: 'Demeanor', enabled: true, description: 'Observable demeanor or emotional state' }
            ],
            thoughts: {
                enabled: true,
                name: 'Thoughts',
                description: 'Internal monologue (in first person POV, up to three sentences long)'
            },
            characterStats: {
                enabled: false,
                customStats: [
                    { id: 'health', name: 'Health', description: '', enabled: true, default: 100 },
                    { id: 'arousal', name: 'Arousal', description: '', enabled: true, default: 0 }
                ]
            }
        }
    },
    collapsedInventoryLocations: [],
    inventoryViewModes: {
        onPerson: 'list',
        stored: 'list',
        assets: 'list'
    },
    lastDiceRoll: null,
    debugMode: false,
    memoryMessagesToProcess: 16
};

export function createFreshTrackerData() {
    return createEmptyTrackerData(extensionSettings.trackerConfig);
}

/**
 * Last generated tracker data (structured) - source for UI display
 */
export let lastGeneratedData = createFreshTrackerData();

/**
 * Committed tracker data used as the next-generation source of truth
 */
export let committedTrackerData = createFreshTrackerData();

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
export const debugLogs = [];

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
export let $skillsContainer = null;
export let $questsContainer = null;

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
    committedTrackerData = data;
}

export function updateCommittedTrackerData(updates) {
    Object.assign(committedTrackerData, updates);
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

export function setSkillsContainer($element) {
    $skillsContainer = $element;
}

export function setQuestsContainer($element) {
    $questsContainer = $element;
}
