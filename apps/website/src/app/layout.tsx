import { type Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { Geist, Geist_Mono } from 'next/font/google';
import { AuthHeader } from '@/components/auth-header';
import { ThemeProvider } from '@/components/theme-provider';
import './globals.css';

const geistSans = Geist({
    variable: '--font-geist-sans',
    subsets: ['latin'],
});

const geistMono = Geist_Mono({
    variable: '--font-geist-mono',
    subsets: ['latin'],
});

export const metadata: Metadata = {
    title: {
        default: 'Nest Next Template',
        template: '%s | Nest Next Template',
    },
    description: 'NestJS + Next.js + Clerk + Prisma monorepo boilerplate',
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
                <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
                    <ClerkProvider appearance={{ cssLayerName: 'clerk' }}>
                        <AuthHeader />
                        {children}
                    </ClerkProvider>
                </ThemeProvider>
            </body>
        </html>
    );
}
