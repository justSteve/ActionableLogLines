/**
 * Beads Source Adapter
 *
 * Parses beads event log lines and provides interactive commands.
 * Source: .beads/events.log
 * Format: TIMESTAMP|EVENT_CODE|ISSUE_ID|AGENT_ID|SESSION_ID|DETAILS
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import type {
  SourceAdapter,
  ActionableLogLine,
  ExpansionResult,
  QueryResult,
  Command,
} from '../protocol';

const execAsync = promisify(exec);

/** Event category descriptions */
const EVENT_CATEGORIES: Record<string, string> = {
  'ep': 'Epoch (app lifecycle)',
  'ss': 'Session (agent workflows)',
  'sk': 'Skill (Claude skill activations)',
  'bd': 'Beads (issue operations)',
  'gt': 'Git (version control)',
  'hk': 'Hook (git hook triggers)',
  'gd': 'Guard (enforcement)',
};

/**
 * Execute a bd command and return output
 */
async function runBdCommand(args: string): Promise<string> {
  try {
    const { stdout } = await execAsync(`bd ${args}`);
    return stdout.trim();
  } catch (error) {
    const err = error as { stderr?: string; message?: string };
    return err.stderr || err.message || 'Command failed';
  }
}

/**
 * Parse event code into category and action
 */
function parseEventCode(eventCode: string): { category: string; action: string } {
  const [category, ...rest] = eventCode.split('.');
  return { category, action: rest.join('.') };
}

/**
 * Create commands for a beads log line
 */
function createBeadsCommands(context: BeadsContext): Command[] {
  const commands: Command[] = [
    {
      name: 'show',
      aliases: ['s'],
      description: 'Show issue details',
      handler: async () => {
        if (!context.issueId || context.issueId === 'none') {
          return { handled: true, content: 'No issue associated with this event' };
        }
        const content = await runBdCommand(`show ${context.issueId}`);
        return { handled: true, content };
      },
    },
    {
      name: 'related',
      aliases: ['r', 'rel'],
      description: 'Show related events',
      handler: async () => {
        if (context.issueId && context.issueId !== 'none') {
          const content = await runBdCommand(`log --issue ${context.issueId}`);
          return { handled: true, content };
        }
        // Fall back to category filter
        const { category } = parseEventCode(context.eventCode);
        const content = await runBdCommand(`log --category ${category} --last 20`);
        return { handled: true, content };
      },
    },
    {
      name: 'deps',
      aliases: ['d', 'dependencies'],
      description: 'Show issue dependencies',
      handler: async () => {
        if (!context.issueId || context.issueId === 'none') {
          return { handled: true, content: 'No issue associated with this event' };
        }
        const content = await runBdCommand(`show ${context.issueId}`);
        return { handled: true, content };
      },
    },
    {
      name: 'category',
      aliases: ['c', 'cat'],
      description: 'Filter by event category',
      handler: async (params?: string) => {
        const cat = params || parseEventCode(context.eventCode).category;
        const content = await runBdCommand(`log --category ${cat} --last 30`);
        return { handled: true, content };
      },
    },
    {
      name: 'session',
      aliases: ['sess'],
      description: 'Show events from this session',
      handler: async () => {
        if (!context.sessionId) {
          return { handled: true, content: 'No session ID available' };
        }
        const content = await runBdCommand(`log --session ${context.sessionId}`);
        return { handled: true, content };
      },
    },
    {
      name: 'before',
      aliases: ['b'],
      description: 'Show events before this timestamp',
      handler: async () => {
        const content = await runBdCommand(`log --until ${context.timestamp} --last 20`);
        return { handled: true, content };
      },
    },
    {
      name: 'after',
      aliases: ['a'],
      description: 'Show events after this timestamp',
      handler: async () => {
        const content = await runBdCommand(`log --since ${context.timestamp} --last 20`);
        return { handled: true, content };
      },
    },
  ];

  return commands;
}

/** Context extracted from a beads log line */
interface BeadsContext {
  timestamp: string;
  eventCode: string;
  issueId: string;
  agentId: string;
  sessionId: string;
  details: string;
  [key: string]: string; // Index signature for Record<string, unknown> compatibility
}

/**
 * Create an ActionableLogLine from parsed beads context
 */
function createActionableLogLine(raw: string, context: BeadsContext): ActionableLogLine {
  const commands = createBeadsCommands(context);

  return {
    timestamp: context.timestamp,
    message: context.eventCode,
    raw,
    source: {
      type: 'beads',
      id: context.issueId || context.eventCode,
      context,
    },

    availableCommands: commands,

    async getDefaultExpansion(): Promise<ExpansionResult> {
      const { category, action } = parseEventCode(context.eventCode);
      const categoryDesc = EVENT_CATEGORIES[category] || 'Unknown';

      let content = `**Event:** ${context.eventCode}\n`;
      content += `**Category:** ${categoryDesc}\n`;
      content += `**Action:** ${action}\n`;

      if (context.issueId && context.issueId !== 'none') {
        content += `**Issue:** ${context.issueId}\n`;
      }
      if (context.agentId) {
        content += `**Agent:** ${context.agentId}\n`;
      }
      if (context.sessionId) {
        content += `**Session:** ${context.sessionId}\n`;
      }
      if (context.details) {
        content += `**Details:** ${context.details}\n`;
      }

      return {
        content,
        data: context,
        suggestions: ['show', 'related', 'category', 'session'],
      };
    },

    async handleQuery(input: string): Promise<QueryResult> {
      const trimmed = input.trim().toLowerCase();
      const [cmdName, ...args] = trimmed.split(/\s+/);
      const params = args.join(' ');

      // Find matching command
      for (const cmd of commands) {
        if (cmd.name === cmdName || cmd.aliases.includes(cmdName)) {
          return cmd.handler(params);
        }
      }

      // No command matched - return unhandled for Claude fallback
      return {
        handled: false,
        content: '',
        error: `Unknown command: ${cmdName}. Try: ${commands.map(c => c.name).join(', ')}`,
      };
    },
  };
}

/**
 * Beads Source Adapter implementation
 */
export const BeadsAdapter: SourceAdapter = {
  type: 'beads',

  parse(rawLine: string): ActionableLogLine | null {
    // Defensive: handle null/undefined input
    if (!rawLine || typeof rawLine !== 'string') {
      return null;
    }
    // Beads format: TIMESTAMP|EVENT_CODE|ISSUE_ID|AGENT_ID|SESSION_ID|DETAILS
    const parts = rawLine.split('|');
    if (parts.length < 5) {
      return null;
    }

    const [timestamp, eventCode, issueId, agentId, sessionId, ...detailParts] = parts;

    // Validate timestamp format (ISO 8601)
    if (!timestamp || !timestamp.match(/^\d{4}-\d{2}-\d{2}T/)) {
      return null;
    }

    // Validate event code format (category.action)
    if (!eventCode || !eventCode.includes('.')) {
      return null;
    }

    const context: BeadsContext = {
      timestamp,
      eventCode,
      issueId: issueId || 'none',
      agentId: agentId || '',
      sessionId: sessionId || '',
      details: detailParts.join('|'),
    };

    return createActionableLogLine(rawLine, context);
  },

  async getDefaultExpansion(line: ActionableLogLine): Promise<ExpansionResult> {
    return line.getDefaultExpansion();
  },

  async handleQuery(line: ActionableLogLine, input: string): Promise<QueryResult> {
    return line.handleQuery(input);
  },

  getCommands(): Command[] {
    // Return template commands (actual commands are line-specific)
    return createBeadsCommands({
      timestamp: '',
      eventCode: '',
      issueId: '',
      agentId: '',
      sessionId: '',
      details: '',
    });
  },
};

/**
 * Factory function for creating beads adapter
 */
export function createBeadsAdapter(): SourceAdapter {
  return BeadsAdapter;
}
