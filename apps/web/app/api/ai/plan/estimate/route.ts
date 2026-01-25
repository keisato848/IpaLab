import { NextResponse } from 'next/server';
import { getContainer } from '@/lib/cosmos';
import { getAppInsightsClient } from '@/lib/appinsights';

export const runtime = 'nodejs';

export async function GET() {
    try {
        // ... (lines 9-21)
        // Calculate average duration of past successful generations
        const querySpec = {
            query: "SELECT VALUE AVG(c.duration) FROM c WHERE c.type = 'plan_generation'"
        };

        const container = await getContainer("Metrics");
        const { resources } = await container.items.query(querySpec).fetchAll();
        const avg = resources[0];
        const estimatedMs = (avg && typeof avg === 'number') ? Math.round(avg) : 5000;

        return NextResponse.json({ estimatedMs });
    } catch (error: any) {
        console.error("Failed to get estimate:", error);

        const client = getAppInsightsClient();
        if (client) {
            client.trackException({ exception: error });
        }

        return NextResponse.json({ estimatedMs: 5000 }); // Fallback
    }
}
