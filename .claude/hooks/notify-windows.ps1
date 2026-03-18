# Fires on Notification events (Claude waiting for input).
# Shows a Windows balloon notification.

$json = [Console]::In.ReadToEnd() | ConvertFrom-Json
$msg  = if ($json.message) { $json.message } else { "Claude Code needs your attention" }

try {
    Add-Type -AssemblyName System.Windows.Forms
    $n = New-Object System.Windows.Forms.NotifyIcon
    $n.Icon = [System.Drawing.SystemIcons]::Information
    $n.BalloonTipTitle = "Claude Code"
    $n.BalloonTipText  = $msg
    $n.Visible = $true
    $n.ShowBalloonTip(5000)
    Start-Sleep -Seconds 1
    $n.Dispose()
} catch {
    # Silently fail if notifications aren't available
}

exit 0
