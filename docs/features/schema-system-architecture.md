# Schema System Architecture

**Status:** Design Phase
**Priority:** Critical (Tier 1 Feature - 16% vote priority)
**Target Version:** 2.0.0

---

## Overview

The Schema System allows users to define custom RPG systems using human-readable YAML files instead of being locked into hardcoded stats. Inspired by Gemini Deep Research recommendations and Entity-Component-System (ECS) patterns.

### Vision
> Transform RPG Companion from a fixed D&D-style tracker into a universal RPG system that adapts to ANY tabletop game: Pathfinder, Cyberpunk RED, World of Darkness, homebrew systems, etc.

---

## Architecture Overview

### Three-Layer System

```
┌─────────────────────────────────────────┐
│   System Definition (YAML)              │  ← Design Time
│   Rules, structure, formulas            │
└─────────────────────────────────────────┘
              ↓ validates
┌─────────────────────────────────────────┐
│   Character Instance (JSON)             │  ← Run Time
│   Actual character data                 │
└─────────────────────────────────────────┘
              ↓ renders via
┌─────────────────────────────────────────┐
│   Widget Dashboard (UI)                 │  ← User Interface
│   Dynamic widget rendering              │
└─────────────────────────────────────────┘
```

---

## System Definition Layer (YAML)

### Schema Structure

```yaml
# dnd5e.yaml - Example D&D 5th Edition Schema

meta:
  name: "D&D 5th Edition"
  version: "1.0.0"
  author: "RPG Companion Community"
  description: "Official D&D 5e ruleset"
  tags: ["fantasy", "d20", "official"]

components:

  # Core Abilities (STR, DEX, CON, etc.)
  coreAbilities:
    type: object
    label: "Ability Scores"
    icon: "🎲"
    properties:
      strength:
        type: number
        label: "Strength"
        abbr: "STR"
        min: 1
        max: 30
        default: 10

      dexterity:
        type: number
        label: "Dexterity"
        abbr: "DEX"
        min: 1
        max: 30
        default: 10

      constitution:
        type: number
        label: "Constitution"
        abbr: "CON"
        min: 1
        max: 30
        default: 10

      intelligence:
        type: number
        label: "Intelligence"
        abbr: "INT"
        min: 1
        max: 30
        default: 10

      wisdom:
        type: number
        label: "Wisdom"
        abbr: "WIS"
        min: 1
        max: 30
        default: 10

      charisma:
        type: number
        label: "Charisma"
        abbr: "CHA"
        min: 1
        max: 30
        default: 10

  # Derived Stats (calculated from abilities)
  abilityModifiers:
    type: object
    label: "Ability Modifiers"
    properties:
      str_mod:
        type: formula
        formula: "floor((@coreAbilities.strength - 10) / 2)"

      dex_mod:
        type: formula
        formula: "floor((@coreAbilities.dexterity - 10) / 2)"

      con_mod:
        type: formula
        formula: "floor((@coreAbilities.constitution - 10) / 2)"

      int_mod:
        type: formula
        formula: "floor((@coreAbilities.intelligence - 10) / 2)"

      wis_mod:
        type: formula
        formula: "floor((@coreAbilities.wisdom - 10) / 2)"

      cha_mod:
        type: formula
        formula: "floor((@coreAbilities.charisma - 10) / 2)"

  # Resources (pools that track usage)
  resources:
    type: list
    label: "Resources"
    icon: "⚡"
    items:
      hitPoints:
        type: resource
        label: "Hit Points"
        abbr: "HP"
        current: 0
        max:
          type: formula
          formula: "10 + @abilityModifiers.con_mod"
        color: "#cc3333"
        display: "bar"

      spellSlots:
        type: resource
        label: "Spell Slots"
        abbr: "Spells"
        current: 0
        max: 0
        color: "#3366cc"
        display: "dots"

  # Skills
  skills:
    type: list
    label: "Skills"
    icon: "⚔️"
    items:
      acrobatics:
        type: number
        label: "Acrobatics"
        baseAbility: "dexterity"
        proficient: false
        expertise: false

      animalHandling:
        type: number
        label: "Animal Handling"
        baseAbility: "wisdom"
        proficient: false
        expertise: false

      arcana:
        type: number
        label: "Arcana"
        baseAbility: "intelligence"
        proficient: false
        expertise: false

      # ... more skills

  # Conditions/Status Effects
  statusEffects:
    type: list
    label: "Conditions"
    icon: "✨"
    items:
      name:
        type: text
        label: "Condition Name"

      duration:
        type: number
        label: "Rounds Remaining"
        min: 0

      effect:
        type: text
        label: "Effect Description"

  # Inventory (simplified)
  inventory:
    type: object
    label: "Equipment"
    icon: "🎒"
    properties:
      carried:
        type: list
        label: "Carried Items"

      worn:
        type: list
        label: "Worn Armor"

      gold:
        type: number
        label: "Gold Pieces"
        abbr: "GP"
        default: 0

  # Character Identity
  identity:
    type: object
    label: "Character Info"
    properties:
      name:
        type: text
        label: "Name"
        required: true

      race:
        type: text
        label: "Race"

      class:
        type: text
        label: "Class"

      level:
        type: number
        label: "Level"
        min: 1
        max: 20
        default: 1

      background:
        type: text
        label: "Background"

# Progression tables for lookup() function
tables:
  proficiency_bonus:
    1: 2
    2: 2
    3: 2
    4: 2
    5: 3
    6: 3
    7: 3
    8: 3
    9: 4
    10: 4
    11: 4
    12: 4
    13: 5
    14: 5
    15: 5
    16: 5
    17: 6
    18: 6
    19: 6
    20: 6

  spell_slots:
    # Wizard spell slots by level and spell level
    1: [2, 0, 0, 0, 0, 0, 0, 0, 0]
    2: [3, 0, 0, 0, 0, 0, 0, 0, 0]
    3: [4, 2, 0, 0, 0, 0, 0, 0, 0]
    # ... more levels

# Custom UI overrides (optional - for pixel-perfect layouts)
customUI:
  # Most components use dynamic generation
  # Optionally override specific components with custom HTML/CSS
  coreAbilities:
    template: "custom-templates/dnd5e-abilities.html"
    style: "custom-templates/dnd5e-abilities.css"

# Prompt template for AI generation
prompts:
  stats: |
    Character Stats
    ---
    HP: [@resources.hitPoints.current/@resources.hitPoints.max]
    Spell Slots: [@resources.spellSlots.current/@resources.spellSlots.max]
    Conditions: [List active conditions or "None"]

  skills: |
    Skills
    ---
    [Skill Name]: [Modifier] | [Proficiency Status]
    (List all relevant skills for the current scene)

# Widget layout suggestions
layout:
  defaultTabs:
    - name: "Combat"
      widgets:
        - type: "resources"
          component: "resources"
          x: 0
          y: 0
          w: 4
          h: 3

        - type: "skills"
          component: "skills"
          filter: ["acrobatics", "athletics", "stealth"]
          x: 4
          y: 0
          w: 4
          h: 4

        - type: "statusEffects"
          component: "statusEffects"
          x: 8
          y: 0
          w: 4
          h: 2

    - name: "Character"
      widgets:
        - type: "coreAbilities"
          component: "coreAbilities"
          x: 0
          y: 0
          w: 6
          h: 3

        - type: "identity"
          component: "identity"
          x: 6
          y: 0
          w: 6
          h: 3
```

---

## Component Types

### 1. Object Components
Group related properties together.

```yaml
identity:
  type: object
  properties:
    name:
      type: text
    age:
      type: number
```

**Rendered as:** Card with labeled fields

### 2. List Components
Collections of items.

```yaml
skills:
  type: list
  items:
    name:
      type: text
    value:
      type: number
```

**Rendered as:** Vertical list, table, or grid

### 3. Resource Components
Tracked pools with current/max values.

```yaml
hitPoints:
  type: resource
  current: 10
  max: 20
  display: "bar"
```

**Rendered as:** Progress bar or numeric display

### 4. Formula Components
Derived values calculated from other components.

```yaml
armorClass:
  type: formula
  formula: "10 + @abilityModifiers.dex_mod + @equipment.armor.bonus"
```

**Rendered as:** Read-only calculated value

---

## Character Instance Layer (JSON)

### Instance Structure

Character data stored in `extensionSettings.characterInstance`:

```javascript
extensionSettings.characterInstance = {
  schemaId: "dnd5e-v1.0.0",          // Which schema this uses
  schemaVersion: "1.0.0",             // Schema version

  data: {
    // Component data matching schema structure
    coreAbilities: {
      strength: 16,
      dexterity: 14,
      constitution: 15,
      intelligence: 10,
      wisdom: 12,
      charisma: 8
    },

    abilityModifiers: {
      // Calculated automatically via formula
      str_mod: 3,
      dex_mod: 2,
      con_mod: 2,
      int_mod: 0,
      wis_mod: 1,
      cha_mod: -1
    },

    resources: {
      hitPoints: {
        current: 12,
        max: 22
      },
      spellSlots: {
        current: 3,
        max: 4
      }
    },

    skills: [
      { name: "Acrobatics", value: 2, proficient: false },
      { name: "Athletics", value: 5, proficient: true },
      { name: "Stealth", value: 4, proficient: true }
      // ... more skills
    ],

    statusEffects: [
      { name: "Blessed", duration: 10, effect: "+1d4 to attacks" }
    ],

    inventory: {
      carried: ["Longsword", "Shield", "Healing Potion x2"],
      worn: ["Chain Mail"],
      gold: 47
    },

    identity: {
      name: "Ragnar",
      race: "Human",
      class: "Fighter",
      level: 3,
      background: "Soldier"
    }
  },

  // Metadata
  createdAt: "2025-10-23T12:00:00Z",
  updatedAt: "2025-10-23T14:30:00Z"
};
```

---

## Formula Engine

### Formula Syntax (Enhanced)

The formula engine supports progressively complex expressions to handle the wide range of TTRPG mechanics.

#### Level 1: Basic Math and References

```javascript
// @ references components in character instance
@coreAbilities.strength           // → 16
@abilityModifiers.str_mod          // → 3
@resources.hitPoints.max           // → 22

// Math operators
floor((@coreAbilities.strength - 10) / 2)  // → 3
@coreAbilities.strength + 5                // → 21
(@level * 2) + @abilityModifiers.con_mod   // → 8
```

#### Level 2: Conditional Logic

```javascript
// Ternary operator
@coreAbilities.strength > 15 ? "Strong" : "Weak"

// Complex conditions
@coreAbilities.strength >= 13 && @coreAbilities.dexterity >= 13 ? 2 : 0

// Nested conditionals
@level >= 20 ? 6 : (@level >= 17 ? 5 : (@level >= 13 ? 4 : 3))
```

#### Level 3: Functions and Lookups

```javascript
// Built-in functions
min(@coreAbilities.strength, @coreAbilities.dexterity)
max(@resources.hitPoints.current, 0)
clamp(@skills.stealth.value, 0, 20)

// Boolean functions
hasFeature("shield_master")
hasTrait("undead")
isProficient("athletics")

// Table lookups (for complex progression tables)
lookup("proficiency_bonus", @level)  // → Returns value from table
lookup("spell_slots", @level, @spellcaster_class)

// Array operations
sum(@inventory.weapons.*.damage)
count(@statusEffects)
```

#### Level 4: String Manipulation

```javascript
// String concatenation
concat(@identity.firstName, " ", @identity.lastName)

// String formatting
format("Level {0} {1}", @level, @identity.class)

// Conditional text
@resources.hitPoints.current > 0 ? "Alive" : "Unconscious"
```

### Safe Expression Parser

```javascript
// src/systems/schema/formulaEngine.js

export class FormulaEngine {
  constructor(characterData) {
    this.data = characterData;
    this.cache = new Map(); // Memoize calculated values
  }

  // Evaluate formula string
  evaluate(formula) {
    // Check cache first
    if (this.cache.has(formula)) {
      return this.cache.get(formula);
    }

    // Replace @ references with actual values
    const resolved = this.resolveReferences(formula);

    // Safe eval using Function constructor (sandboxed)
    try {
      const result = this.safeEval(resolved);
      this.cache.set(formula, result);
      return result;
    } catch (error) {
      console.error('[Formula Engine] Error evaluating:', formula, error);
      return 0; // Fallback
    }
  }

  // Replace @component.path with actual values
  resolveReferences(formula) {
    const refRegex = /@([a-zA-Z0-9_.]+)/g;

    return formula.replace(refRegex, (match, path) => {
      const value = this.getValueByPath(path);
      return value !== undefined ? value : 0;
    });
  }

  // Get nested value from character data
  getValueByPath(path) {
    const parts = path.split('.');
    let value = this.data;

    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = value[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  // Safe evaluation (whitelist functions)
  safeEval(expression) {
    const allowedFunctions = {
      // Math functions
      floor: Math.floor,
      ceil: Math.ceil,
      round: Math.round,
      abs: Math.abs,
      min: Math.min,
      max: Math.max,
      pow: Math.pow,
      sqrt: Math.sqrt,

      // Utility functions
      clamp: (val, min, max) => Math.max(min, Math.min(max, val)),

      // Boolean functions (check character data)
      hasFeature: (featureName) => {
        return this.data.features?.some(f => f.name === featureName) || false;
      },
      hasTrait: (traitName) => {
        return this.data.traits?.includes(traitName) || false;
      },
      isProficient: (skillName) => {
        return this.data.skills?.find(s => s.name === skillName)?.proficient || false;
      },

      // Table lookup functions
      lookup: (tableName, ...keys) => {
        return this.lookupTable(tableName, keys);
      },

      // Array operations
      sum: (array) => Array.isArray(array) ? array.reduce((a, b) => a + b, 0) : 0,
      count: (array) => Array.isArray(array) ? array.length : 0,

      // String functions
      concat: (...strings) => strings.join(''),
      format: (template, ...args) => {
        return template.replace(/\{(\d+)\}/g, (match, index) => args[index] || '');
      }
    };

    // Create sandboxed function
    const func = new Function(...Object.keys(allowedFunctions), `return ${expression}`);

    // Execute with whitelisted functions
    return func(...Object.values(allowedFunctions));
  }

  // Lookup value from a progression table defined in schema
  lookupTable(tableName, keys) {
    const tables = this.schema.tables || {};
    const table = tables[tableName];

    if (!table) {
      console.warn(`[Formula Engine] Table not found: ${tableName}`);
      return 0;
    }

    // Simple single-key lookup
    if (keys.length === 1) {
      return table[keys[0]] || 0;
    }

    // Multi-key lookup (for 2D tables)
    let value = table;
    for (const key of keys) {
      value = value?.[key];
      if (value === undefined) return 0;
    }

    return value;
  }

  // Clear cache (call when character data changes)
  invalidateCache() {
    this.cache.clear();
  }
}

// Usage:
const engine = new FormulaEngine(characterInstance.data);
const strMod = engine.evaluate("floor((@coreAbilities.strength - 10) / 2)");
console.log('STR Modifier:', strMod); // → 3
```

---

## Schema Validation

### JSON Schema Integration

Use JSON Schema to validate character instances:

```javascript
// src/systems/schema/validator.js

import Ajv from 'ajv'; // Lightweight JSON Schema validator

export class SchemaValidator {
  constructor() {
    this.ajv = new Ajv({ allErrors: true });
  }

  // Convert YAML schema to JSON Schema
  compileSchema(yamlSchema) {
    const jsonSchema = {
      type: 'object',
      properties: {},
      required: []
    };

    // Convert each component to JSON Schema property
    for (const [componentName, component] of Object.entries(yamlSchema.components)) {
      jsonSchema.properties[componentName] = this.convertComponent(component);

      if (component.required) {
        jsonSchema.required.push(componentName);
      }
    }

    return this.ajv.compile(jsonSchema);
  }

  // Convert component definition to JSON Schema
  convertComponent(component) {
    switch (component.type) {
      case 'object':
        return {
          type: 'object',
          properties: this.convertProperties(component.properties)
        };

      case 'list':
        return {
          type: 'array',
          items: this.convertComponent(component.items)
        };

      case 'resource':
        return {
          type: 'object',
          properties: {
            current: { type: 'number' },
            max: { type: 'number' }
          },
          required: ['current', 'max']
        };

      case 'number':
        return {
          type: 'number',
          minimum: component.min,
          maximum: component.max,
          default: component.default
        };

      case 'text':
        return {
          type: 'string',
          minLength: component.minLength,
          maxLength: component.maxLength
        };

      case 'formula':
        // Formulas are always numbers
        return { type: 'number' };

      default:
        return { type: 'string' };
    }
  }

  // Validate character instance against schema
  validate(characterInstance, schema) {
    const compiled = this.compileSchema(schema);
    const valid = compiled(characterInstance.data);

    if (!valid) {
      return {
        valid: false,
        errors: compiled.errors
      };
    }

    return { valid: true };
  }
}
```

---

## Storage Layer

### Hybrid Storage Strategy (Gemini Recommendation)

**IndexedDB** for internal operations:
- Fast local access
- Query capabilities
- No size limits (within reason)

**File System Access API** for import/export:
- User-friendly YAML files
- Version control compatible
- Shareable with community

```javascript
// src/systems/schema/storage.js

export class SchemaStorage {
  constructor() {
    this.db = null;
    this.init();
  }

  async init() {
    // Initialize IndexedDB
    const request = indexedDB.open('RPGCompanionSchemas', 1);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Schemas store
      if (!db.objectStoreNames.contains('schemas')) {
        const schemaStore = db.createObjectStore('schemas', { keyPath: 'id' });
        schemaStore.createIndex('name', 'meta.name');
        schemaStore.createIndex('version', 'meta.version');
      }

      // Character instances store
      if (!db.objectStoreNames.contains('characters')) {
        const charStore = db.createObjectStore('characters', { keyPath: 'id' });
        charStore.createIndex('schemaId', 'schemaId');
        charStore.createIndex('name', 'data.identity.name');
      }
    };

    request.onsuccess = (event) => {
      this.db = event.target.result;
      console.log('[Schema Storage] IndexedDB initialized');
    };
  }

  // Save schema to IndexedDB
  async saveSchema(schema) {
    const transaction = this.db.transaction(['schemas'], 'readwrite');
    const store = transaction.objectStore('schemas');

    const schemaWithId = {
      id: `${schema.meta.name}-v${schema.meta.version}`,
      ...schema,
      savedAt: new Date().toISOString()
    };

    await store.put(schemaWithId);
    return schemaWithId.id;
  }

  // Load schema from IndexedDB
  async loadSchema(schemaId) {
    const transaction = this.db.transaction(['schemas'], 'readonly');
    const store = transaction.objectStore('schemas');

    return new Promise((resolve, reject) => {
      const request = store.get(schemaId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // List all schemas
  async listSchemas() {
    const transaction = this.db.transaction(['schemas'], 'readonly');
    const store = transaction.objectStore('schemas');

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Export schema to YAML file
  async exportSchema(schemaId) {
    const schema = await this.loadSchema(schemaId);

    // Convert to YAML
    const yaml = this.toYAML(schema);

    // Use File System Access API (if available)
    if ('showSaveFilePicker' in window) {
      const handle = await window.showSaveFilePicker({
        suggestedName: `${schema.meta.name}.yaml`,
        types: [{
          description: 'YAML Schema',
          accept: { 'text/yaml': ['.yaml', '.yml'] }
        }]
      });

      const writable = await handle.createWritable();
      await writable.write(yaml);
      await writable.close();
    } else {
      // Fallback: download blob
      const blob = new Blob([yaml], { type: 'text/yaml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${schema.meta.name}.yaml`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  // Import schema from YAML file
  async importSchema() {
    // Use File System Access API (if available)
    if ('showOpenFilePicker' in window) {
      const [handle] = await window.showOpenFilePicker({
        types: [{
          description: 'YAML Schema',
          accept: { 'text/yaml': ['.yaml', '.yml'] }
        }]
      });

      const file = await handle.getFile();
      const yaml = await file.text();
      const schema = this.fromYAML(yaml);

      // Validate and save
      await this.saveSchema(schema);
      return schema;
    } else {
      // Fallback: file input
      return new Promise((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.yaml,.yml';

        input.onchange = async (e) => {
          const file = e.target.files[0];
          const yaml = await file.text();
          const schema = this.fromYAML(yaml);
          await this.saveSchema(schema);
          resolve(schema);
        };

        input.click();
      });
    }
  }

  // Convert schema object to YAML string
  toYAML(schema) {
    // Use js-yaml library
    return jsyaml.dump(schema, {
      indent: 2,
      lineWidth: 80,
      noRefs: true
    });
  }

  // Parse YAML string to schema object
  fromYAML(yaml) {
    // Use js-yaml library
    return jsyaml.load(yaml);
  }
}
```

---

## Custom UI Override System

### Rationale

While dynamic UI generation from schema definitions is powerful and efficient, some game systems benefit from highly stylized, pixel-perfect layouts that match their official character sheets. The Custom UI Override System allows schema authors to optionally provide custom HTML/CSS for specific components while maintaining the benefits of schema-driven data management.

### Hybrid Approach

```yaml
# In system.yaml

customUI:
  # Override specific components with custom templates
  coreAbilities:
    template: "custom-templates/dnd5e-abilities.html"
    style: "custom-templates/dnd5e-abilities.css"

  # Other components use dynamic generation (default behavior)
  # skills: (auto-generated)
  # resources: (auto-generated)
```

### Custom Template Structure

```html
<!-- custom-templates/dnd5e-abilities.html -->
<div class="dnd5e-abilities-grid">
  <div class="ability-card" data-ability="strength">
    <div class="ability-label">STR</div>
    <div class="ability-score" data-bind="@coreAbilities.strength">10</div>
    <div class="ability-modifier" data-bind="@abilityModifiers.str_mod">+0</div>
  </div>

  <div class="ability-card" data-ability="dexterity">
    <div class="ability-label">DEX</div>
    <div class="ability-score" data-bind="@coreAbilities.dexterity">10</div>
    <div class="ability-modifier" data-bind="@abilityModifiers.dex_mod">+0</div>
  </div>

  <!-- More ability cards... -->
</div>
```

```css
/* custom-templates/dnd5e-abilities.css */
.dnd5e-abilities-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.ability-card {
  background: linear-gradient(135deg, #8B0000, #4A0000);
  border: 2px solid #FFD700;
  border-radius: 8px;
  padding: 16px;
  text-align: center;
}

.ability-label {
  font-size: 14px;
  font-weight: bold;
  color: #FFD700;
  text-transform: uppercase;
  letter-spacing: 2px;
}

.ability-score {
  font-size: 32px;
  font-weight: bold;
  color: white;
  margin: 8px 0;
}

.ability-modifier {
  font-size: 18px;
  color: #AAA;
}
```

### Data Binding

Custom templates use `data-bind` attributes with the same `@` reference syntax as formulas:

```javascript
// src/systems/schema/customUIRenderer.js

export class CustomUIRenderer {
  constructor(schema, characterInstance, formulaEngine) {
    this.schema = schema;
    this.instance = characterInstance;
    this.formulaEngine = formulaEngine;
  }

  // Render custom UI component
  renderCustomComponent(componentName, container) {
    const customUI = this.schema.customUI?.[componentName];

    if (!customUI) {
      // Fall back to dynamic generation
      return false;
    }

    // Load custom template
    const template = this.loadTemplate(customUI.template);
    const style = this.loadStyle(customUI.style);

    // Inject HTML
    container.innerHTML = template;

    // Inject CSS (scoped to this component)
    this.injectScopedStyles(style, componentName);

    // Bind data to template
    this.bindData(container);

    // Attach event listeners for editable fields
    this.attachEditHandlers(container);

    return true;
  }

  // Bind character data to [data-bind] attributes
  bindData(container) {
    const bindings = container.querySelectorAll('[data-bind]');

    bindings.forEach(element => {
      const reference = element.dataset.bind;

      // Resolve @ reference
      if (reference.startsWith('@')) {
        const path = reference.substring(1);
        const value = this.getValueByPath(path);

        // Update element content
        if (element.tagName === 'INPUT') {
          element.value = value;
        } else {
          element.textContent = value;
        }

        // Store binding for updates
        element.dataset.boundPath = path;
      }
    });
  }

  // Attach edit handlers to bound elements
  attachEditHandlers(container) {
    const editableElements = container.querySelectorAll('[data-bind][contenteditable]');

    editableElements.forEach(element => {
      element.addEventListener('blur', (e) => {
        const path = e.target.dataset.boundPath;
        const value = e.target.textContent.trim();

        // Update character instance
        this.setValueByPath(path, value);

        // Re-calculate formulas
        this.formulaEngine.invalidateCache();

        // Re-render (to update any derived values)
        this.bindData(container);
      });
    });
  }

  // Get value from character data by path
  getValueByPath(path) {
    const parts = path.split('.');
    let value = this.instance.data;

    for (const part of parts) {
      value = value?.[part];
    }

    return value;
  }

  // Set value in character data by path
  setValueByPath(path, value) {
    const parts = path.split('.');
    let obj = this.instance.data;

    for (let i = 0; i < parts.length - 1; i++) {
      obj = obj[parts[i]];
    }

    obj[parts[parts.length - 1]] = value;
  }

  // Load template file
  loadTemplate(templatePath) {
    // Fetch from schemas directory or bundled templates
    // For now, placeholder implementation
    return `<div>Custom template: ${templatePath}</div>`;
  }

  // Load and inject scoped CSS
  injectScopedStyles(css, componentName) {
    // Scope CSS to this component to avoid conflicts
    const scopedCSS = this.scopeCSS(css, `[data-component="${componentName}"]`);

    const style = document.createElement('style');
    style.textContent = scopedCSS;
    style.dataset.component = componentName;

    // Remove old style if exists
    document.querySelector(`style[data-component="${componentName}"]`)?.remove();

    document.head.appendChild(style);
  }

  // Scope CSS rules to a specific selector
  scopeCSS(css, scope) {
    // Simple CSS scoping (could use postcss for production)
    return css.replace(/([^\r\n,{}]+)(,(?=[^}]*{)|\s*{)/g, `${scope} $1$2`);
  }
}
```

### Benefits of Custom UI

1. **Pixel-Perfect Replication** - Match official character sheet layouts exactly
2. **Advanced Styling** - Use complex CSS effects, animations, gradients
3. **Brand Identity** - Maintain game system's visual identity
4. **Performance** - Static HTML faster than complex dynamic generation
5. **Community Templates** - Share beautiful designs without coding

### When to Use Custom UI

- **Official character sheets** - When brand accuracy matters
- **Complex visual layouts** - Intricate positioning, overlapping elements
- **Themed experiences** - Cyberpunk neon, fantasy parchment, horror gothic
- **Special components** - Character portraits, spell cards, inventory grids

### When to Use Dynamic Generation

- **Most components** - Skills lists, stats, resources
- **Rapid prototyping** - Testing new game systems
- **Flexible layouts** - Need to work on mobile and desktop
- **Community schemas** - Easier to create without HTML/CSS knowledge

---

## Data Migration Strategy

### Versioning System

Every schema includes a version number, and character instances track which schema version they were created with. This enables automated migration when schemas are updated.

```yaml
# system.yaml
meta:
  name: "D&D 5th Edition"
  version: "1.2.0"  # Semantic versioning
  author: "RPG Companion Community"
```

```javascript
// character.json
{
  schemaId: "dnd5e-v1.2.0",
  schemaVersion: "1.2.0",
  data: { /* character data */ }
}
```

### Migration Functions

Each schema can define migration functions to transform character data between versions:

```yaml
# system.yaml
migrations:
  - from: "1.0.0"
    to: "1.1.0"
    script: "migrations/1.0.0-to-1.1.0.js"

  - from: "1.1.0"
    to: "1.2.0"
    script: "migrations/1.1.0-to-1.2.0.js"
```

### Migration Script Example

```javascript
// migrations/1.0.0-to-1.1.0.js

/**
 * Migration from v1.0.0 to v1.1.0
 * Changes:
 * - Renamed "classicStats" to "coreAbilities"
 * - Added "abilityModifiers" as derived component
 * - Changed spell slots from single number to object
 */
export function migrate_1_0_0_to_1_1_0(characterData) {
  const migrated = { ...characterData };

  // 1. Rename classicStats to coreAbilities
  if (migrated.classicStats) {
    migrated.coreAbilities = {
      strength: migrated.classicStats.str,
      dexterity: migrated.classicStats.dex,
      constitution: migrated.classicStats.con,
      intelligence: migrated.classicStats.int,
      wisdom: migrated.classicStats.wis,
      charisma: migrated.classicStats.cha
    };
    delete migrated.classicStats;
  }

  // 2. Initialize abilityModifiers (will be calculated by formulas)
  migrated.abilityModifiers = {
    str_mod: 0,
    dex_mod: 0,
    con_mod: 0,
    int_mod: 0,
    wis_mod: 0,
    cha_mod: 0
  };

  // 3. Convert spell slots from number to object
  if (migrated.resources?.spellSlots) {
    const oldValue = migrated.resources.spellSlots;
    migrated.resources.spellSlots = {
      current: typeof oldValue === 'number' ? oldValue : 0,
      max: typeof oldValue === 'number' ? oldValue : 0
    };
  }

  return migrated;
}
```

### Migration Manager

```javascript
// src/systems/schema/migrationManager.js

export class MigrationManager {
  constructor(schemaStorage) {
    this.schemaStorage = schemaStorage;
  }

  // Check if character needs migration
  async needsMigration(characterInstance, currentSchema) {
    const charVersion = characterInstance.schemaVersion;
    const schemaVersion = currentSchema.meta.version;

    return charVersion !== schemaVersion;
  }

  // Migrate character to latest schema version
  async migrateCharacter(characterInstance, currentSchema) {
    const charVersion = characterInstance.schemaVersion;
    const targetVersion = currentSchema.meta.version;

    console.log(`[Migration] Migrating character from ${charVersion} to ${targetVersion}`);

    // Get all migration steps needed
    const migrationPath = this.getMigrationPath(
      charVersion,
      targetVersion,
      currentSchema.migrations || []
    );

    if (migrationPath.length === 0) {
      console.warn('[Migration] No migration path found');
      return characterInstance; // Can't migrate
    }

    // Apply migrations sequentially
    let migratedData = { ...characterInstance.data };

    for (const migration of migrationPath) {
      console.log(`[Migration] Applying: ${migration.from} → ${migration.to}`);

      try {
        // Load and execute migration script
        const migrationFn = await this.loadMigration(migration.script);
        migratedData = migrationFn(migratedData);
      } catch (error) {
        console.error('[Migration] Failed:', error);
        throw new Error(`Migration failed at ${migration.from} → ${migration.to}: ${error.message}`);
      }
    }

    // Update character instance
    return {
      ...characterInstance,
      schemaVersion: targetVersion,
      data: migratedData,
      updatedAt: new Date().toISOString(),
      migratedFrom: charVersion
    };
  }

  // Find shortest migration path between versions
  getMigrationPath(fromVersion, toVersion, migrations) {
    // Build graph of migrations
    const graph = new Map();

    migrations.forEach(m => {
      if (!graph.has(m.from)) {
        graph.set(m.from, []);
      }
      graph.get(m.from).push(m);
    });

    // BFS to find shortest path
    const queue = [[fromVersion, []]];
    const visited = new Set([fromVersion]);

    while (queue.length > 0) {
      const [currentVersion, path] = queue.shift();

      if (currentVersion === toVersion) {
        return path; // Found path
      }

      const neighbors = graph.get(currentVersion) || [];

      for (const migration of neighbors) {
        if (!visited.has(migration.to)) {
          visited.add(migration.to);
          queue.push([migration.to, [...path, migration]]);
        }
      }
    }

    return []; // No path found
  }

  // Load migration script
  async loadMigration(scriptPath) {
    // Dynamic import of migration script
    const module = await import(`/schemas/${scriptPath}`);

    // Migration script should export a function named migrate_X_X_X_to_Y_Y_Y
    const fnName = Object.keys(module).find(key => key.startsWith('migrate_'));

    if (!fnName) {
      throw new Error(`Migration script ${scriptPath} does not export a migration function`);
    }

    return module[fnName];
  }

  // Backup character before migration
  async backupCharacter(characterInstance) {
    const backup = {
      ...characterInstance,
      backedUpAt: new Date().toISOString()
    };

    // Save to separate backup store in IndexedDB
    await this.schemaStorage.saveBackup(backup);

    return backup;
  }

  // Restore character from backup
  async restoreCharacter(backupId) {
    return await this.schemaStorage.loadBackup(backupId);
  }
}
```

### Migration UI Flow

```
User loads character with old schema version
    ↓
App detects version mismatch
    ↓
Show migration prompt:
┌─────────────────────────────────────────┐
│ Character Migration Required            │
├─────────────────────────────────────────┤
│ Your character "Ragnar" was created     │
│ with schema version 1.0.0.              │
│                                         │
│ The current schema is version 1.2.0.   │
│                                         │
│ Changes in new version:                │
│ • Renamed stats for consistency        │
│ • Added ability modifiers              │
│ • Improved spell slot tracking         │
│                                         │
│ A backup will be created automatically.│
│                                         │
│ [Cancel] [Migrate Character]           │
└─────────────────────────────────────────┘
    ↓
Create backup
    ↓
Apply migration(s)
    ↓
Validate migrated data against new schema
    ↓
Show success message
┌─────────────────────────────────────────┐
│ Migration Successful! ✓                 │
├─────────────────────────────────────────┤
│ "Ragnar" has been updated to v1.2.0.   │
│                                         │
│ Backup saved: backup-2025-10-23.json   │
│                                         │
│ [View Backup] [Continue]               │
└─────────────────────────────────────────┘
```

### Migration Best Practices

1. **Always Create Backups** - Automatic backup before any migration
2. **Sequential Migrations** - Chain small migrations (1.0→1.1→1.2) instead of big jumps
3. **Validate After Migration** - Ensure migrated data passes schema validation
4. **Provide Rollback** - Allow users to restore from backup if issues arise
5. **Document Changes** - Clear changelog in migration prompt
6. **Test Thoroughly** - Test migrations with real character data before release

### Version Compatibility Matrix

```javascript
// In schema metadata
compatibility:
  minAppVersion: "2.0.0"    // Minimum RPG Companion version required
  maxAppVersion: null       // No maximum (null = any version)
  breaking: false           // Whether this is a breaking change
```

---

## Widget Integration

### Schema-Driven Widget Rendering

```javascript
// src/systems/dashboard/schemaWidgets.js

export class SchemaWidgetRenderer {
  constructor(schema, characterInstance, formulaEngine) {
    this.schema = schema;
    this.instance = characterInstance;
    this.formulaEngine = formulaEngine;
  }

  // Render component as widget
  renderComponent(componentName, container, config = {}) {
    const component = this.schema.components[componentName];
    const data = this.instance.data[componentName];

    switch (component.type) {
      case 'object':
        this.renderObject(component, data, container);
        break;

      case 'list':
        this.renderList(component, data, container, config);
        break;

      case 'resource':
        this.renderResource(component, data, container);
        break;

      default:
        console.warn('Unknown component type:', component.type);
    }
  }

  // Render object component (e.g., coreAbilities)
  renderObject(component, data, container) {
    const html = `
      <div class="schema-component schema-object">
        <h4>${component.label || 'Component'}</h4>
        <div class="schema-properties">
          ${Object.entries(component.properties).map(([key, prop]) => {
            const value = data?.[key] ?? prop.default ?? '';
            const displayValue = prop.type === 'formula'
              ? this.formulaEngine.evaluate(prop.formula)
              : value;

            return `
              <div class="schema-property">
                <label>${prop.label || key}:</label>
                ${prop.type === 'formula'
                  ? `<span class="schema-value-readonly">${displayValue}</span>`
                  : `<input type="${prop.type === 'number' ? 'number' : 'text'}"
                       value="${displayValue}"
                       data-component="${component.label}"
                       data-property="${key}"
                       ${prop.min ? `min="${prop.min}"` : ''}
                       ${prop.max ? `max="${prop.max}"` : ''} />`
                }
                ${prop.abbr ? `<span class="schema-abbr">(${prop.abbr})</span>` : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    container.innerHTML = html;

    // Add event listeners for editable fields
    container.querySelectorAll('input').forEach(input => {
      input.addEventListener('change', (e) => {
        this.updateProperty(
          e.target.dataset.component,
          e.target.dataset.property,
          e.target.value
        );
      });
    });
  }

  // Render list component (e.g., skills)
  renderList(component, data, container, config) {
    const filter = config.filter; // Optional filter for specific items

    const items = Array.isArray(data) ? data : [];
    const filteredItems = filter
      ? items.filter(item => filter.includes(item.name))
      : items;

    const html = `
      <div class="schema-component schema-list">
        <h4>${component.icon || ''} ${component.label || 'List'}</h4>
        <div class="schema-list-items">
          ${filteredItems.map((item, index) => `
            <div class="schema-list-item">
              ${Object.entries(component.items).map(([key, itemProp]) => {
                const value = item[key] ?? '';
                return `
                  <span class="schema-item-${key}">
                    ${itemProp.label ? `<label>${itemProp.label}:</label>` : ''}
                    ${itemProp.type === 'number'
                      ? `<input type="number" value="${value}" data-index="${index}" data-key="${key}" />`
                      : `<span>${value}</span>`
                    }
                  </span>
                `;
              }).join('')}
            </div>
          `).join('')}
        </div>
        <button class="schema-add-item">+ Add ${component.label}</button>
      </div>
    `;

    container.innerHTML = html;

    // Event listeners for list item editing
    container.querySelectorAll('input').forEach(input => {
      input.addEventListener('change', (e) => {
        this.updateListItem(
          component.label,
          parseInt(e.target.dataset.index),
          e.target.dataset.key,
          e.target.value
        );
      });
    });

    // Add item button
    container.querySelector('.schema-add-item').addEventListener('click', () => {
      this.addListItem(component.label);
    });
  }

  // Render resource component (e.g., HP)
  renderResource(component, data, container) {
    const current = data?.current ?? 0;
    const max = typeof component.max === 'object' && component.max.type === 'formula'
      ? this.formulaEngine.evaluate(component.max.formula)
      : (data?.max ?? 0);

    const percentage = max > 0 ? (current / max) * 100 : 0;
    const color = component.color || '#3366cc';

    const html = `
      <div class="schema-component schema-resource">
        <div class="schema-resource-header">
          <h4>${component.label || 'Resource'}</h4>
          <span class="schema-resource-values">
            <input type="number" class="schema-current" value="${current}" min="0" max="${max}" />
            / ${max}
          </span>
        </div>
        ${component.display === 'bar'
          ? `<div class="schema-resource-bar" style="background: linear-gradient(to right, ${color}, ${color});">
               <div class="schema-resource-fill" style="width: ${100 - percentage}%"></div>
             </div>`
          : `<div class="schema-resource-dots">
               ${Array(max).fill('').map((_, i) => `
                 <span class="schema-dot ${i < current ? 'filled' : ''}" style="background: ${color}"></span>
               `).join('')}
             </div>`
        }
      </div>
    `;

    container.innerHTML = html;

    // Update current value
    container.querySelector('.schema-current').addEventListener('change', (e) => {
      this.updateResource(component.label, 'current', parseInt(e.target.value));
    });
  }

  // Update character property
  updateProperty(componentName, propertyName, value) {
    if (!this.instance.data[componentName]) {
      this.instance.data[componentName] = {};
    }

    this.instance.data[componentName][propertyName] = value;

    // Invalidate formula cache
    this.formulaEngine.invalidateCache();

    // Save character instance
    this.saveInstance();
  }

  // Update list item
  updateListItem(componentName, index, key, value) {
    if (!Array.isArray(this.instance.data[componentName])) {
      this.instance.data[componentName] = [];
    }

    if (!this.instance.data[componentName][index]) {
      this.instance.data[componentName][index] = {};
    }

    this.instance.data[componentName][index][key] = value;

    this.saveInstance();
  }

  // Add new list item
  addListItem(componentName) {
    if (!Array.isArray(this.instance.data[componentName])) {
      this.instance.data[componentName] = [];
    }

    // Create empty item based on component definition
    const component = this.schema.components[componentName];
    const newItem = {};

    for (const [key, prop] of Object.entries(component.items)) {
      newItem[key] = prop.default ?? '';
    }

    this.instance.data[componentName].push(newItem);

    this.saveInstance();

    // Re-render component
    this.renderComponent(componentName, container);
  }

  // Update resource value
  updateResource(componentName, field, value) {
    if (!this.instance.data[componentName]) {
      this.instance.data[componentName] = {};
    }

    this.instance.data[componentName][field] = value;

    this.saveInstance();
  }

  // Save character instance
  saveInstance() {
    // Update timestamp
    this.instance.updatedAt = new Date().toISOString();

    // Save to extension settings
    updateExtensionSettings({ characterInstance: this.instance });

    // Persist to storage
    saveSettings();
  }
}
```

---

## AI Prompt Generation

### Dynamic Prompt Builder

```javascript
// src/systems/generation/schemaPromptBuilder.js

export function generateSchemaPrompt(schema, characterInstance) {
  let prompt = '';

  // Use schema's prompt templates
  if (schema.prompts) {
    for (const [section, template] of Object.entries(schema.prompts)) {
      // Replace [@component.path] with actual values
      const resolved = resolvePromptTemplate(template, characterInstance.data);
      prompt += resolved + '\n\n';
    }
  } else {
    // Fallback: auto-generate from components
    for (const [name, component] of Object.entries(schema.components)) {
      prompt += generateComponentPrompt(name, component, characterInstance.data[name]);
      prompt += '\n\n';
    }
  }

  return prompt.trim();
}

// Resolve [@reference] syntax in prompt templates
function resolvePromptTemplate(template, data) {
  const refRegex = /\[@([a-zA-Z0-9_.]+)\]/g;

  return template.replace(refRegex, (match, path) => {
    const value = getValueByPath(data, path);
    return value !== undefined ? value : '[Unknown]';
  });
}

// Auto-generate prompt for a component
function generateComponentPrompt(name, component, data) {
  let prompt = `${component.label || name}\n---\n`;

  switch (component.type) {
    case 'object':
      for (const [key, prop] of Object.entries(component.properties)) {
        const value = data?.[key] ?? prop.default ?? '';
        prompt += `${prop.label || key}: ${value}\n`;
      }
      break;

    case 'list':
      if (Array.isArray(data)) {
        data.forEach(item => {
          const values = Object.entries(component.items)
            .map(([key, prop]) => `${prop.label || key}: ${item[key]}`)
            .join(' | ');
          prompt += `${values}\n`;
        });
      }
      break;

    case 'resource':
      prompt += `${component.label}: ${data?.current ?? 0}/${data?.max ?? 0}\n`;
      break;
  }

  return prompt;
}
```

---

## Migration from Hardcoded to Schema

### Backward Compatibility Strategy

1. **Keep existing hardcoded mode** as fallback
2. **Detect schema presence** to switch modes
3. **Provide migration wizard** to convert existing characters

```javascript
// src/systems/schema/migration.js

export async function migrateToSchema() {
  const currentStats = extensionSettings.userStats;
  const currentClassicStats = extensionSettings.classicStats;
  const currentLevel = extensionSettings.level;

  // Load D&D 5e schema as default
  const dnd5eSchema = await schemaStorage.loadSchema('dnd5e-v1.0.0');

  // Map existing data to schema
  const characterInstance = {
    schemaId: 'dnd5e-v1.0.0',
    schemaVersion: '1.0.0',
    data: {
      coreAbilities: {
        strength: currentClassicStats.str,
        dexterity: currentClassicStats.dex,
        constitution: currentClassicStats.con,
        intelligence: currentClassicStats.int,
        wisdom: currentClassicStats.wis,
        charisma: currentClassicStats.cha
      },

      resources: {
        hitPoints: {
          current: Math.round(currentStats.health),
          max: 100 // Default, user can change
        }
      },

      identity: {
        name: getContext().name1,
        level: currentLevel
      },

      inventory: currentStats.inventory
    },

    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Save migrated instance
  await schemaStorage.saveCharacterInstance(characterInstance);

  // Enable schema mode
  updateExtensionSettings({
    schemaMode: true,
    activeSchemaId: 'dnd5e-v1.0.0',
    characterInstance
  });

  console.log('[Schema Migration] Successfully migrated to D&D 5e schema');
}
```

---

## Schema Editor UI

### Visual Builder (Future)

```
┌─────────────────────────────────────────────────────────┐
│ Schema Editor: D&D 5e                          [Save] [×]│
├─────────────────────────────────────────────────────────┤
│ ┌─ Components ──────┐ ┌─ Editor ───────────────────────┐│
│ │ + Core Abilities  │ │ Component: Core Abilities      ││
│ │ + Ability Mods    │ │                                ││
│ │ + Resources       │ │ Type: [Object ▼]               ││
│ │ + Skills          │ │ Label: [Core Abilities]        ││
│ │ + Status Effects  │ │ Icon: [🎲]                     ││
│ │ + Inventory       │ │                                ││
│ │ + Identity        │ │ Properties:                    ││
│ │                   │ │ ┌──────────────────────────────┐││
│ │ [+ Add Component] │ │ │ strength                     │││
│ └───────────────────┘ │ │  Type: number                │││
│                       │ │  Label: "Strength"           │││
│                       │ │  Min: 1, Max: 30             │││
│                       │ │  Default: 10                 │││
│                       │ │ [Edit] [Delete]              │││
│                       │ │                              │││
│                       │ │ dexterity                    │││
│                       │ │  Type: number                │││
│                       │ │  ...                         │││
│                       │ └──────────────────────────────┘││
│                       │ [+ Add Property]                ││
│                       └────────────────────────────────┘│
│                                                          │
│ [YAML View] [Visual Builder]                            │
└─────────────────────────────────────────────────────────┘
```

---

## Success Criteria

- ✅ Users can import D&D 5e schema YAML
- ✅ Character instance validates against schema
- ✅ Formula engine calculates derived stats correctly
- ✅ Schema-driven widgets render dynamically
- ✅ Users can edit character data through widgets
- ✅ AI prompts generate based on schema
- ✅ Export/import workflows work reliably
- ✅ Backward compatibility maintained (hardcoded mode still works)
- ✅ Migration wizard converts existing characters to schema

---

## Open Questions

1. **Schema Marketplace:** Should we host community schemas on GitHub?
2. **Version Compatibility:** How to handle schema version upgrades?
3. **Formula Complexity:** Limit formula depth to prevent infinite loops?
4. **Multi-Character:** Support multiple character instances with different schemas?
5. **Real-Time Sync:** Should formulas recalculate on every input change or debounced?

---

## Next Steps

1. Implement YAML parser and validator
2. Build formula engine with safe evaluation
3. Create IndexedDB storage layer
4. Develop schema-driven widget renderer
5. Design schema editor UI (YAML + visual builder)
6. Create D&D 5e reference schema
7. Build migration wizard
8. Write documentation and tutorials
