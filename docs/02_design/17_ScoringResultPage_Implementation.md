# 採点結果ページ 実装設計書

> 関連Issue: #178 (P1-A-4) / 担当: frontend-engineer
> 依存: #176 (API v2), #177 (情報設計)

## 1. 目的

#177 の情報設計に基づき、採点API v2 のストリーミング応答を活用した採点結果ページを実装する。

## 2. ディレクトリ構成

```
apps/web/
├─ app/exam/[examId]/result/page.tsx          (Server Component / 既存)
├─ components/features/scoring/
│  ├─ AfternoonScoringResult.tsx              (Client / Top)
│  ├─ ScoringHeader.tsx                       (総合点ヘッダ)
│  ├─ PerspectiveCard.tsx                     (観点カード ×4)
│  ├─ ModelAnswerDiff.tsx                     (差分ビュー → #179)
│  ├─ ScoringActions.tsx                      (Next Step アクション)
│  └─ ScoringResult.module.css
└─ lib/scoring/
   ├─ useAfternoonScoringStream.ts            (SSE フック)
   └─ types.ts                                 (#175 型定義の再エクスポート)
```

## 3. ストリーミング統合

```typescript
// useAfternoonScoringStream.ts
export function useAfternoonScoringStream(questionId: string, userAnswer: string) {
  const [perspectives, setPerspectives] = useState<PerspectiveScore[]>([]);
  const [total, setTotal] = useState<TotalScore | null>(null);
  const [status, setStatus] = useState<'idle' | 'streaming' | 'done' | 'error'>('idle');

  useEffect(() => {
    const es = new EventSource(`/api/ai/scoring/afternoon/v2?...`);
    es.addEventListener('perspective', (e) => {
      setPerspectives((prev) => [...prev, JSON.parse(e.data)]);
    });
    es.addEventListener('complete', (e) => {
      setTotal(JSON.parse(e.data));
      setStatus('done');
      es.close();
    });
    es.onerror = () => { setStatus('error'); es.close(); };
    setStatus('streaming');
    return () => es.close();
  }, [questionId, userAnswer]);

  return { perspectives, total, status };
}
```

## 4. レンダリング戦略

- ページ自体は **Server Component**（既存パターン踏襲）
- 採点結果部分のみ Client Component で SSE 受信
- SEO 不要のためクライアント側で十分

## 5. 状態管理

- ローカル State（useState）で完結（Zustand 等は不要）
- 再取得は URL 変更 or 明示的な再採点ボタン

## 6. パフォーマンス

- 観点カード到着ごとにアニメーション（CSS transition）
- 大きな差分テキストは仮想化不要だが折りたたみ初期 collapsed

## 7. エラー UX

- API エラー時：「採点に失敗しました。もう一度お試しください」+ requestId
- ストリーム切断時：自動リトライ 1 回 → 失敗時は手動リトライ

## 8. テスト

- `__tests__/components/scoring/AfternoonScoringResult.test.tsx`
  - モック SSE で観点カード描画
  - 完了イベントで総合点表示
  - エラー時のフォールバック
- E2E (`e2e/`): 実際の採点フロー往復

## 9. DoD

- レスポンシブ対応（モバイル/タブレット/デスクトップ）
- ストリーミング表示動作確認
- a11y（axe-core）パス
- ユニットテスト・E2E パス

## 10. 関連

- #176 API v2 / #177 情報設計 / #179 差分ハイライト / #180 フィードバックUI
