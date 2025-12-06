/**
 * Markdown Format Converter
 * Token-efficient alternative to JSON for LLM communication
 * 
 * Format is designed to be:
 * - Human-readable
 * - Token-efficient (fewer characters than JSON)
 * - Easy to parse reliably
 * - Clear hierarchical structure with headers
 */

/**
 * Converts TrackerData JSON to markdown format
 * @param {Object} data - TrackerData object
 * @param {Object} config - Tracker configuration for context
 * @returns {string} Markdown-formatted tracker data
 */
export function jsonToMarkdown(data, config = {}) {
    if (!data || typeof data !== 'object') return '';
    
    const lines = [];
    
    // Stats section
    if (data.stats && Object.keys(data.stats).length > 0) {
        lines.push('# Stats');
        for (const [name, value] of Object.entries(data.stats)) {
            lines.push(`${name}: ${value}`);
        }
        lines.push('');
    }
    
    // Status section
    if (data.status) {
        const hasContent = data.status.mood || 
            (data.status.fields && Object.keys(data.status.fields).length > 0);
        if (hasContent) {
            lines.push('# Status');
            if (data.status.mood) {
                lines.push(`Mood: ${data.status.mood}`);
            }
            if (data.status.fields) {
                for (const [name, value] of Object.entries(data.status.fields)) {
                    lines.push(`${name}: ${value}`);
                }
            }
            lines.push('');
        }
    }
    
    // Attributes section
    if (data.attributes && Object.keys(data.attributes).length > 0) {
        lines.push('# Attributes');
        for (const [name, value] of Object.entries(data.attributes)) {
            lines.push(`${name}: ${value}`);
        }
        lines.push('');
    }
    
    // Level
    if (data.level !== undefined) {
        lines.push('# Level');
        lines.push(String(data.level));
        lines.push('');
    }
    
    // InfoBox section
    if (data.infoBox && Object.keys(data.infoBox).length > 0) {
        lines.push('# InfoBox');
        const fieldOrder = ['date', 'time', 'weather', 'temperature', 'location', 'recentEvents'];
        for (const field of fieldOrder) {
            if (data.infoBox[field] !== undefined) {
                const label = field.charAt(0).toUpperCase() + field.slice(1);
                const value = Array.isArray(data.infoBox[field]) 
                    ? data.infoBox[field].join('; ')
                    : data.infoBox[field];
                lines.push(`${label}: ${value}`);
            }
        }
        lines.push('');
    }
    
    // Characters section
    if (data.characters && data.characters.length > 0) {
        lines.push('# Characters');
        for (const char of data.characters) {
            lines.push(`## ${char.name || 'Unknown'}`);
            if (char.emoji) {
                lines.push(`Emoji: ${char.emoji}`);
            }
            if (char.relationship) {
                lines.push(`Relationship: ${char.relationship}`);
            }
            if (char.fields) {
                for (const [name, value] of Object.entries(char.fields)) {
                    lines.push(`${name}: ${value}`);
                }
            }
            // Character stats
            if (char.stats) {
                for (const [name, value] of Object.entries(char.stats)) {
                    lines.push(`${name}: ${value}`);
                }
            }
            if (char.thoughts) {
                lines.push(`Thoughts: ${char.thoughts}`);
            }
        }
        lines.push('');
    }
    
    // Inventory section
    if (data.inventory) {
        const inv = data.inventory;
        const hasInventory = (inv.onPerson && inv.onPerson.length > 0) ||
            (inv.stored && Object.keys(inv.stored).length > 0) ||
            (inv.assets && inv.assets.length > 0) ||
            (inv.simplified && inv.simplified.length > 0);
        
        if (hasInventory) {
            lines.push('# Inventory');
            
            // Simplified inventory (if present, use only this)
            if (inv.simplified && inv.simplified.length > 0) {
                lines.push('## Items');
                for (const item of inv.simplified) {
                    lines.push(formatInventoryItem(item));
                }
            } else {
                // Full inventory mode
                if (inv.onPerson && inv.onPerson.length > 0) {
                    lines.push('## On Person');
                    for (const item of inv.onPerson) {
                        lines.push(formatInventoryItem(item));
                    }
                }
                
                if (inv.stored && Object.keys(inv.stored).length > 0) {
                    for (const [location, items] of Object.entries(inv.stored)) {
                        if (items && items.length > 0) {
                            lines.push(`## Stored @ ${location}`);
                            for (const item of items) {
                                lines.push(formatInventoryItem(item));
                            }
                        }
                    }
                }
                
                if (inv.assets && inv.assets.length > 0) {
                    lines.push('## Assets');
                    for (const item of inv.assets) {
                        lines.push(formatInventoryItem(item));
                    }
                }
            }
            lines.push('');
        }
    }
    
    // Skills section
    if (data.skills && Object.keys(data.skills).length > 0) {
        lines.push('# Skills');
        for (const [category, skills] of Object.entries(data.skills)) {
            if (skills && skills.length > 0) {
                lines.push(`## ${category}`);
                for (const skill of skills) {
                    lines.push(formatSkillItem(skill));
                }
            }
        }
        lines.push('');
    }
    
    // Quests section
    if (data.quests) {
        const hasQuests = data.quests.main || 
            (data.quests.optional && data.quests.optional.length > 0);
        if (hasQuests) {
            lines.push('# Quests');
            if (data.quests.main) {
                lines.push('## Main');
                lines.push(formatQuestItem(data.quests.main));
            }
            if (data.quests.optional && data.quests.optional.length > 0) {
                lines.push('## Optional');
                for (const quest of data.quests.optional) {
                    lines.push(formatQuestItem(quest));
                }
            }
            lines.push('');
        }
    }
    
    return lines.join('\n').trim();
}

/**
 * Formats an inventory item for markdown
 * @param {Object|string} item - Item object or string
 * @returns {string} Formatted item line
 */
function formatInventoryItem(item) {
    if (typeof item === 'string') {
        return `- ${item}`;
    }
    let line = `- ${item.name || 'Unknown'}`;
    if (item.description) {
        line += `: ${item.description}`;
    }
    if (item.grantsSkill) {
        line += ` [grants: ${item.grantsSkill}]`;
    }
    return line;
}

/**
 * Formats a skill item for markdown
 * @param {Object|string} skill - Skill object or string
 * @returns {string} Formatted skill line
 */
function formatSkillItem(skill) {
    if (typeof skill === 'string') {
        return `- ${skill}`;
    }
    let line = `- ${skill.name || 'Unknown'}`;
    if (skill.description) {
        line += `: ${skill.description}`;
    }
    if (skill.grantedBy) {
        line += ` [from: ${skill.grantedBy}]`;
    }
    return line;
}

/**
 * Formats a quest item for markdown
 * @param {Object|string} quest - Quest object or string
 * @returns {string} Formatted quest line
 */
function formatQuestItem(quest) {
    if (typeof quest === 'string') {
        return quest;
    }
    let line = quest.name || 'Unknown Quest';
    if (quest.description) {
        line += `: ${quest.description}`;
    }
    return line;
}

/**
 * Parses markdown format back to TrackerData JSON
 * @param {string} markdown - Markdown-formatted tracker data
 * @returns {Object} TrackerData object
 */
export function markdownToJson(markdown) {
    if (!markdown || typeof markdown !== 'string') return {};
    
    const data = {};
    const lines = markdown.split('\n');
    
    let currentSection = null;
    let currentSubsection = null;
    let currentCharacter = null;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // Main section header (# Section)
        if (line.startsWith('# ')) {
            currentSection = line.substring(2).trim().toLowerCase();
            currentSubsection = null;
            currentCharacter = null;
            
            // Initialize section containers
            switch (currentSection) {
                case 'stats':
                    data.stats = {};
                    break;
                case 'status':
                    data.status = { fields: {} };
                    break;
                case 'attributes':
                    data.attributes = {};
                    break;
                case 'infobox':
                    data.infoBox = {};
                    break;
                case 'characters':
                    data.characters = [];
                    break;
                case 'inventory':
                    data.inventory = { onPerson: [], stored: {}, assets: [], items: [] };
                    break;
                case 'skills':
                    data.skills = {};
                    break;
                case 'quests':
                    data.quests = { main: null, optional: [] };
                    break;
            }
            continue;
        }
        
        // Subsection header (## Subsection)
        if (line.startsWith('## ')) {
            currentSubsection = line.substring(3).trim();
            
            // Handle character subsections
            if (currentSection === 'characters') {
                currentCharacter = { name: currentSubsection };
                data.characters.push(currentCharacter);
            }
            // Handle inventory stored locations
            else if (currentSection === 'inventory' && currentSubsection.toLowerCase().startsWith('stored @')) {
                const location = currentSubsection.substring(9).trim();
                currentSubsection = `stored:${location}`;
                if (!data.inventory.stored[location]) {
                    data.inventory.stored[location] = [];
                }
            }
            // Handle skill categories
            else if (currentSection === 'skills') {
                if (!data.skills[currentSubsection]) {
                    data.skills[currentSubsection] = [];
                }
            }
            continue;
        }
        
        // Parse content based on current section
        if (currentSection === 'level') {
            data.level = parseInt(line) || 1;
            continue;
        }
        
        // Key: value parsing
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0 && !line.startsWith('-')) {
            const key = line.substring(0, colonIndex).trim();
            const value = line.substring(colonIndex + 1).trim();
            
            switch (currentSection) {
                case 'stats':
                    data.stats[key] = parseFloat(value) || 0;
                    break;
                case 'status':
                    if (key.toLowerCase() === 'mood') {
                        data.status.mood = value;
                    } else {
                        data.status.fields[key] = value;
                    }
                    break;
                case 'attributes':
                    data.attributes[key] = parseFloat(value) || 0;
                    break;
                case 'infobox':
                    const infoKey = key.toLowerCase();
                    if (infoKey === 'recentevents') {
                        data.infoBox.recentEvents = value.split(';').map(s => s.trim()).filter(Boolean);
                    } else {
                        data.infoBox[infoKey] = value;
                    }
                    break;
                case 'characters':
                    if (currentCharacter) {
                        const keyLower = key.toLowerCase();
                        if (keyLower === 'relationship') {
                            currentCharacter.relationship = value;
                        } else if (keyLower === 'thoughts') {
                            currentCharacter.thoughts = value;
                        } else if (keyLower === 'emoji') {
                            currentCharacter.emoji = value;
                        } else {
                            // Check if it looks like a stat (numeric value)
                            const numValue = parseFloat(value);
                            if (!isNaN(numValue) && value.match(/^\d+(\.\d+)?$/)) {
                                if (!currentCharacter.stats) currentCharacter.stats = {};
                                currentCharacter.stats[key] = numValue;
                            } else {
                                if (!currentCharacter.fields) currentCharacter.fields = {};
                                currentCharacter.fields[key] = value;
                            }
                        }
                    }
                    break;
            }
            continue;
        }
        
        // List item parsing (- Item: Description [metadata])
        if (line.startsWith('-')) {
            const itemText = line.substring(1).trim();
            
            if (currentSection === 'inventory') {
                const itemLower = itemText.toLowerCase().trim();
                if (itemLower === 'null' || itemLower === 'none' || itemLower === '') {
                    continue;
                }
                const item = parseInventoryItem(itemText);
                if (!item.name || item.name.toLowerCase() === 'null' || item.name.toLowerCase() === 'none') {
                    continue;
                }
                
                const subsectionLower = (currentSubsection || '').toLowerCase().trim();
                
                if (subsectionLower === 'on person') {
                    data.inventory.onPerson.push(item);
                } else if (subsectionLower === 'assets') {
                    data.inventory.assets.push(item);
                } else if (currentSubsection && currentSubsection.startsWith('stored:')) {
                    const location = currentSubsection.substring(7);
                    data.inventory.stored[location].push(item);
                } else {
                    data.inventory.items.push(item);
                }
            } else if (currentSection === 'skills' && currentSubsection) {
                const itemLower = itemText.toLowerCase().trim();
                if (itemLower === 'null' || itemLower === 'none' || itemLower === '') {
                    continue;
                }
                const skill = parseSkillItem(itemText);
                if (skill.name && skill.name.toLowerCase() !== 'null' && skill.name.toLowerCase() !== 'none') {
                    data.skills[currentSubsection].push(skill);
                }
            }
            continue;
        }
        
        // Quest parsing (non-list items in quests section)
        if (currentSection === 'quests' && line) {
            const quest = parseQuestItem(line);
            const subsectionLower = (currentSubsection || '').toLowerCase();
            
            if (subsectionLower === 'main') {
                data.quests.main = quest;
            } else if (subsectionLower === 'optional') {
                data.quests.optional.push(quest);
            }
        }
    }
    
    return data;
}

/**
 * Parses an inventory item string
 * @param {string} text - Item text like "Iron Sword: A sturdy blade [grants: Swordsmanship]"
 * @returns {Object} Item object with name, description, and optionally grantsSkill
 */
function parseInventoryItem(text) {
    const item = {};
    
    // Check for [grants: skillName] metadata
    const grantsMatch = text.match(/\[grants:\s*([^\]]+)\]/i);
    if (grantsMatch) {
        item.grantsSkill = grantsMatch[1].trim();
        text = text.replace(grantsMatch[0], '').trim();
    }
    
    // Parse name: description
    const colonIndex = text.indexOf(':');
    if (colonIndex > 0) {
        item.name = text.substring(0, colonIndex).trim();
        item.description = text.substring(colonIndex + 1).trim();
    } else {
        item.name = text.trim();
    }
    
    return item;
}

/**
 * Parses a skill item string
 * @param {string} text - Skill text like "Fireball: Launches fire [from: Staff of Fire]"
 * @returns {Object} Skill object with name, description, and optionally grantedBy
 */
function parseSkillItem(text) {
    const skill = {};
    
    // Check for [from: itemName] metadata
    const fromMatch = text.match(/\[from:\s*([^\]]+)\]/i);
    if (fromMatch) {
        skill.grantedBy = fromMatch[1].trim();
        text = text.replace(fromMatch[0], '').trim();
    }
    
    // Parse name: description
    const colonIndex = text.indexOf(':');
    if (colonIndex > 0) {
        skill.name = text.substring(0, colonIndex).trim();
        skill.description = text.substring(colonIndex + 1).trim();
    } else {
        skill.name = text.trim();
    }
    
    return skill;
}

/**
 * Parses a quest item string
 * @param {string} text - Quest text like "Find the Artifact: Locate the ancient relic"
 * @returns {Object} Quest object with name and description
 */
function parseQuestItem(text) {
    const quest = {};
    
    const colonIndex = text.indexOf(':');
    if (colonIndex > 0) {
        quest.name = text.substring(0, colonIndex).trim();
        quest.description = text.substring(colonIndex + 1).trim();
    } else {
        quest.name = text.trim();
    }
    
    return quest;
}

/**
 * Generates markdown format example/schema for LLM instructions
 * @param {Object} trackerConfig - Tracker configuration
 * @param {Object} options - Options for which sections to include
 * @returns {string} Example markdown schema
 */
export function generateMarkdownSchema(trackerConfig, options = {}) {
    const {
        includeStats = true,
        includeAttributes = false,
        includeInfoBox = true,
        includeCharacters = true,
        includeInventory = true,
        includeSkills = true,
        includeQuests = true,
        enableItemSkillLinks = false,
        useSimplifiedInventory = false
    } = options;
    
    const lines = [];
    
    // Stats example
    if (includeStats && trackerConfig?.userStats?.customStats) {
        const enabledStats = trackerConfig.userStats.customStats.filter(s => s.enabled);
        if (enabledStats.length > 0) {
            lines.push('# Stats');
            for (const stat of enabledStats) {
                lines.push(`${stat.name}: [0-100]`);
            }
            lines.push('');
        }
        
        // Status
        if (trackerConfig.userStats.statusSection?.enabled) {
            lines.push('# Status');
            if (trackerConfig.userStats.statusSection.showMoodEmoji) {
                lines.push('Mood: [emoji]');
            }
            if (trackerConfig.userStats.statusSection.customFields?.length > 0) {
                for (const field of trackerConfig.userStats.statusSection.customFields) {
                    lines.push(`${field}: [${field} value]`);
                }
            }
            lines.push('');
        }
        
        // Simple skills within stats
        const skillsSectionEnabled = trackerConfig.userStats.skillsSection?.enabled || false;
        if (skillsSectionEnabled && !includeSkills) {
            const skillCategories = trackerConfig.userStats.skillsSection?.customFields || [];
            const enabledCategories = skillCategories.filter(cat => cat.enabled !== false);
            if (enabledCategories.length > 0) {
                lines.push('# Skills');
                for (const cat of enabledCategories) {
                    const catName = typeof cat === 'string' ? cat : cat?.name || cat;
                    lines.push(`${catName}: [skill], [skill]`);
                }
                lines.push('');
            }
        }
    }
    
    // Attributes example (only when attributes should be sent)
    if (includeAttributes && trackerConfig?.userStats?.rpgAttributes) {
        const enabledAttrs = trackerConfig.userStats.rpgAttributes.filter(a => a.enabled);
        if (enabledAttrs.length > 0) {
            lines.push('# Attributes');
            for (const attr of enabledAttrs) {
                lines.push(`${attr.name}: [number]`);
            }
            lines.push('');
            
            // Level goes with attributes
            lines.push('# Level');
            lines.push('[number]');
            lines.push('');
        }
    }
    
    // InfoBox example
    if (includeInfoBox && trackerConfig?.infoBox?.widgets) {
        const widgets = trackerConfig.infoBox.widgets;
        const hasWidgets = Object.values(widgets).some(w => w?.enabled);
        if (hasWidgets) {
            lines.push('# InfoBox');
            if (widgets.date?.enabled) lines.push('Date: [weekday, month day, year]');
            if (widgets.time?.enabled) lines.push('Time: [HH:MM → HH:MM]');
            if (widgets.weather?.enabled) lines.push('Weather: [emoji] [description]');
            if (widgets.temperature?.enabled) {
                const unit = widgets.temperature.unit === 'F' ? '°F' : '°C';
                lines.push(`Temperature: [number]${unit}`);
            }
            if (widgets.location?.enabled) lines.push('Location: [location name]');
            if (widgets.recentEvents?.enabled) lines.push('RecentEvents: [event]; [event]');
            lines.push('');
        }
    }
    
    // Characters example
    if (includeCharacters && trackerConfig?.presentCharacters) {
        const charConfig = trackerConfig.presentCharacters;
        lines.push('# Characters');
        lines.push('## [Character Name]');
        lines.push('Emoji: [emoji]');
        if (charConfig.relationshipFields?.length > 0) {
            const allowedRelationships = charConfig.relationshipFields.join(' | ');
            lines.push(`Relationship: (${allowedRelationships})`);
        }
        if (charConfig.customFields) {
            for (const field of charConfig.customFields) {
                if (field.enabled) {
                    lines.push(`${field.name}: [${field.description || field.name}]`);
                }
            }
        }
        // Character stats
        const charStatsConfig = charConfig.characterStats;
        const enabledCharStats = charStatsConfig?.enabled && charStatsConfig?.customStats?.filter(s => s?.enabled && s?.name) || [];
        if (enabledCharStats.length > 0) {
            for (const stat of enabledCharStats) {
                lines.push(`${stat.name}: [0-100]`);
            }
        }
        if (charConfig.thoughts?.enabled) {
            lines.push('Thoughts: [character\'s inner thoughts in first person]');
        }
        lines.push('');
    }
    
    // Inventory example
    if (includeInventory) {
        lines.push('# Inventory');
        
        const itemExample = enableItemSkillLinks 
            ? '- [item name]: [description] [grants: skill name]'
            : '- [item name]: [description]';
        
        if (useSimplifiedInventory) {
            // Simplified inventory - just a flat list
            lines.push(itemExample);
        } else {
            // Full inventory with categories
            lines.push('## On Person');
            lines.push(itemExample);
            lines.push('## Stored @ [Location Name]');
            lines.push('- [item name]: [description]');
            lines.push('## Assets');
            lines.push('- [property/vehicle]: [description]');
        }
        lines.push('');
    }
    
    // Skills example (separate skills panel)
    if (includeSkills && trackerConfig?.userStats?.skillsSection?.customFields?.length > 0) {
        const skillCategories = trackerConfig.userStats.skillsSection.customFields;
        const enabledCategories = skillCategories.filter(cat => cat.enabled !== false);
        
        if (enabledCategories.length > 0) {
            lines.push('# Skills');
            for (const category of enabledCategories) {
                const catName = typeof category === 'string' ? category : category?.name || category;
                lines.push(`## ${catName}`);
                if (enableItemSkillLinks) {
                    lines.push('- [ability name]: [what this ability does] [from: item name]');
                } else {
                    lines.push('- [ability name]: [what this ability does]');
                }
            }
            lines.push('');
        }
    }
    
    // Quests example
    if (includeQuests) {
        lines.push('# Quests');
        lines.push('## Main');
        lines.push('[quest title]: [primary objective]');
        lines.push('## Optional');
        lines.push('- [quest title]: [optional objective]');
        lines.push('');
    }
    
    return lines.join('\n').trim();
}

/**
 * Extracts markdown tracker block from LLM response
 * Looks for content between ```markdown or ```md fences, or raw markdown starting with # Stats
 * @param {string} response - Full LLM response
 * @returns {string|null} Extracted markdown content or null if not found
 */
export function extractMarkdownBlock(response) {
    if (!response) return null;
    
    // Try to find markdown code fence
    const mdFencePattern = /```(?:markdown|md)\s*([\s\S]*?)```/i;
    const mdMatch = response.match(mdFencePattern);
    if (mdMatch) {
        return mdMatch[1].trim();
    }
    
    // Try to find raw markdown starting with # Stats or # Status or similar
    const rawPattern = /^(# (?:Stats|Status|InfoBox|Characters|Inventory|Skills|Quests|Level|Attributes)[\s\S]*?)(?=\n\n[^#]|\n[^#\n-]|$)/m;
    const rawMatch = response.match(rawPattern);
    if (rawMatch) {
        // Find the extent of the markdown block
        let mdContent = rawMatch[1];
        
        // Continue parsing until we hit non-markdown content
        const lines = response.substring(response.indexOf(rawMatch[1])).split('\n');
        const mdLines = [];
        let inMarkdown = true;
        
        for (const line of lines) {
            if (inMarkdown) {
                // Check if this line is part of markdown format
                if (line.startsWith('#') || 
                    line.startsWith('-') || 
                    line.match(/^[A-Za-z]+:\s/) ||
                    line.trim() === '' ||
                    line.match(/^\d+$/)) {
                    mdLines.push(line);
                } else if (mdLines.length > 0 && line.trim() && !line.startsWith('#')) {
                    // Non-markdown content, stop
                    inMarkdown = false;
                }
            }
        }
        
        if (mdLines.length > 0) {
            return mdLines.join('\n').trim();
        }
    }
    
    return null;
}
