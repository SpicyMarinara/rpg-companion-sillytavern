/**
 * Inventory Widget
 *
 * Comprehensive inventory management with three sub-tabs:
 * - On Person: Items currently carried
 * - Stored: Items in storage locations
 * - Assets: Vehicles, property, major possessions
 *
 * Features:
 * - List/Grid view modes per sub-tab
 * - Add/remove items and storage locations
 * - Collapsible storage locations
 * - Editable item names
 * - Inline forms for adding items
 */

import { parseItems, serializeItems } from '../../../utils/itemParser.js';
import { sanitizeItemName, sanitizeLocationName } from '../../../utils/security.js';
import { showAlertDialog } from '../confirmDialog.js';

/**
 * Convert location name to safe HTML ID
 */
function getLocationId(locationName) {
    return locationName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '-');
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Register Inventory Widget
 */
export function registerInventoryWidget(registry, dependencies) {
    const { getExtensionSettings, onDataChange } = dependencies;

    // Widget state (per-instance)
    const widgetStates = new Map();

    function getWidgetState(widgetId) {
        if (!widgetStates.has(widgetId)) {
            widgetStates.set(widgetId, {
                activeSubTab: 'onPerson',
                collapsedLocations: [],
                viewModes: {
                    onPerson: 'list',
                    stored: 'list',
                    assets: 'list'
                }
            });
        }
        return widgetStates.get(widgetId);
    }

    registry.register('inventory', {
        name: 'Inventory',
        icon: '🎒',
        description: 'Full inventory system with On Person, Stored, and Assets',
        category: 'inventory',
        minSize: { w: 2, h: 4 },
        defaultSize: { w: 2, h: 6 },
        maxAutoSize: { w: 3, h: 8 }, // Max size for auto-arrange expansion (full tab)
        requiresSchema: false,

        render(container, config = {}) {
            const settings = getExtensionSettings();
            const inventory = settings.userStats.inventory || {
                version: 2,
                onPerson: 'None',
                stored: {},
                assets: 'None'
            };

            // Get or create widget state
            const widgetId = container.closest('.dashboard-widget')?.dataset?.widgetId || 'default';
            const state = getWidgetState(widgetId);

            // Build HTML
            const html = `
                <div class="rpg-inventory-widget" data-widget-id="${widgetId}">
                    ${renderSubTabs(state.activeSubTab)}
                    <div class="rpg-inventory-views">
                        ${renderActiveView(inventory, state)}
                    </div>
                </div>
            `;

            container.innerHTML = html;

            // Attach event handlers
            attachInventoryHandlers(container, widgetId, inventory, state, dependencies);
        },

        getConfig() {
            return {
                compactMode: {
                    type: 'boolean',
                    label: 'Compact Mode',
                    default: false
                }
            };
        },

        onConfigChange(container, newConfig) {
            this.render(container, newConfig);
        },

        onResize(container, newW, newH) {
            // Adjust layout for narrow widgets
            const widget = container.querySelector('.rpg-inventory-widget');
            if (!widget) return;

            if (newW < 6) {
                widget.classList.add('rpg-inventory-compact');
            } else {
                widget.classList.remove('rpg-inventory-compact');
            }
        },

        onRemove(widgetId) {
            // Clean up widget state
            widgetStates.delete(widgetId);
        }
    });

    /**
     * Render sub-tab navigation
     */
    function renderSubTabs(activeTab) {
        return `
            <div class="rpg-inventory-subtabs">
                <button class="rpg-inventory-subtab ${activeTab === 'onPerson' ? 'active' : ''}" data-tab="onPerson" title="On Person">
                    <i class="fa-solid fa-user"></i>
                    <span class="rpg-subtab-label">On Person</span>
                </button>
                <button class="rpg-inventory-subtab ${activeTab === 'stored' ? 'active' : ''}" data-tab="stored" title="Stored">
                    <i class="fa-solid fa-box"></i>
                    <span class="rpg-subtab-label">Stored</span>
                </button>
                <button class="rpg-inventory-subtab ${activeTab === 'assets' ? 'active' : ''}" data-tab="assets" title="Assets">
                    <i class="fa-solid fa-building"></i>
                    <span class="rpg-subtab-label">Assets</span>
                </button>
            </div>
        `;
    }

    /**
     * Render active view based on state
     */
    function renderActiveView(inventory, state) {
        switch (state.activeSubTab) {
            case 'onPerson':
                return renderOnPersonView(inventory.onPerson, state.viewModes.onPerson);
            case 'stored':
                return renderStoredView(inventory.stored, state.collapsedLocations, state.viewModes.stored);
            case 'assets':
                return renderAssetsView(inventory.assets, state.viewModes.assets);
            default:
                return renderOnPersonView(inventory.onPerson, state.viewModes.onPerson);
        }
    }

    /**
     * Render On Person view
     */
    function renderOnPersonView(onPersonItems, viewMode) {
        const items = parseItems(onPersonItems);
        const itemsHtml = items.length === 0
            ? '<div class="rpg-inventory-empty">No items carried</div>'
            : renderItemList(items, 'onPerson', null, viewMode);

        return `
            <div class="rpg-inventory-section" data-section="onPerson">
                <div class="rpg-inventory-header">
                    <h4>Items Currently Carried</h4>
                    <div class="rpg-inventory-header-actions">
                        ${renderViewToggle('onPerson', viewMode)}
                        <button class="rpg-inventory-add-btn" data-action="add-item" data-field="onPerson">
                            <i class="fa-solid fa-plus"></i> Add Item
                        </button>
                    </div>
                </div>
                <div class="rpg-inventory-content">
                    <div class="rpg-inline-form" data-form="add-item-onPerson" style="display: none;">
                        <input type="text" class="rpg-inline-input" placeholder="Enter item name..." />
                        <div class="rpg-inline-buttons">
                            <button class="rpg-inline-btn rpg-inline-cancel" data-action="cancel-add-item" data-field="onPerson">
                                <i class="fa-solid fa-times"></i> Cancel
                            </button>
                            <button class="rpg-inline-btn rpg-inline-save" data-action="save-add-item" data-field="onPerson">
                                <i class="fa-solid fa-check"></i> Add
                            </button>
                        </div>
                    </div>
                    <div class="rpg-item-list ${viewMode === 'list' ? 'rpg-item-list-view' : 'rpg-item-grid-view'}">
                        ${itemsHtml}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render Stored view
     */
    function renderStoredView(stored, collapsedLocations, viewMode) {
        const locations = Object.keys(stored || {});

        let locationsHtml = '';
        if (locations.length === 0) {
            locationsHtml = `
                <div class="rpg-inventory-empty">
                    No storage locations yet. Click "Add Location" to create one.
                </div>
            `;
        } else {
            locationsHtml = locations.map(location => {
                const items = parseItems(stored[location]);
                const isCollapsed = collapsedLocations.includes(location);
                const locationId = getLocationId(location);
                const itemsHtml = items.length === 0
                    ? '<div class="rpg-inventory-empty">No items stored here</div>'
                    : renderItemList(items, 'stored', location, viewMode);

                return `
                    <div class="rpg-storage-location ${isCollapsed ? 'collapsed' : ''}" data-location="${escapeHtml(location)}">
                        <div class="rpg-storage-header">
                            <button class="rpg-storage-toggle" data-action="toggle-location" data-location="${escapeHtml(location)}">
                                <i class="fa-solid fa-chevron-${isCollapsed ? 'right' : 'down'}"></i>
                            </button>
                            <h5 class="rpg-storage-name">${escapeHtml(location)}</h5>
                            <div class="rpg-storage-actions">
                                <button class="rpg-inventory-remove-btn" data-action="remove-location" data-location="${escapeHtml(location)}">
                                    <i class="fa-solid fa-trash"></i>
                                </button>
                            </div>
                        </div>
                        <div class="rpg-storage-content" ${isCollapsed ? 'style="display:none;"' : ''}>
                            <div class="rpg-inline-form" data-form="add-item-stored-${locationId}" style="display: none;">
                                <input type="text" class="rpg-inline-input" placeholder="Enter item name..." />
                                <div class="rpg-inline-buttons">
                                    <button class="rpg-inline-btn rpg-inline-cancel" data-action="cancel-add-item" data-field="stored" data-location="${escapeHtml(location)}">
                                        <i class="fa-solid fa-times"></i> Cancel
                                    </button>
                                    <button class="rpg-inline-btn rpg-inline-save" data-action="save-add-item" data-field="stored" data-location="${escapeHtml(location)}">
                                        <i class="fa-solid fa-check"></i> Add
                                    </button>
                                </div>
                            </div>
                            <div class="rpg-item-list ${viewMode === 'list' ? 'rpg-item-list-view' : 'rpg-item-grid-view'}">
                                ${itemsHtml}
                            </div>
                            <div class="rpg-storage-add-item-container">
                                <button class="rpg-inventory-add-btn" data-action="add-item" data-field="stored" data-location="${escapeHtml(location)}">
                                    <i class="fa-solid fa-plus"></i> Add Item
                                </button>
                            </div>
                        </div>
                        <div class="rpg-inline-confirmation" data-confirm="remove-location-${locationId}" style="display: none;">
                            <p>Remove "${escapeHtml(location)}"? This will delete all items stored there.</p>
                            <div class="rpg-inline-buttons">
                                <button class="rpg-inline-btn rpg-inline-cancel" data-action="cancel-remove-location" data-location="${escapeHtml(location)}">
                                    <i class="fa-solid fa-times"></i> Cancel
                                </button>
                                <button class="rpg-inline-btn rpg-inline-confirm" data-action="confirm-remove-location" data-location="${escapeHtml(location)}">
                                    <i class="fa-solid fa-check"></i> Confirm
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        return `
            <div class="rpg-inventory-section" data-section="stored">
                <div class="rpg-inventory-header">
                    <h4>Storage Locations</h4>
                    <div class="rpg-inventory-header-actions">
                        ${renderViewToggle('stored', viewMode)}
                        <button class="rpg-inventory-add-btn" data-action="add-location">
                            <i class="fa-solid fa-plus"></i> Add Location
                        </button>
                    </div>
                </div>
                <div class="rpg-inventory-content">
                    <div class="rpg-inline-form" data-form="add-location" style="display: none;">
                        <input type="text" class="rpg-inline-input" placeholder="Enter location name..." />
                        <div class="rpg-inline-buttons">
                            <button class="rpg-inline-btn rpg-inline-cancel" data-action="cancel-add-location">
                                <i class="fa-solid fa-times"></i> Cancel
                            </button>
                            <button class="rpg-inline-btn rpg-inline-save" data-action="save-add-location">
                                <i class="fa-solid fa-check"></i> Save
                            </button>
                        </div>
                    </div>
                    ${locationsHtml}
                </div>
            </div>
        `;
    }

    /**
     * Render Assets view
     */
    function renderAssetsView(assets, viewMode) {
        const items = parseItems(assets);
        const itemsHtml = items.length === 0
            ? '<div class="rpg-inventory-empty">No assets owned</div>'
            : renderItemList(items, 'assets', null, viewMode);

        return `
            <div class="rpg-inventory-section" data-section="assets">
                <div class="rpg-inventory-header">
                    <h4>Vehicles, Property & Major Possessions</h4>
                    <div class="rpg-inventory-header-actions">
                        ${renderViewToggle('assets', viewMode)}
                        <button class="rpg-inventory-add-btn" data-action="add-item" data-field="assets">
                            <i class="fa-solid fa-plus"></i> Add Asset
                        </button>
                    </div>
                </div>
                <div class="rpg-inventory-content">
                    <div class="rpg-inline-form" data-form="add-item-assets" style="display: none;">
                        <input type="text" class="rpg-inline-input" placeholder="Enter asset name..." />
                        <div class="rpg-inline-buttons">
                            <button class="rpg-inline-btn rpg-inline-cancel" data-action="cancel-add-item" data-field="assets">
                                <i class="fa-solid fa-times"></i> Cancel
                            </button>
                            <button class="rpg-inline-btn rpg-inline-save" data-action="save-add-item" data-field="assets">
                                <i class="fa-solid fa-check"></i> Add
                            </button>
                        </div>
                    </div>
                    <div class="rpg-item-list ${viewMode === 'list' ? 'rpg-item-list-view' : 'rpg-item-grid-view'}">
                        ${itemsHtml}
                    </div>
                    <div class="rpg-inventory-hint">
                        <i class="fa-solid fa-info-circle"></i>
                        Assets include vehicles (cars, motorcycles), property (homes, apartments),
                        and major equipment (workshop tools, special items).
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render view toggle buttons
     */
    function renderViewToggle(field, viewMode) {
        return `
            <div class="rpg-view-toggle">
                <button class="rpg-view-btn ${viewMode === 'list' ? 'active' : ''}" data-action="switch-view" data-field="${field}" data-view="list" title="List view">
                    <i class="fa-solid fa-list"></i>
                </button>
                <button class="rpg-view-btn ${viewMode === 'grid' ? 'active' : ''}" data-action="switch-view" data-field="${field}" data-view="grid" title="Grid view">
                    <i class="fa-solid fa-th"></i>
                </button>
            </div>
        `;
    }

    /**
     * Render item list (list or grid view)
     */
    function renderItemList(items, field, location, viewMode) {
        const locationAttr = location ? `data-location="${escapeHtml(location)}"` : '';

        if (viewMode === 'grid') {
            return items.map((item, index) => `
                <div class="rpg-item-card" data-field="${field}" ${locationAttr} data-index="${index}">
                    <button class="rpg-item-remove" data-action="remove-item" data-field="${field}" ${locationAttr} data-index="${index}" title="Remove item">
                        <i class="fa-solid fa-times"></i>
                    </button>
                    <span class="rpg-item-name rpg-editable" contenteditable="true" data-field="${field}" ${locationAttr} data-index="${index}" title="Click to edit">${escapeHtml(item)}</span>
                </div>
            `).join('');
        } else {
            return items.map((item, index) => `
                <div class="rpg-item-row" data-field="${field}" ${locationAttr} data-index="${index}">
                    <span class="rpg-item-name rpg-editable" contenteditable="true" data-field="${field}" ${locationAttr} data-index="${index}" title="Click to edit">${escapeHtml(item)}</span>
                    <button class="rpg-item-remove" data-action="remove-item" data-field="${field}" ${locationAttr} data-index="${index}" title="Remove item">
                        <i class="fa-solid fa-times"></i>
                    </button>
                </div>
            `).join('');
        }
    }

    /**
     * Attach all event handlers
     */
    function attachInventoryHandlers(container, widgetId, inventory, state, dependencies) {
        const widget = container.querySelector('.rpg-inventory-widget');
        if (!widget) return;

        // Sub-tab switching
        widget.querySelectorAll('.rpg-inventory-subtab').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                state.activeSubTab = tab;

                // Re-render
                const settings = getExtensionSettings();
                const inv = settings.userStats.inventory;
                widget.querySelector('.rpg-inventory-views').innerHTML = renderActiveView(inv, state);

                // Update active tab styling
                widget.querySelectorAll('.rpg-inventory-subtab').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Re-attach handlers for new view
                attachInventoryHandlers(container, widgetId, inv, state, dependencies);
            });
        });

        // View mode toggle
        widget.querySelectorAll('[data-action="switch-view"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const field = btn.dataset.field;
                const view = btn.dataset.view;
                state.viewModes[field] = view;

                // Re-render active view
                const settings = getExtensionSettings();
                const inv = settings.userStats.inventory;
                widget.querySelector('.rpg-inventory-views').innerHTML = renderActiveView(inv, state);
                attachInventoryHandlers(container, widgetId, inv, state, dependencies);
            });
        });

        // Add item button
        widget.querySelectorAll('[data-action="add-item"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const field = btn.dataset.field;
                const location = btn.dataset.location;
                showAddItemForm(widget, field, location);
            });
        });

        // Cancel add item
        widget.querySelectorAll('[data-action="cancel-add-item"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const field = btn.dataset.field;
                const location = btn.dataset.location;
                hideAddItemForm(widget, field, location);
            });
        });

        // Save add item
        widget.querySelectorAll('[data-action="save-add-item"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const field = btn.dataset.field;
                const location = btn.dataset.location;
                saveAddItem(container, widgetId, field, location, state, dependencies);
            });
        });

        // Enter key in add item form
        widget.querySelectorAll('.rpg-inline-form input').forEach(input => {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const form = input.closest('.rpg-inline-form');
                    const saveBtn = form.querySelector('[data-action="save-add-item"], [data-action="save-add-location"]');
                    if (saveBtn) saveBtn.click();
                }
                if (e.key === 'Escape') {
                    e.preventDefault();
                    const form = input.closest('.rpg-inline-form');
                    const cancelBtn = form.querySelector('[data-action="cancel-add-item"], [data-action="cancel-add-location"]');
                    if (cancelBtn) cancelBtn.click();
                }
            });
        });

        // Remove item
        widget.querySelectorAll('[data-action="remove-item"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const field = btn.dataset.field;
                const index = parseInt(btn.dataset.index);
                const location = btn.dataset.location;
                removeItem(container, widgetId, field, index, location, state, dependencies);
            });
        });

        // Edit item name
        widget.querySelectorAll('.rpg-item-name.rpg-editable').forEach(field => {
            let originalValue = field.textContent.trim();

            field.addEventListener('focus', () => {
                originalValue = field.textContent.trim();
                const range = document.createRange();
                range.selectNodeContents(field);
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);
            });

            field.addEventListener('blur', () => {
                const newValue = field.textContent.trim();
                if (newValue && newValue !== originalValue) {
                    const fieldName = field.dataset.field;
                    const index = parseInt(field.dataset.index);
                    const location = field.dataset.location;
                    updateItemName(container, widgetId, fieldName, index, newValue, location, state, dependencies);
                } else if (!newValue) {
                    field.textContent = originalValue;
                }
            });

            field.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    field.blur();
                }
                if (e.key === 'Escape') {
                    e.preventDefault();
                    field.textContent = originalValue;
                    field.blur();
                }
            });

            field.addEventListener('paste', (e) => {
                e.preventDefault();
                const text = (e.clipboardData || window.clipboardData).getData('text/plain');
                document.execCommand('insertText', false, text);
            });
        });

        // Add location
        const addLocationBtn = widget.querySelector('[data-action="add-location"]');
        if (addLocationBtn) {
            addLocationBtn.addEventListener('click', () => {
                showAddLocationForm(widget);
            });
        }

        // Cancel add location
        const cancelAddLocationBtn = widget.querySelector('[data-action="cancel-add-location"]');
        if (cancelAddLocationBtn) {
            cancelAddLocationBtn.addEventListener('click', () => {
                hideAddLocationForm(widget);
            });
        }

        // Save add location
        const saveAddLocationBtn = widget.querySelector('[data-action="save-add-location"]');
        if (saveAddLocationBtn) {
            saveAddLocationBtn.addEventListener('click', () => {
                saveAddLocation(container, widgetId, state, dependencies);
            });
        }

        // Toggle location collapse
        widget.querySelectorAll('[data-action="toggle-location"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const location = btn.dataset.location;
                toggleLocationCollapse(widget, location, state);
            });
        });

        // Remove location
        widget.querySelectorAll('[data-action="remove-location"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const location = btn.dataset.location;
                showRemoveLocationConfirm(widget, location);
            });
        });

        // Cancel remove location
        widget.querySelectorAll('[data-action="cancel-remove-location"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const location = btn.dataset.location;
                hideRemoveLocationConfirm(widget, location);
            });
        });

        // Confirm remove location
        widget.querySelectorAll('[data-action="confirm-remove-location"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const location = btn.dataset.location;
                removeLocation(container, widgetId, location, state, dependencies);
            });
        });
    }

    /**
     * Show add item form
     */
    function showAddItemForm(widget, field, location) {
        let formSelector;
        if (field === 'stored') {
            const locationId = getLocationId(location);
            formSelector = `[data-form="add-item-stored-${locationId}"]`;
        } else {
            formSelector = `[data-form="add-item-${field}"]`;
        }

        const form = widget.querySelector(formSelector);
        if (form) {
            form.style.display = 'block';
            const input = form.querySelector('input');
            if (input) {
                input.value = '';
                input.focus();
            }
        }
    }

    /**
     * Hide add item form
     */
    function hideAddItemForm(widget, field, location) {
        let formSelector;
        if (field === 'stored') {
            const locationId = getLocationId(location);
            formSelector = `[data-form="add-item-stored-${locationId}"]`;
        } else {
            formSelector = `[data-form="add-item-${field}"]`;
        }

        const form = widget.querySelector(formSelector);
        if (form) {
            form.style.display = 'none';
            const input = form.querySelector('input');
            if (input) input.value = '';
        }
    }

    /**
     * Save new item
     */
    function saveAddItem(container, widgetId, field, location, state, dependencies) {
        const widget = container.querySelector('.rpg-inventory-widget');
        let formSelector;
        if (field === 'stored') {
            const locationId = getLocationId(location);
            formSelector = `[data-form="add-item-stored-${locationId}"]`;
        } else {
            formSelector = `[data-form="add-item-${field}"]`;
        }

        const form = widget.querySelector(formSelector);
        if (!form) return;

        const input = form.querySelector('input');
        const rawItemName = input.value.trim();

        if (!rawItemName) {
            hideAddItemForm(widget, field, location);
            return;
        }

        const itemName = sanitizeItemName(rawItemName);
        if (!itemName) {
            showAlertDialog({
                title: 'Invalid Item',
                message: 'Please enter a valid item name.',
                variant: 'warning'
            });
            hideAddItemForm(widget, field, location);
            return;
        }

        const settings = getExtensionSettings();
        const inventory = settings.userStats.inventory;

        // Get current items
        let currentString;
        if (field === 'stored') {
            currentString = inventory.stored[location] || 'None';
        } else {
            currentString = inventory[field] || 'None';
        }

        const items = parseItems(currentString);
        items.push(itemName);
        const newString = serializeItems(items);

        // Save back
        if (field === 'stored') {
            inventory.stored[location] = newString;
        } else {
            inventory[field] = newString;
        }

        // Trigger change callback
        if (onDataChange) {
            onDataChange('inventory', field, newString, location);
        }

        hideAddItemForm(widget, field, location);

        // Re-render view
        widget.querySelector('.rpg-inventory-views').innerHTML = renderActiveView(inventory, state);
        attachInventoryHandlers(container, widgetId, inventory, state, dependencies);
    }

    /**
     * Remove item
     */
    function removeItem(container, widgetId, field, index, location, state, dependencies) {
        const settings = getExtensionSettings();
        const inventory = settings.userStats.inventory;

        // Get current items
        let currentString;
        if (field === 'stored') {
            currentString = inventory.stored[location] || 'None';
        } else {
            currentString = inventory[field] || 'None';
        }

        const items = parseItems(currentString);
        items.splice(index, 1);
        const newString = serializeItems(items);

        // Save back
        if (field === 'stored') {
            inventory.stored[location] = newString;
        } else {
            inventory[field] = newString;
        }

        // Trigger change callback
        if (onDataChange) {
            onDataChange('inventory', field, newString, location);
        }

        // Re-render view
        const widget = container.querySelector('.rpg-inventory-widget');
        widget.querySelector('.rpg-inventory-views').innerHTML = renderActiveView(inventory, state);
        attachInventoryHandlers(container, widgetId, inventory, state, dependencies);
    }

    /**
     * Update item name
     */
    function updateItemName(container, widgetId, field, index, newName, location, state, dependencies) {
        const sanitized = sanitizeItemName(newName);
        if (!sanitized) return;

        const settings = getExtensionSettings();
        const inventory = settings.userStats.inventory;

        // Get current items
        let currentString;
        if (field === 'stored') {
            currentString = inventory.stored[location] || 'None';
        } else {
            currentString = inventory[field] || 'None';
        }

        const items = parseItems(currentString);
        items[index] = sanitized;
        const newString = serializeItems(items);

        // Save back
        if (field === 'stored') {
            inventory.stored[location] = newString;
        } else {
            inventory[field] = newString;
        }

        // Trigger change callback
        if (onDataChange) {
            onDataChange('inventory', field, newString, location);
        }
    }

    /**
     * Show add location form
     */
    function showAddLocationForm(widget) {
        const form = widget.querySelector('[data-form="add-location"]');
        if (form) {
            form.style.display = 'block';
            const input = form.querySelector('input');
            if (input) {
                input.value = '';
                input.focus();
            }
        }
    }

    /**
     * Hide add location form
     */
    function hideAddLocationForm(widget) {
        const form = widget.querySelector('[data-form="add-location"]');
        if (form) {
            form.style.display = 'none';
            const input = form.querySelector('input');
            if (input) input.value = '';
        }
    }

    /**
     * Save new location
     */
    function saveAddLocation(container, widgetId, state, dependencies) {
        const widget = container.querySelector('.rpg-inventory-widget');
        const form = widget.querySelector('[data-form="add-location"]');
        if (!form) return;

        const input = form.querySelector('input');
        const rawLocationName = input.value.trim();

        if (!rawLocationName) {
            hideAddLocationForm(widget);
            return;
        }

        const locationName = sanitizeLocationName(rawLocationName);
        if (!locationName) {
            showAlertDialog({
                title: 'Invalid Location',
                message: 'Please enter a valid location name.',
                variant: 'warning'
            });
            hideAddLocationForm(widget);
            return;
        }

        const settings = getExtensionSettings();
        const inventory = settings.userStats.inventory;

        // Check if location already exists
        if (inventory.stored[locationName]) {
            showAlertDialog({
                title: 'Duplicate Location',
                message: 'A location with this name already exists.',
                variant: 'warning'
            });
            hideAddLocationForm(widget);
            return;
        }

        // Add new location
        inventory.stored[locationName] = 'None';

        // Trigger change callback
        if (onDataChange) {
            onDataChange('inventory', 'stored', inventory.stored);
        }

        hideAddLocationForm(widget);

        // Re-render view
        widget.querySelector('.rpg-inventory-views').innerHTML = renderActiveView(inventory, state);
        attachInventoryHandlers(container, widgetId, inventory, state, dependencies);
    }

    /**
     * Toggle location collapse
     */
    function toggleLocationCollapse(widget, location, state) {
        const index = state.collapsedLocations.indexOf(location);
        if (index === -1) {
            state.collapsedLocations.push(location);
        } else {
            state.collapsedLocations.splice(index, 1);
        }

        // Update DOM
        const locationDiv = widget.querySelector(`.rpg-storage-location[data-location="${location}"]`);
        if (locationDiv) {
            const content = locationDiv.querySelector('.rpg-storage-content');
            const icon = locationDiv.querySelector('.rpg-storage-toggle i');

            if (index === -1) {
                // Now collapsed
                locationDiv.classList.add('collapsed');
                content.style.display = 'none';
                icon.className = 'fa-solid fa-chevron-right';
            } else {
                // Now expanded
                locationDiv.classList.remove('collapsed');
                content.style.display = 'block';
                icon.className = 'fa-solid fa-chevron-down';
            }
        }
    }

    /**
     * Show remove location confirmation
     */
    function showRemoveLocationConfirm(widget, location) {
        const locationId = getLocationId(location);
        const confirm = widget.querySelector(`[data-confirm="remove-location-${locationId}"]`);
        if (confirm) {
            confirm.style.display = 'block';
        }
    }

    /**
     * Hide remove location confirmation
     */
    function hideRemoveLocationConfirm(widget, location) {
        const locationId = getLocationId(location);
        const confirm = widget.querySelector(`[data-confirm="remove-location-${locationId}"]`);
        if (confirm) {
            confirm.style.display = 'none';
        }
    }

    /**
     * Remove location
     */
    function removeLocation(container, widgetId, location, state, dependencies) {
        const settings = getExtensionSettings();
        const inventory = settings.userStats.inventory;

        delete inventory.stored[location];

        // Remove from collapsed locations
        const index = state.collapsedLocations.indexOf(location);
        if (index !== -1) {
            state.collapsedLocations.splice(index, 1);
        }

        // Trigger change callback
        if (onDataChange) {
            onDataChange('inventory', 'stored', inventory.stored);
        }

        // Re-render view
        const widget = container.querySelector('.rpg-inventory-widget');
        widget.querySelector('.rpg-inventory-views').innerHTML = renderActiveView(inventory, state);
        attachInventoryHandlers(container, widgetId, inventory, state, dependencies);
    }
}
