/**
 * Layout Management Module
 *
 * The panel never moves or resizes SillyTavern's own elements. Instead it picks
 * one of three modes from the space actually available:
 *
 *  - docked:   the gutter beside the chat (#sheld) is wide enough, so the panel
 *              fills it, like ST's own pinned side drawers. Collapses to a slim strip.
 *  - floating: the gutter is too narrow (small laptops, wide chat setting), so the
 *              panel becomes a drawer that slides over the edge of the chat and
 *              starts collapsed to an edge handle.
 *  - mobile:   at ST's own mobile breakpoint; same drawer, opened by the FAB,
 *              with a backdrop.
 *
 * "top" position is always a floating drop-down under the top bar.
 */

import {
    extensionSettings,
    $panelContainer,
    $userStatsContainer,
    $infoBoxContainer,
    $thoughtsContainer,
    $musicPlayerContainer,
    setInventoryContainer,
    setQuestsContainer,
    lastGeneratedData,
    committedTrackerData
} from '../../core/state.js';
import { i18n } from '../../core/i18n.js';
import { updateStripWidgets } from './desktop.js';

/** Matches SillyTavern's own mobile breakpoint (css/mobile-styles.css). */
const MOBILE_BREAKPOINT = 1000;
/** Narrowest gutter (in rem) the panel will dock into before switching to floating. */
const MIN_DOCK_REM = 18;
/** Widest the docked panel grows (in rem), even on very large screens. */
const MAX_DOCK_REM = 30;

let currentMode = null;
let collapsed = false;
let layoutObserverStarted = false;

function remPx() {
    return parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
}

function getPosition() {
    const pos = extensionSettings.panelPosition;
    return pos === 'left' || pos === 'top' ? pos : 'right';
}

/**
 * Width of the free space between the chat column and the screen edge.
 */
function getGutterWidth(position) {
    const sheld = document.getElementById('sheld');
    if (!sheld) return 0;
    const rect = sheld.getBoundingClientRect();
    return position === 'left' ? rect.left : window.innerWidth - rect.right;
}

function computeMode() {
    if (window.innerWidth <= MOBILE_BREAKPOINT) return 'mobile';
    const position = getPosition();
    if (position === 'top') return 'floating';
    return getGutterWidth(position) >= MIN_DOCK_REM * remPx() ? 'docked' : 'floating';
}

export function isMobileLayout() {
    return (currentMode ?? computeMode()) === 'mobile';
}

export function getLayoutMode() {
    return currentMode ?? computeMode();
}

/**
 * Applies mode, position, and docked width to the panel. Cheap; safe to call often.
 */
export function applyLayout() {
    const panel = $panelContainer?.[0];
    if (!panel) return;

    const mode = computeMode();
    const position = getPosition();
    const modeChanged = mode !== currentMode;

    if (modeChanged) {
        // Floating and mobile start closed so they never cover the chat unasked;
        // docked starts open since it only uses empty space.
        collapsed = mode !== 'docked';
        currentMode = mode;
    }

    panel.dataset.rpgMode = mode;
    panel.classList.remove('rpg-position-left', 'rpg-position-right', 'rpg-position-top');
    panel.classList.add(`rpg-position-${position}`);
    panel.classList.toggle('rpg-collapsed', collapsed);

    if (mode === 'docked') {
        const width = Math.min(getGutterWidth(position), MAX_DOCK_REM * remPx());
        panel.style.setProperty('--rpg-dock-width', `${Math.floor(width)}px`);
    } else {
        panel.style.removeProperty('--rpg-dock-width');
    }

    // The FAB is the opener on mobile; the edge handle everywhere else.
    $('#rpg-mobile-toggle')
        .css('display', extensionSettings.enabled && mode === 'mobile' ? 'flex' : 'none')
        .toggleClass('active', mode === 'mobile' && !collapsed);
    $('.rpg-mobile-overlay').toggle(mode === 'mobile' && !collapsed);
    $('body').toggleClass('rpg-fab-panel-open', mode === 'mobile' && !collapsed);

    updateCollapseToggleIcon();
}

/**
 * Opens or closes the panel (strip / handle / drawer depending on mode).
 * @param {boolean} [force] - true to collapse, false to expand
 */
export function togglePanelCollapsed(force) {
    collapsed = typeof force === 'boolean' ? force : !collapsed;
    if (collapsed) updateStripWidgets();
    applyLayout();
}

/** Kept for callers that close the mobile drawer explicitly. */
export function closeMobilePanelWithAnimation() {
    togglePanelCollapsed(true);
}

/**
 * Points the header chevron and edge handle in the direction the panel will move.
 */
export function updateCollapseToggleIcon() {
    const position = getPosition();
    const away = { left: 'fa-chevron-left', right: 'fa-chevron-right', top: 'fa-chevron-up' }[position];
    const toward = { left: 'fa-chevron-right', right: 'fa-chevron-left', top: 'fa-chevron-down' }[position];
    const all = 'fa-chevron-left fa-chevron-right fa-chevron-up fa-chevron-down';
    $('#rpg-collapse-toggle i').removeClass(all).addClass(away);
    $('#rpg-expand-handle i').removeClass(all).addClass(toward);
}

/**
 * Wires the collapse controls, tabs, and the observers that keep the layout in sync.
 */
export function setupCollapseToggle() {
    const collapseTitle = i18n.getTranslation('template.mainPanel.collapseExpand') || 'Collapse/Expand panel';
    $('#rpg-collapse-toggle, #rpg-expand-handle').attr('title', collapseTitle);

    $('#rpg-collapse-toggle').on('click', (e) => {
        e.preventDefault();
        togglePanelCollapsed(true);
    });
    $('#rpg-expand-handle').on('click', (e) => {
        e.preventDefault();
        togglePanelCollapsed(false);
    });

    if (!$('.rpg-mobile-overlay').length) {
        $('<div class="rpg-mobile-overlay"></div>').hide().appendTo('body')
            .on('click', () => togglePanelCollapsed(true));
    }

    setupPanelTabs();
    startLayoutObserver();
    applyLayout();
}

/**
 * Tab bar. Tabs are static markup; this only switches the active pane.
 */
function setupPanelTabs() {
    const $panel = $('#rpg-companion-panel');
    $panel.on('click', '.rpg-tabs-nav .rpg-tab-btn', function () {
        selectTab($(this).data('tab'));
    });
}

function selectTab(tabName) {
    const $panel = $('#rpg-companion-panel');
    $panel.find('.rpg-tab-btn').each(function () {
        const active = $(this).data('tab') === tabName;
        $(this).toggleClass('active', active).attr('aria-selected', String(active));
    });
    $panel.find('.rpg-tab-content').each(function () {
        $(this).toggleClass('active', $(this).data('tab-content') === tabName);
    });
}

/**
 * Re-evaluates the layout when the window or the chat column changes size
 * (ST's chat-width slider resizes #sheld without a window resize).
 */
function startLayoutObserver() {
    if (layoutObserverStarted) return;
    layoutObserverStarted = true;

    let frame = null;
    const schedule = () => {
        if (frame) return;
        frame = requestAnimationFrame(() => {
            frame = null;
            applyLayout();
        });
    };

    window.addEventListener('resize', schedule);
    const sheld = document.getElementById('sheld');
    if (sheld && 'ResizeObserver' in window) {
        new ResizeObserver(schedule).observe(sheld);
    }
}

/**
 * Toggles the visibility of plot buttons based on settings.
 */
export function togglePlotButtons() {
    if (!extensionSettings.enabled) {
        $('#rpg-plot-buttons').hide();
        return;
    }

    const showRandom = !!extensionSettings.enableRandomizedPlot;
    const showNatural = !!extensionSettings.enableNaturalPlot;
    const showEncounter = !!extensionSettings.encounterSettings?.enabled;

    $('#rpg-plot-random').toggle(showRandom);
    $('#rpg-plot-natural').toggle(showNatural);
    $('#rpg-encounter-button').toggle(showEncounter);
    $('#rpg-plot-buttons').toggle(showRandom || showNatural || showEncounter);
}

/**
 * Updates the visibility of the entire panel.
 */
export function updatePanelVisibility() {
    if (extensionSettings.enabled) {
        $panelContainer.show();
        togglePlotButtons();
        applyLayout();
    } else {
        $panelContainer.hide();
        $('#rpg-plot-buttons').hide();
        $('#rpg-mobile-toggle').hide();
        $('.rpg-mobile-overlay').hide();
    }
}

/**
 * Updates the visibility of individual sections and their tabs.
 */
export function updateSectionVisibility() {
    setInventoryContainer($('#rpg-inventory'));
    setQuestsContainer($('#rpg-quests'));

    const hasInfoBoxData = !!(lastGeneratedData.infoBox || committedTrackerData.infoBox);

    $userStatsContainer?.toggle(!!extensionSettings.showUserStats);
    $infoBoxContainer?.toggle(!!extensionSettings.showInfoBox && hasInfoBoxData);
    $thoughtsContainer?.toggle(!!extensionSettings.showCharacterThoughts);
    $musicPlayerContainer?.toggle(!!extensionSettings.enableSpotifyMusic);

    const tabs = {
        status: !!(extensionSettings.showUserStats || extensionSettings.showInfoBox || extensionSettings.showCharacterThoughts),
        inventory: !!extensionSettings.showInventory,
        quests: !!extensionSettings.showQuests
    };
    $('#rpg-inventory').toggle(tabs.inventory);
    $('#rpg-quests').toggle(tabs.quests);

    const $panel = $('#rpg-companion-panel');
    for (const [name, visible] of Object.entries(tabs)) {
        $panel.find(`.rpg-tab-btn[data-tab="${name}"]`).toggle(visible);
    }
    // The tab bar is pointless with a single tab.
    const visibleTabs = Object.keys(tabs).filter(name => tabs[name]);
    $panel.find('.rpg-tabs-nav').toggle(visibleTabs.length > 1);

    // If the active tab was just hidden, fall back to the first visible one.
    const active = $panel.find('.rpg-tab-btn.active').data('tab');
    if (visibleTabs.length && !tabs[active]) selectTab(visibleTabs[0]);
}

/**
 * Applies the selected panel position.
 */
export function applyPanelPosition() {
    // A position change can change the mode, so re-derive the collapsed default.
    currentMode = null;
    applyLayout();
}

/**
 * Updates the UI based on generation mode selection.
 */
export function updateGenerationModeUI() {
    const mode = extensionSettings.generationMode;
    const usesSeparateRequest = mode === 'separate' || mode === 'external';

    $('#rpg-manual-update, #rpg-strip-refresh').toggle(usesSeparateRequest);
    $('#rpg-external-api-settings')[mode === 'external' ? 'slideDown' : 'slideUp'](200);
    $('#rpg-separate-mode-settings')[usesSeparateRequest ? 'slideDown' : 'slideUp'](200);
    $('#rpg-auto-update-container')[usesSeparateRequest ? 'slideDown' : 'slideUp'](200);
}
