/**
 * GridEngine - Core grid layout engine for widget dashboard
 *
 * Handles grid-based positioning, snapping, collision detection, and auto-reflow.
 * Uses a responsive 2-4 column grid system that adapts to panel width.
 * Mobile devices (≤1000px screen width) always use 2 columns.
 *
 * @class GridEngine
 */
export class GridEngine {
    /**
     * Initialize grid engine with configuration
     *
     * @param {Object} config - Grid configuration
     * @param {number} [config.rowHeight=80] - Height of each row in pixels
     * @param {number} [config.gap=12] - Gap between widgets in pixels
     * @param {boolean} [config.snapToGrid=true] - Enable auto-snapping to grid
     * @param {HTMLElement} [config.container=null] - Container element
     */
    constructor(config = {}) {
        // Start with 2 columns (safest default for side panel)
        this.columns = 2;
        this.rowHeight = config.rowHeight || 80;
        this.gap = config.gap || 12;
        this.snapToGrid = config.snapToGrid !== false;
        this.container = config.container || null;

        // Container width will be set dynamically
        this.containerWidth = 0;

        // Callback for column changes (so DashboardManager can re-render)
        this.onColumnsChange = config.onColumnsChange || null;

        console.log('[GridEngine] Initialized:', {
            columns: this.columns,
            rowHeight: this.rowHeight,
            gap: this.gap,
            snapToGrid: this.snapToGrid
        });
    }

    /**
     * Check if we're on a mobile device
     * Mobile is defined as screen width ≤ 1000px
     *
     * @returns {boolean} True if mobile
     */
    isMobile() {
        return window.innerWidth <= 1000;
    }

    /**
     * Calculate optimal number of columns based on container width
     *
     * Desktop (>1000px screen):
     *   - < 370px: 2 columns
     *   - 370-449px: 3 columns
     *   - ≥ 450px: 4 columns
     *
     * Mobile (≤1000px screen):
     *   - Always 2 columns
     *
     * @param {number} containerWidth - Container width in pixels
     * @returns {number} Number of columns (2-4)
     */
    calculateColumns(containerWidth) {
        // Mobile always uses 2 columns
        if (this.isMobile()) {
            return 2;
        }

        // Desktop: dynamic 2-4 columns based on panel width
        if (containerWidth < 370) return 2;
        if (containerWidth < 450) return 3;
        return 4;
    }

    /**
     * Set container width (called when container is measured or resized)
     *
     * Recalculates column count based on new width and notifies if changed.
     *
     * @param {number} width - Container width in pixels
     */
    setContainerWidth(width) {
        const oldColumns = this.columns;
        this.containerWidth = width;
        this.columns = this.calculateColumns(width);

        console.log('[GridEngine] Container width set to:', width, 'Columns:', this.columns);

        // Notify if column count changed (so dashboard can re-render)
        if (oldColumns !== this.columns && this.onColumnsChange) {
            console.log('[GridEngine] Column count changed from', oldColumns, 'to', this.columns);
            this.onColumnsChange(this.columns, oldColumns);
        }
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
            console.warn('[GridEngine] Container width not set, using default 350px (side panel estimate)');
            this.containerWidth = 350;
            this.columns = this.calculateColumns(350); // Recalculate columns for fallback
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
     * Calculate responsive position from grid coordinates
     *
     * Returns positions as % of container width (for horizontal) and vh (for vertical).
     * Widgets are positioned absolutely within the container, so % is relative to container.
     *
     * @param {Object} widget - Widget with grid coordinates
     * @param {number} widget.x - Grid column position (0-based)
     * @param {number} widget.y - Grid row position (0-based)
     * @param {number} widget.w - Width in grid columns
     * @param {number} widget.h - Height in grid rows
     * @returns {Object} Responsive coordinates {left, top, width, height}
     *
     * @example
     * // Widget at column 0, row 0, size 2x3 in 2-column grid
     * const pos = gridEngine.getViewportPosition({ x: 0, y: 0, w: 2, h: 3 });
     * // Returns: { left: "3%", top: "2vh", width: "94%", height: "25vh" }
     */
    getViewportPosition(widget) {
        if (this.containerWidth === 0) {
            console.warn('[GridEngine] Container width not set, using default 350px (side panel estimate)');
            this.containerWidth = 350;
            this.columns = this.calculateColumns(350);
        }

        console.log('[GridEngine] getViewportPosition DEBUG:', {
            widgetId: widget.id,
            widgetSize: `${widget.w}×${widget.h}`,
            containerWidth: this.containerWidth,
            columns: this.columns,
            gap: this.gap
        });

        // Calculate column width as % of container
        const gapPercent = (this.gap / this.containerWidth) * 100;
        const totalGapsPercent = gapPercent * (this.columns + 1);
        const colWidthPercent = (100 - totalGapsPercent) / this.columns;

        console.log('[GridEngine] Calculation values:', {
            gapPercent: gapPercent.toFixed(2) + '%',
            totalGapsPercent: totalGapsPercent.toFixed(2) + '%',
            colWidthPercent: colWidthPercent.toFixed(2) + '%'
        });

        // Calculate row height in vh for vertical scaling
        const viewportHeight = window.innerHeight;
        const rowHeightVh = (this.rowHeight / viewportHeight) * 100;
        const gapVh = (this.gap / viewportHeight) * 100;

        // Calculate positions
        // Horizontal: % of container (since widgets are absolutely positioned within container)
        const left = widget.x * (colWidthPercent + gapPercent) + gapPercent;
        const width = widget.w * colWidthPercent + (widget.w - 1) * gapPercent;

        console.log('[GridEngine] Position calc:', {
            left: left.toFixed(2) + '%',
            width: width.toFixed(2) + '%',
            formula: `${widget.w} * ${colWidthPercent.toFixed(2)}% + ${widget.w - 1} * ${gapPercent.toFixed(2)}%`
        });

        // Vertical: vh units (scales with viewport height)
        const top = widget.y * (rowHeightVh + gapVh) + gapVh;
        const height = widget.h * rowHeightVh + (widget.h - 1) * gapVh;

        return {
            left: `${left.toFixed(2)}%`,
            top: `${top.toFixed(2)}vh`,
            width: `${width.toFixed(2)}%`,
            height: `${height.toFixed(2)}vh`
        };
    }

    /**
     * Get widget position for CSS styling
     * Returns responsive units for scaling across all screen sizes.
     * Uses % of container for horizontal (adapts to panel width)
     * Uses vh for vertical (adapts to viewport height)
     *
     * @param {Object} widget - Widget with grid coordinates
     * @returns {Object} Position with %, vh units {left, top, width, height}
     */
    getWidgetPosition(widget) {
        return this.getViewportPosition(widget);
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
            console.warn('[GridEngine] Container width not set, using default 350px (side panel estimate)');
            this.containerWidth = 350;
            this.columns = this.calculateColumns(350); // Recalculate columns for fallback
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

    /**
     * Auto-layout widgets to efficiently use all available space
     *
     * Packs widgets in reading order (left to right, top to bottom) with no gaps.
     * Respects current column count (responsive to panel width).
     * Scales widgets to maximize space usage while respecting minimum sizes.
     *
     * Strategy:
     * 1. Sort widgets by area (largest first) for better packing
     * 2. For each widget, try to fit full width (all columns)
     * 3. If widget prefers smaller size, use that
     * 4. Find first available position from top-left
     * 5. Ensure no overlaps
     *
     * @param {Array<Object>} widgets - Array of widgets to auto-layout
     * @param {Object} options - Layout options
     * @param {boolean} [options.preferFullWidth=true] - Prefer full-width widgets when possible
     * @param {Object} [options.minSize={w:1, h:2}] - Minimum widget size
     * @returns {Array<Object>} Re-positioned widgets (same array, modified in place)
     */
    autoLayout(widgets, options = {}) {
        if (widgets.length === 0) return widgets;

        const preferFullWidth = options.preferFullWidth !== false;
        const minSize = options.minSize || { w: 1, h: 2 };

        console.log('[GridEngine] Auto-layout started:', {
            widgetCount: widgets.length,
            columns: this.columns,
            preferFullWidth,
            minSize
        });

        // Sort widgets by area (largest first) for better packing efficiency
        const sorted = [...widgets].sort((a, b) => {
            const areaA = a.w * a.h;
            const areaB = b.w * b.h;
            if (areaB !== areaA) return areaB - areaA;
            // If same area, sort by height (taller first)
            return b.h - a.h;
        });

        // Track occupied cells in a 2D grid
        const occupied = new Map(); // key: "x,y" => widget

        /**
         * Check if position is free
         */
        const isFree = (x, y, w, h) => {
            for (let row = y; row < y + h; row++) {
                for (let col = x; col < x + w; col++) {
                    const key = `${col},${row}`;
                    if (occupied.has(key)) return false;
                    if (col >= this.columns) return false; // Out of bounds
                }
            }
            return true;
        };

        /**
         * Mark cells as occupied
         */
        const markOccupied = (widget, x, y, w, h) => {
            for (let row = y; row < y + h; row++) {
                for (let col = x; col < x + w; col++) {
                    occupied.set(`${col},${row}`, widget.id);
                }
            }
        };

        /**
         * Find first available position for widget of given size
         */
        const findPosition = (w, h) => {
            // Start from top-left, scan row by row
            for (let y = 0; y < 1000; y++) { // Max 1000 rows (practical limit)
                for (let x = 0; x <= this.columns - w; x++) {
                    if (isFree(x, y, w, h)) {
                        return { x, y };
                    }
                }
            }
            // Fallback: stack at bottom (should never happen)
            return { x: 0, y: 1000 };
        };

        // Process each widget
        sorted.forEach(widget => {
            // Determine optimal size for this widget
            let targetW, targetH;

            if (preferFullWidth) {
                // Try to use full width when possible
                targetW = this.columns;
                targetH = widget.h;
            } else {
                // Keep original size or clamp to current column count
                targetW = Math.min(widget.w, this.columns);
                targetH = widget.h;
            }

            // Ensure minimum size
            targetW = Math.max(minSize.w, Math.min(targetW, this.columns));
            targetH = Math.max(minSize.h, targetH);

            // Try to find position for preferred size
            let pos = findPosition(targetW, targetH);

            // If preferred size doesn't fit well, try smaller widths
            if (pos.y > 100 && targetW > minSize.w) {
                // Widget would be placed very far down, try narrower width
                for (let tryW = targetW - 1; tryW >= minSize.w; tryW--) {
                    const tryPos = findPosition(tryW, targetH);
                    if (tryPos.y < pos.y) {
                        // Found better position with narrower width
                        pos = tryPos;
                        targetW = tryW;
                        break;
                    }
                }
            }

            // Update widget position and size
            widget.x = pos.x;
            widget.y = pos.y;
            widget.w = targetW;
            widget.h = targetH;

            // Mark cells as occupied
            markOccupied(widget, pos.x, pos.y, targetW, targetH);

            console.log(`[GridEngine] Auto-layout positioned: ${widget.id} at (${pos.x},${pos.y}) size ${targetW}×${targetH}`);
        });

        console.log('[GridEngine] Auto-layout complete');
        return widgets;
    }
}
