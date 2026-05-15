# Copilot OTel / Langfuse 監視・証跡手順書

## 1. 目的

本書は、VS Code Copilot Chat の OpenTelemetry 出力を OTel Collector 経由で Langfuse に集約し、会話・ツール実行・セッション証跡を確認するための仕組みと運用手順を定義する。

対象は以下の 2 系統である。

- 本リポジトリの OTel / Langfuse 開発時監視構成
- 汎用テンプレート `/tmp/copilot-otel-langfuse-devcontainer` をコピーした別リポジトリの構成

本構成は開発・検証用途であり、本番アプリケーションの利用者トレースを Langfuse に送るものではない。

---

## 2. PM 整理 (Phase 0-3)

| Phase | 整理内容 |
|------|------|
| Phase 0 受付 | OTel + Langfuse の仕組み、ダッシュボードの見方、セットアップ、起動、検証、トラブルシュート、リモート転送、セッション証跡を日本語手順書として残す |
| Phase 1 要件 | 開発者が devcontainer または手動起動で Langfuse を立ち上げ、Copilot Chat のトレースを確認し、必要に応じて証跡 Markdown とスクリーンショットを生成できる |
| Phase 2 基本設計 | Copilot Chat -> OTel Collector -> Local Langfuse、必要に応じて Remote OTLP へ追加転送する構成を採用する。秘密値は `.env` に置き、生成設定ファイルへ直接書かない |
| Phase 3 詳細設計・WBS | 既存スクリプトと devcontainer 設定を前提に、正式設計書、手順書、テンプレート README を文書化する。コード変更、DB 変更、Azure 変更は行わない |

### 2.1 影響領域

| 領域 | 影響 |
|------|------|
| Docs | 本手順書とドキュメント索引を更新する |
| DevContainer | 既存の `.devcontainer/devcontainer.json` と `.devcontainer/docker-compose.yml` の使い方を説明するのみ |
| Observability | Copilot Chat OTel、OTel Collector、Langfuse、任意の Remote OTLP の見方を整理する |
| Security | `captureContent` と `.env` の秘密値取り扱いを明記する |
| Test / Evidence | E2E テストではなく OTel セッション証跡の生成・確認手順を対象にする |

### 2.2 更新すべき文書

| 文書 | 役割 |
|------|------|
| `docs/02_design/16_TelemetryAndMonitoringDesign.md` | 監視設計の正式な入口。詳細手順書への参照を置く |
| `docs/02_design/24_CopilotOtelLangfuseRunbook.md` | 本書。仕組み、操作、検証、トラブルシュートの正本 |
| `docs/00_Documentation_Map.md` | 新規手順書をドキュメント体系に追加する |
| `/tmp/copilot-otel-langfuse-devcontainer/README.md` | 汎用テンプレート利用者向けに手順書への導線を置く |
| `/tmp/copilot-otel-langfuse-devcontainer/docs/CopilotOtelLangfuseRunbook.md` | テンプレートをコピーした先でも読める汎用手順書 |

### 2.3 検証観点

- `npm run otel:setup` で `.env`、`langfuse/docker-compose.yml`、`otel-collector/generated/config.yml` が準備できること
- `npm run otel:compose` で Langfuse と OTel Collector が起動すること
- `npm run otel:verify` で Langfuse health、Collector 到達性、OTel 環境変数を確認できること
- `http://localhost:3000` の Langfuse UI で project `copilot-otel` の Tracing を確認できること
- Copilot Chat Agent mode で会話した後、Langfuse 上に trace / span が表示されること
- `npm run otel:report` または `npm run otel:start-session` で `docs/04_reports/otel-sessions/` に Markdown とスクリーンショットが生成されること
- Remote OTLP を使う場合、Collector ログにリモート exporter のエラーが出ていないこと

### 2.4 E2E 証跡要否

本作業はアプリケーション UI の変更ではなく、Playwright E2E テストも実行しないため、E2E エビデンス報告書は不要である。

ただし、OTel / Langfuse の起動確認を実行した場合は、`docs/04_reports/otel-sessions/` のセッションレポートとスクリーンショットを OTel 監視の証跡として残す。

---

## 3. 仕組み

### 3.1 全体フロー

```text
VS Code Copilot Chat
  -> OTLP HTTP
  -> OTel Collector (:4318)
  -> Local Langfuse (/api/public/otel)
  -> optional Remote OTLP
```

### 3.2 コンポーネント

| コンポーネント | 役割 |
|------|------|
| Copilot Chat | VS Code の OTel 設定に従って会話・ツール実行の trace を OTLP HTTP で送信する |
| OTel Collector | Copilot から受けた trace / log をローカル Langfuse と任意の Remote OTLP に転送する |
| Langfuse | ローカルの可視化 UI。project `copilot-otel` に trace を保存・表示する |
| `.env` | Langfuse 初期ユーザー、project key、OTLP Authorization、Remote OTLP 設定を保持する。コミットしない |
| セッションレポート | Langfuse health、OTLP endpoint、Remote 転送有無、ダッシュボードスクリーンショットを Markdown で残す |

### 3.3 devcontainer と手動起動の違い

| 起動方式 | Copilot OTLP endpoint | 主な設定元 |
|------|------|------|
| devcontainer | `http://otel-collector:4318` | `.devcontainer/devcontainer.json` と compose network |
| 手動起動 | `http://localhost:4318` | `.vscode/settings.json` とローカル port forward |

---

## 4. セットアップ

### 4.1 前提

- Node.js と npm が利用できること
- VS Code と GitHub Copilot / Copilot Chat 拡張が利用できること
- Docker Desktop、Rancher Desktop、Podman など、Compose 互換 CLI が利用できること
- `docker compose`、`docker-compose`、`nerdctl compose`、`podman compose` のいずれかが実行できること

Compose コマンドを明示する場合は、以下のように指定する。

```bash
COPILOT_OTEL_COMPOSE_COMMAND="nerdctl compose" npm run otel:compose
```

### 4.2 devcontainer 起動

VS Code でリポジトリを Dev Container として開く。

起動時に以下が自動実行される。

1. `scripts/setup-copilot-otel.mjs` が Langfuse compose、`.env`、Collector 設定を準備する
2. compose が Langfuse と OTel Collector を起動する
3. `scripts/start-copilot-otel-session.mjs` が Langfuse health を待つ
4. `http://localhost:3000` の Langfuse UI を開く
5. `docs/04_reports/otel-sessions/` にセッションレポートを生成する

### 4.3 手動起動

Dev Container を使わない場合は、リポジトリルートで以下を実行する。

```bash
npm run otel:setup
npm run otel:compose
export OTEL_EXPORTER_OTLP_HEADERS="$(sed -n 's/^OTEL_EXPORTER_OTLP_HEADERS=//p' .env)"
code .
npm run otel:start-session
```

PowerShell では以下を使う。

```powershell
$env:OTEL_EXPORTER_OTLP_HEADERS = (Select-String -Path .env -Pattern '^OTEL_EXPORTER_OTLP_HEADERS=').Line -replace '^OTEL_EXPORTER_OTLP_HEADERS=', ''
code .
npm run otel:start-session
```

---

## 5. 起動・停止・ログ確認

| 操作 | コマンド |
|------|------|
| 起動 | `npm run otel:compose` |
| 状態確認 | `npm run otel:compose -- ps` |
| Langfuse ログ | `npm run otel:compose -- logs langfuse-web` |
| Collector ログ | `npm run otel:compose -- logs otel-collector` |
| 停止 | `npm run otel:compose -- down` |
| 再生成 | `npm run otel:setup` |

---

## 6. Langfuse ダッシュボードの見方

### 6.1 アクセス

- URL: `http://localhost:3000`
- 初期 project: `copilot-otel`
- 初期ユーザー: `.env` の `LANGFUSE_INIT_USER_EMAIL`
- 初期パスワード: `.env` の `LANGFUSE_INIT_USER_PASSWORD`

`.env` を自動生成した直後の既定値は以下である。

```text
email: dev@example.com
password: changeme123
project: copilot-otel
```

### 6.2 基本の確認順

1. Langfuse にログインする
2. project `copilot-otel` を開く
3. Tracing / Traces の一覧を開く
4. Time range を直近に絞る
5. 新しい Copilot Chat 会話を実行する
6. trace が増えることを確認する
7. trace を開き、span の duration、metadata、input / output、error を確認する

### 6.3 何を見るか

| 観点 | 見る場所 | 判断 |
|------|------|------|
| trace が作られているか | Traces 一覧 | Copilot Chat から Collector 経由で Langfuse へ届いている |
| span の親子関係 | Trace detail | 会話、ツール呼び出し、内部処理の流れを追える |
| duration | Span detail | 遅い処理や待ち時間の大きい箇所を見つける |
| input / output | Span detail | `captureContent=true` の場合のみ内容を確認できる |
| error / status | Span detail | Collector 転送や Copilot 側エラーの兆候を確認する |
| metadata | Span detail | service name、endpoint、実行環境の手掛かりを確認する |

### 6.4 ダッシュボードで trace が見えない場合

まず以下を確認する。

```bash
npm run otel:verify
npm run otel:compose -- ps
npm run otel:compose -- logs otel-collector
```

次に、VS Code を起動したシェルで `OTEL_EXPORTER_OTLP_HEADERS` が設定されているか、devcontainer では Copilot endpoint が `http://otel-collector:4318`、手動起動では `http://localhost:4318` になっているかを確認する。

---

## 7. 検証手順

### 7.1 health と到達性

```bash
npm run otel:verify
```

期待結果は以下である。

- Langfuse が `OK` になる
- OTel Collector が到達可能になる
- `OTEL_` または `COPILOT_OTEL` 関連環境変数が表示される
- 秘密値は `[redacted]` として表示される

### 7.2 trace 生成

1. VS Code で Copilot Chat Agent mode を開く
2. 短い依頼を送る
3. Langfuse の Traces 一覧を更新する
4. 直近時刻の trace が表示されることを確認する

### 7.3 セッション証跡生成

```bash
npm run otel:report
```

または起動セッション込みで以下を実行する。

```bash
npm run otel:start-session
```

出力先は以下である。

```text
docs/04_reports/otel-sessions/{timestamp}_langfuse-session.md
docs/04_reports/otel-sessions/{timestamp}_langfuse-dashboard.png
```

Markdown には Langfuse health、Copilot OTLP endpoint、Remote OTLP 転送有無、スクリーンショットが含まれる。

---

## 8. Remote OTLP 転送

### 8.1 設定

リモートにも同じ trace を転送する場合は、未追跡 `.env` に以下を設定する。

```env
OTEL_REMOTE_EXPORTER_OTLP_ENDPOINT=https://otel.example.com/v1/traces
OTEL_REMOTE_AUTH_HEADER=Bearer xxxxx
```

設定後に再起動する。

```bash
npm run otel:compose -- down
npm run otel:setup
npm run otel:compose
```

### 8.2 確認

```bash
npm run otel:compose -- logs otel-collector
```

リモート側で受信が見えない場合は、endpoint の path、認証ヘッダー、ネットワーク到達性、Collector ログを確認する。

### 8.3 注意

- `.env` はコミットしない
- `OTEL_REMOTE_AUTH_HEADER` をログや PR に貼らない
- リモート転送先が外部サービスの場合、`captureContent=true` のまま会話内容を送ってよいか事前に確認する

---

## 9. トラブルシュート

| 症状 | 主な原因 | 確認・対応 |
|------|------|------|
| Langfuse が開かない | compose 未起動、port 3000 競合、初期化未完了 | `npm run otel:compose -- ps`、`npm run otel:compose -- logs langfuse-web` を確認する |
| Collector に届かない | port 4318 競合、Collector 設定未生成、compose 起動失敗 | `npm run otel:setup`、`npm run otel:compose -- logs otel-collector` を確認する |
| Traces が空 | Copilot OTel が無効、endpoint 不一致、ヘッダー未設定、会話がまだ発生していない | VS Code 設定、`OTEL_EXPORTER_OTLP_HEADERS`、devcontainer / 手動 endpoint を確認し、新しい Copilot 会話を実行する |
| 401 / 403 が出る | Langfuse project key と Authorization が不一致 | `.env` の `LANGFUSE_INIT_PROJECT_PUBLIC_KEY`、`LANGFUSE_INIT_PROJECT_SECRET_KEY`、`OTEL_LANGFUSE_AUTH_HEADER` を確認する |
| Remote OTLP に届かない | endpoint / auth / outbound network の問題 | `OTEL_REMOTE_EXPORTER_OTLP_ENDPOINT`、`OTEL_REMOTE_AUTH_HEADER`、Collector ログを確認する |
| スクリーンショットがない | Langfuse health 失敗、Playwright / Chromium 起動失敗 | `npm run otel:verify` の後に `npm run otel:report` を再実行する |
| `.env` が不整合 | 以前の設定が残っている | 必要な値を退避したうえで `.env` を作り直し、`npm run otel:setup` を再実行する |

---

## 10. セキュリティ運用

- `github.copilot.chat.otel.captureContent=true` と `COPILOT_OTEL_CAPTURE_CONTENT=true` は、プロンプト、応答、ツール引数を trace に含める
- シークレット、個人情報、本番データ、顧客データを含む会話では有効化しない
- `.env`、Remote OTLP の認証ヘッダー、Langfuse の secret key はコミットしない
- セッションレポートやスクリーンショットを共有する前に、画面内に秘密情報が含まれていないか確認する
- 外部 Remote OTLP へ転送する場合は、会話内容の送信可否を事前に合意する

---

## 11. 汎用テンプレートへ適用する場合

`/tmp/copilot-otel-langfuse-devcontainer` を別リポジトリへコピーした場合も、基本手順は同じである。

1. テンプレートの `.devcontainer/`、`.vscode/`、`langfuse/`、`otel-collector/`、`scripts/`、`package.json`、`.env.example`、`docs/` を対象リポジトリへコピーする
2. 実値入り `.env` は作成せず、`npm run otel:setup` に生成させる
3. Dev Container として開く、または手動起動手順を実行する
4. `http://localhost:3000` で Langfuse を確認する
5. `npm run otel:verify` と `npm run otel:report` で検証と証跡生成を行う

コピー先リポジトリで npm scripts が既に存在する場合は、`otel:setup`、`otel:compose`、`otel:start-session`、`otel:verify`、`otel:report` を既存 scripts に統合する。

---

## 12. 関連ファイル

| ファイル | 役割 |
|------|------|
| `.devcontainer/devcontainer.json` | Dev Container 起動時の compose、port forward、Copilot OTel 設定 |
| `.devcontainer/docker-compose.yml` | workspace と OTel Collector の compose 定義 |
| `.vscode/settings.json` | 手動起動時の Copilot OTel 設定 |
| `scripts/setup-copilot-otel.mjs` | Langfuse compose、`.env`、Collector 設定の生成 |
| `scripts/run-copilot-otel-compose.mjs` | Compose 互換 CLI の検出と実行 |
| `scripts/start-copilot-otel-session.mjs` | Langfuse 起動待ち、ダッシュボード表示、証跡生成 |
| `scripts/capture-copilot-otel-session.mjs` | Markdown とスクリーンショットの生成 |
| `scripts/verify-copilot-otel.mjs` | health、Collector 到達性、環境変数確認 |
| `langfuse/README.md` | Langfuse ローカル監視の補足 |
| `otel-collector/README.md` | Collector 転送設定の補足 |
| `docs/04_reports/otel-sessions/` | セッション証跡の保存先 |
