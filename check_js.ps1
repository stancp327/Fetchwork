$files = @(
    'C:\Users\stanc\Fetchwork\client\src\components\common\Footer.js',
    'C:\Users\stanc\Fetchwork\client\src\components\Onboarding\ProfileWizard\Wizard.js',
    'C:\Users\stanc\Fetchwork\client\src\components\Disputes\DisputeCenter.js',
    'C:\Users\stanc\Fetchwork\client\src\components\Settings\EmailPreferences.js'
)
$allOk = $true
foreach ($f in $files) {
    $result = & node --check $f 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "FAIL: $f"
        Write-Host $result
        $allOk = $false
    } else {
        Write-Host "OK: $f"
    }
}
if ($allOk) { Write-Host "`nAll JS files pass syntax check" }
