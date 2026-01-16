/**
 * Character Brain Configuration System
 * Allows assigning different LLM providers/models to different characters
 *
 * Each character/NPC can have their own:
 * - LLM provider (default, openai, anthropic, local, custom)
 * - Model selection
 * - Temperature and token settings
 * - Custom system prompts
 * - Memory and journal preferences
 */

import { getContext } from '../../../../../../extensions.js';
import { chat } from '../../../../../../../script.js';
import { extensionSettings } from '../../core/state.js';
import { saveSettings } from '../../core/persistence.js';
import {
    loadCharacterBrains,
    saveCharacterBrains,
    getStoredCharacterBrain,
    setStoredCharacterBrain,
    removeStoredCharacterBrain,
    getAllStoredCharacterBrains
} from './characterBrainStorage.js';

/**
 * Default brain configuration for characters
 * @type {Object}
 */
export const defaultBrainConfig = {
    provider: 'default',        // 'default' uses main chat model, or: 'openai', 'anthropic', 'local', 'custom'
    model: '',                  // Model name/ID (e.g., 'gpt-4o-mini', 'claude-3-haiku')
    apiKeyEnvVar: '',           // localStorage key for API key (e.g., 'character_brain_openai_key')
    endpoint: '',               // Custom endpoint URL (for local models or proxies)
    temperature: 0.7,           // Generation temperature (0.0 - 2.0)
    maxTokens: 2048,            // Maximum tokens for generation
    systemPromptOverride: '',   // Optional custom system prompt for this character
    memoryEnabled: true,        // Use vector memory for this character
    journalEnabled: false,      // Character keeps a journal about player interactions
    contextWindow: 4096,        // Context window size for this character's model
    presencePenalty: 0,         // Presence penalty (-2.0 to 2.0)
    frequencyPenalty: 0,        // Frequency penalty (-2.0 to 2.0)
    topP: 1.0,                  // Top-p sampling (0.0 - 1.0)
    stopSequences: [],          // Custom stop sequences
    enabled: false              // Whether this character has a custom brain (false = use default)
};

/**
 * Supported LLM providers
 * @type {Object}
 */
export const PROVIDERS = {
    DEFAULT: 'default',         // Use SillyTavern's main chat model
    OPENAI: 'openai',           // OpenAI API (GPT-4, GPT-3.5, etc.)
    ANTHROPIC: 'anthropic',     // Anthropic API (Claude models)
    LOCAL: 'local',             // Local models (LM Studio, Ollama, etc.)
    CUSTOM: 'custom'            // Custom OpenAI-compatible endpoint
};

/**
 * Provider configurations with their default endpoints
 * @type {Object}
 */
export const PROVIDER_CONFIGS = {
    [PROVIDERS.OPENAI]: {
        name: 'OpenAI',
        endpoint: 'https://api.openai.com/v1',
        models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
        requiresKey: true,
        keyStorageKey: 'character_brain_openai_key'
    },
    [PROVIDERS.ANTHROPIC]: {
        name: 'Anthropic',
        endpoint: 'https://api.anthropic.com/v1',
        models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
        requiresKey: true,
        keyStorageKey: 'character_brain_anthropic_key',
        isAnthropicFormat: true
    },
    [PROVIDERS.LOCAL]: {
        name: 'Local (LM Studio/Ollama)',
        endpoint: 'http://localhost:1234/v1',
        models: [],
        requiresKey: false,
        keyStorageKey: ''
    },
    [PROVIDERS.CUSTOM]: {
        name: 'Custom Endpoint',
        endpoint: '',
        models: [],
        requiresKey: false,
        keyStorageKey: 'character_brain_custom_key'
    }
};

/**
 * In-memory cache of character brains
 * @type {Object<string, Object>}
 */
let characterBrainsCache = {};

/**
 * Initialize the character brain system
 * Loads stored brain configurations
 */
export function initCharacterBrains() {
    characterBrainsCache = loadCharacterBrains();
    // console.log('[Character Brain] Initialized with', Object.keys(characterBrainsCache).length, 'character brains');
}

/**
 * Gets the brain configuration for a character
 * @param {string} characterId - Character ID or name
 * @returns {Object} Brain configuration (default if not set)
 */
export function getCharacterBrain(characterId) {
    if (!characterId) {
        return { ...defaultBrainConfig };
    }

    const normalizedId = normalizeCharacterId(characterId);
    const stored = characterBrainsCache[normalizedId];

    if (stored && stored.enabled) {
        return { ...defaultBrainConfig, ...stored };
    }

    return { ...defaultBrainConfig };
}

/**
 * Sets the brain configuration for a character
 * @param {string} characterId - Character ID or name
 * @param {Object} config - Brain configuration (partial, merged with defaults)
 */
export function setCharacterBrain(characterId, config) {
    if (!characterId) {
        console.warn('[Character Brain] Cannot set brain for empty character ID');
        return;
    }

    const normalizedId = normalizeCharacterId(characterId);

    // Merge with defaults, ensuring all required fields exist
    const fullConfig = {
        ...defaultBrainConfig,
        ...config,
        characterId: normalizedId,
        lastModified: Date.now()
    };

    characterBrainsCache[normalizedId] = fullConfig;
    setStoredCharacterBrain(normalizedId, fullConfig);

    // console.log('[Character Brain] Set brain for', normalizedId, fullConfig);
}

/**
 * Removes the brain configuration for a character
 * @param {string} characterId - Character ID or name
 */
export function removeCharacterBrain(characterId) {
    if (!characterId) return;

    const normalizedId = normalizeCharacterId(characterId);

    delete characterBrainsCache[normalizedId];
    removeStoredCharacterBrain(normalizedId);

    // console.log('[Character Brain] Removed brain for', normalizedId);
}

/**
 * Gets all character brain configurations
 * @returns {Object} Map of character ID to brain config
 */
export function getAllCharacterBrains() {
    return { ...characterBrainsCache };
}

/**
 * Checks if a character has a custom brain configured
 * @param {string} characterId - Character ID or name
 * @returns {boolean} True if character has custom brain enabled
 */
export function hasCustomBrain(characterId) {
    if (!characterId) return false;

    const normalizedId = normalizeCharacterId(characterId);
    const brain = characterBrainsCache[normalizedId];

    return brain && brain.enabled && brain.provider !== PROVIDERS.DEFAULT;
}

/**
 * Normalizes a character ID for consistent storage
 * @param {string} characterId - Raw character ID or name
 * @returns {string} Normalized ID
 */
function normalizeCharacterId(characterId) {
    if (!characterId) return '';

    // Convert to string and lowercase, remove special characters
    return String(characterId)
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9_-]/g, '_');
}

/**
 * Detects which character is currently "speaking" in the conversation
 * Used to route generation to the appropriate brain
 * @returns {string|null} Character ID/name or null if unknown
 */
export function detectCurrentSpeaker() {
    const context = getContext();

    // In a group chat, detect whose turn it is
    if (context.groupId) {
        return detectGroupChatSpeaker(context);
    }

    // In a 1-on-1 chat, return the character
    if (context.characterId !== undefined && context.characterId !== null) {
        return context.name2 || `char_${context.characterId}`;
    }

    return null;
}

/**
 * Detects the current speaker in a group chat
 * @param {Object} context - SillyTavern context
 * @returns {string|null} Character name or null
 */
function detectGroupChatSpeaker(context) {
    // Check if there's a character selection for this turn
    if (context.selected_group_members && context.selected_group_members.length > 0) {
        // Return the first selected member (current turn)
        const memberId = context.selected_group_members[0];
        const member = context.characters?.find(c => c.avatar === memberId || c.name === memberId);
        return member?.name || memberId;
    }

    // Try to detect from recent messages
    if (chat && chat.length > 0) {
        // Find the last non-user message
        for (let i = chat.length - 1; i >= 0; i--) {
            const msg = chat[i];
            if (!msg.is_user && msg.name) {
                return msg.name;
            }
        }
    }

    return null;
}

/**
 * Gets the API key for a provider from localStorage
 * @param {string} provider - Provider type
 * @param {string} customKeyName - Optional custom key name
 * @returns {string} API key or empty string
 */
export function getProviderApiKey(provider, customKeyName = '') {
    const keyName = customKeyName || PROVIDER_CONFIGS[provider]?.keyStorageKey || '';

    if (!keyName) return '';

    return localStorage.getItem(keyName) || '';
}

/**
 * Sets the API key for a provider in localStorage
 * @param {string} provider - Provider type
 * @param {string} apiKey - API key value
 * @param {string} customKeyName - Optional custom key name
 */
export function setProviderApiKey(provider, apiKey, customKeyName = '') {
    const keyName = customKeyName || PROVIDER_CONFIGS[provider]?.keyStorageKey || '';

    if (!keyName) return;

    if (apiKey && apiKey.trim()) {
        localStorage.setItem(keyName, apiKey.trim());
    } else {
        localStorage.removeItem(keyName);
    }
}

/**
 * Generates a response using a character's custom brain
 * @param {string} characterId - Character ID/name
 * @param {Array<{role: string, content: string}>} messages - Chat messages
 * @param {Object} options - Additional generation options
 * @returns {Promise<string|null>} Generated response or null if using default
 */
export async function generateForCharacter(characterId, messages, options = {}) {
    const brain = getCharacterBrain(characterId);

    // If not enabled or using default provider, return null to signal fallback
    if (!brain.enabled || brain.provider === PROVIDERS.DEFAULT) {
        return null;
    }

    // Create provider instance and generate
    return await generateWithProvider(brain, messages, options);
}

/**
 * Generates a response using a specific provider configuration
 * @param {Object} brain - Brain configuration
 * @param {Array<{role: string, content: string}>} messages - Chat messages
 * @param {Object} options - Additional generation options
 * @returns {Promise<string>} Generated response
 */
async function generateWithProvider(brain, messages, options = {}) {
    const provider = brain.provider;
    const providerConfig = PROVIDER_CONFIGS[provider] || PROVIDER_CONFIGS[PROVIDERS.CUSTOM];

    // Get endpoint
    const endpoint = brain.endpoint || providerConfig.endpoint;
    if (!endpoint) {
        throw new Error(`No endpoint configured for provider: ${provider}`);
    }

    // Get API key
    const apiKey = getProviderApiKey(provider, brain.apiKeyEnvVar);
    if (providerConfig.requiresKey && !apiKey) {
        throw new Error(`API key required for provider: ${provider}`);
    }

    // Apply system prompt override if specified
    let finalMessages = [...messages];
    if (brain.systemPromptOverride && brain.systemPromptOverride.trim()) {
        // Prepend or replace system message
        const hasSystem = finalMessages.length > 0 && finalMessages[0].role === 'system';
        if (hasSystem) {
            finalMessages[0] = {
                role: 'system',
                content: brain.systemPromptOverride
            };
        } else {
            finalMessages.unshift({
                role: 'system',
                content: brain.systemPromptOverride
            });
        }
    }

    // Handle Anthropic format differences
    if (providerConfig.isAnthropicFormat) {
        return await generateWithAnthropic(endpoint, apiKey, brain, finalMessages, options);
    }

    // Standard OpenAI-compatible request
    return await generateWithOpenAI(endpoint, apiKey, brain, finalMessages, options);
}

/**
 * Generates using OpenAI-compatible API
 * @param {string} endpoint - API endpoint
 * @param {string} apiKey - API key
 * @param {Object} brain - Brain configuration
 * @param {Array} messages - Chat messages
 * @param {Object} options - Additional options
 * @returns {Promise<string>} Generated response
 */
async function generateWithOpenAI(endpoint, apiKey, brain, messages, options = {}) {
    const normalizedEndpoint = endpoint.replace(/\/+$/, '');
    const url = `${normalizedEndpoint}/chat/completions`;

    const headers = {
        'Content-Type': 'application/json'
    };

    if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const requestBody = {
        model: brain.model || 'gpt-3.5-turbo',
        messages: messages,
        max_tokens: options.maxTokens || brain.maxTokens || 2048,
        temperature: options.temperature ?? brain.temperature ?? 0.7,
        top_p: brain.topP ?? 1.0,
        presence_penalty: brain.presencePenalty ?? 0,
        frequency_penalty: brain.frequencyPenalty ?? 0
    };

    if (brain.stopSequences && brain.stopSequences.length > 0) {
        requestBody.stop = brain.stopSequences;
    }

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            let errorMessage = `API error: ${response.status} ${response.statusText}`;

            try {
                const errorJson = JSON.parse(errorText);
                if (errorJson.error?.message) {
                    errorMessage = `API error: ${errorJson.error.message}`;
                }
            } catch (e) {
                if (errorText.length < 200) {
                    errorMessage = `API error: ${errorText}`;
                }
            }

            throw new Error(errorMessage);
        }

        const data = await response.json();

        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new Error('Invalid response format from API');
        }

        return data.choices[0].message.content;
    } catch (error) {
        if (error.name === 'TypeError' && (error.message.includes('fetch') || error.message.includes('Failed to fetch'))) {
            throw new Error(`CORS blocked: Cannot access ${normalizedEndpoint}. Use a local proxy or CORS-enabled endpoint.`);
        }
        throw error;
    }
}

/**
 * Generates using Anthropic API format
 * @param {string} endpoint - API endpoint
 * @param {string} apiKey - API key
 * @param {Object} brain - Brain configuration
 * @param {Array} messages - Chat messages
 * @param {Object} options - Additional options
 * @returns {Promise<string>} Generated response
 */
async function generateWithAnthropic(endpoint, apiKey, brain, messages, options = {}) {
    const normalizedEndpoint = endpoint.replace(/\/+$/, '');
    const url = `${normalizedEndpoint}/messages`;

    // Extract system message if present
    let systemMessage = '';
    let anthropicMessages = [];

    for (const msg of messages) {
        if (msg.role === 'system') {
            systemMessage = msg.content;
        } else {
            anthropicMessages.push({
                role: msg.role === 'assistant' ? 'assistant' : 'user',
                content: msg.content
            });
        }
    }

    const headers = {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
    };

    const requestBody = {
        model: brain.model || 'claude-3-5-haiku-20241022',
        messages: anthropicMessages,
        max_tokens: options.maxTokens || brain.maxTokens || 2048,
        temperature: options.temperature ?? brain.temperature ?? 0.7,
        top_p: brain.topP ?? 1.0
    };

    if (systemMessage) {
        requestBody.system = systemMessage;
    }

    if (brain.stopSequences && brain.stopSequences.length > 0) {
        requestBody.stop_sequences = brain.stopSequences;
    }

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            let errorMessage = `Anthropic API error: ${response.status} ${response.statusText}`;

            try {
                const errorJson = JSON.parse(errorText);
                if (errorJson.error?.message) {
                    errorMessage = `Anthropic API error: ${errorJson.error.message}`;
                }
            } catch (e) {
                if (errorText.length < 200) {
                    errorMessage = `Anthropic API error: ${errorText}`;
                }
            }

            throw new Error(errorMessage);
        }

        const data = await response.json();

        if (!data.content || !data.content[0] || !data.content[0].text) {
            throw new Error('Invalid response format from Anthropic API');
        }

        return data.content[0].text;
    } catch (error) {
        if (error.name === 'TypeError' && (error.message.includes('fetch') || error.message.includes('Failed to fetch'))) {
            throw new Error(`CORS blocked: Cannot access Anthropic API directly from browser. Use a proxy.`);
        }
        throw error;
    }
}

/**
 * Tests a character brain configuration
 * @param {string} characterId - Character ID to test
 * @returns {Promise<{success: boolean, message: string}>} Test result
 */
export async function testCharacterBrain(characterId) {
    const brain = getCharacterBrain(characterId);

    if (!brain.enabled) {
        return { success: false, message: 'Character brain is not enabled' };
    }

    if (brain.provider === PROVIDERS.DEFAULT) {
        return { success: true, message: 'Using SillyTavern default model (no test needed)' };
    }

    try {
        const testMessages = [
            { role: 'user', content: 'Respond with exactly: "Connection successful"' }
        ];

        const response = await generateWithProvider(brain, testMessages, { maxTokens: 50 });

        return {
            success: true,
            message: `Connection successful! Model: ${brain.model || 'default'}`,
            response: response
        };
    } catch (error) {
        return {
            success: false,
            message: error.message || 'Connection failed'
        };
    }
}

/**
 * Creates a preset from a brain configuration
 * @param {string} presetName - Name for the preset
 * @param {Object} brainConfig - Brain configuration to save
 * @returns {string} Preset ID
 */
export function createBrainPreset(presetName, brainConfig) {
    const presetId = `brain_preset_${Date.now()}`;

    const preset = {
        id: presetId,
        name: presetName,
        config: { ...brainConfig },
        createdAt: Date.now()
    };

    // Store in extension settings
    if (!extensionSettings.characterBrainPresets) {
        extensionSettings.characterBrainPresets = {};
    }

    extensionSettings.characterBrainPresets[presetId] = preset;
    saveSettings();

    return presetId;
}

/**
 * Applies a brain preset to a character
 * @param {string} characterId - Character ID
 * @param {string} presetId - Preset ID to apply
 */
export function applyBrainPreset(characterId, presetId) {
    const presets = extensionSettings.characterBrainPresets || {};
    const preset = presets[presetId];

    if (!preset) {
        console.warn('[Character Brain] Preset not found:', presetId);
        return;
    }

    setCharacterBrain(characterId, {
        ...preset.config,
        enabled: true
    });
}

/**
 * Gets all brain presets
 * @returns {Object} Map of preset ID to preset data
 */
export function getBrainPresets() {
    return extensionSettings.characterBrainPresets || {};
}

/**
 * Deletes a brain preset
 * @param {string} presetId - Preset ID to delete
 */
export function deleteBrainPreset(presetId) {
    if (extensionSettings.characterBrainPresets) {
        delete extensionSettings.characterBrainPresets[presetId];
        saveSettings();
    }
}
