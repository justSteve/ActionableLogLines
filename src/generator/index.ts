/**
 * ALLP Adapter Generator
 *
 * Generates custom adapters based on configuration.
 */

import * as fs from 'fs';
import * as path from 'path';
import Handlebars from 'handlebars';
import prettier from 'prettier';
import type {
  AdapterConfig,
  GeneratorResult,
  TemplateContext,
} from './types';

// Register Handlebars helpers
Handlebars.registerHelper('eq', function (a, b) {
  return a === b;
});

/**
 * Build template context from adapter configuration
 */
function buildTemplateContext(config: AdapterConfig): TemplateContext {
  const adapterName = config.name
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');

  const context: TemplateContext = {
    ADAPTER_NAME: adapterName,
    ADAPTER_TYPE: config.name,
    GENERATION_DATE: new Date().toISOString(),
    LOG_FORMAT: config.format,

    formatType: config.format,
    hasCliIntegration: !!config.cliIntegration,
    cliName: config.cliIntegration,

    // Detect features from event categories
    hasErrorFields: config.eventCategories.includes('errors'),
    hasTimingFields: config.eventCategories.includes('timing'),
    hasIntegrationFields: config.eventCategories.includes('integrations'),

    customFields: [],
    fieldMappings: config.fieldMappings || [],
    commands: config.commands,

    appName: config.name,
    logFileName: config.name,
  };

  // Set format-specific defaults
  if (config.format === 'pipe-delimited') {
    context.minimumFields = 5;
    context.timestampField = 'timestamp';
    context.eventTypeField = 'eventType';
    context.correlationIdField = 'correlationId';
    context.levelField = 'level';
  } else if (config.format === 'json') {
    // Auto-detect from sample line
    if (config.sampleLine) {
      try {
        const parsed = JSON.parse(config.sampleLine);
        context.timestampField = findField(parsed, ['timestamp', 'time', 'ts', '@timestamp']);
        context.eventTypeField = findField(parsed, ['type', 'event', 'eventType', 'level']);
        context.levelField = findField(parsed, ['level', 'severity']);
        context.correlationIdField = findField(parsed, ['correlationId', 'requestId', 'traceId']);
      } catch {
        // Use defaults
        context.timestampField = 'timestamp';
        context.eventTypeField = 'type';
        context.correlationIdField = 'correlationId';
        context.levelField = 'level';
      }
    }
  }

  return context;
}

/**
 * Find field in object by trying multiple names
 */
function findField(obj: any, candidates: string[]): string {
  for (const candidate of candidates) {
    if (obj.hasOwnProperty(candidate)) {
      return candidate;
    }
  }
  return candidates[0]; // Return first candidate as default
}

/**
 * Load and compile Handlebars template
 */
function loadTemplate(templateName: string): HandlebarsTemplateDelegate {
  const templatePath = path.join(__dirname, 'templates', `${templateName}.template.ts`);
  const templateSource = fs.readFileSync(templatePath, 'utf-8');
  return Handlebars.compile(templateSource);
}

/**
 * Format code with Prettier
 */
async function formatCode(code: string): Promise<string> {
  try {
    return await prettier.format(code, {
      parser: 'typescript',
      singleQuote: true,
      trailingComma: 'es5',
      tabWidth: 2,
    });
  } catch (error) {
    console.warn('Failed to format code:', error);
    return code; // Return unformatted if prettier fails
  }
}

/**
 * Generate adapter code
 */
export async function generateAdapter(config: AdapterConfig): Promise<GeneratorResult> {
  const context = buildTemplateContext(config);

  // Generate adapter
  const adapterTemplate = loadTemplate('adapter');
  const adapterCode = adapterTemplate(context);
  const formattedAdapter = await formatCode(adapterCode);

  const result: GeneratorResult = {
    adapter: {
      path: path.join(config.outputPath, 'adapter.ts'),
      code: formattedAdapter,
    },
    readme: {
      path: path.join(config.outputPath, 'README.md'),
      code: generateReadme(config, context),
    },
  };

  // Generate helper library if requested
  if (config.generateHelper) {
    const loggerTemplate = loadTemplate('logger-lib');
    const loggerCode = loggerTemplate(context);
    const formattedLogger = await formatCode(loggerCode);

    result.logger = {
      path: path.join(config.outputPath, 'logger.ts'),
      code: formattedLogger,
    };
  }

  // Generate tests if requested
  if (config.generateTests) {
    const testTemplate = loadTemplate('test');
    const testCode = testTemplate(context);
    const formattedTest = await formatCode(testCode);

    result.test = {
      path: path.join(config.outputPath, 'adapter.test.ts'),
      code: formattedTest,
    };
  }

  return result;
}

/**
 * Generate README content
 */
function generateReadme(config: AdapterConfig, context: TemplateContext): string {
  return `# ${context.ADAPTER_NAME} Adapter

Generated: ${new Date().toLocaleDateString()}

## Usage

### Import Adapter

\`\`\`typescript
import { ${context.ADAPTER_NAME} } from './adapter';
import { registerAdapter } from 'allp';

registerAdapter(${context.ADAPTER_NAME});
\`\`\`

${config.generateHelper ? `### Use Logger Helper

\`\`\`typescript
import { getLogger } from './logger';

const logger = getLogger();

// Log errors
try {
  await doWork();
} catch (error) {
  logger.logError(error, { operation: 'doWork', user_id: '123' });
}

// Log API calls
logger.logApiCall('https://api.example.com', 'POST', 200, 1234);

// Log timing
logger.logTiming('expensive_operation', 5678);
\`\`\`
` : ''}

## Log Format

Format: \`${config.format}\`

${config.sampleLine ? `Sample line:
\`\`\`
${config.sampleLine}
\`\`\`
` : ''}

## Available Commands

${context.commands.map((cmd) => `- **${cmd.name}** (aliases: ${cmd.aliases.join(', ')}): ${cmd.description}`).join('\n')}

## Event Categories

${config.eventCategories.map((cat) => `- ${cat}`).join('\n')}
`;
}

/**
 * Write generated files to disk
 */
export async function writeGeneratedFiles(result: GeneratorResult): Promise<void> {
  // Ensure output directory exists
  const baseDir = path.dirname(result.adapter.path);
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }

  // Write adapter
  fs.writeFileSync(result.adapter.path, result.adapter.code, 'utf-8');
  console.log(`✓ Generated: ${result.adapter.path}`);

  // Write logger if generated
  if (result.logger) {
    fs.writeFileSync(result.logger.path, result.logger.code, 'utf-8');
    console.log(`✓ Generated: ${result.logger.path}`);
  }

  // Write test if generated
  if (result.test) {
    fs.writeFileSync(result.test.path, result.test.code, 'utf-8');
    console.log(`✓ Generated: ${result.test.path}`);
  }

  // Write README
  fs.writeFileSync(result.readme.path, result.readme.code, 'utf-8');
  console.log(`✓ Generated: ${result.readme.path}`);
}
