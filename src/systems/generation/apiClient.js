import { executeSlashCommandsOnChatInput } from '../../../../../../../scripts/slash-commands.js';
import {
    extensionSettings,
    lastGeneratedData,
    committedTrackerData,
    isGenerating,
    lastActionWasSwipe,
    setIsGenerating,
    setLastActionWasSwipe
} from '../../core/state.js';
import { chat } from '../../../../../../../script.js';
import { saveChatData } from '../../core/persistence.js';
import { generateSeparateUpdatePrompt } from './promptBuilder.js';
import { parseResponse, parseUserStats } from './parser.js';
import getContext from '../../../../../../st-context.js';

/*
    Purpose:
    When in separate generation mode, build prompt and update RPG
*/

function applyParsedTrackerData(parsedData, { renderUserStats, renderInfoBox, renderThoughts, renderInventory }) {
    const lastMessage = chat && chat.length > 0 ? chat[chat.length - 1] : null;

    if (lastMessage && !lastMessage.is_user) {
        if (!lastMessage.extra) lastMessage.extra = {};
        if (!lastMessage.extra.rpg_companion_swipes) lastMessage.extra.rpg_companion_swipes = {};

        const currentSwipeId = lastMessage.swipe_id || 0;
        lastMessage.extra.rpg_companion_swipes[currentSwipeId] = {
            userStats: parsedData.userStats,
            infoBox: parsedData.infoBox,
            characterThoughts: parsedData.characterThoughts
        };

        // Update lastGeneratedData + commit logic
        if (parsedData.userStats) {
            lastGeneratedData.userStats = parsedData.userStats;
            parseUserStats(parsedData.userStats);
        }
        if (parsedData.infoBox) lastGeneratedData.infoBox = parsedData.infoBox;
        if (parsedData.characterThoughts) lastGeneratedData.characterThoughts = parsedData.characterThoughts;

        const hasNoRealData = !committedTrackerData.userStats && !committedTrackerData.infoBox && !committedTrackerData.characterThoughts;
        const hasOnlyPlaceholderData = (
            (!committedTrackerData.userStats || committedTrackerData.userStats === '') &&
            (!committedTrackerData.infoBox || committedTrackerData.infoBox === 'Info Box\n---\n' || committedTrackerData.infoBox === '') &&
            (!committedTrackerData.characterThoughts || committedTrackerData.characterThoughts === 'Present Characters\n---\n' || committedTrackerData.characterThoughts === '')
        );

        if (hasNoRealData || hasOnlyPlaceholderData) {
            committedTrackerData.userStats = parsedData.userStats;
            committedTrackerData.infoBox = parsedData.infoBox;
            committedTrackerData.characterThoughts = parsedData.characterThoughts;
        }
    } else {
        // No assistant message to attach to — just update display
        if (parsedData.userStats) parseUserStats(parsedData.userStats);
    }

    // Render updated UI
    renderUserStats();
    renderInfoBox();
    renderThoughts();
    renderInventory();

    // Persist metadata
    saveChatData();
}


/**
 * Updates RPG tracker data using separate API call (separate mode only).
 * Makes a dedicated API call to generate tracker data, then stores it
 * in the last assistant message's swipe data.
 *
 * @param {Function} renderUserStats - UI function to render user stats
 * @param {Function} renderInfoBox - UI function to render info box
 * @param {Function} renderThoughts - UI function to render character thoughts
 * @param {Function} renderInventory - UI function to render inventory
 */

export async function updateRPGData(renderUserStats, renderInfoBox, renderThoughts, renderInventory) {
    if (isGenerating) return;
    if (!extensionSettings.enabled) return;
    if (extensionSettings.generationMode !== 'separate') return;

    const RPGUpdatingProfileName = extensionSettings.connectionProfileName;

    const context = getContext();
    const profiles = context?.extensionSettings?.connectionManager?.profiles ?? [];

    // Try to resolve the configured RPGUpdatingProfileName to a profile object.
    // RPGUpdatingProfileName can be either an id or a display name.
    const matchedProfile = profiles.find((p) => p.id === RPGUpdatingProfileName || p.name === RPGUpdatingProfileName);

    if (!matchedProfile) {
        console.warn('[RPG Companion] Requested connection profile does not exist or is invalid, skipping manual update.');
        console.log(JSON.stringify(profiles));
        console.log(RPGUpdatingProfileName)
        return;
    }
    const profileIdToUse = matchedProfile.id;



    const $updateBtn = $('#rpg-manual-update');

    try {
        setIsGenerating(true);
        $updateBtn.html('<i class="fa-solid fa-spinner fa-spin"></i> Updating...').prop('disabled', true);

        const prompt = generateSeparateUpdatePrompt();
        const response = await getContext().ConnectionManagerRequestService.sendRequest(profileIdToUse, prompt);
        console.log(`[RPG Companion] response is: ${JSON.stringify(response)}`);

        const responseText =
            typeof response === 'string'
            ? response
            : response?.content ?? JSON.stringify(response);

        if (response) {
            const parsedData = parseResponse(responseText);
            applyParsedTrackerData(parsedData, { renderUserStats, renderInfoBox, renderThoughts, renderInventory });
        }
    } catch (error) {
        console.error('[RPG Companion] Error updating RPG data:', error);
    } finally {
        setIsGenerating(false);
        $updateBtn.html('<i class="fa-solid fa-sync"></i> Refresh RPG Info').prop('disabled', false);
        setLastActionWasSwipe(false);
    }
}
