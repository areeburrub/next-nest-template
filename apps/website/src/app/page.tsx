import { SignedIn, SignedOut } from '@clerk/nextjs';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function HomePage() {
    return (
        <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
            <h1 className="text-4xl font-bold tracking-tight">Website Builder</h1>
            <p className="text-muted-foreground text-center max-w-md">
                Turborepo monorepo with NestJS backend, Next.js frontend, Prisma, and Clerk auth.
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
                <p className="text-sm text-muted-foreground">
                    You are signed in. Protected routes sync your user to the database on first visit.
                </p>
            </SignedIn>
        </main>
    );
}
