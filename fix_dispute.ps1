$cssPath = 'C:\Users\stanc\Fetchwork\client\src\components\Disputes\DisputeCenter.css'
$jsPath  = 'C:\Users\stanc\Fetchwork\client\src\components\Disputes\DisputeCenter.js'

# Update CSS
$css = [System.IO.File]::ReadAllText($cssPath)
$css = $css.Replace('.filter-tab {', '.dc-filter-tab {')
$css = $css.Replace('.filter-tab:hover', '.dc-filter-tab:hover')
$css = $css.Replace('.filter-tab.active', '.dc-filter-tab.active')
$css = $css.Replace('.filter-tab:not(.active)', '.dc-filter-tab:not(.dc-filter-tab-active)')
$css = $css.Replace('.filter-count {', '.dc-filter-count {')
$css = $css.Replace('.filter-tab:not(.active) .filter-count', '.dc-filter-tab:not(.active) .dc-filter-count')
$css = $css.Replace('.spinner {', '.dc-spinner {')
$css = $css.Replace('.empty-icon {', '.dc-empty-icon {')
$css = $css.Replace('.filter-tab { flex-shrink', '.dc-filter-tab { flex-shrink')
[System.IO.File]::WriteAllText($cssPath, $css)
Write-Host "CSS updated"

# Update JS
$js = [System.IO.File]::ReadAllText($jsPath)
$js = $js.Replace('className={`filter-tab ${', 'className={`dc-filter-tab ${')
$js = $js.Replace('className="filter-count"', 'className="dc-filter-count"')
$js = $js.Replace('className="spinner"', 'className="dc-spinner"')
$js = $js.Replace('className="empty-icon"', 'className="dc-empty-icon"')
[System.IO.File]::WriteAllText($jsPath, $js)
Write-Host "JS updated"
