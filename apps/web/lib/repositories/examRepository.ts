import { getContainer } from '@/lib/cosmos';
// import { Exam } from '@ipa-lab/shared'; // Not available in shared yet

export interface Exam {
    id: string;
    title: string;
    category: string;
    year: number;
    term: string;
    type: string;
    date: string;
    stats?: {
        total: number;
        correctRate: number;
    }
}

export const examRepository = {
    async findAll(): Promise<Exam[]> {
        const container = await getContainer("Exams");
<<<<<<< Updated upstream
        if (!container) return [];
=======
        if (!container) throw new Error("Database not initialized");
>>>>>>> Stashed changes
        const { resources } = await container.items
            .query("SELECT * FROM c ORDER BY c.id DESC")
            .fetchAll();
        return resources;
    },

    async findById(id: string): Promise<Exam | null> {
        const container = await getContainer("Exams");
        if (!container) return null;
        try {
            const { resource } = await container.item(id, id).read();
            return resource || null;
        } catch (e) {
            return null;
        }
    }
};
