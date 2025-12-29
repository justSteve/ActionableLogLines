/**
 * ALLP Test Harness
 *
 * Provides utilities for testing ALLP components with event logging
 * for beads workflow metrics capture.
 */

import * as fs from 'fs';
import * as path from 'path';

// Event categories for testing
export const TX_EVENTS = {
  TEST_START: 'tx.test.start',
  TEST_PASS: 'tx.test.pass',
  TEST_FAIL: 'tx.test.fail',
  TEST_SKIP: 'tx.test.skip',
  SUITE_START: 'tx.suite.start',
  SUITE_END: 'tx.suite.end',
  SESSION_START: 'tx.session.start',
  SESSION_END: 'tx.session.end',
} as const;

export const ML_EVENTS = {
  METRIC_RECORD: 'ml.metric.record',
  ASSERTION_COUNT: 'ml.assertion.count',
  COVERAGE_SNAPSHOT: 'ml.coverage.snapshot',
  TIMING_RECORD: 'ml.timing.record',
} as const;

interface TestEvent {
  timestamp: string;
  eventCode: string;
  issueId: string;
  agentId: string;
  sessionId: string;
  details: string;
}

/**
 * Test Event Logger
 * Logs test events to .beads/events.log for workflow metrics
 */
export class TestEventLogger {
  private eventsLogPath: string;
  private sessionId: string;
  private agentId: string;
  private issueId: string;

  constructor(options: {
    beadsDir?: string;
    sessionId?: string;
    agentId?: string;
    issueId?: string;
  } = {}) {
    const beadsDir = options.beadsDir || path.join(process.cwd(), '.beads');
    this.eventsLogPath = path.join(beadsDir, 'events.log');
    this.sessionId = options.sessionId || `test-${Date.now()}`;
    this.agentId = options.agentId || 'test-runner';
    this.issueId = options.issueId || 'none';
  }

  /**
   * Log a test event
   */
  log(eventCode: string, details: Record<string, unknown> = {}): void {
    const event: TestEvent = {
      timestamp: new Date().toISOString(),
      eventCode,
      issueId: this.issueId,
      agentId: this.agentId,
      sessionId: this.sessionId,
      details: Object.entries(details)
        .map(([k, v]) => `${k}=${v}`)
        .join(','),
    };

    const line = [
      event.timestamp,
      event.eventCode,
      event.issueId,
      event.agentId,
      event.sessionId,
      event.details,
    ].join('|');

    try {
      fs.appendFileSync(this.eventsLogPath, line + '\n');
    } catch {
      // Silently fail if .beads directory doesn't exist
      // Tests should work without event logging
    }
  }

  /**
   * Log test session start
   */
  sessionStart(testCount: number): void {
    this.log(TX_EVENTS.SESSION_START, { tests: testCount });
  }

  /**
   * Log test session end
   */
  sessionEnd(passed: number, failed: number, skipped: number, durationMs: number): void {
    this.log(TX_EVENTS.SESSION_END, {
      passed,
      failed,
      skipped,
      duration_ms: durationMs,
    });
  }

  /**
   * Log suite start
   */
  suiteStart(name: string): void {
    this.log(TX_EVENTS.SUITE_START, { suite: name });
  }

  /**
   * Log suite end
   */
  suiteEnd(name: string, passed: number, failed: number): void {
    this.log(TX_EVENTS.SUITE_END, { suite: name, passed, failed });
  }

  /**
   * Log test start
   */
  testStart(name: string): void {
    this.log(TX_EVENTS.TEST_START, { test: name });
  }

  /**
   * Log test pass
   */
  testPass(name: string, durationMs: number): void {
    this.log(TX_EVENTS.TEST_PASS, { test: name, duration_ms: durationMs });
  }

  /**
   * Log test fail
   */
  testFail(name: string, error: string): void {
    this.log(TX_EVENTS.TEST_FAIL, { test: name, error: error.slice(0, 100) });
  }

  /**
   * Log test skip
   */
  testSkip(name: string, reason?: string): void {
    this.log(TX_EVENTS.TEST_SKIP, { test: name, reason: reason || 'skipped' });
  }

  /**
   * Log a metric
   */
  recordMetric(name: string, value: number, unit?: string): void {
    this.log(ML_EVENTS.METRIC_RECORD, { metric: name, value, unit: unit || 'count' });
  }

  /**
   * Log timing
   */
  recordTiming(name: string, durationMs: number): void {
    this.log(ML_EVENTS.TIMING_RECORD, { timing: name, duration_ms: durationMs });
  }
}

// Global logger instance for test files
let globalLogger: TestEventLogger | null = null;

export function getTestLogger(): TestEventLogger {
  if (!globalLogger) {
    globalLogger = new TestEventLogger();
  }
  return globalLogger;
}

export function initTestLogger(options: ConstructorParameters<typeof TestEventLogger>[0]): TestEventLogger {
  globalLogger = new TestEventLogger(options);
  return globalLogger;
}

/**
 * Mock beads log lines for testing adapters
 */
export const MOCK_BEADS_LINES = {
  valid: {
    issueCreate: '2025-01-15T15:04:03.456Z|bd.issue.create|bd-97ux|steve|sess-abc123|title=Implement ALLP',
    issueUpdate: '2025-01-15T15:04:05.789Z|bd.issue.update|bd-97ux|steve|sess-abc123|status=in_progress',
    issueClose: '2025-01-15T15:04:15.678Z|bd.issue.close|bd-97ux|steve|sess-abc123|reason=completed',
    gitCommit: '2025-01-15T15:04:10.012Z|gt.commit|bd-97ux|steve|sess-abc123|hash=abc1234',
    skillActivate: '2025-01-15T15:04:02.123Z|sk.bootup.activated|none|steve|sess-abc123|skill=beads-bootup',
    sessionEnd: '2025-01-15T15:04:20.901Z|ss.session.end|none|steve|sess-abc123|duration=18s',
    epochStart: '2025-01-15T15:05:01.234Z|ep.epoch.start|none|system|sess-def456|version=1.0.0',
    hookTrigger: '2025-01-15T15:05:05.890Z|hk.hook.trigger|bd-vnlh|system|sess-def456|hook=pre-commit',
    guardPass: '2025-01-15T15:05:08.123Z|gd.guard.pass|bd-vnlh|system|sess-def456|check=branch-protection',
    depAdd: '2025-01-15T15:05:10.456Z|bd.dep.add|bd-vnlh|steve|sess-def456|depends_on=bd-97ux',
  },
  invalid: {
    plainText: 'This is plain text without pipe separators',
    noTimestamp: '|bd.issue.create|bd-97ux|steve|sess-abc123|title=Test',
    badTimestamp: 'not-a-date|bd.issue.create|bd-97ux|steve|sess-abc123|title=Test',
    noEventCode: '2025-01-15T15:04:03.456Z||bd-97ux|steve|sess-abc123|title=Test',
    badEventCode: '2025-01-15T15:04:03.456Z|nodot|bd-97ux|steve|sess-abc123|title=Test',
    tooFewFields: '2025-01-15T15:04:03.456Z|bd.issue.create|bd-97ux',
    emptyLine: '',
    whitespaceOnly: '   ',
  },
};

/**
 * Assert helper that works with node:test
 */
export function assertDefined<T>(value: T | null | undefined, message?: string): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(message || 'Expected value to be defined');
  }
}

/**
 * Measure execution time of an async function
 */
export async function measureAsync<T>(fn: () => Promise<T>): Promise<{ result: T; durationMs: number }> {
  const start = performance.now();
  const result = await fn();
  const durationMs = performance.now() - start;
  return { result, durationMs };
}

/**
 * Create a simple mock for testing
 */
export function createMock<T extends object>(overrides: Partial<T> = {}): T {
  return new Proxy(overrides as T, {
    get(target, prop) {
      if (prop in target) {
        return (target as Record<string | symbol, unknown>)[prop];
      }
      return () => undefined;
    },
  });
}
