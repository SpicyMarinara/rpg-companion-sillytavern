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
    setLastActionWasSwipe
} from '../../core/state.js';
import { evaluateSuppression } from './suppression.js';
import { parseUserStats } from './parser.js';
import {
    generateTrackerExample,
    generateTrackerInstructions,
    generateContextualSummary,
    DEFAULT_HTML_PROMPT,
    DEFAULT_SPOTIFY_PROMPT,
    SPOTIFY_FORMAT_INSTRUCTION
} from './promptBuilder.js';
import { restoreCheckpointOnLoad } from '../features/chapterCheckpoint.js';

/**
 * Event handler for generation start.
 * Manages tracker data commitment and prompt injection based on generation mode.
 *
 * @param {string} type - Event type
 * @param {Object} data - Event data
 */
export async function onGenerationStarted(type, data) {
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

    const lastMessage = chat && chat.length > 0 ? chat[chat.length - 1] : null;

    // For SEPARATE/EXTERNAL mode: Check if we need to commit extension data
    // BUT: Only do this for the MAIN generation, not the tracker update generation
    // If isGenerating is true, this is the tracker update generation (second call), so skip flag logic
    // console.log('[RPG Companion DEBUG] Before generating:', lastGeneratedData.characterThoughts, ' , committed - ', committedTrackerData.characterThoughts);
    if ((extensionSettings.generationMode === 'separate' || extensionSettings.generationMode === 'external') && !isGenerating) {
        if (!lastActionWasSwipe) {
            // User sent a new message - commit lastGeneratedData before generation
            // console.log('[RPG Companion] 📝 COMMIT: New message - committing lastGeneratedData');
            // console.log('[RPG Companion]   BEFORE commit - committedTrackerData:', {
            //     userStats: committedTrackerData.userStats ? 'exists' : 'null',
            //     infoBox: committedTrackerData.infoBox ? 'exists' : 'null',
            //     characterThoughts: committedTrackerData.characterThoughts ? 'exists' : 'null'
            // });
            // console.log('[RPG Companion]   BEFORE commit - lastGeneratedData:', {
            //     userStats: lastGeneratedData.userStats ? 'exists' : 'null',
            //     infoBox: lastGeneratedData.infoBox ? 'exists' : 'null',
            //     characterThoughts: lastGeneratedData.characterThoughts ? 'exists' : 'null'
            // });
            committedTrackerData.userStats = lastGeneratedData.userStats;
            committedTrackerData.infoBox = lastGeneratedData.infoBox;
            committedTrackerData.characterThoughts = lastGeneratedData.characterThoughts;
            // console.log('[RPG Companion]   AFTER commit - committedTrackerData:', {
            //     userStats: committedTrackerData.userStats ? 'exists' : 'null',
            //     infoBox: committedTrackerData.infoBox ? 'exists' : 'null',
            //     characterThoughts: committedTrackerData.characterThoughts ? 'exists' : 'null'
            // });

            // Reset flag after committing (ready for next cycle)

        } else {
            // console.log('[RPG Companion] 🔄 SWIPE: Using existing committedTrackerData (no commit)');
            // console.log('[RPG Companion]   committedTrackerData:', {
            //     userStats: committedTrackerData.userStats ? 'exists' : 'null',
            //     infoBox: committedTrackerData.infoBox ? 'exists' : 'null',
            //     characterThoughts: committedTrackerData.characterThoughts ? 'exists' : 'null'
            // });
            // Reset flag after using it (swipe generation complete, ready for next action)
        }
    }

    // For TOGETHER mode: Check if we need to commit extension data
    // Only commit when user sends a new message (not on swipes)
    if (extensionSettings.generationMode === 'together') {
        if (!lastActionWasSwipe) {
            // User sent a new message - commit data from the last assistant message they replied to
            // This ensures swipes use consistent data from before the first swipe
            console.log('[RPG Companion] 📝 TOGETHER MODE COMMIT: New message - committing from last assistant message');

            // Find the last assistant message (before the user's new message)
            const chat = getContext().chat;
            let foundAssistantMessage = false;

            for (let i = chat.length - 1; i >= 0; i--) {
                const message = chat[i];
                if (!message.is_user) {
                    // Found last assistant message - commit its stored tracker data
                    if (message.extra && message.extra.rpg_companion_swipes) {
                        const swipeId = message.swipe_id || 0;
                        const swipeData = message.extra.rpg_companion_swipes[swipeId];

                        if (swipeData) {
                            committedTrackerData.userStats = swipeData.userStats || null;
                            committedTrackerData.infoBox = swipeData.infoBox || null;
                            committedTrackerData.characterThoughts = swipeData.characterThoughts || null;
                            foundAssistantMessage = true;
                            console.log('[RPG Companion] ✓ Committed tracker data from message swipe', swipeId);
                        }
                    }
                    break;
                }
            }

            // Fallback: if no stored data found, use lastGeneratedData (for first message)
            if (!foundAssistantMessage) {
                committedTrackerData.userStats = lastGeneratedData.userStats;
                committedTrackerData.infoBox = lastGeneratedData.infoBox;
                committedTrackerData.characterThoughts = lastGeneratedData.characterThoughts;
                console.log('[RPG Companion] ⚠ No stored message data found, using lastGeneratedData as fallback');
            }
        } else {
            console.log('[RPG Companion] 🔄 TOGETHER MODE SWIPE: Using existing committedTrackerData (no commit)');
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
        const example = generateTrackerExample();
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
        // In SEPARATE/EXTERNAL mode, inject the contextual summary for main roleplay generation
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
