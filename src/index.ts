/**
 * Actionable Log Lines Protocol (ALLP)
 *
 * Interactive log viewing where each log line is both display
 * AND an interaction portal back to its source entity.
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
} from './protocol';

export { DEFAULT_RENDERER_CONFIG } from './protocol';

// Adapter registry
export {
  DefaultAdapterRegistry,
  getRegistry,
  registerAdapter,
} from './adapters';

// Built-in adapters
export { BeadsAdapter, createBeadsAdapter } from './adapters/beads';

// Query interpreter
export {
  interpret,
  parseCommand,
  isNaturalLanguage,
  configureClaudeFallback,
} from './interpreter';
export type { ClaudeFallbackConfig } from './interpreter';
