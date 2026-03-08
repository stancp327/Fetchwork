$path = 'C:\Users\stanc\Fetchwork\client\src\components\Onboarding\ProfileWizard\Wizard.js'
$c = [System.IO.File]::ReadAllText($path)
$c = $c.Replace('className="section"', 'className="wiz-section"')
$c = $c.Replace('className="row"', 'className="wiz-row"')
$c = $c.Replace('className="info"', 'className="wiz-info"')
[System.IO.File]::WriteAllText($path, $c)
Write-Host "Done - Wizard.js updated"
