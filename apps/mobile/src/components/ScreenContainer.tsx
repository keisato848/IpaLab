/**
 * 画面コンテンツを中央寄せ＋最大幅で包むレイアウト・コンテナ。
 *
 * 横長画面（タブレット）でコンテンツが端まで間延びするのを防ぐ。
 * 子に FlatList / ScrollView / View をそのまま置ける（inner は flex:1）。
 * スマホ幅（< maxWidth）では maxWidth が効かず従来どおり全幅になる。
 */
import type { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, layout } from '../constants/theme';

interface ScreenContainerProps {
    children: ReactNode;
    /** 中央カラムの最大幅（既定: 一般コンテンツ幅）。 */
    maxWidth?: number;
}

export function ScreenContainer({
    children,
    maxWidth = layout.contentMaxWidth,
}: ScreenContainerProps) {
    return (
        <View style={styles.outer}>
            <View style={[styles.inner, { maxWidth }]}>{children}</View>
        </View>
    );
}

const styles = StyleSheet.create({
    outer: {
        flex: 1,
        backgroundColor: colors.bgPrimary,
    },
    inner: {
        flex: 1,
        width: '100%',
        alignSelf: 'center',
    },
});
