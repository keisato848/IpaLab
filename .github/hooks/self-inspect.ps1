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
#   R16. AM/AM2 問題データ差分で answers/questions の qNo・正答・選択肢が不整合なパターン
#   R17. PM/PM1/PM2 問題データ差分で questions_transformed.json が欠落し、解答欄が生成されないパターン
#   R18. Mermaid 図表データ差分でブラウザ描画に失敗しやすいリンクラベル・節点表記を含むパターン
#   R19. 新形式午後画面で Tailwind 風の未適用クラスへ戻り、ヘッダー/終了ボタンのスタイルが欠落するパターン
#   R20. AIAnswerBox から午後答案の下書き保存・文字数制限が消えるパターン
#   R21. SCPMExamView の総合スコアが 100 点満点ではなく小問合計点表示へ戻るパターン
#   R22. SCPMExamView が subQuestions 以外の午後データ形を解答欄化できなくなるパターン
#   R23. Mermaid サニタイズが日本語 ER 図・日本語 subgraph を扱えなくなるパターン
#   R24. GitHub Actions のデプロイジョブが gh run download に戻り、checkout 不在で artifact 取得に失敗するパターン
#   R25. 新形式午後画面の解答例解説が ReactMarkdown を通らず、Markdown 記法が素のテキスト表示へ戻るパターン
#   R26. 新形式午後画面の解答例ラベルがダークテーマで低コントラストな赤茶文字へ戻るパターン
#   R27. 午後試験の親見出しが余分な800字欄になり、全区分監査が欠落するパターン
#   R28. 午後問題の qNo 不一致を位置番号で誤解決するパターン
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

# ---------------------------------------------------------------------------
# R16: 変更対象の AM/AM2 questions_raw.json が answers_raw.json と整合しているか
#      (Ollama OCR の過少抽出や正答マップ更新漏れで qNo 欠番・correctOption 不一致が残る)
# ---------------------------------------------------------------------------
$changedMorningExamIds = @(
    $changedFiles |
        ForEach-Object {
            $p = $_ -replace '\\', '/'
            if ($p -match '^packages/data/data/questions/([^/]+-AM2?)/(answers_raw|questions_raw)\.json$') {
                $Matches[1]
            }
        } |
        Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
        Sort-Object -Unique
)

foreach ($examId in $changedMorningExamIds) {
    $answersPath = Join-Path $RepoRoot "packages\data\data\questions\$examId\answers_raw.json"
    $questionsPath = Join-Path $RepoRoot "packages\data\data\questions\$examId\questions_raw.json"
    if (-not ((Test-Path $answersPath) -and (Test-Path $questionsPath))) { continue }

    try {
        $answers = Get-Content -LiteralPath $answersPath -Raw | ConvertFrom-Json
        $questionsRaw = Get-Content -LiteralPath $questionsPath -Raw | ConvertFrom-Json
        $questions = @()
        if ($questionsRaw -is [array]) {
            $questions = @($questionsRaw)
        } elseif ($null -ne $questionsRaw.PSObject.Properties['questions']) {
            $questions = @($questionsRaw.questions)
        } elseif ($null -ne $questionsRaw) {
            $questions = @($questionsRaw)
        }

        $answerMap = @{}
        $answerItems = $null
        if ($answers -is [array]) {
            $answerItems = @($answers)
        } elseif ($null -ne $answers.PSObject.Properties['answers']) {
            $answerItems = @($answers.answers)
        }

        if ($null -ne $answerItems) {
            foreach ($answer in $answerItems) {
                $answerQNo = $null
                if ($null -ne $answer.PSObject.Properties['qNo']) { $answerQNo = [string]$answer.qNo }
                elseif ($null -ne $answer.PSObject.Properties['questionNo']) { $answerQNo = [string]$answer.questionNo }

                $answerValue = $null
                if ($null -ne $answer.PSObject.Properties['correctOption']) { $answerValue = [string]$answer.correctOption }
                elseif ($null -ne $answer.PSObject.Properties['correct']) { $answerValue = [string]$answer.correct }
                elseif ($null -ne $answer.PSObject.Properties['answer']) { $answerValue = [string]$answer.answer }

                if ($answerQNo -match '^\d+$' -and -not [string]::IsNullOrWhiteSpace($answerValue)) {
                    $answerMap[$answerQNo] = $answerValue
                }
            }
        } else {
            foreach ($prop in $answers.PSObject.Properties) {
                if ($prop.Name -match '^\d+$') {
                    $answerMap[$prop.Name] = [string]$prop.Value
                }
            }
        }

        $questionMap = @{}
        $badOptions = @()
        $missingAnswers = @()
        $mismatches = @()
        foreach ($q in $questions) {
            $qNo = [string]$q.qNo
            if ([string]::IsNullOrWhiteSpace($qNo)) { continue }
            $questionMap[$qNo] = $true

            $options = @($q.options)
            $expectedIds = @('a', 'b', 'c', 'd')
            $hasBadOptions = $options.Count -ne 4
            if (-not $hasBadOptions) {
                for ($i = 0; $i -lt 4; $i++) {
                    if ([string]$options[$i].id -ne $expectedIds[$i] -or [string]::IsNullOrWhiteSpace([string]$options[$i].text)) {
                        $hasBadOptions = $true
                        break
                    }
                }
            }
            if ($hasBadOptions) { $badOptions += $qNo }

            if (-not $answerMap.ContainsKey($qNo)) {
                $missingAnswers += $qNo
            } elseif ([string]$q.correctOption -ne $answerMap[$qNo]) {
                $mismatches += "${qNo}:$($q.correctOption)->$($answerMap[$qNo])"
            }
        }

        $missingQuestions = @(
            $answerMap.Keys |
                Where-Object { -not $questionMap.ContainsKey([string]$_) } |
                Sort-Object { [int]$_ }
        )

        if ($missingQuestions.Count -gt 0 -or $missingAnswers.Count -gt 0 -or $badOptions.Count -gt 0 -or $mismatches.Count -gt 0) {
            $details = @()
            if ($missingQuestions.Count -gt 0) { $details += "missing qNo: $(($missingQuestions | Select-Object -First 10) -join ', ')" }
            if ($missingAnswers.Count -gt 0) { $details += "missing answers: $(($missingAnswers | Select-Object -First 10) -join ', ')" }
            if ($badOptions.Count -gt 0) { $details += "bad options: $(($badOptions | Select-Object -First 10) -join ', ')" }
            if ($mismatches.Count -gt 0) { $details += "correctOption mismatch: $(($mismatches | Select-Object -First 10) -join ', ')" }
            Add-Finding -Rule 'R16-morning-data-answer-sync' -Severity 'High' `
                -File $questionsPath `
                -Detail ($details -join ' / ')
        }
    } catch {
        Add-Finding -Rule 'R16-morning-data-answer-sync' -Severity 'High' `
            -File $questionsPath `
            -Detail "AM/AM2 問題データの JSON 解析または正答照合に失敗しました: $($_.Exception.Message)"
    }
}

# ---------------------------------------------------------------------------
# R17: 変更対象の PM/PM1/PM2 データが transformed と解答欄を持つか
#      (raw 配列の questions[] だけでは QuestionClient/SCPMExamView の入力欄が生成されない)
# ---------------------------------------------------------------------------
$changedAfternoonExamIds = @(
    $changedFiles |
        ForEach-Object {
            $p = $_ -replace '\\', '/'
            if ($p -match '^packages/data/data/questions/([^/]+-PM\d?)/(answers_raw|questions_raw|questions_transformed)\.json$') {
                $Matches[1]
            }
        } |
        Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
        Sort-Object -Unique
)

foreach ($examId in $changedAfternoonExamIds) {
    $examDir = Join-Path $RepoRoot "packages\data\data\questions\$examId"
    $transformedPath = Join-Path $examDir 'questions_transformed.json'

    if (-not (Test-Path $transformedPath)) {
        Add-Finding -Rule 'R17-afternoon-transformed-answer-fields' -Severity 'High' `
            -File $examDir `
            -Detail 'PM/PM1/PM2 データに questions_transformed.json がなく、午後解答欄が生成されない可能性があります'
        continue
    }

    try {
        $data = Get-Content -LiteralPath $transformedPath -Raw | ConvertFrom-Json
        $items = @($data)
        $mainCount = $items.Count
        $sectionCount = 0
        $answerFieldCount = 0
        $emptySections = @()

        foreach ($item in $items) {
            $sections = @($item.questions)
            $sectionCount += $sections.Count
            foreach ($section in $sections) {
                $fields = @($section.subQuestions)
                $answerFieldCount += $fields.Count
                if ($fields.Count -eq 0) {
                    $emptySections += "$($item.qNo):$($section.subQNo)"
                }
            }
        }

        if ($mainCount -eq 0 -or $sectionCount -eq 0 -or $answerFieldCount -eq 0 -or $emptySections.Count -gt 0) {
            $details = @("main=$mainCount", "sections=$sectionCount", "answerFields=$answerFieldCount")
            if ($emptySections.Count -gt 0) { $details += "empty sections: $(($emptySections | Select-Object -First 10) -join ', ')" }
            Add-Finding -Rule 'R17-afternoon-transformed-answer-fields' -Severity 'High' `
                -File $transformedPath `
                -Detail ($details -join ' / ')
        }
    } catch {
        Add-Finding -Rule 'R17-afternoon-transformed-answer-fields' -Severity 'High' `
            -File $transformedPath `
            -Detail "PM/PM1/PM2 transformed データの JSON 解析または解答欄照合に失敗しました: $($_.Exception.Message)"
    }
}

# ---------------------------------------------------------------------------
# R18: 変更対象の問題データに Mermaid の既知描画失敗パターンが残っていないか
#      (ハイフン入りリンクラベルやエッジ上の節点定義はブラウザ描画で構文エラーになりやすい)
# ---------------------------------------------------------------------------
$changedQuestionDataFiles = @(
    $changedFiles |
        ForEach-Object { $_ -replace '\\', '/' } |
        Where-Object { $_ -match '^packages/data/data/questions/.+\.json$' } |
        Sort-Object -Unique
)

foreach ($relPath in $changedQuestionDataFiles) {
    $fullPath = Join-Path $RepoRoot ($relPath -replace '/', '\')
    if (-not (Test-Path $fullPath)) { continue }

    $raw = Get-Content -LiteralPath $fullPath -Raw
    $badPatterns = @()
    if ($raw -match '(?<!-)--(?![-|>])\s+[A-Za-z0-9]+-[A-Za-z0-9]+\s+(?<!-)--(?![-|>])') {
        $badPatterns += 'hyphenated edge label should use -->|label| or ---|label|'
    }
    if ($raw -match '(?<!-)--(?![-|>])\s+[A-Za-z0-9_]+\(\(') {
        $badPatterns += 'node definition appears inside an edge label'
    }
    if ($raw -match '[A-Za-z0-9_]+\(\([^"\\\)]*[^\x00-\x7F][^"\\\)]*\)\)') {
        $badPatterns += 'non-ASCII circle node label should be quoted'
    }

    if ($badPatterns.Count -gt 0) {
        Add-Finding -Rule 'R18-mermaid-data-render-syntax' -Severity 'Medium' `
            -File $fullPath `
            -Detail (($badPatterns | Sort-Object -Unique) -join ' / ')
    }
}

# ---------------------------------------------------------------------------
# R19: 新形式午後画面で Tailwind 風の未適用クラスへ戻っていないか
#      (CSS Modules ベースでないと「終了して一覧へ」ボタンやヘッダー背景が未適用になる)
# ---------------------------------------------------------------------------
if (Test-Path $questionClient) {
    $raw = Get-Content -LiteralPath $questionClient -Raw
    $badPmShellPatterns = @(
        'className="flex flex-col h-screen overflow-hidden bg-background"',
        'className="flex-none h-16 border-b px-4 flex items-center justify-between bg-card text-foreground"',
        'className="text-sm px-4 py-2 rounded-md font-medium border'
    )

    foreach ($pattern in $badPmShellPatterns) {
        if ($raw -match [regex]::Escape($pattern)) {
            Add-Finding -Rule 'R19-pm-shell-unscoped-utility-classes' -Severity 'High' `
                -File $questionClient `
                -Detail '新形式午後画面のヘッダー/終了ボタンが Tailwind 風の未適用クラスへ戻っています (推奨: QuestionClient.module.css の pmExamShell / pmExitButton を使用)'
            break
        }
    }
}

# ---------------------------------------------------------------------------
# R20: 午後答案の下書き保存・文字数制限が AIAnswerBox から消えていないか
#      (午後試験は採点前に長文回答を中断・復元できる必要がある)
# ---------------------------------------------------------------------------
$aiAnswerBox = Join-Path $WebRoot 'components\features\exam\AIAnswerBox.tsx'
if (Test-Path $aiAnswerBox) {
    $raw = Get-Content -LiteralPath $aiAnswerBox -Raw
    if ($raw -notmatch 'draftKey' -or
        $raw -notmatch 'localStorage\.setItem\(draftKey' -or
        $raw -notmatch 'isOverLimit' -or
        $raw -notmatch '文字数制限を超えています') {
        Add-Finding -Rule 'R20-pm-draft-and-limit-missing' -Severity 'High' `
            -File $aiAnswerBox `
            -Detail 'AIAnswerBox の午後答案下書き保存または文字数制限表示が欠落しています (推奨: draftKey + localStorage + isOverLimit を維持)'
    }
}

# ---------------------------------------------------------------------------
# R21: SCPMExamView の総合スコアが小問合計点表示へ戻っていないか
#      (例: 300/300 は利用者に意味が伝わらないため、回答済み小問の平均を /100 で表示する)
# ---------------------------------------------------------------------------
$scpmExamView = Join-Path $WebRoot 'components\features\exam\SCPMExamView.tsx'
if (Test-Path $scpmExamView) {
    $raw = Get-Content -LiteralPath $scpmExamView -Raw
    if ($raw -match 'questions\s*\?\s*questions\.length\s*\*\s*100' -or
        $raw -match 'scoreMax[^\n]+questions\.length\s*\*\s*100' -or
        $raw -notmatch 'aria-label="総合スコア 100点満点"' -or
        $raw -notmatch 'answerFieldCount' -or
        $raw -match '全\{questions\?\.length \|\| 0\}問' -or
        $raw -notmatch 'Math\.round\(totalScore / answeredScoreCount\)') {
        Add-Finding -Rule 'R21-pm-overall-score-100-scale' -Severity 'High' `
            -File $scpmExamView `
            -Detail 'SCPMExamView の総合スコアまたは設問数表示が逸脱しています (推奨: answeredScoreCount 平均 + /100、解答欄数表示)'
    }
}

# ---------------------------------------------------------------------------
# R22: 新形式午後画面が subQuestions 以外の既存データ形を解答欄化できるか
#      (section.answer / section.questions / subQuestions 空配列の午後データで textarea 欠落を再発させない)
# ---------------------------------------------------------------------------
if (Test-Path $scpmExamView) {
    $raw = Get-Content -LiteralPath $scpmExamView -Raw
    $utilsRaw = ''
    $pmAnswerUtilsForR22 = Join-Path $WebRoot 'components\features\exam\pmAnswerUtils.ts'
    if (Test-Path $pmAnswerUtilsForR22) { $utilsRaw = Get-Content -LiteralPath $pmAnswerUtilsForR22 -Raw }
    $combinedRaw = "$raw`n$utilsRaw"
    if ($raw -notmatch 'getAnswerItems' -or
        $combinedRaw -notmatch 'section\?\.questions' -or
        ($combinedRaw -notmatch 'hasDirectAnswerContent' -and $combinedRaw -notmatch 'hasPMDirectAnswerContent') -or
        $raw -notmatch 'promptText') {
        Add-Finding -Rule 'R22-pm-section-answer-field-fallback' -Severity 'High' `
            -File $scpmExamView `
            -Detail 'SCPMExamView が subQuestions 以外の section.answer / section.questions / 空 subQuestions を解答欄として扱えない状態です'
    }
}

# ---------------------------------------------------------------------------
# R23: Mermaid サニタイズが日本語 ER 図・日本語 subgraph を扱えるか
#      (SC/PM 午後データの図表で「図の描画に失敗しました」を再発させない)
# ---------------------------------------------------------------------------
$mermaidSanitize = Join-Path $WebRoot 'lib\mermaid\sanitize.ts'
if (Test-Path $mermaidSanitize) {
    $raw = Get-Content -LiteralPath $mermaidSanitize -Raw
    if ($raw -notmatch 'convertErDiagramToFlowchart' -or
        $raw -notmatch 'sanitizeSubgraphLabels' -or
        $raw -notmatch 'relationCardinality' -or
        $raw -notmatch '\(\(' -or
        $raw -notmatch '\[\^\\x00-\\x7F\]') {
        Add-Finding -Rule 'R23-mermaid-japanese-diagram-sanitize' -Severity 'Medium' `
            -File $mermaidSanitize `
            -Detail 'Mermaid サニタイズが日本語 ER 図・日本語 subgraph・日本語ノードラベルの描画失敗を防ぐ実装から逸脱しています'
    }
}

# ---------------------------------------------------------------------------
# R24: GitHub Actions artifact ダウンロードが gh run download に戻っていないか
#      (checkout していない deploy ジョブで "fatal: not a git repository" を再発させない)
# ---------------------------------------------------------------------------
$azureWorkflow = Join-Path $RepoRoot '.github\workflows\azure-app-service.yml'
if (Test-Path $azureWorkflow) {
    $raw = Get-Content -LiteralPath $azureWorkflow -Raw
    if ($raw -match 'gh\s+run\s+download' -or
        $raw -notmatch 'actions/download-artifact@v6') {
        Add-Finding -Rule 'R24-actions-artifact-download' -Severity 'High' `
            -File $azureWorkflow `
            -Detail 'Azure App Service CI/CD の artifact 取得は actions/download-artifact@v6 を使用してください (gh run download は checkout 不在ジョブで失敗します)'
    }
}

# ---------------------------------------------------------------------------
# R25: 新形式午後画面の解答例解説を Markdown として描画しているか
#      (### / **...** が解答例に素のテキストとして表示されるデグレを再発させない)
# ---------------------------------------------------------------------------
if (Test-Path $scpmExamView) {
    $raw = Get-Content -LiteralPath $scpmExamView -Raw
    if ($raw -match '<p\s+style=\{\{\s*marginTop:\s*''0\.5rem''\s*\}\}>\{sq\.explanation\}</p>' -or
        $raw -notmatch 'normalizedExplanation' -or
        $raw -notmatch 'ReactMarkdown[\s\S]{0,500}\{normalizedExplanation') {
        Add-Finding -Rule 'R25-pm-explanation-markdown-rendering' -Severity 'High' `
            -File $scpmExamView `
            -Detail 'SCPMExamView の解答例解説は ReactMarkdown で描画してください (### や ** が素の文字列として表示されます)'
    }
}

# ---------------------------------------------------------------------------
# R26: 新形式午後画面の解答例ラベルがダークテーマでも読める配色か
#      (透過アンバー背景 + 赤茶文字はダーク背景で視認しづらい)
# ---------------------------------------------------------------------------
$scpmExamViewCss = Join-Path $WebRoot 'components\features\exam\SCPMExamView.module.css'
if (Test-Path $scpmExamViewCss) {
    $raw = Get-Content -LiteralPath $scpmExamViewCss -Raw
    $badgeMatch = [regex]::Match($raw, '(?s)\.explanationBadge\s*\{(?<body>[^}]*)\}')
    if (-not $badgeMatch.Success -or
        $badgeMatch.Groups['body'].Value -match '#92400e' -or
        $badgeMatch.Groups['body'].Value -match 'rgba\(251,\s*191,\s*36,\s*0\.[0-4]' -or
        $badgeMatch.Groups['body'].Value -notmatch 'background:\s*#fbbf24' -or
        $badgeMatch.Groups['body'].Value -notmatch 'color:\s*#111827') {
        Add-Finding -Rule 'R26-pm-explanation-badge-contrast' -Severity 'Medium' `
            -File $scpmExamViewCss `
            -Detail 'SCPMExamView の解答例ラベルは不透明アンバー背景 + 濃色文字でダークテーマの視認性を維持してください'
    }
}

# ---------------------------------------------------------------------------
# R27: 親見出しが子設問と同時に解答欄化しないこと、全区分監査スクリプトがあること
#      (説明だけの親設問が 800 字の原稿用紙欄になり、DB/AU/SM 等の未抽出区分も見落とす)
# ---------------------------------------------------------------------------
$pmAnswerUtils = Join-Path $WebRoot 'components\features\exam\pmAnswerUtils.ts'
if (Test-Path $scpmExamView) {
    $raw = Get-Content -LiteralPath $scpmExamView -Raw
    if ($raw -match 'if \(hasDirectAnswerContent\(section\)\)' -or
        $raw -notmatch 'shouldRenderPMSectionAnswerItem' -or
        $raw -notmatch 'getPMChildAnswerItems') {
        Add-Finding -Rule 'R27-afternoon-parent-heading-answer-field' -Severity 'High' `
            -File $scpmExamView `
            -Detail '子設問を持つ説明だけの親見出しを解答欄化しないよう、SCPMExamView は pmAnswerUtils の判定ヘルパーを使ってください'
    }
}
if (Test-Path $pmAnswerUtils) {
    $raw = Get-Content -LiteralPath $pmAnswerUtils -Raw
    if ($raw -notmatch 'shouldRenderPMSectionAnswerItem' -or
        $raw -notmatch 'hasText\(section\?\.answer\)' -or
        $raw -notmatch 'hasText\(section\?\.modelAnswer\)') {
        Add-Finding -Rule 'R27-afternoon-parent-heading-answer-field' -Severity 'High' `
            -File $pmAnswerUtils `
            -Detail '子設問を持つ親は、answer/modelAnswer が明示された場合のみ直接解答欄化する判定を維持してください'
    }
}
$afternoonDataAudit = Join-Path $RepoRoot 'scripts\audit-afternoon-data-quality.mjs'
if (-not (Test-Path $afternoonDataAudit)) {
    Add-Finding -Rule 'R27-afternoon-data-quality-audit' -Severity 'Medium' `
        -File (Join-Path $RepoRoot 'scripts') `
        -Detail '全試験区分の午後データ品質を監査する scripts/audit-afternoon-data-quality.mjs がありません'
}

# ---------------------------------------------------------------------------
# R28: 午後問題の qNo 不一致を位置番号で誤解決しないこと
#      (疎な qNo を qNo-1 番目へフォールバックすると別問題を表示する)
# ---------------------------------------------------------------------------
$examDataHelper = Join-Path $WebRoot 'lib\exam-data.ts'
if (Test-Path -LiteralPath $examDataHelper) {
    $raw = Get-Content -LiteralPath $examDataHelper -Raw
    if ($raw -match 'findQuestionByNoOrPosition' -or
        $raw -match 'sortedQuestions\s*\[\s*qNo\s*-\s*1\s*\]') {
        Add-Finding -Rule 'R28-afternoon-qno-position-fallback' -Severity 'High' `
            -File $examDataHelper `
            -Detail '午後問題は要求 qNo とデータ qNo の完全一致だけで解決し、位置番号フォールバックを再導入しないでください'
    }
}
$examQuestionPage = Join-Path $WebRoot 'app\(main)\exam\[year]\[type]\[qNo]\page.tsx'
if (Test-Path -LiteralPath $examQuestionPage) {
    $raw = Get-Content -LiteralPath $examQuestionPage -Raw
    if ($raw -match 'findQuestionByNoOrPosition') {
        Add-Finding -Rule 'R28-afternoon-qno-position-fallback' -Severity 'High' `
            -File $examQuestionPage `
            -Detail '個別問題ページは findQuestionByNo の厳密一致だけで問題を解決してください'
    }
}

$tag = if ($Mode -eq 'start') { 'SESSION-START' } else { 'SESSION-END' }
Write-Host ""
Write-Host "## [self-inspect $tag] 自己点検レポート"
Write-Host ""

if ($findings.Count -eq 0) {
    Write-Host "✅ 検出された不整合はありません (R1 / R2 / R3 / R4 / R5 / R6 / R7 / R8 / R9 / R10 / R11 / R12 / R13 / R14 / R15 / R16 / R17 / R18 / R19 / R20 / R21 / R22 / R23 / R24 / R25 / R26 / R27 / R28)"
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
Write-Host "ヒント: R1 → ensureContainer に置換 / R2 → catch 直下に console.error 追加 / R3 → CSS 宣言を @media 外に移動 / R4 → @media 内の grid-column override を削除 / R6 → error を弱点判定から除外 / R7 → 公式小問スコアを優先 / R8 → document-agent が docs/ を更新 / R9 → セッション進捗保存は currentSessionStats を使用 / R10 → Mermaid CODE_BLOCK マーカーを sanitizeMermaid で除去 / R11 → qNo 欠損を 99 にせず同期失敗として扱う / R12 → tracked 設定から接続文字列・API キー実値を除去 / R13 → download.ts で content-type と %PDF- ヘッダーを検証し、壊れた既存 PDF は再取得する / R14 → npx 直接 spawn ではなく process.execPath + ts-node/register を使う / R15 → npm_config_* と node --require ts-node/register で npm run 引数を安定化する / R16 → AM/AM2 の answers_raw.json と questions_raw.json の qNo・correctOption・選択肢を同期する / R17 → PM/PM1/PM2 は questions_transformed.json と subQuestions 解答欄を同期する / R18 → Mermaid のリンクラベルは -->|label| または ---|label| に正規化し、非ASCIIの円形節点ラベルは引用する / R19 → 新形式午後ヘッダーは CSS Modules を使う / R20 → AIAnswerBox の draftKey・文字数制限を維持する / R21 → 新形式午後の総合スコアは平均を /100、件数は解答欄数で表示する / R22 → section.answer・section.questions・空 subQuestions も解答欄化する / R23 → 日本語 ER 図・subgraph は sanitizeMermaid で描画可能に正規化する / R24 → GitHub Actions の artifact 取得は actions/download-artifact@v6 を使う / R25 → SCPMExamView の解答例解説は ReactMarkdown で描画する / R26 → 解答例ラベルは不透明アンバー背景 + 濃色文字で視認性を保つ / R27 → 子設問を持つ説明だけの親見出しは解答欄化せず、午後データ監査を全区分で実行する / R28 → 午後問題は qNo 完全一致だけで解決し、位置番号フォールバックを再導入しない"

if ($FailOnFinding) { exit 1 }
exit 0

