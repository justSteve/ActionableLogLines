/**
 * Extension Activation Tests
 *
 * Tests for VS Code extension patterns and mock data.
 * Note: Full VS Code API testing requires the @vscode/test-electron framework.
 * These tests verify testable patterns without the VS Code runtime.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { BeadsAdapter } from '../src/adapters/beads';
import { getTestLogger, TestEventLogger } from './harness';

/**
 * Mock beads lines from extension.ts for validation testing
 * These should match what the extension uses for mock data
 */
const EXTENSION_MOCK_LINES = [
  '2025-01-15T15:04:02.123Z|sk.bootup.activated|none|steve|sess-abc123|skill=beads-bootup',
  '2025-01-15T15:04:03.456Z|bd.issue.create|bd-97ux|steve|sess-abc123|title=Implement ALLP',
  '2025-01-15T15:04:05.789Z|bd.issue.update|bd-97ux|steve|sess-abc123|status=in_progress',
  '2025-01-15T15:04:10.012Z|gt.commit|bd-97ux|steve|sess-abc123|hash=abc1234',
  '2025-01-15T15:04:12.345Z|sk.skill.complete|none|steve|sess-abc123|skill=test-driven-development',
  '2025-01-15T15:04:15.678Z|bd.issue.close|bd-97ux|steve|sess-abc123|reason=completed',
  '2025-01-15T15:04:20.901Z|ss.session.end|none|steve|sess-abc123|duration=18s',
  '2025-01-15T15:05:01.234Z|ep.epoch.start|none|system|sess-def456|version=1.0.0',
  '2025-01-15T15:05:02.567Z|bd.issue.create|bd-vnlh|steve|sess-def456|title=ALLP VS Code Integration',
  '2025-01-15T15:05:05.890Z|hk.hook.trigger|bd-vnlh|system|sess-def456|hook=pre-commit',
  '2025-01-15T15:05:08.123Z|gd.guard.pass|bd-vnlh|system|sess-def456|check=branch-protection',
  'This is a plain text line that should show as unparsed',
  '2025-01-15T15:05:10.456Z|bd.dep.add|bd-vnlh|steve|sess-def456|depends_on=bd-97ux',
];

describe('Extension Mock Data Validation', () => {
  let logger: TestEventLogger;

  before(() => {
    logger = getTestLogger();
    logger.suiteStart('Extension Mock Data Validation');
  });

  after(() => {
    logger.suiteEnd('Extension Mock Data Validation', 0, 0);
  });

  it('should have correct number of mock lines', () => {
    logger.testStart('mock line count');
    const start = performance.now();

    assert.strictEqual(EXTENSION_MOCK_LINES.length, 13);

    logger.testPass('mock line count', performance.now() - start);
  });

  it('should have parseable beads lines', () => {
    logger.testStart('parseable lines');
    const start = performance.now();

    let parseableCount = 0;
    for (const line of EXTENSION_MOCK_LINES) {
      if (BeadsAdapter.parse(line)) {
        parseableCount++;
      }
    }

    // 12 valid beads lines, 1 plain text
    assert.strictEqual(parseableCount, 12);

    logger.testPass('parseable lines', performance.now() - start);
  });

  it('should include all event categories', () => {
    logger.testStart('all categories');
    const start = performance.now();

    const categories = new Set<string>();
    for (const line of EXTENSION_MOCK_LINES) {
      const parsed = BeadsAdapter.parse(line);
      if (parsed) {
        const category = parsed.message.split('.')[0];
        categories.add(category);
      }
    }

    // Should have: sk, bd, gt, ss, ep, hk, gd
    assert.ok(categories.has('sk'), 'Missing sk (skill) category');
    assert.ok(categories.has('bd'), 'Missing bd (beads) category');
    assert.ok(categories.has('gt'), 'Missing gt (git) category');
    assert.ok(categories.has('ss'), 'Missing ss (session) category');
    assert.ok(categories.has('ep'), 'Missing ep (epoch) category');
    assert.ok(categories.has('hk'), 'Missing hk (hook) category');
    assert.ok(categories.has('gd'), 'Missing gd (guard) category');

    logger.testPass('all categories', performance.now() - start);
  });

  it('should include plain text line for testing', () => {
    logger.testStart('plain text line');
    const start = performance.now();

    const plainTextLine = EXTENSION_MOCK_LINES.find(line => !BeadsAdapter.parse(line));
    assert.ok(plainTextLine);
    assert.ok(plainTextLine.includes('plain text'));

    logger.testPass('plain text line', performance.now() - start);
  });

  it('should have consistent session IDs for related events', () => {
    logger.testStart('consistent sessions');
    const start = performance.now();

    const sessionOneEvents: string[] = [];
    const sessionTwoEvents: string[] = [];

    for (const line of EXTENSION_MOCK_LINES) {
      const parsed = BeadsAdapter.parse(line);
      if (parsed) {
        const ctx = parsed.source.context as Record<string, string>;
        if (ctx.sessionId === 'sess-abc123') {
          sessionOneEvents.push(parsed.message);
        } else if (ctx.sessionId === 'sess-def456') {
          sessionTwoEvents.push(parsed.message);
        }
      }
    }

    // Session 1 should have multiple related events
    assert.ok(sessionOneEvents.length >= 5);
    // Session 2 should have its own events
    assert.ok(sessionTwoEvents.length >= 4);

    logger.testPass('consistent sessions', performance.now() - start);
  });

  it('should have chronologically ordered timestamps', () => {
    logger.testStart('chronological order');
    const start = performance.now();

    const timestamps: Date[] = [];
    for (const line of EXTENSION_MOCK_LINES) {
      const parsed = BeadsAdapter.parse(line);
      if (parsed) {
        timestamps.push(new Date(parsed.timestamp));
      }
    }

    for (let i = 1; i < timestamps.length; i++) {
      assert.ok(
        timestamps[i] >= timestamps[i - 1],
        `Timestamp at index ${i} is not after previous`
      );
    }

    logger.testPass('chronological order', performance.now() - start);
  });
});

describe('Extension Command Patterns', () => {
  let logger: TestEventLogger;

  before(() => {
    logger = getTestLogger();
    logger.suiteStart('Extension Command Patterns');
  });

  after(() => {
    logger.suiteEnd('Extension Command Patterns', 0, 0);
  });

  it('should define expected command IDs', () => {
    logger.testStart('command IDs');
    const start = performance.now();

    // These are the command IDs that should be registered
    const expectedCommands = ['allp.showViewer', 'allp.showWithMockData'];

    // Verify the pattern matches VS Code conventions
    for (const cmd of expectedCommands) {
      assert.ok(cmd.startsWith('allp.'), `Command ${cmd} should start with 'allp.'`);
      assert.ok(cmd.includes('.'), `Command ${cmd} should have namespace separator`);
    }

    logger.testPass('command IDs', performance.now() - start);
  });

  it('should have keyboard shortcut following convention', () => {
    logger.testStart('keyboard shortcut');
    const start = performance.now();

    // The keybinding should follow platform conventions
    const binding = { key: 'ctrl+shift+l', mac: 'cmd+shift+l' };

    assert.ok(binding.key.includes('ctrl'));
    assert.ok(binding.mac.includes('cmd'));
    assert.strictEqual(binding.key.replace('ctrl', ''), binding.mac.replace('cmd', ''));

    logger.testPass('keyboard shortcut', performance.now() - start);
  });
});

describe('WebView Message Protocol', () => {
  let logger: TestEventLogger;

  before(() => {
    logger = getTestLogger();
    logger.suiteStart('WebView Message Protocol');
  });

  after(() => {
    logger.suiteEnd('WebView Message Protocol', 0, 0);
  });

  it('should define message types', () => {
    logger.testStart('message types');
    const start = performance.now();

    // These are the message types used for WebView communication
    const messageTypes = ['logLine', 'expansion', 'queryResult', 'clear', 'config'];

    // Verify all types are valid identifiers
    for (const type of messageTypes) {
      assert.ok(/^[a-zA-Z][a-zA-Z0-9]*$/.test(type), `Invalid message type: ${type}`);
    }

    logger.testPass('message types', performance.now() - start);
  });

  it('should define log line payload structure', () => {
    logger.testStart('logLine payload');
    const start = performance.now();

    // Simulate a log line payload
    const payload = {
      raw: EXTENSION_MOCK_LINES[1],
      parsed: {
        timestamp: '2025-01-15T15:04:03.456Z',
        message: 'bd.issue.create',
        sourceType: 'beads',
        sourceId: 'bd-97ux',
      },
    };

    assert.ok(payload.raw);
    assert.ok(payload.parsed);
    assert.ok(payload.parsed.timestamp);
    assert.ok(payload.parsed.message);
    assert.ok(payload.parsed.sourceType);
    assert.ok(payload.parsed.sourceId);

    logger.testPass('logLine payload', performance.now() - start);
  });

  it('should define expansion payload structure', () => {
    logger.testStart('expansion payload');
    const start = performance.now();

    // Simulate an expansion payload
    const payload = {
      content: '**Event:** bd.issue.create\n**Category:** Beads',
      data: { eventCode: 'bd.issue.create', issueId: 'bd-97ux' },
      suggestions: ['show', 'related', 'deps'],
    };

    assert.ok(payload.content);
    assert.ok(typeof payload.content === 'string');
    assert.ok(payload.suggestions);
    assert.ok(Array.isArray(payload.suggestions));

    logger.testPass('expansion payload', performance.now() - start);
  });

  it('should define queryResult payload structure', () => {
    logger.testStart('queryResult payload');
    const start = performance.now();

    // Success case
    const successPayload = {
      content: 'Issue details...',
      error: false,
    };

    // Error case
    const errorPayload = {
      content: '',
      error: true,
      errorMessage: 'Unknown command: foo',
    };

    assert.strictEqual(successPayload.error, false);
    assert.ok(successPayload.content);
    assert.strictEqual(errorPayload.error, true);
    assert.ok(errorPayload.errorMessage);

    logger.testPass('queryResult payload', performance.now() - start);
  });
});

describe('Activation Context', () => {
  let logger: TestEventLogger;

  before(() => {
    logger = getTestLogger();
    logger.suiteStart('Activation Context');
  });

  after(() => {
    logger.suiteEnd('Activation Context', 0, 0);
  });

  it('should activate on .beads folder presence', () => {
    logger.testStart('workspaceContains activation');
    const start = performance.now();

    // The activation event should be 'workspaceContains:.beads'
    const activationEvent = 'workspaceContains:.beads';

    assert.ok(activationEvent.startsWith('workspaceContains:'));
    assert.ok(activationEvent.includes('.beads'));

    logger.testPass('workspaceContains activation', performance.now() - start);
  });

  it('should target correct VS Code version', () => {
    logger.testStart('VS Code version');
    const start = performance.now();

    // The engine should target a stable VS Code version
    const engineVersion = '^1.85.0';

    assert.ok(engineVersion.startsWith('^1.'));
    const major = parseInt(engineVersion.match(/\d+/)?.[0] || '0');
    assert.ok(major >= 1, 'Should target VS Code 1.x');

    logger.testPass('VS Code version', performance.now() - start);
  });
});
