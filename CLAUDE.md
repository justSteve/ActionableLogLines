# CLAUDE.md - Actionable Log Lines Protocol (ALLP)

## Project Overview

ALLP is a protocol and implementation for interactive log viewing. Each log line is both display AND an interaction portal back to its source entity.

## Core Concept

**Two-Phase Interaction:**
1. **Click** log line → Default expansion (orientation info)
2. **Text input** → Directed query (hybrid: commands first, Claude fallback)

## Architecture

```
ActionableLogLines/
├── src/
│   ├── protocol.ts         # Core ALLP interfaces
│   ├── interpreter.ts      # Hybrid query interpreter
│   ├── adapters/
│   │   ├── index.ts        # Adapter registry
│   │   └── beads.ts        # Beads adapter (reference impl)
│   ├── renderer/
│   │   ├── panel.ts        # VS Code WebView panel
│   │   └── panel.html      # Panel template
│   └── index.ts            # Public API
```

## Key Interfaces

- `ActionableLogLine` - Core log line with source context and handlers
- `SourceAdapter` - Interface for parsing logs and handling queries
- `Command` - Individual command with name, aliases, handler

## Beads Integration

First adapter implementation uses beads events:
- Source: `.beads/events.log`
- Format: `TIMESTAMP|EVENT_CODE|ISSUE_ID|AGENT_ID|SESSION_ID|DETAILS`
- Commands: show, related, deps, category, explain

## Development

```bash
npm install
npm run compile
npm run watch  # Development mode
```

## Features (bd-vnlh)

- **File watching**: Automatically watches `.beads/events.log` for new events
- **Real-time streaming**: New log lines appear instantly in the viewer
- **Mock mode**: Test with `ALLP: Show Viewer with Mock Data` command
- **Split-pane UI**: Response panel (top) + streaming log (bottom)
- **Interactive commands**: Click line for details, type commands for queries

## Related

- Beads repo: `c:\myStuff\_infra\beads`
- Event taxonomy: `beads/vscode/events/EVENT_TAXONOMY.md`
- Tracking issue: `bd-vnlh` (COMPLETE)
