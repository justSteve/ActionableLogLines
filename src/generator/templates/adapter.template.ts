/**
 * {{ADAPTER_NAME}} - ALLP Adapter
 * Generated: {{GENERATION_DATE}}
 * Format: {{LOG_FORMAT}}
 */

import type { SourceAdapter, ActionableLogLine, ExpansionResult, QueryResult, Command } from 'allp';
{{#if hasCliIntegration}}
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);
{{/if}}

/** Context extracted from log line */
interface {{ADAPTER_NAME}}Context {
  timestamp: string;
  eventType: string;
  correlationId?: string;
  level?: string;
  {{#each customFields}}
  {{this.name}}: {{this.type}};
  {{/each}}
  [key: string]: any;
}

/** Parse log line into context */
function parseLogLine(rawLine: string): {{ADAPTER_NAME}}Context | null {
  {{#if (eq formatType 'pipe-delimited')}}
  const parts = rawLine.split('|');
  if (parts.length < {{minimumFields}}) return null;

  const [timestamp, eventType, correlationId, level, contextJson] = parts;

  // Validate timestamp
  if (!timestamp.match(/^\d{4}-\d{2}-\d{2}T/)) return null;

  // Parse context JSON
  let context: any = {};
  try {
    if (contextJson) {
      context = JSON.parse(contextJson);
    }
  } catch {
    return null;
  }

  return {
    timestamp,
    eventType,
    correlationId,
    level,
    ...context
  };
  {{/if}}
  {{#if (eq formatType 'json')}}
  try {
    const parsed = JSON.parse(rawLine);
    return {
      timestamp: parsed.{{timestampField}},
      eventType: parsed.{{eventTypeField}},
      correlationId: parsed.{{correlationIdField}},
      level: parsed.{{levelField}},
      {{#each fieldMappings}}
      {{this.target}}: parsed.{{this.source}},
      {{/each}}
      ...parsed
    };
  } catch {
    return null;
  }
  {{/if}}
}

{{#if hasCliIntegration}}
/** Execute CLI command */
async function runCliCommand(args: string): Promise<string> {
  try {
    const { stdout } = await execAsync(`{{cliName}} ${args}`);
    return stdout.trim();
  } catch (error: any) {
    return error.stderr || error.message || 'Command failed';
  }
}
{{/if}}

/** Create commands for this adapter */
function createCommands(context: {{ADAPTER_NAME}}Context): Command[] {
  return [
    {{#each commands}}
    {
      name: '{{this.name}}',
      aliases: [{{#each this.aliases}}'{{this}}'{{#unless @last}}, {{/unless}}{{/each}}],
      description: '{{this.description}}',
      handler: async (params?: string) => {
        {{#if this.cliCommand}}
        const output = await runCliCommand('{{this.cliCommand}} ' + (params || ''));
        return { handled: true, content: output };
        {{else}}
        // Custom handler logic
        return { handled: true, content: '{{this.name}} result' };
        {{/if}}
      }
    },
    {{/each}}
  ];
}

/** Create ActionableLogLine from context */
function createActionableLogLine(raw: string, context: {{ADAPTER_NAME}}Context): ActionableLogLine {
  const commands = createCommands(context);

  return {
    timestamp: context.timestamp,
    message: context.eventType,
    raw,
    level: context.level as any,
    source: {
      type: '{{ADAPTER_TYPE}}',
      id: context.correlationId || context.timestamp,
      context: context as Record<string, unknown>
    },
    availableCommands: commands,

    async getDefaultExpansion(): Promise<ExpansionResult> {
      let content = `**Event:** ${context.eventType}\n`;
      content += `**Timestamp:** ${context.timestamp}\n`;

      if (context.level) {
        content += `**Level:** ${context.level}\n`;
      }

      if (context.correlationId) {
        content += `**Correlation ID:** ${context.correlationId}\n`;
      }

      {{#if hasErrorFields}}
      if (context.error) {
        content += `\n**Error:**\n`;
        content += `  Type: ${context.error.type}\n`;
        content += `  Message: ${context.error.message}\n`;
        if (context.error.stack) {
          content += `  Stack: ${context.error.stack.split('\\n').slice(0, 3).join('\\n')}\n`;
        }
      }
      {{/if}}

      {{#if hasTimingFields}}
      if (context.timing) {
        content += `\n**Performance:**\n`;
        content += `  Duration: ${context.timing.duration_ms}ms\n`;
      }
      {{/if}}

      {{#if hasIntegrationFields}}
      if (context.integration) {
        content += `\n**Integration:**\n`;
        content += `  Endpoint: ${context.integration.endpoint}\n`;
        content += `  Status: ${context.integration.status}\n`;
      }
      {{/if}}

      return {
        content,
        data: context,
        suggestions: commands.map(c => c.name)
      };
    },

    async handleQuery(input: string): Promise<QueryResult> {
      const trimmed = input.trim().toLowerCase();
      const [cmdName, ...args] = trimmed.split(/\s+/);
      const params = args.join(' ');

      for (const cmd of commands) {
        if (cmd.name === cmdName || cmd.aliases.includes(cmdName)) {
          return cmd.handler(params);
        }
      }

      return {
        handled: false,
        content: '',
        error: `Unknown command: ${cmdName}`
      };
    }
  };
}

/** {{ADAPTER_NAME}} Source Adapter */
export const {{ADAPTER_NAME}}: SourceAdapter = {
  type: '{{ADAPTER_TYPE}}',

  parse(rawLine: string): ActionableLogLine | null {
    if (!rawLine || typeof rawLine !== 'string') return null;

    const context = parseLogLine(rawLine);
    if (!context) return null;

    return createActionableLogLine(rawLine, context);
  },

  async getDefaultExpansion(line: ActionableLogLine): Promise<ExpansionResult> {
    return line.getDefaultExpansion();
  },

  async handleQuery(line: ActionableLogLine, input: string): Promise<QueryResult> {
    return line.handleQuery(input);
  },

  getCommands(): Command[] {
    return createCommands({
      timestamp: '',
      eventType: '',
      {{#each customFields}}
      {{this.name}}: {{this.defaultValue}},
      {{/each}}
    });
  }
};

/** Factory function */
export function create{{ADAPTER_NAME}}(): SourceAdapter {
  return {{ADAPTER_NAME}};
}
