/**
 * Present Characters Widget
 *
 * Displays character cards for all characters present in the scene.
 * Shows:
 * - Character avatars (matched via fuzzy name matching)
 * - Character emoji and name
 * - Traits (status, demeanor)
 * - Relationship badges (Enemy/Neutral/Friend/Lover)
 *
 * All fields are editable and sync back to character thoughts data.
 */

/**
 * Fuzzy name matching for character avatars
 * Handles exact matches, parenthetical additions, and titles
 */
function namesMatch(cardName, aiName) {
    if (!cardName || !aiName) return false;

    // Exact match
    if (cardName.toLowerCase() === aiName.toLowerCase()) return true;

    // Strip parentheses and match
    const stripParens = (s) => s.replace(/\s*\([^)]*\)/g, '').trim();
    const cardCore = stripParens(cardName).toLowerCase();
    const aiCore = stripParens(aiName).toLowerCase();
    if (cardCore === aiCore) return true;

    // Check if card name appears as complete word in AI name
    const escapedCardCore = cardCore.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const wordBoundary = new RegExp(`\\b${escapedCardCore}\\b`);
    return wordBoundary.test(aiCore);
}

/**
 * Parse character thoughts data
 * Format: [Emoji]: [Name, Traits] | [Relationship] | [Thoughts]
 * Or: [Emoji]: [Name, Traits] | [Demeanor] | [Relationship] | [Thoughts]
 */
function parseCharacterThoughts(thoughtsText) {
    if (!thoughtsText) return [];

    const lines = thoughtsText.split('\n');
    const presentCharacters = [];

    for (const line of lines) {
        // Skip empty lines, headers, dividers
        if (!line.trim() ||
            line.includes('Present Characters') ||
            line.includes('---') ||
            line.trim().startsWith('```')) {
            continue;
        }

        const parts = line.split('|').map(p => p.trim());

        // Require at least 3 parts: Emoji:Name | Relationship | Thoughts
        if (parts.length >= 3) {
            const firstPart = parts[0].trim();
            const emojiMatch = firstPart.match(/^(.+?):\s*(.+)$/);

            if (emojiMatch) {
                const emoji = emojiMatch[1].trim();
                const info = emojiMatch[2].trim();

                let relationship, thoughts, traits;

                if (parts.length === 3) {
                    // 3-part format
                    relationship = parts[1].trim();
                    thoughts = parts[2].trim();
                    const infoParts = info.split(',').map(p => p.trim());
                    traits = infoParts.slice(1).join(', ');
                } else {
                    // 4-part format (includes demeanor)
                    const demeanor = parts[1].trim();
                    relationship = parts[2].trim();
                    thoughts = parts[3].trim();
                    const infoParts = info.split(',').map(p => p.trim());
                    const baseTraits = infoParts.slice(1).join(', ');
                    traits = baseTraits ? `${baseTraits}, ${demeanor}` : demeanor;
                }

                // Parse name (first part before comma)
                const infoParts = info.split(',').map(p => p.trim());
                const name = infoParts[0] || '';

                if (name && name.toLowerCase() !== 'unavailable') {
                    presentCharacters.push({ emoji, name, traits, relationship, thoughts });
                }
            }
        }
    }

    return presentCharacters;
}

/**
 * Find character avatar
 */
function findCharacterAvatar(charName, dependencies) {
    const { getCharacters, getGroupMembers, getCurrentCharId, getFallbackAvatar, getAvatarUrl } = dependencies;

    let avatarUrl = getFallbackAvatar();

    // Try group members first if in group chat
    const groupMembers = getGroupMembers();
    if (groupMembers && groupMembers.length > 0) {
        const matchingMember = groupMembers.find(member =>
            member && member.name && namesMatch(member.name, charName)
        );
        if (matchingMember && matchingMember.avatar && matchingMember.avatar !== 'none') {
            const url = getAvatarUrl('avatar', matchingMember.avatar);
            if (url) avatarUrl = url;
        }
    }

    // Try all characters
    if (avatarUrl === getFallbackAvatar()) {
        const characters = getCharacters();
        if (characters && characters.length > 0) {
            const matchingChar = characters.find(c =>
                c && c.name && namesMatch(c.name, charName)
            );
            if (matchingChar && matchingChar.avatar && matchingChar.avatar !== 'none') {
                const url = getAvatarUrl('avatar', matchingChar.avatar);
                if (url) avatarUrl = url;
            }
        }
    }

    // Try current character in 1-on-1 chat
    if (avatarUrl === getFallbackAvatar()) {
        const currentCharId = getCurrentCharId();
        const characters = getCharacters();
        if (currentCharId !== undefined && characters[currentCharId]) {
            const currentChar = characters[currentCharId];
            if (currentChar.name && namesMatch(currentChar.name, charName)) {
                const url = getAvatarUrl('avatar', currentChar.avatar);
                if (url) avatarUrl = url;
            }
        }
    }

    return avatarUrl;
}

/**
 * Update character field in shared data
 */
function updateCharacterThoughtsField(dependencies, characterName, field, value) {
    const { getCharacterThoughts, setCharacterThoughts, onDataChange } = dependencies;
    let thoughtsText = getCharacterThoughts() || '';

    const lines = thoughtsText.split('\n');
    let updated = false;

    const updatedLines = lines.map(line => {
        // Find the line for this character
        if (line.includes(characterName)) {
            const parts = line.split('|').map(p => p.trim());
            if (parts.length >= 3) {
                const firstPart = parts[0].trim();
                const emojiMatch = firstPart.match(/^(.+?):\s*(.+)$/);

                if (emojiMatch) {
                    let emoji = emojiMatch[1].trim();
                    const info = emojiMatch[2].trim();
                    const infoParts = info.split(',').map(p => p.trim());
                    let name = infoParts[0];
                    let traits = infoParts.slice(1).join(', ');

                    let relationship, thoughts;
                    if (parts.length === 3) {
                        relationship = parts[1].trim();
                        thoughts = parts[2].trim();
                    } else {
                        // 4-part format
                        relationship = parts[2].trim();
                        thoughts = parts[3].trim();
                    }

                    // Update the specific field
                    if (field === 'emoji') emoji = value;
                    else if (field === 'name') name = value;
                    else if (field === 'traits') traits = value;
                    else if (field === 'relationship') {
                        // Convert emoji to text
                        const relationshipMap = {
                            '⚔️': 'Enemy',
                            '⚖️': 'Neutral',
                            '⭐': 'Friend',
                            '❤️': 'Lover'
                        };
                        relationship = relationshipMap[value] || value;
                    }

                    // Reconstruct line
                    const nameAndTraits = traits ? `${name}, ${traits}` : name;
                    updated = true;

                    if (parts.length === 3) {
                        return `${emoji}: ${nameAndTraits} | ${relationship} | ${thoughts}`;
                    } else {
                        return `${emoji}: ${nameAndTraits} | ${parts[1].trim()} | ${relationship} | ${thoughts}`;
                    }
                }
            }
        }
        return line;
    });

    if (updated) {
        const newThoughtsText = updatedLines.join('\n');
        setCharacterThoughts(newThoughtsText);
        if (onDataChange) {
            onDataChange('characterThoughts', field, value, characterName);
        }
    }
}

/**
 * Register Present Characters Widget
 */
export function registerPresentCharactersWidget(registry, dependencies) {
    const relationshipEmojis = {
        'Enemy': '⚔️',
        'Neutral': '⚖️',
        'Friend': '⭐',
        'Lover': '❤️'
    };

    registry.register('presentCharacters', {
        name: 'Present Characters',
        icon: '👥',
        description: 'Character cards with avatars, traits, and relationships',
        minSize: { w: 4, h: 3 },
        defaultSize: { w: 6, h: 4 },
        requiresSchema: false,

        render(container, config = {}) {
            const { getCharacterThoughts, getCharacters, getFallbackAvatar } = dependencies;

            const thoughtsText = getCharacterThoughts();
            const presentCharacters = parseCharacterThoughts(thoughtsText);

            let html = '<div class="rpg-thoughts-content">';

            if (presentCharacters.length === 0) {
                // Show placeholder
                const characters = getCharacters();
                const currentCharId = dependencies.getCurrentCharId();
                let defaultPortrait = getFallbackAvatar();
                let defaultName = 'Character';

                if (currentCharId !== undefined && characters[currentCharId]) {
                    defaultPortrait = findCharacterAvatar(characters[currentCharId].name, dependencies);
                    defaultName = characters[currentCharId].name || 'Character';
                }

                html += `
                    <div class="rpg-character-card" data-character-name="${defaultName}">
                        <div class="rpg-character-avatar">
                            <img src="${defaultPortrait}" alt="${defaultName}" onerror="this.style.opacity='0.5';this.onerror=null;" />
                            <div class="rpg-relationship-badge rpg-editable" contenteditable="true" data-character="${defaultName}" data-field="relationship" title="Click to edit (use emoji: ⚔️ ⚖️ ⭐ ❤️)">⚖️</div>
                        </div>
                        <div class="rpg-character-info">
                            <div class="rpg-character-header">
                                <span class="rpg-character-emoji rpg-editable" contenteditable="true" data-character="${defaultName}" data-field="emoji" title="Click to edit emoji">😊</span>
                                <span class="rpg-character-name rpg-editable" contenteditable="true" data-character="${defaultName}" data-field="name" title="Click to edit name">${defaultName}</span>
                            </div>
                            <div class="rpg-character-traits rpg-editable" contenteditable="true" data-character="${defaultName}" data-field="traits" title="Click to edit traits">Traits</div>
                        </div>
                    </div>
                `;
            } else {
                // Render character cards
                for (const char of presentCharacters) {
                    const characterPortrait = findCharacterAvatar(char.name, dependencies);
                    const relationshipEmoji = relationshipEmojis[char.relationship] || '⚖️';

                    html += `
                        <div class="rpg-character-card" data-character-name="${char.name}">
                            <div class="rpg-character-avatar">
                                <img src="${characterPortrait}" alt="${char.name}" onerror="this.style.opacity='0.5';this.onerror=null;" />
                                <div class="rpg-relationship-badge rpg-editable" contenteditable="true" data-character="${char.name}" data-field="relationship" title="Click to edit (use emoji: ⚔️ ⚖️ ⭐ ❤️)">${relationshipEmoji}</div>
                            </div>
                            <div class="rpg-character-info">
                                <div class="rpg-character-header">
                                    <span class="rpg-character-emoji rpg-editable" contenteditable="true" data-character="${char.name}" data-field="emoji" title="Click to edit emoji">${char.emoji}</span>
                                    <span class="rpg-character-name rpg-editable" contenteditable="true" data-character="${char.name}" data-field="name" title="Click to edit name">${char.name}</span>
                                </div>
                                <div class="rpg-character-traits rpg-editable" contenteditable="true" data-character="${char.name}" data-field="traits" title="Click to edit traits">${char.traits}</div>
                            </div>
                        </div>
                    `;
                }
            }

            html += '</div>';

            container.innerHTML = html;
            attachCharacterHandlers(container, dependencies);
        },

        getConfig() {
            return {
                showThoughtsInChat: {
                    type: 'boolean',
                    label: 'Show thought bubbles in chat',
                    default: false
                },
                cardLayout: {
                    type: 'select',
                    label: 'Card Layout',
                    default: 'grid',
                    options: [
                        { value: 'grid', label: 'Grid' },
                        { value: 'list', label: 'List' },
                        { value: 'compact', label: 'Compact' }
                    ]
                }
            };
        }
    });
}

/**
 * Attach character field edit handlers
 */
function attachCharacterHandlers(container, dependencies) {
    const editableFields = container.querySelectorAll('.rpg-editable');

    editableFields.forEach(field => {
        const characterName = field.dataset.character;
        const fieldName = field.dataset.field;
        let originalValue = field.textContent.trim();

        field.addEventListener('focus', () => {
            originalValue = field.textContent.trim();

            const range = document.createRange();
            range.selectNodeContents(field);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
        });

        field.addEventListener('blur', () => {
            const value = field.textContent.trim();
            if (value && value !== originalValue) {
                updateCharacterThoughtsField(dependencies, characterName, fieldName, value);
            }
        });

        field.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                field.blur();
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                field.textContent = originalValue;
                field.blur();
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
