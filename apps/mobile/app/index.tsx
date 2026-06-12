import { Redirect } from 'expo-router';

/**
 * エントリーポイント。
 * セッション復元実装（WP-1.4）までは暫定的にログインへ誘導する。
 */
export default function Index() {
    return <Redirect href="/(auth)/login" />;
}
