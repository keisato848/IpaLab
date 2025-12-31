import { Inter } from "next/font/google";
import "./globals.css";
import type { Metadata } from "next";

const inter = Inter({ subsets: ["latin"] });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://shikakuno.vercel.app'; // Fallback URL

export const metadata: Metadata = {
    metadataBase: new URL(siteUrl),
    title: {
        default: "シカクノ | 情報処理技術者試験 過去問演習プラットフォーム",
        template: "%s | シカクノ"
    },
    description: "シカクノは、基本情報(FE)、応用情報(AP)、プロジェクトマネージャ(PM)などの情報処理技術者試験の過去問演習を効率化する学習プラットフォームです。学習履歴の分析や模擬試験モードで合格をサポートします。",
    authors: [{ name: "Shikaku-No Project" }],
    creator: "Shikaku-No Project",
    openGraph: {
        type: "website",
        locale: "ja_JP",
        url: siteUrl,
        title: "シカクノ | 情報処理技術者試験 過去問演習プラットフォーム",
        description: "情報処理技術者試験の過去問演習を効率化。学習履歴分析機能付き。",
        siteName: "シカクノ",
        images: [
            {
                url: "/og-image.png", // Creating a placeholder reference
                width: 1200,
                height: 630,
                alt: "シカクノ - 情報処理技術者試験学習プラットフォーム",
            },
        ],
    },
    twitter: {
        card: "summary_large_image",
        title: "シカクノ | 情報処理技術者試験 過去問演習プラットフォーム",
        description: "情報処理技術者試験の過去問演習を効率化。学習履歴分析機能付き。",
        // creator: "@twitter_handle", // Optional
    },
    robots: {
        index: true,
        follow: true,
        googleBot: {
            index: true,
            follow: true,
            'max-video-preview': -1,
            'max-image-preview': 'large',
            'max-snippet': -1,
        },
    },
    alternates: {
        canonical: '/',
    },
};

import { NextAuthProvider } from "@/components/providers/NextAuthProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="ja">
            <body className={inter.className}>
                <script
                    dangerouslySetInnerHTML={{
                        __html: `
                            (function() {
                                try {
                                    var savedTheme = localStorage.getItem('theme');
                                    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                                    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
                                        document.documentElement.setAttribute('data-theme', 'dark');
                                    } else {
                                        document.documentElement.setAttribute('data-theme', 'light');
                                    }
                                } catch (e) {}
                            })();
                        `,
                    }}
                />
                <NextAuthProvider>
                    <ThemeProvider>
                        {children}
                    </ThemeProvider>
                </NextAuthProvider>
            </body>
        </html>
    );
}
