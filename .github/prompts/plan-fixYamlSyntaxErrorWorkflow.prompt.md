---
description: 'GitHub Actions YAML 構文エラーの修正計画を確認し、ワークフロー構文を安全に復旧する。'
tools:
  - read
  - search
  - edit
  - execute
---

# Plan: azure-functions-ai.yml の YAML 構文エラー修正

PR #118 のマージにより、`.github/workflows/azure-functions-ai.yml` の「Check outbound IPs for CosmosDB firewall」ステップに **YAML 構文エラー**が導入された。GitHub Actions ランナーがワークフローファイルをパースする際に 125行目で失敗している。

## 原因

PR #118 のパッチで、元の `for` ループを `while` + ヒアドキュメント(`<<EOF ... EOF`)に書き換えた。しかし、YAML ブロックスカラー(`run: |`)内でヒアドキュメントを使用すると、ヒアドキュメント本体とターミネータ `EOF` がインデント無し（カラム1）になり、**YAML パーサーがブロックスカラーの終了と誤認**して構文エラーとなる。

```
          done <<EOF        ← line 124: ヒアドキュメント開始
$(printf '%s\n' ...)        ← line 125: インデントなし → YAML パーサーエラー
EOF                         ← line 126: インデントなし → YAML パーサーエラー
```

## 修正前（現行・壊れているコード）

```bash
while IFS= read -r ip; do
  [ -z "$ip" ] && continue
  if [[ "$COSMOS_IPS" != *"$ip"* ]]; then
    MISSING="$MISSING $ip"
  fi
done <<EOF
$(printf '%s\n' "$FUNC_IPS" | tr ',' '\n')
EOF
```

## 修正案

PR #118 が変更する前の**元のコード（bash 配列 + `for` ループ）に戻す**。これは YAML ブロックスカラーと完全に互換性があり、同じ機能を実現する。

```bash
IFS=',' read -ra FUNC_IP_ARRAY <<< "$FUNC_IPS"
for ip in "${FUNC_IP_ARRAY[@]}"; do
  if [[ "$COSMOS_IPS" != *"$ip"* ]]; then
    MISSING="$MISSING $ip"
  fi
done
```

## Steps

1. `.github/workflows/azure-functions-ai.yml` を編集し、`while` + `<<EOF` ヒアドキュメント構文を元の `IFS=',' read -ra FUNC_IP_ARRAY <<< "$FUNC_IPS"` + `for` ループに戻す
2. 他のワークフローファイル（6ファイル確認済み）にはヒアドキュメントを使用している箇所がないため、追加修正は不要
3. フィーチャーブランチ `fix/yaml-syntax-error-workflow` を作成し、コミット・プッシュ
4. PR を作成してマージ

## Verification

- `git push` 後に GitHub Actions のワークフロー検証が通ること（YAML パースエラーが解消）
- 修正 PR の CI/CD で `azure-functions-ai.yml` ワークフローが正常にロードされること
- YAML リンターで事前確認: `npx yaml-lint .github/workflows/azure-functions-ai.yml` 等

## Decisions

- ヒアドキュメントの代替としてプロセス置換 (`< <(...)`) も検討したが、元コードへの revert がもっとも安全かつシンプルなため、revert を採用
