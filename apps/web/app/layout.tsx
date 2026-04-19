import { Inter } from "next/font/google";
import "./globals.css";
import type { Metadata } from "next";
import BottomNav from "@/components/layout/BottomNav";

// Removed: export const dynamic = 'force-dynamic';
// This was causing all pages to be SSR-only, preventing static generation benefits

const inter = Inter({ subsets: ["latin"] });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://shikaku-no.com'; // Fallback URL

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
import { AdProvider } from "@/components/features/ads";

import { TelemetryProvider } from "@/components/providers/TelemetryProvider";
import { GoogleAnalytics } from "@next/third-parties/google";
import AiAssistantLoader from "@/components/features/ai-assistant/AiAssistantLoader";

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="ja" suppressHydrationWarning>
            <body className={inter.className}>
                {/* ... script ... */}
                {/* Application Insights 接続文字列をランタイムで埋め込む（SWA対応） */}
                <script
                    dangerouslySetInnerHTML={{
                        __html: `window.__APPINSIGHTS_CONNECTION_STRING__ = "${process.env.NEXT_PUBLIC_APPLICATIONINSIGHTS_CONNECTION_STRING || ''}";`,
                    }}
                />
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
                    <TelemetryProvider connectionString={process.env.NEXT_PUBLIC_APPLICATIONINSIGHTS_CONNECTION_STRING}>
                        <AdProvider>
                            <ThemeProvider>
                                <a href="#main-content" className="skip-link">本文へスキップ</a>
                                <div id="main-content">{children}</div>
                                <BottomNav />
                                <AiAssistantLoader />
                            </ThemeProvider>
                        </AdProvider>
                    </TelemetryProvider>
                </NextAuthProvider>
                {process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID && (
                    <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID} />
                )}
            </body>
        </html>
    );
}
