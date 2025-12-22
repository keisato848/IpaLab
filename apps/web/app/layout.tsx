import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "PM Exam DX",
    description: "Project Manager Exam Learning App",
};

import { NextAuthProvider } from "@/components/providers/NextAuthProvider";

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="ja">
            <body>
                <NextAuthProvider>
                    {children}
                </NextAuthProvider>
            </body>
        </html>
    );
}
