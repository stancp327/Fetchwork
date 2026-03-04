Param(
  [switch]$All,
  [switch]$Smoke,
  [switch]$Org,
  [switch]$Roles,
  [switch]$Clients
)

$ErrorActionPreference = 'Stop'

function Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Warn($msg) { Write-Host "[warn] $msg" -ForegroundColor Yellow }
function Die($msg) { Write-Host "[error] $msg" -ForegroundColor Red; exit 1 }

$repoRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$reportDir = Join-Path $repoRoot "tasks\reports"
if (-not (Test-Path $reportDir)) { New-Item -Path $reportDir -ItemType Directory | Out-Null }
$ts = Get-Date -Format "yyyy-MM-dd_HHmmss"
$reportPath = Join-Path $reportDir "mobile-teams-phase3-maestro-$ts.md"
$reportLines = @()
$reportLines += "# Mobile Teams Phase 3 Maestro Run Report"
$reportLines += ""
$reportLines += "- Timestamp: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz')"
$reportLines += "- Host: $env:COMPUTERNAME"
$reportLines += "- Runner: run-maestro-phase3.ps1"
$reportLines += ""
$reportLines += "## Flow results"

function Has-Command($name) {
  return [bool](Get-Command $name -ErrorAction SilentlyContinue)
}

Step "Checking prerequisites"
if (-not (Has-Command 'maestro')) {
  Die "Maestro CLI not found. Install: https://docs.maestro.dev/getting-started/installing-maestro"
}

if (-not (Has-Command 'adb')) {
  Warn "adb not found in PATH. If running Android, install Android platform-tools and ensure emulator/device is connected."
} else {
  $adbOut = adb devices
  if ($adbOut -notmatch "\tdevice") {
    Warn "No Android device/emulator detected via adb devices."
  }
}

$flows = @()
if ($All -or (-not $Smoke -and -not $Org -and -not $Roles -and -not $Clients)) {
  $flows = @(
    '.maestro/teams-phase3-smoke.yaml',
    '.maestro/teams-phase3-org-settings.yaml',
    '.maestro/teams-phase3-custom-roles.yaml',
    '.maestro/teams-phase3-linked-clients.yaml'
  )
} else {
  if ($Smoke) { $flows += '.maestro/teams-phase3-smoke.yaml' }
  if ($Org) { $flows += '.maestro/teams-phase3-org-settings.yaml' }
  if ($Roles) { $flows += '.maestro/teams-phase3-custom-roles.yaml' }
  if ($Clients) { $flows += '.maestro/teams-phase3-linked-clients.yaml' }
}

$failed = $false

foreach ($flow in $flows) {
  Step "Running $flow"
  $start = Get-Date
  try {
    maestro test $flow
    $duration = [int]((Get-Date) - $start).TotalSeconds
    $reportLines += "- ✅ `$flow` (pass, ${duration}s)"
  } catch {
    $failed = $true
    $duration = [int]((Get-Date) - $start).TotalSeconds
    $msg = $_.Exception.Message
    Warn "Flow failed: $flow"
    $reportLines += "- ❌ `$flow` (fail, ${duration}s)"
    $reportLines += "  - Error: $msg"
  }
}

$reportLines += ""
$reportLines += "## Summary"
if ($failed) {
  $reportLines += "Status: ❌ FAILED"
} else {
  $reportLines += "Status: ✅ PASSED"
}

$reportLines | Set-Content -Path $reportPath -Encoding UTF8

Step "Done"
Write-Host "Maestro Teams Phase 3 run completed." -ForegroundColor Green
Write-Host "Report: $reportPath" -ForegroundColor Cyan

if ($failed) { exit 1 }
