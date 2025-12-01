/**
 * Inventory Rendering Module
 * Handles UI rendering for inventory v2 system
 */

import { extensionSettings, $inventoryContainer } from '../../core/state.js';
import { getInventoryRenderOptions, restoreFormStates } from '../interaction/inventoryActions.js';
import { updateInventoryItem } from '../interaction/inventoryEdit.js';
import { parseItems } from '../../utils/itemParser.js';
import { i18n } from '../../core/i18n.js';

// Type imports
/** @typedef {import('../../types/inventory.js').InventoryV2} InventoryV2 */

/**
 * Converts a location name to a safe ID for use in HTML element IDs.
 * Must match the logic used in inventoryActions.js.
 * @param {string} locationName - The location name
 * @returns {string} Safe ID string
 */
export function getLocationId(locationName) {
    // Remove all non-alphanumeric characters except spaces, then replace spaces with hyphens
    return locationName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '-');
}

/**
 * Renders the inventory sub-tab navigation (On Person, Stored, Assets)
 * @param {string} activeTab - Currently active sub-tab ('onPerson', 'stored', 'assets')
 * @returns {string} HTML for sub-tab navigation
 */
export function renderInventorySubTabs(activeTab = 'onPerson') {
    return `
        <div class="rpg-inventory-subtabs">
            <button class="rpg-inventory-subtab ${activeTab === 'onPerson' ? 'active' : ''}" data-tab="onPerson" data-i18n-key="inventory.section.onPerson">
                ${i18n.getTranslation('inventory.section.onPerson')}
            </button>
            <button class="rpg-inventory-subtab ${activeTab === 'stored' ? 'active' : ''}" data-tab="stored" data-i18n-key="inventory.section.stored">
                ${i18n.getTranslation('inventory.section.stored')}
            </button>
            <button class="rpg-inventory-subtab ${activeTab === 'assets' ? 'active' : ''}" data-tab="assets" data-i18n-key="inventory.section.assets">
                ${i18n.getTranslation('inventory.section.assets')}
            </button>
        </div>
    `;
}

/**
 * Renders the "On Person" inventory view with list or grid display
 * @param {string} onPersonItems - Current on-person items (comma-separated string)
 * @param {string} viewMode - View mode ('list' or 'grid')
 * @returns {string} HTML for on-person view with items and add button
 */
export function renderOnPersonView(onPersonItems, viewMode = 'list') {
    const items = parseItems(onPersonItems);

    let itemsHtml = '';
    if (items.length === 0) {
        itemsHtml = `<div class="rpg-inventory-empty" data-i18n-key="inventory.onPerson.empty">${i18n.getTranslation('inventory.onPerson.empty')}</div>`;
    } else {
        if (viewMode === 'grid') {
            // Grid view: card-style items
            itemsHtml = items.map((item, index) => `
                <div class="rpg-item-card" data-field="onPerson" data-index="${index}">
                    <button class="rpg-item-remove" data-action="remove-item" data-field="onPerson" data-index="${index}" title="Remove item">
                        <i class="fa-solid fa-times"></i>
                    </button>
                    <span class="rpg-item-name rpg-editable" contenteditable="true" data-field="onPerson" data-index="${index}" title="Click to edit">${escapeHtml(item)}</span>
                </div>
            `).join('');
        } else {
            // List view: full-width rows
            itemsHtml = items.map((item, index) => `
                <div class="rpg-item-row" data-field="onPerson" data-index="${index}">
                    <span class="rpg-item-name rpg-editable" contenteditable="true" data-field="onPerson" data-index="${index}" title="Click to edit">${escapeHtml(item)}</span>
                    <button class="rpg-item-remove" data-action="remove-item" data-field="onPerson" data-index="${index}" title="Remove item">
                        <i class="fa-solid fa-times"></i>
                    </button>
                </div>
            `).join('');
        }
    }

    const listViewClass = viewMode === 'list' ? 'rpg-item-list-view' : 'rpg-item-grid-view';

    return `
        <div class="rpg-inventory-section" data-section="onPerson">
            <div class="rpg-inventory-header">
                <h4 data-i18n-key="inventory.onPerson.title">${i18n.getTranslation('inventory.onPerson.title')}</h4>
                <div class="rpg-inventory-header-actions">
                    <div class="rpg-view-toggle">
                        <button class="rpg-view-btn ${viewMode === 'list' ? 'active' : ''}" data-action="switch-view" data-field="onPerson" data-view="list" title="${i18n.getTranslation('global.listView')}">
                            <i class="fa-solid fa-list"></i>
                        </button>
                        <button class="rpg-view-btn ${viewMode === 'grid' ? 'active' : ''}" data-action="switch-view" data-field="onPerson" data-view="grid" title="${i18n.getTranslation('global.gridView')}">
                            <i class="fa-solid fa-th"></i>
                        </button>
                    </div>
                    <button class="rpg-inventory-add-btn" data-action="add-item" data-field="onPerson" title="Add new item">
                        <i class="fa-solid fa-plus"></i> <span data-i18n-key="inventory.onPerson.addItemButton">${i18n.getTranslation('inventory.onPerson.addItemButton')}</span>
                    </button>
                </div>
            </div>
            <div class="rpg-inventory-content">
                <div class="rpg-inline-form" id="rpg-add-item-form-onPerson" style="display: none;">
                    <input type="text" class="rpg-inline-input" id="rpg-new-item-onPerson" placeholder="${i18n.getTranslation('inventory.onPerson.addItemPlaceholder')}" data-i18n-placeholder-key="inventory.onPerson.addItemPlaceholder" />
                    <div class="rpg-inline-buttons">
                        <button class="rpg-inline-btn rpg-inline-cancel" data-action="cancel-add-item" data-field="onPerson">
                            <i class="fa-solid fa-times"></i> <span data-i18n-key="global.cancel">${i18n.getTranslation('global.cancel')}</span>
                        </button>
                        <button class="rpg-inline-btn rpg-inline-save" data-action="save-add-item" data-field="onPerson">
                            <i class="fa-solid fa-check"></i> <span data-i18n-key="global.add">${i18n.getTranslation('global.add')}</span>
                        </button>
                    </div>
                </div>
                <div class="rpg-item-list ${listViewClass}">
                    ${itemsHtml}
                </div>
            </div>
        </div>
    `;
}

/**
 * Renders the "Stored" inventory view with collapsible locations and list/grid views
 * @param {Object.<string, string>} stored - Stored items by location
 * @param {string[]} collapsedLocations - Array of collapsed location names
 * @param {string} viewMode - View mode ('list' or 'grid')
 * @returns {string} HTML for stored inventory with all locations
 */
export function renderStoredView(stored, collapsedLocations = [], viewMode = 'list') {
    const locations = Object.keys(stored || {});

    let html = `
        <div class="rpg-inventory-section" data-section="stored">
            <div class="rpg-inventory-header">
                <h4 data-i18n-key="inventory.stored.title">${i18n.getTranslation('inventory.stored.title')}</h4>
                <div class="rpg-inventory-header-actions">
                    <div class="rpg-view-toggle">
                        <button class="rpg-view-btn ${viewMode === 'list' ? 'active' : ''}" data-action="switch-view" data-field="stored" data-view="list" title="${i18n.getTranslation('global.listView')}">
                            <i class="fa-solid fa-list"></i>
                        </button>
                        <button class="rpg-view-btn ${viewMode === 'grid' ? 'active' : ''}" data-action="switch-view" data-field="stored" data-view="grid" title="${i18n.getTranslation('global.gridView')}">
                            <i class="fa-solid fa-th"></i>
                        </button>
                    </div>
                    <button class="rpg-inventory-add-btn" data-action="add-location" title="Add new storage location">
                        <i class="fa-solid fa-plus"></i> <span data-i18n-key="inventory.stored.addLocationButton">${i18n.getTranslation('inventory.stored.addLocationButton')}</span>
                    </button>
                </div>
            </div>
            <div class="rpg-inventory-content">
                <div class="rpg-inline-form" id="rpg-add-location-form" style="display: none;">
                    <input type="text" class="rpg-inline-input" id="rpg-new-location-name" placeholder="${i18n.getTranslation('inventory.stored.addLocationPlaceholder')}" data-i18n-placeholder-key="inventory.stored.addLocationPlaceholder" />
                    <div class="rpg-inline-buttons">
                        <button class="rpg-inline-btn rpg-inline-cancel" data-action="cancel-add-location">
                            <i class="fa-solid fa-times"></i> <span data-i18n-key="global.cancel">${i18n.getTranslation('global.cancel')}</span>
                        </button>
                        <button class="rpg-inline-btn rpg-inline-save" data-action="save-add-location">
                            <i class="fa-solid fa-check"></i> <span data-i18n-key="inventory.stored.saveButton">${i18n.getTranslation('inventory.stored.saveButton')}</span>
                        </button>
                    </div>
                </div>
    `;

    if (locations.length === 0) {
        html += `
                <div class="rpg-inventory-empty" data-i18n-key="inventory.stored.empty">
                    ${i18n.getTranslation('inventory.stored.empty')}
                </div>
        `;
    } else {
        for (const location of locations) {
            const itemString = stored[location];
            const items = parseItems(itemString);
            const isCollapsed = collapsedLocations.includes(location);
            const locationId = getLocationId(location);

            let itemsHtml = '';
            if (items.length === 0) {
                itemsHtml = `<div class="rpg-inventory-empty" data-i18n-key="inventory.stored.noItems">${i18n.getTranslation('inventory.stored.noItems')}</div>`;
            } else {
                if (viewMode === 'grid') {
                    // Grid view: card-style items
                    itemsHtml = items.map((item, index) => `
                        <div class="rpg-item-card" data-field="stored" data-location="${escapeHtml(location)}" data-index="${index}">
                            <button class="rpg-item-remove" data-action="remove-item" data-field="stored" data-location="${escapeHtml(location)}" data-index="${index}" title="Remove item">
                                <i class="fa-solid fa-times"></i>
                            </button>
                            <span class="rpg-item-name rpg-editable" contenteditable="true" data-field="stored" data-location="${escapeHtml(location)}" data-index="${index}" title="Click to edit">${escapeHtml(item)}</span>
                        </div>
                    `).join('');
                } else {
                    // List view: full-width rows
                    itemsHtml = items.map((item, index) => `
                        <div class="rpg-item-row" data-field="stored" data-location="${escapeHtml(location)}" data-index="${index}">
                            <span class="rpg-item-name rpg-editable" contenteditable="true" data-field="stored" data-location="${escapeHtml(location)}" data-index="${index}" title="Click to edit">${escapeHtml(item)}</span>
                            <button class="rpg-item-remove" data-action="remove-item" data-field="stored" data-location="${escapeHtml(location)}" data-index="${index}" title="Remove item">
                                <i class="fa-solid fa-times"></i>
                            </button>
                        </div>
                    `).join('');
                }
            }

            const listViewClass = viewMode === 'list' ? 'rpg-item-list-view' : 'rpg-item-grid-view';

            html += `
                <div class="rpg-storage-location ${isCollapsed ? 'collapsed' : ''}" data-location="${escapeHtml(location)}">
                    <div class="rpg-storage-header">
                        <button class="rpg-storage-toggle" data-action="toggle-location" data-location="${escapeHtml(location)}">
                            <i class="fa-solid fa-chevron-${isCollapsed ? 'right' : 'down'}"></i>
                        </button>
                        <h5 class="rpg-storage-name">${escapeHtml(location)}</h5>
                        <div class="rpg-storage-actions">
                            <button class="rpg-inventory-remove-btn" data-action="remove-location" data-location="${escapeHtml(location)}" title="Remove this storage location">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    <div class="rpg-storage-content" ${isCollapsed ? 'style="display:none;"' : ''}>
                        <div class="rpg-inline-form" id="rpg-add-item-form-stored-${locationId}" style="display: none;">
                            <input type="text" class="rpg-inline-input rpg-location-item-input" data-location="${escapeHtml(location)}" placeholder="${i18n.getTranslation('inventory.stored.addItemToLocationPlaceholder')}" data-i18n-placeholder-key="inventory.stored.addItemToLocationPlaceholder" />
                            <div class="rpg-inline-buttons">
                                <button class="rpg-inline-btn rpg-inline-cancel" data-action="cancel-add-item" data-field="stored" data-location="${escapeHtml(location)}">
                                    <i class="fa-solid fa-times"></i> <span data-i18n-key="global.cancel">${i18n.getTranslation('global.cancel')}</span>
                                </button>
                                <button class="rpg-inline-btn rpg-inline-save" data-action="save-add-item" data-field="stored" data-location="${escapeHtml(location)}">
                                    <i class="fa-solid fa-check"></i> <span data-i18n-key="global.add">${i18n.getTranslation('global.add')}</span>
                                </button>
                            </div>
                        </div>
                        <div class="rpg-item-list ${listViewClass}">
                            ${itemsHtml}
                        </div>
                        <div class="rpg-storage-add-item-container">
                            <button class="rpg-inventory-add-btn" data-action="add-item" data-field="stored" data-location="${escapeHtml(location)}" title="Add item to this location">
                                <i class="fa-solid fa-plus"></i> <span data-i18n-key="inventory.stored.addItemButton">${i18n.getTranslation('inventory.stored.addItemButton')}</span>
                            </button>
                        </div>
                    </div>
                    <div class="rpg-inline-confirmation" id="rpg-remove-confirm-${locationId}" style="display: none;">
                        <p>${i18n.getTranslation('inventory.stored.confirmRemoveLocationMessage', { location: escapeHtml(location) })}</p>
                        <div class="rpg-inline-buttons">
                            <button class="rpg-inline-btn rpg-inline-cancel" data-action="cancel-remove-location" data-location="${escapeHtml(location)}">
                                <i class="fa-solid fa-times"></i> <span data-i18n-key="global.cancel">${i18n.getTranslation('global.cancel')}</span>
                            </button>
                            <button class="rpg-inline-btn rpg-inline-confirm" data-action="confirm-remove-location" data-location="${escapeHtml(location)}">
                                <i class="fa-solid fa-check"></i> <span data-i18n-key="inventory.stored.confirmRemoveLocationConfirmButton">${i18n.getTranslation('inventory.stored.confirmRemoveLocationConfirmButton')}</span>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    html += `
            </div>
        </div>
    `;

    return html;
}

/**
 * Renders the "Assets" inventory view with list or grid display
 * @param {string} assets - Current assets (vehicles, property, equipment)
 * @param {string} viewMode - View mode ('list' or 'grid')
 * @returns {string} HTML for assets view with items and add button
 */
export function renderAssetsView(assets, viewMode = 'list') {
    const items = parseItems(assets);

    let itemsHtml = '';
    if (items.length === 0) {
        itemsHtml = `<div class="rpg-inventory-empty" data-i18n-key="inventory.assets.empty">${i18n.getTranslation('inventory.assets.empty')}</div>`;
    } else {
        if (viewMode === 'grid') {
            // Grid view: card-style items
            itemsHtml = items.map((item, index) => `
                <div class="rpg-item-card" data-field="assets" data-index="${index}">
                    <button class="rpg-item-remove" data-action="remove-item" data-field="assets" data-index="${index}" title="Remove asset">
                        <i class="fa-solid fa-times"></i>
                    </button>
                    <span class="rpg-item-name rpg-editable" contenteditable="true" data-field="assets" data-index="${index}" title="Click to edit">${escapeHtml(item)}</span>
                </div>
            `).join('');
        } else {
            // List view: full-width rows
            itemsHtml = items.map((item, index) => `
                <div class="rpg-item-row" data-field="assets" data-index="${index}">
                    <span class="rpg-item-name rpg-editable" contenteditable="true" data-field="assets" data-index="${index}" title="Click to edit">${escapeHtml(item)}</span>
                    <button class="rpg-item-remove" data-action="remove-item" data-field="assets" data-index="${index}" title="${i18n.getTranslation('inventory.assets.removeAssetTitle')}">
                        <i class="fa-solid fa-times"></i>
                    </button>
                </div>
            `).join('');
        }
    }

    const listViewClass = viewMode === 'list' ? 'rpg-item-list-view' : 'rpg-item-grid-view';

    return `
        <div class="rpg-inventory-section" data-section="assets">
            <div class="rpg-inventory-header">
                <h4 data-i18n-key="inventory.assets.title">${i18n.getTranslation('inventory.assets.title')}</h4>
                <div class="rpg-inventory-header-actions">
                    <div class="rpg-view-toggle">
                        <button class="rpg-view-btn ${viewMode === 'list' ? 'active' : ''}" data-action="switch-view" data-field="assets" data-view="list" title="${i18n.getTranslation('global.listView')}">
                            <i class="fa-solid fa-list"></i>
                        </button>
                        <button class="rpg-view-btn ${viewMode === 'grid' ? 'active' : ''}" data-action="switch-view" data-field="assets" data-view="grid" title="${i18n.getTranslation('global.gridView')}">
                            <i class="fa-solid fa-th"></i>
                        </button>
                    </div>
                    <button class="rpg-inventory-add-btn" data-action="add-item" data-field="assets" title="Add new asset">
                        <i class="fa-solid fa-plus"></i> <span data-i18n-key="inventory.assets.addAssetButton">${i18n.getTranslation('inventory.assets.addAssetButton')}</span>
                    </button>
                </div>
            </div>
            <div class="rpg-inventory-content">
                <div class="rpg-inline-form" id="rpg-add-item-form-assets" style="display: none;">
                    <input type="text" class="rpg-inline-input" id="rpg-new-item-assets" placeholder="${i18n.getTranslation('inventory.assets.addAssetPlaceholder')}" data-i18n-placeholder-key="inventory.assets.addAssetPlaceholder" />
                    <div class="rpg-inline-buttons">
                        <button class="rpg-inline-btn rpg-inline-cancel" data-action="cancel-add-item" data-field="assets">
                            <i class="fa-solid fa-times"></i> <span data-i18n-key="global.cancel">${i18n.getTranslation('global.cancel')}</span>
                        </button>
                        <button class="rpg-inline-btn rpg-inline-save" data-action="save-add-item" data-field="assets">
                            <i class="fa-solid fa-check"></i> <span data-i18n-key="global.add">${i18n.getTranslation('global.add')}</span>
                        </button>
                    </div>
                </div>
                <div class="rpg-item-list ${listViewClass}">
                    ${itemsHtml}
                </div>
                <div class="rpg-inventory-hint">
                    <i class="fa-solid fa-info-circle"></i>
                    <span data-i18n-key="inventory.assets.description">${i18n.getTranslation('inventory.assets.description')}</span>
                </div>
            </div>
        </div>
    `;
}

/**
 * Generates inventory HTML (internal helper)
 * @param {InventoryV2} inventory - Inventory data to render
 * @param {Object} options - Rendering options
 * @param {string} options.activeSubTab - Currently active sub-tab ('onPerson', 'stored', 'assets')
 * @param {string[]} options.collapsedLocations - Collapsed storage locations
 * @returns {string} Complete HTML for inventory tab content
 */
function generateInventoryHTML(inventory, options = {}) {
    const {
        activeSubTab = 'onPerson',
        collapsedLocations = []
    } = options;

    // Handle legacy v1 format - convert to v2 for display
    let v2Inventory = inventory;
    if (typeof inventory === 'string') {
        v2Inventory = {
            version: 2,
            onPerson: inventory,
            stored: {},
            assets: 'None'
        };
    }

    // Ensure v2 structure has all required fields
    if (!v2Inventory || typeof v2Inventory !== 'object') {
        v2Inventory = {
            version: 2,
            onPerson: 'None',
            stored: {},
            assets: 'None'
        };
    }

    // Additional safety check: ensure required properties exist and are correct type
    if (!v2Inventory.onPerson || typeof v2Inventory.onPerson !== 'string') {
        v2Inventory.onPerson = 'None';
    }
    if (!v2Inventory.stored || typeof v2Inventory.stored !== 'object' || Array.isArray(v2Inventory.stored)) {
        v2Inventory.stored = {};
    }
    if (!v2Inventory.assets || typeof v2Inventory.assets !== 'string') {
        v2Inventory.assets = 'None';
    }

    let html = `
        <div class="rpg-inventory-container">
            ${renderInventorySubTabs(activeSubTab)}
            <div class="rpg-inventory-views">
    `;

    // Get view modes from settings (default to 'list')
    const viewModes = extensionSettings.inventoryViewModes || {
        onPerson: 'list',
        stored: 'list',
        assets: 'list'
    };

    // Render the active view
    switch (activeSubTab) {
        case 'onPerson':
            html += renderOnPersonView(v2Inventory.onPerson, viewModes.onPerson);
            break;
        case 'stored':
            html += renderStoredView(v2Inventory.stored, collapsedLocations, viewModes.stored);
            break;
        case 'assets':
            html += renderAssetsView(v2Inventory.assets, viewModes.assets);
            break;
        default:
            html += renderOnPersonView(v2Inventory.onPerson, viewModes.onPerson);
    }

    html += `
            </div>
        </div>
    `;

    return html;
}

/**
 * Updates the inventory display in the DOM (used by inventoryActions)
 * @param {string} containerId - ID of container element to update
 * @param {Object} options - Rendering options (passed to generateInventoryHTML)
 */
export function updateInventoryDisplay(containerId, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.warn(`[RPG Companion] Inventory container not found: ${containerId}`);
        return;
    }

    const inventory = extensionSettings.userStats.inventory;
    const html = generateInventoryHTML(inventory, options);
    container.innerHTML = html;

    // Restore form states after re-rendering
    restoreFormStates();
}

/**
 * Main inventory rendering function (matches pattern of other render functions)
 * Gets data from state/settings and updates DOM directly.
 * Call this after AI generation, character changes, or swipes.
 */
export function renderInventory() {
    // Early return if container doesn't exist or section is hidden
    if (!$inventoryContainer || !extensionSettings.showInventory) {
        return;
    }

    // Get inventory data from settings
    const inventory = extensionSettings.userStats.inventory;

    // Get current render options (active tab, collapsed locations)
    const options = getInventoryRenderOptions();

    // Generate HTML and update DOM
    const html = generateInventoryHTML(inventory, options);
    $inventoryContainer.html(html);

    // Restore form states after re-rendering (fixes Bug #1)
    restoreFormStates();

    // Event listener for editing item names (mobile-friendly contenteditable)
    $inventoryContainer.find('.rpg-item-name.rpg-editable').on('blur', function() {
        const field = $(this).data('field');
        const index = parseInt($(this).data('index'));
        const location = $(this).data('location');
        const newName = $(this).text().trim();
        updateInventoryItem(field, index, newName, location);
    });
}

/**
 * Escapes HTML special characters to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
