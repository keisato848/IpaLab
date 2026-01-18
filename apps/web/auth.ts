import NextAuth, { NextAuthOptions } from "next-auth"
import GitHub from "next-auth/providers/github"
import Google from "next-auth/providers/google"
import { CosmosAdapter } from "@/lib/auth-adapter"

export const authOptions: NextAuthOptions = {
    providers: [
        GitHub({
            clientId: process.env.AUTH_GITHUB_ID!,
            clientSecret: process.env.AUTH_GITHUB_SECRET!,
        }),
        Google({
            clientId: process.env.AUTH_GOOGLE_ID!,
            clientSecret: process.env.AUTH_GOOGLE_SECRET!,
        }),
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
}
