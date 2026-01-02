# ALLP - Actionable Log Lines Protocol

Interactive log viewer for VS Code where each log line is both **display** and an **interaction portal** back to its source entity.

## Features

- **Click** any log line to see expanded context
- **Query** with commands or natural language
- **Beads integration** for issue tracking workflows
- **Extensible adapter system** for custom log formats
- **Adapter generator** - Create custom adapters with interactive CLI
- **Standalone library** - Use ALLP without VS Code

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

## Adapter Generator

Generate custom adapters for your applications:

```bash
# Install and link CLI tool
npm install
npm link

# Generate adapter interactively
cd your-app
allp-generate
```

The generator creates:
- **adapter.ts** - ALLP SourceAdapter for your log format
- **logger.ts** - Helper library with `logError()`, `logApiCall()`, etc.
- **adapter.test.ts** - Test suite
- **README.md** - Usage instructions

See [Adapter Generator Guide](docs/ADAPTER-GENERATOR.md) for details.

## Standalone Library

Use ALLP core without VS Code:

```typescript
import { registerAdapter, getRegistry } from 'allp';
import { MyAdapter } from './.allp/adapter';

// Register adapter
registerAdapter(MyAdapter);

// Parse log lines
const parsed = getRegistry().parse(logLine);
if (parsed) {
  const expansion = await parsed.getDefaultExpansion();
  console.log(expansion.content);
}
```

Perfect for:
- CLI log viewers
- Web-based log exploration
- Custom tooling
- Non-VS Code environments

## Custom Adapters

Create adapters manually or use the generator:

```typescript
import type { SourceAdapter } from 'allp';

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
  lib/                # Standalone library entry point
  protocol.ts         # Core interfaces
  interpreter.ts      # Command/NL query processing
  adapters/
    index.ts          # Adapter registry
    beads.ts          # Beads format adapter
  generator/
    index.ts          # Adapter generator engine
    cli.ts            # Interactive CLI
    templates/        # Code generation templates
  renderer/
    panel.ts          # VS Code WebView panel
```

## Documentation

- [Adapter Generator Guide](docs/ADAPTER-GENERATOR.md) - Generate custom adapters
- [Logging Schema Reference](docs/LOGGING-SCHEMA.md) - Comprehensive logging patterns

## License

MIT
