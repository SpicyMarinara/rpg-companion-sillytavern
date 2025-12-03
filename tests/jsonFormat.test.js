/**
 * JSON Format Tests for RPG Companion
 * 
 * These tests can be run in two ways:
 * 1. In browser console: Copy/paste or load as module in SillyTavern
 * 2. Via Node.js: Run with `node tests/jsonFormat.test.js`
 * 
 * Tests cover:
 * - JSON prompt generation
 * - JSON response parsing
 * - Data structure validation
 */

// Mock SillyTavern context for Node.js testing
const isBrowser = typeof window !== 'undefined';

// Sample mock data for testing
const mockTrackerConfig = {
    userStats: {
        customStats: [
            { id: 'health', name: 'Health', enabled: true },
            { id: 'energy', name: 'Energy', enabled: true }
        ],
        showRPGAttributes: true,
        rpgAttributes: [
            { id: 'str', name: 'Strength', enabled: true },
            { id: 'dex', name: 'Dexterity', enabled: true }
        ],
        statusSection: {
            enabled: true,
            showMoodEmoji: true,
            customFields: ['Conditions']
        },
        skillsSection: {
            enabled: true,
            customFields: ['Combat', 'Stealth', 'Magic']
        }
    },
    infoBox: {
        widgets: {
            date: { enabled: true },
            weather: { enabled: true },
            temperature: { enabled: true, unit: 'C' },
            time: { enabled: true },
            location: { enabled: true },
            recentEvents: { enabled: true }
        }
    },
    presentCharacters: {
        showEmoji: true,
        relationshipFields: ['Enemy', 'Neutral', 'Friend', 'Lover'],
        customFields: [
            { id: 'appearance', name: 'Appearance', enabled: true },
            { id: 'demeanor', name: 'Demeanor', enabled: true }
        ],
        thoughts: { enabled: true, name: 'Thoughts' },
        characterStats: {
            enabled: true,
            customStats: [
                { id: 'health', name: 'Health', enabled: true },
                { id: 'arousal', name: 'Arousal', enabled: true }
            ]
        }
    }
};

// Sample JSON responses for testing parser
const sampleValidJSONResponse = `
Here's an interesting development in the story...

\`\`\`json
{
    "userStats": {
        "health": 85,
        "energy": 60,
        "str": 14,
        "dex": 12,
        "status": {
            "mood": "😊",
            "conditions": "Well-rested"
        }
    },
    "skills": {
        "combat": [
            { "name": "Sword Fighting", "description": "Basic melee combat with swords", "linkedItem": "Iron Sword" },
            { "name": "Parry", "description": "Deflect incoming attacks" }
        ],
        "stealth": [
            { "name": "Sneak", "description": "Move quietly" }
        ],
        "magic": []
    },
    "inventory": {
        "onPerson": [
            { "name": "Iron Sword", "description": "A sturdy blade" },
            { "name": "Leather Armor", "description": "Basic protection" },
            { "name": "Health Potion", "description": "Restores 50 HP" }
        ],
        "stored": {
            "Backpack": [
                { "name": "Rope", "description": "50 feet of hemp rope" }
            ]
        },
        "assets": [
            { "name": "Small Cottage", "description": "A humble dwelling in the village" }
        ]
    },
    "quests": {
        "main": "Find the Lost Artifact",
        "optional": ["Gather herbs for the healer", "Clear the rat infestation"]
    },
    "infoBox": {
        "date": "15th of Sunstone, Year 1423",
        "weather": "☀️ Sunny",
        "temperature": "22°C",
        "time": "Midday",
        "location": "Village Square",
        "recentEvents": ["Met the village elder", "Bought supplies"]
    },
    "presentCharacters": [
        {
            "name": "Elena",
            "description": "A young healer with kind eyes",
            "emoji": "😊",
            "relationship": "Friend",
            "stats": { "health": 100, "arousal": 10 },
            "appearance": "Long brown hair, green robes",
            "demeanor": "Cheerful and helpful",
            "thoughts": "I hope they can help me find the rare herbs..."
        }
    ]
}
\`\`\`

The village was bustling with activity...
`;

const sampleMalformedJSONResponse = `
Some story text here...

\`\`\`json
{
    "userStats": {
        "health": 85,
        "energy": 60,
    },
    "inventory": {
        "onPerson": [
            { "name": "Sword", "description": "Sharp" }
        ]
    }
}
\`\`\`
`;

const sampleSimplifiedInventoryResponse = `
\`\`\`json
{
    "userStats": {
        "health": 75,
        "energy": 50
    },
    "inventory": {
        "simplified": [
            { "name": "Magic Staff", "description": "Channels arcane energy" },
            { "name": "Spell Book", "description": "Contains basic spells" },
            { "name": "Mana Potion", "description": "Restores magical energy" }
        ]
    }
}
\`\`\`
`;

// Test results accumulator
const testResults = {
    passed: 0,
    failed: 0,
    errors: []
};

/**
 * Simple assertion helper
 */
function assert(condition, message) {
    if (condition) {
        testResults.passed++;
        console.log(`✅ PASS: ${message}`);
    } else {
        testResults.failed++;
        testResults.errors.push(message);
        console.error(`❌ FAIL: ${message}`);
    }
}

/**
 * Test JSON extraction from markdown code blocks
 */
function testJSONExtraction() {
    console.log('\n📋 Testing JSON Extraction from Code Blocks...\n');
    
    // Test 1: Extract valid JSON from code block
    const jsonRegex = /```(?:json)?\s*([\s\S]*?)```/i;
    const match = sampleValidJSONResponse.match(jsonRegex);
    assert(match !== null, 'Should find JSON code block in response');
    
    if (match) {
        let parsed;
        try {
            parsed = JSON.parse(match[1].trim());
            assert(true, 'Should parse extracted JSON successfully');
            assert(parsed.userStats !== undefined, 'Parsed JSON should have userStats');
            assert(parsed.inventory !== undefined, 'Parsed JSON should have inventory');
            assert(parsed.skills !== undefined, 'Parsed JSON should have skills');
            assert(parsed.quests !== undefined, 'Parsed JSON should have quests');
            assert(parsed.infoBox !== undefined, 'Parsed JSON should have infoBox');
            assert(parsed.presentCharacters !== undefined, 'Parsed JSON should have presentCharacters');
        } catch (e) {
            assert(false, `Should not throw parsing error: ${e.message}`);
        }
    }
    
    // Test 2: Handle malformed JSON (trailing comma)
    const malformedMatch = sampleMalformedJSONResponse.match(jsonRegex);
    assert(malformedMatch !== null, 'Should find malformed JSON code block');
    
    if (malformedMatch) {
        try {
            JSON.parse(malformedMatch[1].trim());
            assert(false, 'Malformed JSON should throw parsing error');
        } catch (e) {
            assert(true, 'Malformed JSON correctly throws parsing error');
            
            // Test JSON fixing (remove trailing commas)
            const fixed = malformedMatch[1].trim()
                .replace(/,\s*}/g, '}')
                .replace(/,\s*]/g, ']');
            try {
                const fixedParsed = JSON.parse(fixed);
                assert(fixedParsed.userStats.health === 85, 'Fixed JSON should parse correctly');
            } catch (e2) {
                assert(false, `JSON fixing should work: ${e2.message}`);
            }
        }
    }
}

/**
 * Test inventory data structure validation
 */
function testInventoryStructure() {
    console.log('\n📦 Testing Inventory Structure...\n');
    
    const jsonRegex = /```(?:json)?\s*([\s\S]*?)```/i;
    const match = sampleValidJSONResponse.match(jsonRegex);
    const data = JSON.parse(match[1].trim());
    
    const inv = data.inventory;
    
    // Test onPerson array structure
    assert(Array.isArray(inv.onPerson), 'onPerson should be an array');
    assert(inv.onPerson.length > 0, 'onPerson should have items');
    assert(inv.onPerson[0].name !== undefined, 'Items should have name property');
    assert(inv.onPerson[0].description !== undefined, 'Items should have description property');
    
    // Test stored object structure
    assert(typeof inv.stored === 'object', 'stored should be an object');
    assert(inv.stored.Backpack !== undefined, 'stored should have location keys');
    assert(Array.isArray(inv.stored.Backpack), 'stored locations should be arrays');
    
    // Test assets array
    assert(Array.isArray(inv.assets), 'assets should be an array');
    
    // Test simplified inventory
    const simplifiedMatch = sampleSimplifiedInventoryResponse.match(jsonRegex);
    const simplifiedData = JSON.parse(simplifiedMatch[1].trim());
    assert(Array.isArray(simplifiedData.inventory.simplified), 'simplified inventory should be an array');
}

/**
 * Test skills data structure validation
 */
function testSkillsStructure() {
    console.log('\n⚔️ Testing Skills Structure...\n');
    
    const jsonRegex = /```(?:json)?\s*([\s\S]*?)```/i;
    const match = sampleValidJSONResponse.match(jsonRegex);
    const data = JSON.parse(match[1].trim());
    
    const skills = data.skills;
    
    // Test skill categories
    assert(typeof skills === 'object', 'skills should be an object');
    assert(skills.combat !== undefined, 'skills should have combat category');
    assert(Array.isArray(skills.combat), 'skill categories should be arrays');
    
    // Test ability structure
    const ability = skills.combat[0];
    assert(ability.name !== undefined, 'Abilities should have name');
    assert(ability.description !== undefined, 'Abilities should have description');
    
    // Test linked item
    assert(ability.linkedItem === 'Iron Sword', 'First combat ability should be linked to Iron Sword');
    assert(skills.combat[1].linkedItem === undefined || skills.combat[1].linkedItem === null, 
           'Second combat ability should not have linkedItem');
}

/**
 * Test quests data structure
 */
function testQuestsStructure() {
    console.log('\n📜 Testing Quests Structure...\n');
    
    const jsonRegex = /```(?:json)?\s*([\s\S]*?)```/i;
    const match = sampleValidJSONResponse.match(jsonRegex);
    const data = JSON.parse(match[1].trim());
    
    const quests = data.quests;
    
    assert(typeof quests.main === 'string', 'main quest should be a string');
    assert(Array.isArray(quests.optional), 'optional quests should be an array');
    assert(quests.optional.length === 2, 'Should have 2 optional quests');
}

/**
 * Test characters data structure
 */
function testCharactersStructure() {
    console.log('\n👥 Testing Characters Structure...\n');
    
    const jsonRegex = /```(?:json)?\s*([\s\S]*?)```/i;
    const match = sampleValidJSONResponse.match(jsonRegex);
    const data = JSON.parse(match[1].trim());
    
    const chars = data.presentCharacters;
    
    assert(Array.isArray(chars), 'presentCharacters should be an array');
    assert(chars.length > 0, 'Should have at least one character');
    
    const char = chars[0];
    assert(char.name === 'Elena', 'Character should have name');
    assert(char.description !== undefined, 'Character should have description');
    assert(char.emoji !== undefined, 'Character should have emoji');
    assert(char.relationship !== undefined, 'Character should have relationship');
    assert(char.stats !== undefined, 'Character should have stats');
    assert(char.thoughts !== undefined, 'Character should have thoughts');
}

/**
 * Test info box data structure
 */
function testInfoBoxStructure() {
    console.log('\n📍 Testing Info Box Structure...\n');
    
    const jsonRegex = /```(?:json)?\s*([\s\S]*?)```/i;
    const match = sampleValidJSONResponse.match(jsonRegex);
    const data = JSON.parse(match[1].trim());
    
    const info = data.infoBox;
    
    assert(typeof info.date === 'string', 'date should be a string');
    assert(typeof info.weather === 'string', 'weather should be a string');
    assert(typeof info.temperature === 'string', 'temperature should be a string');
    assert(typeof info.time === 'string', 'time should be a string');
    assert(typeof info.location === 'string', 'location should be a string');
    assert(Array.isArray(info.recentEvents), 'recentEvents should be an array');
}

/**
 * Test JSON prompt schema generation (mock)
 */
function testPromptSchemaGeneration() {
    console.log('\n📝 Testing Prompt Schema Generation...\n');
    
    // This tests the expected schema structure that generateJSONTrackerInstructions should produce
    const expectedSchemaProperties = [
        'userStats',
        'skills', 
        'inventory',
        'quests',
        'infoBox',
        'presentCharacters'
    ];
    
    // Mock schema generation based on config
    const schema = {
        type: 'object',
        properties: {}
    };
    
    // User stats
    if (mockTrackerConfig.userStats) {
        schema.properties.userStats = { type: 'object', properties: {} };
        
        // Custom stats
        mockTrackerConfig.userStats.customStats.forEach(stat => {
            if (stat.enabled) {
                schema.properties.userStats.properties[stat.id] = { 
                    type: 'integer', 
                    minimum: 0, 
                    maximum: 100 
                };
            }
        });
        
        // RPG attributes
        if (mockTrackerConfig.userStats.showRPGAttributes) {
            mockTrackerConfig.userStats.rpgAttributes.forEach(attr => {
                if (attr.enabled) {
                    schema.properties.userStats.properties[attr.id] = { 
                        type: 'integer', 
                        minimum: 1 
                    };
                }
            });
        }
    }
    
    // Skills
    if (mockTrackerConfig.userStats.skillsSection?.enabled) {
        schema.properties.skills = { type: 'object', properties: {} };
        mockTrackerConfig.userStats.skillsSection.customFields.forEach(field => {
            const fieldId = field.toLowerCase();
            schema.properties.skills.properties[fieldId] = {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        name: { type: 'string' },
                        description: { type: 'string' },
                        linkedItem: { type: 'string', nullable: true }
                    }
                }
            };
        });
    }
    
    // Inventory
    schema.properties.inventory = {
        type: 'object',
        properties: {
            onPerson: { type: 'array' },
            stored: { type: 'object' },
            assets: { type: 'array' }
        }
    };
    
    // Validate schema structure
    assert(schema.properties.userStats !== undefined, 'Schema should include userStats');
    assert(schema.properties.userStats.properties.health !== undefined, 'Schema should include health stat');
    assert(schema.properties.skills !== undefined, 'Schema should include skills');
    assert(schema.properties.skills.properties.combat !== undefined, 'Schema should include combat skill');
    assert(schema.properties.inventory !== undefined, 'Schema should include inventory');
    
    console.log('Generated schema structure:', JSON.stringify(schema, null, 2).substring(0, 500) + '...');
}

/**
 * Run all tests
 */
function runAllTests() {
    console.log('🧪 RPG Companion JSON Format Tests\n');
    console.log('='.repeat(50));
    
    try {
        testJSONExtraction();
        testInventoryStructure();
        testSkillsStructure();
        testQuestsStructure();
        testCharactersStructure();
        testInfoBoxStructure();
        testPromptSchemaGeneration();
    } catch (e) {
        console.error('💥 Test suite error:', e);
        testResults.failed++;
        testResults.errors.push(e.message);
    }
    
    console.log('\n' + '='.repeat(50));
    console.log(`\n📊 Results: ${testResults.passed} passed, ${testResults.failed} failed`);
    
    if (testResults.errors.length > 0) {
        console.log('\n❌ Failed tests:');
        testResults.errors.forEach(err => console.log(`   - ${err}`));
    }
    
    return testResults;
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        runAllTests,
        sampleValidJSONResponse,
        sampleMalformedJSONResponse,
        sampleSimplifiedInventoryResponse,
        mockTrackerConfig
    };
}

// Auto-run if executed directly
if (!isBrowser || (isBrowser && window.RPG_RUN_TESTS)) {
    runAllTests();
}

