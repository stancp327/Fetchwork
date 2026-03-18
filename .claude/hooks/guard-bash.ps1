# Fires before every Bash tool call.
# Blocks dangerous patterns before they execute.

$json = [Console]::In.ReadToEnd() | ConvertFrom-Json
$cmd = $json.tool_input.command

# Block rm on root or home paths
if ($cmd -match "rm\s+-[rRfF]+\s+(/[^t]|~|\$HOME)") {
    @{
        hookSpecificOutput = @{
            hookEventName         = "PreToolUse"
            permissionDecision    = "deny"
            permissionDecisionReason = "Blocked: rm on root/home path. Use trash or specify an exact subdirectory."
        }
    } | ConvertTo-Json -Depth 5
    exit 0
}

# Block writing directly to .env files
if ($cmd -match "(echo|printf|tee|Out-File).*\.env[^.]") {
    @{
        hookSpecificOutput = @{
            hookEventName         = "PreToolUse"
            permissionDecision    = "deny"
            permissionDecisionReason = "Blocked: direct write to .env file. Edit manually or use the Write tool."
        }
    } | ConvertTo-Json -Depth 5
    exit 0
}

# Warn (but allow) if touching node_modules
if ($cmd -match "node_modules" -and $cmd -match "(rm|del|Remove-Item)") {
    Write-Host "[hook] Warning: deleting node_modules — make sure you mean to do this." -ForegroundColor Yellow
}

exit 0
