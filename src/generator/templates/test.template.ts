/**
 * {{ADAPTER_NAME}} Adapter Tests
 * Generated: {{GENERATION_DATE}}
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { {{ADAPTER_NAME}} } from './adapter';

describe('{{ADAPTER_NAME}} Adapter', () => {
  describe('parse', () => {
    it('should parse valid log line', () => {
      const sampleLine = '2025-01-02T10:00:00.000Z|test.event|corr-123|info|{"key":"value"}';
      const result = {{ADAPTER_NAME}}.parse(sampleLine);

      assert.ok(result, 'Should parse valid line');
      assert.strictEqual(result?.timestamp, '2025-01-02T10:00:00.000Z');
      assert.strictEqual(result?.message, 'test.event');
      assert.strictEqual(result?.source.type, '{{ADAPTER_TYPE}}');
    });

    it('should return null for invalid line', () => {
      const invalidLine = 'not a valid log line';
      const result = {{ADAPTER_NAME}}.parse(invalidLine);

      assert.strictEqual(result, null);
    });

    it('should return null for empty line', () => {
      const result = {{ADAPTER_NAME}}.parse('');
      assert.strictEqual(result, null);
    });

    it('should return null for non-string input', () => {
      const result = {{ADAPTER_NAME}}.parse(null as any);
      assert.strictEqual(result, null);
    });
  });

  describe('getDefaultExpansion', () => {
    it('should return expansion for parsed line', async () => {
      const sampleLine = '2025-01-02T10:00:00.000Z|test.event|corr-123|info|{"key":"value"}';
      const parsed = {{ADAPTER_NAME}}.parse(sampleLine);

      assert.ok(parsed, 'Should parse line');

      const expansion = await parsed!.getDefaultExpansion();
      assert.ok(expansion.content.includes('test.event'));
      assert.ok(Array.isArray(expansion.suggestions));
    });
  });

  describe('handleQuery', () => {
    it('should handle known commands', async () => {
      const sampleLine = '2025-01-02T10:00:00.000Z|test.event|corr-123|info|{}';
      const parsed = {{ADAPTER_NAME}}.parse(sampleLine);

      assert.ok(parsed, 'Should parse line');

      // Test first command if any exist
      const commands = {{ADAPTER_NAME}}.getCommands();
      if (commands.length > 0) {
        const result = await parsed!.handleQuery(commands[0].name);
        assert.strictEqual(result.handled, true);
      }
    });

    it('should return handled=false for unknown commands', async () => {
      const sampleLine = '2025-01-02T10:00:00.000Z|test.event|corr-123|info|{}';
      const parsed = {{ADAPTER_NAME}}.parse(sampleLine);

      assert.ok(parsed, 'Should parse line');

      const result = await parsed!.handleQuery('unknown-command-xyz');
      assert.strictEqual(result.handled, false);
      assert.ok(result.error);
    });
  });

  describe('getCommands', () => {
    it('should return array of commands', () => {
      const commands = {{ADAPTER_NAME}}.getCommands();
      assert.ok(Array.isArray(commands));

      commands.forEach(cmd => {
        assert.ok(cmd.name);
        assert.ok(Array.isArray(cmd.aliases));
        assert.ok(cmd.description);
        assert.strictEqual(typeof cmd.handler, 'function');
      });
    });
  });
});
