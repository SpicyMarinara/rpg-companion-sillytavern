/**
 * LM Studio Provider
 * Adapter for LM Studio's local OpenAI-compatible server.
 * LM Studio runs models locally and exposes an OpenAI-compatible API.
 */

import { OpenAICompatibleProvider } from './openaiCompatibleProvider.js';

/**
 * @typedef {import('./baseProvider.js').ProviderConfig} ProviderConfig
 * @typedef {import('./baseProvider.js').ModelInfo} ModelInfo
 */

/**
 * LM Studio local server provider
 * @extends OpenAICompatibleProvider
 */
export class LMStudioProvider extends OpenAICompatibleProvider {
    /**
     * Creates a new LM Studio provider instance
     * @param {ProviderConfig} config - Provider configuration
     */
    constructor(config = {}) {
        super({
            baseUrl: 'http://localhost:1234/v1',
            model: 'local-model',
            maxTokens: 2048,
            ...config
        });
    }

    /**
     * Gets the provider name identifier
     * @returns {string} Provider name
     */
    getName() {
        return 'lmstudio';
    }

    /**
     * Gets a human-readable display name for the provider
     * @returns {string} Display name
     */
    getDisplayName() {
        return 'LM Studio';
    }

    /**
     * Checks if this provider runs locally
     * @returns {boolean} True (LM Studio is local)
     */
    isLocal() {
        return true;
    }

    /**
     * Checks if this provider requires an API key
     * LM Studio doesn't require authentication by default
     * @returns {boolean} False
     */
    requiresApiKey() {
        return false;
    }

    /**
     * Gets available models from LM Studio
     * Models are dynamically loaded, so we fetch from the server
     * @returns {ModelInfo[]} Array of available models
     */
    getAvailableModels() {
        // LM Studio models are loaded dynamically
        // Return empty - use fetchAvailableModels() for actual models
        return [];
    }

    /**
     * Fetches available models from the LM Studio server
     * @returns {Promise<Array<{id: string, name: string}>>} Available models
     */
    async fetchAvailableModels() {
        try {
            const models = await super.fetchAvailableModels();

            // LM Studio returns models with paths, clean up names
            return models.map(model => ({
                id: model.id,
                name: this._formatModelName(model.id),
                contextWindow: model.contextWindow
            }));
        } catch (error) {
            console.error('[LMStudio] Failed to fetch models:', error);
            return [];
        }
    }

    /**
     * Formats a model ID into a readable name
     * @private
     * @param {string} modelId - Raw model ID
     * @returns {string} Formatted name
     */
    _formatModelName(modelId) {
        // LM Studio model IDs often include paths
        // Extract just the model name
        const parts = modelId.split('/');
        const name = parts[parts.length - 1];

        // Remove file extension if present
        return name.replace(/\.(gguf|bin|safetensors)$/i, '');
    }

    /**
     * Validates the provider configuration
     * @returns {{valid: boolean, errors: string[]}} Validation result
     */
    validateConfig() {
        const errors = [];

        // Base URL is required
        if (!this.config.baseUrl || !this.config.baseUrl.trim()) {
            errors.push('LM Studio server URL is required');
        }

        // Model is required
        if (!this.config.model || !this.config.model.trim()) {
            errors.push('Model is not specified');
        }

        // No API key required for LM Studio

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Tests the connection to LM Studio
     * @returns {Promise<{success: boolean, message: string, model?: string}>}
     */
    async testConnection() {
        try {
            // First try to list models to verify server is running
            const models = await this.fetchAvailableModels();

            if (models.length === 0) {
                return {
                    success: false,
                    message: 'LM Studio server responded but no models are loaded. Please load a model in LM Studio.'
                };
            }

            // Then test generation
            return await super.testConnection();
        } catch (error) {
            // Check for common LM Studio connection issues
            if (error.message.includes('Failed to fetch') ||
                error.message.includes('NetworkError')) {
                return {
                    success: false,
                    message: 'Cannot connect to LM Studio. Make sure LM Studio is running and the server is started (Settings > Server).'
                };
            }

            return {
                success: false,
                message: error.message
            };
        }
    }

    /**
     * Gets headers for LM Studio API requests
     * LM Studio typically doesn't need authentication
     * @protected
     * @returns {Object} Headers object
     */
    _getHeaders() {
        const headers = this._getDefaultHeaders();

        // LM Studio may accept an API key for compatibility
        // but doesn't require one
        const apiKey = this.getApiKey();
        if (apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`;
        }

        return headers;
    }

    /**
     * Enhances request body with LM Studio-specific options
     * @protected
     * @param {Object} body - Request body
     * @param {Object} options - Generation options
     * @returns {Object} Enhanced request body
     */
    _enhanceRequestBody(body, options) {
        // LM Studio supports additional parameters

        // Repeat penalty (helps with repetitive outputs)
        if (options.repeatPenalty !== undefined) {
            body.repeat_penalty = options.repeatPenalty;
        }

        // Min-P sampling (better than top-p for some models)
        if (options.minP !== undefined) {
            body.min_p = options.minP;
        }

        // Mirostat sampling
        if (options.mirostat !== undefined) {
            body.mirostat = options.mirostat;
        }

        // Cache the prompt (improves speed for similar prompts)
        if (options.cachePrompt !== false) {
            // LM Studio caches by default
        }

        return body;
    }
}
