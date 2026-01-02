# validate.ps1 - Quick beads validation for ActionableLogLines
# Usage: .\.beads\validate.ps1 [-Verbose] [-CreateTestIssue]
#
# Run from ActionableLogLines repo root to validate beads integration

param(
    [switch]$VerboseOutput,
    [switch]$CreateTestIssue
)

$ErrorActionPreference = "Stop"
$script:Errors = @()

function Write-Check {
    param([string]$Name, [bool]$Passed, [string]$Details = "")
    if ($Passed) {
        Write-Host "[OK] $Name" -ForegroundColor Green
    } else {
        Write-Host "[!!] $Name" -ForegroundColor Red
        $script:Errors += $Name
    }
    if ($VerboseOutput -and $Details) {
        Write-Host "     $Details" -ForegroundColor DarkGray
    }
}

Write-Host "`nBeads Validation - ActionableLogLines" -ForegroundColor Cyan
Write-Host "======================================`n" -ForegroundColor Cyan

# Check 1: .beads directory exists
$beadsDir = ".beads"
Write-Check ".beads directory exists" (Test-Path $beadsDir)

# Check 2: Database exists
$dbPath = ".beads/beads.db"
Write-Check "Database exists" (Test-Path $dbPath) "Path: $dbPath"

# Check 3: bd command available
try {
    $version = bd --version 2>&1
    Write-Check "bd command available" $true "Version: $version"
} catch {
    Write-Check "bd command available" $false "bd not in PATH"
}

# Check 4: bd info returns valid data
try {
    $output = bd --no-daemon info --json 2>&1 | Out-String
    # Extract JSON from output (may contain warnings)
    $jsonStart = $output.IndexOf('{')
    if ($jsonStart -ge 0) {
        $jsonText = $output.Substring($jsonStart)
        $info = $jsonText | ConvertFrom-Json
        Write-Check "bd info succeeds" ($null -ne $info.database_path)
    } else {
        Write-Check "bd info succeeds" $false
    }
} catch {
    Write-Check "bd info succeeds" $false
}

# Check 5: Can list issues
try {
    $output = bd --no-daemon list --json 2>&1 | Out-String
    # Extract JSON from output
    $jsonStart = $output.IndexOf('[')
    if ($jsonStart -ge 0) {
        $jsonText = $output.Substring($jsonStart)
        $issues = $jsonText | ConvertFrom-Json
        $count = if ($issues -is [array]) { $issues.Count } else { 1 }
        Write-Check "bd list succeeds" $true "Found $count issue(s)"
    } else {
        Write-Check "bd list succeeds" $false
    }
} catch {
    Write-Check "bd list succeeds" $false
}

# Check 6: Ready command works
try {
    $ready = bd --no-daemon ready 2>&1
    Write-Check "bd ready succeeds" $true
    if ($VerboseOutput) {
        Write-Host "     Ready issues:" -ForegroundColor DarkGray
        $ready | ForEach-Object { Write-Host "       $_" -ForegroundColor DarkGray }
    }
} catch {
    Write-Check "bd ready succeeds" $false
}

# Check 7: JSONL file exists
$jsonlPath = ".beads/issues.jsonl"
Write-Check "issues.jsonl exists" (Test-Path $jsonlPath)

# Check 8: Doctor passes
try {
    $doctor = bd doctor 2>&1
    Write-Check "bd doctor passes" $true
} catch {
    Write-Check "bd doctor passes" $false
}

# Optional: Create and cleanup test issue
if ($CreateTestIssue) {
    Write-Host "`nTest Issue Creation" -ForegroundColor Yellow
    try {
        $testIssue = bd create "VALIDATE: Temporary test issue" -t task -p 4 --json 2>&1 | ConvertFrom-Json
        $testId = $testIssue.id
        Write-Check "Create test issue" $true "ID: $testId"

        bd close $testId --reason "Validation test" 2>&1 | Out-Null
        Write-Check "Close test issue" $true

        Write-Host "     Note: Test issue $testId remains in closed state" -ForegroundColor DarkGray
    } catch {
        Write-Check "Test issue lifecycle" $false $_.Exception.Message
    }
}

# Summary
Write-Host "`n======================================" -ForegroundColor Cyan
if ($script:Errors.Count -eq 0) {
    Write-Host "All checks passed!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "Failed checks: $($script:Errors.Count)" -ForegroundColor Red
    $script:Errors | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
    exit 1
}
