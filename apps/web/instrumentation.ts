
export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const { initDatabase } = await import('./lib/services/cosmos');
        await initDatabase();
        console.log('Cosmos DB initialized');
    }
}
