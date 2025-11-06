/**
 * GridEngine - Core grid layout engine for widget dashboard
 *
 * Handles grid-based positioning, snapping, collision detection, and auto-reflow.
 * Uses a responsive 2-4 column grid system that adapts to panel width.
 * Mobile devices (≤1000px screen width) always use 2 columns.
 *
 * @class GridEngine
 */

// Performance: Disable console logging (console.error still active)
// Temporarily enabled for debugging auto-arrange onResize issue
const DEBUG = true;
const console = DEBUG ? window.console : {
    log: () => {},
    warn: () => {},
    error: window.console.error.bind(window.console)
};

export class GridEngine {
    /**
     * Initialize grid engine with configuration
     *
     * @param {Object} config - Grid configuration
     * @param {number} [config.rowHeight=5] - Height of each row in rem units
     * @param {number} [config.gap=0.75] - Gap between widgets in rem units
     * @param {boolean} [config.snapToGrid=true] - Enable auto-snapping to grid
     * @param {HTMLElement} [config.container=null] - Container element
     */
    constructor(config = {}) {
        // Start with 2 columns (safest default for side panel)
        this.columns = 2;
        // Use rem for responsive sizing across all resolutions (1080p, 4K, mobile)
        // Mobile uses smaller rowHeight (3.5rem) to prevent vertical squashing
        const isMobileViewport = window.innerWidth <= 1000;
        const defaultRowHeight = isMobileViewport ? 3.5 : 5;
        this.rowHeight = config.rowHeight || defaultRowHeight; // rem
        this.gap = config.gap || 0.75; // rem (was 12px)
        this.snapToGrid = config.snapToGrid !== false;
        this.container = config.container || null;

        // Widget registry for accessing widget definitions (e.g., maxAutoSize)
        this.registry = config.registry || null;

        // Container width will be set dynamically
        this.containerWidth = 0;

        // Callback for column changes (so DashboardManager can re-render)
        this.onColumnsChange = config.onColumnsChange || null;

        console.log('[GridEngine] Initialized:', {
            columns: this.columns,
            rowHeight: this.rowHeight + 'rem',
            gap: this.gap + 'rem',
            snapToGrid: this.snapToGrid,
            isMobile: this.isMobile()
        });
    }

    /**
     * Convert rem to pixels using current browser font size
     * @param {number} rem - Value in rem units
     * @returns {number} Value in pixels
     */
    remToPixels(rem) {
        const fontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
        return rem * fontSize;
    }

    /**
     * Convert pixels to rem using current browser font size
     * @param {number} pixels - Value in pixels
     * @returns {number} Value in rem
     */
    pixelsToRem(pixels) {
        const fontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
        return pixels / fontSize;
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
     * @returns {boolean} True if column count changed, false otherwise
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
            return true; // Signal that columns changed
        }

        return false; // Columns did NOT change
    }

    /**
     * Calculate pixel position from grid coordinates
     *
     * Converts grid-based widget position (x, y, w, h) to actual pixel values
     * (left, top, width, height) for CSS positioning.
     * Note: rowHeight and gap are stored in rem, converted to pixels here.
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

        // Convert rem to pixels for calculations
        const gapPx = this.remToPixels(this.gap);
        const rowHeightPx = this.remToPixels(this.rowHeight);

        // Calculate column width
        // Formula: (containerWidth - gaps) / columns
        // Gaps: (columns + 1) gaps total (one before each column + one after last)
        const totalGaps = gapPx * (this.columns + 1);
        const colWidth = (this.containerWidth - totalGaps) / this.columns;

        // Calculate positions
        // Left: x columns * (colWidth + gap) + initial gap
        const left = widget.x * (colWidth + gapPx) + gapPx;

        // Top: y rows * (rowHeight + gap) + initial gap
        const top = widget.y * (rowHeightPx + gapPx) + gapPx;

        // Width: w columns * colWidth + (w - 1) inner gaps
        const width = widget.w * colWidth + (widget.w - 1) * gapPx;

        // Height: h rows * rowHeight + (h - 1) inner gaps
        const height = widget.h * rowHeightPx + (widget.h - 1) * gapPx;

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

        // Calculate positions
        // Horizontal: % of container (since widgets are absolutely positioned within container)
        const left = widget.x * (colWidthPercent + gapPercent) + gapPercent;
        const width = widget.w * colWidthPercent + (widget.w - 1) * gapPercent;

        console.log('[GridEngine] Position calc:', {
            left: left.toFixed(2) + '%',
            width: width.toFixed(2) + '%',
            formula: `${widget.w} * ${colWidthPercent.toFixed(2)}% + ${widget.w - 1} * ${gapPercent.toFixed(2)}%`
        });

        // Vertical: rem units (scales across all resolutions - 1080p, 4K, mobile)
        // rem scales with browser font size, which adapts to screen DPI
        const top = widget.y * (this.rowHeight + this.gap) + this.gap;
        const height = widget.h * this.rowHeight + (widget.h - 1) * this.gap;

        return {
            left: `${left.toFixed(2)}%`,
            top: `${top.toFixed(2)}rem`,
            width: `${width.toFixed(2)}%`,
            height: `${height.toFixed(2)}rem`
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

        // Convert rem to pixels for calculations
        const gapPx = this.remToPixels(this.gap);
        const rowHeightPx = this.remToPixels(this.rowHeight);

        // Calculate column width
        const totalGaps = gapPx * (this.columns + 1);
        const colWidth = (this.containerWidth - totalGaps) / this.columns;

        // Convert pixel to grid coordinates
        // Reverse of getPixelPosition formula
        // x = (pixelX - gap) / (colWidth + gap)
        const x = Math.round((pixelX - gapPx) / (colWidth + gapPx));
        const y = Math.round((pixelY - gapPx) / (rowHeightPx + gapPx));

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
     * @returns {number} Total height in rem units
     */
    calculateGridHeight(widgets) {
        if (widgets.length === 0) return 0;

        // Find the bottom-most widget
        const maxY = Math.max(...widgets.map(w => w.y + w.h));

        // Calculate total height including gaps (in rem)
        return maxY * (this.rowHeight + this.gap) + this.gap;
    }

    /**
     * Auto-layout widgets to efficiently use all available space
     *
     * Packs widgets in reading order (left to right, top to bottom) with no gaps.
     * Respects each widget's defined size - only repositions, doesn't resize.
     * Respects current column count (responsive to panel width).
     *
     * Strategy:
     * 1. Sort widgets (by area or preserve order if requested)
     * 2. For each widget, keep its defined size (w, h)
     * 3. Find first available position from top-left
     * 4. Ensure no overlaps
     * 5. If widget doesn't fit at preferred size, try narrower widths
     *
     * @param {Array<Object>} widgets - Array of widgets to auto-layout
     * @param {Object} options - Layout options
     * @param {boolean} [options.preserveOrder=false] - Keep input order instead of sorting by area
     * @returns {Array<Object>} Re-positioned widgets (same array, modified in place)
     */
    autoLayout(widgets, options = {}) {
        if (widgets.length === 0) return widgets;

        const preserveOrder = options.preserveOrder || false;

        // Calculate maximum visible rows based on grid container's actual viewport height
        let maxVisibleRows = 100; // Fallback
        if (this.container) {
            // Use grid container's own clientHeight (actual visible viewport area)
            // Don't use parentElement which includes the header (tabs + buttons)
            const viewportHeight = this.container.clientHeight; // pixels
            const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize); // px per rem
            const viewportHeightRem = viewportHeight / rootFontSize;
            const rowHeightWithGap = this.rowHeight + this.gap;
            // Add gap to calculation because last row doesn't need trailing gap
            // Formula: (height + gap) / (rowHeight + gap) accounts for N rows with N-1 gaps
            maxVisibleRows = Math.floor((viewportHeightRem + this.gap) / rowHeightWithGap);
            console.log('[GridEngine] Viewport height:', viewportHeight + 'px', '=', viewportHeightRem.toFixed(2) + 'rem', '→', maxVisibleRows, 'visible rows');
        }

        console.log('[GridEngine] Auto-layout started:', {
            widgetCount: widgets.length,
            columns: this.columns,
            preserveOrder,
            maxVisibleRows
        });

        // Sort widgets (or preserve input order for category-aware layout)
        const sorted = preserveOrder ? [...widgets] : [...widgets].sort((a, b) => {
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
            // Respect widget's defined size - only clamp to grid bounds
            // Don't force sizes - widgets define their own optimal dimensions
            let targetW = Math.min(widget.w, this.columns); // Clamp to column count
            let targetH = widget.h; // Respect widget's height

            // Try to find position for preferred size
            let pos = findPosition(targetW, targetH);

            // If preferred size doesn't fit well, try smaller widths
            // (but never go below 1 column)
            if (pos.y > 100 && targetW > 1) {
                // Widget would be placed very far down, try narrower width
                for (let tryW = targetW - 1; tryW >= 1; tryW--) {
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

        // Compact pass: Move widgets up to fill gaps
        console.log('[GridEngine] Compacting layout to fill gaps...');
        let compactedCount = 0;

        // Sort widgets by current Y position (process top to bottom)
        const sortedForCompact = [...sorted].sort((a, b) => a.y - b.y);

        sortedForCompact.forEach(widget => {
            const originalY = widget.y;

            // Try to move widget up as far as possible
            for (let tryY = 0; tryY < originalY; tryY++) {
                // Clear current position from occupied map
                for (let row = originalY; row < originalY + widget.h; row++) {
                    for (let col = widget.x; col < widget.x + widget.w; col++) {
                        occupied.delete(`${col},${row}`);
                    }
                }

                // Check if new position is free
                if (isFree(widget.x, tryY, widget.w, widget.h)) {
                    // Move widget up
                    widget.y = tryY;
                    markOccupied(widget, widget.x, tryY, widget.w, widget.h);
                    compactedCount++;
                    console.log(`[GridEngine] Compacted ${widget.id} from y=${originalY} to y=${tryY}`);
                    break;
                } else {
                    // Re-mark original position and continue
                    markOccupied(widget, widget.x, originalY, widget.w, widget.h);
                }
            }
        });

        console.log(`[GridEngine] Compaction complete (${compactedCount} widgets moved up)`);

        // Expansion pass: Try to expand widgets to fill available space
        console.log('[GridEngine] Expanding widgets to fill available space...');
        let expandedCount = 0;

        // Sort widgets by position (top-to-bottom, left-to-right) for orderly expansion
        const sortedForExpand = [...sorted].sort((a, b) => {
            if (a.y !== b.y) return a.y - b.y; // Top to bottom
            return a.x - b.x; // Left to right
        });

        // Helper to get widget max size from registry
        const getWidgetMaxSize = (widget) => {
            // Try to get widget definition from registry
            if (this.registry && widget.type) {
                const definition = this.registry.get(widget.type);
                if (definition && definition.maxAutoSize) {
                    // Support maxAutoSize as function (column-aware sizing)
                    if (typeof definition.maxAutoSize === 'function') {
                        return definition.maxAutoSize(this.columns);
                    }
                    // Static maxAutoSize object
                    return definition.maxAutoSize;
                }
            }
            // Default max size if not specified (conservative expansion)
            return { w: this.columns, h: 3 };
        };

        sortedForExpand.forEach(widget => {
            const maxSize = getWidgetMaxSize(widget);
            const originalW = widget.w;
            const originalH = widget.h;

            // Try expanding height first (fills vertical gaps) - keep trying until maxSize or collision
            let expandedH = false;
            for (let tryH = originalH + 1; tryH <= maxSize.h; tryH++) {
                // Check if expansion would go beyond visible area
                // y + h represents the row AFTER the widget ends, so > check (not >=) is correct
                if (widget.y + tryH > maxVisibleRows) {
                    console.log(`[GridEngine] ${widget.id} cannot expand to h=${tryH} (would exceed visible area: row ${widget.y + tryH} > ${maxVisibleRows})`);
                    break;
                }

                // Clear current position
                for (let row = widget.y; row < widget.y + widget.h; row++) {
                    for (let col = widget.x; col < widget.x + widget.w; col++) {
                        occupied.delete(`${col},${row}`);
                    }
                }

                // Check if expanded height is free
                if (isFree(widget.x, widget.y, widget.w, tryH)) {
                    widget.h = tryH;
                    markOccupied(widget, widget.x, widget.y, widget.w, tryH);
                    expandedH = true;
                    expandedCount++;
                    // Continue trying to expand further
                } else {
                    // Hit a collision, stop expanding height
                    markOccupied(widget, widget.x, widget.y, widget.w, widget.h);
                    break;
                }
            }

            if (expandedH) {
                console.log(`[GridEngine] Expanded ${widget.id} height: ${originalH} → ${widget.h}`);
            }

            // Try expanding width (fills horizontal gaps) - keep trying until maxSize or collision
            let expandedW = false;
            for (let tryW = originalW + 1; tryW <= Math.min(maxSize.w, this.columns); tryW++) {
                // Clear current position
                for (let row = widget.y; row < widget.y + widget.h; row++) {
                    for (let col = widget.x; col < widget.x + widget.w; col++) {
                        occupied.delete(`${col},${row}`);
                    }
                }

                // Check if expanded width is free
                if (isFree(widget.x, widget.y, tryW, widget.h)) {
                    widget.w = tryW;
                    markOccupied(widget, widget.x, widget.y, tryW, widget.h);
                    expandedW = true;
                    expandedCount++;
                    // Continue trying to expand further
                } else {
                    // Hit a collision, stop expanding width
                    markOccupied(widget, widget.x, widget.y, widget.w, widget.h);
                    break;
                }
            }

            if (expandedW) {
                console.log(`[GridEngine] Expanded ${widget.id} width: ${originalW} → ${widget.w}`);
            }

            if (!expandedH && !expandedW) {
                // Widget couldn't expand - ensure it's still marked in grid
                markOccupied(widget, widget.x, widget.y, widget.w, widget.h);
            }
        });

        console.log(`[GridEngine] Expansion complete (${expandedCount} expansions made)`);
        console.log(`[GridEngine] Auto-layout complete`);
        return widgets;
    }
}
