/**
 * OpenAI-Compatible Provider Base Class
 * Shared implementation for providers that use OpenAI-compatible API format.
 * This includes LM Studio, Ollama, Groq, OpenRouter, and other compatible services.
 */

import { BaseProvider } from './baseProvider.js';

/**
 * @typedef {import('./baseProvider.js').ProviderConfig} ProviderConfig
 * @typedef {import('./baseProvider.js').Message} Message
 * @typedef {import('./baseProvider.js').GenerationOptions} GenerationOptions
 * @typedef {import('./baseProvider.js').GenerationResponse} GenerationResponse
 */

/**
 * Base class for providers using OpenAI-compatible chat completions API
 * @extends BaseProvider
 */
export class OpenAICompatibleProvider extends BaseProvider {
    /**
     * Creates a new OpenAI-compatible provider instance
     * @param {ProviderConfig} config - Provider configuration
     */
    constructor(config = {}) {
        super(config);

        // Default endpoint path (can be overridden by subclasses)
        this.completionsEndpoint = '/chat/completions';
        this.modelsEndpoint = '/models';
    }

    /**
     * Gets the full URL for the completions endpoint
     * @returns {string} Full completions URL
     */
    getCompletionsUrl() {
        const baseUrl = this._normalizeBaseUrl(this.config.baseUrl);
        return `${baseUrl}${this.completionsEndpoint}`;
    }

    /**
     * Gets the full URL for the models endpoint
     * @returns {string} Full models URL
     */
    getModelsUrl() {
        const baseUrl = this._normalizeBaseUrl(this.config.baseUrl);
        return `${baseUrl}${this.modelsEndpoint}`;
    }

    /**
     * Gets headers for API requests including authorization
     * @protected
     * @returns {Object} Headers object
     */
    _getHeaders() {
        const headers = this._getDefaultHeaders();
        const apiKey = this.getApiKey();

        if (apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`;
        }

        return headers;
    }

    /**
     * Builds the request body for chat completions
     * @protected
     * @param {Message[]} messages - Array of messages
     * @param {GenerationOptions} options - Generation options
     * @returns {Object} Request body
     */
    _buildRequestBody(messages, options = {}) {
        const body = {
            model: this.config.model,
            messages: this.formatMessages(messages),
            max_tokens: options.maxTokens || this.config.maxTokens,
            temperature: options.temperature ?? this.config.temperature
        };

        // Add optional parameters if specified
        if (options.stop) {
            body.stop = options.stop;
        }

        if (options.topP !== undefined) {
            body.top_p = options.topP;
        }

        if (options.frequencyPenalty !== undefined) {
            body.frequency_penalty = options.frequencyPenalty;
        }

        if (options.presencePenalty !== undefined) {
            body.presence_penalty = options.presencePenalty;
        }

        if (options.stream) {
            body.stream = true;
        }

        // Allow subclasses to add provider-specific options
        return this._enhanceRequestBody(body, options);
    }

    /**
     * Hook for subclasses to add provider-specific options to request body
     * @protected
     * @param {Object} body - Request body
     * @param {GenerationOptions} options - Generation options
     * @returns {Object} Enhanced request body
     */
    _enhanceRequestBody(body, options) {
        return body;
    }

    /**
     * Parses the completion response into standard format
     * @protected
     * @param {Object} data - Raw API response data
     * @returns {GenerationResponse} Parsed response
     */
    _parseCompletionResponse(data) {
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new Error('Invalid response format: missing choices or message');
        }

        const choice = data.choices[0];

        const response = {
            content: choice.message.content || '',
            model: data.model,
            finishReason: choice.finish_reason
        };

        // Add usage info if available
        if (data.usage) {
            response.usage = {
                promptTokens: data.usage.prompt_tokens,
                completionTokens: data.usage.completion_tokens,
                totalTokens: data.usage.total_tokens
            };
        }

        return response;
    }

    /**
     * Generates a response from the LLM
     * @param {Message[]} messages - Array of messages for context
     * @param {GenerationOptions} [options={}] - Generation options
     * @returns {Promise<GenerationResponse>} Generated response
     */
    async generateResponse(messages, options = {}) {
        // Validate configuration
        const validation = this.validateConfig();
        if (!validation.valid) {
            throw new Error(`Configuration error: ${validation.errors.join(', ')}`);
        }

        const url = this.getCompletionsUrl();
        const headers = this._getHeaders();
        const body = this._buildRequestBody(messages, options);

        try {
            const response = await this._makeRequest(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                throw await this._parseErrorResponse(response);
            }

            const data = await response.json();
            return this._parseCompletionResponse(data);

        } catch (error) {
            // Re-throw with formatted message
            throw new Error(this._formatErrorMessage(error));
        }
    }

    /**
     * Fetches available models from the API
     * @returns {Promise<Array<{id: string, name: string}>>} Available models
     */
    async fetchAvailableModels() {
        const url = this.getModelsUrl();
        const headers = this._getHeaders();

        try {
            const response = await this._makeRequest(url, {
                method: 'GET',
                headers
            });

            if (!response.ok) {
                throw await this._parseErrorResponse(response);
            }

            const data = await response.json();

            // OpenAI format returns { data: [...models] }
            const models = data.data || data;

            return models.map(model => ({
                id: model.id,
                name: model.name || model.id,
                contextWindow: model.context_window || model.context_length
            }));

        } catch (error) {
            console.error(`[${this.getName()}] Failed to fetch models:`, error);
            return [];
        }
    }

    /**
     * Validates the provider configuration
     * @returns {{valid: boolean, errors: string[]}} Validation result
     */
    validateConfig() {
        const errors = [];

        // Base URL is required for OpenAI-compatible providers
        if (!this.config.baseUrl || !this.config.baseUrl.trim()) {
            errors.push('Base URL is required');
        }

        // Model is required
        if (!this.config.model || !this.config.model.trim()) {
            errors.push('Model is not specified');
        }

        // API key may or may not be required depending on provider
        if (this.requiresApiKey() && !this.getApiKey()) {
            errors.push('API key is required but not configured');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Checks if streaming is supported
     * @returns {boolean} True if streaming is supported
     */
    supportsStreaming() {
        return true;
    }
}
