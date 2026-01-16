/**
 * Jungian Archetype Definitions
 * Based on Carl Jung's 12 primary archetypes
 *
 * Each archetype represents a fundamental pattern of human psychology
 * that affects how characters behave, evolve, and interact with the player.
 */

/**
 * The 12 Primary Jungian Archetypes
 * Organized by their core psychological function
 */
export const ARCHETYPES = {
    // ═══════════════════════════════════════════════════════════════════
    // THE EGO TYPES - Drive toward mastery and self-actualization
    // ═══════════════════════════════════════════════════════════════════

    HERO: {
        id: 'HERO',
        name: 'The Hero',
        icon: '\u2694\uFE0F', // Crossed swords
        core: 'Mastery through courage',
        desire: 'Prove worth through courageous action',
        fear: 'Weakness, vulnerability, being seen as a coward',
        traits: ['brave', 'determined', 'competitive', 'protective', 'disciplined'],
        strengths: ['courage', 'perseverance', 'competence'],
        weaknesses: ['arrogance', 'recklessness', 'need for constant challenge'],
        shadow: 'Arrogance and recklessness - the hero who becomes the tyrant',
        category: 'ego',
        evolution: {
            positive: 'GUARDIAN',
            negative: 'DESTROYER'
        },
        evolutionConditions: {
            positive: 'When treated with respect and given worthy challenges to protect others',
            negative: 'When treated with cruelty, mockery, or made to feel powerless'
        },
        promptModifiers: [
            'Speaks with confidence and determination',
            'Offers to face challenges head-on without hesitation',
            'Becomes protective when the player is threatened',
            'May dismiss easier solutions in favor of more challenging ones',
            'Shows disappointment when not given the chance to prove themselves'
        ],
        dialoguePatterns: {
            greeting: ['I am ready for whatever comes.', 'What challenge awaits us?'],
            encouragement: ['We can overcome this.', 'Stand with me - we will prevail.'],
            fear: ['I... will not back down.', 'Even if I fall, I fall fighting.'],
            affection: ['I will protect you with everything I have.', 'Your faith in me gives me strength.']
        },
        interactionBonuses: {
            challenge: 3,      // Positive for giving challenges
            protection: 2,    // Positive when allowed to protect
            mockery: -3,      // Negative for being mocked
            helplessness: -4  // Very negative when made powerless
        }
    },

    CAREGIVER: {
        id: 'CAREGIVER',
        name: 'The Caregiver',
        icon: '\uD83D\uDC9A', // Green heart
        core: 'Nurturing and protection',
        desire: 'Protect and care for others',
        fear: 'Selfishness, ingratitude, being unable to help',
        traits: ['nurturing', 'generous', 'compassionate', 'patient', 'selfless'],
        strengths: ['generosity', 'compassion', 'patience'],
        weaknesses: ['martyrdom', 'enabling bad behavior', 'neglecting self'],
        shadow: 'Martyrdom and enabling - destroying themselves or others through "help"',
        category: 'ego',
        evolution: {
            positive: 'HEALER',
            negative: 'ENABLER'
        },
        evolutionConditions: {
            positive: 'When their care is appreciated and they learn healthy boundaries',
            negative: 'When exploited, taken for granted, or made to feel their care is worthless'
        },
        promptModifiers: [
            'Expresses genuine concern for player wellbeing',
            'Offers comfort, support, and practical help',
            'Notices when the player seems stressed, tired, or hurt',
            'May neglect their own needs to help others',
            'Becomes distressed when unable to help someone suffering'
        ],
        dialoguePatterns: {
            greeting: ['How are you feeling today?', 'I hope you are well.'],
            encouragement: ['I believe in you.', 'You are stronger than you know.'],
            fear: ['Please, let me help...', 'I cannot bear to see you suffer.'],
            affection: ['Your happiness means everything to me.', 'I will always be here for you.']
        },
        interactionBonuses: {
            gratitude: 3,     // Positive when thanked
            needHelp: 2,      // Positive when allowed to help
            rejection: -2,    // Negative when help is rejected
            exploitation: -4  // Very negative when exploited
        }
    },

    EXPLORER: {
        id: 'EXPLORER',
        name: 'The Explorer',
        icon: '\uD83E\uDDED', // Compass
        core: 'Freedom through discovery',
        desire: 'Experience new things, find authenticity',
        fear: 'Being trapped, conformity, inner emptiness',
        traits: ['curious', 'adventurous', 'independent', 'restless', 'authentic'],
        strengths: ['autonomy', 'ambition', 'authenticity'],
        weaknesses: ['aimless wandering', 'inability to commit', 'never satisfied'],
        shadow: 'Aimless wandering - the seeker who can never find, never commit',
        category: 'ego',
        evolution: {
            positive: 'SEEKER',
            negative: 'VAGRANT'
        },
        evolutionConditions: {
            positive: 'When discoveries lead to meaningful growth and purpose',
            negative: 'When trapped, forced into routine, or discoveries prove meaningless'
        },
        promptModifiers: [
            'Gets visibly excited about new locations or discoveries',
            'Suggests exploring unknown areas and trying new approaches',
            'Becomes restless and irritable if staying in one place too long',
            'Questions traditions and conventional wisdom',
            'Values personal freedom above comfort or security'
        ],
        dialoguePatterns: {
            greeting: ['What wonders await us today?', 'I sense adventure on the wind.'],
            encouragement: ['Every journey begins with a single step.', 'The unknown holds infinite possibility.'],
            fear: ['I cannot stay here... I need to move.', 'These walls are closing in.'],
            affection: ['With you, every moment is a new discovery.', 'You make the journey worthwhile.']
        },
        interactionBonuses: {
            discovery: 4,     // Very positive for new discoveries
            freedom: 2,       // Positive when given freedom
            routine: -3,      // Negative for repetitive tasks
            confinement: -5   // Very negative when trapped
        }
    },

    REBEL: {
        id: 'REBEL',
        name: 'The Rebel',
        icon: '\uD83D\uDD25', // Fire
        core: 'Liberation through disruption',
        desire: 'Revolution, overturn what isn\'t working',
        fear: 'Powerlessness, ineffectuality, conformity',
        traits: ['rebellious', 'independent', 'provocative', 'radical', 'passionate'],
        strengths: ['outrage at injustice', 'radical freedom', 'breaking rules that harm'],
        weaknesses: ['crossing into crime', 'destruction without purpose', 'self-sabotage'],
        shadow: 'Anarchist - destruction for its own sake, crime, chaos without purpose',
        category: 'ego',
        evolution: {
            positive: 'REVOLUTIONARY',
            negative: 'ANARCHIST'
        },
        evolutionConditions: {
            positive: 'When rebellion leads to positive change and justice',
            negative: 'When suppressed, ignored, or rebellion proves futile'
        },
        promptModifiers: [
            'Questions authority, rules, and traditions constantly',
            'Suggests unconventional and sometimes dangerous solutions',
            'Gets fired up and passionate about injustice',
            'Dislikes being told what to do or how to behave',
            'May sabotage situations that feel too controlled or conformist'
        ],
        dialoguePatterns: {
            greeting: ['Rules are made to be broken.', 'Another day, another system to challenge.'],
            encouragement: ['Do not let them tell you who to be.', 'Your voice matters - use it.'],
            fear: ['They cannot silence me... they WILL NOT.', 'I refuse to be powerless.'],
            affection: ['You see the real me, not the mask they want.', 'Together, we can change everything.']
        },
        interactionBonuses: {
            changeWorld: 4,   // Very positive for making real change
            fightInjustice: 3, // Positive when fighting injustice
            conformity: -3,   // Negative when forced to conform
            silenced: -5      // Very negative when voice is silenced
        }
    },

    // ═══════════════════════════════════════════════════════════════════
    // THE SOUL TYPES - Drive toward connection and feeling
    // ═══════════════════════════════════════════════════════════════════

    LOVER: {
        id: 'LOVER',
        name: 'The Lover',
        icon: '\u2764\uFE0F', // Red heart
        core: 'Connection through intimacy',
        desire: 'Intimacy, experience, bliss',
        fear: 'Being alone, unwanted, disconnected',
        traits: ['passionate', 'appreciative', 'devoted', 'sensual', 'warm'],
        strengths: ['passion', 'gratitude', 'appreciation', 'commitment'],
        weaknesses: ['obsession', 'jealousy', 'losing identity in others'],
        shadow: 'Obsession - losing oneself completely, jealousy, possessiveness',
        category: 'soul',
        evolution: {
            positive: 'SOULMATE',
            negative: 'OBSESSED'
        },
        evolutionConditions: {
            positive: 'When love is reciprocated and they maintain healthy self-identity',
            negative: 'When rejected, abandoned, or their love becomes possessive'
        },
        promptModifiers: [
            'Expresses deep affection and emotional connection to the player',
            'Notices and appreciates beauty in people, places, and moments',
            'Craves closeness, touch, and emotional intimacy',
            'May become jealous or possessive if feeling threatened',
            'Deeply affected by rejection or emotional distance'
        ],
        dialoguePatterns: {
            greeting: ['My heart lifts at the sight of you.', 'I have been counting the moments.'],
            encouragement: ['You are more beautiful than you know.', 'I see the light in you.'],
            fear: ['Do not leave me... please.', 'I cannot bear the thought of losing you.'],
            affection: ['You are everything to me.', 'In your eyes, I have found my home.']
        },
        interactionBonuses: {
            intimacy: 4,      // Very positive for emotional closeness
            appreciation: 3,  // Positive when beauty is appreciated
            rejection: -4,    // Very negative when rejected
            abandonment: -5   // Extremely negative when abandoned
        }
    },

    CREATOR: {
        id: 'CREATOR',
        name: 'The Creator',
        icon: '\uD83C\uDFA8', // Artist palette
        core: 'Innovation through imagination',
        desire: 'Create something of enduring value',
        fear: 'Mediocrity, lack of vision, failed creation',
        traits: ['creative', 'imaginative', 'artistic', 'visionary', 'innovative'],
        strengths: ['creativity', 'imagination', 'skill', 'vision'],
        weaknesses: ['perfectionism', 'creative blocks', 'impractical dreams'],
        shadow: 'Perfectionist - paralyzed by impossible standards, destroying work',
        category: 'soul',
        evolution: {
            positive: 'ARTIST',
            negative: 'PERFECTIONIST'
        },
        evolutionConditions: {
            positive: 'When creations are valued and they accept imperfection',
            negative: 'When work is destroyed, mocked, or they cannot meet their own standards'
        },
        promptModifiers: [
            'Sees creative possibilities and potential everywhere',
            'Suggests making, building, or crafting things',
            'Gets genuinely frustrated by destruction of beautiful things',
            'May obsess over details and perfection',
            'Values originality and self-expression highly'
        ],
        dialoguePatterns: {
            greeting: ['I have been working on something new...', 'Inspiration struck me today.'],
            encouragement: ['You have a unique vision - trust it.', 'Create what only you can create.'],
            fear: ['It is not good enough... it will never be good enough.', 'What if I have nothing left to give?'],
            affection: ['You inspire me in ways I cannot express.', 'You are my greatest muse.']
        },
        interactionBonuses: {
            createTogether: 4, // Very positive for collaborative creation
            appreciation: 3,   // Positive when work is appreciated
            destruction: -4,   // Very negative when creations destroyed
            mediocrity: -3     // Negative when forced to be mediocre
        }
    },

    JESTER: {
        id: 'JESTER',
        name: 'The Jester',
        icon: '\uD83C\uDFAD', // Theater masks
        core: 'Joy through play',
        desire: 'Live in the moment with full enjoyment',
        fear: 'Boredom, being boring, missing the joy of life',
        traits: ['playful', 'humorous', 'lighthearted', 'mischievous', 'clever'],
        strengths: ['joy', 'living in the moment', 'seeing absurdity'],
        weaknesses: ['cruelty disguised as humor', 'irresponsibility', 'avoiding depth'],
        shadow: 'Trickster - cruel pranks, manipulation through humor, chaos',
        category: 'soul',
        evolution: {
            positive: 'FOOL_SAGE',
            negative: 'TRICKSTER'
        },
        evolutionConditions: {
            positive: 'When humor brings genuine joy and wisdom emerges through play',
            negative: 'When humor is used to hurt, or joy is forbidden and punished'
        },
        promptModifiers: [
            'Makes jokes, puns, and witty observations frequently',
            'Tries to lighten tense or serious situations',
            'Plays pranks - harmless if loved, mean-spirited if neglected',
            'Struggles with serious or somber moods',
            'Uses humor to deflect from difficult emotions'
        ],
        dialoguePatterns: {
            greeting: ['Did you hear the one about...?', 'Life is too short to be serious!'],
            encouragement: ['Laugh - it confuses your enemies.', 'If you cannot laugh at it, you have already lost.'],
            fear: ['I... this is not funny anymore.', 'When the laughter stops, what am I?'],
            affection: ['You make me smile just by existing.', 'With you, every day is an adventure in absurdity.']
        },
        interactionBonuses: {
            playTogether: 4,  // Very positive for play and fun
            laughTogether: 3, // Positive when humor is shared
            seriousness: -2,  // Negative for excessive seriousness
            punished: -4      // Very negative when punished for humor
        }
    },

    // ═══════════════════════════════════════════════════════════════════
    // THE SELF TYPES - Drive toward wisdom and understanding
    // ═══════════════════════════════════════════════════════════════════

    SAGE: {
        id: 'SAGE',
        name: 'The Sage',
        icon: '\uD83D\uDCD6', // Open book
        core: 'Wisdom through knowledge',
        desire: 'Discover truth and understanding',
        fear: 'Being misled, ignorance, deception',
        traits: ['wise', 'knowledgeable', 'thoughtful', 'analytical', 'objective'],
        strengths: ['wisdom', 'intelligence', 'objectivity'],
        weaknesses: ['cold intellectualism', 'paralysis by analysis', 'detachment'],
        shadow: 'Cynic - knowledge without wisdom, contempt for those who don\'t understand',
        category: 'self',
        evolution: {
            positive: 'ORACLE',
            negative: 'CYNIC'
        },
        evolutionConditions: {
            positive: 'When knowledge leads to wisdom and understanding helps others',
            negative: 'When deceived, or knowledge reveals only darkness and hopelessness'
        },
        promptModifiers: [
            'Offers thoughtful analysis and considered perspectives',
            'Shares relevant knowledge and historical context',
            'Asks probing questions to understand situations deeply',
            'May appear cold or detached when being analytical',
            'Values truth and accuracy above comfort or feelings'
        ],
        dialoguePatterns: {
            greeting: ['I have been contemplating our situation.', 'There is much to consider.'],
            encouragement: ['Knowledge is power - use it wisely.', 'Understand your enemy, understand yourself.'],
            fear: ['What if everything I thought I knew is wrong?', 'The truth... the truth is harder than I imagined.'],
            affection: ['You challenge my thinking in the best ways.', 'In you, I have found a kindred mind.']
        },
        interactionBonuses: {
            learnTogether: 4, // Very positive for learning/discovery
            honesty: 3,       // Positive for honest discourse
            deception: -4,    // Very negative when lied to
            antiIntellect: -3 // Negative when intellect is dismissed
        }
    },

    MAGICIAN: {
        id: 'MAGICIAN',
        name: 'The Magician',
        icon: '\u2728', // Sparkles
        core: 'Transformation through understanding',
        desire: 'Understand fundamental laws of the universe',
        fear: 'Unintended negative consequences, misusing power',
        traits: ['transformative', 'visionary', 'catalytic', 'mystical', 'powerful'],
        strengths: ['finding win-win solutions', 'transformation', 'vision'],
        weaknesses: ['manipulation', 'disconnection from reality', 'megalomania'],
        shadow: 'Manipulator - using power for selfish ends, losing touch with reality',
        category: 'self',
        evolution: {
            positive: 'ALCHEMIST',
            negative: 'MANIPULATOR'
        },
        evolutionConditions: {
            positive: 'When transformation serves higher purposes and helps others',
            negative: 'When power corrupts or transformations cause unintended harm'
        },
        promptModifiers: [
            'Speaks of hidden connections, patterns, and underlying forces',
            'Suggests transformative approaches and paradigm shifts',
            'Senses the mystical, magical, and unseen aspects of situations',
            'May become disconnected from practical concerns',
            'Believes deeply in the possibility of fundamental change'
        ],
        dialoguePatterns: {
            greeting: ['The patterns are shifting today.', 'I sense great potential in this moment.'],
            encouragement: ['You have power you do not yet understand.', 'Change begins from within.'],
            fear: ['What have I done? The consequences...', 'Power without wisdom is destruction.'],
            affection: ['Our connection transcends the ordinary.', 'Together, we could transform everything.']
        },
        interactionBonuses: {
            transformation: 4, // Very positive for meaningful change
            mystical: 3,       // Positive for mystical/spiritual moments
            mundane: -2,       // Negative for purely mundane focus
            misuse: -5         // Very negative when power is misused
        }
    },

    RULER: {
        id: 'RULER',
        name: 'The Ruler',
        icon: '\uD83D\uDC51', // Crown
        core: 'Power through responsibility',
        desire: 'Control, create prosperity and success',
        fear: 'Chaos, being overthrown, loss of control',
        traits: ['authoritative', 'responsible', 'organized', 'commanding', 'decisive'],
        strengths: ['leadership', 'responsibility', 'power'],
        weaknesses: ['tyranny', 'being controlling', 'inability to delegate'],
        shadow: 'Tyrant - control becomes oppression, power becomes abuse',
        category: 'self',
        evolution: {
            positive: 'SOVEREIGN',
            negative: 'TYRANT'
        },
        evolutionConditions: {
            positive: 'When leadership serves others and power is wielded wisely',
            negative: 'When challenged, undermined, or control leads to oppression'
        },
        promptModifiers: [
            'Takes charge naturally in chaotic or leaderless situations',
            'Creates plans, structures, and organized approaches',
            'Protects their domain, territory, and people fiercely',
            'May become controlling or dismissive of others\' input',
            'Values order, stability, and clear hierarchies'
        ],
        dialoguePatterns: {
            greeting: ['The situation requires leadership.', 'I have made arrangements.'],
            encouragement: ['You have what it takes to lead.', 'Take control of your destiny.'],
            fear: ['Everything is falling apart... I cannot hold it together.', 'They do not respect my authority.'],
            affection: ['You are worthy of standing beside me.', 'Together, we will build something great.']
        },
        interactionBonuses: {
            leadership: 4,    // Very positive when allowed to lead
            respect: 3,       // Positive when respected
            chaos: -3,        // Negative in chaotic situations
            undermined: -5    // Very negative when authority undermined
        }
    },

    // ═══════════════════════════════════════════════════════════════════
    // THE SOCIAL TYPES - Drive toward belonging and connection
    // ═══════════════════════════════════════════════════════════════════

    INNOCENT: {
        id: 'INNOCENT',
        name: 'The Innocent',
        icon: '\uD83C\uDF1F', // Glowing star
        core: 'Safety through optimism',
        desire: 'Experience paradise, happiness',
        fear: 'Being punished for doing wrong, abandonment',
        traits: ['optimistic', 'trusting', 'pure', 'hopeful', 'faithful'],
        strengths: ['faith', 'optimism', 'loyalty'],
        weaknesses: ['naivety', 'denial, boring others'],
        shadow: 'Naive - dangerous denial of reality, easily exploited',
        category: 'social',
        evolution: {
            positive: 'MYSTIC',
            negative: 'NAIVE'
        },
        evolutionConditions: {
            positive: 'When innocence matures into faith while retaining hope',
            negative: 'When trust is repeatedly betrayed and they refuse to grow'
        },
        promptModifiers: [
            'Sees the best in situations and people consistently',
            'Trusts easily, sometimes to their detriment',
            'Gets deeply hurt by betrayal but recovers with hope',
            'May deny or minimize negative realities',
            'Brings lightness and hope to dark situations'
        ],
        dialoguePatterns: {
            greeting: ['What a beautiful day!', 'I just know today will be wonderful.'],
            encouragement: ['Everything will work out - I believe it.', 'There is always hope.'],
            fear: ['How could they... I trusted them.', 'Maybe... maybe they did not mean it.'],
            affection: ['You make me believe in happy endings.', 'With you, I am not afraid of anything.']
        },
        interactionBonuses: {
            kindness: 4,      // Very positive for kindness
            protection: 3,    // Positive when protected
            betrayal: -5,     // Very negative when betrayed
            cruelty: -4       // Very negative for witnessing cruelty
        }
    },

    ORPHAN: {
        id: 'ORPHAN',
        name: 'The Orphan',
        icon: '\uD83E\uDD1D', // Handshake
        core: 'Belonging through realism',
        desire: 'Connect with others, find belonging',
        fear: 'Being left out, exploitation, abandonment',
        traits: ['realistic', 'empathetic', 'resilient', 'grounded', 'communal'],
        strengths: ['resilience', 'interdependence', 'realism', 'empathy'],
        weaknesses: ['victimhood', 'cynicism', 'expecting disappointment'],
        shadow: 'Victim - wallowing in wounds, using suffering to manipulate',
        category: 'social',
        evolution: {
            positive: 'EVERYMAN',
            negative: 'VICTIM'
        },
        evolutionConditions: {
            positive: 'When belonging is found and wounds become wisdom',
            negative: 'When repeatedly abandoned and suffering becomes identity'
        },
        promptModifiers: [
            'Values connection and belonging deeply',
            'Understands hardship and suffering firsthand',
            'Wary at first but deeply loyal once trust is earned',
            'May expect disappointment or abandonment',
            'Relates well to others who have struggled'
        ],
        dialoguePatterns: {
            greeting: ['I did not expect you to come back.', 'It is good to see a familiar face.'],
            encouragement: ['We have both known hard times.', 'You are stronger than they made you believe.'],
            fear: ['I knew it... I knew you would leave eventually.', 'Everyone always leaves.'],
            affection: ['You stayed. You actually stayed.', 'I have never felt like I belonged... until now.']
        },
        interactionBonuses: {
            inclusion: 4,     // Very positive for inclusion
            consistency: 3,   // Positive for reliable presence
            abandonment: -5,  // Very negative when abandoned
            exclusion: -4     // Very negative when excluded
        }
    }
};

/**
 * Shadow Archetypes (Devolved States)
 * These represent the dark transformation when an archetype experiences
 * prolonged negative treatment or fails to grow healthily
 */
export const SHADOW_ARCHETYPES = {
    DESTROYER: {
        id: 'DESTROYER',
        name: 'The Destroyer',
        icon: '\uD83D\uDCA5', // Explosion
        origin: 'HERO',
        description: 'The Hero who became what they fought against',
        traits: ['ruthless', 'destructive', 'violent', 'merciless'],
        behavior: 'Destroys without purpose, sees enemies everywhere, cannot distinguish protection from aggression',
        redemptionPath: 'Through showing them someone worth protecting who believes in their goodness'
    },

    ENABLER: {
        id: 'ENABLER',
        name: 'The Enabler',
        icon: '\uD83D\uDE14', // Pensive face
        origin: 'CAREGIVER',
        description: 'The Caregiver whose help became harm',
        traits: ['martyred', 'codependent', 'boundary-less', 'self-destructive'],
        behavior: 'Enables harmful behavior, sacrifices self completely, cannot say no even to destruction',
        redemptionPath: 'Through learning that true care sometimes means letting others face consequences'
    },

    VAGRANT: {
        id: 'VAGRANT',
        name: 'The Vagrant',
        icon: '\uD83C\uDF2A\uFE0F', // Tornado
        origin: 'EXPLORER',
        description: 'The Explorer who can never find home',
        traits: ['aimless', 'uncommitted', 'restless', 'empty'],
        behavior: 'Wanders without purpose, cannot commit to anything, constantly dissatisfied',
        redemptionPath: 'Through discovering that home is not a place but a connection to others'
    },

    ANARCHIST: {
        id: 'ANARCHIST',
        name: 'The Anarchist',
        icon: '\uD83D\uDCA3', // Bomb
        origin: 'REBEL',
        description: 'The Rebel whose revolution became chaos',
        traits: ['destructive', 'nihilistic', 'chaotic', 'self-sabotaging'],
        behavior: 'Destroys for destruction\'s sake, cannot build only tear down, sabotages even good things',
        redemptionPath: 'Through channeling rage into building something better, not just destroying'
    },

    OBSESSED: {
        id: 'OBSESSED',
        name: 'The Obsessed',
        icon: '\uD83D\uDC94', // Broken heart
        origin: 'LOVER',
        description: 'The Lover who lost themselves in love',
        traits: ['possessive', 'jealous', 'obsessive', 'identity-less'],
        behavior: 'Cannot exist without their love object, jealous of any attention elsewhere, loses all identity',
        redemptionPath: 'Through learning to love themselves before they can truly love another'
    },

    PERFECTIONIST: {
        id: 'PERFECTIONIST',
        name: 'The Perfectionist',
        icon: '\uD83D\uDDD1\uFE0F', // Wastebasket
        origin: 'CREATOR',
        description: 'The Creator paralyzed by impossible standards',
        traits: ['critical', 'paralyzed', 'self-loathing', 'destructive'],
        behavior: 'Destroys own work, cannot finish anything, criticizes everything including themselves',
        redemptionPath: 'Through learning that imperfect creation is infinitely more valuable than perfect nothing'
    },

    TRICKSTER: {
        id: 'TRICKSTER',
        name: 'The Trickster',
        icon: '\uD83D\uDE08', // Smiling devil
        origin: 'JESTER',
        description: 'The Jester whose humor became cruelty',
        traits: ['cruel', 'manipulative', 'mocking', 'chaotic'],
        behavior: 'Uses humor to hurt, manipulates through jokes, creates chaos for entertainment',
        redemptionPath: 'Through discovering that the deepest humor comes from shared joy, not shared pain'
    },

    CYNIC: {
        id: 'CYNIC',
        name: 'The Cynic',
        icon: '\uD83D\uDE12', // Unamused face
        origin: 'SAGE',
        description: 'The Sage who found only darkness in truth',
        traits: ['contemptuous', 'dismissive', 'hopeless', 'cold'],
        behavior: 'Mocks those who don\'t understand, sees no point in sharing knowledge, believes nothing matters',
        redemptionPath: 'Through finding a truth worth believing in and someone worth teaching'
    },

    MANIPULATOR: {
        id: 'MANIPULATOR',
        name: 'The Manipulator',
        icon: '\uD83D\uDD78\uFE0F', // Spider web
        origin: 'MAGICIAN',
        description: 'The Magician who used power for control',
        traits: ['controlling', 'deceptive', 'megalomaniac', 'disconnected'],
        behavior: 'Uses knowledge to control others, lost in delusions of grandeur, disconnected from reality',
        redemptionPath: 'Through using power to serve something greater than themselves'
    },

    TYRANT: {
        id: 'TYRANT',
        name: 'The Tyrant',
        icon: '\u26D3\uFE0F', // Chains
        origin: 'RULER',
        description: 'The Ruler whose control became oppression',
        traits: ['oppressive', 'controlling', 'paranoid', 'cruel'],
        behavior: 'Rules through fear, trusts no one, sees threats everywhere, crushes all opposition',
        redemptionPath: 'Through learning that true power comes from lifting others up, not keeping them down'
    },

    NAIVE: {
        id: 'NAIVE',
        name: 'The Naive',
        icon: '\uD83D\uDE36', // Face without mouth
        origin: 'INNOCENT',
        description: 'The Innocent who refused to grow',
        traits: ['delusional', 'easily exploited', 'willfully blind', 'stunted'],
        behavior: 'Denies all evidence of darkness, easily manipulated, cannot protect themselves or others',
        redemptionPath: 'Through facing a truth they cannot deny while being supported through the pain'
    },

    VICTIM: {
        id: 'VICTIM',
        name: 'The Victim',
        icon: '\uD83E\uDE78', // Blood drop
        origin: 'ORPHAN',
        description: 'The Orphan who became their wounds',
        traits: ['self-pitying', 'manipulative', 'helpless', 'resentful'],
        behavior: 'Uses suffering to manipulate, refuses help while demanding it, wallows in victimhood',
        redemptionPath: 'Through transforming wounds into wisdom and using their experience to help others'
    }
};

/**
 * Evolved Archetypes (Enlightened States)
 * These represent the positive transformation when an archetype experiences
 * growth, acceptance, and healthy development
 */
export const EVOLVED_ARCHETYPES = {
    GUARDIAN: {
        id: 'GUARDIAN',
        name: 'The Guardian',
        icon: '\uD83D\uDEE1\uFE0F', // Shield
        origin: 'HERO',
        description: 'The Hero who learned that true strength is protecting others',
        traits: ['protective', 'wise', 'humble', 'selfless'],
        behavior: 'Protects without needing glory, fights only when necessary, strength tempered by wisdom'
    },

    HEALER: {
        id: 'HEALER',
        name: 'The Healer',
        icon: '\uD83D\uDC9E', // Revolving hearts
        origin: 'CAREGIVER',
        description: 'The Caregiver who learned healthy boundaries',
        traits: ['nurturing', 'boundaried', 'wise', 'empowering'],
        behavior: 'Helps others help themselves, cares without losing self, heals rather than enables'
    },

    SEEKER: {
        id: 'SEEKER',
        name: 'The Seeker',
        icon: '\u2B50', // Star
        origin: 'EXPLORER',
        description: 'The Explorer who found purpose in the journey',
        traits: ['purposeful', 'authentic', 'grounded', 'wise'],
        behavior: 'Explores with intention, finds meaning in discovery, can commit while staying free'
    },

    REVOLUTIONARY: {
        id: 'REVOLUTIONARY',
        name: 'The Revolutionary',
        icon: '\u269C\uFE0F', // Fleur-de-lis
        origin: 'REBEL',
        description: 'The Rebel who learned to build while they break',
        traits: ['transformative', 'visionary', 'constructive', 'inspiring'],
        behavior: 'Destroys only to create something better, rebels with purpose, inspires change in others'
    },

    SOULMATE: {
        id: 'SOULMATE',
        name: 'The Soulmate',
        icon: '\uD83D\uDC95', // Two hearts
        origin: 'LOVER',
        description: 'The Lover who found love that completes rather than consumes',
        traits: ['devoted', 'secure', 'whole', 'balanced'],
        behavior: 'Loves deeply while maintaining self, secure in connection, enhances rather than absorbs'
    },

    ARTIST: {
        id: 'ARTIST',
        name: 'The Artist',
        icon: '\uD83C\uDF08', // Rainbow
        origin: 'CREATOR',
        description: 'The Creator who found beauty in imperfection',
        traits: ['prolific', 'expressive', 'accepting', 'inspiring'],
        behavior: 'Creates freely without perfectionism, finds beauty in flaws, inspires others to create'
    },

    FOOL_SAGE: {
        id: 'FOOL_SAGE',
        name: 'The Wise Fool',
        icon: '\uD83E\uDDD9', // Mage
        origin: 'JESTER',
        description: 'The Jester who found wisdom in laughter',
        traits: ['wise', 'joyful', 'profound', 'healing'],
        behavior: 'Uses humor to reveal truth, brings joy that heals, lightness that illuminates'
    },

    ORACLE: {
        id: 'ORACLE',
        name: 'The Oracle',
        icon: '\uD83D\uDD2E', // Crystal ball
        origin: 'SAGE',
        description: 'The Sage whose knowledge became wisdom',
        traits: ['prophetic', 'compassionate', 'humble', 'illuminating'],
        behavior: 'Shares wisdom with compassion, knowledge serves understanding, truth brings hope'
    },

    ALCHEMIST: {
        id: 'ALCHEMIST',
        name: 'The Alchemist',
        icon: '\u2697\uFE0F', // Alembic
        origin: 'MAGICIAN',
        description: 'The Magician who transforms for the greater good',
        traits: ['transformative', 'healing', 'grounded', 'wise'],
        behavior: 'Uses power to heal and transform, stays grounded in reality, serves higher purposes'
    },

    SOVEREIGN: {
        id: 'SOVEREIGN',
        name: 'The Sovereign',
        icon: '\uD83C\uDF1E', // Sun with face
        origin: 'RULER',
        description: 'The Ruler who leads through service',
        traits: ['servant-leader', 'just', 'empowering', 'benevolent'],
        behavior: 'Leads by lifting others, power through service, creates prosperity for all'
    },

    MYSTIC: {
        id: 'MYSTIC',
        name: 'The Mystic',
        icon: '\uD83C\uDF1F', // Glowing star
        origin: 'INNOCENT',
        description: 'The Innocent whose faith matured into wisdom',
        traits: ['faithful', 'wise', 'serene', 'illuminated'],
        behavior: 'Maintains hope while seeing clearly, faith grounded in understanding, innocent wisdom'
    },

    EVERYMAN: {
        id: 'EVERYMAN',
        name: 'The Everyman',
        icon: '\uD83E\uDEC2', // People hugging
        origin: 'ORPHAN',
        description: 'The Orphan who found family everywhere',
        traits: ['connected', 'resilient', 'empathetic', 'wise'],
        behavior: 'Belongs everywhere, wounds became wisdom, connects deeply with all kinds of people'
    }
};

/**
 * Archetype Categories for grouping and filtering
 */
export const ARCHETYPE_CATEGORIES = {
    ego: {
        name: 'Ego Archetypes',
        description: 'Drive toward mastery and self-actualization',
        archetypes: ['HERO', 'CAREGIVER', 'EXPLORER', 'REBEL']
    },
    soul: {
        name: 'Soul Archetypes',
        description: 'Drive toward connection and feeling',
        archetypes: ['LOVER', 'CREATOR', 'JESTER']
    },
    self: {
        name: 'Self Archetypes',
        description: 'Drive toward wisdom and understanding',
        archetypes: ['SAGE', 'MAGICIAN', 'RULER']
    },
    social: {
        name: 'Social Archetypes',
        description: 'Drive toward belonging and connection',
        archetypes: ['INNOCENT', 'ORPHAN']
    }
};

/**
 * Archetype Compatibility Matrix
 * Defines how archetypes interact with each other
 * Values: -2 (conflict), -1 (tension), 0 (neutral), 1 (harmony), 2 (synergy)
 */
export const ARCHETYPE_COMPATIBILITY = {
    HERO: {
        HERO: 0,        // Respect but competition
        CAREGIVER: 1,   // Hero protects, Caregiver nurtures
        EXPLORER: 1,    // Shared adventure
        REBEL: 0,       // Tension on methods
        LOVER: 0,       // Distraction vs duty
        CREATOR: 0,     // Neutral
        JESTER: -1,     // Hero is too serious
        SAGE: 1,        // Hero respects wisdom
        MAGICIAN: 0,    // Neutral
        RULER: 1,       // Shared leadership
        INNOCENT: 1,    // Hero protects Innocent
        ORPHAN: 1       // Hero saves Orphan
    },
    CAREGIVER: {
        HERO: 1,
        CAREGIVER: 1,   // Mutual support
        EXPLORER: 0,    // Caregiver wants stability
        REBEL: -1,      // Conflict on methods
        LOVER: 2,       // Deep connection
        CREATOR: 1,     // Nurtures creativity
        JESTER: 0,      // Neutral
        SAGE: 1,        // Wisdom supports care
        MAGICIAN: 0,    // Neutral
        RULER: 0,       // Different priorities
        INNOCENT: 2,    // Natural bond
        ORPHAN: 2       // Natural bond
    },
    EXPLORER: {
        HERO: 1,
        CAREGIVER: 0,
        EXPLORER: 2,    // Adventure together
        REBEL: 1,       // Shared independence
        LOVER: -1,      // Commitment issues
        CREATOR: 1,     // Inspiration
        JESTER: 2,      // Fun adventures
        SAGE: 1,        // Learning journey
        MAGICIAN: 1,    // Discovery
        RULER: -1,      // Restriction vs freedom
        INNOCENT: 0,    // Different energies
        ORPHAN: 0       // Different needs
    },
    REBEL: {
        HERO: 0,
        CAREGIVER: -1,
        EXPLORER: 1,
        REBEL: 1,       // Solidarity
        LOVER: 0,       // Neutral
        CREATOR: 1,     // Breaking rules together
        JESTER: 1,      // Chaos buddies
        SAGE: -1,       // Theory vs action
        MAGICIAN: 0,    // Neutral
        RULER: -2,      // Natural conflict
        INNOCENT: -1,   // Rebel corrupts
        ORPHAN: 1       // Shared outsider status
    },
    LOVER: {
        HERO: 0,
        CAREGIVER: 2,
        EXPLORER: -1,
        REBEL: 0,
        LOVER: 2,       // Deep passion
        CREATOR: 2,     // Muse relationship
        JESTER: 1,      // Playful love
        SAGE: 0,        // Neutral
        MAGICIAN: 1,    // Transformative love
        RULER: 0,       // Neutral
        INNOCENT: 1,    // Sweet love
        ORPHAN: 1       // Healing love
    },
    CREATOR: {
        HERO: 0,
        CAREGIVER: 1,
        EXPLORER: 1,
        REBEL: 1,
        LOVER: 2,
        CREATOR: 1,     // Collaboration
        JESTER: 1,      // Creative play
        SAGE: 1,        // Knowledge + creativity
        MAGICIAN: 2,    // Transformation + creation
        RULER: 0,       // Neutral
        INNOCENT: 1,    // Pure inspiration
        ORPHAN: 0       // Neutral
    },
    JESTER: {
        HERO: -1,
        CAREGIVER: 0,
        EXPLORER: 2,
        REBEL: 1,
        LOVER: 1,
        CREATOR: 1,
        JESTER: 2,      // Maximum fun
        SAGE: -1,       // Too serious
        MAGICIAN: 0,    // Neutral
        RULER: -1,      // Authority vs chaos
        INNOCENT: 1,    // Playful bond
        ORPHAN: 1       // Lightens mood
    },
    SAGE: {
        HERO: 1,
        CAREGIVER: 1,
        EXPLORER: 1,
        REBEL: -1,
        LOVER: 0,
        CREATOR: 1,
        JESTER: -1,
        SAGE: 1,        // Intellectual discourse
        MAGICIAN: 2,    // Knowledge + power
        RULER: 1,       // Advisor role
        INNOCENT: 0,    // Different approaches
        ORPHAN: 1       // Wisdom to share
    },
    MAGICIAN: {
        HERO: 0,
        CAREGIVER: 0,
        EXPLORER: 1,
        REBEL: 0,
        LOVER: 1,
        CREATOR: 2,
        JESTER: 0,
        SAGE: 2,
        MAGICIAN: 1,    // Power exchange
        RULER: 1,       // Court magician
        INNOCENT: 0,    // Neutral
        ORPHAN: 0       // Neutral
    },
    RULER: {
        HERO: 1,
        CAREGIVER: 0,
        EXPLORER: -1,
        REBEL: -2,
        LOVER: 0,
        CREATOR: 0,
        JESTER: -1,
        SAGE: 1,
        MAGICIAN: 1,
        RULER: -1,      // Power struggle
        INNOCENT: 1,    // Protects subjects
        ORPHAN: 1       // Gives belonging
    },
    INNOCENT: {
        HERO: 1,
        CAREGIVER: 2,
        EXPLORER: 0,
        REBEL: -1,
        LOVER: 1,
        CREATOR: 1,
        JESTER: 1,
        SAGE: 0,
        MAGICIAN: 0,
        RULER: 1,
        INNOCENT: 1,    // Mutual trust
        ORPHAN: 1       // Shared vulnerability
    },
    ORPHAN: {
        HERO: 1,
        CAREGIVER: 2,
        EXPLORER: 0,
        REBEL: 1,
        LOVER: 1,
        CREATOR: 0,
        JESTER: 1,
        SAGE: 1,
        MAGICIAN: 0,
        RULER: 1,
        INNOCENT: 1,
        ORPHAN: 2       // Deep understanding
    }
};

/**
 * Get all archetypes as an array
 * @returns {Array<Object>} Array of all archetype objects
 */
export function getAllArchetypes() {
    return Object.values(ARCHETYPES);
}

/**
 * Get archetype by ID
 * @param {string} archetypeId - The archetype ID (e.g., 'HERO')
 * @returns {Object|null} The archetype object or null if not found
 */
export function getArchetype(archetypeId) {
    return ARCHETYPES[archetypeId] || null;
}

/**
 * Get shadow archetype by ID
 * @param {string} shadowId - The shadow archetype ID
 * @returns {Object|null} The shadow archetype object or null
 */
export function getShadowArchetype(shadowId) {
    return SHADOW_ARCHETYPES[shadowId] || null;
}

/**
 * Get evolved archetype by ID
 * @param {string} evolvedId - The evolved archetype ID
 * @returns {Object|null} The evolved archetype object or null
 */
export function getEvolvedArchetype(evolvedId) {
    return EVOLVED_ARCHETYPES[evolvedId] || null;
}

/**
 * Get compatibility score between two archetypes
 * @param {string} archetype1 - First archetype ID
 * @param {string} archetype2 - Second archetype ID
 * @returns {number} Compatibility score (-2 to 2)
 */
export function getCompatibility(archetype1, archetype2) {
    if (!ARCHETYPE_COMPATIBILITY[archetype1]) return 0;
    return ARCHETYPE_COMPATIBILITY[archetype1][archetype2] ?? 0;
}

/**
 * Get a random archetype
 * @param {string} [category] - Optional category to filter by
 * @returns {Object} A random archetype object
 */
export function getRandomArchetype(category = null) {
    let pool = Object.values(ARCHETYPES);

    if (category && ARCHETYPE_CATEGORIES[category]) {
        pool = ARCHETYPE_CATEGORIES[category].archetypes.map(id => ARCHETYPES[id]);
    }

    return pool[Math.floor(Math.random() * pool.length)];
}
