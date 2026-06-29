/**
 * 画面向き制御のテスト（WP: タブレット対応）
 * - Dimensions と expo-screen-orientation をモックし、端末別の挙動を検証。
 */
import { Dimensions } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import { isTabletScreen, applyAdaptiveOrientation } from '../orientation';

jest.mock('expo-screen-orientation', () => ({
    lockAsync: jest.fn().mockResolvedValue(undefined),
    unlockAsync: jest.fn().mockResolvedValue(undefined),
    OrientationLock: { PORTRAIT_UP: 'PORTRAIT_UP' },
}));

const mockLock = ScreenOrientation.lockAsync as jest.MockedFunction<
    typeof ScreenOrientation.lockAsync
>;
const mockUnlock = ScreenOrientation.unlockAsync as jest.MockedFunction<
    typeof ScreenOrientation.unlockAsync
>;

function setWindow(width: number, height: number) {
    jest.spyOn(Dimensions, 'get').mockReturnValue({
        width,
        height,
        scale: 2,
        fontScale: 1,
    } as ReturnType<typeof Dimensions.get>);
}

beforeEach(() => {
    mockLock.mockClear();
    mockUnlock.mockClear();
});

describe('orientation', () => {
    it('スマホ寸法（最小辺 < 600dp）ではタブレットと判定しない', () => {
        setWindow(390, 844);
        expect(isTabletScreen()).toBe(false);
    });

    it('タブレット寸法（最小辺 >= 600dp）ではタブレットと判定する', () => {
        setWindow(800, 1280);
        expect(isTabletScreen()).toBe(true);
    });

    it('スマホではポートレート固定する', async () => {
        setWindow(390, 844);
        await applyAdaptiveOrientation();
        expect(mockLock).toHaveBeenCalledWith(
            ScreenOrientation.OrientationLock.PORTRAIT_UP,
        );
        expect(mockUnlock).not.toHaveBeenCalled();
    });

    it('タブレットでは回転を許可（アンロック）する', async () => {
        setWindow(1600, 2560);
        await applyAdaptiveOrientation();
        expect(mockUnlock).toHaveBeenCalledTimes(1);
        expect(mockLock).not.toHaveBeenCalled();
    });
});
