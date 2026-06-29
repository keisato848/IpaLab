/**
 * ログイン画面（詳細設計§4）
 *
 * - Google / GitHub OAuth ボタン
 * - ゲスト利用ボタン（オフライン時も常に有効）
 * - OAuth 取消・ネットワークエラー時のフィードバック表示
 */
import { useState, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ActivityIndicator,
    StyleSheet,
    Alert,
} from 'react-native';
import { loginWithOAuth, loginAsGuest } from '../../src/application/usecases/auth';
import { colors, layout } from '../../src/constants/theme';

type LoadingState = 'idle' | 'google' | 'github' | 'guest';

export default function LoginScreen() {
    const [loading, setLoading] = useState<LoadingState>('idle');

    const handleOAuth = useCallback(async (provider: 'google' | 'github') => {
        setLoading(provider);
        try {
            const result = await loginWithOAuth(provider);
            if (!result.success) {
                if (result.message !== 'User cancelled OAuth flow') {
                    Alert.alert('ログインエラー', result.message);
                }
            }
            // 成功時は _layout.tsx の status 変化で自動遷移
        } finally {
            setLoading('idle');
        }
    }, []);

    const handleGuest = useCallback(async () => {
        setLoading('guest');
        try {
            const result = await loginAsGuest();
            if (!result.success) {
                Alert.alert('エラー', result.message);
            }
        } finally {
            setLoading('idle');
        }
    }, []);

    const isLoading = loading !== 'idle';

    return (
        <View style={styles.container}>
            {/* ロゴ（shikakuno ブランド） */}
            <Text style={styles.logo}>シカクノ</Text>
            <Text style={styles.tagline}>情報処理技術者試験 学習プラットフォーム</Text>

            <View style={styles.buttonGroup}>
                {/* Google */}
                <TouchableOpacity
                    style={[styles.button, styles.googleButton]}
                    onPress={() => handleOAuth('google')}
                    disabled={isLoading}
                    accessibilityLabel="Googleでログイン"
                    accessibilityRole="button"
                >
                    {loading === 'google' ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.buttonText}>Google でログイン</Text>
                    )}
                </TouchableOpacity>

                {/* GitHub */}
                <TouchableOpacity
                    style={[styles.button, styles.githubButton]}
                    onPress={() => handleOAuth('github')}
                    disabled={isLoading}
                    accessibilityLabel="GitHubでログイン"
                    accessibilityRole="button"
                >
                    {loading === 'github' ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.buttonText}>GitHub でログイン</Text>
                    )}
                </TouchableOpacity>

                {/* ゲスト */}
                <TouchableOpacity
                    style={[styles.button, styles.guestButton]}
                    onPress={handleGuest}
                    disabled={isLoading}
                    accessibilityLabel="ゲストとして利用する"
                    accessibilityRole="button"
                >
                    {loading === 'guest' ? (
                        <ActivityIndicator color={colors.accent} />
                    ) : (
                        <Text style={[styles.buttonText, styles.guestText]}>
                            ゲストとして利用する
                        </Text>
                    )}
                </TouchableOpacity>
            </View>

            <Text style={styles.note}>
                ゲスト利用はオフラインでも可能です。{'\n'}
                ログイン後にゲスト記録を引き継げます。
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.bgPrimary,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
    },
    logo: {
        fontSize: 44,
        color: colors.accent,
        fontWeight: '700',
        letterSpacing: 2,
        marginBottom: 8,
    },
    tagline: {
        fontSize: 13,
        color: colors.textSecondary,
        opacity: 0.8,
        marginBottom: 48,
    },
    buttonGroup: {
        width: '100%',
        maxWidth: layout.formMaxWidth,
        gap: 12,
    },
    button: {
        height: 52,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 48, // A11y: 48dp タップ領域
    },
    googleButton: {
        backgroundColor: colors.google,
    },
    githubButton: {
        backgroundColor: colors.github,
    },
    guestButton: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: colors.accent,
    },
    buttonText: {
        color: colors.white,
        fontSize: 16,
        fontWeight: '600',
    },
    guestText: {
        color: colors.accent,
    },
    note: {
        marginTop: 32,
        fontSize: 12,
        color: colors.textTertiary,
        textAlign: 'center',
        lineHeight: 18,
    },
});
