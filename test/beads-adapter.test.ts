/**
 * BeadsAdapter Unit Tests
 *
 * Comprehensive tests for beads event log parsing and command handling.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { BeadsAdapter, createBeadsAdapter } from '../src/adapters/beads';
import { getTestLogger, TestEventLogger, MOCK_BEADS_LINES } from './harness';

describe('BeadsAdapter Parsing', () => {
  let logger: TestEventLogger;

  before(() => {
    logger = getTestLogger();
    logger.suiteStart('BeadsAdapter Parsing');
  });

  after(() => {
    logger.suiteEnd('BeadsAdapter Parsing', 0, 0);
  });

  describe('Valid beads format', () => {
    it('should parse issue.create event', () => {
      logger.testStart('parse issue.create');
      const start = performance.now();

      const line = BeadsAdapter.parse(MOCK_BEADS_LINES.valid.issueCreate);

      assert.ok(line, 'Should return parsed line');
      assert.strictEqual(line.source.type, 'beads');
      assert.strictEqual(line.message, 'bd.issue.create');
      assert.strictEqual(line.source.id, 'bd-97ux');
      assert.ok(line.timestamp.includes('2025-01-15'));

      logger.testPass('parse issue.create', performance.now() - start);
    });

    it('should parse issue.update event', () => {
      logger.testStart('parse issue.update');
      const start = performance.now();

      const line = BeadsAdapter.parse(MOCK_BEADS_LINES.valid.issueUpdate);

      assert.ok(line);
      assert.strictEqual(line.message, 'bd.issue.update');
      assert.strictEqual(line.source.id, 'bd-97ux');

      logger.testPass('parse issue.update', performance.now() - start);
    });

    it('should parse issue.close event', () => {
      logger.testStart('parse issue.close');
      const start = performance.now();

      const line = BeadsAdapter.parse(MOCK_BEADS_LINES.valid.issueClose);

      assert.ok(line);
      assert.strictEqual(line.message, 'bd.issue.close');

      logger.testPass('parse issue.close', performance.now() - start);
    });

    it('should parse git.commit event', () => {
      logger.testStart('parse git.commit');
      const start = performance.now();

      const line = BeadsAdapter.parse(MOCK_BEADS_LINES.valid.gitCommit);

      assert.ok(line);
      assert.strictEqual(line.message, 'gt.commit');
      assert.strictEqual(line.source.id, 'bd-97ux');

      logger.testPass('parse git.commit', performance.now() - start);
    });

    it('should parse skill.activated event', () => {
      logger.testStart('parse skill.activated');
      const start = performance.now();

      const line = BeadsAdapter.parse(MOCK_BEADS_LINES.valid.skillActivate);

      assert.ok(line);
      assert.strictEqual(line.message, 'sk.bootup.activated');
      assert.strictEqual(line.source.id, 'none');

      logger.testPass('parse skill.activated', performance.now() - start);
    });

    it('should parse session.end event', () => {
      logger.testStart('parse session.end');
      const start = performance.now();

      const line = BeadsAdapter.parse(MOCK_BEADS_LINES.valid.sessionEnd);

      assert.ok(line);
      assert.strictEqual(line.message, 'ss.session.end');

      logger.testPass('parse session.end', performance.now() - start);
    });

    it('should parse epoch.start event', () => {
      logger.testStart('parse epoch.start');
      const start = performance.now();

      const line = BeadsAdapter.parse(MOCK_BEADS_LINES.valid.epochStart);

      assert.ok(line);
      assert.strictEqual(line.message, 'ep.epoch.start');

      logger.testPass('parse epoch.start', performance.now() - start);
    });

    it('should parse hook.trigger event', () => {
      logger.testStart('parse hook.trigger');
      const start = performance.now();

      const line = BeadsAdapter.parse(MOCK_BEADS_LINES.valid.hookTrigger);

      assert.ok(line);
      assert.strictEqual(line.message, 'hk.hook.trigger');

      logger.testPass('parse hook.trigger', performance.now() - start);
    });

    it('should parse guard.pass event', () => {
      logger.testStart('parse guard.pass');
      const start = performance.now();

      const line = BeadsAdapter.parse(MOCK_BEADS_LINES.valid.guardPass);

      assert.ok(line);
      assert.strictEqual(line.message, 'gd.guard.pass');

      logger.testPass('parse guard.pass', performance.now() - start);
    });

    it('should parse dep.add event', () => {
      logger.testStart('parse dep.add');
      const start = performance.now();

      const line = BeadsAdapter.parse(MOCK_BEADS_LINES.valid.depAdd);

      assert.ok(line);
      assert.strictEqual(line.message, 'bd.dep.add');

      logger.testPass('parse dep.add', performance.now() - start);
    });

    it('should extract all context fields', () => {
      logger.testStart('extract context');
      const start = performance.now();

      const line = BeadsAdapter.parse(MOCK_BEADS_LINES.valid.issueCreate);
      assert.ok(line);

      const ctx = line.source.context as Record<string, string>;
      assert.strictEqual(ctx.eventCode, 'bd.issue.create');
      assert.strictEqual(ctx.issueId, 'bd-97ux');
      assert.strictEqual(ctx.agentId, 'steve');
      assert.strictEqual(ctx.sessionId, 'sess-abc123');
      assert.ok(ctx.details.includes('title='));

      logger.testPass('extract context', performance.now() - start);
    });
  });

  describe('Invalid beads format', () => {
    it('should return null for plain text', () => {
      logger.testStart('reject plain text');
      const start = performance.now();

      const result = BeadsAdapter.parse(MOCK_BEADS_LINES.invalid.plainText);
      assert.strictEqual(result, null);

      logger.testPass('reject plain text', performance.now() - start);
    });

    it('should return null for missing timestamp', () => {
      logger.testStart('reject missing timestamp');
      const start = performance.now();

      const result = BeadsAdapter.parse(MOCK_BEADS_LINES.invalid.noTimestamp);
      assert.strictEqual(result, null);

      logger.testPass('reject missing timestamp', performance.now() - start);
    });

    it('should return null for bad timestamp format', () => {
      logger.testStart('reject bad timestamp');
      const start = performance.now();

      const result = BeadsAdapter.parse(MOCK_BEADS_LINES.invalid.badTimestamp);
      assert.strictEqual(result, null);

      logger.testPass('reject bad timestamp', performance.now() - start);
    });

    it('should return null for missing event code', () => {
      logger.testStart('reject missing event code');
      const start = performance.now();

      const result = BeadsAdapter.parse(MOCK_BEADS_LINES.invalid.noEventCode);
      assert.strictEqual(result, null);

      logger.testPass('reject missing event code', performance.now() - start);
    });

    it('should return null for event code without dot', () => {
      logger.testStart('reject bad event code');
      const start = performance.now();

      const result = BeadsAdapter.parse(MOCK_BEADS_LINES.invalid.badEventCode);
      assert.strictEqual(result, null);

      logger.testPass('reject bad event code', performance.now() - start);
    });

    it('should return null for too few fields', () => {
      logger.testStart('reject too few fields');
      const start = performance.now();

      const result = BeadsAdapter.parse(MOCK_BEADS_LINES.invalid.tooFewFields);
      assert.strictEqual(result, null);

      logger.testPass('reject too few fields', performance.now() - start);
    });

    it('should return null for empty line', () => {
      logger.testStart('reject empty line');
      const start = performance.now();

      const result = BeadsAdapter.parse(MOCK_BEADS_LINES.invalid.emptyLine);
      assert.strictEqual(result, null);

      logger.testPass('reject empty line', performance.now() - start);
    });

    it('should return null for whitespace-only line', () => {
      logger.testStart('reject whitespace');
      const start = performance.now();

      const result = BeadsAdapter.parse(MOCK_BEADS_LINES.invalid.whitespaceOnly);
      assert.strictEqual(result, null);

      logger.testPass('reject whitespace', performance.now() - start);
    });
  });
});

describe('BeadsAdapter Default Expansion', () => {
  let logger: TestEventLogger;

  before(() => {
    logger = getTestLogger();
    logger.suiteStart('BeadsAdapter Default Expansion');
  });

  after(() => {
    logger.suiteEnd('BeadsAdapter Default Expansion', 0, 0);
  });

  it('should generate expansion content for issue event', async () => {
    logger.testStart('expansion for issue');
    const start = performance.now();

    const line = BeadsAdapter.parse(MOCK_BEADS_LINES.valid.issueCreate);
    assert.ok(line);

    const expansion = await line.getDefaultExpansion();

    assert.ok(expansion.content.includes('Event:'));
    assert.ok(expansion.content.includes('bd.issue.create'));
    assert.ok(expansion.content.includes('Category:'));
    assert.ok(expansion.content.includes('Issue:'));
    assert.ok(expansion.content.includes('bd-97ux'));

    logger.testPass('expansion for issue', performance.now() - start);
  });

  it('should generate expansion for event without issue', async () => {
    logger.testStart('expansion without issue');
    const start = performance.now();

    const line = BeadsAdapter.parse(MOCK_BEADS_LINES.valid.epochStart);
    assert.ok(line);

    const expansion = await line.getDefaultExpansion();

    assert.ok(expansion.content.includes('Event:'));
    assert.ok(expansion.content.includes('ep.epoch.start'));
    // Should not include Issue line for 'none' issue
    assert.ok(!expansion.content.includes('Issue: none'));

    logger.testPass('expansion without issue', performance.now() - start);
  });

  it('should include suggestions in expansion', async () => {
    logger.testStart('expansion suggestions');
    const start = performance.now();

    const line = BeadsAdapter.parse(MOCK_BEADS_LINES.valid.issueCreate);
    assert.ok(line);

    const expansion = await line.getDefaultExpansion();

    assert.ok(expansion.suggestions);
    assert.ok(expansion.suggestions.length > 0);
    assert.ok(expansion.suggestions.includes('show'));
    assert.ok(expansion.suggestions.includes('related'));

    logger.testPass('expansion suggestions', performance.now() - start);
  });

  it('should include structured data in expansion', async () => {
    logger.testStart('expansion data');
    const start = performance.now();

    const line = BeadsAdapter.parse(MOCK_BEADS_LINES.valid.issueCreate);
    assert.ok(line);

    const expansion = await line.getDefaultExpansion();

    assert.ok(expansion.data);
    assert.strictEqual((expansion.data as Record<string, string>).eventCode, 'bd.issue.create');
    assert.strictEqual((expansion.data as Record<string, string>).issueId, 'bd-97ux');

    logger.testPass('expansion data', performance.now() - start);
  });
});

describe('BeadsAdapter Commands', () => {
  let logger: TestEventLogger;

  before(() => {
    logger = getTestLogger();
    logger.suiteStart('BeadsAdapter Commands');
  });

  after(() => {
    logger.suiteEnd('BeadsAdapter Commands', 0, 0);
  });

  it('should have all 7 commands available', () => {
    logger.testStart('command count');
    const start = performance.now();

    const commands = BeadsAdapter.getCommands();

    assert.strictEqual(commands.length, 7);

    const names = commands.map(c => c.name);
    assert.ok(names.includes('show'));
    assert.ok(names.includes('related'));
    assert.ok(names.includes('deps'));
    assert.ok(names.includes('category'));
    assert.ok(names.includes('session'));
    assert.ok(names.includes('before'));
    assert.ok(names.includes('after'));

    logger.testPass('command count', performance.now() - start);
  });

  it('should have aliases for commands', () => {
    logger.testStart('command aliases');
    const start = performance.now();

    const commands = BeadsAdapter.getCommands();

    const showCmd = commands.find(c => c.name === 'show');
    assert.ok(showCmd);
    assert.ok(showCmd.aliases.includes('s'));

    const relatedCmd = commands.find(c => c.name === 'related');
    assert.ok(relatedCmd);
    assert.ok(relatedCmd.aliases.includes('r'));
    assert.ok(relatedCmd.aliases.includes('rel'));

    logger.testPass('command aliases', performance.now() - start);
  });

  it('should handle show command for issue event', async () => {
    logger.testStart('show command');
    const start = performance.now();

    const line = BeadsAdapter.parse(MOCK_BEADS_LINES.valid.issueCreate);
    assert.ok(line);

    // Query with show command
    const result = await line.handleQuery('show');

    assert.strictEqual(result.handled, true);
    // Result content depends on bd command execution
    assert.ok(typeof result.content === 'string');

    logger.testPass('show command', performance.now() - start);
  });

  it('should handle show command via alias', async () => {
    logger.testStart('show alias');
    const start = performance.now();

    const line = BeadsAdapter.parse(MOCK_BEADS_LINES.valid.issueCreate);
    assert.ok(line);

    const result = await line.handleQuery('s');

    assert.strictEqual(result.handled, true);

    logger.testPass('show alias', performance.now() - start);
  });

  it('should handle show command for non-issue event', async () => {
    logger.testStart('show non-issue');
    const start = performance.now();

    const line = BeadsAdapter.parse(MOCK_BEADS_LINES.valid.epochStart);
    assert.ok(line);

    const result = await line.handleQuery('show');

    assert.strictEqual(result.handled, true);
    assert.ok(result.content.includes('No issue'));

    logger.testPass('show non-issue', performance.now() - start);
  });

  it('should handle category command', async () => {
    logger.testStart('category command');
    const start = performance.now();

    const line = BeadsAdapter.parse(MOCK_BEADS_LINES.valid.issueCreate);
    assert.ok(line);

    const result = await line.handleQuery('category');

    assert.strictEqual(result.handled, true);

    logger.testPass('category command', performance.now() - start);
  });

  it('should handle category command with alias', async () => {
    logger.testStart('category alias');
    const start = performance.now();

    const line = BeadsAdapter.parse(MOCK_BEADS_LINES.valid.issueCreate);
    assert.ok(line);

    const result = await line.handleQuery('cat');

    assert.strictEqual(result.handled, true);

    logger.testPass('category alias', performance.now() - start);
  });

  it('should return unhandled for unknown command', async () => {
    logger.testStart('unknown command');
    const start = performance.now();

    const line = BeadsAdapter.parse(MOCK_BEADS_LINES.valid.issueCreate);
    assert.ok(line);

    const result = await line.handleQuery('unknowncmd');

    assert.strictEqual(result.handled, false);
    assert.ok(result.error);
    assert.ok(result.error.includes('Unknown command'));

    logger.testPass('unknown command', performance.now() - start);
  });

  it('should handle session command for event with session', async () => {
    logger.testStart('session command');
    const start = performance.now();

    const line = BeadsAdapter.parse(MOCK_BEADS_LINES.valid.issueCreate);
    assert.ok(line);

    const result = await line.handleQuery('session');

    assert.strictEqual(result.handled, true);

    logger.testPass('session command', performance.now() - start);
  });
});

describe('BeadsAdapter Factory', () => {
  let logger: TestEventLogger;

  before(() => {
    logger = getTestLogger();
    logger.suiteStart('BeadsAdapter Factory');
  });

  after(() => {
    logger.suiteEnd('BeadsAdapter Factory', 0, 0);
  });

  it('should create adapter via factory function', () => {
    logger.testStart('factory creation');
    const start = performance.now();

    const adapter = createBeadsAdapter();

    assert.strictEqual(adapter.type, 'beads');
    assert.strictEqual(typeof adapter.parse, 'function');
    assert.strictEqual(typeof adapter.getCommands, 'function');

    logger.testPass('factory creation', performance.now() - start);
  });

  it('should return same adapter as BeadsAdapter export', () => {
    logger.testStart('factory returns BeadsAdapter');
    const start = performance.now();

    const adapter = createBeadsAdapter();

    assert.strictEqual(adapter, BeadsAdapter);

    logger.testPass('factory returns BeadsAdapter', performance.now() - start);
  });
});
