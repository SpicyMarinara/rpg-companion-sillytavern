/**
 * NPC Sprite Display Module
 *
 * Takes control of ST's existing #expression-holder to cycle through:
 *   [0] Main ST character (if they have sprites)
 *   [1..N] RPG companion NPC characters (with sprites or base avatars)
 *
 * Injects a cycling control bar inside #expression-holder rather than
 * creating a second holder, so it works regardless of #expression-wrapper
 * visibility state (we force-show it when we have content).
 */

import { extensionSettings, lastGeneratedData } from '../../core/state.js';

// ── Session state ─────────────────────────────────────────────────────────────
/** @type {Array<{name: string, demeanor: string, folderName: string, type: 'st'|'npc'}>} */
let presentCharacters = [];
let currentIndex = 0;

const CYCLE_BAR_ID = 'rpg-npc-cycle-bar';

// ── Folder name normalisation ─────────────────────────────────────────────────
/**
 * Converts a character name to the folder name used for sprite storage.
 * Must match the normalisation in avatarGenerator.js generateExpressionsForCharacter.
 */
function toFolderName(characterName) {
    return characterName
        .replace(/[^a-zA-Z0-9 _-]/g, '')
        .trim()
        .replace(/ /g, '_');
}

// ── Expression mapping ────────────────────────────────────────────────────────
const DEMEANOR_MAP = [
    { keywords: ['happy', 'joy', 'cheer', 'excit', 'pleas', 'glad', 'smil', 'laugh', 'delight', 'elat', 'grin'], expression: 'happy' },
    { keywords: ['sad', 'sorrow', 'cry', 'depress', 'unhappy', 'upset', 'grief', 'mourn', 'tearful', 'misera', 'gloom'], expression: 'sad' },
    { keywords: ['angry', 'anger', 'furio', 'rage', 'annoy', 'irritat', 'mad', 'wrath', 'hostile', 'scowl', 'glare'], expression: 'angry' },
    { keywords: ['surpr', 'shock', 'stun', 'astonish', 'amaze', 'startl', 'wide.*eye', 'gape'], expression: 'surprised' },
];

function demeanorToExpression(demeanor) {
    if (!demeanor) return 'neutral';
    const lower = demeanor.toLowerCase();
    for (const { keywords, expression } of DEMEANOR_MAP) {
        if (keywords.some(k => lower.includes(k))) return expression;
    }
    return 'neutral';
}

// ── Sprite fetching ───────────────────────────────────────────────────────────
const spriteCache = {};

async function fetchSprites(folderName) {
    if (spriteCache[folderName]) return spriteCache[folderName];
    try {
        const res = await fetch(`/api/sprites/get?name=${encodeURIComponent(folderName)}`);
        if (!res.ok) return [];
        const sprites = await res.json();
        spriteCache[folderName] = sprites;
        return sprites;
    } catch {
        return [];
    }
}

async function getSpriteUrl(folderName, expression) {
    const sprites = await fetchSprites(folderName);
    if (sprites.length === 0) return null;
    const exact = sprites.find(s => s.label === expression);
    if (exact) return exact.path;
    const neutral = sprites.find(s => s.label === 'neutral');
    if (neutral) return neutral.path;
    return sprites[0].path;
}

async function hasAnySprites(folderName) {
    const sprites = await fetchSprites(folderName);
    return sprites.length > 0;
}

// ── DOM helpers ───────────────────────────────────────────────────────────────

/**
 * Ensures the cycling control bar exists inside #expression-holder.
 * Returns false if #expression-holder isn't in the DOM yet.
 */
function ensureCycleBar() {
    if ($(`#${CYCLE_BAR_ID}`).length > 0) return true;

    const $holder = $('#expression-holder');
    if ($holder.length === 0) return false;

    // Make holder a positioning context so our bar can sit at the bottom
    if ($holder.css('position') === 'static') {
        $holder.css('position', 'relative');
    }

    const $bar = $(`
        <div id="${CYCLE_BAR_ID}" class="rpg-npc-cycle-bar" style="display:none;">
            <button class="rpg-npc-btn rpg-npc-prev" title="Previous character">&#8249;</button>
            <span class="rpg-npc-name-label"></span>
            <button class="rpg-npc-btn rpg-npc-next" title="Next character">&#8250;</button>
        </div>
    `);

    $bar.find('.rpg-npc-prev').on('click', (e) => { e.stopPropagation(); cycleNPC(-1); });
    $bar.find('.rpg-npc-next').on('click', (e) => { e.stopPropagation(); cycleNPC(1); });

    $holder.append($bar);
    return true;
}

// ── Display logic ─────────────────────────────────────────────────────────────

async function showCurrentCharacter() {
    const $bar = $(`#${CYCLE_BAR_ID}`);

    if (presentCharacters.length === 0) {
        $bar.hide();
        return;
    }

    const char = presentCharacters[currentIndex];
    const expression = demeanorToExpression(char.demeanor);

    let imgUrl = await getSpriteUrl(char.folderName, expression);

    // For NPCs, fall back to base portrait if no expression sprites exist
    if (!imgUrl && char.type === 'npc') {
        imgUrl = extensionSettings.npcAvatars?.[char.name] || null;
    }

    if (!imgUrl) {
        // No image for this character — skip to next that has one
        const fallbackIdx = presentCharacters.findIndex(async (c, i) => {
            if (i === currentIndex) return false;
            const url = await getSpriteUrl(c.folderName, demeanorToExpression(c.demeanor))
                || (c.type === 'npc' ? extensionSettings.npcAvatars?.[c.name] : null);
            return !!url;
        });
        if (fallbackIdx >= 0) {
            currentIndex = fallbackIdx;
            await showCurrentCharacter();
        } else {
            $bar.hide();
        }
        return;
    }

    // Force ST's expression area to show our image
    $('#expression-wrapper').show();
    $('#expression-holder').show();
    $('#expression-image').attr('src', imgUrl).show();

    // Update bar
    $bar.find('.rpg-npc-name-label').text(char.name);
    const multi = presentCharacters.length > 1;
    $bar.find('.rpg-npc-prev, .rpg-npc-next').toggle(multi);
    $bar.show();
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Cycles to the previous (-1) or next (+1) character.
 */
export function cycleNPC(direction) {
    if (presentCharacters.length <= 1) return;
    currentIndex = (currentIndex + direction + presentCharacters.length) % presentCharacters.length;
    showCurrentCharacter();
}

/**
 * Rebuilds the character list and refreshes the display.
 * Called after each tracker update (and after avatar generation).
 */
export async function updateNPCSpriteDisplay() {
    if (!extensionSettings.showNPCSprites) {
        $(`#${CYCLE_BAR_ID}`).hide();
        return;
    }

    if (!ensureCycleBar()) return;

    const entries = [];

    // ── 1. Main ST character ──────────────────────────────────────────────────
    try {
        const context = SillyTavern.getContext();
        if (context && context.characters && context.characterId != null) {
            const stChar = context.characters[context.characterId];
            if (stChar?.name) {
                const folderName = toFolderName(stChar.name);
                if (folderName && await hasAnySprites(folderName)) {
                    // Attempt to read ST's current expression label from the tracker or image src
                    let demeanor = '';
                    const currentSrc = $('#expression-image').attr('src') || '';
                    const srcMatch = currentSrc.match(/\/([^/]+)\.[^.]+$/);
                    if (srcMatch) demeanor = srcMatch[1]; // e.g. "neutral", "happy"
                    entries.push({ name: stChar.name, demeanor, folderName, type: 'st' });
                }
            }
        }
    } catch (err) {
        // SillyTavern.getContext() not available yet — skip
    }

    // ── 2. RPG Companion NPC characters ──────────────────────────────────────
    const characterThoughts = lastGeneratedData.characterThoughts;
    if (characterThoughts) {
        let characters = [];
        try {
            const parsed = typeof characterThoughts === 'string'
                ? JSON.parse(characterThoughts)
                : characterThoughts;
            characters = Array.isArray(parsed) ? parsed : (parsed.characters || []);
        } catch {
            // malformed tracker data
        }

        for (const char of characters) {
            if (!char.name) continue;
            const folderName = toFolderName(char.name);
            const hasSprites = folderName ? await hasAnySprites(folderName) : false;
            const hasAvatar = !!(extensionSettings.npcAvatars?.[char.name]);
            if (hasSprites || hasAvatar) {
                entries.push({
                    name: char.name,
                    demeanor: char.demeanor || '',
                    folderName,
                    type: 'npc',
                });
            }
        }
    }

    // ── 3. Active party companions ────────────────────────────────────────────
    const partyMembers = extensionSettings.partyMembers || [];
    for (const member of partyMembers) {
        if (member.status === 'dead') continue;
        if (member.location === 'elsewhere') continue;
        if (!member.name) continue;
        // Skip if already in list (e.g. also appears as an NPC in characterThoughts)
        if (entries.some(e => e.name === member.name)) continue;
        const folderName = toFolderName(member.name);
        const hasSprites = folderName ? await hasAnySprites(folderName) : false;
        const hasAvatar = !!(member.avatar || extensionSettings.npcAvatars?.[member.name]);
        if (hasSprites || hasAvatar) {
            entries.push({ name: member.name, demeanor: '', folderName, type: 'npc' });
        }
    }

    if (entries.length === 0) {
        $(`#${CYCLE_BAR_ID}`).hide();
        return;
    }

    // Preserve current selection across updates
    const previousName = presentCharacters[currentIndex]?.name;
    presentCharacters = entries;
    const sameIdx = presentCharacters.findIndex(c => c.name === previousName);
    currentIndex = sameIdx >= 0 ? sameIdx : 0;

    await showCurrentCharacter();
}

/**
 * Clears the sprite cache so updated sprites are fetched on next update.
 */
export function clearSpriteCache() {
    for (const key of Object.keys(spriteCache)) delete spriteCache[key];
}

/**
 * Initialises the module — safe to call multiple times.
 * Retries until #expression-holder is present, then populates the display
 * if there is already cached tracker data (e.g. after a page reload).
 */
export function initNPCSpriteDisplay() {
    let attempts = 0;
    const MAX_ATTEMPTS = 30; // ~15 s at 500 ms intervals

    function tryInit() {
        if (ensureCycleBar()) {
            // Bar injected — trigger display update in case tracker data already exists
            updateNPCSpriteDisplay();
            return;
        }
        attempts++;
        if (attempts < MAX_ATTEMPTS) {
            setTimeout(tryInit, 500);
        }
    }

    $(document).ready(() => tryInit());
}
