import { Text, View } from 'react-native';

/**
 * ログイン画面（S: ログイン、詳細設計§4）
 * OAuth/ゲスト導線はWP-1で実装する。オフライン時はゲスト開始のみ許可。
 */
export default function LoginScreen() {
    return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text>シカクノ（WP-1でOAuth/ゲスト実装）</Text>
        </View>
    );
}
