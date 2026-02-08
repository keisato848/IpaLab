# IpaLab 現状と今後の課題

**作成日:** 2026-02-07
**プロジェクト:** IpaLab (apps/web)
**作成者:** Claude Code

---

## 1. 現状サマリー

### 1.1 テストカバレッジ達成状況

| 指標 | 現在値 | 目標 | 状態 |
|------|--------|------|------|
| Branch Coverage | **81.60%** | 80% | 達成 |
| Statement Coverage | **88.70%** | - | 良好 |
| Line Coverage | **91.31%** | - | 良好 |
| Function Coverage | **100%** | - | 完全 |

### 1.2 テスト統計

| 項目 | 値 |
|------|-----|
| テストフレームワーク | Vitest 4.0.18 |
| テストファイル数 | 14 |
| 総テスト数 | 226 |
| 成功 | 226 |
| 失敗 | 0 |
| 成功率 | 100% |

### 1.3 ファイル別カバレッジ詳細

#### APIルート

| ファイル | Statement | Branch | 状態 |
|----------|-----------|--------|------|
| `app/api/exam-progress/route.ts` | 100% | 100% | 完了 |
| `app/api/exams/route.ts` | 100% | 100% | 完了 |
| `app/api/score/route.ts` | 100% | 100% | 完了 |
| `app/api/learning-records/route.ts` | 100% | 83.33% | 完了 |
| `app/api/exams/[examId]/questions/route.ts` | 92.85% | 87.5% | 良好 |
| `app/api/session/create/route.ts` | 88.23% | 66.66% | 要改善 |

#### Hooks

| ファイル | Statement | Branch | 状態 |
|----------|-----------|--------|------|
| `hooks/useUserProgress.ts` | 94.82% | 84.61% | 完了 |
| `hooks/useGuestSync.ts` | 95.65% | 90.9% | 完了 |

#### ライブラリ

| ファイル | Statement | Branch | 状態 |
|----------|-----------|--------|------|
| `lib/api.ts` | 80.9% | 85.71% | 完了 |
| `lib/exam-utils.ts` | 100% | 97.36% | 完了 |
| `lib/scoring.ts` | 94.87% | 75% | 良好 |
| `lib/auth-adapter.ts` | 83.58% | 68.75% | 要改善 |
| `lib/cosmos.ts` | 44.44% | 44.44% | 要改善 |
| `lib/guest-manager.ts` | 78.94% | 60% | 要改善 |

---

## 2. 完了した作業

### 2.1 テスト環境整備
- [x] `@vitest/coverage-v8` インストール
- [x] カバレッジ計測環境の構築
- [x] 失敗テストの修正 (`routes.test.ts` - crypto.randomUUID問題)

### 2.2 新規テストファイル作成
- [x] `__tests__/api/exam-progress.test.ts` (13テスト)
- [x] `__tests__/api/score.test.ts` (12テスト)
- [x] `__tests__/hooks/useGuestSync.test.ts` (9テスト)
- [x] `__tests__/lib/ssg-helper.test.ts` (13テスト)
- [x] `__tests__/lib/cosmos.test.ts` (6テスト)
- [x] `__tests__/lib/auth-adapter.test.ts` (15テスト)
- [x] `__tests__/api/questions.test.ts` (6テスト)
- [x] `__tests__/api/learning-records.test.ts` (19テスト)

### 2.3 既存テストの拡張
- [x] `useUserProgress.test.ts` +12テスト追加
- [x] `api.test.ts` +10テスト追加 (createStudyPlanJob, getLatestStudyPlanJob等)

---

## 3. 今後の課題

### 3.1 高優先度 (High Priority)

#### 3.1.1 低カバレッジファイルの改善

| ファイル | 現在のBranch | 目標 | 対応内容 |
|----------|--------------|------|----------|
| `lib/cosmos.ts` | 44.44% | 80% | DB接続成功時のテスト追加 |
| `lib/guest-manager.ts` | 60% | 80% | localStorage操作の分岐テスト |
| `app/api/session/create/route.ts` | 66.66% | 80% | エラーハンドリング分岐 |
| `lib/auth-adapter.ts` | 68.75% | 80% | セッション管理の分岐 |

#### 3.1.2 CI/CDパイプラインへのテスト統合
- [ ] GitHub Actionsにテスト実行ステップ追加
- [ ] PRマージ前のテスト必須化
- [ ] カバレッジ閾値チェック (80%維持)

```yaml
# 推奨設定例
- name: Run tests with coverage
  run: npm run test:coverage

- name: Check coverage threshold
  run: |
    if [ $(cat coverage/coverage-summary.json | jq '.total.branches.pct') -lt 80 ]; then
      echo "Branch coverage below 80%"
      exit 1
    fi
```

### 3.2 中優先度 (Medium Priority)

#### 3.2.1 未テストAPIルートの追加

| エンドポイント | 重要度 | 対応内容 |
|----------------|--------|----------|
| `/api/auth/[...nextauth]` | 高 | 認証フロー全体のテスト |
| `/api/session` | 中 | セッション取得/更新のテスト |
| `/api/config/telemetry` | 低 | 設定取得のテスト |
| `/api/ai/jobs` | 中 | ジョブ作成/取得のテスト |
| `/api/ai/jobs/pending` | 中 | ペンディングジョブのテスト |
| `/api/ai/jobs/[jobId]` | 中 | 個別ジョブ操作のテスト |
| `/api/ai/plan` | 中 | 学習プラン生成のテスト |
| `/api/ai/plan/estimate` | 低 | 見積もりAPIのテスト |
| `/api/ai/generate-plan` | 中 | プラン生成のテスト |

#### 3.2.2 モック戦略の改善
- [ ] CosmosDBクライアントのモック共通化
- [ ] 外部API (Gemini) のモックファクトリ作成
- [ ] テストユーティリティの整理

### 3.3 低優先度 (Low Priority)

#### 3.3.1 UIコンポーネントテストの導入

| カテゴリ | ファイル数 | 推奨テスト対象 |
|----------|-----------|----------------|
| features/exam/ | 6 | QuestionCard, ExamProgress |
| features/dashboard/ | 4 | DashboardStats, ProgressChart |
| features/auth/ | 2 | LoginButton, UserMenu |
| common/ | 1 | レイアウトコンポーネント |

**推奨ツール:**
- React Testing Library
- @testing-library/user-event
- MSW (Mock Service Worker) for API mocking

#### 3.3.2 E2Eテストの検討

```
推奨フレームワーク: Playwright

対象シナリオ:
1. ログイン → ダッシュボード表示
2. 試験選択 → 問題解答 → 結果表示
3. ゲストモード → ログイン → 履歴統合
4. 学習プラン生成 → ミッション完了
```

#### 3.3.3 パフォーマンステスト
- [ ] API応答時間の計測
- [ ] 大量データでの動作確認
- [ ] メモリリーク検出

---

## 4. 技術的負債

### 4.1 テストコードの課題

| 課題 | 影響度 | 対応案 |
|------|--------|--------|
| モジュールモックの重複 | 中 | 共通モックファイルの作成 |
| テストデータの散在 | 低 | フィクスチャファイルの整理 |
| 非同期テストのタイムアウト | 低 | タイムアウト設定の見直し |

### 4.2 コードカバレッジの死角

以下は現在のテストでカバーされていない領域:

1. **サーバーサイドレンダリング (SSR)**
   - `ssg-helper.ts` の実際のファイルシステム操作

2. **認証フロー**
   - NextAuth.jsのコールバック処理
   - セッション有効期限切れ処理

3. **エラーリカバリ**
   - ネットワーク断続時の再試行
   - CosmosDB接続障害時のフォールバック

---

## 5. 推奨アクション計画

### Phase 1 (1週間以内)
1. CI/CDへのテスト統合
2. 低カバレッジファイル (`cosmos.ts`, `guest-manager.ts`) の改善

### Phase 2 (2週間以内)
3. 未テストAPIルートの追加 (認証関連優先)
4. モック戦略の共通化

### Phase 3 (1ヶ月以内)
5. 主要UIコンポーネントのテスト追加
6. E2Eテスト基盤の構築

---

## 6. 参考コマンド

```bash
# テスト実行
npm run test:run

# ウォッチモード
npm run test

# カバレッジ付き実行
npm run test:coverage

# 特定ファイルのテスト
npm run test:run -- __tests__/api/score.test.ts

# カバレッジHTMLレポート生成
npm run test:coverage -- --reporter=html
```

---

*報告書作成: Claude Code*
