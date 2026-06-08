import { SignedIn, SignedOut } from '@clerk/nextjs';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function LandingPage() {
    return (
        <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
            <h1 className="text-4xl font-bold tracking-tight">Nest Next Template</h1>
            <p className="text-muted-foreground text-center max-w-md">
                A production-ready monorepo boilerplate with NestJS, Next.js, Clerk, and Prisma.
            </p>
            <SignedOut>
                <div className="flex gap-4">
                    <Button asChild>
                        <Link href="/sign-in">Sign in</Link>
                    </Button>
                    <Button variant="outline" asChild>
                        <Link href="/sign-up">Sign up</Link>
                    </Button>
                </div>
            </SignedOut>
            <SignedIn>
                <Button asChild>
                    <Link href="/dashboard">Go to dashboard</Link>
                </Button>
            </SignedIn>
        </main>
    );
}
