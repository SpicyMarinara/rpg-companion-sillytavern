/**
 * Prompt Injector Module
 * Handles injection of RPG tracker prompts into the generation context
 */

import { getContext } from '../../../../../../extensions.js';
import { extension_prompt_types, extension_prompt_roles, setExtensionPrompt, eventSource, event_types } from '../../../../../../../script.js';
import {
    extensionSettings,
    committedTrackerData,
    lastGeneratedData,
    isGenerating,
    lastActionWasSwipe
} from '../../core/state.js';
import { evaluateSuppression } from './suppression.js';
import { parseUserStats } from './parser.js';
import {
    generateTrackerExample,
    generateTrackerInstructions,
    generateContextualSummary,
    formatHistoricalTrackerData,
    DEFAULT_HTML_PROMPT,
    DEFAULT_DIALOGUE_COLORING_PROMPT,
    DEFAULT_DECEPTION_PROMPT,
    DEFAULT_OMNISCIENCE_FILTER_PROMPT,
    DEFAULT_CYOA_PROMPT,
    DEFAULT_SPOTIFY_PROMPT,
    DEFAULT_NARRATOR_PROMPT,
    DEFAULT_CONTEXT_INSTRUCTIONS_PROMPT,
    SPOTIFY_FORMAT_INSTRUCTION
} from './promptBuilder.js';
import { restoreCheckpointOnLoad } from '../features/chapterCheckpoint.js';
import { commitTrackerDataFromPriorMessage } from '../../core/persistence.js';

// Track suppression state for event handler
let currentSuppressionState = false;

// Type imports
/** @typedef {import('../../types/inventory.js').InventoryV2} InventoryV2 */

// Track the latest user message we committed for to prevent duplicate commits
// when GENERATION_STARTED can fire multiple times for the same turn.
let lastCommittedUserMessageSignature = null;

// Store context map for prompt injection (used by event handlers)
let pendingContextMap = new Map();

// Flag to track if injection already happened in BEFORE_COMBINE
let historyInjectionDone = false;

/**
 * Builds a map of historical context data from ST chat messages with rpg_companion_swipes data.
 * Returns a map keyed by message index with formatted context strings.
 * The index stored depends on the injection position setting.
 *
 * @returns {Map<number, string>} Map of target message index to formatted context string
 */
function buildHistoricalContextMap() {
    const historyPersistence = extensionSettings.historyPersistence;
    if (!historyPersistence || !historyPersistence.enabled) {
        return new Map();
    }

    const context = getContext();
    const chat = context.chat;
    if (!chat || chat.length < 2) {
        return new Map();
    }

    const trackerConfig = extensionSettings.trackerConfig;
    const userName = context.name1;
    const position = historyPersistence.injectionPosition || 'assistant_message_end';
    const contextMap = new Map();

    // Determine how many messages to include (0 = all available)
    const messageCount = historyPersistence.messageCount || 0;
    const maxMessages = messageCount === 0 ? chat.length : Math.min(messageCount, chat.length);

    // Find the last assistant message - this is the one that gets current context via setExtensionPrompt
    // We should NOT add historical context to it when injecting into assistant messages
    // But when injecting into user messages, we DO need to process it to get context for the preceding user message
    let lastAssistantIndex = -1;
    for (let i = chat.length - 1; i >= 0; i--) {
        if (!chat[i].is_user && !chat[i].is_system) {
            lastAssistantIndex = i;
            break;
        }
    }

    // Iterate through messages to find those with tracker data
    // For user_message_end: start from the last assistant message (we need its context for the preceding user message)
    // For assistant_message_end: start from before the last assistant message (it gets current context via setExtensionPrompt)
    let processedCount = 0;
    const startIndex = position === 'user_message_end'
        ? lastAssistantIndex
        : (lastAssistantIndex > 0 ? lastAssistantIndex - 1 : chat.length - 2);

    for (let i = startIndex; i >= 0 && (messageCount === 0 || processedCount < maxMessages); i--) {
        const message = chat[i];

        // Skip system messages
        if (message.is_system) {
            continue;
        }

        // Only assistant messages have rpg_companion_swipes data
        if (message.is_user) {
            continue;
        }

        // Get the rpg_companion_swipes data for current swipe
        // Data can be in two places:
        // 1. message.extra.rpg_companion_swipes (current session, before save)
        // 2. message.swipe_info[swipeId].extra.rpg_companion_swipes (loaded from file)
        const currentSwipeId = message.swipe_id || 0;
        let swipeData = message.extra?.rpg_companion_swipes;

        // If not in message.extra, check swipe_info
        if (!swipeData && message.swipe_info && message.swipe_info[currentSwipeId]) {
            swipeData = message.swipe_info[currentSwipeId].extra?.rpg_companion_swipes;
        }

        if (!swipeData) {
            continue;
        }

        const trackerData = swipeData[currentSwipeId];
        if (!trackerData) {
            continue;
        }

        // Format the historical tracker data using the shared function
        const formattedContext = formatHistoricalTrackerData(trackerData, trackerConfig, userName);
        if (!formattedContext) {
            continue;
        }

        // Build the context wrapper
        const preamble = historyPersistence.contextPreamble || 'Context for that moment:';
        const wrappedContext = `\n${preamble}\n${formattedContext}`;

        // Determine which message index to store based on injection position
        let targetIndex = i; // Default: the assistant message itself

        if (position === 'user_message_end') {
            // Find the preceding user message before this assistant message
            // This is the user message that prompted this assistant response
            for (let j = i - 1; j >= 0; j--) {
                if (chat[j].is_user && !chat[j].is_system) {
                    targetIndex = j;
                    break;
                }
            }
            // If no user message found before, skip this one
            if (targetIndex === i) {
                continue;
            }
        }
        // For assistant_message_end, extra_user_message, extra_assistant_message:
        // We inject into the assistant message itself (for now - extra messages handled differently)

        // Store the context keyed by target index
        // If multiple assistant messages map to the same user message, append
        if (contextMap.has(targetIndex)) {
            contextMap.set(targetIndex, contextMap.get(targetIndex) + wrappedContext);
        } else {
            contextMap.set(targetIndex, wrappedContext);
        }

        processedCount++;
    }

    return contextMap;
}

/**
 * Prepares historical context for injection into prompts.
 * This builds the context map and stores it for use by prompt event handlers.
 * Does NOT modify the original chat messages.
 */
function prepareHistoricalContextInjection() {
    const historyPersistence = extensionSettings.historyPersistence;
    if (!historyPersistence || !historyPersistence.enabled) {
        pendingContextMap = new Map();
        return;
    }

    if (currentSuppressionState || !extensionSettings.enabled) {
        pendingContextMap = new Map();
        return;
    }

    const context = getContext();
    const chat = context.chat;
    if (!chat || chat.length < 2) {
        pendingContextMap = new Map();
        historyInjectionDone = false;
        return;
    }

    // Build and store the context map for use by prompt handlers
    pendingContextMap = buildHistoricalContextMap();
    historyInjectionDone = false; // Reset flag for new generation
}

/**
 * Finds the best match position for message content in the prompt.
 * Tries full content first, then progressively smaller suffixes.
 *
 * @param {string} prompt - The prompt to search in
 * @param {string} messageContent - The message content to find
 * @returns {{start: number, end: number}|null} - Position info or null if not found
 */
function findMessageInPrompt(prompt, messageContent) {
    if (!messageContent || !prompt) {
        return null;
    }

    // Try to find the full content first
    let searchIndex = prompt.lastIndexOf(messageContent);

    if (searchIndex !== -1) {
        return { start: searchIndex, end: searchIndex + messageContent.length };
    }

    // If full content not found, try last N characters with progressively smaller chunks
    // This handles cases where messages are truncated in the prompt
    const searchLengths = [500, 300, 200, 100, 50];

    for (const len of searchLengths) {
        if (messageContent.length <= len) {
            continue;
        }

        const searchContent = messageContent.slice(-len);
        searchIndex = prompt.lastIndexOf(searchContent);

        if (searchIndex !== -1) {
            return { start: searchIndex, end: searchIndex + searchContent.length };
        }
    }

    return null;
}

/**
 * Injects historical context into a text completion prompt string.
 * Searches for message content in the prompt and appends context after matches.
 *
 * @param {string} prompt - The text completion prompt
 * @returns {string} - The modified prompt with injected context
 */
function injectContextIntoTextPrompt(prompt) {
    if (pendingContextMap.size === 0) {
        return prompt;
    }

    const context = getContext();
    const chat = context.chat;
    let modifiedPrompt = prompt;
    let injectedCount = 0;

    // Sort by message index descending so we inject from end to start
    // This prevents position shifts from affecting earlier injections
    const sortedEntries = Array.from(pendingContextMap.entries()).sort((a, b) => b[0] - a[0]);

    // Process each message that needs context injection
    for (const [msgIdx, ctxContent] of sortedEntries) {
        const message = chat[msgIdx];
        if (!message || typeof message.mes !== 'string') {
            continue;
        }

        // Find the message content in the prompt
        const position = findMessageInPrompt(modifiedPrompt, message.mes);

        if (!position) {
            // Message not found in prompt (might be truncated or not included)
            console.debug(`[RPG Companion] Could not find message ${msgIdx} in prompt for context injection`);
            continue;
        }

        // Insert the context after the message content
        modifiedPrompt = modifiedPrompt.slice(0, position.end) + ctxContent + modifiedPrompt.slice(position.end);
        injectedCount++;
    }

    if (injectedCount > 0) {
        console.log(`[RPG Companion] Injected historical context into ${injectedCount} positions in text prompt`);
    }

    return modifiedPrompt;
}

/**
 * Injects historical context into a chat completion message array.
 * Modifies the content of messages in the array directly.
 *
 * @param {Array} chatMessages - The chat completion message array
 * @returns {Array} - The modified message array with injected context
 */
function injectContextIntoChatPrompt(chatMessages) {
    if (pendingContextMap.size === 0 || !Array.isArray(chatMessages)) {
        return chatMessages;
    }

    const context = getContext();
    const chat = context.chat;
    let injectedCount = 0;

    // Process each message that needs context injection
    for (const [msgIdx, ctxContent] of pendingContextMap) {
        const originalMessage = chat[msgIdx];
        if (!originalMessage || typeof originalMessage.mes !== 'string') {
            continue;
        }

        const messageContent = originalMessage.mes;

        // Find this message in the chat completion array by matching content
        // Try full content first, then progressively smaller suffixes
        let found = false;

        for (const promptMsg of chatMessages) {
            if (!promptMsg.content || typeof promptMsg.content !== 'string') {
                continue;
            }

            // Try full content match
            if (promptMsg.content.includes(messageContent)) {
                promptMsg.content = promptMsg.content + ctxContent;
                injectedCount++;
                found = true;
                break;
            }

            // Try suffix matches for truncated messages
            const searchLengths = [500, 300, 200, 100, 50];
            for (const len of searchLengths) {
                if (messageContent.length <= len) {
                    continue;
                }

                const searchContent = messageContent.slice(-len);
                if (promptMsg.content.includes(searchContent)) {
                    promptMsg.content = promptMsg.content + ctxContent;
                    injectedCount++;
                    found = true;
                    break;
                }
            }

            if (found) {
                break;
            }
        }

        if (!found) {
            console.debug(`[RPG Companion] Could not find message ${msgIdx} in chat prompt for context injection`);
        }
    }

    if (injectedCount > 0) {
        console.log(`[RPG Companion] Injected historical context into ${injectedCount} messages in chat prompt`);
    }

    return chatMessages;
}

/**
 * Injects historical context into finalMesSend message array (text completion).
 * Iterates through chat and finalMesSend in order, matching by content to skip injected messages.
 *
 * @param {Array} finalMesSend - The array of message objects {message: string, extensionPrompts: []}
 * @returns {number} - Number of injections made
 */
function injectContextIntoFinalMesSend(finalMesSend) {
    if (pendingContextMap.size === 0 || !Array.isArray(finalMesSend) || finalMesSend.length === 0) {
        return 0;
    }

    const context = getContext();
    const chat = context.chat;
    if (!chat || chat.length === 0) {
        return 0;
    }

    let injectedCount = 0;

    // Build a map from chat index to finalMesSend index by matching content in order
    // This handles injected messages (author's note, OOC, etc.) that exist in finalMesSend but not in chat
    const chatToMesSendMap = new Map();
    let mesSendIdx = 0;

    for (let chatIdx = 0; chatIdx < chat.length && mesSendIdx < finalMesSend.length; chatIdx++) {
        const chatMsg = chat[chatIdx];
        if (!chatMsg || chatMsg.is_system) {
            continue;
        }

        const chatContent = chatMsg.mes || '';

        // Look for this chat message in finalMesSend starting from current position
        // Skip any finalMesSend entries that don't match (they're injected content)
        while (mesSendIdx < finalMesSend.length) {
            const mesSendObj = finalMesSend[mesSendIdx];
            if (!mesSendObj || !mesSendObj.message) {
                mesSendIdx++;
                continue;
            }

            // Check if this finalMesSend message contains the chat content
            // Use a substring match since instruct formatting adds prefixes/suffixes
            // Match with sufficient content (first 50 chars or full message if shorter)
            const matchContent = chatContent.length > 50
                ? chatContent.substring(0, 50)
                : chatContent;

            if (matchContent && mesSendObj.message.includes(matchContent)) {
                // Found a match - record the mapping
                chatToMesSendMap.set(chatIdx, mesSendIdx);
                mesSendIdx++;
                break;
            }

            // This finalMesSend entry doesn't match - it's injected content, skip it
            mesSendIdx++;
        }
    }

    // Now inject context using the map
    for (const [chatIdx, ctxContent] of pendingContextMap) {
        const targetMesSendIdx = chatToMesSendMap.get(chatIdx);

        if (targetMesSendIdx === undefined) {
            console.debug(`[RPG Companion] Chat message ${chatIdx} not found in finalMesSend mapping`);
            continue;
        }

        const mesSendObj = finalMesSend[targetMesSendIdx];
        if (!mesSendObj || !mesSendObj.message) {
            continue;
        }

        // Append context to this message
        mesSendObj.message = mesSendObj.message + ctxContent;
        injectedCount++;
        console.debug(`[RPG Companion] Injected context for chat[${chatIdx}] into finalMesSend[${targetMesSendIdx}]`);
    }

    return injectedCount;
}

/**
 * Event handler for GENERATE_BEFORE_COMBINE_PROMPTS (text completion).
 * Injects historical context into the finalMesSend array before prompt combination.
 * This is more reliable than post-combine string searching.
 *
 * @param {Object} eventData - Event data with finalMesSend and other properties
 */
function onGenerateBeforeCombinePrompts(eventData) {
    if (!eventData || !Array.isArray(eventData.finalMesSend)) {
        return;
    }

    // Skip for OpenAI (uses chat completion)
    if (eventData.api === 'openai') {
        return;
    }

    // Only inject if we have pending context
    if (pendingContextMap.size === 0) {
        return;
    }

    const injectedCount = injectContextIntoFinalMesSend(eventData.finalMesSend);
    if (injectedCount > 0) {
        console.log(`[RPG Companion] Injected historical context into ${injectedCount} messages in finalMesSend`);
        historyInjectionDone = true; // Mark as done to prevent double injection
    }
}

/**
 * Event handler for GENERATE_AFTER_COMBINE_PROMPTS (text completion).
 * This is now a backup/fallback - primary injection happens in BEFORE_COMBINE.
 * Also fixes newline spacing after </context> tag.
 *
 * @param {Object} eventData - Event data with prompt property
 */
function onGenerateAfterCombinePrompts(eventData) {
    if (!eventData || typeof eventData.prompt !== 'string') {
        return;
    }

    if (eventData.dryRun) {
        return;
    }

    let didInjectHistory = false;

    // Inject historical context if available and not already done
    if (!historyInjectionDone && pendingContextMap.size > 0) {
        // Fallback injection for edge cases where BEFORE_COMBINE didn't work
        console.log('[RPG Companion] Using fallback string-based injection (AFTER_COMBINE)');
        eventData.prompt = injectContextIntoTextPrompt(eventData.prompt);
        didInjectHistory = true;
    }

    // Always fix newlines around context tags (whether we just injected or not)
    eventData.prompt = eventData.prompt.replace(/<context>/g, '\n<context>');
    eventData.prompt = eventData.prompt.replace(/<\/context>/g, '</context>\n');
}

/**
 * Event handler for CHAT_COMPLETION_PROMPT_READY.
 * Injects historical context into the chat message array.
 * Also fixes newline spacing around <context> tags.
 *
 * @param {Object} eventData - Event data with chat property
 */
function onChatCompletionPromptReady(eventData) {
    if (!eventData || !Array.isArray(eventData.chat)) {
        return;
    }

    if (eventData.dryRun) {
        return;
    }

    // Inject historical context if we have pending context
    if (pendingContextMap.size > 0) {
        eventData.chat = injectContextIntoChatPrompt(eventData.chat);
        // DON'T clear pendingContextMap here - let it persist for other generations
        // (e.g., prewarm extensions). It will be cleared on GENERATION_ENDED.
    }

    // Fix newlines around context tags for all messages
    for (const message of eventData.chat) {
        if (message.content && typeof message.content === 'string') {
            message.content = message.content.replace(/<context>/g, '\n<context>');
            message.content = message.content.replace(/<\/context>/g, '</context>\n');
        }
    }
}

/**
 * Event handler for generation start.
 * Manages tracker data commitment and prompt injection based on generation mode.
 *
 * @param {string} type - Event type
 * @param {Object} data - Event data
 * @param {boolean} dryRun - If true, this is a dry run (page reload, prompt preview, etc.) - skip all logic
 */
export async function onGenerationStarted(type, data, dryRun) {
    // Skip dry runs (page reload, prompt manager preview, etc.)
    if (dryRun) {
        // console.log('[RPG Companion] Skipping onGenerationStarted: dry run detected');
        return;
    }

    // console.log('[RPG Companion] onGenerationStarted called');
    // console.log('[RPG Companion] enabled:', extensionSettings.enabled);
    // console.log('[RPG Companion] generationMode:', extensionSettings.generationMode);
    // console.log('[RPG Companion] ⚡ EVENT: onGenerationStarted - lastActionWasSwipe =', lastActionWasSwipe, '| isGenerating =', isGenerating);
    // console.log('[RPG Companion] Committed Prompt:', committedTrackerData);

    // Skip tracker injection for image generation requests
    if (data?.quietImage || data?.quiet_image || data?.isImageGeneration) {
        // console.log('[RPG Companion] Detected image generation, skipping tracker injection');
        return;
    }

    if (!extensionSettings.enabled) {
        // Extension is disabled - clear any existing prompts to ensure nothing is injected
        setExtensionPrompt('rpg-companion-inject', '', extension_prompt_types.IN_CHAT, 0, false);
        setExtensionPrompt('rpg-companion-example', '', extension_prompt_types.IN_CHAT, 0, false);
        setExtensionPrompt('rpg-companion-html', '', extension_prompt_types.IN_CHAT, 0, false);
        setExtensionPrompt('rpg-companion-dialogue-coloring', '', extension_prompt_types.IN_CHAT, 0, false);
        setExtensionPrompt('rpg-companion-spotify', '', extension_prompt_types.IN_CHAT, 0, false);
        setExtensionPrompt('rpg-companion-context', '', extension_prompt_types.IN_CHAT, 1, false);
        return;
    }

    const context = getContext();
    const chat = context.chat;
    // Detect if a guided generation is active (GuidedGenerations and similar extensions
    // inject an ephemeral 'instruct' injection into chatMetadata.script_injects).
    // If present, we should avoid injecting RPG tracker instructions that ask
    // the model to include stats/etc. This prevents conflicts when guided prompts
    // are used (e.g., GuidedGenerations Extension).
    // Evaluate suppression using the shared helper
    const suppression = evaluateSuppression(extensionSettings, context, data);
    const { shouldSuppress, skipMode, isGuidedGeneration, isImpersonationGeneration, hasQuietPrompt, instructContent, quietPromptRaw, matchedPattern } = suppression;

    if (shouldSuppress) {
        // Debugging: indicate active suppression and which source triggered it
        console.debug(`[RPG Companion] Suppression active (mode=${skipMode}). isGuided=${isGuidedGeneration}, isImpersonation=${isImpersonationGeneration}, hasQuietPrompt=${hasQuietPrompt} - skipping RPG tracker injections for this generation.`);

        // Also clear any existing RPG Companion prompts so they do not leak into this generation
        // (e.g., previously set extension prompts should not be used alongside a guided prompt)
        setExtensionPrompt('rpg-companion-inject', '', extension_prompt_types.IN_CHAT, 0, false);
        setExtensionPrompt('rpg-companion-example', '', extension_prompt_types.IN_CHAT, 0, false);
        setExtensionPrompt('rpg-companion-html', '', extension_prompt_types.IN_CHAT, 0, false);
        setExtensionPrompt('rpg-companion-spotify', '', extension_prompt_types.IN_CHAT, 0, false);
        setExtensionPrompt('rpg-companion-context', '', extension_prompt_types.IN_CHAT, 1, false);
    }

    // Ensure checkpoint is applied before generation
    await restoreCheckpointOnLoad();

    const isSwipeOrRegenerate = type === 'swipe' || type === 'regenerate';

    // If this is a new generation (not a swipe and not the tracker update pass),
    // commit the tracker data from the last assistant message (N-1 rule).
    // Passing chat.length ensures we start searching backwards from the end of the chat,
    // correctly finding the latest valid assistant state regardless of where the user message is.
    if (!lastActionWasSwipe && !isGenerating && !isSwipeOrRegenerate) {
        commitTrackerDataFromPriorMessage(chat ? chat.length : 0);
    }

    // The old reply is still the last message here, skip it
    if (isSwipeOrRegenerate && !isGenerating) {
        commitTrackerDataFromPriorMessage(chat ? chat.length - 1 : 0);
    }

    // Use the committed tracker data as source for generation
    // console.log('[RPG Companion] Using committedTrackerData for generation');
    // console.log('[RPG Companion] committedTrackerData.userStats:', committedTrackerData.userStats);

    // Parse stats from committed data to update the extensionSettings for prompt generation
    if (committedTrackerData.userStats) {
        // console.log('[RPG Companion] Parsing committed userStats into extensionSettings');
        parseUserStats(committedTrackerData.userStats);
        // console.log('[RPG Companion] After parsing, extensionSettings.userStats:', JSON.stringify(extensionSettings.userStats));
    }

    if (extensionSettings.generationMode === 'together') {
        // console.log('[RPG Companion] In together mode, generating prompts...');
        const exampleRaw = generateTrackerExample();
        // Wrap example in ```json``` code blocks for consistency with format instructions
        // Add only 1 newline after the closing ``` (ST adds its own newline when injecting)
        const example = exampleRaw ? `\`\`\`json\n${exampleRaw}\n\`\`\`\n` : null;
        // Don't include HTML prompt in instructions - inject it separately to avoid duplication on swipes
        const instructions = generateTrackerInstructions(false, true);

        // Clear separate mode context injection - we don't use contextual summary in together mode
        setExtensionPrompt('rpg-companion-context', '', extension_prompt_types.IN_CHAT, 1, false);

        // console.log('[RPG Companion] Example:', example ? 'exists' : 'empty');
        // console.log('[RPG Companion] Chat length:', chat ? chat.length : 'chat is null');

        // Find the last assistant message in the chat history
        let lastAssistantDepth = -1; // -1 means not found
        if (chat && chat.length > 0) {
            // console.log('[RPG Companion] Searching for last assistant message...');
            // Start from depth 1 (skip depth 0 which is usually user's message or prefill)
            for (let depth = 1; depth < chat.length; depth++) {
                const index = chat.length - 1 - depth; // Convert depth to index
                const message = chat[index];
                // console.log('[RPG Companion] Checking depth', depth, 'index', index, 'message properties:', Object.keys(message));
                // Check for assistant message: not user and not system
                if (!message.is_user && !message.is_system) {
                    // Found assistant message at this depth
                    // Inject at the SAME depth to prepend to this assistant message
                    lastAssistantDepth = depth;
                    // console.log('[RPG Companion] Found last assistant message at depth', depth, '-> injecting at same depth:', lastAssistantDepth);
                    break;
                }
            }
        }

        // If we have previous tracker data and found an assistant message, inject it as an assistant message
        if (!shouldSuppress && example && lastAssistantDepth > 0) {
            setExtensionPrompt('rpg-companion-example', example, extension_prompt_types.IN_CHAT, lastAssistantDepth, false, extension_prompt_roles.ASSISTANT);
            // console.log('[RPG Companion] Injected tracker example as assistant message at depth:', lastAssistantDepth);
        } else {
            // console.log('[RPG Companion] NOT injecting example. example:', !!example, 'lastAssistantDepth:', lastAssistantDepth);
        }

        // Inject the instructions as a user message at depth 0 (right before generation)
        // If this is a guided generation (user explicitly injected 'instruct'), skip adding
        // our tracker instructions to avoid clobbering the guided prompt.
        if (!shouldSuppress) {
            setExtensionPrompt('rpg-companion-inject', instructions, extension_prompt_types.IN_CHAT, 0, false, extension_prompt_roles.USER);
        }
        // console.log('[RPG Companion] Injected RPG tracking instructions at depth 0 (right before generation)');

        // Inject HTML prompt separately at depth 0 if enabled (prevents duplication on swipes)
        if (extensionSettings.enableHtmlPrompt && !shouldSuppress) {
            // Use custom HTML prompt if set, otherwise use default
            const htmlPromptText = extensionSettings.customHtmlPrompt || DEFAULT_HTML_PROMPT;
            const htmlPrompt = `\n- ${htmlPromptText}\n`;

            setExtensionPrompt('rpg-companion-html', htmlPrompt, extension_prompt_types.IN_CHAT, 0, false);
            // console.log('[RPG Companion] Injected HTML prompt at depth 0 for together mode');
        } else {
            // Clear HTML prompt if disabled
            setExtensionPrompt('rpg-companion-html', '', extension_prompt_types.IN_CHAT, 0, false);
        }

        // Inject Dialogue Coloring prompt separately at depth 0 if enabled
        if (extensionSettings.enableDialogueColoring && !shouldSuppress) {
            // Use custom Dialogue Coloring prompt if set, otherwise use default
            const dialogueColoringPromptText = extensionSettings.customDialogueColoringPrompt || DEFAULT_DIALOGUE_COLORING_PROMPT;
            const dialogueColoringPrompt = `\n- ${dialogueColoringPromptText}\n`;

            setExtensionPrompt('rpg-companion-dialogue-coloring', dialogueColoringPrompt, extension_prompt_types.IN_CHAT, 0, false);
            // console.log('[RPG Companion] Injected Dialogue Coloring prompt at depth 0 for together mode');
        } else {
            // Clear Dialogue Coloring prompt if disabled
            setExtensionPrompt('rpg-companion-dialogue-coloring', '', extension_prompt_types.IN_CHAT, 0, false);
        }

        // Inject Deception System prompt separately at depth 0 if enabled
        if (extensionSettings.enableDeceptionSystem && !shouldSuppress) {
            // Use custom Deception prompt if set, otherwise use default
            const deceptionPromptText = extensionSettings.customDeceptionPrompt || DEFAULT_DECEPTION_PROMPT;
            const deceptionPrompt = `\n- ${deceptionPromptText}\n`;

            setExtensionPrompt('rpg-companion-deception', deceptionPrompt, extension_prompt_types.IN_CHAT, 0, false);
            // console.log('[RPG Companion] Injected Deception System prompt at depth 0 for together mode');
        } else {
            // Clear Deception System prompt if disabled
            setExtensionPrompt('rpg-companion-deception', '', extension_prompt_types.IN_CHAT, 0, false);
        }

        // Inject Omniscience Filter prompt separately at depth 0 if enabled
        if (extensionSettings.enableOmniscienceFilter && !shouldSuppress) {
            // Use custom Omniscience Filter prompt if set, otherwise use default
            const omnisciencePromptText = extensionSettings.customOmnisciencePrompt || DEFAULT_OMNISCIENCE_FILTER_PROMPT;
            const omnisciencePrompt = `\n${omnisciencePromptText}\n`;

            setExtensionPrompt('rpg-companion-omniscience', omnisciencePrompt, extension_prompt_types.IN_CHAT, 0, false);
            // console.log('[RPG Companion] Injected Omniscience Filter prompt at depth 0 for together mode');
        } else {
            // Clear Omniscience Filter prompt if disabled
            setExtensionPrompt('rpg-companion-omniscience', '', extension_prompt_types.IN_CHAT, 0, false);
        }

        // Inject Spotify prompt separately at depth 0 if enabled
        if (extensionSettings.enableSpotifyMusic && !shouldSuppress) {
            // Use custom Spotify prompt if set, otherwise use default
            const spotifyPromptText = extensionSettings.customSpotifyPrompt || DEFAULT_SPOTIFY_PROMPT;
            const spotifyPrompt = `\n- ${spotifyPromptText} ${SPOTIFY_FORMAT_INSTRUCTION}\n`;

            setExtensionPrompt('rpg-companion-spotify', spotifyPrompt, extension_prompt_types.IN_CHAT, 0, false);
            // console.log('[RPG Companion] Injected Spotify prompt at depth 0 for together mode');
        } else {
            // Clear Spotify prompt if disabled
            setExtensionPrompt('rpg-companion-spotify', '', extension_prompt_types.IN_CHAT, 0, false);
        }

        // Inject CYOA prompt separately at depth 0 if enabled (injected last to appear last in prompt)
        if (extensionSettings.enableCYOA && !shouldSuppress) {
            // Use custom CYOA prompt if set, otherwise use default
            const cyoaPromptText = extensionSettings.customCYOAPrompt || DEFAULT_CYOA_PROMPT;
            const cyoaPrompt = `\n- ${cyoaPromptText}\n`;

            setExtensionPrompt('rpg-companion-zzz-cyoa', cyoaPrompt, extension_prompt_types.IN_CHAT, 0, false);
            // console.log('[RPG Companion] Injected CYOA prompt at depth 0 for together mode');
        } else {
            // Clear CYOA prompt if disabled
            setExtensionPrompt('rpg-companion-zzz-cyoa', '', extension_prompt_types.IN_CHAT, 0, false);
        }

    } else if (extensionSettings.generationMode === 'separate' || extensionSettings.generationMode === 'external') {
        // In SEPARATE and EXTERNAL modes, inject the contextual summary for main roleplay generation
        const contextSummary = generateContextualSummary();

        if (contextSummary) {
            // Use custom context instructions prompt if set, otherwise use default
            const contextInstructionsText = extensionSettings.customContextInstructionsPrompt || DEFAULT_CONTEXT_INSTRUCTIONS_PROMPT;

            const wrappedContext = `
<context>
${contextSummary}
${contextInstructionsText}
</context>`;

            // Inject context at depth 1 (before last user message) as SYSTEM
            // Skip when a guided generation injection is present to avoid conflicting instructions
            if (!shouldSuppress) {
                setExtensionPrompt('rpg-companion-context', wrappedContext, extension_prompt_types.IN_CHAT, 1, false);
            }
            // console.log('[RPG Companion] Injected contextual summary for separate/external mode:', contextSummary);
        } else {
            // Clear if no data yet
            setExtensionPrompt('rpg-companion-context', '', extension_prompt_types.IN_CHAT, 1, false);
        }

        // Inject HTML prompt separately at depth 0 if enabled (same as together mode pattern)
        if (extensionSettings.enableHtmlPrompt && !shouldSuppress) {
            // Use custom HTML prompt if set, otherwise use default
            const htmlPromptText = extensionSettings.customHtmlPrompt || DEFAULT_HTML_PROMPT;
            const htmlPrompt = `\n- ${htmlPromptText}\n`;

            setExtensionPrompt('rpg-companion-html', htmlPrompt, extension_prompt_types.IN_CHAT, 0, false);
            // console.log('[RPG Companion] Injected HTML prompt at depth 0 for separate/external mode');
        } else {
            // Clear HTML prompt if disabled
            setExtensionPrompt('rpg-companion-html', '', extension_prompt_types.IN_CHAT, 0, false);
        }

        // Inject Dialogue Coloring prompt separately at depth 0 if enabled
        if (extensionSettings.enableDialogueColoring && !shouldSuppress) {
            // Use custom Dialogue Coloring prompt if set, otherwise use default
            const dialogueColoringPromptText = extensionSettings.customDialogueColoringPrompt || DEFAULT_DIALOGUE_COLORING_PROMPT;
            const dialogueColoringPrompt = `\n- ${dialogueColoringPromptText}\n`;

            setExtensionPrompt('rpg-companion-dialogue-coloring', dialogueColoringPrompt, extension_prompt_types.IN_CHAT, 0, false);
            // console.log('[RPG Companion] Injected Dialogue Coloring prompt at depth 0 for separate/external mode');
        } else {
            // Clear Dialogue Coloring prompt if disabled
            setExtensionPrompt('rpg-companion-dialogue-coloring', '', extension_prompt_types.IN_CHAT, 0, false);
        }

        // Inject Deception System prompt separately at depth 0 if enabled
        if (extensionSettings.enableDeceptionSystem && !shouldSuppress) {
            // Use custom Deception prompt if set, otherwise use default
            const deceptionPromptText = extensionSettings.customDeceptionPrompt || DEFAULT_DECEPTION_PROMPT;
            const deceptionPrompt = `\n- ${deceptionPromptText}\n`;

            setExtensionPrompt('rpg-companion-deception', deceptionPrompt, extension_prompt_types.IN_CHAT, 0, false);
            // console.log('[RPG Companion] Injected Deception System prompt at depth 0 for separate/external mode');
        } else {
            // Clear Deception System prompt if disabled
            setExtensionPrompt('rpg-companion-deception', '', extension_prompt_types.IN_CHAT, 0, false);
        }

        // Inject Omniscience Filter prompt separately at depth 0 if enabled
        if (extensionSettings.enableOmniscienceFilter && !shouldSuppress) {
            // Use custom Omniscience Filter prompt if set, otherwise use default
            const omnisciencePromptText = extensionSettings.customOmnisciencePrompt || DEFAULT_OMNISCIENCE_FILTER_PROMPT;
            const omnisciencePrompt = `\n${omnisciencePromptText}\n`;

            setExtensionPrompt('rpg-companion-omniscience', omnisciencePrompt, extension_prompt_types.IN_CHAT, 0, false);
            // console.log('[RPG Companion] Injected Omniscience Filter prompt at depth 0 for separate/external mode');
        } else {
            // Clear Omniscience Filter prompt if disabled
            setExtensionPrompt('rpg-companion-omniscience', '', extension_prompt_types.IN_CHAT, 0, false);
        }

        // Inject Spotify prompt separately at depth 0 if enabled
        if (extensionSettings.enableSpotifyMusic && !shouldSuppress) {
            // Use custom Spotify prompt if set, otherwise use default
            const spotifyPromptText = extensionSettings.customSpotifyPrompt || DEFAULT_SPOTIFY_PROMPT;
            const spotifyPrompt = `\n- ${spotifyPromptText} ${SPOTIFY_FORMAT_INSTRUCTION}\n`;

            setExtensionPrompt('rpg-companion-spotify', spotifyPrompt, extension_prompt_types.IN_CHAT, 0, false);
            // console.log('[RPG Companion] Injected Spotify prompt at depth 0 for separate/external mode');
        } else {
            // Clear Spotify prompt if disabled
            setExtensionPrompt('rpg-companion-spotify', '', extension_prompt_types.IN_CHAT, 0, false);
        }

        // Inject CYOA prompt separately at depth 0 if enabled (injected last to appear last in prompt)
        if (extensionSettings.enableCYOA && !shouldSuppress) {
            // Use custom CYOA prompt if set, otherwise use default
            const cyoaPromptText = extensionSettings.customCYOAPrompt || DEFAULT_CYOA_PROMPT;
            const cyoaPrompt = `\n- ${cyoaPromptText}\n`;

            setExtensionPrompt('rpg-companion-zzz-cyoa', cyoaPrompt, extension_prompt_types.IN_CHAT, 0, false);
            // console.log('[RPG Companion] Injected CYOA prompt at depth 0 for separate/external mode');
        } else {
            // Clear CYOA prompt if disabled
            setExtensionPrompt('rpg-companion-zzz-cyoa', '', extension_prompt_types.IN_CHAT, 0, false);
        }

        // Clear together mode injections
        setExtensionPrompt('rpg-companion-inject', '', extension_prompt_types.IN_CHAT, 0, false);
        setExtensionPrompt('rpg-companion-example', '', extension_prompt_types.IN_CHAT, 0, false);
    } else {
        // Clear all injections
        setExtensionPrompt('rpg-companion-inject', '', extension_prompt_types.IN_CHAT, 0, false);
        setExtensionPrompt('rpg-companion-example', '', extension_prompt_types.IN_CHAT, 0, false);
        setExtensionPrompt('rpg-companion-context', '', extension_prompt_types.IN_CHAT, 1, false);
        setExtensionPrompt('rpg-companion-html', '', extension_prompt_types.IN_CHAT, 0, false);
        setExtensionPrompt('rpg-companion-dialogue-coloring', '', extension_prompt_types.IN_CHAT, 0, false);
        setExtensionPrompt('rpg-companion-deception', '', extension_prompt_types.IN_CHAT, 0, false);
        setExtensionPrompt('rpg-companion-omniscience', '', extension_prompt_types.IN_CHAT, 0, false);
        setExtensionPrompt('rpg-companion-zzz-cyoa', '', extension_prompt_types.IN_CHAT, 0, false);
        setExtensionPrompt('rpg-companion-spotify', '', extension_prompt_types.IN_CHAT, 0, false);
    }

    // Set suppression state for the historical context injection
    currentSuppressionState = shouldSuppress;

    // Prepare historical context for injection into prompts
    // This builds the context map but does NOT modify original chat messages
    // The persistent event listeners will inject it into all prompts until cleared
    prepareHistoricalContextInjection();
}

/**
 * Initialize the history injection event listeners.
 * These are persistent listeners that inject context into ALL generations
 * while pendingContextMap has data. Should be called once at extension init.
 */
export function initHistoryInjectionListeners() {
    // Register persistent listeners for prompt injection
    // These check pendingContextMap and only inject if there's data

    // Primary: BEFORE_COMBINE for text completion (more reliable - modifies message objects)
    eventSource.on(event_types.GENERATE_BEFORE_COMBINE_PROMPTS, onGenerateBeforeCombinePrompts);

    // Fallback: AFTER_COMBINE for text completion (string-based injection)
    eventSource.on(event_types.GENERATE_AFTER_COMBINE_PROMPTS, onGenerateAfterCombinePrompts);

    // Chat completion (OpenAI, etc.)
    eventSource.on(event_types.CHAT_COMPLETION_PROMPT_READY, onChatCompletionPromptReady);

    console.log('[RPG Companion] History injection listeners initialized');
}

