/** 広告関連の型定義 */

/** 広告スロットの位置 */
export type AdPosition = 'header' | 'sidebar' | 'footer' | 'in-content' | 'rewarded';

/** 広告スロットのサイズ */
export type AdSize =
    | 'banner'           // 728×90 (デスクトップ)
    | 'leaderboard'      // 970×90
    | 'rectangle'        // 300×250
    | 'mobile-banner'    // 320×50
    | 'responsive'       // 自動サイズ
    | 'rewarded';        // リワード広告

/** 広告スロットの設定 */
export interface AdSlotConfig {
    id: string;
    position: AdPosition;
    size: AdSize;
    /** 表示対象ページパス（glob パターン） */
    allowedPaths: string[];
    /** 表示禁止ページパス */
    blockedPaths: string[];
    /** 認証ユーザーに表示するか */
    showToAuthenticated: boolean;
}

/** ユーザーの広告同意状態 */
export interface AdConsent {
    analytics: boolean;
    advertising: boolean;
    timestamp: string;
}

/** リワード広告の状態 */
export type RewardedAdState = 'idle' | 'loading' | 'showing' | 'completed' | 'skipped' | 'error';

/** リワード広告のコールバック */
export interface RewardedAdCallbacks {
    onComplete: () => void;
    onSkip: () => void;
    onError?: (error: Error) => void;
}
