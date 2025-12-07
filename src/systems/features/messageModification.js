/**
 * Message Modification Features
 * Handles interception and secret prompt attachment to user messages
 */

import { getContext } from '../../../../../../extensions.js';
import {
    chat,
    updateMessageBlock,
    generateRaw,
    substituteParams
} from '../../../../../../../script.js';

// Core modules
import { extensionSettings } from '../../core/state.js';

// Generation
import {
    generateContextualSummary,
    DEFAULT_MESSAGE_INTERCEPTION_PROMPT,
    DEFAULT_MESSAGE_INTERCEPTION_PROMPT_MARKDOWN
} from '../generation/promptBuilder.js';

/**
 * Intercepts the last user message, asks the LLM to rewrite it using RPG state and recent chat,
 * and updates the chat/DOM with the modified content.
 */
export async function interceptAndModifyUserMessage() {
    const context = getContext();
    const chatHistory = context.chat || chat;

    if (!chatHistory || chatHistory.length === 0) {
        return;
    }

    const lastMessage = chatHistory[chatHistory.length - 1];
    if (!lastMessage || !lastMessage.is_user) {
        return; // Only rewrite user messages
    }

    const originalText = lastMessage.mes || '';
    const stateJson = generateContextualSummary();
    const depth = extensionSettings.messageInterceptionContextDepth || extensionSettings.updateDepth || 4;
    const startIndex = Math.max(0, chatHistory.length - 1 - depth);
    const recentMessages = chatHistory.slice(startIndex, chatHistory.length - 1);

    const recentContext = recentMessages
        .map((m) => {
            const role = m.is_system ? 'system' : m.is_user ? '{{user}}' : '{{char}}';
            const content = (m.mes || '').replace(/\s+/g, ' ').trim();
            return `- ${role}: ${content}`;
        })
        .join('\n');

    const useMarkdown = extensionSettings.useMarkdownFormat;
    const defaultPrompt = useMarkdown ? DEFAULT_MESSAGE_INTERCEPTION_PROMPT_MARKDOWN : DEFAULT_MESSAGE_INTERCEPTION_PROMPT;
    const basePrompt = (extensionSettings.customMessageInterceptionPrompt || '').trim() || defaultPrompt;
    
    const formatName = useMarkdown ? 'markdown' : 'JSON';
    const fenceType = useMarkdown ? 'markdown' : 'json';

    const promptMessages = [
        {
            role: 'system',
            content: basePrompt
        },
        {
            role: 'system',
            content: `{{user}}'s persona definition:\n{{persona}}`
        },
        {
            role: 'system',
            content: `Current RPG state (${formatName}):\n${stateJson ? `\`\`\`${fenceType}\n${stateJson}\n\`\`\`` : 'None'}`
        },
        {
            role: 'system',
            content: `Recent messages (newest last):\n${recentContext || 'None'}`
        },
        {
            role: 'user',
            content: `User draft message:\n${originalText}\n\nReturn only the modified message text.`
        }
    ];

    const response = await generateRaw({
        prompt: promptMessages,
        quietToLoud: false
    });

    if (!response || typeof response !== 'string') {
        return;
    }

    const cleaned = response.trim();
    if (!cleaned) {
        return;
    }

    // Update chat history
    lastMessage.mes = cleaned;
    
    // Update DOM if the message element exists
    const messageId = chatHistory.length - 1;
    const messageElement = document.querySelector(`#chat .mes[mesid="${messageId}"]`);
    if (messageElement) {
        updateMessageBlock(messageId, lastMessage, { rerenderMessage: true });
    }
}

/**
 * Asks the LLM whether the secret prompt should be injected based on context.
 * @returns {Promise<boolean>} - true if the secret prompt should be injected
 */
async function shouldInjectSecretPrompt() {
    const context = getContext();
    const chatHistory = context.chat || chat;

    const llmInstructions = extensionSettings.secretPromptLLMInstructions;
    
    // If no LLM instructions configured, always inject
    if (!llmInstructions || !llmInstructions.trim()) {
        return true;
    }

    const depth = extensionSettings.secretPromptContextDepth || 4;
    const startIndex = Math.max(0, chatHistory.length - 1 - depth);
    const recentMessages = chatHistory.slice(startIndex, chatHistory.length - 1);

    const recentContext = recentMessages
        .map((m) => {
            const role = m.is_system ? 'system' : m.is_user ? '{{user}}' : '{{char}}';
            const content = (m.mes || '').replace(/\s+/g, ' ').trim();
            return `- ${role}: ${content}`;
        })
        .join('\n');

    const lastMessage = chatHistory[chatHistory.length - 1];
    const userMessage = lastMessage?.mes || '';

    const promptMessages = [
        {
            role: 'system',
            content: `You are a decision-making assistant. Based on the context provided, you must answer the following question: ${llmInstructions}
            You must respond with ONLY "YES" or "NO" - nothing else.`
        },
        {
            role: 'system',
            content: `Recent conversation context:\n${recentContext || 'None'}`
        },
        {
            role: 'user',
            content: `Current {{user}} message:\n${userMessage}`
        }
    ];

    try {
        const response = await generateRaw({
            prompt: promptMessages,
            quietToLoud: false
        });

        if (!response || typeof response !== 'string') {
            console.log('[RPG Companion] Secret Prompt LLM - No response, defaulting to inject');
            return true;
        }

        const cleaned = response.trim().toUpperCase();
        const shouldInject = cleaned.includes('YES');
        console.log(`[RPG Companion] Secret Prompt LLM decision: ${cleaned} -> ${shouldInject ? 'INJECT' : 'SKIP'}`);
        return shouldInject;
    } catch (error) {
        console.error('[RPG Companion] Secret Prompt LLM error:', error);
        return true; // Default to inject on error
    }
}

/**
 * Attaches a secret prompt to the last user message as an HTML comment.
 * Uses the secretPromptText from settings, or altSecretPromptText if LLM returns NO.
 * If LLM instructions are configured, asks the LLM first whether to use primary or alt prompt.
 */
export async function attachSecretPromptToUserMessage() {
    const context = getContext();
    const chatHistory = context.chat || chat;

    if (!chatHistory || chatHistory.length === 0) {
        return;
    }

    const lastMessage = chatHistory[chatHistory.length - 1];
    if (!lastMessage || !lastMessage.is_user) {
        return; // Only modify user messages
    }

    // Get the secret prompt texts from settings
    const secretPromptText = extensionSettings.secretPromptText;
    const altSecretPromptText = extensionSettings.altSecretPromptText;

    if (!secretPromptText || !secretPromptText.trim()) {
        console.log('[RPG Companion] Secret Prompt - No secret prompt text configured');
        return;
    }

    // Check with LLM if we should use primary prompt (if LLM instructions are configured)
    const usePrimary = await shouldInjectSecretPrompt();
    
    let promptToUse;
    if (usePrimary) {
        promptToUse = secretPromptText;
        console.log('[RPG Companion] Secret Prompt - Using primary prompt');
    } else if (altSecretPromptText && altSecretPromptText.trim()) {
        // LLM said NO - use alt prompt
        promptToUse = altSecretPromptText;
        console.log('[RPG Companion] Secret Prompt - LLM returned NO, using alt prompt');
    } else {
        // LLM said NO and no alt prompt configured
        console.log('[RPG Companion] Secret Prompt - LLM returned NO, no alt prompt configured, skipping');
        return;
    }

    // Evaluate SillyTavern macros and wrap in HTML comment
    const evaluated = substituteParams(promptToUse.trim());
    const secretPrompt = `<!-- ${evaluated} -->`;

    // Append to message
    lastMessage.mes = (lastMessage.mes || '') + '\n' + secretPrompt;

    console.log('[RPG Companion] Secret prompt attached:', secretPrompt);

    // Update DOM if the message element exists
    const messageId = chatHistory.length - 1;
    const messageElement = document.querySelector(`#chat .mes[mesid="${messageId}"]`);
    if (messageElement) {
        updateMessageBlock(messageId, lastMessage, { rerenderMessage: true });
    }
}
