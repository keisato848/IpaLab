[CmdletBinding()]
param(
    [ValidateSet('SessionStart', 'SubagentStart', 'SubagentStop')]
    [string]$Event
)

$ErrorActionPreference = 'Stop'

function Get-ShortHash {
    param([AllowNull()][string]$Value)
    if ([string]::IsNullOrWhiteSpace($Value)) { return $null }
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($Value)
        $hash = $sha.ComputeHash($bytes)
        return (($hash | ForEach-Object { $_.ToString('x2') }) -join '').Substring(0, 16)
    } finally {
        $sha.Dispose()
    }
}

function Get-ObjectValue {
    param(
        [AllowNull()]$InputObject,
        [string[]]$Names
    )
    if ($null -eq $InputObject) { return $null }
    foreach ($name in $Names) {
        $property = $InputObject.PSObject.Properties[$name]
        if ($null -ne $property -and $null -ne $property.Value) {
            return [string]$property.Value
        }
    }
    return $null
}

function ConvertTo-SafeToken {
    param([AllowNull()][string]$Value)
    if ([string]::IsNullOrWhiteSpace($Value)) { return $null }
    if ($Value -match '(?i)(secret|token|key|connection|string|password|credential|authorization|cookie)') {
        return '[redacted]'
    }
    $normalized = $Value -replace '[^A-Za-z0-9_.:/@-]', '_'
    if ($normalized.Length -gt 96) { return $normalized.Substring(0, 96) }
    return $normalized
}

try {
    $repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
    $logDir = Join-Path $repoRoot 'agent_logs\hooks'
    $logFile = Join-Path $logDir 'agent-activity.log'
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null

    $rawInput = [Console]::In.ReadToEnd()
    $hookInput = $null
    if (-not [string]::IsNullOrWhiteSpace($rawInput)) {
        try {
            $hookInput = $rawInput | ConvertFrom-Json -ErrorAction Stop
        } catch {
            $hookInput = $null
        }
    }

    $fieldNames = @()
    if ($null -ne $hookInput) {
        $fieldNames = @($hookInput.PSObject.Properties.Name |
            Where-Object { $_ -notmatch '(?i)(prompt|message|content|input|secret|token|key|connection|password|credential|authorization|cookie|transcript)' } |
            Sort-Object -Unique)
    }

    $entry = [ordered]@{
        schemaVersion = 1
        timestampUtc  = (Get-Date).ToUniversalTime().ToString('o')
        event         = $Event
        repository    = (Split-Path $repoRoot -Leaf)
        sessionHash   = Get-ShortHash (Get-ObjectValue $hookInput @('session_id', 'sessionId'))
        agentName     = ConvertTo-SafeToken (Get-ObjectValue $hookInput @('agent_name', 'agentName', 'subagent_name', 'subagentName', 'name'))
        hookInputFields = $fieldNames
    }

    ($entry | ConvertTo-Json -Compress -Depth 5) | Add-Content -LiteralPath $logFile -Encoding utf8
    '{"continue":true}'
    exit 0
} catch {
    Write-Warning "agent activity hook failed: $($_.Exception.Message)"
    '{"continue":true}'
    exit 0
}