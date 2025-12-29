#!/usr/bin/env bash
# test-session.sh
# Run tests and capture per-commit metrics for beads workflow

set -e

ISSUE_ID="${1:-none}"
COMMIT_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "uncommitted")
SESSION_ID="test-$(date +%Y%m%d%H%M%S)"
START_TIME=$(date +%s%3N)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BEADS_DIR="$SCRIPT_DIR/../.beads"
EVENTS_LOG="$BEADS_DIR/events.log"

log_event() {
    local event_code="$1"
    local details="$2"
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")
    local line="$timestamp|$event_code|$ISSUE_ID|test-runner|$SESSION_ID|$details"
    if [[ -d "$BEADS_DIR" ]]; then
        echo "$line" >> "$EVENTS_LOG"
    fi
}

echo "=== ALLP Test Session ==="
echo "Commit: $COMMIT_HASH"
echo "Session: $SESSION_ID"
echo ""

log_event "tx.session.start" "commit=$COMMIT_HASH"

# Build first
echo "Building..."
if ! npm run compile > /dev/null 2>&1; then
    echo "Build failed!"
    log_event "tx.session.end" "status=build_failed,commit=$COMMIT_HASH"
    exit 1
fi
echo "Build successful"
echo ""

# Run tests and capture output
echo "Running tests..."
TEST_OUTPUT=$(npm test 2>&1) || true

# Parse test results from node --test output
PASSED=$(echo "$TEST_OUTPUT" | grep -oP '# pass \K\d+' || echo "0")
FAILED=$(echo "$TEST_OUTPUT" | grep -oP '# fail \K\d+' || echo "0")
SKIPPED=$(echo "$TEST_OUTPUT" | grep -oP '# skip \K\d+' || echo "0")

# Calculate duration
END_TIME=$(date +%s%3N)
DURATION=$((END_TIME - START_TIME))

# Output results
echo ""
echo "=== Results ==="
echo "Passed:  $PASSED"
echo "Failed:  $FAILED"
echo "Skipped: $SKIPPED"
echo "Duration: ${DURATION}ms"

# Determine status
STATUS="passed"
if [[ "$FAILED" -gt 0 ]]; then
    STATUS="failed"
fi

log_event "tx.session.end" "status=$STATUS,passed=$PASSED,failed=$FAILED,skipped=$SKIPPED,duration_ms=$DURATION,commit=$COMMIT_HASH"

# Output metrics JSON
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")
echo ""
echo "Metrics: {\"commit\":\"$COMMIT_HASH\",\"session\":\"$SESSION_ID\",\"passed\":$PASSED,\"failed\":$FAILED,\"skipped\":$SKIPPED,\"duration_ms\":$DURATION,\"timestamp\":\"$TIMESTAMP\"}"

# Exit with appropriate code
if [[ "$FAILED" -gt 0 ]]; then
    exit 1
fi
exit 0
