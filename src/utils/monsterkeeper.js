/**
 * Monster Keeper Utility Module
 * Handles detection and creation of lorebook entries for D&D monster stat blocks
 */

import { checkWorldInfo, createNewWorldInfo, openWorldInfoEditor, saveWorldInfo } from '../../../../../../scripts/world-info.js';
import { getContext } from '../../../../../../scripts/extensions.js';
import { characters, this_chid } from '../../../../../../script.js';

const MONSTERS_LOREBOOK_BASE_NAME = 'RPG Companion Monsters';

/**
 * Gets the lorebook name for the current chat
 * @returns {string} Chat-specific lorebook name
 */
function getMonstersLorebookName() {
    const context = getContext();
    let chatName = 'Default';
    
    if (context.groupId && context.groups) {
        const group = context.groups.find(g => g.id === context.groupId);
        chatName = group ? group.name : `Group_${context.groupId}`;
    } else if (context.characterId !== undefined && context.characters && context.characters[context.characterId]) {
        chatName = context.characters[context.characterId].name;
    } else if (context.name2) {
        chatName = context.name2;
    }
    
    return `${MONSTERS_LOREBOOK_BASE_NAME} - ${chatName}`;
}

const CACHE_KEY = 'rpg_companion_monster_entries_cache';

// In-memory cache of all monster entries
let monsterEntriesCache = {};
let cacheInitialized = {};

function getCurrentCache() {
    const lorebookName = getMonstersLorebookName();
    if (!monsterEntriesCache[lorebookName]) {
        monsterEntriesCache[lorebookName] = {};
    }
    return monsterEntriesCache[lorebookName];
}

function setCurrentCache(entries) {
    const lorebookName = getMonstersLorebookName();
    monsterEntriesCache[lorebookName] = entries;
}

function isCacheInitialized() {
    const lorebookName = getMonstersLorebookName();
    return !!cacheInitialized[lorebookName];
}

function setCacheInitialized() {
    const lorebookName = getMonstersLorebookName();
    cacheInitialized[lorebookName] = true;
}

/**
 * Creates the constant header entry for the monsters lorebook
 * @returns {Object} The header entry object
 */
function createHeaderEntry() {
    return {
        uid: 0,
        key: [],
        keysecondary: [],
        comment: 'Header: RPG Companion Monsters',
        content: `# RPG Companion Monster Stat Blocks

This lorebook contains D&D monster stat blocks auto-detected from your DM's messages.

**How it works:**
1. When the DM generates a [MONSTER_CARD]...[/MONSTER_CARD] block
2. The monster is automatically added here as a lorebook entry
3. Future mentions of the monster name will inject these stats into context
4. The AI will have access to the creature's full stat block

**Managing monsters:**
- Monsters are automatically detected and added
- Edit or remove entries manually if needed
- Use World Info settings to adjust priority or keywords

This entry always stays at the top and explains the monster system.`,
        constant: false,
        vectorized: false,
        selective: false,
        selectiveLogic: 0,
        addMemo: false,
        order: 0,
        position: 0,
        disable: true,
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
 * Initializes the cache with existing monster entries from lorebook
 * @returns {Promise<void>}
 */
async function initializeCache() {
    if (isCacheInitialized()) return;
    
    try {
        console.log('[RPG Companion] Initializing monster entries cache...');
        
        const lorebookName = getMonstersLorebookName();
        const headerEntry = createHeaderEntry();
        
        // Try to load from localStorage
        const chatSpecificKey = `${CACHE_KEY}_${lorebookName}`;
        const cachedData = localStorage.getItem(chatSpecificKey);
        if (cachedData) {
            try {
                const parsedCache = JSON.parse(cachedData);
                parsedCache['0'] = headerEntry;
                setCurrentCache(parsedCache);
                console.log(`[RPG Companion] ✅ Loaded ${Object.keys(parsedCache).length} monster entries from cache`);
                setCacheInitialized();
                return;
            } catch (e) {
                console.warn('[RPG Companion] Failed to parse monster cache:', e);
            }
        }
        
        // Create new cache with just header
        const newCache = { '0': headerEntry };
        setCurrentCache(newCache);
        localStorage.setItem(chatSpecificKey, JSON.stringify(newCache));
        console.log('[RPG Companion] Created new monster cache');
        setCacheInitialized();
    } catch (error) {
        console.error('[RPG Companion] Error initializing monster cache:', error);
    }
}

/**
 * Gets or creates the "RPG Companion Monsters" lorebook
 * @returns {Promise<string|null>} The name of the Monsters lorebook or null if creation failed
 */
export async function getOrCreateMonstersLorebook() {
    try {
        const exists = await checkWorldInfo(getMonstersLorebookName());
        
        if (exists) {
            console.log('[RPG Companion] Found existing "RPG Companion Monsters" lorebook');
            return getMonstersLorebookName();
        }

        console.log('[RPG Companion] Creating new "RPG Companion Monsters" lorebook');
        await createNewWorldInfo(getMonstersLorebookName(), true);
        console.log('[RPG Companion] Created "RPG Companion Monsters" lorebook');
        return getMonstersLorebookName();
    } catch (error) {
        console.error('[RPG Companion] Error creating monsters lorebook:', error);
        return null;
    }
}

/**
 * Extracts monster cards from text using [MONSTER_CARD]...[/MONSTER_CARD] tags
 * @param {string} text - Text to search for monster cards
 * @returns {Array<{name: string, content: string}>} Array of extracted monsters
 */
export function extractMonsterCards(text) {
    const monsters = [];
    const regex = /\[MONSTER_CARD\](.*?)\[\/MONSTER_CARD\]/gis;
    let match;
    
    while ((match = regex.exec(text)) !== null) {
        const cardContent = match[1].trim();
        
        // Extract name from "Name:" field
        const nameMatch = cardContent.match(/Name:\s*([^\n]+)/i);
        if (nameMatch) {
            const name = nameMatch[1].trim();
            monsters.push({
                name: name,
                content: cardContent
            });
            console.log(`[RPG Companion] Detected monster: "${name}"`);
        }
    }
    
    return monsters;
}

/**
 * Checks if a monster already exists in the lorebook by name
 * @param {string} monsterName - Name of the monster to check
 * @returns {Promise<boolean>} True if monster exists
 */
export async function monsterExists(monsterName) {
    await initializeCache();
    const cache = getCurrentCache();
    const lowerName = monsterName.toLowerCase();
    
    for (const entry of Object.values(cache)) {
        if (entry.key && Array.isArray(entry.key)) {
            if (entry.key.some(k => k.toLowerCase() === lowerName)) {
                return true;
            }
        }
    }
    
    return false;
}

/**
 * Adds a monster entry to the Monsters lorebook
 * @param {string} monsterName - Name of the monster
 * @param {string} statBlock - Full stat block content
 * @returns {Promise<boolean>} True if successful
 */
export async function addMonsterToLorebook(monsterName, statBlock) {
    try {
        const lorebookName = await getOrCreateMonstersLorebook();
        if (!lorebookName) {
            console.error('[RPG Companion] Could not get or create Monsters lorebook');
            return false;
        }

        // Initialize cache
        await initializeCache();

        // Check for duplicates
        const exists = await monsterExists(monsterName);
        if (exists) {
            console.warn(`[RPG Companion] Monster "${monsterName}" already exists in lorebook`);
            return false;
        }

        // Generate new UID
        const cache = getCurrentCache();
        const existingUids = Object.keys(cache).map(k => Number(k)).filter(n => Number.isFinite(n));
        const newUid = existingUids.length ? Math.max(...existingUids) + 1 : 1;

        // Create lorebook entry
        const entry = {
            uid: newUid,
            key: [monsterName.toLowerCase()],
            keysecondary: [],
            comment: `Monster: ${monsterName}`,
            content: statBlock,
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
            caseSensitive: false,
            matchWholeWords: null,
            automation: 'off'
        };

        console.log(`[RPG Companion] Adding monster "${monsterName}" to Monsters lorebook (uid=${newUid})...`);

        // Add to cache
        cache[String(newUid)] = entry;
        setCurrentCache(cache);

        // Save to lorebook
        console.log(`[RPG Companion] Saving ${Object.keys(cache).length} total entries to monsters lorebook`);
        await saveWorldInfo(lorebookName, { entries: cache });

        // Persist to localStorage
        const chatSpecificKey = `${CACHE_KEY}_${lorebookName}`;
        localStorage.setItem(chatSpecificKey, JSON.stringify(cache));

        console.log(`[RPG Companion] ✅ Successfully added monster "${monsterName}" to Monsters lorebook (priority: 200)`);
        return true;
    } catch (error) {
        console.error('[RPG Companion] Error adding monster to lorebook:', error);
        return false;
    }
}

/**
 * Removes a monster from the lorebook by name
 * @param {string} monsterName - Name of the monster to remove
 * @returns {Promise<boolean>} True if successful
 */
export async function removeMonsterFromLorebook(monsterName) {
    try {
        console.log(`[RPG Companion] Removing monster "${monsterName}" from lorebook...`);
        
        await initializeCache();
        
        let removed = false;
        const cache = getCurrentCache();
        for (const [uid, entry] of Object.entries(cache)) {
            if (entry.comment === `Monster: ${monsterName}`) {
                delete cache[uid];
                removed = true;
                console.log(`[RPG Companion] Removed monster entry with uid ${uid}`);
                break;
            }
        }
        
        if (removed) {
            setCurrentCache(cache);
            const chatSpecificKey = `${CACHE_KEY}_${getMonstersLorebookName()}`;
            localStorage.setItem(chatSpecificKey, JSON.stringify(cache));
            
            const lorebookName = await getOrCreateMonstersLorebook();
            if (lorebookName) {
                await saveWorldInfo(lorebookName, { entries: cache });
                console.log(`[RPG Companion] ✅ Monster "${monsterName}" removed from lorebook`);
            }
            return true;
        } else {
            console.log(`[RPG Companion] Monster "${monsterName}" not found in lorebook`);
            return false;
        }
    } catch (error) {
        console.error('[RPG Companion] Error removing monster from lorebook:', error);
        return false;
    }
}

export default {
    extractMonsterCards,
    getOrCreateMonstersLorebook,
    addMonsterToLorebook,
    removeMonsterFromLorebook,
    monsterExists
};
