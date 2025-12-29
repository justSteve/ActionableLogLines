/**
 * Protocol Unit Tests
 *
 * Comprehensive tests for core ALLP interfaces and default configurations.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import {
  DEFAULT_RENDERER_CONFIG,
  type ActionableLogLine,
  type SourceAdapter,
  type AdapterRegistry,
  type Command,
  type ExpansionResult,
  type QueryResult,
  type RendererConfig,
} from '../src/protocol';
import { DefaultAdapterRegistry } from '../src/adapters';
import { getTestLogger, TestEventLogger } from './harness';

describe('Protocol Interfaces', () => {
  let logger: TestEventLogger;

  before(() => {
    logger = getTestLogger();
    logger.suiteStart('Protocol Interfaces');
  });

  after(() => {
    logger.suiteEnd('Protocol Interfaces', 0, 0);
  });

  describe('DEFAULT_RENDERER_CONFIG', () => {
    it('should have expected default values', () => {
      logger.testStart('default config values');
      const start = performance.now();

      assert.strictEqual(DEFAULT_RENDERER_CONFIG.responsePanelHeight, 200);
      assert.strictEqual(DEFAULT_RENDERER_CONFIG.maxLogLines, 10000);
      assert.strictEqual(DEFAULT_RENDERER_CONFIG.autoScroll, true);
      assert.strictEqual(DEFAULT_RENDERER_CONFIG.showLineNumbers, true);
      assert.strictEqual(DEFAULT_RENDERER_CONFIG.theme, 'auto');

      logger.testPass('default config values', performance.now() - start);
    });

    it('should be a frozen or readonly-like object', () => {
      logger.testStart('config is stable');
      const start = performance.now();

      // Verify all expected keys exist
      const expectedKeys = ['responsePanelHeight', 'maxLogLines', 'autoScroll', 'showLineNumbers', 'theme'];
      const actualKeys = Object.keys(DEFAULT_RENDERER_CONFIG);
      assert.deepStrictEqual(actualKeys.sort(), expectedKeys.sort());

      logger.testPass('config is stable', performance.now() - start);
    });
  });

  describe('ActionableLogLine shape', () => {
    it('should be implementable with required properties', () => {
      logger.testStart('log line shape');
      const start = performance.now();

      const mockLine: ActionableLogLine = {
        timestamp: '2025-01-15T15:04:03.456Z',
        message: 'test.event',
        raw: '2025-01-15T15:04:03.456Z|test.event|test-id|agent|sess|details',
        level: 'info',
        source: {
          type: 'test',
          id: 'test-id',
          context: { key: 'value' },
        },
        availableCommands: [],
        async getDefaultExpansion(): Promise<ExpansionResult> {
          return { content: 'Expansion content', suggestions: ['cmd1'] };
        },
        async handleQuery(input: string): Promise<QueryResult> {
          return { handled: true, content: `Handled: ${input}` };
        },
      };

      // Verify structure
      assert.strictEqual(mockLine.timestamp, '2025-01-15T15:04:03.456Z');
      assert.strictEqual(mockLine.message, 'test.event');
      assert.strictEqual(mockLine.level, 'info');
      assert.strictEqual(mockLine.source.type, 'test');
      assert.strictEqual(mockLine.source.id, 'test-id');
      assert.ok(Array.isArray(mockLine.availableCommands));
      assert.strictEqual(typeof mockLine.getDefaultExpansion, 'function');
      assert.strictEqual(typeof mockLine.handleQuery, 'function');

      logger.testPass('log line shape', performance.now() - start);
    });

    it('should support optional level property', () => {
      logger.testStart('optional level');
      const start = performance.now();

      const lineWithoutLevel: ActionableLogLine = {
        timestamp: '2025-01-15T15:04:03.456Z',
        message: 'test.event',
        raw: 'raw line',
        source: {
          type: 'test',
          id: 'test-id',
          context: {},
        },
        availableCommands: [],
        async getDefaultExpansion() {
          return { content: '' };
        },
        async handleQuery() {
          return { handled: false, content: '' };
        },
      };

      assert.strictEqual(lineWithoutLevel.level, undefined);

      logger.testPass('optional level', performance.now() - start);
    });
  });

  describe('Command interface', () => {
    it('should support command with aliases', () => {
      logger.testStart('command aliases');
      const start = performance.now();

      const cmd: Command = {
        name: 'show',
        aliases: ['s', 'display'],
        description: 'Show details',
        async handler(params?: string): Promise<QueryResult> {
          return {
            handled: true,
            content: `Showing: ${params || 'all'}`,
          };
        },
      };

      assert.strictEqual(cmd.name, 'show');
      assert.deepStrictEqual(cmd.aliases, ['s', 'display']);
      assert.ok(cmd.description.length > 0);
      assert.strictEqual(typeof cmd.handler, 'function');

      logger.testPass('command aliases', performance.now() - start);
    });

    it('should execute handler with params', async () => {
      logger.testStart('command execution');
      const start = performance.now();

      const cmd: Command = {
        name: 'echo',
        aliases: [],
        description: 'Echo input',
        async handler(params?: string): Promise<QueryResult> {
          return { handled: true, content: params || '' };
        },
      };

      const result = await cmd.handler('hello world');
      assert.strictEqual(result.handled, true);
      assert.strictEqual(result.content, 'hello world');

      logger.testPass('command execution', performance.now() - start);
    });
  });

  describe('ExpansionResult interface', () => {
    it('should support minimal result', () => {
      logger.testStart('minimal expansion');
      const start = performance.now();

      const result: ExpansionResult = {
        content: 'Basic content',
      };

      assert.strictEqual(result.content, 'Basic content');
      assert.strictEqual(result.data, undefined);
      assert.strictEqual(result.suggestions, undefined);

      logger.testPass('minimal expansion', performance.now() - start);
    });

    it('should support full result with data and suggestions', () => {
      logger.testStart('full expansion');
      const start = performance.now();

      const result: ExpansionResult = {
        content: '**Event:** test.event\n**ID:** 123',
        data: { event: 'test.event', id: 123 },
        suggestions: ['show', 'related', 'deps'],
      };

      assert.ok(result.content.includes('Event'));
      assert.strictEqual(result.data?.event, 'test.event');
      assert.strictEqual(result.suggestions?.length, 3);

      logger.testPass('full expansion', performance.now() - start);
    });
  });

  describe('QueryResult interface', () => {
    it('should indicate handled status', () => {
      logger.testStart('handled status');
      const start = performance.now();

      const success: QueryResult = { handled: true, content: 'OK' };
      const unhandled: QueryResult = { handled: false, content: '', error: 'Unknown command' };

      assert.strictEqual(success.handled, true);
      assert.strictEqual(unhandled.handled, false);
      assert.ok(unhandled.error);

      logger.testPass('handled status', performance.now() - start);
    });

    it('should support optional data payload', () => {
      logger.testStart('data payload');
      const start = performance.now();

      const result: QueryResult = {
        handled: true,
        content: 'Result',
        data: { items: [1, 2, 3], count: 3 },
      };

      assert.strictEqual(result.data?.count, 3);
      assert.deepStrictEqual(result.data?.items, [1, 2, 3]);

      logger.testPass('data payload', performance.now() - start);
    });
  });

  describe('RendererConfig interface', () => {
    it('should allow custom configuration', () => {
      logger.testStart('custom config');
      const start = performance.now();

      const customConfig: RendererConfig = {
        responsePanelHeight: 300,
        maxLogLines: 5000,
        autoScroll: false,
        showLineNumbers: false,
        theme: 'dark',
      };

      assert.strictEqual(customConfig.responsePanelHeight, 300);
      assert.strictEqual(customConfig.maxLogLines, 5000);
      assert.strictEqual(customConfig.autoScroll, false);
      assert.strictEqual(customConfig.showLineNumbers, false);
      assert.strictEqual(customConfig.theme, 'dark');

      logger.testPass('custom config', performance.now() - start);
    });

    it('should support auto height', () => {
      logger.testStart('auto height');
      const start = performance.now();

      const config: RendererConfig = {
        ...DEFAULT_RENDERER_CONFIG,
        responsePanelHeight: 'auto',
      };

      assert.strictEqual(config.responsePanelHeight, 'auto');

      logger.testPass('auto height', performance.now() - start);
    });
  });
});

describe('SourceAdapter Interface', () => {
  let logger: TestEventLogger;

  before(() => {
    logger = getTestLogger();
    logger.suiteStart('SourceAdapter Interface');
  });

  after(() => {
    logger.suiteEnd('SourceAdapter Interface', 0, 0);
  });

  it('should be implementable with required methods', () => {
    logger.testStart('adapter implementation');
    const start = performance.now();

    const mockAdapter: SourceAdapter = {
      type: 'test-adapter',
      parse(rawLine: string): ActionableLogLine | null {
        if (!rawLine.startsWith('TEST|')) return null;
        const parts = rawLine.split('|');
        return {
          timestamp: new Date().toISOString(),
          message: parts[1] || '',
          raw: rawLine,
          source: { type: 'test-adapter', id: parts[1], context: {} },
          availableCommands: [],
          async getDefaultExpansion() {
            return { content: 'Test expansion' };
          },
          async handleQuery() {
            return { handled: false, content: '' };
          },
        };
      },
      async getDefaultExpansion(line) {
        return line.getDefaultExpansion();
      },
      async handleQuery(line, input) {
        return line.handleQuery(input);
      },
      getCommands() {
        return [];
      },
    };

    assert.strictEqual(mockAdapter.type, 'test-adapter');
    assert.strictEqual(typeof mockAdapter.parse, 'function');
    assert.strictEqual(typeof mockAdapter.getDefaultExpansion, 'function');
    assert.strictEqual(typeof mockAdapter.handleQuery, 'function');
    assert.strictEqual(typeof mockAdapter.getCommands, 'function');

    logger.testPass('adapter implementation', performance.now() - start);
  });

  it('should return null for non-matching lines', () => {
    logger.testStart('non-matching parse');
    const start = performance.now();

    const adapter: SourceAdapter = {
      type: 'prefix-adapter',
      parse(rawLine) {
        if (!rawLine.startsWith('PREFIX:')) return null;
        return {
          timestamp: new Date().toISOString(),
          message: rawLine.slice(7),
          raw: rawLine,
          source: { type: 'prefix-adapter', id: 'id', context: {} },
          availableCommands: [],
          async getDefaultExpansion() { return { content: '' }; },
          async handleQuery() { return { handled: false, content: '' }; },
        };
      },
      async getDefaultExpansion(line) { return line.getDefaultExpansion(); },
      async handleQuery(line, input) { return line.handleQuery(input); },
      getCommands() { return []; },
    };

    assert.strictEqual(adapter.parse('not matching'), null);
    assert.strictEqual(adapter.parse('WRONG:data'), null);
    assert.notStrictEqual(adapter.parse('PREFIX:data'), null);

    logger.testPass('non-matching parse', performance.now() - start);
  });

  it('should provide commands via getCommands', () => {
    logger.testStart('getCommands');
    const start = performance.now();

    const adapter: SourceAdapter = {
      type: 'cmd-adapter',
      parse() { return null; },
      async getDefaultExpansion() { return { content: '' }; },
      async handleQuery() { return { handled: false, content: '' }; },
      getCommands(): Command[] {
        return [
          { name: 'help', aliases: ['h', '?'], description: 'Show help', handler: async () => ({ handled: true, content: 'Help' }) },
          { name: 'info', aliases: ['i'], description: 'Show info', handler: async () => ({ handled: true, content: 'Info' }) },
        ];
      },
    };

    const commands = adapter.getCommands();
    assert.strictEqual(commands.length, 2);
    assert.strictEqual(commands[0].name, 'help');
    assert.deepStrictEqual(commands[0].aliases, ['h', '?']);

    logger.testPass('getCommands', performance.now() - start);
  });
});

describe('AdapterRegistry Behavior', () => {
  let logger: TestEventLogger;

  before(() => {
    logger = getTestLogger();
    logger.suiteStart('AdapterRegistry Behavior');
  });

  after(() => {
    logger.suiteEnd('AdapterRegistry Behavior', 0, 0);
  });

  it('should register and retrieve adapters', () => {
    logger.testStart('register and get');
    const start = performance.now();

    const registry = new DefaultAdapterRegistry();
    const adapter: SourceAdapter = {
      type: 'test-type',
      parse() { return null; },
      async getDefaultExpansion() { return { content: '' }; },
      async handleQuery() { return { handled: false, content: '' }; },
      getCommands() { return []; },
    };

    registry.register(adapter);
    const retrieved = registry.get('test-type');

    assert.strictEqual(retrieved, adapter);
    assert.strictEqual(retrieved?.type, 'test-type');

    logger.testPass('register and get', performance.now() - start);
  });

  it('should return undefined for unregistered types', () => {
    logger.testStart('undefined for missing');
    const start = performance.now();

    const registry = new DefaultAdapterRegistry();
    const result = registry.get('nonexistent');

    assert.strictEqual(result, undefined);

    logger.testPass('undefined for missing', performance.now() - start);
  });

  it('should list registered adapter types', () => {
    logger.testStart('list types');
    const start = performance.now();

    const registry = new DefaultAdapterRegistry();
    const adapter1: SourceAdapter = {
      type: 'type-a',
      parse() { return null; },
      async getDefaultExpansion() { return { content: '' }; },
      async handleQuery() { return { handled: false, content: '' }; },
      getCommands() { return []; },
    };
    const adapter2: SourceAdapter = {
      type: 'type-b',
      parse() { return null; },
      async getDefaultExpansion() { return { content: '' }; },
      async handleQuery() { return { handled: false, content: '' }; },
      getCommands() { return []; },
    };

    registry.register(adapter1);
    registry.register(adapter2);

    const types = registry.types();
    assert.ok(types.includes('type-a'));
    assert.ok(types.includes('type-b'));
    assert.strictEqual(types.length, 2);

    logger.testPass('list types', performance.now() - start);
  });

  it('should parse lines using first matching adapter', () => {
    logger.testStart('parse with registry');
    const start = performance.now();

    const registry = new DefaultAdapterRegistry();

    const adapter1: SourceAdapter = {
      type: 'format-a',
      parse(rawLine) {
        if (!rawLine.startsWith('A:')) return null;
        return {
          timestamp: new Date().toISOString(),
          message: rawLine.slice(2),
          raw: rawLine,
          source: { type: 'format-a', id: 'a', context: {} },
          availableCommands: [],
          async getDefaultExpansion() { return { content: 'Format A' }; },
          async handleQuery() { return { handled: false, content: '' }; },
        };
      },
      async getDefaultExpansion(line) { return line.getDefaultExpansion(); },
      async handleQuery(line, input) { return line.handleQuery(input); },
      getCommands() { return []; },
    };

    const adapter2: SourceAdapter = {
      type: 'format-b',
      parse(rawLine) {
        if (!rawLine.startsWith('B:')) return null;
        return {
          timestamp: new Date().toISOString(),
          message: rawLine.slice(2),
          raw: rawLine,
          source: { type: 'format-b', id: 'b', context: {} },
          availableCommands: [],
          async getDefaultExpansion() { return { content: 'Format B' }; },
          async handleQuery() { return { handled: false, content: '' }; },
        };
      },
      async getDefaultExpansion(line) { return line.getDefaultExpansion(); },
      async handleQuery(line, input) { return line.handleQuery(input); },
      getCommands() { return []; },
    };

    registry.register(adapter1);
    registry.register(adapter2);

    const parsedA = registry.parse('A:message');
    const parsedB = registry.parse('B:message');
    const parsedNone = registry.parse('C:message');

    assert.strictEqual(parsedA?.source.type, 'format-a');
    assert.strictEqual(parsedB?.source.type, 'format-b');
    assert.strictEqual(parsedNone, null);

    logger.testPass('parse with registry', performance.now() - start);
  });

  it('should replace adapter when registering duplicate type', () => {
    logger.testStart('replace duplicate');
    const start = performance.now();

    const registry = new DefaultAdapterRegistry();

    const adapter1: SourceAdapter = {
      type: 'same-type',
      parse() { return null; },
      async getDefaultExpansion() { return { content: 'first' }; },
      async handleQuery() { return { handled: false, content: '' }; },
      getCommands() { return []; },
    };

    const adapter2: SourceAdapter = {
      type: 'same-type',
      parse() { return null; },
      async getDefaultExpansion() { return { content: 'second' }; },
      async handleQuery() { return { handled: false, content: '' }; },
      getCommands() { return []; },
    };

    registry.register(adapter1);
    registry.register(adapter2);

    const retrieved = registry.get('same-type');
    assert.strictEqual(retrieved, adapter2);
    assert.strictEqual(registry.types().length, 1);

    logger.testPass('replace duplicate', performance.now() - start);
  });
});
