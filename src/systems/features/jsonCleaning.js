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

        const existingScript = existingScripts.find(script =>
            script && script.scriptName && script.scriptName === scriptName
        );

        if (existingScript) {
            // Update existing script with new regex pattern if it's different
            const newPattern = '/```json[\\s\\S]*?```/gim';

            // Always ensure these properties are set correctly
            let needsSave = false;

            if (existingScript.findRegex !== newPattern) {
                existingScript.findRegex = newPattern;
                needsSave = true;
            }

            if (JSON.stringify(existingScript.placement) !== JSON.stringify([2])) {
                existingScript.placement = [2]; // 2 = AI Output
                needsSave = true;
            }

            if (existingScript.disabled !== false) {
                existingScript.disabled = false;
                needsSave = true;
            }

            if (existingScript.runOnEdit !== true) {
                existingScript.runOnEdit = true;
                needsSave = true;
            }

            if (existingScript.displayOnly !== true) {
                existingScript.displayOnly = true; // Alter Chat Display
                needsSave = true;
            }

            if (existingScript.onlyFormatDisplay !== true) {
                existingScript.onlyFormatDisplay = true; // Alter Chat Display
                needsSave = true;
            }

            if (existingScript.onlyFormatPrompt !== true) {
                existingScript.onlyFormatPrompt = true; // Alter Outgoing Prompt
                needsSave = true;
            }

            if (existingScript.promptOnly !== true) {
                existingScript.promptOnly = true; // Enable prompt processing
                needsSave = true;
            }

            if (existingScript.filterGaslighting !== true) {
                existingScript.filterGaslighting = true; // Ephemerality
            }

            console.log('[RPG Companion] JSON Cleaning Regex is already downloaded and active.');
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

        // Create the regex script object for cleaning JSON tracker data
        // This regex matches ```json...``` code blocks containing tracker data
        // The prompt now explicitly instructs models to use this format
        // Updated to handle various whitespace scenarios and ensure it catches all variations
        const regexScript = {
            id: uuidv4(),
            scriptName: scriptName,
            // Match ```json...``` code blocks (handles spaces, newlines, any content)
            // Using a more permissive pattern to catch all variations
            findRegex: '/```json[\\s\\S]*?```/gim',
            replaceString: '',
            trimStrings: [],
            placement: [2], // 2 = AI Output
            disabled: false,
            markdownOnly: false,
            promptOnly: true, // Enable prompt processing
            runOnEdit: true,
            onlyFormatDisplay: true, // Alter Chat Display (enabled)
            onlyFormatPrompt: true, // Alter Outgoing Prompt (enabled)
            filterGaslighting: true, // Ephemerality - makes it only affect display
            substituteRegex: 0,
            minDepth: null,
            maxDepth: null
        };

        // Add to global regex scripts
        if (!Array.isArray(st_extension_settings.regex)) {
            st_extension_settings.regex = [];
        }

        st_extension_settings.regex.push(regexScript);
        console.log('[RPG Companion] JSON Cleaning Regex created and activated.');

        // Save the changes
        if (typeof saveSettingsDebounced === 'function') {
            saveSettingsDebounced();
        } else {
            console.warn('[RPG Companion] saveSettingsDebounced is not a function, cannot save JSON cleaning regex');
        }
    } catch (error) {
        console.error('[RPG Companion] JSON Cleaning Regex failed to properly initialize!');
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
            // console.log('[RPG Companion] Removed JSON cleaning regex');
            if (typeof saveSettingsDebounced === 'function') {
                saveSettingsDebounced();
            }
        }
    } catch (error) {
        console.error('[RPG Companion] Failed to remove JSON cleaning regex:', error);
    }
}
