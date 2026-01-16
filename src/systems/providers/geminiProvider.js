/**
 * Gemini Provider
 * Adapter for Google's Gemini API with native message format.
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
 * Google Gemini API provider
 * @extends BaseProvider
 */
export class GeminiProvider extends BaseProvider {
    /**
     * Creates a new Gemini provider instance
     * @param {ProviderConfig} config - Provider configuration
     */
    constructor(config = {}) {
        super({
            baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
            model: 'gemini-2.0-flash',
            maxTokens: 8192,
            ...config
        });
    }

    /**
     * Gets the provider name identifier
     * @returns {string} Provider name
     */
    getName() {
        return 'gemini';
    }

    /**
     * Gets a human-readable display name for the provider
     * @returns {string} Display name
     */
    getDisplayName() {
        return 'Google Gemini';
    }

    /**
     * Gets available Gemini models
     * @returns {ModelInfo[]} Array of available models
     */
    getAvailableModels() {
        return [
            // Gemini 2.0 series
            {
                id: 'gemini-2.0-flash',
                name: 'Gemini 2.0 Flash',
                contextWindow: 1000000,
                supportsStreaming: true
            },
            {
                id: 'gemini-2.0-flash-lite',
                name: 'Gemini 2.0 Flash Lite',
                contextWindow: 1000000,
                supportsStreaming: true
            },
            // Gemini 1.5 series
            {
                id: 'gemini-1.5-pro',
                name: 'Gemini 1.5 Pro',
                contextWindow: 2000000,
                supportsStreaming: true
            },
            {
                id: 'gemini-1.5-flash',
                name: 'Gemini 1.5 Flash',
                contextWindow: 1000000,
                supportsStreaming: true
            },
            {
                id: 'gemini-1.5-flash-8b',
                name: 'Gemini 1.5 Flash 8B',
                contextWindow: 1000000,
                supportsStreaming: true
            },
            // Gemini 1.0 Pro
            {
                id: 'gemini-1.0-pro',
                name: 'Gemini 1.0 Pro',
                contextWindow: 32768,
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
     * Gets the localStorage key for storing this provider's API key
     * @returns {string} localStorage key
     */
    getApiKeyStorageKey() {
        return 'rpg_companion_gemini_api_key';
    }

    /**
     * Formats messages to Gemini's native format
     * Gemini uses "contents" with "parts" structure
     * @param {Message[]} messages - Array of messages in standard format
     * @returns {{systemInstruction: Object|undefined, contents: Array}} Gemini format
     */
    formatMessages(messages) {
        let systemInstruction = undefined;
        const contents = [];

        for (const msg of messages) {
            if (msg.role === 'system') {
                // Gemini uses systemInstruction for system messages
                if (systemInstruction) {
                    systemInstruction.parts[0].text += '\n\n' + msg.content;
                } else {
                    systemInstruction = {
                        parts: [{ text: msg.content }]
                    };
                }
            } else {
                // Map roles: user -> user, assistant -> model
                const role = msg.role === 'assistant' ? 'model' : 'user';
                contents.push({
                    role,
                    parts: [{ text: msg.content }]
                });
            }
        }

        // Gemini requires at least one content item
        if (contents.length === 0) {
            contents.push({
                role: 'user',
                parts: [{ text: 'Hello' }]
            });
        }

        // Ensure first message is from user
        if (contents[0].role !== 'user') {
            contents.unshift({
                role: 'user',
                parts: [{ text: '.' }]
            });
        }

        // Merge consecutive same-role messages (Gemini requires alternating)
        const mergedContents = [];
        let lastRole = null;

        for (const content of contents) {
            if (content.role === lastRole) {
                // Merge with previous message
                const lastContent = mergedContents[mergedContents.length - 1];
                lastContent.parts[0].text += '\n\n' + content.parts[0].text;
            } else {
                mergedContents.push(content);
                lastRole = content.role;
            }
        }

        return { systemInstruction, contents: mergedContents };
    }

    /**
     * Generates a response from Gemini
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
        const model = this.config.model;
        const apiKey = this.getApiKey();

        // Gemini API uses API key as query parameter
        const url = `${baseUrl}/models/${model}:generateContent?key=${apiKey}`;

        const { systemInstruction, contents } = this.formatMessages(messages);

        const body = {
            contents,
            generationConfig: {
                maxOutputTokens: options.maxTokens || this.config.maxTokens,
                temperature: options.temperature ?? this.config.temperature
            }
        };

        // Add system instruction if present
        if (systemInstruction) {
            body.systemInstruction = systemInstruction;
        }

        // Add optional parameters
        if (options.topP !== undefined) {
            body.generationConfig.topP = options.topP;
        }

        if (options.stop) {
            body.generationConfig.stopSequences = options.stop;
        }

        // Add safety settings (allow all content for roleplay)
        body.safetySettings = [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
        ];

        try {
            const response = await this._makeRequest(url, {
                method: 'POST',
                headers: this._getDefaultHeaders(),
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                throw await this._parseErrorResponse(response);
            }

            const data = await response.json();
            return this._parseGeminiResponse(data);

        } catch (error) {
            throw new Error(this._formatErrorMessage(error));
        }
    }

    /**
     * Parses Gemini's response format
     * @private
     * @param {Object} data - Raw API response
     * @returns {GenerationResponse} Parsed response
     */
    _parseGeminiResponse(data) {
        // Check for blocked content
        if (data.promptFeedback?.blockReason) {
            throw new Error(`Content blocked: ${data.promptFeedback.blockReason}`);
        }

        // Get the candidate response
        const candidate = data.candidates?.[0];
        if (!candidate) {
            throw new Error('No response generated');
        }

        // Check for safety filtering
        if (candidate.finishReason === 'SAFETY') {
            throw new Error('Response blocked by safety filters');
        }

        // Extract text content
        let content = '';
        if (candidate.content?.parts) {
            content = candidate.content.parts
                .filter(part => part.text)
                .map(part => part.text)
                .join('');
        }

        const response = {
            content,
            model: this.config.model,
            finishReason: candidate.finishReason
        };

        // Add usage info
        if (data.usageMetadata) {
            response.usage = {
                promptTokens: data.usageMetadata.promptTokenCount,
                completionTokens: data.usageMetadata.candidatesTokenCount,
                totalTokens: data.usageMetadata.totalTokenCount
            };
        }

        return response;
    }

    /**
     * Parses error responses specific to Gemini API
     * @protected
     * @param {Response} response - Fetch response
     * @returns {Promise<Error>} Parsed error
     */
    async _parseErrorResponse(response) {
        let errorMessage = `Gemini API error: ${response.status} ${response.statusText}`;

        try {
            const data = await response.json();

            if (data.error?.message) {
                errorMessage = data.error.message;
            }

            // Add error status if available
            if (data.error?.status) {
                errorMessage = `[${data.error.status}] ${errorMessage}`;
            }
        } catch {
            // JSON parsing failed, use default message
        }

        // Specific error handling
        if (response.status === 400) {
            if (errorMessage.includes('API key')) {
                errorMessage = 'Invalid API key. Please check your Google AI API key.';
            }
        } else if (response.status === 403) {
            errorMessage = 'Access forbidden. Please check your API key permissions.';
        } else if (response.status === 429) {
            errorMessage = 'Rate limit exceeded. Please wait before making more requests.';
        } else if (response.status === 503) {
            errorMessage = 'Gemini API is temporarily unavailable. Please try again later.';
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
            errors.push('Google AI API key is required');
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
