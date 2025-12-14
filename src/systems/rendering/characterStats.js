/**
 * RPG Companion Enhanced - Character Stats Rendering
 * Renders the enhanced character stats panel
 *
 * Based on KATHERINE_RPG_MASTER_SPECIFICATION.txt
 * Version: 2.0.0
 */

import { i18n } from '../../core/i18n.js';

/**
 * Stat category configurations
 */
const STAT_CATEGORIES = {
    physical: {
        name: 'Physical',
        icon: '💪',
        stats: ['hunger', 'bladder', 'bowel', 'health', 'cleanliness', 'energy', 'sleep', 'pain']
    },
    mental: {
        name: 'Mental',
        icon: '🧠',
        stats: ['willpower', 'confidence', 'pride', 'shame', 'stress', 'anxiety', 'loneliness', 'jealousy']
    },
    moral: {
        name: 'Moral',
        icon: '⚖️',
        stats: ['morality', 'corruption', 'honesty', 'loyalty']
    },
    sexual: {
        name: 'Sexual',
        icon: '💕',
        stats: ['arousal', 'modesty', 'lewdity', 'exhibitionism', 'perversion', 'dominance', 'submissiveness']
    }
};

/**
 * Stat display names
 */
const STAT_NAMES = {
    hunger: 'Hunger',
    bladder: 'Bladder',
    bowel: 'Bowel',
    health: 'Health',
    cleanliness: 'Cleanliness',
    energy: 'Energy',
    sleep: 'Sleep',
    pain: 'Pain',
    willpower: 'Willpower',
    confidence: 'Confidence',
    pride: 'Pride',
    shame: 'Shame',
    stress: 'Stress',
    anxiety: 'Anxiety',
    loneliness: 'Loneliness',
    jealousy: 'Jealousy',
    morality: 'Morality',
    corruption: 'Corruption',
    honesty: 'Honesty',
    loyalty: 'Loyalty',
    arousal: 'Arousal',
    modesty: 'Modesty',
    lewdity: 'Lewdity',
    exhibitionism: 'Exhibitionism',
    perversion: 'Perversion',
    dominance: 'Dominance',
    submissiveness: 'Submissiveness',
    comfort: 'Comfort',
    patience: 'Patience',
    focus: 'Focus'
};

/**
 * Get color for stat value
 * @param {number} value - Stat value
 * @param {string} statName - Stat name
 * @param {Object} colorSettings - Color settings
 * @returns {string} Hex color
 */
function getStatColor(value, statName, colorSettings = {}) {
    const lowColor = colorSettings.statBarColorLow || '#cc3333';
    const highColor = colorSettings.statBarColorHigh || '#33cc66';

    // Stats where higher is worse
    const inverseStats = ['hunger', 'bladder', 'bowel', 'pain', 'stress', 'anxiety',
                          'shame', 'corruption', 'jealousy', 'loneliness'];

    const isInverse = inverseStats.includes(statName);

    // Calculate percentage for color
    const percentage = value / 100;

    if (isInverse) {
        // Higher is worse - red at high values
        return interpolateColor(highColor, lowColor, percentage);
    } else {
        // Higher is better - green at high values
        return interpolateColor(lowColor, highColor, percentage);
    }
}

/**
 * Interpolate between two colors
 * @param {string} color1 - Start color (hex)
 * @param {string} color2 - End color (hex)
 * @param {number} factor - Interpolation factor (0-1)
 * @returns {string} Interpolated color (hex)
 */
function interpolateColor(color1, color2, factor) {
    const hex1 = color1.replace('#', '');
    const hex2 = color2.replace('#', '');

    const r1 = parseInt(hex1.substring(0, 2), 16);
    const g1 = parseInt(hex1.substring(2, 4), 16);
    const b1 = parseInt(hex1.substring(4, 6), 16);

    const r2 = parseInt(hex2.substring(0, 2), 16);
    const g2 = parseInt(hex2.substring(2, 4), 16);
    const b2 = parseInt(hex2.substring(4, 6), 16);

    const r = Math.round(r1 + (r2 - r1) * factor);
    const g = Math.round(g1 + (g2 - g1) * factor);
    const b = Math.round(b1 + (b2 - b1) * factor);

    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Get urgency class for stat
 * @param {number} value - Stat value
 * @param {string} statName - Stat name
 * @returns {string} CSS class
 */
function getUrgencyClass(value, statName) {
    // Stats where higher is critical
    const highCriticalStats = ['hunger', 'bladder', 'bowel', 'pain', 'stress', 'anxiety'];
    // Stats where lower is critical
    const lowCriticalStats = ['health', 'energy', 'sleep'];

    if (highCriticalStats.includes(statName)) {
        if (value >= 90) return 'stat-critical';
        if (value >= 70) return 'stat-urgent';
        if (value >= 50) return 'stat-warning';
    }

    if (lowCriticalStats.includes(statName)) {
        if (value <= 20) return 'stat-critical';
        if (value <= 30) return 'stat-urgent';
        if (value <= 40) return 'stat-warning';
    }

    return '';
}

/**
 * Render a single stat bar
 * @param {string} statName - Stat name
 * @param {number} value - Stat value
 * @param {Object} options - Rendering options
 * @returns {string} HTML string
 */
function renderStatBar(statName, value, options = {}) {
    const displayName = STAT_NAMES[statName] || statName;
    const color = getStatColor(value, statName, options.colorSettings);
    const urgencyClass = getUrgencyClass(value, statName);

    // Handle null loyalty
    if (value === null) {
        return `
            <div class="rpg-enhanced-stat ${urgencyClass}" data-stat="${statName}">
                <div class="stat-header">
                    <span class="stat-name">${displayName}</span>
                    <span class="stat-value">Not Earned</span>
                </div>
                <div class="stat-bar-container">
                    <div class="stat-bar stat-bar-empty"></div>
                </div>
            </div>
        `;
    }

    return `
        <div class="rpg-enhanced-stat ${urgencyClass}" data-stat="${statName}">
            <div class="stat-header">
                <span class="stat-name">${displayName}</span>
                <span class="stat-value">${value}/100</span>
            </div>
            <div class="stat-bar-container">
                <div class="stat-bar" style="width: ${value}%; background-color: ${color};"></div>
            </div>
        </div>
    `;
}

/**
 * Render a stat category
 * @param {string} categoryKey - Category key
 * @param {Object} stats - All stats
 * @param {Object} options - Rendering options
 * @returns {string} HTML string
 */
function renderStatCategory(categoryKey, stats, options = {}) {
    const category = STAT_CATEGORIES[categoryKey];
    if (!category) return '';

    const statsHtml = category.stats
        .filter(statName => stats[statName] !== undefined)
        .map(statName => renderStatBar(statName, stats[statName], options))
        .join('');

    const isCollapsed = options.collapsedCategories?.includes(categoryKey) || false;

    return `
        <div class="rpg-enhanced-category ${isCollapsed ? 'collapsed' : ''}" data-category="${categoryKey}">
            <div class="category-header" onclick="toggleStatCategory('${categoryKey}')">
                <span class="category-icon">${category.icon}</span>
                <span class="category-name">${category.name}</span>
                <span class="category-toggle">${isCollapsed ? '▶' : '▼'}</span>
            </div>
            <div class="category-content">
                ${statsHtml}
            </div>
        </div>
    `;
}

/**
 * Render priority indicators
 * @param {Array} priorities - Active priorities
 * @returns {string} HTML string
 */
function renderPriorityIndicators(priorities) {
    if (!priorities || priorities.length === 0) {
        return '';
    }

    const priorityHtml = priorities
        .filter(p => p.level <= 4) // Only show important priorities
        .map(p => {
            const levelClass = `priority-level-${p.level}`;
            return `
                <div class="priority-indicator ${levelClass}">
                    <span class="priority-level">L${p.level}</span>
                    <span class="priority-name">${p.name}</span>
                    <span class="priority-reason">${truncateReason(p.reason, 50)}</span>
                </div>
            `;
        })
        .join('');

    if (!priorityHtml) return '';

    return `
        <div class="rpg-enhanced-priorities">
            <div class="priorities-header">Active Priorities</div>
            ${priorityHtml}
        </div>
    `;
}

/**
 * Truncate reason text
 * @param {string} reason - Full reason
 * @param {number} maxLength - Max length
 * @returns {string} Truncated reason
 */
function truncateReason(reason, maxLength) {
    if (!reason) return '';
    if (reason.length <= maxLength) return reason;
    return reason.substring(0, maxLength - 3) + '...';
}

/**
 * Render scene context summary
 * @param {Object} scene - Scene context
 * @returns {string} HTML string
 */
function renderSceneContext(scene) {
    if (!scene) return '';

    const privacyClass = scene.privacy < 40 ? 'privacy-public' :
                         scene.privacy < 60 ? 'privacy-semi' : 'privacy-private';

    return `
        <div class="rpg-enhanced-scene">
            <div class="scene-header">Current Scene</div>
            <div class="scene-location">
                <span class="scene-icon">📍</span>
                <span class="scene-name">${scene.location || 'Unknown'}</span>
                <span class="scene-type">(${scene.locationType || 'Unknown'})</span>
            </div>
            <div class="scene-metrics">
                <div class="scene-metric ${privacyClass}">
                    <span class="metric-label">Privacy:</span>
                    <span class="metric-value">${scene.privacy}/100</span>
                </div>
                <div class="scene-metric">
                    <span class="metric-label">Safety:</span>
                    <span class="metric-value">${scene.safety}/100</span>
                </div>
            </div>
            <div class="scene-time">
                <span class="time-icon">🕐</span>
                <span class="time-value">${scene.time || '12:00 PM'}, ${scene.dayOfWeek || 'Day'}</span>
            </div>
            ${scene.peoplePresent?.length > 0 ? `
                <div class="scene-people">
                    <span class="people-icon">👥</span>
                    <span class="people-list">${scene.peoplePresent.join(', ')}</span>
                </div>
            ` : ''}
        </div>
    `;
}

/**
 * Render biology summary
 * @param {Object} biology - Biology data
 * @returns {string} HTML string
 */
function renderBiologySummary(biology) {
    if (!biology || !biology.cycleEnabled) return '';

    if (biology.pregnant) {
        return `
            <div class="rpg-enhanced-biology">
                <div class="biology-header">Biology</div>
                <div class="biology-status pregnant">
                    <span class="status-icon">🤰</span>
                    <span class="status-text">Pregnant - Day ${biology.pregnancyDay}</span>
                    <span class="status-detail">Trimester ${biology.pregnancyTrimester}</span>
                </div>
            </div>
        `;
    }

    const phaseClasses = {
        menstruating: 'phase-menstruating',
        follicular: 'phase-follicular',
        ovulating: 'phase-ovulating',
        luteal: 'phase-luteal'
    };

    const phaseClass = phaseClasses[biology.currentPhase] || '';

    return `
        <div class="rpg-enhanced-biology">
            <div class="biology-header">Biology</div>
            <div class="biology-cycle ${phaseClass}">
                <span class="cycle-day">Day ${biology.dayOfCycle}/${biology.cycleLength}</span>
                <span class="cycle-phase">${biology.currentPhase}</span>
                ${biology.fertilityWindow ? '<span class="fertility-warning">⚠️ Fertile</span>' : ''}
            </div>
            ${biology.symptoms?.length > 0 ? `
                <div class="biology-symptoms">
                    <span class="symptoms-label">Symptoms:</span>
                    <span class="symptoms-list">${biology.symptoms.join(', ')}</span>
                </div>
            ` : ''}
        </div>
    `;
}

/**
 * Render hair summary
 * @param {Object} hair - Hair data
 * @returns {string} HTML string
 */
function renderHairSummary(hair) {
    if (!hair) return '';

    const areas = ['pubic', 'armpits', 'legs', 'arms', 'assCrack'];
    const areaNames = {
        pubic: 'Pubic',
        armpits: 'Armpits',
        legs: 'Legs',
        arms: 'Arms',
        assCrack: 'Rear'
    };

    const hairBars = areas.map(area => {
        const value = hair[area]?.value ?? 0;
        const description = hair.getDescription?.(area) || '';

        return `
            <div class="hair-area" data-area="${area}">
                <div class="hair-header">
                    <span class="hair-name">${areaNames[area]}</span>
                    <span class="hair-value">${value}%</span>
                </div>
                <div class="hair-bar-container">
                    <div class="hair-bar" style="width: ${value}%"></div>
                </div>
                <div class="hair-description">${description}</div>
            </div>
        `;
    }).join('');

    return `
        <div class="rpg-enhanced-hair">
            <div class="hair-header-main">Hair Growth</div>
            ${hairBars}
        </div>
    `;
}

/**
 * Render outfit summary
 * @param {Object} outfit - Outfit data
 * @returns {string} HTML string
 */
function renderOutfitSummary(outfit) {
    if (!outfit) return '';

    const slots = [
        { key: 'top', icon: '👕', name: 'Top' },
        { key: 'bottom', icon: '👖', name: 'Bottom' },
        { key: 'bra', icon: '👙', name: 'Bra' },
        { key: 'underwear', icon: '🩲', name: 'Underwear' },
        { key: 'shoes', icon: '👟', name: 'Shoes' },
        { key: 'accessories', icon: '💍', name: 'Accessories' }
    ];

    const outfitItems = slots
        .filter(slot => outfit[slot.key]?.name)
        .map(slot => `
            <div class="outfit-item">
                <span class="outfit-icon">${slot.icon}</span>
                <span class="outfit-name">${outfit[slot.key].name}</span>
                ${outfit[slot.key].description ? `
                    <span class="outfit-desc">(${outfit[slot.key].description})</span>
                ` : ''}
            </div>
        `)
        .join('');

    if (!outfitItems && !outfit.overallDescription) {
        return '';
    }

    return `
        <div class="rpg-enhanced-outfit">
            <div class="outfit-header">Current Outfit</div>
            ${outfit.overallDescription ? `
                <div class="outfit-overall">${outfit.overallDescription}</div>
            ` : ''}
            ${outfitItems ? `
                <div class="outfit-items">${outfitItems}</div>
            ` : ''}
        </div>
    `;
}

/**
 * Sample default stats for preview when no chat is open
 */
const SAMPLE_STATS = {
    hunger: 45, bladder: 30, bowel: 25, health: 90, cleanliness: 70,
    willpower: 60, confidence: 60, pride: 60, shame: 10, jealousy: 20, loneliness: 30,
    morality: 80, corruption: 5, honesty: 80, loyalty: null,
    perversion: 10, lewdity: 30, exhibitionism: 5, modesty: 70,
    dominance: 40, submissiveness: 40, arousal: 30,
    stress: 20, anxiety: 20, energy: 70, sleep: 70, pain: 0,
    comfort: 60, patience: 60, focus: 60
};

const SAMPLE_SCENE = {
    location: 'Home', locationType: 'Home', privacy: 85, safety: 90,
    time: '10:30 AM', dayOfWeek: 'Monday', peoplePresent: []
};

const SAMPLE_OUTFIT = {
    top: { name: 'Casual T-shirt', description: 'Light blue' },
    bottom: { name: 'Jeans', description: 'Dark blue' },
    underwear: { name: 'Cotton panties', description: '' },
    bra: { name: 'Sports bra', description: '' },
    shoes: { name: 'Sneakers', description: '' },
    overallDescription: ''
};

const SAMPLE_HAIR = {
    pubic: { value: 15 },
    armpits: { value: 10 },
    legs: { value: 12 },
    arms: { value: 25 },
    assCrack: { value: 8 }
};

/**
 * Render full character stats panel
 * @param {Object} characterSystem - Character system instance
 * @param {Object} options - Rendering options
 * @returns {string} HTML string
 */
export function renderCharacterStatsPanel(characterSystem, options = {}) {
    const state = characterSystem?.getState?.();

    // Use sample data if no state available (for preview)
    const isPreview = !state;
    const stats = state?.stats?.toObject?.() || state?.stats || SAMPLE_STATS;
    const priorities = characterSystem?.getActivePriorities?.() || [];
    const scene = state?.scene?.toObject?.() || state?.scene || SAMPLE_SCENE;
    const hair = state?.hair || SAMPLE_HAIR;
    const outfit = state?.outfit || SAMPLE_OUTFIT;
    const biology = state?.biology || {};

    // Render all categories
    const categoriesHtml = Object.keys(STAT_CATEGORIES)
        .map(key => renderStatCategory(key, stats, options))
        .join('');

    return `
        <div class="rpg-enhanced-stats-panel ${isPreview ? 'preview-mode' : ''}">
            <div class="panel-header">
                <span class="character-name">${state?.characterName || 'Character'}</span>
                <span class="panel-title">Enhanced Stats${isPreview ? ' (Preview)' : ''}</span>
            </div>

            ${isPreview ? `
                <div class="preview-notice">
                    <i class="fa-solid fa-info-circle"></i>
                    <span>Open a chat to see live character data</span>
                </div>
            ` : ''}

            ${renderPriorityIndicators(priorities)}
            ${renderSceneContext(scene)}

            <div class="stats-categories">
                ${categoriesHtml}
            </div>

            ${options.showBiology !== false ? renderBiologySummary(biology) : ''}
            ${options.showHair !== false ? renderHairSummary(hair) : ''}
            ${options.showOutfit !== false ? renderOutfitSummary(outfit) : ''}
        </div>
    `;
}

/**
 * Render compact stats summary (for sidebar)
 * @param {Object} characterSystem - Character system instance
 * @param {Object} options - Rendering options
 * @returns {string} HTML string
 */
export function renderCompactStats(characterSystem, options = {}) {
    const state = characterSystem?.getState?.();
    if (!state) return '';

    const stats = state.stats || {};
    const priorities = characterSystem?.getActivePriorities?.() || [];
    const highestPriority = priorities[0];

    // Show only critical/urgent stats
    const critical = stats.getCriticalStats?.() || [];
    const urgent = stats.getUrgentStats?.() || [];

    const criticalHtml = critical.map(s => `
        <div class="compact-stat critical">
            <span class="stat-name">${STAT_NAMES[s.name] || s.name}</span>
            <span class="stat-value">${s.value}</span>
        </div>
    `).join('');

    const urgentHtml = urgent.map(s => `
        <div class="compact-stat urgent">
            <span class="stat-name">${STAT_NAMES[s.name] || s.name}</span>
            <span class="stat-value">${s.value}</span>
        </div>
    `).join('');

    // Always show key stats
    const keyStats = ['arousal', 'stress', 'energy'];
    const keyStatsHtml = keyStats.map(statName => {
        const value = stats[statName];
        if (value === undefined) return '';
        return `
            <div class="compact-stat">
                <span class="stat-name">${STAT_NAMES[statName]}</span>
                <span class="stat-value">${value}</span>
            </div>
        `;
    }).join('');

    return `
        <div class="rpg-enhanced-compact-stats">
            ${highestPriority && highestPriority.level <= 3 ? `
                <div class="compact-priority priority-level-${highestPriority.level}">
                    ${highestPriority.name}: ${truncateReason(highestPriority.reason, 30)}
                </div>
            ` : ''}
            ${criticalHtml}
            ${urgentHtml}
            ${keyStatsHtml}
        </div>
    `;
}

// Export for global access
export { STAT_CATEGORIES, STAT_NAMES };
