# Character State Tracking System for SillyTavern RPG Companion

## 📖 Overview

This is a **comprehensive character state tracking system** based on the Katherine RPG framework. Unlike traditional RPG companions that track **{{user}}** stats, this system tracks **{{char}}** (the AI character's) internal states, emotions, relationships, and physical condition.

### What It Tracks

#### 🧬 Primary Traits (Personality DNA)
- **40+ personality traits** that define who the character IS
- Core disposition (dominance, introversion, emotional stability)
- Sexual personality (perversion, exhibitionism, masochism, etc.)
- Moral core (honesty, empathy, corruption, etc.)
- Intellectual traits (intelligence, wisdom, creativity)
- **These change SLOWLY** - only through sustained experiences over time

#### 🌤️ Secondary States (Emotional Weather)
- **70+ temporary emotional states** that change frequently
- Core emotions (happy, sad, angry, anxious, etc.)
- Arousal & sexual states (horny, frustrated, seductive, etc.)
- Social states (lonely, confident, playful, etc.)
- Energy & altered states (drunk, exhausted, euphoric, etc.)
- **These change FAST** - minute to hour timescales

#### 💭 Beliefs & Worldview
- Track character's beliefs with strength and stability
- Moral beliefs, spiritual beliefs, self-concept
- Relationship beliefs, sexual morality
- Beliefs can fracture during pivotal moments

#### 🏃 Physical Stats
- Survival needs (hunger, thirst, bladder, energy, sleep)
- Physical condition (health, pain, temperature, cleanliness)
- Physical attributes (strength, stamina, agility)

#### 👗 Outfit/Clothing System
- Dynamic tracking of what character is wearing
- Per-piece tracking (bra, panties, shirt, pants, etc.)
- Status tracking (worn properly, shifted, removed, torn, wet)
- Coverage calculation (0-100% body coverage)

#### ❤️ Relationship Tracking
- **Per-NPC detailed relationship stats**
- Core metrics: Trust, Love, Loyalty, Attraction, Respect, Fear
- Social dynamics: Closeness, Openness, Comfort, Dependency
- Sexual dynamics: Flirtiness, Sexual Compatibility, Satisfaction
- Power dynamics: Dominance, Submissiveness, Possessiveness
- Current thoughts about each person

#### 🎬 Contextual Information
- Location, time of day, weather
- Present characters in the scene
- Recent events
- Current activity

---

## 🔄 How It Works

### The Flow

1. **LLM receives current character state** as input before generating a response
2. **LLM generates the character's response** based on their current emotional/physical state
3. **LLM updates character states** based on what happened in the response
4. **Parser extracts and applies updates** to the character state
5. **UI displays updated states** for the user to see

### Example

**Before Response:**
- Character: Katherine
- Emotional State: Lonely (70), Anxious (40), Horny (30)
- Relationship with User: Trust 85, Love 60, Attraction 75
- Physical: Energy 50%, Arousal 30%
- Location: Katherine's apartment
- Thoughts: "I wish {{user}} would stay longer..."

**LLM generates response where Katherine invites {{user}} to stay for dinner**

**After Response:**
- Emotional State Changes:
  - Lonely: -20 (reason: {{user}} accepted invitation)
  - Happy: +25 (reason: spending time with {{user}})
  - Hopeful: +15 (reason: possibility of intimacy)
- Relationship Updates:
  - Trust: +5 (reason: {{user}} agreed to stay)
  - Closeness: +10 (reason: intimate setting)
  - Thoughts: "Maybe tonight is finally the night..."
- Physical Changes:
  - Energy: -5 (reason: cooking dinner)
  - Arousal: +15 (reason: anticipation of being alone with {{user}})

---

## 📁 File Structure

```
src/
├── core/
│   ├── characterState.js          # Character state data structure & management
│   └── state.js                    # Original extension state (keep for compatibility)
│
├── systems/
│   ├── generation/
│   │   ├── characterPromptBuilder.js   # Generates prompts for character tracking
│   │   ├── characterParser.js          # Parses LLM responses and updates states
│   │   ├── promptBuilder.js            # Original prompt builder (still used for user tracking)
│   │   └── parser.js                   # Original parser
│   │
│   └── rendering/
│       ├── characterStateRenderer.js   # Renders character state in UI
│       └── [other renderers...]
│
└── [other modules...]
```

---

## 🚀 Getting Started

### 1. Installation

Copy all the new files into your RPG Companion extension:

- `src/core/characterState.js`
- `src/systems/generation/characterPromptBuilder.js`
- `src/systems/generation/characterParser.js`
- `src/systems/rendering/characterStateRenderer.js`

### 2. Integration with Main Extension

You'll need to modify `index.js` to integrate the character tracking system:

```javascript
// Import character tracking modules
import {
    getCharacterState,
    updateCharacterState,
    initializeRelationship
} from './src/core/characterState.js';

import {
    generateCharacterTrackingPrompt,
    generateSeparateCharacterTrackingPrompt
} from './src/systems/generation/characterPromptBuilder.js';

import {
    parseAndApplyCharacterStateUpdate,
    removeCharacterStateBlock
} from './src/systems/generation/characterParser.js';

import {
    renderCharacterStateOverview,
    updateCharacterStateDisplay
} from './src/systems/rendering/characterStateRenderer.js';
```

### 3. Hook into Message Received Event

```javascript
// In your onMessageReceived handler
async function onMessageReceived(data) {
    if (!extensionSettings.enabled) return;

    // Parse character state update from the response
    const stateUpdate = parseAndApplyCharacterStateUpdate(data.mes);

    // Update UI
    updateCharacterStateDisplay();

    // Optionally remove the state block from the displayed message
    if (stateUpdate) {
        data.mes = removeCharacterStateBlock(data.mes);
    }
}
```

### 4. Hook into Generation Started Event

```javascript
// In your onGenerationStarted handler
async function onGenerationStarted(data) {
    if (!extensionSettings.enabled) return;

    // Add character tracking prompt to the generation
    const characterPrompt = generateCharacterTrackingPrompt();

    // Inject into the prompt (method depends on your setup)
    // Example: use extension_prompts system
    setExtensionPrompt(
        'CHARACTER_STATE_TRACKING',
        characterPrompt,
        extension_prompt_types.AFTER_SCENARIO,
        0, // position
        false, // scan depth
        extension_prompt_roles.SYSTEM
    );
}
```

### 5. Add UI Container

Add this to your `template.html`:

```html
<div id="rpg-character-state-container" class="rpg-section">
    <!-- Character state will be rendered here -->
</div>
```

---

## 🎨 Customization

### Choosing Which States to Track

You can customize which states to track by modifying `characterState.js`:

```javascript
// Focus on emotional tracking only
export let characterState = {
    characterName: null,
    secondaryStates: {
        happy: 50,
        sad: 0,
        angry: 0,
        horny: 0
        // Add only the emotions you care about
    },
    // Remove sections you don't need
};
```

### Customizing the Prompt

Edit `characterPromptBuilder.js` to change how the LLM is instructed:

```javascript
// Simplify the tracking instructions
instructions += `Update only these states:\n`;
instructions += `- Emotions: happy, sad, angry, aroused\n`;
instructions += `- Energy level\n`;
instructions += `- Thoughts about {{user}}\n`;
```

### Styling the UI

Add custom CSS for the character state display:

```css
.rpg-character-overview {
    background: rgba(0, 0, 0, 0.7);
    border-radius: 8px;
    padding: 15px;
}

.rpg-emotion-item {
    display: flex;
    align-items: center;
    margin-bottom: 8px;
}

.rpg-relationship-card {
    background: rgba(255, 255, 255, 0.05);
    padding: 10px;
    border-radius: 5px;
    margin-bottom: 10px;
}
```

---

## 💡 Advanced Features

### Automatic Character Initialization

When starting a new chat, you can automatically initialize the character's personality traits from their character card:

```javascript
import { generateCharacterInitializationPrompt } from './src/systems/generation/characterPromptBuilder.js';
import { parseCharacterInitialization } from './src/systems/generation/characterParser.js';

async function initializeCharacterFromCard() {
    const prompt = await generateCharacterInitializationPrompt();

    // Send to LLM (using your API client)
    const response = await generateRaw(messages, api, false);

    // Parse and apply
    const traits = parseCharacterInitialization(response);
    if (traits) {
        updateCharacterState({ primaryTraits: traits });
    }
}
```

### Relationship Analysis

Automatically analyze relationships when new characters appear:

```javascript
import { generateRelationshipAnalysisPrompt } from './src/systems/generation/characterPromptBuilder.js';
import { parseRelationshipAnalysis } from './src/systems/generation/characterParser.js';

async function analyzeRelationship(npcName) {
    const prompt = generateRelationshipAnalysisPrompt(npcName);

    // Send to LLM
    const response = await generateRaw([{role: 'user', content: prompt}], api, false);

    // Parse and apply
    const relationshipData = parseRelationshipAnalysis(response);
    if (relationshipData) {
        updateRelationship(npcName, relationshipData);
    }
}
```

### Persistent State Storage

Save character state to chat metadata:

```javascript
import { getCharacterState } from './src/core/characterState.js';

function saveCharacterState() {
    const charState = getCharacterState();

    // Save to SillyTavern chat metadata
    chat_metadata.rpg_character_state = charState;
    saveChatDebounced();
}

function loadCharacterState() {
    if (chat_metadata.rpg_character_state) {
        setCharacterState(chat_metadata.rpg_character_state);
    }
}
```

---

## 📊 State Change Guidelines

### Emotional States (Secondary States)

**Small changes (+/- 5-15):**
- Normal conversation
- Minor events
- Gradual mood shifts

**Medium changes (+/- 20-40):**
- Significant events
- Important revelations
- Strong emotional moments

**Large changes (+/- 50+):**
- Life-changing events
- Trauma
- Peak experiences

### Relationship Changes

**Trust:**
- Vulnerability rewarded: +5 to +15
- Promise kept: +5
- Betrayal: -30 to -60

**Love:**
- Romantic moment: +5 to +20
- Declaration of feelings: +20 to +40
- Heartbreak: -40 to -80

**Attraction:**
- Attractive behavior: +5 to +15
- Sexual tension: +10 to +30
- Turn-off: -10 to -30

---

## 🐛 Troubleshooting

### Character state not updating

1. Check console for parsing errors
2. Verify the LLM is including the state update block in responses
3. Make sure the format matches exactly what the parser expects

### UI not displaying

1. Check that the container `#rpg-character-state-container` exists
2. Verify jQuery selectors are working
3. Check browser console for JavaScript errors

### LLM not following format

1. Adjust the prompt to be more explicit
2. Use a better model (Claude Sonnet 4.5, GPT-4, etc.)
3. Increase temperature slightly for more creative state updates
4. Add examples to the prompt

---

## 📚 Examples

### Example Character State Update (from LLM)

```character-state
Katherine's State Update
---

**Emotional Changes**:
- happy: +20 (reason: {{user}} complimented her cooking)
- confident: +10 (reason: successful dinner preparation)
- horny: +15 (reason: intimate candlelit atmosphere with {{user}})
- anxious: -15 (reason: {{user}}'s presence is comforting)

**Physical Changes**:
- Energy: -10 (reason: cooking and cleaning)
- Arousal: +20 (reason: anticipation of being alone with {{user}})

**Relationship Updates**:
- {{user}}:
  - Trust: +5 (reason: {{user}} was vulnerable about their past)
  - Closeness: +15 (reason: deep conversation during dinner)
  - Attraction: +10 (reason: {{user}} looked particularly attractive tonight)
  - Thoughts: "I want this moment to never end. Maybe I should make a move..."

**Scene Context**:
- Location: Katherine's apartment, dining room
- Time: 8:30 PM
- Present: {{user}}, Katherine

**Katherine's Thoughts**:
"This is perfect. The wine, the candlelight, {{user}} opening up to me... I can feel the tension between us. Should I reach across the table and touch their hand? My heart is racing just thinking about it."
```

---

## 🤝 Contributing

This system is based on the Katherine RPG Complete Master document. If you want to extend it:

1. Add new state categories to `characterState.js`
2. Update `characterPromptBuilder.js` to instruct the LLM about new states
3. Update `characterParser.js` to parse new state formats
4. Update `characterStateRenderer.js` to display new states

---

## 📄 License

This extends the RPG Companion SillyTavern extension. Follow the same license as the main extension.

---

## 🙏 Credits

- **Katherine RPG System**: Original comprehensive character simulation framework
- **RPG Companion**: Base extension by Marysia
- **Character State Tracking**: Integration of Katherine RPG into SillyTavern

---

## 📞 Support

If you encounter issues:

1. Check the console for error messages
2. Verify your LLM model supports structured outputs
3. Review the prompt and parsing logic
4. Open an issue on GitHub with:
   - Error messages
   - LLM response example
   - What you expected vs what happened

---

**Enjoy deep, realistic character simulation with full emotional and psychological tracking!** 🎭✨
