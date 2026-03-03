## タイトル
test: 管理者フィーチャーフラグE2Eテスト追加・修正 (20テスト全パス)

## 本文
### 概要
`feature/admin-and-feature-flags` ブランチ向けに、管理者フィーチャーフラグ画面の E2E テスト 20 ケースを安定化しました。CSS トグルの操作方法、API 呼び出し経路、strict mode を考慮したセレクタを見直し、FF-21 の判定も `toBeChecked()` に統一しています。エビデンスのスクリーンショットは `apps/web/e2e/evidence/` に保存しました。

### 変更内容
- CSS トグルスイッチのクリックを `evaluate` 経由に変更（非表示 input 対応）
- `page.request.*` を使う API 呼び出しを `page.evaluate(fetch)` に置き換え、`page.route` との干渉を回避
- Playwright strict mode に合わせてセレクタを整理（FF-01〜10、FF-05/06、FF-08 など）
- FF-21 の判定を `toBeChecked()` に変更
- E2E エビデンスを `apps/web/e2e/evidence/` に保存

### テスト
- [ ] npm run lint（web: Invalid project directory `/apps/web/lint` で失敗）
- [x] npm run build
- [x] npm run test
- [x] admin-feature-flags E2E 20 ケース（Pass）
- [x] E2E テストエビデンス: docs/04_reports/E2E_Test_Evidence_Report_20260302.md
