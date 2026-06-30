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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { bootstrapAuth, restoreSession } from '../src/application/usecases/auth';
import { applyAdaptiveOrientation } from '../src/infrastructure/orientation';
import { useAuthStore } from '../src/store/auth-store';

// 起動時に一度だけ auth 基盤を初期化
bootstrapAuth();

// React Query クライアント（アプリ全体で共有）
const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 1, staleTime: 5 * 60 * 1000 } },
});

export default function RootLayout() {
    const router = useRouter();
    const segments = useSegments();
    const { status } = useAuthStore();

    // セッション復元
    useEffect(() => {
        restoreSession();
    }, []);

    // 端末種別に応じた画面の向き制御（スマホ=縦固定 / タブレット=回転許可）
    useEffect(() => {
        applyAdaptiveOrientation();
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

    return (
        <QueryClientProvider client={queryClient}>
            {status === 'initializing' ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F1117' }}>
                    <ActivityIndicator color="#0070F3" size="large" />
                </View>
            ) : (
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
            )}
        </QueryClientProvider>
    );
}
