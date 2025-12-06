/**
 * Skills Rendering Module
 * Handles rendering of the skills section with skill categories (like inventory)
 * Each configured skill becomes a category, and abilities/items can be added within each
 */

import { extensionSettings, lastGeneratedData, committedTrackerData, $skillsContainer } from '../../core/state.js';
import { saveChatData, updateMessageSwipeData } from '../../core/persistence.js';
import { i18n } from '../../core/i18n.js';
import { parseItems } from '../../utils/itemParser.js';
import { renderInventory } from './inventory.js';

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

/**
 * Gets tracker data with fallback
 */
function getTrackerData() {
    return lastGeneratedData || committedTrackerData || {};
}

/**
 * Gets the configured skill categories from settings
 * @returns {string[]} Array of skill category names
 */
export function getSkillCategories() {
    const categories = extensionSettings.trackerConfig?.userStats?.skillsSection?.customFields || [];
    const enabledConfigCategories = categories
        .filter(cat => cat && cat.enabled !== false && cat.name)
        .map(cat => cat.name);

    if (enabledConfigCategories.length > 0) {
        return enabledConfigCategories;
    }

    // Fallback: derive from existing tracker data
    const tracker = getTrackerData();
    return Object.keys(tracker.skills || {});
}

/**
 * Gets the items/abilities for a specific skill category
 * @param {string} skillName - The skill category name
 * @returns {string} Comma-separated items string or 'None'
 */
export function getSkillItems(skillName) {
    const tracker = getTrackerData();
    const skills = tracker.skills?.[skillName];
    if (Array.isArray(skills) && skills.length > 0) {
        return skills.map(s => s?.name).filter(Boolean).join(', ') || 'None';
    }
    return 'None';
}

/**
 * Sets the items/abilities for a specific skill category
 * @param {string} skillName - The skill category name
 * @param {string} itemsString - Comma-separated items string
 */
export function setSkillItems(skillName, itemsString) {
    if (!lastGeneratedData.skills) {
        lastGeneratedData.skills = {};
    }
    
    // Convert comma-separated string to structured array
    const items = itemsString && itemsString !== 'None'
        ? itemsString.split(',').map(s => s.trim()).filter(Boolean).map(name => ({ name, description: '' }))
        : [];
    
    lastGeneratedData.skills[skillName] = items;
    saveChatData();
    updateMessageSwipeData();
}

/**
 * Adds an item to a skill category
 * @param {string} skillName - The skill category name
 * @param {string} item - The item to add
 */
export function addSkillItem(skillName, item, description = '') {
    if (!lastGeneratedData.skills) {
        lastGeneratedData.skills = {};
    }
    if (!Array.isArray(lastGeneratedData.skills[skillName])) {
        lastGeneratedData.skills[skillName] = [];
    }
    
    // Check if ability already exists
    const exists = lastGeneratedData.skills[skillName].some(a => a.name === item);
    if (!exists) {
        lastGeneratedData.skills[skillName].push({ name: item, description: description, grantedBy: null });
        saveChatData();
        updateMessageSwipeData();
    }
}

/**
 * Removes an item from a skill category
 * @param {string} skillName - The skill category name
 * @param {number} index - Index of item to remove
 */
export function removeSkillItem(skillName, index) {
    const skills = lastGeneratedData.skills;
    if (!skills || !Array.isArray(skills[skillName])) return;
    
    if (index >= 0 && index < skills[skillName].length) {
        skills[skillName].splice(index, 1);
        saveChatData();
        updateMessageSwipeData();
    }
}

/**
 * Updates an item in a skill category
 * @param {string} skillName - The skill category name
 * @param {number} index - Index of item to update
 * @param {string} newValue - New item value
 */
export function updateSkillItem(skillName, index, newValue) {
    const skills = lastGeneratedData.skills;
    if (skills && Array.isArray(skills[skillName]) && skills[skillName][index]) {
        skills[skillName][index].name = newValue;
        saveChatData();
        updateMessageSwipeData();
    }
}

/**
 * Updates a skill ability's description
 * @param {string} skillName - The skill category name
 * @param {number} index - Index of ability to update
 * @param {string} newDescription - New description
 */
function updateStructuredSkillDescription(skillName, index, newDescription) {
    const skills = lastGeneratedData.skills;
    if (skills && Array.isArray(skills[skillName]) && skills[skillName][index]) {
        skills[skillName][index].description = newDescription;
        saveChatData();
        updateMessageSwipeData();
    }
}

/**
 * Called when an item is removed from inventory
 * Based on deleteSkillWithItem setting:
 * - false (default): Just removes the link, skill remains
 * - true: Deletes the linked skill abilities entirely
 * @param {string} itemName - The name of the removed item
 */
export function handleItemRemoved(itemName) {
    if (!extensionSettings.enableItemSkillLinks) return;
    
    // Find all skill abilities linked to this item
    const linkedAbilities = getAbilitiesLinkedToItem(itemName);
    if (linkedAbilities.length === 0) return;
    
    // Process each linked ability
    for (const { skillName, abilityName } of linkedAbilities) {
        if (extensionSettings.deleteSkillWithItem) {
            // Delete the skill ability entirely
            deleteSkillAbility(skillName, abilityName);
        } else {
            // Just remove the grantedBy link
            unlinkAbility(skillName, abilityName);
        }
    }
    
    saveChatData();
    renderSkills();
}

/**
 * Deletes a skill ability from the skills data
 * @param {string} skillName - The skill category name
 * @param {string} abilityName - The ability name to delete
 */
function deleteSkillAbility(skillName, abilityName) {
    const skills = lastGeneratedData.skills;
    if (!skills || !Array.isArray(skills[skillName])) return;
    
    const index = skills[skillName].findIndex(a => 
        a?.name?.toLowerCase().trim() === abilityName.toLowerCase().trim()
    );
    if (index !== -1) {
        skills[skillName].splice(index, 1);
        saveChatData();
        updateMessageSwipeData();
    }
}

/**
 * Gets the linked item for a skill ability
 * @param {string} skillName - The skill category name
 * @param {string} abilityName - The ability name
 * @returns {string|null} The linked item name or null
 */
export function getLinkedItem(skillName, abilityName) {
    const tracker = getTrackerData();
    const skills = tracker.skills?.[skillName];
    if (!skills) return null;
    
    const ability = skills.find(s => s.name === abilityName);
    return ability?.grantedBy || null;
}

/**
 * Links a skill ability to an inventory item
 * @param {string} skillName - The skill category name
 * @param {string} abilityName - The ability name
 * @param {string} itemName - The inventory item name
 */
export function linkAbilityToItem(skillName, abilityName, itemName) {
    if (!lastGeneratedData.skills) lastGeneratedData.skills = {};
    if (!lastGeneratedData.skills[skillName]) lastGeneratedData.skills[skillName] = [];
    
    const skills = lastGeneratedData.skills[skillName];
    const ability = skills.find(s => s.name === abilityName);
    
    if (ability) {
        ability.grantedBy = itemName;
    }
    
    updateMessageSwipeData();
    saveChatData();

    // Defer renderInventory to avoid circular import timing issues
    setTimeout(() => renderInventory(), 0);
}

/**
 * Unlinks a skill ability from its inventory item
 * @param {string} skillName - The skill category name
 * @param {string} abilityName - The ability name
 */
export function unlinkAbility(skillName, abilityName) {
    const skills = lastGeneratedData.skills?.[skillName];
    if (!skills) return;
    
    const ability = skills.find(s => s.name === abilityName);
    if (ability) {
        const linkedItemName = ability.grantedBy;
        delete ability.grantedBy;
        if (linkedItemName) {
            clearGrantsSkillFromItem(linkedItemName);
        }
    }
    
    updateMessageSwipeData();
    saveChatData();

    // Defer renderInventory to avoid circular import timing issues
    setTimeout(() => renderInventory(), 0);
}

/**
 * Gets all skill abilities linked to a specific inventory item
 * @param {string} itemName - The inventory item name
 * @returns {Array<{skillName: string, abilityName: string}>} Array of linked abilities
 */
export function getAbilitiesLinkedToItem(itemName) {
    if (!itemName) return [];
    const linked = [];
    const normalizedItemName = itemName.toLowerCase().trim();
    
    // Check tracker skills for abilities with grantedBy matching this item
    const tracker = getTrackerData();
    if (tracker.skills && typeof tracker.skills === 'object') {
        for (const [skillName, abilities] of Object.entries(tracker.skills)) {
            if (!Array.isArray(abilities)) continue;
            for (const ability of abilities) {
                if (!ability || typeof ability !== 'object') continue;
                const grantedBy = (ability.grantedBy || '').toLowerCase().trim();
                if (grantedBy === normalizedItemName) {
                    linked.push({ skillName, abilityName: ability.name });
                }
            }
        }
    }
    
    return linked;
}

/**
 * Checks if an inventory item has any linked skills
 * @param {string} itemName - The inventory item name
 * @returns {boolean} True if item has linked skills
 */
export function itemHasLinkedSkills(itemName) {
    // Check manual links first
    if (getAbilitiesLinkedToItem(itemName).length > 0) {
        return true;
    }
    
    // Check structured inventory for grantsSkill property
    const tracker = getTrackerData();
    const inv = tracker.inventory;
    if (!inv || !itemName) return false;
    
    const normalizedName = itemName.toLowerCase().trim();
    
    // Helper to check if an item array contains the item with grantsSkill
    const checkItems = (items) => {
        if (!Array.isArray(items)) return false;
        return items.some(item => {
            if (!item || typeof item !== 'object') return false;
            const name = (item.name || '').toLowerCase().trim();
            return name === normalizedName && item.grantsSkill;
        });
    };
    
    // Check onPerson
    if (checkItems(inv.onPerson)) return true;
    
    // Check simplified
    if (checkItems(inv.simplified)) return true;
    
    // Check assets
    if (checkItems(inv.assets)) return true;
    
    // Check stored locations
    if (inv.stored && typeof inv.stored === 'object') {
        for (const items of Object.values(inv.stored)) {
            if (checkItems(items)) return true;
        }
    }
    
    return false;
}

/**
 * Clears the grantsSkill property from an inventory item
 * @param {string} itemName - The item name to clear grantsSkill from
 */
function clearGrantsSkillFromItem(itemName) {
    const inv = lastGeneratedData.inventory;
    if (!inv || !itemName) return;
    
    const normalizedName = itemName.toLowerCase().trim();
    
    const clearFromItems = (items) => {
        if (!Array.isArray(items)) return;
        for (const item of items) {
            if (!item || typeof item !== 'object') continue;
            const name = (item.name || '').toLowerCase().trim();
            if (name === normalizedName && item.grantsSkill) {
                delete item.grantsSkill;
            }
        }
    };
    
    clearFromItems(inv.onPerson);
    clearFromItems(inv.simplified);
    clearFromItems(inv.assets);
    
    if (inv.stored && typeof inv.stored === 'object') {
        for (const items of Object.values(inv.stored)) {
            clearFromItems(items);
        }
    }
}

/**
 * Navigates to the inventory tab and highlights an item
 * @param {string} itemName - The item to highlight
 */
export function navigateToInventoryItem(itemName) {
    // Switch to inventory tab if on desktop
    if (window.innerWidth > 1000) {
        const $inventoryTab = $('.rpg-tab-btn[data-tab="inventory"]');
        if ($inventoryTab.length) {
            $inventoryTab.click();
        }
    }
    
    // Find and highlight the item after a delay for tab switch animation
    setTimeout(() => {
        // Search in inventory container specifically
        const $inventoryContainer = $('#rpg-inventory');
        const $items = $inventoryContainer.find('.rpg-item-name');
        let found = false;
        
        $items.each(function() {
            const text = $(this).text().trim();
            // Match exact or partial (for items that might have quantities etc)
            if (text === itemName || text.toLowerCase() === itemName.toLowerCase()) {
                const $row = $(this).closest('.rpg-item-row, .rpg-item-card');
                if ($row.length) {
                    // Scroll into view
                    $row[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
                    // Add highlight class
                    $row.addClass('rpg-highlight-item');
                    found = true;
                    // Remove after 3.5 seconds (after 3 animation cycles)
                    setTimeout(() => {
                        $row.removeClass('rpg-highlight-item');
                    }, 3500);
                }
                return false; // Break the loop
            }
        });
        
        if (!found) {
            toastr.warning(`Item "${itemName}" not found in inventory`);
        }
    }, 300);
}

/**
 * Navigates to the skills tab and highlights abilities linked to an item
 * @param {string} itemName - The item whose linked abilities to highlight
 */
export function navigateToLinkedSkills(itemName) {
    const linkedAbilities = getAbilitiesLinkedToItem(itemName);
    if (linkedAbilities.length === 0) {
        toastr.info(`No skills linked to "${itemName}"`);
        return;
    }
    
    // Switch to skills tab if on desktop
    if (window.innerWidth > 1000) {
        const $skillsTab = $('.rpg-tab-btn[data-tab="skills"]');
        if ($skillsTab.length) {
            $skillsTab.click();
        }
    }
    
    // Highlight all linked abilities after a delay for tab switch
    setTimeout(() => {
        let firstHighlighted = false;
        
        linkedAbilities.forEach(({ skillName, abilityName }) => {
            // Find the skill category
            const $category = $(`.rpg-skill-category[data-skill="${skillName}"]`);
            if ($category.length) {
                // Find items within this category
                const $items = $category.find('.rpg-item-row, .rpg-item-card');
                $items.each(function() {
                    const $row = $(this);
                    const $name = $row.find('.rpg-item-name');
                    if ($name.text().trim() === abilityName) {
                        // Scroll first match into view
                        if (!firstHighlighted) {
                            $row[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
                            firstHighlighted = true;
                        }
                        // Add highlight class
                        $row.addClass('rpg-highlight-item');
                        // Remove after 3.5 seconds
                        setTimeout(() => {
                            $row.removeClass('rpg-highlight-item');
                        }, 3500);
                    }
                });
            }
        });
    }, 300);
}

/**
 * Gets all inventory items from current inventory state
 * @returns {string[]} Array of item names
 */
function getAllInventoryItems() {
    const items = [];
    const tracker = getTrackerData();
    const inv = tracker.inventory;
    if (!inv) return items;
    
    // On Person
    if (Array.isArray(inv.onPerson)) {
        items.push(...inv.onPerson.map(i => i?.name).filter(Boolean));
    }
    // Stored
    if (inv.stored && typeof inv.stored === 'object') {
        for (const locationItems of Object.values(inv.stored)) {
            if (Array.isArray(locationItems)) {
                items.push(...locationItems.map(i => i?.name).filter(Boolean));
            }
        }
    }
    // Assets
    if (Array.isArray(inv.assets)) {
        items.push(...inv.assets.map(i => i?.name).filter(Boolean));
    }
    // Simplified
    if (Array.isArray(inv.simplified)) {
        items.push(...inv.simplified.map(i => i?.name).filter(Boolean));
    }
    
    return [...new Set(items)];
}

// Track open add forms
const openAddForms = {};

/**
 * Shows the add item form for a skill category
 * @param {string} skillName - The skill category name
 */
function showAddForm(skillName) {
    openAddForms[skillName] = true;
    renderSkills();
    // Focus the input after render
    setTimeout(() => {
        $(`#rpg-new-skill-item-${CSS.escape(skillName)}`).focus();
    }, 50);
}

/**
 * Hides the add item form for a skill category
 * @param {string} skillName - The skill category name
 */
function hideAddForm(skillName) {
    openAddForms[skillName] = false;
    renderSkills();
}

/**
 * Saves a new item from the add form
 * @param {string} skillName - The skill category name
 */
function saveAddItem(skillName) {
    const input = $(`#rpg-new-skill-item-${CSS.escape(skillName)}`);
    const value = input.val()?.trim();
    if (value) {
        addSkillItem(skillName, value);
    }
    hideAddForm(skillName);
}

/**
 * Renders a structured skill ability (with name + description)
 * @param {string} skillName - The skill category name
 * @param {Object} ability - Structured ability object {name, description, grantedBy}
 * @param {number} index - The item index
 * @param {string} viewMode - View mode ('list' or 'grid')
 * @returns {string} HTML string
 */
function renderStructuredSkillAbility(skillName, ability, index, viewMode) {
    // Normalize ability - handle both string and object formats
    const normalizedAbility = typeof ability === 'string'
        ? { name: ability, description: '', grantedBy: null }
        : { name: ability?.name || 'Unknown', description: ability?.description || '', grantedBy: ability?.grantedBy || null };
    
    // Check for linked item from ability.grantedBy
    const linkedItem = normalizedAbility.grantedBy;
    const itemClass = viewMode === 'grid' ? 'rpg-item-card' : 'rpg-item-row';
    const hasLink = !!linkedItem;
    
    // Link indicator HTML - shows the item that grants this skill
    const linkIndicator = hasLink
        ? `<span class="rpg-skill-link-badge" data-action="goto-linked-item" data-item="${escapeHtml(linkedItem)}" title="${i18n.getTranslation('skills.gotoItem')}: ${escapeHtml(linkedItem)}">
            <i class="fa-solid fa-link"></i>
            <span class="rpg-link-item-name">${escapeHtml(linkedItem)}</span>
           </span>`
        : (extensionSettings.enableItemSkillLinks 
            ? `<button class="rpg-skill-link-btn" data-action="show-link-dropdown" data-skill="${escapeHtml(skillName)}" data-ability="${escapeHtml(normalizedAbility.name)}" data-index="${index}" title="${i18n.getTranslation('skills.linkToItem')}">
                <i class="fa-solid fa-link"></i>
               </button>`
            : '');
    
    // Unlink button
    const unlinkBtn = hasLink && extensionSettings.enableItemSkillLinks
        ? `<button class="rpg-skill-unlink-btn" data-action="unlink-ability" data-skill="${escapeHtml(skillName)}" data-ability="${escapeHtml(normalizedAbility.name)}" title="${i18n.getTranslation('skills.unlinkItem')}">
            <i class="fa-solid fa-unlink"></i>
           </button>`
        : '';
    
    if (viewMode === 'list') {
        return `
            <div class="${itemClass} rpg-structured ${hasLink ? 'rpg-has-link' : ''}" data-skill="${escapeHtml(skillName)}" data-index="${index}" data-ability="${escapeHtml(normalizedAbility.name)}">
                <div class="rpg-skill-ability-row">
                    <span class="rpg-item-name rpg-editable" contenteditable="true" data-skill="${escapeHtml(skillName)}" data-index="${index}" title="${i18n.getTranslation('global.clickToEdit')}">${escapeHtml(normalizedAbility.name)}</span>
                    ${linkIndicator}
                    ${unlinkBtn}
                    <button class="rpg-item-remove" data-action="remove-skill-item" data-skill="${escapeHtml(skillName)}" data-index="${index}" title="${i18n.getTranslation('skills.removeAbility')}">
                        <i class="fa-solid fa-times"></i>
                    </button>
                </div>
                <div class="rpg-skill-ability-desc-row">
                    <span class="rpg-item-description rpg-editable" contenteditable="true" data-skill="${escapeHtml(skillName)}" data-index="${index}" data-prop="description" title="Click to edit description">${escapeHtml(normalizedAbility.description)}</span>
                </div>
            </div>
        `;
    } else {
        return `
            <div class="${itemClass} rpg-structured ${hasLink ? 'rpg-has-link' : ''}" data-skill="${escapeHtml(skillName)}" data-index="${index}" data-ability="${escapeHtml(normalizedAbility.name)}">
                <div class="rpg-card-actions">
                    ${unlinkBtn}
                    <button class="rpg-item-remove" data-action="remove-skill-item" data-skill="${escapeHtml(skillName)}" data-index="${index}" title="${i18n.getTranslation('skills.removeAbility')}">
                        <i class="fa-solid fa-times"></i>
                    </button>
                </div>
                <span class="rpg-item-name rpg-editable" contenteditable="true" data-skill="${escapeHtml(skillName)}" data-index="${index}" title="${i18n.getTranslation('global.clickToEdit')}">${escapeHtml(normalizedAbility.name)}</span>
                ${linkIndicator}
                <div class="rpg-skill-ability-desc-row">
                    <span class="rpg-item-description rpg-editable" contenteditable="true" data-skill="${escapeHtml(skillName)}" data-index="${index}" data-prop="description" title="Click to edit description">${escapeHtml(normalizedAbility.description)}</span>
                </div>
            </div>
        `;
    }
}

/**
 * Renders a single skill ability item with link indicator (legacy string format)
 * @param {string} skillName - The skill category name
 * @param {string} abilityName - The ability name
 * @param {number} index - The item index
 * @param {string} viewMode - View mode ('list' or 'grid')
 * @returns {string} HTML string
 */
function renderSkillAbilityItem(skillName, abilityName, index, viewMode) {
    const linkedItem = extensionSettings.enableItemSkillLinks ? getLinkedItem(skillName, abilityName) : null;
    const itemClass = viewMode === 'grid' ? 'rpg-item-card' : 'rpg-item-row';
    const hasLink = !!linkedItem;
    
    // Link indicator HTML
    const linkIndicator = extensionSettings.enableItemSkillLinks ? (hasLink 
        ? `<span class="rpg-skill-link-badge" data-action="goto-linked-item" data-item="${escapeHtml(linkedItem)}" title="${i18n.getTranslation('skills.gotoItem')}: ${escapeHtml(linkedItem)}">
            <i class="fa-solid fa-link"></i>
            <span class="rpg-link-item-name">${escapeHtml(linkedItem)}</span>
           </span>`
        : `<button class="rpg-skill-link-btn" data-action="show-link-dropdown" data-skill="${escapeHtml(skillName)}" data-ability="${escapeHtml(abilityName)}" data-index="${index}" title="${i18n.getTranslation('skills.linkToItem')}">
            <i class="fa-solid fa-link"></i>
           </button>`
    ) : '';
    
    // Unlink button (only shown if linked)
    const unlinkBtn = hasLink && extensionSettings.enableItemSkillLinks
        ? `<button class="rpg-skill-unlink-btn" data-action="unlink-ability" data-skill="${escapeHtml(skillName)}" data-ability="${escapeHtml(abilityName)}" title="${i18n.getTranslation('skills.unlinkItem')}">
            <i class="fa-solid fa-unlink"></i>
           </button>`
        : '';
    
    if (viewMode === 'list') {
        return `
            <div class="${itemClass} ${hasLink ? 'rpg-has-link' : ''}" data-skill="${escapeHtml(skillName)}" data-index="${index}" data-ability="${escapeHtml(abilityName)}">
                <span class="rpg-item-name rpg-editable" contenteditable="true" data-skill="${escapeHtml(skillName)}" data-index="${index}" title="${i18n.getTranslation('global.clickToEdit')}">${escapeHtml(abilityName)}</span>
                ${linkIndicator}
                ${unlinkBtn}
                <button class="rpg-item-remove" data-action="remove-skill-item" data-skill="${escapeHtml(skillName)}" data-index="${index}" title="${i18n.getTranslation('skills.removeAbility')}">
                    <i class="fa-solid fa-times"></i>
                </button>
            </div>
        `;
    } else {
        return `
            <div class="${itemClass} ${hasLink ? 'rpg-has-link' : ''}" data-skill="${escapeHtml(skillName)}" data-index="${index}" data-ability="${escapeHtml(abilityName)}">
                <div class="rpg-card-actions">
                    ${unlinkBtn}
                    <button class="rpg-item-remove" data-action="remove-skill-item" data-skill="${escapeHtml(skillName)}" data-index="${index}" title="${i18n.getTranslation('skills.removeAbility')}">
                        <i class="fa-solid fa-times"></i>
                    </button>
                </div>
                <span class="rpg-item-name rpg-editable" contenteditable="true" data-skill="${escapeHtml(skillName)}" data-index="${index}" title="${i18n.getTranslation('global.clickToEdit')}">${escapeHtml(abilityName)}</span>
                ${linkIndicator}
            </div>
        `;
    }
}

/**
 * Gets structured skills data for a category
 * @param {string} skillName - The skill category name
 * @returns {Array|null} Structured abilities array or null
 */
function getStructuredSkillAbilities(skillName) {
    const tracker = getTrackerData();
    const skills = tracker.skills;
    if (skills && Array.isArray(skills[skillName])) {
        return skills[skillName];
    }
    return null;
}

/**
 * Renders a single skill category section
 * @param {string} skillName - The skill category name
 * @param {string} viewMode - View mode ('list' or 'grid')
 * @returns {string} HTML string
 */
function renderSkillCategory(skillName, viewMode) {
    // Check for structured data first
    const structuredAbilities = getStructuredSkillAbilities(skillName);
    const isStructured = structuredAbilities !== null;
    
    const items = isStructured ? structuredAbilities : parseItems(getSkillItems(skillName));
    const safeSkillName = skillName.replace(/[^a-zA-Z0-9]/g, '_');
    const isFormOpen = openAddForms[skillName];
    
    let itemsHtml = '';
    if (items.length === 0) {
        itemsHtml = `<div class="rpg-skill-items-empty" data-i18n-key="skills.noAbilities">${i18n.getTranslation('skills.noAbilities')}</div>`;
    } else if (isStructured) {
            // Render structured abilities with name + description
            itemsHtml = items.map((ability, index) => renderStructuredSkillAbility(skillName, ability, index, viewMode)).join('');
        } else {
            // Render legacy string-based abilities
            itemsHtml = items.map((item, index) => renderSkillAbilityItem(skillName, item, index, viewMode)).join('');
        }
    
    const listViewClass = viewMode === 'list' ? 'rpg-item-list-view' : 'rpg-item-grid-view';
    
    return `
        <div class="rpg-skill-category" data-skill="${escapeHtml(skillName)}">
            <div class="rpg-skill-category-header">
                <h5 class="rpg-skill-category-title">
                    <i class="fa-solid fa-star"></i>
                    <span>${escapeHtml(skillName)}</span>
                    <span class="rpg-skill-category-count">(${items.length})</span>
                </h5>
                <div class="rpg-skill-category-actions">
                    <div class="rpg-view-toggle">
                        <button class="rpg-view-btn ${viewMode === 'list' ? 'active' : ''}" data-action="switch-skill-view" data-skill="${escapeHtml(skillName)}" data-view="list" title="${i18n.getTranslation('global.listView')}">
                            <i class="fa-solid fa-list"></i>
                        </button>
                        <button class="rpg-view-btn ${viewMode === 'grid' ? 'active' : ''}" data-action="switch-skill-view" data-skill="${escapeHtml(skillName)}" data-view="grid" title="${i18n.getTranslation('global.gridView')}">
                            <i class="fa-solid fa-th"></i>
                        </button>
                    </div>
                    <button class="rpg-skill-add-btn" data-action="show-add-skill-item" data-skill="${escapeHtml(skillName)}" title="${i18n.getTranslation('skills.addAbility')}">
                        <i class="fa-solid fa-plus"></i> <span data-i18n-key="skills.addAbilityButton">${i18n.getTranslation('skills.addAbilityButton')}</span>
                    </button>
                </div>
            </div>
            <div class="rpg-skill-category-content">
                <div class="rpg-inline-form" id="rpg-add-skill-form-${safeSkillName}" style="display: ${isFormOpen ? 'flex' : 'none'};">
                    <input type="text" class="rpg-inline-input" id="rpg-new-skill-item-${safeSkillName}" placeholder="${i18n.getTranslation('skills.addAbilityPlaceholder')}" />
                    <div class="rpg-inline-buttons">
                        <button class="rpg-inline-btn rpg-inline-cancel" data-action="cancel-add-skill-item" data-skill="${escapeHtml(skillName)}">
                            <i class="fa-solid fa-times"></i> <span data-i18n-key="global.cancel">${i18n.getTranslation('global.cancel')}</span>
                        </button>
                        <button class="rpg-inline-btn rpg-inline-save" data-action="save-add-skill-item" data-skill="${escapeHtml(skillName)}">
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
 * Generates the full skills section HTML
 * @returns {string} HTML string
 */
export function generateSkillsHTML() {
    const skillCategories = getSkillCategories();
    
    if (skillCategories.length === 0) {
        return `
            <div class="rpg-skills-container">
                <div class="rpg-skills-empty">
                    <i class="fa-solid fa-star"></i>
                    <p data-i18n-key="skills.empty">${i18n.getTranslation('skills.empty')}</p>
                    <small data-i18n-key="skills.emptyNote">${i18n.getTranslation('skills.emptyNote')}</small>
                </div>
            </div>
        `;
    }
    
    // Get view modes for each skill (default to list)
    const viewModes = extensionSettings.skillsViewModes || {};
    
    let html = `<div class="rpg-skills-container">`;
    
    // Render each skill category
    for (const skillName of skillCategories) {
        const viewMode = viewModes[skillName] || 'list';
        html += renderSkillCategory(skillName, viewMode);
    }
    
    html += '</div>';
    return html;
}

/**
 * Sets up event listeners for skills section
 */
function setupSkillsEventListeners() {
    if (!$skillsContainer || $skillsContainer.length === 0) return;
    
    // Show add form
    $skillsContainer.off('click', '[data-action="show-add-skill-item"]').on('click', '[data-action="show-add-skill-item"]', function() {
        const skillName = $(this).data('skill');
        showAddForm(skillName);
    });
    
    // Cancel add form
    $skillsContainer.off('click', '[data-action="cancel-add-skill-item"]').on('click', '[data-action="cancel-add-skill-item"]', function() {
        const skillName = $(this).data('skill');
        hideAddForm(skillName);
    });
    
    // Save add form
    $skillsContainer.off('click', '[data-action="save-add-skill-item"]').on('click', '[data-action="save-add-skill-item"]', function() {
        const skillName = $(this).data('skill');
        saveAddItem(skillName);
    });
    
    // Enter key in add form
    $skillsContainer.off('keypress', '.rpg-inline-input').on('keypress', '.rpg-inline-input', function(e) {
        if (e.which === 13) { // Enter key
            const skillName = $(this).closest('.rpg-skill-category').data('skill');
            saveAddItem(skillName);
        }
    });
    
    // Remove item
    $skillsContainer.off('click', '[data-action="remove-skill-item"]').on('click', '[data-action="remove-skill-item"]', function() {
        const skillName = $(this).data('skill');
        const index = $(this).data('index');
        removeSkillItem(skillName, index);
        renderSkills();
    });
    
    // Edit item name (blur event for contenteditable)
    $skillsContainer.off('blur', '.rpg-item-name.rpg-editable').on('blur', '.rpg-item-name.rpg-editable', function() {
        const skillName = $(this).data('skill');
        const index = $(this).data('index');
        const newValue = $(this).text().trim();
        if (newValue) {
            updateSkillItem(skillName, index, newValue);
        } else {
            // If empty, remove the item
            removeSkillItem(skillName, index);
            renderSkills();
        }
    });
    
    // Edit item description (for structured skills)
    $skillsContainer.off('blur', '.rpg-item-description.rpg-editable').on('blur', '.rpg-item-description.rpg-editable', function() {
        const skillName = $(this).data('skill');
        const index = $(this).data('index');
        const newDesc = $(this).text().trim();
        updateStructuredSkillDescription(skillName, index, newDesc);
    });
    
    // Switch view mode for a skill category
    $skillsContainer.off('click', '[data-action="switch-skill-view"]').on('click', '[data-action="switch-skill-view"]', function() {
        const skillName = $(this).data('skill');
        const view = $(this).data('view');
        if (!extensionSettings.skillsViewModes) {
            extensionSettings.skillsViewModes = {};
        }
        extensionSettings.skillsViewModes[skillName] = view;
        saveSettings();
        renderSkills();
    });
    
    // Show link dropdown
    $skillsContainer.off('click', '[data-action="show-link-dropdown"]').on('click', '[data-action="show-link-dropdown"]', function(e) {
        e.stopPropagation();
        const $btn = $(this);
        const skillName = $btn.data('skill');
        const abilityName = $btn.data('ability');
        showLinkDropdown($btn, skillName, abilityName);
    });
    
    // Go to linked item in inventory
    $skillsContainer.off('click', '[data-action="goto-linked-item"]').on('click', '[data-action="goto-linked-item"]', function() {
        const itemName = $(this).data('item');
        if (itemName) {
            navigateToInventoryItem(itemName);
        }
    });
    
    // Unlink ability from item
    $skillsContainer.off('click', '[data-action="unlink-ability"]').on('click', '[data-action="unlink-ability"]', function(e) {
        e.stopPropagation();
        const skillName = $(this).data('skill');
        const abilityName = $(this).data('ability');
        unlinkAbility(skillName, abilityName);
        renderSkills();
    });
}

/**
 * Shows a dropdown to select an inventory item to link
 */
function showLinkDropdown($btn, skillName, abilityName) {
    // Remove any existing dropdown
    $('.rpg-link-dropdown').remove();
    
    const inventoryItems = getAllInventoryItems();
    
    if (inventoryItems.length === 0) {
        toastr.info(i18n.getTranslation('skills.noItemsToLink'));
        return;
    }
    
    // Build dropdown HTML
    let dropdownHtml = `<div class="rpg-link-dropdown">
        <div class="rpg-link-dropdown-header">
            <span>${i18n.getTranslation('skills.selectItemToLink')}</span>
            <button class="rpg-link-dropdown-close" data-action="close-link-dropdown"><i class="fa-solid fa-times"></i></button>
        </div>
        <div class="rpg-link-dropdown-list">`;
    
    for (const item of inventoryItems) {
        dropdownHtml += `<div class="rpg-link-dropdown-item" data-action="link-to-item" data-skill="${escapeHtml(skillName)}" data-ability="${escapeHtml(abilityName)}" data-item="${escapeHtml(item)}">
            <i class="fa-solid fa-box"></i> <span>${escapeHtml(item)}</span>
        </div>`;
    }
    
    dropdownHtml += `</div></div>`;
    
    const $dropdown = $(dropdownHtml);
    $('body').append($dropdown);
    
    // Position near the button
    const btnOffset = $btn.offset();
    $dropdown.css({
        position: 'fixed',
        top: btnOffset.top + $btn.outerHeight() + 5,
        left: Math.min(btnOffset.left, $(window).width() - $dropdown.outerWidth() - 10),
        zIndex: 10000
    });
    
    // Event handlers
    $dropdown.on('click', '[data-action="close-link-dropdown"]', () => $dropdown.remove());
    $dropdown.on('click', '[data-action="link-to-item"]', function() {
        linkAbilityToItem($(this).data('skill'), $(this).data('ability'), $(this).data('item'));
        $dropdown.remove();
        renderSkills();
        toastr.success(i18n.getTranslation('skills.linkCreated'));
    });
    
    // Close when clicking outside
    setTimeout(() => {
        $(document).one('click', function(e) {
            if (!$(e.target).closest('.rpg-link-dropdown, [data-action="show-link-dropdown"]').length) {
                $dropdown.remove();
            }
        });
    }, 100);
}

/**
 * Main render function for skills section
 */
export function renderSkills() {
    if (!extensionSettings.showSkills || !$skillsContainer || $skillsContainer.length === 0) {
        return;
    }
    
    const html = generateSkillsHTML();
    
    $skillsContainer.html(html);
    setupSkillsEventListeners();
    
    // Apply i18n translations (pass DOM element, not jQuery object)
    const domElement = $skillsContainer[0];
    if (domElement) {
        i18n.applyTranslations(domElement);
    }
}

/**
 * Builds a summary string of all skills for prompt injection
 * @returns {string} Formatted skills summary
 */
export function buildSkillsSummary() {
    const skillCategories = getSkillCategories();
    if (skillCategories.length === 0) return '';
    
    let summary = '';
    for (const skillName of skillCategories) {
        const items = getSkillItems(skillName);
        summary += `${skillName}: ${items}\n`;
    }
    return summary.trim();
}

