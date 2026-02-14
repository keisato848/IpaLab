# ISSUE-004: 選択肢タップで即時判定（1ステップ化）

| 項目 | 内容 |
|------|------|
| **Issue ID** | ISSUE-004 |
| **優先度** | 中 (Middle) |
| **ステータス** | Open |
| **起票日** | 2026年2月14日 |
| **担当者** | 未割当 |
| **工数見積** | 2〜3日 |
| **関連ドキュメント** | `docs/04_reports/UIUX_Improvement_Status_Report_20260211.md` Section 2.3 |

---

## 📋 課題の概要

現在の演習画面は「選択肢タップ → 回答ボタンクリック」の2ステップ操作。

UI/UX改善提案書では、**選択肢タップで即座に判定**する1ステップ化を推奨しており、フロー高速化とリズム感向上を目指している。

---

## 🔍 現状の問題点

### 現在の実装（2ステップ）

```tsx
// apps/web/components/features/exam/QuestionClient.tsx
// 1. 選択肢をクリック → selectedOption に保存
// 2. フッターの「回答する」ボタンをクリック → handleAnswer() 実行
```

### メリット・デメリット

**現状のメリット**:
- 誤クリック防止
- ユーザーが選択を変更できる猶予がある
- 安全で熟考できる

**現状のデメリット**:
- クリック数が増加
- 学習フローが遅延
- リズム感が損なわれる

---

## 💡 提案する解決策

### Option A: 完全1ステップ化（提案書準拠）

選択肢クリック → 即座に判定

**メリット**:
- フロー高速化
- リズム感向上
- 提案書準拠

**デメリット**:
- 誤タップリスク増大
- 選択変更が不可能

### Option B: 現状維持

選択 + 確定ボタン

**メリット**:
- 安全性
- 熟考可能

**デメリット**:
- クリック数増加
- 改善なし

### **Option C: ユーザー設定で切り替え可能（推奨）**

デフォルトは現状維持、設定で「即座判定モード」を有効化可能にする。

**メリット**:
- 両方のユースケースに対応
- 上級者は高速化、初心者は安全性を確保
- ユーザーの選択権を尊重

**デメリット**:
- 実装の複雑性が若干増加

---

## 🛠️ 実装案（Option C）

### 1. 設定項目の追加

```tsx
// apps/web/lib/settings-manager.ts (新規作成)
interface UserSettings {
  instantAnswer: boolean; // 即座判定モード
  // その他の設定...
}

export const settingsManager = {
  get(): UserSettings {
    const saved = localStorage.getItem('userSettings');
    return saved ? JSON.parse(saved) : { instantAnswer: false };
  },
  set(settings: UserSettings) {
    localStorage.setItem('userSettings', JSON.stringify(settings));
  }
};
```

### 2. 演習画面での実装

```tsx
// apps/web/components/features/exam/QuestionClient.tsx
const settings = settingsManager.get();

const handleOptionClick = (option: string) => {
  setSelectedOption(option);
  
  if (settings.instantAnswer) {
    // 即座判定モード: 即座に回答処理
    handleAnswer(option);
  }
  // デフォルト: 選択のみ（確定ボタンが必要）
};
```

### 3. 設定画面の追加

```tsx
// apps/web/app/(main)/settings/page.tsx
<label>
  <input 
    type="checkbox" 
    checked={settings.instantAnswer}
    onChange={(e) => updateSetting('instantAnswer', e.target.checked)}
  />
  即座判定モード（上級者向け）
</label>
<p className={styles.description}>
  選択肢をタップした瞬間に判定します。誤タップに注意してください。
</p>
```

---

## ✅ 受け入れ基準

- [ ] 設定画面に「即座判定モード」のトグルスイッチが追加される
- [ ] デフォルト（OFF）では現在の2ステップ動作を維持
- [ ] 設定ON時、選択肢タップで即座に正誤判定が表示される
- [ ] 設定はlocalStorageに保存され、次回訪問時も維持される
- [ ] ゲストモードでも設定が機能する
- [ ] モックモードでも設定が適用される
- [ ] 既存のテストが全てパスする

---

## 🔗 関連Issue

- なし

---

## 📝 備考

- UI/UX改善提案書の Phase 2（学習フロー改善）に該当
- **優先度が中**の理由: 学習体験の向上だが、現状でも機能的に問題はない
- 上級者向け機能として、段階的なロールアウトを推奨
- 実装後、A/Bテストで学習継続率への影響を計測すると良い
