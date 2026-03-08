$path = 'C:\Users\stanc\Fetchwork\client\src\components\Onboarding\ProfileWizard\Wizard.js'
$c = [System.IO.File]::ReadAllText($path)
$matches = [regex]::Matches($c, 'className="(section|row|info)"')
if ($matches.Count -eq 0) {
    Write-Host "CLEAN - no generic classNames remaining"
} else {
    Write-Host "FOUND $($matches.Count) remaining:"
    foreach ($m in $matches) { Write-Host "  $($m.Value)" }
}
# Also verify wiz- classes are present
$wizMatches = [regex]::Matches($c, 'className="wiz-(section|row|info)"')
Write-Host "wiz- class occurrences: $($wizMatches.Count)"
