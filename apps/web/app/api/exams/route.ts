
import { NextResponse } from 'next/server';
import { containers } from '@/lib/services/cosmos';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const container = containers.exams;

        // Fetch all exams from the Exams container
        const { resources: exams } = await container.items
            .query("SELECT * FROM c ORDER BY c.id DESC")
            .fetchAll();

        return NextResponse.json(exams);
    } catch (error: any) {
        return NextResponse.json(
            { error: "Internal Server Error", details: error.message },
            { status: 500 }
        );
    }
}
