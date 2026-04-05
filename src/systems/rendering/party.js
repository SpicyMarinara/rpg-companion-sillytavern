/**
 * Party Rendering Module
 * Renders the party companion cards in the party panel.
 */

import { extensionSettings, $partyContainer, FALLBACK_AVATAR_DATA_URI } from '../../core/state.js';

/**
 * Opens a fullscreen lightbox for a party member avatar.
 * @param {string} src
 * @param {string} name
 */
function openAvatarLightbox(src, name) {
    $('#rpg-avatar-lightbox').remove();
    const escapedName = (name || '').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    const $lb = $(`
        <div id="rpg-avatar-lightbox">
            <div class="rpg-avatar-lightbox-backdrop"></div>
            <div class="rpg-avatar-lightbox-content">
                <button class="rpg-avatar-lightbox-close" type="button" title="Close">×</button>
                <img src="${src}" alt="${escapedName}" />
                <div class="rpg-avatar-lightbox-name">${escapedName}</div>
            </div>
        </div>
    `);
    $('body').append($lb);
    $lb.find('.rpg-avatar-lightbox-backdrop, .rpg-avatar-lightbox-close').on('click', function () {
        $lb.remove();
    });
    $(document).one('keydown.rpg-lightbox', function (e) {
        if (e.key === 'Escape') $lb.remove();
    });
}
import { saveChatData } from '../../core/persistence.js';
import {
    openPartyMemberEditor,
    removePartyMember,
    generatePartyMemberAvatar,
    setRenderPartyFn
} from '../features/partyManager.js';

// Register self as the render function in partyManager (avoids circular import)
setRenderPartyFn(renderParty);

/**
 * Resolves the avatar URL for a party member.
 * Priority: member.avatar → npcAvatars[name] → FALLBACK
 * @param {Object} member
 * @returns {string} Image URL
 */
function resolveAvatar(member) {
    // Party-specific override
    if (member.avatar && typeof member.avatar === 'string' && member.avatar.length > 0) {
        return member.avatar;
    }
    // Shared npcAvatars namespace (used by avatarGenerator)
    if (extensionSettings.npcAvatars?.[member.name]) {
        const url = extensionSettings.npcAvatars[member.name];
        if (typeof url === 'string' && url.length > 0) return url;
    }
    return FALLBACK_AVATAR_DATA_URI;
}

/**
 * Renders stat bars for HP and MP.
 * @param {Object} member
 * @returns {string} HTML string
 */
function renderStatBars(member) {
    const hpMax = Math.max(1, member.hp?.max ?? 100);
    const hpCurrent = Math.max(0, member.hp?.current ?? hpMax);
    const mpMax = Math.max(1, member.mp?.max ?? 50);
    const mpCurrent = Math.max(0, member.mp?.current ?? mpMax);

    const hpPct = Math.min(100, (hpCurrent / hpMax) * 100);
    const mpPct = Math.min(100, (mpCurrent / mpMax) * 100);

    // Fill from right (dark overlay covers the bar from the right)
    const hpFill = 100 - hpPct;
    const mpFill = 100 - mpPct;

    return `
        <div class="rpg-party-stats">
            <div class="rpg-stat-row">
                <span class="rpg-stat-label">HP</span>
                <div class="rpg-stat-bar">
                    <div class="rpg-stat-fill" style="width: ${hpFill}%"></div>
                </div>
                <span class="rpg-stat-value">${hpCurrent}/${hpMax}</span>
            </div>
            <div class="rpg-stat-row">
                <span class="rpg-stat-label">MP</span>
                <div class="rpg-stat-bar">
                    <div class="rpg-stat-fill" style="width: ${mpFill}%"></div>
                </div>
                <span class="rpg-stat-value">${mpCurrent}/${mpMax}</span>
            </div>
        </div>`;
}

/**
 * Renders a single party member card.
 * @param {Object} member
 * @returns {string} HTML string
 */
function renderMemberCard(member) {
    const avatarUrl = resolveAvatar(member);
    const statusClass = `rpg-party-status-${member.status || 'active'}`;
    const statusLabel = member.status || 'active';

    const cardClasses = ['rpg-party-card'];
    if (member.location === 'elsewhere') cardClasses.push('rpg-party-card--elsewhere');
    if (member.status === 'dead') cardClasses.push('rpg-party-card--dead');

    const escapedName = (member.name || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    const escapedEmoji = (member.emoji || '🧙').replace(/</g, '&lt;');
    const escapedClass = (member.class || '').replace(/</g, '&lt;');
    const escapedRelationship = (member.relationship || '').replace(/</g, '&lt;');
    const escapedPersonality = (member.personality || '').replace(/</g, '&lt;');
    const escapedAppearance = (member.appearance || '').replace(/</g, '&lt;');
    const escapedClothing = (member.clothing || '').replace(/</g, '&lt;');
    const conditions = (member.conditions || 'None').replace(/</g, '&lt;');
    const lastAction = (member._lastAction || '').replace(/</g, '&lt;');

    return `
        <div class="${cardClasses.join(' ')}" data-member-id="${member.id}" data-member-name="${escapedName}">
            <div class="rpg-party-card-header">
                <div class="rpg-party-avatar" title="Click to upload portrait" data-member-id="${member.id}">
                    <img src="${avatarUrl}" alt="${escapedName}" />
                    <button class="rpg-avatar-view-full" data-member-id="${member.id}" data-member-name="${escapedName}" type="button" title="View full portrait"><i class="fa-solid fa-expand"></i></button>
                    <div class="rpg-party-status-badge ${statusClass}">${statusLabel}</div>
                </div>
                <div class="rpg-party-card-identity">
                    <span class="rpg-party-emoji">${escapedEmoji}</span>
                    <span class="rpg-party-name">${escapedName}</span>
                    <span class="rpg-party-class">${escapedClass}</span>
                </div>
                <div class="rpg-party-card-controls">
                    <button class="rpg-party-regen-avatar" data-member-id="${member.id}" title="Regenerate portrait">
                        <i class="fa-solid fa-image"></i>
                    </button>
                    <button class="rpg-party-edit-btn" data-member-id="${member.id}" title="Edit companion">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="rpg-party-demote-btn" data-member-id="${member.id}" title="Demote to NPC">
                        <i class="fa-solid fa-user-minus"></i>
                    </button>
                    <button class="rpg-party-remove-btn" data-member-id="${member.id}" title="Remove companion">×</button>
                </div>
            </div>
            ${(escapedRelationship || escapedPersonality) ? `
            <div class="rpg-party-details">
                ${escapedRelationship ? `<span class="rpg-party-relationship">${escapedRelationship}</span>` : ''}
                ${escapedPersonality ? `<span class="rpg-party-personality">${escapedPersonality}</span>` : ''}
            </div>` : ''}
            ${(escapedAppearance || escapedClothing) ? `
            <div class="rpg-party-description">
                ${escapedAppearance ? `<div class="rpg-party-appearance"><span class="rpg-party-desc-label">Looks:</span> ${escapedAppearance}</div>` : ''}
                ${escapedClothing ? `<div class="rpg-party-clothing"><span class="rpg-party-desc-label">Wearing:</span> ${escapedClothing}</div>` : ''}
            </div>` : ''}
            ${renderStatBars(member)}
            <div class="rpg-party-conditions">
                <span class="rpg-party-conditions-label">Conditions:</span>
                <span class="rpg-party-conditions-value">${conditions}</span>
            </div>
            ${lastAction ? `<div class="rpg-party-action"><span class="rpg-party-action-text">${lastAction}</span></div>` : ''}
        </div>`;
}

/**
 * Renders the party panel into $partyContainer.
 * @param {{ preserveScroll?: boolean }} options
 */
export function renderParty({ preserveScroll = false } = {}) {
    if (!$partyContainer || !$partyContainer.length) return;

    const members = extensionSettings.partyMembers || [];

    if (!extensionSettings.showParty) {
        $partyContainer.hide();
        return;
    }
    $partyContainer.show();

    // Save scroll position if needed
    const scrollTop = preserveScroll ? $partyContainer.find('.rpg-party-content').scrollTop() : 0;

    if (members.length === 0) {
        $partyContainer.html(`
            <div class="rpg-section-header">
                <span class="rpg-section-title">Party</span>
            </div>
            <div class="rpg-party-content">
                <div class="rpg-party-empty">No companions yet.</div>
                <button class="rpg-add-party-member-btn" title="Add party companion">
                    <i class="fa-solid fa-plus"></i> Add Companion
                </button>
            </div>`);
    } else {
        const cardsHtml = members.map(renderMemberCard).join('');
        $partyContainer.html(`
            <div class="rpg-section-header">
                <span class="rpg-section-title">Party</span>
            </div>
            <div class="rpg-party-content">
                ${cardsHtml}
                <button class="rpg-add-party-member-btn" title="Add party companion">
                    <i class="fa-solid fa-plus"></i> Add Companion
                </button>
            </div>`);
    }

    if (preserveScroll) {
        $partyContainer.find('.rpg-party-content').scrollTop(scrollTop);
    }

    // Bind events
    bindPartyEvents();
}

/**
 * Binds click/event handlers on party cards.
 * Called after every render.
 */
function bindPartyEvents() {
    if (!$partyContainer || !$partyContainer.length) return;

    // Add companion button
    $partyContainer.find('.rpg-add-party-member-btn').off('click').on('click', () => {
        openPartyMemberEditor(null);
    });

    // Edit button
    $partyContainer.find('.rpg-party-edit-btn').off('click').on('click', function () {
        const memberId = $(this).data('member-id');
        openPartyMemberEditor(memberId);
    });

    // Demote button — removes from party, NPC stays in Present Characters
    $partyContainer.find('.rpg-party-demote-btn').off('click').on('click', function () {
        const memberId = $(this).data('member-id');
        const memberName = $(this).closest('.rpg-party-card').data('member-name');
        if (confirm(`Demote ${memberName || 'this companion'} back to NPC?`)) {
            removePartyMember(memberId);
        }
    });

    // Remove button
    $partyContainer.find('.rpg-party-remove-btn').off('click').on('click', function () {
        const memberId = $(this).data('member-id');
        const memberName = $(this).closest('.rpg-party-card').data('member-name');
        if (confirm(`Remove ${memberName || 'this companion'} from your party?`)) {
            removePartyMember(memberId);
        }
    });

    // Regen avatar button
    $partyContainer.find('.rpg-party-regen-avatar').off('click').on('click', async function () {
        const memberId = $(this).data('member-id');
        const $btn = $(this);
        $btn.prop('disabled', true).html('<i class="fa-solid fa-spinner fa-spin"></i>');
        try {
            const newUrl = await generatePartyMemberAvatar(memberId);
            if (newUrl) {
                const $avatar = $partyContainer.find(`.rpg-party-avatar[data-member-id="${memberId}"] img`);
                $avatar.attr('src', newUrl);
            }
        } finally {
            $btn.prop('disabled', false).html('<i class="fa-solid fa-image"></i>');
        }
    });

    // View full-size avatar
    $partyContainer.find('.rpg-avatar-view-full').off('click').on('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        const src = $(this).siblings('img').attr('src');
        const name = $(this).data('member-name') || '';
        if (src) openAvatarLightbox(src, name);
    });

    // Avatar click — file upload
    $partyContainer.find('.rpg-party-avatar').off('click').on('click', function (e) {
        if ($(e.target).closest('button').length) return; // Ignore if clicking a button inside
        const memberId = $(this).data('member-id');
        const $input = $('<input type="file" accept="image/*" style="display:none">');
        $input.on('change', function () {
            const file = this.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (evt) => {
                const dataUrl = evt.target.result;
                const member = (extensionSettings.partyMembers || []).find(m => m.id === memberId);
                if (member) {
                    member.avatar = dataUrl;
                    // Also update shared npcAvatars namespace
                    if (!extensionSettings.npcAvatars) extensionSettings.npcAvatars = {};
                    extensionSettings.npcAvatars[member.name] = dataUrl;
                    saveChatData();
                    renderParty({ preserveScroll: true });
                }
            };
            reader.readAsDataURL(file);
        });
        $input.trigger('click');
    });
}
