/**
 * Lorekeeper Utility Module
 * Handles creation and management of lorebook entries for spells
 */

import { checkWorldInfo, createNewWorldInfo, openWorldInfoEditor, saveWorldInfo } from '../../../../../../scripts/world-info.js';
import { getContext } from '../../../../../../scripts/extensions.js';
import { characters, this_chid } from '../../../../../../script.js';
import { selected_group } from '../../../../../../scripts/group-chats.js';

const SPELLS_LOREBOOK_BASE_NAME = 'RPG Companion Spells';

/**
 * Gets the lorebook name for the current chat
 * @returns {string} Chat-specific lorebook name
 */
function getSpellsLorebookName() {
    const context = getContext();
    let chatName = 'Default';
    
    if (context.groupId && context.groups) {
        // Group chat - get group name from context.groups array
        const group = context.groups.find(g => g.id === context.groupId);
        chatName = group ? group.name : `Group_${context.groupId}`;
    } else if (context.characterId !== undefined && context.characters && context.characters[context.characterId]) {
        // 1-on-1 chat - get character name
        chatName = context.characters[context.characterId].name;
    } else if (context.name2) {
        // Fallback to context.name2 if available
        chatName = context.name2;
    }
    
    return `${SPELLS_LOREBOOK_BASE_NAME} - ${chatName}`;
}

const CACHE_KEY = 'rpg_companion_spell_entries_cache';

// In-memory cache of all spell entries to prevent overwrites (keyed by lorebook name)
let spellEntriesCache = {};
let cacheInitialized = {};

// Helper functions to get/set chat-specific cache
function getCurrentCache() {
    const lorebookName = getSpellsLorebookName();
    if (!spellEntriesCache[lorebookName]) {
        spellEntriesCache[lorebookName] = {};
    }
    return spellEntriesCache[lorebookName];
}

function setCurrentCache(entries) {
    const lorebookName = getSpellsLorebookName();
    spellEntriesCache[lorebookName] = entries;
}

function isCacheInitialized() {
    const lorebookName = getSpellsLorebookName();
    return !!cacheInitialized[lorebookName];
}

function setCacheInitialized() {
    const lorebookName = getSpellsLorebookName();
    cacheInitialized[lorebookName] = true;
}

/**
 * Creates the constant header entry for the spellbook lorebook
 * @returns {Object} The header entry object
 */
function createHeaderEntry() {
    return {
        uid: 0,
        key: [],  // No activation keywords
        keysecondary: [],
        comment: 'Header: RPG Companion Spellbook',
        content: `# RPG Companion Spellbook

This lorebook contains spells from your RPG Companion Spellbook.

**How it works:**
1. Open the Spellbook tracker in RPG Companion
2. Add a spell with a name and description
3. The spell is automatically added here as a lorebook entry
4. When the spell name is mentioned in chat, this entry will activate

**Managing spells:**
- Remove spells from the Spellbook UI to remove them from this lorebook
- Use "Clear Spellbook Cache" in Edit Trackers > Spellbook if old entries persist

This entry always stays at the top and explains the spellbook system.`,
        constant: false,
        vectorized: false,
        selective: false,
        selectiveLogic: 0,
        addMemo: false,
        order: 0,
        position: 0,
        disable: true,  // Disabled - never loads
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
        depth: 0,
        outletName: '',
        group: '',
        groupOverride: false,
        groupWeight: 100,
        scanDepth: null,
        caseSensitive: null,
        matchWholeWords: null,
        automation: 'off'
    };
}

/**
 * Loads existing spell entries from the lorebook into cache
 * Uses localStorage to persist the cache across SillyTavern restarts
 * @returns {Promise<void>}
 */
async function initializeCache() {
    if (isCacheInitialized()) return;
    
    try {
        console.log('[RPG Companion] Initializing spell entries cache...');
        
        // Get the lorebook name for this chat
        const lorebookName = getSpellsLorebookName();
        
        // Always ensure header entry exists
        const headerEntry = createHeaderEntry();
        
        // Try to load from localStorage first (most reliable)
        // Use chat-specific key to prevent conflicts
        const chatSpecificKey = `${CACHE_KEY}_${lorebookName}`;
        const cachedData = localStorage.getItem(chatSpecificKey);
        if (cachedData) {
            try {
                const parsedCache = JSON.parse(cachedData);
                // Ensure header exists in cache
                parsedCache['0'] = headerEntry;
                await setCurrentCache(parsedCache);
                console.log(`[RPG Companion] ✅ Loaded ${Object.keys(parsedCache).length} spell entries from localStorage cache`);
                await setCacheInitialized();
                return;
            } catch (e) {
                console.warn('[RPG Companion] Failed to parse localStorage cache, will try lorebook:', e);
            }
        }
        
        // If no localStorage cache, try to load from the lorebook file
        const exists = await checkWorldInfo(lorebookName);
        if (!exists) {
            console.log('[RPG Companion] Spells lorebook does not exist yet, starting with header only');
            await setCurrentCache({ '0': headerEntry });
            await setCacheInitialized();
            return;
        }
        
        console.log('[RPG Companion] Spells lorebook exists, attempting to load entries...');
        
        // Try opening the editor to load data
        await openWorldInfoEditor(lorebookName);
        await new Promise(r => setTimeout(r, 500));
        
        const worldInfo = window.world_info;
        
        // Extract entries if available
        if (worldInfo && typeof worldInfo === 'object' && worldInfo.entries) {
            const loadedEntries = { ...worldInfo.entries };
            // Ensure header exists
            loadedEntries['0'] = headerEntry;
            setCurrentCache(loadedEntries);
            console.log(`[RPG Companion] ✅ Loaded ${Object.keys(loadedEntries).length} entries from lorebook`);
            // Save to localStorage for next time
            const chatSpecificKey = `${CACHE_KEY}_${lorebookName}`;
            localStorage.setItem(chatSpecificKey, JSON.stringify(loadedEntries));
        } else {
            console.log('[RPG Companion] Could not extract entries from lorebook, starting with header only');
            await setCurrentCache({ '0': headerEntry });
        }
    } catch (error) {
        console.log('[RPG Companion] Error loading entries, starting with header only:', error.message);
        await setCurrentCache({ '0': createHeaderEntry() });
    }
    
    await setCacheInitialized();
}

/**
 * Syncs the cache with the actual lorebook file
 * This is called before adding new spells to detect manual deletions
 * @returns {Promise<void>}
 */
async function syncCacheWithLorebook() {
    try {
        console.log('[RPG Companion] Syncing cache with lorebook...');
        
        // Read the lorebook file directly via fetch
        const response = await fetch('/scripts/world-info-data.js?' + Date.now()); // Cache bust
        
        // Try alternative endpoint - fetch the actual JSON file
        let lorebookData = null;
        try {
            const fileResponse = await fetch(`/user/worlds/${await getSpellsLorebookName()}.json?` + Date.now());
            if (fileResponse.ok) {
                lorebookData = await fileResponse.json();
            }
        } catch (e) {
            console.log('[RPG Companion] Could not fetch lorebook file directly:', e.message);
        }
        
        // If we got the data, sync with it
        if (lorebookData && lorebookData.entries) {
            const lorebookEntries = lorebookData.entries;
            const cache = getCurrentCache();
            const cacheCount = Object.keys(cache).length;
            const lorebookCount = Object.keys(lorebookEntries).length;
            
            if (cacheCount !== lorebookCount) {
                console.log(`[RPG Companion] Detected manual changes: cache has ${cacheCount} entries, lorebook has ${lorebookCount} entries`);
                const syncedCache = { ...lorebookEntries };
                await setCurrentCache(syncedCache);
                const chatSpecificKey = `${CACHE_KEY}_${await getSpellsLorebookName()}`;
                localStorage.setItem(chatSpecificKey, JSON.stringify(syncedCache));
                console.log('[RPG Companion] ✅ Cache synced with lorebook file');
            } else {
                console.log('[RPG Companion] Cache and lorebook are in sync');
            }
        } else {
            console.log('[RPG Companion] Could not read lorebook file for sync, keeping cache as-is');
        }
    } catch (error) {
        console.warn('[RPG Companion] Error syncing cache with lorebook:', error.message);
    }
}

/**
 * Gets or creates the "RPG Companion Spells" lorebook
 * @returns {Promise<string|null>} The UID/filename of the Spells lorebook or null if creation failed
 */
export async function getOrCreateSpellsLorebook() {
    try {
        // Check if "RPG Companion Spells" lorebook already exists
        const exists = await checkWorldInfo(await getSpellsLorebookName());
        
        if (exists) {
            console.log('[RPG Companion] Found existing "RPG Companion Spells" lorebook');
            return getSpellsLorebookName();
        }

        // Create new "RPG Companion Spells" lorebook if it doesn't exist
        console.log('[RPG Companion] Creating new "RPG Companion Spells" lorebook');
        await createNewWorldInfo(await getSpellsLorebookName(), true);
        console.log('[RPG Companion] Created "RPG Companion Spells" lorebook');
        return await getSpellsLorebookName();
    } catch (error) {
        console.error('[RPG Companion] Error creating spells lorebook:', error);
        return null;
    }
}

/**
 * Adds a spell entry to the Spells lorebook
 * @param {string} spellName - Name of the spell
 * @param {string} description - Description of the spell
 * @param {string} type - The type of entry: 'Spell', 'Cantrip', or 'Ability'
 * @returns {Promise<boolean>} True if successful
 */
export async function addSpellToLorebook(spellName, description, type = 'Spell') {
    try {
        const lorebookName = await getOrCreateSpellsLorebook();
        if (!lorebookName) {
            console.error('[RPG Companion] Could not get or create Spells lorebook');
            return false;
        }

        // Initialize cache with existing entries if not already done
        await initializeCache();

        // Generate a numeric UID for the new entry
        const cache = await getCurrentCache();
        const existingUids = Object.keys(cache).map(k => Number(k)).filter(n => Number.isFinite(n));
        const newUid = existingUids.length ? Math.max(...existingUids) + 1 : 1;

        // Create lorebook entry with proper SillyTavern format
        const entry = {
            uid: newUid,
            key: [spellName.toLowerCase()], // Store as array
            keysecondary: [],
            comment: `${type}: ${spellName}`,
            content: description,
            constant: false,
            vectorized: false,
            selective: true,
            selectiveLogic: 0,
            addMemo: false,
            order: 100,
            position: 4,
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
            depth: 1,
            outletName: '',
            group: '',
            groupOverride: false,
            groupWeight: 100,
            scanDepth: null,
            caseSensitive: null,
            matchWholeWords: null,
            automation: 'off'
        };

        console.log(`[RPG Companion] Adding spell "${spellName}" to Spells lorebook (uid=${newUid})...`);

        // Add to cache (reuse cache variable from above)
        cache[String(newUid)] = entry;
        await setCurrentCache(cache);

        // Save ALL cached entries to lorebook
        console.log(`[RPG Companion] Saving ${Object.keys(cache).length} total entries to lorebook`);
        await saveWorldInfo(lorebookName, { entries: cache });

        // Persist cache to localStorage for next restart
        const chatSpecificKey = `${CACHE_KEY}_${lorebookName}`;
        localStorage.setItem(chatSpecificKey, JSON.stringify(cache));

        console.log(`[RPG Companion] Successfully added spell "${spellName}" to Spells lorebook`);
        return true;
    } catch (error) {
        console.error('[RPG Companion] Error adding spell to lorebook:', error);
        return false;
    }
}

/**
 * Removes a spell from the lorebook cache by name
 * @param {string} spellName - Name of the spell to remove
 * @returns {Promise<void>}
 */
export async function removeSpellFromLorebook(spellName) {
    try {
        console.log(`[RPG Companion] Removing spell "${spellName}" from lorebook...`);
        
        // Ensure cache is initialized
        await initializeCache();
        
        // Find and remove entry by spell name (check comment field)
        let removed = false;
        const cache = await getCurrentCache();
        for (const [uid, entry] of Object.entries(cache)) {
            if (entry.comment === `Spell: ${spellName}`) {
                delete cache[uid];
                removed = true;
                console.log(`[RPG Companion] Removed spell entry with uid ${uid}`);
                break;
            }
        }
        
        if (removed) {
            await setCurrentCache(cache);
            // Update localStorage
            const chatSpecificKey = `${CACHE_KEY}_${await getSpellsLorebookName()}`;
            localStorage.setItem(chatSpecificKey, JSON.stringify(cache));
            
            // Update lorebook file
            const lorebookName = await getOrCreateSpellsLorebook();
            if (lorebookName) {
                await saveWorldInfo(lorebookName, { entries: cache });
                console.log(`[RPG Companion] ✅ Spell "${spellName}" removed from lorebook`);
            }
        } else {
            console.log(`[RPG Companion] Spell "${spellName}" not found in lorebook cache`);
        }
    } catch (error) {
        console.error('[RPG Companion] Error removing spell from lorebook:', error);
    }
}

export default {
    getOrCreateSpellsLorebook,
    addSpellToLorebook,
    removeSpellFromLorebook
};
