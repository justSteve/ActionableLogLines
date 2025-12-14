/**
 * Adapter Registry
 *
 * Manages source adapters and routes log lines to appropriate handlers.
 */

import type { SourceAdapter, AdapterRegistry, ActionableLogLine } from '../protocol';

/**
 * Default adapter registry implementation
 */
export class DefaultAdapterRegistry implements AdapterRegistry {
  private adapters: Map<string, SourceAdapter> = new Map();

  register(adapter: SourceAdapter): void {
    if (this.adapters.has(adapter.type)) {
      console.warn(`Adapter '${adapter.type}' already registered, replacing`);
    }
    this.adapters.set(adapter.type, adapter);
  }

  get(type: string): SourceAdapter | undefined {
    return this.adapters.get(type);
  }

  parse(rawLine: string): ActionableLogLine | null {
    // Try each adapter until one matches
    for (const adapter of this.adapters.values()) {
      const result = adapter.parse(rawLine);
      if (result) {
        return result;
      }
    }
    return null;
  }

  types(): string[] {
    return Array.from(this.adapters.keys());
  }
}

// Singleton registry instance
let globalRegistry: AdapterRegistry | null = null;

/**
 * Get the global adapter registry
 */
export function getRegistry(): AdapterRegistry {
  if (!globalRegistry) {
    globalRegistry = new DefaultAdapterRegistry();
  }
  return globalRegistry;
}

/**
 * Register an adapter with the global registry
 */
export function registerAdapter(adapter: SourceAdapter): void {
  getRegistry().register(adapter);
}

// Re-export for convenience
export { BeadsAdapter, createBeadsAdapter } from './beads';
