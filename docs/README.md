# RPG Companion Documentation

This directory contains all design and implementation documentation for RPG Companion v2.0.

---

## Documentation Index

### Implementation

- **[IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)** - Complete implementation roadmap
  - 8 epics with detailed tasks and subtasks
  - Checkboxes for progress tracking
  - Dependencies and timeline estimates
  - Each task builds on the previous one

### Feature Design

- **[Widget Dashboard System](./features/widget-dashboard-system.md)** - Dashboard architecture
  - Dynamic tabs with create/rename/delete
  - Widget grid system with drag-and-drop
  - Edit mode and layout persistence
  - Mobile responsive design
  - Widget development guide

- **[Schema System Architecture](./features/schema-system-architecture.md)** - Schema system design
  - Entity-Component-System (ECS) pattern
  - YAML-based system definitions
  - Formula engine with @ references
  - Character instance validation
  - Storage layer (IndexedDB + File System API)
  - AI prompt generation and parsing

---

## Quick Start

### For Developers

1. **Start here:** Read [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)
2. **Understand the dashboard:** Read [Widget Dashboard System](./features/widget-dashboard-system.md)
3. **Understand schemas:** Read [Schema System Architecture](./features/schema-system-architecture.md)
4. **Pick a task:** Find unchecked tasks in implementation plan
5. **Build incrementally:** Each task builds on previous ones

### For Contributors

- All major features documented in `/docs/features/`
- Implementation plan tracks progress with checkboxes
- Each epic is a major deliverable
- Commit messages should reference task numbers
- Example: `feat: implement grid engine core (Task 1.1)`

---

## Architecture Overview

```
RPG Companion v2.0 Architecture

┌─────────────────────────────────────────────────────────┐
│                   User Interface Layer                   │
│  ┌───────────────┐  ┌───────────────┐  ┌──────────────┐│
│  │ Tab Navigator │  │ Widget Grid   │  │ Edit Mode UI ││
│  └───────────────┘  └───────────────┘  └──────────────┘│
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                  Widget System Layer                     │
│  ┌───────────────┐  ┌───────────────┐  ┌──────────────┐│
│  │ Widget        │  │ Grid Engine   │  │ Drag & Drop  ││
│  │ Registry      │  │               │  │ Handler      ││
│  └───────────────┘  └───────────────┘  └──────────────┘│
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                   Schema System Layer                    │
│  ┌───────────────┐  ┌───────────────┐  ┌──────────────┐│
│  │ Schema        │  │ Formula       │  │ Character    ││
│  │ Validator     │  │ Engine        │  │ Manager      ││
│  └───────────────┘  └───────────────┘  └──────────────┘│
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                   Storage Layer                          │
│  ┌───────────────┐  ┌───────────────┐  ┌──────────────┐│
│  │ IndexedDB     │  │ File System   │  │ Extension    ││
│  │               │  │ Access API    │  │ Settings     ││
│  └───────────────┘  └───────────────┘  └──────────────┘│
└─────────────────────────────────────────────────────────┘
```

---

## Key Concepts

### Widget Dashboard
- **Dynamic Tabs:** Users create unlimited tabs with custom names
- **Widget Grid:** 12-column responsive grid with drag-and-drop
- **Edit Mode:** Visual editor for arranging widgets
- **Persistence:** Layouts save automatically

### Schema System
- **System Definition:** YAML files define RPG system rules
- **Character Instance:** JSON data validated against schema
- **Formula Engine:** Calculate derived stats with @ references
- **AI Integration:** Dynamic prompts and parsing based on schema

### Progressive Enhancement
- **No Modes:** Single flexible system with toggles
- **Backward Compatible:** Existing features work without schemas
- **Opt-In Complexity:** Users enable advanced features when ready

---

## Epics Overview

| # | Epic | Status | Duration | Description |
|---|------|--------|----------|-------------|
| 1 | Dashboard Infrastructure | Not Started | 2 weeks | Core grid engine, tabs, drag-and-drop |
| 2 | Widget Conversion | Not Started | 2-3 weeks | Convert existing sections to widgets |
| 3 | Schema Infrastructure | Not Started | 3-4 weeks | YAML parser, formula engine, validation |
| 4 | Schema-Driven Widgets | Not Started | 3-4 weeks | Widgets that render from schemas |
| 5 | Schema Editor UI | Not Started | 2-3 weeks | YAML editor and visual builder |
| 6 | AI Integration | Not Started | 2-3 weeks | Schema-based prompts and parsing |
| 7 | Polish & Mobile | Not Started | 2-3 weeks | Responsive, animations, accessibility |
| 8 | Documentation | Not Started | 1-2 weeks | User docs, migration, templates |

**Total Estimated Time:** 12-14 weeks (3-3.5 months)

---

## Design Principles

### KISS (Keep It Simple, Stupid)
- Vanilla JavaScript, no frameworks
- Progressive enhancement over feature flags
- Clear APIs over clever abstractions

### User Freedom
> "This is SillyTavern - users should be able to do whatever the fuck they want"

- No arbitrary limitations
- Everything customizable
- Full GUI editing
- Import/export everything

### Backward Compatibility
- Existing features must keep working
- Graceful fallbacks everywhere
- Migration wizard for v1.x users
- No data loss scenarios

### Performance First
- Widgets lazy-load
- Formulas memoized
- Drag-and-drop throttled
- Mobile optimized

---

## Contributing

### Before Starting a Task

1. Read the task description in [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)
2. Check dependencies are complete
3. Review relevant design docs
4. Understand acceptance criteria

### While Working

1. Mark task in progress (comment or `[~]`)
2. Follow code style in CLAUDE.md
3. Test incrementally
4. Check console for errors
5. Add debug logging

### After Completing

1. Test acceptance criteria
2. Mark task complete (`[x]`)
3. Commit with conventional commit message
4. Update epic progress
5. Document any blockers or deviations

### Commit Message Format

```
type(scope): description

Examples:
feat(dashboard): implement grid engine core (Task 1.1)
fix(widgets): resolve user stats rendering bug
docs(schema): add formula engine examples
refactor(storage): optimize IndexedDB queries
```

---

## Testing Strategy

### Manual Testing
- Test in SillyTavern with extension enabled
- Check console for errors
- Test on different screen sizes
- Verify data persistence
- Test edge cases

### Browser Compatibility
- Chrome/Chromium (primary)
- Firefox
- Safari (if possible)
- Mobile browsers

### Accessibility
- Keyboard navigation
- Screen reader support
- Focus indicators
- Color contrast

---

## Support

### Getting Help

- Check [CLAUDE.md](../CLAUDE.md) for development guidelines
- Review relevant design docs in `/docs/features/`
- Check implementation plan for dependencies
- Ask questions in Discord

### Reporting Issues

When stuck or blocked:
- Document the blocker in implementation plan
- Include error messages and logs
- Describe what you tried
- Note which task is blocked

---

## Future Enhancements

Ideas for post-v2.0:

- Widget marketplace for community widgets
- Layout templates for different RPG systems
- Widget linking (skills affect stats, etc.)
- Conditional widget visibility
- Real-time collaboration
- Cloud sync
- Advanced formula functions
- Visual node-based formula editor
- Drag-and-drop formula builder

---

## License

See [LICENSE](../LICENSE) for details (AGPL-3.0).

---

**Last Updated:** 2025-10-23
**Version:** 2.0.0-dev
