# =============================================================================
# PreToolUse フック: gh pr merge 禁止ポリシー
# =============================================================================
# エージェントが gh pr merge を含むコマンドを実行しようとしたときに
# permissionDecision: "deny" を返してブロックする。
#
# マージはユーザーが GitHub UI または CLI で明示的に承認してから行う。
# =============================================================================

$ErrorActionPreference = 'Stop'

# stdin から JSON を読み取る
$inputJson = $input | Out-String
if ([string]::IsNullOrWhiteSpace($inputJson)) {
    # 入力がない場合はスルー
    exit 0
}

try {
    $payload = $inputJson | ConvertFrom-Json
} catch {
    exit 0
}

# シェル実行系ツール名のリスト (VS Code Copilot エージェントが使用するもの)
# 公式エイリアス 'execute' と旧名称両方を包拵する
$shellTools = @('execute', 'runCommands', 'executePowerShell', 'executeCommand', 'powershell', 'bash', 'sh', 'terminal')

$toolName = $payload.tool_name
if ($toolName -notin $shellTools) {
    exit 0
}

# tool_input からコマンド文字列を抽出
$toolInput = $payload.tool_input
$commandText = ''
if ($toolInput -is [string]) {
    $commandText = $toolInput
} elseif ($null -ne $toolInput.command) {
    $commandText = $toolInput.command
} elseif ($null -ne $toolInput.commands) {
    $commandText = ($toolInput.commands | ForEach-Object { if ($_ -is [string]) { $_ } else { $_.command } }) -join ' '
}

# gh pr merge が含まれているか検査
if ($commandText -match 'gh\s+pr\s+merge') {
    $result = @{
        hookSpecificOutput = @{
            hookEventName          = 'PreToolUse'
            permissionDecision     = 'deny'
            permissionDecisionReason = '🚫 gh pr merge はエージェントに禁止されています。マージはユーザーが GitHub UI または CLI で承認してから実施してください。'
        }
    }
    $result | ConvertTo-Json -Depth 5
    exit 0
}

exit 0
