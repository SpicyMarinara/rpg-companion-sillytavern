/**
 * Message Modification Features
 * Handles interception and smart trigger functionality for user messages
 */

import { getContext } from '../../../../../../extensions.js';
import {
    chat,
    updateMessageBlock,
    generateRaw,
    substituteParams,
    setExtensionPrompt,
    extension_prompt_types
} from '../../../../../../../script.js';

// Core modules
import { extensionSettings } from '../../core/state.js';

// Generation
import {
    generateContextualSummary,
    DEFAULT_MESSAGE_INTERCEPTION_PROMPT,
    DEFAULT_MESSAGE_INTERCEPTION_PROMPT_MARKDOWN
} from '../generation/promptBuilder.js';

/** Extension prompt identifier for smart trigger */
const SMART_TRIGGER_PROMPT_ID = 'rpg-companion-smart-trigger';

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
 * Clears the Smart Trigger extension prompt.
 * Should be called after generation ends.
 */
export function clearSmartTriggerPrompt() {
    setExtensionPrompt(SMART_TRIGGER_PROMPT_ID, '', extension_prompt_types.IN_CHAT, 0, false);
    console.log('[RPG Companion] Smart Trigger - Cleared extension prompt');
}

/**
 * Executes the Smart Trigger feature.
 * Sends the smart trigger instructions to the LLM with context, then injects
 * the LLM's response as a temporary system message via extension prompt.
 * The message is sent to the LLM but not persisted in chat history.
 */
export async function executeSmartTrigger() {
    const context = getContext();
    const chatHistory = context.chat || chat;

    if (!chatHistory || chatHistory.length === 0) {
        return;
    }

    // Get the smart trigger text from settings
    const smartTriggerText = extensionSettings.smartTriggerText;
    if (!smartTriggerText || !smartTriggerText.trim()) {
        console.log('[RPG Companion] Smart Trigger - No trigger text configured');
        return;
    }

    // Build context from recent messages
    const depth = extensionSettings.smartTriggerContextDepth || 4;
    const endIndex = chatHistory.length;
    const startIndex = Math.max(0, endIndex - depth);
    const recentMessages = chatHistory.slice(startIndex, endIndex);

    const recentContext = recentMessages
        .map((m) => {
            const role = m.is_system ? 'system' : m.is_user ? '{{user}}' : '{{char}}';
            const content = (m.mes || '').replace(/\s+/g, ' ').trim();
            return `- ${role}: ${content}`;
        })
        .join('\n');

    // Evaluate SillyTavern macros in the trigger text
    const evaluatedTrigger = substituteParams(smartTriggerText.trim());

    const promptMessages = [
        {
            role: 'system',
            content: 'You are an assistant tasked with executing the user\'s instructions based on the recent messages.'
        },
        {
            role: 'user',
            content: evaluatedTrigger
        },
        {
            role: 'user',
            content: `Recent messages (newest last):\n${recentContext || 'None'}`
        }
    ];

    try {
        const response = await generateRaw({
            prompt: promptMessages,
            quietToLoud: false
        });

        if (!response || typeof response !== 'string') {
            console.log('[RPG Companion] Smart Trigger - No response from LLM');
            return;
        }

        const triggerOutput = response.trim();
        if (!triggerOutput) {
            console.log('[RPG Companion] Smart Trigger - Empty response from LLM');
            return;
        }

        setExtensionPrompt(
            SMART_TRIGGER_PROMPT_ID,
            triggerOutput,
            extension_prompt_types.IN_CHAT,
            1,  // Before the last user message
            true, // scan for world info
            extension_prompt_types.ROLE_SYSTEM
        );

        console.log('[RPG Companion] Smart Trigger - Injected extension prompt:', triggerOutput);

    } catch (error) {
        console.error('[RPG Companion] Smart Trigger error:', error);
    }
}
