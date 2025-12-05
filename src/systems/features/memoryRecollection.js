/**
 * Memory Recollection Module
 * Handles generation of lorebook entries from chat history
 */

import { chat, characters, this_chid, generateRaw, substituteParams, eventSource, event_types } from '../../../../../../../script.js';
import { selected_group } from '../../../../../../group-chats.js';
import { extensionSettings, addDebugLog } from '../../core/state.js';
import { saveSettings } from '../../core/persistence.js';
import { checkWorldInfo, createNewWorldInfo, openWorldInfoEditor, saveWorldInfo, setWorldInfoSettings } from '../../../../../../world-info.js';

/**
 * Helper to log to both console and debug logs array
 */
function debugLog(message, data = null) {
    if (data !== null && data !== undefined) {
        console.log(message, data);
    } else {
        console.log(message);
    }
    if (extensionSettings.debugMode) {
        addDebugLog(message, data);
    }
}

/**
 * Get or create the Memory Recollection lorebook
 * @returns {Promise<string>} The UID of the Memory Recollection lorebook
 */
async function getOrCreateMemoryLorebook() {
    const lorebookName = 'Memory Recollection';

    try {
        debugLog('[Memory Recollection] Checking for existing lorebook...');

        // Use checkWorldInfo to see if it exists
        const exists = await checkWorldInfo(lorebookName);

        if (exists) {
            debugLog('[Memory Recollection] Found existing lorebook:', lorebookName);
            return lorebookName;
        }

        // Create new lorebook using SillyTavern's imported function
        debugLog('[Memory Recollection] Creating new Memory Recollection lorebook');

        // Call the imported createNewWorldInfo function
        await createNewWorldInfo(lorebookName, true);

        debugLog('[Memory Recollection] Created lorebook:', lorebookName);

        // Wait for the file system to settle
        await new Promise(resolve => setTimeout(resolve, 500));

        return lorebookName;
    } catch (error) {
        console.error('[Memory Recollection] Error in getOrCreateMemoryLorebook:', error);
        throw error;
    }
}
/**
 * Create the constant "Relevant Memories:" header entry
 * @param {string} lorebookUid - The UID of the lorebook
 * @returns {Object} The header entry object
 */
function createConstantHeaderEntry() {
    const entry = {
        uid: 1, // Fixed UID so it's always first
        key: [],
        keysecondary: [],
        comment: 'Relevant Memories Header',
        content: 'Relevant Memories:',
        constant: true, // Always inserted
        vectorized: false,
        selective: false,
        selectiveLogic: 0,
        addMemo: false,
        order: 99, // First in order
        position: 4, // at Depth
        disable: false,
        ignoreBudget: false,
        excludeRecursion: false,
        preventRecursion: false,
        matchPersonaDescription: false,
        matchCharacterDescription: false,
        matchCharacterPersonality: false,
        matchCharacterDepthPrompt: false,
        matchScenario: false,
        matchCreatorNotes: false,
        delayUntilRecursion: false,
        probability: 100,
        useProbability: true,
        depth: 1, // Insertion depth
        outletName: '',
        group: '',
        groupOverride: false,
        groupWeight: 100,
        scanDepth: null,
        caseSensitive: null,
        matchWholeWords: null,
        useGroupScoring: null,
        automationId: '',
        role: 0, // System role
        sticky: 0,
        cooldown: 0,
        delay: 0,
        triggers: [],
        displayIndex: 0,
        characterFilter: {
            isExclude: false,
            names: [],
            tags: []
        }
    };

    debugLog('[Memory Recollection] Created constant header entry');
    return entry;
}

/**
 * Save a world info entry to a lorebook
 * @param {string} lorebookUid - The filename/UID of the lorebook
 * @param {Object} entry - The entry data
 */
async function saveWorldInfoEntry(lorebookUid, entry) {
    try {
        debugLog('[Memory Recollection] Saving entry to lorebook:', lorebookUid);

        // Open the world info editor for this lorebook to load its data
        await openWorldInfoEditor(lorebookUid);

        // Wait for it to load
        await new Promise(resolve => setTimeout(resolve, 500));

        // Now access the loaded world info data
        const worldInfo = window.world_info;

        debugLog('[Memory Recollection] World info after opening:', {
            type: typeof worldInfo,
            isArray: Array.isArray(worldInfo),
            hasEntries: worldInfo?.entries !== undefined,
            keys: worldInfo ? Object.keys(worldInfo).slice(0, 10) : null
        });

        // Try different structures - it might be an array or might have different properties
        let entries;
        if (worldInfo && typeof worldInfo === 'object') {
            if (worldInfo.entries) {
                entries = worldInfo.entries;
            } else if (Array.isArray(worldInfo)) {
                // If it's an array, convert to entries object
                entries = {};
                worldInfo.forEach((e, i) => {
                    if (e && e.uid) {
                        entries[e.uid] = e;
                    }
                });
            }
        }

        if (!entries) {
            entries = {};
        }

        // Add the entry
        entries[entry.uid] = entry;

        debugLog('[Memory Recollection] Entry added, saving world info...');

        // Save using the imported saveWorldInfo function
        // Pass the entries as the data structure
        await saveWorldInfo(lorebookUid, { entries });

        debugLog('[Memory Recollection] Entry saved successfully');
        return { success: true };
    } catch (error) {
        console.error('[Memory Recollection] Error saving entry:', error);
        throw error;
    }
}

/**
 * Save multiple world info entries to a lorebook at once
 * @param {string} lorebookUid - The filename/UID of the lorebook
 * @param {Array} newEntries - Array of entry objects to add
 */
async function saveWorldInfoEntries(lorebookUid, newEntries) {
    try {
        debugLog(`[Memory Recollection] Saving ${newEntries.length} entries to lorebook:`, lorebookUid);

        // Open the world info editor for this lorebook to load its data
        await openWorldInfoEditor(lorebookUid);

        // Wait for it to load
        await new Promise(resolve => setTimeout(resolve, 500));

        // Now access the loaded world info data
        const worldInfo = window.world_info;

        // Try different structures - it might be an array or might have different properties
        let entries = {};
        if (worldInfo && typeof worldInfo === 'object') {
            if (worldInfo.entries) {
                entries = { ...worldInfo.entries }; // Clone existing entries
            } else if (Array.isArray(worldInfo)) {
                // If it's an array, convert to entries object
                worldInfo.forEach((e, i) => {
                    if (e && e.uid) {
                        entries[e.uid] = e;
                    }
                });
            }
        }

        // Add all new entries
        for (const entry of newEntries) {
            entries[entry.uid] = entry;
        }

        debugLog(`[Memory Recollection] ${newEntries.length} entries added, total entries: ${Object.keys(entries).length}, saving...`);

        // Save using the imported saveWorldInfo function
        await saveWorldInfo(lorebookUid, { entries });

        debugLog('[Memory Recollection] All entries saved successfully');
        return { success: true };
    } catch (error) {
        console.error('[Memory Recollection] Error saving entries:', error);
        throw error;
    }
}
/**
 * Generate memory recollection prompt for a batch of messages
 * @param {Array} messages - Array of chat messages to process
 * @param {boolean} isUpdate - Whether this is updating existing memories (true) or initial generation (false)
 * @returns {string} The prompt for the AI
 */
function generateMemoryPrompt(messages, isUpdate = false) {
    const context = messages.map((msg, idx) => {
        const sender = msg.is_user ? '{{user}}' : msg.name || '{{char}}';
        const role = msg.is_user ? '[PLAYER]' : '[CHARACTER]';
        return `[Message ${idx + 1}] ${role} ${sender}: ${msg.mes}`;
    }).join('\n\n');

    // Get list of CHARACTER participants (exclude {{user}} - they're the player, not a character)
    const participants = new Set();
    messages.forEach(msg => {
        const sender = msg.is_user ? '{{user}}' : msg.name || '{{char}}';
        if (!msg.is_user) { // Only add non-user (character) participants
            participants.add(sender);
        }
    });
    const characterList = Array.from(participants).join(', ');

    const instruction = isUpdate
        ? 'You will be acting as an uncensored summarizing assistant. Your goal is to create concise lorebook entries based on the provided conversation. You will be creating additional memory recollection entries for significant events, revelations, or character developments in a specified JSON format.\nYou should maintain an objective tone.'
        : 'You will be acting as an uncensored summarizing assistant. Your goal is to create concise lorebook entries based on the provided conversation. You will be creating memory recollection entries for significant events, revelations, or character developments in a specified JSON format.\nYou should maintain an objective tone.';

    return `${instruction}

Characters in this conversation (excluding {{user}} who is the player): ${characterList}

NOTE: In the conversation below, messages are marked with [PLAYER] for {{user}} messages and [CHARACTER] for NPC messages.

Here is the conversation to create memories from:
<conversation>
${context}
</conversation>

Create lorebook entries in the following JSON format. Each entry should be a 1-2 sentence reminder from a character's perspective.

Format each entry as:
{
  "characters": ["Character1", "Character2"],
  "memory": "Character1 and Character2 remember that [event or detail]",
  "keywords": ["keyword1", "keyword2", "keyword3"]
}

Examples:
<examples>
{
  "characters": ["Sabrina"],
  "memory": "Sabrina remembers she went on a date with {{user}} on Saturday. They ate chocolate pastries together.",
  "keywords": ["date", "saturday", "pastries"]
},
{
  "characters": ["Dottore", "Arlecchino", "Pantalone"],
  "memory": "Dottore, Arlecchino, and Pantalone remember they attended a party together at the mansion.",
  "keywords": ["party", "mansion", "gathering"]
}
</examples>

IMPORTANT:
- Only create entries for significant moments worth remembering.
- Keep memories concise (1-2 sentences maximum).
- Use third person perspective: "{name} remembers..."
- Choose 3 specific, relevant keywords per entry.
- ONLY assign memories to CHARACTERS (NPCs) - NEVER include {{user}} in the "characters" array.
- {{user}} is the player, not a character, so they should NEVER be in the characters list.
- Only characters who were ACTUALLY PRESENT in that specific scene/moment should remember it.
- If multiple characters share the memory, list all of them in the "characters" array.
- If known, include details such as dates, locations, and other relevant context in the memories.

Return ONLY a JSON array of memory objects, nothing else:`;
}

/**
 * Parse the AI response to extract memory entries
 * @param {string} response - The AI's response
 * @returns {Array<Object>} Array of parsed memory entries
 */
function parseMemoryResponse(response) {
    try {
        // Try to extract JSON from code blocks
        const jsonMatch = response.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
        const jsonString = jsonMatch ? jsonMatch[1] : response;

        // Parse JSON
        const memories = JSON.parse(jsonString.trim());

        if (!Array.isArray(memories)) {
            throw new Error('Response is not an array');
        }

        debugLog('[Memory Recollection] Parsed memories:', memories);
        return memories;

    } catch (error) {
        debugLog('[Memory Recollection] Failed to parse response:', error);
        console.error('[Memory Recollection] Parse error:', error);
        console.error('[Memory Recollection] Raw response:', response);
        return [];
    }
}

/**
 * Create a world info entry from a memory object
 * @param {string} lorebookUid - The UID of the lorebook
 * @param {Object} memory - The memory object
 * @param {number} index - The index for ordering
 */
async function createMemoryEntry(lorebookUid, memory, index) {
    const { characters: characterList, memory: content, keywords } = memory;

    // Handle character filter - just use the character names directly
    let characterNames = [];

    if (Array.isArray(characterList) && characterList.length > 0) {
        // New format: array of character names
        characterNames = characterList.map(name => name.trim());
        debugLog(`[Memory Recollection] Character names for filter:`, characterNames);
    } else if (typeof characterList === 'string' && characterList.trim() !== '') {
        // Legacy string format or comma-separated - parse it
        characterNames = characterList.split(',').map(n => n.trim()).filter(n => n !== '');
        debugLog(`[Memory Recollection] Character names for filter:`, characterNames);
    }

    const entry = {
        uid: Date.now() + index, // Simple UID generation
        key: keywords || [],
        keysecondary: [],
        comment: `Memory: ${characterNames.join(', ')}`,
        content: content,
        constant: false,
        vectorized: false,
        selective: true,
        selectiveLogic: 0,
        addMemo: false,
        order: 100,
        position: 4, // at Depth
        disable: false,
        ignoreBudget: false,
        excludeRecursion: false,
        preventRecursion: false,
        matchPersonaDescription: false,
        matchCharacterDescription: false,
        matchCharacterPersonality: false,
        matchCharacterDepthPrompt: false,
        matchScenario: false,
        matchCreatorNotes: false,
        delayUntilRecursion: false,
        probability: 100,
        useProbability: true,
        depth: 1, // Insertion depth
        outletName: '',
        group: '',
        groupOverride: false,
        groupWeight: 100,
        scanDepth: null,
        caseSensitive: null,
        matchWholeWords: null,
        useGroupScoring: null,
        automationId: '',
        role: 0, // 0 = System role (matching the example)
        sticky: 0,
        cooldown: 0,
        delay: 0,
        triggers: [],
        displayIndex: index + 1,
        characterFilter: {
            isExclude: false,
            names: characterNames, // Array of character names
            tags: []
        },
        extensions: {
            position: 4, // at Depth
            depth: 1,
            role: 1
        }
    };

    debugLog(`[Memory Recollection] Created entry for ${characterNames.join(', ')} with character filter:`, characterNames);
    return entry; // Return instead of saving
}

/**
 * Process a batch of messages and generate memory entries
 * @param {Array} messages - Array of messages to process
 * @param {string} lorebookUid - The UID of the lorebook
 * @param {boolean} isUpdate - Whether this is an update (true) or initial generation (false)
 * @param {number} startIndex - Starting index for entry ordering
 * @returns {Promise<Array>} Array of created entries
 */
async function processBatch(messages, lorebookUid, isUpdate, startIndex) {
    debugLog(`[Memory Recollection] Processing batch of ${messages.length} messages (isUpdate: ${isUpdate})`);

    const prompt = generateMemoryPrompt(messages, isUpdate);

    // Generate using SillyTavern's generateRaw
    const response = await generateRaw(prompt, '', false, false);

    if (!response) {
        throw new Error('No response from AI');
    }

    // Parse the response
    const memories = parseMemoryResponse(response);

    if (memories.length === 0) {
        debugLog('[Memory Recollection] No memories extracted from this batch');
        // Return -1 to signal parse failure (vs 0 for valid but empty response)
        throw new Error('Failed to parse memories from AI response. The response may be invalid or the service may be unavailable.');
    }

    // Create entries for each memory (but don't save yet)
    const entries = [];
    for (let i = 0; i < memories.length; i++) {
        const entry = await createMemoryEntry(lorebookUid, memories[i], startIndex + i);
        entries.push(entry);
    }

    debugLog(`[Memory Recollection] Created ${entries.length} entries from batch`);
    return entries;
}

/**
 * Main function to start memory recollection process
 * @param {Function} onProgress - Callback for progress updates (current, total)
 * @param {Function} onComplete - Callback when complete
 * @param {Function} onError - Callback for errors
 */
export async function startMemoryRecollection(onProgress, onComplete, onError) {
    try {
        debugLog('[Memory Recollection] Starting memory recollection process');

        // Get or create the lorebook
        const lorebookUid = await getOrCreateMemoryLorebook();

        // Get messages to process count from settings
        const messagesToProcess = extensionSettings.memoryMessagesToProcess || 16;

        // Check if this is an update (lorebook already exists with entries)
        const world_info = window.world_info;
        const lorebook = world_info.globalSelect?.find(book => book.uid === lorebookUid);
        const existingEntryCount = lorebook?.entries ? Object.keys(lorebook.entries).length : 0;
        const isUpdate = existingEntryCount > 1; // More than just the header

        let messagesToProcessArray;
        if (isUpdate) {
            // Process only the last batch
            const totalMessages = chat.length;
            const startIdx = Math.max(0, totalMessages - messagesToProcess);
            messagesToProcessArray = chat.slice(startIdx);
            debugLog(`[Memory Recollection] Update mode: Processing last ${messagesToProcess} messages`);
        } else {
            // Process entire chat in batches
            messagesToProcessArray = chat;
            debugLog(`[Memory Recollection] Initial mode: Processing all ${chat.length} messages`);
        }

        const totalBatches = Math.ceil(messagesToProcessArray.length / messagesToProcess);
        let entryIndex = existingEntryCount;
        const allEntries = []; // Accumulate all entries here

        for (let i = 0; i < totalBatches; i++) {
            const batchStart = i * messagesToProcess;
            const batchEnd = Math.min(batchStart + messagesToProcess, messagesToProcessArray.length);
            const batch = messagesToProcessArray.slice(batchStart, batchEnd);

            onProgress(i + 1, totalBatches);

            try {
                const batchEntries = await processBatch(batch, lorebookUid, isUpdate && i === 0, entryIndex);
                allEntries.push(...batchEntries); // Add to accumulator
                entryIndex += batchEntries.length;
            } catch (error) {
                // Batch failed - ask user if they want to retry
                debugLog('[Memory Recollection] Batch failed:', error.message);

                const retry = await new Promise(resolve => {
                    const retryModal = document.createElement('div');
                    retryModal.className = 'rpg-memory-modal-overlay';
                    retryModal.innerHTML = `
                        <div class="rpg-memory-modal">
                            <div class="rpg-memory-modal-header">
                                <h3>⚠️ Generation Failed</h3>
                            </div>
                            <div class="rpg-memory-modal-body">
                                <p><strong>Error:</strong> ${error.message}</p>
                                <p>Batch ${i + 1} of ${totalBatches} failed to process.</p>
                                <p>Would you like to retry this batch?</p>
                            </div>
                            <div class="rpg-memory-modal-footer">
                                <button class="rpg-memory-modal-btn rpg-memory-cancel">Skip Batch</button>
                                <button class="rpg-memory-modal-btn rpg-memory-proceed">Retry</button>
                            </div>
                        </div>
                    `;

                    document.body.appendChild(retryModal);

                    retryModal.querySelector('.rpg-memory-cancel').addEventListener('click', () => {
                        document.body.removeChild(retryModal);
                        resolve(false);
                    });

                    retryModal.querySelector('.rpg-memory-proceed').addEventListener('click', () => {
                        document.body.removeChild(retryModal);
                        resolve(true);
                    });
                });

                if (retry) {
                    // Retry the same batch
                    i--;
                    continue;
                }
                // Otherwise skip this batch and continue
            }

            // Small delay between batches to avoid rate limiting
            if (i < totalBatches - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        // Add the constant header entry at the end
        const headerEntry = createConstantHeaderEntry();
        allEntries.push(headerEntry); // Add to end of array

        // Save all entries at once
        if (allEntries.length > 0) {
            debugLog(`[Memory Recollection] Saving ${allEntries.length} total entries (including header) to lorebook...`);
            await saveWorldInfoEntries(lorebookUid, allEntries);

            // Trigger world info refresh by simulating the WI button click to reload the list
            // This ensures the newly created lorebook appears in the dropdown
            const wiButton = document.querySelector('#WIDrawerIcon');
            if (wiButton) {
                // Close and reopen to force refresh
                wiButton.click();
                await new Promise(resolve => setTimeout(resolve, 100));
                wiButton.click();
                debugLog('[Memory Recollection] Triggered WI panel refresh');
            }

            // Also emit the update event
            eventSource.emit(event_types.WORLDINFO_SETTINGS_UPDATED);
        }

        debugLog('[Memory Recollection] Process complete');

        // Open the World Info editor with the Memory Recollection lorebook
        try {
            await openWorldInfoEditor(lorebookUid);
            debugLog('[Memory Recollection] Opened World Info editor with Memory Recollection lorebook');
        } catch (err) {
            debugLog('[Memory Recollection] Could not open World Info editor:', err);
        }

        onComplete(allEntries.length);

    } catch (error) {
        debugLog('[Memory Recollection] Error:', error);
        onError(error);
    }
}

/**
 * Show memory recollection confirmation modal
 */
export function showMemoryRecollectionModal() {
    const modal = document.createElement('div');
    modal.className = 'rpg-memory-modal-overlay';
    modal.innerHTML = `
        <div class="rpg-memory-modal">
            <div class="rpg-memory-modal-header">
                <h3>⚠️ Memory Recollection</h3>
            </div>
            <div class="rpg-memory-modal-body">
                <p><strong>Warning!</strong> This process will trigger multiple generation requests and will take time.</p>
                <p>Ensure your currently selected model is the one you want to use for this task.</p>
                <p class="rpg-memory-modal-info">
                    Messages per batch: <strong>${extensionSettings.memoryMessagesToProcess || 16}</strong>
                    <br>
                    <span class="rpg-memory-modal-hint">(You can change this in the extension settings)</span>
                </p>
            </div>
            <div class="rpg-memory-modal-footer">
                <button class="rpg-memory-modal-btn rpg-memory-cancel">Cancel</button>
                <button class="rpg-memory-modal-btn rpg-memory-proceed">Proceed</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Event listeners
    modal.querySelector('.rpg-memory-cancel').addEventListener('click', () => {
        document.body.removeChild(modal);
    });

    modal.querySelector('.rpg-memory-proceed').addEventListener('click', () => {
        document.body.removeChild(modal);
        showMemoryProgressModal();
    });

    // Click outside to close
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
}

/**
 * Show progress modal during memory recollection
 */
function showMemoryProgressModal() {
    const modal = document.createElement('div');
    modal.className = 'rpg-memory-modal-overlay';
    modal.innerHTML = `
        <div class="rpg-memory-modal">
            <div class="rpg-memory-modal-header">
                <h3>🧠 Processing Memories...</h3>
            </div>
            <div class="rpg-memory-modal-body">
                <p class="rpg-memory-progress-text">Processing batch <span class="rpg-memory-current">0</span> of <span class="rpg-memory-total">0</span></p>
                <div class="rpg-memory-progress-bar">
                    <div class="rpg-memory-progress-fill"></div>
                </div>
                <p class="rpg-memory-status">Initializing...</p>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const currentSpan = modal.querySelector('.rpg-memory-current');
    const totalSpan = modal.querySelector('.rpg-memory-total');
    const progressFill = modal.querySelector('.rpg-memory-progress-fill');
    const statusText = modal.querySelector('.rpg-memory-status');

    // Start the process
    startMemoryRecollection(
        (current, total) => {
            currentSpan.textContent = current;
            totalSpan.textContent = total;
            const percentage = (current / total) * 100;
            progressFill.style.width = `${percentage}%`;
            statusText.textContent = `Processing memories from batch ${current}...`;
        },
        (entriesCreated) => {
            statusText.innerHTML = `
                <strong>✅ Complete!</strong> Created ${entriesCreated} memory entries.<br>
                <small>The "Memory Recollection" lorebook has been created.</small><br>
                <strong style="color: #ffa500; margin-top: 10px; display: block;">⚠️ Please refresh SillyTavern to see the lorebook in the World Info dropdown.</strong>
            `;
            progressFill.style.width = '100%';

            // Add close button
            const closeBtn = document.createElement('button');
            closeBtn.className = 'rpg-memory-modal-btn rpg-memory-close';
            closeBtn.textContent = 'Close';
            closeBtn.style.marginTop = '15px';
            closeBtn.addEventListener('click', () => {
                document.body.removeChild(modal);
            });
            modal.querySelector('.rpg-memory-modal-body').appendChild(closeBtn);
        },
        (error) => {
            statusText.textContent = `Error: ${error.message}`;
            statusText.style.color = '#e94560';

            // Close after 5 seconds
            setTimeout(() => {
                document.body.removeChild(modal);
            }, 5000);
        }
    );
}

/**
 * Setup the memory recollection button in World Info section
 */
export function setupMemoryRecollectionButton() {
    console.log('[Memory Recollection] Setting up button via event listener');

    // Use SillyTavern's built-in event to know when WI is ready
    // This fires after the worldInfoSettings are loaded
    eventSource.on('worldInfoSettings', () => {
        console.log('[Memory Recollection] worldInfoSettings event fired');
        setTimeout(updateButton, 100);
    });

    // Also try on app ready
    eventSource.on('app_ready', () => {
        console.log('[Memory Recollection] app_ready event fired');
        setTimeout(updateButton, 500);
    });

    // Try immediately as well
    setTimeout(updateButton, 2000);

    function updateButton() {
        const existingButton = document.querySelector('.rpg-memory-recollection-btn');

        // If extension is disabled, remove button if it exists
        if (!extensionSettings.enabled) {
            if (existingButton) {
                console.log('[Memory Recollection] Extension disabled, removing button');
                existingButton.remove();
            }
            return;
        }

        // Extension is enabled, add button if it doesn't exist
        addButton();
    }

    function addButton() {
        // Check if button already exists
        if (document.querySelector('.rpg-memory-recollection-btn')) {
            console.log('[Memory Recollection] Button already exists');
            return;
        }

        console.log('[Memory Recollection] Attempting to add button...');

        // World Info button bar is inside the world editor
        // Look for the specific button container
        const selectors = [
            '#world_editor_buttons',
            '#world_popup .world_button_bar',
            '#WorldInfo .world_button_bar',
            '.world_button_bar',
            '#world_popup .justifyLeft',
            '#WorldInfo .justifyLeft',
            '#world_popup',
            '#WorldInfo'
        ];

        let container = null;
        for (const selector of selectors) {
            container = document.querySelector(selector);
            if (container) {
                console.log(`[Memory Recollection] Found container with selector: ${selector}`, container);
                break;
            }
        }

        if (!container) {
            console.log('[Memory Recollection] No suitable container found yet');
            return;
        }

        // Create the button
        const button = document.createElement('button');
        button.id = 'rpg-memory-recollection-button';
        button.className = 'rpg-memory-recollection-btn menu_button';
        button.innerHTML = '<i class="fa-solid fa-brain"></i> Memory Recollection';
        button.title = 'Generate memory recollection entries from chat history';

        button.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            showMemoryRecollectionModal();
        });

        // Insert the button - prepend to put it first
        if (container.classList.contains('world_button_bar') || container.classList.contains('justifyLeft')) {
            container.insertBefore(button, container.firstChild);
        } else {
            // Find or create a button container
            let buttonContainer = container.querySelector('.world_button_bar') ||
                                 container.querySelector('.justifyLeft');

            if (!buttonContainer) {
                buttonContainer = document.createElement('div');
                buttonContainer.className = 'world_button_bar justifyLeft';
                container.insertBefore(buttonContainer, container.firstChild);
            }

            buttonContainer.insertBefore(button, buttonContainer.firstChild);
        }

        console.log('[Memory Recollection] ✅ Button added successfully!');
    }
}

/**
 * Update button visibility based on extension enabled state
 * Call this when the extension is toggled on/off
 */
export function updateMemoryRecollectionButton() {
    const existingButton = document.querySelector('.rpg-memory-recollection-btn');

    if (!extensionSettings.enabled) {
        // Extension disabled - remove button if it exists
        if (existingButton) {
            console.log('[Memory Recollection] Extension disabled, removing button');
            existingButton.remove();
        }
    } else {
        // Extension enabled - ensure button exists
        if (!existingButton) {
            console.log('[Memory Recollection] Extension enabled, adding button');
            setTimeout(() => {
                setupMemoryRecollectionButton();
            }, 100);
        }
    }
}
