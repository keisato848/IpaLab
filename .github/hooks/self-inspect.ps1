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
#   R6. 採点エラーカードが低スコア観点として「要改善」表示されるパターン
#   R7. 論述式の小問スコア表示が公式集計ではなく単純平均へ戻るパターン
#   R8. 実装変更に docs/ 配下の設計書・手順書更新が伴っていないパターン
#   R9. QuestionClient のセッション進捗保存が表示用 sessionStats に依存するパターン
#   R10. 静的問題データ由来の Mermaid CODE_BLOCK マーカーを除去しないパターン
#   R11. 問題データ同期で qNo 欠損を 99 に丸めるパターン
#   R12. tracked 設定テンプレートに実接続文字列や API キーを置くパターン
#   R13. PDF ダウンロードで HTML/XML エラーページを .pdf として保存するパターン
#   R14. Windows で npx を直接 spawn して ENOENT になるパターン
#   R15. npm run 経由の CLI 引数が npm_config_* に吸収されるパターン
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

function Invoke-GitLines {
    param([string[]]$GitArgs)

    try {
        $output = & git -C $RepoRoot.Path @GitArgs 2>$null
        if ($LASTEXITCODE -eq 0 -and $null -ne $output) {
            return @($output)
        }
    } catch {}
    return @()
}

function Get-ChangedFilesForDocSync {
    $changed = @()

    $originMain = Invoke-GitLines @('rev-parse', '--verify', 'origin/main')
    if ($originMain.Count -gt 0) {
        $mergeBase = Invoke-GitLines @('merge-base', 'HEAD', 'origin/main')
        if ($mergeBase.Count -gt 0) {
            $changed += Invoke-GitLines @('diff', '--name-only', "$($mergeBase[0])...HEAD")
        }
    } else {
        $localMain = Invoke-GitLines @('rev-parse', '--verify', 'main')
        if ($localMain.Count -gt 0) {
            $mergeBase = Invoke-GitLines @('merge-base', 'HEAD', 'main')
            if ($mergeBase.Count -gt 0) {
                $changed += Invoke-GitLines @('diff', '--name-only', "$($mergeBase[0])...HEAD")
            }
        }
    }

    $changed += Invoke-GitLines @('diff', '--name-only')
    $changed += Invoke-GitLines @('diff', '--cached', '--name-only')
    $changed += Invoke-GitLines @('ls-files', '--others', '--exclude-standard')

    return @(
        $changed |
            Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
            ForEach-Object { $_ -replace '\\', '/' } |
            Sort-Object -Unique
    )
}

function Test-IsImplementationChange {
    param([string]$Path)

    $p = $Path -replace '\\', '/'
    if ([string]::IsNullOrWhiteSpace($p)) { return $false }
    if ($p -match '^(docs|playwright-report|test-results)/') { return $false }
    if ($p -match '(^|/)(\.next|coverage|dist|node_modules)/') { return $false }
    if ($p -match '(^|/)(__tests__|e2e|evidence)/') { return $false }
    if ($p -match '\.(test|spec)\.(ts|tsx|js|jsx|mjs|cjs)$') { return $false }

    if ($p -match '^apps/.+\.(ts|tsx|js|jsx|mjs|cjs|css|scss|json)$') { return $true }
    if ($p -match '^packages/.+\.(ts|tsx|js|jsx|mjs|cjs|css|scss|json)$') { return $true }
    if ($p -match '^\.github/(hooks|workflows)/.+\.(ps1|ya?ml)$') { return $true }
    if ($p -match '^\.husky/.+') { return $true }
    if ($p -match '^(package\.json|package-lock\.json|staticwebapp\.config\.json|playwright\.config\.ts)$') { return $true }
    if ($p -match '(^|/)next\.config\.(js|mjs|ts)$') { return $true }

    return $false
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

# ---------------------------------------------------------------------------
# R6: PerspectiveCard のエラー表示を弱点観点として扱っていないか
#     (error 用 data.score=0 により「要改善」バッジが出るデグレを防ぐ)
# R7: EssayScoringClient の小問スコア表示が公式集計ではなく単純平均に戻っていないか
#     (`sub_question_complete` / `complete.subQuestionScores` を優先する必要がある)
# ---------------------------------------------------------------------------
$perspectiveCard = Join-Path $WebRoot 'components\features\scoring\PerspectiveCard.tsx'
if (Test-Path $perspectiveCard) {
    $raw = Get-Content -LiteralPath $perspectiveCard -Raw
    if ($raw -match 'const\s+lowScore\s*=\s*data\.score\s*<\s*60') {
        Add-Finding -Rule 'R6-scoring-error-card-weakness' -Severity 'Med' `
            -File $perspectiveCard `
            -Detail 'error カードも data.score=0 で要改善扱いになります (推奨: !error && data.score < 60)'
    }
}

$essayClient = Join-Path $WebRoot 'components\features\scoring\EssayScoringClient.tsx'
if (Test-Path $essayClient) {
    $raw = Get-Content -LiteralPath $essayClient -Raw
    if ($raw -match '平均スコア') {
        Add-Finding -Rule 'R7-scoring-subscore-average' -Severity 'Med' `
            -File $essayClient `
            -Detail '論述式の小問スコアが単純平均表示に戻っている可能性があります (推奨: sub_question_complete / complete.subQuestionScores を優先)'
    }
}

# ---------------------------------------------------------------------------
# R8: 実装変更に docs/ 配下の設計書・手順書更新が伴っているか
#     document-agent が該当設計書を更新する運用を機械的に促す
# ---------------------------------------------------------------------------
$changedFiles = Get-ChangedFilesForDocSync
$implementationChanges = @($changedFiles | Where-Object { Test-IsImplementationChange $_ })
$docsChanges = @($changedFiles | Where-Object { ($_ -replace '\\', '/') -match '^docs/' })
if ($implementationChanges.Count -gt 0 -and $docsChanges.Count -eq 0) {
    $sample = ($implementationChanges | Select-Object -First 5) -join ', '
    Add-Finding -Rule 'R8-doc-sync-required' -Severity 'High' `
        -File (Join-Path $RepoRoot 'docs') `
        -Detail "実装変更に対応する docs/ 配下の更新がありません。document-agent が該当する設計書・手順書を更新してください。対象例: $sample"
}

# ---------------------------------------------------------------------------
# R9: セッション進捗保存が表示用の当日集計に依存していないか
#     (`sessionStats` は画面上の「今回」表示用。LearningSession の保存は
#      現在の sessionId に閉じた `currentSessionStats` を使う)
# ---------------------------------------------------------------------------
$questionClient = Join-Path $WebRoot 'components\features\exam\QuestionClient.tsx'
if (Test-Path $questionClient) {
    $raw = Get-Content -LiteralPath $questionClient -Raw
    if ($raw -match 'answeredCount:\s*sessionStats\.total' -or
        $raw -match 'correctCount:\s*sessionStats\.correct' -or
        $raw -match 'const\s+newTotal\s*=\s*sessionStats\.total\s*\+\s*1' -or
        $raw -match 'const\s+newCorrect\s*=\s*sessionStats\.correct\s*\+') {
        Add-Finding -Rule 'R9-session-progress-display-stats' -Severity 'High' `
            -File $questionClient `
            -Detail 'LearningSession の answeredCount/correctCount 保存が表示用 sessionStats に依存しています (推奨: currentSessionStats を使用)'
    }
}

# ---------------------------------------------------------------------------
# R10: 静的問題データ由来の Mermaid CODE_BLOCK マーカーを除去しているか
#      (`[CODE_BLOCK:mermaid]` が Mermaid コンポーネントへ渡ると描画に失敗する)
# ---------------------------------------------------------------------------
$mermaidSanitize = Join-Path $WebRoot 'lib\mermaid\sanitize.ts'
if (Test-Path $mermaidSanitize) {
    $raw = Get-Content -LiteralPath $mermaidSanitize -Raw
    if ($raw -notmatch 'CODE_BLOCK:mermaid' -or $raw -notmatch '/CODE_BLOCK') {
        Add-Finding -Rule 'R10-mermaid-codeblock-marker' -Severity 'High' `
            -File $mermaidSanitize `
            -Detail '静的問題データの [CODE_BLOCK:mermaid] / [/CODE_BLOCK] を除去できず、Mermaid 描画失敗が再発する可能性があります'
    }
}

# ---------------------------------------------------------------------------
# R11: sync-db.ts が qNo 欠損を 99 に丸めていないか
#      (Cosmos に qNo=99 の午後問題が残ると、対象 qNo が見つからず FS fallback も発動しない)
# ---------------------------------------------------------------------------
$syncDbScript = Join-Path $RepoRoot 'packages\data\src\scripts\sync-db.ts'
if (Test-Path $syncDbScript) {
    $raw = Get-Content -LiteralPath $syncDbScript -Raw
    $badPatterns = @(
        'qNo\s*\|\|\s*99',
        'parentQNo\s*=\s*99',
        'resolvedQNo\s*=\s*[^;]*\|\|\s*99'
    )

    foreach ($pattern in $badPatterns) {
        if ($raw -match $pattern) {
            Add-Finding -Rule 'R11-sync-db-qno-99-fallback' -Severity 'High' `
                -File $syncDbScript `
                -Detail 'sync-db.ts が qNo 欠損を 99 に丸める可能性があります (推奨: qNo を正規化し、欠損時は同期を失敗させる)'
            break
        }
    }
}

# ---------------------------------------------------------------------------
# R12: tracked local settings / env templates に実値が入っていないか
#      (値はレポートに出さず、ファイルと種類だけを示す)
# ---------------------------------------------------------------------------
$trackedConfigPatterns = @(
    'apps/*/local.settings.json',
    'apps/*/.env.template',
    'packages/*/.env.template'
)

$trackedConfigFiles = @()
foreach ($pattern in $trackedConfigPatterns) {
    $trackedConfigFiles += Invoke-GitLines @('ls-files', $pattern)
}

foreach ($relativePath in ($trackedConfigFiles | Sort-Object -Unique)) {
    $fullPath = Join-Path $RepoRoot $relativePath
    if (-not (Test-Path $fullPath)) { continue }

    $content = Get-Content -LiteralPath $fullPath -Raw
    if ($content -match 'AccountKey=(?!<|\$\{|abc123==|"|''|;|\s|$)[^;"''\s]+') {
        Add-Finding -Rule 'R12-tracked-secret-material' -Severity 'High' `
            -File $fullPath `
            -Detail 'tracked 設定ファイルに Cosmos/Storage 接続文字列の AccountKey 実値が含まれている可能性があります (値は表示しません)'
    }
    if ($content -match 'AIza[0-9A-Za-z_-]{20,}') {
        Add-Finding -Rule 'R12-tracked-secret-material' -Severity 'High' `
            -File $fullPath `
            -Detail 'tracked 設定ファイルに Google API キー形式の実値が含まれている可能性があります (値は表示しません)'
    }
    if ($content -match 'BEGIN (RSA|OPENSSH|PRIVATE) KEY') {
        Add-Finding -Rule 'R12-tracked-secret-material' -Severity 'High' `
            -File $fullPath `
            -Detail 'tracked 設定ファイルに秘密鍵ヘッダーが含まれている可能性があります (値は表示しません)'
    }
}

# ---------------------------------------------------------------------------
# R13: download.ts が非 PDF レスポンスを検証せず保存していないか
#      (HTML/XML エラーページが raw_pdfs/*.pdf として残ると OCR が no pages で失敗する)
# ---------------------------------------------------------------------------
$downloadScript = Join-Path $RepoRoot 'packages\data\src\scraper\download.ts'
if (Test-Path $downloadScript) {
    $raw = Get-Content -LiteralPath $downloadScript -Raw
    $hasPdfValidation = ($raw -match 'validatePdfProbe' -and $raw -match 'content-type' -and $raw -match '%PDF-')
    $writesResponseDirectly = ($raw -match 'writeFile\(\s*filePath\s*,\s*response\.data\s*\)' -or $raw -match 'writeFile\(\s*answerFilePath\s*,\s*response\.data\s*\)')

    if (-not $hasPdfValidation -or $writesResponseDirectly) {
        Add-Finding -Rule 'R13-download-non-pdf-save' -Severity 'High' `
            -File $downloadScript `
            -Detail 'download.ts が HTML/XML や PDF ヘッダー欠落を検証せず raw_pdfs に保存する可能性があります (推奨: content-type と %PDF- ヘッダーを確認し、壊れた既存ファイルは再取得する)'
    }
}

# ---------------------------------------------------------------------------
# R14: Node child_process で npx を直接 spawn/execFile していないか
#      (Windows では npx.cmd 解決に失敗して spawnSync npx ENOENT になる)
# ---------------------------------------------------------------------------
$runExtractScript = Join-Path $RepoRoot 'packages\data\src\scripts\run-extract.ts'
if (Test-Path $runExtractScript) {
    $raw = Get-Content -LiteralPath $runExtractScript -Raw
    $spawnsNpxWithSingleQuote = $raw -match "(execFileSync|spawnSync)\(\s*'npx'"
    $spawnsNpxWithDoubleQuote = $raw -match '(execFileSync|spawnSync)\(\s*"npx"'
    if ($spawnsNpxWithSingleQuote -or $spawnsNpxWithDoubleQuote) {
        Add-Finding -Rule 'R14-node-npx-spawn-windows' -Severity 'High' `
            -File $runExtractScript `
            -Detail 'run-extract.ts が npx を直接 spawn しており、Windows で ENOENT になる可能性があります (推奨: process.execPath + --require ts-node/register)'
    }
}

# ---------------------------------------------------------------------------
# R15: npm run 経由で dry-run 等の CLI 引数が npm_config_* に吸収されても動くか
#      (Windows/npm では --dry-run などが argv に届かず設定として扱われる場合がある)
# ---------------------------------------------------------------------------
$ollamaAnswerScript = Join-Path $RepoRoot 'packages\data\src\scripts\ollama-extract-answers.ts'
$dataPackageJson = Join-Path $RepoRoot 'packages\data\package.json'
if ((Test-Path $ollamaAnswerScript) -and (Test-Path $dataPackageJson)) {
    $scriptRaw = Get-Content -LiteralPath $ollamaAnswerScript -Raw
    $packageRaw = Get-Content -LiteralPath $dataPackageJson -Raw
    $readsNpmConfigArgs = ($scriptRaw -match 'npm_config_dry_run' -and $scriptRaw -match 'npm_config_limit' -and $scriptRaw -match 'npm_config_categories')
    $usesNodeRegister = $packageRaw -match '"extract:answers:ollama"\s*:\s*"node --require ts-node/register src/scripts/ollama-extract-answers.ts"'

    if (-not $readsNpmConfigArgs -or -not $usesNodeRegister) {
        Add-Finding -Rule 'R15-npm-script-args-windows' -Severity 'Medium' `
            -File $ollamaAnswerScript `
            -Detail 'Ollama 抽出 script が npm run 経由の --dry-run/--limit/--categories を npm_config_* から読めない、または ts-node CLI 直起動に戻っている可能性があります'
    }
}

$tag = if ($Mode -eq 'start') { 'SESSION-START' } else { 'SESSION-END' }
Write-Host ""
Write-Host "## [self-inspect $tag] 自己点検レポート"
Write-Host ""

if ($findings.Count -eq 0) {
    Write-Host "✅ 検出された不整合はありません (R1 / R2 / R3 / R4 / R5 / R6 / R7 / R8 / R9 / R10 / R11 / R12 / R13 / R14 / R15)"
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
Write-Host "ヒント: R1 → ensureContainer に置換 / R2 → catch 直下に console.error 追加 / R3 → CSS 宣言を @media 外に移動 / R4 → @media 内の grid-column override を削除 / R6 → error を弱点判定から除外 / R7 → 公式小問スコアを優先 / R8 → document-agent が docs/ を更新 / R9 → セッション進捗保存は currentSessionStats を使用 / R10 → Mermaid CODE_BLOCK マーカーを sanitizeMermaid で除去 / R11 → qNo 欠損を 99 にせず同期失敗として扱う / R12 → tracked 設定から接続文字列・API キー実値を除去 / R13 → download.ts で content-type と %PDF- ヘッダーを検証し、壊れた既存 PDF は再取得する / R14 → npx 直接 spawn ではなく process.execPath + ts-node/register を使う / R15 → npm_config_* と node --require ts-node/register で npm run 引数を安定化する"

if ($FailOnFinding) { exit 1 }
exit 0
