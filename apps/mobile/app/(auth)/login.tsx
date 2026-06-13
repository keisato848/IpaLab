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
    Platform,
} from 'react-native';
import { loginWithOAuth, loginAsGuest } from '../../src/application/usecases/auth';

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
            {/* ロゴ */}
            <Text style={styles.logo}>臺所</Text>
            <Text style={styles.subtitle}>シカクノ</Text>
            <Text style={styles.tagline}>IPA 試験対策アプリ</Text>

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
                        <ActivityIndicator color="#C9A16A" />
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
        backgroundColor: '#0A0805',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
    },
    logo: {
        fontSize: 48,
        color: '#C9A16A',
        fontWeight: '300',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 20,
        color: '#DCC9A8',
        letterSpacing: 4,
        marginBottom: 8,
    },
    tagline: {
        fontSize: 13,
        color: '#DCC9A8',
        opacity: 0.6,
        marginBottom: 48,
    },
    buttonGroup: {
        width: '100%',
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
        backgroundColor: '#4285F4',
    },
    githubButton: {
        backgroundColor: '#24292F',
    },
    guestButton: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: '#C9A16A',
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    guestText: {
        color: '#C9A16A',
    },
    note: {
        marginTop: 32,
        fontSize: 12,
        color: '#DCC9A8',
        opacity: 0.5,
        textAlign: 'center',
        lineHeight: 18,
    },
});
