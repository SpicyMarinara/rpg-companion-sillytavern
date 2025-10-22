/**
 * Widget Definition Type
 * @typedef {Object} WidgetDefinition
 * @property {string} name - Display name of the widget
 * @property {string} icon - Emoji or icon for the widget
 * @property {string} description - Brief description of widget functionality
 * @property {{w: number, h: number}} minSize - Minimum grid size (width × height)
 * @property {{w: number, h: number}} defaultSize - Default grid size when added
 * @property {boolean} requiresSchema - Whether widget requires active schema to function
 * @property {Function} render - Render function: (container, config) => void
 * @property {Function} [getConfig] - Optional: Returns configurable options
 * @property {Function} [onConfigChange] - Optional: Called when config changes
 * @property {Function} [onRemove] - Optional: Cleanup when widget removed
 * @property {Function} [onResize] - Optional: Called when widget resized
 */

/**
 * Widget Configuration Type
 * @typedef {Object} WidgetConfig
 * @property {string} type - Type of config (text, number, boolean, select, color)
 * @property {string} label - Display label for the config option
 * @property {*} default - Default value
 * @property {Array<*>} [options] - Options for select type
 * @property {number} [min] - Min value for number type
 * @property {number} [max] - Max value for number type
 */

/**
 * WidgetRegistry - Central registry for all widget types
 *
 * Manages widget definitions and provides methods to register, retrieve,
 * and filter available widgets based on schema requirements.
 *
 * @class WidgetRegistry
 */
export class WidgetRegistry {
    /**
     * Initialize widget registry
     */
    constructor() {
        /** @type {Map<string, WidgetDefinition>} */
        this.widgets = new Map();

        console.log('[WidgetRegistry] Initialized');
    }

    /**
     * Register a new widget type
     *
     * @param {string} type - Unique identifier for the widget type
     * @param {WidgetDefinition} definition - Widget definition object
     * @throws {Error} If widget type already registered
     *
     * @example
     * registry.register('userStats', {
     *   name: 'User Stats',
     *   icon: '❤️',
     *   description: 'Health, energy, satiety bars',
     *   minSize: { w: 2, h: 2 },
     *   defaultSize: { w: 4, h: 3 },
     *   requiresSchema: false,
     *   render: (container, config) => {
     *     container.innerHTML = '<div>User stats here</div>';
     *   }
     * });
     */
    register(type, definition) {
        // Validate type
        if (!type || typeof type !== 'string') {
            throw new Error('[WidgetRegistry] Widget type must be a non-empty string');
        }

        // Check for duplicate
        if (this.widgets.has(type)) {
            console.warn(`[WidgetRegistry] Widget type "${type}" already registered, overwriting`);
        }

        // Validate required fields
        const required = ['name', 'icon', 'description', 'minSize', 'defaultSize', 'requiresSchema', 'render'];
        for (const field of required) {
            if (!(field in definition)) {
                throw new Error(`[WidgetRegistry] Widget definition missing required field: ${field}`);
            }
        }

        // Validate minSize and defaultSize
        if (!definition.minSize.w || !definition.minSize.h) {
            throw new Error('[WidgetRegistry] Widget minSize must have w and h properties');
        }
        if (!definition.defaultSize.w || !definition.defaultSize.h) {
            throw new Error('[WidgetRegistry] Widget defaultSize must have w and h properties');
        }

        // Validate render function
        if (typeof definition.render !== 'function') {
            throw new Error('[WidgetRegistry] Widget render must be a function');
        }

        // Store widget definition
        this.widgets.set(type, {
            ...definition,
            // Bind render function to maintain 'this' context
            render: definition.render.bind(definition),
            // Bind optional lifecycle functions
            getConfig: definition.getConfig?.bind(definition),
            onConfigChange: definition.onConfigChange?.bind(definition),
            onRemove: definition.onRemove?.bind(definition),
            onResize: definition.onResize?.bind(definition)
        });

        console.log(`[WidgetRegistry] Registered widget: ${type} (${definition.name})`);
    }

    /**
     * Get widget definition by type
     *
     * @param {string} type - Widget type identifier
     * @returns {WidgetDefinition|undefined} Widget definition or undefined if not found
     *
     * @example
     * const userStatsWidget = registry.get('userStats');
     * if (userStatsWidget) {
     *   userStatsWidget.render(container, config);
     * }
     */
    get(type) {
        const widget = this.widgets.get(type);
        if (!widget) {
            console.warn(`[WidgetRegistry] Widget type "${type}" not found`);
        }
        return widget;
    }

    /**
     * Get all available widgets, optionally filtered by schema requirement
     *
     * @param {boolean} [hasSchema=false] - Whether an active schema is present
     * @returns {Array<{type: string, definition: WidgetDefinition}>} Array of available widgets
     *
     * @example
     * // Get widgets that work without schema
     * const coreWidgets = registry.getAvailable(false);
     *
     * // Get all widgets (schema active)
     * const allWidgets = registry.getAvailable(true);
     */
    getAvailable(hasSchema = false) {
        const available = [];

        for (const [type, definition] of this.widgets.entries()) {
            // If widget requires schema and we don't have one, skip it
            if (definition.requiresSchema && !hasSchema) {
                continue;
            }

            available.push({
                type,
                definition
            });
        }

        console.log(`[WidgetRegistry] Found ${available.length} available widgets (hasSchema: ${hasSchema})`);
        return available;
    }

    /**
     * Get all registered widget types (regardless of schema requirement)
     *
     * @returns {Array<{type: string, definition: WidgetDefinition}>} All registered widgets
     */
    getAll() {
        const all = [];
        for (const [type, definition] of this.widgets.entries()) {
            all.push({ type, definition });
        }
        return all;
    }

    /**
     * Check if widget type is registered
     *
     * @param {string} type - Widget type identifier
     * @returns {boolean} True if widget type is registered
     */
    has(type) {
        return this.widgets.has(type);
    }

    /**
     * Unregister a widget type
     *
     * @param {string} type - Widget type identifier
     * @returns {boolean} True if widget was removed, false if not found
     *
     * @example
     * registry.unregister('oldWidget');
     */
    unregister(type) {
        const existed = this.widgets.delete(type);
        if (existed) {
            console.log(`[WidgetRegistry] Unregistered widget: ${type}`);
        } else {
            console.warn(`[WidgetRegistry] Cannot unregister "${type}" - not found`);
        }
        return existed;
    }

    /**
     * Get count of registered widgets
     *
     * @returns {number} Number of registered widgets
     */
    count() {
        return this.widgets.size;
    }

    /**
     * Clear all registered widgets
     *
     * @returns {number} Number of widgets cleared
     */
    clear() {
        const count = this.widgets.size;
        this.widgets.clear();
        console.log(`[WidgetRegistry] Cleared ${count} widgets`);
        return count;
    }

    /**
     * Get statistics about registered widgets
     *
     * @returns {Object} Registry statistics
     */
    getStats() {
        const all = this.getAll();
        const schemaRequired = all.filter(w => w.definition.requiresSchema).length;
        const noSchema = all.length - schemaRequired;

        return {
            total: all.length,
            requiresSchema: schemaRequired,
            noSchema: noSchema,
            types: all.map(w => w.type)
        };
    }
}

/**
 * Global widget registry instance
 * @type {WidgetRegistry}
 */
export const widgetRegistry = new WidgetRegistry();
