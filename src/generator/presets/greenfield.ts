/**
 * Greenfield Adapter Preset
 *
 * Recommended format for new applications.
 * Uses pipe-delimited format with JSON context.
 */

import type { AdapterConfig } from '../types';

export function greenfieldPreset(name: string, outputPath: string): Partial<AdapterConfig> {
  return {
    scenario: 'greenfield',
    format: 'pipe-delimited',
    eventCategories: ['errors', 'integrations', 'timing'],
    commands: [
      {
        name: 'errors',
        aliases: ['e', 'err'],
        description: 'Show all error events',
      },
      {
        name: 'slow',
        aliases: ['s'],
        description: 'Show slow operations (>1000ms)',
      },
      {
        name: 'recent',
        aliases: ['r'],
        description: 'Show recent events',
      },
    ],
    generateHelper: true,
    generateTests: true,
  };
}
