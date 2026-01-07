/**
 * Encounter UI Module
 * Manages the combat encounter modal window and interactions
 */

import { getContext } from '../../../../../../extensions.js';
import { generateRaw, chat, saveChatDebounced, characters, this_chid, user_avatar } from '../../../../../../../script.js';
import { selected_group, getGroupMembers, groups } from '../../../../../../group-chats.js';
import { executeSlashCommandsOnChatInput } from '../../../../../../../scripts/slash-commands.js';
import { extensionSettings } from '../../core/state.js';
import { saveSettings } from '../../core/persistence.js';
import { i18n } from '../../core/i18n.js';
import { getSafeThumbnailUrl } from '../../utils/avatars.js';
import {
    currentEncounter,
    updateCurrentEncounter,
    resetEncounter,
    addCombatMessage,
    addEncounterLogEntry,
    saveEncounterLog
} from '../features/encounterState.js';
import {
    buildEncounterInitPrompt,
    buildCombatActionPrompt,
    buildCombatSummaryPrompt,
    parseEncounterJSON
} from '../generation/encounterPrompts.js';

/**
 * EncounterModal class
 * Manages the combat encounter UI
 */
export class EncounterModal {
    constructor() {
        this.modal = null;
        this.isInitializing = false;
        this.isProcessing = false;
        this.lastRequest = null; // Store last request for regeneration
    }

    /**
     * Opens the encounter modal and initializes combat
     */
    async open() {
        if (this.isInitializing) return;

        // Always show configuration modal (it will pre-populate with saved values if they exist)
        const configured = await this.showNarrativeConfigModal();
        if (!configured) {
            // User cancelled
            return;
        }

        // Proceed with encounter initialization
        await this.initialize();
    }

    /**
     * Initializes the encounter
     */
    async initialize() {
        if (this.isInitializing) return;

        this.isInitializing = true;

        try {
            // Create modal if it doesn't exist
            if (!this.modal) {
                this.createModal();
            }

            // Show loading state
            this.showLoadingState('Initializing combat encounter...');

            // Open the modal
            this.modal.classList.add('is-open');

            // Generate initial combat state
            const initPrompt = await buildEncounterInitPrompt();

            // Store request for potential regeneration
            this.lastRequest = { type: 'init', prompt: initPrompt };

            const response = await generateRaw({
                prompt: initPrompt,
                quietToLoud: false
            });

            if (!response) {
                this.showErrorWithRegenerate('No response received from AI. The model may be unavailable.');
                return;
            }

            // Parse the combat stats
            const combatData = parseEncounterJSON(response);

            if (!combatData || !combatData.party || !combatData.enemies) {
                this.showErrorWithRegenerate('Invalid JSON format detected. The AI returned malformed data.');
                return;
            }

            // Update encounter state
            updateCurrentEncounter({
                active: true,
                initialized: true,
                combatStats: combatData
            });

            // Add to combat history
            addCombatMessage('system', 'Combat initialized');
            addCombatMessage('assistant', JSON.stringify(combatData));

            // Apply visual styling from styleNotes
            if (combatData.styleNotes) {
                this.applyEnvironmentStyling(combatData.styleNotes);
            }

            // Render the combat UI
            this.renderCombatUI(combatData);

        } catch (error) {
            console.error('[RPG Companion] Error initializing encounter:', error);
            this.showErrorWithRegenerate(`Failed to initialize combat: ${error.message}`);
        } finally {
            this.isInitializing = false;
        }
    }

    /**
     * Shows narrative configuration modal before starting encounter
     * @returns {Promise<boolean>} True if configured, false if cancelled
     */
    async showNarrativeConfigModal() {
        return new Promise((resolve) => {
            // Get current values or defaults
            const combatDefaults = extensionSettings.encounterSettings?.combatNarrative || {};
            const summaryDefaults = extensionSettings.encounterSettings?.summaryNarrative || {};

            const configHTML = `
                <div id="rpg-narrative-config-modal" class="rpg-encounter-modal" data-theme="${extensionSettings.theme || 'default'}">
                    <div class="rpg-encounter-overlay"></div>
                    <div class="rpg-encounter-container" style="max-width: 600px;">
                        <div class="rpg-encounter-header">
                            <h2><i class="fa-solid fa-book-open"></i> Configure Combat Narrative</h2>
                        </div>
                        <div class="rpg-encounter-content" style="padding: 24px;">
                            <div class="rpg-narrative-config-section">
                                <label class="label_text" style="margin-bottom: 16px; display: block; font-weight: 600;">
                                    <i class="fa-solid fa-swords"></i> Combat Narrative Style
                                </label>

                                <div class="rpg-setting-row" style="margin-bottom: 12px;">
                                    <label for="config-combat-tense" style="min-width: 100px;">Tense:</label>
                                    <select id="config-combat-tense" class="rpg-select" style="flex: 1;">
                                        <option value="present" ${combatDefaults.tense === 'present' ? 'selected' : ''}>Present</option>
                                        <option value="past" ${combatDefaults.tense === 'past' ? 'selected' : ''}>Past</option>
                                    </select>
                                </div>

                                <div class="rpg-setting-row" style="margin-bottom: 12px;">
                                    <label for="config-combat-person" style="min-width: 100px;">Person:</label>
                                    <select id="config-combat-person" class="rpg-select" style="flex: 1;">
                                        <option value="first" ${combatDefaults.person === 'first' ? 'selected' : ''}>First Person</option>
                                        <option value="second" ${combatDefaults.person === 'second' ? 'selected' : ''}>Second Person</option>
                                        <option value="third" ${combatDefaults.person === 'third' ? 'selected' : ''}>Third Person</option>
                                    </select>
                                </div>

                                <div class="rpg-setting-row" style="margin-bottom: 12px;">
                                    <label for="config-combat-narration" style="min-width: 100px;">Narration:</label>
                                    <select id="config-combat-narration" class="rpg-select" style="flex: 1;">
                                        <option value="omniscient" ${combatDefaults.narration === 'omniscient' ? 'selected' : ''}>Omniscient</option>
                                        <option value="limited" ${combatDefaults.narration === 'limited' ? 'selected' : ''}>Limited</option>
                                    </select>
                                </div>

                                <div class="rpg-setting-row" style="margin-bottom: 12px;">
                                    <label for="config-combat-pov" style="min-width: 100px;">Point of View:</label>
                                    <input type="text" id="config-combat-pov" class="text_pole" placeholder="narrator" value="${combatDefaults.pov || ''}" style="flex: 1;" />
                                </div>
                            </div>

                            <div class="rpg-narrative-config-section" style="margin-top: 24px; padding-top: 24px; border-top: 1px solid var(--rpg-border, rgba(255,255,255,0.1));">
                                <label class="label_text" style="margin-bottom: 16px; display: block; font-weight: 600;">
                                    <i class="fa-solid fa-scroll"></i> Combat Summary Style
                                </label>

                                <div class="rpg-setting-row" style="margin-bottom: 12px;">
                                    <label for="config-summary-tense" style="min-width: 100px;">Tense:</label>
                                    <select id="config-summary-tense" class="rpg-select" style="flex: 1;">
                                        <option value="present" ${summaryDefaults.tense === 'present' ? 'selected' : ''}>Present</option>
                                        <option value="past" ${summaryDefaults.tense === 'past' ? 'selected' : ''}>Past</option>
                                    </select>
                                </div>

                                <div class="rpg-setting-row" style="margin-bottom: 12px;">
                                    <label for="config-summary-person" style="min-width: 100px;">Person:</label>
                                    <select id="config-summary-person" class="rpg-select" style="flex: 1;">
                                        <option value="first" ${summaryDefaults.person === 'first' ? 'selected' : ''}>First Person</option>
                                        <option value="second" ${summaryDefaults.person === 'second' ? 'selected' : ''}>Second Person</option>
                                        <option value="third" ${summaryDefaults.person === 'third' ? 'selected' : ''}>Third Person</option>
                                    </select>
                                </div>

                                <div class="rpg-setting-row" style="margin-bottom: 12px;">
                                    <label for="config-summary-narration" style="min-width: 100px;">Narration:</label>
                                    <select id="config-summary-narration" class="rpg-select" style="flex: 1;">
                                        <option value="omniscient" ${summaryDefaults.narration === 'omniscient' ? 'selected' : ''}>Omniscient</option>
                                        <option value="limited" ${summaryDefaults.narration === 'limited' ? 'selected' : ''}>Limited</option>
                                    </select>
                                </div>

                                <div class="rpg-setting-row" style="margin-bottom: 12px;">
                                    <label for="config-summary-pov" style="min-width: 100px;">Point of View:</label>
                                    <input type="text" id="config-summary-pov" class="text_pole" placeholder="narrator" value="${summaryDefaults.pov || ''}" style="flex: 1;" />
                                </div>
                            </div>

                            <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid var(--rpg-border, rgba(255,255,255,0.1));">
                                <label class="checkbox_label" style="display: flex; align-items: center; gap: 8px;">
                                    <input type="checkbox" id="config-remember" ${extensionSettings.encounterSettings?.narrativeConfigured ? 'checked' : ''} style="margin: 0;" />
                                    <span style="color: var(--rpg-text, #eaeaea);">Remember these settings for future encounters</span>
                                </label>
                            </div>

                            <div style="margin-top: 24px; display: flex; gap: 12px; justify-content: flex-end;">
                                <button id="config-cancel" class="rpg-btn rpg-btn-secondary" style="padding: 12px 24px;">
                                    <i class="fa-solid fa-times"></i> Cancel
                                </button>
                                <button id="config-proceed" class="rpg-btn rpg-btn-primary" style="padding: 12px 24px;">
                                    <i class="fa-solid fa-play"></i> Proceed
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', configHTML);
            const configModal = document.getElementById('rpg-narrative-config-modal');

            // Show modal
            setTimeout(() => configModal.classList.add('is-open'), 10);

            // Handle proceed
            configModal.querySelector('#config-proceed').addEventListener('click', () => {
                // Get values
                const combatNarrative = {
                    tense: configModal.querySelector('#config-combat-tense').value,
                    person: configModal.querySelector('#config-combat-person').value,
                    narration: configModal.querySelector('#config-combat-narration').value,
                    pov: configModal.querySelector('#config-combat-pov').value.trim() || 'narrator'
                };

                const summaryNarrative = {
                    tense: configModal.querySelector('#config-summary-tense').value,
                    person: configModal.querySelector('#config-summary-person').value,
                    narration: configModal.querySelector('#config-summary-narration').value,
                    pov: configModal.querySelector('#config-summary-pov').value.trim() || 'narrator'
                };

                const remember = configModal.querySelector('#config-remember').checked;

                // Save to settings
                if (!extensionSettings.encounterSettings) {
                    extensionSettings.encounterSettings = {};
                }
                extensionSettings.encounterSettings.combatNarrative = combatNarrative;
                extensionSettings.encounterSettings.summaryNarrative = summaryNarrative;

                // Set narrativeConfigured based on checkbox state
                extensionSettings.encounterSettings.narrativeConfigured = remember;

                // Save settings
                saveSettings();

                // Clean up
                configModal.remove();
                resolve(true);
            });

            // Handle cancel
            configModal.querySelector('#config-cancel').addEventListener('click', () => {
                configModal.remove();
                resolve(false);
            });

            // Handle overlay click
            configModal.querySelector('.rpg-encounter-overlay').addEventListener('click', () => {
                configModal.remove();
                resolve(false);
            });
        });
    }

    /**
     * Creates the modal DOM structure
     */
    createModal() {
        const modalHTML = `
            <div id="rpg-encounter-modal" class="rpg-encounter-modal" data-theme="${extensionSettings.theme || 'default'}" data-environment="default" data-atmosphere="default">
                <div class="rpg-encounter-overlay"></div>
                <div class="rpg-encounter-container">
                    <div class="rpg-encounter-header">
                        <h2><i class="fa-solid fa-swords"></i> Combat Encounter</h2>
                        <div class="rpg-encounter-header-buttons">
                            <button id="rpg-encounter-conclude" class="rpg-encounter-conclude-btn" title="Conclude encounter early">
                                <i class="fa-solid fa-flag-checkered"></i> Conclude Encounter
                            </button>
                            <button id="rpg-encounter-close" class="rpg-encounter-close-btn" title="Close (ends combat)">
                                <i class="fa-solid fa-times"></i>
                            </button>
                        </div>
                    </div>
                    <div class="rpg-encounter-content">
                        <div id="rpg-encounter-loading" class="rpg-encounter-loading">
                            <i class="fa-solid fa-spinner fa-spin"></i>
                            <p>Initializing combat...</p>
                        </div>
                        <div id="rpg-encounter-main" class="rpg-encounter-main" style="display: none;">
                            <!-- Combat UI will be rendered here -->
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.modal = document.getElementById('rpg-encounter-modal');

        // Add event listeners
        this.modal.querySelector('#rpg-encounter-conclude').addEventListener('click', () => {
            if (confirm('Conclude this encounter early and generate a summary?')) {
                this.concludeEncounter();
            }
        });

        this.modal.querySelector('#rpg-encounter-close').addEventListener('click', () => {
            if (confirm('Are you sure you want to end this combat encounter?')) {
                this.close();
            }
        });

        // Close on overlay click
        this.modal.querySelector('.rpg-encounter-overlay').addEventListener('click', () => {
            if (confirm('Are you sure you want to end this combat encounter?')) {
                this.close();
            }
        });
    }

    /**
     * Renders the combat UI with party, enemies, and controls
     * @param {object} combatData - Combat data including party and enemies
     */
    renderCombatUI(combatData) {
        const mainContent = this.modal.querySelector('#rpg-encounter-main');
        const loadingContent = this.modal.querySelector('#rpg-encounter-loading');

        loadingContent.style.display = 'none';
        mainContent.style.display = 'block';

        const context = getContext();
        const userName = context.name1;

        let html = `
            <div class="rpg-encounter-battlefield">
                <!-- Environment -->
                <div class="rpg-encounter-environment">
                    <p><i class="fa-solid fa-mountain"></i> ${combatData.environment || 'Battle Arena'}</p>
                </div>

                <!-- Enemies Section -->
                <div class="rpg-encounter-section">
                    <h3><i class="fa-solid fa-skull"></i> Enemies</h3>
                    <div class="rpg-encounter-enemies">
                        ${this.renderEnemies(combatData.enemies)}
                    </div>
                </div>

                <!-- Party Section -->
                <div class="rpg-encounter-section">
                    <h3><i class="fa-solid fa-users"></i> Party</h3>
                    <div class="rpg-encounter-party">
                        ${this.renderParty(combatData.party)}
                    </div>
                </div>

                <!-- Combat Log -->
                <div class="rpg-encounter-log-section">
                    <h3><i class="fa-solid fa-scroll"></i> Combat Log</h3>
                    <div id="rpg-encounter-log" class="rpg-encounter-log">
                        <div class="rpg-encounter-log-entry">
                            <em>Combat begins!</em>
                        </div>
                    </div>
                </div>

                <!-- Player Controls -->
                ${this.renderPlayerControls(combatData.party)}
            </div>
        `;

        mainContent.innerHTML = html;

        // Add event listeners for controls
        this.attachControlListeners(combatData.party);
    }

    /**
     * Renders enemy cards
     * @param {Array} enemies - Array of enemy data
     * @returns {string} HTML for enemies
     */
    renderEnemies(enemies) {
        return enemies.map((enemy, index) => {
            const hpPercent = (enemy.hp / enemy.maxHp) * 100;
            const isDead = enemy.hp <= 0;

            return `
                <div class="rpg-encounter-card ${isDead ? 'rpg-encounter-dead' : ''}" data-enemy-index="${index}">
                    <div class="rpg-encounter-card-sprite">
                        ${enemy.sprite || '👹'}
                    </div>
                    <div class="rpg-encounter-card-info">
                        <h4>${enemy.name}</h4>
                        <div class="rpg-encounter-hp-bar">
                            <div class="rpg-encounter-hp-fill" style="width: ${hpPercent}%"></div>
                            <span class="rpg-encounter-hp-text">${enemy.hp}/${enemy.maxHp} HP</span>
                        </div>
                        ${enemy.statuses && enemy.statuses.length > 0 ? `
                            <div class="rpg-encounter-statuses">
                                ${enemy.statuses.map(status => `<span class="rpg-encounter-status" title="${status.name}">${status.emoji}</span>`).join('')}
                            </div>
                        ` : ''}
                        ${enemy.description ? `<p class="rpg-encounter-description">${enemy.description}</p>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Renders party member cards
     * @param {Array} party - Array of party member data
     * @returns {string} HTML for party
     */
    renderParty(party) {
        const context = getContext();

        return party.map((member, index) => {
            const hpPercent = (member.hp / member.maxHp) * 100;
            const isDead = member.hp <= 0;

            // Get avatar for party member
            let avatarUrl = '';
            if (member.isPlayer) {
                // Get user/persona avatar using user_avatar like userStats does
                if (user_avatar) {
                    avatarUrl = getSafeThumbnailUrl('persona', user_avatar);
                }
            } else {
                // Try to find character avatar by name
                avatarUrl = this.getPartyMemberAvatar(member.name);
            }

            // Fallback SVG if no avatar found
            const fallbackSvg = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2NjY2NjYyIgb3BhY2l0eT0iMC4zIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIiBmaWxsPSIjNjY2IiBmb250LXNpemU9IjQwIj4/PC90ZXh0Pjwvc3ZnPg==';

            return `
                <div class="rpg-encounter-card ${isDead ? 'rpg-encounter-dead' : ''}" data-party-index="${index}">
                    <div class="rpg-encounter-card-avatar">
                        <img src="${avatarUrl || fallbackSvg}" alt="${member.name}" onerror="this.src='${fallbackSvg}'">
                    </div>
                    <div class="rpg-encounter-card-info">
                        <h4>${member.name} ${member.isPlayer ? '(You)' : ''}</h4>
                        <div class="rpg-encounter-hp-bar">
                            <div class="rpg-encounter-hp-fill rpg-encounter-hp-party" style="width: ${hpPercent}%"></div>
                            <span class="rpg-encounter-hp-text">${member.hp}/${member.maxHp} HP</span>
                        </div>                        ${member.statuses && member.statuses.length > 0 ? `
                            <div class="rpg-encounter-statuses">
                                ${member.statuses.map(status => `<span class="rpg-encounter-status" title="${status.name}">${status.emoji}</span>`).join('')}
                            </div>
                        ` : ''}                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Gets avatar for a party member by name
     * @param {string} name - Party member name
     * @returns {string} Avatar URL or null
     */
    getPartyMemberAvatar(name) {
        // Try to get from NPC avatars first
        if (extensionSettings.npcAvatars && extensionSettings.npcAvatars[name]) {
            return extensionSettings.npcAvatars[name];
        }

        // Try to find character by name in loaded characters
        if (characters && Array.isArray(characters)) {
            const matchingChar = characters.find(char =>
                char && char.name && char.name.toLowerCase() === name.toLowerCase()
            );

            if (matchingChar && matchingChar.avatar) {
                return getSafeThumbnailUrl('avatar', matchingChar.avatar);
            }
        }

        // Check if it's the current character
        if (this_chid !== undefined && characters && characters[this_chid]) {
            const currentChar = characters[this_chid];
            if (currentChar.name && currentChar.name.toLowerCase() === name.toLowerCase()) {
                return getSafeThumbnailUrl('avatar', currentChar.avatar);
            }
        }

        // No avatar found
        return null;
    }

    /**
     * Shows target selection modal for attacks
     * @param {string} attackType - Type of attack (single-target, AoE, both)
     * @param {Object} combatStats - Current combat state
     * @returns {Promise<string|null>} Selected target name or null if cancelled
     */
    async showTargetSelection(attackType, combatStats) {
        return new Promise((resolve) => {
            const targetModal = document.createElement('div');
            targetModal.className = 'rpg-target-selection-overlay';

            let targetOptions = '';

            // Build target options based on attack type
            if (attackType === 'AoE') {
                targetOptions = `
                    <div class="rpg-target-option" data-target="all-enemies">
                        <div class="rpg-target-icon">💥</div>
                        <div class="rpg-target-name">All Enemies</div>
                        <div class="rpg-target-desc">Area of Effect</div>
                    </div>
                `;
            } else if (attackType === 'both') {
                targetOptions = `
                    <div class="rpg-target-option" data-target="all-enemies">
                        <div class="rpg-target-icon">💥</div>
                        <div class="rpg-target-name">All Enemies</div>
                        <div class="rpg-target-desc">Area of Effect</div>
                    </div>
                    <div class="rpg-target-divider">OR</div>
                `;
            }

            // Add individual targets (enemies and allies)
            if (attackType !== 'AoE') {
                // Add enemies
                combatStats.enemies.forEach((enemy, index) => {
                    if (enemy.hp > 0) {
                        targetOptions += `
                            <div class="rpg-target-option" data-target="${enemy.name}" data-target-type="enemy" data-target-index="${index}">
                                <div class="rpg-target-icon">${enemy.sprite || '👹'}</div>
                                <div class="rpg-target-name">${enemy.name}</div>
                                <div class="rpg-target-hp">${enemy.hp}/${enemy.maxHp} HP</div>
                            </div>
                        `;
                    }
                });

                // Add party members (for heals/buffs)
                combatStats.party.forEach((member, index) => {
                    if (member.hp > 0) {
                        const isPlayer = member.isPlayer ? ' (You)' : '';
                        // Get avatar for party member
                        let avatarIcon = '✨';
                        if (member.isPlayer && user_avatar) {
                            avatarIcon = `<img src="${getSafeThumbnailUrl('persona', user_avatar)}" alt="${member.name}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">`;
                        } else {
                            const avatarUrl = this.getPartyMemberAvatar(member.name);
                            if (avatarUrl) {
                                avatarIcon = `<img src="${avatarUrl}" alt="${member.name}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">`;
                            }
                        }
                        targetOptions += `
                            <div class="rpg-target-option rpg-target-ally" data-target="${member.name}" data-target-type="party" data-target-index="${index}">
                                <div class="rpg-target-icon">${avatarIcon}</div>
                                <div class="rpg-target-name">${member.name}${isPlayer}</div>
                                <div class="rpg-target-hp">${member.hp}/${member.maxHp} HP</div>
                            </div>
                        `;
                    }
                });
            }

            targetModal.innerHTML = `
                <div class="rpg-target-selection-modal">
                    <h3><i class="fa-solid fa-crosshairs"></i> Select Target</h3>
                    <div class="rpg-target-list">
                        ${targetOptions}
                    </div>
                    <button class="rpg-target-cancel">Cancel</button>
                </div>
            `;

            document.body.appendChild(targetModal);

            // Handle target selection
            targetModal.querySelectorAll('.rpg-target-option').forEach(option => {
                option.addEventListener('click', () => {
                    const target = option.dataset.target;
                    document.body.removeChild(targetModal);
                    resolve(target);
                });
            });

            // Handle cancel
            targetModal.querySelector('.rpg-target-cancel').addEventListener('click', () => {
                document.body.removeChild(targetModal);
                resolve(null);
            });

            // Handle overlay click
            targetModal.addEventListener('click', (e) => {
                if (e.target === targetModal) {
                    document.body.removeChild(targetModal);
                    resolve(null);
                }
            });
        });
    }

    /**
     * Renders player action controls
     * @param {Array} party - Party data
     * @returns {string} HTML for controls
     */
    renderPlayerControls(party) {
        const player = party.find(m => m.isPlayer);
        if (!player || player.hp <= 0) {
            return '<div class="rpg-encounter-controls"><p class="rpg-encounter-defeated">You have been defeated...</p></div>';
        }

        return `
            <div class="rpg-encounter-controls">
                <h3><i class="fa-solid fa-hand-fist"></i> Your Actions</h3>

                <div class="rpg-encounter-action-buttons">
                    <div class="rpg-encounter-button-group">
                        <h4>Attacks</h4>
                        ${player.attacks.map(attack => {
                            // Support both old string format and new object format
                            const attackName = typeof attack === 'string' ? attack : attack.name;
                            const attackType = typeof attack === 'string' ? 'single-target' : (attack.type || 'single-target');
                            const typeIcon = attackType === 'AoE' ? '💥' : attackType === 'both' ? '⚡' : '🎯';

                            return `
                            <button class="rpg-encounter-action-btn rpg-encounter-attack-btn"
                                    data-action="attack"
                                    data-value="${attackName}"
                                    data-attack-type="${attackType}"
                                    title="${attackType === 'AoE' ? 'Area of Effect' : attackType === 'both' ? 'Single or AoE' : 'Single Target'}">
                                <i class="fa-solid fa-sword"></i> ${attackName} ${typeIcon}
                            </button>
                            `;
                        }).join('')}
                    </div>

                    ${player.items && player.items.length > 0 ? `
                        <div class="rpg-encounter-button-group">
                            <h4>Items</h4>
                            ${player.items.map(item => `
                                <button class="rpg-encounter-action-btn rpg-encounter-item-btn" data-action="item" data-value="${item}">
                                    <i class="fa-solid fa-flask"></i> ${item}
                                </button>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>

                <div class="rpg-encounter-custom-action">
                    <h4>Custom Action</h4>
                    <div class="rpg-encounter-input-group">
                        <input type="text" id="rpg-encounter-custom-input" placeholder="Describe what you want to do..." />
                        <button id="rpg-encounter-custom-submit" class="rpg-encounter-submit-btn">
                            <i class="fa-solid fa-paper-plane"></i> Submit
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Attaches event listeners to control buttons
     * @param {Array} party - Party data for reference
     */
    attachControlListeners(party) {
        // Attack and item buttons
        this.modal.querySelectorAll('.rpg-encounter-action-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const actionType = e.currentTarget.dataset.action;
                const value = e.currentTarget.dataset.value;
                const attackType = e.currentTarget.dataset.attackType;
                const context = getContext();
                const userName = context.name1;

                let actionText = '';

                if (actionType === 'attack') {
                    // Show target selection for attacks
                    const target = await this.showTargetSelection(attackType, currentEncounter.combatStats);
                    if (!target) return; // User cancelled

                    if (target === 'all-enemies') {
                        actionText = `${userName} uses ${value} targeting all enemies!`;
                    } else {
                        actionText = `${userName} uses ${value} on ${target}!`;
                    }
                } else if (actionType === 'item') {
                    // Show target selection for items (default to single-target)
                    const target = await this.showTargetSelection('single-target', currentEncounter.combatStats);
                    if (!target) return; // User cancelled

                    actionText = `${userName} uses ${value} on ${target}!`;
                }

                await this.processCombatAction(actionText);
            });
        });

        // Custom action submit
        const customInput = this.modal.querySelector('#rpg-encounter-custom-input');
        const customSubmit = this.modal.querySelector('#rpg-encounter-custom-submit');

        const submitCustomAction = async () => {
            const action = customInput.value.trim();
            if (!action) return;

            await this.processCombatAction(action);
            customInput.value = '';
        };

        if (customSubmit) {
            customSubmit.addEventListener('click', submitCustomAction);
        }

        if (customInput) {
            customInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    submitCustomAction();
                }
            });
        }
    }

    /**
     * Processes a combat action
     * @param {string} action - The action description
     */
    async processCombatAction(action) {
        if (this.isProcessing) return;

        this.isProcessing = true;

        try {
            // Disable all buttons
            this.modal.querySelectorAll('.rpg-encounter-action-btn, #rpg-encounter-custom-submit').forEach(btn => {
                btn.disabled = true;
            });

            // Add action to log
            this.addToLog(`You: ${action}`, 'player-action');

            // Build and send combat action prompt
            const actionPrompt = await buildCombatActionPrompt(action, currentEncounter.combatStats);

            // Store request for potential regeneration
            this.lastRequest = { type: 'action', action, prompt: actionPrompt };

            const response = await generateRaw({
                prompt: actionPrompt,
                quietToLoud: false
            });

            if (!response) {
                this.showErrorWithRegenerate('No response received from AI. The model may be unavailable.');
                return;
            }

            // Parse response
            const result = parseEncounterJSON(response);

            if (!result || !result.combatStats) {
                this.showErrorWithRegenerate('Invalid JSON format detected. The AI returned malformed data.');
                return;
            }

            // Update encounter state
            updateCurrentEncounter({
                combatStats: result.combatStats
            });

            // Collect log entries in order: enemy actions, party actions, then narration
            const logEntries = [];

            // Add enemy actions first
            if (result.enemyActions) {
                result.enemyActions.forEach(enemyAction => {
                    logEntries.push({ message: `${enemyAction.enemyName}: ${enemyAction.action}`, type: 'enemy-action' });
                });
            }

            // Add party actions second
            if (result.partyActions) {
                result.partyActions.forEach(partyAction => {
                    logEntries.push({ message: `${partyAction.memberName}: ${partyAction.action}`, type: 'party-action' });
                });
            }

            // Add narrative last - split by newlines for line-by-line display
            if (result.narrative) {
                const narrativeLines = result.narrative.split('\n').filter(line => line.trim());
                narrativeLines.forEach(line => {
                    logEntries.push({ message: line, type: 'narrative' });
                });
            }

            // Display log entries sequentially with animation
            await this.addLogsSequentially(logEntries);

            // Add to encounter log for summary - include all actions
            let fullActionLog = action;
            if (result.enemyActions && result.enemyActions.length > 0) {
                result.enemyActions.forEach(enemyAction => {
                    fullActionLog += `\n${enemyAction.enemyName}: ${enemyAction.action}`;
                });
            }
            if (result.partyActions && result.partyActions.length > 0) {
                result.partyActions.forEach(partyAction => {
                    fullActionLog += `\n${partyAction.memberName}: ${partyAction.action}`;
                });
            }
            addEncounterLogEntry(fullActionLog, result.narrative || 'Action resolved');

            // Update UI
            this.updateCombatUI(result.combatStats);

            // Check if combat ended
            if (result.combatEnd) {
                await this.endCombat(result.result || 'unknown');
                return;
            }

            // Re-enable buttons
            this.modal.querySelectorAll('.rpg-encounter-action-btn, #rpg-encounter-custom-submit').forEach(btn => {
                btn.disabled = false;
            });

        } catch (error) {
            console.error('[RPG Companion] Error processing combat action:', error);
            this.showErrorWithRegenerate(`Error processing action: ${error.message}`);

            // Re-enable buttons
            this.modal.querySelectorAll('.rpg-encounter-action-btn, #rpg-encounter-custom-submit').forEach(btn => {
                btn.disabled = false;
            });
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Updates the combat UI with new stats
     * @param {object} combatStats - Updated combat statistics
     */
    updateCombatUI(combatStats) {
        // Update enemies
        combatStats.enemies.forEach((enemy, index) => {
            const card = this.modal.querySelector(`[data-enemy-index="${index}"]`);
            if (card) {
                const hpPercent = (enemy.hp / enemy.maxHp) * 100;
                const isDead = enemy.hp <= 0;

                if (isDead) {
                    card.classList.add('rpg-encounter-dead');
                }

                const hpBar = card.querySelector('.rpg-encounter-hp-fill');
                const hpText = card.querySelector('.rpg-encounter-hp-text');

                if (hpBar) hpBar.style.width = `${hpPercent}%`;
                if (hpText) hpText.textContent = `${enemy.hp}/${enemy.maxHp} HP`;
            }
        });

        // Update party
        combatStats.party.forEach((member, index) => {
            const card = this.modal.querySelector(`[data-party-index="${index}"]`);
            if (card) {
                const hpPercent = (member.hp / member.maxHp) * 100;
                const isDead = member.hp <= 0;

                if (isDead) {
                    card.classList.add('rpg-encounter-dead');
                }

                const hpBar = card.querySelector('.rpg-encounter-hp-fill');
                const hpText = card.querySelector('.rpg-encounter-hp-text');

                if (hpBar) hpBar.style.width = `${hpPercent}%`;
                if (hpText) hpText.textContent = `${member.hp}/${member.maxHp} HP`;
            }
        });

        // Re-render controls if player died
        const player = combatStats.party.find(m => m.isPlayer);
        if (player && player.hp <= 0) {
            const controlsContainer = this.modal.querySelector('.rpg-encounter-controls');
            if (controlsContainer) {
                controlsContainer.innerHTML = '<p class="rpg-encounter-defeated">You have been defeated...</p>';
            }
        }
    }

    /**
     * Adds multiple log entries sequentially with animation
     * @param {Array} entries - Array of {message, type} objects
     * @param {number} delay - Delay between entries in ms
     */
    async addLogsSequentially(entries, delay = 400) {
        for (const entry of entries) {
            this.addToLog(entry.message, entry.type);
            if (entries.indexOf(entry) < entries.length - 1) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    /**
     * Adds an entry to the combat log
     * @param {string} message - Log message
     * @param {string} type - Log entry type (for styling)
     */
    addToLog(message, type = '') {
        const logContainer = this.modal.querySelector('#rpg-encounter-log');
        if (!logContainer) return;

        const entry = document.createElement('div');
        entry.className = `rpg-encounter-log-entry ${type}`;
        entry.style.whiteSpace = 'pre-wrap';
        entry.textContent = message;

        logContainer.appendChild(entry);
        logContainer.scrollTop = logContainer.scrollHeight;
    }

    /**
     * Concludes the encounter early (user-initiated)
     */
    async concludeEncounter() {
        if (!currentEncounter.active) {
            console.warn('[RPG Companion] No active encounter to conclude');
            return;
        }

        // End combat with "interrupted" result
        await this.endCombat('interrupted');
    }

    /**
     * Ends the combat and generates summary
     * @param {string} result - Combat result ('victory', 'defeat', 'fled', 'interrupted')
     */
    async endCombat(result) {
        try {
            // Show combat over screen
            this.showCombatOverScreen(result);

            // Generate summary
            const summaryPrompt = await buildCombatSummaryPrompt(currentEncounter.encounterLog, result);

            const summaryResponse = await generateRaw({
                prompt: summaryPrompt,
                quietToLoud: false
            });

            if (summaryResponse) {
                // Extract summary (remove [FIGHT CONCLUDED] tag)
                const summary = summaryResponse.replace(/\[FIGHT CONCLUDED\]\s*/i, '').trim();

                // Determine which character should speak the summary
                const speakerName = this.getCombatNarrator();

                // Use /sendas command to safely add summary to chat
                // This handles group chats properly and won't delete chat history
                try {
                    await executeSlashCommandsOnChatInput(
                        `/sendas name="${speakerName}" ${summary}`,
                        { clearChatInput: false }
                    );

                    // console.log(`[RPG Companion] Added combat summary to chat as "${speakerName}"`);

                    // Update combat over screen
                    this.updateCombatOverScreen(true, speakerName);
                } catch (sendError) {
                    console.error('[RPG Companion] Error using /sendas command:', sendError);
                    // Fallback: try appending to last message
                    if (chat && chat.length > 0) {
                        const lastMessage = chat[chat.length - 1];
                        if (lastMessage) {
                            lastMessage.mes += '\n\n' + summary;
                            saveChatDebounced();
                        }
                    }
                    this.updateCombatOverScreen(true, 'chat');
                }

                // Save encounter log
                const context = getContext();
                if (context.chatId) {
                    saveEncounterLog(context.chatId, {
                        log: currentEncounter.encounterLog,
                        summary: summary,
                        result: result
                    });
                }
            } else {
                this.updateCombatOverScreen(false);
            }

        } catch (error) {
            console.error('[RPG Companion] Error ending combat:', error);
            this.updateCombatOverScreen(false);
        }
    }

    /**
     * Determines which character should narrate the combat summary
     * Priority: Narrator character > First active group member > Current character
     * @returns {string} Character name to use for /sendas
     */
    getCombatNarrator() {
        // Check if in group chat
        if (selected_group) {
            const group = groups.find(g => g.id === selected_group);
            const groupMembers = getGroupMembers(selected_group);

            if (groupMembers && groupMembers.length > 0) {
                const disabledMembers = group?.disabled_members || [];

                // First priority: Look for a character named "Narrator" or "GM"
                const narrator = groupMembers.find(member =>
                    member && member.name &&
                    !disabledMembers.includes(member.avatar) &&
                    (member.name.toLowerCase() === 'narrator' ||
                     member.name.toLowerCase() === 'gm' ||
                     member.name.toLowerCase() === 'game master')
                );

                if (narrator) {
                    return narrator.name;
                }

                // Second priority: First active (non-muted) group member
                const firstActive = groupMembers.find(member =>
                    member && member.name &&
                    !disabledMembers.includes(member.avatar)
                );

                if (firstActive) {
                    return firstActive.name;
                }
            }
        }

        // Fallback: Use current character
        if (this_chid !== undefined && characters && characters[this_chid]) {
            return characters[this_chid].name;
        }

        // Last resort: Generic narrator
        return 'Narrator';
    }

    /**
     * Shows the combat over screen
     * @param {string} result - Combat result ('victory', 'defeat', 'fled', 'interrupted')
     */
    showCombatOverScreen(result) {
        const mainContent = this.modal.querySelector('#rpg-encounter-main');
        if (!mainContent) return;

        const resultIcons = {
            victory: 'fa-trophy',
            defeat: 'fa-skull-crossbones',
            fled: 'fa-person-running',
            interrupted: 'fa-flag-checkered'
        };

        const resultColors = {
            victory: '#4caf50',
            defeat: '#e94560',
            fled: '#ff9800',
            interrupted: '#888'
        };

        const icon = resultIcons[result] || 'fa-flag-checkered';
        const color = resultColors[result] || '#888';

        mainContent.innerHTML = `
            <div class="rpg-encounter-over" style="text-align: center; padding: 40px 20px;">
                <i class="fa-solid ${icon}" style="font-size: 72px; color: ${color}; margin-bottom: 24px;"></i>
                <h2 style="font-size: 32px; margin-bottom: 16px; text-transform: uppercase;">${result}</h2>
                <p style="font-size: 18px; margin-bottom: 32px; opacity: 0.8;">Generating combat summary...</p>
                <div class="rpg-encounter-loading" style="display: flex; justify-content: center; align-items: center; gap: 12px;">
                    <i class="fa-solid fa-spinner fa-spin" style="font-size: 24px;"></i>
                    <span>Please wait...</span>
                </div>
            </div>
        `;
    }

    /**
     * Updates the combat over screen after summary is added
     * @param {boolean} success - Whether summary was added successfully
     * @param {string} speakerName - Name of character who narrated (optional)
     */
    updateCombatOverScreen(success, speakerName = '') {
        const mainContent = this.modal.querySelector('#rpg-encounter-main');
        if (!mainContent) return;

        const overScreen = mainContent.querySelector('.rpg-encounter-over');
        if (!overScreen) return;

        if (success) {
            overScreen.querySelector('p').textContent = speakerName
                ? `Combat summary has been added to the chat by ${speakerName}.`
                : 'Combat summary has been added to the chat.';
            overScreen.querySelector('.rpg-encounter-loading').innerHTML = `
                <button id="rpg-encounter-close-final" class="rpg-encounter-submit-btn" style="font-size: 18px; padding: 12px 24px;">
                    <i class="fa-solid fa-check"></i> Close Combat Window
                </button>
            `;

            // Add click handler for close button
            const closeBtn = overScreen.querySelector('#rpg-encounter-close-final');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    this.close();
                });
            }
        } else {
            overScreen.querySelector('p').textContent = 'Error generating combat summary.';
            overScreen.querySelector('.rpg-encounter-loading').innerHTML = `
                <p style="color: #e94560;">Failed to create summary. You can close this window.</p>
                <button id="rpg-encounter-close-final" class="rpg-encounter-submit-btn" style="font-size: 18px; padding: 12px 24px; margin-top: 16px;">
                    <i class="fa-solid fa-times"></i> Close Combat Window
                </button>
            `;

            // Add click handler for close button
            const closeBtn = overScreen.querySelector('#rpg-encounter-close-final');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    this.close();
                });
            }
        }
    }

    /**
     * Shows a loading state
     * @param {string} message - Loading message
     */
    showLoadingState(message) {
        const loadingContent = this.modal.querySelector('#rpg-encounter-loading');
        const mainContent = this.modal.querySelector('#rpg-encounter-main');

        if (loadingContent) {
            loadingContent.querySelector('p').textContent = message;
            loadingContent.style.display = 'flex';
        }

        if (mainContent) {
            mainContent.style.display = 'none';
        }
    }

    /**
     * Shows an error message
     * @param {string} message - Error message
     */
    showError(message) {
        const loadingContent = this.modal.querySelector('#rpg-encounter-loading');

        if (loadingContent) {
            loadingContent.innerHTML = `
                <i class="fa-solid fa-exclamation-triangle" style="color: #e94560; font-size: 48px;"></i>
                <p style="color: #e94560;">${message}</p>
            `;
        }
    }

    /**
     * Shows an error message with a regenerate button
     * @param {string} message - Error message to display
     */
    showErrorWithRegenerate(message) {
        const loadingContent = this.modal.querySelector('#rpg-encounter-loading');
        const combatContent = this.modal.querySelector('#rpg-encounter-content');

        // Hide combat content if visible
        if (combatContent) {
            combatContent.style.display = 'none';
        }

        // Show error in loading area
        if (loadingContent) {
            loadingContent.style.display = 'flex';
            loadingContent.innerHTML = `
                <div class="rpg-encounter-error-box">
                    <i class="fa-solid fa-exclamation-triangle" style="color: #e94560; font-size: 48px; margin-bottom: 1em;"></i>
                    <h3 style="color: #e94560; margin: 0 0 0.5em 0;">Wrong Format Detected</h3>
                    <p style="color: #ccc; margin: 0 0 1.5em 0; max-width: 500px;">${message}</p>
                    <div style="display: flex; gap: 1em;">
                        <button id="rpg-error-regenerate" class="rpg-btn rpg-btn-primary">
                            <i class="fa-solid fa-rotate-right"></i> Regenerate
                        </button>
                        <button id="rpg-error-close" class="rpg-btn rpg-btn-secondary">
                            <i class="fa-solid fa-times"></i> Close
                        </button>
                    </div>
                </div>
            `;

            // Add event listeners
            const regenerateBtn = loadingContent.querySelector('#rpg-error-regenerate');
            const closeBtn = loadingContent.querySelector('#rpg-error-close');

            if (regenerateBtn) {
                regenerateBtn.addEventListener('click', () => this.regenerateLastRequest());
            }

            if (closeBtn) {
                closeBtn.addEventListener('click', () => this.close());
            }
        }
    }

    /**
     * Regenerates the last failed request
     */
    async regenerateLastRequest() {
        if (!this.lastRequest) {
            console.warn('[RPG Companion] No request to regenerate');
            return;
        }

        // console.log('[RPG Companion] Regenerating request:', this.lastRequest.type);

        if (this.lastRequest.type === 'init') {
            // Retry initialization
            this.isInitializing = true;
            await this.initialize();
        } else if (this.lastRequest.type === 'action') {
            // Retry action
            this.isProcessing = true;
            await this.processCombatAction(this.lastRequest.action);
        }
    }

    /**
     * Shows an error message with a regenerate button
     * @param {string} message - Error message to display
     */
    showErrorWithRegenerate(message) {
        const loadingContent = this.modal.querySelector('#rpg-encounter-loading');
        const combatContent = this.modal.querySelector('#rpg-encounter-content');

        // Hide combat content if visible
        if (combatContent) {
            combatContent.style.display = 'none';
        }

        // Show error in loading area
        if (loadingContent) {
            loadingContent.style.display = 'flex';
            loadingContent.innerHTML = `
                <div class="rpg-encounter-error-box">
                    <i class="fa-solid fa-exclamation-triangle" style="color: #e94560; font-size: 48px; margin-bottom: 1em;"></i>
                    <h3 style="color: #e94560; margin: 0 0 0.5em 0;">Wrong Format Detected</h3>
                    <p style="color: #ccc; margin: 0 0 1.5em 0; max-width: 500px;">${message}</p>
                    <div style="display: flex; gap: 1em;">
                        <button id="rpg-error-regenerate" class="rpg-btn rpg-btn-primary">
                            <i class="fa-solid fa-rotate-right"></i> Regenerate
                        </button>
                        <button id="rpg-error-close" class="rpg-btn rpg-btn-secondary">
                            <i class="fa-solid fa-times"></i> Close
                        </button>
                    </div>
                </div>
            `;

            // Add event listeners
            const regenerateBtn = loadingContent.querySelector('#rpg-error-regenerate');
            const closeBtn = loadingContent.querySelector('#rpg-error-close');

            if (regenerateBtn) {
                regenerateBtn.addEventListener('click', () => this.regenerateLastRequest());
            }

            if (closeBtn) {
                closeBtn.addEventListener('click', () => this.close());
            }
        }
    }

    /**
     * Regenerates the last failed request
     */
    async regenerateLastRequest() {
        if (!this.lastRequest) {
            console.warn('[RPG Companion] No request to regenerate');
            return;
        }

        // console.log('[RPG Companion] Regenerating request:', this.lastRequest.type);

        if (this.lastRequest.type === 'init') {
            // Retry initialization
            this.isInitializing = true;
            await this.initialize();
        } else if (this.lastRequest.type === 'action') {
            // Retry action
            this.isProcessing = true;
            await this.processCombatAction(this.lastRequest.action);
        }
    }

    /**
     * Apply environment-based visual styling to the modal
     * @param {object} styleNotes - Style information from the AI
     */
    applyEnvironmentStyling(styleNotes) {
        if (!styleNotes || typeof styleNotes !== 'object') return;

        const { environmentType, atmosphere, timeOfDay, weather } = styleNotes;

        // Apply environment attribute
        if (environmentType) {
            this.modal.setAttribute('data-environment', environmentType.toLowerCase());
        }

        // Apply atmosphere attribute
        if (atmosphere) {
            this.modal.setAttribute('data-atmosphere', atmosphere.toLowerCase());
        }

        // Apply time attribute
        if (timeOfDay) {
            this.modal.setAttribute('data-time', timeOfDay.toLowerCase());
        }

        // Apply weather attribute
        if (weather) {
            this.modal.setAttribute('data-weather', weather.toLowerCase());
        }

        // console.log('[RPG Companion] Applied environment styling:', styleNotes);
    }

    /**
     * Closes the modal and resets encounter state
     */
    close() {
        if (this.modal) {
            this.modal.classList.remove('is-open');
            resetEncounter();
        }
    }
}

// Export singleton instance
export const encounterModal = new EncounterModal();

/**
 * Opens the encounter modal
 */
export function openEncounterModal() {
    encounterModal.open();
}
