/**
 * ALLP Standalone Library
 *
 * Core Actionable Log Lines Protocol without VS Code dependencies.
 * Use this for CLI tools, web servers, or any non-VS Code application.
 */

// Core protocol types
export type {
  ActionableLogLine,
  SourceAdapter,
  AdapterRegistry,
  Command,
  ExpansionResult,
  QueryResult,
  RendererConfig,
} from '../protocol';

export { DEFAULT_RENDERER_CONFIG } from '../protocol';

// Adapter registry
export {
  DefaultAdapterRegistry,
  getRegistry,
  registerAdapter,
} from '../adapters';

// Built-in adapters
export { BeadsAdapter, createBeadsAdapter } from '../adapters/beads';

// Query interpreter
export {
  interpret,
  parseCommand,
  isNaturalLanguage,
  configureClaudeFallback,
} from '../interpreter';

export type { ClaudeFallbackConfig } from '../interpreter';
