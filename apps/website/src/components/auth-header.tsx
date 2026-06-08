'use client';

import Link from 'next/link';
import {
    SignedIn,
    SignedOut,
    SignInButton,
    SignUpButton,
    UserButton,
} from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';

export function AuthHeader() {
    return (
        <header className="flex justify-end items-center p-4 gap-2 h-16 border-b border-border bg-background">
            <ThemeToggle />
            <SignedOut>
                <SignInButton mode="redirect">
                    <Button variant="outline">Sign in</Button>
                </SignInButton>
                <SignUpButton mode="redirect">
                    <Button>Sign up</Button>
                </SignUpButton>
            </SignedOut>
            <SignedIn>
                <Button variant="outline" asChild>
                    <Link href="/dashboard">Dashboard</Link>
                </Button>
                <UserButton />
            </SignedIn>
        </header>
    );
}
