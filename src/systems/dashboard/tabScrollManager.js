/**
 * Tab Scroll Manager
 *
 * Handles horizontal scrolling of dashboard tabs with:
 * - Left/Right navigation arrows
 * - Edge fade indicators
 * - Smooth scroll behavior
 * - Automatic arrow visibility
 */

export class TabScrollManager {
    /**
     * @param {HTMLElement} tabContainer - The scrollable tabs container
     * @param {Object} options - Configuration options
     */
    constructor(tabContainer, options = {}) {
        this.tabContainer = tabContainer;
        this.options = {
            scrollAmount: 200, // px per click
            smoothScroll: true,
            showFadeIndicators: true,
            arrowHideDelay: 2000, // ms after scroll stops
            ...options
        };

        this.leftArrow = null;
        this.rightArrow = null;
        this.leftFade = null;
        this.rightFade = null;
        this.scrollTimeout = null;
        this.isScrolling = false;

        this.boundScrollHandler = this.handleScroll.bind(this);
        this.boundResizeHandler = this.handleResize.bind(this);
    }

    /**
     * Initialize the scroll manager
     */
    init() {
        console.log('[TabScrollManager] Initializing...');

        // Create arrow buttons
        this.createArrows();

        // Create fade indicators if enabled
        if (this.options.showFadeIndicators) {
            this.createFadeIndicators();
        }

        // Set up event listeners
        this.tabContainer.addEventListener('scroll', this.boundScrollHandler);
        window.addEventListener('resize', this.boundResizeHandler);

        // Initial state update
        this.updateScrollState();

        console.log('[TabScrollManager] Initialized');
    }

    /**
     * Create left and right arrow buttons
     */
    createArrows() {
        const wrapper = this.tabContainer.parentElement;

        // Left arrow
        this.leftArrow = document.createElement('button');
        this.leftArrow.className = 'rpg-tab-nav-arrow rpg-tab-nav-left';
        this.leftArrow.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
        this.leftArrow.setAttribute('aria-label', 'Scroll tabs left');
        this.leftArrow.addEventListener('click', () => this.scrollLeft());

        // Right arrow
        this.rightArrow = document.createElement('button');
        this.rightArrow.className = 'rpg-tab-nav-arrow rpg-tab-nav-right';
        this.rightArrow.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
        this.rightArrow.setAttribute('aria-label', 'Scroll tabs right');
        this.rightArrow.addEventListener('click', () => this.scrollRight());

        // Insert arrows
        wrapper.insertBefore(this.leftArrow, this.tabContainer);
        wrapper.appendChild(this.rightArrow);
    }

    /**
     * Create fade indicator overlays
     */
    createFadeIndicators() {
        const wrapper = this.tabContainer.parentElement;

        // Left fade
        this.leftFade = document.createElement('div');
        this.leftFade.className = 'rpg-tab-fade rpg-tab-fade-left';

        // Right fade
        this.rightFade = document.createElement('div');
        this.rightFade.className = 'rpg-tab-fade rpg-tab-fade-right';

        // Insert fades
        wrapper.insertBefore(this.leftFade, this.tabContainer);
        wrapper.appendChild(this.rightFade);
    }

    /**
     * Scroll tabs to the left
     */
    scrollLeft() {
        const scrollAmount = this.options.scrollAmount;
        const targetScroll = Math.max(0, this.tabContainer.scrollLeft - scrollAmount);

        if (this.options.smoothScroll) {
            this.tabContainer.scrollTo({
                left: targetScroll,
                behavior: 'smooth'
            });
        } else {
            this.tabContainer.scrollLeft = targetScroll;
        }
    }

    /**
     * Scroll tabs to the right
     */
    scrollRight() {
        const scrollAmount = this.options.scrollAmount;
        const maxScroll = this.tabContainer.scrollWidth - this.tabContainer.clientWidth;
        const targetScroll = Math.min(maxScroll, this.tabContainer.scrollLeft + scrollAmount);

        if (this.options.smoothScroll) {
            this.tabContainer.scrollTo({
                left: targetScroll,
                behavior: 'smooth'
            });
        } else {
            this.tabContainer.scrollLeft = targetScroll;
        }
    }

    /**
     * Handle scroll events
     */
    handleScroll() {
        this.isScrolling = true;

        // Update arrow and fade visibility
        this.updateScrollState();

        // Clear previous timeout
        if (this.scrollTimeout) {
            clearTimeout(this.scrollTimeout);
        }

        // Hide arrows after scroll stops (optional)
        if (this.options.arrowHideDelay > 0) {
            this.scrollTimeout = setTimeout(() => {
                this.isScrolling = false;
                this.updateScrollState();
            }, this.options.arrowHideDelay);
        }
    }

    /**
     * Handle window resize
     */
    handleResize() {
        this.updateScrollState();
    }

    /**
     * Update arrow and fade visibility based on scroll position
     */
    updateScrollState() {
        const scrollLeft = this.tabContainer.scrollLeft;
        const scrollWidth = this.tabContainer.scrollWidth;
        const clientWidth = this.tabContainer.clientWidth;
        const maxScroll = scrollWidth - clientWidth;

        const isScrollable = scrollWidth > clientWidth;
        const isAtStart = scrollLeft <= 1; // Small threshold for floating point
        const isAtEnd = scrollLeft >= maxScroll - 1;

        // Show/hide left arrow
        if (this.leftArrow) {
            if (isScrollable && !isAtStart) {
                this.leftArrow.classList.add('visible');
            } else {
                this.leftArrow.classList.remove('visible');
            }
        }

        // Show/hide right arrow
        if (this.rightArrow) {
            if (isScrollable && !isAtEnd) {
                this.rightArrow.classList.add('visible');
            } else {
                this.rightArrow.classList.remove('visible');
            }
        }

        // Show/hide fade indicators
        if (this.leftFade) {
            if (isScrollable && !isAtStart) {
                this.leftFade.classList.add('visible');
            } else {
                this.leftFade.classList.remove('visible');
            }
        }

        if (this.rightFade) {
            if (isScrollable && !isAtEnd) {
                this.rightFade.classList.add('visible');
            } else {
                this.rightFade.classList.remove('visible');
            }
        }
    }

    /**
     * Scroll a specific tab into view
     * @param {HTMLElement} tabElement - Tab element to scroll to
     */
    scrollToTab(tabElement) {
        if (!tabElement) return;

        tabElement.scrollIntoView({
            behavior: this.options.smoothScroll ? 'smooth' : 'auto',
            block: 'nearest',
            inline: 'center'
        });
    }

    /**
     * Destroy the scroll manager
     */
    destroy() {
        console.log('[TabScrollManager] Destroying...');

        // Remove event listeners
        this.tabContainer.removeEventListener('scroll', this.boundScrollHandler);
        window.removeEventListener('resize', this.boundResizeHandler);

        // Clear timeout
        if (this.scrollTimeout) {
            clearTimeout(this.scrollTimeout);
        }

        // Remove arrows
        if (this.leftArrow) this.leftArrow.remove();
        if (this.rightArrow) this.rightArrow.remove();

        // Remove fade indicators
        if (this.leftFade) this.leftFade.remove();
        if (this.rightFade) this.rightFade.remove();

        console.log('[TabScrollManager] Destroyed');
    }
}
