/**
 * Base Provider Class
 * Abstract base class that all LLM provider adapters must extend.
 * Defines the interface contract for provider implementations.
 */

/**
 * @typedef {Object} ProviderConfig
 * @property {string} [apiKey] - API key for authentication (stored in localStorage)
 * @property {string} [baseUrl] - Base URL for the API endpoint
 * @property {string} [model] - Model identifier to use
 * @property {number} [maxTokens] - Maximum tokens for generation (default: 2048)
 * @property {number} [temperature] - Temperature for generation (default: 0.7)
 * @property {number} [timeout] - Request timeout in milliseconds (default: 60000)
 * @property {Object} [additionalOptions] - Provider-specific options
 */

/**
 * @typedef {Object} Message
 * @property {'system'|'user'|'assistant'} role - Message role
 * @property {string} content - Message content
 */

/**
 * @typedef {Object} GenerationOptions
 * @property {number} [maxTokens] - Override max tokens for this request
 * @property {number} [temperature] - Override temperature for this request
 * @property {boolean} [stream] - Enable streaming response
 * @property {string[]} [stop] - Stop sequences
 * @property {number} [topP] - Top-p (nucleus) sampling
 * @property {number} [frequencyPenalty] - Frequency penalty
 * @property {number} [presencePenalty] - Presence penalty
 */

/**
 * @typedef {Object} GenerationResponse
 * @property {string} content - Generated text content
 * @property {string} [model] - Model that was used
 * @property {Object} [usage] - Token usage information
 * @property {number} [usage.promptTokens] - Tokens in the prompt
 * @property {number} [usage.completionTokens] - Tokens in the completion
 * @property {number} [usage.totalTokens] - Total tokens used
 * @property {string} [finishReason] - Reason generation stopped
 */

/**
 * @typedef {Object} ModelInfo
 * @property {string} id - Model identifier
 * @property {string} name - Human-readable model name
 * @property {number} [contextWindow] - Maximum context window size
 * @property {boolean} [supportsStreaming] - Whether model supports streaming
 */

/**
 * @typedef {Object} ConnectionTestResult
 * @property {boolean} success - Whether connection test passed
 * @property {string} message - Human-readable result message
 * @property {string} [model] - Model that was tested
 * @property {number} [latencyMs] - Response latency in milliseconds
 */

export class BaseProvider {
    /**
     * Creates a new provider instance
     * @param {ProviderConfig} config - Provider configuration
     */
    constructor(config = {}) {
        if (new.target === BaseProvider) {
            throw new Error('BaseProvider is abstract and cannot be instantiated directly');
        }

        this.config = {
            maxTokens: 2048,
            temperature: 0.7,
            timeout: 60000,
            ...config
        };

        // Rate limiting state
        this._lastRequestTime = 0;
        this._requestCount = 0;
        this._rateLimitResetTime = 0;
    }

    /**
     * Gets the provider name identifier
     * @returns {string} Provider name (e.g., 'claude', 'openai')
     */
    getName() {
        throw new Error('getName() must be implemented by subclass');
    }

    /**
     * Gets a human-readable display name for the provider
     * @returns {string} Display name (e.g., 'Anthropic Claude', 'OpenAI')
     */
    getDisplayName() {
        throw new Error('getDisplayName() must be implemented by subclass');
    }

    /**
     * Checks if this provider runs locally (no internet required)
     * @returns {boolean} True if local provider
     */
    isLocal() {
        return false;
    }

    /**
     * Checks if this provider requires an API key
     * @returns {boolean} True if API key is required
     */
    requiresApiKey() {
        return true;
    }

    /**
     * Checks if this provider supports streaming responses
     * @returns {boolean} True if streaming is supported
     */
    supportsStreaming() {
        return false;
    }

    /**
     * Gets the localStorage key for storing this provider's API key
     * @returns {string} localStorage key
     */
    getApiKeyStorageKey() {
        return `rpg_companion_${this.getName()}_api_key`;
    }

    /**
     * Gets the API key from localStorage
     * @returns {string|null} API key or null if not set
     */
    getApiKey() {
        return localStorage.getItem(this.getApiKeyStorageKey());
    }

    /**
     * Stores the API key in localStorage
     * @param {string} apiKey - API key to store
     */
    setApiKey(apiKey) {
        if (apiKey && apiKey.trim()) {
            localStorage.setItem(this.getApiKeyStorageKey(), apiKey.trim());
        } else {
            localStorage.removeItem(this.getApiKeyStorageKey());
        }
    }

    /**
     * Gets available models for this provider
     * @returns {ModelInfo[]} Array of available models
     */
    getAvailableModels() {
        return [];
    }

    /**
     * Formats messages to provider-specific format
     * Default implementation returns messages as-is (OpenAI format)
     * @param {Message[]} messages - Array of messages in standard format
     * @returns {any} Provider-specific message format
     */
    formatMessages(messages) {
        return messages;
    }

    /**
     * Generates a response from the LLM
     * @param {Message[]} messages - Array of messages for context
     * @param {GenerationOptions} [options={}] - Generation options
     * @returns {Promise<GenerationResponse>} Generated response
     */
    async generateResponse(messages, options = {}) {
        throw new Error('generateResponse() must be implemented by subclass');
    }

    /**
     * Tests the connection to the provider
     * @returns {Promise<ConnectionTestResult>} Test result
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

            return {
                success: true,
                message: `Connection successful! Response time: ${latencyMs}ms`,
                model: this.config.model,
                latencyMs
            };
        } catch (error) {
            return {
                success: false,
                message: this._formatErrorMessage(error),
                latencyMs: Date.now() - startTime
            };
        }
    }

    /**
     * Validates the provider configuration
     * @returns {{valid: boolean, errors: string[]}} Validation result
     */
    validateConfig() {
        const errors = [];

        if (this.requiresApiKey() && !this.getApiKey()) {
            errors.push('API key is required but not configured');
        }

        if (!this.config.model) {
            errors.push('Model is not specified');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Makes an HTTP request with error handling and rate limiting
     * @protected
     * @param {string} url - Request URL
     * @param {Object} options - Fetch options
     * @returns {Promise<Response>} Fetch response
     */
    async _makeRequest(url, options) {
        // Check rate limit
        if (this._rateLimitResetTime > Date.now()) {
            const waitTime = this._rateLimitResetTime - Date.now();
            throw new Error(`Rate limited. Please wait ${Math.ceil(waitTime / 1000)} seconds.`);
        }

        // Add timeout handling
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });

            // Track request timing for rate limiting
            this._lastRequestTime = Date.now();
            this._requestCount++;

            // Handle rate limit headers
            this._handleRateLimitHeaders(response.headers);

            return response;
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error(`Request timed out after ${this.config.timeout}ms`);
            }
            throw error;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    /**
     * Handles rate limit headers from the response
     * @protected
     * @param {Headers} headers - Response headers
     */
    _handleRateLimitHeaders(headers) {
        // Check for common rate limit headers
        const retryAfter = headers.get('retry-after');
        const rateLimitRemaining = headers.get('x-ratelimit-remaining');
        const rateLimitReset = headers.get('x-ratelimit-reset');

        if (retryAfter) {
            const retrySeconds = parseInt(retryAfter, 10);
            if (!isNaN(retrySeconds)) {
                this._rateLimitResetTime = Date.now() + (retrySeconds * 1000);
            }
        }

        if (rateLimitRemaining === '0' && rateLimitReset) {
            const resetTime = parseInt(rateLimitReset, 10);
            if (!isNaN(resetTime)) {
                // Reset time might be Unix timestamp or seconds from now
                this._rateLimitResetTime = resetTime > 1000000000
                    ? resetTime * 1000
                    : Date.now() + (resetTime * 1000);
            }
        }
    }

    /**
     * Parses an error response from the API
     * @protected
     * @param {Response} response - Fetch response
     * @returns {Promise<Error>} Parsed error
     */
    async _parseErrorResponse(response) {
        let errorMessage = `API error: ${response.status} ${response.statusText}`;

        try {
            const errorText = await response.text();

            // Try to parse as JSON
            try {
                const errorJson = JSON.parse(errorText);
                if (errorJson.error?.message) {
                    errorMessage = errorJson.error.message;
                } else if (errorJson.message) {
                    errorMessage = errorJson.message;
                } else if (errorJson.detail) {
                    errorMessage = errorJson.detail;
                }
            } catch {
                // Not JSON, use raw text if short enough
                if (errorText.length < 200) {
                    errorMessage = errorText;
                }
            }
        } catch {
            // Ignore parsing errors
        }

        // Check for specific error codes
        if (response.status === 401) {
            errorMessage = 'Authentication failed. Please check your API key.';
        } else if (response.status === 403) {
            errorMessage = 'Access forbidden. Your API key may not have permission for this operation.';
        } else if (response.status === 404) {
            errorMessage = 'API endpoint not found. Please check the base URL configuration.';
        } else if (response.status === 429) {
            errorMessage = 'Rate limit exceeded. Please wait before making more requests.';
        } else if (response.status >= 500) {
            errorMessage = `Server error (${response.status}). The API service may be experiencing issues.`;
        }

        const error = new Error(errorMessage);
        error.status = response.status;
        return error;
    }

    /**
     * Formats an error into a user-friendly message
     * @protected
     * @param {Error} error - Error object
     * @returns {string} Formatted error message
     */
    _formatErrorMessage(error) {
        if (error.name === 'TypeError' &&
            (error.message.includes('fetch') ||
             error.message.includes('Failed to fetch') ||
             error.message.includes('NetworkError'))) {
            return `Network error: Unable to reach the API. This may be a CORS issue if using a browser. Please check the API endpoint URL and ensure it supports CORS.`;
        }

        return error.message || 'An unknown error occurred';
    }

    /**
     * Gets default headers for API requests
     * @protected
     * @returns {Object} Headers object
     */
    _getDefaultHeaders() {
        return {
            'Content-Type': 'application/json'
        };
    }

    /**
     * Normalizes a base URL by removing trailing slashes
     * @protected
     * @param {string} url - URL to normalize
     * @returns {string} Normalized URL
     */
    _normalizeBaseUrl(url) {
        return (url || '').trim().replace(/\/+$/, '');
    }
}
