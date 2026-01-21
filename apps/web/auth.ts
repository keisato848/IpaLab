import NextAuth, { NextAuthOptions } from "next-auth"
import { Provider } from "next-auth/providers/index"
import GitHub from "next-auth/providers/github"
import Google from "next-auth/providers/google"
import { CosmosAdapter } from "@/lib/auth-adapter"

const providers: Provider[] = [];

// Add GitHub provider only if its environment variables are set
if (process.env.GITHUB_ID && process.env.GITHUB_SECRET) {
    providers.push(
        GitHub({
            clientId: process.env.GITHUB_ID,
            clientSecret: process.env.GITHUB_SECRET,
        })
    );
}

// Add Google provider only if its environment variables are set
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.push(
        Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        })
    );
}


export const authOptions: NextAuthOptions = {
    providers: providers,
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
