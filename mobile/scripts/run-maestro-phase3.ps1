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

foreach ($flow in $flows) {
  Step "Running $flow"
  maestro test $flow
}

Step "Done"
Write-Host "Maestro Teams Phase 3 run completed." -ForegroundColor Green
