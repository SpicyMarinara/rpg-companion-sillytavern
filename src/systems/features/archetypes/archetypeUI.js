/**
 * Archetype UI Module
 * Handles rendering and interaction for archetype-related UI components
 *
 * Components:
 * - Archetype badge display
 * - Evolution progress bar
 * - Archetype details modal
 * - Character archetype selector
 * - Interaction recording UI
 */

import {
    ARCHETYPES,
    SHADOW_ARCHETYPES,
    EVOLVED_ARCHETYPES,
    ARCHETYPE_CATEGORIES,
    getAllArchetypes,
    getArchetype,
    getShadowArchetype,
    getEvolvedArchetype
} from './archetypeDefinitions.js';
import { ArchetypeManager, archetypeRegistry, INTERACTION_IMPACTS } from './archetypeManager.js';
import { getArchetypeSummary, getRelationshipDynamics } from './archetypeEffects.js';

/**
 * Generate HTML for the archetype badge
 *
 * @param {ArchetypeManager} manager - The archetype manager for a character
 * @param {Object} options - Display options
 * @returns {string} HTML string for the badge
 */
export function renderArchetypeBadge(manager, options = {}) {
    const {
        showProgress = true,
        showTooltip = true,
        size = 'medium',
        onClick = null
    } = options;

    if (!manager || !manager.archetype) {
        return `<div class="rpg-archetype-badge rpg-archetype-badge--${size} rpg-archetype-badge--empty">
            <span class="rpg-archetype-badge__icon">?</span>
            <span class="rpg-archetype-badge__name">No Archetype</span>
        </div>`;
    }

    const status = manager.getEvolutionStatus();
    const progress = status.progress;
    const progressPercent = Math.abs(progress) * 100;

    // Determine current display based on state
    let displayIcon, displayName, stateClass;
    if (status.state === 'evolved' && status.nextEvolution) {
        const evolved = getEvolvedArchetype(status.nextEvolution.id);
        displayIcon = evolved?.icon || manager.archetype.icon;
        displayName = evolved?.name || status.archetypeName;
        stateClass = 'rpg-archetype-badge--evolved';
    } else if (status.state === 'shadow' && status.nextDevolution) {
        const shadow = getShadowArchetype(status.nextDevolution.id);
        displayIcon = shadow?.icon || manager.archetype.icon;
        displayName = shadow?.name || status.archetypeName;
        stateClass = 'rpg-archetype-badge--shadow';
    } else {
        displayIcon = manager.archetype.icon;
        displayName = status.archetypeName;
        stateClass = 'rpg-archetype-badge--base';
    }

    // Progress bar color based on direction
    const progressColor = progress >= 0 ? 'var(--rpg-archetype-evolution-color, #4ade80)' : 'var(--rpg-archetype-shadow-color, #f87171)';

    // Build tooltip content
    const tooltipContent = showTooltip ? `
        <div class="rpg-archetype-badge__tooltip">
            <div class="rpg-archetype-badge__tooltip-header">${displayIcon} ${displayName}</div>
            <div class="rpg-archetype-badge__tooltip-core">${manager.archetype.core}</div>
            <div class="rpg-archetype-badge__tooltip-progress">
                Progress: ${progress >= 0 ? '+' : ''}${(progress * 100).toFixed(0)}%
            </div>
            <div class="rpg-archetype-badge__tooltip-hint">Click for details</div>
        </div>
    ` : '';

    // Build progress indicator
    const progressBar = showProgress ? `
        <div class="rpg-archetype-badge__progress">
            <div class="rpg-archetype-badge__progress-bar" style="width: ${progressPercent}%; background: ${progressColor};"></div>
        </div>
    ` : '';

    const clickAttr = onClick ? `onclick="${onClick}"` : '';

    return `
        <div class="rpg-archetype-badge rpg-archetype-badge--${size} ${stateClass}" ${clickAttr}>
            <span class="rpg-archetype-badge__icon">${displayIcon}</span>
            <span class="rpg-archetype-badge__name">${displayName}</span>
            ${progressBar}
            ${tooltipContent}
        </div>
    `;
}

/**
 * Generate HTML for the evolution progress bar (larger, standalone version)
 *
 * @param {ArchetypeManager} manager - The archetype manager
 * @returns {string} HTML string for the progress bar
 */
export function renderEvolutionProgressBar(manager) {
    if (!manager || !manager.archetype) {
        return '<div class="rpg-archetype-progress rpg-archetype-progress--empty">No archetype set</div>';
    }

    const status = manager.getEvolutionStatus();
    const progress = status.progress;

    // Get evolved and shadow info
    const evolved = status.nextEvolution;
    const shadow = status.nextDevolution;

    // Calculate bar position (center is 0, left is -1, right is +1)
    const barPosition = ((progress + 1) / 2) * 100; // Convert -1..1 to 0..100

    return `
        <div class="rpg-archetype-progress">
            <div class="rpg-archetype-progress__header">
                <span class="rpg-archetype-progress__label rpg-archetype-progress__label--shadow">
                    ${shadow?.icon || ''} ${shadow?.name || 'Shadow'}
                </span>
                <span class="rpg-archetype-progress__label rpg-archetype-progress__label--current">
                    ${manager.archetype.icon} ${manager.archetype.name}
                </span>
                <span class="rpg-archetype-progress__label rpg-archetype-progress__label--evolved">
                    ${evolved?.icon || ''} ${evolved?.name || 'Evolved'}
                </span>
            </div>
            <div class="rpg-archetype-progress__bar">
                <div class="rpg-archetype-progress__gradient"></div>
                <div class="rpg-archetype-progress__marker" style="left: ${barPosition}%;">
                    <div class="rpg-archetype-progress__marker-dot"></div>
                </div>
                <div class="rpg-archetype-progress__center-line"></div>
            </div>
            <div class="rpg-archetype-progress__footer">
                <span class="rpg-archetype-progress__points">
                    Evolution Points: ${status.points >= 0 ? '+' : ''}${status.points}
                </span>
                <span class="rpg-archetype-progress__interactions">
                    Interactions: ${status.totalInteractions}
                </span>
            </div>
        </div>
    `;
}

/**
 * Generate HTML for the archetype details modal
 *
 * @param {ArchetypeManager} manager - The archetype manager
 * @returns {string} HTML string for the modal content
 */
export function renderArchetypeDetailsModal(manager) {
    if (!manager || !manager.archetype) {
        return `
            <div class="rpg-archetype-modal__empty">
                <p>No archetype has been assigned to this character.</p>
                <p>Archetypes affect personality, behavior, and evolution.</p>
            </div>
        `;
    }

    const archetype = manager.archetype;
    const status = manager.getEvolutionStatus();
    const stats = manager.getInteractionStats();
    const recentInteractions = manager.getRecentInteractions(5);

    // Build traits list
    const traitsHtml = archetype.traits.map(trait =>
        `<span class="rpg-archetype-modal__trait">${trait}</span>`
    ).join('');

    // Build evolution paths
    const evolved = getEvolvedArchetype(archetype.evolution.positive);
    const shadow = getShadowArchetype(archetype.evolution.negative);

    // Build recent interactions
    const interactionsHtml = recentInteractions.length > 0
        ? recentInteractions.map(i => `
            <div class="rpg-archetype-modal__interaction rpg-archetype-modal__interaction--${i.finalValue >= 0 ? 'positive' : 'negative'}">
                <span class="rpg-archetype-modal__interaction-type">${i.type}</span>
                <span class="rpg-archetype-modal__interaction-value">${i.finalValue >= 0 ? '+' : ''}${i.finalValue}</span>
            </div>
        `).join('')
        : '<p class="rpg-archetype-modal__no-interactions">No interactions recorded yet.</p>';

    return `
        <div class="rpg-archetype-modal">
            <div class="rpg-archetype-modal__header">
                <span class="rpg-archetype-modal__icon">${archetype.icon}</span>
                <h2 class="rpg-archetype-modal__title">${archetype.name}</h2>
                <span class="rpg-archetype-modal__category">${ARCHETYPE_CATEGORIES[archetype.category]?.name || ''}</span>
            </div>

            <div class="rpg-archetype-modal__core">
                <p class="rpg-archetype-modal__core-text">"${archetype.core}"</p>
            </div>

            <div class="rpg-archetype-modal__section">
                <h3>Psychology</h3>
                <div class="rpg-archetype-modal__psychology">
                    <div class="rpg-archetype-modal__psych-item">
                        <span class="rpg-archetype-modal__psych-label">Deepest Desire</span>
                        <span class="rpg-archetype-modal__psych-value">${archetype.desire}</span>
                    </div>
                    <div class="rpg-archetype-modal__psych-item">
                        <span class="rpg-archetype-modal__psych-label">Greatest Fear</span>
                        <span class="rpg-archetype-modal__psych-value">${archetype.fear}</span>
                    </div>
                    <div class="rpg-archetype-modal__psych-item">
                        <span class="rpg-archetype-modal__psych-label">Shadow Tendency</span>
                        <span class="rpg-archetype-modal__psych-value">${archetype.shadow}</span>
                    </div>
                </div>
            </div>

            <div class="rpg-archetype-modal__section">
                <h3>Traits</h3>
                <div class="rpg-archetype-modal__traits">${traitsHtml}</div>
            </div>

            <div class="rpg-archetype-modal__section">
                <h3>Evolution Progress</h3>
                ${renderEvolutionProgressBar(manager)}
            </div>

            <div class="rpg-archetype-modal__section rpg-archetype-modal__evolution-paths">
                <div class="rpg-archetype-modal__path rpg-archetype-modal__path--evolved">
                    <h4>${evolved?.icon || ''} ${evolved?.name || 'Evolved Form'}</h4>
                    <p class="rpg-archetype-modal__path-desc">${evolved?.description || ''}</p>
                    <p class="rpg-archetype-modal__path-condition"><strong>Condition:</strong> ${archetype.evolutionConditions.positive}</p>
                </div>
                <div class="rpg-archetype-modal__path rpg-archetype-modal__path--shadow">
                    <h4>${shadow?.icon || ''} ${shadow?.name || 'Shadow Form'}</h4>
                    <p class="rpg-archetype-modal__path-desc">${shadow?.description || ''}</p>
                    <p class="rpg-archetype-modal__path-condition"><strong>Condition:</strong> ${archetype.evolutionConditions.negative}</p>
                    ${shadow?.redemptionPath ? `<p class="rpg-archetype-modal__path-redemption"><strong>Redemption:</strong> ${shadow.redemptionPath}</p>` : ''}
                </div>
            </div>

            <div class="rpg-archetype-modal__section">
                <h3>Interaction Statistics</h3>
                <div class="rpg-archetype-modal__stats">
                    <div class="rpg-archetype-modal__stat">
                        <span class="rpg-archetype-modal__stat-value">${stats.total}</span>
                        <span class="rpg-archetype-modal__stat-label">Total</span>
                    </div>
                    <div class="rpg-archetype-modal__stat rpg-archetype-modal__stat--positive">
                        <span class="rpg-archetype-modal__stat-value">${stats.positive}</span>
                        <span class="rpg-archetype-modal__stat-label">Positive</span>
                    </div>
                    <div class="rpg-archetype-modal__stat rpg-archetype-modal__stat--negative">
                        <span class="rpg-archetype-modal__stat-value">${stats.negative}</span>
                        <span class="rpg-archetype-modal__stat-label">Negative</span>
                    </div>
                </div>
            </div>

            <div class="rpg-archetype-modal__section">
                <h3>Recent Interactions</h3>
                <div class="rpg-archetype-modal__interactions">
                    ${interactionsHtml}
                </div>
            </div>
        </div>
    `;
}

/**
 * Generate HTML for archetype selector (for assigning archetypes to characters)
 *
 * @param {string} currentArchetypeKey - Currently selected archetype key
 * @param {string} selectId - ID for the select element
 * @returns {string} HTML string for the selector
 */
export function renderArchetypeSelector(currentArchetypeKey = '', selectId = 'archetype-select') {
    const categories = Object.entries(ARCHETYPE_CATEGORIES);

    let optionsHtml = '<option value="">-- Select Archetype --</option>';

    for (const [categoryKey, category] of categories) {
        optionsHtml += `<optgroup label="${category.name}">`;
        for (const archetypeKey of category.archetypes) {
            const archetype = getArchetype(archetypeKey);
            if (archetype) {
                const selected = archetypeKey === currentArchetypeKey ? 'selected' : '';
                optionsHtml += `<option value="${archetypeKey}" ${selected}>${archetype.icon} ${archetype.name}</option>`;
            }
        }
        optionsHtml += '</optgroup>';
    }

    return `
        <div class="rpg-archetype-selector">
            <label for="${selectId}" class="rpg-archetype-selector__label">Archetype</label>
            <select id="${selectId}" class="rpg-archetype-selector__select">
                ${optionsHtml}
            </select>
            <p class="rpg-archetype-selector__hint">
                Archetypes define a character's psychological patterns, affecting their behavior and evolution.
            </p>
        </div>
    `;
}

/**
 * Generate HTML for the archetype card (compact info display)
 *
 * @param {string} archetypeKey - The archetype key
 * @returns {string} HTML string for the card
 */
export function renderArchetypeCard(archetypeKey) {
    const archetype = getArchetype(archetypeKey);
    if (!archetype) {
        return '<div class="rpg-archetype-card rpg-archetype-card--empty">Unknown archetype</div>';
    }

    const category = ARCHETYPE_CATEGORIES[archetype.category];

    return `
        <div class="rpg-archetype-card">
            <div class="rpg-archetype-card__header">
                <span class="rpg-archetype-card__icon">${archetype.icon}</span>
                <div class="rpg-archetype-card__titles">
                    <h3 class="rpg-archetype-card__name">${archetype.name}</h3>
                    <span class="rpg-archetype-card__category">${category?.name || ''}</span>
                </div>
            </div>
            <p class="rpg-archetype-card__core">${archetype.core}</p>
            <div class="rpg-archetype-card__traits">
                ${archetype.traits.map(t => `<span class="rpg-archetype-card__trait">${t}</span>`).join('')}
            </div>
        </div>
    `;
}

/**
 * Generate HTML for interaction recorder UI
 *
 * @param {string} characterId - The character ID
 * @returns {string} HTML string for the interaction recorder
 */
export function renderInteractionRecorder(characterId) {
    // Group interactions by type (positive/negative)
    const positiveInteractions = Object.entries(INTERACTION_IMPACTS)
        .filter(([_, data]) => data.base > 0)
        .map(([key, data]) => ({ key, ...data }));

    const negativeInteractions = Object.entries(INTERACTION_IMPACTS)
        .filter(([_, data]) => data.base < 0)
        .map(([key, data]) => ({ key, ...data }));

    const positiveHtml = positiveInteractions.map(i => `
        <button class="rpg-interaction-btn rpg-interaction-btn--positive"
                data-character="${characterId}"
                data-interaction="${i.key}"
                data-value="${i.base}"
                title="${i.description}">
            ${i.key.replace(/([A-Z])/g, ' $1').trim()} (+${i.base})
        </button>
    `).join('');

    const negativeHtml = negativeInteractions.map(i => `
        <button class="rpg-interaction-btn rpg-interaction-btn--negative"
                data-character="${characterId}"
                data-interaction="${i.key}"
                data-value="${i.base}"
                title="${i.description}">
            ${i.key.replace(/([A-Z])/g, ' $1').trim()} (${i.base})
        </button>
    `).join('');

    return `
        <div class="rpg-interaction-recorder" data-character="${characterId}">
            <h4 class="rpg-interaction-recorder__title">Record Interaction</h4>

            <div class="rpg-interaction-recorder__section">
                <h5 class="rpg-interaction-recorder__subtitle rpg-interaction-recorder__subtitle--positive">Positive</h5>
                <div class="rpg-interaction-recorder__buttons">
                    ${positiveHtml}
                </div>
            </div>

            <div class="rpg-interaction-recorder__section">
                <h5 class="rpg-interaction-recorder__subtitle rpg-interaction-recorder__subtitle--negative">Negative</h5>
                <div class="rpg-interaction-recorder__buttons">
                    ${negativeHtml}
                </div>
            </div>

            <div class="rpg-interaction-recorder__modifier">
                <label for="interaction-modifier-${characterId}">Intensity:</label>
                <input type="range" id="interaction-modifier-${characterId}"
                       min="0.5" max="2" step="0.5" value="1"
                       class="rpg-interaction-recorder__slider">
                <span class="rpg-interaction-recorder__modifier-value">1x</span>
            </div>
        </div>
    `;
}

/**
 * Generate CSS styles for archetype UI components
 *
 * @returns {string} CSS styles string
 */
export function getArchetypeStyles() {
    return `
        /* Archetype Badge */
        .rpg-archetype-badge {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.5rem 1rem;
            border-radius: 1rem;
            background: var(--rpg-archetype-bg, rgba(0, 0, 0, 0.2));
            cursor: pointer;
            position: relative;
            transition: all 0.2s ease;
        }

        .rpg-archetype-badge:hover {
            background: var(--rpg-archetype-bg-hover, rgba(0, 0, 0, 0.3));
        }

        .rpg-archetype-badge--small {
            padding: 0.25rem 0.5rem;
            font-size: 0.875rem;
        }

        .rpg-archetype-badge--large {
            padding: 0.75rem 1.5rem;
            font-size: 1.125rem;
        }

        .rpg-archetype-badge--base { border-left: 3px solid var(--rpg-archetype-base-color, #60a5fa); }
        .rpg-archetype-badge--evolved { border-left: 3px solid var(--rpg-archetype-evolution-color, #4ade80); }
        .rpg-archetype-badge--shadow { border-left: 3px solid var(--rpg-archetype-shadow-color, #f87171); }

        .rpg-archetype-badge__icon {
            font-size: 1.25em;
        }

        .rpg-archetype-badge__name {
            font-weight: 500;
        }

        .rpg-archetype-badge__progress {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            height: 3px;
            background: rgba(0, 0, 0, 0.2);
            border-radius: 0 0 1rem 1rem;
            overflow: hidden;
        }

        .rpg-archetype-badge__progress-bar {
            height: 100%;
            transition: width 0.3s ease;
        }

        .rpg-archetype-badge__tooltip {
            display: none;
            position: absolute;
            bottom: 100%;
            left: 50%;
            transform: translateX(-50%);
            padding: 0.75rem;
            background: var(--rpg-tooltip-bg, #1f2937);
            border-radius: 0.5rem;
            font-size: 0.875rem;
            white-space: nowrap;
            z-index: 100;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
            margin-bottom: 0.5rem;
        }

        .rpg-archetype-badge:hover .rpg-archetype-badge__tooltip {
            display: block;
        }

        .rpg-archetype-badge__tooltip-header {
            font-weight: 600;
            margin-bottom: 0.25rem;
        }

        .rpg-archetype-badge__tooltip-core {
            color: var(--rpg-text-muted, #9ca3af);
            font-style: italic;
        }

        .rpg-archetype-badge__tooltip-progress {
            margin-top: 0.5rem;
            font-size: 0.75rem;
        }

        .rpg-archetype-badge__tooltip-hint {
            margin-top: 0.25rem;
            font-size: 0.75rem;
            color: var(--rpg-text-muted, #9ca3af);
        }

        /* Evolution Progress Bar */
        .rpg-archetype-progress {
            padding: 1rem;
            background: var(--rpg-archetype-bg, rgba(0, 0, 0, 0.2));
            border-radius: 0.5rem;
        }

        .rpg-archetype-progress__header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 0.5rem;
            font-size: 0.875rem;
        }

        .rpg-archetype-progress__label--shadow {
            color: var(--rpg-archetype-shadow-color, #f87171);
        }

        .rpg-archetype-progress__label--current {
            font-weight: 600;
        }

        .rpg-archetype-progress__label--evolved {
            color: var(--rpg-archetype-evolution-color, #4ade80);
        }

        .rpg-archetype-progress__bar {
            position: relative;
            height: 1.5rem;
            background: rgba(0, 0, 0, 0.2);
            border-radius: 0.75rem;
            overflow: hidden;
        }

        .rpg-archetype-progress__gradient {
            position: absolute;
            inset: 0;
            background: linear-gradient(to right,
                var(--rpg-archetype-shadow-color, #f87171) 0%,
                var(--rpg-archetype-base-color, #60a5fa) 50%,
                var(--rpg-archetype-evolution-color, #4ade80) 100%
            );
            opacity: 0.3;
        }

        .rpg-archetype-progress__center-line {
            position: absolute;
            top: 0;
            bottom: 0;
            left: 50%;
            width: 2px;
            background: var(--rpg-text-muted, #9ca3af);
            transform: translateX(-50%);
        }

        .rpg-archetype-progress__marker {
            position: absolute;
            top: 50%;
            transform: translate(-50%, -50%);
            z-index: 10;
            transition: left 0.3s ease;
        }

        .rpg-archetype-progress__marker-dot {
            width: 1.25rem;
            height: 1.25rem;
            background: var(--rpg-text, #fff);
            border-radius: 50%;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        }

        .rpg-archetype-progress__footer {
            display: flex;
            justify-content: space-between;
            margin-top: 0.5rem;
            font-size: 0.75rem;
            color: var(--rpg-text-muted, #9ca3af);
        }

        /* Archetype Modal */
        .rpg-archetype-modal {
            padding: 1rem;
            max-width: 600px;
        }

        .rpg-archetype-modal__header {
            display: flex;
            align-items: center;
            gap: 1rem;
            margin-bottom: 1rem;
            padding-bottom: 1rem;
            border-bottom: 1px solid var(--rpg-border, rgba(255, 255, 255, 0.1));
        }

        .rpg-archetype-modal__icon {
            font-size: 2.5rem;
        }

        .rpg-archetype-modal__title {
            margin: 0;
            font-size: 1.5rem;
        }

        .rpg-archetype-modal__category {
            font-size: 0.875rem;
            color: var(--rpg-text-muted, #9ca3af);
        }

        .rpg-archetype-modal__core {
            padding: 1rem;
            background: rgba(0, 0, 0, 0.2);
            border-radius: 0.5rem;
            margin-bottom: 1rem;
        }

        .rpg-archetype-modal__core-text {
            margin: 0;
            font-style: italic;
            font-size: 1.125rem;
            text-align: center;
        }

        .rpg-archetype-modal__section {
            margin-bottom: 1.5rem;
        }

        .rpg-archetype-modal__section h3 {
            margin: 0 0 0.75rem 0;
            font-size: 1rem;
            color: var(--rpg-text-muted, #9ca3af);
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }

        .rpg-archetype-modal__psychology {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
        }

        .rpg-archetype-modal__psych-item {
            display: flex;
            gap: 0.5rem;
        }

        .rpg-archetype-modal__psych-label {
            font-weight: 600;
            min-width: 120px;
        }

        .rpg-archetype-modal__traits {
            display: flex;
            flex-wrap: wrap;
            gap: 0.5rem;
        }

        .rpg-archetype-modal__trait {
            padding: 0.25rem 0.75rem;
            background: var(--rpg-archetype-base-color, #60a5fa);
            border-radius: 1rem;
            font-size: 0.875rem;
        }

        .rpg-archetype-modal__evolution-paths {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 1rem;
        }

        .rpg-archetype-modal__path {
            padding: 1rem;
            border-radius: 0.5rem;
        }

        .rpg-archetype-modal__path--evolved {
            background: rgba(74, 222, 128, 0.1);
            border: 1px solid var(--rpg-archetype-evolution-color, #4ade80);
        }

        .rpg-archetype-modal__path--shadow {
            background: rgba(248, 113, 113, 0.1);
            border: 1px solid var(--rpg-archetype-shadow-color, #f87171);
        }

        .rpg-archetype-modal__path h4 {
            margin: 0 0 0.5rem 0;
        }

        .rpg-archetype-modal__path-desc {
            margin: 0 0 0.5rem 0;
            font-size: 0.875rem;
        }

        .rpg-archetype-modal__path-condition,
        .rpg-archetype-modal__path-redemption {
            margin: 0;
            font-size: 0.75rem;
            color: var(--rpg-text-muted, #9ca3af);
        }

        .rpg-archetype-modal__stats {
            display: flex;
            gap: 2rem;
        }

        .rpg-archetype-modal__stat {
            text-align: center;
        }

        .rpg-archetype-modal__stat-value {
            display: block;
            font-size: 1.5rem;
            font-weight: 600;
        }

        .rpg-archetype-modal__stat-label {
            font-size: 0.75rem;
            color: var(--rpg-text-muted, #9ca3af);
        }

        .rpg-archetype-modal__stat--positive .rpg-archetype-modal__stat-value {
            color: var(--rpg-archetype-evolution-color, #4ade80);
        }

        .rpg-archetype-modal__stat--negative .rpg-archetype-modal__stat-value {
            color: var(--rpg-archetype-shadow-color, #f87171);
        }

        .rpg-archetype-modal__interactions {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
        }

        .rpg-archetype-modal__interaction {
            display: flex;
            justify-content: space-between;
            padding: 0.5rem;
            background: rgba(0, 0, 0, 0.2);
            border-radius: 0.25rem;
        }

        .rpg-archetype-modal__interaction--positive {
            border-left: 3px solid var(--rpg-archetype-evolution-color, #4ade80);
        }

        .rpg-archetype-modal__interaction--negative {
            border-left: 3px solid var(--rpg-archetype-shadow-color, #f87171);
        }

        .rpg-archetype-modal__interaction-type {
            text-transform: capitalize;
        }

        .rpg-archetype-modal__interaction-value {
            font-weight: 600;
        }

        /* Archetype Selector */
        .rpg-archetype-selector {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
        }

        .rpg-archetype-selector__label {
            font-weight: 600;
        }

        .rpg-archetype-selector__select {
            padding: 0.5rem;
            border-radius: 0.25rem;
            background: var(--rpg-input-bg, #374151);
            border: 1px solid var(--rpg-border, #4b5563);
            color: var(--rpg-text, #fff);
        }

        .rpg-archetype-selector__hint {
            font-size: 0.75rem;
            color: var(--rpg-text-muted, #9ca3af);
            margin: 0;
        }

        /* Archetype Card */
        .rpg-archetype-card {
            padding: 1rem;
            background: var(--rpg-archetype-bg, rgba(0, 0, 0, 0.2));
            border-radius: 0.5rem;
            border: 1px solid var(--rpg-border, rgba(255, 255, 255, 0.1));
        }

        .rpg-archetype-card__header {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            margin-bottom: 0.75rem;
        }

        .rpg-archetype-card__icon {
            font-size: 2rem;
        }

        .rpg-archetype-card__name {
            margin: 0;
            font-size: 1.125rem;
        }

        .rpg-archetype-card__category {
            font-size: 0.75rem;
            color: var(--rpg-text-muted, #9ca3af);
        }

        .rpg-archetype-card__core {
            margin: 0 0 0.75rem 0;
            font-style: italic;
            color: var(--rpg-text-muted, #9ca3af);
        }

        .rpg-archetype-card__traits {
            display: flex;
            flex-wrap: wrap;
            gap: 0.25rem;
        }

        .rpg-archetype-card__trait {
            padding: 0.125rem 0.5rem;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 0.25rem;
            font-size: 0.75rem;
        }

        /* Interaction Recorder */
        .rpg-interaction-recorder {
            padding: 1rem;
            background: var(--rpg-archetype-bg, rgba(0, 0, 0, 0.2));
            border-radius: 0.5rem;
        }

        .rpg-interaction-recorder__title {
            margin: 0 0 1rem 0;
        }

        .rpg-interaction-recorder__section {
            margin-bottom: 1rem;
        }

        .rpg-interaction-recorder__subtitle {
            margin: 0 0 0.5rem 0;
            font-size: 0.875rem;
        }

        .rpg-interaction-recorder__subtitle--positive {
            color: var(--rpg-archetype-evolution-color, #4ade80);
        }

        .rpg-interaction-recorder__subtitle--negative {
            color: var(--rpg-archetype-shadow-color, #f87171);
        }

        .rpg-interaction-recorder__buttons {
            display: flex;
            flex-wrap: wrap;
            gap: 0.5rem;
        }

        .rpg-interaction-btn {
            padding: 0.25rem 0.75rem;
            border-radius: 0.25rem;
            border: none;
            cursor: pointer;
            font-size: 0.75rem;
            transition: all 0.2s ease;
        }

        .rpg-interaction-btn--positive {
            background: rgba(74, 222, 128, 0.2);
            color: var(--rpg-archetype-evolution-color, #4ade80);
            border: 1px solid var(--rpg-archetype-evolution-color, #4ade80);
        }

        .rpg-interaction-btn--positive:hover {
            background: rgba(74, 222, 128, 0.3);
        }

        .rpg-interaction-btn--negative {
            background: rgba(248, 113, 113, 0.2);
            color: var(--rpg-archetype-shadow-color, #f87171);
            border: 1px solid var(--rpg-archetype-shadow-color, #f87171);
        }

        .rpg-interaction-btn--negative:hover {
            background: rgba(248, 113, 113, 0.3);
        }

        .rpg-interaction-recorder__modifier {
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        .rpg-interaction-recorder__slider {
            flex: 1;
        }

        .rpg-interaction-recorder__modifier-value {
            min-width: 2rem;
            text-align: center;
            font-weight: 600;
        }
    `;
}

/**
 * Initialize event handlers for archetype UI interactions
 * Should be called after rendering archetype UI elements
 *
 * @param {Object} callbacks - Callback functions
 */
export function initArchetypeUIHandlers(callbacks = {}) {
    const {
        onInteraction = () => {},
        onArchetypeChange = () => {},
        onBadgeClick = () => {},
        onEvolutionEvent = () => {}
    } = callbacks;

    // Handle interaction button clicks
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.rpg-interaction-btn');
        if (btn) {
            const characterId = btn.dataset.character;
            const interactionType = btn.dataset.interaction;
            const recorder = btn.closest('.rpg-interaction-recorder');
            const slider = recorder?.querySelector('.rpg-interaction-recorder__slider');
            const modifier = slider ? parseFloat(slider.value) : 1;

            const manager = archetypeRegistry.getManager(characterId);
            const result = manager.recordInteraction(interactionType, modifier);

            onInteraction(characterId, result);

            // Check for evolution event
            if (result.evolutionResult) {
                onEvolutionEvent(characterId, result.evolutionResult);
            }
        }
    });

    // Handle intensity slider changes
    document.addEventListener('input', (e) => {
        if (e.target.classList.contains('rpg-interaction-recorder__slider')) {
            const recorder = e.target.closest('.rpg-interaction-recorder');
            const valueDisplay = recorder?.querySelector('.rpg-interaction-recorder__modifier-value');
            if (valueDisplay) {
                valueDisplay.textContent = `${e.target.value}x`;
            }
        }
    });

    // Handle archetype selector changes
    document.addEventListener('change', (e) => {
        if (e.target.classList.contains('rpg-archetype-selector__select')) {
            const archetypeKey = e.target.value;
            onArchetypeChange(archetypeKey, e.target);
        }
    });

    // Handle badge clicks
    document.addEventListener('click', (e) => {
        const badge = e.target.closest('.rpg-archetype-badge');
        if (badge) {
            onBadgeClick(badge);
        }
    });
}

/**
 * Utility function to inject archetype styles into the document
 */
export function injectArchetypeStyles() {
    const styleId = 'rpg-archetype-styles';
    if (!document.getElementById(styleId)) {
        const styleElement = document.createElement('style');
        styleElement.id = styleId;
        styleElement.textContent = getArchetypeStyles();
        document.head.appendChild(styleElement);
    }
}
