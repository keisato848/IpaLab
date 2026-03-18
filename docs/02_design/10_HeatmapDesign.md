# 詳細設計書: 学習ヒートマップ描画アルゴリズム (HeatmapWidget)

## 1. 概要

ダッシュボードに表示される「学習ヒートマップ」（`HeatmapWidget`）は、GitHub のコントリビューショングラフと同様に、過去 16 週間分の日別学習実績をグリッド状に可視化するコンポーネントです。

- **実装ファイル**: `apps/web/components/features/dashboard/HeatmapWidget.tsx`
- **スタイル**: `apps/web/components/features/dashboard/HeatmapWidget.module.css`

---

## 2. 描画アルゴリズム全体の流れ

```
[1] 学習記録を日付ごとに集計
        ↓
[2] グリッド開始日を計算（16週前の日曜日）
        ↓
[3] 16週 × 7日の二次元配列を生成
        ↓
[4] 各セルに解答数に応じた色レベルを割り当て
        ↓
[5] CSS Flexbox でグリッドをレンダリング
```

---

## 3. 各ステップの詳細

### ステップ 1: 学習記録の日付別集計

`LearningRecord[]` の配列を受け取り、`Map<string, number>` に変換します。キーは `Date.toDateString()` で生成した文字列（例: `"Mon Mar 18 2024"`）、値はその日の解答数です。

```typescript
const counts = new Map<string, number>();
records.forEach(r => {
    if (!r || !r.answeredAt) return;
    const d = new Date(r.answeredAt);
    const key = d.toDateString();
    counts.set(key, (counts.get(key) || 0) + 1);
});
```

**ポイント**: `toDateString()` はタイムゾーンに依存した「ローカル日付文字列」を返すため、集計とセル生成の両方で同じメソッドを使用することで整合性を保ちます。

---

### ステップ 2: グリッド開始日の計算

グリッドは「現在の週（日曜始まり）の 15 週前の日曜日」を起点として描画されます。

```
今日が水曜日（dayOfWeek = 3）の場合:

currentWeekStart = 今日 - 3日 = 直前の日曜日
startDate        = currentWeekStart - 15週 = グリッド左端の日曜日
```

```typescript
const dayOfWeek = today.getDay(); // 0(日) ～ 6(土)
const currentWeekStart = new Date(today);
currentWeekStart.setDate(today.getDate() - dayOfWeek);

const startDate = new Date(currentWeekStart);
startDate.setDate(currentWeekStart.getDate() - (weeksToShow - 1) * 7);
// weeksToShow = 16 なので、15週前の日曜日が startDate
```

---

### ステップ 3: 二次元配列（週 × 日）の生成

`startDate` から 1 日ずつインクリメントしながら、`weeks[col][row]` の形式で `Date` オブジェクトを格納します。

```
weeks = [
  [Sun, Mon, Tue, Wed, Thu, Fri, Sat],  // 15週前
  [Sun, Mon, Tue, Wed, Thu, Fri, Sat],  // 14週前
  ...
  [Sun, Mon, Tue, Wed, Thu, Fri, Sat],  // 今週（最新）
]
```

```typescript
const weeks: Date[][] = [];
let currentD = new Date(startDate);

for (let w = 0; w < weeksToShow; w++) {        // 列（週）のループ
    const weekDays: Date[] = [];
    for (let d = 0; d < 7; d++) {              // 行（曜日）のループ
        weekDays.push(new Date(currentD));
        currentD.setDate(currentD.getDate() + 1);
    }
    weeks.push(weekDays);
}
```

---

### ステップ 4: 色レベルの決定

その日の解答数（`count`）に応じて、5 段階の色クラスを割り当てます。

| レベル | CSS クラス | 解答数 | ライトモード | ダークモード |
|--------|-----------|--------|------------|------------|
| 0 | `level0` | 0 問 | `#ebedf0`（薄灰） | `#161b22` |
| 1 | `level1` | 1〜2 問 | `#9be9a8`（薄緑） | `#0e4429` |
| 2 | `level2` | 3〜5 問 | `#40c463`（緑） | `#006d32` |
| 3 | `level3` | 6〜10 問 | `#30a14e`（濃緑） | `#26a641` |
| 4 | `level4` | 11 問以上 | `#216e39`（最濃緑） | `#39d353` |

```typescript
const getColorClass = (count: number) => {
    if (count === 0)   return styles.level0;
    if (count <= 2)    return styles.level1;
    if (count <= 5)    return styles.level2;
    if (count <= 10)   return styles.level3;
    return styles.level4;
};
```

**未来日の扱い**: `date > today` の場合はセルを透明な空要素（`emptyDay`）として描画し、データが存在しない未来日を視覚的に区別します。

---

### ステップ 5: CSS Flexbox によるグリッドレンダリング

`weeks` 配列を列単位で並べ、各列の中に 7 つのセルを縦並びで配置します。

```
┌─────────────────────────────────────────────────────────────────────┐
│  .heatmap（flex, row方向）                                           │
│  ┌──────────┐ ┌──────────┐     ┌──────────┐                        │
│  │.weekCol  │ │.weekCol  │ ... │.weekCol  │                        │
│  │ (列:週)  │ │          │     │ (最新週) │                        │
│  │ ■ Sun    │ │ ■ Sun    │     │ ■ Sun    │                        │
│  │ ■ Mon    │ │ ■ Mon    │     │ ■ Mon    │                        │
│  │ ■ Tue    │ │ ■ Tue    │     │ □ Tue    │ ← 今日               │
│  │ □ Wed    │ │ □ Wed    │     │ □ Wed    │ ← 未来（emptyDay）   │
│  │ □ Thu    │ │ □ Thu    │     │ □ Thu    │                        │
│  │ □ Fri    │ │ □ Fri    │     │ □ Fri    │                        │
│  │ □ Sat    │ │ □ Sat    │     │ □ Sat    │                        │
│  └──────────┘ └──────────┘     └──────────┘                        │
└─────────────────────────────────────────────────────────────────────┘
```

- **`.heatmap`**: `display: flex; gap: 4px;`（水平方向に週を並べる）
- **`.weekCol`**: `display: flex; flex-direction: column; gap: 4px;`（垂直方向に日を並べる）
- **`.day`**: `width: 12px; height: 12px; border-radius: 2px;`（各セルの正方形）

---

## 4. パラメータ設計

| パラメータ | 値 | 説明 |
|-----------|-----|------|
| `weeksToShow` | 16 | 表示する週数（グリッドの列数） |
| 週始まり | 日曜日 (`dayOfWeek = 0`) | GitHub と同様の日曜始まり |
| セルサイズ | 12px × 12px | `.day` の幅・高さ |
| セル間隔 | 4px | `.heatmap` および `.weekCol` の `gap` |

---

## 5. ホバー表示（Tooltip）

各セルには `title` 属性を付与しており、マウスオーバー時にブラウザ標準の Tooltip で日付と解答数が表示されます。

```tsx
title={`${date.toLocaleDateString()}: ${count}問`}
```

例: `"2024/3/18: 5問"`

---

## 6. 変更履歴

| 日付 | バージョン | 変更内容 |
|------|-----------|----------|
| 2026/03/18 | Rev.1 | 初版作成 - ヒートマップ描画アルゴリズムの文書化 |
