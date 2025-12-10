/**
 * Edit Item Modal Helper
 * Provides reusable modal dialogs for editing abilities, spells, and cantrips
 */

/**
 * Shows a modal dialog for editing an ability
 * @param {string} currentName - Current ability name
 * @param {string} currentDesc - Current ability description
 * @returns {Promise<{name: string, description: string} | null>}
 */
export function showEditAbilityModal(currentName, currentDesc = '') {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'rpg-add-item-modal-overlay';
        modal.innerHTML = `
            <div class="rpg-add-item-modal">
                <h2>Edit Ability</h2>
                <div class="rpg-modal-form">
                    <div class="rpg-form-group">
                        <label for="rpg-modal-ability-name-edit">Ability Name *</label>
                        <input type="text" id="rpg-modal-ability-name-edit" placeholder="Enter ability name" class="rpg-modal-input" value="${currentName.replace(/"/g, '&quot;')}" />
                    </div>
                    <div class="rpg-form-group">
                        <label for="rpg-modal-ability-desc-edit">Description (optional)</label>
                        <textarea id="rpg-modal-ability-desc-edit" placeholder="Enter description" rows="4" class="rpg-modal-textarea">${currentDesc.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                    </div>
                    <div class="rpg-modal-buttons">
                        <button class="rpg-modal-btn rpg-modal-cancel">Cancel</button>
                        <button class="rpg-modal-btn rpg-modal-submit">Save Changes</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const nameInput = modal.querySelector('#rpg-modal-ability-name-edit');
        const descInput = modal.querySelector('#rpg-modal-ability-desc-edit');
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
            resolve({ name, description: descInput.value.trim() });
        };

        nameInput.focus();
        nameInput.select();
    });
}

/**
 * Shows a modal dialog for editing a spell
 * @param {string} currentName - Current spell name
 * @param {number} currentLevel - Current spell level
 * @param {string} currentDesc - Current spell description
 * @returns {Promise<{name: string, level: number, description: string} | null>}
 */
export function showEditSpellModal(currentName, currentLevel = 1, currentDesc = '') {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'rpg-add-item-modal-overlay';
        modal.innerHTML = `
            <div class="rpg-add-item-modal">
                <h2>Edit Spell</h2>
                <div class="rpg-modal-form">
                    <div class="rpg-form-group">
                        <label for="rpg-modal-spell-name-edit">Spell Name *</label>
                        <input type="text" id="rpg-modal-spell-name-edit" placeholder="Enter spell name" class="rpg-modal-input" value="${currentName.replace(/"/g, '&quot;')}" />
                    </div>
                    <div class="rpg-form-group">
                        <label for="rpg-modal-spell-level-edit">Spell Level *</label>
                        <select id="rpg-modal-spell-level-edit" class="rpg-modal-input">
                            ${Array.from({ length: 9 }, (_, i) => `<option value="${i+1}" ${i+1 === currentLevel ? 'selected' : ''}>Level ${i+1}</option>`).join('')}
                        </select>
                    </div>
                    <div class="rpg-form-group">
                        <label for="rpg-modal-spell-desc-edit">Description (optional)</label>
                        <textarea id="rpg-modal-spell-desc-edit" placeholder="Enter description" rows="4" class="rpg-modal-textarea">${currentDesc.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                    </div>
                    <div class="rpg-modal-buttons">
                        <button class="rpg-modal-btn rpg-modal-cancel">Cancel</button>
                        <button class="rpg-modal-btn rpg-modal-submit">Save Changes</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const nameInput = modal.querySelector('#rpg-modal-spell-name-edit');
        const levelSelect = modal.querySelector('#rpg-modal-spell-level-edit');
        const descInput = modal.querySelector('#rpg-modal-spell-desc-edit');
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
        nameInput.select();
    });
}

/**
 * Shows a modal dialog for editing a cantrip
 * @param {string} currentName - Current cantrip name
 * @param {string} currentDesc - Current cantrip description
 * @returns {Promise<{name: string, description: string} | null>}
 */
export function showEditCantripModal(currentName, currentDesc = '') {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'rpg-add-item-modal-overlay';
        modal.innerHTML = `
            <div class="rpg-add-item-modal">
                <h2>Edit Cantrip</h2>
                <div class="rpg-modal-form">
                    <div class="rpg-form-group">
                        <label for="rpg-modal-cantrip-name-edit">Cantrip Name *</label>
                        <input type="text" id="rpg-modal-cantrip-name-edit" placeholder="Enter cantrip name" class="rpg-modal-input" value="${currentName.replace(/"/g, '&quot;')}" />
                    </div>
                    <div class="rpg-form-group">
                        <label for="rpg-modal-cantrip-desc-edit">Description (optional)</label>
                        <textarea id="rpg-modal-cantrip-desc-edit" placeholder="Enter description" rows="4" class="rpg-modal-textarea">${currentDesc.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                    </div>
                    <div class="rpg-modal-buttons">
                        <button class="rpg-modal-btn rpg-modal-cancel">Cancel</button>
                        <button class="rpg-modal-btn rpg-modal-submit">Save Changes</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const nameInput = modal.querySelector('#rpg-modal-cantrip-name-edit');
        const descInput = modal.querySelector('#rpg-modal-cantrip-desc-edit');
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
            resolve({ name, description: descInput.value.trim() });
        };

        nameInput.focus();
        nameInput.select();
    });
}
