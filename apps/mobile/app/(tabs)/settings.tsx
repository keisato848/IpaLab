/**
 * 設定画面（詳細設計§4・WP-4.4）
 * - テーマ切替（WP-4.4 で実装予定）
 * - 手動同期（WP-4.4 で実装予定）
 * - ログアウト（WP-1.4 で実装）
 */
import { useState, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    StyleSheet,
    ScrollView,
} from 'react-native';
import { useAuthStore } from '../../src/store/auth-store';
import { logout } from '../../src/application/usecases/auth';

export default function SettingsScreen() {
    const { session } = useAuthStore();
    const [loggingOut, setLoggingOut] = useState(false);

    const handleLogout = useCallback(() => {
        Alert.alert(
            'ログアウト',
            'ログアウトしますか？\n未同期のデータは次回ログイン後に同期されます。',
            [
                { text: 'キャンセル', style: 'cancel' },
                {
                    text: 'ログアウト',
                    style: 'destructive',
                    onPress: async () => {
                        setLoggingOut(true);
                        try {
                            await logout();
                            // _layout.tsx が unauthenticated を検知してログイン画面へ遷移
                        } catch {
                            Alert.alert('エラー', 'ログアウトに失敗しました。');
                        } finally {
                            setLoggingOut(false);
                        }
                    },
                },
            ],
        );
    }, []);

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <Text style={styles.title}>設定</Text>

            {/* アカウント情報 */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>アカウント</Text>
                <View style={styles.row}>
                    <Text style={styles.label}>利用モード</Text>
                    <Text style={styles.value}>
                        {session?.authType === 'guest' ? 'ゲスト' : 'ログイン済み'}
                    </Text>
                </View>
                {session?.authType === 'guest' && (
                    <Text style={styles.hint}>
                        ログインするとデータがクラウドに同期されます。
                    </Text>
                )}
            </View>

            {/* 同期（WP-4.4 プレースホルダー） */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>同期</Text>
                <View style={[styles.row, styles.disabledRow]}>
                    <Text style={[styles.label, styles.disabledText]}>手動同期</Text>
                    <Text style={styles.badge}>準備中</Text>
                </View>
            </View>

            {/* ログアウト */}
            <View style={styles.section}>
                <TouchableOpacity
                    style={[styles.logoutButton, loggingOut && styles.disabledRow]}
                    onPress={handleLogout}
                    disabled={loggingOut}
                    accessibilityLabel="ログアウト"
                    accessibilityRole="button"
                >
                    {loggingOut ? (
                        <ActivityIndicator color="#F87171" />
                    ) : (
                        <Text style={styles.logoutText}>ログアウト</Text>
                    )}
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0F1117' },
    content: { padding: 20 },
    title: { fontSize: 24, color: '#CBD5E0', fontWeight: '600', marginBottom: 24 },
    section: {
        marginBottom: 24,
        borderBottomWidth: 1,
        borderBottomColor: '#1A202C',
        paddingBottom: 16,
    },
    sectionTitle: {
        fontSize: 12,
        color: '#0070F3',
        letterSpacing: 1,
        marginBottom: 12,
        textTransform: 'uppercase',
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        minHeight: 48,
    },
    label: { fontSize: 15, color: '#CBD5E0' },
    value: { fontSize: 15, color: '#CBD5E0', opacity: 0.7 },
    hint: { fontSize: 12, color: '#CBD5E0', opacity: 0.5, marginTop: 4 },
    disabledRow: { opacity: 0.4 },
    disabledText: {},
    badge: {
        fontSize: 11,
        color: '#0070F3',
        borderWidth: 1,
        borderColor: '#0070F3',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    logoutButton: {
        height: 52,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#F87171',
        minHeight: 48,
    },
    logoutText: { color: '#F87171', fontSize: 16, fontWeight: '600' },
});
