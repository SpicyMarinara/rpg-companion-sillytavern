/**
 * Section Manager
 *
 * Manages collapsible sections within dashboard tabs for better organization and mobile UX.
 * Sections group related widgets together with expand/collapse functionality.
 *
 * Features:
 * - Click section header to toggle expand/collapse
 * - Smooth CSS transitions
 * - State persistence per tab in dashboard config
 * - Keyboard accessibility (Enter/Space to toggle)
 * - ARIA attributes for screen readers
 */

export class SectionManager {
    /**
     * @param {Object} options - Configuration options
     * @param {Function} options.onStateChange - Callback when section state changes
     */
    constructor(options = {}) {
        this.options = options;
        this.sectionStates = new Map(); // sectionId -> {expanded: boolean}

        // Bound event handlers
        this.boundToggleSection = this.toggleSection.bind(this);
        this.boundHandleKeyDown = this.handleKeyDown.bind(this);
    }

    /**
     * Initialize section state from dashboard config
     * @param {Object} tabConfig - Tab configuration with sections array
     */
    init(tabConfig) {
        if (!tabConfig || !Array.isArray(tabConfig.sections)) {
            return;
        }

        // Load initial state from config
        tabConfig.sections.forEach(section => {
            this.sectionStates.set(section.id, {
                expanded: section.expanded !== false // Default to expanded
            });
        });

        console.log(`[SectionManager] Initialized with ${this.sectionStates.size} sections`);
    }

    /**
     * Get section state
     * @param {string} sectionId - Section ID
     * @returns {boolean} Whether section is expanded
     */
    isExpanded(sectionId) {
        const state = this.sectionStates.get(sectionId);
        return state ? state.expanded : true; // Default to expanded
    }

    /**
     * Set section state
     * @param {string} sectionId - Section ID
     * @param {boolean} expanded - Whether section should be expanded
     * @param {boolean} notify - Whether to trigger state change callback
     */
    setExpanded(sectionId, expanded, notify = true) {
        this.sectionStates.set(sectionId, { expanded });

        // Update DOM
        const sectionHeader = document.querySelector(`[data-section-id="${sectionId}"]`);
        if (sectionHeader) {
            const container = sectionHeader.parentElement;
            const content = container?.querySelector('.rpg-section-content');
            const chevron = sectionHeader.querySelector('.rpg-section-chevron');

            if (expanded) {
                container?.classList.remove('collapsed');
                sectionHeader.setAttribute('aria-expanded', 'true');
                if (content) content.style.maxHeight = content.scrollHeight + 'px';
                if (chevron) chevron.style.transform = 'rotate(0deg)';
            } else {
                container?.classList.add('collapsed');
                sectionHeader.setAttribute('aria-expanded', 'false');
                if (content) content.style.maxHeight = '0';
                if (chevron) chevron.style.transform = 'rotate(-90deg)';
            }
        }

        // Notify state change
        if (notify && this.options.onStateChange) {
            this.options.onStateChange(sectionId, expanded);
        }

        console.log(`[SectionManager] Section '${sectionId}' ${expanded ? 'expanded' : 'collapsed'}`);
    }

    /**
     * Toggle section expand/collapse
     * @param {Event} event - Click event
     */
    toggleSection(event) {
        const header = event.currentTarget;
        const sectionId = header.dataset.sectionId;

        if (!sectionId) {
            console.warn('[SectionManager] No section ID found on header');
            return;
        }

        const currentState = this.isExpanded(sectionId);
        this.setExpanded(sectionId, !currentState);
    }

    /**
     * Handle keyboard events for accessibility
     * @param {KeyboardEvent} event - Keyboard event
     */
    handleKeyDown(event) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            this.toggleSection(event);
        }
    }

    /**
     * Attach event handlers to section header
     * @param {HTMLElement} header - Section header element
     */
    attachHandlers(header) {
        header.addEventListener('click', this.boundToggleSection);
        header.addEventListener('keydown', this.boundHandleKeyDown);
    }

    /**
     * Detach event handlers from section header
     * @param {HTMLElement} header - Section header element
     */
    detachHandlers(header) {
        header.removeEventListener('click', this.boundToggleSection);
        header.removeEventListener('keydown', this.boundHandleKeyDown);
    }

    /**
     * Render section header HTML
     * @param {Object} section - Section configuration
     * @param {string} section.id - Section ID
     * @param {string} section.name - Section display name
     * @param {string} section.icon - Section icon (emoji or FontAwesome)
     * @param {boolean} section.expanded - Whether section starts expanded
     * @returns {string} Section header HTML
     */
    renderSectionHeader(section) {
        const expanded = this.isExpanded(section.id);
        const chevronRotation = expanded ? '0deg' : '-90deg';

        return `
            <div class="rpg-section">
                <div class="rpg-section-header"
                     data-section-id="${section.id}"
                     role="button"
                     tabindex="0"
                     aria-expanded="${expanded}"
                     aria-label="Toggle ${section.name} section">
                    <span class="rpg-section-icon">${section.icon || '📁'}</span>
                    <span class="rpg-section-name">${section.name}</span>
                    <span class="rpg-section-chevron" style="transform: rotate(${chevronRotation})">
                        <i class="fa-solid fa-chevron-down"></i>
                    </span>
                </div>
                <div class="rpg-section-content" style="max-height: ${expanded ? 'none' : '0'}">
        `;
    }

    /**
     * Render section footer HTML
     * @returns {string} Section footer HTML
     */
    renderSectionFooter() {
        return `
                </div>
            </div>
        `;
    }

    /**
     * Get current state for persistence
     * @returns {Object} Map of sectionId -> expanded state
     */
    getState() {
        const state = {};
        this.sectionStates.forEach((value, key) => {
            state[key] = value.expanded;
        });
        return state;
    }

    /**
     * Restore state from saved data
     * @param {Object} state - Saved state object
     */
    restoreState(state) {
        if (!state || typeof state !== 'object') {
            return;
        }

        Object.entries(state).forEach(([sectionId, expanded]) => {
            this.setExpanded(sectionId, expanded, false); // Don't notify on restore
        });

        console.log(`[SectionManager] Restored state for ${Object.keys(state).length} sections`);
    }

    /**
     * Cleanup - detach all event handlers
     */
    destroy() {
        const headers = document.querySelectorAll('.rpg-section-header');
        headers.forEach(header => this.detachHandlers(header));
        this.sectionStates.clear();
        console.log('[SectionManager] Destroyed');
    }
}
