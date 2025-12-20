export const sharedTest = () => {
    return "Hello from shared package!";
};

// Placeholder for Spaced Repetition logic
export class SpacedRepetition {
    calculateNextReview(currentData: any, isCorrect: boolean): Date {
        // Stub implementation
        const now = new Date();
        return new Date(now.setDate(now.getDate() + 1));
    }
}
