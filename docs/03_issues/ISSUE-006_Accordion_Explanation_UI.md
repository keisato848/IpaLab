# ISSUE-006: アコーディオンUIによる解説の階層化

| 項目 | 内容 |
|------|------|
| **Issue ID** | ISSUE-006 |
| **優先度** | 低 (Low) |
| **ステータス** | Open |
| **起票日** | 2026年2月14日 |
| **担当者** | 未割当 |
| **工数見積** | 2〜3日 |
| **関連ドキュメント** | `docs/04_reports/UIUX_Improvement_Status_Report_20260211.md` 演習インターフェース改善セクション |

---

## 📋 課題の概要

演習画面の解説が長文の場合、すべての情報が一度に表示され、認知的負荷が高い。

UI/UX改善提案書では、**重要語句の強調とアコーディオンUIによる階層化**を推奨しており、ユーザーが必要な情報だけを段階的に取得できる設計を目指している。

---

## 🔍 現状の問題点

### 現在の実装

```tsx
// apps/web/components/features/exam/QuestionClient.tsx
// 解説は Markdown で表示
<ReactMarkdown>{question.explanation}</ReactMarkdown>
```

**評価**:
- Markdown レンダリングは動作 ✅
- 太字（`**text**`）やハイライトは Markdown で記述可能 ✅
- **アコーディオンUIは未実装** ⚠️

### ユーザー体験の課題

1. **情報過多**: 詳細な解説が全て表示され、重要ポイントが埋もれる
2. **認知的負荷**: ワーキングメモリを浪費し、学習効率が低下
3. **スクロール量**: モバイルで特に、長文解説は読みづらい

---

## 💡 提案する解決策

### 構造化された解説デザイン

```tsx
// apps/web/components/features/exam/ExplanationSection.tsx (新規作成)

interface ExplanationSectionProps {
  explanation: string;
  detailedExplanation?: string;
  keyPoints?: string[];
}

export default function ExplanationSection({ 
  explanation, 
  detailedExplanation,
  keyPoints 
}: ExplanationSectionProps) {
  return (
    <div className={styles.explanationContainer}>
      {/* 基本解説（常に表示） */}
      <div className={styles.basicExplanation}>
        <ReactMarkdown>{explanation}</ReactMarkdown>
      </div>
      
      {/* 重要ポイント（強調表示） */}
      {keyPoints && keyPoints.length > 0 && (
        <div className={styles.keyPoints}>
          <h4>🔑 重要ポイント</h4>
          <ul>
            {keyPoints.map((point, i) => (
              <li key={i}><strong>{point}</strong></li>
            ))}
          </ul>
        </div>
      )}
      
      {/* 詳細解説（アコーディオン） */}
      {detailedExplanation && (
        <details className={styles.accordion}>
          <summary className={styles.accordionHeader}>
            📚 もっと詳しく見る
          </summary>
          <div className={styles.accordionContent}>
            <ReactMarkdown>{detailedExplanation}</ReactMarkdown>
          </div>
        </details>
      )}
    </div>
  );
}
```

### CSSスタイル

```css
/* ExplanationSection.module.css */
.basicExplanation {
  margin-bottom: 1rem;
  line-height: 1.8;
}

.keyPoints {
  background: var(--success-bg);
  border-left: 4px solid var(--success-text);
  padding: 1rem;
  margin: 1rem 0;
  border-radius: 8px;
}

.keyPoints h4 {
  margin: 0 0 0.5rem 0;
  color: var(--success-text);
  font-size: var(--fs-base);
}

.keyPoints ul {
  margin: 0;
  padding-left: 1.5rem;
}

.keyPoints strong {
  color: var(--success-text);
}

.accordion {
  margin-top: 1rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  overflow: hidden;
}

.accordionHeader {
  padding: 0.8rem 1rem;
  background: var(--bg-primary);
  cursor: pointer;
  font-weight: 600;
  color: var(--accent-color);
  user-select: none;
  transition: background 0.2s;
}

.accordionHeader:hover {
  background: var(--bg-secondary);
}

.accordionContent {
  padding: 1rem;
  border-top: 1px solid var(--border-color);
  animation: fadeIn 0.3s ease-out;
}
```

---

## 🛠️ 実装の段階的アプローチ

### Phase 1: `<details>` タグによるシンプルなアコーディオン

最小限の変更で実装。既存のMarkdownベースの解説を維持しつつ、詳細情報を折りたたみ可能にする。

```tsx
// QuestionClient.tsx
<div className={styles.explanationArea}>
  <ReactMarkdown>{question.explanation}</ReactMarkdown>
  
  {question.detailedExplanation && (
    <details className={styles.detailsAccordion}>
      <summary>📚 もっと詳しく見る</summary>
      <ReactMarkdown>{question.detailedExplanation}</ReactMarkdown>
    </details>
  )}
</div>
```

### Phase 2: データ構造の拡張

問題データに `detailedExplanation` フィールドを追加。

```typescript
// packages/shared/src/types/models.ts
export interface Question {
  // 既存フィールド...
  explanation: string;
  detailedExplanation?: string; // 詳細解説（オプション）
  keyPoints?: string[]; // 重要ポイント（オプション）
}
```

### Phase 3: 専用コンポーネントの作成

`ExplanationSection` コンポーネントを作成し、より洗練されたUIを提供。

---

## ✅ 受け入れ基準

- [ ] 解説に `<details>` タグによるアコーディオンUIが実装される
- [ ] デフォルトでは基本解説のみ表示される
- [ ] 「もっと詳しく見る」をクリックすると、詳細解説が展開される
- [ ] 展開/折りたたみのアニメーションがスムーズ
- [ ] モバイルでもタップしやすいサイズ（48px以上のタップ領域）
- [ ] ダークモードでも適切に表示される
- [ ] 既存の解説表示機能に影響がない（後方互換性）

---

## 🔗 関連Issue

- なし

---

## 📝 備考

- UI/UX改善提案書の演習インターフェース改善項目に該当
- **優先度が低**の理由: 学習体験の向上だが、現状でも解説は機能している
- **実装の選択肢**:
  - 軽量: `<details>` タグ（HTML5標準）
  - 高機能: カスタムReactコンポーネント
- 推奨は軽量実装から開始し、ユーザーフィードバックに基づいて改善
- 問題データの移行は段階的に実施可能（既存データはそのまま動作）
