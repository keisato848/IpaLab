/**
 * ScreenContainer のテスト（WP: タブレット対応）
 * - 子要素をそのまま描画すること（中央寄せ＋最大幅の表示ラッパー）。
 */
import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { ScreenContainer } from '../ScreenContainer';

describe('ScreenContainer', () => {
    it('子要素を描画する', () => {
        render(
            <ScreenContainer>
                <Text>中身</Text>
            </ScreenContainer>,
        );
        expect(screen.getByText('中身')).toBeTruthy();
    });

    it('maxWidth を指定しても子要素を描画する', () => {
        render(
            <ScreenContainer maxWidth={480}>
                <Text>カスタム幅</Text>
            </ScreenContainer>,
        );
        expect(screen.getByText('カスタム幅')).toBeTruthy();
    });
});
