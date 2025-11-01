# Tracker Customization Implementation Plan

## Overview
Allow users to fully customize what trackers display, including custom fields, toggles, and formats.

## Settings Schema Design

```javascript
extensionSettings.trackerConfig = {
  userStats: {
    // Array of custom stats (allows add/remove/rename)
    customStats: [
      { id: 'health', name: 'Health', enabled: true, value: 100 },
      { id: 'satiety', name: 'Satiety', enabled: true, value: 100 },
      { id: 'energy', name: 'Energy', enabled: true, value: 100 },
      { id: 'hygiene', name: 'Hygiene', enabled: true, value: 100 },
      { id: 'arousal', name: 'Arousal', enabled: true, value: 0 }
    ],
    showRPGAttributes: true,
    statusSection: {
      enabled: true,
      showMoodEmoji: true,
      customFields: ['Conditions']
    },
    skillsSection: {
      enabled: false,
      label: 'Skills'
    }
  },
  
  infoBox: {
    widgets: {
      date: { enabled: true, format: 'Weekday, Month, Year' },
      weather: { enabled: true },
      temperature: { enabled: true, unit: 'C' },
      time: { enabled: true },
      location: { enabled: true },
      recentEvents: { enabled: true }
    }
  },
  
  presentCharacters: {
    showEmoji: true,
    showName: true,
    customFields: [
      { id: 'physicalState', label: 'Physical State', enabled: true, placeholder: 'Visible traits' },
      { id: 'demeanor', label: 'Demeanor Cue', enabled: true, placeholder: 'Observable demeanor' },
      { id: 'relationship', label: 'Relationship', enabled: true, type: 'relationship' },
      { id: 'internalMonologue', label: 'Internal Monologue', enabled: true, placeholder: 'First person thoughts' }
    ],
    characterStats: {
      enabled: false,
      stats: []
    }
  }
}
```

## Implementation Phases

### Phase 1: State Management ✓
- Update state.js with trackerConfig schema
- Add migration logic for existing users
- Ensure persistence in loadSettings/saveSettings

### Phase 2: Edit Trackers Modal UI
- Create src/systems/ui/trackerEditor.js
- Add "Edit Trackers" button in template.html
- Build tabbed modal interface with save/cancel/reset

### Phase 3: User Stats Customization
- Tab UI for managing custom stats array
- RPG attributes toggle
- Status section configuration
- Skills field configuration

### Phase 4: Info Box Customization
- Tab UI for widget toggles
- Date format selector
- Temperature unit toggle

### Phase 5: Present Characters Customization
- Tab UI for custom fields management
- Character stats configuration
- Field ordering and custom additions

### Phase 6: Dynamic Rendering
- Update renderUserStats() for variable stats
- Update renderInfoBox() for conditional widgets
- Update renderThoughts() for custom fields

### Phase 7: Dynamic Prompts
- Update generateTrackerInstructions()
- Build prompts from trackerConfig
- Handle variable formats

### Phase 8: Flexible Parsing
- Update parser.js for variable formats
- Handle custom stat names
- Parse custom character fields

### Phase 9: Responsive CSS
- Support variable stat counts
- Conditional widget visibility
- Mobile-friendly layouts for all configs

### Phase 10: Testing
- Test minimal configurations
- Test maximal configurations
- Test custom field names
- Verify mobile responsiveness

## Files to Modify

1. **State & Persistence**
   - src/core/state.js
   - src/core/persistence.js
   - src/utils/migration.js

2. **UI Components**
   - template.html (add button)
   - src/systems/ui/trackerEditor.js (NEW)
   - src/systems/ui/modals.js (register new modal)

3. **Rendering**
   - src/systems/rendering/userStats.js
   - src/systems/rendering/infoBox.js
   - src/systems/rendering/thoughts.js

4. **Generation**
   - src/systems/generation/promptBuilder.js
   - src/systems/generation/parser.js

5. **Styling**
   - style.css

## Critical Success Factors
- Backward compatibility via migration
- Mobile-first responsive design
- Flexible parsing handles variable formats
- CSS adapts without breaking existing layouts
- Settings persist correctly across sessions
