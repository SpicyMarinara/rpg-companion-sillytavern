/**
 * Provider Registry and Factory
 * Central module for managing LLM provider adapters.
 *
 * Usage:
 * ```javascript
 * import { createProvider, PROVIDERS, getProviderNames } from './providers/index.js';
 *
 * // Create a provider instance
 * const provider = createProvider('claude', {
 *     model: 'claude-sonnet-4-20250514',
 *     maxTokens: 4096
 * });
 *
 * // Generate a response
 * const response = await provider.generateResponse([
 *     { role: 'user', content: 'Hello!' }
 * ]);
 * ```
 */

// Import all provider classes
import { BaseProvider } from './baseProvider.js';
import { OpenAICompatibleProvider } from './openaiCompatibleProvider.js';
import { ClaudeProvider } from './claudeProvider.js';
import { OpenAIProvider } from './openaiProvider.js';
import { GeminiProvider } from './geminiProvider.js';
import { LMStudioProvider } from './lmstudioProvider.js';
import { OllamaProvider } from './ollamaProvider.js';
import { OpenRouterProvider } from './openrouterProvider.js';
import { GroqProvider } from './groqProvider.js';

/**
 * Registry of all available provider classes
 * @type {Object<string, typeof BaseProvider>}
 */
export const PROVIDERS = {
    claude: ClaudeProvider,
    openai: OpenAIProvider,
    gemini: GeminiProvider,
    lmstudio: LMStudioProvider,
    ollama: OllamaProvider,
    openrouter: OpenRouterProvider,
    groq: GroqProvider
};

/**
 * Provider metadata for UI display
 * @type {Object<string, {name: string, description: string, isLocal: boolean, requiresApiKey: boolean, defaultBaseUrl: string}>}
 */
export const PROVIDER_INFO = {
    claude: {
        name: 'Anthropic Claude',
        description: 'Anthropic\'s Claude models - excellent for roleplay and creative writing',
        isLocal: false,
        requiresApiKey: true,
        defaultBaseUrl: 'https://api.anthropic.com',
        website: 'https://console.anthropic.com/'
    },
    openai: {
        name: 'OpenAI',
        description: 'OpenAI\'s GPT models including GPT-4o',
        isLocal: false,
        requiresApiKey: true,
        defaultBaseUrl: 'https://api.openai.com/v1',
        website: 'https://platform.openai.com/'
    },
    gemini: {
        name: 'Google Gemini',
        description: 'Google\'s Gemini models with large context windows',
        isLocal: false,
        requiresApiKey: true,
        defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        website: 'https://aistudio.google.com/'
    },
    lmstudio: {
        name: 'LM Studio',
        description: 'Run models locally with LM Studio - no API key needed',
        isLocal: true,
        requiresApiKey: false,
        defaultBaseUrl: 'http://localhost:1234/v1',
        website: 'https://lmstudio.ai/'
    },
    ollama: {
        name: 'Ollama',
        description: 'Run open-source models locally with Ollama - no API key needed',
        isLocal: true,
        requiresApiKey: false,
        defaultBaseUrl: 'http://localhost:11434/v1',
        website: 'https://ollama.ai/'
    },
    openrouter: {
        name: 'OpenRouter',
        description: 'Access many models through one API - Claude, GPT, Llama, and more',
        isLocal: false,
        requiresApiKey: true,
        defaultBaseUrl: 'https://openrouter.ai/api/v1',
        website: 'https://openrouter.ai/'
    },
    groq: {
        name: 'Groq',
        description: 'Extremely fast inference for open-source models',
        isLocal: false,
        requiresApiKey: true,
        defaultBaseUrl: 'https://api.groq.com/openai/v1',
        website: 'https://console.groq.com/'
    }
};

/**
 * Creates a provider instance by type
 * @param {string} type - Provider type (e.g., 'claude', 'openai')
 * @param {Object} config - Provider configuration
 * @returns {BaseProvider} Provider instance
 * @throws {Error} If provider type is unknown
 */
export function createProvider(type, config = {}) {
    const ProviderClass = PROVIDERS[type];

    if (!ProviderClass) {
        const availableProviders = Object.keys(PROVIDERS).join(', ');
        throw new Error(`Unknown provider type: "${type}". Available providers: ${availableProviders}`);
    }

    // Add default base URL if not provided
    if (!config.baseUrl && PROVIDER_INFO[type]?.defaultBaseUrl) {
        config.baseUrl = PROVIDER_INFO[type].defaultBaseUrl;
    }

    return new ProviderClass(config);
}

/**
 * Gets all available provider type names
 * @returns {string[]} Array of provider type names
 */
export function getProviderNames() {
    return Object.keys(PROVIDERS);
}

/**
 * Gets provider info for all providers
 * @returns {Array<{type: string, name: string, description: string, isLocal: boolean, requiresApiKey: boolean}>}
 */
export function getProviderList() {
    return Object.entries(PROVIDER_INFO).map(([type, info]) => ({
        type,
        ...info
    }));
}

/**
 * Gets local providers only
 * @returns {Array<{type: string, name: string, description: string}>}
 */
export function getLocalProviders() {
    return getProviderList().filter(p => p.isLocal);
}

/**
 * Gets cloud providers only
 * @returns {Array<{type: string, name: string, description: string}>}
 */
export function getCloudProviders() {
    return getProviderList().filter(p => !p.isLocal);
}

/**
 * Checks if a provider type exists
 * @param {string} type - Provider type to check
 * @returns {boolean} True if provider exists
 */
export function hasProvider(type) {
    return type in PROVIDERS;
}

/**
 * Gets info for a specific provider
 * @param {string} type - Provider type
 * @returns {Object|null} Provider info or null if not found
 */
export function getProviderInfo(type) {
    return PROVIDER_INFO[type] || null;
}

/**
 * Storage keys for provider configurations
 * API keys are stored separately from other settings for security
 */
export const STORAGE_KEYS = {
    /** Current active provider type */
    ACTIVE_PROVIDER: 'rpg_companion_active_provider',
    /** Provider configurations (excluding API keys) */
    PROVIDER_CONFIGS: 'rpg_companion_provider_configs',
    /** Last used model per provider */
    LAST_MODELS: 'rpg_companion_last_models'
};

/**
 * Saves the active provider type
 * @param {string} type - Provider type
 */
export function saveActiveProvider(type) {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_PROVIDER, type);
}

/**
 * Gets the active provider type
 * @returns {string} Active provider type or 'openrouter' as default
 */
export function getActiveProvider() {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_PROVIDER) || 'openrouter';
}

/**
 * Saves provider configuration (excluding API key)
 * @param {string} type - Provider type
 * @param {Object} config - Configuration to save
 */
export function saveProviderConfig(type, config) {
    const configs = getProviderConfigs();

    // Don't save API key in config
    const { apiKey, ...safeConfig } = config;

    configs[type] = safeConfig;
    localStorage.setItem(STORAGE_KEYS.PROVIDER_CONFIGS, JSON.stringify(configs));
}

/**
 * Gets all saved provider configurations
 * @returns {Object<string, Object>} Provider configs by type
 */
export function getProviderConfigs() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.PROVIDER_CONFIGS) || '{}');
    } catch {
        return {};
    }
}

/**
 * Gets saved configuration for a specific provider
 * @param {string} type - Provider type
 * @returns {Object} Provider configuration
 */
export function getProviderConfig(type) {
    const configs = getProviderConfigs();
    return configs[type] || {};
}

/**
 * Saves the last used model for a provider
 * @param {string} type - Provider type
 * @param {string} model - Model ID
 */
export function saveLastModel(type, model) {
    const models = getLastModels();
    models[type] = model;
    localStorage.setItem(STORAGE_KEYS.LAST_MODELS, JSON.stringify(models));
}

/**
 * Gets the last used model for a provider
 * @param {string} type - Provider type
 * @returns {string|null} Last used model or null
 */
export function getLastModel(type) {
    const models = getLastModels();
    return models[type] || null;
}

/**
 * Gets all last used models
 * @returns {Object<string, string>} Last models by provider type
 */
export function getLastModels() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.LAST_MODELS) || '{}');
    } catch {
        return {};
    }
}

/**
 * Creates a provider with saved configuration
 * Loads config from localStorage and creates a ready-to-use provider
 * @param {string} type - Provider type
 * @param {Object} overrides - Optional config overrides
 * @returns {BaseProvider} Configured provider instance
 */
export function createConfiguredProvider(type, overrides = {}) {
    const savedConfig = getProviderConfig(type);
    const lastModel = getLastModel(type);

    const config = {
        ...savedConfig,
        ...(lastModel && { model: lastModel }),
        ...overrides
    };

    return createProvider(type, config);
}

/**
 * Tests all configured providers and returns their status
 * @returns {Promise<Array<{type: string, name: string, status: 'ok'|'error'|'unconfigured', message: string}>>}
 */
export async function testAllProviders() {
    const results = [];

    for (const [type, info] of Object.entries(PROVIDER_INFO)) {
        try {
            const provider = createConfiguredProvider(type);
            const validation = provider.validateConfig();

            if (!validation.valid) {
                results.push({
                    type,
                    name: info.name,
                    status: 'unconfigured',
                    message: validation.errors.join(', ')
                });
                continue;
            }

            const testResult = await provider.testConnection();
            results.push({
                type,
                name: info.name,
                status: testResult.success ? 'ok' : 'error',
                message: testResult.message,
                latencyMs: testResult.latencyMs
            });
        } catch (error) {
            results.push({
                type,
                name: info.name,
                status: 'error',
                message: error.message
            });
        }
    }

    return results;
}

// Export base classes for custom provider implementations
export { BaseProvider, OpenAICompatibleProvider };

// Export individual provider classes
export {
    ClaudeProvider,
    OpenAIProvider,
    GeminiProvider,
    LMStudioProvider,
    OllamaProvider,
    OpenRouterProvider,
    GroqProvider
};
