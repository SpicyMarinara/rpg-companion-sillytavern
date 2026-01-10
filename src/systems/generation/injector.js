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
    DEFAULT_DECEPTION_PROMPT,
    DEFAULT_CYOA_PROMPT,
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

// Store original message content for restoration after generation
// Map of message index -> original mes content
let originalMessageContent = new Map();

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
        const preamble = historyPersistence.contextPreamble || 'Context for that moment:';
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
 * Injects historical context into chat messages by modifying them in-place.
 * Stores original content for restoration after generation.
 * This approach works for ALL API types (text completion and chat completion).
 */
function injectHistoricalContextIntoChat() {
    const historyPersistence = extensionSettings.historyPersistence;
    if (!historyPersistence || !historyPersistence.enabled) {
        // console.log('[RPG Companion] History persistence not enabled, skipping injection');
        return;
    }

    if (currentSuppressionState || !extensionSettings.enabled) {
        // console.log('[RPG Companion] Skipping history injection: suppressed or disabled');
        return;
    }

    const context = getContext();
    const chat = context.chat;
    if (!chat || chat.length < 2) {
        // console.log('[RPG Companion] Chat too short, skipping history injection');
        return;
    }

    // Build the context map
    const contextMap = buildHistoricalContextMap();
    if (contextMap.size === 0) {
        // console.log('[RPG Companion] No historical context to inject');
        return;
    }

    // console.log(`[RPG Companion] Injecting historical context into ${contextMap.size} messages`);

    // Clear any previous stored content
    originalMessageContent.clear();

    let injectedCount = 0;
    for (const [msgIdx, ctxContent] of contextMap) {
        const message = chat[msgIdx];
        if (!message || typeof message.mes !== 'string') {
            continue;
        }

        // Store original content for restoration
        originalMessageContent.set(msgIdx, message.mes);

        // Modify the message in-place
        message.mes = message.mes + ctxContent;
        injectedCount++;
        // console.log(`[RPG Companion] Injected context into message ${msgIdx}`);
    }

    // console.log(`[RPG Companion] Successfully injected historical context into ${injectedCount} messages`);
}

/**
 * Restores original message content after generation completes.
 * This ensures the injected context doesn't persist in the actual chat data.
 */
function restoreOriginalMessageContent() {
    if (originalMessageContent.size === 0) {
        return;
    }

    const context = getContext();
    const chat = context.chat;

    // console.log(`[RPG Companion] Restoring ${originalMessageContent.size} messages to original content`);

    for (const [msgIdx, originalContent] of originalMessageContent) {
        if (chat[msgIdx]) {
            chat[msgIdx].mes = originalContent;
        }
    }

    originalMessageContent.clear();
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
        setExtensionPrompt('rpg-companion-zzz-cyoa', '', extension_prompt_types.IN_CHAT, 0, false);
        setExtensionPrompt('rpg-companion-spotify', '', extension_prompt_types.IN_CHAT, 0, false);
    }

    // Set suppression state for the historical context injection
    currentSuppressionState = shouldSuppress;

    // Inject historical context directly into chat messages
    // This temporarily modifies messages and will be restored after generation
    injectHistoricalContextIntoChat();

    // Register a one-time listener to restore messages after prompt is built
    // Using .once() so it auto-removes after firing
    eventSource.once(event_types.GENERATE_AFTER_COMBINE_PROMPTS, () => {
        restoreOriginalMessageContent();
    });
}

/**
 * Called when generation ends to restore original message content.
 * This should be called from the GENERATION_ENDED event handler.
 */
export function onGenerationEndedCleanup() {
    restoreOriginalMessageContent();
}

