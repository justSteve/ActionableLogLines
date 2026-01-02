/**
 * Generator Configuration Types
 */

export type Scenario = 'greenfield' | 'winston' | 'bunyan' | 'pino' | 'custom';
export type LogFormat = 'pipe-delimited' | 'json' | 'space-delimited' | 'custom';

export interface CommandConfig {
  name: string;
  aliases: string[];
  description: string;
  cliCommand?: string;
  handler?: string; // Custom handler code
}

export interface FieldMapping {
  source: string;  // Field name in source log
  target: string;  // Field name in ALLP context
  type?: string;   // TypeScript type
}

export interface AdapterConfig {
  name: string;
  scenario: Scenario;
  format: LogFormat;

  // Format-specific
  sampleLine?: string;
  parsePattern?: string | RegExp;
  fieldMappings?: FieldMapping[];

  // Features
  eventCategories: string[];
  commands: CommandConfig[];

  // Optional integrations
  cliIntegration?: string;

  // Output
  outputPath: string;
  generateHelper: boolean;
  generateTests: boolean;
}

export interface GeneratorResult {
  adapter: {
    path: string;
    code: string;
  };
  logger?: {
    path: string;
    code: string;
  };
  test?: {
    path: string;
    code: string;
  };
  readme: {
    path: string;
    code: string;
  };
}

export interface TemplateContext {
  ADAPTER_NAME: string;
  ADAPTER_TYPE: string;
  GENERATION_DATE: string;
  LOG_FORMAT: string;

  // Format details
  formatType: LogFormat;
  minimumFields?: number;
  timestampField?: string;
  eventTypeField?: string;
  correlationIdField?: string;
  levelField?: string;

  // Features
  hasCliIntegration: boolean;
  cliName?: string;
  hasErrorFields: boolean;
  hasTimingFields: boolean;
  hasIntegrationFields: boolean;

  // Custom
  customFields: Array<{ name: string; type: string; defaultValue: string }>;
  fieldMappings: FieldMapping[];
  commands: CommandConfig[];

  // Logger helper
  appName: string;
  logFileName: string;
}
