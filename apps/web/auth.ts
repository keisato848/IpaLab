import NextAuth from "next-auth"
import GitHub from "next-auth/providers/github"
import Google from "next-auth/providers/google"
import { CosmosAdapter } from "@/lib/auth-adapter"

export const { handlers, auth, signIn, signOut } = NextAuth({
    providers: [
        GitHub,
        Google,
    ],
    callbacks: {
        async session({ session, token, user }) {
            if (session.user) {
                session.user.id = token.sub || ""; // Use token sub as ID for now (JWT strategy)
            }
            return session;
        },
        async jwt({ token, user }) {
            if (user) {
                token.sub = user.id;
            }
            return token;
        }
    },
    pages: {
        signIn: '/login', // Custom login page
    },
    adapter: CosmosAdapter(),
    session: { strategy: "jwt" }, // Start with JWT, switch to Database later if needed/compatible with Adapter
})
