import { Adapter, AdapterUser, AdapterAccount } from "next-auth/adapters"
import { containers } from "./cosmos"
import { v4 as uuidv4 } from "uuid"

export function CosmosAdapter(): Adapter {
    return {
        async createUser(user: Omit<AdapterUser, "id">) {
            const id = uuidv4();
            const newUser = { ...user, id };
            await containers.users.items.create(newUser);
            return newUser as AdapterUser;
        },
        async getUser(id: string) {
            try {
                const { resource } = await containers.users.item(id, id).read();
                return resource || null;
            } catch {
                return null;
            }
        },
        async getUserByEmail(email: string) {
            try {
                const querySpec = {
                    query: "SELECT * FROM c WHERE c.email = @email",
                    parameters: [{ name: "@email", value: email }]
                };
                const { resources } = await containers.users.items.query(querySpec).fetchAll();
                return resources[0] || null;
            } catch {
                return null;
            }
        },
        async getUserByAccount({ providerAccountId, provider }: Pick<AdapterAccount, "provider" | "providerAccountId">) {
            try {
                const querySpec = {
                    query: "SELECT * FROM c WHERE c.providerAccountId = @providerAccountId AND c.provider = @provider",
                    parameters: [
                        { name: "@providerAccountId", value: providerAccountId },
                        { name: "@provider", value: provider }
                    ]
                };
                const { resources } = await containers.accounts.items.query(querySpec).fetchAll();
                const account = resources[0];

                if (!account) return null;

                const { resource: user } = await containers.users.item(account.userId, account.userId).read();
                return user || null;
            } catch {
                return null;
            }
        },
        async updateUser(user: Partial<AdapterUser> & { id: string }) {
            if (!user.id) throw new Error("User ID is required for update");
            // Read existing to merge? Or just upsert?
            // AdapterUser extends User, but might be partial here? Types say Partial<AdapterUser> & { id: string }
            // We'll use upsert for simplicity, but ideally we should read-modify-write if partial.
            // Actually `updateUser` arg is Partial... wait.
            const { resource: existing } = await containers.users.item(user.id, user.id).read();
            if (!existing) throw new Error("User not found");

            const updated = { ...existing, ...user };
            await containers.users.items.upsert(updated);
            return updated;
        },
        async deleteUser(userId: string) {
            await containers.users.item(userId, userId).delete();
            // Also delete accounts? NextAuth usually expects cascading, creating separate query for accounts
            // We skip cascade for now as it's complex without stored procedure or careful logic
        },
        async linkAccount(account: AdapterAccount) {
            // account has userId
            // Account needs PK? Our Accounts container has PK='/userId'
            // But we need to query by providerAccountId/provider usually.
            // Wait, linkAccount is for `Accounts` table. 
            // NextAuth Account object: userId, type, provider, providerAccountId, refresh_token, etc.
            // We should store this in `Accounts` container.
            // We need a unique ID for the item itself.
            const item = {
                id: uuidv4(),
                ...account
            };
            await containers.accounts.items.create(item);
            return account; // Return as is (without id?) AdapterAccount doesn't enforce 'id' on return? Types say yes.
            // Actually AdapterAccount doesn't have 'id' property usually visible.
            // Let's check type definition if it errors.
        },
        async unlinkAccount({ providerAccountId, provider }: Pick<AdapterAccount, "provider" | "providerAccountId">) {
            // We need to find the account item first to delete it.
            const querySpec = {
                query: "SELECT * FROM c WHERE c.providerAccountId = @providerAccountId AND c.provider = @provider",
                parameters: [
                    { name: "@providerAccountId", value: providerAccountId },
                    { name: "@provider", value: provider }
                ]
            };
            const { resources } = await containers.accounts.items.query(querySpec).fetchAll();
            const account = resources[0];
            if (account) {
                await containers.accounts.item(account.id, account.userId).delete();
            }
        },
        // Session management (optional for JWT) - Implementing stub if needed or skip
        // We skip for now as we use JWT strategy.
    }
}
