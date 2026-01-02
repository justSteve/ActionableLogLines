/**
 * Generator Tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { generateAdapter } from '../src/generator/index';
import type { AdapterConfig } from '../src/generator/types';

describe('Generator', () => {
  describe('generateAdapter', () => {
    it('should generate greenfield adapter', async () => {
      const config: AdapterConfig = {
        name: 'test-app',
        scenario: 'greenfield',
        format: 'pipe-delimited',
        eventCategories: ['errors', 'integrations'],
        commands: [
          {
            name: 'errors',
            aliases: ['e'],
            description: 'Show errors',
          },
        ],
        outputPath: '.allp',
        generateHelper: true,
        generateTests: true,
      };

      const result = await generateAdapter(config);

      // Verify adapter generated
      assert.ok(result.adapter);
      assert.ok(result.adapter.code.includes('TestApp'));
      assert.ok(result.adapter.code.includes('SourceAdapter'));

      // Verify logger generated
      assert.ok(result.logger);
      assert.ok(result.logger.code.includes('TestAppLogger'));

      // Verify test generated
      assert.ok(result.test);
      assert.ok(result.test.code.includes('describe'));

      // Verify README generated
      assert.ok(result.readme);
      assert.ok(result.readme.code.includes('TestApp'));
    });

    it('should generate JSON format adapter', async () => {
      const config: AdapterConfig = {
        name: 'json-app',
        scenario: 'custom',
        format: 'json',
        sampleLine: '{"timestamp":"2025-01-02T10:00:00Z","level":"info","message":"test"}',
        eventCategories: ['errors'],
        commands: [],
        outputPath: '.allp',
        generateHelper: false,
        generateTests: false,
      };

      const result = await generateAdapter(config);

      assert.ok(result.adapter);
      assert.ok(result.adapter.code.includes('JsonApp'));
      assert.ok(result.adapter.code.includes('JSON.parse'));
    });

    it('should handle commands configuration', async () => {
      const config: AdapterConfig = {
        name: 'cmd-app',
        scenario: 'greenfield',
        format: 'pipe-delimited',
        eventCategories: [],
        commands: [
          {
            name: 'test',
            aliases: ['t'],
            description: 'Test command',
          },
          {
            name: 'debug',
            aliases: ['d', 'dbg'],
            description: 'Debug command',
          },
        ],
        outputPath: '.allp',
        generateHelper: false,
        generateTests: false,
      };

      const result = await generateAdapter(config);

      assert.ok(result.adapter.code.includes("name: 'test'"));
      assert.ok(result.adapter.code.includes("name: 'debug'"));
      assert.ok(result.adapter.code.includes("aliases: ['t']"));
      assert.ok(result.adapter.code.includes("aliases: ['d', 'dbg']"));
    });

    it('should handle CLI integration', async () => {
      const config: AdapterConfig = {
        name: 'cli-app',
        scenario: 'greenfield',
        format: 'pipe-delimited',
        eventCategories: [],
        commands: [],
        cliIntegration: 'mycli',
        outputPath: '.allp',
        generateHelper: false,
        generateTests: false,
      };

      const result = await generateAdapter(config);

      assert.ok(result.adapter.code.includes('execAsync'));
      assert.ok(result.adapter.code.includes('mycli'));
    });
  });
});
