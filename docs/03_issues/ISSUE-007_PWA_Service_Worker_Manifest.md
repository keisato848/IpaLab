# ISSUE-007: PWA化（Service Worker + Manifest）

| 項目 | 内容 |
|------|------|
| **Issue ID** | ISSUE-007 |
| **優先度** | 中 (Middle) |
| **ステータス** | Open |
| **起票日** | 2026年2月14日 |
| **担当者** | 未割当 |
| **工数見積** | 1〜2週間 |
| **関連ドキュメント** | `docs/04_reports/UIUX_Improvement_Status_Report_20260211.md` Section 3.1, 3.2 |

---

## 📋 課題の概要

現在、シカクノはPWA（Progressive Web App）として動作していない。

UI/UX改善提案書の Phase 3 では、**Service WorkerとManifestの実装**により、オフライン対応とネイティブアプリ同等の体験を提供することを推奨している。

---

## 🔍 現状の問題点

### 調査結果

```bash
$ find apps/web -name "manifest.json" -o -name "sw.js" -o -name "service-worker.js"
(結果: 0件)
```

**現状**:
- Service Worker なし ❌
- PWA Manifest なし ❌
- オフライン機能なし ❌
- ネイティブアプリ風のUIなし ❌

### ユーザー体験の課題

1. **インストール不可**: ホーム画面への追加ができない
2. **オフライン非対応**: 通信が途切れると学習不可
3. **ブラウザUI表示**: アドレスバーが表示され、没入感が低い
4. **プッシュ通知不可**: 学習リマインダーなどが送れない

---

## 💡 提案する解決策

### Phase 3 実装計画

PWA化は大規模な変更となるため、段階的なアプローチを推奨。

---

## 🛠️ 実装ステップ

### Step 1: PWA Manifest の作成

```json
// apps/web/public/manifest.json
{
  "name": "シカクノ - 情報処理技術者試験対策",
  "short_name": "シカクノ",
  "description": "忙しいエンジニアのための情報処理技術者試験対策プラットフォーム",
  "start_url": "/dashboard",
  "display": "standalone",
  "background_color": "#f8f9fa",
  "theme_color": "#0070f3",
  "orientation": "portrait-primary",
  "icons": [
    {
      "src": "/icons/icon-72x72.png",
      "sizes": "72x72",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-96x96.png",
      "sizes": "96x96",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-128x128.png",
      "sizes": "128x128",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-144x144.png",
      "sizes": "144x144",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-152x152.png",
      "sizes": "152x152",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-384x384.png",
      "sizes": "384x384",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable any"
    }
  ],
  "categories": ["education", "productivity"],
  "screenshots": [
    {
      "src": "/screenshots/dashboard.png",
      "sizes": "540x720",
      "type": "image/png"
    },
    {
      "src": "/screenshots/exam.png",
      "sizes": "540x720",
      "type": "image/png"
    }
  ]
}
```

### Step 2: Manifest を HTML にリンク

```tsx
// apps/web/app/layout.tsx
<head>
  <link rel="manifest" href="/manifest.json" />
  <meta name="theme-color" content="#0070f3" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="default" />
  <meta name="apple-mobile-web-app-title" content="シカクノ" />
  <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
</head>
```

### Step 3: Service Worker の実装

```javascript
// apps/web/public/sw.js
const CACHE_NAME = 'shikaku-no-v1';
const STATIC_ASSETS = [
  '/',
  '/dashboard',
  '/exam',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// インストール時のキャッシュ
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// アクティベーション時の古いキャッシュ削除
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch イベント: Cache-First 戦略
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      
      return fetch(event.request).then((response) => {
        // API レスポンスはキャッシュしない
        if (!response || response.status !== 200 || response.type === 'error') {
          return response;
        }
        
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        
        return response;
      });
    })
  );
});
```

### Step 4: Service Worker の登録

```tsx
// apps/web/app/layout.tsx または専用ファイル
useEffect(() => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('Service Worker registered:', registration);
      })
      .catch((error) => {
        console.error('Service Worker registration failed:', error);
      });
  }
}, []);
```

### Step 5: アイコン生成

PWA用のアイコンを複数サイズで用意（72x72 〜 512x512）。

```bash
# ImageMagickなどで生成
convert logo.png -resize 72x72 icon-72x72.png
convert logo.png -resize 96x96 icon-96x96.png
convert logo.png -resize 128x128 icon-128x128.png
# ... (以下省略)
```

### Step 6: Next.js 設定の更新

```javascript
// apps/web/next.config.js
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development'
});

module.exports = withPWA({
  // 既存の設定...
});
```

---

## ✅ 受け入れ基準

- [ ] `manifest.json` が作成され、適切な内容が記載されている
- [ ] PWAアイコンが複数サイズで用意されている
- [ ] Service Workerが登録され、正常に動作している
- [ ] Chrome DevToolsの「Application」タブで「Manifest」が認識される
- [ ] Chrome DevToolsの「Lighthouse」でPWAスコアが80以上
- [ ] モバイルブラウザで「ホーム画面に追加」が表示される
- [ ] ホーム画面から起動すると、アドレスバーが非表示になる
- [ ] オフライン時でも、キャッシュされたページが表示される
- [ ] 既存機能に影響がない

---

## 🔗 関連Issue

- **ISSUE-008**: オフライン学習機能の実装（PWA化と同時進行）

---

## 📝 備考

- UI/UX改善提案書の Phase 3 に該当
- **優先度が中**の理由: ユーザー体験の大幅向上だが、現状でもWebアプリとして機能している
- **工数が大きい（1〜2週間）**: 複数のステップと、アイコン生成、テストが必要
- PWAライブラリの選択肢:
  - **next-pwa** (推奨): Next.js用の軽量PWAライブラリ
  - カスタムService Worker: より細かい制御が可能
- 実装後、PWAインストール率、オフライン利用率を計測すると良い
