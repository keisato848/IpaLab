import HistoryList from '@/components/features/history/HistoryList';

export default function HistoryPage() {
    return (
        <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
            <h1 style={{ marginBottom: '2rem', fontSize: '1.8rem', fontWeight: 'bold' }}>学習履歴</h1>
            <HistoryList />
        </div>
    );
}
