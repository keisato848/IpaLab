import NextAuth, { NextAuthOptions } from "next-auth"

import GitHub from "next-auth/providers/github"
import Google from "next-auth/providers/google"
import CredentialsProvider from "next-auth/providers/credentials"
import { CosmosAdapter } from "@/lib/auth-adapter"
import { getContainer } from "@/lib/cosmos"

const providers: NextAuthOptions["providers"] = [];

// Add GitHub provider only if its environment variables are set
if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) {
    providers.push(
        GitHub({
            clientId: process.env.AUTH_GITHUB_ID,
            clientSecret: process.env.AUTH_GITHUB_SECRET,
        })
    );
}

// Add Google provider only if its environment variables are set
if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
    providers.push(
        Google({
            clientId: process.env.AUTH_GOOGLE_ID,
            clientSecret: process.env.AUTH_GOOGLE_SECRET,
            authorization: {
                params: {
                    prompt: "consent",
                    access_type: "offline",
                    response_type: "code",
                },
            },
        })
    );
}


// Staging bypass provider
// STAGING_BYPASS_TOKEN が設定されている環境（Staging App Service）でのみ有効化される
// 本番環境ではこの環境変数が存在しないため、このプロバイダーは登録されない
if (process.env.STAGING_BYPASS_TOKEN) {
    providers.push(
        CredentialsProvider({
            id: "staging-bypass",
            name: "Stagingログイン",
            credentials: {
                token: { label: "アクセストークン", type: "password" },
            },
            async authorize(credentials) {
                if (credentials?.token === process.env.STAGING_BYPASS_TOKEN) {
                    return {
                        id: "staging-keisato848",
                        name: "keisato848",
                        email: "keisato848@staging.local",
                        image: "https://avatars.githubusercontent.com/keisato848",
                    };
                }
                return null;
            },
        })
    );
}

export const authOptions: NextAuthOptions = {
    providers: providers,
    // next-auth v4 は NEXTAUTH_SECRET を自動認識するが、AUTH_SECRET もサポートするため明示的に設定
    secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET,
    callbacks: {
        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.sub || "";
                session.user.role = (token.role as "user" | "admin") || "user";
            }
            return session;
        },
        async jwt({ token, user, account, profile }) {
            if (user) {
                token.sub = user.id;
                // CosmosDB から role を取得
                try {
                    const container = await getContainer("Users");
                    if (container) {
                        const { resource } = await container.item(user.id, user.id).read();
                        token.role = resource?.role || "user";
                    } else {
                        token.role = "user";
                    }
                } catch {
                    token.role = "user";
                }
            }
            // Google OAuth からプロフィール情報を保持
            if (account?.provider === "google" && profile) {
                token.picture = (profile as { picture?: string }).picture;
            }
            return token;
        }
    },
    pages: {
        signIn: '/login',
        error: '/login', // エラー時もログインページにリダイレクト
    },
    adapter: CosmosAdapter(),
    session: { strategy: "jwt" },
    debug: process.env.NODE_ENV === "development",
}
