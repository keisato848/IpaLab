# =============================================================================
# GitHub Customization Validator
# =============================================================================
# .github 配下の Custom Agents / Prompt Files / Hooks / Skills を機械的に検証する。
# Hook からも手動でも同じスクリプトを呼び、旧記法や壊れた frontmatter を再発防止する。
# =============================================================================

[CmdletBinding()]
param(
    [ValidateSet('manual', 'hook')]
    [string]$Mode = 'manual',
    [switch]$FailOnFinding
)

$ErrorActionPreference = 'Stop'

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..\..')).Path
$GitHubRoot = Join-Path $RepoRoot '.github'
$AllowedTopLevelTools = @('read', 'edit', 'search', 'execute', 'agent', 'web', 'todo')
$LegacyToolNames = @('editFiles', 'runCommands', 'codebase', 'search/codebase', 'edit/editFiles', 'search/changes', 'web/fetch')
$AllowedHookEvents = @('SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'PreCompact', 'SubagentStart', 'SubagentStop', 'Stop')
$MaxDescriptionChars = 1024
$MaxSkillNameChars = 64
$MaxAgentPromptChars = 30000
$ObsoleteModelReplacements = @{
    'Claude Sonnet 4' = 'Claude Sonnet 4.6 (copilot)'
}
$Findings = New-Object System.Collections.Generic.List[object]

function Get-RelativePath {
    param([string]$Path)
    if ([string]::IsNullOrWhiteSpace($Path)) { return '' }
    $fullPath = (Resolve-Path -LiteralPath $Path).Path
    return ($fullPath.Replace($RepoRoot, '').TrimStart('\', '/') -replace '\\', '/')
}

function Add-Finding {
    param(
        [string]$Severity,
        [string]$Rule,
        [string]$File,
        [string]$Detail
    )
    $script:Findings.Add([pscustomobject]@{
        Severity = $Severity
        Rule     = $Rule
        File     = (Get-RelativePath $File)
        Detail   = $Detail
    }) | Out-Null
}

function Get-FrontMatter {
    param([string]$Path)
    $lines = @(Get-Content -LiteralPath $Path)
    if ($lines.Count -lt 3 -or $lines[0].Trim() -ne '---') { return $null }

    for ($i = 1; $i -lt $lines.Count; $i++) {
        if ($lines[$i].Trim() -eq '---') {
            $frontLines = @()
            if ($i -gt 1) { $frontLines = $lines[1..($i - 1)] }
            return [pscustomobject]@{
                Text    = ($frontLines -join "`n")
                Lines   = $lines
                EndLine = $i + 1
            }
        }
    }

    return $null
}

function Get-FrontMatterName {
    param($FrontMatter)
    if ($null -eq $FrontMatter) { return $null }
    $m = [regex]::Match($FrontMatter.Text, '(?m)^name\s*:\s*(?<name>.+?)\s*$')
    if (-not $m.Success) { return $null }
    return $m.Groups['name'].Value.Trim().Trim("'").Trim('"')
}

function Test-FrontMatterKey {
    param($FrontMatter, [string]$Key)
    if ($null -eq $FrontMatter) { return $false }
    return ($FrontMatter.Text -match "(?m)^$([regex]::Escape($Key))\s*:")
}

function Get-FrontMatterScalarValue {
    param($FrontMatter, [string]$Key)
    if ($null -eq $FrontMatter) { return $null }

    $lines = @($FrontMatter.Text -split "`r?`n")
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -notmatch "^$([regex]::Escape($Key))\s*:\s*(?<value>.*)$") { continue }

        $value = $Matches['value'].Trim()
        if ($value -eq '>' -or $value -eq '|') {
            $parts = New-Object System.Collections.Generic.List[string]
            for ($j = $i + 1; $j -lt $lines.Count; $j++) {
                if ($lines[$j] -match '^[A-Za-z0-9_-]+\s*:') { break }
                if ($lines[$j] -match '^\s{1,}(?<part>.*)$') {
                    $parts.Add($Matches['part'].Trim()) | Out-Null
                }
            }
            if ($value -eq '>') { return (($parts | Where-Object { $_ -ne '' }) -join ' ') }
            return ($parts -join "`n")
        }

        return $value.Trim().Trim("'").Trim('"')
    }

    return $null
}

function Get-FrontMatterModelValues {
    param($FrontMatter)
    $models = New-Object System.Collections.Generic.List[string]
    if ($null -eq $FrontMatter) { return @() }

    $lines = @($FrontMatter.Text -split "`r?`n")
    for ($i = 0; $i -lt $lines.Count; $i++) {
        $line = $lines[$i]
        if ($line -match '^model\s*:\s*\[(?<items>.*)\]\s*$') {
            foreach ($item in ($Matches['items'] -split ',')) {
                $value = $item.Trim().Trim("'").Trim('"')
                if (-not [string]::IsNullOrWhiteSpace($value)) { $models.Add($value) | Out-Null }
            }
            continue
        }
        if ($line -match '^model\s*:\s*(?<value>.+?)\s*$') {
            $value = $Matches['value'].Trim().Trim("'").Trim('"')
            if (-not [string]::IsNullOrWhiteSpace($value)) { $models.Add($value) | Out-Null }
            continue
        }
        if ($line -match '^model\s*:\s*$') {
            for ($j = $i + 1; $j -lt $lines.Count; $j++) {
                $next = $lines[$j]
                if ($next -match '^[A-Za-z0-9_-]+\s*:') { break }
                if ($next -match '^\s*-\s*(?<model>.+?)\s*$') {
                    $value = $Matches['model'].Trim().Trim("'").Trim('"')
                    if (-not [string]::IsNullOrWhiteSpace($value)) { $models.Add($value) | Out-Null }
                }
            }
        }
    }

    return @($models)
}

function Get-TopLevelTools {
    param($FrontMatter)
    $tools = New-Object System.Collections.Generic.List[string]
    if ($null -eq $FrontMatter) { return @() }

    $lines = @($FrontMatter.Text -split "`r?`n")
    for ($i = 0; $i -lt $lines.Count; $i++) {
        $line = $lines[$i]

        if ($line -match '^tools\s*:\s*\[(?<items>.*)\]\s*$') {
            foreach ($item in ($Matches['items'] -split ',')) {
                $value = $item.Trim().Trim("'").Trim('"')
                if (-not [string]::IsNullOrWhiteSpace($value)) { $tools.Add($value) | Out-Null }
            }
            continue
        }

        if ($line -match '^tools\s*:\s*$') {
            for ($j = $i + 1; $j -lt $lines.Count; $j++) {
                $next = $lines[$j]
                if ($next -match '^[A-Za-z0-9_-]+\s*:') { break }
                if ($next -match '^\s*-\s*(?<tool>.+?)\s*$') {
                    $value = $Matches['tool'].Trim().Trim("'").Trim('"')
                    if (-not [string]::IsNullOrWhiteSpace($value)) { $tools.Add($value) | Out-Null }
                }
            }
        }
    }

    return @($tools)
}

function Test-Tools {
    param([string]$Path, $FrontMatter)
    $tools = Get-TopLevelTools -FrontMatter $FrontMatter
    foreach ($tool in $tools) {
        if ($tool -in $LegacyToolNames) {
            Add-Finding -Severity 'High' -Rule 'GHC-FM-TOOLS' -File $Path -Detail "top-level tools に旧形式のツール名 '$tool' が含まれています"
            continue
        }
        if ($tool -eq '*') { continue }
        if ($tool -match '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.*-]+$') { continue }
        if ($tool -notin $AllowedTopLevelTools) {
            Add-Finding -Severity 'High' -Rule 'GHC-FM-TOOLS' -File $Path -Detail "top-level tools に公式エイリアスではない '$tool' が含まれています"
        }
    }
}

function Get-LastSectionBulletCount {
    param([string]$Content, [string]$Heading)
    $pattern = "(?ms)^##\s+$([regex]::Escape($Heading))\s*`r?`n(?<body>.*?)(?=^##\s+|\z)"
    $matches = [regex]::Matches($Content, $pattern)
    if ($matches.Count -eq 0) { return 0 }
    $body = $matches[$matches.Count - 1].Groups['body'].Value
    return ([regex]::Matches($body, '(?m)^\s*-\s+\S')).Count
}

function Test-MarkdownFrontMatter {
    param([string]$Path, [string]$Kind)
    $frontMatter = Get-FrontMatter -Path $Path
    if ($null -eq $frontMatter) {
        Add-Finding -Severity 'High' -Rule 'GHC-FM-MISSING' -File $Path -Detail "$Kind に YAML frontmatter がありません"
        return $null
    }
    if (-not (Test-FrontMatterKey -FrontMatter $frontMatter -Key 'description')) {
        Add-Finding -Severity 'High' -Rule 'GHC-FM-DESCRIPTION' -File $Path -Detail "$Kind の frontmatter に description がありません"
    } else {
        $description = Get-FrontMatterScalarValue -FrontMatter $frontMatter -Key 'description'
        if ($description.Length -gt $MaxDescriptionChars) {
            Add-Finding -Severity 'High' -Rule 'GHC-FM-DESCRIPTION-LENGTH' -File $Path -Detail "description は $MaxDescriptionChars 文字以内にしてください (現在 $($description.Length) 文字)"
        }
    }
    if ($frontMatter.Text -match '(?m)^description\s*:.*\btools\s*:') {
        Add-Finding -Severity 'High' -Rule 'GHC-FM-BROKEN-SCALAR' -File $Path -Detail 'description 行に tools: が混入しています'
    }
    if ($frontMatter.Text -match 'edithandoffs|toolshandoffs|\btools:\s*$.*?edithandoffs') {
        Add-Finding -Severity 'High' -Rule 'GHC-FM-BROKEN-SCALAR' -File $Path -Detail 'tools/handoffs が連結された壊れた YAML が疑われます'
    }
    foreach ($model in (Get-FrontMatterModelValues -FrontMatter $frontMatter)) {
        if ($ObsoleteModelReplacements.ContainsKey($model)) {
            Add-Finding -Severity 'High' -Rule 'GHC-FM-MODEL-OBSOLETE' -File $Path -Detail "model '$model' は現在選択できないため '$($ObsoleteModelReplacements[$model])' に更新してください"
        }
    }
    Test-Tools -Path $Path -FrontMatter $frontMatter
    return $frontMatter
}

if (-not (Test-Path $GitHubRoot)) {
    Write-Host '[github-customization-check] .github directory not found - skipped'
    exit 0
}

# ---------------------------------------------------------------------------
# 全ファイル共通の旧記法チェック
# ---------------------------------------------------------------------------
Get-ChildItem -Path $GitHubRoot -File -Recurse | ForEach-Object {
    $path = $_.FullName
    $content = Get-Content -LiteralPath $path -Raw
    if ($content -match '\{\{\{\s*input\s*\}\}\}') {
        Add-Finding -Severity 'High' -Rule 'GHC-PROMPT-INPUT' -File $path -Detail '旧形式の triple-brace input が残っています。${input:name:説明} に置換してください'
    }
}

# ---------------------------------------------------------------------------
# Hooks JSON チェック
# ---------------------------------------------------------------------------
$hookFiles = @(Get-ChildItem -Path (Join-Path $GitHubRoot 'hooks') -Filter '*.json' -File -ErrorAction SilentlyContinue)
$hookRegistrationHits = 0
$validatorHookEvents = @{}
foreach ($hookFile in $hookFiles) {
    $raw = Get-Content -LiteralPath $hookFile.FullName -Raw
    if ($raw -match 'validate-github-customizations\.ps1') { $hookRegistrationHits++ }

    try {
        [System.Text.Json.JsonDocument]::Parse($raw).Dispose()
        $json = $raw | ConvertFrom-Json
    } catch {
        Add-Finding -Severity 'High' -Rule 'GHC-HOOK-JSON' -File $hookFile.FullName -Detail "厳密な JSON として解析できません: $($_.Exception.Message)"
        continue
    }

    if ($null -eq $json.PSObject.Properties['version'] -or [int]$json.version -ne 1) {
        Add-Finding -Severity 'High' -Rule 'GHC-HOOK-VERSION' -File $hookFile.FullName -Detail 'hook JSON には version: 1 が必要です'
    }
    if ($null -eq $json.hooks) {
        Add-Finding -Severity 'High' -Rule 'GHC-HOOKS-MISSING' -File $hookFile.FullName -Detail 'hooks オブジェクトがありません'
        continue
    }

    foreach ($event in $json.hooks.PSObject.Properties.Name) {
        if ($event -notin $AllowedHookEvents) {
            Add-Finding -Severity 'High' -Rule 'GHC-HOOK-EVENT' -File $hookFile.FullName -Detail "hook イベント '$event' は PascalCase の公式イベント名ではありません"
        }
        foreach ($entry in @($json.hooks.$event)) {
            if (($entry.command -match 'validate-github-customizations\.ps1') -or ($entry.windows -match 'validate-github-customizations\.ps1')) {
                $validatorHookEvents[$event] = $true
            }
            if ($entry.type -ne 'command') {
                Add-Finding -Severity 'Medium' -Rule 'GHC-HOOK-TYPE' -File $hookFile.FullName -Detail "$event の hook type は command を推奨します"
            }
            if ([string]::IsNullOrWhiteSpace($entry.command) -or [string]::IsNullOrWhiteSpace($entry.windows)) {
                Add-Finding -Severity 'High' -Rule 'GHC-HOOK-COMMAND' -File $hookFile.FullName -Detail "$event の hook に command/windows の両方が必要です"
            }
        }
    }
}

if ($hookRegistrationHits -eq 0) {
    Add-Finding -Severity 'High' -Rule 'GHC-HOOK-REGISTERED' -File (Join-Path $GitHubRoot 'hooks') -Detail 'github-customization-check validator が hook JSON から呼び出されていません'
}
foreach ($requiredEvent in @('SessionStart', 'Stop')) {
    if (-not $validatorHookEvents.ContainsKey($requiredEvent)) {
        Add-Finding -Severity 'High' -Rule 'GHC-HOOK-REQUIRED-EVENT' -File (Join-Path $GitHubRoot 'hooks') -Detail "github-customization-check validator を $requiredEvent hook から実行してください"
    }
}

# ---------------------------------------------------------------------------
# Custom Agent チェック
# ---------------------------------------------------------------------------
Get-ChildItem -Path (Join-Path $GitHubRoot 'agents') -Filter '*.agent.md' -File -ErrorAction SilentlyContinue | ForEach-Object {
    $frontMatter = Test-MarkdownFrontMatter -Path $_.FullName -Kind 'Custom Agent'
    if ($null -eq $frontMatter) { return }

    $body = ''
    if ($frontMatter.EndLine -lt $frontMatter.Lines.Count) {
        $body = ($frontMatter.Lines[$frontMatter.EndLine..($frontMatter.Lines.Count - 1)] -join "`n")
    }
    if ($body.Length -gt $MaxAgentPromptChars) {
        Add-Finding -Severity 'High' -Rule 'GHC-AGENT-PROMPT-LENGTH' -File $_.FullName -Detail "Custom Agent の本文 prompt は $MaxAgentPromptChars 文字以内にしてください (現在 $($body.Length) 文字)"
    }

    $name = Get-FrontMatterName -FrontMatter $frontMatter
    $expected = $_.BaseName -replace '\.agent$', ''
    if ([string]::IsNullOrWhiteSpace($name)) {
        Add-Finding -Severity 'High' -Rule 'GHC-AGENT-NAME' -File $_.FullName -Detail 'Custom Agent に name がありません'
    } elseif ($name -ne $expected) {
        Add-Finding -Severity 'Medium' -Rule 'GHC-AGENT-NAME' -File $_.FullName -Detail "name '$name' がファイル名 '$expected' と一致しません"
    }

    if ($frontMatter.Text -match '(?im)^description\s*:\s*Use this agent') {
        Add-Finding -Severity 'Medium' -Rule 'GHC-AGENT-DESCRIPTION-LANG' -File $_.FullName -Detail 'description が英語テンプレートのままです。日本語で起動条件を記載してください'
    }
}

Get-ChildItem -Path (Join-Path $GitHubRoot 'agents') -Filter '*.md' -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -notlike '*.agent.md' } |
    ForEach-Object {
        Add-Finding -Severity 'High' -Rule 'GHC-AGENT-EXTENSION' -File $_.FullName -Detail 'Custom Agent は *.agent.md として保存してください'
    }

# ---------------------------------------------------------------------------
# Prompt File チェック
# ---------------------------------------------------------------------------
Get-ChildItem -Path $GitHubRoot -Filter '*.prompt.md' -File -Recurse | ForEach-Object {
    [void](Test-MarkdownFrontMatter -Path $_.FullName -Kind 'Prompt File')
}

# ---------------------------------------------------------------------------
# Skill レベルチェック
# ---------------------------------------------------------------------------
$skillFiles = @(Get-ChildItem -Path (Join-Path $GitHubRoot 'skills') -Filter 'SKILL.md' -File -Recurse -ErrorAction SilentlyContinue)
foreach ($skillFile in $skillFiles) {
    $frontMatter = Test-MarkdownFrontMatter -Path $skillFile.FullName -Kind 'Skill'
    $content = Get-Content -LiteralPath $skillFile.FullName -Raw
    $folderName = Split-Path (Split-Path $skillFile.FullName -Parent) -Leaf
    $name = Get-FrontMatterName -FrontMatter $frontMatter

    if ([string]::IsNullOrWhiteSpace($name)) {
        Add-Finding -Severity 'High' -Rule 'GHC-SKILL-NAME' -File $skillFile.FullName -Detail 'Skill に name がありません'
    } elseif ($name -ne $folderName) {
        Add-Finding -Severity 'High' -Rule 'GHC-SKILL-NAME' -File $skillFile.FullName -Detail "name '$name' がフォルダ名 '$folderName' と一致しません"
    } elseif ($name.Length -gt $MaxSkillNameChars) {
        Add-Finding -Severity 'High' -Rule 'GHC-SKILL-NAME-LENGTH' -File $skillFile.FullName -Detail "Skill name は $MaxSkillNameChars 文字以内にしてください (現在 $($name.Length) 文字)"
    }

    $lineCount = @(Get-Content -LiteralPath $skillFile.FullName).Count
    if ($lineCount -gt 500) {
        Add-Finding -Severity 'Medium' -Rule 'GHC-SKILL-LINES' -File $skillFile.FullName -Detail "SKILL.md が 500 行を超えています ($lineCount 行)"
    }

    if ($content -notmatch '(?m)^##\s+Gotchas\s*$') {
        Add-Finding -Severity 'High' -Rule 'GHC-SKILL-GOTCHAS' -File $skillFile.FullName -Detail 'Gotchas セクションがありません'
    } elseif ((Get-LastSectionBulletCount -Content $content -Heading 'Gotchas') -lt 3) {
        Add-Finding -Severity 'Medium' -Rule 'GHC-SKILL-GOTCHAS' -File $skillFile.FullName -Detail 'Gotchas セクションの箇条書きが 3 項目未満です'
    }

    if ($content -notmatch '(?m)^##\s+(検証ループ|Validation Loop)\s*$') {
        Add-Finding -Severity 'High' -Rule 'GHC-SKILL-VALIDATION' -File $skillFile.FullName -Detail '検証ループがありません'
    }

    if ($content -notmatch '(Quality Gates|品質ゲート)') {
        Add-Finding -Severity 'High' -Rule 'GHC-SKILL-QUALITY-GATES' -File $skillFile.FullName -Detail 'Quality Gates / 品質ゲートがありません'
    }

    $skillRoot = Split-Path $skillFile.FullName -Parent
    foreach ($supplement in @('assets', 'references', 'scripts', 'examples')) {
        $dir = Join-Path $skillRoot $supplement
        if (Test-Path $dir) {
            $relativeDir = (Get-RelativePath $dir)
            if ($content -notmatch [regex]::Escape($supplement + '/')) {
                Add-Finding -Severity 'Medium' -Rule 'GHC-SKILL-SUPPLEMENT' -File $skillFile.FullName -Detail "補助ディレクトリ '$relativeDir' が SKILL.md から条件付き参照されていません"
            }
            if (-not (Get-ChildItem -Path $dir -File -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1)) {
                Add-Finding -Severity 'Medium' -Rule 'GHC-SKILL-SUPPLEMENT-EMPTY' -File $dir -Detail '補助ディレクトリが空です'
            }
        }
    }
}

Write-Host ''
Write-Host "## [github-customization-check $Mode] .github カスタマイズ検証レポート"
Write-Host ''

if ($Findings.Count -eq 0) {
    Write-Host '✅ .github 配下のカスタマイズ検証はすべてパスしました。'
    exit 0
}

Write-Host "⚠ 検出件数: $($Findings.Count) 件"
Write-Host ''
Write-Host '| Severity | Rule | File | Detail |'
Write-Host '|---|---|---|---|'
foreach ($finding in $Findings) {
    $detail = ($finding.Detail -replace '\|', '\/')
    Write-Host "| $($finding.Severity) | $($finding.Rule) | $($finding.File) | $detail |"
}

Write-Host ''
Write-Host '対応: 上記ファイルを修正し、同じコマンドを再実行してください。'

if ($FailOnFinding) { exit 1 }
exit 0