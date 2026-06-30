import { Tabs } from 'expo-router';

/** 主要タブ: ホーム、問題、計画、履歴、設定（詳細設計§2） */
export default function TabsLayout() {
    return (
        <Tabs>
            <Tabs.Screen name="dashboard" options={{ title: 'ホーム' }} />
            <Tabs.Screen name="exams" options={{ title: '問題' }} />
            <Tabs.Screen name="plan" options={{ title: '計画' }} />
            <Tabs.Screen name="history" options={{ title: '履歴' }} />
            <Tabs.Screen name="settings" options={{ title: '設定' }} />
        </Tabs>
    );
}
