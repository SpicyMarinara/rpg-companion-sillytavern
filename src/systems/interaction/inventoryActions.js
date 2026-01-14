/**
 * Inventory Actions Module
 * Handles all user interactions with the inventory v3 system
 */

import { extensionSettings, lastGeneratedData, committedTrackerData } from '../../core/state.js';
import { saveSettings, saveChatData, updateMessageSwipeData } from '../../core/persistence.js';
import { renderInventory, getLocationId } from '../rendering/inventory.js';
import { sanitizeLocationName, sanitizeItemName } from '../../utils/security.js';
import { getInventoryV3, setInventoryV3, createV3Item } from '../../utils/inventoryHelper.js';

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
    addItemClothing: false,
    addItemStored: {}, // { [locationName]: true/false }
    addItemAssets: false
};

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
 * Adds a new item to the inventory (v3 format).
 * @param {string} field - Field name ('onPerson', 'clothing', 'stored', 'assets')
 * @param {string} [location] - Location name (required for 'stored' field)
 */
export function saveAddItem(field, location) {
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

    // Get v3 inventory and modify directly
    const inventory = getInventoryV3();
    const newItem = createV3Item(itemName);

    if (field === 'stored') {
        if (!inventory.stored[location]) {
            inventory.stored[location] = [];
        }
        inventory.stored[location].push(newItem);
    } else {
        if (!inventory[field]) {
            inventory[field] = [];
        }
        inventory[field].push(newItem);
    }

    // Save v3 inventory back
    setInventoryV3(inventory);
    saveSettings();
    saveChatData();
    updateMessageSwipeData();

    // Hide form and re-render
    hideAddItemForm(field, location);
    renderInventory();
}

/**
 * Removes an item from the inventory (v3 format).
 * @param {string} field - Field name ('onPerson', 'clothing', 'stored', 'assets')
 * @param {number} itemIndex - Index of item to remove
 * @param {string} [location] - Location name (required for 'stored' field)
 */
export function removeItem(field, itemIndex, location) {
    // Get v3 inventory
    const inventory = getInventoryV3();

    if (field === 'stored') {
        if (inventory.stored[location] && Array.isArray(inventory.stored[location])) {
            inventory.stored[location].splice(itemIndex, 1);
        }
    } else {
        if (inventory[field] && Array.isArray(inventory[field])) {
            inventory[field].splice(itemIndex, 1);
        }
    }

    // Save v3 inventory back
    setInventoryV3(inventory);
    saveSettings();
    saveChatData();
    updateMessageSwipeData();

    // Re-render
    renderInventory();
}

/**
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
 * Saves a new storage location from the inline form (v3 format).
 */
export function saveAddLocation() {
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

    // Get v3 inventory
    const inventory = getInventoryV3();

    // Check for duplicate
    if (inventory.stored[locationName]) {
        alert(`Storage location "${locationName}" already exists.`);
        return;
    }

    // Create new location with empty array
    inventory.stored[locationName] = [];

    // Save v3 inventory back
    setInventoryV3(inventory);
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
 * Confirms and removes a storage location from the inventory (v3 format).
 * @param {string} locationName - Name of location to remove
 */
export function confirmRemoveLocation(locationName) {
    // Get v3 inventory
    const inventory = getInventoryV3();

    delete inventory.stored[locationName];

    // Remove from collapsed list if present
    const index = collapsedLocations.indexOf(locationName);
    if (index > -1) {
        collapsedLocations.splice(index, 1);
    }

    // Save v3 inventory back
    setInventoryV3(inventory);
    saveSettings();
    saveChatData();
    updateMessageSwipeData();

    // Re-render inventory UI
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
        const inventory = getInventoryV3();
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
