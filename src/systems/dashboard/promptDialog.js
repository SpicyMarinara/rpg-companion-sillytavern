/**
 * Prompt Dialog System
 *
 * Provides styled prompt dialogs for text input, similar to confirmDialog.
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

        // Create modal container
        const modal = document.createElement('div');
        modal.className = 'rpg-modal rpg-prompt-modal';
        modal.style.display = 'flex';
        modal.style.position = 'fixed';
        modal.style.inset = '0';
        modal.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        modal.style.zIndex = '10001';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';

        // Create modal content
        const modalContent = document.createElement('div');
        modalContent.className = 'rpg-modal-content rpg-prompt-content';
        modalContent.style.cssText = `
            background: #16213e;
            border-radius: 8px;
            padding: 0;
            min-width: 400px;
            max-width: 90vw;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        `;

        // Header
        const header = document.createElement('div');
        header.className = 'rpg-modal-header';
        header.style.cssText = `
            padding: 20px;
            border-bottom: 1px solid #0f3460;
            display: flex;
            align-items: center;
            justify-content: space-between;
        `;

        const headerContent = document.createElement('div');
        headerContent.style.display = 'flex';
        headerContent.style.alignItems = 'center';
        headerContent.style.gap = '10px';

        const icon = document.createElement('i');
        icon.className = 'fa-solid fa-pencil';
        icon.style.color = '#4ecca3';
        icon.style.fontSize = '20px';

        const titleEl = document.createElement('h3');
        titleEl.textContent = title;
        titleEl.style.cssText = `
            margin: 0;
            font-size: 18px;
            color: #eeeeee;
        `;

        const closeBtn = document.createElement('button');
        closeBtn.className = 'rpg-modal-close';
        closeBtn.innerHTML = '<i class="fa-solid fa-times"></i>';
        closeBtn.style.cssText = `
            background: transparent;
            border: none;
            color: #eeeeee;
            font-size: 20px;
            cursor: pointer;
            padding: 4px;
            width: 28px;
            height: 28px;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.2s;
        `;
        closeBtn.onmouseenter = () => closeBtn.style.background = '#e94560';
        closeBtn.onmouseleave = () => closeBtn.style.background = 'transparent';

        headerContent.appendChild(icon);
        headerContent.appendChild(titleEl);
        header.appendChild(headerContent);
        header.appendChild(closeBtn);

        // Body
        const body = document.createElement('div');
        body.className = 'rpg-modal-body';
        body.style.cssText = `
            padding: 20px;
        `;

        if (message) {
            const messageEl = document.createElement('p');
            messageEl.textContent = message;
            messageEl.style.cssText = `
                margin: 0 0 15px 0;
                color: #eeeeee;
                font-size: 14px;
            `;
            body.appendChild(messageEl);
        }

        const input = document.createElement('input');
        input.type = 'text';
        input.value = defaultValue;
        input.placeholder = placeholder;
        input.style.cssText = `
            width: 100%;
            padding: 10px;
            background: #0f3460;
            border: 1px solid #1a4d7a;
            border-radius: 4px;
            color: #eeeeee;
            font-size: 14px;
            font-family: inherit;
            box-sizing: border-box;
        `;

        const errorEl = document.createElement('div');
        errorEl.className = 'rpg-prompt-error';
        errorEl.style.cssText = `
            margin-top: 8px;
            color: #e94560;
            font-size: 12px;
            min-height: 18px;
        `;

        body.appendChild(input);
        body.appendChild(errorEl);

        // Footer
        const footer = document.createElement('div');
        footer.className = 'rpg-modal-footer';
        footer.style.cssText = `
            padding: 20px;
            border-top: 1px solid #0f3460;
            display: flex;
            gap: 10px;
            justify-content: flex-end;
        `;

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'rpg-btn-secondary';
        cancelBtn.textContent = cancelText;
        cancelBtn.style.cssText = `
            padding: 10px 20px;
            background: #0f3460;
            border: none;
            border-radius: 6px;
            color: #eeeeee;
            font-size: 14px;
            cursor: pointer;
            transition: background 0.2s;
        `;
        cancelBtn.onmouseenter = () => cancelBtn.style.background = '#1a4d7a';
        cancelBtn.onmouseleave = () => cancelBtn.style.background = '#0f3460';

        const confirmBtn = document.createElement('button');
        confirmBtn.className = 'rpg-btn-primary';
        confirmBtn.textContent = confirmText;
        confirmBtn.style.cssText = `
            padding: 10px 20px;
            background: #4ecca3;
            border: none;
            border-radius: 6px;
            color: #16213e;
            font-size: 14px;
            font-weight: bold;
            cursor: pointer;
            transition: background 0.2s;
        `;
        confirmBtn.onmouseenter = () => confirmBtn.style.background = '#45b993';
        confirmBtn.onmouseleave = () => confirmBtn.style.background = '#4ecca3';

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
