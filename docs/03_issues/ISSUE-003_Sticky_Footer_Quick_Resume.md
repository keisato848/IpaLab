# ISSUE-003: Sticky Footer（Quick Resume ボタン）の実装

| 項目 | 内容 |
|------|------|
| **Issue ID** | ISSUE-003 |
| **優先度** | 高 (High) |
| **ステータス** | Open |
| **起票日** | 2026年2月14日 |
| **担当者** | 未割当 |
| **工数見積** | 1〜2日 |
| **関連ドキュメント** | `docs/04_reports/UIUX_Improvement_Status_Report_20260211.md` Section 1.3 |

---

## 📋 課題の概要

ダッシュボードの「クイックスタート (続きから)」ボタンが、モバイルでスクロール時に画面外に隠れてしまう問題。

UI/UX改善提案書では、学習再開ボタンを**画面最下部に固定（Sticky Footer）**し、親指が自然に届く位置（Thumb Zone）に配置することを推奨している。

---

## 🔍 現状の問題点

### 現在の実装

- ダッシュボードに「クイックスタート (続きから)」ボタンは存在 ✅
- **問題**: ボタンは `statusCard` 内に配置されており、**Sticky Footer 固定ではない** ❌
- モバイルでスクロールが必要な場合、ボタンが画面外に隠れる

### コード箇所

```tsx
// apps/web/components/features/dashboard/DashboardClient.tsx (L1133付近)
<Link href={quickStartUrl} className={styles.quickStartBtn}>{quickStartLabel}</Link>
```

```css
/* apps/web/components/features/dashboard/DashboardClient.module.css (L230-248) */
.quickStartBtn {
  width: 100%;
  padding: 0.8rem;
  background: var(--accent-color);
  /* position: sticky; は未設定 */
}
```

---

## 💡 提案する解決策

### モバイル専用 Sticky Footer の実装

```css
/* apps/web/components/features/dashboard/DashboardClient.module.css */
@media (max-width: 768px) {
  .quickResumeFooter {
    position: sticky;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 100;
    background: var(--bg-secondary);
    padding: 1rem;
    box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.1);
    border-top: 1px solid var(--border-color);
  }
  
  .quickResumeFooter .quickStartBtn {
    width: 100%;
    /* 既存のスタイルを継承 */
  }
}
```

### 実装の指針

1. **モバイル専用フッター要素の追加**
   - `DashboardClient.tsx` に `<div className={styles.quickResumeFooter}>` を追加
   - モバイル画面（768px以下）でのみ表示

2. **デスクトップでは現状維持**
   - 768px超のデスクトップでは従来通り、カード内にボタンを表示
   - レスポンシブ設計を維持

3. **Thumb Zone 配慮**
   - 親指が自然に届く位置（画面下部）に配置
   - タップ領域は48px以上を確保（既存のボタンは満たしている）

---

## ✅ 受け入れ基準

- [ ] モバイル（768px以下）でダッシュボードを表示したとき、Quick Resumeボタンが画面下部に固定表示される
- [ ] スクロールしてもボタンは常に表示され続ける
- [ ] デスクトップ（769px以上）では従来通り、カード内にボタンが表示される
- [ ] ボタンのタップ領域は48px以上を維持
- [ ] ダークモードでも適切に表示される
- [ ] 既存の機能（ボタンのリンク先、ラベル変更）に影響がない

---

## 🔗 関連Issue

- なし

---

## 📝 備考

- UI/UX改善提案書の Phase 1（モバイル最適化）に該当
- **優先度が高い**理由: モバイルでの学習再開が最重要アクション（Product-Led Growth の観点）
- 実装後は、モバイルユーザーの学習再開率（Activation Rate）の計測を推奨
