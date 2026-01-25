
import { NextResponse } from 'next/server';
import { getContainer } from '@/lib/cosmos';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const container = await getContainer("Exams");

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
