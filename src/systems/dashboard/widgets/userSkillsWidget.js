/**
 * User Skills Widget
 *
 * Comprehensive skills tracking system with categories, levels, and XP progress.
 * Features three sub-tabs, multiple view modes, and full CRUD operations.
 *
 * Data Model:
 * skills: {
 *     version: 1,
 *     categories: {
 *         'Combat': [{ name: 'Swordsmanship', level: 5, xp: 75, maxXP: 100 }, ...],
 *         'Magic': [...]
 *     },
 *     uncategorized: [...]
 * }
 */

import { parseItems, serializeItems } from '../../../utils/itemParser.js';

// Per-widget state storage (Map: widgetId => state)
const widgetStates = new Map();

/**
 * Get or initialize widget state
 */
function getWidgetState(widgetId) {
    if (!widgetStates.has(widgetId)) {
        widgetStates.set(widgetId, {
            activeSubTab: 'all',
            viewModes: {
                all: 'list',
                categories: 'list',
                quick: 'grid'
            },
            collapsedCategories: [],
            sortBy: 'level', // 'level', 'name', 'xp'
            filterText: ''
        });
    }
    return widgetStates.get(widgetId);
}

/**
 * Migrate old string format to structured format
 */
function migrateSkillsData(oldSkills) {
    // Already in new format
    if (oldSkills && typeof oldSkills === 'object' && oldSkills.version) {
        return oldSkills;
    }

    // Old string format: "Swordsmanship, Lockpicking, Alchemy"
    if (typeof oldSkills === 'string' && oldSkills.trim()) {
        const skillNames = parseItems(oldSkills);
        return {
            version: 1,
            categories: {},
            uncategorized: skillNames.map(name => ({
                name,
                level: 1,
                xp: 0,
                maxXP: 100
            }))
        };
    }

    // Empty or null
    return {
        version: 1,
        categories: {},
        uncategorized: []
    };
}

/**
 * Get all skills as flat array
 */
function getAllSkills(skillsData) {
    const skills = [];

    // Add skills from categories
    for (const [category, categorySkills] of Object.entries(skillsData.categories || {})) {
        categorySkills.forEach(skill => {
            skills.push({ ...skill, category });
        });
    }

    // Add uncategorized skills
    (skillsData.uncategorized || []).forEach(skill => {
        skills.push({ ...skill, category: null });
    });

    return skills;
}

/**
 * Sort skills
 */
function sortSkills(skills, sortBy) {
    const sorted = [...skills];

    switch (sortBy) {
        case 'level':
            sorted.sort((a, b) => b.level - a.level || a.name.localeCompare(b.name));
            break;
        case 'name':
            sorted.sort((a, b) => a.name.localeCompare(b.name));
            break;
        case 'xp':
            sorted.sort((a, b) => {
                const progressA = a.xp / a.maxXP;
                const progressB = b.xp / b.maxXP;
                return progressB - progressA || b.level - a.level;
            });
            break;
    }

    return sorted;
}

/**
 * Filter skills by search text
 */
function filterSkills(skills, filterText) {
    if (!filterText.trim()) return skills;

    const search = filterText.toLowerCase();
    return skills.filter(skill =>
        skill.name.toLowerCase().includes(search) ||
        (skill.category && skill.category.toLowerCase().includes(search))
    );
}

/**
 * Sanitize skill name
 */
function sanitizeSkillName(name) {
    return name.trim().replace(/[<>]/g, '').slice(0, 100);
}

/**
 * Sanitize category name
 */
function sanitizeCategoryName(name) {
    return name.trim().replace(/[<>]/g, '').slice(0, 50);
}

/**
 * Register User Skills Widget
 */
export function registerUserSkillsWidget(registry, dependencies) {
    const { getExtensionSettings, onDataChange } = dependencies;

    registry.register('userSkills', {
        name: 'User Skills',
        icon: '⚔️',
        description: 'Character skills with categories, levels, and XP tracking',
        category: 'skills',
        minSize: { w: 2, h: 4 },
        // Large widget like Inventory/Quests
        defaultSize: (columns) => {
            if (columns <= 2) {
                return { w: 2, h: 6 }; // Mobile: 2 cols (full), 6 rows
            }
            return { w: 3, h: 7 }; // Desktop: 3 cols (full), 7 rows
        },
        maxAutoSize: (columns) => {
            if (columns <= 2) {
                return { w: 2, h: 8 };
            }
            return { w: 3, h: 10 };
        },
        requiresSchema: false,

        /**
         * Render widget content
         */
        render(container, config = {}) {
            const settings = getExtensionSettings();
            const skillsConfig = settings.trackerConfig?.userStats?.skillsSection;

            // Check if skills tracking is enabled
            if (!skillsConfig?.enabled) {
                container.innerHTML = `
                    <div class="rpg-widget-disabled">
                        <i class="fa-solid fa-circle-exclamation" style="font-size: 2rem; margin-bottom: 0.5rem;"></i>
                        <p style="margin: 0; font-weight: 600;">Skills tracking is disabled</p>
                        <small style="opacity: 0.7; margin-top: 0.25rem;">Enable in Tracker Settings</small>
                    </div>
                `;
                return;
            }

            // Migrate and get skills data
            let skillsData = settings.userStats?.skills;
            skillsData = migrateSkillsData(skillsData);

            // Save migrated data
            if (!settings.userStats) settings.userStats = {};
            settings.userStats.skills = skillsData;

            // Get widget ID from container
            const widgetId = container.closest('[data-widget-id]')?.dataset.widgetId || 'default';
            const state = getWidgetState(widgetId);

            // Build UI based on active sub-tab
            const html = renderSkillsUI(skillsData, state, config, widgetId);
            container.innerHTML = html;

            // Attach event handlers
            attachSkillsHandlers(container, widgetId, dependencies, config);
        },

        /**
         * Get widget configuration schema
         */
        getConfig() {
            return {
                showXP: {
                    type: 'boolean',
                    label: 'Show XP Progress Bars',
                    default: true,
                    description: 'Display XP progress bars for each skill'
                },
                showCategories: {
                    type: 'boolean',
                    label: 'Show Category Tags',
                    default: true,
                    description: 'Show category labels on skill cards'
                },
                defaultSort: {
                    type: 'select',
                    label: 'Default Sort Order',
                    options: [
                        { value: 'level', label: 'By Level (High to Low)' },
                        { value: 'name', label: 'By Name (A-Z)' },
                        { value: 'xp', label: 'By XP Progress' }
                    ],
                    default: 'level',
                    description: 'How to sort skills in All Skills view'
                },
                maxLevel: {
                    type: 'number',
                    label: 'Maximum Skill Level',
                    default: 10,
                    min: 1,
                    max: 100,
                    description: 'Highest level a skill can reach'
                }
            };
        },

        /**
         * Handle widget resize
         */
        onResize(container, newW, newH) {
            // Add compact class for narrow widths
            if (newW <= 2) {
                container.classList.add('rpg-skills-compact');
                container.classList.remove('rpg-skills-wide');
            } else {
                container.classList.add('rpg-skills-wide');
                container.classList.remove('rpg-skills-compact');
            }
        }
    });
}

/**
 * Render skills UI
 */
function renderSkillsUI(skillsData, state, config, widgetId) {
    const allSkills = getAllSkills(skillsData);
    const hasSkills = allSkills.length > 0;

    let html = '<div class="rpg-skills-widget">';

    // Sub-tab navigation
    html += renderSubTabs(state.activeSubTab);

    // Scrollable content area
    html += '<div class="rpg-skills-views">';

    // Content based on active tab
    switch (state.activeSubTab) {
        case 'all':
            html += renderAllSkillsTab(skillsData, state, config);
            break;
        case 'categories':
            html += renderCategoriesTab(skillsData, state, config);
            break;
        case 'quick':
            html += renderQuickViewTab(skillsData, state, config);
            break;
    }

    html += '</div>'; // Close rpg-skills-views
    html += '</div>'; // Close rpg-skills-widget
    return html;
}

/**
 * Render sub-tab navigation
 */
function renderSubTabs(activeTab) {
    const tabs = [
        { id: 'all', label: 'All', icon: 'fa-list' },
        { id: 'categories', label: 'By Category', icon: 'fa-folder-tree' },
        { id: 'quick', label: 'Quick', icon: 'fa-bolt' }
    ];

    let html = '<div class="rpg-skills-subtabs">';
    tabs.forEach(tab => {
        const active = tab.id === activeTab ? 'active' : '';
        html += `
            <button class="rpg-skills-subtab ${active}" data-action="switch-tab" data-tab="${tab.id}">
                <i class="fa-solid ${tab.icon}"></i>
                <span class="rpg-subtab-label">${tab.label}</span>
            </button>
        `;
    });
    html += '</div>';

    return html;
}

/**
 * Render All Skills tab
 */
function renderAllSkillsTab(skillsData, state, config) {
    const allSkills = getAllSkills(skillsData);

    let html = '<div class="rpg-skills-content" data-tab="all">';

    // Header with controls
    html += `
        <div class="rpg-skills-header">
            <div class="rpg-skills-title">
                <i class="fa-solid fa-book-sparkles"></i>
                All Skills
            </div>
            <div class="rpg-skills-controls">
                <select class="rpg-sort-select" data-action="change-sort">
                    <option value="level" ${state.sortBy === 'level' ? 'selected' : ''}>By Level</option>
                    <option value="name" ${state.sortBy === 'name' ? 'selected' : ''}>By Name</option>
                    <option value="xp" ${state.sortBy === 'xp' ? 'selected' : ''}>By XP</option>
                </select>
                <div class="rpg-view-toggle">
                    <button class="rpg-view-btn ${state.viewModes.all === 'list' ? 'active' : ''}"
                            data-action="change-view" data-view="list" data-tab="all" title="List View">
                        <i class="fa-solid fa-list"></i>
                    </button>
                    <button class="rpg-view-btn ${state.viewModes.all === 'grid' ? 'active' : ''}"
                            data-action="change-view" data-view="grid" data-tab="all" title="Grid View">
                        <i class="fa-solid fa-grip"></i>
                    </button>
                </div>
                <button class="rpg-skills-add-btn" data-action="show-add-skill" title="Add Skill">
                    <i class="fa-solid fa-plus"></i>
                </button>
            </div>
        </div>
    `;

    // Search/filter
    html += `
        <div class="rpg-skills-filter">
            <i class="fa-solid fa-magnifying-glass"></i>
            <input type="text" class="rpg-filter-input" placeholder="Search skills..."
                   value="${state.filterText}" data-action="filter-skills">
        </div>
    `;

    // Add skill form (hidden by default)
    html += renderAddSkillForm(skillsData);

    // Skills list/grid
    if (allSkills.length === 0) {
        html += `
            <div class="rpg-skills-empty">
                <i class="fa-solid fa-book-open"></i>
                <p>No skills yet</p>
                <small>Click the + button to add your first skill</small>
            </div>
        `;
    } else {
        let filtered = filterSkills(allSkills, state.filterText);
        let sorted = sortSkills(filtered, state.sortBy);

        const viewMode = state.viewModes.all;
        html += `<div class="rpg-skills-list ${viewMode === 'grid' ? 'rpg-skills-grid' : ''}">`;
        sorted.forEach(skill => {
            html += renderSkillCard(skill, config, viewMode);
        });
        html += '</div>';

        if (filtered.length === 0 && allSkills.length > 0) {
            html += `
                <div class="rpg-skills-empty">
                    <i class="fa-solid fa-magnifying-glass"></i>
                    <p>No skills match your search</p>
                </div>
            `;
        }
    }

    html += '</div>';
    return html;
}

/**
 * Render By Category tab
 */
function renderCategoriesTab(skillsData, state, config) {
    let html = '<div class="rpg-skills-content" data-tab="categories">';

    // Header
    html += `
        <div class="rpg-skills-header">
            <div class="rpg-skills-title">
                <i class="fa-solid fa-folder-tree"></i>
                Skills by Category
            </div>
            <div class="rpg-skills-controls">
                <div class="rpg-view-toggle">
                    <button class="rpg-view-btn ${state.viewModes.categories === 'list' ? 'active' : ''}"
                            data-action="change-view" data-view="list" data-tab="categories" title="List View">
                        <i class="fa-solid fa-list"></i>
                    </button>
                    <button class="rpg-view-btn ${state.viewModes.categories === 'grid' ? 'active' : ''}"
                            data-action="change-view" data-view="grid" data-tab="categories" title="Grid View">
                        <i class="fa-solid fa-grip"></i>
                    </button>
                </div>
                <button class="rpg-skills-add-btn" data-action="show-add-category" title="Add Category">
                    <i class="fa-solid fa-folder-plus"></i>
                </button>
            </div>
        </div>
    `;

    // Add category form (hidden)
    html += renderAddCategoryForm();

    const viewMode = state.viewModes.categories;
    const categories = Object.keys(skillsData.categories || {}).sort();
    const uncategorized = skillsData.uncategorized || [];

    if (categories.length === 0 && uncategorized.length === 0) {
        html += `
            <div class="rpg-skills-empty">
                <i class="fa-solid fa-folder-open"></i>
                <p>No categories yet</p>
                <small>Click the folder+ button to create a category</small>
            </div>
        `;
    } else {
        // Render categories
        categories.forEach(category => {
            html += renderCategory(category, skillsData.categories[category], state, config, viewMode);
        });

        // Render uncategorized
        if (uncategorized.length > 0) {
            html += renderCategory('Uncategorized', uncategorized, state, config, viewMode, true);
        }
    }

    html += '</div>';
    return html;
}

/**
 * Render Quick View tab
 */
function renderQuickViewTab(skillsData, state, config) {
    const allSkills = getAllSkills(skillsData);
    const topSkills = allSkills.sort((a, b) => b.level - a.level).slice(0, 12);

    let html = '<div class="rpg-skills-content" data-tab="quick">';

    html += `
        <div class="rpg-skills-header">
            <div class="rpg-skills-title">
                <i class="fa-solid fa-bolt"></i>
                Quick View
            </div>
        </div>
    `;

    html += `<div class="rpg-skills-hint">
        <i class="fa-solid fa-circle-info"></i>
        <span>Showing your top skills for quick reference</span>
    </div>`;

    if (topSkills.length === 0) {
        html += `
            <div class="rpg-skills-empty">
                <i class="fa-solid fa-star"></i>
                <p>No skills to display</p>
                <small>Add skills in the "All Skills" tab</small>
            </div>
        `;
    } else {
        html += '<div class="rpg-skills-list rpg-skills-grid rpg-skills-quick">';
        topSkills.forEach(skill => {
            html += renderSkillCard(skill, config, 'quick');
        });
        html += '</div>';
    }

    html += '</div>';
    return html;
}

/**
 * Render category section
 */
function renderCategory(categoryName, skills, state, config, viewMode, isUncategorized = false) {
    const isCollapsed = state.collapsedCategories.includes(categoryName);

    let html = '<div class="rpg-skills-category">';

    // Category header
    html += `
        <div class="rpg-category-header">
            <button class="rpg-category-toggle" data-action="toggle-category" data-category="${categoryName}">
                <i class="fa-solid fa-chevron-${isCollapsed ? 'right' : 'down'}"></i>
            </button>
            <div class="rpg-category-name">${categoryName}</div>
            <div class="rpg-category-badge">${skills.length}</div>
            ${!isUncategorized ? `
                <button class="rpg-category-action" data-action="rename-category" data-category="${categoryName}" title="Rename">
                    <i class="fa-solid fa-pen"></i>
                </button>
                <button class="rpg-category-action" data-action="delete-category" data-category="${categoryName}" title="Delete">
                    <i class="fa-solid fa-trash"></i>
                </button>
            ` : ''}
            <button class="rpg-category-action" data-action="show-add-skill-to-category" data-category="${categoryName}" title="Add Skill">
                <i class="fa-solid fa-plus"></i>
            </button>
        </div>
    `;

    // Category content
    if (!isCollapsed) {
        html += renderAddSkillForm(null, categoryName, true);
        html += `<div class="rpg-skills-list ${viewMode === 'grid' ? 'rpg-skills-grid' : ''}">`;
        skills.forEach(skill => {
            html += renderSkillCard({ ...skill, category: isUncategorized ? null : categoryName }, config, viewMode);
        });
        html += '</div>';
    }

    html += '</div>';
    return html;
}

/**
 * Render skill card
 */
function renderSkillCard(skill, config, viewMode) {
    const xpPercent = (skill.xp / skill.maxXP) * 100;
    const showXP = config.showXP !== false;
    const showCategory = config.showCategories !== false && skill.category;
    const isQuickView = viewMode === 'quick';

    let html = `<div class="rpg-skill-card ${isQuickView ? 'rpg-skill-quick' : ''}" data-skill="${skill.name}" data-category="${skill.category || 'Uncategorized'}">`;

    // Skill info wrapper (name, level, XP bar)
    html += '<div class="rpg-skill-info">';

    // Header row with name and level
    html += '<div class="rpg-skill-header-row">';
    html += `<div class="rpg-skill-name rpg-editable" contenteditable="true" data-action="edit-skill-name" data-original="${skill.name}">${skill.name}</div>`;
    html += `<div class="rpg-skill-level" title="Level ${skill.level}">Lv ${skill.level}</div>`;
    html += '</div>';

    // XP bar (if not quick view)
    if (showXP && !isQuickView) {
        html += `
            <div class="rpg-xp-bar">
                <div class="rpg-xp-fill" style="width: ${xpPercent}%"></div>
                <div class="rpg-xp-text">${skill.xp}/${skill.maxXP} XP</div>
            </div>
        `;
    }

    html += '</div>'; // Close rpg-skill-info

    // Actions
    html += '<div class="rpg-skill-actions">';
    if (!isQuickView) {
        html += `
            <button class="rpg-skill-action rpg-level-up-btn" data-action="level-up" title="Level Up">
                <i class="fa-solid fa-arrow-up"></i>
            </button>
            <button class="rpg-skill-action rpg-level-down-btn" data-action="level-down" title="Level Down">
                <i class="fa-solid fa-arrow-down"></i>
            </button>
            <button class="rpg-skill-action rpg-delete-btn" data-action="delete-skill" title="Delete">
                <i class="fa-solid fa-trash"></i>
            </button>
        `;
    } else {
        html += `
            <button class="rpg-skill-action rpg-level-up-btn" data-action="level-up" title="Level Up">
                <i class="fa-solid fa-arrow-up"></i>
            </button>
        `;
    }
    html += '</div>';

    html += '</div>';
    return html;
}

/**
 * Render add skill form
 */
function renderAddSkillForm(skillsData, targetCategory = null, isInCategory = false) {
    const categories = skillsData ? Object.keys(skillsData.categories || {}).sort() : [];

    let html = `<div class="rpg-inline-form rpg-add-skill-form" ${targetCategory ? `data-target-category="${targetCategory}"` : ''} style="display: none;">`;

    html += '<div class="rpg-inline-form-row">';
    html += '<input type="text" class="rpg-inline-input" placeholder="Skill name" data-field="name" maxlength="100">';
    html += '<input type="number" class="rpg-inline-input-small" placeholder="Level" value="1" min="1" max="100" data-field="level">';

    if (!isInCategory && categories.length > 0) {
        html += '<select class="rpg-inline-select" data-field="category">';
        html += '<option value="">Uncategorized</option>';
        categories.forEach(cat => {
            html += `<option value="${cat}">${cat}</option>`;
        });
        html += '</select>';
    }

    html += '</div>';

    html += '<div class="rpg-inline-buttons">';
    html += '<button class="rpg-inline-btn rpg-inline-cancel" data-action="cancel-add-skill">Cancel</button>';
    html += '<button class="rpg-inline-btn rpg-inline-save" data-action="save-add-skill">Add</button>';
    html += '</div>';

    html += '</div>';
    return html;
}

/**
 * Render add category form
 */
function renderAddCategoryForm() {
    let html = '<div class="rpg-inline-form rpg-add-category-form" style="display: none;">';
    html += '<input type="text" class="rpg-inline-input" placeholder="Category name" data-field="name" maxlength="50">';
    html += '<div class="rpg-inline-buttons">';
    html += '<button class="rpg-inline-btn rpg-inline-cancel" data-action="cancel-add-category">Cancel</button>';
    html += '<button class="rpg-inline-btn rpg-inline-save" data-action="save-add-category">Add</button>';
    html += '</div>';
    html += '</div>';
    return html;
}

/**
 * Attach event handlers
 */
function attachSkillsHandlers(container, widgetId, dependencies, config) {
    const { getExtensionSettings, onDataChange } = dependencies;

    // Check if handlers are already attached to prevent duplicate listeners
    if (container.dataset.handlersAttached === 'true') {
        return;
    }
    container.dataset.handlersAttached = 'true';

    // Event delegation
    container.addEventListener('click', (e) => {
        const target = e.target.closest('[data-action]');
        if (!target) return;

        const action = target.dataset.action;
        handleAction(action, target, container, widgetId, dependencies, config);
    });

    // Filter input
    const filterInput = container.querySelector('.rpg-filter-input');
    if (filterInput) {
        filterInput.addEventListener('input', (e) => {
            const state = getWidgetState(widgetId);
            state.filterText = e.target.value;
            rerender(container, widgetId, dependencies, config);
        });
    }

    // Sort select
    const sortSelect = container.querySelector('.rpg-sort-select');
    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
            const state = getWidgetState(widgetId);
            state.sortBy = e.target.value;
            rerender(container, widgetId, dependencies, config);
        });
    }

    // Skill name editing
    container.addEventListener('blur', (e) => {
        if (e.target.hasAttribute('contenteditable') && e.target.dataset.action === 'edit-skill-name') {
            const skillName = e.target.dataset.original;
            const newName = sanitizeSkillName(e.target.textContent);

            if (newName && newName !== skillName) {
                updateSkillName(skillName, e.target.closest('.rpg-skill-card').dataset.category, newName, dependencies);
                rerender(container, widgetId, dependencies, config);
            } else {
                e.target.textContent = skillName;
            }
        }
    }, true);

    // Keyboard shortcuts
    container.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const target = e.target;
            if (target.classList.contains('rpg-inline-input')) {
                e.preventDefault();
                const saveBtn = target.closest('.rpg-inline-form').querySelector('.rpg-inline-save');
                if (saveBtn) saveBtn.click();
            } else if (target.hasAttribute('contenteditable')) {
                e.preventDefault();
                target.blur();
            }
        } else if (e.key === 'Escape') {
            const target = e.target;
            if (target.classList.contains('rpg-inline-input')) {
                const cancelBtn = target.closest('.rpg-inline-form').querySelector('.rpg-inline-cancel');
                if (cancelBtn) cancelBtn.click();
            } else if (target.hasAttribute('contenteditable')) {
                const original = target.dataset.original;
                target.textContent = original;
                target.blur();
            }
        }
    });
}

/**
 * Handle actions
 */
function handleAction(action, target, container, widgetId, dependencies, config) {
    const settings = dependencies.getExtensionSettings();
    const state = getWidgetState(widgetId);

    switch (action) {
        case 'switch-tab':
            state.activeSubTab = target.dataset.tab;
            rerender(container, widgetId, dependencies, config);
            break;

        case 'change-view':
            state.viewModes[target.dataset.tab] = target.dataset.view;
            rerender(container, widgetId, dependencies, config);
            break;

        case 'show-add-skill':
            showAddSkillForm(container);
            break;

        case 'show-add-skill-to-category':
            showAddSkillForm(container, target.dataset.category);
            break;

        case 'cancel-add-skill':
            hideAddSkillForm(container, target);
            break;

        case 'save-add-skill':
            saveNewSkill(container, target, dependencies);
            rerender(container, widgetId, dependencies, config);
            break;

        case 'show-add-category':
            showAddCategoryForm(container);
            break;

        case 'cancel-add-category':
            hideAddCategoryForm(container);
            break;

        case 'save-add-category':
            saveNewCategory(container, dependencies);
            rerender(container, widgetId, dependencies, config);
            break;

        case 'toggle-category':
            toggleCategory(target.dataset.category, state);
            rerender(container, widgetId, dependencies, config);
            break;

        case 'level-up':
            levelUpSkill(target, dependencies);
            rerender(container, widgetId, dependencies, config);
            break;

        case 'level-down':
            levelDownSkill(target, dependencies);
            rerender(container, widgetId, dependencies, config);
            break;

        case 'delete-skill':
            deleteSkill(target, dependencies);
            rerender(container, widgetId, dependencies, config);
            break;

        case 'delete-category':
            deleteCategory(target.dataset.category, dependencies);
            rerender(container, widgetId, dependencies, config);
            break;
    }
}

/**
 * Show add skill form
 */
function showAddSkillForm(container, targetCategory = null) {
    const form = targetCategory
        ? container.querySelector(`.rpg-add-skill-form[data-target-category="${targetCategory}"]`)
        : container.querySelector('.rpg-add-skill-form:not([data-target-category])');

    if (form) {
        form.style.display = 'block';
        const input = form.querySelector('input[data-field="name"]');
        if (input) input.focus();
    }
}

/**
 * Hide add skill form
 */
function hideAddSkillForm(container, cancelBtn) {
    const form = cancelBtn.closest('.rpg-add-skill-form');
    if (form) {
        form.style.display = 'none';
        form.querySelectorAll('input').forEach(input => input.value = '');
    }
}

/**
 * Save new skill
 */
function saveNewSkill(container, saveBtn, dependencies) {
    const form = saveBtn.closest('.rpg-add-skill-form');
    const nameInput = form.querySelector('[data-field="name"]');
    const levelInput = form.querySelector('[data-field="level"]');
    const categorySelect = form.querySelector('[data-field="category"]');

    const name = sanitizeSkillName(nameInput.value);
    const level = parseInt(levelInput.value) || 1;
    const category = form.dataset.targetCategory || (categorySelect ? categorySelect.value : null);

    if (!name) return;

    const settings = dependencies.getExtensionSettings();
    const skillsData = settings.userStats.skills;

    const newSkill = {
        name,
        level: Math.max(1, Math.min(100, level)),
        xp: 0,
        maxXP: 100
    };

    if (category && category !== '' && category !== 'Uncategorized') {
        if (!skillsData.categories[category]) {
            skillsData.categories[category] = [];
        }
        skillsData.categories[category].push(newSkill);
    } else {
        skillsData.uncategorized.push(newSkill);
    }

    saveSkillsData(settings, skillsData, dependencies);

    form.style.display = 'none';
    form.querySelectorAll('input').forEach(input => input.value = '');
}

/**
 * Show add category form
 */
function showAddCategoryForm(container) {
    const form = container.querySelector('.rpg-add-category-form');
    if (form) {
        form.style.display = 'block';
        const input = form.querySelector('input');
        if (input) input.focus();
    }
}

/**
 * Hide add category form
 */
function hideAddCategoryForm(container) {
    const form = container.querySelector('.rpg-add-category-form');
    if (form) {
        form.style.display = 'none';
        form.querySelector('input').value = '';
    }
}

/**
 * Save new category
 */
function saveNewCategory(container, dependencies) {
    const form = container.querySelector('.rpg-add-category-form');
    const input = form.querySelector('input');
    const name = sanitizeCategoryName(input.value);

    if (!name) return;

    const settings = dependencies.getExtensionSettings();
    const skillsData = settings.userStats.skills;

    if (!skillsData.categories[name]) {
        skillsData.categories[name] = [];
        saveSkillsData(settings, skillsData, dependencies);
    }

    form.style.display = 'none';
    input.value = '';
}

/**
 * Toggle category collapsed state
 */
function toggleCategory(categoryName, state) {
    const index = state.collapsedCategories.indexOf(categoryName);
    if (index >= 0) {
        state.collapsedCategories.splice(index, 1);
    } else {
        state.collapsedCategories.push(categoryName);
    }
}

/**
 * Level up skill
 */
function levelUpSkill(target, dependencies) {
    const card = target.closest('.rpg-skill-card');
    const skillName = card.dataset.skill;
    const category = card.dataset.category === 'Uncategorized' ? null : card.dataset.category;

    const settings = dependencies.getExtensionSettings();
    const skillsData = settings.userStats.skills;

    const skill = findSkill(skillsData, skillName, category);
    if (skill) {
        skill.level++;
        skill.xp = 0; // Reset XP on level up
        saveSkillsData(settings, skillsData, dependencies);
    }
}

/**
 * Level down skill
 */
function levelDownSkill(target, dependencies) {
    const card = target.closest('.rpg-skill-card');
    const skillName = card.dataset.skill;
    const category = card.dataset.category === 'Uncategorized' ? null : card.dataset.category;

    const settings = dependencies.getExtensionSettings();
    const skillsData = settings.userStats.skills;

    const skill = findSkill(skillsData, skillName, category);
    if (skill && skill.level > 1) {
        skill.level--;
        skill.xp = 0; // Reset XP on level change
        saveSkillsData(settings, skillsData, dependencies);
    }
}

/**
 * Delete skill
 */
function deleteSkill(target, dependencies) {
    const card = target.closest('.rpg-skill-card');
    const skillName = card.dataset.skill;
    const category = card.dataset.category === 'Uncategorized' ? null : card.dataset.category;

    const settings = dependencies.getExtensionSettings();
    const skillsData = settings.userStats.skills;

    removeSkill(skillsData, skillName, category);
    saveSkillsData(settings, skillsData, dependencies);
}

/**
 * Delete category
 */
function deleteCategory(categoryName, dependencies) {
    const settings = dependencies.getExtensionSettings();
    const skillsData = settings.userStats.skills;

    if (skillsData.categories[categoryName]) {
        // Move skills to uncategorized
        const skills = skillsData.categories[categoryName];
        skillsData.uncategorized.push(...skills);
        delete skillsData.categories[categoryName];
        saveSkillsData(settings, skillsData, dependencies);
    }
}

/**
 * Update skill name
 */
function updateSkillName(oldName, category, newName, dependencies) {
    const settings = dependencies.getExtensionSettings();
    const skillsData = settings.userStats.skills;

    const skill = findSkill(skillsData, oldName, category === 'Uncategorized' ? null : category);
    if (skill) {
        skill.name = newName;
        saveSkillsData(settings, skillsData, dependencies);
    }
}

/**
 * Find skill in data
 */
function findSkill(skillsData, name, category) {
    if (category) {
        const categorySkills = skillsData.categories[category];
        return categorySkills ? categorySkills.find(s => s.name === name) : null;
    } else {
        return skillsData.uncategorized.find(s => s.name === name);
    }
}

/**
 * Remove skill from data
 */
function removeSkill(skillsData, name, category) {
    if (category) {
        const categorySkills = skillsData.categories[category];
        if (categorySkills) {
            const index = categorySkills.findIndex(s => s.name === name);
            if (index >= 0) categorySkills.splice(index, 1);
        }
    } else {
        const index = skillsData.uncategorized.findIndex(s => s.name === name);
        if (index >= 0) skillsData.uncategorized.splice(index, 1);
    }
}

/**
 * Save skills data
 */
function saveSkillsData(settings, skillsData, dependencies) {
    settings.userStats.skills = skillsData;

    if (dependencies.onDataChange) {
        dependencies.onDataChange('userStats', 'skills', skillsData);
    }
}

/**
 * Re-render widget
 */
function rerender(container, widgetId, dependencies, config) {
    const settings = dependencies.getExtensionSettings();
    const skillsData = settings.userStats.skills;
    const state = getWidgetState(widgetId);

    const html = renderSkillsUI(skillsData, state, config, widgetId);
    container.innerHTML = html;

    attachSkillsHandlers(container, widgetId, dependencies, config);
}
