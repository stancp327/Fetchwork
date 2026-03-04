Param(
  [string]$BackendUrl = "https://fetchwork-1.onrender.com"
)

$ErrorActionPreference = 'Stop'

function Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Warn($msg) { Write-Host "[warn] $msg" -ForegroundColor Yellow }

$repoRoot = Split-Path $PSScriptRoot -Parent
$reportDir = Join-Path $repoRoot "tasks\reports"
if (-not (Test-Path $reportDir)) { New-Item -Path $reportDir -ItemType Directory | Out-Null }
$ts = Get-Date -Format "yyyy-MM-dd_HHmmss"
$reportPath = Join-Path $reportDir "phase3-qa-$ts.md"

$lines = @()
$lines += "# Phase 3 QA Report"
$lines += ""
$lines += "- Timestamp: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz')"
$lines += "- Backend URL: $BackendUrl"
$lines += "- Host: $env:COMPUTERNAME"
$lines += ""
$lines += "## Results"

$failed = $false

function Run-Step {
  param(
    [string]$Name,
    [scriptblock]$Block
  )

  Step $Name
  $start = Get-Date
  try {
    & $Block
    $duration = [int]((Get-Date) - $start).TotalSeconds
    $script:lines += "- ✅ **$Name** (${duration}s)"
  } catch {
    $script:failed = $true
    $duration = [int]((Get-Date) - $start).TotalSeconds
    $msg = $_.Exception.Message
    Warn "$Name failed: $msg"
    $script:lines += "- ❌ **$Name** (${duration}s)"
    $script:lines += "  - Error: $msg"
  }
}

Push-Location $repoRoot

Run-Step -Name "Server smoke (unauth)" -Block {
  Push-Location "$repoRoot\server"
  $env:BACKEND_URL = $BackendUrl
  npm run smoke:teams:phase3 | Out-Host
  Pop-Location
}

Run-Step -Name "Server integration (teams phase3b)" -Block {
  Push-Location "$repoRoot\server"
  npm test -- --runTestsByPath __tests__/integration/teams.phase3b.integration.test.js | Out-Host
  Pop-Location
}

Run-Step -Name "Mobile typecheck" -Block {
  Push-Location "$repoRoot\mobile"
  npx tsc --noEmit | Out-Host
  Pop-Location
}

Pop-Location

$lines += ""
$lines += "## Summary"
if ($failed) {
  $lines += "Status: ❌ FAILED"
} else {
  $lines += "Status: ✅ PASSED"
}

$lines | Set-Content -Path $reportPath -Encoding UTF8
Write-Host "`nReport written: $reportPath" -ForegroundColor Green

if ($failed) { exit 1 }
