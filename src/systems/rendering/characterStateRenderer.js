/**
 * Character State Rendering Module
 * Displays character state information in the UI
 */

import { getCharacterState } from '../../core/characterState.js';

/**
 * Renders the character's emotional state section
 * @param {Object} $container - jQuery container element
 */
export function renderEmotionalState($container) {
    if (!$container || !$container.length) return;

    const charState = getCharacterState();
    const charName = charState.characterName || 'Character';

    let html = `<div class="rpg-character-emotions">`;
    html += `<h4>${charName}'s Emotional State</h4>`;

    // Get active emotional states (>10 intensity)
    const activeEmotions = Object.entries(charState.secondaryStates)
        .filter(([key, value]) => value > 10)
        .sort((a, b) => b[1] - a[1]) // Sort by intensity
        .slice(0, 8); // Show top 8

    if (activeEmotions.length > 0) {
        html += `<div class="rpg-emotion-list">`;
        for (const [emotion, value] of activeEmotions) {
            const emotionLabel = formatEmotionName(emotion);
            const emotionColor = getEmotionColor(emotion, value);
            const barWidth = value;

            html += `<div class="rpg-emotion-item">`;
            html += `<span class="rpg-emotion-label">${emotionLabel}</span>`;
            html += `<div class="rpg-stat-bar-container">`;
            html += `<div class="rpg-stat-bar" style="width: ${barWidth}%; background-color: ${emotionColor};"></div>`;
            html += `</div>`;
            html += `<span class="rpg-emotion-value">${value}</span>`;
            html += `</div>`;
        }
        html += `</div>`;
    } else {
        html += `<p class="rpg-neutral-state">Emotionally neutral</p>`;
    }

    html += `</div>`;

    $container.html(html);
}

/**
 * Renders the character's physical condition section
 * @param {Object} $container - jQuery container element
 */
export function renderPhysicalCondition($container) {
    if (!$container || !$container.length) return;

    const charState = getCharacterState();
    const stats = charState.physicalStats;

    let html = `<div class="rpg-physical-condition">`;
    html += `<h4>Physical Condition</h4>`;
    html += `<div class="rpg-physical-stats">`;

    const displayStats = [
        { key: 'health', label: 'Health', icon: '❤️' },
        { key: 'energy', label: 'Energy', icon: '⚡' },
        { key: 'hunger', label: 'Hunger', icon: '🍽️' },
        { key: 'arousal', label: 'Arousal', icon: '🔥' }
    ];

    for (const stat of displayStats) {
        const value = stats[stat.key] !== undefined ? stats[stat.key] : 50;
        const color = getStatColor(stat.key, value);

        html += `<div class="rpg-physical-stat-item">`;
        html += `<span class="rpg-stat-icon">${stat.icon}</span>`;
        html += `<span class="rpg-stat-label">${stat.label}</span>`;
        html += `<div class="rpg-stat-bar-container">`;
        html += `<div class="rpg-stat-bar" style="width: ${value}%; background-color: ${color};"></div>`;
        html += `</div>`;
        html += `<span class="rpg-stat-value">${value}%</span>`;
        html += `</div>`;
    }

    html += `</div>`;
    html += `</div>`;

    $container.html(html);
}

/**
 * Renders the character's relationships section
 * @param {Object} $container - jQuery container element
 */
export function renderRelationships($container) {
    if (!$container || !$container.length) return;

    const charState = getCharacterState();
    const charName = charState.characterName || 'Character';
    const relationships = charState.relationships;

    let html = `<div class="rpg-relationships">`;
    html += `<h4>${charName}'s Relationships</h4>`;

    const relationshipEntries = Object.entries(relationships);

    if (relationshipEntries.length > 0) {
        html += `<div class="rpg-relationship-list">`;

        for (const [npcName, relData] of relationshipEntries) {
            // Only show relationships with some significance
            if (relData.trust < 20 && relData.love < 10 && relData.attraction < 10) {
                continue;
            }

            html += `<div class="rpg-relationship-card">`;
            html += `<div class="rpg-relationship-header">`;
            html += `<strong>${npcName}</strong>`;
            html += `<span class="rpg-relationship-status">${relData.relationshipStatus || 'Acquaintance'}</span>`;
            html += `</div>`;

            // Show key stats
            html += `<div class="rpg-relationship-stats">`;
            if (relData.trust > 20) {
                html += `<span class="rpg-rel-stat">Trust: ${relData.trust}</span>`;
            }
            if (relData.love > 10) {
                html += `<span class="rpg-rel-stat">Love: ${relData.love}❤️</span>`;
            }
            if (relData.attraction > 10) {
                html += `<span class="rpg-rel-stat">Attraction: ${relData.attraction}✨</span>`;
            }
            html += `</div>`;

            // Show current thoughts
            if (relData.currentThoughts) {
                html += `<div class="rpg-relationship-thoughts">`;
                html += `<em>"${relData.currentThoughts}"</em>`;
                html += `</div>`;
            }

            html += `</div>`;
        }

        html += `</div>`;
    } else {
        html += `<p class="rpg-no-relationships">No significant relationships yet</p>`;
    }

    html += `</div>`;

    $container.html(html);
}

/**
 * Renders the character's internal thoughts section
 * @param {Object} $container - jQuery container element
 */
export function renderInternalThoughts($container) {
    if (!$container || !$container.length) return;

    const charState = getCharacterState();
    const charName = charState.characterName || 'Character';
    const thoughts = charState.thoughts;

    let html = `<div class="rpg-internal-thoughts">`;
    html += `<h4>${charName}'s Thoughts</h4>`;

    if (thoughts.internalMonologue) {
        html += `<div class="rpg-thought-bubble">`;
        html += `<p>"${thoughts.internalMonologue}"</p>`;
        html += `</div>`;
    } else {
        html += `<p class="rpg-no-thoughts"><em>No current thoughts</em></p>`;
    }

    html += `</div>`;

    $container.html(html);
}

/**
 * Renders the character's current context (location, time, etc.)
 * @param {Object} $container - jQuery container element
 */
export function renderContext($container) {
    if (!$container || !$container.length) return;

    const charState = getCharacterState();
    const context = charState.contextInfo;

    let html = `<div class="rpg-context">`;
    html += `<h4>Current Scene</h4>`;
    html += `<div class="rpg-context-info">`;

    if (context.location) {
        html += `<div class="rpg-context-item">`;
        html += `<span class="rpg-context-icon">📍</span>`;
        html += `<span class="rpg-context-label">Location:</span>`;
        html += `<span class="rpg-context-value">${context.location}</span>`;
        html += `</div>`;
    }

    if (context.timeOfDay) {
        html += `<div class="rpg-context-item">`;
        html += `<span class="rpg-context-icon">🕐</span>`;
        html += `<span class="rpg-context-label">Time:</span>`;
        html += `<span class="rpg-context-value">${context.timeOfDay}</span>`;
        html += `</div>`;
    }

    if (context.presentCharacters && context.presentCharacters.length > 0) {
        html += `<div class="rpg-context-item">`;
        html += `<span class="rpg-context-icon">👥</span>`;
        html += `<span class="rpg-context-label">Present:</span>`;
        html += `<span class="rpg-context-value">${context.presentCharacters.join(', ')}</span>`;
        html += `</div>`;
    }

    html += `</div>`;
    html += `</div>`;

    $container.html(html);
}

/**
 * Renders a comprehensive character state overview
 * @param {Object} $container - jQuery container element
 */
export function renderCharacterStateOverview($container) {
    if (!$container || !$container.length) return;

    const charState = getCharacterState();
    const charName = charState.characterName || 'Character';

    let html = `<div class="rpg-character-overview">`;
    html += `<h3>📊 ${charName}'s State</h3>`;

    // Create tabbed sections
    html += `<div class="rpg-character-tabs">`;
    html += `<button class="rpg-tab-btn active" data-tab="emotions">Emotions</button>`;
    html += `<button class="rpg-tab-btn" data-tab="physical">Physical</button>`;
    html += `<button class="rpg-tab-btn" data-tab="relationships">Relationships</button>`;
    html += `<button class="rpg-tab-btn" data-tab="thoughts">Thoughts</button>`;
    html += `<button class="rpg-tab-btn" data-tab="context">Context</button>`;
    html += `</div>`;

    // Tab contents
    html += `<div class="rpg-tab-content">`;
    html += `<div id="rpg-tab-emotions" class="rpg-tab-pane active"></div>`;
    html += `<div id="rpg-tab-physical" class="rpg-tab-pane"></div>`;
    html += `<div id="rpg-tab-relationships" class="rpg-tab-pane"></div>`;
    html += `<div id="rpg-tab-thoughts" class="rpg-tab-pane"></div>`;
    html += `<div id="rpg-tab-context" class="rpg-tab-pane"></div>`;
    html += `</div>`;

    html += `</div>`;

    $container.html(html);

    // Render individual sections
    renderEmotionalState($('#rpg-tab-emotions'));
    renderPhysicalCondition($('#rpg-tab-physical'));
    renderRelationships($('#rpg-tab-relationships'));
    renderInternalThoughts($('#rpg-tab-thoughts'));
    renderContext($('#rpg-tab-context'));

    // Set up tab switching
    setupTabs();
}

/**
 * Sets up tab switching functionality
 */
function setupTabs() {
    $('.rpg-tab-btn').off('click').on('click', function() {
        const tabName = $(this).data('tab');

        // Update active button
        $('.rpg-tab-btn').removeClass('active');
        $(this).addClass('active');

        // Update active pane
        $('.rpg-tab-pane').removeClass('active');
        $(`#rpg-tab-${tabName}`).addClass('active');
    });
}

/**
 * Helper function to format emotion names for display
 * @param {string} emotion - Raw emotion key
 * @returns {string} Formatted emotion name
 */
function formatEmotionName(emotion) {
    // Convert camelCase to Title Case
    return emotion
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase())
        .trim();
}

/**
 * Helper function to get color for an emotion based on its type and intensity
 * @param {string} emotion - Emotion type
 * @param {number} value - Emotion intensity (0-100)
 * @returns {string} CSS color
 */
function getEmotionColor(emotion, value) {
    const intensity = value / 100;

    // Color mappings for different emotions
    const emotionColors = {
        happy: `rgba(76, 175, 80, ${0.5 + intensity * 0.5})`, // Green
        sad: `rgba(96, 125, 139, ${0.5 + intensity * 0.5})`, // Blue-grey
        angry: `rgba(244, 67, 54, ${0.5 + intensity * 0.5})`, // Red
        anxious: `rgba(255, 152, 0, ${0.5 + intensity * 0.5})`, // Orange
        horny: `rgba(233, 30, 99, ${0.5 + intensity * 0.5})`, // Pink
        confident: `rgba(63, 81, 181, ${0.5 + intensity * 0.5})`, // Indigo
        scared: `rgba(121, 85, 72, ${0.5 + intensity * 0.5})`, // Brown
        playful: `rgba(255, 193, 7, ${0.5 + intensity * 0.5})` // Amber
    };

    return emotionColors[emotion] || `rgba(158, 158, 158, ${0.5 + intensity * 0.5})`;
}

/**
 * Helper function to get color for a physical stat
 * @param {string} statKey - Stat key
 * @param {number} value - Stat value (0-100)
 * @returns {string} CSS color
 */
function getStatColor(statKey, value) {
    // For most stats, green is high, red is low
    // For hunger and arousal, yellow/orange might be more appropriate

    if (statKey === 'hunger') {
        if (value < 30) return '#4CAF50'; // Green (not hungry)
        if (value < 60) return '#FFC107'; // Yellow (getting hungry)
        return '#F44336'; // Red (very hungry)
    }

    if (statKey === 'arousal') {
        if (value < 30) return '#9E9E9E'; // Grey (low)
        if (value < 70) return '#E91E63'; // Pink (moderate)
        return '#880E4F'; // Dark pink (high)
    }

    // Default: green for high, red for low
    if (value > 70) return '#4CAF50'; // Green
    if (value > 40) return '#FFC107'; // Yellow
    return '#F44336'; // Red
}

/**
 * Updates character state display
 * Call this after parsing an LLM response to update the UI
 */
export function updateCharacterStateDisplay() {
    console.log('[Character State Renderer] 🎭 updateCharacterStateDisplay called');

    // Find the main container
    const $mainContainer = $('#rpg-character-state-container');
    console.log('[Character State Renderer] Container found:', $mainContainer && $mainContainer.length > 0);

    if ($mainContainer && $mainContainer.length) {
        console.log('[Character State Renderer] ✅ Rendering character state overview');
        renderCharacterStateOverview($mainContainer);
    } else {
        console.warn('[Character State Renderer] ❌ Container #rpg-character-state-container not found in DOM');
    }
}
