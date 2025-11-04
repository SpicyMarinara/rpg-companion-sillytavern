/**
 * Prompt Dialog System
 *
 * Provides styled prompt dialogs for text input, matching extension theming.
 * Used for tab renaming, creation, etc.
 */

/**
 * Show a prompt dialog with text input
 * @param {Object} options - Dialog options
 * @param {string} options.title - Dialog title
 * @param {string} options.message - Dialog message/label
 * @param {string} [options.defaultValue=''] - Default input value
 * @param {string} [options.placeholder=''] - Input placeholder
 * @param {string} [options.confirmText='OK'] - Confirm button text
 * @param {string} [options.cancelText='Cancel'] - Cancel button text
 * @param {Function} [options.validator] - Optional validation function (value) => {valid: boolean, error: string}
 * @returns {Promise<string|null>} Resolves to input value if confirmed, null if cancelled
 */
export function showPromptDialog(options) {
    return new Promise((resolve) => {
        const {
            title = 'Enter Value',
            message = '',
            defaultValue = '',
            placeholder = '',
            confirmText = 'OK',
            cancelText = 'Cancel',
            validator = null
        } = options;

        // Create modal container (uses .rpg-modal class for theming)
        const modal = document.createElement('div');
        modal.className = 'rpg-modal rpg-prompt-modal';
        modal.style.display = 'flex';

        // Create modal content (uses .rpg-modal-content class for theming)
        const modalContent = document.createElement('div');
        modalContent.className = 'rpg-modal-content rpg-prompt-content';

        // Copy theme from panel so modal inherits theme CSS variables
        const panel = document.querySelector('.rpg-panel');
        if (panel && panel.dataset.theme) {
            modalContent.dataset.theme = panel.dataset.theme;
        }

        modalContent.style.cssText = `
            min-width: 400px;
            max-width: 90vw;
        `;

        // Header (uses .rpg-modal-header class)
        const header = document.createElement('div');
        header.className = 'rpg-modal-header';

        const headerContent = document.createElement('div');
        headerContent.style.display = 'flex';
        headerContent.style.alignItems = 'center';
        headerContent.style.gap = '0.5rem';

        const icon = document.createElement('i');
        icon.className = 'fa-solid fa-pencil';
        icon.style.color = 'var(--rpg-highlight)';

        const titleEl = document.createElement('h3');
        titleEl.textContent = title;
        titleEl.style.margin = '0';

        const closeBtn = document.createElement('button');
        closeBtn.className = 'rpg-modal-close';
        closeBtn.innerHTML = '<i class="fa-solid fa-times"></i>';

        headerContent.appendChild(icon);
        headerContent.appendChild(titleEl);
        header.appendChild(headerContent);
        header.appendChild(closeBtn);

        // Body (uses .rpg-modal-body class)
        const body = document.createElement('div');
        body.className = 'rpg-modal-body';

        if (message) {
            const messageEl = document.createElement('p');
            messageEl.textContent = message;
            messageEl.style.cssText = `
                margin: 0 0 1rem 0;
                color: var(--rpg-text);
            `;
            body.appendChild(messageEl);
        }

        const input = document.createElement('input');
        input.type = 'text';
        input.value = defaultValue;
        input.placeholder = placeholder;
        input.style.cssText = `
            width: 100%;
            padding: 0.5rem;
            background: var(--rpg-accent);
            border: 1px solid var(--rpg-border);
            border-radius: 4px;
            color: var(--rpg-text);
            font-size: 1rem;
            font-family: inherit;
            box-sizing: border-box;
        `;

        const errorEl = document.createElement('div');
        errorEl.className = 'rpg-prompt-error';
        errorEl.style.cssText = `
            margin-top: 0.5rem;
            color: var(--rpg-highlight);
            font-size: 0.875rem;
            min-height: 1.25rem;
        `;

        body.appendChild(input);
        body.appendChild(errorEl);

        // Footer (uses .rpg-modal-footer class)
        const footer = document.createElement('div');
        footer.className = 'rpg-modal-footer';

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'rpg-btn-secondary';
        cancelBtn.innerHTML = `<i class="fa-solid fa-times"></i> ${cancelText}`;

        const confirmBtn = document.createElement('button');
        confirmBtn.className = 'rpg-btn-primary';
        confirmBtn.innerHTML = `<i class="fa-solid fa-check"></i> ${confirmText}`;

        footer.appendChild(cancelBtn);
        footer.appendChild(confirmBtn);

        // Assemble modal
        modalContent.appendChild(header);
        modalContent.appendChild(body);
        modalContent.appendChild(footer);
        modal.appendChild(modalContent);

        // Append to body
        document.body.appendChild(modal);

        // Validation helper
        const validate = () => {
            if (!validator) return { valid: true, error: '' };
            const result = validator(input.value);
            errorEl.textContent = result.error || '';
            return result;
        };

        // Handle confirm
        const handleConfirm = () => {
            const validation = validate();
            if (!validation.valid) {
                input.focus();
                return;
            }

            modal.remove();
            cleanup();
            resolve(input.value);
        };

        // Handle cancel
        const handleCancel = () => {
            modal.remove();
            cleanup();
            resolve(null);
        };

        // Handle keyboard
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                handleCancel();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                handleConfirm();
            }
        };

        // Handle backdrop click
        const handleBackdropClick = (e) => {
            if (e.target === modal) {
                handleCancel();
            }
        };

        // Clean up event listeners
        const cleanup = () => {
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
            closeBtn.removeEventListener('click', handleCancel);
            input.removeEventListener('keydown', handleKeyDown);
            modal.removeEventListener('click', handleBackdropClick);
        };

        // Attach event listeners
        confirmBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', handleCancel);
        closeBtn.addEventListener('click', handleCancel);
        input.addEventListener('keydown', handleKeyDown);
        modal.addEventListener('click', handleBackdropClick);

        // Focus input and select default text
        setTimeout(() => {
            input.focus();
            if (defaultValue) {
                input.select();
            }
        }, 100);
    });
}
