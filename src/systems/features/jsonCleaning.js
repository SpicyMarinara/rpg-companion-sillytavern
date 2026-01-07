/**
 * JSON Cleaning Module
 * Automatically registers a regex script to strip tracker JSON from Together mode output
 */

/**
 * Registers an output transformation regex to remove tracker JSON from messages
 * This uses SillyTavern's built-in regex system to transform text BEFORE display
 * @param {Object} st_extension_settings - SillyTavern extension settings object
 * @param {Function} saveSettingsDebounced - Function to save settings
 */
export async function ensureJsonCleaningRegex(st_extension_settings, saveSettingsDebounced) {
    try {
        // Validate extension settings structure
        if (!st_extension_settings || typeof st_extension_settings !== 'object') {
            console.warn('[RPG Companion] Invalid extension_settings object, skipping JSON cleaning regex');
            return;
        }

        // Check if the JSON cleaning regex already exists
        const scriptName = 'RPG Companion - Remove Tracker JSON (Together Mode)';
        const existingScripts = st_extension_settings?.regex || [];

        // Validate regex array
        if (!Array.isArray(existingScripts)) {
            console.warn('[RPG Companion] extension_settings.regex is not an array, resetting to empty array');
            st_extension_settings.regex = [];
        }

        const alreadyExists = existingScripts.some(script =>
            script && script.scriptName && script.scriptName === scriptName
        );

        if (alreadyExists) {
            console.log('[RPG Companion] JSON cleaning regex already exists, skipping import');
            return;
        }

        console.log('[RPG Companion] Importing JSON cleaning regex for Together mode...');

        // Generate a UUID for the script
        const uuidv4 = () => {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                const r = Math.random() * 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        };

        // Create the regex script object for cleaning JSON tracker data
        // This regex matches ```json...``` code blocks containing tracker data
        // The prompt now explicitly instructs models to use this format
        const regexScript = {
            id: uuidv4(),
            scriptName: scriptName,
            // Match ```json...``` code blocks (non-greedy, multiline)
            // This is now the guaranteed format since prompts instruct models to use code blocks
            findRegex: '/```json\\s*[\\s\\S]*?```/gi',
            replaceString: '',
            trimStrings: [],
            placement: [0], // 0 = Output (transforms after generation, before display)
            disabled: false,
            markdownOnly: false,
            promptOnly: false, // Apply to both prompts and outputs
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

        // Save the changes
        if (typeof saveSettingsDebounced === 'function') {
            saveSettingsDebounced();
        } else {
            console.warn('[RPG Companion] saveSettingsDebounced is not a function, cannot save JSON cleaning regex');
        }

        console.log('[RPG Companion] ✅ JSON cleaning regex imported successfully');
        console.log('[RPG Companion] This regex will automatically remove tracker JSON from Together mode messages');
    } catch (error) {
        console.error('[RPG Companion] Failed to import JSON cleaning regex:', error);
        console.error('[RPG Companion] Error details:', error.message, error.stack);
        // Don't throw - continue without it
    }
}

/**
 * Removes the JSON cleaning regex if it exists
 * Useful when switching to separate mode or disabling the feature
 * @param {Object} st_extension_settings - SillyTavern extension settings object
 * @param {Function} saveSettingsDebounced - Function to save settings
 */
export function removeJsonCleaningRegex(st_extension_settings, saveSettingsDebounced) {
    try {
        if (!st_extension_settings?.regex || !Array.isArray(st_extension_settings.regex)) {
            return;
        }

        const scriptName = 'RPG Companion - Remove Tracker JSON (Together Mode)';
        const initialLength = st_extension_settings.regex.length;

        st_extension_settings.regex = st_extension_settings.regex.filter(script =>
            !script || !script.scriptName || script.scriptName !== scriptName
        );

        if (st_extension_settings.regex.length < initialLength) {
            console.log('[RPG Companion] Removed JSON cleaning regex');
            if (typeof saveSettingsDebounced === 'function') {
                saveSettingsDebounced();
            }
        }
    } catch (error) {
        console.error('[RPG Companion] Failed to remove JSON cleaning regex:', error);
    }
}
