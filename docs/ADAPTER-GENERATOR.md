# ALLP Adapter Generator

Generate custom log adapters for your applications with an interactive CLI tool.

## Quick Start

```bash
# Install dependencies
npm install

# Link CLI tool globally
npm link

# Generate adapter
cd your-app
allp-generate
```

## Interactive Prompts

The generator asks a series of questions to configure your adapter:

1. **Adapter name** - Unique identifier (e.g., `myapp-events`)
2. **Scenario** - Greenfield, Winston, Bunyan, Pino, or Custom
3. **Log format** - Pipe-delimited, JSON, or custom
4. **Sample log line** - For format detection (existing loggers only)
5. **Event categories** - Errors, integrations, timing, etc.
6. **Custom commands** - Optional interactive commands
7. **CLI integration** - External command integration
8. **Output location** - Where to generate files
9. **Helper library** - Generate logger utility

## Output Files

**Generated files in `.allp/`:**
- `adapter.ts` - ALLP SourceAdapter implementation
- `logger.ts` - Helper library (optional)
- `adapter.test.ts` - Test suite (optional)
- `README.md` - Usage instructions

## Usage Examples

### Greenfield Application

```bash
$ allp-generate
? Adapter name: myapp-events
? Scenario: Greenfield
? Log format: Pipe-delimited with JSON context
? Event categories: [x] Errors, [x] API calls, [x] Timing
? Output: .allp/

Generated:
  ✓ .allp/adapter.ts
  ✓ .allp/logger.ts
  ✓ .allp/adapter.test.ts
  ✓ .allp/README.md
```

**Using the logger:**
```typescript
import { getLogger } from './.allp/logger';

const logger = getLogger();

try {
  await apiCall();
} catch (error) {
  logger.logError(error, { operation: 'apiCall', userId: '123' });
}
```

### Fork with Winston

```bash
$ allp-generate
? Adapter name: myapp-winston
? Scenario: Fork with Winston logger
? Sample log line: {"level":"error","message":"...","timestamp":"..."}
? Output: .allp/

Generated:
  ✓ .allp/adapter.ts (parses Winston JSON)
  ✓ .allp/adapter.test.ts
  ✓ .allp/README.md
```

**Register adapter:**
```typescript
import { MyappWinston } from './.allp/adapter';
import { registerAdapter } from 'allp';

registerAdapter(MyappWinston);
```

## Presets

### Greenfield

Recommended format for new applications:
- Pipe-delimited: `TIMESTAMP|EVENT_TYPE|CORRELATION_ID|LEVEL|CONTEXT_JSON`
- Commands: errors, slow, recent
- Helper library: Yes

### Winston

Parses Winston JSON logs:
- JSON format with standard Winston fields
- Field mappings: timestamp, level, message, meta
- Helper library: No (Winston already provides logging)

## Programmatic Usage

```typescript
import { generateAdapter, writeGeneratedFiles } from 'allp/generator';

const config = {
  name: 'myapp-events',
  scenario: 'greenfield',
  format: 'pipe-delimited',
  eventCategories: ['errors', 'integrations'],
  commands: [
    { name: 'errors', aliases: ['e'], description: 'Show errors' }
  ],
  outputPath: '.allp',
  generateHelper: true,
  generateTests: true,
};

const result = await generateAdapter(config);
await writeGeneratedFiles(result);
```

## Custom Commands

Commands provide interactive log exploration:

```typescript
commands: [
  {
    name: 'errors',
    aliases: ['e', 'err'],
    description: 'Show all error events',
  },
  {
    name: 'slow',
    aliases: ['s'],
    description: 'Show operations >1000ms',
  }
]
```

## CLI Integration

Integrate with external tools (like beads uses `bd`):

```typescript
cliIntegration: 'mycli'

// Generated handler:
async handler(params) {
  const output = await execAsync(`mycli show ${params}`);
  return { handled: true, content: output.stdout };
}
```

## Validation

Generated adapters are automatically:
- Formatted with Prettier
- Type-checked (if TypeScript compilation succeeds)
- Tested with sample log lines

## Troubleshooting

**Generator fails:**
- Check Node.js version (>=18 recommended)
- Verify dependencies installed: `npm install`
- Check write permissions on output directory

**Generated adapter doesn't compile:**
- Review TypeScript errors
- Check custom field mappings
- Validate sample log line format

**Logs not parsing:**
- Verify log format matches adapter configuration
- Check timestamp format (ISO 8601 recommended)
- Review parse logic in generated `adapter.ts`
