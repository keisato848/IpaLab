import { getContainer } from '@/lib/cosmos';
import { Exam } from '@ipa-lab/shared';

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
