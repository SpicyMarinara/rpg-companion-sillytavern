/**
 * Claude Provider
 * Adapter for Anthropic's Claude API with native message format.
 */

import { BaseProvider } from './baseProvider.js';

/**
 * @typedef {import('./baseProvider.js').ProviderConfig} ProviderConfig
 * @typedef {import('./baseProvider.js').Message} Message
 * @typedef {import('./baseProvider.js').GenerationOptions} GenerationOptions
 * @typedef {import('./baseProvider.js').GenerationResponse} GenerationResponse
 * @typedef {import('./baseProvider.js').ModelInfo} ModelInfo
 */

/**
 * Anthropic Claude API provider
 * @extends BaseProvider
 */
export class ClaudeProvider extends BaseProvider {
    /**
     * Creates a new Claude provider instance
     * @param {ProviderConfig} config - Provider configuration
     */
    constructor(config = {}) {
        super({
            baseUrl: 'https://api.anthropic.com',
            model: 'claude-sonnet-4-20250514',
            maxTokens: 4096,
            ...config
        });

        // Claude API version header
        this.apiVersion = '2023-06-01';
    }

    /**
     * Gets the provider name identifier
     * @returns {string} Provider name
     */
    getName() {
        return 'claude';
    }

    /**
     * Gets a human-readable display name for the provider
     * @returns {string} Display name
     */
    getDisplayName() {
        return 'Anthropic Claude';
    }

    /**
     * Gets available Claude models
     * @returns {ModelInfo[]} Array of available models
     */
    getAvailableModels() {
        return [
            {
                id: 'claude-opus-4-20250514',
                name: 'Claude Opus 4',
                contextWindow: 200000,
                supportsStreaming: true
            },
            {
                id: 'claude-sonnet-4-20250514',
                name: 'Claude Sonnet 4',
                contextWindow: 200000,
                supportsStreaming: true
            },
            {
                id: 'claude-3-5-sonnet-20241022',
                name: 'Claude 3.5 Sonnet',
                contextWindow: 200000,
                supportsStreaming: true
            },
            {
                id: 'claude-3-5-haiku-20241022',
                name: 'Claude 3.5 Haiku',
                contextWindow: 200000,
                supportsStreaming: true
            },
            {
                id: 'claude-3-opus-20240229',
                name: 'Claude 3 Opus',
                contextWindow: 200000,
                supportsStreaming: true
            },
            {
                id: 'claude-3-sonnet-20240229',
                name: 'Claude 3 Sonnet',
                contextWindow: 200000,
                supportsStreaming: true
            },
            {
                id: 'claude-3-haiku-20240307',
                name: 'Claude 3 Haiku',
                contextWindow: 200000,
                supportsStreaming: true
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
     * Gets headers for Anthropic API requests
     * @protected
     * @returns {Object} Headers object
     */
    _getHeaders() {
        const headers = this._getDefaultHeaders();
        const apiKey = this.getApiKey();

        if (apiKey) {
            headers['x-api-key'] = apiKey;
        }

        headers['anthropic-version'] = this.apiVersion;

        return headers;
    }

    /**
     * Formats messages to Claude's native format
     * Claude requires system message to be separate from the messages array
     * @param {Message[]} messages - Array of messages in standard format
     * @returns {{system: string|undefined, messages: Array}} Claude message format
     */
    formatMessages(messages) {
        let systemMessage = undefined;
        const formattedMessages = [];

        for (const msg of messages) {
            if (msg.role === 'system') {
                // Claude wants system as a separate parameter
                if (systemMessage) {
                    systemMessage += '\n\n' + msg.content;
                } else {
                    systemMessage = msg.content;
                }
            } else {
                formattedMessages.push({
                    role: msg.role,
                    content: msg.content
                });
            }
        }

        // Claude requires at least one message and it must start with user
        if (formattedMessages.length === 0) {
            formattedMessages.push({
                role: 'user',
                content: 'Hello'
            });
        }

        // Ensure first message is from user
        if (formattedMessages[0].role !== 'user') {
            formattedMessages.unshift({
                role: 'user',
                content: '.'
            });
        }

        // Ensure alternating user/assistant messages
        const cleanedMessages = [];
        let lastRole = null;

        for (const msg of formattedMessages) {
            if (msg.role === lastRole) {
                // Merge consecutive same-role messages
                cleanedMessages[cleanedMessages.length - 1].content += '\n\n' + msg.content;
            } else {
                cleanedMessages.push(msg);
                lastRole = msg.role;
            }
        }

        return { system: systemMessage, messages: cleanedMessages };
    }

    /**
     * Generates a response from Claude
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

        const baseUrl = this._normalizeBaseUrl(this.config.baseUrl);
        const url = `${baseUrl}/v1/messages`;
        const headers = this._getHeaders();

        const { system, messages: formattedMessages } = this.formatMessages(messages);

        const body = {
            model: this.config.model,
            messages: formattedMessages,
            max_tokens: options.maxTokens || this.config.maxTokens
        };

        // Add system message if present
        if (system) {
            body.system = system;
        }

        // Add optional parameters
        if (options.temperature !== undefined || this.config.temperature !== undefined) {
            body.temperature = options.temperature ?? this.config.temperature;
        }

        if (options.topP !== undefined) {
            body.top_p = options.topP;
        }

        if (options.stop) {
            body.stop_sequences = options.stop;
        }

        if (options.stream) {
            body.stream = true;
        }

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
            return this._parseClaudeResponse(data);

        } catch (error) {
            throw new Error(this._formatErrorMessage(error));
        }
    }

    /**
     * Parses Claude's response format
     * @private
     * @param {Object} data - Raw API response
     * @returns {GenerationResponse} Parsed response
     */
    _parseClaudeResponse(data) {
        // Claude returns content as an array of blocks
        let content = '';

        if (data.content && Array.isArray(data.content)) {
            content = data.content
                .filter(block => block.type === 'text')
                .map(block => block.text)
                .join('');
        }

        const response = {
            content,
            model: data.model,
            finishReason: data.stop_reason
        };

        // Add usage info
        if (data.usage) {
            response.usage = {
                promptTokens: data.usage.input_tokens,
                completionTokens: data.usage.output_tokens,
                totalTokens: (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0)
            };
        }

        return response;
    }

    /**
     * Parses error responses specific to Claude API
     * @protected
     * @param {Response} response - Fetch response
     * @returns {Promise<Error>} Parsed error
     */
    async _parseErrorResponse(response) {
        let errorMessage = `Claude API error: ${response.status} ${response.statusText}`;

        try {
            const data = await response.json();

            if (data.error?.message) {
                errorMessage = data.error.message;
            } else if (data.message) {
                errorMessage = data.message;
            }

            // Add type info if available
            if (data.error?.type) {
                errorMessage = `[${data.error.type}] ${errorMessage}`;
            }
        } catch {
            // JSON parsing failed, use default message
        }

        // Specific error handling
        if (response.status === 401) {
            errorMessage = 'Invalid API key. Please check your Anthropic API key.';
        } else if (response.status === 429) {
            errorMessage = 'Rate limit exceeded. Please wait before making more requests.';
        } else if (response.status === 529) {
            errorMessage = 'Anthropic API is overloaded. Please try again later.';
        }

        const error = new Error(errorMessage);
        error.status = response.status;
        return error;
    }

    /**
     * Validates the provider configuration
     * @returns {{valid: boolean, errors: string[]}} Validation result
     */
    validateConfig() {
        const errors = [];

        if (!this.getApiKey()) {
            errors.push('Anthropic API key is required');
        }

        if (!this.config.model || !this.config.model.trim()) {
            errors.push('Model is not specified');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }
}
