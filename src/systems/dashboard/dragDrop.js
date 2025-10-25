/**
 * Drag-and-Drop Handler
 *
 * Handles widget dragging and repositioning with both mouse and touch support.
 * Provides visual feedback, grid snapping, and collision detection.
 */

/**
 * @typedef {Object} DragState
 * @property {HTMLElement} element - Element being dragged
 * @property {Object} widget - Widget data object
 * @property {number} startX - Initial pointer X
 * @property {number} startY - Initial pointer Y
 * @property {number} offsetX - Pointer offset from element top-left
 * @property {number} offsetY - Pointer offset from element top-left
 * @property {HTMLElement} ghost - Ghost/preview element
 * @property {boolean} isDragging - Whether drag is in progress
 */

export class DragDropHandler {
    /**
     * @param {Object} gridEngine - GridEngine instance
     * @param {Object} options - Configuration options
     */
    constructor(gridEngine, options = {}) {
        this.gridEngine = gridEngine;
        this.editManager = options.editManager || null; // Reference to EditModeManager for lock state
        this.options = {
            showGrid: true,
            showCollisions: true,
            enableSnap: true,
            ghostOpacity: 0.5,
            touchDelay: 150, // Delay before touch drag starts (ms)
            mouseMoveThreshold: 5, // Pixels mouse must move before drag starts
            ...options
        };

        this.dragState = null;
        this.dragHandlers = new Map();
        this.gridOverlay = null;
        this.touchTimer = null;
        this.mouseDragPending = null; // Tracks potential mouse drag before threshold

        // Bound event handlers for cleanup
        this.boundMouseMove = this.onMouseMove.bind(this);
        this.boundMouseUp = this.onMouseUp.bind(this);
        this.boundTouchMove = this.onTouchMove.bind(this);
        this.boundTouchEnd = this.onTouchEnd.bind(this);
        this.boundKeyDown = this.onKeyDown.bind(this);
        this.boundPendingMouseMove = this.onPendingMouseMove.bind(this);
        this.boundPendingMouseUp = this.onPendingMouseUp.bind(this);
    }

    /**
     * Initialize drag functionality on a widget element
     * @param {HTMLElement} element - Widget DOM element
     * @param {Object} widget - Widget data object
     * @param {Function} onDragEnd - Callback when drag completes (widget, newX, newY)
     * @param {Array<Object>} widgets - All widgets (for collision detection)
     */
    initWidget(element, widget, onDragEnd, widgets = []) {
        // Store handler reference for cleanup
        const dragHandle = element.querySelector('.drag-handle') || element;

        const mouseDownHandler = (e) => {
            if (e.button !== 0) return; // Only left mouse button

            // Don't drag if widgets are locked
            if (this.editManager?.isWidgetsLocked()) {
                return;
            }

            // Don't drag if clicking on resize handle or widget controls
            if (e.target.closest('.resize-handle') || e.target.closest('.widget-edit-controls')) {
                return;
            }

            // Don't drag if clicking on interactive elements
            const interactiveElements = 'input, button, select, textarea, a, [contenteditable="true"]';
            if (e.target.closest(interactiveElements)) {
                return;
            }

            // Store pending drag info - wait for movement threshold before starting drag
            this.mouseDragPending = {
                startX: e.clientX,
                startY: e.clientY,
                element,
                widget,
                onDragEnd,
                widgets,
                event: e
            };

            // Add temporary listeners to detect movement or mouseup
            document.addEventListener('mousemove', this.boundPendingMouseMove);
            document.addEventListener('mouseup', this.boundPendingMouseUp);
        };

        const touchStartHandler = (e) => {
            // Don't drag if widgets are locked
            if (this.editManager?.isWidgetsLocked()) {
                return;
            }

            // Don't drag if touching resize handle or widget controls
            if (e.target.closest('.resize-handle') || e.target.closest('.widget-edit-controls')) {
                return;
            }

            // Don't drag if touching interactive elements
            const interactiveElements = 'input, button, select, textarea, a, [contenteditable="true"]';
            if (e.target.closest(interactiveElements)) {
                return;
            }

            // Delay touch drag to allow scrolling
            this.touchTimer = setTimeout(() => {
                e.preventDefault();
                this.startDrag(e.touches[0], element, widget, onDragEnd, widgets);
            }, this.options.touchDelay);
        };

        const touchCancelHandler = () => {
            if (this.touchTimer) {
                clearTimeout(this.touchTimer);
                this.touchTimer = null;
            }
        };

        dragHandle.addEventListener('mousedown', mouseDownHandler);
        dragHandle.addEventListener('touchstart', touchStartHandler, { passive: false });
        dragHandle.addEventListener('touchcancel', touchCancelHandler);
        dragHandle.addEventListener('touchend', touchCancelHandler);

        // Store handlers for cleanup
        this.dragHandlers.set(element, {
            mouseDownHandler,
            touchStartHandler,
            touchCancelHandler,
            dragHandle
        });

        // Add draggable cursor (unless locked)
        if (!this.editManager?.isWidgetsLocked()) {
            dragHandle.style.cursor = 'grab';
        }
    }

    /**
     * Remove drag functionality from a widget element
     * @param {HTMLElement} element - Widget DOM element
     */
    destroyWidget(element) {
        const handlers = this.dragHandlers.get(element);
        if (!handlers) return;

        const { dragHandle, mouseDownHandler, touchStartHandler, touchCancelHandler } = handlers;

        dragHandle.removeEventListener('mousedown', mouseDownHandler);
        dragHandle.removeEventListener('touchstart', touchStartHandler);
        dragHandle.removeEventListener('touchcancel', touchCancelHandler);
        dragHandle.removeEventListener('touchend', touchCancelHandler);

        this.dragHandlers.delete(element);
    }

    /**
     * Start drag operation
     * @param {MouseEvent|Touch} e - Pointer event
     * @param {HTMLElement} element - Element being dragged
     * @param {Object} widget - Widget data
     * @param {Function} onDragEnd - Callback when drag completes
     * @param {Array<Object>} widgets - All widgets (for collision detection)
     */
    startDrag(e, element, widget, onDragEnd, widgets = []) {
        // Calculate pointer offset from element top-left
        const rect = element.getBoundingClientRect();
        const offsetX = e.clientX - rect.left;
        const offsetY = e.clientY - rect.top;

        // Create ghost element
        const ghost = this.createGhost(element);

        this.dragState = {
            element,
            widget: { ...widget }, // Clone widget data
            startX: e.clientX,
            startY: e.clientY,
            offsetX,
            offsetY,
            ghost,
            isDragging: true,
            onDragEnd,
            widgets,
            originalX: widget.x,
            originalY: widget.y
        };

        // Change cursor
        const dragHandle = element.querySelector('.drag-handle') || element;
        dragHandle.style.cursor = 'grabbing';

        // Add event listeners
        document.addEventListener('mousemove', this.boundMouseMove);
        document.addEventListener('mouseup', this.boundMouseUp);
        document.addEventListener('touchmove', this.boundTouchMove, { passive: false });
        document.addEventListener('touchend', this.boundTouchEnd);
        document.addEventListener('keydown', this.boundKeyDown);

        // Show grid overlay if enabled
        if (this.options.showGrid) {
            this.showGridOverlay();
        }

        // Hide original element
        element.style.opacity = '0.3';

        console.log('[DragDrop] Started dragging widget:', widget.id);
    }

    /**
     * Handle mouse move during drag
     * @param {MouseEvent} e - Mouse event
     */
    onMouseMove(e) {
        if (!this.dragState?.isDragging) return;
        e.preventDefault();
        this.updateDragPosition(e.clientX, e.clientY);
    }

    /**
     * Handle touch move during drag
     * @param {TouchEvent} e - Touch event
     */
    onTouchMove(e) {
        if (!this.dragState?.isDragging) return;
        e.preventDefault();
        const touch = e.touches[0];
        this.updateDragPosition(touch.clientX, touch.clientY);
    }

    /**
     * Handle mouse move before drag threshold is reached
     * @param {MouseEvent} e - Mouse event
     */
    onPendingMouseMove(e) {
        if (!this.mouseDragPending) return;

        const { startX, startY, element, widget, onDragEnd, widgets } = this.mouseDragPending;
        const deltaX = Math.abs(e.clientX - startX);
        const deltaY = Math.abs(e.clientY - startY);
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        // Check if movement threshold exceeded
        if (distance >= this.options.mouseMoveThreshold) {
            // Clean up pending listeners
            document.removeEventListener('mousemove', this.boundPendingMouseMove);
            document.removeEventListener('mouseup', this.boundPendingMouseUp);

            // Start actual drag
            this.startDrag(this.mouseDragPending.event, element, widget, onDragEnd, widgets);
            this.mouseDragPending = null;
        }
    }

    /**
     * Handle mouse up before drag threshold is reached (click, not drag)
     * @param {MouseEvent} e - Mouse event
     */
    onPendingMouseUp(e) {
        if (!this.mouseDragPending) return;

        // Clean up pending listeners - this was a click, not a drag
        document.removeEventListener('mousemove', this.boundPendingMouseMove);
        document.removeEventListener('mouseup', this.boundPendingMouseUp);
        this.mouseDragPending = null;
    }

    /**
     * Update drag position and visual feedback
     * @param {number} clientX - Pointer X coordinate
     * @param {number} clientY - Pointer Y coordinate
     */
    updateDragPosition(clientX, clientY) {
        const { ghost, offsetX, offsetY, widget } = this.dragState;

        // Position ghost at pointer
        ghost.style.left = (clientX - offsetX) + 'px';
        ghost.style.top = (clientY - offsetY) + 'px';

        // Calculate grid position
        const containerRect = this.gridEngine.container.getBoundingClientRect();
        const relativeX = clientX - containerRect.left - offsetX;
        const relativeY = clientY - containerRect.top - offsetY;

        // Snap to grid
        const snapped = this.gridEngine.snapToCell(relativeX, relativeY);

        // Update widget position for collision detection
        this.dragState.widget.x = snapped.x;
        this.dragState.widget.y = snapped.y;

        // Update grid overlay highlighting
        if (this.gridOverlay) {
            this.highlightGridCells(snapped.x, snapped.y, widget.w, widget.h);
        }
    }

    /**
     * Handle mouse up - end drag
     * @param {MouseEvent} e - Mouse event
     */
    onMouseUp(e) {
        if (!this.dragState?.isDragging) return;
        e.preventDefault();
        this.endDrag();
    }

    /**
     * Handle touch end - end drag
     * @param {TouchEvent} e - Touch event
     */
    onTouchEnd(e) {
        if (!this.dragState?.isDragging) return;
        e.preventDefault();
        this.endDrag();
    }

    /**
     * Handle keyboard during drag (Escape to cancel)
     * @param {KeyboardEvent} e - Keyboard event
     */
    onKeyDown(e) {
        if (!this.dragState?.isDragging) return;

        if (e.key === 'Escape') {
            e.preventDefault();
            this.cancelDrag();
        }
    }

    /**
     * End drag operation and commit position
     */
    endDrag() {
        if (!this.dragState) return;

        const { element, widget, onDragEnd, widgets, originalX, originalY } = this.dragState;

        // Restore original element
        element.style.opacity = '1';

        // Change cursor back
        const dragHandle = element.querySelector('.drag-handle') || element;
        dragHandle.style.cursor = 'grab';

        // Check for collision before committing
        const otherWidgets = widgets.filter(w => w.id !== widget.id);
        const collision = this.gridEngine.detectCollision(widget, otherWidgets);

        if (collision) {
            console.log('[DragDrop] Collision detected, pushing widgets aside and reflowing');

            // Instead of reverting, reflow all widgets to push collisions aside
            // The reflow algorithm will automatically push overlapping widgets down
            const allWidgets = [widget, ...otherWidgets];
            this.gridEngine.reflow(allWidgets);

            console.log('[DragDrop] Reflow complete, widget at:', widget.x, widget.y);
        }

        // Always commit the position (either the dropped position or reflowed position)
        if (onDragEnd) {
            onDragEnd(widget, widget.x, widget.y);
        }

        this.cleanup();
        console.log('[DragDrop] Drag completed:', widget.id, `(${widget.x}, ${widget.y})`);
    }

    /**
     * Cancel drag operation and restore original position
     */
    cancelDrag() {
        if (!this.dragState) return;

        const { element } = this.dragState;

        // Restore original element
        element.style.opacity = '1';

        // Change cursor back
        const dragHandle = element.querySelector('.drag-handle') || element;
        dragHandle.style.cursor = 'grab';

        this.cleanup();
        console.log('[DragDrop] Drag cancelled');
    }

    /**
     * Cleanup after drag ends
     */
    cleanup() {
        // Remove ghost element
        if (this.dragState?.ghost) {
            this.dragState.ghost.remove();
        }

        // Remove grid overlay
        this.hideGridOverlay();

        // Remove event listeners
        document.removeEventListener('mousemove', this.boundMouseMove);
        document.removeEventListener('mouseup', this.boundMouseUp);
        document.removeEventListener('touchmove', this.boundTouchMove);
        document.removeEventListener('touchend', this.boundTouchEnd);
        document.removeEventListener('keydown', this.boundKeyDown);
        document.removeEventListener('mousemove', this.boundPendingMouseMove);
        document.removeEventListener('mouseup', this.boundPendingMouseUp);

        // Clear touch timer
        if (this.touchTimer) {
            clearTimeout(this.touchTimer);
            this.touchTimer = null;
        }

        // Clear pending drag state
        this.mouseDragPending = null;

        this.dragState = null;
    }

    /**
     * Create ghost/preview element
     * @param {HTMLElement} element - Original element
     * @returns {HTMLElement} Ghost element
     */
    createGhost(element) {
        const ghost = element.cloneNode(true);
        ghost.style.position = 'fixed';
        ghost.style.opacity = this.options.ghostOpacity;
        ghost.style.pointerEvents = 'none';
        ghost.style.zIndex = '10000';
        ghost.style.width = element.offsetWidth + 'px';
        ghost.style.height = element.offsetHeight + 'px';
        ghost.style.transition = 'none';
        ghost.classList.add('drag-ghost');

        document.body.appendChild(ghost);
        return ghost;
    }

    /**
     * Show grid overlay
     */
    showGridOverlay() {
        if (this.gridOverlay) return;

        // Calculate actual grid height based on widget positions (returns rem)
        const widgets = this.dragState?.widgets || [];
        const gridHeightRem = this.gridEngine.calculateGridHeight(widgets);
        const gridHeightPx = this.gridEngine.remToPixels(gridHeightRem);

        this.gridOverlay = document.createElement('div');
        this.gridOverlay.className = 'grid-overlay';
        this.gridOverlay.style.position = 'absolute';
        this.gridOverlay.style.top = '0';
        this.gridOverlay.style.left = '0';
        this.gridOverlay.style.width = '100%';
        this.gridOverlay.style.height = gridHeightPx + 'px';
        this.gridOverlay.style.pointerEvents = 'none';
        this.gridOverlay.style.zIndex = '9999';

        this.gridEngine.container.appendChild(this.gridOverlay);
    }

    /**
     * Hide grid overlay
     */
    hideGridOverlay() {
        if (this.gridOverlay) {
            this.gridOverlay.remove();
            this.gridOverlay = null;
        }
    }

    /**
     * Highlight grid cells where widget will be placed
     * @param {number} x - Grid X coordinate
     * @param {number} y - Grid Y coordinate
     * @param {number} w - Widget width in grid units
     * @param {number} h - Widget height in grid units
     */
    highlightGridCells(x, y, w, h) {
        if (!this.gridOverlay) return;

        // Clear previous highlights
        this.gridOverlay.innerHTML = '';

        // Convert rem to pixels for calculations
        const gapPx = this.gridEngine.remToPixels(this.gridEngine.gap);
        const rowHeightPx = this.gridEngine.remToPixels(this.gridEngine.rowHeight);

        // Calculate column width in pixels
        const totalGaps = gapPx * (this.gridEngine.columns + 1);
        const colWidth = (this.gridEngine.containerWidth - totalGaps) / this.gridEngine.columns;

        for (let row = y; row < y + h; row++) {
            for (let col = x; col < x + w; col++) {
                const cell = document.createElement('div');
                cell.style.position = 'absolute';
                cell.style.left = (col * (colWidth + gapPx) + gapPx) + 'px';
                cell.style.top = (row * (rowHeightPx + gapPx) + gapPx) + 'px';
                cell.style.width = colWidth + 'px';
                cell.style.height = rowHeightPx + 'px';
                cell.style.backgroundColor = 'rgba(78, 204, 163, 0.3)';
                cell.style.border = '2px solid rgba(78, 204, 163, 0.6)';
                cell.style.borderRadius = '4px';
                cell.style.boxSizing = 'border-box';

                this.gridOverlay.appendChild(cell);
            }
        }
    }

    /**
     * Check if current drag position has collisions
     * @param {Array<Object>} widgets - Array of other widgets
     * @returns {boolean} True if collision detected
     */
    hasCollision(widgets) {
        if (!this.dragState) return false;

        const { widget } = this.dragState;

        // Filter out the widget being dragged
        const otherWidgets = widgets.filter(w => w.id !== widget.id);

        return this.gridEngine.detectCollision(widget, otherWidgets);
    }

    /**
     * Get current drag state
     * @returns {DragState|null} Current drag state or null
     */
    getDragState() {
        return this.dragState;
    }

    /**
     * Check if currently dragging
     * @returns {boolean} True if drag in progress
     */
    isDragging() {
        return this.dragState?.isDragging || false;
    }

    /**
     * Destroy drag handler and cleanup
     */
    destroy() {
        // Cancel any ongoing drag
        if (this.isDragging()) {
            this.cancelDrag();
        }

        // Remove all widget handlers
        for (const element of this.dragHandlers.keys()) {
            this.destroyWidget(element);
        }

        this.dragHandlers.clear();
    }
}
