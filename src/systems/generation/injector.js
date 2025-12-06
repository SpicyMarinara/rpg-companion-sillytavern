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
    lastActionWasSwipe
} from '../../core/state.js';
import { evaluateSuppression } from './suppression.js';
import {
    generateJSONTrackerInstructions,
    generateContextualSummary,
    DEFAULT_HTML_PROMPT
} from './promptBuilder.js';

/**
 * Gets tracker instructions (always uses JSON format)
 * @param {boolean} includeHtmlPrompt 
 * @param {boolean} includeContinuation 
 * @returns {string}
 */
function getTrackerInstructions(includeHtmlPrompt, includeContinuation) {
    return generateJSONTrackerInstructions(includeHtmlPrompt, includeContinuation);
}

/**
 * Event handler for generation start.
 * Manages tracker data commitment and prompt injection based on generation mode.
 *
 * @param {string} type - Event type
 * @param {Object} data - Event data
 */
export function onGenerationStarted(type, data) {
    if (data?.quietImage) {
        return;
    }

    if (!extensionSettings.enabled) {
        return;
    }

    const context = getContext();
    const chat = context.chat;
    const suppression = evaluateSuppression(extensionSettings, context, data);
    const { shouldSuppress, skipMode, isGuidedGeneration, isImpersonationGeneration, hasQuietPrompt } = suppression;

    if (shouldSuppress) {
        console.debug(`[RPG Companion] Suppression active (mode=${skipMode}). isGuided=${isGuidedGeneration}, isImpersonation=${isImpersonationGeneration}, hasQuietPrompt=${hasQuietPrompt} - skipping RPG tracker injections for this generation.`);
        setExtensionPrompt('rpg-companion-inject', '', extension_prompt_types.IN_CHAT, 0, false);
        setExtensionPrompt('rpg-companion-example', '', extension_prompt_types.IN_CHAT, 0, false);
        setExtensionPrompt('rpg-companion-html', '', extension_prompt_types.IN_CHAT, 0, false);
        setExtensionPrompt('rpg-companion-context', '', extension_prompt_types.IN_CHAT, 1, false);
    }

    const isTogether = extensionSettings.generationMode === 'together';
    const isSeparate = extensionSettings.generationMode === 'separate';

    if (isSeparate && !isGenerating) {
        if (!lastActionWasSwipe) {
            Object.assign(committedTrackerData, lastGeneratedData);
        }
    }

    if (isTogether) {
        if (!lastActionWasSwipe) {
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
                            Object.assign(committedTrackerData, swipeData);
                            foundAssistantMessage = true;
                            console.log('[RPG Companion] ✓ Committed tracker data from message swipe', swipeId);
                        }
                    }
                    break;
                }
            }

            // Fallback: if no stored data found, use lastGeneratedData (for first message)
            if (!foundAssistantMessage) {
                Object.assign(committedTrackerData, lastGeneratedData);
                console.log('[RPG Companion] ⚠ No stored message data found, using lastGeneratedData as fallback');
            }
        } else {
            console.log('[RPG Companion] 🔄 TOGETHER MODE SWIPE: Using existing committedTrackerData (no commit)');
        }
    }

    if (isTogether) {
        const example = '';
        const instructions = getTrackerInstructions(false, true);

        setExtensionPrompt('rpg-companion-context', '', extension_prompt_types.IN_CHAT, 1, false);

        let lastAssistantDepth = -1;
        if (chat && chat.length > 0) {
            for (let depth = 1; depth < chat.length; depth++) {
                const index = chat.length - 1 - depth;
                const message = chat[index];
                if (!message.is_user && !message.is_system) {
                    lastAssistantDepth = depth;
                    break;
                }
            }
        }

        if (!shouldSuppress && example && lastAssistantDepth > 0) {
            setExtensionPrompt('rpg-companion-example', example, extension_prompt_types.IN_CHAT, lastAssistantDepth, false, extension_prompt_roles.ASSISTANT);
        }

        if (!shouldSuppress) {
            setExtensionPrompt('rpg-companion-inject', instructions, extension_prompt_types.IN_CHAT, 0, false, extension_prompt_roles.USER);
        }

        if (extensionSettings.enableHtmlPrompt && !shouldSuppress) {
            const htmlPromptText = extensionSettings.customHtmlPrompt || DEFAULT_HTML_PROMPT;
            const htmlPrompt = `\n${htmlPromptText}`;
            setExtensionPrompt('rpg-companion-html', htmlPrompt, extension_prompt_types.IN_CHAT, 0, false);
        } else {
            setExtensionPrompt('rpg-companion-html', '', extension_prompt_types.IN_CHAT, 0, false);
        }
    } else if (extensionSettings.generationMode === 'separate') {
        const currentStateJSON = generateContextualSummary();

        if (currentStateJSON) {
            const wrappedContext = `\nHere is {{user}}'s current state in JSON format. This is merely informative, it's not your job to update it:
<context>
\`\`\`json
${currentStateJSON}
\`\`\`
</context>\n\n`;

            if (!shouldSuppress) {
                setExtensionPrompt('rpg-companion-context', wrappedContext, extension_prompt_types.IN_CHAT, 1, false);
            }
        } else {
            setExtensionPrompt('rpg-companion-context', '', extension_prompt_types.IN_CHAT, 1, false);
        }

        if (extensionSettings.enableHtmlPrompt && !shouldSuppress) {
            const htmlPromptText = extensionSettings.customHtmlPrompt || DEFAULT_HTML_PROMPT;
            const htmlPrompt = `\n${htmlPromptText}`;
            setExtensionPrompt('rpg-companion-html', htmlPrompt, extension_prompt_types.IN_CHAT, 0, false);
        } else {
            setExtensionPrompt('rpg-companion-html', '', extension_prompt_types.IN_CHAT, 0, false);
        }

        // Clear together mode injections
        setExtensionPrompt('rpg-companion-inject', '', extension_prompt_types.IN_CHAT, 0, false);
        setExtensionPrompt('rpg-companion-example', '', extension_prompt_types.IN_CHAT, 0, false);
    } else {
        // Clear all injections
        setExtensionPrompt('rpg-companion-inject', '', extension_prompt_types.IN_CHAT, 0, false);
        setExtensionPrompt('rpg-companion-example', '', extension_prompt_types.IN_CHAT, 0, false);
        setExtensionPrompt('rpg-companion-context', '', extension_prompt_types.IN_CHAT, 1, false);
    }
}
