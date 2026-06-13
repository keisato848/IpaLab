/**
 * OAuth コールバック画面（詳細設計§5.1）
 *
 * BFF callback → app scheme リダイレクト後に Expo Router が本画面を表示する。
 * expo-auth-session の openAuthSessionAsync が結果を受け取り処理するため、
 * 実際にはこの画面が表示される前に oauth-flow.ts 側で処理が完了している。
 * 画面はローディング表示のみ（ほぼ瞬時に _layout.tsx がルーティングする）。
 */
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';

export default function OAuthResultScreen() {
    return (
        <View style={styles.container}>
            <ActivityIndicator color="#C9A16A" size="large" />
            <Text style={styles.text}>認証中...</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0A0805',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
    },
    text: {
        color: '#DCC9A8',
        fontSize: 14,
    },
});
