/**
 * ALLP Integration Tests
 *
 * End-to-end tests for complete ALLP workflow.
 * Tests the full pipeline from raw log lines through interpretation to results.
 */

import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import {
  DefaultAdapterRegistry,
  BeadsAdapter,
  interpret,
  parseCommand,
  isNaturalLanguage,
} from '../src/index';
import type { ActionableLogLine, SourceAdapter, Command, QueryResult } from '../src/protocol';
import { MOCK_BEADS_LINES, measureAsync } from './harness';

/**
 * Create a complete test adapter matching the SourceAdapter interface
 */
function createTestAdapter(type: string, prefix: string): SourceAdapter {
  const commands: Command[] = [
    {
      name: 'test',
      aliases: ['t'],
      description: 'Test command',
      handler: async () => ({ handled: true, content: `${type} test command` }),
    },
  ];

  return {
    type,
    parse(rawLine: string): ActionableLogLine | null {
      if (!rawLine.startsWith(prefix)) return null;
      const message = rawLine.slice(prefix.length);
      return {
        timestamp: new Date().toISOString(),
        message,
        raw: rawLine,
        source: { type, id: 'test-id', context: { prefix } },
        availableCommands: commands,
        getDefaultExpansion: async () => ({
          content: `${type} expansion: ${rawLine}`,
          suggestions: ['test'],
        }),
        handleQuery: async (query: string) => ({
          handled: true,
          content: `${type} handled: ${query}`,
        }),
      };
    },
    getDefaultExpansion: async (line: ActionableLogLine) => ({
      content: `${type} expansion: ${line.raw}`,
      suggestions: ['test'],
    }),
    handleQuery: async (_line: ActionableLogLine, input: string) => ({
      handled: true,
      content: `${type} handled: ${input}`,
    }),
    getCommands(): Command[] {
      return commands;
    },
  };
}

/**
 * E2E Happy Path Tests
 * Raw line → parse → ActionableLogLine → query → result
 */
describe('E2E Happy Path', () => {
  let registry: DefaultAdapterRegistry;

  beforeEach(() => {
    registry = new DefaultAdapterRegistry();
    registry.register(BeadsAdapter);
  });

  it('should complete full workflow: parse → expand → query', async () => {
    const rawLine = MOCK_BEADS_LINES.valid.issueCreate;

    // Step 1: Parse raw line into ActionableLogLine
    const parsed = registry.parse(rawLine);
    assert.ok(parsed, 'Should parse valid beads line');
    assert.strictEqual(parsed.source.type, 'beads');
    assert.ok(parsed.timestamp, 'Should have timestamp');
    assert.ok(parsed.message, 'Should have message');

    // Step 2: Get default expansion (click behavior)
    const expansion = await parsed.getDefaultExpansion();
    assert.ok(expansion.content, 'Expansion should have content');
    assert.ok(Array.isArray(expansion.suggestions), 'Expansion should have suggestions array');

    // Step 3: Execute a query command
    const result = await interpret(parsed, 'show');
    assert.ok(result.handled || result.content, 'Query should produce a result');
  });

  it('should handle multiple sequential queries on same line', async () => {
    const rawLine = MOCK_BEADS_LINES.valid.issueCreate;
    const parsed = registry.parse(rawLine);
    assert.ok(parsed);

    // Execute multiple queries in sequence
    const queries = ['show', 'category', 'related'];
    for (const query of queries) {
      const result = await interpret(parsed, query);
      // Each query should return without throwing
      assert.ok(result, `Query '${query}' should return a result`);
    }
  });

  it('should complete workflow for each valid event type', async () => {
    const validLines = Object.entries(MOCK_BEADS_LINES.valid);

    for (const [name, rawLine] of validLines) {
      const parsed = registry.parse(rawLine);
      assert.ok(parsed, `Should parse ${name}`);

      const expansion = await parsed.getDefaultExpansion();
      assert.ok(expansion.content, `${name} should have expansion content`);
    }
  });

  it('should have acceptable parse performance', async () => {
    const rawLine = MOCK_BEADS_LINES.valid.issueCreate;
    const iterations = 100;

    const { durationMs } = await measureAsync(async () => {
      for (let i = 0; i < iterations; i++) {
        registry.parse(rawLine);
      }
    });

    const avgMs = durationMs / iterations;
    assert.ok(avgMs < 10, `Average parse time ${avgMs}ms should be < 10ms`);
  });
});

/**
 * Multi-Adapter Routing Tests
 */
describe('Multi-Adapter Routing', () => {
  let registry: DefaultAdapterRegistry;

  beforeEach(() => {
    registry = new DefaultAdapterRegistry();
  });

  it('should route to correct adapter by line format', () => {
    const alphaAdapter = createTestAdapter('alpha', 'ALPHA:');
    const betaAdapter = createTestAdapter('beta', 'BETA:');

    registry.register(alphaAdapter);
    registry.register(betaAdapter);

    const alphaLine = registry.parse('ALPHA:test message');
    const betaLine = registry.parse('BETA:another message');
    const unknownLine = registry.parse('GAMMA:unknown');

    assert.ok(alphaLine, 'Should parse alpha line');
    assert.strictEqual(alphaLine.source.type, 'alpha');

    assert.ok(betaLine, 'Should parse beta line');
    assert.strictEqual(betaLine.source.type, 'beta');

    assert.strictEqual(unknownLine, null, 'Should not parse unknown format');
  });

  it('should use first matching adapter when multiple could match', () => {
    // Both adapters match lines starting with 'TEST:'
    const firstAdapter = createTestAdapter('first', 'TEST:');
    const secondAdapter = createTestAdapter('second', 'TEST:');

    registry.register(firstAdapter);
    registry.register(secondAdapter);

    const parsed = registry.parse('TEST:message');
    assert.ok(parsed);
    assert.strictEqual(parsed.source.type, 'first', 'Should use first registered adapter');
  });

  it('should support BeadsAdapter alongside custom adapters', () => {
    const customAdapter = createTestAdapter('custom', 'CUSTOM:');

    registry.register(BeadsAdapter);
    registry.register(customAdapter);

    const beadsLine = registry.parse(MOCK_BEADS_LINES.valid.issueCreate);
    const customLine = registry.parse('CUSTOM:my message');

    assert.ok(beadsLine);
    assert.strictEqual(beadsLine.source.type, 'beads');

    assert.ok(customLine);
    assert.strictEqual(customLine.source.type, 'custom');
  });

  it('should list all registered adapter types', () => {
    const adapter1 = createTestAdapter('type1', 'T1:');
    const adapter2 = createTestAdapter('type2', 'T2:');

    registry.register(adapter1);
    registry.register(adapter2);
    registry.register(BeadsAdapter);

    const types = registry.types();
    assert.ok(types.includes('type1'));
    assert.ok(types.includes('type2'));
    assert.ok(types.includes('beads'));
  });
});

/**
 * Error Boundary Tests
 */
describe('Error Boundaries', () => {
  let registry: DefaultAdapterRegistry;

  beforeEach(() => {
    registry = new DefaultAdapterRegistry();
    registry.register(BeadsAdapter);
  });

  describe('Parse errors', () => {
    it('should return null for all invalid formats without throwing', () => {
      const invalidLines = Object.values(MOCK_BEADS_LINES.invalid);

      for (const line of invalidLines) {
        assert.doesNotThrow(() => {
          const result = registry.parse(line);
          assert.strictEqual(result, null, `Should return null for invalid line: "${line}"`);
        });
      }
    });

    it('should handle null and undefined gracefully', () => {
      assert.doesNotThrow(() => {
        const result1 = registry.parse(null as unknown as string);
        const result2 = registry.parse(undefined as unknown as string);
        assert.strictEqual(result1, null);
        assert.strictEqual(result2, null);
      });
    });
  });

  describe('Query errors', () => {
    it('should handle unknown commands gracefully', async () => {
      const parsed = registry.parse(MOCK_BEADS_LINES.valid.issueCreate);
      assert.ok(parsed);

      const result = await interpret(parsed, 'nonexistent-command-xyz');
      assert.strictEqual(result.handled, false, 'Unknown command should be unhandled');
    });

    it('should handle empty query input', async () => {
      const parsed = registry.parse(MOCK_BEADS_LINES.valid.issueCreate);
      assert.ok(parsed);

      const cmd = parseCommand('');
      assert.strictEqual(cmd, null, 'Empty input should parse to null');

      const cmd2 = parseCommand('   ');
      assert.strictEqual(cmd2, null, 'Whitespace input should parse to null');
    });

    it('should distinguish commands from natural language', () => {
      // Commands
      assert.strictEqual(isNaturalLanguage('show'), false);
      assert.strictEqual(isNaturalLanguage('deps'), false);
      assert.strictEqual(isNaturalLanguage('category'), false);

      // Natural language
      assert.strictEqual(isNaturalLanguage('What is this?'), true);
      assert.strictEqual(isNaturalLanguage('why did this happen'), true);
      assert.strictEqual(isNaturalLanguage('tell me about this'), true);
    });
  });

  describe('Adapter errors', () => {
    it('should handle adapter that throws during parse', () => {
      const throwingAdapter: SourceAdapter = {
        type: 'throwing',
        parse(): ActionableLogLine | null {
          throw new Error('Parse explosion');
        },
        getDefaultExpansion: async () => ({ content: '', suggestions: [] }),
        handleQuery: async () => ({ handled: false, content: '' }),
        getCommands(): Command[] {
          return [];
        },
      };

      registry.register(throwingAdapter);

      // Should not throw - registry should handle adapter errors
      assert.doesNotThrow(() => {
        // BeadsAdapter should still work
        const result = registry.parse(MOCK_BEADS_LINES.valid.issueCreate);
        assert.ok(result);
      });
    });

    it('should handle adapter with async errors in handleQuery', async () => {
      const commands: Command[] = [];
      const errorAdapter: SourceAdapter = {
        type: 'error-test',
        parse(rawLine: string): ActionableLogLine | null {
          if (!rawLine.startsWith('ERROR:')) return null;
          return {
            timestamp: new Date().toISOString(),
            message: rawLine,
            raw: rawLine,
            source: { type: 'error-test', id: 'err', context: {} },
            availableCommands: commands,
            getDefaultExpansion: async () => ({ content: 'test', suggestions: [] }),
            handleQuery: async () => {
              throw new Error('Query explosion');
            },
          };
        },
        getDefaultExpansion: async () => ({ content: 'test', suggestions: [] }),
        handleQuery: async () => {
          throw new Error('Query explosion');
        },
        getCommands(): Command[] {
          return commands;
        },
      };

      registry.register(errorAdapter);
      const parsed = registry.parse('ERROR:test');
      assert.ok(parsed);

      // Should handle error gracefully
      try {
        await parsed.handleQuery('anything');
        assert.fail('Should have thrown');
      } catch (e) {
        assert.ok(e instanceof Error);
      }
    });
  });

  describe('Registry edge cases', () => {
    it('should handle empty registry', () => {
      const emptyRegistry = new DefaultAdapterRegistry();
      const result = emptyRegistry.parse('any line');
      assert.strictEqual(result, null);
    });

    it('should handle re-registration of same adapter type', () => {
      const commands: Command[] = [];
      const adapter1: SourceAdapter = {
        type: 'test',
        parse: () => null,
        getDefaultExpansion: async () => ({ content: '', suggestions: [] }),
        handleQuery: async () => ({ handled: false, content: '' }),
        getCommands: () => [],
      };
      const adapter2: SourceAdapter = {
        type: 'test',
        parse: (line) => line === 'MATCH' ? {
          timestamp: '',
          message: 'matched',
          raw: line,
          source: { type: 'test', id: 'new', context: {} },
          availableCommands: commands,
          getDefaultExpansion: async () => ({ content: '', suggestions: [] }),
          handleQuery: async () => ({ handled: false, content: '' }),
        } : null,
        getDefaultExpansion: async () => ({ content: '', suggestions: [] }),
        handleQuery: async () => ({ handled: false, content: '' }),
        getCommands: () => [],
      };

      registry.register(adapter1);
      registry.register(adapter2); // Should replace

      const result = registry.parse('MATCH');
      assert.ok(result, 'New adapter should be used');
      assert.strictEqual(result.message, 'matched');
    });
  });
});

/**
 * Query Interpretation Integration Tests
 */
describe('Query Interpretation Integration', () => {
  let registry: DefaultAdapterRegistry;

  beforeEach(() => {
    registry = new DefaultAdapterRegistry();
    registry.register(BeadsAdapter);
  });

  it('should execute command and return structured result', async () => {
    const parsed = registry.parse(MOCK_BEADS_LINES.valid.issueCreate);
    assert.ok(parsed);

    const result = await interpret(parsed, 'category');
    assert.ok(result.content, 'Should have content');
    assert.ok(typeof result.handled === 'boolean', 'Should have handled flag');
  });

  it('should support command aliases', async () => {
    const parsed = registry.parse(MOCK_BEADS_LINES.valid.issueCreate);
    assert.ok(parsed);

    // 'details' is alias for 'show'
    const result1 = await interpret(parsed, 'show');
    const result2 = await interpret(parsed, 'details');

    // Both should work (may have different output based on bd availability)
    assert.ok(typeof result1.handled === 'boolean');
    assert.ok(typeof result2.handled === 'boolean');
  });

  it('should handle commands with parameters', async () => {
    const parsed = registry.parse(MOCK_BEADS_LINES.valid.issueCreate);
    assert.ok(parsed);

    // related command can take optional params
    const result = await interpret(parsed, 'related open');
    assert.ok(typeof result.handled === 'boolean');
  });

  it('should preserve context across multiple queries', async () => {
    const parsed = registry.parse(MOCK_BEADS_LINES.valid.issueCreate);
    assert.ok(parsed);

    // Query shouldn't modify the line object
    const originalSource = { ...parsed.source };

    await interpret(parsed, 'show');
    await interpret(parsed, 'category');
    await interpret(parsed, 'deps');

    assert.deepStrictEqual(parsed.source, originalSource, 'Source should not be modified');
  });
});
