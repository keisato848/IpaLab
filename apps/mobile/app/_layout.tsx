import { Stack } from 'expo-router';

/**
 * ルートレイアウト（詳細設計§2）
 * 認証グループとタブグループを分離する。
 */
export default function RootLayout() {
    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
        </Stack>
    );
}
