/**
 * Encounter State Module
 * Manages combat encounter state and history
 */

/**
 * Current encounter state
 */
export let currentEncounter = {
    active: false,
    initialized: false,
    combatHistory: [], // Array of {role: 'user'|'assistant'|'system', content: string}
    combatStats: null, // Current combat stats (HP, party, enemies, etc.)
    preEncounterContext: [], // Messages from before the encounter started
    encounterStartMessage: '', // The message that triggered the encounter
    encounterLog: [] // Full log of combat actions for final summary
};

/**
 * Encounter logs storage (per chat)
 */
export let encounterLogs = {
    // chatId: [
    //   {
    //     timestamp: Date,
    //     log: [],
    //     summary: string,
    //     result: 'victory'|'defeat'|'fled'
    //   }
    // ]
};

/**
 * Sets the current encounter state
 * @param {object} encounter - The encounter state object
 */
export function setCurrentEncounter(encounter) {
    currentEncounter = encounter;
}

/**
 * Updates current encounter state with partial data
 * @param {object} updates - Partial encounter state to merge
 */
export function updateCurrentEncounter(updates) {
    Object.assign(currentEncounter, updates);
}

/**
 * Resets the encounter state
 */
export function resetEncounter() {
    currentEncounter = {
        active: false,
        initialized: false,
        combatHistory: [],
        combatStats: null,
        preEncounterContext: [],
        encounterStartMessage: '',
        encounterLog: []
    };
}

/**
 * Adds a message to combat history
 * @param {string} role - Message role ('user', 'assistant', or 'system')
 * @param {string} content - Message content
 */
export function addCombatMessage(role, content) {
    currentEncounter.combatHistory.push({ role, content });
}

/**
 * Adds an entry to the encounter log
 * @param {string} action - The action taken
 * @param {string} result - The result of the action
 */
export function addEncounterLogEntry(action, result) {
    currentEncounter.encounterLog.push({
        timestamp: Date.now(),
        action,
        result
    });
}

/**
 * Saves an encounter log for a specific chat
 * @param {string} chatId - The chat identifier
 * @param {object} logData - The encounter log data
 */
export function saveEncounterLog(chatId, logData) {
    if (!encounterLogs[chatId]) {
        encounterLogs[chatId] = [];
    }
    encounterLogs[chatId].push({
        timestamp: new Date(),
        log: logData.log || [],
        summary: logData.summary || '',
        result: logData.result || 'unknown'
    });
}

/**
 * Gets encounter logs for a specific chat
 * @param {string} chatId - The chat identifier
 * @returns {Array} Array of encounter logs
 */
export function getEncounterLogs(chatId) {
    return encounterLogs[chatId] || [];
}

/**
 * Clears all encounter logs for a specific chat
 * @param {string} chatId - The chat identifier
 */
export function clearEncounterLogs(chatId) {
    if (encounterLogs[chatId]) {
        delete encounterLogs[chatId];
    }
}

/**
 * Exports encounter logs as JSON
 * @param {string} chatId - The chat identifier
 * @returns {string} JSON string of encounter logs
 */
export function exportEncounterLogs(chatId) {
    const logs = getEncounterLogs(chatId);
    return JSON.stringify(logs, null, 2);
}
