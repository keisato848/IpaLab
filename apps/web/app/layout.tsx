import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "シカクノ | 情報処理技術者試験 過去問演習プラットフォーム",
    description: "シカクノは、効率的な学習をサポートする情報処理技術者試験の過去問演習プラットフォームです。",
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
            <body>
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
