/**
 * ALLP Adapter Generator CLI
 *
 * Interactive command-line tool for generating custom adapters.
 */

import prompts from 'prompts';
import * as path from 'path';
import { generateAdapter, writeGeneratedFiles } from './index';
import { greenfieldPreset } from './presets/greenfield';
import { winstonPreset } from './presets/winston';
import type { AdapterConfig, Scenario, LogFormat, CommandConfig } from './types';

export async function run() {
  console.log('\n🚀 ALLP Adapter Generator\n');

  try {
    const config = await promptForConfig();
    console.log('\n⚙️  Generating adapter...\n');

    const result = await generateAdapter(config);
    await writeGeneratedFiles(result);

    console.log('\n✅ Adapter generated successfully!\n');
    console.log('Next steps:');
    console.log('  1. Review generated files in:', config.outputPath);
    console.log('  2. Import and register the adapter in your app');
    console.log('  3. Start logging!\n');
  } catch (error: any) {
    if (error.message === 'canceled') {
      console.log('\n❌ Cancelled\n');
      process.exit(0);
    }
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

async function promptForConfig(): Promise<AdapterConfig> {
  // Step 1: Adapter name
  const { name } = await prompts({
    type: 'text',
    name: 'name',
    message: 'Adapter name (e.g., myapp-events):',
    validate: (value) => {
      if (!value) return 'Name is required';
      if (!/^[a-z0-9-]+$/.test(value)) return 'Use lowercase letters, numbers, and hyphens only';
      return true;
    },
  });

  // Step 2: Scenario
  const { scenario } = await prompts({
    type: 'select',
    name: 'scenario',
    message: 'What scenario describes your app?',
    choices: [
      { title: 'Greenfield - design from scratch', value: 'greenfield' },
      { title: 'Fork with Winston logger', value: 'winston' },
      { title: 'Fork with Bunyan logger', value: 'bunyan' },
      { title: 'Fork with Pino logger', value: 'pino' },
      { title: 'Custom - I\'ll configure everything', value: 'custom' },
    ],
  });

  // Load preset if applicable
  let config: Partial<AdapterConfig> = {};
  const outputPath = '.allp';

  if (scenario === 'greenfield') {
    config = greenfieldPreset(name, outputPath);
  } else if (scenario === 'winston') {
    config = winstonPreset(name, outputPath);
  }

  // Step 3: Log format (conditional)
  let format: LogFormat = config.format || 'pipe-delimited';
  if (scenario === 'greenfield' || scenario === 'custom') {
    const formatAnswer = await prompts({
      type: 'select',
      name: 'format',
      message: 'Choose log format:',
      choices: [
        { title: 'Pipe-delimited with JSON context (recommended)', value: 'pipe-delimited' },
        { title: 'JSON lines', value: 'json' },
        { title: 'Custom format', value: 'custom' },
      ],
    });
    format = formatAnswer.format;
  }

  // Step 4: Sample log line (for existing loggers)
  let sampleLine: string | undefined;
  if (['winston', 'bunyan', 'pino', 'custom'].includes(scenario)) {
    const sampleAnswer = await prompts({
      type: 'text',
      name: 'sampleLine',
      message: 'Paste a sample log line:',
      validate: (value) => (value ? true : 'Sample line required for format detection'),
    });
    sampleLine = sampleAnswer.sampleLine;
  }

  // Step 5: Event categories
  const { eventCategories } = await prompts({
    type: 'multiselect',
    name: 'eventCategories',
    message: 'Select event categories to log:',
    choices: [
      { title: 'Error events (catch blocks)', value: 'errors', selected: true },
      { title: 'Integration points (API/DB calls)', value: 'integrations', selected: true },
      { title: 'Performance timing spans', value: 'timing', selected: true },
      { title: 'Session initialization', value: 'session', selected: false },
      { title: 'Business workflow events', value: 'workflow', selected: false },
      { title: 'DSPy-specific events', value: 'dspy', selected: false },
      { title: 'Security audit events', value: 'security', selected: false },
    ],
  });

  // Step 6: Commands
  const { addCommands } = await prompts({
    type: 'confirm',
    name: 'addCommands',
    message: 'Add custom commands?',
    initial: false,
  });

  let commands: CommandConfig[] = config.commands || [];
  if (addCommands) {
    commands = await promptForCommands();
  }

  // Step 7: CLI integration
  const { cliIntegration } = await prompts({
    type: 'confirm',
    name: 'cliIntegration',
    message: 'Integrate with external CLI tool (like beads uses "bd")?',
    initial: false,
  });

  let cliName: string | undefined;
  if (cliIntegration) {
    const cliAnswer = await prompts({
      type: 'text',
      name: 'cliName',
      message: 'CLI command name:',
      validate: (value) => (value ? true : 'CLI name required'),
    });
    cliName = cliAnswer.cliName;
  }

  // Step 8: Output location
  const { customOutputPath } = await prompts({
    type: 'confirm',
    name: 'customOutputPath',
    message: `Use default output path (.allp/)?`,
    initial: true,
  });

  let finalOutputPath = '.allp';
  if (!customOutputPath) {
    const pathAnswer = await prompts({
      type: 'text',
      name: 'outputPath',
      message: 'Output path:',
      initial: '.allp',
    });
    finalOutputPath = pathAnswer.outputPath;
  }

  // Step 9: Helper library
  const { generateHelper } = await prompts({
    type: 'confirm',
    name: 'generateHelper',
    message: 'Generate helper logger library (logger.logError(), logger.logApiCall(), etc.)?',
    initial: config.generateHelper !== undefined ? config.generateHelper : true,
  });

  // Build final configuration
  const finalConfig: AdapterConfig = {
    name,
    scenario: scenario as Scenario,
    format,
    sampleLine,
    eventCategories,
    commands,
    cliIntegration: cliName,
    outputPath: finalOutputPath,
    generateHelper,
    generateTests: true,
  };

  return finalConfig;
}

async function promptForCommands(): Promise<CommandConfig[]> {
  const commands: CommandConfig[] = [];
  let addMore = true;

  while (addMore) {
    const cmd = await prompts([
      {
        type: 'text',
        name: 'name',
        message: 'Command name:',
        validate: (value) => (value ? true : 'Name required'),
      },
      {
        type: 'list',
        name: 'aliases',
        message: 'Aliases (comma-separated):',
        separator: ',',
      },
      {
        type: 'text',
        name: 'description',
        message: 'Description:',
        validate: (value) => (value ? true : 'Description required'),
      },
    ]);

    commands.push({
      name: cmd.name,
      aliases: cmd.aliases || [],
      description: cmd.description,
    });

    const { more } = await prompts({
      type: 'confirm',
      name: 'more',
      message: 'Add another command?',
      initial: false,
    });

    addMore = more;
  }

  return commands;
}

// Handle SIGINT
process.on('SIGINT', () => {
  console.log('\n\n❌ Cancelled\n');
  process.exit(0);
});
