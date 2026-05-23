'use server';

import { auth } from '@clerk/nextjs/server';
import axios, { type AxiosInstance } from 'axios';

export async function getAuthenticatedApi(): Promise<AxiosInstance> {
    const { getToken } = await auth();
    const token = await getToken();

    if (!token) {
        throw new Error('Unauthorized: No authentication token available');
    }

    const authenticatedApi = axios.create({
        baseURL: process.env.BACKEND_URL || 'http://localhost:3001',
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    return authenticatedApi;
}

export async function createServerAction<T>(
    handler: (api: AxiosInstance) => Promise<T>,
): Promise<T> {
    try {
        const api = await getAuthenticatedApi();
        return await handler(api);
    } catch (error) {
        if (axios.isAxiosError(error)) {
            const data = error.response?.data as Record<string, unknown> | undefined;
            const msg = data?.message;
            const message = Array.isArray(msg)
                ? msg[0]
                : typeof msg === 'string'
                  ? msg
                  : data?.error ?? data?.detail ?? error.message;
            const status = error.response?.status;
            const hint =
                status === 502 || status === 503
                    ? ' (backend may be unavailable)'
                    : '';
            throw new Error(`${message}${hint}`);
        }
        throw error;
    }
}
