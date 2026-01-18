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
    description: "忙しいエンジニアのための情報処理技術者試験（基本情報・応用情報・PM）最短合格プラットフォーム。学習データを分析し、あなただけの効率的な学習戦略を提供します。",
    authors: [{ name: "Shikaku-No Project" }],
    creator: "Shikaku-No Project",
    openGraph: {
        type: "website",
        locale: "ja_JP",
        url: siteUrl,
        title: "シカクノ | 情報処理技術者試験 過去問演習プラットフォーム",
        description: "忙しいエンジニアのための情報処理技術者試験（基本情報・応用情報・PM）最短合格プラットフォーム。",
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
        description: "忙しいエンジニアのための情報処理技術者試験（基本情報・応用情報・PM）最短合格プラットフォーム。",
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

import { TelemetryProvider } from "@/components/providers/TelemetryProvider";

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="ja">
            <body className={inter.className}>
                {/* ... script ... */}
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
                <TelemetryProvider connectionString={process.env.APPLICATIONINSIGHTS_CONNECTION_STRING}>
                    <NextAuthProvider>
                        <ThemeProvider>
                            {children}
                        </ThemeProvider>
                    </NextAuthProvider>
                </TelemetryProvider>
            </body>
        </html>
    );
}
