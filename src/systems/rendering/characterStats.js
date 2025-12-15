/**
 * RPG Companion Enhanced - RPGM-Style Character Stats Rendering
 * Creates a game-like status screen similar to RPGM games
 *
 * Based on KATHERINE_RPG_MASTER_SPECIFICATION.txt
 * Version: 3.1.0 - Dynamic data from chat
 */

import { getContext } from '../../../../../../extensions.js';

/**
 * Stat category configurations - organized like RPGM games
 */
const STAT_CATEGORIES = {
    physical: {
        name: 'Physical',
        icon: '❤️',
        color: '#ff6b6b',
        stats: ['hunger', 'bladder', 'bowel', 'health', 'cleanliness', 'energy', 'sleep', 'pain']
    },
    mental: {
        name: 'Mental',
        icon: '🧠',
        color: '#4ecdc4',
        stats: ['willpower', 'confidence', 'pride', 'shame', 'stress', 'anxiety', 'loneliness', 'jealousy']
    },
    moral: {
        name: 'Moral',
        icon: '⚖️',
        color: '#ffe66d',
        stats: ['morality', 'corruption', 'honesty', 'loyalty']
    },
    sexual: {
        name: 'Sexual',
        icon: '💋',
        color: '#ff69b4',
        stats: ['arousal', 'modesty', 'lewdity', 'exhibitionism', 'perversion', 'dominance', 'submissiveness']
    }
};

/**
 * Stat display names and descriptions
 */
const STAT_INFO = {
    // Physical
    hunger: { name: 'Hunger', desc: 'Need to eat', icon: '🍽️' },
    bladder: { name: 'Bladder', desc: 'Need to pee', icon: '💧' },
    bowel: { name: 'Bowel', desc: 'Need to poop', icon: '💩' },
    health: { name: 'Health', desc: 'Physical wellness', icon: '❤️' },
    cleanliness: { name: 'Cleanliness', desc: 'How clean', icon: '🚿' },
    energy: { name: 'Energy', desc: 'Stamina level', icon: '⚡' },
    sleep: { name: 'Sleep', desc: 'Rest level', icon: '😴' },
    pain: { name: 'Pain', desc: 'Physical pain', icon: '🩹' },
    // Mental
    willpower: { name: 'Willpower', desc: 'Self-control', icon: '💪' },
    confidence: { name: 'Confidence', desc: 'Self-belief', icon: '😎' },
    pride: { name: 'Pride', desc: 'Self-dignity', icon: '👑' },
    shame: { name: 'Shame', desc: 'Embarrassment', icon: '😳' },
    stress: { name: 'Stress', desc: 'Mental pressure', icon: '😰' },
    anxiety: { name: 'Anxiety', desc: 'Nervousness', icon: '😟' },
    loneliness: { name: 'Loneliness', desc: 'Isolation', icon: '🥺' },
    jealousy: { name: 'Jealousy', desc: 'Envy level', icon: '💚' },
    // Moral
    morality: { name: 'Morality', desc: 'Ethical code', icon: '😇' },
    corruption: { name: 'Corruption', desc: 'Moral decay', icon: '😈' },
    honesty: { name: 'Honesty', desc: 'Truthfulness', icon: '🤥' },
    loyalty: { name: 'Loyalty', desc: 'Devotion', icon: '🤝' },
    // Sexual
    arousal: { name: 'Arousal', desc: 'Sexual desire', icon: '🔥' },
    modesty: { name: 'Modesty', desc: 'Privacy need', icon: '🙈' },
    lewdity: { name: 'Lewdity', desc: 'Sexual comfort', icon: '😏' },
    exhibitionism: { name: 'Exhibitionism', desc: 'Show-off desire', icon: '👀' },
    perversion: { name: 'Perversion', desc: 'Kink level', icon: '🎭' },
    dominance: { name: 'Dominance', desc: 'Control desire', icon: '👸' },
    submissiveness: { name: 'Submissiveness', desc: 'Submission desire', icon: '🙇' }
};

/**
 * Stats where higher value is worse (inverted for color)
 */
const INVERSE_STATS = ['hunger', 'bladder', 'bowel', 'pain', 'stress', 'anxiety',
                       'shame', 'corruption', 'jealousy', 'loneliness'];

/**
 * Get the character name from SillyTavern context
 */
function getCharacterName() {
    try {
        const context = getContext();
        if (context?.name2) {
            return context.name2;
        }
        // Try to get from characters array
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
 * Get user name from SillyTavern context
 */
function getUserName() {
    try {
        const context = getContext();
        return context?.name1 || null;
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
 * Get color for stat value based on level
 */
function getStatColor(value, statName) {
    const isInverse = INVERSE_STATS.includes(statName);

    if (isInverse) {
        if (value >= 90) return '#ff0000';
        if (value >= 70) return '#ff6600';
        if (value >= 50) return '#ffcc00';
        if (value >= 30) return '#88cc00';
        return '#00cc44';
    } else {
        if (value >= 80) return '#00cc44';
        if (value >= 60) return '#88cc00';
        if (value >= 40) return '#ffcc00';
        if (value >= 20) return '#ff6600';
        return '#ff0000';
    }
}

/**
 * Get urgency level for stat
 */
function getStatUrgency(value, statName) {
    const isInverse = INVERSE_STATS.includes(statName);

    if (isInverse) {
        if (value >= 90) return 'critical';
        if (value >= 70) return 'urgent';
        if (value >= 50) return 'warning';
        return 'normal';
    } else {
        if (value <= 20) return 'critical';
        if (value <= 30) return 'urgent';
        if (value <= 40) return 'warning';
        return 'normal';
    }
}

/**
 * Render a single game-style stat bar
 */
function renderGameStatBar(statName, value, categoryColor) {
    const info = STAT_INFO[statName] || { name: statName, desc: '', icon: '📊' };
    const color = getStatColor(value, statName);
    const urgency = getStatUrgency(value, statName);
    const displayValue = value === null ? 'N/A' : Math.round(value);
    const barWidth = value === null ? 0 : Math.min(100, Math.max(0, value));

    const urgencyClass = urgency !== 'normal' ? `stat-${urgency}` : '';
    const pulseClass = (urgency === 'critical' || urgency === 'urgent') ? 'pulse-glow' : '';

    return `
        <div class="game-stat-row ${urgencyClass} ${pulseClass}" data-stat="${statName}" title="${info.desc}">
            <div class="game-stat-icon">${info.icon}</div>
            <div class="game-stat-info">
                <div class="game-stat-label">${info.name}</div>
                <div class="game-stat-bar-wrap">
                    <div class="game-stat-bar-bg">
                        <div class="game-stat-bar-fill" style="width: ${barWidth}%; background: linear-gradient(90deg, ${color}88, ${color});"></div>
                    </div>
                    <div class="game-stat-value">${displayValue}</div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Render a stat category section
 */
function renderStatCategory(categoryKey, stats, options = {}) {
    const category = STAT_CATEGORIES[categoryKey];
    if (!category) return '';

    const isCollapsed = options.collapsedCategories?.includes(categoryKey);

    // Only render stats that have actual values (not null/undefined)
    const statsHtml = category.stats
        .filter(statName => stats && stats[statName] !== undefined && stats[statName] !== null)
        .map(statName => renderGameStatBar(statName, stats[statName], category.color))
        .join('');

    if (!statsHtml) return '';

    return `
        <div class="game-category ${isCollapsed ? 'collapsed' : ''}" data-category="${categoryKey}">
            <div class="game-category-header" onclick="window.toggleStatCategory('${categoryKey}')" style="--cat-color: ${category.color}">
                <span class="game-category-icon">${category.icon}</span>
                <span class="game-category-name">${category.name}</span>
                <span class="game-category-arrow">${isCollapsed ? '▶' : '▼'}</span>
            </div>
            <div class="game-category-body">
                ${statsHtml}
            </div>
        </div>
    `;
}

/**
 * Render scene/location info - only if data exists
 */
function renderGameScene(scene) {
    if (!scene || !scene.location) return '';

    const privacyLevel = scene.privacy >= 80 ? 'Private' :
                         scene.privacy >= 50 ? 'Semi-Private' : 'Public';
    const privacyClass = scene.privacy >= 80 ? 'privacy-high' :
                         scene.privacy >= 50 ? 'privacy-mid' : 'privacy-low';

    return `
        <div class="game-scene-panel">
            <div class="game-scene-header">
                <span class="scene-icon">📍</span>
                <span class="scene-title">Current Scene</span>
            </div>
            <div class="game-scene-body">
                <div class="scene-location-name">${scene.location}</div>
                <div class="scene-details">
                    ${scene.time ? `
                        <div class="scene-detail">
                            <span class="detail-icon">🕐</span>
                            <span>${scene.time}</span>
                        </div>
                    ` : ''}
                    ${scene.privacy !== undefined ? `
                        <div class="scene-detail ${privacyClass}">
                            <span class="detail-icon">👁️</span>
                            <span>${privacyLevel} (${scene.privacy}%)</span>
                        </div>
                    ` : ''}
                    ${scene.safety !== undefined ? `
                        <div class="scene-detail">
                            <span class="detail-icon">🛡️</span>
                            <span>Safety: ${scene.safety}%</span>
                        </div>
                    ` : ''}
                </div>
                ${scene.peoplePresent?.length > 0 ? `
                    <div class="scene-people">
                        <span class="detail-icon">👥</span>
                        <span>${scene.peoplePresent.join(', ')}</span>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

/**
 * Render biology/womb system - only if data exists
 */
function renderGameBiology(biology) {
    if (!biology || !biology.cycleEnabled) return '';

    if (biology.pregnant) {
        const trimester = biology.pregnancyTrimester || 1;
        const progress = Math.min(100, (biology.pregnancyDay / 280) * 100);

        return `
            <div class="game-biology-panel pregnant">
                <div class="game-biology-header">
                    <span class="bio-icon">🤰</span>
                    <span class="bio-title">Womb Status</span>
                </div>
                <div class="game-biology-body">
                    <div class="pregnancy-status">
                        <div class="pregnancy-label">Pregnant - Trimester ${trimester}</div>
                        <div class="pregnancy-day">Day ${biology.pregnancyDay || 1}</div>
                    </div>
                    <div class="pregnancy-bar-wrap">
                        <div class="pregnancy-bar" style="width: ${progress}%"></div>
                    </div>
                    ${biology.symptoms?.length > 0 ? `
                        <div class="bio-symptoms">
                            Symptoms: ${biology.symptoms.join(', ')}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    const phaseColors = {
        menstruating: '#ff4466',
        follicular: '#44aaff',
        ovulating: '#ff66aa',
        luteal: '#aa66ff'
    };

    const phaseColor = phaseColors[biology.currentPhase] || '#888';
    const cycleProgress = (biology.dayOfCycle / (biology.cycleLength || 28)) * 100;

    return `
        <div class="game-biology-panel">
            <div class="game-biology-header">
                <span class="bio-icon">🌸</span>
                <span class="bio-title">Biology</span>
            </div>
            <div class="game-biology-body">
                <div class="cycle-info">
                    <div class="cycle-phase" style="color: ${phaseColor}">
                        ${(biology.currentPhase || 'Unknown').charAt(0).toUpperCase() + (biology.currentPhase || 'unknown').slice(1)}
                    </div>
                    <div class="cycle-day">Day ${biology.dayOfCycle || 1} / ${biology.cycleLength || 28}</div>
                </div>
                <div class="cycle-bar-wrap">
                    <div class="cycle-bar" style="width: ${cycleProgress}%; background: ${phaseColor}"></div>
                </div>
                ${biology.fertilityWindow ? `
                    <div class="fertility-alert">
                        <span class="fertility-icon">⚠️</span>
                        <span>Fertile Window!</span>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

/**
 * Render hair growth system - only relevant areas (pubic, armpits, rear)
 */
function renderGameHair(hair) {
    if (!hair) return '';

    // Only relevant areas - NO arms/legs
    const areas = [
        { key: 'pubic', name: 'Pubic', icon: '🔻' },
        { key: 'armpits', name: 'Armpits', icon: '💪' },
        { key: 'assCrack', name: 'Rear', icon: '🍑' }
    ];

    // Check if any hair data exists
    const hasData = areas.some(area => {
        const value = hair[area.key]?.value ?? hair[area.key];
        return value !== undefined && value !== null;
    });

    if (!hasData) return '';

    const hairBars = areas.map(area => {
        const value = hair[area.key]?.value ?? hair[area.key] ?? 0;
        const color = value > 70 ? '#8B4513' : value > 40 ? '#D2691E' : '#DEB887';

        return `
            <div class="hair-area-row">
                <span class="hair-icon">${area.icon}</span>
                <span class="hair-name">${area.name}</span>
                <div class="hair-bar-wrap">
                    <div class="hair-bar" style="width: ${value}%; background: ${color}"></div>
                </div>
                <span class="hair-value">${value}%</span>
            </div>
        `;
    }).join('');

    return `
        <div class="game-hair-panel">
            <div class="game-hair-header">
                <span class="hair-title-icon">✂️</span>
                <span class="hair-title">Hair Growth</span>
            </div>
            <div class="game-hair-body">
                ${hairBars}
            </div>
        </div>
    `;
}

/**
 * Render outfit system - only if data exists
 */
function renderGameOutfit(outfit) {
    if (!outfit) return '';

    const slots = [
        { key: 'top', icon: '👕', name: 'Top' },
        { key: 'bra', icon: '👙', name: 'Bra' },
        { key: 'bottom', icon: '👖', name: 'Bottom' },
        { key: 'underwear', icon: '🩲', name: 'Underwear' },
        { key: 'shoes', icon: '👟', name: 'Shoes' },
        { key: 'accessories', icon: '💍', name: 'Accessories' }
    ];

    // Check if any outfit data exists
    const hasData = slots.some(slot => outfit[slot.key]);
    if (!hasData) return '';

    const outfitItems = slots.map(slot => {
        const item = outfit[slot.key];
        const itemName = item?.name || item || 'None';
        const hasItem = itemName && itemName !== 'None';

        return `
            <div class="outfit-slot ${hasItem ? 'equipped' : 'empty'}">
                <span class="outfit-slot-icon">${slot.icon}</span>
                <div class="outfit-slot-info">
                    <span class="outfit-slot-name">${slot.name}</span>
                    <span class="outfit-item-name">${itemName}</span>
                </div>
            </div>
        `;
    }).join('');

    return `
        <div class="game-outfit-panel">
            <div class="game-outfit-header">
                <span class="outfit-title-icon">👗</span>
                <span class="outfit-title">Outfit</span>
            </div>
            <div class="game-outfit-body">
                ${outfitItems}
            </div>
        </div>
    `;
}

/**
 * Render the full RPGM-style character stats panel
 * Shows actual data from character system, or empty state if no data
 */
export function renderCharacterStatsPanel(characterSystem, options = {}) {
    const charName = getCharacterName();
    const userName = getUserName();
    const chatOpen = isChatOpen();

    // No chat open - show prompt to open chat
    if (!chatOpen || !charName) {
        return `
            <div class="game-status-screen empty-state">
                <div class="game-empty-message">
                    <span class="empty-icon">💬</span>
                    <span class="empty-text">Open a chat to view character stats</span>
                    <small class="empty-hint">Stats will be tracked automatically during roleplay</small>
                </div>
            </div>
        `;
    }

    // Get state from character system - NO defaults, only real data
    const state = characterSystem?.getState?.();
    const stats = state?.stats?.toObject?.() || state?.stats || null;
    const scene = state?.scene?.toObject?.() || state?.scene || null;
    const hair = state?.hair?.toObject?.() || state?.hair || null;
    const outfit = state?.outfit?.toObject?.() || state?.outfit || null;
    const biology = state?.biology?.toObject?.() || state?.biology || null;

    // Check if any stats have actual non-null values
    const hasAnyStats = stats && Object.values(stats).some(v => v !== null && v !== undefined && typeof v !== 'object');

    // If no stats have been determined yet, show waiting state
    if (!hasAnyStats) {
        return `
            <div class="game-status-screen">
                <div class="game-status-header">
                    <div class="character-portrait">
                        <div class="portrait-frame">
                            <span class="portrait-icon">👤</span>
                        </div>
                    </div>
                    <div class="character-info">
                        <div class="character-name-display">${charName}</div>
                        ${userName ? `<div class="character-relation">with ${userName}</div>` : ''}
                    </div>
                </div>
                <div class="game-empty-message">
                    <span class="empty-icon">🔍</span>
                    <span class="empty-text">Analyzing character context...</span>
                    <small class="empty-hint">Stats will be extracted from conversation and lorebook</small>
                </div>
            </div>
        `;
    }

    // Render all stat categories that have data
    const categoriesHtml = Object.keys(STAT_CATEGORIES)
        .map(key => renderStatCategory(key, stats, options))
        .filter(html => html)
        .join('');

    return `
        <div class="game-status-screen">
            <div class="game-status-header">
                <div class="character-portrait">
                    <div class="portrait-frame">
                        <span class="portrait-icon">👤</span>
                    </div>
                </div>
                <div class="character-info">
                    <div class="character-name-display">${charName}</div>
                    ${userName ? `<div class="character-relation">with ${userName}</div>` : ''}
                </div>
            </div>

            <div class="game-stats-container">
                ${categoriesHtml || '<div class="game-empty-message"><span>No stats data</span></div>'}
            </div>

            <div class="game-subsystems">
                ${renderGameScene(scene)}
                ${renderGameBiology(biology)}
                ${renderGameHair(hair)}
                ${renderGameOutfit(outfit)}
            </div>
        </div>
    `;
}

/**
 * Render compact stats for sidebar
 */
export function renderCompactStats(characterSystem, options = {}) {
    const state = characterSystem?.getState?.();
    if (!state || !state.stats) return '';

    const stats = state.stats;
    const charName = getCharacterName();
    if (!charName) return '';

    // Show only critical stats that have actual values (not null)
    const criticalStats = ['hunger', 'bladder', 'arousal', 'stress', 'health'];

    const statsHtml = criticalStats.map(statName => {
        const value = stats[statName];
        // Only show stats with actual values
        if (value === undefined || value === null) return '';

        const info = STAT_INFO[statName] || { icon: '📊' };
        const color = getStatColor(value, statName);

        return `
            <div class="compact-stat-item">
                <span class="compact-icon">${info.icon}</span>
                <span class="compact-value" style="color: ${color}">${Math.round(value)}</span>
            </div>
        `;
    }).filter(h => h).join('');

    if (!statsHtml) return '';

    return `
        <div class="game-compact-stats">
            <div class="compact-header">${charName}</div>
            <div class="compact-stats-row">${statsHtml}</div>
        </div>
    `;
}

// Export for global access
export { STAT_CATEGORIES, STAT_INFO };
