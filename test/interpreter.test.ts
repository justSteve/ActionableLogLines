/**
 * QueryInterpreter Unit Tests
 *
 * Tests for command parsing, NL detection, and interpret function.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import {
  parseCommand,
  isNaturalLanguage,
  interpret,
  configureClaudeFallback,
} from '../src/interpreter';
import type { ActionableLogLine, QueryResult } from '../src/protocol';
import { getTestLogger, TestEventLogger } from './harness';

/**
 * Create a mock ActionableLogLine for testing
 */
function createMockLine(options: {
  commands?: string[];
  handleQuery?: (input: string) => Promise<QueryResult>;
} = {}): ActionableLogLine {
  const { commands = ['show', 'help'], handleQuery } = options;

  const defaultHandler = async (input: string): Promise<QueryResult> => {
    const trimmed = input.trim().toLowerCase();
    if (commands.includes(trimmed.split(/\s+/)[0])) {
      return { handled: true, content: `Executed: ${trimmed}` };
    }
    return {
      handled: false,
      content: '',
      error: `Unknown command: ${trimmed}. Try: ${commands.join(', ')}`,
    };
  };

  return {
    timestamp: '2025-01-15T15:04:03.456Z',
    message: 'test.event',
    raw: 'test|event|line',
    source: {
      type: 'test',
      id: 'test-id',
      context: { key: 'value' },
    },
    availableCommands: commands.map(name => ({
      name,
      aliases: [],
      description: `${name} command`,
      handler: async () => ({ handled: true, content: name }),
    })),
    async getDefaultExpansion() {
      return { content: 'Test expansion', suggestions: commands };
    },
    handleQuery: handleQuery || defaultHandler,
  };
}

describe('parseCommand', () => {
  let logger: TestEventLogger;

  before(() => {
    logger = getTestLogger();
    logger.suiteStart('parseCommand');
  });

  after(() => {
    logger.suiteEnd('parseCommand', 0, 0);
  });

  it('should parse simple command', () => {
    logger.testStart('simple command');
    const start = performance.now();

    const result = parseCommand('show');

    assert.ok(result);
    assert.strictEqual(result.command, 'show');
    assert.strictEqual(result.params, '');

    logger.testPass('simple command', performance.now() - start);
  });

  it('should parse command with params', () => {
    logger.testStart('command with params');
    const start = performance.now();

    const result = parseCommand('category bd');

    assert.ok(result);
    assert.strictEqual(result.command, 'category');
    assert.strictEqual(result.params, 'bd');

    logger.testPass('command with params', performance.now() - start);
  });

  it('should parse command with multiple params', () => {
    logger.testStart('multiple params');
    const start = performance.now();

    const result = parseCommand('filter type=bug status=open');

    assert.ok(result);
    assert.strictEqual(result.command, 'filter');
    assert.strictEqual(result.params, 'type=bug status=open');

    logger.testPass('multiple params', performance.now() - start);
  });

  it('should convert command to lowercase', () => {
    logger.testStart('lowercase conversion');
    const start = performance.now();

    const result = parseCommand('SHOW');

    assert.ok(result);
    assert.strictEqual(result.command, 'show');

    logger.testPass('lowercase conversion', performance.now() - start);
  });

  it('should trim whitespace', () => {
    logger.testStart('trim whitespace');
    const start = performance.now();

    const result = parseCommand('  show  param  ');

    assert.ok(result);
    assert.strictEqual(result.command, 'show');
    assert.strictEqual(result.params, 'param');

    logger.testPass('trim whitespace', performance.now() - start);
  });

  it('should return null for empty input', () => {
    logger.testStart('empty input');
    const start = performance.now();

    const result = parseCommand('');

    assert.strictEqual(result, null);

    logger.testPass('empty input', performance.now() - start);
  });

  it('should return null for whitespace-only input', () => {
    logger.testStart('whitespace only');
    const start = performance.now();

    const result = parseCommand('   ');

    assert.strictEqual(result, null);

    logger.testPass('whitespace only', performance.now() - start);
  });

  it('should handle command with numbers', () => {
    logger.testStart('command with numbers');
    const start = performance.now();

    const result = parseCommand('cmd123 param');

    assert.ok(result);
    assert.strictEqual(result.command, 'cmd123');
    assert.strictEqual(result.params, 'param');

    logger.testPass('command with numbers', performance.now() - start);
  });
});

describe('isNaturalLanguage', () => {
  let logger: TestEventLogger;

  before(() => {
    logger = getTestLogger();
    logger.suiteStart('isNaturalLanguage');
  });

  after(() => {
    logger.suiteEnd('isNaturalLanguage', 0, 0);
  });

  it('should detect "what" questions', () => {
    logger.testStart('what questions');
    const start = performance.now();

    assert.strictEqual(isNaturalLanguage('what is this event?'), true);
    assert.strictEqual(isNaturalLanguage('What does this mean'), true);

    logger.testPass('what questions', performance.now() - start);
  });

  it('should detect "why" questions', () => {
    logger.testStart('why questions');
    const start = performance.now();

    assert.strictEqual(isNaturalLanguage('why did this happen'), true);

    logger.testPass('why questions', performance.now() - start);
  });

  it('should detect "how" questions', () => {
    logger.testStart('how questions');
    const start = performance.now();

    assert.strictEqual(isNaturalLanguage('how does this work'), true);

    logger.testPass('how questions', performance.now() - start);
  });

  it('should detect "when" questions', () => {
    logger.testStart('when questions');
    const start = performance.now();

    assert.strictEqual(isNaturalLanguage('when was this created'), true);

    logger.testPass('when questions', performance.now() - start);
  });

  it('should detect "where" questions', () => {
    logger.testStart('where questions');
    const start = performance.now();

    assert.strictEqual(isNaturalLanguage('where is this defined'), true);

    logger.testPass('where questions', performance.now() - start);
  });

  it('should detect "who" questions', () => {
    logger.testStart('who questions');
    const start = performance.now();

    assert.strictEqual(isNaturalLanguage('who created this'), true);

    logger.testPass('who questions', performance.now() - start);
  });

  it('should detect "can/could/would/should" questions', () => {
    logger.testStart('modal questions');
    const start = performance.now();

    assert.strictEqual(isNaturalLanguage('can you explain this'), true);
    assert.strictEqual(isNaturalLanguage('could this be related'), true);
    assert.strictEqual(isNaturalLanguage('would this affect X'), true);
    assert.strictEqual(isNaturalLanguage('should I check this'), true);

    logger.testPass('modal questions', performance.now() - start);
  });

  it('should detect "is/are" questions', () => {
    logger.testStart('is/are questions');
    const start = performance.now();

    assert.strictEqual(isNaturalLanguage('is this an error'), true);
    assert.strictEqual(isNaturalLanguage('are there dependencies'), true);

    logger.testPass('is/are questions', performance.now() - start);
  });

  it('should detect "tell me" phrases', () => {
    logger.testStart('tell me phrases');
    const start = performance.now();

    assert.strictEqual(isNaturalLanguage('tell me about this'), true);

    logger.testPass('tell me phrases', performance.now() - start);
  });

  it('should detect "explain" and "describe"', () => {
    logger.testStart('explain/describe');
    const start = performance.now();

    assert.strictEqual(isNaturalLanguage('explain this event'), true);
    assert.strictEqual(isNaturalLanguage('describe the context'), true);

    logger.testPass('explain/describe', performance.now() - start);
  });

  it('should detect question marks', () => {
    logger.testStart('question marks');
    const start = performance.now();

    assert.strictEqual(isNaturalLanguage('show details?'), true);
    assert.strictEqual(isNaturalLanguage('anything here?'), true);

    logger.testPass('question marks', performance.now() - start);
  });

  it('should not detect simple commands', () => {
    logger.testStart('not commands');
    const start = performance.now();

    assert.strictEqual(isNaturalLanguage('show'), false);
    assert.strictEqual(isNaturalLanguage('related'), false);
    assert.strictEqual(isNaturalLanguage('deps'), false);
    assert.strictEqual(isNaturalLanguage('category bd'), false);

    logger.testPass('not commands', performance.now() - start);
  });

  it('should be case-insensitive', () => {
    logger.testStart('case insensitive');
    const start = performance.now();

    assert.strictEqual(isNaturalLanguage('WHAT is this'), true);
    assert.strictEqual(isNaturalLanguage('How does it work'), true);

    logger.testPass('case insensitive', performance.now() - start);
  });
});

describe('interpret', () => {
  let logger: TestEventLogger;

  before(() => {
    logger = getTestLogger();
    logger.suiteStart('interpret');
  });

  after(() => {
    logger.suiteEnd('interpret', 0, 0);
  });

  it('should execute matching command', async () => {
    logger.testStart('execute command');
    const start = performance.now();

    const line = createMockLine({ commands: ['show', 'help'] });
    const result = await interpret(line, 'show');

    assert.strictEqual(result.handled, true);
    assert.ok(result.content.includes('show'));

    logger.testPass('execute command', performance.now() - start);
  });

  it('should return unhandled for unknown command without fallback', async () => {
    logger.testStart('unknown no fallback');
    const start = performance.now();

    // Ensure fallback is disabled
    configureClaudeFallback({ enabled: false });

    const line = createMockLine({ commands: ['show'] });
    const result = await interpret(line, 'unknowncmd');

    assert.strictEqual(result.handled, false);
    assert.ok(result.error);

    logger.testPass('unknown no fallback', performance.now() - start);
  });

  it('should delegate to line handleQuery', async () => {
    logger.testStart('delegate to handleQuery');
    const start = performance.now();

    let queryCalled = false;
    const line = createMockLine({
      handleQuery: async (input: string) => {
        queryCalled = true;
        return { handled: true, content: `Custom: ${input}` };
      },
    });

    const result = await interpret(line, 'anything');

    assert.strictEqual(queryCalled, true);
    assert.strictEqual(result.handled, true);
    assert.ok(result.content.includes('Custom'));

    logger.testPass('delegate to handleQuery', performance.now() - start);
  });
});

describe('Claude Fallback', () => {
  let logger: TestEventLogger;

  before(() => {
    logger = getTestLogger();
    logger.suiteStart('Claude Fallback');
  });

  after(() => {
    // Reset to disabled
    configureClaudeFallback({ enabled: false });
    logger.suiteEnd('Claude Fallback', 0, 0);
  });

  it('should not call fallback when disabled', async () => {
    logger.testStart('fallback disabled');
    const start = performance.now();

    let handlerCalled = false;
    configureClaudeFallback({
      enabled: false,
      handler: async () => {
        handlerCalled = true;
        return 'fallback response';
      },
    });

    const line = createMockLine({ commands: [] });
    await interpret(line, 'any query');

    assert.strictEqual(handlerCalled, false);

    logger.testPass('fallback disabled', performance.now() - start);
  });

  it('should call fallback when enabled and command unhandled', async () => {
    logger.testStart('fallback enabled');
    const start = performance.now();

    let handlerCalled = false;
    let receivedContext = '';
    let receivedQuery = '';

    configureClaudeFallback({
      enabled: true,
      handler: async (context: string, query: string) => {
        handlerCalled = true;
        receivedContext = context;
        receivedQuery = query;
        return 'Claude response';
      },
    });

    const line = createMockLine({
      commands: [],
      handleQuery: async () => ({
        handled: false,
        content: '',
        error: 'Not handled',
      }),
    });

    const result = await interpret(line, 'explain this');

    assert.strictEqual(handlerCalled, true);
    assert.strictEqual(receivedQuery, 'explain this');
    assert.ok(receivedContext.includes('Log line context'));
    assert.strictEqual(result.handled, true);
    assert.strictEqual(result.content, 'Claude response');

    logger.testPass('fallback enabled', performance.now() - start);
  });

  it('should not call fallback when command is handled', async () => {
    logger.testStart('no fallback when handled');
    const start = performance.now();

    let handlerCalled = false;
    configureClaudeFallback({
      enabled: true,
      handler: async () => {
        handlerCalled = true;
        return 'fallback';
      },
    });

    const line = createMockLine({
      commands: ['show'],
      handleQuery: async (input: string) => {
        if (input === 'show') {
          return { handled: true, content: 'Command output' };
        }
        return { handled: false, content: '' };
      },
    });

    await interpret(line, 'show');

    assert.strictEqual(handlerCalled, false);

    logger.testPass('no fallback when handled', performance.now() - start);
  });

  it('should handle fallback errors gracefully', async () => {
    logger.testStart('fallback error');
    const start = performance.now();

    configureClaudeFallback({
      enabled: true,
      handler: async () => {
        throw new Error('API error');
      },
    });

    const line = createMockLine({
      commands: [],
      handleQuery: async () => ({
        handled: false,
        content: '',
      }),
    });

    const result = await interpret(line, 'query');

    assert.strictEqual(result.handled, false);
    assert.ok(result.error);
    assert.ok(result.error.includes('Claude fallback failed'));

    logger.testPass('fallback error', performance.now() - start);
  });

  it('should include context in fallback call', async () => {
    logger.testStart('context in fallback');
    const start = performance.now();

    let capturedContext = '';
    configureClaudeFallback({
      enabled: true,
      handler: async (context: string) => {
        capturedContext = context;
        return 'ok';
      },
    });

    const line = createMockLine({
      commands: ['show', 'help'],
      handleQuery: async () => ({
        handled: false,
        content: '',
      }),
    });

    await interpret(line, 'query');

    assert.ok(capturedContext.includes('Type: test'));
    assert.ok(capturedContext.includes('Message: test.event'));
    assert.ok(capturedContext.includes('ID: test-id'));
    assert.ok(capturedContext.includes('Available commands'));

    logger.testPass('context in fallback', performance.now() - start);
  });
});
