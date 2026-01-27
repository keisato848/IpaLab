import { Adapter, AdapterUser, AdapterAccount } from "next-auth/adapters"
import { getContainer } from "./cosmos"
import { v4 as uuidv4 } from "uuid"

export function CosmosAdapter(): Adapter {
    return {
        async createUser(user: Omit<AdapterUser, "id">) {
            const id = uuidv4();
            const newUser = { ...user, id };
            const container = await getContainer("Users");
<<<<<<< Updated upstream
            if (!container) throw new Error("Database not available");
=======
            if (!container) throw new Error("DB not ready");

>>>>>>> Stashed changes
            await container.items.create(newUser);
            return newUser as AdapterUser;
        },
        async getUser(id: string) {
            try {
                const container = await getContainer("Users");
                if (!container) return null;
<<<<<<< Updated upstream
=======

>>>>>>> Stashed changes
                const { resource } = await container.item(id, id).read();
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
                const container = await getContainer("Users");
                if (!container) return null;
<<<<<<< Updated upstream
=======

>>>>>>> Stashed changes
                const { resources } = await container.items.query(querySpec).fetchAll();
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
                const accountsContainer = await getContainer("Accounts");
                if (!accountsContainer) return null;
<<<<<<< Updated upstream
=======

>>>>>>> Stashed changes
                const { resources } = await accountsContainer.items.query(querySpec).fetchAll();
                const account = resources[0];

                if (!account) return null;

                const usersContainer = await getContainer("Users");
                if (!usersContainer) return null;
<<<<<<< Updated upstream
=======

>>>>>>> Stashed changes
                const { resource: user } = await usersContainer.item(account.userId, account.userId).read();
                return user || null;
            } catch {
                return null;
            }
        },
        async updateUser(user: Partial<AdapterUser> & { id: string }) {
            if (!user.id) throw new Error("User ID is required for update");
            const container = await getContainer("Users");
<<<<<<< Updated upstream
            if (!container) throw new Error("Database not available");
=======
            if (!container) throw new Error("DB not ready");

>>>>>>> Stashed changes
            const { resource: existing } = await container.item(user.id, user.id).read();
            if (!existing) throw new Error("User not found");

            const updated = { ...existing, ...user };
            await container.items.upsert(updated);
            return updated;
        },
        async deleteUser(userId: string) {
            const container = await getContainer("Users");
<<<<<<< Updated upstream
            if (!container) throw new Error("Database not available");
=======
            if (!container) return; // Cannot delete if DB missing

>>>>>>> Stashed changes
            await container.item(userId, userId).delete();
        },
        async linkAccount(account: AdapterAccount) {
            const item = {
                id: uuidv4(),
                ...account
            };
            const container = await getContainer("Accounts");
<<<<<<< Updated upstream
            if (!container) throw new Error("Database not available");
=======
            if (!container) throw new Error("DB not ready");

>>>>>>> Stashed changes
            await container.items.create(item);
            return account;
        },
        async unlinkAccount({ providerAccountId, provider }: Pick<AdapterAccount, "provider" | "providerAccountId">) {
            const querySpec = {
                query: "SELECT * FROM c WHERE c.providerAccountId = @providerAccountId AND c.provider = @provider",
                parameters: [
                    { name: "@providerAccountId", value: providerAccountId },
                    { name: "@provider", value: provider }
                ]
            };
            const container = await getContainer("Accounts");
<<<<<<< Updated upstream
            if (!container) return; // Or throw
=======
            if (!container) return;

>>>>>>> Stashed changes
            const { resources } = await container.items.query(querySpec).fetchAll();
            const account = resources[0];
            if (account) {
                await container.item(account.id, account.userId).delete();
            }
        },
    }
}
