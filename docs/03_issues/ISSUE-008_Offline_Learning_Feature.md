# ISSUE-008: オフライン学習機能の実装

| 項目 | 内容 |
|------|------|
| **Issue ID** | ISSUE-008 |
| **優先度** | 中 (Middle) |
| **ステータス** | Open |
| **起票日** | 2026年2月14日 |
| **担当者** | 未割当 |
| **工数見積** | 2〜3週間 |
| **関連ドキュメント** | `docs/04_reports/UIUX_Improvement_Status_Report_20260211.md` Section 3.1 |

---

## 📋 課題の概要

地下鉄など通信不安定な環境での学習を可能にするため、オフライン対応が必要。

UI/UX改善提案書では、**Service Workerによる問題データのキャッシュ**と、**オフライン時の学習履歴保存**を推奨している。

---

## 🔍 現状の問題点

### 調査結果

- オフライン対応なし ❌
- 通信が途切れると、問題データが取得できず学習不可 ❌
- 学習履歴の保存もオンライン必須 ❌

### ユーザー体験の課題

1. **通勤・通学での利用困難**: 地下鉄、トンネル内で学習できない
2. **機会損失**: スキマ時間を活用できず、学習機会を逃す
3. **ストレス**: 通信エラーによる学習中断

---

## 💡 提案する解決策

### オフライン学習のアーキテクチャ

```
[オンライン時]
1. 問題データをIndexedDBにキャッシュ
2. 学習履歴をlocalStorageに一時保存
3. 定期的にサーバーと同期

[オフライン時]
1. IndexedDBから問題データを取得
2. 学習履歴をlocalStorageに蓄積
3. オンライン復帰時に自動同期
```

---

## 🛠️ 実装ステップ

### Step 1: IndexedDB による問題データキャッシュ

```typescript
// apps/web/lib/offline-db.ts
import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface OfflineDB extends DBSchema {
  questions: {
    key: string; // questionId
    value: Question;
    indexes: { 'by-exam': string }; // examId
  };
  exams: {
    key: string; // examId
    value: Exam;
  };
}

class OfflineDataManager {
  private db: IDBPDatabase<OfflineDB> | null = null;

  async init() {
    this.db = await openDB<OfflineDB>('shikaku-no-offline', 1, {
      upgrade(db) {
        // Questions store
        const questionStore = db.createObjectStore('questions', { keyPath: 'id' });
        questionStore.createIndex('by-exam', 'examId');
        
        // Exams store
        db.createObjectStore('exams', { keyPath: 'id' });
      },
    });
  }

  // 問題データをキャッシュ
  async cacheQuestions(questions: Question[]) {
    if (!this.db) await this.init();
    const tx = this.db!.transaction('questions', 'readwrite');
    await Promise.all(questions.map(q => tx.store.put(q)));
    await tx.done;
  }

  // オフライン時に問題データを取得
  async getQuestion(questionId: string): Promise<Question | undefined> {
    if (!this.db) await this.init();
    return this.db!.get('questions', questionId);
  }

  // 試験の全問題を取得
  async getQuestionsByExam(examId: string): Promise<Question[]> {
    if (!this.db) await this.init();
    return this.db!.getAllFromIndex('questions', 'by-exam', examId);
  }

  // 試験データをキャッシュ
  async cacheExam(exam: Exam) {
    if (!this.db) await this.init();
    await this.db!.put('exams', exam);
  }

  // オフライン時に試験データを取得
  async getExam(examId: string): Promise<Exam | undefined> {
    if (!this.db) await this.init();
    return this.db!.get('exams', examId);
  }
}

export const offlineDB = new OfflineDataManager();
```

### Step 2: オフライン検知とデータ取得戦略

```typescript
// apps/web/lib/api.ts に追加
import { offlineDB } from './offline-db';

export async function getQuestionWithOfflineSupport(
  examId: string,
  questionId: string
): Promise<Question | null> {
  // オンライン時: APIから取得してキャッシュ
  if (navigator.onLine) {
    try {
      const question = await fetch(`/api/questions/${examId}/${questionId}`).then(r => r.json());
      // キャッシュに保存
      await offlineDB.cacheQuestions([question]);
      return question;
    } catch (error) {
      console.warn('API fetch failed, trying offline cache:', error);
    }
  }
  
  // オフライン時: キャッシュから取得
  const cached = await offlineDB.getQuestion(questionId);
  return cached || null;
}
```

### Step 3: 学習履歴のオフライン対応

```typescript
// apps/web/lib/offline-sync.ts
interface PendingRecord {
  id: string;
  record: LearningRecord;
  timestamp: number;
}

class OfflineSyncManager {
  private PENDING_KEY = 'pending-learning-records';

  // オフライン時の学習履歴を保存
  async savePendingRecord(record: LearningRecord) {
    const pending = this.getPendingRecords();
    pending.push({
      id: crypto.randomUUID(),
      record,
      timestamp: Date.now()
    });
    localStorage.setItem(this.PENDING_KEY, JSON.stringify(pending));
  }

  // 保留中の学習履歴を取得
  getPendingRecords(): PendingRecord[] {
    const saved = localStorage.getItem(this.PENDING_KEY);
    return saved ? JSON.parse(saved) : [];
  }

  // オンライン復帰時に同期
  async syncPendingRecords() {
    if (!navigator.onLine) return;

    const pending = this.getPendingRecords();
    if (pending.length === 0) return;

    try {
      // バッチでサーバーに送信
      await fetch('/api/learning-records/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pending.map(p => p.record))
      });

      // 成功したらクリア
      localStorage.removeItem(this.PENDING_KEY);
      console.log(`Synced ${pending.length} offline records`);
    } catch (error) {
      console.error('Failed to sync offline records:', error);
    }
  }
}

export const offlineSync = new OfflineSyncManager();
```

### Step 4: オンライン/オフライン状態の監視

```tsx
// apps/web/hooks/useOnlineStatus.ts
import { useState, useEffect } from 'react';
import { offlineSync } from '@/lib/offline-sync';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // オンライン復帰時に自動同期
      offlineSync.syncPendingRecords();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
```

### Step 5: UI へのオフライン状態表示

```tsx
// apps/web/components/common/OfflineIndicator.tsx
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import styles from './OfflineIndicator.module.css';

export default function OfflineIndicator() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className={styles.indicator}>
      📡 オフライン - キャッシュから学習中
    </div>
  );
}
```

### Step 6: 問題データの事前ダウンロード機能

```tsx
// apps/web/components/features/exam/DownloadForOffline.tsx
export default function DownloadForOffline({ examId }: { examId: string }) {
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      // 試験の全問題を取得
      const questions = await fetch(`/api/exams/${examId}/questions`).then(r => r.json());
      
      // IndexedDBにキャッシュ
      for (let i = 0; i < questions.length; i++) {
        await offlineDB.cacheQuestions([questions[i]]);
        setProgress(Math.round(((i + 1) / questions.length) * 100));
      }
      
      alert('オフライン学習用データをダウンロードしました！');
    } catch (error) {
      alert('ダウンロードに失敗しました');
    } finally {
      setDownloading(false);
      setProgress(0);
    }
  };

  return (
    <button onClick={handleDownload} disabled={downloading}>
      {downloading ? `ダウンロード中... ${progress}%` : '📥 オフライン用にダウンロード'}
    </button>
  );
}
```

---

## ✅ 受け入れ基準

- [ ] IndexedDBによる問題データキャッシュが動作する
- [ ] オフライン時でも、キャッシュされた問題が表示される
- [ ] オフライン時の学習履歴がlocalStorageに保存される
- [ ] オンライン復帰時に、保留中の学習履歴が自動同期される
- [ ] オフライン状態がUIに明示される（インジケーター表示）
- [ ] 事前ダウンロード機能が動作する
- [ ] オフライン学習後、オンライン復帰時にデータが正しく反映される
- [ ] 既存のオンライン機能に影響がない

---

## 🔗 関連Issue

- **ISSUE-007**: PWA化（Service Worker + Manifest）- 前提条件

---

## 📝 備考

- UI/UX改善提案書の Phase 3 に該当
- **優先度が中**の理由: 通勤・通学時の学習体験向上だが、現状でもオンライン学習は可能
- **工数が大きい（2〜3週間）**: IndexedDB、同期ロジック、UIの実装が必要
- **ISSUE-007（PWA化）と同時進行を推奨**: Service Workerと合わせることで、より効果的なオフライン対応が可能
- 技術スタック:
  - **idb**: IndexedDBのPromiseベースラッパー
  - **Service Worker**: 静的アセットのキャッシュ
  - **localStorage**: 学習履歴の一時保存
- 実装後、オフライン学習率、同期成功率を計測すると良い
