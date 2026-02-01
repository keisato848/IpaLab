# ゲーミフィケーション機能 設計書

## 1. 概要

学習継続のモチベーション向上を目的として、ゲーム的要素（XP、レベル、ミッション、実績）を導入する機能設計書。

## 2. 現在の実装状況（Rev.1 - 2026/02/01）

### 2.1 実装済み機能

| 機能 | 状態 | 説明 |
|------|------|------|
| 難易度設定 | ✅ 完了 | AI生成時に `easy/normal/hard` を自動設定 |
| XP報酬設定 | ✅ 完了 | 難易度に応じた XP を AI が自動設定 (10-100) |
| ミッション名 | ✅ 完了 | ゲーム風の日本語ミッション名を AI が生成 |
| 週テーマ | ✅ 完了 | 週ごとの学習テーマを設定 |
| クリア判定 | ✅ 完了 | 問題解答数ベースでミッションクリアを判定 |
| UI表示 | ✅ 完了 | 難易度バッジ、XP表示、クリアエフェクト |

### 2.2 データ構造

```typescript
interface DailyTask {
    date: string;
    missionTitle?: string;      // ゲーム風ミッション名
    goal: string;
    questionCount: number;
    targetCategory: string;
    targetExamId?: string;
    difficulty?: 'easy' | 'normal' | 'hard';
    xpReward?: number;          // 10-100
    isCompleted?: boolean;      // クライアント側で管理（未永続化）
}
```

### 2.3 制限事項

- XP の累計は保存されない（表示のみ）
- `isCompleted` フラグは永続化されていない
- レベルシステム未実装
- 実績（アチーブメント）未実装

---

## 3. 拡張計画

### 3.1 Phase 1: XP永続化とレベルシステム（優先度: 高）

#### 3.1.1 目的
ユーザーの学習継続を可視化し、達成感を提供する。

#### 3.1.2 データ構造追加

```typescript
// localStorage: 'userProgress'
interface UserProgress {
    totalXp: number;            // 累計XP
    currentLevel: number;       // 現在のレベル
    completedMissions: {        // 完了ミッション履歴
        date: string;
        planId: string;
        xpEarned: number;
        missionTitle: string;
    }[];
    streakDays: number;         // 連続学習日数
    lastActiveDate: string;     // 最終学習日
}
```

#### 3.1.3 レベル設計

| レベル | 必要累計XP | 称号 |
|--------|-----------|------|
| 1 | 0 | 見習い |
| 2 | 100 | 初心者 |
| 3 | 300 | 学習者 |
| 4 | 600 | 挑戦者 |
| 5 | 1000 | 熟練者 |
| 6 | 1500 | エキスパート |
| 7 | 2100 | マスター |
| 8 | 2800 | グランドマスター |
| 9 | 3600 | レジェンド |
| 10 | 4500 | 合格請負人 |

#### 3.1.4 実装タスク

```
□ UserProgress 型定義を lib/api.ts に追加
□ useUserProgress カスタムフックを作成
□ localStorage への永続化ロジック実装
□ ミッション完了時の XP 加算処理
□ レベルアップ判定ロジック
□ ダッシュボードにレベル・XP表示を追加
□ レベルアップ時のアニメーション/通知
```

---

### 3.2 Phase 2: 連続学習ボーナス（優先度: 中）

#### 3.2.1 目的
毎日の学習習慣を定着させるためのインセンティブ。

#### 3.2.2 ボーナス設計

| 連続日数 | ボーナス倍率 | 追加XP |
|----------|-------------|--------|
| 1日 | x1.0 | +0 |
| 2日 | x1.1 | +5 |
| 3日 | x1.2 | +10 |
| 7日 | x1.5 | +30 |
| 14日 | x1.7 | +50 |
| 30日 | x2.0 | +100 |

#### 3.2.3 連続判定ロジック

```typescript
const checkStreak = (lastActiveDate: string): { isStreak: boolean; newStreak: number } => {
    const last = new Date(lastActiveDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    last.setHours(0, 0, 0, 0);
    
    const diffDays = Math.floor((today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return { isStreak: true, newStreak: currentStreak }; // 同日
    if (diffDays === 1) return { isStreak: true, newStreak: currentStreak + 1 }; // 連続
    return { isStreak: false, newStreak: 1 }; // リセット
};
```

---

### 3.3 Phase 3: 実績（アチーブメント）システム（優先度: 中）

#### 3.3.1 実績一覧

| ID | 名称 | 条件 | 報酬XP |
|----|------|------|--------|
| `first_mission` | 初めの一歩 | 初回ミッションクリア | 50 |
| `streak_7` | 一週間の継続 | 7日連続学習 | 100 |
| `streak_30` | 月間マスター | 30日連続学習 | 500 |
| `level_5` | 熟練者への道 | レベル5到達 | 200 |
| `perfect_day` | パーフェクトデイ | 1日で全問正解 | 150 |
| `category_master_{cat}` | {カテゴリ}マスター | 特定カテゴリ正答率90%以上 | 300 |
| `exam_complete` | 模試完走 | 模擬試験を1回完走 | 200 |
| `hundred_questions` | 百問突破 | 累計100問解答 | 100 |
| `thousand_questions` | 千問の壁 | 累計1000問解答 | 500 |

#### 3.3.2 データ構造

```typescript
interface Achievement {
    id: string;
    name: string;
    description: string;
    iconEmoji: string;
    xpReward: number;
    unlockedAt?: string;  // ISO日付（未解除はundefined）
}

// localStorage: 'achievements'
interface UserAchievements {
    unlocked: Achievement[];
    progress: Record<string, number>;  // 進捗追跡（例: { "hundred_questions": 85 }）
}
```

---

### 3.4 Phase 4: サーバーサイド同期（優先度: 低）

#### 3.4.1 目的
デバイス間でのゲーミフィケーションデータ同期。

#### 3.4.2 Cosmos DB スキーマ

```typescript
// Container: UserProgress
interface UserProgressDocument {
    id: string;              // = userId
    partitionKey: string;    // = userId
    totalXp: number;
    currentLevel: number;
    streakDays: number;
    lastActiveDate: string;
    achievements: string[];  // 解除済み実績ID
    updatedAt: string;
}

// Container: MissionHistory
interface MissionHistoryDocument {
    id: string;              // UUID
    partitionKey: string;    // = userId
    userId: string;
    date: string;
    planId: string;
    missionTitle: string;
    xpEarned: number;
    bonusXp: number;
    completedAt: string;
}
```

#### 3.4.3 API エンドポイント

| Method | Endpoint | 説明 |
|--------|----------|------|
| GET | `/api/progress` | ユーザー進捗取得 |
| POST | `/api/progress/complete-mission` | ミッション完了処理 |
| GET | `/api/achievements` | 実績一覧取得 |

---

## 4. UI/UX 設計

### 4.1 ダッシュボード拡張

```
┌─────────────────────────────────────────────────┐
│ レベル 5 - 熟練者                    XP: 1,234   │
│ ████████████░░░░░░░░  次のレベルまで 266 XP     │
│                                                 │
│ 🔥 連続学習: 12日目  │  🏆 実績: 8/20          │
└─────────────────────────────────────────────────┘
```

### 4.2 ミッション完了ポップアップ

```
┌─────────────────────────────────────────────────┐
│              🎉 ミッションクリア！               │
│                                                 │
│     「セキュリティの門番」を達成しました         │
│                                                 │
│           ⭐ +45 XP                             │
│           🔥 連続ボーナス +5 XP                 │
│           ────────────                          │
│           合計: +50 XP                          │
│                                                 │
│              [次のミッションへ]                  │
└─────────────────────────────────────────────────┘
```

### 4.3 レベルアップ演出

```
┌─────────────────────────────────────────────────┐
│                  ✨ LEVEL UP! ✨                │
│                                                 │
│                  Level 5                        │
│                 「熟練者」                       │
│                                                 │
│     これまでの努力が実を結びました！             │
│     この調子で合格を目指しましょう！             │
│                                                 │
│                   [OK]                          │
└─────────────────────────────────────────────────┘
```

---

## 5. 実装優先順位

| Phase | 機能 | 工数目安 | 優先度 |
|-------|------|----------|--------|
| 1 | XP永続化・レベルシステム | 4-6h | 高 |
| 2 | 連続学習ボーナス | 2-3h | 中 |
| 3 | 実績システム | 6-8h | 中 |
| 4 | サーバーサイド同期 | 8-12h | 低 |

---

## 6. 変更履歴

| 日付 | バージョン | 変更内容 |
|------|-----------|----------|
| 2026/02/01 | Rev.1 | 初版作成 - 現状整理と拡張計画策定 |
