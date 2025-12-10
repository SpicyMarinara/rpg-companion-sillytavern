/**
 * Add Item Modal Helper
 * Provides reusable modal dialogs for adding abilities, spells, and cantrips
 */

/**
 * Shows a modal dialog for adding an ability
 * @returns {Promise<{name: string, description: string} | null>} Returns item data or null if cancelled
 */
export function showAddAbilityModal() {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'rpg-add-item-modal-overlay';
        modal.innerHTML = `
            <div class="rpg-add-item-modal">
                <h2>Add New Ability</h2>
                <div class="rpg-modal-form">
                    <div class="rpg-form-group">
                        <label for="rpg-modal-ability-name">Ability Name *</label>
                        <input type="text" id="rpg-modal-ability-name" placeholder="Enter ability name" class="rpg-modal-input" />
                    </div>
                    <div class="rpg-form-group">
                        <label for="rpg-modal-ability-desc">Description (optional)</label>
                        <textarea id="rpg-modal-ability-desc" placeholder="Enter description (creates lorebook entry)" rows="4" class="rpg-modal-textarea"></textarea>
                    </div>
                    <div class="rpg-modal-buttons">
                        <button class="rpg-modal-btn rpg-modal-cancel">Cancel</button>
                        <button class="rpg-modal-btn rpg-modal-submit">Add Ability</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const nameInput = modal.querySelector('#rpg-modal-ability-name');
        const descInput = modal.querySelector('#rpg-modal-ability-desc');
        const cancelBtn = modal.querySelector('.rpg-modal-cancel');
        const submitBtn = modal.querySelector('.rpg-modal-submit');

        const cleanup = () => modal.remove();

        cancelBtn.onclick = () => {
            cleanup();
            resolve(null);
        };

        submitBtn.onclick = () => {
            const name = nameInput.value.trim();
            if (!name) {
                alert('Please enter an ability name');
                return;
            }
            cleanup();
            resolve({ 
                name, 
                description: descInput.value.trim()
            });
        };

        nameInput.focus();
    });
}

/**
 * Shows a modal dialog for adding a spell
 * @returns {Promise<{name: string, level: number, description: string} | null>}
 */
export function showAddSpellModal() {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'rpg-add-item-modal-overlay';
        modal.innerHTML = `
            <div class="rpg-add-item-modal">
                <h2>Add New Spell</h2>
                <div class="rpg-modal-form">
                    <div class="rpg-form-group">
                        <label for="rpg-modal-spell-name">Spell Name *</label>
                        <input type="text" id="rpg-modal-spell-name" placeholder="Enter spell name" class="rpg-modal-input" />
                    </div>
                    <div class="rpg-form-group">
                        <label for="rpg-modal-spell-level">Spell Level *</label>
                        <select id="rpg-modal-spell-level" class="rpg-modal-input">
                            ${Array.from({ length: 9 }, (_, i) => `<option value="${i+1}">Level ${i+1}</option>`).join('')}
                        </select>
                    </div>
                    <div class="rpg-form-group">
                        <label for="rpg-modal-spell-desc">Description (optional)</label>
                        <textarea id="rpg-modal-spell-desc" placeholder="Enter description (creates lorebook entry)" rows="4" class="rpg-modal-textarea"></textarea>
                    </div>
                    <div class="rpg-modal-buttons">
                        <button class="rpg-modal-btn rpg-modal-cancel">Cancel</button>
                        <button class="rpg-modal-btn rpg-modal-submit">Add Spell</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const nameInput = modal.querySelector('#rpg-modal-spell-name');
        const levelSelect = modal.querySelector('#rpg-modal-spell-level');
        const descInput = modal.querySelector('#rpg-modal-spell-desc');
        const cancelBtn = modal.querySelector('.rpg-modal-cancel');
        const submitBtn = modal.querySelector('.rpg-modal-submit');

        const cleanup = () => modal.remove();

        cancelBtn.onclick = () => {
            cleanup();
            resolve(null);
        };

        submitBtn.onclick = () => {
            const name = nameInput.value.trim();
            if (!name) {
                alert('Please enter a spell name');
                return;
            }
            cleanup();
            resolve({ 
                name, 
                level: parseInt(levelSelect.value) || 1,
                description: descInput.value.trim()
            });
        };

        nameInput.focus();
    });
}

/**
 * Shows a modal dialog for adding a cantrip
 * @returns {Promise<{name: string, description: string} | null>}
 */
export function showAddCantripModal() {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'rpg-add-item-modal-overlay';
        modal.innerHTML = `
            <div class="rpg-add-item-modal">
                <h2>Add New Cantrip</h2>
                <div class="rpg-modal-form">
                    <div class="rpg-form-group">
                        <label for="rpg-modal-cantrip-name">Cantrip Name *</label>
                        <input type="text" id="rpg-modal-cantrip-name" placeholder="Enter cantrip name" class="rpg-modal-input" />
                    </div>
                    <div class="rpg-form-group">
                        <label for="rpg-modal-cantrip-desc">Description (optional)</label>
                        <textarea id="rpg-modal-cantrip-desc" placeholder="Enter description (creates lorebook entry)" rows="4" class="rpg-modal-textarea"></textarea>
                    </div>
                    <div class="rpg-modal-buttons">
                        <button class="rpg-modal-btn rpg-modal-cancel">Cancel</button>
                        <button class="rpg-modal-btn rpg-modal-submit">Add Cantrip</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const nameInput = modal.querySelector('#rpg-modal-cantrip-name');
        const descInput = modal.querySelector('#rpg-modal-cantrip-desc');
        const cancelBtn = modal.querySelector('.rpg-modal-cancel');
        const submitBtn = modal.querySelector('.rpg-modal-submit');

        const cleanup = () => modal.remove();

        cancelBtn.onclick = () => {
            cleanup();
            resolve(null);
        };

        submitBtn.onclick = () => {
            const name = nameInput.value.trim();
            if (!name) {
                alert('Please enter a cantrip name');
                return;
            }
            cleanup();
            resolve({ 
                name, 
                description: descInput.value.trim()
            });
        };

        nameInput.focus();
    });
}
