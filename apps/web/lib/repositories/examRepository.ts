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
        const { resources } = await container.items
            .query("SELECT * FROM c ORDER BY c.id DESC")
            .fetchAll();
        return resources;
    },

    async findById(id: string): Promise<Exam | null> {
        const container = await getContainer("Exams");
        try {
            const { resource } = await container.item(id, id).read();
            return resource || null;
        } catch (e) {
            return null;
        }
    }
};
