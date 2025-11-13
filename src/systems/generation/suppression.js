/**
 * Suppression helper for guided generation injection behavior.
 *
 * This module exports a pure function `evaluateSuppression` that computes
 * whether RPG Companion should suppress tracker and HTML injections for a
 * given generation request, based on runtime settings, extended context, and
 * generation data (quiet prompt flags, etc.).
 */

/**
 * Determine if suppression should be applied for this generation.
 *
 * @param {any} extensionSettings - extension settings object (may contain skipInjectionsForGuided)
 * @param {any} context - SillyTavern context object (used to find chatMetadata.script_injects.instruct)
 * @param {any} data - Generation data (contains quiet_prompt/quietPrompt flags)
 * @returns {Object} - An object describing the suppression decision.
 */
export function evaluateSuppression(extensionSettings, context, data) {
    // Detect presence of any injected `instruct` script
    const instructObj = context?.chatMetadata?.script_injects?.instruct;
    const isGuidedGeneration = !!instructObj;
    const quietPromptRaw = data?.quiet_prompt || data?.quietPrompt || '';
    const hasQuietPrompt = !!quietPromptRaw;

    // Normalize the injected instruction body (it may be an object with a 'value' field or a raw string)
    let instructContent = '';
    if (instructObj) {
        if (typeof instructObj === 'object') {
            instructContent = String(instructObj.value || instructObj || '');
        } else {
            instructContent = String(instructObj);
        }
    }

    const IMPERSONATION_PATTERNS = [
        { id: 'first-perspective', re: /write in first person perspective from/i },
        { id: 'second-perspective', re: /write in second person perspective from/i },
        { id: 'third-perspective', re: /write in third person perspective from/i },
        { id: 'you-yours', re: /using you\/yours for/i },
        { id: 'third-person-pronouns', re: /third-person pronouns for/i },
        { id: 'impersonate-word', re: /\bimpersonat(e|ion)?\b/i },
        { id: 'assume-role', re: /assume the role of/i },
        { id: 'play-role', re: /play the role of/i },
        { id: 'impersonate-command', re: /\/impersonate await=true/i },
        { id: 'generic-first', re: /\bfirst person\b/i },
        { id: 'generic-second', re: /\bsecond person\b/i },
        { id: 'generic-third', re: /\bthird person\b/i }
    ];

    // Include quietPrompt raw text in detection; guided impersonation flows may pass it directly here
    const combinedTextForDetection = [instructContent, quietPromptRaw].filter(Boolean).join('\n');

    let matchedPattern = '';
    let isImpersonationGeneration = false;
    if (combinedTextForDetection.length) {
        for (const pat of IMPERSONATION_PATTERNS) {
            if (pat.re.test(combinedTextForDetection)) {
                matchedPattern = pat.id;
                isImpersonationGeneration = true;
                break;
            }
        }
    }

    const skipMode = (extensionSettings && extensionSettings.skipInjectionsForGuided) || 'none';

    // Compute suppression according to mode
    const shouldSuppress = skipMode === 'guided'
        ? (isGuidedGeneration || hasQuietPrompt)
        : (skipMode === 'impersonation' ? isImpersonationGeneration : false);

    return {
        shouldSuppress,
        skipMode,
        isGuidedGeneration,
        isImpersonationGeneration,
        hasQuietPrompt,
        instructContent,
        quietPromptRaw,
        matchedPattern
    };
}
