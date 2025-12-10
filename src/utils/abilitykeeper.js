/**
 * Abilitykeeper Utility Module
 * Handles creation and management of lorebook entries for abilities
 */

import { checkWorldInfo, createNewWorldInfo, openWorldInfoEditor, saveWorldInfo } from '../../../../../../scripts/world-info.js';
import { getContext } from '../../../../../../scripts/extensions.js';
import { characters, this_chid } from '../../../../../../script.js';
import { selected_group } from '../../../../../../scripts/group-chats.js';

const ABILITIES_LOREBOOK_BASE_NAME = 'RPG Companion Abilities';
const CACHE_KEY = 'rpg_companion_ability_entries_cache';

/**
 * Gets the lorebook name for the current chat
 * @returns {string} Chat-specific lorebook name
 */
function getAbilitiesLorebookName() {
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
    
    const lorebookName = `${ABILITIES_LOREBOOK_BASE_NAME} - ${chatName}`;
    console.log('[RPG Companion] Abilities lorebook name:', lorebookName, '(groupId:', context.groupId, 'characterId:', context.characterId, ')');
    return lorebookName;
}

// In-memory cache of all ability entries to prevent overwrites
// Now keyed by lorebook name to support multiple chats
let abilityEntriesCache = {};
let cacheInitialized = {};

/**
 * Gets the cache for the current lorebook
 */
function getCurrentCache() {
    const lorebookName = getAbilitiesLorebookName();
    if (!abilityEntriesCache[lorebookName]) {
        abilityEntriesCache[lorebookName] = {};
    }
    return abilityEntriesCache[lorebookName];
}

/**
 * Sets the cache for the current lorebook
 */
function setCurrentCache(entries) {
    const lorebookName = getAbilitiesLorebookName();
    abilityEntriesCache[lorebookName] = entries;
}

/**
 * Checks if current lorebook cache is initialized
 */
function isCacheInitialized() {
    const lorebookName = getAbilitiesLorebookName();
    return cacheInitialized[lorebookName] || false;
}

/**
 * Marks current lorebook cache as initialized
 */
function setCacheInitialized() {
    const lorebookName = getAbilitiesLorebookName();
    cacheInitialized[lorebookName] = true;
}

/**
 * Creates the constant header entry for the abilities lorebook
 * @returns {Object} The header entry object
 */
function createHeaderEntry() {
    return {
        uid: 0,
        key: [],  // No activation keywords
        keysecondary: [],
        comment: 'Header: RPG Companion Abilities',
        content: `# RPG Companion Abilities

This lorebook contains abilities from your RPG Companion Abilities.

**How it works:**
1. Open the Abilities tracker in RPG Companion
2. Add an ability with a name and description
3. The ability is automatically added here as a lorebook entry
4. When the ability name is mentioned in chat, this entry will activate

**Managing abilities:**
- Remove abilities from the Abilities UI to remove them from this lorebook
- Use "Clear Abilities Cache" in Edit Trackers > Abilities if old entries persist

This entry always stays at the top and explains the abilities system.`,
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
 * Loads existing ability entries from the lorebook into cache
 * Uses localStorage to persist the cache across SillyTavern restarts
 * @returns {Promise<void>}
 */
async function initializeCache() {
    if (isCacheInitialized()) return;
    
    try {
        console.log('[RPG Companion] Initializing ability entries cache...');
        
        // Get the lorebook name for this chat
        const lorebookName = getAbilitiesLorebookName();
        
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
                console.log(`[RPG Companion] ✅ Loaded ${Object.keys(parsedCache).length} ability entries from localStorage cache`);
                await setCacheInitialized();
                return;
            } catch (e) {
                console.warn('[RPG Companion] Failed to parse localStorage cache, will try lorebook:', e);
            }
        }
        
        // If no localStorage cache, try to load from the lorebook file
        const exists = await checkWorldInfo(lorebookName);
        if (!exists) {
            console.log('[RPG Companion] Abilities lorebook does not exist yet, starting with header only');
            await setCurrentCache({ '0': headerEntry });
            await setCacheInitialized();
            return;
        }
        
        console.log('[RPG Companion] Abilities lorebook exists, attempting to load entries...');
        
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
 * This is called before adding new abilities to detect manual deletions
 * @returns {Promise<void>}
 */
async function syncCacheWithLorebook() {
    try {
        console.log('[RPG Companion] Syncing cache with lorebook...');
        
        // Try alternative endpoint - fetch the actual JSON file
        let lorebookData = null;
        try {
            const fileResponse = await fetch(`/user/worlds/${getAbilitiesLorebookName()}.json?` + Date.now());
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
                const chatSpecificKey = `${CACHE_KEY}_${await getAbilitiesLorebookName()}`;
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
 * Gets or creates the "RPG Companion Abilities" lorebook
 * @returns {Promise<string|null>} The UID/filename of the Abilities lorebook or null if creation failed
 */
export async function getOrCreateAbilitiesLorebook() {
    try {
        // Check if "RPG Companion Abilities" lorebook already exists
        const exists = await checkWorldInfo(getAbilitiesLorebookName());
        
        if (exists) {
            console.log('[RPG Companion] Found existing "RPG Companion Abilities" lorebook');
            return getAbilitiesLorebookName();
        }

        // Create new "RPG Companion Abilities" lorebook if it doesn't exist
        console.log('[RPG Companion] Creating new "RPG Companion Abilities" lorebook');
        await createNewWorldInfo(getAbilitiesLorebookName(), true);
        console.log('[RPG Companion] Created "RPG Companion Abilities" lorebook');
        return getAbilitiesLorebookName();
    } catch (error) {
        console.error('[RPG Companion] Error creating abilities lorebook:', error);
        return null;
    }
}

/**
 * Adds an ability entry to the Abilities lorebook
 * @param {string} abilityName - Name of the ability
 * @param {string} description - Description of the ability
 * @returns {Promise<boolean>} True if successful
 */
export async function addAbilityToLorebook(abilityName, description) {
    try {
        const lorebookName = await getOrCreateAbilitiesLorebook();
        if (!lorebookName) {
            console.error('[RPG Companion] Could not get or create Abilities lorebook');
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
            key: [abilityName.toLowerCase()], // Store as array
            keysecondary: [],
            comment: `Ability: ${abilityName}`,
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

        console.log(`[RPG Companion] Adding ability "${abilityName}" to Abilities lorebook (uid=${newUid})...`);

        // Add to cache (reuse cache variable from above)
        cache[String(newUid)] = entry;
        await setCurrentCache(cache);

        // Save ALL cached entries to lorebook
        console.log(`[RPG Companion] Saving ${Object.keys(cache).length} total entries to lorebook`);
        await saveWorldInfo(lorebookName, { entries: cache });

        // Persist cache to localStorage for next restart
        const chatSpecificKey = `${CACHE_KEY}_${lorebookName}`;
        localStorage.setItem(chatSpecificKey, JSON.stringify(cache));

        console.log(`[RPG Companion] Successfully added ability "${abilityName}" to Abilities lorebook`);
        return true;
    } catch (error) {
        console.error('[RPG Companion] Error adding ability to lorebook:', error);
        return false;
    }
}

/**
 * Removes an ability from the lorebook cache by name
 * @param {string} abilityName - Name of the ability to remove
 * @returns {Promise<void>}
 */
export async function removeAbilityFromLorebook(abilityName) {
    try {
        console.log(`[RPG Companion] Removing ability "${abilityName}" from lorebook...`);
        
        // Ensure cache is initialized
        await initializeCache();
        
        // Find and remove entry by ability name (check comment field)
        let removed = false;
        const cache = await getCurrentCache();
        for (const [uid, entry] of Object.entries(cache)) {
            if (entry.comment === `Ability: ${abilityName}`) {
                delete cache[uid];
                removed = true;
                console.log(`[RPG Companion] Removed ability entry with uid ${uid}`);
                break;
            }
        }
        
        if (removed) {
            await setCurrentCache(cache);
            // Update localStorage
            const chatSpecificKey = `${CACHE_KEY}_${await getAbilitiesLorebookName()}`;
            localStorage.setItem(chatSpecificKey, JSON.stringify(cache));
            
            // Update lorebook file
            const lorebookName = await getOrCreateAbilitiesLorebook();
            if (lorebookName) {
                await saveWorldInfo(lorebookName, { entries: cache });
                console.log(`[RPG Companion] ✅ Ability "${abilityName}" removed from lorebook`);
            }
        } else {
            console.log(`[RPG Companion] Ability "${abilityName}" not found in lorebook cache`);
        }
    } catch (error) {
        console.error('[RPG Companion] Error removing ability from lorebook:', error);
    }
}

export default {
    getOrCreateAbilitiesLorebook,
    addAbilityToLorebook,
    removeAbilityFromLorebook
};
