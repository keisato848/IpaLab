
import NextAuth, { DefaultSession } from "next-auth"
import { JWT } from "next-auth/jwt"

declare module "next-auth" {
    /**
     * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
     */
    interface Session {
        user: {
            /** ユーザーID */
            id: string
            /** ユーザーロール */
            role: "user" | "admin"
        } & DefaultSession["user"]
    }

    interface User {
        id: string
        role?: "user" | "admin"
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        role?: "user" | "admin"
    }
}
