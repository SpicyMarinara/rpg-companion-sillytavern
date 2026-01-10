/**
 * Prompt Injector Module
 * Handles injection of RPG tracker prompts into the generation context
 */

import { getContext } from '../../../../../../extensions.js';
import { setExtensionPrompt, extension_prompt_types, extension_prompt_roles, eventSource, event_types } from '../../../../../../../script.js';
import {
    extensionSettings,
    committedTrackerData,
    lastGeneratedData,
    isGenerating,
    lastActionWasSwipe,
    setLastActionWasSwipe,
    setIsGenerating
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
    DEFAULT_SPOTIFY_PROMPT,
    SPOTIFY_FORMAT_INSTRUCTION
} from './promptBuilder.js';
import { restoreCheckpointOnLoad } from '../features/chapterCheckpoint.js';

// Track suppression state for event handler
let currentSuppressionState = false;

// Type imports
/** @typedef {import('../../types/inventory.js').InventoryV2} InventoryV2 */

// Track last chat length we committed at to prevent duplicate commits from streaming
let lastCommittedChatLength = -1;

// Store context map for prompt injection (used by event handlers)
let pendingContextMap = new Map();

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
    // We should NOT add historical context to it
    let lastAssistantIndex = -1;
    for (let i = chat.length - 1; i >= 0; i--) {
        if (!chat[i].is_user && !chat[i].is_system) {
            lastAssistantIndex = i;
            break;
        }
    }

    // Iterate through messages to find those with tracker data
    // Start from before the last assistant message
    let processedCount = 0;
    const startIndex = lastAssistantIndex > 0 ? lastAssistantIndex - 1 : chat.length - 2;

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
        const preamble = historyPersistence.contextPreamble || '[Context at this point:]';
        const wrappedContext = `\n${preamble}\n${formattedContext}`;

        // Determine which message index to store based on injection position
        let targetIndex = i; // Default: the assistant message itself

        if (position === 'user_message_end') {
            // Find the next user message after this assistant message
            for (let j = i + 1; j < chat.length; j++) {
                if (chat[j].is_user && !chat[j].is_system) {
                    targetIndex = j;
                    break;
                }
            }
            // If no user message found after, skip this one
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
        return;
    }

    // Build and store the context map for use by prompt handlers
    pendingContextMap = buildHistoricalContextMap();
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

    // Process each message that needs context injection
    for (const [msgIdx, ctxContent] of pendingContextMap) {
        const message = chat[msgIdx];
        if (!message || typeof message.mes !== 'string') {
            continue;
        }

        // Find the message content in the prompt
        // Use a portion of the message to find it (last 100 chars should be unique enough)
        const searchContent = message.mes.length > 100 
            ? message.mes.slice(-100) 
            : message.mes;
        
        const searchIndex = modifiedPrompt.lastIndexOf(searchContent);
        if (searchIndex === -1) {
            // Message not found in prompt (might be truncated)
            continue;
        }

        // Find the end of this message content in the prompt
        const insertPosition = searchIndex + searchContent.length;
        
        // Insert the context after the message
        modifiedPrompt = modifiedPrompt.slice(0, insertPosition) + ctxContent + modifiedPrompt.slice(insertPosition);
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

        // Find this message in the chat completion array by matching content
        // Use a portion of the message to find it
        const searchContent = originalMessage.mes.length > 100 
            ? originalMessage.mes.slice(-100) 
            : originalMessage.mes;

        for (const promptMsg of chatMessages) {
            if (promptMsg.content && typeof promptMsg.content === 'string' && 
                promptMsg.content.includes(searchContent)) {
                // Found the message - append context
                promptMsg.content = promptMsg.content + ctxContent;
                injectedCount++;
                break;
            }
        }
    }

    if (injectedCount > 0) {
        console.log(`[RPG Companion] Injected historical context into ${injectedCount} messages in chat prompt`);
    }

    return chatMessages;
}

/**
 * Event handler for GENERATE_AFTER_COMBINE_PROMPTS (text completion).
 * Injects historical context into the prompt string.
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

    eventData.prompt = injectContextIntoTextPrompt(eventData.prompt);
    
    // Clear the pending context after injection
    pendingContextMap = new Map();
}

/**
 * Event handler for CHAT_COMPLETION_PROMPT_READY.
 * Injects historical context into the chat message array.
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

    eventData.chat = injectContextIntoChatPrompt(eventData.chat);
    
    // Clear the pending context after injection
    pendingContextMap = new Map();
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
    if (data?.quietImage) {
        // console.log('[RPG Companion] Detected image generation (quietImage=true), skipping tracker injection');
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

    const currentChatLength = chat ? chat.length : 0;
    const lastMessage = chat && chat.length > 0 ? chat[chat.length - 1] : null;

    // For TOGETHER mode: Commit when user sends message (before first generation)
    if (extensionSettings.generationMode === 'together') {
        // By the time onGenerationStarted fires, ST has already added the placeholder AI message
        // So we check the second-to-last message to see if user just sent a message
        const secondToLastMessage = chat && chat.length > 1 ? chat[chat.length - 2] : null;
        const isUserMessage = secondToLastMessage && secondToLastMessage.is_user;

        // Commit if:
        // 1. Second-to-last message is from USER (user just sent message)
        // 2. Not a swipe (lastActionWasSwipe = false)
        // 3. Haven't already committed for this chat length (prevent streaming duplicates)
        const shouldCommit = isUserMessage && !lastActionWasSwipe && currentChatLength !== lastCommittedChatLength;

        if (shouldCommit) {
            // console.log('[RPG Companion] 📝 TOGETHER MODE COMMIT: User sent message - committing data from BEFORE user message');
            // console.log('[RPG Companion]   Chat length:', currentChatLength, 'Last committed:', lastCommittedChatLength);
            // console.log('[RPG Companion]   BEFORE: committedTrackerData =', {
            //     userStats: committedTrackerData.userStats ? `${committedTrackerData.userStats.substring(0, 50)}...` : 'null',
            //     infoBox: committedTrackerData.infoBox ? 'exists' : 'null',
            //     characterThoughts: committedTrackerData.characterThoughts ? `${committedTrackerData.characterThoughts.substring(0, 100)}...` : 'null'
            // // });
            // console.log('[RPG Companion]   BEFORE: lastGeneratedData =', {
            //     userStats: lastGeneratedData.userStats ? `${lastGeneratedData.userStats.substring(0, 50)}...` : 'null',
            //     infoBox: lastGeneratedData.infoBox ? 'exists' : 'null',
            //     characterThoughts: lastGeneratedData.characterThoughts ? `${lastGeneratedData.characterThoughts.substring(0, 100)}...` : 'null'
            // });

            // Commit displayed data (from before user sent message)
            committedTrackerData.userStats = lastGeneratedData.userStats;
            committedTrackerData.infoBox = lastGeneratedData.infoBox;
            committedTrackerData.characterThoughts = lastGeneratedData.characterThoughts;

            // Track chat length to prevent duplicate commits
            lastCommittedChatLength = currentChatLength;

            // console.log('[RPG Companion]   AFTER: committedTrackerData =', {
            //     userStats: committedTrackerData.userStats ? `${committedTrackerData.userStats.substring(0, 50)}...` : 'null',
            //     infoBox: committedTrackerData.infoBox ? 'exists' : 'null',
            //     characterThoughts: committedTrackerData.characterThoughts ? `${committedTrackerData.characterThoughts.substring(0, 100)}...` : 'null'
            // });
        } else if (lastActionWasSwipe) {
            // console.log('[RPG Companion] ⏭️ Skipping commit: swipe (using previous committed data)');
        } else if (!isUserMessage) {
            // console.log('[RPG Companion] ⏭️ Skipping commit: second-to-last message is not user message (likely swipe or continuation)');
        }

        // console.log('[RPG Companion] 📦 TOGETHER MODE: Injecting committed tracker data into prompt');
        // console.log('[RPG Companion]   committedTrackerData =', {
        //     userStats: committedTrackerData.userStats ? `${committedTrackerData.userStats.substring(0, 50)}...` : 'null',
        //     infoBox: committedTrackerData.infoBox ? 'exists' : 'null',
        //     characterThoughts: committedTrackerData.characterThoughts ? `${committedTrackerData.characterThoughts.substring(0, 100)}...` : 'null'
        // });
    }

    // For SEPARATE and EXTERNAL modes: Check if we need to commit extension data
    // BUT: Only do this for the MAIN generation, not the tracker update generation
    // If isGenerating is true, this is the tracker update generation (second call), so skip flag logic
    // console.log('[RPG Companion DEBUG] Before generating:', lastGeneratedData.characterThoughts, ' , committed - ', committedTrackerData.characterThoughts);
    if ((extensionSettings.generationMode === 'separate' || extensionSettings.generationMode === 'external') && !isGenerating) {
        if (!lastActionWasSwipe) {
            // User sent a new message - commit lastGeneratedData before generation
            // console.log('[RPG Companion] 📝 COMMIT: New message - committing lastGeneratedData');
            // console.log('[RPG Companion]   BEFORE commit - committedTrackerData:', {
            //      userStats: committedTrackerData.userStats ? 'exists' : 'null',
            //      infoBox: committedTrackerData.infoBox ? 'exists' : 'null',
            //      characterThoughts: committedTrackerData.characterThoughts ? 'exists' : 'null'
            // // });
            // console.log('[RPG Companion]   BEFORE commit - lastGeneratedData:', {
            //      userStats: lastGeneratedData.userStats ? 'exists' : 'null',
            //      infoBox: lastGeneratedData.infoBox ? 'exists' : 'null',
            //      characterThoughts: lastGeneratedData.characterThoughts ? 'exists' : 'null'
            // });
            committedTrackerData.userStats = lastGeneratedData.userStats;
            committedTrackerData.infoBox = lastGeneratedData.infoBox;
            committedTrackerData.characterThoughts = lastGeneratedData.characterThoughts;
            // console.log('[RPG Companion]   AFTER commit - committedTrackerData:', {
            //      userStats: committedTrackerData.userStats ? 'exists' : 'null',
            //      infoBox: committedTrackerData.infoBox ? 'exists' : 'null',
            //      characterThoughts: committedTrackerData.characterThoughts ? 'exists' : 'null'
            // });

            // Reset flag after committing (ready for next cycle)

        } else {
            // console.log('[RPG Companion] 🔄 SWIPE: Using existing committedTrackerData (no commit)');
            // console.log('[RPG Companion]   committedTrackerData:', {
            //      userStats: committedTrackerData.userStats ? 'exists' : 'null',
            //      infoBox: committedTrackerData.infoBox ? 'exists' : 'null',
            //      characterThoughts: committedTrackerData.characterThoughts ? 'exists' : 'null'
            // });
            // Reset flag after using it (swipe generation complete, ready for next action)
        }
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
            const htmlPrompt = `\n${htmlPromptText}`;

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
            const dialogueColoringPrompt = `\n${dialogueColoringPromptText}`;

            setExtensionPrompt('rpg-companion-dialogue-coloring', dialogueColoringPrompt, extension_prompt_types.IN_CHAT, 0, false);
            // console.log('[RPG Companion] Injected Dialogue Coloring prompt at depth 0 for together mode');
        } else {
            // Clear Dialogue Coloring prompt if disabled
            setExtensionPrompt('rpg-companion-dialogue-coloring', '', extension_prompt_types.IN_CHAT, 0, false);
        }

        // Inject Spotify prompt separately at depth 0 if enabled
        if (extensionSettings.enableSpotifyMusic && !shouldSuppress) {
            // Use custom Spotify prompt if set, otherwise use default
            const spotifyPromptText = extensionSettings.customSpotifyPrompt || DEFAULT_SPOTIFY_PROMPT;
            const spotifyPrompt = `\n${spotifyPromptText} ${SPOTIFY_FORMAT_INSTRUCTION}`;

            setExtensionPrompt('rpg-companion-spotify', spotifyPrompt, extension_prompt_types.IN_CHAT, 0, false);
            // console.log('[RPG Companion] Injected Spotify prompt at depth 0 for together mode');
        } else {
            // Clear Spotify prompt if disabled
            setExtensionPrompt('rpg-companion-spotify', '', extension_prompt_types.IN_CHAT, 0, false);
        }
    } else if (extensionSettings.generationMode === 'separate' || extensionSettings.generationMode === 'external') {
        // In SEPARATE and EXTERNAL modes, inject the contextual summary for main roleplay generation
        const contextSummary = generateContextualSummary();

        if (contextSummary) {
            const wrappedContext = `\nHere is context information about the current scene, and what follows is the last message in the chat history:
<context>
${contextSummary}

Ensure these details naturally reflect and influence the narrative. Character behavior, dialogue, and story events should acknowledge these conditions when relevant, such as fatigue affecting performance, low hygiene influencing social interactions, environmental factors shaping the scene, or a character's emotional state coloring their responses.
</context>\n\n`;

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
            const htmlPrompt = `\n${htmlPromptText}`;

            setExtensionPrompt('rpg-companion-html', htmlPrompt, extension_prompt_types.IN_CHAT, 0, false);
            // console.log('[RPG Companion] Injected HTML prompt at depth 0 for separate/external mode');
        } else {
            // Clear HTML prompt if disabled
            setExtensionPrompt('rpg-companion-html', '', extension_prompt_types.IN_CHAT, 0, false);
        }

        // Inject Spotify prompt separately at depth 0 if enabled
        if (extensionSettings.enableSpotifyMusic && !shouldSuppress) {
            // Use custom Spotify prompt if set, otherwise use default
            const spotifyPromptText = extensionSettings.customSpotifyPrompt || DEFAULT_SPOTIFY_PROMPT;
            const spotifyPrompt = `\n${spotifyPromptText} ${SPOTIFY_FORMAT_INSTRUCTION}`;

            setExtensionPrompt('rpg-companion-spotify', spotifyPrompt, extension_prompt_types.IN_CHAT, 0, false);
            // console.log('[RPG Companion] Injected Spotify prompt at depth 0 for separate/external mode');
        } else {
            // Clear Spotify prompt if disabled
            setExtensionPrompt('rpg-companion-spotify', '', extension_prompt_types.IN_CHAT, 0, false);
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
        setExtensionPrompt('rpg-companion-spotify', '', extension_prompt_types.IN_CHAT, 0, false);
    }

    // Set suppression state for the historical context injection
    currentSuppressionState = shouldSuppress;

    // Prepare historical context for injection into prompts
    // This builds the context map but does NOT modify original chat messages
    prepareHistoricalContextInjection();

    // Register one-time listeners to inject context into the actual prompt
    // These modify only the prompt sent to the API, not the stored chat data
    if (pendingContextMap.size > 0) {
        eventSource.once(event_types.GENERATE_AFTER_COMBINE_PROMPTS, onGenerateAfterCombinePrompts);
        eventSource.once(event_types.CHAT_COMPLETION_PROMPT_READY, onChatCompletionPromptReady);
    }
}

/**
 * Called when generation ends to clean up any pending context.
 * This should be called from the GENERATION_ENDED event handler.
 */
export function onGenerationEndedCleanup() {
    // Clear any pending context that wasn't used (e.g., if generation was cancelled)
    pendingContextMap = new Map();
}

