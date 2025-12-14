# Plan: Actionable Log Lines Protocol (ALLP) + Beads Implementation

## Repository

**Location**: `c:\myStuff\_infra\ActionableLogLines`
**GitHub**: `github.com/justSteve/ActionableLogLines`
**Tracking**: `bd-vnlh`

---

## Concept

**Actionable Log Lines**: Each log entry is both display AND an interaction portal back to its source entity.

### Two-Phase Interaction

1. **Click** → Default expansion (orientation info)
2. **Text input** → Directed query (hybrid: commands first, Claude fallback)

### Visual Model

```text
[▶] 15:04:02 | sk.bootup.activated | steve
     ↓ click
┌─────────────────────────────────────────────┐
│ Skill: beads-bootup                         │
│ Category: Session lifecycle                 │
│ Session: abc123 (started 2m ago)            │
├─────────────────────────────────────────────┤
│ [_________________________________] [→]     │
│ try: "related" "before this" "explain"      │
└─────────────────────────────────────────────┘
```

---

## Architecture

### 1. Protocol Layer (Generic)

```typescript
interface ActionableLogLine {
  // Core log data
  timestamp: string;
  message: string;
  level?: string;

  // Source identity - enables routing back
  source: {
    type: string;        // "beads" | "git" | "api" | etc
    id: string;          // entity identifier
    context: object;     // source-specific metadata
  };

  // Interaction handlers
  defaultExpansion: () => ExpansionResult;
  queryHandler: (input: string) => QueryResult;

  // Available commands for this line (enables autocomplete, help)
  availableCommands: Command[];
}

interface Command {
  name: string;
  aliases: string[];
  description: string;
  handler: (params?: string) => Result;
}
```

### 2. Source Adapter Interface (Generic)

```typescript
interface SourceAdapter {
  type: string;

  // Parse raw log line into ActionableLogLine
  parse(rawLine: string): ActionableLogLine;

  // Generate default expansion for a line
  getDefaultExpansion(line: ActionableLogLine): ExpansionResult;

  // Handle user query (commands + fallback routing)
  handleQuery(line: ActionableLogLine, input: string): QueryResult;

  // List available commands for this source type
  getCommands(): Command[];
}
```

### 3. Beads Adapter (Specific Implementation)

```typescript
// Source: .beads/events.log
// Format: TIMESTAMP|EVENT_CODE|ISSUE_ID|AGENT_ID|SESSION_ID|DETAILS

const BeadsAdapter: SourceAdapter = {
  type: "beads",

  parse(rawLine) {
    const [timestamp, eventCode, issueId, agentId, sessionId, details] =
      rawLine.split('|');
    return {
      timestamp,
      message: eventCode,
      source: {
        type: "beads",
        id: issueId || eventCode,
        context: { eventCode, issueId, agentId, sessionId, details }
      },
      // ... handlers
    };
  },

  getCommands() {
    return [
      { name: "show", aliases: ["s"], description: "Show issue details",
        handler: (id) => exec(`bd show ${id}`) },
      { name: "related", aliases: ["r"], description: "Related events",
        handler: () => exec(`bd log --issue ${issueId}`) },
      { name: "deps", aliases: ["d"], description: "Show dependencies",
        handler: (id) => exec(`bd show ${id}`) },
      { name: "category", aliases: ["c"], description: "Filter by category",
        handler: (cat) => exec(`bd log --category ${cat}`) },
      // ... more commands
    ];
  }
};
```

---

## Implementation Plan

### Phase 1: Repository Setup

- [ ] Create `c:\myStuff\_infra\ActionableLogLines`
- [ ] Initialize git repo, push to GitHub
- [ ] Create CLAUDE.md with project context

### Phase 2: Protocol Definition

- [ ] Define TypeScript interfaces
- [ ] Location: `src/protocol.ts`

### Phase 3: Beads Source Adapter

- [ ] Implement BeadsAdapter
- [ ] Location: `src/adapters/beads.ts`
- [ ] Commands: show, related, deps, category, explain, before, after

### Phase 4: Query Interpreter (Hybrid)

- [ ] Command parser (exact match + aliases)
- [ ] Claude fallback with context injection
- [ ] Location: `src/interpreter.ts`

### Phase 5: Renderer (VS Code WebView)

- [ ] Log display with clickable lines
- [ ] Expansion panel with text input
- [ ] Location: `src/renderer/`

### Phase 6: Integration

- [ ] Wire up to `.beads/events.log`
- [ ] Test with `bd log --follow` equivalent

---

## Files to Create

**New repo structure (`c:\myStuff\_infra\ActionableLogLines`):**

```text
ActionableLogLines/
├── src/
│   ├── protocol.ts              # Core ALLP interfaces
│   ├── interpreter.ts           # Hybrid query interpreter
│   ├── adapters/
│   │   ├── index.ts             # Adapter registry
│   │   └── beads.ts             # Beads adapter (first impl)
│   ├── renderer/
│   │   ├── panel.ts             # VS Code WebView panel
│   │   └── panel.html           # Panel template
│   └── index.ts                 # Public API
├── CLAUDE.md                    # Project context
├── package.json
└── tsconfig.json
```

**Reference files (in beads repo):**

- `c:\myStuff\_infra\beads\vscode\events\EVENT_TAXONOMY.md` - Event codes
- `c:\myStuff\_infra\beads\cmd\bd\log.go` - CLI log implementation
- `c:\myStuff\_infra\beads\vscode\scripts\beads-log-event.ps1` - Event format

---

## Generalization Path

When adding new sources:

1. Create new adapter implementing `SourceAdapter`
2. Register adapter with type string
3. Log lines auto-route based on source.type

Future adapters:

- `GitAdapter` - git log lines → blame, diff, show
- `ApiAdapter` - HTTP logs → replay, inspect, mock
- `ClaudeAdapter` - conversation logs → follow-up, branch

---

## Design Decisions

1. **Renderer scope**: VS Code WebView only (for now)
2. **Claude integration**: Implementation detail - likely MCP or direct API
3. **Streaming**: Split-pane UI - log streams independently, response panel is fixed

### UI Layout

```text
┌─────────────────────────────────────────────────┐
│ RESPONSE PANEL (fixed, top)                     │
│ ─────────────────────────────────────────────── │
│ [Context from clicked line]                     │
│ [Default expansion info]                        │
│ [_________________________________] [→]         │
├─────────────────────────────────────────────────┤
│ STREAMING LOG (scrolls independently)           │
│ [▶] 15:04:02 | sk.bootup.activated | steve     │
│ [▶] 15:04:03 | bd.issue.create | bd-97ux       │
│ ...continues streaming...                       │
└─────────────────────────────────────────────────┘
```

**Benefits of split-pane:**

- Log continues streaming uninterrupted
- No DOM surgery mid-stream
- Scroll position preserved in log
- Response panel can grow without affecting log
- Low-medium implementation complexity

---

## VS Code Integration Strategy

### Panel Identification

**viewType convention**: `allp.<adapter>.allp` (e.g., `allp.beads.allp`, `allp.git.allp`, `allp.api.allp`)

This allows:

- Multiple ALLP viewers running simultaneously
- Each adapter has unique identification
- Extension can query/manage all `allp.*.allp` panels
- Prefix `allp.` groups all ALLP viewTypes
- Suffix `.allp` marks them as ALLP viewers
- Clear namespace avoids collision with other extensions

### Container Architecture

**ALLP Container** holds multiple log viewports as tabs:

```text
┌─────────────────────────────────────────────────────────────┐
│ [beads.allp] [git.allp] [api.allp]  ←── tabs (draggable)   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Active viewport content                                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

- Tabs cycle via click or keyboard
- Tabs are detachable via drag/drop (become independent panels)
- Container remembers which tabs are attached vs detached

### Lifecycle

```text
Workspace opens
    ↓
Check for .beads/ folder (or other adapter triggers)
    ↓
Restore last state (visible/hidden, position, size)
    ↓
If no last state → use config defaults
    ↓
Register WebviewPanelSerializer for persistence
    ↓
Keystroke toggles visibility
    ↓
If visible → flash effect
If hidden → reveal
```

### Positioning & Sizing

**Semantic labels** instead of pixel values:

```typescript
// Config file defines named positions
interface AllpLayoutConfig {
  positions: {
    logviewerTop: string;      // e.g., "panel-top", "editor-bottom"
    logviewerLeft: string;     // e.g., "sidebar-right", "0"
    logviewerWidth: string;    // e.g., "50%", "400px", "fill"
    logviewerHeight: string;   // e.g., "30%", "200px", "auto"
  };
}

// Usage
ALLPViewer.top = config.positions.logviewerTop;
ALLPViewer.left = config.positions.logviewerLeft;
```

**Resolution order**:

1. **Last used** - persisted from previous session
2. **Config default** - from `allp.config.json` or settings
3. **Hardcoded fallback** - safe defaults if nothing else

### Key Components

1. **Activation Events** (package.json):

   ```json
   "activationEvents": [
     "workspaceContains:.beads",
     "onWebviewPanel:allp.beads.allp",
     "onCommand:allp.toggle"
   ]
   ```

2. **Singleton Panel Manager**:
   - Static `currentPanel` per viewType
   - `createOrShow()` pattern
   - `reveal()` for existing panels

3. **Panel Registry** (for multi-adapter support):

   ```typescript
   class AllpPanelRegistry {
     private panels: Map<string, AllpPanel> = new Map();

     get(viewType: string): AllpPanel | undefined;
     getAll(): AllpPanel[];  // all allp.* panels
     register(panel: AllpPanel): void;
   }
   ```

4. **Keystroke Command**:
   - `allp.toggle` - toggle current workspace's ALLP panel
   - `allp.toggleAll` - toggle all ALLP panels
   - Default binding: `Ctrl+Shift+L` (Log)

5. **Flash Effect** (when already visible):
   - CSS animation on panel border
   - Brief highlight color change
   - PostMessage to webview: `{ type: 'flash' }`

### Files to Add

```text
src/
├── extension.ts         # VS Code extension entry point
├── container.ts         # ALLP container with tabbed viewports
├── panel-registry.ts    # Multi-panel management
├── state.ts             # State persistence (position, size, visibility)
├── config.ts            # Config loading and semantic position resolution
└── commands.ts          # Toggle, flash, tab-cycle commands
```

### State Persistence

```typescript
interface AllpState {
  // Per-container state
  containers: {
    [containerId: string]: {
      visible: boolean;
      position: { top: string; left: string };
      size: { width: string; height: string };
      activeTab: string;
      attachedTabs: string[];    // viewTypes in container
      detachedTabs: string[];    // viewTypes as independent panels
    };
  };

  // Per-viewport state
  viewports: {
    [viewType: string]: {
      scrollPosition: number;
      selectedLineIndex: number;
      queryHistory: string[];
    };
  };
}
```

### Persistence

Use `WebviewPanelSerializer` to restore panels across VS Code restarts:

- Save: adapter type, log source path, scroll position
- Restore: recreate panel with saved state

### Sources

- [VS Code Webview API](https://code.visualstudio.com/api/extension-guides/webview)
- [WebviewPanelSerializer](https://code.visualstudio.com/api/references/vscode-api)
- [Panel UX Guidelines](https://code.visualstudio.com/api/ux-guidelines/panel)

---

## Session Status

**Active**: Planning ALLP VS Code integration. Tracking: `bd-vnlh`
