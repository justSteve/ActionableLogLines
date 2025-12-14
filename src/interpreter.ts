/**
 * Query Interpreter
 *
 * Hybrid interpreter: tries commands first, falls back to Claude for NL queries.
 */

import type { ActionableLogLine, QueryResult } from './protocol';

/**
 * Configuration for Claude fallback
 */
export interface ClaudeFallbackConfig {
  /** Whether Claude fallback is enabled */
  enabled: boolean;
  /** Function to send query to Claude (injected by host) */
  handler?: (context: string, query: string) => Promise<string>;
}

/**
 * Default fallback config (disabled)
 */
const defaultFallbackConfig: ClaudeFallbackConfig = {
  enabled: false,
};

let fallbackConfig = defaultFallbackConfig;

/**
 * Configure Claude fallback
 */
export function configureClaudeFallback(config: ClaudeFallbackConfig): void {
  fallbackConfig = config;
}

/**
 * Format log line context for Claude
 */
function formatContextForClaude(line: ActionableLogLine): string {
  const ctx = line.source.context as Record<string, string>;
  let context = `Log line context:\n`;
  context += `- Type: ${line.source.type}\n`;
  context += `- Timestamp: ${line.timestamp}\n`;
  context += `- Message: ${line.message}\n`;
  context += `- ID: ${line.source.id}\n`;

  // Add source-specific context
  for (const [key, value] of Object.entries(ctx)) {
    if (value && value !== 'none') {
      context += `- ${key}: ${value}\n`;
    }
  }

  // Add available commands
  const commands = line.availableCommands.map(c => `${c.name} (${c.description})`);
  context += `\nAvailable commands: ${commands.join(', ')}`;

  return context;
}

/**
 * Interpret a user query against a log line
 *
 * Flow:
 * 1. Try to match a command
 * 2. If no match and Claude fallback enabled, send to Claude
 * 3. Return error with command suggestions if no match and no fallback
 */
export async function interpret(
  line: ActionableLogLine,
  input: string
): Promise<QueryResult> {
  // Try line's built-in handler first (includes command matching)
  const result = await line.handleQuery(input);

  if (result.handled) {
    return result;
  }

  // Command not matched - try Claude fallback
  if (fallbackConfig.enabled && fallbackConfig.handler) {
    try {
      const context = formatContextForClaude(line);
      const response = await fallbackConfig.handler(context, input);
      return {
        handled: true,
        content: response,
      };
    } catch (error) {
      const err = error as { message?: string };
      return {
        handled: false,
        content: '',
        error: `Claude fallback failed: ${err.message}`,
      };
    }
  }

  // No fallback - return the original error with suggestions
  return result;
}

/**
 * Parse command from input
 * Returns: { command, params } or null if not a command
 */
export function parseCommand(input: string): { command: string; params: string } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Commands start with a word (letters/numbers)
  const match = trimmed.match(/^(\w+)(?:\s+(.*))?$/);
  if (!match) return null;

  return {
    command: match[1].toLowerCase(),
    params: match[2]?.trim() || '',
  };
}

/**
 * Check if input looks like a natural language query (vs a command)
 */
export function isNaturalLanguage(input: string): boolean {
  const trimmed = input.trim().toLowerCase();

  // Common NL patterns
  const nlPatterns = [
    /^what\s/,
    /^why\s/,
    /^how\s/,
    /^when\s/,
    /^where\s/,
    /^who\s/,
    /^can\s/,
    /^could\s/,
    /^would\s/,
    /^should\s/,
    /^is\s/,
    /^are\s/,
    /^tell\s+me/,
    /^explain/,
    /^describe/,
    /\?$/,
  ];

  return nlPatterns.some(pattern => pattern.test(trimmed));
}
