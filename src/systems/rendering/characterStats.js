/**
 * RPG Companion Enhanced - RPGM-Style Character Stats Rendering
 * Creates a game-like status screen similar to RPGM games
 *
 * Based on KATHERINE_RPG_MASTER_SPECIFICATION.txt
 * Version: 3.0.0 - Game-style UI
 */

import { getContext } from '../../../../extensions.js';

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
    submissiveness: { name: 'Submissiveness', desc: 'Submission desire', icon: '🙇' },
    // Extra
    comfort: { name: 'Comfort', desc: 'Physical comfort', icon: '🛋️' },
    patience: { name: 'Patience', desc: 'Waiting tolerance', icon: '⏳' },
    focus: { name: 'Focus', desc: 'Concentration', icon: '🎯' }
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
        return context?.name2 || 'Character';
    } catch (e) {
        return 'Character';
    }
}

/**
 * Get user name from SillyTavern context
 */
function getUserName() {
    try {
        const context = getContext();
        return context?.name1 || 'User';
    } catch (e) {
        return 'User';
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

    // Color ranges
    if (isInverse) {
        // Higher is worse
        if (value >= 90) return '#ff0000'; // Critical red
        if (value >= 70) return '#ff6600'; // Urgent orange
        if (value >= 50) return '#ffcc00'; // Warning yellow
        if (value >= 30) return '#88cc00'; // Ok lime
        return '#00cc44'; // Good green
    } else {
        // Higher is better
        if (value >= 80) return '#00cc44'; // Good green
        if (value >= 60) return '#88cc00'; // Ok lime
        if (value >= 40) return '#ffcc00'; // Warning yellow
        if (value >= 20) return '#ff6600'; // Low orange
        return '#ff0000'; // Critical red
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
                    <div class="game-stat-value">${displayValue}${value !== null ? '' : ''}</div>
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

    const statsHtml = category.stats
        .filter(statName => stats[statName] !== undefined)
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
 * Render scene/location info in game style
 */
function renderGameScene(scene) {
    if (!scene) return '';

    const privacyLevel = scene.privacy >= 80 ? 'Private' :
                         scene.privacy >= 50 ? 'Semi-Private' : 'Public';
    const privacyClass = scene.privacy >= 80 ? 'privacy-high' :
                         scene.privacy >= 50 ? 'privacy-mid' : 'privacy-low';

    return `
        <div class="game-scene-panel">
            <div class="game-scene-header">
                <span class="scene-icon">📍</span>
                <span class="scene-title">Current Location</span>
            </div>
            <div class="game-scene-body">
                <div class="scene-location-name">${scene.location || 'Unknown'}</div>
                <div class="scene-details">
                    <div class="scene-detail">
                        <span class="detail-icon">🕐</span>
                        <span>${scene.time || '12:00'}</span>
                    </div>
                    <div class="scene-detail ${privacyClass}">
                        <span class="detail-icon">👁️</span>
                        <span>${privacyLevel} (${scene.privacy || 50}%)</span>
                    </div>
                    <div class="scene-detail">
                        <span class="detail-icon">🛡️</span>
                        <span>Safety: ${scene.safety || 50}%</span>
                    </div>
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
 * Render biology/womb system in game style
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
                ${biology.symptoms?.length > 0 ? `
                    <div class="bio-symptoms">
                        ${biology.symptoms.join(', ')}
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

/**
 * Render hair growth system in game style
 */
function renderGameHair(hair) {
    if (!hair) return '';

    const areas = [
        { key: 'pubic', name: 'Pubic', icon: '🔻' },
        { key: 'armpits', name: 'Armpits', icon: '💪' },
        { key: 'legs', name: 'Legs', icon: '🦵' },
        { key: 'arms', name: 'Arms', icon: '💪' },
        { key: 'assCrack', name: 'Rear', icon: '🍑' }
    ];

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
 * Render outfit system in game style
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
 * Default stats when initializing new character
 */
const DEFAULT_STATS = {
    // Physical
    hunger: 30, bladder: 20, bowel: 15, health: 100, cleanliness: 85,
    energy: 80, sleep: 75, pain: 0,
    // Mental
    willpower: 65, confidence: 60, pride: 60, shame: 10,
    stress: 20, anxiety: 15, loneliness: 25, jealousy: 10,
    // Moral
    morality: 75, corruption: 10, honesty: 80, loyalty: null,
    // Sexual
    arousal: 20, modesty: 70, lewdity: 25, exhibitionism: 5,
    perversion: 10, dominance: 40, submissiveness: 45
};

/**
 * Render the full RPGM-style character stats panel
 */
export function renderCharacterStatsPanel(characterSystem, options = {}) {
    const charName = getCharacterName();
    const userName = getUserName();
    const chatOpen = isChatOpen();

    // Get state from character system or use defaults
    const state = characterSystem?.getState?.();
    const stats = state?.stats?.toObject?.() || state?.stats || DEFAULT_STATS;
    const scene = state?.scene?.toObject?.() || state?.scene || {
        location: 'Home',
        privacy: 85,
        safety: 90,
        time: '10:00 AM'
    };
    const hair = state?.hair || null;
    const outfit = state?.outfit || null;
    const biology = state?.biology || null;

    // Render all stat categories
    const categoriesHtml = Object.keys(STAT_CATEGORIES)
        .map(key => renderStatCategory(key, stats, options))
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
                    <div class="character-relation">Interacting with ${userName}</div>
                </div>
            </div>

            ${!chatOpen ? `
                <div class="game-notice">
                    <span class="notice-icon">💬</span>
                    <span>Open a chat to track ${charName}'s state</span>
                </div>
            ` : ''}

            <div class="game-stats-container">
                ${categoriesHtml}
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
    if (!state) return '';

    const stats = state.stats || {};
    const charName = getCharacterName();

    // Show only critical stats
    const criticalStats = ['hunger', 'bladder', 'arousal', 'stress', 'health'];

    const statsHtml = criticalStats.map(statName => {
        const value = stats[statName];
        if (value === undefined) return '';

        const info = STAT_INFO[statName] || { icon: '📊' };
        const color = getStatColor(value, statName);

        return `
            <div class="compact-stat-item">
                <span class="compact-icon">${info.icon}</span>
                <span class="compact-value" style="color: ${color}">${Math.round(value)}</span>
            </div>
        `;
    }).join('');

    return `
        <div class="game-compact-stats">
            <div class="compact-header">${charName}</div>
            <div class="compact-stats-row">${statsHtml}</div>
        </div>
    `;
}

// Export for global access
export { STAT_CATEGORIES, STAT_INFO, DEFAULT_STATS };
