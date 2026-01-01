
export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        import('./lib/services/cosmos').then(async (mod) => {
            try {
                await mod.initDatabase();
                console.log('Cosmos DB initialized');
            } catch (e) {
                console.error('Failed to initialize Cosmos DB during startup', e);
            }
        }).catch(err => {
            console.error('Failed to import cosmos service', err);
        });
    }
}
