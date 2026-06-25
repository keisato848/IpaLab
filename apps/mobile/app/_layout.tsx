/**
 * ルートレイアウト（詳細設計§2・§4）
 *
 * - 起動時に bootstrapAuth() → restoreSession() を実行する。
 * - status に応じて (auth)/login または (tabs) へナビゲートする。
 * - status === 'initializing' の間はスプラッシュ相当のローディング表示。
 */
import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { bootstrapAuth, restoreSession } from '../src/application/usecases/auth';
import { useAuthStore } from '../src/store/auth-store';

// 起動時に一度だけ auth 基盤を初期化
bootstrapAuth();

export default function RootLayout() {
    const router = useRouter();
    const segments = useSegments();
    const { status } = useAuthStore();

    // セッション復元
    useEffect(() => {
        restoreSession();
    }, []);

    // status 変化に応じてルーティング
    useEffect(() => {
        if (status === 'initializing') return;

        const inAuthGroup = segments[0] === '(auth)';

        if (status === 'unauthenticated' && !inAuthGroup) {
            router.replace('/(auth)/login');
        } else if (status === 'authenticated' && inAuthGroup) {
            router.replace('/(tabs)/dashboard');
        }
    }, [status, segments]);

    if (status === 'initializing') {
        return (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F1117' }}>
                <ActivityIndicator color="#0070F3" size="large" />
            </View>
        );
    }

    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="exam" />
            <Stack.Screen name="scoring" />
            <Stack.Screen name="history" />
            <Stack.Screen name="plan" />
            <Stack.Screen name="sync-status" />
        </Stack>
    );
}
