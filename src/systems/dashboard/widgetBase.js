/**
 * Widget Base Utilities
 *
 * Provides common utilities for widget development:
 * - Standard widget HTML structure
 * - Editable field handlers
 * - Configuration UI helpers
 * - Event listener management
 */

/**
 * Create standard widget container structure
 * @param {Object} options - Widget options
 * @param {string} options.title - Widget title
 * @param {string} options.icon - Widget icon (emoji or FontAwesome class)
 * @param {string} options.content - Widget content HTML
 * @param {string} [options.headerClass] - Additional header CSS class
 * @param {string} [options.contentClass] - Additional content CSS class
 * @returns {string} Widget HTML
 */
export function createWidgetContainer({ title, icon, content, headerClass = '', contentClass = '' }) {
    return `
        <div class="rpg-widget-container">
            <div class="rpg-widget-header ${headerClass}">
                <span class="rpg-widget-icon">${icon}</span>
                <span class="rpg-widget-title">${title}</span>
            </div>
            <div class="rpg-widget-content ${contentClass}">
                ${content}
            </div>
        </div>
    `;
}

/**
 * Create editable field with auto-save
 * @param {Object} options - Field options
 * @param {string} options.value - Field value
 * @param {string} options.field - Field name (for data-field attribute)
 * @param {string} [options.placeholder] - Placeholder text
 * @param {string} [options.className] - Additional CSS class
 * @param {Function} [options.onSave] - Callback when field saved
 * @returns {string} Editable field HTML
 */
export function createEditableField({ value, field, placeholder = '', className = '', onSave }) {
    const dataAttr = onSave ? `data-on-save="true"` : '';
    return `
        <span class="rpg-editable ${className}"
              contenteditable="true"
              data-field="${field}"
              ${dataAttr}
              title="Click to edit">${value}</span>
    `;
}

/**
 * Attach editable field handlers to a container
 * @param {HTMLElement} container - Container element
 * @param {Function} onFieldChange - Callback (fieldName, newValue) => void
 */
export function attachEditableHandlers(container, onFieldChange) {
    if (!container) return;

    // Find all editable fields
    const editableFields = container.querySelectorAll('[contenteditable="true"]');

    editableFields.forEach(field => {
        // Store original value
        let originalValue = field.textContent.trim();

        // Focus event - select all text
        field.addEventListener('focus', (e) => {
            originalValue = e.target.textContent.trim();

            // Select all text
            const range = document.createRange();
            range.selectNodeContents(e.target);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
        });

        // Blur event - save changes
        field.addEventListener('blur', (e) => {
            const newValue = e.target.textContent.trim();
            const fieldName = e.target.dataset.field;

            if (newValue !== originalValue && newValue !== '') {
                console.log(`[WidgetBase] Field changed: ${fieldName} = ${newValue}`);
                if (onFieldChange) {
                    onFieldChange(fieldName, newValue);
                }
            } else if (newValue === '') {
                // Restore original if empty
                e.target.textContent = originalValue;
            }
        });

        // Enter key - blur to save
        field.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.target.blur();
            }
            // Escape key - cancel edit
            if (e.key === 'Escape') {
                e.preventDefault();
                e.target.textContent = originalValue;
                e.target.blur();
            }
        });

        // Prevent paste with formatting
        field.addEventListener('paste', (e) => {
            e.preventDefault();
            const text = (e.clipboardData || window.clipboardData).getData('text/plain');
            document.execCommand('insertText', false, text);
        });
    });
}

/**
 * Create progress bar HTML
 * @param {Object} options - Progress bar options
 * @param {string} options.label - Label text
 * @param {number} options.value - Current value (0-100)
 * @param {string} [options.gradient] - CSS gradient for bar
 * @param {boolean} [options.editable] - Whether value is editable
 * @param {string} [options.field] - Field name for editable value
 * @returns {string} Progress bar HTML
 */
export function createProgressBar({ label, value, gradient, editable = false, field = '' }) {
    const barStyle = gradient ? `background: ${gradient}` : '';
    const valueHtml = editable
        ? `<span class="rpg-stat-value rpg-editable-stat" contenteditable="true" data-field="${field}" title="Click to edit">${value}%</span>`
        : `<span class="rpg-stat-value">${value}%</span>`;

    return `
        <div class="rpg-stat-row">
            <span class="rpg-stat-label">${label}:</span>
            <div class="rpg-stat-bar" style="${barStyle}">
                <div class="rpg-stat-fill" style="width: ${100 - value}%"></div>
            </div>
            ${valueHtml}
        </div>
    `;
}

/**
 * Update progress bar value
 * @param {HTMLElement} container - Container element
 * @param {string} field - Field name
 * @param {number} newValue - New value (0-100)
 */
export function updateProgressBar(container, field, newValue) {
    const valueSpan = container.querySelector(`[data-field="${field}"]`);
    const fillDiv = valueSpan?.parentElement.querySelector('.rpg-stat-fill');

    if (valueSpan) {
        valueSpan.textContent = `${newValue}%`;
    }
    if (fillDiv) {
        fillDiv.style.width = `${100 - newValue}%`;
    }
}

/**
 * Create icon button
 * @param {Object} options - Button options
 * @param {string} options.icon - FontAwesome icon class or emoji
 * @param {string} [options.label] - Button label
 * @param {string} [options.className] - Additional CSS class
 * @param {string} [options.title] - Tooltip text
 * @returns {string} Button HTML
 */
export function createIconButton({ icon, label = '', className = '', title = '' }) {
    const isFontAwesome = icon.startsWith('fa-');
    const iconHtml = isFontAwesome
        ? `<i class="${icon}"></i>`
        : `<span class="rpg-emoji-icon">${icon}</span>`;

    return `
        <button class="rpg-icon-btn ${className}" title="${title}">
            ${iconHtml}
            ${label ? `<span>${label}</span>` : ''}
        </button>
    `;
}

/**
 * Create toggle switch
 * @param {Object} options - Toggle options
 * @param {string} options.id - Toggle ID
 * @param {string} options.label - Toggle label
 * @param {boolean} options.checked - Initial checked state
 * @param {Function} [options.onChange] - Change callback
 * @returns {string} Toggle HTML
 */
export function createToggle({ id, label, checked = false, onChange }) {
    return `
        <label class="rpg-toggle-label">
            <input type="checkbox" id="${id}" ${checked ? 'checked' : ''}>
            <span class="rpg-toggle-slider"></span>
            <span class="rpg-toggle-text">${label}</span>
        </label>
    `;
}

/**
 * Attach toggle handler
 * @param {HTMLElement} container - Container element
 * @param {string} toggleId - Toggle input ID
 * @param {Function} onChange - Callback (checked) => void
 */
export function attachToggleHandler(container, toggleId, onChange) {
    const toggle = container.querySelector(`#${toggleId}`);
    if (!toggle) return;

    toggle.addEventListener('change', (e) => {
        if (onChange) {
            onChange(e.target.checked);
        }
    });
}

/**
 * Create select dropdown
 * @param {Object} options - Select options
 * @param {string} options.id - Select ID
 * @param {Array<{value: string, label: string}>} options.options - Options array
 * @param {string} [options.selected] - Selected value
 * @param {string} [options.className] - Additional CSS class
 * @returns {string} Select HTML
 */
export function createSelect({ id, options, selected = '', className = '' }) {
    const optionsHtml = options.map(opt =>
        `<option value="${opt.value}" ${opt.value === selected ? 'selected' : ''}>${opt.label}</option>`
    ).join('');

    return `
        <select id="${id}" class="rpg-select ${className}">
            ${optionsHtml}
        </select>
    `;
}

/**
 * Attach select handler
 * @param {HTMLElement} container - Container element
 * @param {string} selectId - Select element ID
 * @param {Function} onChange - Callback (value) => void
 */
export function attachSelectHandler(container, selectId, onChange) {
    const select = container.querySelector(`#${selectId}`);
    if (!select) return;

    select.addEventListener('change', (e) => {
        if (onChange) {
            onChange(e.target.value);
        }
    });
}

/**
 * Create configuration section
 * @param {Object} options - Config options
 * @param {string} options.title - Section title
 * @param {string} options.content - Section content HTML
 * @param {boolean} [options.collapsible] - Whether section is collapsible
 * @param {boolean} [options.collapsed] - Initial collapsed state
 * @returns {string} Config section HTML
 */
export function createConfigSection({ title, content, collapsible = false, collapsed = false }) {
    if (!collapsible) {
        return `
            <div class="rpg-config-section">
                <h4 class="rpg-config-title">${title}</h4>
                <div class="rpg-config-content">
                    ${content}
                </div>
            </div>
        `;
    }

    return `
        <div class="rpg-config-section ${collapsed ? 'collapsed' : ''}">
            <h4 class="rpg-config-title rpg-collapsible">
                ${title}
                <i class="fa-solid fa-chevron-${collapsed ? 'down' : 'up'}"></i>
            </h4>
            <div class="rpg-config-content" style="${collapsed ? 'display: none;' : ''}">
                ${content}
            </div>
        </div>
    `;
}

/**
 * Attach collapsible section handlers
 * @param {HTMLElement} container - Container element
 */
export function attachCollapsibleHandlers(container) {
    const collapsibles = container.querySelectorAll('.rpg-collapsible');

    collapsibles.forEach(header => {
        header.addEventListener('click', () => {
            const section = header.parentElement;
            const content = section.querySelector('.rpg-config-content');
            const icon = header.querySelector('i');

            const isCollapsed = section.classList.toggle('collapsed');

            if (isCollapsed) {
                content.style.display = 'none';
                icon.className = 'fa-solid fa-chevron-down';
            } else {
                content.style.display = 'block';
                icon.className = 'fa-solid fa-chevron-up';
            }
        });
    });
}

/**
 * Debounce function for auto-save
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in ms
 * @returns {Function} Debounced function
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Safe number parser with fallback
 * @param {string|number} value - Value to parse
 * @param {number} fallback - Fallback value
 * @param {number} [min] - Minimum value
 * @param {number} [max] - Maximum value
 * @returns {number} Parsed number
 */
export function parseNumber(value, fallback, min = -Infinity, max = Infinity) {
    const num = typeof value === 'string' ? parseInt(value, 10) : value;
    if (isNaN(num)) return fallback;
    return Math.max(min, Math.min(max, num));
}

/**
 * Create loading spinner
 * @param {string} [text] - Loading text
 * @returns {string} Loading spinner HTML
 */
export function createLoadingSpinner(text = 'Loading...') {
    return `
        <div class="rpg-loading-spinner">
            <i class="fa-solid fa-spinner fa-spin"></i>
            <span>${text}</span>
        </div>
    `;
}

/**
 * Create empty state message
 * @param {Object} options - Empty state options
 * @param {string} options.icon - Icon (emoji or FA class)
 * @param {string} options.message - Message text
 * @param {string} [options.action] - Optional action button HTML
 * @returns {string} Empty state HTML
 */
export function createEmptyState({ icon, message, action = '' }) {
    const isFontAwesome = icon.startsWith('fa-');
    const iconHtml = isFontAwesome
        ? `<i class="${icon}"></i>`
        : `<span class="rpg-emoji-icon">${icon}</span>`;

    return `
        <div class="rpg-empty-state">
            <div class="rpg-empty-icon">${iconHtml}</div>
            <p class="rpg-empty-message">${message}</p>
            ${action}
        </div>
    `;
}

/**
 * Escape HTML to prevent XSS
 * @param {string} unsafe - Unsafe string
 * @returns {string} Escaped string
 */
export function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Format number with commas
 * @param {number} num - Number to format
 * @returns {string} Formatted number
 */
export function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Truncate text with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
export function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + '...';
}

/**
 * Create responsive grid for items
 * @param {Array<string>} items - Array of item HTML
 * @param {number} [columns] - Number of columns (auto if not specified)
 * @param {string} [gap] - Gap size (CSS value)
 * @returns {string} Grid HTML
 */
export function createGrid(items, columns = null, gap = '12px') {
    const gridStyle = columns
        ? `grid-template-columns: repeat(${columns}, 1fr); gap: ${gap};`
        : `grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: ${gap};`;

    return `
        <div class="rpg-grid" style="display: grid; ${gridStyle}">
            ${items.join('')}
        </div>
    `;
}

/**
 * Create card component
 * @param {Object} options - Card options
 * @param {string} options.title - Card title
 * @param {string} options.content - Card content
 * @param {string} [options.icon] - Optional icon
 * @param {string} [options.footer] - Optional footer HTML
 * @param {string} [options.className] - Additional CSS class
 * @returns {string} Card HTML
 */
export function createCard({ title, content, icon = '', footer = '', className = '' }) {
    const iconHtml = icon ? `<span class="rpg-card-icon">${icon}</span>` : '';
    const footerHtml = footer ? `<div class="rpg-card-footer">${footer}</div>` : '';

    return `
        <div class="rpg-card ${className}">
            <div class="rpg-card-header">
                ${iconHtml}
                <h5 class="rpg-card-title">${title}</h5>
            </div>
            <div class="rpg-card-body">
                ${content}
            </div>
            ${footerHtml}
        </div>
    `;
}
