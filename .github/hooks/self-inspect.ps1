# =============================================================================
# 自己点検スクリプト (App-wide Consistency Inspector)
# =============================================================================
# 目的:
#   セッション開始/終了時にアプリ全体の "再発しがちな不整合" を機械的に検出し、
#   AI エージェントが「再調査を指示されずとも」最初から認識できるようにする。
#
# 検出ルール (過去のインシデントから蓄積):
#   R1. Cosmos リポジトリで getContainer を直接使用 (要 ensureContainer)
#       → 新環境で 500 エラー (#229 の DailyProgress 事案)
#   R2. API ルートの catch 句で console.error が無い
#       → Application Insights に流れず障害調査が困難になる (#229)
#   R3. .fullWidthCard 等の重要 CSS クラスがメディアクエリ内にしか
#       定義されていない (モバイル幅でデッドスペース発生)
#
# 引数:
#   -Mode start|end   どちらのフェーズで呼ばれたか (出力タグの違いだけ)
#   -FailOnFinding    検出時に exit 1 (CI / pre-push 用)。デフォルト警告のみ
#
# 出力:
#   標準出力に Markdown 形式のレポート。エージェントはこれを読んで初動に活かす。
# =============================================================================

[CmdletBinding()]
param(
    [ValidateSet('start', 'end')]
    [string]$Mode = 'start',
    [switch]$FailOnFinding
)

$ErrorActionPreference = 'Stop'

# このスクリプトは <repo>/.github/hooks/ にあるので、リポジトリルートは 2 つ上
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..') 
$WebRoot = Join-Path $RepoRoot 'apps\web'

if (-not (Test-Path $WebRoot)) {
    # web アプリが見つからない (浅いチェックアウト等) → サイレントに終了
    Write-Host "[self-inspect] web app not found at $WebRoot - skipped"
    exit 0
}

$findings = @()

function Add-Finding {
    param(
        [string]$Rule,
        [string]$Severity,
        [string]$File,
        [string]$Detail
    )
    $script:findings += [pscustomobject]@{
        Rule     = $Rule
        Severity = $Severity
        File     = $File
        Detail   = $Detail
    }
}

# ---------------------------------------------------------------------------
# R1: getContainer 直接使用の検出 (cosmos.ts 自身と test は除外)
# ---------------------------------------------------------------------------
$repoDir = Join-Path $WebRoot 'lib\repositories'
if (Test-Path $repoDir) {
    Get-ChildItem -Path $repoDir -Filter '*.ts' -Recurse |
        Where-Object { $_.Name -notmatch '\.test\.ts$' } |
        ForEach-Object {
            $matches = Select-String -LiteralPath $_.FullName -Pattern 'getContainer\(' -SimpleMatch
            foreach ($m in $matches) {
                Add-Finding -Rule 'R1-repo-getContainer' -Severity 'High' `
                    -File $m.Path -Detail "L$($m.LineNumber): $($m.Line.Trim())"
            }
        }
}

# ---------------------------------------------------------------------------
# R2: API ルートの catch 句で console.error 抜け
# ---------------------------------------------------------------------------
$apiDir = Join-Path $WebRoot 'app\api'
if (Test-Path $apiDir) {
    Get-ChildItem -Path $apiDir -Filter 'route.ts' -Recurse |
        ForEach-Object {
            $lines = Get-Content -LiteralPath $_.FullName
            for ($i = 0; $i -lt $lines.Count; $i++) {
                if ($lines[$i] -match '^\s*\}\s*catch\s*\(') {
                    # 直後 5 行以内に console.error / console.warn が無ければ NG
                    $window = $lines[($i)..([Math]::Min($i + 5, $lines.Count - 1))] -join "`n"
                    if ($window -notmatch 'console\.(error|warn)') {
                        Add-Finding -Rule 'R2-api-no-console-error' -Severity 'Med' `
                            -File $_.FullName -Detail "L$($i + 1): $($lines[$i].Trim())"
                    }
                }
            }
        }
}

# ---------------------------------------------------------------------------
# R3: 重要 CSS クラスがメディアクエリ内にしか定義されていない
# ---------------------------------------------------------------------------
$cssTargets = @('fullWidthCard')
Get-ChildItem -Path $WebRoot -Filter '*.module.css' -Recurse | ForEach-Object {
    $content = Get-Content -LiteralPath $_.FullName -Raw
    foreach ($cls in $cssTargets) {
        $pattern = "\.$cls\s*\{"
        $allDecl = [regex]::Matches($content, $pattern)
        if ($allDecl.Count -eq 0) { continue }

        # 各宣言の出現位置で { } のバランスを計算し、トップレベル(深度0)定義が
        # 1 つでもあれば OK。すべてが何らかのブロック内 (深度 >= 1) なら警告。
        $hasTopLevel = $false
        foreach ($m in $allDecl) {
            $before = $content.Substring(0, $m.Index)
            $opens = ([regex]::Matches($before, '\{')).Count
            $closes = ([regex]::Matches($before, '\}')).Count
            if (($opens - $closes) -eq 0) { $hasTopLevel = $true; break }
        }

        if (-not $hasTopLevel) {
            Add-Finding -Rule 'R3-css-media-only' -Severity 'Med' `
                -File $_.FullName `
                -Detail ".$cls はトップレベル(@media 外)に定義されていません (モバイル幅で適用されません)"
        }
    }
}

# ---------------------------------------------------------------------------
# レポート出力
# ---------------------------------------------------------------------------
$tag = if ($Mode -eq 'start') { 'SESSION-START' } else { 'SESSION-END' }
Write-Host ""
Write-Host "## [self-inspect $tag] 自己点検レポート"
Write-Host ""

if ($findings.Count -eq 0) {
    Write-Host "✅ 検出された不整合はありません (R1 / R2 / R3)"
    exit 0
}

Write-Host "⚠ 検出件数: $($findings.Count) 件"
Write-Host ""
Write-Host "| Severity | Rule | File | Detail |"
Write-Host "|---|---|---|---|"
foreach ($f in $findings) {
    $rel = $f.File.Replace($RepoRoot.Path, '').TrimStart('\', '/')
    Write-Host "| $($f.Severity) | $($f.Rule) | $rel | $($f.Detail) |"
}

Write-Host ""
Write-Host "ヒント: R1 → ensureContainer に置換 / R2 → catch 直下に console.error 追加 / R3 → CSS 宣言を @media 外に移動"

if ($FailOnFinding) { exit 1 }
exit 0
