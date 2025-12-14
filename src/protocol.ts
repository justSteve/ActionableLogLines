/**
 * Actionable Log Lines Protocol (ALLP)
 *
 * Core interfaces for interactive log viewing where each log line
 * is both display AND an interaction portal to its source entity.
 */

/**
 * Result of expanding a log line (Phase 1: Click)
 */
export interface ExpansionResult {
  /** Formatted content to display in response panel */
  content: string;
  /** Optional structured data for programmatic use */
  data?: Record<string, unknown>;
  /** Suggested commands for this context */
  suggestions?: string[];
}

/**
 * Result of a user query (Phase 2: Text input)
 */
export interface QueryResult {
  /** Whether the query was handled by a command (vs Claude fallback) */
  handled: boolean;
  /** Result content to display */
  content: string;
  /** Optional structured data */
  data?: Record<string, unknown>;
  /** Error message if query failed */
  error?: string;
}

/**
 * A command available for a log line
 */
export interface Command {
  /** Primary command name */
  name: string;
  /** Alternative names (shortcuts) */
  aliases: string[];
  /** Human-readable description */
  description: string;
  /** Execute the command */
  handler: (params?: string) => Promise<QueryResult>;
}

/**
 * Core log line with interaction capabilities
 */
export interface ActionableLogLine {
  // === Core log data ===

  /** ISO 8601 timestamp */
  timestamp: string;
  /** Primary message/event code */
  message: string;
  /** Optional log level */
  level?: 'debug' | 'info' | 'warn' | 'error';
  /** Raw original line (for display) */
  raw: string;

  // === Source identity ===

  source: {
    /** Adapter type identifier */
    type: string;
    /** Entity identifier within the source */
    id: string;
    /** Source-specific metadata */
    context: Record<string, unknown>;
  };

  // === Interaction handlers ===

  /** Get default expansion (Phase 1) */
  getDefaultExpansion(): Promise<ExpansionResult>;
  /** Handle user query (Phase 2) */
  handleQuery(input: string): Promise<QueryResult>;
  /** Available commands for this line */
  availableCommands: Command[];
}

/**
 * Adapter interface for parsing and handling a specific log source
 */
export interface SourceAdapter {
  /** Unique type identifier (e.g., "beads", "git", "api") */
  type: string;

  /**
   * Parse a raw log line into an ActionableLogLine
   * @returns null if line doesn't match this adapter's format
   */
  parse(rawLine: string): ActionableLogLine | null;

  /**
   * Generate default expansion for a parsed line
   */
  getDefaultExpansion(line: ActionableLogLine): Promise<ExpansionResult>;

  /**
   * Handle user query with command matching + fallback
   */
  handleQuery(line: ActionableLogLine, input: string): Promise<QueryResult>;

  /**
   * Get all commands available for this source type
   */
  getCommands(): Command[];
}

/**
 * Registry for managing multiple source adapters
 */
export interface AdapterRegistry {
  /** Register an adapter */
  register(adapter: SourceAdapter): void;

  /** Get adapter by type */
  get(type: string): SourceAdapter | undefined;

  /** Try to parse a line with any registered adapter */
  parse(rawLine: string): ActionableLogLine | null;

  /** List all registered adapter types */
  types(): string[];
}

/**
 * Configuration for the ALLP renderer
 */
export interface RendererConfig {
  /** Height of response panel in pixels (or 'auto') */
  responsePanelHeight: number | 'auto';
  /** Maximum lines to keep in log buffer */
  maxLogLines: number;
  /** Enable auto-scroll when new lines arrive */
  autoScroll: boolean;
  /** Show line numbers */
  showLineNumbers: boolean;
  /** Theme: 'light' | 'dark' | 'auto' */
  theme: 'light' | 'dark' | 'auto';
}

/**
 * Default renderer configuration
 */
export const DEFAULT_RENDERER_CONFIG: RendererConfig = {
  responsePanelHeight: 200,
  maxLogLines: 10000,
  autoScroll: true,
  showLineNumbers: true,
  theme: 'auto',
};
