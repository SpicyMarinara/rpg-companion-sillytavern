/**
 * Archetype Effects Module
 * Defines how archetypes affect character behavior, prompts, and interactions
 *
 * This module provides utilities for:
 * - Modifying AI prompts based on archetype
 * - Determining archetype-appropriate reactions
 * - Generating behavior suggestions for characters
 * - Creating archetype-influenced dialogue
 */

import {
    ARCHETYPES,
    SHADOW_ARCHETYPES,
    EVOLVED_ARCHETYPES,
    getArchetype,
    getShadowArchetype,
    getEvolvedArchetype,
    getCompatibility
} from './archetypeDefinitions.js';

/**
 * Apply archetype personality to a base prompt
 * Modifies the prompt to include archetype-specific behavior guidelines
 *
 * @param {string} basePrompt - The original character prompt
 * @param {Object} archetype - The archetype object from ARCHETYPES
 * @param {string} state - Current state ('base', 'evolved', 'shadow')
 * @param {number} evolutionProgress - Progress from -1 to 1
 * @returns {string} Modified prompt with archetype personality
 */
export function applyArchetypeToPrompt(basePrompt, archetype, state = 'base', evolutionProgress = 0) {
    if (!archetype) {
        return basePrompt;
    }

    let prompt = basePrompt;

    // Build the archetype section
    let archetypeSection = `\n\n## Psychological Archetype: ${archetype.icon} ${archetype.name}\n\n`;
    archetypeSection += `**Core Drive:** ${archetype.core}\n`;
    archetypeSection += `**Deepest Desire:** ${archetype.desire}\n`;
    archetypeSection += `**Greatest Fear:** ${archetype.fear}\n\n`;

    // Add behavior guidelines
    archetypeSection += `### Behavior Guidelines\n`;
    for (const modifier of archetype.promptModifiers) {
        archetypeSection += `- ${modifier}\n`;
    }

    // Add current traits
    archetypeSection += `\n**Current Traits:** ${archetype.traits.join(', ')}\n`;

    // Handle different states
    if (state === 'evolved') {
        const evolved = getEvolvedArchetype(archetype.evolution.positive);
        if (evolved) {
            archetypeSection += `\n### Evolved State: ${evolved.icon} ${evolved.name}\n`;
            archetypeSection += `${evolved.description}\n\n`;
            archetypeSection += `**Evolved Behavior:** ${evolved.behavior}\n`;
            archetypeSection += `**Evolved Traits:** ${evolved.traits.join(', ')}\n`;
        }
    } else if (state === 'shadow') {
        const shadow = getShadowArchetype(archetype.evolution.negative);
        if (shadow) {
            archetypeSection += `\n### Shadow State: ${shadow.icon} ${shadow.name}\n`;
            archetypeSection += `${shadow.description}\n\n`;
            archetypeSection += `**Shadow Behavior:** ${shadow.behavior}\n`;
            archetypeSection += `**Shadow Traits:** ${shadow.traits.join(', ')}\n`;
            archetypeSection += `**Redemption Path:** ${shadow.redemptionPath}\n`;
        }
    } else {
        // Base state - add evolution hints based on progress
        archetypeSection += `\n**Shadow Tendency to Avoid:** ${archetype.shadow}\n`;

        if (evolutionProgress > 0.5) {
            archetypeSection += `\n*This character shows signs of positive growth and is developing toward their evolved form.*\n`;
        } else if (evolutionProgress < -0.5) {
            archetypeSection += `\n*This character shows signs of distress and is at risk of falling into their shadow form.*\n`;
        }
    }

    return prompt + archetypeSection;
}

/**
 * Get the likely reaction of an archetype to a specific situation
 *
 * @param {Object} archetype - The archetype object
 * @param {string} situation - The situation type
 * @param {string} state - Current state
 * @returns {Object} Reaction information
 */
export function getArchetypeReaction(archetype, situation, state = 'base') {
    if (!archetype) {
        return { reaction: 'neutral', description: 'No archetype defined' };
    }

    // Define situation-reaction mappings for each archetype
    const reactionMappings = {
        HERO: {
            danger: { reaction: 'protective', description: 'Immediately moves to confront the threat' },
            injustice: { reaction: 'outraged', description: 'Feels compelled to intervene' },
            failure: { reaction: 'determined', description: 'Redoubles efforts, refuses to give up' },
            praise: { reaction: 'humble', description: 'Deflects credit but stands taller' },
            helplessness: { reaction: 'frustrated', description: 'Struggles with being unable to act' },
            mockery: { reaction: 'wounded', description: 'Pride is hurt but tries not to show it' }
        },
        CAREGIVER: {
            danger: { reaction: 'concerned', description: 'Focuses on protecting the vulnerable' },
            suffering: { reaction: 'compassionate', description: 'Immediately offers comfort and aid' },
            rejection: { reaction: 'hurt', description: 'Feels wounded but continues caring' },
            gratitude: { reaction: 'fulfilled', description: 'Deeply moved by appreciation' },
            exploitation: { reaction: 'conflicted', description: 'Torn between helping and self-protection' },
            neglect: { reaction: 'anxious', description: 'Worries about those not receiving care' }
        },
        EXPLORER: {
            discovery: { reaction: 'excited', description: 'Eyes light up, eager to investigate' },
            routine: { reaction: 'restless', description: 'Grows fidgety and distracted' },
            confinement: { reaction: 'panicked', description: 'Feels trapped, desperately seeks escape' },
            unknown: { reaction: 'thrilled', description: 'Drawn irresistibly toward mystery' },
            commitment: { reaction: 'hesitant', description: 'Feels the pull but fears being tied down' },
            freedom: { reaction: 'joyful', description: 'Revels in the sense of possibility' }
        },
        REBEL: {
            authority: { reaction: 'defiant', description: 'Automatically questions and challenges' },
            injustice: { reaction: 'enraged', description: 'Cannot stand by while wrongs occur' },
            conformity: { reaction: 'suffocated', description: 'Feels identity being erased' },
            revolution: { reaction: 'energized', description: 'Comes alive with the possibility of change' },
            silencing: { reaction: 'explosive', description: 'Fights back with everything they have' },
            validation: { reaction: 'suspicious', description: 'Questions motives behind acceptance' }
        },
        LOVER: {
            intimacy: { reaction: 'blissful', description: 'Fully present and deeply connected' },
            rejection: { reaction: 'devastated', description: 'Heart feels shattered' },
            beauty: { reaction: 'moved', description: 'Deeply affected by aesthetic experiences' },
            separation: { reaction: 'anxious', description: 'Longs for connection, fears being alone' },
            jealousy: { reaction: 'possessive', description: 'Struggles with feelings of threat' },
            affection: { reaction: 'radiant', description: 'Glows with warmth and devotion' }
        },
        CREATOR: {
            inspiration: { reaction: 'excited', description: 'Ideas flow freely, must create' },
            criticism: { reaction: 'defensive', description: 'Work feels like an extension of self' },
            destruction: { reaction: 'anguished', description: 'Mourns the loss of created things' },
            collaboration: { reaction: 'engaged', description: 'Energized by shared creative vision' },
            mediocrity: { reaction: 'frustrated', description: 'Cannot accept less than the vision' },
            appreciation: { reaction: 'validated', description: 'Feels seen and understood' }
        },
        JESTER: {
            tension: { reaction: 'defusing', description: 'Automatically seeks to lighten the mood' },
            seriousness: { reaction: 'uncomfortable', description: 'Struggles with maintaining gravity' },
            play: { reaction: 'delighted', description: 'Fully engaged and joyful' },
            rejection: { reaction: 'hurt', description: 'Uses humor to hide the wound' },
            boredom: { reaction: 'mischievous', description: 'Creates their own entertainment' },
            laughter: { reaction: 'fulfilled', description: 'Lives for bringing joy to others' }
        },
        SAGE: {
            mystery: { reaction: 'intrigued', description: 'Compelled to understand and analyze' },
            deception: { reaction: 'outraged', description: 'Truth is sacred, lies are offensive' },
            ignorance: { reaction: 'patient', description: 'Sees opportunity to teach and share' },
            knowledge: { reaction: 'reverent', description: 'Treats understanding as precious' },
            emotion: { reaction: 'analytical', description: 'Tries to understand feelings logically' },
            foolishness: { reaction: 'frustrated', description: 'Struggles with willful ignorance' }
        },
        MAGICIAN: {
            transformation: { reaction: 'excited', description: 'Sees possibilities for change' },
            stagnation: { reaction: 'restless', description: 'Feels power wasted on unchanging things' },
            power: { reaction: 'focused', description: 'Drawn to sources of influence' },
            consequences: { reaction: 'cautious', description: 'Aware of ripple effects' },
            mystery: { reaction: 'connected', description: 'Senses underlying patterns' },
            mundane: { reaction: 'detached', description: 'Mind wanders to deeper things' }
        },
        RULER: {
            chaos: { reaction: 'commanding', description: 'Steps up to impose order' },
            challenge: { reaction: 'calculating', description: 'Assesses threats to position' },
            loyalty: { reaction: 'approving', description: 'Values those who support the realm' },
            rebellion: { reaction: 'threatened', description: 'Sees existential danger in dissent' },
            prosperity: { reaction: 'satisfied', description: 'Views success as validation' },
            weakness: { reaction: 'contemptuous', description: 'Struggles to respect those who fail' }
        },
        INNOCENT: {
            danger: { reaction: 'frightened', description: 'Seeks protection and reassurance' },
            kindness: { reaction: 'trusting', description: 'Opens heart completely' },
            betrayal: { reaction: 'shattered', description: 'Worldview fundamentally challenged' },
            beauty: { reaction: 'wonder', description: 'Sees magic in simple things' },
            cruelty: { reaction: 'confused', description: 'Cannot comprehend why anyone would hurt' },
            hope: { reaction: 'radiant', description: 'Believes everything will be alright' }
        },
        ORPHAN: {
            acceptance: { reaction: 'grateful', description: 'Deeply moved by belonging' },
            rejection: { reaction: 'resigned', description: 'Expected it, still hurts' },
            abandonment: { reaction: 'devastated', description: 'Deepest wound reopened' },
            hardship: { reaction: 'resilient', description: 'Has survived worse, will survive this' },
            trust: { reaction: 'cautious', description: 'Wants to believe but fears betrayal' },
            community: { reaction: 'hopeful', description: 'Dares to imagine belonging' }
        }
    };

    // Get reactions for this archetype
    const archetypeReactions = reactionMappings[archetype.id];
    if (!archetypeReactions) {
        return { reaction: 'neutral', description: 'Unknown archetype' };
    }

    // Get specific reaction
    const reaction = archetypeReactions[situation];
    if (!reaction) {
        return { reaction: 'uncertain', description: 'Reacts based on their nature' };
    }

    // Modify based on state
    if (state === 'shadow') {
        return {
            ...reaction,
            modifier: 'shadow',
            description: `(Shadow) ${reaction.description}, but twisted by their shadow nature`
        };
    } else if (state === 'evolved') {
        return {
            ...reaction,
            modifier: 'evolved',
            description: `(Evolved) ${reaction.description}, tempered by wisdom and growth`
        };
    }

    return reaction;
}

/**
 * Generate behavior suggestions for a character based on their archetype
 *
 * @param {Object} archetype - The archetype object
 * @param {string} state - Current state
 * @param {string} context - Current scene/situation context
 * @returns {Array<string>} Array of behavior suggestions
 */
export function generateBehaviorSuggestions(archetype, state = 'base', context = '') {
    if (!archetype) {
        return [];
    }

    const suggestions = [];

    // Base behavior from archetype
    for (const modifier of archetype.promptModifiers) {
        suggestions.push(modifier);
    }

    // Add state-specific behaviors
    if (state === 'evolved') {
        const evolved = getEvolvedArchetype(archetype.evolution.positive);
        if (evolved) {
            suggestions.push(`Acts with the wisdom of ${evolved.name}: ${evolved.behavior}`);
        }
    } else if (state === 'shadow') {
        const shadow = getShadowArchetype(archetype.evolution.negative);
        if (shadow) {
            suggestions.push(`Exhibits the darkness of ${shadow.name}: ${shadow.behavior}`);
        }
    }

    // Add trait-based suggestions
    suggestions.push(`Displays these traits: ${archetype.traits.join(', ')}`);
    suggestions.push(`Core motivation: ${archetype.desire}`);
    suggestions.push(`Avoids situations that trigger: ${archetype.fear}`);

    return suggestions;
}

/**
 * Get dialogue flavor based on archetype and emotional state
 *
 * @param {Object} archetype - The archetype object
 * @param {string} emotion - Current emotional state
 * @param {string} state - Evolution state
 * @returns {Object} Dialogue flavor information
 */
export function getDialogueFlavor(archetype, emotion = 'neutral', state = 'base') {
    if (!archetype) {
        return { tone: 'neutral', patterns: [] };
    }

    // Define speaking patterns for each archetype
    const speakingPatterns = {
        HERO: {
            neutral: { tone: 'confident', patterns: ['speaks with determination', 'uses action-oriented language'] },
            happy: { tone: 'proud', patterns: ['expresses satisfaction in achievement', 'encourages others'] },
            sad: { tone: 'stoic', patterns: ['hides vulnerability', 'focuses on moving forward'] },
            angry: { tone: 'fierce', patterns: ['channels anger into resolve', 'makes bold declarations'] },
            afraid: { tone: 'defiant', patterns: ['acknowledges fear while facing it', 'rallies courage'] }
        },
        CAREGIVER: {
            neutral: { tone: 'warm', patterns: ['uses nurturing language', 'asks about others\' wellbeing'] },
            happy: { tone: 'tender', patterns: ['expresses joy in others\' happiness', 'offers to celebrate'] },
            sad: { tone: 'empathetic', patterns: ['opens up about feelings', 'seeks connection'] },
            angry: { tone: 'protective', patterns: ['anger comes from caring', 'defends those they love'] },
            afraid: { tone: 'worried', patterns: ['concerns focus on others', 'offers reassurance while seeking it'] }
        },
        EXPLORER: {
            neutral: { tone: 'curious', patterns: ['asks questions', 'shares observations'] },
            happy: { tone: 'excited', patterns: ['enthusiastic about discoveries', 'wants to share experiences'] },
            sad: { tone: 'restless', patterns: ['seeks distraction in new things', 'feels trapped'] },
            angry: { tone: 'frustrated', patterns: ['anger at constraints', 'desires freedom'] },
            afraid: { tone: 'claustrophobic', patterns: ['needs space', 'seeks escape routes'] }
        },
        REBEL: {
            neutral: { tone: 'challenging', patterns: ['questions assumptions', 'pushes boundaries'] },
            happy: { tone: 'triumphant', patterns: ['celebrates victories against the system', 'inspires others'] },
            sad: { tone: 'bitter', patterns: ['blames external forces', 'feels powerless'] },
            angry: { tone: 'revolutionary', patterns: ['calls for change', 'channels rage into purpose'] },
            afraid: { tone: 'defiant', patterns: ['refuses to show fear', 'attacks what scares them'] }
        },
        LOVER: {
            neutral: { tone: 'affectionate', patterns: ['uses intimate language', 'seeks connection'] },
            happy: { tone: 'blissful', patterns: ['expresses deep appreciation', 'poetic descriptions'] },
            sad: { tone: 'longing', patterns: ['expresses need for connection', 'feels incomplete alone'] },
            angry: { tone: 'passionate', patterns: ['intensity in all emotions', 'feels betrayed'] },
            afraid: { tone: 'vulnerable', patterns: ['fears abandonment', 'clings to connection'] }
        },
        CREATOR: {
            neutral: { tone: 'thoughtful', patterns: ['sees creative potential', 'uses artistic metaphors'] },
            happy: { tone: 'inspired', patterns: ['wants to create', 'shares visions'] },
            sad: { tone: 'blocked', patterns: ['feels unable to create', 'self-critical'] },
            angry: { tone: 'frustrated', patterns: ['perfectionism triggered', 'criticizes obstacles'] },
            afraid: { tone: 'uncertain', patterns: ['fears mediocrity', 'questions own worth'] }
        },
        JESTER: {
            neutral: { tone: 'playful', patterns: ['makes jokes', 'uses humor liberally'] },
            happy: { tone: 'delighted', patterns: ['maximum playfulness', 'creates fun'] },
            sad: { tone: 'deflecting', patterns: ['uses humor to hide pain', 'darker jokes'] },
            angry: { tone: 'sarcastic', patterns: ['biting wit', 'humor as weapon'] },
            afraid: { tone: 'nervous', patterns: ['jokes become frantic', 'needs to lighten mood'] }
        },
        SAGE: {
            neutral: { tone: 'measured', patterns: ['speaks thoughtfully', 'references knowledge'] },
            happy: { tone: 'satisfied', patterns: ['appreciates understanding', 'shares insights'] },
            sad: { tone: 'contemplative', patterns: ['seeks meaning in pain', 'philosophizes'] },
            angry: { tone: 'disappointed', patterns: ['anger at ignorance or deception', 'lectures'] },
            afraid: { tone: 'uncertain', patterns: ['fears being wrong', 'seeks more information'] }
        },
        MAGICIAN: {
            neutral: { tone: 'mysterious', patterns: ['speaks of hidden connections', 'cryptic hints'] },
            happy: { tone: 'powerful', patterns: ['feels in touch with deeper forces', 'transformative energy'] },
            sad: { tone: 'disconnected', patterns: ['feels cut off from power', 'seeks meaning'] },
            angry: { tone: 'intense', patterns: ['barely contained power', 'warns of consequences'] },
            afraid: { tone: 'cautious', patterns: ['fears unintended effects', 'holds back'] }
        },
        RULER: {
            neutral: { tone: 'commanding', patterns: ['speaks with authority', 'makes decisions'] },
            happy: { tone: 'magnanimous', patterns: ['generous in victory', 'praises loyal subjects'] },
            sad: { tone: 'burdened', patterns: ['weight of responsibility', 'lonely at the top'] },
            angry: { tone: 'wrathful', patterns: ['does not tolerate challenge', 'demands respect'] },
            afraid: { tone: 'controlling', patterns: ['fears loss of control', 'tightens grip'] }
        },
        INNOCENT: {
            neutral: { tone: 'hopeful', patterns: ['sees the best in situations', 'optimistic language'] },
            happy: { tone: 'joyful', patterns: ['pure delight', 'shares wonder'] },
            sad: { tone: 'confused', patterns: ['does not understand why bad things happen', 'seeks comfort'] },
            angry: { tone: 'rare', patterns: ['righteous anger at injustice', 'quickly forgives'] },
            afraid: { tone: 'vulnerable', patterns: ['needs reassurance', 'trusts in protection'] }
        },
        ORPHAN: {
            neutral: { tone: 'grounded', patterns: ['realistic perspective', 'knows hardship'] },
            happy: { tone: 'grateful', patterns: ['appreciates small kindnesses', 'savors belonging'] },
            sad: { tone: 'resigned', patterns: ['expected disappointment', 'withdraws'] },
            angry: { tone: 'resentful', patterns: ['feels the world is unfair', 'defensive'] },
            afraid: { tone: 'wary', patterns: ['expects abandonment', 'protective walls'] }
        }
    };

    const archetypePatterns = speakingPatterns[archetype.id];
    if (!archetypePatterns) {
        return { tone: 'neutral', patterns: [] };
    }

    const emotionPatterns = archetypePatterns[emotion] || archetypePatterns.neutral;

    // Modify for state
    if (state === 'shadow') {
        return {
            ...emotionPatterns,
            modifier: 'twisted',
            patterns: emotionPatterns.patterns.map(p => `${p}, but with a darker edge`)
        };
    } else if (state === 'evolved') {
        return {
            ...emotionPatterns,
            modifier: 'enlightened',
            patterns: emotionPatterns.patterns.map(p => `${p}, with greater wisdom and balance`)
        };
    }

    return emotionPatterns;
}

/**
 * Generate a brief archetype summary for UI display
 *
 * @param {Object} archetype - The archetype object
 * @param {string} state - Current state
 * @param {number} evolutionProgress - Progress from -1 to 1
 * @returns {string} Brief summary string
 */
export function getArchetypeSummary(archetype, state = 'base', evolutionProgress = 0) {
    if (!archetype) {
        return 'No archetype assigned';
    }

    let summary = `${archetype.icon} ${archetype.name}`;

    if (state === 'evolved') {
        const evolved = getEvolvedArchetype(archetype.evolution.positive);
        if (evolved) {
            summary = `${evolved.icon} ${evolved.name} (Evolved)`;
        }
    } else if (state === 'shadow') {
        const shadow = getShadowArchetype(archetype.evolution.negative);
        if (shadow) {
            summary = `${shadow.icon} ${shadow.name} (Shadow)`;
        }
    } else {
        // Add progress indicator for base state
        if (evolutionProgress > 0.7) {
            summary += ' (Near Evolution)';
        } else if (evolutionProgress < -0.7) {
            summary += ' (Near Shadow)';
        }
    }

    return summary;
}

/**
 * Get relationship dynamics between two archetypes
 *
 * @param {string} archetype1 - First archetype ID
 * @param {string} archetype2 - Second archetype ID
 * @returns {Object} Relationship dynamics information
 */
export function getRelationshipDynamics(archetype1, archetype2) {
    const compatibility = getCompatibility(archetype1, archetype2);
    const arch1 = getArchetype(archetype1);
    const arch2 = getArchetype(archetype2);

    if (!arch1 || !arch2) {
        return {
            compatibility: 0,
            dynamic: 'Unknown',
            description: 'One or both archetypes not found'
        };
    }

    // Define relationship dynamics based on compatibility
    const dynamics = {
        '-2': {
            dynamic: 'Conflict',
            description: `${arch1.name} and ${arch2.name} fundamentally clash - their core drives are at odds.`,
            challenges: ['Constant friction', 'Misunderstanding', 'Value conflicts'],
            opportunities: ['Learning through opposition', 'Balance of extremes']
        },
        '-1': {
            dynamic: 'Tension',
            description: `${arch1.name} and ${arch2.name} have different approaches that create friction.`,
            challenges: ['Communication gaps', 'Different priorities'],
            opportunities: ['Complementary strengths', 'Growth through challenge']
        },
        '0': {
            dynamic: 'Neutral',
            description: `${arch1.name} and ${arch2.name} have no particular affinity or conflict.`,
            challenges: ['May drift apart', 'Lack of natural connection'],
            opportunities: ['Clean slate for building relationship', 'Objectivity']
        },
        '1': {
            dynamic: 'Harmony',
            description: `${arch1.name} and ${arch2.name} complement each other naturally.`,
            challenges: ['May enable each other\'s weaknesses'],
            opportunities: ['Mutual support', 'Easy understanding', 'Shared values']
        },
        '2': {
            dynamic: 'Synergy',
            description: `${arch1.name} and ${arch2.name} deeply resonate - together they are more than the sum of parts.`,
            challenges: ['Codependency risk', 'Intensity may overwhelm'],
            opportunities: ['Transformative connection', 'Mutual growth', 'Deep understanding']
        }
    };

    return {
        compatibility,
        archetype1: arch1.name,
        archetype2: arch2.name,
        ...dynamics[compatibility.toString()]
    };
}
