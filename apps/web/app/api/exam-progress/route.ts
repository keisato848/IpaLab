import { NextRequest, NextResponse } from 'next/server';
import { getContainer } from '@/lib/cosmos';

export const dynamic = 'force-dynamic';

export interface ExamProgress {
    id: string; // "userId-examId"
    userId: string;
    examId: string;
    bookmarks: string[]; // List of Question IDs
    statusMap: Record<string, {
        isCorrect: boolean;
        answeredAt: string;
    }>;
    updatedAt: string;
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        const examId = searchParams.get('examId');

        if (!userId || !examId) {
            return NextResponse.json({ error: "userId and examId required" }, { status: 400 });
        }

        const id = `${userId}-${examId}`;
        try {
            const container = await getContainer("ExamProgress");
            if (!container) throw new Error("Database not initialized");

            const { resource } = await container.item(id, userId).read();
            if (!resource) {
                // Return empty progress if not found
                return NextResponse.json({
                    id,
                    userId,
                    examId,
                    bookmarks: [],
                    statusMap: {},
                    updatedAt: new Date().toISOString()
                });
            }
            return NextResponse.json(resource);
        } catch (e: any) {
            // 404 is fine, return empty
            if (e.code === 404) {
                return NextResponse.json({
                    id,
                    userId,
                    examId,
                    bookmarks: [],
                    statusMap: {},
                    updatedAt: new Date().toISOString()
                });
            }
            throw e;
        }

    } catch (error: any) {
        return NextResponse.json(
            { error: "Internal Server Error", details: error.message },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { userId, examId, bookmarks, statusUpdate } = body;

        if (!userId || !examId) {
            return NextResponse.json({ error: "userId and examId required" }, { status: 400 });
        }

        const id = `${userId}-${examId}`;
        const container = await getContainer("ExamProgress");
        if (!container) throw new Error("Database not initialized");

        // Fetch existing or init
        let progress: ExamProgress;
        try {
            const { resource } = await container.item(id, userId).read();
            if (resource) {
                progress = resource;
            } else {
                progress = {
                    id,
                    userId,
                    examId,
                    bookmarks: [],
                    statusMap: {},
                    updatedAt: new Date().toISOString()
                };
            }
        } catch (e) {
            progress = {
                id,
                userId,
                examId,
                bookmarks: [],
                statusMap: {},
                updatedAt: new Date().toISOString()
            };
        }

        // Update fields if provided
        if (bookmarks) {
            progress.bookmarks = bookmarks;
        }

        if (statusUpdate) {
            // statusUpdate: { questionId: string, isCorrect: boolean }
            progress.statusMap[statusUpdate.questionId] = {
                isCorrect: statusUpdate.isCorrect,
                answeredAt: new Date().toISOString()
            };
        }

        progress.updatedAt = new Date().toISOString();

        const { resource } = await container.items.upsert(progress);
        return NextResponse.json(resource);

    } catch (error: any) {
        return NextResponse.json(
            { error: "Internal Server Error", details: error.message },
            { status: 500 }
        );
    }
}
