/**
 * RPG Companion Enhanced - Relationships Rendering
 * Renders the NPC relationships panel
 *
 * Based on KATHERINE_RPG_MASTER_SPECIFICATION.txt
 * Version: 2.1.0 - Dynamic character name
 */

import { getContext } from '../../../../../../extensions.js';
import { RELATIONSHIP_TYPES, IMPORTANCE_LEVELS } from '../../character/relationshipManager.js';

/**
 * Get the character name from SillyTavern context
 */
function getCharacterName() {
    try {
        const context = getContext();
        if (context?.name2) {
            return context.name2;
        }
        if (context?.characterId !== undefined && context?.characters) {
            const char = context.characters[context.characterId];
            if (char?.name) return char.name;
        }
        return null;
    } catch (e) {
        return null;
    }
}

/**
 * Check if a chat is currently open
 */
function isChatOpen() {
    try {
        const context = getContext();
        return context?.chat && context.chat.length > 0;
    } catch (e) {
        return false;
    }
}

/**
 * Relationship type colors
 */
const RELATIONSHIP_COLORS = {
    'Stranger': '#888888',
    'Acquaintance': '#6699cc',
    'Coworker': '#669966',
    'Friend': '#66cc66',
    'Close Friend': '#33aa33',
    'Best Friend': '#00ff00',
    'Romantic Interest': '#ff99cc',
    'Dating': '#ff66aa',
    'Partner': '#ff3399',
    'Fiance': '#ff0066',
    'Spouse': '#ff0033',
    'Family': '#cc99ff',
    'Enemy': '#ff3333',
    'Rival': '#ff9933'
};

/**
 * Relationship type icons
 */
const RELATIONSHIP_ICONS = {
    'Stranger': '👤',
    'Acquaintance': '🤝',
    'Coworker': '💼',
    'Friend': '😊',
    'Close Friend': '😄',
    'Best Friend': '🌟',
    'Romantic Interest': '💕',
    'Dating': '💖',
    'Partner': '❤️',
    'Fiance': '💍',
    'Spouse': '💑',
    'Family': '👪',
    'Enemy': '⚔️',
    'Rival': '🎯'
};

/**
 * Importance level styling
 */
const IMPORTANCE_STYLES = {
    'Critical': { border: '2px solid #ff3333', glow: '0 0 10px #ff3333' },
    'High': { border: '2px solid #ffaa33', glow: '0 0 8px #ffaa33' },
    'Medium': { border: '1px solid #888888', glow: 'none' },
    'Low': { border: '1px solid #444444', glow: 'none' }
};

/**
 * Render stat bar with label
 * @param {string} label - Stat label
 * @param {number} value - Stat value
 * @param {string} color - Bar color
 * @returns {string} HTML string
 */
function renderRelationshipStat(label, value, color = '#66ccff') {
    // Handle null values (like unearned loyalty)
    if (value === null) {
        return `
            <div class="rel-stat">
                <span class="rel-stat-label">${label}</span>
                <div class="rel-stat-bar-container">
                    <div class="rel-stat-bar empty" style="width: 0%"></div>
                </div>
                <span class="rel-stat-value">--</span>
            </div>
        `;
    }

    // Determine color based on value
    const barColor = value >= 70 ? '#33cc66' :
                     value >= 40 ? '#cccc33' :
                     value <= 30 ? '#cc6633' : color;

    return `
        <div class="rel-stat" data-stat="${label.toLowerCase()}">
            <span class="rel-stat-label">${label}</span>
            <div class="rel-stat-bar-container">
                <div class="rel-stat-bar" style="width: ${value}%; background-color: ${barColor}"></div>
            </div>
            <span class="rel-stat-value">${value}</span>
        </div>
    `;
}

/**
 * Render stat category section
 * @param {string} categoryName - Category name
 * @param {Object} stats - Stats object
 * @param {Array} statOrder - Order of stats to display
 * @returns {string} HTML string
 */
function renderStatCategory(categoryName, stats, statOrder) {
    const statsHtml = statOrder
        .filter(stat => stats[stat] !== undefined)
        .map(stat => {
            const label = stat.charAt(0).toUpperCase() + stat.slice(1);
            return renderRelationshipStat(label, stats[stat]);
        })
        .join('');

    return `
        <div class="rel-category">
            <div class="rel-category-header">${categoryName}</div>
            <div class="rel-category-stats">
                ${statsHtml}
            </div>
        </div>
    `;
}

/**
 * Render a single relationship card
 * @param {string} npcName - NPC name
 * @param {Object} relationship - Relationship data
 * @param {Object} options - Rendering options
 * @returns {string} HTML string
 */
function renderRelationshipCard(npcName, relationship, options = {}) {
    const type = relationship.metadata?.relationshipType || 'Unknown';
    const importance = relationship.metadata?.importance || 'Unknown';
    const isActive = relationship.metadata?.isActive || false;

    // Generate summary from relationship stats if method not available
    let summary = 'Unknown';
    if (typeof relationship.getSummary === 'function') {
        summary = relationship.getSummary();
    } else if (relationship.core) {
        const trust = relationship.core.trust;
        const love = relationship.core.love;
        if (love !== null && love > 60) {
            summary = 'Strong romantic bond';
        } else if (trust !== null && trust > 60) {
            summary = 'Trusted relationship';
        } else if (relationship.metadata?.notes) {
            summary = relationship.metadata.notes.substring(0, 50);
        } else {
            summary = type !== 'Unknown' ? `${type} relationship` : 'Developing relationship';
        }
    }

    const typeColor = RELATIONSHIP_COLORS[type] || '#888888';
    const typeIcon = RELATIONSHIP_ICONS[type] || '👤';
    const importanceStyle = IMPORTANCE_STYLES[importance] || IMPORTANCE_STYLES.Low;

    // Core stats
    const coreStatsHtml = renderStatCategory('Core', relationship.core || {},
        ['trust', 'love', 'respect', 'fear', 'loyalty']);

    // Emotional stats
    const emotionalStatsHtml = renderStatCategory('Emotional', relationship.emotional || {},
        ['closeness', 'comfort', 'openness', 'vulnerability', 'dependence']);

    // Social stats
    const socialStatsHtml = renderStatCategory('Social', relationship.social || {},
        ['dominance', 'submissiveness', 'assertiveness', 'flirtiness']);

    // Attraction stats (only show if any are > 0)
    const attraction = relationship.attraction || {};
    const hasAttraction = Object.values(attraction).some(v => v > 0);
    const attractionStatsHtml = hasAttraction ?
        renderStatCategory('Attraction', attraction,
            ['physical', 'emotional', 'intellectual', 'sexual']) : '';

    const isExpanded = options.expandedRelationships?.includes(npcName) || false;

    return `
        <div class="relationship-card ${isActive ? 'active' : ''} ${isExpanded ? 'expanded' : ''}"
             data-npc="${npcName}"
             data-type="${type}"
             data-importance="${importance}"
             style="border: ${importanceStyle.border}; box-shadow: ${importanceStyle.glow}">

            <div class="rel-header" onclick="toggleRelationshipCard('${npcName}')">
                <div class="rel-header-main">
                    <span class="rel-type-icon" style="color: ${typeColor}">${typeIcon}</span>
                    <span class="rel-name">${npcName}</span>
                    ${isActive ? '<span class="rel-active-badge">In Scene</span>' : ''}
                </div>
                <div class="rel-header-info">
                    <span class="rel-type" style="color: ${typeColor}">${type}</span>
                    <span class="rel-expand-toggle">${isExpanded ? '▼' : '▶'}</span>
                </div>
            </div>

            <div class="rel-summary">${summary}</div>

            <div class="rel-details">
                ${coreStatsHtml}
                ${emotionalStatsHtml}
                ${socialStatsHtml}
                ${attractionStatsHtml}

                ${relationship.metadata?.notes ? `
                    <div class="rel-notes">
                        <div class="rel-notes-header">Notes</div>
                        <div class="rel-notes-content">${relationship.metadata.notes}</div>
                    </div>
                ` : ''}

                <div class="rel-meta">
                    <span class="rel-importance" data-importance="${importance}">${importance}</span>
                    <span class="rel-interactions">${relationship.metadata?.interactionCount || 0} interactions</span>
                    <span class="rel-last-seen">${relationship.metadata?.lastSeen || 'Never'}</span>
                </div>
            </div>
        </div>
    `;
}

/**
 * Render active relationships section
 * @param {Object} activeRelationships - Map of active relationships
 * @param {Object} options - Rendering options
 * @returns {string} HTML string
 */
function renderActiveRelationships(activeRelationships, options = {}) {
    const names = Object.keys(activeRelationships);

    if (names.length === 0) {
        return `
            <div class="rel-section active-section empty">
                <div class="rel-section-header">
                    <span class="section-icon">👥</span>
                    <span class="section-title">People in Scene</span>
                </div>
                <div class="rel-section-empty">No one else present</div>
            </div>
        `;
    }

    const cardsHtml = names
        .map(name => renderRelationshipCard(name, activeRelationships[name], options))
        .join('');

    return `
        <div class="rel-section active-section">
            <div class="rel-section-header">
                <span class="section-icon">👥</span>
                <span class="section-title">People in Scene (${names.length})</span>
            </div>
            <div class="rel-section-content">
                ${cardsHtml}
            </div>
        </div>
    `;
}

/**
 * Render all relationships section
 * @param {Object} allRelationships - Map of all relationships
 * @param {Object} options - Rendering options
 * @returns {string} HTML string
 */
function renderAllRelationships(allRelationships, options = {}) {
    const names = Object.keys(allRelationships);

    if (names.length === 0) {
        return `
            <div class="rel-section all-section empty">
                <div class="rel-section-header">
                    <span class="section-icon">📋</span>
                    <span class="section-title">All Relationships</span>
                </div>
                <div class="rel-section-empty">No relationships established</div>
            </div>
        `;
    }

    // Sort by importance, then by type
    const importanceOrder = { 'Critical': 0, 'High': 1, 'Medium': 2, 'Low': 3 };
    const sortedNames = names.sort((a, b) => {
        const impA = importanceOrder[allRelationships[a].metadata?.importance] ?? 3;
        const impB = importanceOrder[allRelationships[b].metadata?.importance] ?? 3;
        if (impA !== impB) return impA - impB;

        // Then by type (romantic first)
        const typeA = allRelationships[a].metadata?.relationshipType || 'Stranger';
        const typeB = allRelationships[b].metadata?.relationshipType || 'Stranger';
        const romanticTypes = ['Spouse', 'Fiance', 'Partner', 'Dating', 'Romantic Interest'];
        const isRomanticA = romanticTypes.includes(typeA);
        const isRomanticB = romanticTypes.includes(typeB);
        if (isRomanticA && !isRomanticB) return -1;
        if (!isRomanticA && isRomanticB) return 1;

        return a.localeCompare(b);
    });

    // Filter out active ones if showing separately
    const inactiveNames = options.showActiveSeparately ?
        sortedNames.filter(name => !allRelationships[name].metadata?.isActive) :
        sortedNames;

    if (inactiveNames.length === 0) {
        return '';
    }

    const cardsHtml = inactiveNames
        .map(name => renderRelationshipCard(name, allRelationships[name], options))
        .join('');

    return `
        <div class="rel-section all-section">
            <div class="rel-section-header">
                <span class="section-icon">📋</span>
                <span class="section-title">Other Relationships (${inactiveNames.length})</span>
                <button class="rel-section-toggle" onclick="toggleAllRelationships()">
                    ${options.showAllRelationships ? 'Hide' : 'Show'}
                </button>
            </div>
            ${options.showAllRelationships ? `
                <div class="rel-section-content">
                    ${cardsHtml}
                </div>
            ` : ''}
        </div>
    `;
}

/**
 * Render relationship type filter
 * @param {Object} allRelationships - All relationships
 * @param {string} activeFilter - Currently active filter
 * @returns {string} HTML string
 */
function renderRelationshipFilter(allRelationships, activeFilter = 'all') {
    const types = new Set();
    for (const name in allRelationships) {
        types.add(allRelationships[name].metadata?.relationshipType || 'Stranger');
    }

    const filterButtons = ['all', ...Array.from(types)].map(type => {
        const isActive = activeFilter === type;
        const icon = type === 'all' ? '👥' : (RELATIONSHIP_ICONS[type] || '👤');
        return `
            <button class="rel-filter-btn ${isActive ? 'active' : ''}"
                    onclick="filterRelationships('${type}')"
                    data-type="${type}">
                ${icon} ${type === 'all' ? 'All' : type}
            </button>
        `;
    }).join('');

    return `
        <div class="rel-filter">
            ${filterButtons}
        </div>
    `;
}

/**
 * Render the full relationships panel
 * @param {Object} characterSystem - Character system instance
 * @param {Object} options - Rendering options
 * @returns {string} HTML string
 */
export function renderRelationshipsPanel(characterSystem, options = {}) {
    const charName = getCharacterName();
    const chatOpen = isChatOpen();

    // No chat open - show prompt
    if (!chatOpen || !charName) {
        return `
            <div class="rpg-enhanced-relationships-panel empty-state">
                <div class="game-empty-message">
                    <span class="empty-icon">💬</span>
                    <span class="empty-text">Open a chat to view relationships</span>
                    <small class="empty-hint">NPC relationships will be tracked during roleplay</small>
                </div>
            </div>
        `;
    }

    // Get relationships from character state directly
    const state = characterSystem?.getState?.();
    const allRelationships = state?.relationships || {};

    // Filter for active relationships
    const activeRelationships = {};
    for (const name in allRelationships) {
        if (allRelationships[name]?.metadata?.isActive) {
            activeRelationships[name] = allRelationships[name];
        }
    }

    // No relationships yet
    const hasRelationships = Object.keys(allRelationships).length > 0;

    if (!hasRelationships) {
        return `
            <div class="rpg-enhanced-relationships-panel">
                <div class="panel-header">
                    <span class="panel-title">${charName}'s Relationships</span>
                </div>
                <div class="game-empty-message">
                    <span class="empty-icon">👥</span>
                    <span class="empty-text">No relationships tracked yet</span>
                    <small class="empty-hint">NPCs will appear here as you interact with them</small>
                </div>
            </div>
        `;
    }

    return `
        <div class="rpg-enhanced-relationships-panel">
            <div class="panel-header">
                <span class="panel-title">${charName}'s Relationships</span>
            </div>

            ${options.showFilter !== false ?
                renderRelationshipFilter(allRelationships, options.activeFilter) : ''}

            ${renderActiveRelationships(activeRelationships, { ...options, showActiveSeparately: true })}

            ${renderAllRelationships(allRelationships, { ...options, showActiveSeparately: true })}
        </div>
    `;
}

/**
 * Render compact relationships list for sidebar
 * @param {Object} characterSystem - Character system instance
 * @param {Object} options - Rendering options
 * @returns {string} HTML string
 */
export function renderCompactRelationships(characterSystem, options = {}) {
    const activeRelationships = characterSystem?.getActiveRelationships?.() || {};
    const names = Object.keys(activeRelationships);

    if (names.length === 0) {
        return `
            <div class="rpg-enhanced-compact-relationships">
                <span class="compact-rel-empty">No one in scene</span>
            </div>
        `;
    }

    const itemsHtml = names.map(name => {
        const rel = activeRelationships[name];
        const type = rel.metadata?.relationshipType || 'Stranger';
        const icon = RELATIONSHIP_ICONS[type] || '👤';
        const summary = rel.getSummary?.() || '';

        return `
            <div class="compact-rel-item" data-npc="${name}">
                <span class="compact-rel-icon">${icon}</span>
                <span class="compact-rel-name">${name}</span>
                <span class="compact-rel-trust" title="Trust: ${rel.core?.trust}">${rel.core?.trust || 0}</span>
            </div>
        `;
    }).join('');

    return `
        <div class="rpg-enhanced-compact-relationships">
            <div class="compact-rel-header">In Scene:</div>
            ${itemsHtml}
        </div>
    `;
}

/**
 * Render relationship quick stats
 * @param {string} npcName - NPC name
 * @param {Object} relationship - Relationship data
 * @returns {string} HTML string
 */
export function renderRelationshipQuickStats(npcName, relationship) {
    if (!relationship) return '';

    const core = relationship.core || {};

    return `
        <div class="rel-quick-stats" data-npc="${npcName}">
            <div class="quick-stat">
                <span class="quick-label">Trust</span>
                <span class="quick-value">${core.trust ?? 0}</span>
            </div>
            <div class="quick-stat">
                <span class="quick-label">Love</span>
                <span class="quick-value">${core.love ?? 0}</span>
            </div>
            <div class="quick-stat">
                <span class="quick-label">Loyalty</span>
                <span class="quick-value">${core.loyalty ?? '--'}</span>
            </div>
        </div>
    `;
}

// Export constants
export { RELATIONSHIP_COLORS, RELATIONSHIP_ICONS, IMPORTANCE_STYLES };
