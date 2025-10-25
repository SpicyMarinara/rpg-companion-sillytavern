/**
 * Widget Resize Handler
 *
 * Handles widget resizing with mouse and touch support.
 * Provides visual feedback, grid snapping, and size constraints.
 */

/**
 * @typedef {Object} ResizeState
 * @property {HTMLElement} element - Element being resized
 * @property {Object} widget - Widget data object
 * @property {string} handle - Handle being dragged (e.g., 'se', 'nw', 'n', 's', 'e', 'w')
 * @property {number} startX - Initial pointer X
 * @property {number} startY - Initial pointer Y
 * @property {number} startWidth - Initial widget width (grid units)
 * @property {number} startHeight - Initial widget height (grid units)
 * @property {number} startGridX - Initial widget X (grid units)
 * @property {number} startGridY - Initial widget Y (grid units)
 * @property {HTMLElement} overlay - Dimension overlay element
 * @property {boolean} isResizing - Whether resize is in progress
 */

export class ResizeHandler {
    /**
     * @param {Object} gridEngine - GridEngine instance
     * @param {Object} options - Configuration options
     */
    constructor(gridEngine, options = {}) {
        this.gridEngine = gridEngine;
        this.editManager = options.editManager || null; // Reference to EditModeManager for lock state
        this.options = {
            showDimensions: true,
            showGrid: true,
            minWidth: 2,
            minHeight: 2,
            maxWidth: 12,
            maxHeight: 10,
            touchDelay: 150,
            ...options
        };

        this.resizeState = null;
        this.resizeHandlers = new Map();
        this.gridOverlay = null;
        this.touchTimer = null;

        // Bound event handlers for cleanup
        this.boundMouseMove = this.onMouseMove.bind(this);
        this.boundMouseUp = this.onMouseUp.bind(this);
        this.boundTouchMove = this.onTouchMove.bind(this);
        this.boundTouchEnd = this.onTouchEnd.bind(this);
        this.boundKeyDown = this.onKeyDown.bind(this);

        // Handle types and their cursor styles
        this.handleTypes = {
            'nw': 'nwse-resize',
            'n': 'ns-resize',
            'ne': 'nesw-resize',
            'e': 'ew-resize',
            'se': 'nwse-resize',
            's': 'ns-resize',
            'sw': 'nesw-resize',
            'w': 'ew-resize'
        };
    }

    /**
     * Initialize resize functionality on a widget element
     * @param {HTMLElement} element - Widget DOM element
     * @param {Object} widget - Widget data object
     * @param {Function} onResizeEnd - Callback when resize completes (widget, newW, newH, newX, newY)
     * @param {Object} constraints - Size constraints {minW, minH, maxW, maxH}
     */
    initWidget(element, widget, onResizeEnd, constraints = {}) {
        // Create resize handles
        const handles = this.createResizeHandles();
        element.appendChild(handles);

        // Store constraints
        const widgetConstraints = {
            minW: constraints.minW || this.options.minWidth,
            minH: constraints.minH || this.options.minHeight,
            maxW: constraints.maxW || this.options.maxWidth,
            maxH: constraints.maxH || this.options.maxHeight
        };

        // Attach event listeners to each handle
        const handleElements = handles.querySelectorAll('.resize-handle');
        const handleListeners = [];

        handleElements.forEach(handleEl => {
            const handleType = handleEl.dataset.handle;

            const mouseDownHandler = (e) => {
                if (e.button !== 0) return;
                // Don't resize if widgets are locked
                if (this.editManager?.isWidgetsLocked()) {
                    return;
                }
                e.preventDefault();
                e.stopPropagation();
                this.startResize(e, handleType, element, widget, onResizeEnd, widgetConstraints);
            };

            const touchStartHandler = (e) => {
                // Don't resize if widgets are locked
                if (this.editManager?.isWidgetsLocked()) {
                    return;
                }
                this.touchTimer = setTimeout(() => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.startResize(e.touches[0], handleType, element, widget, onResizeEnd, widgetConstraints);
                }, this.options.touchDelay);
            };

            const touchCancelHandler = () => {
                if (this.touchTimer) {
                    clearTimeout(this.touchTimer);
                    this.touchTimer = null;
                }
            };

            handleEl.addEventListener('mousedown', mouseDownHandler);
            handleEl.addEventListener('touchstart', touchStartHandler, { passive: false });
            handleEl.addEventListener('touchcancel', touchCancelHandler);
            handleEl.addEventListener('touchend', touchCancelHandler);

            handleListeners.push({
                element: handleEl,
                mouseDownHandler,
                touchStartHandler,
                touchCancelHandler
            });
        });

        // Store handlers for cleanup
        this.resizeHandlers.set(element, {
            handles,
            handleListeners
        });
    }

    /**
     * Remove resize functionality from a widget element
     * @param {HTMLElement} element - Widget DOM element
     */
    destroyWidget(element) {
        const handlers = this.resizeHandlers.get(element);
        if (!handlers) return;

        const { handles, handleListeners } = handlers;

        // Remove event listeners
        handleListeners.forEach(({ element: handleEl, mouseDownHandler, touchStartHandler, touchCancelHandler }) => {
            handleEl.removeEventListener('mousedown', mouseDownHandler);
            handleEl.removeEventListener('touchstart', touchStartHandler);
            handleEl.removeEventListener('touchcancel', touchCancelHandler);
            handleEl.removeEventListener('touchend', touchCancelHandler);
        });

        // Remove handle container
        handles.remove();

        this.resizeHandlers.delete(element);
    }

    /**
     * Create resize handle elements
     * @returns {HTMLElement} Container with all resize handles
     */
    createResizeHandles() {
        const container = document.createElement('div');
        container.className = 'resize-handles';
        container.style.position = 'absolute';
        container.style.inset = '0';
        container.style.pointerEvents = 'none';

        // Create 8 handles (4 corners + 4 edges)
        Object.entries(this.handleTypes).forEach(([handleType, cursor]) => {
            const handle = document.createElement('div');
            handle.className = `resize-handle resize-handle-${handleType}`;
            handle.dataset.handle = handleType;
            handle.style.position = 'absolute';
            handle.style.pointerEvents = 'auto';
            handle.style.cursor = cursor;
            handle.style.width = '12px';
            handle.style.height = '12px';
            handle.style.background = 'rgba(78, 204, 163, 0.8)';
            handle.style.border = '2px solid white';
            handle.style.borderRadius = '3px';
            handle.style.zIndex = '100';

            // Position handles
            // Vertical: -6px offset (adequate gap between rows)
            if (handleType.includes('n')) handle.style.top = '-6px';
            if (handleType.includes('s')) handle.style.bottom = '-6px';
            // Horizontal: -3px offset (prevent overlap when widgets are side-by-side)
            if (handleType.includes('w')) handle.style.left = '-3px';
            if (handleType.includes('e')) handle.style.right = '-3px';

            // Center edge handles
            if (handleType === 'n' || handleType === 's') {
                handle.style.left = '50%';
                handle.style.transform = 'translateX(-50%)';
            }
            if (handleType === 'w' || handleType === 'e') {
                handle.style.top = '50%';
                handle.style.transform = 'translateY(-50%)';
            }

            container.appendChild(handle);
        });

        return container;
    }

    /**
     * Start resize operation
     * @param {MouseEvent|Touch} e - Pointer event
     * @param {string} handleType - Handle type (e.g., 'se', 'nw')
     * @param {HTMLElement} element - Element being resized
     * @param {Object} widget - Widget data
     * @param {Function} onResizeEnd - Callback when resize completes
     * @param {Object} constraints - Size constraints
     */
    startResize(e, handleType, element, widget, onResizeEnd, constraints) {
        // Create dimension overlay
        const overlay = this.createDimensionOverlay();

        this.resizeState = {
            element,
            widget: { ...widget },
            handle: handleType,
            startX: e.clientX,
            startY: e.clientY,
            startWidth: widget.w,
            startHeight: widget.h,
            startGridX: widget.x,
            startGridY: widget.y,
            overlay,
            isResizing: true,
            onResizeEnd,
            constraints
        };

        // Add event listeners
        document.addEventListener('mousemove', this.boundMouseMove);
        document.addEventListener('mouseup', this.boundMouseUp);
        document.addEventListener('touchmove', this.boundTouchMove, { passive: false });
        document.addEventListener('touchend', this.boundTouchEnd);
        document.addEventListener('keydown', this.boundKeyDown);

        // Show grid overlay
        if (this.options.showGrid) {
            this.showGridOverlay();
        }

        // Add resizing class
        element.classList.add('resizing');

        console.log('[ResizeHandler] Started resizing widget:', widget.id, 'handle:', handleType);
    }

    /**
     * Handle mouse move during resize
     * @param {MouseEvent} e - Mouse event
     */
    onMouseMove(e) {
        if (!this.resizeState?.isResizing) return;
        e.preventDefault();
        this.updateResizeSize(e.clientX, e.clientY);
    }

    /**
     * Handle touch move during resize
     * @param {TouchEvent} e - Touch event
     */
    onTouchMove(e) {
        if (!this.resizeState?.isResizing) return;
        e.preventDefault();
        const touch = e.touches[0];
        this.updateResizeSize(touch.clientX, touch.clientY);
    }

    /**
     * Update resize dimensions
     * @param {number} clientX - Pointer X coordinate
     * @param {number} clientY - Pointer Y coordinate
     */
    updateResizeSize(clientX, clientY) {
        const { widget, handle, startX, startY, startWidth, startHeight, startGridX, startGridY, constraints, element, overlay } = this.resizeState;

        // Calculate pixel delta
        const deltaX = clientX - startX;
        const deltaY = clientY - startY;

        // Get column/row size in pixels (containerWidth already set by ResizeObserver in DashboardManager)
        const totalGaps = this.gridEngine.gap * (this.gridEngine.columns + 1);
        const colWidth = (this.gridEngine.containerWidth - totalGaps) / this.gridEngine.columns;
        const rowHeight = this.gridEngine.rowHeight;

        // Convert pixel delta to grid units
        const deltaGridX = Math.round(deltaX / (colWidth + this.gridEngine.gap));
        const deltaGridY = Math.round(deltaY / (rowHeight + this.gridEngine.gap));

        // Calculate new dimensions based on handle type
        let newW = startWidth;
        let newH = startHeight;
        let newX = startGridX;
        let newY = startGridY;

        // Handle width changes
        if (handle.includes('e')) {
            newW = startWidth + deltaGridX;
        } else if (handle.includes('w')) {
            newW = startWidth - deltaGridX;
            newX = startGridX + deltaGridX;
        }

        // Handle height changes
        if (handle.includes('s')) {
            newH = startHeight + deltaGridY;
        } else if (handle.includes('n')) {
            newH = startHeight - deltaGridY;
            newY = startGridY + deltaGridY;
        }

        // Apply constraints
        newW = Math.max(constraints.minW, Math.min(newW, constraints.maxW));
        newH = Math.max(constraints.minH, Math.min(newH, constraints.maxH));

        // Ensure doesn't exceed grid bounds
        newW = Math.min(newW, this.gridEngine.columns - newX);

        // Adjust position if resizing from top/left and hit min size
        if (handle.includes('w') && newW === constraints.minW) {
            newX = startGridX + startWidth - constraints.minW;
        }
        if (handle.includes('n') && newH === constraints.minH) {
            newY = startGridY + startHeight - constraints.minH;
        }

        // Update widget dimensions
        this.resizeState.widget.w = newW;
        this.resizeState.widget.h = newH;
        this.resizeState.widget.x = newX;
        this.resizeState.widget.y = newY;

        // Update element size
        const pos = this.gridEngine.getPixelPosition(this.resizeState.widget);
        element.style.width = pos.width + 'px';
        element.style.height = pos.height + 'px';
        element.style.left = pos.left + 'px';
        element.style.top = pos.top + 'px';

        // Update dimension overlay
        if (overlay) {
            overlay.textContent = `${newW}×${newH}`;
            overlay.style.left = (pos.left + pos.width / 2) + 'px';
            overlay.style.top = (pos.top + pos.height / 2) + 'px';
        }

        // Update grid overlay
        if (this.gridOverlay) {
            this.highlightGridCells(newX, newY, newW, newH);
        }
    }

    /**
     * Handle mouse up - end resize
     * @param {MouseEvent} e - Mouse event
     */
    onMouseUp(e) {
        if (!this.resizeState?.isResizing) return;
        e.preventDefault();
        this.endResize();
    }

    /**
     * Handle touch end - end resize
     * @param {TouchEvent} e - Touch event
     */
    onTouchEnd(e) {
        if (!this.resizeState?.isResizing) return;
        e.preventDefault();
        this.endResize();
    }

    /**
     * Handle keyboard during resize (Escape to cancel)
     * @param {KeyboardEvent} e - Keyboard event
     */
    onKeyDown(e) {
        if (!this.resizeState?.isResizing) return;

        if (e.key === 'Escape') {
            e.preventDefault();
            this.cancelResize();
        }
    }

    /**
     * End resize operation and commit size
     */
    endResize() {
        if (!this.resizeState) return;

        const { element, widget, onResizeEnd } = this.resizeState;

        // Remove resizing class
        element.classList.remove('resizing');

        // Call callback with new dimensions
        if (onResizeEnd) {
            onResizeEnd(widget, widget.w, widget.h, widget.x, widget.y);
        }

        this.cleanup();
        console.log('[ResizeHandler] Resize completed:', widget.id, `${widget.w}×${widget.h} at (${widget.x}, ${widget.y})`);
    }

    /**
     * Cancel resize operation and restore original size
     */
    cancelResize() {
        if (!this.resizeState) return;

        const { element, startWidth, startHeight, startGridX, startGridY } = this.resizeState;

        // Restore original size
        const widget = {
            x: startGridX,
            y: startGridY,
            w: startWidth,
            h: startHeight
        };

        const pos = this.gridEngine.getPixelPosition(widget);
        element.style.width = pos.width + 'px';
        element.style.height = pos.height + 'px';
        element.style.left = pos.left + 'px';
        element.style.top = pos.top + 'px';

        // Remove resizing class
        element.classList.remove('resizing');

        this.cleanup();
        console.log('[ResizeHandler] Resize cancelled');
    }

    /**
     * Cleanup after resize ends
     */
    cleanup() {
        // Remove dimension overlay
        if (this.resizeState?.overlay) {
            this.resizeState.overlay.remove();
        }

        // Remove grid overlay
        this.hideGridOverlay();

        // Remove event listeners
        document.removeEventListener('mousemove', this.boundMouseMove);
        document.removeEventListener('mouseup', this.boundMouseUp);
        document.removeEventListener('touchmove', this.boundTouchMove);
        document.removeEventListener('touchend', this.boundTouchEnd);
        document.removeEventListener('keydown', this.boundKeyDown);

        // Clear touch timer
        if (this.touchTimer) {
            clearTimeout(this.touchTimer);
            this.touchTimer = null;
        }

        this.resizeState = null;
    }

    /**
     * Create dimension overlay element
     * @returns {HTMLElement} Overlay element
     */
    createDimensionOverlay() {
        const overlay = document.createElement('div');
        overlay.className = 'resize-dimension-overlay';
        overlay.style.position = 'absolute';
        overlay.style.background = 'rgba(78, 204, 163, 0.9)';
        overlay.style.color = 'white';
        overlay.style.padding = '8px 12px';
        overlay.style.borderRadius = '6px';
        overlay.style.fontSize = '14px';
        overlay.style.fontWeight = 'bold';
        overlay.style.pointerEvents = 'none';
        overlay.style.zIndex = '10001';
        overlay.style.transform = 'translate(-50%, -50%)';
        overlay.style.whiteSpace = 'nowrap';
        overlay.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';

        this.gridEngine.container.appendChild(overlay);
        return overlay;
    }

    /**
     * Show grid overlay
     */
    showGridOverlay() {
        if (this.gridOverlay) return;

        this.gridOverlay = document.createElement('div');
        this.gridOverlay.className = 'grid-overlay';
        this.gridOverlay.style.position = 'absolute';
        this.gridOverlay.style.top = '0';
        this.gridOverlay.style.left = '0';
        this.gridOverlay.style.width = '100%';
        this.gridOverlay.style.height = '100%';
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

        this.gridOverlay.innerHTML = '';

        const totalGaps = this.gridEngine.gap * (this.gridEngine.columns + 1);
        const colWidth = (this.gridEngine.containerWidth - totalGaps) / this.gridEngine.columns;

        for (let row = y; row < y + h; row++) {
            for (let col = x; col < x + w; col++) {
                const cell = document.createElement('div');
                cell.style.position = 'absolute';
                cell.style.left = (col * (colWidth + this.gridEngine.gap) + this.gridEngine.gap) + 'px';
                cell.style.top = (row * (this.gridEngine.rowHeight + this.gridEngine.gap) + this.gridEngine.gap) + 'px';
                cell.style.width = colWidth + 'px';
                cell.style.height = this.gridEngine.rowHeight + 'px';
                cell.style.backgroundColor = 'rgba(78, 204, 163, 0.3)';
                cell.style.border = '2px solid rgba(78, 204, 163, 0.6)';
                cell.style.borderRadius = '4px';
                cell.style.boxSizing = 'border-box';

                this.gridOverlay.appendChild(cell);
            }
        }
    }

    /**
     * Get current resize state
     * @returns {ResizeState|null} Current resize state or null
     */
    getResizeState() {
        return this.resizeState;
    }

    /**
     * Check if currently resizing
     * @returns {boolean} True if resize in progress
     */
    isResizing() {
        return this.resizeState?.isResizing || false;
    }

    /**
     * Destroy resize handler and cleanup
     */
    destroy() {
        // Cancel any ongoing resize
        if (this.isResizing()) {
            this.cancelResize();
        }

        // Remove all widget handlers
        for (const element of this.resizeHandlers.keys()) {
            this.destroyWidget(element);
        }

        this.resizeHandlers.clear();
    }
}
