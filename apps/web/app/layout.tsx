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
                <NextAuthProvider>
                    <ThemeProvider>
                        {children}
                    </ThemeProvider>
                </NextAuthProvider>
            </body>
        </html>
    );
}
