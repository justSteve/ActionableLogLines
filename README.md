# ALLP - Actionable Log Lines Protocol

Interactive log viewer for VS Code where each log line is both **display** and an **interaction portal** back to its source entity.

## Features

- **Click** any log line to see expanded context
- **Query** with commands or natural language
- **Beads integration** for issue tracking workflows
- **Extensible adapter system** for custom log formats

## Quick Start

1. Open a workspace with a `.beads` directory
2. Press `Ctrl+Shift+L` (or `Cmd+Shift+L` on Mac)
3. Click any log line to expand
4. Type commands in the query bar

## Commands

| Command | Aliases | Description |
|---------|---------|-------------|
| `show` | `details`, `info` | Show full issue details |
| `deps` | `dependencies`, `blocks` | Show dependency graph |
| `related` | `rel` | Find related events |
| `category` | `cat`, `type` | Explain event category |
| `session` | `sess` | Show session context |
| `explain` | - | AI-powered explanation |
| `agent` | - | Show agent activity |

## Two-Phase Interaction

```
[>] 15:04:02 | bd.issue.create | bd-97ux | steve
     | click
+--------------------------------------------------+
| Issue: bd-97ux                                   |
| Title: Implement ALLP                            |
| Status: in_progress                              |
| Created: 2m ago                                  |
+--------------------------------------------------+
| [____________________________] [Query]           |
| try: "show" "deps" "related"                     |
+--------------------------------------------------+
```

## Beads Event Format

ALLP parses the beads event log format:

```
TIMESTAMP|EVENT_CODE|ISSUE_ID|AGENT_ID|SESSION_ID|DETAILS
```

Example:
```
2025-01-15T15:04:03.456Z|bd.issue.create|bd-97ux|steve|sess-abc123|title=Implement ALLP
```

## Event Categories

| Prefix | Category | Description |
|--------|----------|-------------|
| `ep` | Epoch | App lifecycle events |
| `ss` | Session | Agent workflow events |
| `sk` | Skill | Claude skill activations |
| `bd` | Beads | Issue operations |
| `gt` | Git | Version control events |
| `hk` | Hook | Git hook triggers |
| `gd` | Guard | Enforcement checks |

## Custom Adapters

Create adapters for other log formats:

```typescript
import type { SourceAdapter } from 'allp-viewer';

const MyAdapter: SourceAdapter = {
  type: 'my-format',

  parse(rawLine: string): ActionableLogLine | null {
    // Parse your format
    // Return null if line doesn't match
  },

  getDefaultExpansion(line): Promise<ExpansionResult> {
    return { content: 'Expanded view', suggestions: ['cmd1'] };
  },

  handleQuery(line, input): Promise<QueryResult> {
    return { handled: true, content: 'Query result' };
  },

  getCommands(): Command[] {
    return [{ name: 'mycmd', aliases: ['m'], description: '...', handler: ... }];
  }
};
```

## Development

```bash
npm install
npm run compile
npm test
```

### Commands

- `allp.showViewer` - Open the log viewer
- `allp.showWithMockData` - Open with sample data (for testing)

### Keyboard Shortcuts

- `Ctrl+Shift+L` / `Cmd+Shift+L` - Show log viewer
- `Up/Down` arrows in query bar - Navigate query history

## Architecture

```
src/
  protocol.ts         # Core interfaces
  interpreter.ts      # Command/NL query processing
  adapters/
    index.ts          # Adapter registry
    beads.ts          # Beads format adapter
  renderer/
    panel.ts          # VS Code WebView panel
```

## License

MIT
