# ALLP Comprehensive Logging Schema

Complete reference for structured logging with ALLP.

## Log Format

Recommended pipe-delimited format with JSON context:

```
TIMESTAMP|EVENT_TYPE|CORRELATION_ID|LEVEL|CONTEXT_JSON
```

Example:
```
2025-01-02T10:30:00.123Z|integration.api_call|corr-abc123|info|{"endpoint":"https://api.example.com","status":200}
```

## Session Initialization

Captured once at application startup:

```json
{
  "type": "session.init",
  "timestamp": "2025-01-02T10:00:00.000Z",
  "session_id": "sess-uuid",
  "app": {
    "name": "myapp",
    "version": "1.2.3",
    "commit_hash": "abc1234",
    "env": "production"
  },
  "platform": {
    "os": "linux",
    "runtime": "Node v20.5.0",
    "host": "container-xyz",
    "region": "us-east-1"
  },
  "user": {
    "id": "steve",
    "role": "developer"
  },
  "config": {
    "feature_flags": {"new_ui": true},
    "log_level": "info",
    "resource_limits": {"max_memory": "512MB"}
  },
  "dependencies": {
    "critical_libs": {"express": "4.18.0", "pg": "8.11.0"}
  }
}
```

## Error Events

Logged from catch blocks:

```json
{
  "type": "error",
  "error": {
    "message": "Connection timeout",
    "type": "NetworkError",
    "stack": "full stack trace",
    "code": "ETIMEDOUT",
    "taxonomy": "integration.network.timeout"
  },
  "context": {
    "operation": "api.call",
    "upstream": "api.example.com",
    "attempt": 3,
    "recovery": "exponential_backoff",
    "state_snapshot": {"user_query": "...", "params": {...}}
  },
  "related": {
    "previous_errors": ["err-001", "err-002"],
    "correlation_id": "corr-xyz"
  }
}
```

## Integration Events

API calls, database operations, external services:

```json
{
  "type": "integration.api_call",
  "endpoint": "https://api.openai.com/v1/chat/completions",
  "method": "POST",
  "status": 200,
  "duration_ms": 1234,
  "retry_count": 0,
  "request": {
    "model": "gpt-3.5-turbo",
    "tokens": 500
  },
  "response": {
    "tokens_used": 450,
    "cached": false
  }
}
```

## Performance Timing

Operations with duration tracking:

```json
{
  "type": "timing.span",
  "operation": "data_processing",
  "duration_ms": 5678,
  "span_id": "span-abc",
  "parent_span_id": "span-xyz",
  "tags": {
    "records_processed": 1000,
    "cache_hits": 850
  }
}
```

## Business Workflow

Domain-specific events:

```json
{
  "type": "workflow.step_complete",
  "workflow_id": "wf-123",
  "step": "3/10",
  "step_name": "validate_data",
  "state": "completed",
  "entity": {
    "user_id": "user-456",
    "workspace_id": "ws-789"
  },
  "data": {
    "records_validated": 100,
    "errors_found": 3
  }
}
```

## DSPy-Specific Events

For DSPy training and optimization:

```json
{
  "type": "dspy.optimizer.iteration",
  "iteration": "5/10",
  "metrics": {
    "loss": 0.234,
    "accuracy": 0.87,
    "f1": 0.82
  },
  "model": "gpt-3.5-turbo",
  "prompt_length": 1200,
  "examples_used": [1, 5, 12],
  "assertions": {
    "passed": 8,
    "failed": 2,
    "failed_assertions": ["length_check", "format_check"]
  },
  "optimizer_state": {
    "learning_rate": 0.001,
    "temperature": 0.7
  }
}
```

## Security Audit Events

Authentication and authorization:

```json
{
  "type": "security.auth.login",
  "user": {
    "id": "user-123",
    "role": "developer",
    "permissions": ["read", "write"]
  },
  "method": "oauth2",
  "source_ip": "192.168.1.1",
  "user_agent": "Mozilla/5.0...",
  "result": "success",
  "session_id": "sess-xyz"
}
```

## Event Taxonomy

### Core Categories

| Prefix | Category | Examples |
|--------|----------|----------|
| `session` | Session lifecycle | init, end |
| `error` | Errors and exceptions | All catch blocks |
| `integration` | External systems | api_call, db_query, cache_op |
| `timing` | Performance | span, checkpoint |
| `workflow` | Business processes | step_start, step_complete |
| `dspy` | DSPy operations | optimizer.iteration, assertion |
| `security` | Auth/audit | login, access_denied |

### Event Naming Convention

Pattern: `category.subcategory.action`

Examples:
- `integration.api_call`
- `error.network.timeout`
- `dspy.optimizer.iteration`
- `workflow.order.created`

## Field Standards

### Required Fields

All events must have:
- `timestamp`: ISO 8601 format
- `type`: Event type (category.action)
- `correlation_id`: Request/session trace ID
- `level`: debug | info | warn | error

### Optional Standard Fields

- `user_id`: User performing action
- `session_id`: Session identifier
- `operation`: High-level operation name
- `duration_ms`: Operation duration
- `status`: Operation result status

### Context Fields

Wrap complex objects in context:

```json
{
  "context": {
    "request": {...},
    "response": {...},
    "state": {...}
  }
}
```

## Log Levels

| Level | Usage |
|-------|-------|
| `debug` | Detailed diagnostic info |
| `info` | Normal operations |
| `warn` | Unexpected but handled |
| `error` | Operation failures |

## Best Practices

1. **Use correlation IDs** - Trace requests across services
2. **Include context** - Enough to debug without code
3. **Structured data** - JSON when possible
4. **Timing data** - Duration for all operations
5. **Error taxonomy** - Classify errors for analysis
6. **State snapshots** - Capture relevant variable values
7. **Avoid PII** - Filter sensitive data
8. **Consistent timestamps** - ISO 8601 UTC

## Logger Helper Usage

```typescript
import { getLogger } from './.allp/logger';

const logger = getLogger();

// Error with context
try {
  await operation();
} catch (error) {
  logger.logError(error, {
    operation: 'data_sync',
    user_id: '123',
    records_processed: 50
  });
}

// API call
logger.logApiCall(
  'https://api.example.com/data',
  'POST',
  200,
  1234,
  { cache: 'miss' }
);

// Timing
const start = Date.now();
await expensiveOperation();
logger.logTiming('expensive_operation', Date.now() - start);

// Custom event
logger.logEvent('workflow.step_complete', {
  step: '3/10',
  result: 'success'
});
```
