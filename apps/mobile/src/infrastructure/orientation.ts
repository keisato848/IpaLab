/**
 * 端末別の画面向き制御（WP: タブレット対応）
 *
 * - スマホ（最小幅 < 600dp）: ポートレート固定（既存UXを維持）
 * - タブレット（最小幅 >= 600dp）: 回転許可（横向き可）
 *
 * app.json は orientation:"default"（マニフェストで回転許可）とし、
 * 実際のロック/解除は本モジュールで実行時に制御する。
 */
import { Dimensions } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';

/** Android sw600dp 相当のタブレット判定しきい値。 */
export const TABLET_MIN_WIDTH_DP = 600;

/** 画面の最小辺（dp）でタブレットかどうかを判定する。 */
export function isTabletScreen(): boolean {
    const { width, height } = Dimensions.get('window');
    return Math.min(width, height) >= TABLET_MIN_WIDTH_DP;
}

/**
 * 端末種別に応じて画面の向きを設定する。
 * - タブレット: アンロック（縦横どちらも可）
 * - スマホ: ポートレート固定
 */
export async function applyAdaptiveOrientation(): Promise<void> {
    try {
        if (isTabletScreen()) {
            await ScreenOrientation.unlockAsync();
        } else {
            await ScreenOrientation.lockAsync(
                ScreenOrientation.OrientationLock.PORTRAIT_UP,
            );
        }
    } catch {
        // ネイティブモジュール未リンク（旧ビルド等）でも起動を妨げない
    }
}
