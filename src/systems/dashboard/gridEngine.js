/**
 * GridEngine - Core grid layout engine for widget dashboard
 *
 * Handles grid-based positioning, snapping, collision detection, and auto-reflow.
 * Uses a 12-column responsive grid system (default) with configurable row height.
 *
 * @class GridEngine
 */
export class GridEngine {
    /**
     * Initialize grid engine with configuration
     *
     * @param {Object} config - Grid configuration
     * @param {number} [config.columns=12] - Number of grid columns
     * @param {number} [config.rowHeight=80] - Height of each row in pixels
     * @param {number} [config.gap=12] - Gap between widgets in pixels
     * @param {boolean} [config.snapToGrid=true] - Enable auto-snapping to grid
     */
    constructor(config = {}) {
        this.columns = config.columns || 12;
        this.rowHeight = config.rowHeight || 80;
        this.gap = config.gap || 12;
        this.snapToGrid = config.snapToGrid !== false;

        // Container width will be set dynamically
        this.containerWidth = 0;

        console.log('[GridEngine] Initialized:', {
            columns: this.columns,
            rowHeight: this.rowHeight,
            gap: this.gap,
            snapToGrid: this.snapToGrid
        });
    }

    /**
     * Set container width (called when container is measured or resized)
     *
     * @param {number} width - Container width in pixels
     */
    setContainerWidth(width) {
        this.containerWidth = width;
        console.log('[GridEngine] Container width set to:', width);
    }

    /**
     * Calculate pixel position from grid coordinates
     *
     * Converts grid-based widget position (x, y, w, h) to actual pixel values
     * (left, top, width, height) for CSS positioning.
     *
     * @param {Object} widget - Widget with grid coordinates
     * @param {number} widget.x - Grid column position (0-based)
     * @param {number} widget.y - Grid row position (0-based)
     * @param {number} widget.w - Width in grid columns
     * @param {number} widget.h - Height in grid rows
     * @returns {Object} Pixel coordinates {left, top, width, height}
     *
     * @example
     * // Widget at column 2, row 1, size 4x3
     * const pixels = gridEngine.getPixelPosition({ x: 2, y: 1, w: 4, h: 3 });
     * // Returns: { left: 200, top: 100, width: 300, height: 250 }
     */
    getPixelPosition(widget) {
        if (this.containerWidth === 0) {
            console.warn('[GridEngine] Container width not set, using default 1200px');
            this.containerWidth = 1200;
        }

        // Calculate column width
        // Formula: (containerWidth - gaps) / columns
        // Gaps: (columns + 1) gaps total (one before each column + one after last)
        const totalGaps = this.gap * (this.columns + 1);
        const colWidth = (this.containerWidth - totalGaps) / this.columns;

        // Calculate positions
        // Left: x columns * (colWidth + gap) + initial gap
        const left = widget.x * (colWidth + this.gap) + this.gap;

        // Top: y rows * (rowHeight + gap) + initial gap
        const top = widget.y * (this.rowHeight + this.gap) + this.gap;

        // Width: w columns * colWidth + (w - 1) inner gaps
        const width = widget.w * colWidth + (widget.w - 1) * this.gap;

        // Height: h rows * rowHeight + (h - 1) inner gaps
        const height = widget.h * this.rowHeight + (widget.h - 1) * this.gap;

        return { left, top, width, height };
    }

    /**
     * Snap pixel coordinates to nearest grid cell
     *
     * Converts pixel position (from drag-and-drop) to grid coordinates.
     * Clamps to valid grid bounds.
     *
     * @param {number} pixelX - X coordinate in pixels
     * @param {number} pixelY - Y coordinate in pixels
     * @returns {Object} Grid coordinates {x, y}
     *
     * @example
     * // Mouse dragged to pixel (250, 175)
     * const gridPos = gridEngine.snapToCell(250, 175);
     * // Returns: { x: 3, y: 2 } (nearest grid cell)
     */
    snapToCell(pixelX, pixelY) {
        if (this.containerWidth === 0) {
            console.warn('[GridEngine] Container width not set, using default 1200px');
            this.containerWidth = 1200;
        }

        // Calculate column width
        const totalGaps = this.gap * (this.columns + 1);
        const colWidth = (this.containerWidth - totalGaps) / this.columns;

        // Convert pixel to grid coordinates
        // Reverse of getPixelPosition formula
        // x = (pixelX - gap) / (colWidth + gap)
        const x = Math.round((pixelX - this.gap) / (colWidth + this.gap));
        const y = Math.round((pixelY - this.gap) / (this.rowHeight + this.gap));

        // Clamp to valid grid bounds
        return {
            x: Math.max(0, Math.min(x, this.columns - 1)),
            y: Math.max(0, y) // No maximum Y (infinite rows)
        };
    }

    /**
     * Detect if widget collides with any other widgets
     *
     * Uses rectangle intersection algorithm. Two rectangles DON'T intersect if:
     * - rect1 is completely left of rect2, OR
     * - rect1 is completely right of rect2, OR
     * - rect1 is completely above rect2, OR
     * - rect1 is completely below rect2
     *
     * If none of the above are true, they must intersect.
     *
     * @param {Object} widget - Widget to check for collisions
     * @param {Array<Object>} widgets - Array of other widgets to check against
     * @returns {boolean} True if widget collides with any other widget
     *
     * @example
     * const widget = { x: 2, y: 1, w: 4, h: 3 };
     * const others = [{ x: 4, y: 2, w: 2, h: 2 }];
     * const collides = gridEngine.detectCollision(widget, others);
     * // Returns: true (widgets overlap)
     */
    detectCollision(widget, widgets) {
        return widgets.some(other => {
            // Don't collide with self
            if (other.id === widget.id) return false;

            // Check if rectangles DON'T intersect (then negate)
            const noIntersect = (
                widget.x + widget.w <= other.x ||  // widget is left of other
                widget.x >= other.x + other.w ||   // widget is right of other
                widget.y + widget.h <= other.y ||  // widget is above other
                widget.y >= other.y + other.h      // widget is below other
            );

            return !noIntersect; // If they don't NOT intersect, they DO intersect
        });
    }

    /**
     * Reflow widgets to remove overlaps
     *
     * When a widget is moved and causes collisions, this pushes overlapping
     * widgets down to make room. Processes widgets in order (top to bottom,
     * left to right) to ensure consistent layout.
     *
     * @param {Array<Object>} widgets - Array of widgets to reflow
     * @returns {Array<Object>} Reflowed widgets (same array, modified in place)
     *
     * @example
     * // Widget moved to position that overlaps another
     * const widgets = [
     *   { x: 0, y: 0, w: 4, h: 2 },
     *   { x: 2, y: 0, w: 4, h: 2 }  // Overlaps first widget!
     * ];
     * gridEngine.reflow(widgets);
     * // Second widget pushed down: { x: 2, y: 2, w: 4, h: 2 }
     */
    reflow(widgets) {
        // Sort widgets by position (top to bottom, left to right)
        // This ensures we process in reading order
        const sorted = [...widgets].sort((a, b) => {
            if (a.y !== b.y) return a.y - b.y; // Sort by Y first
            return a.x - b.x; // Then by X
        });

        // Process each widget
        for (let i = 0; i < sorted.length; i++) {
            const widget = sorted[i];

            // Keep pushing widget down while it collides with any widget before it
            // (widgets before it in sorted order are already positioned correctly)
            while (this.detectCollision(widget, sorted.slice(0, i))) {
                widget.y++;
            }
        }

        console.log('[GridEngine] Reflowed', widgets.length, 'widgets');
        return sorted;
    }

    /**
     * Validate widget dimensions
     *
     * Ensures widget fits within grid bounds and has valid size.
     *
     * @param {Object} widget - Widget to validate
     * @param {Object} minSize - Minimum allowed size {w, h}
     * @returns {Object} Validated widget (clamped to valid values)
     */
    validateWidget(widget, minSize = { w: 1, h: 1 }) {
        return {
            ...widget,
            x: Math.max(0, Math.min(widget.x, this.columns - 1)),
            y: Math.max(0, widget.y),
            w: Math.max(minSize.w, Math.min(widget.w, this.columns)),
            h: Math.max(minSize.h, widget.h)
        };
    }

    /**
     * Calculate total grid height needed for all widgets
     *
     * @param {Array<Object>} widgets - Array of widgets
     * @returns {number} Total height in pixels
     */
    calculateGridHeight(widgets) {
        if (widgets.length === 0) return 0;

        // Find the bottom-most widget
        const maxY = Math.max(...widgets.map(w => w.y + w.h));

        // Calculate total height including gaps
        return maxY * (this.rowHeight + this.gap) + this.gap;
    }
}
