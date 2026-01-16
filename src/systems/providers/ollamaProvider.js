/**
 * Ollama Provider
 * Adapter for Ollama's local LLM server.
 * Ollama supports both its native API and OpenAI-compatible API.
 */

import { OpenAICompatibleProvider } from './openaiCompatibleProvider.js';

/**
 * @typedef {import('./baseProvider.js').ProviderConfig} ProviderConfig
 * @typedef {import('./baseProvider.js').ModelInfo} ModelInfo
 */

/**
 * Ollama local server provider
 * @extends OpenAICompatibleProvider
 */
export class OllamaProvider extends OpenAICompatibleProvider {
    /**
     * Creates a new Ollama provider instance
     * @param {ProviderConfig} config - Provider configuration
     */
    constructor(config = {}) {
        super({
            baseUrl: 'http://localhost:11434/v1',
            model: 'llama3.2',
            maxTokens: 2048,
            ...config
        });

        // Store native Ollama base URL for model listing
        this._ollamaBaseUrl = this._normalizeBaseUrl(config.baseUrl || 'http://localhost:11434');
    }

    /**
     * Gets the provider name identifier
     * @returns {string} Provider name
     */
    getName() {
        return 'ollama';
    }

    /**
     * Gets a human-readable display name for the provider
     * @returns {string} Display name
     */
    getDisplayName() {
        return 'Ollama';
    }

    /**
     * Checks if this provider runs locally
     * @returns {boolean} True (Ollama is local)
     */
    isLocal() {
        return true;
    }

    /**
     * Checks if this provider requires an API key
     * Ollama doesn't require authentication
     * @returns {boolean} False
     */
    requiresApiKey() {
        return false;
    }

    /**
     * Gets commonly used Ollama models
     * @returns {ModelInfo[]} Array of common models
     */
    getAvailableModels() {
        // Common Ollama models - actual availability depends on what's pulled
        return [
            {
                id: 'llama3.2',
                name: 'Llama 3.2 (3B)',
                contextWindow: 128000,
                supportsStreaming: true
            },
            {
                id: 'llama3.2:1b',
                name: 'Llama 3.2 (1B)',
                contextWindow: 128000,
                supportsStreaming: true
            },
            {
                id: 'llama3.1',
                name: 'Llama 3.1 (8B)',
                contextWindow: 128000,
                supportsStreaming: true
            },
            {
                id: 'llama3.1:70b',
                name: 'Llama 3.1 (70B)',
                contextWindow: 128000,
                supportsStreaming: true
            },
            {
                id: 'mistral',
                name: 'Mistral (7B)',
                contextWindow: 32768,
                supportsStreaming: true
            },
            {
                id: 'mixtral',
                name: 'Mixtral (8x7B)',
                contextWindow: 32768,
                supportsStreaming: true
            },
            {
                id: 'codellama',
                name: 'Code Llama',
                contextWindow: 16384,
                supportsStreaming: true
            },
            {
                id: 'deepseek-r1',
                name: 'DeepSeek R1',
                contextWindow: 64000,
                supportsStreaming: true
            },
            {
                id: 'qwen2.5',
                name: 'Qwen 2.5 (7B)',
                contextWindow: 128000,
                supportsStreaming: true
            },
            {
                id: 'gemma2',
                name: 'Gemma 2 (9B)',
                contextWindow: 8192,
                supportsStreaming: true
            },
            {
                id: 'phi3',
                name: 'Phi-3 (3.8B)',
                contextWindow: 4096,
                supportsStreaming: true
            }
        ];
    }

    /**
     * Fetches installed models from the Ollama server
     * Uses Ollama's native API for model listing
     * @returns {Promise<Array<{id: string, name: string}>>} Available models
     */
    async fetchAvailableModels() {
        try {
            // Use Ollama's native tags endpoint for listing models
            const response = await this._makeRequest(`${this._ollamaBaseUrl}/api/tags`, {
                method: 'GET',
                headers: this._getDefaultHeaders()
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch models: ${response.status}`);
            }

            const data = await response.json();
            const models = data.models || [];

            return models.map(model => ({
                id: model.name,
                name: this._formatModelName(model.name),
                contextWindow: model.details?.parameter_size ? undefined : undefined
            }));
        } catch (error) {
            console.error('[Ollama] Failed to fetch models:', error);
            // Fall back to common models list
            return this.getAvailableModels();
        }
    }

    /**
     * Formats a model name for display
     * @private
     * @param {string} modelName - Raw model name
     * @returns {string} Formatted name
     */
    _formatModelName(modelName) {
        // Capitalize and format model name
        return modelName
            .split(':')[0] // Remove tag
            .replace(/-/g, ' ')
            .replace(/\b\w/g, c => c.toUpperCase());
    }

    /**
     * Validates the provider configuration
     * @returns {{valid: boolean, errors: string[]}} Validation result
     */
    validateConfig() {
        const errors = [];

        // Base URL is required
        if (!this.config.baseUrl || !this.config.baseUrl.trim()) {
            errors.push('Ollama server URL is required');
        }

        // Model is required
        if (!this.config.model || !this.config.model.trim()) {
            errors.push('Model is not specified');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Tests the connection to Ollama
     * @returns {Promise<{success: boolean, message: string, model?: string}>}
     */
    async testConnection() {
        try {
            // First check if Ollama server is running
            const models = await this.fetchAvailableModels();

            if (models.length === 0) {
                return {
                    success: false,
                    message: 'Ollama server is running but no models are installed. Run "ollama pull llama3.2" to install a model.'
                };
            }

            // Check if the configured model is available
            const modelAvailable = models.some(m =>
                m.id === this.config.model ||
                m.id.startsWith(this.config.model + ':')
            );

            if (!modelAvailable) {
                return {
                    success: false,
                    message: `Model "${this.config.model}" is not installed. Available models: ${models.slice(0, 5).map(m => m.id).join(', ')}${models.length > 5 ? '...' : ''}`
                };
            }

            // Test generation
            return await super.testConnection();
        } catch (error) {
            if (error.message.includes('Failed to fetch') ||
                error.message.includes('NetworkError')) {
                return {
                    success: false,
                    message: 'Cannot connect to Ollama. Make sure Ollama is running (run "ollama serve" in terminal).'
                };
            }

            return {
                success: false,
                message: error.message
            };
        }
    }

    /**
     * Gets headers for Ollama API requests
     * Ollama doesn't require authentication
     * @protected
     * @returns {Object} Headers object
     */
    _getHeaders() {
        return this._getDefaultHeaders();
    }

    /**
     * Enhances request body with Ollama-specific options
     * @protected
     * @param {Object} body - Request body
     * @param {Object} options - Generation options
     * @returns {Object} Enhanced request body
     */
    _enhanceRequestBody(body, options) {
        // Ollama supports additional parameters through 'options' field
        const ollamaOptions = {};

        if (options.numCtx !== undefined) {
            ollamaOptions.num_ctx = options.numCtx;
        }

        if (options.numPredict !== undefined) {
            ollamaOptions.num_predict = options.numPredict;
        }

        if (options.repeatPenalty !== undefined) {
            ollamaOptions.repeat_penalty = options.repeatPenalty;
        }

        if (options.seed !== undefined) {
            ollamaOptions.seed = options.seed;
        }

        if (options.numGpu !== undefined) {
            ollamaOptions.num_gpu = options.numGpu;
        }

        // Add Ollama options if any were specified
        if (Object.keys(ollamaOptions).length > 0) {
            body.options = ollamaOptions;
        }

        // Keep alive time (how long to keep model loaded)
        if (options.keepAlive !== undefined) {
            body.keep_alive = options.keepAlive;
        }

        return body;
    }

    /**
     * Pulls (downloads) a model from Ollama's library
     * @param {string} modelName - Name of the model to pull
     * @param {Function} [onProgress] - Progress callback
     * @returns {Promise<boolean>} True if successful
     */
    async pullModel(modelName, onProgress) {
        try {
            const response = await this._makeRequest(`${this._ollamaBaseUrl}/api/pull`, {
                method: 'POST',
                headers: this._getDefaultHeaders(),
                body: JSON.stringify({ name: modelName, stream: false })
            });

            if (!response.ok) {
                throw new Error(`Failed to pull model: ${response.status}`);
            }

            return true;
        } catch (error) {
            console.error('[Ollama] Failed to pull model:', error);
            return false;
        }
    }
}
