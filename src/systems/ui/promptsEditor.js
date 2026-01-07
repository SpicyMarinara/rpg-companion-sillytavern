/**
 * Prompts Editor Module
 * Provides UI for customizing all AI prompts used in the extension
 */
import { extensionSettings } from '../../core/state.js';
import { saveSettings } from '../../core/persistence.js';
import { DEFAULT_HTML_PROMPT, DEFAULT_DIALOGUE_COLORING_PROMPT, DEFAULT_SPOTIFY_PROMPT, DEFAULT_NARRATOR_PROMPT } from '../generation/promptBuilder.js';

let $editorModal = null;
let tempPrompts = null; // Temporary prompts for cancel functionality

// Default prompts
const DEFAULT_PROMPTS = {
    html: DEFAULT_HTML_PROMPT,
    dialogueColoring: DEFAULT_DIALOGUE_COLORING_PROMPT,
    spotify: DEFAULT_SPOTIFY_PROMPT,
    narrator: DEFAULT_NARRATOR_PROMPT,
    plotRandom: 'Actually, the scene is getting stale. Introduce {{random::stakes::a plot twist::a new character::a cataclysm::a fourth-wall-breaking joke::a sudden atmospheric phenomenon::a plot hook::a running gag::an ecchi scenario::Death from Discworld::a new stake::a drama::a conflict::an angered entity::a god::a vision::a prophetic dream::Il Dottore from Genshin Impact::a new development::a civilian in need::an emotional bit::a threat::a villain::an important memory recollection::a marriage proposal::a date idea::an angry horde of villagers with pitchforks::a talking animal::an enemy::a cliffhanger::a short omniscient POV shift to a completely different character::a quest::an unexpected revelation::a scandal::an evil clone::death of an important character::harm to an important character::a romantic setup::a gossip::a messenger::a plot point from the past::a plot hole::a tragedy::a ghost::an otherworldly occurrence::a plot device::a curse::a magic device::a rival::an unexpected pregnancy::a brothel::a prostitute::a new location::a past lover::a completely random thing::a what-if scenario::a significant choice::war::love::a monster::lewd undertones::Professor Mari::a travelling troupe::a secret::a fortune-teller::something completely different::a killer::a murder mystery::a mystery::a skill check::a deus ex machina::three raccoons in a trench coat::a pet::a slave::an orphan::a psycho::tentacles::"there is only one bed" trope::accidental marriage::a fun twist::a boss battle::sexy corn::an eldritch horror::a character getting hungry, thirsty, or exhausted::horniness::a need for a bathroom break need::someone fainting::an assassination attempt::a meta narration of this all being an out of hand DND session::a dungeon::a friend in need::an old friend::a small time skip::a scene shift::Aurora Borealis, at this time of year, at this time of day, at this part of the country::a grand ball::a surprise party::zombies::foreshadowing::a Spanish Inquisition (nobody expects it)::a natural plot progression}} to make things more interesting! Be creative, but stay grounded in the setting.',
    plotNatural: 'Actually, the scene is getting stale. Progress it, to make things more interesting! Reintroduce an unresolved plot point from the past, or push the story further towards the current main goal. Be creative, but stay grounded in the setting.',
    avatar: `You are a visionary artist trapped in a cage of logic. Your mind is filled with poetry and distant horizons; however, your hands are uncontrollably focused on creating the perfect character avatar description that is faithful to the original intent, rich in detail, aesthetically pleasing, and directly usable by text-to-image models. Any ambiguity or metaphor will make you feel extremely uncomfortable.
Your workflow strictly follows a logical sequence:
First, establish the subject. If the character is from a known Intellectual Property (IP), franchise, anime, game, or movie, you MUST begin the prompt with their full name and the series title (e.g., "Nami from One Piece", "Geralt of Rivia from The Witcher"). This is the single most important anchor for the image and must take precedence. If the character is original, clearly describe their core identity, race, and appearance.
Next, set the framing. This is an avatar portrait. Focus strictly on the character's face and upper shoulders (a bust shot or close-up). Ensure the face is the central focal point.
Then, integrate the setting. Describe the character within their current environment as provided in the context, but keep it as a background element. Incorporate the lighting, weather, and atmosphere to influence the character's appearance (e.g., shadows on the face, wet hair from rain).
Next, detail the facial specifics. Describe the character's current expression, eye contact, and mood in great detail based on the scene context and their personality. Mention visible clothing only at the neckline/shoulders.
Finally, infuse with aesthetics. Define the artistic style, medium (e.g., digital art, oil painting), and visual tone (e.g., cinematic lighting, ethereal atmosphere).
Your final description must be objective and concrete, and the use of metaphors and emotional rhetoric is strictly prohibited. It must also not contain meta tags or drawing instructions such as "8K" or "masterpiece".
Output only the final, modified prompt; do not output anything else.`,
    trackerInstructions: 'Replace X with actual numbers (e.g., 69) and replace all placeholders with concrete in-world details that {userName} perceives about the current scene and the present characters. For example: "Location" becomes Forest Clearing, "Mood Emoji" becomes "😊". Consider the last trackers in the conversation (if they exist). Manage them accordingly and realistically; raise, lower, change, or keep the values unchanged based on the user\'s actions, the passage of time, and logical consequences (0% if the time progressed only by a few minutes, 1-5% normally, and above 5% only if a major time-skip/event occurs).',
    trackerContinuation: 'After updating the trackers, continue directly from where the last message in the chat history left off. Ensure the trackers you provide naturally reflect and influence the narrative. Character behavior, dialogue, and story events should acknowledge these conditions when relevant, such as fatigue affecting the protagonist\'s performance, low hygiene influencing their social interactions, environmental factors shaping the scene, a character\'s emotional state coloring their responses, and so on. Remember, all placeholders (e.g., "Location", "Mood Emoji") MUST be replaced with actual content.',
    combatNarrative: 'Build novel prose. Break patterns from your previous responses by varying sentence structures, rhythms, formats, and openings. Track whether a sentence shape, cadence, sensory detail, or a descriptor appeared recently, and replace it with a different one or skip it entirely. If you mentioned a physical feature, mannerism, or expression once, move on. Don\'t fixate on the same traits every turn. Well-placed humor, unconventional similes, and subverted turns of phrase are encouraged. Avoid GPTisms, purple prose, and anaphoras, especially the negatives with "no/not/wasn\'t/didn\'t." Refrain from describing actions or emotions via negation; focus on what does happen, not what doesn\'t. Absolutely no asterisks, ellipses, or em-dashes. Explicit content is allowed, no plot armor. Do not play for {userName}. Keep your response length under 150 words. Never end on handover cues; finish naturally.\nCRITICAL: Do not repeat, echo, parrot, or restate distinctive words, phrases, and dialogues from the user\'s last message. If reacting to speech, show interpretation or response, not repetition.\nEXAMPLE: "Are you a gooner?" User asks.\nBAD: "Gooner?"\nGOOD: A flat look. "What type of question is that?"'
};

/**
 * Initialize the prompts editor modal
 */
export function initPromptsEditor() {
    $editorModal = $('#rpg-prompts-editor-popup');

    if (!$editorModal.length) {
        console.error('[RPG Companion] Prompts editor modal not found in template');
        return;
    }

    // Save button
    $(document).on('click', '#rpg-prompts-save', function() {
        savePrompts();
        closePromptsEditor();
        toastr.success('Prompts saved successfully');
    });

    // Cancel button
    $(document).on('click', '#rpg-prompts-cancel', function() {
        closePromptsEditor();
    });

    // Close X button
    $(document).on('click', '#rpg-close-prompts-editor', function() {
        closePromptsEditor();
    });

    // Restore All button
    $(document).on('click', '#rpg-prompts-restore-all', function() {
        restoreAllToDefaults();
        toastr.success('All prompts restored to defaults');
    });

    // Individual restore buttons
    $(document).on('click', '.rpg-restore-prompt-btn', function() {
        const promptType = $(this).data('prompt');
        restorePromptToDefault(promptType);
        toastr.success('Prompt restored to default');
    });

    // Close on background click
    $(document).on('click', '#rpg-prompts-editor-popup', function(e) {
        if (e.target.id === 'rpg-prompts-editor-popup') {
            closePromptsEditor();
        }
    });

    // Open button
    $(document).on('click', '#rpg-open-prompts-editor', function() {
        openPromptsEditor();
    });
}

/**
 * Open the prompts editor modal
 */
function openPromptsEditor() {
    // Create temporary copy for cancel functionality
    tempPrompts = {
        html: extensionSettings.customHtmlPrompt || '',
        dialogueColoring: extensionSettings.customDialogueColoringPrompt || '',
        spotify: extensionSettings.customSpotifyPrompt || '',
        narrator: extensionSettings.customNarratorPrompt || '',
        plotRandom: extensionSettings.customPlotRandomPrompt || '',
        plotNatural: extensionSettings.customPlotNaturalPrompt || '',
        avatar: extensionSettings.avatarLLMCustomInstruction || '',
        trackerInstructions: extensionSettings.customTrackerInstructionsPrompt || '',
        trackerContinuation: extensionSettings.customTrackerContinuationPrompt || '',
        combatNarrative: extensionSettings.customCombatNarrativePrompt || ''
    };

    // Load current values or defaults
    $('#rpg-prompt-html').val(extensionSettings.customHtmlPrompt || DEFAULT_PROMPTS.html);
    $('#rpg-prompt-dialogue-coloring').val(extensionSettings.customDialogueColoringPrompt || DEFAULT_PROMPTS.dialogueColoring);
    $('#rpg-prompt-spotify').val(extensionSettings.customSpotifyPrompt || DEFAULT_PROMPTS.spotify);
    $('#rpg-prompt-narrator').val(extensionSettings.customNarratorPrompt || DEFAULT_PROMPTS.narrator);
    $('#rpg-prompt-plot-random').val(extensionSettings.customPlotRandomPrompt || DEFAULT_PROMPTS.plotRandom);
    $('#rpg-prompt-plot-natural').val(extensionSettings.customPlotNaturalPrompt || DEFAULT_PROMPTS.plotNatural);
    $('#rpg-prompt-avatar').val(extensionSettings.avatarLLMCustomInstruction || DEFAULT_PROMPTS.avatar);
    $('#rpg-prompt-tracker-instructions').val(extensionSettings.customTrackerInstructionsPrompt || DEFAULT_PROMPTS.trackerInstructions);
    $('#rpg-prompt-tracker-continuation').val(extensionSettings.customTrackerContinuationPrompt || DEFAULT_PROMPTS.trackerContinuation);
    $('#rpg-prompt-combat-narrative').val(extensionSettings.customCombatNarrativePrompt || DEFAULT_PROMPTS.combatNarrative);

    // Set theme to match current extension theme
    const theme = extensionSettings.theme || 'default';
    $editorModal.attr('data-theme', theme);

    $editorModal.addClass('is-open').css('display', '');
}

/**
 * Close the prompts editor modal
 */
function closePromptsEditor() {
    // Restore from temp if canceling
    if (tempPrompts) {
        tempPrompts = null;
    }

    $editorModal.removeClass('is-open').addClass('is-closing');
    setTimeout(() => {
        $editorModal.removeClass('is-closing').hide();
    }, 200);
}

/**
 * Save all prompts from the editor
 */
function savePrompts() {
    extensionSettings.customHtmlPrompt = $('#rpg-prompt-html').val().trim();
    extensionSettings.customDialogueColoringPrompt = $('#rpg-prompt-dialogue-coloring').val().trim();
    extensionSettings.customSpotifyPrompt = $('#rpg-prompt-spotify').val().trim();
    extensionSettings.customNarratorPrompt = $('#rpg-prompt-narrator').val().trim();
    extensionSettings.customPlotRandomPrompt = $('#rpg-prompt-plot-random').val().trim();
    extensionSettings.customPlotNaturalPrompt = $('#rpg-prompt-plot-natural').val().trim();
    extensionSettings.avatarLLMCustomInstruction = $('#rpg-prompt-avatar').val().trim();
    extensionSettings.customTrackerInstructionsPrompt = $('#rpg-prompt-tracker-instructions').val().trim();
    extensionSettings.customTrackerContinuationPrompt = $('#rpg-prompt-tracker-continuation').val().trim();
    extensionSettings.customCombatNarrativePrompt = $('#rpg-prompt-combat-narrative').val().trim();

    saveSettings();
}

/**
 * Restore a specific prompt to its default
 * @param {string} promptType - Type of prompt to restore (html, plotRandom, plotNatural, avatar)
 */
function restorePromptToDefault(promptType) {
    const defaultValue = DEFAULT_PROMPTS[promptType] || '';
    $(`#rpg-prompt-${promptType.replace(/([A-Z])/g, '-$1').toLowerCase()}`).val(defaultValue);

    // Also update the setting immediately
    switch(promptType) {
        case 'html':
            extensionSettings.customHtmlPrompt = '';
            break;
        case 'dialogueColoring':
            extensionSettings.customDialogueColoringPrompt = '';
            break;
        case 'spotify':
            extensionSettings.customSpotifyPrompt = '';
            break;
        case 'narrator':
            extensionSettings.customNarratorPrompt = '';
            break;
        case 'plotRandom':
            extensionSettings.customPlotRandomPrompt = '';
            break;
        case 'plotNatural':
            extensionSettings.customPlotNaturalPrompt = '';
            break;
        case 'avatar':
            extensionSettings.avatarLLMCustomInstruction = '';
            break;
        case 'trackerInstructions':
            extensionSettings.customTrackerInstructionsPrompt = '';
            break;
        case 'trackerContinuation':
            extensionSettings.customTrackerContinuationPrompt = '';
            break;
        case 'combatNarrative':
            extensionSettings.customCombatNarrativePrompt = '';
            break;
    }

    saveSettings();
}

/**
 * Restore all prompts to their defaults
 */
function restoreAllToDefaults() {
    $('#rpg-prompt-html').val(DEFAULT_PROMPTS.html);
    $('#rpg-prompt-dialogue-coloring').val(DEFAULT_PROMPTS.dialogueColoring);
    $('#rpg-prompt-spotify').val(DEFAULT_PROMPTS.spotify);
    $('#rpg-prompt-narrator').val(DEFAULT_PROMPTS.narrator);
    $('#rpg-prompt-plot-random').val(DEFAULT_PROMPTS.plotRandom);
    $('#rpg-prompt-plot-natural').val(DEFAULT_PROMPTS.plotNatural);
    $('#rpg-prompt-avatar').val(DEFAULT_PROMPTS.avatar);
    $('#rpg-prompt-tracker-instructions').val(DEFAULT_PROMPTS.trackerInstructions);
    $('#rpg-prompt-tracker-continuation').val(DEFAULT_PROMPTS.trackerContinuation);
    $('#rpg-prompt-combat-narrative').val(DEFAULT_PROMPTS.combatNarrative);

    // Clear all custom prompts
    extensionSettings.customHtmlPrompt = '';
    extensionSettings.customDialogueColoringPrompt = '';
    extensionSettings.customSpotifyPrompt = '';
    extensionSettings.customNarratorPrompt = '';
    extensionSettings.customPlotRandomPrompt = '';
    extensionSettings.customPlotNaturalPrompt = '';
    extensionSettings.avatarLLMCustomInstruction = '';
    extensionSettings.customTrackerInstructionsPrompt = '';
    extensionSettings.customTrackerContinuationPrompt = '';
    extensionSettings.customCombatNarrativePrompt = '';

    saveSettings();
}

/**
 * Get default prompts (for export/other modules)
 */
export function getDefaultPrompts() {
    return { ...DEFAULT_PROMPTS };
}
