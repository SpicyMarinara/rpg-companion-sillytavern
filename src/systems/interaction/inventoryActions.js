/**
 * Inventory Actions Module
 * Handles all user interactions with the inventory v2 system
 */

import { extensionSettings, lastGeneratedData, committedTrackerData } from '../../core/state.js';
import { saveSettings, saveChatData, updateMessageSwipeData } from '../../core/persistence.js';
import { buildInventorySummary } from '../generation/promptBuilder.js';
import { buildUserStatsText } from '../rendering/userStats.js';
import { renderInventory, getLocationId } from '../rendering/inventory.js';
import { parseItems, serializeItems } from '../../utils/itemParser.js';
import { sanitizeLocationName, sanitizeItemName } from '../../utils/security.js';

// Type imports
/** @typedef {import('../../types/inventory.js').InventoryV2} InventoryV2 */

/**
 * Current active sub-tab for inventory UI
 * @type {string}
 */
let currentActiveSubTab = 'onPerson';

/**
 * Array of collapsed storage location names
 * @type {string[]}
 */
let collapsedLocations = [];

/**
 * Tracks which inline forms are currently open
 * @type {Object}
 */
let openForms = {
    addLocation: false,
    addItemOnPerson: false,
    addItemStored: {}, // { [locationName]: true/false }
    addItemAssets: false
};

/**
 * Updates lastGeneratedData.userStats AND committedTrackerData.userStats to include
 * current inventory in text format.
 * This ensures manual edits are immediately visible to AI in next generation.
 */
function updateLastGeneratedDataInventory() {
    // Rebuild the userStats text format using custom stat names
    const statsText = buildUserStatsText();

    // Update BOTH lastGeneratedData AND committedTrackerData
    // This makes manual edits immediately visible to AI
    lastGeneratedData.userStats = statsText;
    committedTrackerData.userStats = statsText;
}

/**
 * Shows the inline form for adding a new item.
 * @param {string} field - Field name ('onPerson', 'stored', 'assets')
 * @param {string} [location] - Location name (required for 'stored' field)
 */
export function showAddItemForm(field, location) {
    let formId;
    let inputId;

    if (field === 'stored') {
        const locationId = getLocationId(location);
        formId = `rpg-add-item-form-stored-${locationId}`;
        inputId = `.rpg-location-item-input[data-location="${location}"]`;
        // Track in state
        if (!openForms.addItemStored) openForms.addItemStored = {};
        openForms.addItemStored[location] = true;
    } else {
        formId = `rpg-add-item-form-${field}`;
        inputId = `#rpg-new-item-${field}`;
        // Track in state
        if (field === 'onPerson') {
            openForms.addItemOnPerson = true;
        } else if (field === 'assets') {
            openForms.addItemAssets = true;
        }
    }

    const form = $(`#${formId}`);
    const input = $(inputId);

    form.show();
    input.val('').focus();
}

/**
 * Hides the inline form for adding a new item.
 * @param {string} field - Field name ('onPerson', 'stored', 'assets')
 * @param {string} [location] - Location name (required for 'stored' field)
 */
export function hideAddItemForm(field, location) {
    let formId;
    let inputId;

    if (field === 'stored') {
        const locationId = getLocationId(location);
        formId = `rpg-add-item-form-stored-${locationId}`;
        inputId = `.rpg-location-item-input[data-location="${location}"]`;
        // Clear from state
        if (openForms.addItemStored && openForms.addItemStored[location]) {
            delete openForms.addItemStored[location];
        }
    } else {
        formId = `rpg-add-item-form-${field}`;
        inputId = `#rpg-new-item-${field}`;
        // Clear from state
        if (field === 'onPerson') {
            openForms.addItemOnPerson = false;
        } else if (field === 'assets') {
            openForms.addItemAssets = false;
        }
    }

    const form = $(`#${formId}`);
    const input = $(inputId);

    form.hide();
    input.val('');
}

/**
 * Adds a new item to the inventory.
 * @param {string} field - Field name ('onPerson', 'stored', 'assets')
 * @param {string} [location] - Location name (required for 'stored' field)
 */
export function saveAddItem(field, location) {
    const inventory = extensionSettings.userStats.inventory;
    let inputId;

    if (field === 'stored') {
        inputId = `.rpg-location-item-input[data-location="${location}"]`;
    } else {
        inputId = `#rpg-new-item-${field}`;
    }

    const input = $(inputId);
    const rawItemName = input.val().trim();

    if (!rawItemName) {
        hideAddItemForm(field, location);
        return;
    }

    // Security: Validate and sanitize item name
    const itemName = sanitizeItemName(rawItemName);
    if (!itemName) {
        alert('Invalid item name.');
        hideAddItemForm(field, location);
        return;
    }

    // Get current items, add new one, serialize back
    let currentString;
    if (field === 'stored') {
        currentString = inventory.stored[location] || 'None';
    } else {
        currentString = inventory[field] || 'None';
    }

    const items = parseItems(currentString);
    items.push(itemName);
    const newString = serializeItems(items);

    // Save back to inventory
    if (field === 'stored') {
        inventory.stored[location] = newString;
    } else {
        inventory[field] = newString;
    }

    updateLastGeneratedDataInventory();
    saveSettings();
    saveChatData();
    updateMessageSwipeData();

    // Hide form and re-render
    hideAddItemForm(field, location);
    renderInventory();
}

/**
 * Removes an item from the inventory.
 * @param {string} field - Field name ('onPerson', 'stored', 'assets')
 * @param {number} itemIndex - Index of item to remove
 * @param {string} [location] - Location name (required for 'stored' field)
 */
export function removeItem(field, itemIndex, location) {
    const inventory = extensionSettings.userStats.inventory;

    // console.log('[RPG Companion] DEBUG removeItem called:', { field, itemIndex, location });

    // Get current items, remove the one at index, serialize back
    let currentString;
    if (field === 'stored') {
        currentString = inventory.stored[location] || 'None';
    } else {
        currentString = inventory[field] || 'None';
    }

    // console.log('[RPG Companion] DEBUG currentString before removal:', currentString);

    const items = parseItems(currentString);
    // console.log('[RPG Companion] DEBUG items array before removal:', items);

    items.splice(itemIndex, 1); // Remove item at index
    // console.log('[RPG Companion] DEBUG items array after removal:', items);

    const newString = serializeItems(items);
    // console.log('[RPG Companion] DEBUG newString after removal:', newString);

    // Save back to inventory
    if (field === 'stored') {
        inventory.stored[location] = newString;
    } else {
        inventory[field] = newString;
    }

    // console.log('[RPG Companion] DEBUG inventory after save:', inventory);

    updateLastGeneratedDataInventory();
    saveSettings();
    saveChatData();
    updateMessageSwipeData();

    // Re-render
    renderInventory();
}/**
 * Shows the inline form for adding a new storage location.
 */
export function showAddLocationForm() {
    const form = $('#rpg-add-location-form');
    const input = $('#rpg-new-location-name');

    // Track in state
    openForms.addLocation = true;

    form.show();
    input.val('').focus();
}

/**
 * Hides the inline form for adding a new storage location.
 */
export function hideAddLocationForm() {
    const form = $('#rpg-add-location-form');
    const input = $('#rpg-new-location-name');

    // Clear from state
    openForms.addLocation = false;

    form.hide();
    input.val('');
}

/**
 * Saves a new storage location from the inline form.
 */
export function saveAddLocation() {
    const inventory = extensionSettings.userStats.inventory;
    const input = $('#rpg-new-location-name');
    const rawLocationName = input.val().trim();

    if (!rawLocationName) {
        hideAddLocationForm();
        return;
    }

    // Security: Validate and sanitize location name
    const locationName = sanitizeLocationName(rawLocationName);
    if (!locationName) {
        alert('Invalid location name. Avoid special names like "__proto__" or "constructor".');
        hideAddLocationForm();
        return;
    }

    // Check for duplicate
    if (inventory.stored[locationName]) {
        alert(`Storage location "${locationName}" already exists.`);
        return;
    }

    // Create new location with default "None"
    inventory.stored[locationName] = 'None';

    updateLastGeneratedDataInventory();
    saveSettings();
    saveChatData();
    updateMessageSwipeData();

    // Hide form and re-render
    hideAddLocationForm();
    renderInventory();
}

/**
 * Shows the inline confirmation UI for removing a storage location.
 * @param {string} locationName - Name of location to remove
 */
export function showRemoveConfirmation(locationName) {
    // console.log('[RPG Companion] DEBUG showRemoveConfirmation called for:', locationName);
    const confirmId = `rpg-remove-confirm-${getLocationId(locationName)}`;
    // console.log('[RPG Companion] DEBUG confirmId:', confirmId);
    const confirmUI = $(`#${confirmId}`);
    // console.log('[RPG Companion] DEBUG confirmUI element found:', confirmUI.length);

    if (confirmUI.length > 0) {
        confirmUI.show();
        // console.log('[RPG Companion] DEBUG confirmation shown');
    } else {
        console.warn('[RPG Companion] DEBUG confirmation element not found!');
    }
}

/**
 * Hides the inline confirmation UI for removing a storage location.
 * @param {string} locationName - Name of location
 */
export function hideRemoveConfirmation(locationName) {
    const confirmId = `rpg-remove-confirm-${getLocationId(locationName)}`;
    const confirmUI = $(`#${confirmId}`);

    if (confirmUI.length > 0) {
        confirmUI.hide();
    }
}

/**
 * Confirms and removes a storage location from the inventory.
 * @param {string} locationName - Name of location to remove
 */
export function confirmRemoveLocation(locationName) {
    // console.log('[RPG Companion] DEBUG confirmRemoveLocation called for:', locationName);
    const inventory = extensionSettings.userStats.inventory;
    // console.log('[RPG Companion] DEBUG inventory.stored before deletion:', inventory.stored);

    delete inventory.stored[locationName];
    // console.log('[RPG Companion] DEBUG inventory.stored after deletion:', inventory.stored);

    // Remove from collapsed list if present
    const index = collapsedLocations.indexOf(locationName);
    if (index > -1) {
        collapsedLocations.splice(index, 1);
    }

    updateLastGeneratedDataInventory();
    saveSettings();
    saveChatData();
    updateMessageSwipeData();

    // Re-render inventory UI
    // console.log('[RPG Companion] DEBUG calling renderInventory()');
    renderInventory();
}/**
 * Toggles the collapsed state of a storage location section.
 * @param {string} locationName - Name of location to toggle
 */
export function toggleLocationCollapse(locationName) {
    const index = collapsedLocations.indexOf(locationName);

    if (index > -1) {
        // Currently collapsed, expand it
        collapsedLocations.splice(index, 1);
    } else {
        // Currently expanded, collapse it
        collapsedLocations.push(locationName);
    }

    // Save collapsed state to settings
    extensionSettings.collapsedInventoryLocations = collapsedLocations;
    saveSettings();

    // Re-render inventory UI
    renderInventory();
}

/**
 * Switches the active inventory sub-tab.
 * @param {string} tabName - Name of the tab ('onPerson', 'stored', 'assets')
 */
export function switchInventoryTab(tabName) {
    currentActiveSubTab = tabName;

    // Re-render inventory UI
    renderInventory();
}

/**
 * Switches the view mode for an inventory section.
 * @param {string} field - Field name ('onPerson', 'stored', 'assets')
 * @param {string} mode - View mode ('list' or 'grid')
 */
export function switchViewMode(field, mode) {
    // Ensure inventoryViewModes exists
    if (!extensionSettings.inventoryViewModes) {
        extensionSettings.inventoryViewModes = {
            onPerson: 'list',
            stored: 'list',
            assets: 'list'
        };
    }

    // Update view mode
    extensionSettings.inventoryViewModes[field] = mode;

    // Save settings
    saveSettings();

    // Re-render inventory UI
    renderInventory();
}

/**
 * Initializes all event listeners for inventory interactions.
 * Uses event delegation to handle dynamically created elements.
 */
export function initInventoryEventListeners() {
    // Load collapsed state from settings
    if (extensionSettings.collapsedInventoryLocations) {
        collapsedLocations = extensionSettings.collapsedInventoryLocations;
    }

    // Add item button - shows inline form
    $(document).on('click', '.rpg-inventory-add-btn[data-action="add-item"]', function(e) {
        e.preventDefault();
        const field = $(this).data('field');
        const location = $(this).data('location');
        showAddItemForm(field, location);
    });

    // Add item inline form - save button
    $(document).on('click', '.rpg-inline-btn[data-action="save-add-item"]', function(e) {
        e.preventDefault();
        const field = $(this).data('field');
        const location = $(this).data('location');
        saveAddItem(field, location);
    });

    // Add item inline form - cancel button
    $(document).on('click', '.rpg-inline-btn[data-action="cancel-add-item"]', function(e) {
        e.preventDefault();
        const field = $(this).data('field');
        const location = $(this).data('location');
        hideAddItemForm(field, location);
    });

    // Add item inline form - enter key to save
    $(document).on('keypress', '.rpg-inline-input', function(e) {
        if (e.which === 13) { // Enter key
            e.preventDefault();
            const $btn = $(this).closest('.rpg-inline-form').find('[data-action="save-add-item"]');
            if ($btn.length > 0) {
                const field = $btn.data('field');
                const location = $btn.data('location');
                saveAddItem(field, location);
            }
        }
    });

    // Remove item button
    $(document).on('click', '.rpg-item-remove[data-action="remove-item"]', function(e) {
        e.preventDefault();
        const field = $(this).data('field');
        const itemIndex = parseInt($(this).data('index'));
        const location = $(this).data('location');
        removeItem(field, itemIndex, location);
    });

    // Add location button - shows inline form
    $(document).on('click', '.rpg-inventory-add-btn[data-action="add-location"]', function(e) {
        e.preventDefault();
        showAddLocationForm();
    });

    // Add location inline form - save button
    $(document).on('click', '.rpg-inline-btn[data-action="save-add-location"]', function(e) {
        e.preventDefault();
        saveAddLocation();
    });

    // Add location inline form - cancel button
    $(document).on('click', '.rpg-inline-btn[data-action="cancel-add-location"]', function(e) {
        e.preventDefault();
        hideAddLocationForm();
    });

    // Add location inline form - enter key to save
    $(document).on('keypress', '#rpg-new-location-name', function(e) {
        if (e.which === 13) { // Enter key
            e.preventDefault();
            saveAddLocation();
        }
    });

    // Remove location button - shows inline confirmation
    $(document).on('click', '.rpg-inventory-remove-btn[data-action="remove-location"]', function(e) {
        e.preventDefault();
        const location = $(this).data('location');
        showRemoveConfirmation(location);
    });

    // Remove location inline confirmation - confirm button
    $(document).on('click', '.rpg-inline-btn[data-action="confirm-remove-location"]', function(e) {
        e.preventDefault();
        const location = $(this).data('location');
        confirmRemoveLocation(location);
    });

    // Remove location inline confirmation - cancel button
    $(document).on('click', '.rpg-inline-btn[data-action="cancel-remove-location"]', function(e) {
        e.preventDefault();
        const location = $(this).data('location');
        hideRemoveConfirmation(location);
    });

    // Collapse toggle buttons
    $(document).on('click', '.rpg-storage-toggle', function(e) {
        e.preventDefault();
        const location = $(this).data('location');
        toggleLocationCollapse(location);
    });

    // Sub-tab switching
    $(document).on('click', '.rpg-inventory-subtab', function(e) {
        e.preventDefault();
        const tab = $(this).data('tab');
        switchInventoryTab(tab);
    });

    // View mode switching
    $(document).on('click', '.rpg-view-btn[data-action="switch-view"]', function(e) {
        e.preventDefault();
        const field = $(this).data('field');
        const view = $(this).data('view');
        switchViewMode(field, view);
    });

    // console.log('[RPG Companion] Inventory event listeners initialized');
}

/**
 * Gets the current inventory rendering options.
 * @returns {Object} Options object with activeSubTab and collapsedLocations
 */
export function getInventoryRenderOptions() {
    return {
        activeSubTab: currentActiveSubTab,
        collapsedLocations
    };
}

/**
 * Restores the state of inline forms after re-rendering.
 * This ensures forms that were open before re-render are shown again.
 * Also cleans up orphaned form states for deleted locations (Bug #3 fix).
 */
export function restoreFormStates() {
    // Restore add location form
    if (openForms.addLocation) {
        const form = $('#rpg-add-location-form');
        const input = $('#rpg-new-location-name');
        if (form.length > 0) {
            form.show();
            // Don't refocus to avoid disrupting user interaction
        }
    }

    // Restore add item on person form
    if (openForms.addItemOnPerson) {
        const form = $('#rpg-add-item-form-onPerson');
        const input = $('#rpg-new-item-onPerson');
        if (form.length > 0) {
            form.show();
        }
    }

    // Restore add item assets form
    if (openForms.addItemAssets) {
        const form = $('#rpg-add-item-form-assets');
        const input = $('#rpg-new-item-assets');
        if (form.length > 0) {
            form.show();
        }
    }

    // Restore add item stored forms (for each location)
    // Clean up orphaned states for deleted locations (Bug #3 fix)
    if (openForms.addItemStored && typeof openForms.addItemStored === 'object') {
        const inventory = extensionSettings.userStats.inventory;
        const locationsToDelete = [];

        for (const location in openForms.addItemStored) {
            if (openForms.addItemStored[location]) {
                // Check if location still exists in inventory
                if (inventory?.stored && inventory.stored.hasOwnProperty(location)) {
                    // Location exists, restore form
                    const locationId = location.replace(/\s+/g, '-');
                    const form = $(`#rpg-add-item-form-stored-${locationId}`);
                    if (form.length > 0) {
                        form.show();
                    }
                } else {
                    // Location was deleted, mark for cleanup
                    locationsToDelete.push(location);
                }
            }
        }

        // Clean up orphaned form states
        for (const location of locationsToDelete) {
            delete openForms.addItemStored[location];
        }
    }
}
