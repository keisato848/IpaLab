# ISSUE-005: Cold Start 時の学習計画自動設定

| 項目 | 内容 |
|------|------|
| **Issue ID** | ISSUE-005 |
| **優先度** | 中 (Middle) |
| **ステータス** | Open |
| **起票日** | 2026年2月14日 |
| **担当者** | 未割当 |
| **工数見積** | 1日 |
| **関連ドキュメント** | `docs/04_reports/UIUX_Improvement_Status_Report_20260211.md` ダッシュボード改善セクション |

---

## 📋 課題の概要

初回起動時（studyPlan未設定）にダッシュボードが空虚で、ユーザーが何をすべきか迷う可能性がある。

UI/UX改善提案書では、**「標準コース（デフォルト設定）」をワンタップで適用可能にする**ことで、Cold Start 問題を解消することを推奨している。

---

## 🔍 現状の問題点

### 現在の実装

```tsx
// apps/web/components/features/dashboard/GoalSettingWizard.tsx
// AI学習計画ウィザードは存在する
```

**問題点**:
- AI学習計画ウィザードは存在 ✅
- しかし、初回起動時に**自動表示されるか未確認** ⚠️
- 提案書の「ワンタップで標準コース適用」は実装されていない可能性 ⚠️

### ユーザー体験の課題

1. **新規ユーザーが迷う**: 目標未設定の状態で何をすべきか不明瞭
2. **離脱リスク**: Cold Start の摩擦が大きいと、ユーザーが離脱する可能性
3. **Product-Led Growth への影響**: スムーズなオンボーディングが重要

---

## 💡 提案する解決策

### 1. 初回起動時にウィザードを自動表示

```tsx
// apps/web/components/features/dashboard/DashboardClient.tsx
useEffect(() => {
  if (!studyPlan && !loading && !localStorage.getItem('hasSeenWizard')) {
    setShowWizard(true);
    localStorage.setItem('hasSeenWizard', 'true');
  }
}, [studyPlan, loading]);
```

**ポイント**:
- `studyPlan === null` の場合に自動表示
- `hasSeenWizard` フラグで1度だけ表示（うるさくならない）
- ウィザードをスキップした場合は、ダッシュボードに誘導ボタンを表示

### 2. 「標準コース」のクイックスタートオプション

```tsx
// apps/web/components/features/dashboard/GoalSettingWizard.tsx
<div className={styles.quickStartSection}>
  <h3>すぐに始めたい方へ</h3>
  <button 
    onClick={applyDefaultPlan}
    className={styles.quickStartBtn}
  >
    標準コース（基本情報技術者試験）で始める
  </button>
  <p className={styles.note}>
    試験日: 3ヶ月後、週5日学習、1日10問のプラン
  </p>
</div>
```

**デフォルトプラン例**:
- 試験種別: 基本情報技術者試験（最も一般的）
- 試験日: 3ヶ月後
- 週間学習日: 月〜金（5日）
- 1日の目標問題数: 10問

### 3. カスタマイズへの誘導

```tsx
<p className={styles.customizeNote}>
  もちろん、あとからカスタマイズできます。
  <button onClick={showCustomize}>詳細設定へ</button>
</p>
```

---

## 🛠️ 実装の段階的アプローチ

### Phase 1: 自動ウィザード表示（最小限の変更）

```tsx
// DashboardClient.tsx
useEffect(() => {
  if (!studyPlan && !loading) {
    setShowWizard(true);
  }
}, [studyPlan, loading]);
```

### Phase 2: 標準コースのワンタップ適用

```tsx
// GoalSettingWizard.tsx
const applyDefaultPlan = () => {
  const defaultPlan: StudyPlan = {
    id: crypto.randomUUID(),
    title: '基本情報技術者試験 標準コース',
    examType: 'FE',
    examDate: getDateAfterMonths(3),
    weeklySchedule: generateWeeklySchedule(5, 10), // 週5日、1日10問
    monthlyGoal: '基礎固めと過去問演習を並行して進める',
    monthlyGoals: createDefaultMonthlyGoals([...])
  };
  
  onSave(defaultPlan);
  onClose();
};
```

---

## ✅ 受け入れ基準

- [ ] 初回起動時（studyPlan未設定）に、GoalSettingWizardが自動表示される
- [ ] ウィザード内に「標準コースで始める」ボタンが表示される
- [ ] 標準コースボタンをクリックすると、デフォルトプランが自動適用される
- [ ] デフォルトプランの内容が明確に表示される（試験種別、期間、学習頻度）
- [ ] プラン適用後、ダッシュボードに戻り、学習を開始できる
- [ ] 既存ユーザー（studyPlan設定済み）には影響がない
- [ ] ウィザードを閉じた場合、次回起動時も再表示される（until studyPlan is set）

---

## 🔗 関連Issue

- なし

---

## 📝 備考

- UI/UX改善提案書のダッシュボード改善項目に該当
- **優先度が中**の理由: ユーザーオンボーディングの改善だが、現状でもウィザードは利用可能
- **工数が少ない（1日）**: 既存のウィザードを活用し、自動表示ロジックを追加するのみ
- 実装後、新規ユーザーの学習開始率（Activation Rate）を計測すると良い
