'use client';

import {
    SignedIn,
    SignedOut,
    SignInButton,
    SignUpButton,
    UserButton,
} from '@clerk/nextjs';
import { Button } from '@/components/ui/button';

export function AuthHeader() {
    return (
        <header className="flex justify-end items-center p-4 gap-4 h-16 border-b">
            <SignedOut>
                <SignInButton mode="redirect">
                    <Button variant="outline">Sign in</Button>
                </SignInButton>
                <SignUpButton mode="redirect">
                    <Button>Sign up</Button>
                </SignUpButton>
            </SignedOut>
            <SignedIn>
                <UserButton />
            </SignedIn>
        </header>
    );
}
