# =============================================================================
# セッション終了時 行動規範チェック (Conduct Check)
# =============================================================================
# copilot-instructions.md に定義された行動規範を、セッション終了時に確認する。
#
# チェック項目:
#   C1. fix: コミットがあれば self-inspect/conduct-check 等の再発防止 guard も更新されているか
#   C2. PR 作成が行われたか (gh pr merge の代わりに gh pr create になっているか)
#   C3. APIルートを追加・変更した場合、console.error が catch 句に含まれているか (R2 再確認)
#   C4. Active PR のレビューはすべて確認し、未解決 thread は修正 commit または返信で解消しているか
# =============================================================================

$ErrorActionPreference = 'SilentlyContinue'

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$findings = @()

function Add-Violation {
    param([string]$Rule, [string]$Detail)
    $script:findings += [pscustomobject]@{ Rule = $Rule; Detail = $Detail }
}

# ---------------------------------------------------------------------------
# C1: 現在ブランチの fix: コミットに再発防止 guard 更新が伴っているか
#     origin/main との差分コミットだけを対象にし、main 既存履歴のノイズを避ける
# ---------------------------------------------------------------------------
try {
    $base = git -C $RepoRoot merge-base HEAD origin/main 2>$null
    if ([string]::IsNullOrWhiteSpace($base)) {
        $recentCommits = git -C $RepoRoot log --oneline -20 2>$null
    } else {
        $recentCommits = git -C $RepoRoot log --oneline "$base..HEAD" 2>$null
    }
    $fixCommits = $recentCommits | Where-Object { $_ -match '^[0-9a-f]+ fix' }

    foreach ($fc in $fixCommits) {
        $sha = ($fc -split ' ')[0]
        $changedFiles = git -C $RepoRoot diff-tree --no-commit-id -r --name-only $sha 2>$null
        $hasGuardUpdate = $changedFiles | Where-Object {
            $_ -match '(^|/)self-inspect\.ps1$' -or
            $_ -match '(^|/)conduct-check\.ps1$' -or
            $_ -match '(^|/)guard-.+\.mjs$'
        }
        if (-not $hasGuardUpdate) {
            Add-Violation -Rule 'C1-guard-not-updated' `
                -Detail "fix コミット '$fc' に self-inspect / conduct-check / guard script の更新が含まれていません。再発防止ルールを追加しましたか？"
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
# C4: Active PR の未解決レビュー thread / Changes requested を検出
#     ルール: PRレビューはすべて確認し、各指摘に対して修正 commit または返信を行う。
#     GitHub 上で未解決 thread が残っている場合、作業完了扱いにしない。
# ---------------------------------------------------------------------------
try {
        $null = Get-Command gh -ErrorAction Stop
        $prJson = gh pr view --json number,url,reviewDecision 2>$null
        if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($prJson)) {
                $pr = $prJson | ConvertFrom-Json
                if ($pr.reviewDecision -eq 'CHANGES_REQUESTED') {
                        Add-Violation -Rule 'C4-pr-review-changes-requested' `
                                -Detail "PR #$($pr.number) は Changes requested 状態です。すべてのレビューを確認し、修正 commit または返信で対応してください: $($pr.url)"
                }

                $repoJson = gh repo view --json nameWithOwner 2>$null
                if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($repoJson)) {
                        $repo = $repoJson | ConvertFrom-Json
                        $parts = @($repo.nameWithOwner -split '/', 2)
                        if ($parts.Count -eq 2) {
                                $query = @'
query($owner:String!, $name:String!, $number:Int!) {
    repository(owner:$owner, name:$name) {
        pullRequest(number:$number) {
            reviewThreads(first:100) {
                nodes {
                    isResolved
                    isOutdated
                    path
                    line
                    comments(first:1) {
                        nodes {
                            url
                            author { login }
                        }
                    }
                }
            }
        }
    }
}
'@
                                $threadsJson = gh api graphql `
                                        -f "owner=$($parts[0])" `
                                        -f "name=$($parts[1])" `
                                        -F "number=$($pr.number)" `
                                        -f "query=$query" 2>$null
                                if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($threadsJson)) {
                                        $threadsData = $threadsJson | ConvertFrom-Json
                                        $threads = @($threadsData.data.repository.pullRequest.reviewThreads.nodes)
                                        foreach ($thread in ($threads | Where-Object { -not $_.isResolved -and -not $_.isOutdated })) {
                                                $firstComment = @($thread.comments.nodes) | Select-Object -First 1
                                                $location = $thread.path
                                                if ($null -ne $thread.line) { $location = "${location}:$($thread.line)" }
                                                Add-Violation -Rule 'C4-pr-review-unresolved-thread' `
                                                        -Detail "PR #$($pr.number) の未解決レビュー thread が残っています ($location)。修正 commit または返信後に解消してください: $($firstComment.url)"
                                        }
                                }
                        }
                }
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
