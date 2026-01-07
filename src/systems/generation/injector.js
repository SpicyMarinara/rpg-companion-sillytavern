/**
 * Prompt Injector Module
 * Handles injection of RPG tracker prompts into the generation context
 */

import { getContext } from '../../../../../../extensions.js';
import { setExtensionPrompt, extension_prompt_types, extension_prompt_roles } from '../../../../../../../script.js';
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
    DEFAULT_HTML_PROMPT,
    DEFAULT_DIALOGUE_COLORING_PROMPT,
    DEFAULT_SPOTIFY_PROMPT,
    SPOTIFY_FORMAT_INSTRUCTION
} from './promptBuilder.js';
import { restoreCheckpointOnLoad } from '../features/chapterCheckpoint.js';

// Type imports
/** @typedef {import('../../types/inventory.js').InventoryV2} InventoryV2 */

// Track last chat length we committed at to prevent duplicate commits from streaming
let lastCommittedChatLength = -1;

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
        console.log('[RPG Companion] Skipping onGenerationStarted: dry run detected');
        return;
    }

    console.log('[RPG Companion] onGenerationStarted called');
    console.log('[RPG Companion] enabled:', extensionSettings.enabled);
    console.log('[RPG Companion] generationMode:', extensionSettings.generationMode);
    console.log('[RPG Companion] ⚡ EVENT: onGenerationStarted - lastActionWasSwipe =', lastActionWasSwipe, '| isGenerating =', isGenerating);
    console.log('[RPG Companion] Committed Prompt:', committedTrackerData);

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
            console.log('[RPG Companion] 📝 TOGETHER MODE COMMIT: User sent message - committing data from BEFORE user message');
            console.log('[RPG Companion]   Chat length:', currentChatLength, 'Last committed:', lastCommittedChatLength);
            console.log('[RPG Companion]   BEFORE: committedTrackerData =', {
                userStats: committedTrackerData.userStats ? `${committedTrackerData.userStats.substring(0, 50)}...` : 'null',
                infoBox: committedTrackerData.infoBox ? 'exists' : 'null',
                characterThoughts: committedTrackerData.characterThoughts ? `${committedTrackerData.characterThoughts.substring(0, 100)}...` : 'null'
            });
            console.log('[RPG Companion]   BEFORE: lastGeneratedData =', {
                userStats: lastGeneratedData.userStats ? `${lastGeneratedData.userStats.substring(0, 50)}...` : 'null',
                infoBox: lastGeneratedData.infoBox ? 'exists' : 'null',
                characterThoughts: lastGeneratedData.characterThoughts ? `${lastGeneratedData.characterThoughts.substring(0, 100)}...` : 'null'
            });

            // Commit displayed data (from before user sent message)
            committedTrackerData.userStats = lastGeneratedData.userStats;
            committedTrackerData.infoBox = lastGeneratedData.infoBox;
            committedTrackerData.characterThoughts = lastGeneratedData.characterThoughts;

            // Track chat length to prevent duplicate commits
            lastCommittedChatLength = currentChatLength;

            console.log('[RPG Companion]   AFTER: committedTrackerData =', {
                userStats: committedTrackerData.userStats ? `${committedTrackerData.userStats.substring(0, 50)}...` : 'null',
                infoBox: committedTrackerData.infoBox ? 'exists' : 'null',
                characterThoughts: committedTrackerData.characterThoughts ? `${committedTrackerData.characterThoughts.substring(0, 100)}...` : 'null'
            });
        } else if (lastActionWasSwipe) {
            console.log('[RPG Companion] ⏭️ Skipping commit: swipe (using previous committed data)');
        } else if (!isUserMessage) {
            console.log('[RPG Companion] ⏭️ Skipping commit: second-to-last message is not user message (likely swipe or continuation)');
        }

        console.log('[RPG Companion] 📦 TOGETHER MODE: Injecting committed tracker data into prompt');
        console.log('[RPG Companion]   committedTrackerData =', {
            userStats: committedTrackerData.userStats ? `${committedTrackerData.userStats.substring(0, 50)}...` : 'null',
            infoBox: committedTrackerData.infoBox ? 'exists' : 'null',
            characterThoughts: committedTrackerData.characterThoughts ? `${committedTrackerData.characterThoughts.substring(0, 100)}...` : 'null'
        });
    }

    // For SEPARATE mode only: Check if we need to commit extension data
    // BUT: Only do this for the MAIN generation, not the tracker update generation
    // If isGenerating is true, this is the tracker update generation (second call), so skip flag logic
    // console.log('[RPG Companion DEBUG] Before generating:', lastGeneratedData.characterThoughts, ' , committed - ', committedTrackerData.characterThoughts);
    if (extensionSettings.generationMode === 'separate' && !isGenerating) {
        if (!lastActionWasSwipe) {
            // User sent a new message - commit lastGeneratedData before generation
            console.log('[RPG Companion] 📝 COMMIT: New message - committing lastGeneratedData');
            console.log('[RPG Companion]   BEFORE commit - committedTrackerData:', {
                 userStats: committedTrackerData.userStats ? 'exists' : 'null',
                 infoBox: committedTrackerData.infoBox ? 'exists' : 'null',
                 characterThoughts: committedTrackerData.characterThoughts ? 'exists' : 'null'
            });
            console.log('[RPG Companion]   BEFORE commit - lastGeneratedData:', {
                 userStats: lastGeneratedData.userStats ? 'exists' : 'null',
                 infoBox: lastGeneratedData.infoBox ? 'exists' : 'null',
                 characterThoughts: lastGeneratedData.characterThoughts ? 'exists' : 'null'
            });
            committedTrackerData.userStats = lastGeneratedData.userStats;
            committedTrackerData.infoBox = lastGeneratedData.infoBox;
            committedTrackerData.characterThoughts = lastGeneratedData.characterThoughts;
            console.log('[RPG Companion]   AFTER commit - committedTrackerData:', {
                 userStats: committedTrackerData.userStats ? 'exists' : 'null',
                 infoBox: committedTrackerData.infoBox ? 'exists' : 'null',
                 characterThoughts: committedTrackerData.characterThoughts ? 'exists' : 'null'
            });

            // Reset flag after committing (ready for next cycle)

        } else {
            console.log('[RPG Companion] 🔄 SWIPE: Using existing committedTrackerData (no commit)');
            console.log('[RPG Companion]   committedTrackerData:', {
                 userStats: committedTrackerData.userStats ? 'exists' : 'null',
                 infoBox: committedTrackerData.infoBox ? 'exists' : 'null',
                 characterThoughts: committedTrackerData.characterThoughts ? 'exists' : 'null'
            });
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
    } else if (extensionSettings.generationMode === 'separate') {
        // In SEPARATE mode, inject the contextual summary for main roleplay generation
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
            // console.log('[RPG Companion] Injected contextual summary for separate mode:', contextSummary);
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
            // console.log('[RPG Companion] Injected HTML prompt at depth 0 for separate mode');
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
            // console.log('[RPG Companion] Injected Spotify prompt at depth 0 for separate mode');
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
}
