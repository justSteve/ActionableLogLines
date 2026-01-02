/**
 * {{ADAPTER_NAME}} Logger Helper
 * Simplifies writing logs in ALLP-compatible format
 */

import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuid } from 'uuid';

export class {{ADAPTER_NAME}}Logger {
  private logPath: string;
  private sessionId: string;

  constructor(logPath = '.allp/{{logFileName}}.log') {
    this.logPath = logPath;
    this.sessionId = uuid();
    this.ensureLogDir();
    this.writeSessionHeader();
  }

  private ensureLogDir() {
    const dir = path.dirname(this.logPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private writeSessionHeader() {
    const header = {
      type: 'session.init',
      timestamp: new Date().toISOString(),
      session_id: this.sessionId,
      app: {
        name: '{{appName}}',
        version: process.env.APP_VERSION || '0.0.0',
        env: process.env.NODE_ENV || 'development'
      },
      platform: {
        os: process.platform,
        runtime: process.version,
        host: process.env.HOSTNAME || 'localhost'
      }
    };

    this.log('session.init', header);
  }

  private log(eventType: string, context: any, level = 'info') {
    const timestamp = new Date().toISOString();
    const correlationId = context.correlation_id || uuid();
    const contextJson = JSON.stringify(context);

    const line = `${timestamp}|${eventType}|${correlationId}|${level}|${contextJson}\n`;
    fs.appendFileSync(this.logPath, line);
  }

  /** Log error from catch block */
  logError(error: Error, context?: any) {
    this.log('error', {
      ...context,
      error: {
        message: error.message,
        type: error.constructor.name,
        stack: error.stack,
        code: (error as any).code
      }
    }, 'error');
  }

  /** Log API call */
  logApiCall(endpoint: string, method: string, status: number, durationMs: number, context?: any) {
    this.log('integration.api_call', {
      ...context,
      integration: {
        endpoint,
        method,
        status,
        duration_ms: durationMs
      }
    });
  }

  /** Log timing span */
  logTiming(operation: string, durationMs: number, context?: any) {
    this.log('timing.span', {
      ...context,
      timing: {
        operation,
        duration_ms: durationMs
      }
    });
  }

  /** Log custom event */
  logEvent(eventType: string, context: any, level = 'info') {
    this.log(eventType, context, level);
  }
}

// Singleton instance
let globalLogger: {{ADAPTER_NAME}}Logger | null = null;

export function getLogger(logPath?: string): {{ADAPTER_NAME}}Logger {
  if (!globalLogger) {
    globalLogger = new {{ADAPTER_NAME}}Logger(logPath);
  }
  return globalLogger;
}
