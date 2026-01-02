/**
 * Winston Logger Adapter Preset
 *
 * Parses Winston JSON format logs.
 */

import type { AdapterConfig } from '../types';

export function winstonPreset(name: string, outputPath: string): Partial<AdapterConfig> {
  return {
    scenario: 'winston',
    format: 'json',
    fieldMappings: [
      { source: 'timestamp', target: 'timestamp' },
      { source: 'level', target: 'level' },
      { source: 'message', target: 'eventType' },
      { source: 'meta', target: 'context', type: 'any' },
    ],
    eventCategories: ['errors', 'integrations'],
    commands: [
      {
        name: 'errors',
        aliases: ['e'],
        description: 'Filter error level logs',
      },
      {
        name: 'warnings',
        aliases: ['w', 'warn'],
        description: 'Filter warning level logs',
      },
    ],
    generateHelper: false, // Winston already provides logging
    generateTests: true,
  };
}
