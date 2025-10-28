/**
 * Confirmation Dialog System
 *
 * Provides styled confirmation and alert dialogs to replace native browser popups.
 * Supports three variants: danger (red), warning (yellow), and info (blue).
 */

/**
 * Show a confirmation dialog
 * @param {Object} options - Dialog options
 * @param {string} options.title - Dialog title
 * @param {string} options.message - Dialog message
 * @param {string} [options.variant='danger'] - Dialog variant: 'danger', 'warning', or 'info'
 * @param {string} [options.confirmText='Confirm'] - Confirm button text
 * @param {string} [options.cancelText='Cancel'] - Cancel button text
 * @param {Function} [options.onConfirm] - Callback when confirmed
 * @param {Function} [options.onCancel] - Callback when cancelled
 * @returns {Promise<boolean>} Resolves to true if confirmed, false if cancelled
 */
export function showConfirmDialog(options) {
    return new Promise((resolve) => {
        const {
            title = 'Confirm Action',
            message = 'Are you sure?',
            variant = 'danger',
            confirmText = 'Confirm',
            cancelText = 'Cancel',
            onConfirm = null,
            onCancel = null
        } = options;

        // Get modal elements
        const modal = document.getElementById('rpg-confirm-dialog');

        if (!modal) {
            console.error('[ConfirmDialog] Modal not found');
            return resolve(false);
        }

        // CRITICAL: Move modal to document.body on first use to escape panel constraints
        // The panel has transform in its transition which creates a containing block,
        // constraining position:fixed children to the panel instead of viewport
        if (modal.parentElement?.id !== 'document-body-modals') {
            // Create container for modals at body level (only once)
            let bodyModalsContainer = document.getElementById('document-body-modals');
            if (!bodyModalsContainer) {
                bodyModalsContainer = document.createElement('div');
                bodyModalsContainer.id = 'document-body-modals';
                bodyModalsContainer.style.cssText = 'position: fixed; inset: 0; pointer-events: none; z-index: 10000; display: flex; align-items: center; justify-content: center;';
                document.body.appendChild(bodyModalsContainer);
            }
            bodyModalsContainer.appendChild(modal);
            console.log('[ConfirmDialog] Moved modal to document.body to escape panel constraints');
        }

        const modalContent = modal.querySelector('.rpg-confirm-content');
        const icon = document.getElementById('rpg-confirm-icon');
        const titleEl = document.getElementById('rpg-confirm-title');
        const messageEl = document.getElementById('rpg-confirm-message');
        const confirmBtn = document.getElementById('rpg-confirm-confirm');
        const cancelBtn = document.getElementById('rpg-confirm-cancel');
        const closeBtn = modal.querySelector('.rpg-confirm-close');

        // Set icon based on variant
        const iconMap = {
            danger: 'fa-solid fa-triangle-exclamation',
            warning: 'fa-solid fa-circle-exclamation',
            info: 'fa-solid fa-circle-info'
        };
        icon.className = `rpg-confirm-icon ${iconMap[variant] || iconMap.danger}`;

        // Set variant class on modal content
        modalContent.className = `rpg-modal-content rpg-confirm-content rpg-confirm-${variant}`;

        // Set content
        titleEl.textContent = title;
        messageEl.textContent = message;
        confirmBtn.textContent = confirmText;
        cancelBtn.textContent = cancelText;

        // Show modal
        modal.style.display = 'flex';

        // Handle confirm
        const handleConfirm = () => {
            modal.style.display = 'none';
            cleanup();
            if (onConfirm) onConfirm();
            resolve(true);
        };

        // Handle cancel
        const handleCancel = () => {
            modal.style.display = 'none';
            cleanup();
            if (onCancel) onCancel();
            resolve(false);
        };

        // Handle keyboard
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                handleCancel();
            } else if (e.key === 'Enter') {
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
            document.removeEventListener('keydown', handleKeyDown);
            modal.removeEventListener('click', handleBackdropClick);
        };

        // Attach event listeners
        confirmBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', handleCancel);
        closeBtn.addEventListener('click', handleCancel);
        document.addEventListener('keydown', handleKeyDown);
        modal.addEventListener('click', handleBackdropClick);

        // Focus confirm button
        setTimeout(() => confirmBtn.focus(), 100);
    });
}

/**
 * Show an alert dialog (info only, single OK button)
 * @param {Object} options - Dialog options
 * @param {string} options.title - Dialog title
 * @param {string} options.message - Dialog message
 * @param {string} [options.variant='info'] - Dialog variant: 'danger', 'warning', or 'info'
 * @param {string} [options.okText='OK'] - OK button text
 * @param {Function} [options.onOk] - Callback when OK clicked
 * @returns {Promise<void>} Resolves when OK clicked
 */
export function showAlertDialog(options) {
    return new Promise((resolve) => {
        const {
            title = 'Alert',
            message = '',
            variant = 'info',
            okText = 'OK',
            onOk = null
        } = options;

        // Get modal elements
        const modal = document.getElementById('rpg-confirm-dialog');

        if (!modal) {
            console.error('[ConfirmDialog] Modal not found');
            return resolve();
        }

        // CRITICAL: Move modal to document.body on first use to escape panel constraints
        // The panel has transform in its transition which creates a containing block,
        // constraining position:fixed children to the panel instead of viewport
        if (modal.parentElement?.id !== 'document-body-modals') {
            // Create container for modals at body level (only once)
            let bodyModalsContainer = document.getElementById('document-body-modals');
            if (!bodyModalsContainer) {
                bodyModalsContainer = document.createElement('div');
                bodyModalsContainer.id = 'document-body-modals';
                bodyModalsContainer.style.cssText = 'position: fixed; inset: 0; pointer-events: none; z-index: 10000; display: flex; align-items: center; justify-content: center;';
                document.body.appendChild(bodyModalsContainer);
            }
            bodyModalsContainer.appendChild(modal);
            console.log('[ConfirmDialog] Moved modal to document.body to escape panel constraints');
        }

        const modalContent = modal.querySelector('.rpg-confirm-content');
        const icon = document.getElementById('rpg-confirm-icon');
        const titleEl = document.getElementById('rpg-confirm-title');
        const messageEl = document.getElementById('rpg-confirm-message');
        const confirmBtn = document.getElementById('rpg-confirm-confirm');
        const cancelBtn = document.getElementById('rpg-confirm-cancel');
        const closeBtn = modal.querySelector('.rpg-confirm-close');

        // Set icon based on variant
        const iconMap = {
            danger: 'fa-solid fa-triangle-exclamation',
            warning: 'fa-solid fa-circle-exclamation',
            info: 'fa-solid fa-circle-info'
        };
        icon.className = `rpg-confirm-icon ${iconMap[variant] || iconMap.info}`;

        // Set variant class on modal content
        modalContent.className = `rpg-modal-content rpg-confirm-content rpg-confirm-${variant}`;

        // Set content
        titleEl.textContent = title;
        messageEl.textContent = message;
        confirmBtn.textContent = okText;

        // Hide cancel button for alerts
        cancelBtn.style.display = 'none';

        // Show modal
        modal.style.display = 'flex';

        // Handle OK
        const handleOk = () => {
            modal.style.display = 'none';
            cancelBtn.style.display = ''; // Restore for future confirms
            cleanup();
            if (onOk) onOk();
            resolve();
        };

        // Handle keyboard
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' || e.key === 'Enter') {
                handleOk();
            }
        };

        // Handle backdrop click
        const handleBackdropClick = (e) => {
            if (e.target === modal) {
                handleOk();
            }
        };

        // Clean up event listeners
        const cleanup = () => {
            confirmBtn.removeEventListener('click', handleOk);
            closeBtn.removeEventListener('click', handleOk);
            document.removeEventListener('keydown', handleKeyDown);
            modal.removeEventListener('click', handleBackdropClick);
        };

        // Attach event listeners
        confirmBtn.addEventListener('click', handleOk);
        closeBtn.addEventListener('click', handleOk);
        document.addEventListener('keydown', handleKeyDown);
        modal.addEventListener('click', handleBackdropClick);

        // Focus OK button
        setTimeout(() => confirmBtn.focus(), 100);
    });
}
