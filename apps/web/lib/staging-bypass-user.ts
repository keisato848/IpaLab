import { getContainer } from "@/lib/cosmos"

type StagingBypassUser = {
    id: string
    name?: string | null
    email?: string | null
    image?: string | null
}

type UserResource = {
    id: string
    name?: string | null
    email?: string | null
    image?: string | null
}

type AccountResource = {
    userId: string
}

const DEFAULT_STAGING_BYPASS_USER: StagingBypassUser = {
    id: "staging-keisato848",
    name: "keisato848",
    email: "keisato848@staging.local",
    image: "https://avatars.githubusercontent.com/keisato848",
}

function normalizeUser(user: UserResource): StagingBypassUser {
    return {
        id: user.id,
        name: user.name || DEFAULT_STAGING_BYPASS_USER.name,
        email: user.email || DEFAULT_STAGING_BYPASS_USER.email,
        image: user.image || DEFAULT_STAGING_BYPASS_USER.image,
    }
}

async function getUserById(userId: string): Promise<UserResource | null> {
    try {
        const usersContainer = await getContainer("Users")
        if (!usersContainer) return null

        const { resource } = await usersContainer.item(userId, userId).read<UserResource>()
        return resource || null
    } catch {
        return null
    }
}

async function getUserByEmail(email: string): Promise<UserResource | null> {
    try {
        const usersContainer = await getContainer("Users")
        if (!usersContainer) return null

        const { resources } = await usersContainer.items.query<UserResource>({
            query: "SELECT * FROM c WHERE c.email = @email",
            parameters: [{ name: "@email", value: email }],
        }).fetchAll()

        return resources[0] || null
    } catch {
        return null
    }
}

async function getUserByGitHubAccountId(providerAccountId: string): Promise<UserResource | null> {
    try {
        const accountsContainer = await getContainer("Accounts")
        if (!accountsContainer) return null

        const { resources } = await accountsContainer.items.query<AccountResource>({
            query: "SELECT * FROM c WHERE c.provider = @provider AND c.providerAccountId = @providerAccountId",
            parameters: [
                { name: "@provider", value: "github" },
                { name: "@providerAccountId", value: providerAccountId },
            ],
        }).fetchAll()

        const account = resources[0]
        if (!account?.userId) return null

        return getUserById(account.userId)
    } catch {
        return null
    }
}

export function getDefaultStagingBypassUser(): StagingBypassUser {
    return { ...DEFAULT_STAGING_BYPASS_USER }
}

export function hasStagingBypassTargetConfig(): boolean {
    return Boolean(
        process.env.STAGING_BYPASS_TARGET_USER_ID?.trim() ||
        process.env.STAGING_BYPASS_TARGET_GITHUB_ACCOUNT_ID?.trim() ||
        process.env.STAGING_BYPASS_TARGET_EMAIL?.trim()
    )
}

export async function resolveStagingBypassUser(): Promise<StagingBypassUser | null> {
    const targetUserId = process.env.STAGING_BYPASS_TARGET_USER_ID?.trim()
    if (targetUserId) {
        const user = await getUserById(targetUserId)
        return user ? normalizeUser(user) : null
    }

    const targetGitHubAccountId = process.env.STAGING_BYPASS_TARGET_GITHUB_ACCOUNT_ID?.trim()
    if (targetGitHubAccountId) {
        const user = await getUserByGitHubAccountId(targetGitHubAccountId)
        return user ? normalizeUser(user) : null
    }

    const targetEmail = process.env.STAGING_BYPASS_TARGET_EMAIL?.trim()
    if (targetEmail) {
        const user = await getUserByEmail(targetEmail)
        return user ? normalizeUser(user) : null
    }

    return null
}