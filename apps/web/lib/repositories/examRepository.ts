import { containers } from '../services/cosmos';
import { SqlQuerySpec } from '@azure/cosmos';

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
        completed: number;
        correctRate: number;
    }
}

export const examRepository = {
    async getAll(): Promise<Exam[]> {
        const querySpec: SqlQuerySpec = {
            query: "SELECT * FROM c ORDER BY c.year DESC, c.term DESC"
        };
        const { resources } = await containers.exams.items.query(querySpec).fetchAll();
        return resources as Exam[];
    },

    async getById(id: string): Promise<Exam | null> {
        const { resource } = await containers.exams.item(id, id).read();
        return (resource as Exam) || null;
    }
};
