/**
 * Core Configuration Module
 * Extension metadata and configuration constants
 */

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
    messageInterceptionContextDepth: 4, // How many recent messages to send when intercepting user messages
    generationMode: 'together', // 'separate' or 'together' - whether to generate with main response or separately
    useSeparatePreset: false, // Use 'RPG Companion Trackers' preset for tracker generation instead of main API model
    showUserStats: true,
    showInfoBox: true,
    showCharacterThoughts: true,
    showInventory: true, // Show inventory section (v2 system)
    showThoughtsInChat: true, // Show thoughts overlay in chat
    alwaysShowThoughtBubble: false, // Auto-expand thought bubble without clicking icon
    enableHtmlPrompt: false, // Enable immersive HTML prompt injection
    enableMessageInterception: false, // Enable intercepting user messages with LLM rewrite
    messageInterceptionActive: true, // Runtime toggle to allow/skip interception
    // Controls when the extension skips injecting tracker instructions/examples/HTML
    // into generations that appear to be user-injected instructions. Valid values:
    //  - 'none'          -> never skip (legacy behavior: always inject)
    //  - 'guided'        -> skip for any guided / instruct or quiet_prompt generation
    //  - 'impersonation' -> skip only for impersonation-style guided generations
    // This setting helps compatibility with other extensions like GuidedGenerations.
    skipInjectionsForGuided: 'none',
    enablePlotButtons: true, // Show plot progression buttons above chat input
    useMarkdownFormat: false, // Use token-efficient markdown format instead of JSON for LLM communication
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
    trackerConfig: {
        userStats: {
            customStats: [
                { id: 'health', name: 'Health', description: '', enabled: true },
                { id: 'satiety', name: 'Satiety', description: '', enabled: true },
                { id: 'energy', name: 'Energy', description: '', enabled: true },
                { id: 'hygiene', name: 'Hygiene', description: '', enabled: true },
                { id: 'arousal', name: 'Arousal', description: '', enabled: true }
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
                    { id: 'health', name: 'Health', description: '', enabled: true },
                    { id: 'arousal', name: 'Arousal', description: '', enabled: true }
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
    lastDiceRoll: null, // Store last dice roll result
    debugMode: false, // Enable debug logging visible in UI (for mobile debugging)
    memoryMessagesToProcess: 16 // Number of messages to process per batch in memory recollection
};
