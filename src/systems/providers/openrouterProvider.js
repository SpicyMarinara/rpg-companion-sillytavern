/**
 * OpenRouter Provider
 * Adapter for OpenRouter's universal LLM gateway.
 * OpenRouter provides access to many models through a single API.
 */

import { OpenAICompatibleProvider } from './openaiCompatibleProvider.js';

/**
 * @typedef {import('./baseProvider.js').ProviderConfig} ProviderConfig
 * @typedef {import('./baseProvider.js').ModelInfo} ModelInfo
 */

/**
 * OpenRouter universal gateway provider
 * @extends OpenAICompatibleProvider
 */
export class OpenRouterProvider extends OpenAICompatibleProvider {
    /**
     * Creates a new OpenRouter provider instance
     * @param {ProviderConfig} config - Provider configuration
     */
    constructor(config = {}) {
        super({
            baseUrl: 'https://openrouter.ai/api/v1',
            model: 'anthropic/claude-sonnet-4',
            maxTokens: 4096,
            ...config
        });

        // OpenRouter requires site information for some features
        this.siteUrl = config.siteUrl || window.location.origin;
        this.siteName = config.siteName || 'RPG Companion';
    }

    /**
     * Gets the provider name identifier
     * @returns {string} Provider name
     */
    getName() {
        return 'openrouter';
    }

    /**
     * Gets a human-readable display name for the provider
     * @returns {string} Display name
     */
    getDisplayName() {
        return 'OpenRouter';
    }

    /**
     * Gets commonly used OpenRouter models
     * OpenRouter provides access to many providers' models
     * @returns {ModelInfo[]} Array of popular models
     */
    getAvailableModels() {
        return [
            // Anthropic Claude
            {
                id: 'anthropic/claude-opus-4',
                name: 'Claude Opus 4',
                contextWindow: 200000,
                supportsStreaming: true
            },
            {
                id: 'anthropic/claude-sonnet-4',
                name: 'Claude Sonnet 4',
                contextWindow: 200000,
                supportsStreaming: true
            },
            {
                id: 'anthropic/claude-3.5-sonnet',
                name: 'Claude 3.5 Sonnet',
                contextWindow: 200000,
                supportsStreaming: true
            },
            {
                id: 'anthropic/claude-3.5-haiku',
                name: 'Claude 3.5 Haiku',
                contextWindow: 200000,
                supportsStreaming: true
            },
            // OpenAI
            {
                id: 'openai/gpt-4o',
                name: 'GPT-4o',
                contextWindow: 128000,
                supportsStreaming: true
            },
            {
                id: 'openai/gpt-4o-mini',
                name: 'GPT-4o Mini',
                contextWindow: 128000,
                supportsStreaming: true
            },
            {
                id: 'openai/o1-preview',
                name: 'O1 Preview',
                contextWindow: 128000,
                supportsStreaming: false
            },
            // Google
            {
                id: 'google/gemini-2.0-flash',
                name: 'Gemini 2.0 Flash',
                contextWindow: 1000000,
                supportsStreaming: true
            },
            {
                id: 'google/gemini-1.5-pro',
                name: 'Gemini 1.5 Pro',
                contextWindow: 2000000,
                supportsStreaming: true
            },
            // Meta Llama
            {
                id: 'meta-llama/llama-3.3-70b-instruct',
                name: 'Llama 3.3 70B Instruct',
                contextWindow: 128000,
                supportsStreaming: true
            },
            {
                id: 'meta-llama/llama-3.1-405b-instruct',
                name: 'Llama 3.1 405B Instruct',
                contextWindow: 128000,
                supportsStreaming: true
            },
            // Mistral
            {
                id: 'mistralai/mistral-large-2411',
                name: 'Mistral Large (Nov 2024)',
                contextWindow: 128000,
                supportsStreaming: true
            },
            {
                id: 'mistralai/mixtral-8x22b-instruct',
                name: 'Mixtral 8x22B',
                contextWindow: 65536,
                supportsStreaming: true
            },
            // DeepSeek
            {
                id: 'deepseek/deepseek-r1',
                name: 'DeepSeek R1',
                contextWindow: 64000,
                supportsStreaming: true
            },
            {
                id: 'deepseek/deepseek-chat',
                name: 'DeepSeek Chat',
                contextWindow: 64000,
                supportsStreaming: true
            },
            // Qwen
            {
                id: 'qwen/qwen-2.5-72b-instruct',
                name: 'Qwen 2.5 72B',
                contextWindow: 128000,
                supportsStreaming: true
            },
            // Free models (great for testing)
            {
                id: 'meta-llama/llama-3.2-3b-instruct:free',
                name: 'Llama 3.2 3B (Free)',
                contextWindow: 128000,
                supportsStreaming: true
            },
            {
                id: 'google/gemma-2-9b-it:free',
                name: 'Gemma 2 9B (Free)',
                contextWindow: 8192,
                supportsStreaming: true
            }
        ];
    }

    /**
     * Fetches all available models from OpenRouter
     * @returns {Promise<Array<{id: string, name: string, contextWindow: number}>>} Available models
     */
    async fetchAvailableModels() {
        try {
            const response = await this._makeRequest('https://openrouter.ai/api/v1/models', {
                method: 'GET',
                headers: this._getHeaders()
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch models: ${response.status}`);
            }

            const data = await response.json();
            const models = data.data || [];

            return models.map(model => ({
                id: model.id,
                name: model.name || model.id,
                contextWindow: model.context_length,
                pricing: {
                    prompt: model.pricing?.prompt,
                    completion: model.pricing?.completion
                }
            }));
        } catch (error) {
            console.error('[OpenRouter] Failed to fetch models:', error);
            return this.getAvailableModels();
        }
    }

    /**
     * Gets headers for OpenRouter API requests
     * @protected
     * @returns {Object} Headers object
     */
    _getHeaders() {
        const headers = super._getHeaders();

        // OpenRouter specific headers for tracking
        headers['HTTP-Referer'] = this.siteUrl;
        headers['X-Title'] = this.siteName;

        return headers;
    }

    /**
     * Enhances request body with OpenRouter-specific options
     * @protected
     * @param {Object} body - Request body
     * @param {Object} options - Generation options
     * @returns {Object} Enhanced request body
     */
    _enhanceRequestBody(body, options) {
        // OpenRouter supports provider preferences
        if (options.providers || options.route) {
            body.route = options.route || 'fallback';
            if (options.providers) {
                body.providers = options.providers;
            }
        }

        // Model-specific transforms
        if (options.transforms) {
            body.transforms = options.transforms;
        }

        // Provider routing preferences
        if (options.providerOrder) {
            body.provider = {
                order: options.providerOrder
            };
        }

        // Allow fallback to other providers
        if (options.allowFallback !== false) {
            body.provider = body.provider || {};
            body.provider.allow_fallbacks = true;
        }

        return body;
    }

    /**
     * Validates the provider configuration
     * @returns {{valid: boolean, errors: string[]}} Validation result
     */
    validateConfig() {
        const errors = [];

        if (!this.getApiKey()) {
            errors.push('OpenRouter API key is required');
        }

        if (!this.config.model || !this.config.model.trim()) {
            errors.push('Model is not specified');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Gets account credits and usage information
     * @returns {Promise<{credits: number, usage: number}|null>} Account info
     */
    async getAccountInfo() {
        try {
            const response = await this._makeRequest('https://openrouter.ai/api/v1/auth/key', {
                method: 'GET',
                headers: this._getHeaders()
            });

            if (!response.ok) {
                return null;
            }

            const data = await response.json();
            return {
                credits: data.data?.limit || 0,
                usage: data.data?.usage || 0
            };
        } catch (error) {
            console.error('[OpenRouter] Failed to get account info:', error);
            return null;
        }
    }

    /**
     * Tests the connection to OpenRouter
     * @returns {Promise<{success: boolean, message: string, model?: string}>}
     */
    async testConnection() {
        try {
            // First verify the API key
            const accountInfo = await this.getAccountInfo();

            if (!accountInfo) {
                return {
                    success: false,
                    message: 'Invalid API key. Please check your OpenRouter API key.'
                };
            }

            // Then test generation
            const result = await super.testConnection();

            // Add credits info to success message
            if (result.success) {
                result.message = `Connection successful! Credits remaining: $${(accountInfo.credits - accountInfo.usage).toFixed(4)}`;
            }

            return result;
        } catch (error) {
            return {
                success: false,
                message: error.message
            };
        }
    }

    /**
     * Gets generation stats for the last request
     * OpenRouter provides detailed stats in response headers
     * @param {Response} response - Fetch response
     * @returns {Object|null} Stats object
     */
    _parseGenerationStats(response) {
        try {
            return {
                provider: response.headers.get('x-openrouter-provider'),
                model: response.headers.get('x-openrouter-model'),
                generationTime: response.headers.get('x-generation-time')
            };
        } catch {
            return null;
        }
    }
}
