# Fires after Write or Edit tool calls.
# If a client/src file was modified, prints a build reminder.

$json = [Console]::In.ReadToEnd() | ConvertFrom-Json
$path = $json.tool_input.file_path

if ($path -match "client[/\\]src[/\\].*\.(js|jsx|ts|tsx|css)$") {
    $file = Split-Path $path -Leaf
    Write-Host ""
    Write-Host "  [hook] client file modified: $file" -ForegroundColor Yellow
    Write-Host "  [hook] verify build when done: cd client; npx react-scripts build" -ForegroundColor Cyan
    Write-Host ""
}

exit 0
