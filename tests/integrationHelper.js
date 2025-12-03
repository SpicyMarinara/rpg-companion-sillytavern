/**
 * RPG Companion Integration Test Helper
 * 
 * This module provides functions for testing JSON parsing and validation
 * within SillyTavern. It can be loaded in the browser console or integrated
 * into the extension's debug mode.
 * 
 * Usage in browser console:
 * 1. Open SillyTavern with RPG Companion enabled
 * 2. Open browser dev tools (F12)
 * 3. Copy/paste this file's contents into console
 * 4. Run: RPGTestHelper.validateLastResponse() or other methods
 */

window.RPGTestHelper = {
    /**
     * Validates the last generated tracker data against expected JSON structure
     */
    validateLastResponse() {
        console.log('🔍 Validating last generated tracker data...\n');
        
        // Access extension settings (this assumes RPG Companion is loaded)
        const settings = window.extension_settings?.['rpg-companion'];
        if (!settings) {
            console.error('❌ RPG Companion not found in extension_settings');
            return false;
        }
        
        const results = {
            inventoryV3: this.validateInventory(settings.inventoryV3),
            skillsV2: this.validateSkills(settings.skillsV2),
            questsV2: this.validateQuests(settings.questsV2),
            infoBoxData: this.validateInfoBox(settings.infoBoxData),
            charactersData: this.validateCharacters(settings.charactersData)
        };
        
        console.log('\n📊 Validation Results:');
        Object.entries(results).forEach(([key, valid]) => {
            console.log(`   ${valid ? '✅' : '❌'} ${key}`);
        });
        
        return Object.values(results).every(v => v);
    },
    
    /**
     * Validates inventory structure
     */
    validateInventory(inv) {
        console.log('\n📦 Validating Inventory...');
        
        if (!inv) {
            console.log('   ⚠️ inventoryV3 is null/undefined');
            return true; // Not an error if not populated yet
        }
        
        let valid = true;
        
        // Check onPerson array
        if (inv.onPerson && !Array.isArray(inv.onPerson)) {
            console.log('   ❌ onPerson should be an array');
            valid = false;
        } else if (inv.onPerson?.length > 0) {
            const item = inv.onPerson[0];
            if (typeof item !== 'object' || !item.name) {
                console.log('   ❌ onPerson items should be objects with name property');
                valid = false;
            } else {
                console.log(`   ✅ onPerson: ${inv.onPerson.length} items (e.g., "${item.name}")`);
            }
        }
        
        // Check stored object
        if (inv.stored && typeof inv.stored !== 'object') {
            console.log('   ❌ stored should be an object');
            valid = false;
        } else if (inv.stored) {
            const locations = Object.keys(inv.stored);
            console.log(`   ✅ stored: ${locations.length} locations`);
        }
        
        // Check assets array
        if (inv.assets && !Array.isArray(inv.assets)) {
            console.log('   ❌ assets should be an array');
            valid = false;
        } else if (inv.assets?.length > 0) {
            console.log(`   ✅ assets: ${inv.assets.length} items`);
        }
        
        // Check simplified array
        if (inv.simplified && !Array.isArray(inv.simplified)) {
            console.log('   ❌ simplified should be an array');
            valid = false;
        } else if (inv.simplified?.length > 0) {
            console.log(`   ✅ simplified: ${inv.simplified.length} items`);
        }
        
        return valid;
    },
    
    /**
     * Validates skills structure
     */
    validateSkills(skills) {
        console.log('\n⚔️ Validating Skills...');
        
        if (!skills) {
            console.log('   ⚠️ skillsV2 is null/undefined');
            return true;
        }
        
        if (typeof skills !== 'object') {
            console.log('   ❌ skillsV2 should be an object');
            return false;
        }
        
        let valid = true;
        
        for (const [category, abilities] of Object.entries(skills)) {
            if (!Array.isArray(abilities)) {
                console.log(`   ❌ ${category} should be an array`);
                valid = false;
                continue;
            }
            
            abilities.forEach((ability, i) => {
                if (typeof ability !== 'object' || !ability.name) {
                    console.log(`   ❌ ${category}[${i}] should be an object with name`);
                    valid = false;
                }
            });
            
            console.log(`   ✅ ${category}: ${abilities.length} abilities`);
        }
        
        return valid;
    },
    
    /**
     * Validates quests structure
     */
    validateQuests(quests) {
        console.log('\n📜 Validating Quests...');
        
        if (!quests) {
            console.log('   ⚠️ questsV2 is null/undefined');
            return true;
        }
        
        let valid = true;
        
        if (quests.main !== null && quests.main !== undefined) {
            if (typeof quests.main === 'string') {
                console.log(`   ✅ main: "${quests.main}"`);
            } else if (typeof quests.main === 'object' && quests.main.name) {
                console.log(`   ✅ main: "${quests.main.name}" (structured)`);
            } else {
                console.log('   ❌ main should be string or {name, description}');
                valid = false;
            }
        }
        
        if (quests.optional) {
            if (!Array.isArray(quests.optional)) {
                console.log('   ❌ optional should be an array');
                valid = false;
            } else {
                console.log(`   ✅ optional: ${quests.optional.length} quests`);
            }
        }
        
        return valid;
    },
    
    /**
     * Validates info box structure
     */
    validateInfoBox(info) {
        console.log('\n📍 Validating Info Box...');
        
        if (!info) {
            console.log('   ⚠️ infoBoxData is null/undefined');
            return true;
        }
        
        const fields = ['date', 'weather', 'temperature', 'time', 'location'];
        let valid = true;
        
        fields.forEach(field => {
            if (info[field] !== undefined && info[field] !== null) {
                if (typeof info[field] !== 'string') {
                    console.log(`   ❌ ${field} should be a string`);
                    valid = false;
                } else {
                    console.log(`   ✅ ${field}: "${info[field]}"`);
                }
            }
        });
        
        if (info.recentEvents) {
            if (!Array.isArray(info.recentEvents)) {
                console.log('   ❌ recentEvents should be an array');
                valid = false;
            } else {
                console.log(`   ✅ recentEvents: ${info.recentEvents.length} events`);
            }
        }
        
        return valid;
    },
    
    /**
     * Validates characters structure
     */
    validateCharacters(chars) {
        console.log('\n👥 Validating Characters...');
        
        if (!chars) {
            console.log('   ⚠️ charactersData is null/undefined');
            return true;
        }
        
        if (!Array.isArray(chars)) {
            console.log('   ❌ charactersData should be an array');
            return false;
        }
        
        let valid = true;
        
        chars.forEach((char, i) => {
            if (typeof char !== 'object' || !char.name) {
                console.log(`   ❌ character[${i}] should have name`);
                valid = false;
            } else {
                console.log(`   ✅ ${char.name}: ${char.relationship || 'no relationship'}`);
            }
        });
        
        return valid;
    },
    
    /**
     * Tests JSON extraction from a raw response string
     */
    testJSONExtraction(responseText) {
        console.log('\n🔬 Testing JSON Extraction...\n');
        
        const jsonRegex = /```(?:json)?\s*([\s\S]*?)```/i;
        const match = responseText.match(jsonRegex);
        
        if (!match) {
            console.log('❌ No JSON code block found');
            return null;
        }
        
        console.log('✅ Found JSON code block');
        
        try {
            const parsed = JSON.parse(match[1].trim());
            console.log('✅ JSON parsed successfully');
            console.log('📋 Structure:', Object.keys(parsed).join(', '));
            return parsed;
        } catch (e) {
            console.log('❌ JSON parse failed:', e.message);
            
            // Try to fix common issues
            console.log('🔧 Attempting to fix JSON...');
            const fixed = match[1].trim()
                .replace(/,\s*}/g, '}')
                .replace(/,\s*]/g, ']');
            
            try {
                const fixedParsed = JSON.parse(fixed);
                console.log('✅ Fixed JSON parsed successfully');
                return fixedParsed;
            } catch (e2) {
                console.log('❌ Could not fix JSON:', e2.message);
                return null;
            }
        }
    },
    
    /**
     * Simulates a full parse cycle with a sample response
     */
    simulateParseResponse(sampleResponse) {
        console.log('\n🔄 Simulating Parse Response...\n');
        
        const parsed = this.testJSONExtraction(sampleResponse);
        
        if (parsed) {
            console.log('\n📊 Validating parsed structure:');
            
            if (parsed.userStats) {
                console.log('   ✅ userStats present');
            }
            if (parsed.skills) {
                console.log('   ✅ skills present');
            }
            if (parsed.inventory) {
                console.log('   ✅ inventory present');
            }
            if (parsed.quests) {
                console.log('   ✅ quests present');
            }
            if (parsed.infoBox) {
                console.log('   ✅ infoBox present');
            }
            if (parsed.presentCharacters) {
                console.log('   ✅ presentCharacters present');
            }
        }
        
        return parsed;
    },
    
    /**
     * Prints current extension settings for debugging
     */
    printCurrentState() {
        const settings = window.extension_settings?.['rpg-companion'];
        if (!settings) {
            console.error('RPG Companion not found');
            return;
        }
        
        console.log('📋 Current RPG Companion State:\n');
        console.log('inventoryV3:', JSON.stringify(settings.inventoryV3, null, 2));
        console.log('skillsV2:', JSON.stringify(settings.skillsV2, null, 2));
        console.log('questsV2:', JSON.stringify(settings.questsV2, null, 2));
        console.log('infoBoxData:', JSON.stringify(settings.infoBoxData, null, 2));
        console.log('charactersData:', JSON.stringify(settings.charactersData, null, 2));
    },
    
    /**
     * Help message
     */
    help() {
        console.log(`
🧪 RPG Companion Test Helper Commands:

RPGTestHelper.validateLastResponse()  - Validate current structured data
RPGTestHelper.testJSONExtraction(text) - Test JSON extraction from text
RPGTestHelper.simulateParseResponse(text) - Full parse simulation
RPGTestHelper.printCurrentState()     - Print current extension state
RPGTestHelper.help()                  - Show this help message

Example:
  RPGTestHelper.validateLastResponse()
        `);
    }
};

// Print help on load
console.log('🧪 RPG Companion Test Helper loaded. Run RPGTestHelper.help() for commands.');

