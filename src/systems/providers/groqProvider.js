/**
 * Groq Provider
 * Adapter for Groq's fast inference API.
 * Groq provides extremely fast inference for open-source models.
 */

import { OpenAICompatibleProvider } from './openaiCompatibleProvider.js';

/**
 * @typedef {import('./baseProvider.js').ProviderConfig} ProviderConfig
 * @typedef {import('./baseProvider.js').ModelInfo} ModelInfo
 */

/**
 * Groq fast inference provider
 * @extends OpenAICompatibleProvider
 */
export class GroqProvider extends OpenAICompatibleProvider {
    /**
     * Creates a new Groq provider instance
     * @param {ProviderConfig} config - Provider configuration
     */
    constructor(config = {}) {
        super({
            baseUrl: 'https://api.groq.com/openai/v1',
            model: 'llama-3.3-70b-versatile',
            maxTokens: 4096,
            ...config
        });
    }

    /**
     * Gets the provider name identifier
     * @returns {string} Provider name
     */
    getName() {
        return 'groq';
    }

    /**
     * Gets a human-readable display name for the provider
     * @returns {string} Display name
     */
    getDisplayName() {
        return 'Groq';
    }

    /**
     * Gets available Groq models
     * Groq hosts select open-source models optimized for their hardware
     * @returns {ModelInfo[]} Array of available models
     */
    getAvailableModels() {
        return [
            // Llama models
            {
                id: 'llama-3.3-70b-versatile',
                name: 'Llama 3.3 70B Versatile',
                contextWindow: 128000,
                supportsStreaming: true
            },
            {
                id: 'llama-3.1-70b-versatile',
                name: 'Llama 3.1 70B Versatile',
                contextWindow: 128000,
                supportsStreaming: true
            },
            {
                id: 'llama-3.1-8b-instant',
                name: 'Llama 3.1 8B Instant',
                contextWindow: 128000,
                supportsStreaming: true
            },
            {
                id: 'llama3-70b-8192',
                name: 'Llama 3 70B',
                contextWindow: 8192,
                supportsStreaming: true
            },
            {
                id: 'llama3-8b-8192',
                name: 'Llama 3 8B',
                contextWindow: 8192,
                supportsStreaming: true
            },
            // Mixtral
            {
                id: 'mixtral-8x7b-32768',
                name: 'Mixtral 8x7B',
                contextWindow: 32768,
                supportsStreaming: true
            },
            // Gemma
            {
                id: 'gemma2-9b-it',
                name: 'Gemma 2 9B',
                contextWindow: 8192,
                supportsStreaming: true
            },
            // DeepSeek
            {
                id: 'deepseek-r1-distill-llama-70b',
                name: 'DeepSeek R1 Distill Llama 70B',
                contextWindow: 128000,
                supportsStreaming: true
            },
            // Qwen
            {
                id: 'qwen-2.5-72b',
                name: 'Qwen 2.5 72B',
                contextWindow: 128000,
                supportsStreaming: true
            },
            {
                id: 'qwen-2.5-coder-32b',
                name: 'Qwen 2.5 Coder 32B',
                contextWindow: 128000,
                supportsStreaming: true
            }
        ];
    }

    /**
     * Fetches available models from Groq API
     * @returns {Promise<Array<{id: string, name: string}>>} Available models
     */
    async fetchAvailableModels() {
        try {
            const models = await super.fetchAvailableModels();

            // Filter to only chat models (exclude whisper, etc.)
            return models.filter(model =>
                !model.id.includes('whisper') &&
                !model.id.includes('distil-whisper')
            );
        } catch (error) {
            console.error('[Groq] Failed to fetch models:', error);
            return this.getAvailableModels();
        }
    }

    /**
     * Validates the provider configuration
     * @returns {{valid: boolean, errors: string[]}} Validation result
     */
    validateConfig() {
        const errors = [];

        if (!this.getApiKey()) {
            errors.push('Groq API key is required');
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
     * Enhances request body with Groq-specific options
     * @protected
     * @param {Object} body - Request body
     * @param {Object} options - Generation options
     * @returns {Object} Enhanced request body
     */
    _enhanceRequestBody(body, options) {
        // Groq uses standard OpenAI format but has some specific behaviors

        // Groq has very high rate limits but enforces them strictly
        // Don't request more tokens than necessary

        // JSON mode
        if (options.jsonMode) {
            body.response_format = { type: 'json_object' };
        }

        // Groq supports tool/function calling
        if (options.tools) {
            body.tools = options.tools;
        }

        if (options.toolChoice) {
            body.tool_choice = options.toolChoice;
        }

        return body;
    }

    /**
     * Tests the connection to Groq
     * @returns {Promise<{success: boolean, message: string, model?: string, latencyMs?: number}>}
     */
    async testConnection() {
        const startTime = Date.now();

        try {
            const testMessages = [
                { role: 'user', content: 'Respond with exactly: "Connection successful"' }
            ];

            const response = await this.generateResponse(testMessages, {
                maxTokens: 50,
                temperature: 0
            });

            const latencyMs = Date.now() - startTime;

            // Groq is known for fast inference, highlight the speed
            return {
                success: true,
                message: `Connection successful! Response time: ${latencyMs}ms (Groq is fast!)`,
                model: this.config.model,
                latencyMs
            };
        } catch (error) {
            // Check for common Groq-specific errors
            if (error.message.includes('rate_limit')) {
                return {
                    success: false,
                    message: 'Rate limit exceeded. Groq has generous limits but they are enforced. Please wait a moment.',
                    latencyMs: Date.now() - startTime
                };
            }

            if (error.message.includes('model_not_found')) {
                return {
                    success: false,
                    message: `Model "${this.config.model}" is not available on Groq. Check available models.`,
                    latencyMs: Date.now() - startTime
                };
            }

            return {
                success: false,
                message: this._formatErrorMessage(error),
                latencyMs: Date.now() - startTime
            };
        }
    }

    /**
     * Parses error responses specific to Groq API
     * @protected
     * @param {Response} response - Fetch response
     * @returns {Promise<Error>} Parsed error
     */
    async _parseErrorResponse(response) {
        let errorMessage = `Groq API error: ${response.status} ${response.statusText}`;

        try {
            const data = await response.json();

            if (data.error?.message) {
                errorMessage = data.error.message;
            }

            // Add error code if available
            if (data.error?.code) {
                errorMessage = `[${data.error.code}] ${errorMessage}`;
            }
        } catch {
            // JSON parsing failed, use default message
        }

        // Specific error handling
        if (response.status === 401) {
            errorMessage = 'Invalid API key. Please check your Groq API key.';
        } else if (response.status === 429) {
            errorMessage = 'Rate limit exceeded. Groq enforces rate limits strictly. Please wait before making more requests.';
        } else if (response.status === 503) {
            errorMessage = 'Groq service is temporarily unavailable. Please try again later.';
        }

        const error = new Error(errorMessage);
        error.status = response.status;
        return error;
    }

    /**
     * Gets rate limit information from response headers
     * @param {Response} response - Fetch response
     * @returns {Object|null} Rate limit info
     */
    _parseRateLimitInfo(response) {
        try {
            return {
                limitRequests: response.headers.get('x-ratelimit-limit-requests'),
                limitTokens: response.headers.get('x-ratelimit-limit-tokens'),
                remainingRequests: response.headers.get('x-ratelimit-remaining-requests'),
                remainingTokens: response.headers.get('x-ratelimit-remaining-tokens'),
                resetRequests: response.headers.get('x-ratelimit-reset-requests'),
                resetTokens: response.headers.get('x-ratelimit-reset-tokens')
            };
        } catch {
            return null;
        }
    }
}
