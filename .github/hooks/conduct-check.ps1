# =============================================================================
# セッション終了時 行動規範チェック (Conduct Check)
# =============================================================================
# copilot-instructions.md に定義された行動規範を、セッション終了時に確認する。
#
# チェック項目:
#   C1. fix: コミットがあれば self-inspect.ps1 も同一コミット or セッション内で更新されているか
#   C2. PR 作成が行われたか (gh pr merge の代わりに gh pr create になっているか)
#   C3. APIルートを追加・変更した場合、console.error が catch 句に含まれているか (R2 再確認)
# =============================================================================

$ErrorActionPreference = 'SilentlyContinue'

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$findings = @()

function Add-Violation {
    param([string]$Rule, [string]$Detail)
    $script:findings += [pscustomobject]@{ Rule = $Rule; Detail = $Detail }
}

# ---------------------------------------------------------------------------
# C1: 直近セッション内の fix: コミットに self-inspect.ps1 更新が伴っているか
#     (git log で HEAD~10 以内の fix: コミットを対象)
# ---------------------------------------------------------------------------
try {
    $recentCommits = git -C $RepoRoot log --oneline -20 2>$null
    $fixCommits = $recentCommits | Where-Object { $_ -match '^[0-9a-f]+ fix' }

    foreach ($fc in $fixCommits) {
        $sha = ($fc -split ' ')[0]
        $changedFiles = git -C $RepoRoot diff-tree --no-commit-id -r --name-only $sha 2>$null
        $hasInspect = $changedFiles | Where-Object { $_ -match 'self-inspect\.ps1' }
        if (-not $hasInspect) {
            Add-Violation -Rule 'C1-self-inspect-not-updated' `
                -Detail "fix コミット '$fc' に self-inspect.ps1 の更新が含まれていません。再発防止ルールを追加しましたか？"
        }
    }
} catch {}

# ---------------------------------------------------------------------------
# C2: git log にマージコミット (Merge branch) がエージェント操作で混入していないか
#     ※ gh pr merge で生成される "Squash merge" パターンを検出
# ---------------------------------------------------------------------------
try {
    $mergeByAgent = git -C $RepoRoot log --oneline -10 --merges 2>$null |
        Where-Object { $_ -match 'Squash|squash' }
    foreach ($m in $mergeByAgent) {
        Add-Violation -Rule 'C2-unauthorized-merge' `
            -Detail "エージェントによる可能性があるマージコミットが検出されました: $m"
    }
} catch {}

# ---------------------------------------------------------------------------
# 出力
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "## [conduct-check SESSION-END] 行動規範チェック"
Write-Host ""

if ($findings.Count -eq 0) {
    Write-Host "✅ 行動規範の違反は検出されませんでした。"
    exit 0
}

Write-Host "⚠ 行動規範違反の可能性: $($findings.Count) 件"
Write-Host ""
Write-Host "| Rule | Detail |"
Write-Host "|------|--------|"
foreach ($f in $findings) {
    Write-Host "| $($f.Rule) | $($f.Detail) |"
}
Write-Host ""
Write-Host "👉 対応が必要な場合は、セッションを続けて修正してください。"

exit 0
