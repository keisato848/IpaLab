import { NextResponse } from 'next/server';
import { containers } from '@/lib/cosmos';

export const runtime = 'nodejs';

export async function GET() {
    try {
        // Calculate average duration of past successful generations
        const querySpec = {
            query: "SELECT VALUE AVG(c.duration) FROM c WHERE c.type = 'plan_generation'"
        };

        // Note: verify if container exists/initialized. If not, it might throw.
        // For MVP, we assume container exists or we catch error.
        const { resources } = await containers.metrics.items.query(querySpec).fetchAll();

        // resources[0] will be the average number, or undefined/null if no records
        const avg = resources[0];
        const estimatedMs = (avg && typeof avg === 'number') ? Math.round(avg) : 5000; // Default 5s

        return NextResponse.json({ estimatedMs });
    } catch (error) {
        console.error("Failed to get estimate:", error);
        return NextResponse.json({ estimatedMs: 5000 }); // Fallback
    }
}
