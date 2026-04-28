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
#   R4. .todayMissionPriority 等のレイアウト特殊クラスが @media 内で
#       grid-column: span 12 に上書きされている (PR 混入によるデグレ再発防止)
#   R5. @media 内の単一クラスセレクタが .X.fullWidthCard の grid-column を打ち消すパターン
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
# R4: レイアウト特殊クラスが @media 内で grid-column: span 12 に上書きされていないか
#     (デグレパターン: .todayMissionPriority は .statusCard の span 4 を継承すべき)
# R5: @media 内の単一クラスセレクタ (例: .statusCard) が、トップレベルで定義された
#     組合せクラス (.statusCard.fullWidthCard) の grid-column を意図せず打ち消すパターン
#     → @media 内では .X:not(.fullWidthCard) のように除外する必要がある
# ---------------------------------------------------------------------------
$r4Targets = @(
    @{ File = 'DashboardClient.module.css'; Class = 'todayMissionPriority' }
)
Get-ChildItem -Path $WebRoot -Filter '*.module.css' -Recurse | ForEach-Object {
    $cssFile = $_
    foreach ($t in $r4Targets) {
        if ($cssFile.Name -ne $t.File) { continue }
        $raw = Get-Content -LiteralPath $cssFile.FullName -Raw
        # @media ブロック内に .todayMissionPriority { ... grid-column ... } があるか
        $mediaBlocks = [regex]::Matches($raw, '(?s)@media[^{]+\{(?:[^{}]|\{[^{}]*\})*\}')
        foreach ($mb in $mediaBlocks) {
            $innerClass = [regex]::Matches($mb.Value, "(?s)\.$($t.Class)\s*\{([^}]*)\}")
            foreach ($ic in $innerClass) {
                if ($ic.Groups[1].Value -match 'grid-column') {
                    Add-Finding -Rule 'R4-css-media-grid-override' -Severity 'High' `
                        -File $cssFile.FullName `
                        -Detail ".$($t.Class) が @media 内で grid-column を上書きしています (デグレの原因になります)"
                }
            }
        }
    }
}

# R5: @media 内の statusCard / heatmapCard 等が fullWidthCard を打ち消すパターン
$r5SusClasses = @('statusCard', 'heatmapCard', 'historyCard', 'levelCard')
Get-ChildItem -Path $WebRoot -Filter 'DashboardClient.module.css' -Recurse | ForEach-Object {
    $cssFile = $_
    $raw = Get-Content -LiteralPath $cssFile.FullName -Raw
    $mediaBlocks = [regex]::Matches($raw, '(?s)@media[^{]+\{(?:[^{}]|\{[^{}]*\})*\}')
    foreach ($mb in $mediaBlocks) {
        foreach ($cls in $r5SusClasses) {
            # @media 内に `.X { ... grid-column ... }` が裸で書かれているかをチェック
            # (`.X:not(...)` 形式は OK)
            $bareSelector = [regex]::Matches($mb.Value, "(?s)(^|[\s,\}])\.$cls\s*\{([^}]*)\}")
            foreach ($bs in $bareSelector) {
                if ($bs.Groups[2].Value -match 'grid-column' -and
                    $raw -match "\.$cls\.fullWidthCard|\.fullWidthCard\.$cls") {
                    # トップレベルで .X.fullWidthCard が登場しているのに、@mediaで .X 単独で grid-column を定義
                    Add-Finding -Rule 'R5-css-media-fullwidth-shadow' -Severity 'High' `
                        -File $cssFile.FullName `
                        -Detail ".$cls が @media 内で grid-column を裸定義し .fullWidthCard を打ち消す可能性 (推奨: .${cls}:not(.fullWidthCard))"
                }
            }
        }
    }
}

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
Write-Host '| Severity | Rule | File | Detail |'
Write-Host '|----------|------|------|--------|'
foreach ($f in $findings) {
    $rel = $f.File.Replace($RepoRoot.Path, '').TrimStart('\', '/')
    Write-Host "| $($f.Severity) | $($f.Rule) | $rel | $($f.Detail) |"
}

Write-Host ""
Write-Host "ヒント: R1 → ensureContainer に置換 / R2 → catch 直下に console.error 追加 / R3 → CSS 宣言を @media 外に移動 / R4 → @media 内の grid-column override を削除"

if ($FailOnFinding) { exit 1 }
exit 0
