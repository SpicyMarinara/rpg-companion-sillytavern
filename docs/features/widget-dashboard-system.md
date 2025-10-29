# Widget Dashboard System

**Status:** Design Phase
**Priority:** Critical (Foundation for Schema System)
**Target Version:** 2.0.0

---

## Overview

Transform RPG Companion from a static, hardcoded panel into a fully customizable widget-based dashboard where users can create tabs, drag-and-drop widgets, and arrange their perfect RPG tracking interface.

### Core Philosophy
> "This is SillyTavern - users should be able to do whatever the fuck they want"

No "modes", no training wheels, no limitations. Just pure customization.

---

## Key Features

### 1. Dynamic Tabs
- **User-created tabs**: Create unlimited tabs with custom names
- **Tab management**: Rename, delete, reorder, duplicate tabs
- **Default tabs**: Ships with "Status" and "Inventory" (user can modify/delete)
- **Tab icons**: Optional emoji/icon per tab
- **Tab context**: Each tab has independent widget layout

### 2. Widget Grid System
- **12-column responsive grid** (like Bootstrap)
- **Variable row height** (default: 80px, user-configurable)
- **Drag-and-drop** with smooth animations
- **Auto-snap to grid** positions (toggleable)
- **Resize handles** on widget corners
- **Collision detection** and auto-reflow

### 3. Widget Library

#### Core Widgets (Always Available)
```javascript
{
  userStats: {
    name: 'User Stats',
    icon: '❤️',
    description: 'Health, energy, satiety, hygiene, arousal bars',
    minSize: { w: 2, h: 2 },
    defaultSize: { w: 4, h: 3 },
    requiresSchema: false
  },

  infoBox: {
    name: 'Info Box',
    icon: '📅',
    description: 'Date, weather, temperature, time, location dashboard',
    minSize: { w: 3, h: 2 },
    defaultSize: { w: 6, h: 2 },
    requiresSchema: false
  },

  presentCharacters: {
    name: 'Present Characters',
    icon: '👥',
    description: 'Character cards with avatars and traits',
    minSize: { w: 2, h: 2 },
    defaultSize: { w: 6, h: 3 },
    requiresSchema: false
  },

  inventory: {
    name: 'Inventory',
    icon: '🎒',
    description: 'On Person, Stored, Assets with list/grid views',
    minSize: { w: 3, h: 3 },
    defaultSize: { w: 6, h: 4 },
    requiresSchema: false
  },

  classicStats: {
    name: 'Classic Stats',
    icon: '🎲',
    description: 'D&D-style STR/DEX/CON/INT/WIS/CHA with +/- buttons',
    minSize: { w: 2, h: 2 },
    defaultSize: { w: 3, h: 3 },
    requiresSchema: false
  },

  diceRoller: {
    name: 'Dice Roller',
    icon: '🎲',
    description: 'Interactive dice roller with formula input',
    minSize: { w: 2, h: 1 },
    defaultSize: { w: 3, h: 2 },
    requiresSchema: false
  },

  lastRoll: {
    name: 'Last Roll',
    icon: '🎯',
    description: 'Display of most recent dice roll result',
    minSize: { w: 1, h: 1 },
    defaultSize: { w: 2, h: 1 },
    requiresSchema: false
  }
}
```

#### Schema-Driven Widgets (Require Active Schema)
```javascript
{
  customStats: {
    name: 'Custom Stats',
    icon: '📊',
    description: 'Schema-defined stats with formula support',
    minSize: { w: 2, h: 2 },
    defaultSize: { w: 4, h: 3 },
    requiresSchema: true
  },

  skills: {
    name: 'Skills',
    icon: '⚔️',
    description: 'Schema-defined skills with progression',
    minSize: { w: 2, h: 3 },
    defaultSize: { w: 4, h: 4 },
    requiresSchema: true
  },

  relationships: {
    name: 'Relationships',
    icon: '💕',
    description: 'Character relationship tracker with affection values',
    minSize: { w: 3, h: 2 },
    defaultSize: { w: 6, h: 3 },
    requiresSchema: true
  },

  quests: {
    name: 'Quest Log',
    icon: '📜',
    description: 'Active/completed quests with objectives',
    minSize: { w: 3, h: 3 },
    defaultSize: { w: 6, h: 4 },
    requiresSchema: true
  },

  statusEffects: {
    name: 'Status Effects',
    icon: '✨',
    description: 'Active buffs/debuffs with duration tracking',
    minSize: { w: 2, h: 2 },
    defaultSize: { w: 4, h: 2 },
    requiresSchema: true
  },

  resources: {
    name: 'Resources',
    icon: '⚡',
    description: 'Schema-defined resource pools (mana, stamina, etc.)',
    minSize: { w: 2, h: 2 },
    defaultSize: { w: 3, h: 2 },
    requiresSchema: true
  }
}
```

#### Meta Widgets
```javascript
{
  schemaEditor: {
    name: 'Schema Editor',
    icon: '⚙️',
    description: 'Inline YAML/visual editor for system schema',
    minSize: { w: 4, h: 4 },
    defaultSize: { w: 8, h: 6 },
    requiresSchema: false
  },

  debugConsole: {
    name: 'Debug Console',
    icon: '🐛',
    description: 'Parser logs and debug output (mobile-friendly)',
    minSize: { w: 3, h: 2 },
    defaultSize: { w: 6, h: 3 },
    requiresSchema: false
  },

  quickSettings: {
    name: 'Quick Settings',
    icon: '⚙️',
    description: 'Most-used settings without opening modal',
    minSize: { w: 2, h: 2 },
    defaultSize: { w: 3, h: 3 },
    requiresSchema: false
  }
}
```

---

## User Interface Design

### Edit Mode Toggle

**View Mode** (Default):
```
┌──────────────────────────────────────────────────────────┐
│ RPG Companion                            [⚙️] [Edit] [×] │
├──────────────────────────────────────────────────────────┤
│ Combat │ Social │ Inventory │ Lore │ +                   │
└──────────────────────────────────────────────────────────┘
│                                                           │
│  [Widgets render here in locked positions]               │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

**Edit Mode** (Active):
```
┌──────────────────────────────────────────────────────────┐
│ RPG Companion                   [Save] [Cancel] [Reset]  │
├──────────────────────────────────────────────────────────┤
│ Combat │ Social │ + │                  [Rename] [Delete] │
└──────────────────────────────────────────────────────────┘
│ ┌─ Widget Library ────────────┐                          │
│ │ Core Widgets:               │ ┌──────────────┐         │
│ │ [+ User Stats]              │ │ Widget       │ [×] [↔] │
│ │ [+ Info Box]                │ │ (draggable)  │         │
│ │ [+ Present Characters]      │ └──────────────┘         │
│ │ [+ Inventory]               │                          │
│ │ [+ Classic Stats]           │ [Drop widgets here]      │
│ │                             │ [12-column grid visible] │
│ │ Schema Widgets:             │                          │
│ │ [+ Skills] (need schema)    │                          │
│ │ [+ Relationships]           │                          │
│ │ [+ Quests]                  │                          │
│ └────────────────────────────┘                          │
└──────────────────────────────────────────────────────────┘
```

### Widget Header (Edit Mode)

Each widget shows controls when in edit mode:

```
┌─────────────────────────────────────┐
│ User Stats               [↔] [×] [⚙]│ ← Drag, Delete, Settings
├─────────────────────────────────────┤
│                                     │
│  [Widget content]                   │
│                                     │
└─────────────────────────────────────┘
  ↖ Resize handle
```

### Grid Visualization

When in edit mode, show semi-transparent grid lines:

```
┌─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┐ ← 12 columns
│ │ │ │ │ │ │ │ │ │ │ │ │
├─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┤
│                       │ ← Rows (80px each)
├───────────────────────┤
│                       │
└───────────────────────┘
```

---

## Mobile Behavior

### Responsive Strategy

**Mobile (≤1000px width):**
- Force single-column layout (widgets stack vertically)
- Maintain user's widget order from desktop
- Allow drag-to-reorder within column
- No resize handles (fixed width = 100%)
- Tabs become horizontal scrollable

**Example Mobile View:**
```
┌──────────────────────┐
│ Combat ▼             │ ← Dropdown for tabs
└──────────────────────┘
│ User Stats           │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  │
├──────────────────────┤
│ Skills               │
│ - Lockpicking: 75    │
│ - Stealth: 60        │
├──────────────────────┤
│ Inventory            │
│ On Person: 3 items   │
└──────────────────────┘
  [drag handles for reorder]
```

---

## Data Structure

### Dashboard Configuration

Stored in `extensionSettings.dashboard`:

```javascript
extensionSettings.dashboard = {
  version: 2, // Dashboard config version

  gridConfig: {
    columns: 12,           // Grid columns
    rowHeight: 80,         // Pixels per row
    gap: 12,               // Gap between widgets (px)
    snapToGrid: true,      // Auto-snap enabled
    showGrid: true         // Show grid lines in edit mode
  },

  tabs: [
    {
      id: 'tab-combat',    // Unique ID (generated)
      name: 'Combat',      // User-editable name
      icon: '⚔️',          // Optional emoji/icon
      order: 0,            // Tab order
      widgets: [
        {
          id: 'widget-1',         // Unique widget instance ID
          type: 'userStats',      // Widget type from registry
          x: 0,                   // Grid column (0-11)
          y: 0,                   // Grid row (0-infinity)
          w: 4,                   // Width in columns
          h: 3,                   // Height in rows
          config: {               // Widget-specific config
            showClassicStats: true,
            statBarStyle: 'gradient'
          }
        },
        {
          id: 'widget-2',
          type: 'skills',
          x: 4,
          y: 0,
          w: 4,
          h: 4,
          config: {
            category: 'Combat',
            sortBy: 'value'
          }
        }
        // ... more widgets
      ]
    },
    {
      id: 'tab-social',
      name: 'Social',
      icon: '💬',
      order: 1,
      widgets: [
        // ... widgets for this tab
      ]
    }
  ],

  defaultTab: 'tab-combat' // Which tab to show on load
};
```

### Default Layout

First-time users get this default layout:

```javascript
const DEFAULT_DASHBOARD = {
  tabs: [
    {
      id: 'tab-status',
      name: 'Status',
      icon: '📊',
      widgets: [
        { type: 'userStats', x: 0, y: 0, w: 6, h: 3 },
        { type: 'infoBox', x: 6, y: 0, w: 6, h: 2 },
        { type: 'presentCharacters', x: 0, y: 3, w: 12, h: 3 }
      ]
    },
    {
      id: 'tab-inventory',
      name: 'Inventory',
      icon: '🎒',
      widgets: [
        { type: 'inventory', x: 0, y: 0, w: 12, h: 6 }
      ]
    }
  ]
};
```

---

## Implementation Architecture

### Module Structure

```
src/systems/dashboard/
├── gridEngine.js        # Core grid layout engine
├── widgetRegistry.js    # Widget type definitions
├── dragDrop.js          # Drag-and-drop logic
├── tabManager.js        # Tab CRUD operations
├── layoutPersistence.js # Save/load layouts
└── editMode.js          # Edit mode UI state
```

### Widget Registry System

```javascript
// src/systems/dashboard/widgetRegistry.js

export class WidgetRegistry {
  constructor() {
    this.widgets = new Map();
  }

  register(type, definition) {
    this.widgets.set(type, {
      ...definition,
      render: definition.render.bind(definition)
    });
  }

  get(type) {
    return this.widgets.get(type);
  }

  getAvailable(hasSchema = false) {
    return Array.from(this.widgets.values())
      .filter(w => !w.requiresSchema || hasSchema);
  }
}

// Usage:
const registry = new WidgetRegistry();

registry.register('userStats', {
  name: 'User Stats',
  icon: '❤️',
  minSize: { w: 2, h: 2 },
  defaultSize: { w: 4, h: 3 },
  requiresSchema: false,

  render(container, config) {
    // Reuse existing renderUserStats() logic
    renderUserStats(container, config);
  },

  getConfig() {
    // Return editable config options for settings
    return {
      showClassicStats: { type: 'boolean', default: true },
      statBarStyle: { type: 'select', options: ['solid', 'gradient'] }
    };
  }
});
```

### Grid Engine

```javascript
// src/systems/dashboard/gridEngine.js

export class GridEngine {
  constructor(config) {
    this.columns = config.columns || 12;
    this.rowHeight = config.rowHeight || 80;
    this.gap = config.gap || 12;
    this.snapToGrid = config.snapToGrid !== false;
  }

  // Calculate widget pixel position from grid coordinates
  getPixelPosition(widget) {
    const colWidth = (this.containerWidth - (this.gap * (this.columns + 1))) / this.columns;

    return {
      left: widget.x * (colWidth + this.gap) + this.gap,
      top: widget.y * (this.rowHeight + this.gap) + this.gap,
      width: widget.w * colWidth + (widget.w - 1) * this.gap,
      height: widget.h * this.rowHeight + (widget.h - 1) * this.gap
    };
  }

  // Snap pixel position to nearest grid cell
  snapToCell(pixelX, pixelY) {
    const colWidth = (this.containerWidth - (this.gap * (this.columns + 1))) / this.columns;
    const x = Math.round((pixelX - this.gap) / (colWidth + this.gap));
    const y = Math.round((pixelY - this.gap) / (this.rowHeight + this.gap));

    return {
      x: Math.max(0, Math.min(x, this.columns - 1)),
      y: Math.max(0, y)
    };
  }

  // Check for collisions with other widgets
  detectCollision(widget, widgets) {
    return widgets.some(other => {
      if (other.id === widget.id) return false;

      return !(
        widget.x + widget.w <= other.x ||
        widget.x >= other.x + other.w ||
        widget.y + widget.h <= other.y ||
        widget.y >= other.y + other.h
      );
    });
  }

  // Reflow widgets after position change
  reflow(widgets) {
    // Sort by y position, then x
    const sorted = [...widgets].sort((a, b) => {
      if (a.y !== b.y) return a.y - b.y;
      return a.x - b.x;
    });

    // Push down any overlapping widgets
    for (let i = 0; i < sorted.length; i++) {
      const widget = sorted[i];

      while (this.detectCollision(widget, sorted.slice(0, i))) {
        widget.y++;
      }
    }

    return sorted;
  }
}
```

### Drag-and-Drop Handler

```javascript
// src/systems/dashboard/dragDrop.js

export class DragDropHandler {
  constructor(gridEngine, onDrop) {
    this.gridEngine = gridEngine;
    this.onDrop = onDrop;
    this.draggedWidget = null;
    this.dragOffset = { x: 0, y: 0 };
  }

  initWidget(widgetElement, widgetData) {
    const handle = widgetElement.querySelector('.widget-drag-handle');

    handle.addEventListener('mousedown', (e) => {
      this.startDrag(e, widgetElement, widgetData);
    });
  }

  startDrag(e, element, widget) {
    e.preventDefault();

    this.draggedWidget = widget;
    const rect = element.getBoundingClientRect();
    this.dragOffset = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };

    element.classList.add('dragging');

    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('mouseup', this.onMouseUp);
  }

  onMouseMove = (e) => {
    if (!this.draggedWidget) return;

    const pixelX = e.clientX - this.dragOffset.x;
    const pixelY = e.clientY - this.dragOffset.y;

    if (this.gridEngine.snapToGrid) {
      const gridPos = this.gridEngine.snapToCell(pixelX, pixelY);
      this.draggedWidget.x = gridPos.x;
      this.draggedWidget.y = gridPos.y;
    } else {
      // Free-form positioning (convert to grid on drop)
      this.draggedWidget.pixelX = pixelX;
      this.draggedWidget.pixelY = pixelY;
    }

    this.onDrop(this.draggedWidget);
  }

  onMouseUp = (e) => {
    if (!this.draggedWidget) return;

    document.querySelector('.dragging')?.classList.remove('dragging');

    // Final snap to grid
    if (this.draggedWidget.pixelX !== undefined) {
      const gridPos = this.gridEngine.snapToCell(
        this.draggedWidget.pixelX,
        this.draggedWidget.pixelY
      );
      this.draggedWidget.x = gridPos.x;
      this.draggedWidget.y = gridPos.y;
      delete this.draggedWidget.pixelX;
      delete this.draggedWidget.pixelY;
    }

    this.onDrop(this.draggedWidget, true); // true = drop complete
    this.draggedWidget = null;

    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mouseup', this.onMouseUp);
  }
}
```

---

## Widget Development Guide

### Creating a New Widget

```javascript
// 1. Define widget in registry
registry.register('myCustomWidget', {
  name: 'My Custom Widget',
  icon: '🎨',
  description: 'Does something cool',
  minSize: { w: 2, h: 2 },
  defaultSize: { w: 4, h: 3 },
  requiresSchema: false,

  // Render function receives container and config
  render(container, config) {
    const html = `
      <div class="my-widget">
        <h4>${config.title || 'My Widget'}</h4>
        <div class="my-widget-content">
          <!-- Widget content here -->
        </div>
      </div>
    `;

    container.innerHTML = html;

    // Set up event listeners
    container.querySelector('.my-widget').addEventListener('click', () => {
      console.log('Widget clicked!');
    });
  },

  // Define configurable options
  getConfig() {
    return {
      title: {
        type: 'text',
        label: 'Widget Title',
        default: 'My Widget'
      },
      color: {
        type: 'color',
        label: 'Accent Color',
        default: '#e94560'
      },
      showBorder: {
        type: 'boolean',
        label: 'Show Border',
        default: true
      }
    };
  },

  // Called when widget config changes
  onConfigChange(newConfig, container) {
    this.render(container, newConfig);
  }
});

// 2. Widget automatically available in dashboard
```

### Widget Lifecycle

```javascript
// Widget instance lifecycle:
1. User adds widget to tab
   → registry.get(type) returns definition
   → Generate unique widget ID
   → Assign default size and position

2. Dashboard renders widget
   → Create container element
   → Call widget.render(container, config)
   → Apply positioning/sizing CSS

3. User enters edit mode
   → Show drag handle and resize controls
   → Enable drag/drop handlers

4. User changes widget config
   → Call widget.onConfigChange(newConfig)
   → Widget re-renders with new config

5. User removes widget
   → Clean up event listeners
   → Remove from layout array
   → Reflow remaining widgets
```

---

## Settings Integration

### Widget Management Section

Add to existing Settings modal:

```html
<div class="inline-drawer">
  <div class="inline-drawer-toggle inline-drawer-header">
    <b>Dashboard Layout</b>
  </div>
  <div class="inline-drawer-content">

    <!-- Available Widgets -->
    <h4>Available Widgets</h4>
    <div class="widget-toggles">
      <label><input type="checkbox" checked disabled> User Stats</label>
      <label><input type="checkbox" checked disabled> Info Box</label>
      <label><input type="checkbox" checked disabled> Present Characters</label>
      <label><input type="checkbox" checked disabled> Inventory</label>
      <label><input type="checkbox" checked> Classic Stats</label>
      <label><input type="checkbox" checked> Dice Roller</label>
      <label><input type="checkbox"> Skills (requires schema)</label>
      <label><input type="checkbox"> Relationships (requires schema)</label>
      <label><input type="checkbox"> Quests (requires schema)</label>
    </div>

    <!-- Grid Configuration -->
    <h4>Grid Settings</h4>
    <label>Columns: <input type="number" value="12" min="6" max="24"></label>
    <label>Row Height: <input type="number" value="80" min="40" max="200"> px</label>
    <label>Gap: <input type="number" value="12" min="0" max="32"> px</label>
    <label><input type="checkbox" checked> Snap to grid</label>
    <label><input type="checkbox" checked> Show grid in edit mode</label>

    <!-- Layout Actions -->
    <h4>Layout Actions</h4>
    <button id="dashboard-edit-layout">Edit Layout</button>
    <button id="dashboard-reset-layout">Reset to Default</button>
    <button id="dashboard-export-layout">Export Layout</button>
    <button id="dashboard-import-layout">Import Layout</button>

  </div>
</div>
```

---

## Technical Considerations

### Performance

- **Virtualization**: Only render visible widgets (especially on mobile)
- **Throttle drag updates**: Use RAF (requestAnimationFrame) for smooth dragging
- **Debounce saves**: Don't save layout on every drag - wait 500ms after drop
- **Lazy load widgets**: Only load widget code when first used

### Browser Compatibility

- **CSS Grid**: Fallback to flexbox for older browsers
- **Drag API**: Use mouse events instead of HTML5 Drag API (better cross-browser)
- **Touch events**: Support both mouse and touch for mobile
- **LocalStorage**: Store layout in extensionSettings, backed up to localStorage

### Accessibility

- **Keyboard navigation**: Tab through widgets, Enter to edit
- **Screen readers**: Proper ARIA labels on all controls
- **Focus indicators**: Clear visual focus states
- **Skip links**: "Skip to widget X" for keyboard users

---

## Migration Strategy

### Phase 1: Infrastructure
- Implement grid engine and widget registry
- Add dashboard config to extensionSettings
- Create default layout from current structure

### Phase 2: Edit Mode
- Build edit mode toggle and UI
- Implement drag-and-drop for existing widgets
- Add tab management (create/rename/delete)

### Phase 3: Widget Conversion
- Convert existing sections to widgets:
  - userStats widget (reuse renderUserStats)
  - infoBox widget (reuse renderInfoBox)
  - presentCharacters widget (reuse renderThoughts)
  - inventory widget (reuse renderInventory)
  - classicStats widget (extract from userStats)

### Phase 4: New Widgets
- Implement schema-driven widgets:
  - skills widget
  - relationships widget
  - quests widget
  - statusEffects widget

### Phase 5: Polish
- Mobile responsive refinements
- Animation polish
- Settings integration
- Documentation and tutorials

---

## Future Enhancements

- **Widget marketplace**: Share custom widgets with community
- **Layout templates**: Pre-made layouts for different RPG systems
- **Widget linking**: Connect widgets (e.g., skills affect stats)
- **Conditional visibility**: Show/hide widgets based on conditions
- **Widget themes**: Per-widget color/style overrides
- **Nested tabs**: Tabs within widgets for complex UIs

---

## Open Questions

1. **Grid Library**: Use existing library (Gridstack.js) or build custom?
   - **Pro Gridstack**: Battle-tested, feature-rich, responsive
   - **Pro Custom**: No dependencies, lighter weight, full control

2. **Schema Editor Widget**: Should it be a widget or always-modal?
   - **Widget**: More flexible positioning, can be in dedicated tab
   - **Modal**: Cleaner separation, larger working area

3. **Mobile Tab Limit**: Should we limit tabs on mobile?
   - **Unlimited**: Let users manage, use dropdown/scroll
   - **Limited**: Force max 5 tabs, rest in "More" menu

4. **Widget State**: Where to store widget-specific state (not config)?
   - **Per-widget**: Each widget manages its own state
   - **Global**: Dashboard state manager for all widgets
   - **Hybrid**: Widgets can opt into global state management

5. **Undo/Redo**: Should layout changes support undo/redo?
   - **Yes**: Better UX, prevents accidental deletions
   - **No**: Adds complexity, users can import previous layout

---

## Success Metrics

- ✅ Users can create/delete/rename tabs without code
- ✅ Users can drag-and-drop widgets to any position
- ✅ Layout persists across sessions
- ✅ Mobile users get functional (even if stacked) layout
- ✅ Existing functionality works as widgets (no regressions)
- ✅ Schema-driven widgets only appear when schema active
- ✅ Export/import layouts works reliably
- ✅ Edit mode is intuitive (no tutorial needed)
