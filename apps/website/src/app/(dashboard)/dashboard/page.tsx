import { currentUser } from '@clerk/nextjs/server';

export default async function DashboardPage() {
    const user = await currentUser();

    return (
        <main className="flex flex-1 flex-col gap-6 p-8">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
                <p className="text-muted-foreground">
                    Welcome back{user?.firstName ? `, ${user.firstName}` : ''}.
                </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-6 text-card-foreground">
                <p className="text-sm text-muted-foreground">
                    Your app dashboard is ready. Add features under apps/website/src/app/(dashboard)/.
                </p>
            </div>
        </main>
    );
}
