/**
 * Party Manager Module
 * Handles CRUD operations for persistent party companions,
 * applies AI-parsed party state updates, and manages the editor modal.
 */

import { extensionSettings, lastGeneratedData, committedTrackerData } from '../../core/state.js';
import { saveChatData } from '../../core/persistence.js';
import { regenerateAvatar } from './avatarGenerator.js';

// Lazy import to avoid circular dependency (party.js imports partyManager.js)
let _renderParty = null;
export function setRenderPartyFn(fn) {
    _renderParty = fn;
}

/**
 * Generates a UUID v4 for party member IDs.
 * @returns {string}
 */
export function generatePartyMemberId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback
    return 'pm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
}

/**
 * Normalises a name for fuzzy matching (lowercase, strip punctuation).
 * @param {string} name
 * @returns {string}
 */
function normaliseName(name) {
    return (name || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
}

/**
 * Fuzzy name matching — same logic as thoughts.js namesMatch().
 * Handles "Lyra" matching "Lyra Swiftwind" or "Lady Lyra".
 * @param {string} memberName - Party member name from extensionSettings
 * @param {string} aiName - Name from AI response
 * @returns {boolean}
 */
function namesMatch(memberName, aiName) {
    if (!memberName || !aiName) return false;
    const a = normaliseName(memberName);
    const b = normaliseName(aiName);
    if (a === b) return true;
    // One contains the other as a whole word
    const wordBoundary = (haystack, needle) => {
        const re = new RegExp(`(?:^|\\s)${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s|$)`);
        return re.test(haystack);
    };
    if (wordBoundary(b, a)) return true;
    if (wordBoundary(a, b)) return true;
    return false;
}

/**
 * Applies AI-parsed party state to extensionSettings.partyMembers.
 * Called from apiClient.js and sillytavern.js after parsing.
 * @param {string} partyJsonString - JSON string of party array from AI response
 */
export function applyParsedPartyState(partyJsonString) {
    if (!partyJsonString) return;
    try {
        const parsed = JSON.parse(partyJsonString);
        const arr = Array.isArray(parsed) ? parsed : (parsed.party || []);
        if (!Array.isArray(arr)) return;

        for (const update of arr) {
            const member = (extensionSettings.partyMembers || []).find(m => namesMatch(m.name, update.name));
            if (!member) continue;

            if (update.hp !== undefined) {
                if (!member.hp) member.hp = { current: 100, max: 100 };
                member.hp.current = Math.max(0, Math.min(member.hp.max, Number(update.hp) || 0));
            }
            if (update.mp !== undefined) {
                if (!member.mp) member.mp = { current: 50, max: 50 };
                member.mp.current = Math.max(0, Math.min(member.mp.max, Number(update.mp) || 0));
            }
            if (update.conditions !== undefined) member.conditions = update.conditions;
            if (update.appearance !== undefined) member.appearance = update.appearance;
            if (update.clothing !== undefined) member.clothing = update.clothing;
            if (update.action !== undefined) member._lastAction = update.action;

            // Auto-detect death
            if (member.hp && member.hp.current <= 0 && member.status !== 'dead') {
                member.status = 'dead';
            }
        }

        saveChatData();
    } catch (e) {
        console.warn('[RPG Companion] Failed to apply party state:', e);
    }
}

/**
 * Opens the party member editor modal.
 * @param {string|null} memberId - ID of existing member to edit, or null to create
 */
export function openPartyMemberEditor(memberId = null) {
    const popup = document.getElementById('rpg-party-editor-popup');
    if (!popup) return;

    const member = memberId
        ? (extensionSettings.partyMembers || []).find(m => m.id === memberId)
        : null;

    // Set title
    const titleEl = document.getElementById('rpg-party-editor-title-text');
    if (titleEl) titleEl.textContent = member ? 'Edit Companion' : 'Add Companion';

    // Store current member ID
    popup.dataset.memberId = memberId || '';

    // Populate fields
    const set = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val ?? '';
    };

    set('rpg-party-editor-emoji', member?.emoji || '🧙');
    set('rpg-party-editor-name', member?.name || '');
    set('rpg-party-editor-class', member?.class || '');
    set('rpg-party-editor-appearance', member?.appearance || '');
    set('rpg-party-editor-clothing', member?.clothing || '');
    set('rpg-party-editor-personality', member?.personality || '');
    set('rpg-party-editor-backstory', member?.backstory || '');
    set('rpg-party-editor-relationship', member?.relationship || '');
    set('rpg-party-editor-hp-current', member?.hp?.current ?? 100);
    set('rpg-party-editor-hp-max', member?.hp?.max ?? 100);
    set('rpg-party-editor-mp-current', member?.mp?.current ?? 50);
    set('rpg-party-editor-mp-max', member?.mp?.max ?? 50);
    set('rpg-party-editor-conditions', member?.conditions || 'None');
    set('rpg-party-editor-status', member?.status || 'active');
    set('rpg-party-editor-location', member?.location || 'party');
    set('rpg-party-editor-skills', Array.isArray(member?.skills) ? member.skills.join(', ') : (member?.skills || ''));
    set('rpg-party-editor-inventory', Array.isArray(member?.inventory) ? member.inventory.join(', ') : (member?.inventory || ''));

    popup.classList.add('is-open');
    popup.style.display = 'flex';
}

/**
 * Reads form data from the editor modal and saves the party member.
 * @param {string|null} memberId - null = create new
 */
export function savePartyMember(memberId) {
    const get = (id) => {
        const el = document.getElementById(id);
        return el ? el.value.trim() : '';
    };

    const name = get('rpg-party-editor-name');
    if (!name) {
        alert('Companion name is required.');
        return;
    }

    const formData = {
        emoji: get('rpg-party-editor-emoji') || '🧙',
        name,
        class: get('rpg-party-editor-class'),
        appearance: get('rpg-party-editor-appearance'),
        clothing: get('rpg-party-editor-clothing'),
        personality: get('rpg-party-editor-personality'),
        backstory: get('rpg-party-editor-backstory'),
        relationship: get('rpg-party-editor-relationship'),
        hp: {
            current: Math.max(0, parseInt(get('rpg-party-editor-hp-current')) || 100),
            max: Math.max(1, parseInt(get('rpg-party-editor-hp-max')) || 100)
        },
        mp: {
            current: Math.max(0, parseInt(get('rpg-party-editor-mp-current')) || 50),
            max: Math.max(1, parseInt(get('rpg-party-editor-mp-max')) || 50)
        },
        conditions: get('rpg-party-editor-conditions') || 'None',
        status: get('rpg-party-editor-status') || 'active',
        location: get('rpg-party-editor-location') || 'party',
        skills: get('rpg-party-editor-skills').split(',').map(s => s.trim()).filter(Boolean),
        inventory: get('rpg-party-editor-inventory').split(',').map(s => s.trim()).filter(Boolean)
    };

    // Clamp current to max
    formData.hp.current = Math.min(formData.hp.current, formData.hp.max);
    formData.mp.current = Math.min(formData.mp.current, formData.mp.max);

    if (!extensionSettings.partyMembers) extensionSettings.partyMembers = [];

    if (memberId) {
        const idx = extensionSettings.partyMembers.findIndex(m => m.id === memberId);
        if (idx !== -1) {
            extensionSettings.partyMembers[idx] = {
                ...extensionSettings.partyMembers[idx],
                ...formData
            };
        }
    } else {
        extensionSettings.partyMembers.push({
            id: generatePartyMemberId(),
            avatar: null,
            _lastAction: '',
            ...formData
        });
    }

    saveChatData();
    closePartyMemberEditor();

    if (_renderParty) _renderParty();
}

/**
 * Removes a party member by ID.
 * @param {string} memberId
 */
export function removePartyMember(memberId) {
    if (!extensionSettings.partyMembers) return;
    extensionSettings.partyMembers = extensionSettings.partyMembers.filter(m => m.id !== memberId);
    saveChatData();
    if (_renderParty) _renderParty();
}

/**
 * Closes the party editor modal.
 */
export function closePartyMemberEditor() {
    const popup = document.getElementById('rpg-party-editor-popup');
    if (!popup) return;
    popup.classList.remove('is-open');
    popup.classList.add('is-closing');
    setTimeout(() => {
        popup.classList.remove('is-closing');
        popup.style.display = 'none';
    }, 200);
}

/**
 * Triggers avatar generation for a party member using the same SD pipeline as NPCs.
 * Stores result in extensionSettings.npcAvatars[member.name] and member.avatar.
 * @param {string} memberId
 * @returns {Promise<string|null>}
 */
export async function generatePartyMemberAvatar(memberId) {
    const member = (extensionSettings.partyMembers || []).find(m => m.id === memberId);
    if (!member) return null;

    try {
        const newUrl = await regenerateAvatar(member.name);
        if (newUrl) {
            member.avatar = newUrl;
            saveChatData();
        }
        return newUrl;
    } catch (e) {
        console.warn('[RPG Companion] Failed to generate party avatar:', e);
        return null;
    }
}

/**
 * Promotes an NPC from the Present Characters tracker to a party companion.
 * Pulls available data (emoji, relationship, avatar) from tracker state.
 * @param {string} charName - The NPC's name
 */
export function promoteNpcToCompanion(charName) {
    if (!charName) return;

    // Avoid duplicates
    if ((extensionSettings.partyMembers || []).some(m => m.name === charName)) {
        return;
    }

    // Try to pull NPC data from tracker JSON
    let npcData = null;
    const thoughtsRaw = lastGeneratedData.characterThoughts || committedTrackerData.characterThoughts;
    if (thoughtsRaw) {
        try {
            const parsed = typeof thoughtsRaw === 'string' ? JSON.parse(thoughtsRaw) : thoughtsRaw;
            const chars = Array.isArray(parsed) ? parsed : (parsed.characters || []);
            npcData = chars.find(c => c && c.name === charName);
        } catch (_) {
            // Ignore parse errors
        }
    }

    const avatar = extensionSettings.npcAvatars?.[charName] || null;
    const relationship = npcData?.Relationship || npcData?.relationship?.status || npcData?.relationship || '';

    // Pull fields from npcData — check top-level and inside npcData.details
    const details = npcData?.details || {};
    const pick = (...keys) => {
        for (const k of keys) {
            const v = npcData?.[k] ?? details[k];
            if (v && typeof v === 'string' && v.trim()) return v.trim();
        }
        return '';
    };

    const npcClass = pick('class', 'Class', 'occupation', 'Occupation', 'role', 'Role', 'job', 'Job');
    const npcAppearance = pick('appearance', 'Appearance', 'physicalDescription', 'physical', 'looks', 'Looks', 'description', 'Description');
    const npcClothing = pick('clothing', 'Clothing', 'outfit', 'Outfit', 'attire', 'Attire', 'dress', 'wardrobe', 'Wardrobe');
    const npcPersonality = pick('personality', 'Personality', 'demeanor', 'Demeanor', 'temperament', 'Temperament', 'disposition', 'Disposition');
    const npcBackstory = pick('backstory', 'Backstory', 'background', 'Background', 'history', 'History');

    const member = {
        id: generatePartyMemberId(),
        avatar,
        _lastAction: '',
        emoji: npcData?.emoji || '👤',
        name: charName,
        class: npcClass,
        appearance: npcAppearance,
        clothing: npcClothing,
        personality: npcPersonality,
        backstory: npcBackstory,
        relationship,
        hp: { current: 100, max: 100 },
        mp: { current: 50, max: 50 },
        conditions: 'None',
        status: 'active',
        location: 'party',
        skills: [],
        inventory: []
    };

    if (!extensionSettings.partyMembers) extensionSettings.partyMembers = [];
    extensionSettings.partyMembers.push(member);
    saveChatData();
    if (_renderParty) _renderParty();
}

/**
 * Initializes party manager event listeners on the editor modal.
 * Called once during extension initialization.
 */
export function initPartyManager() {
    // Save button
    document.addEventListener('click', (e) => {
        if (e.target.closest('#rpg-party-editor-save')) {
            const popup = document.getElementById('rpg-party-editor-popup');
            const memberId = popup?.dataset.memberId || null;
            savePartyMember(memberId || null);
        }

        if (e.target.closest('#rpg-party-editor-cancel') || e.target.closest('#rpg-party-editor-close')) {
            closePartyMemberEditor();
        }

        // Close on backdrop click
        if (e.target.id === 'rpg-party-editor-popup') {
            closePartyMemberEditor();
        }
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const popup = document.getElementById('rpg-party-editor-popup');
            if (popup && popup.classList.contains('is-open')) {
                closePartyMemberEditor();
            }
        }
    });
}
