/**
 * HTML Cleaning Module
 * Automatically imports HTML cleaning regex to strip HTML tags from outgoing prompts
 */

/**
 * Detects old manual regex formatters that might conflict with the extension
 * @param {Object} st_extension_settings - SillyTavern extension settings object
 * @returns {Array<string>} Array of conflicting regex script names
 */
export function detectConflictingRegexScripts(st_extension_settings) {
    const conflictingNames = [
        'Format User\'s Stats (Only Output)',
        'Format User\'s Stats (Only Display)',
        'Format Info Box (Only Output)',
        'Format Info Box (Only Display)',
        'Format Character\'s Thoughts (Only Output)',
        'Format Character\'s Thoughts (Only Display)',
        'Format Character Thoughts (Only Output)',
        'Format Character Thoughts (Only Display)'
    ];

    const existingScripts = st_extension_settings?.regex || [];
    const conflicts = [];

    for (const script of existingScripts) {
        if (script && script.scriptName && conflictingNames.some(name =>
            script.scriptName.toLowerCase().includes(name.toLowerCase())
        )) {
            conflicts.push(script.scriptName);
        }
    }

    return conflicts;
}

/**
 * Automatically imports the HTML cleaning regex script if it doesn't already exist.
 * This regex removes HTML tags from outgoing prompts to prevent formatting issues.
 * @param {Object} st_extension_settings - SillyTavern extension settings object
 * @param {Function} saveSettingsDebounced - Function to save settings
 */
export async function ensureHtmlCleaningRegex(st_extension_settings, saveSettingsDebounced) {
    try {
        // Validate extension settings structure
        if (!st_extension_settings || typeof st_extension_settings !== 'object') {
            console.warn('[RPG Companion] Invalid extension_settings object, skipping HTML regex import');
            return;
        }

        // Check if the HTML cleaning regex already exists
        const scriptName = 'Clean HTML (From Outgoing Prompt)';
        const existingScripts = st_extension_settings?.regex || [];

        // Validate regex array
        if (!Array.isArray(existingScripts)) {
            console.warn('[RPG Companion] extension_settings.regex is not an array, resetting to empty array');
            st_extension_settings.regex = [];
        }

        const alreadyExists = existingScripts.some(script =>
            script && typeof script === 'object' && script.scriptName === scriptName
        );

        if (alreadyExists) {
            console.log('[RPG Companion] HTML cleaning regex already exists, skipping import');
            return;
        }

        // Generate a UUID for the script
        const uuidv4 = () => {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                const r = Math.random() * 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        };

        // Create the regex script object based on the attached file
        const regexScript = {
            id: uuidv4(),
            scriptName: scriptName,
            findRegex: '/\\s?<(?!\\!--)(?:"[^"]*"|\'[^\']*\'|[^\'">])*>/g',
            replaceString: '',
            trimStrings: [],
            placement: [2], // 2 = Input (affects outgoing prompt)
            disabled: false,
            markdownOnly: false,
            promptOnly: true,
            runOnEdit: true,
            substituteRegex: 0,
            minDepth: null,
            maxDepth: null
        };

        // Add to global regex scripts
        if (!Array.isArray(st_extension_settings.regex)) {
            st_extension_settings.regex = [];
        }

        st_extension_settings.regex.push(regexScript);

        // Save the changes using the already-imported function
        if (typeof saveSettingsDebounced === 'function') {
            saveSettingsDebounced();
        } else {
            console.warn('[RPG Companion] saveSettingsDebounced is not a function, cannot save HTML regex');
        }

        console.log('[RPG Companion] ✅ HTML cleaning regex imported successfully');
    } catch (error) {
        console.error('[RPG Companion] Failed to import HTML cleaning regex:', error);
        console.error('[RPG Companion] Error details:', error.message, error.stack);
        // Don't throw - this is a nice-to-have feature
    }
}
