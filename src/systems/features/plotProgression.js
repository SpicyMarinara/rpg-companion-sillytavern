/**
 * Plot Progression Module
 * Handles plot buttons (Random/Natural) UI setup and plot progression logic
 */

import { togglePlotButtons } from '../ui/layout.js';
import { extensionSettings, setIsPlotProgression } from '../../core/state.js';
import { DEFAULT_HTML_PROMPT } from '../generation/promptBuilder.js';
import { Generate } from '../../../../../../../script.js';

/**
 * Sets up the plot progression buttons inside the send form area.
 * @param {Function} handlePlotClick - Callback function to handle plot button clicks
 */
export function setupPlotButtons(handlePlotClick) {
    // Remove existing buttons if any
    $('#rpg-plot-buttons').remove();

    // Create wrapper if it doesn't exist (shared with other extensions like Spotify)
    if ($('#extension-buttons-wrapper').length === 0) {
        $('#send_form').prepend('<div id="extension-buttons-wrapper" style="text-align: center; margin: 5px auto;"></div>');
    }

    // Create the button container
    const buttonHtml = `
        <span id="rpg-plot-buttons" style="display: none;">
            <button id="rpg-plot-random" class="menu_button interactable" style="
                background-color: #e94560;
                color: white;
                border: none;
                padding: 8px 12px;
                border-radius: 4px;
                font-size: 13px;
                cursor: pointer;
                margin: 0 4px;
                display: inline-block;
            " tabindex="0" role="button">
                <i class="fa-solid fa-dice"></i> Randomized Plot
            </button>
            <button id="rpg-plot-natural" class="menu_button interactable" style="
                background-color: #4a90e2;
                color: white;
                border: none;
                padding: 8px 12px;
                border-radius: 4px;
                font-size: 13px;
                cursor: pointer;
                margin: 0 4px;
                display: inline-block;
            " tabindex="0" role="button">
                <i class="fa-solid fa-forward"></i> Natural Plot
            </button>
        </span>
    `;

    // Insert into the wrapper
    $('#extension-buttons-wrapper').append(buttonHtml);

    // Add event handlers for buttons
    $('#rpg-plot-random').on('click', () => handlePlotClick('random'));
    $('#rpg-plot-natural').on('click', () => handlePlotClick('natural'));

    // Show/hide based on setting
    togglePlotButtons();
}

/**
 * Sends a plot progression request and appends the result to the last message.
 * @param {string} type - 'random' or 'natural'
 */
export async function sendPlotProgression(type) {
    if (!extensionSettings.enabled) {
        return;
    }

    // Disable buttons to prevent multiple clicks
    $('#rpg-plot-random, #rpg-plot-natural').prop('disabled', true).css('opacity', '0.5');

    // Store original enabled state and temporarily disable extension
    // This prevents RPG tracker instructions from being injected during plot progression
    const wasEnabled = extensionSettings.enabled;
    extensionSettings.enabled = false;

    try {
        // Build the prompt based on type
        let prompt = '';
        if (type === 'random') {
            prompt = 'Actually, the scene is getting stale. Introduce {{random::stakes::a plot twist::a new character::a cataclysm::a fourth-wall-breaking joke::a sudden atmospheric phenomenon::a plot hook::a running gag::an ecchi scenario::Death from Discworld::a new stake::a drama::a conflict::an angered entity::a god::a vision::a prophetic dream::Il Dottore from Genshin Impact::a new development::a civilian in need::an emotional bit::a threat::a villain::an important memory recollection::a marriage proposal::a date idea::an angry horde of villagers with pitchforks::a talking animal::an enemy::a cliffhanger::a short omniscient POV shift to a completely different character::a quest::an unexpected revelation::a scandal::an evil clone::death of an important character::harm to an important character::a romantic setup::a gossip::a messenger::a plot point from the past::a plot hole::a tragedy::a ghost::an otherworldly occurrence::a plot device::a curse::a magic device::a rival::an unexpected pregnancy::a brothel::a prostitute::a new location::a past lover::a completely random thing::a what-if scenario::a significant choice::war::love::a monster::lewd undertones::Professor Mari::a travelling troupe::a secret::a fortune-teller::something completely different::a killer::a murder mystery::a mystery::a skill check::a deus ex machina::three raccoons in a trench coat::a pet::a slave::an orphan::a psycho::tentacles::"there is only one bed" trope::accidental marriage::a fun twist::a boss battle::sexy corn::an eldritch horror::a character getting hungry, thirsty, or exhausted::horniness::a need for a bathroom break need::someone fainting::an assassination attempt::a meta narration of this all being an out of hand DND session::a dungeon::a friend in need::an old friend::a small time skip::a scene shift::Aurora Borealis, at this time of year, at this time of day, at this part of the country::a grand ball::a surprise party::zombies::foreshadowing::a Spanish Inquisition (nobody expects it)::a natural plot progression}} to make things more interesting! Be creative, but stay grounded in the setting.';
        } else {
            prompt = 'Actually, the scene is getting stale. Progress it, to make things more interesting! Reintroduce an unresolved plot point from the past, or push the story further towards the current main goal. Be creative, but stay grounded in the setting.';
        }

        // Add HTML prompt if enabled
        if (extensionSettings.enableHtmlPrompt) {
            // Use custom HTML prompt if set, otherwise use default
            const htmlPromptText = extensionSettings.customHtmlPrompt || DEFAULT_HTML_PROMPT;
            prompt += '\n\n' + htmlPromptText;
        }

        setIsPlotProgression(true);

        // Pass the prompt via options with the correct property name
        // Based on /continue slash command implementation, it uses quiet_prompt (underscore, not camelCase)
        const options = {
            quiet_prompt: prompt,  // Use underscore notation, not camelCase
            quietToLoud: true
        };

        await Generate('continue', options);
    } catch (error) {
        console.error('[RPG Companion] Error sending plot progression:', error);
        setIsPlotProgression(false);
    } finally {
        // Restore original enabled state and re-enable buttons after a delay
        setTimeout(() => {
            extensionSettings.enabled = wasEnabled;
            $('#rpg-plot-random, #rpg-plot-natural').prop('disabled', false).css('opacity', '1');
        }, 1000);
    }
}
