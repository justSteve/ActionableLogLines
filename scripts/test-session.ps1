# test-session.ps1
# Run tests and capture per-commit metrics for beads workflow

param(
    [switch]$Verbose,
    [string]$IssueId = "none"
)

$ErrorActionPreference = "Stop"

# Get current commit hash
$commitHash = git rev-parse --short HEAD 2>$null
if (-not $commitHash) {
    $commitHash = "uncommitted"
}

# Timestamp for session
$sessionId = "test-$(Get-Date -Format 'yyyyMMddHHmmss')"
$startTime = Get-Date

Write-Host "=== ALLP Test Session ===" -ForegroundColor Cyan
Write-Host "Commit: $commitHash"
Write-Host "Session: $sessionId"
Write-Host ""

# Log session start to beads
$beadsDir = Join-Path $PSScriptRoot "..\.beads"
$eventsLog = Join-Path $beadsDir "events.log"

function Log-Event {
    param($EventCode, $Details)
    $timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    $line = "$timestamp|$EventCode|$IssueId|test-runner|$sessionId|$Details"
    if (Test-Path $beadsDir) {
        Add-Content -Path $eventsLog -Value $line
    }
}

Log-Event "tx.session.start" "commit=$commitHash"

# Build first
Write-Host "Building..." -ForegroundColor Yellow
npm run compile 2>&1 | Out-Null
$buildSuccess = $LASTEXITCODE -eq 0

if (-not $buildSuccess) {
    Write-Host "Build failed!" -ForegroundColor Red
    Log-Event "tx.session.end" "status=build_failed,commit=$commitHash"
    exit 1
}

Write-Host "Build successful" -ForegroundColor Green
Write-Host ""

# Run tests
Write-Host "Running tests..." -ForegroundColor Yellow
$testOutput = npm test 2>&1 | Out-String

# Parse test results
$passed = 0
$failed = 0
$skipped = 0

# Node test runner outputs "# pass X" and "# fail X"
if ($testOutput -match "# pass (\d+)") { $passed = [int]$Matches[1] }
if ($testOutput -match "# fail (\d+)") { $failed = [int]$Matches[1] }
if ($testOutput -match "# skip (\d+)") { $skipped = [int]$Matches[1] }

# Calculate duration
$duration = ((Get-Date) - $startTime).TotalMilliseconds

# Output results
Write-Host ""
Write-Host "=== Results ===" -ForegroundColor Cyan
Write-Host "Passed:  $passed" -ForegroundColor Green
if ($failed -gt 0) {
    Write-Host "Failed:  $failed" -ForegroundColor Red
} else {
    Write-Host "Failed:  $failed" -ForegroundColor Gray
}
Write-Host "Skipped: $skipped" -ForegroundColor Yellow
Write-Host "Duration: $([math]::Round($duration))ms"

# Log session end
$status = if ($failed -gt 0) { "failed" } else { "passed" }
Log-Event "tx.session.end" "status=$status,passed=$passed,failed=$failed,skipped=$skipped,duration_ms=$([math]::Round($duration)),commit=$commitHash"

# Output metrics line for easy parsing
$metricsLine = @{
    commit = $commitHash
    session = $sessionId
    passed = $passed
    failed = $failed
    skipped = $skipped
    duration_ms = [math]::Round($duration)
    timestamp = (Get-Date).ToUniversalTime().ToString("o")
} | ConvertTo-Json -Compress

Write-Host ""
Write-Host "Metrics: $metricsLine"

# Exit with appropriate code
if ($failed -gt 0) { exit 1 } else { exit 0 }
