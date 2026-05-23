import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isPublicRoute = createRouteMatcher([
    '/',
    '/sign-in(.*)',
    '/sign-up(.*)',
]);

const SIGN_CHECK_COOKIE = 'sign_check';

export default clerkMiddleware(async (auth, request) => {
    if (!isPublicRoute(request)) {
        await auth.protect();
    }

    const authData = await auth();
    const signCheck = request.cookies.get(SIGN_CHECK_COOKIE);
    if (authData.userId && !signCheck?.value) {
        const token = await authData.getToken();
        if (token) {
            const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
            try {
                await fetch(`${backendUrl}/user/me`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
            } catch {
                return NextResponse.next();
            }
            const response = NextResponse.next();
            response.cookies.set(SIGN_CHECK_COOKIE, '1', {
                path: '/',
                httpOnly: true,
                sameSite: 'lax',
                secure: process.env.NODE_ENV === 'production',
                maxAge: 60 * 60 * 24 * 365,
            });
            return response;
        }
    }

    return NextResponse.next();
});

export const config = {
    matcher: [
        '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
        '/(api|trpc)(.*)',
    ],
};
