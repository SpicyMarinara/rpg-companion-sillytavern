/**
 * OpenAI Provider
 * Adapter for OpenAI's API (GPT-4o, GPT-4, GPT-3.5, etc.)
 */

import { OpenAICompatibleProvider } from './openaiCompatibleProvider.js';

/**
 * @typedef {import('./baseProvider.js').ProviderConfig} ProviderConfig
 * @typedef {import('./baseProvider.js').ModelInfo} ModelInfo
 */

/**
 * OpenAI API provider
 * @extends OpenAICompatibleProvider
 */
export class OpenAIProvider extends OpenAICompatibleProvider {
    /**
     * Creates a new OpenAI provider instance
     * @param {ProviderConfig} config - Provider configuration
     */
    constructor(config = {}) {
        super({
            baseUrl: 'https://api.openai.com/v1',
            model: 'gpt-4o',
            maxTokens: 4096,
            ...config
        });
    }

    /**
     * Gets the provider name identifier
     * @returns {string} Provider name
     */
    getName() {
        return 'openai';
    }

    /**
     * Gets a human-readable display name for the provider
     * @returns {string} Display name
     */
    getDisplayName() {
        return 'OpenAI';
    }

    /**
     * Gets available OpenAI models
     * @returns {ModelInfo[]} Array of available models
     */
    getAvailableModels() {
        return [
            // GPT-4o series
            {
                id: 'gpt-4o',
                name: 'GPT-4o (Latest)',
                contextWindow: 128000,
                supportsStreaming: true
            },
            {
                id: 'gpt-4o-mini',
                name: 'GPT-4o Mini',
                contextWindow: 128000,
                supportsStreaming: true
            },
            {
                id: 'gpt-4o-2024-11-20',
                name: 'GPT-4o (Nov 2024)',
                contextWindow: 128000,
                supportsStreaming: true
            },
            // GPT-4 Turbo
            {
                id: 'gpt-4-turbo',
                name: 'GPT-4 Turbo',
                contextWindow: 128000,
                supportsStreaming: true
            },
            {
                id: 'gpt-4-turbo-preview',
                name: 'GPT-4 Turbo Preview',
                contextWindow: 128000,
                supportsStreaming: true
            },
            // GPT-4
            {
                id: 'gpt-4',
                name: 'GPT-4',
                contextWindow: 8192,
                supportsStreaming: true
            },
            {
                id: 'gpt-4-32k',
                name: 'GPT-4 32K',
                contextWindow: 32768,
                supportsStreaming: true
            },
            // GPT-3.5
            {
                id: 'gpt-3.5-turbo',
                name: 'GPT-3.5 Turbo',
                contextWindow: 16385,
                supportsStreaming: true
            },
            {
                id: 'gpt-3.5-turbo-16k',
                name: 'GPT-3.5 Turbo 16K',
                contextWindow: 16385,
                supportsStreaming: true
            },
            // O1 series (reasoning models)
            {
                id: 'o1-preview',
                name: 'O1 Preview (Reasoning)',
                contextWindow: 128000,
                supportsStreaming: false
            },
            {
                id: 'o1-mini',
                name: 'O1 Mini (Reasoning)',
                contextWindow: 128000,
                supportsStreaming: false
            }
        ];
    }

    /**
     * Checks if streaming is supported
     * @returns {boolean} True
     */
    supportsStreaming() {
        return true;
    }

    /**
     * Validates the provider configuration
     * @returns {{valid: boolean, errors: string[]}} Validation result
     */
    validateConfig() {
        const errors = [];

        if (!this.getApiKey()) {
            errors.push('OpenAI API key is required');
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
     * Enhances request body with OpenAI-specific options
     * @protected
     * @param {Object} body - Request body
     * @param {Object} options - Generation options
     * @returns {Object} Enhanced request body
     */
    _enhanceRequestBody(body, options) {
        // O1 models don't support temperature, top_p, etc.
        if (this.config.model?.startsWith('o1')) {
            // Remove unsupported parameters for O1 models
            delete body.temperature;
            delete body.top_p;
            delete body.frequency_penalty;
            delete body.presence_penalty;
            delete body.stream;
        }

        // Add response format if JSON mode is requested
        if (options.jsonMode) {
            body.response_format = { type: 'json_object' };
        }

        // Add seed for reproducibility
        if (options.seed !== undefined) {
            body.seed = options.seed;
        }

        return body;
    }
}
