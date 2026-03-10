---
name: question-data-verification
description: 'IPA試験問題データの品質検証・欠損修復ワークフロー。全試験ディレクトリを監査し、問題データ（選択肢・正解・解説）の欠損を検出・修復する。USE FOR: 問題データの検証、データ品質チェック、欠損問題の修復、解説の生成、questions_raw.jsonの監査、データ整合性確認、午前問題の再抽出。DO NOT USE FOR: 新規試験の追加（gemini-extract.tsを直接使用）、DB同期（sync-db.tsを直接使用）、UIの修正。'
---

# IPA 午前試験問題データ品質検証・修復ワークフロー

午前試験（AM / AM2）の問題データの完全性を体系的に検証し、欠損を検出・修復するスキル。

## 対象

午前問題のみを対象とする。午後問題（PM1/PM2）は対象外。

### 試験種別と午前問題の構成

| 区分 | 種別 | 午前タイプ | 問題数 | ディレクトリ末尾 |
|------|------|-----------|--------|----------------|
| 共通 | FE（基本情報） | AM | 80問（公開問題は20問） | `-AM`, `-Public-AM` |
| 共通 | AP（応用情報） | AM | 80問 | `-AM` |
| 共通 | IP（ITパスポート） | AM | 100問 | `-AM` |
| 高度 | SC（情報処理安全確保支援士） | AM2 | 25問 | `-AM2` |
| 高度 | PM（プロジェクトマネージャ） | AM2 | 25問 | `-AM2` |
| 高度 | SA（システムアーキテクト） | AM2 | 25問 | `-AM2` |
| 高度 | ST（ITストラテジスト） | AM2 | 25問 | `-AM2` |

## いつ使うか

- 新しい試験データを追加した後の品質確認
- 問題データの欠損・不整合が疑われるとき
- 「問題を確認して」「データを検証して」「解説がない」と依頼されたとき
- PDFからの再抽出が必要なとき

## データ構造

```
packages/data/data/questions/<試験ID>/
├── questions_raw.json          # 全問題データ（メインソース）
├── questions_transformed.json  # 変換済みデータ（存在する場合はこちら優先）
├── answers_raw.json            # 正解データ（{"1": "a", "2": "c", ...}）
├── q1.json ... qN.json         # 個別問題ファイル
└── metadata.json               # 試験メタデータ
```

### 試験IDの命名規則

```
<種別>-<年>-<期>-<午前タイプ>
例: AP-2023-Fall-AM, SC-2024-Spring-AM2, FE-2024-Public-AM
```

### 問題データの必須フィールド

```json
{
  "qNo": 1,
  "text": "問題文（必須・空でないこと）",
  "options": [
    {"id": "a", "text": "選択肢a"},
    {"id": "b", "text": "選択肢b"},
    {"id": "c", "text": "選択肢c"},
    {"id": "d", "text": "選択肢d"}
  ],
  "correctOption": "a",
  "explanation": "解説テキスト（20文字超）"
}
```

## 手順

### ステップ 1: 全体監査

午前試験（AM / AM2）のディレクトリをスキャンし、データ品質の全体像を把握する。

```javascript
// Node.js ワンライナーで監査実行（午前試験に限定）
node -e "
const fs = require('fs');
const path = require('path');
const dir = 'packages/data/data/questions';
const exams = fs.readdirSync(dir).filter(d => d.match(/^[A-Z]{2,4}-\d{4}/) && (d.endsWith('-AM') || d.endsWith('-AM2') || d.includes('-Public-AM')));
let issues = [];
for (const exam of exams.sort()) {
  const rawPath = path.join(dir, exam, 'questions_raw.json');
  const tPath = path.join(dir, exam, 'questions_transformed.json');
  const fp = fs.existsSync(tPath) ? tPath : rawPath;
  if (!fs.existsSync(fp)) continue;
  const data = JSON.parse(fs.readFileSync(fp, 'utf-8'));
  const qs = Array.isArray(data) ? data : (data.questions || []);
  const noOptions = qs.filter(q => !q.options || q.options.length < 4);
  const noCorrect = qs.filter(q => q.text && !q.correctOption);
  const noExplanation = qs.filter(q => q.text && q.options && q.correctOption && (!q.explanation || q.explanation.length <= 20));
  const badOptions = qs.filter(q => q.options && q.options.some(o => !o.id || o.id === null || !o.text));
  if (noOptions.length || noCorrect.length || noExplanation.length || badOptions.length) {
    issues.push({exam, total: qs.length, noOptions: noOptions.length, noCorrect: noCorrect.length, noExplanation: noExplanation.length, badOptions: badOptions.length});
  }
}
console.log('対象: ' + exams.length + '試験');
if (issues.length === 0) { console.log('全午前試験データ正常'); }
else { issues.forEach(i => console.log(i.exam + ': ' + i.total + '問 | 選択肢不足=' + i.noOptions + ' 正解欠損=' + i.noCorrect + ' 解説欠損=' + i.noExplanation + ' 不正選択肢=' + i.badOptions)); }
"
```

**チェック項目:**

| # | 項目 | 判定基準 |
|---|------|---------|
| 1 | 選択肢の数 | 4択（a,b,c,d）が揃っているか |
| 2 | 選択肢のデータ | `id` と `text` が null/空でないか |
| 3 | 正解 (`correctOption`) | 存在するか |
| 4 | 解説 (`explanation`) | 存在し20文字超か |
| 5 | 問題数 | 期待値に一致するか（下表参照） |

**問題数の期待値:**

| 種別 | タイプ | 期待問題数 |
|------|--------|-----------|
| AP | AM | 80 |
| FE | AM | 80（公開問題は20） |
| IP | AM | 100 |
| SC, PM, SA, ST | AM2 | 25 |

### ステップ 2: 問題分類と対処方針決定

監査結果に基づき、以下の判断フローで対処方針を決定する。

```
欠損の種類を特定
├── 選択肢不足 / 不正選択肢 / 問題数不足
│   → ステップ 3: PDF再抽出
├── 正解 (correctOption) 欠損
│   → answers_raw.json からバックフィル
└── 解説欠損のみ
    → ステップ 4: 解説生成
```

**判断基準:**
- 選択肢が壊れている = PDF抽出が途中で切れた → **再抽出が必要**
- 問題文・選択肢は正常だが解説がない = **解説生成のみで対応**
- 正解がない = answers_raw.json を確認し、あればバックフィル

### ステップ 3: PDF再抽出（問題データ欠損の場合）

**前提条件:**
- ソースPDFが `packages/data/data/raw_pdfs/` に存在すること
- `packages/data/.env` に `GEMINI_API_KEY` が設定されていること

**実行:**
```bash
cd packages/data
npx ts-node src/scripts/re-extract-am.ts --filter <試験ID>

# ドライランで確認
npx ts-node src/scripts/re-extract-am.ts --filter <試験ID> --dry-run
```

**re-extract-am.ts の動作:**
1. 既存の `questions_raw.json` をバックアップ
2. PDFをGemini File APIにアップロード
3. 全問題を再抽出
4. 既存データとマージ（既存の正常データは保持、欠損分を補完）
5. `answers_raw.json` から `correctOption` をバックフィル

**マージルール:**
- 既存問題で選択肢が4つ揃っているもの → **保持**（解説も保持）
- 既存問題で選択肢が壊れているもの → **新抽出データで置換**
- 既存データにない問題番号 → **新抽出データから追加**

### ステップ 4: 解説生成（解説欠損の場合）

**実行:**
```bash
cd packages/data
npx ts-node src/scripts/fill-missing-explanations.ts
```

**fill-missing-explanations.ts の動作:**
- Gemini 2.5 Pro を使用（`GEMINI_API_KEY_2` = 有料キー優先）
- 全試験を走査し、解説が20文字以下の問題を検出
- 5問ずつバッチ処理（並列）
- 生成した解説を `questions_raw.json` と個別 `q*.json` の両方に反映
- リトライ: 最大3回

**注意:** このスクリプトは全試験（午前・午後問わず）を走査するが、午後問題に選択肢がない場合は自動的にスキップされる。

### ステップ 5: 修復後の再監査

ステップ 1 の監査スクリプトを再実行し、全項目がゼロであることを確認する。

```
期待結果: 全午前試験データ正常
```

### ステップ 6: テスト・ビルド検証

```bash
npm run test:unit
```

- 全テスト合格を確認（277テスト / 18ファイル）

### ステップ 7: コミット

```bash
# 変更対象のみを明示的にステージ
git add packages/data/data/questions/<試験ID>/questions_raw.json

# コミット（バックアップファイルはステージしない）
git commit -m "feat: <試験ID>の欠損データを修復

- 問題データ: Q<開始>〜Q<終了> (<N>問) を再抽出/補完
- 解説: Q<開始>〜Q<終了> (<N>問) をGemini 2.5 Proで生成"
```

**注意:**
- `questions_raw_backup_*.json` はコミットしない（`.gitignore` 対象）
- 再抽出スクリプト自体の変更も含める場合は別コミットにする

## トラブルシューティング

| 問題 | 対処 |
|------|------|
| ソースPDFが見つからない | `packages/data/data/raw_pdfs/` を確認。IPAサイトからダウンロード |
| Gemini APIエラー (429) | レートリミット。数分待ってリトライ |
| Gemini APIエラー (quota) | `GEMINI_API_KEY_2`（有料キー）を使用しているか確認 |
| 再抽出後も問題数が不足 | PDFの品質問題。手動で補完が必要な場合あり |
| 個別q*.jsonに反映されない | `fill-missing-explanations.ts` は自動同期する。手動は `gemini-import.ts` |

## 関連スクリプト一覧

| スクリプト | 用途 |
|-----------|------|
| `re-extract-am.ts` | PDF→問題データ再抽出（午前問題用） |
| `fill-missing-explanations.ts` | 解説の自動生成 |
| `check-missing-answers.ts` | 正解データの欠損チェック |
| `audit-explanations.ts` | 解説の監査 |
| `gemini-import.ts` | questions_raw.json→個別q*.json変換 |
| `sync-db.ts` | データ→CosmosDB同期 |
| `check-all-duplicates.ts` | 重複問題の検出 |
