'use server';

import { createServerAction } from './_base';
import type {
    UpdateUserDto,
    UserResponseDto,
    DeleteUserResponseDto,
} from '@next-nest-template/types';

export async function getCurrentUser() {
    return createServerAction<UserResponseDto>(async (api) => {
        const response = await api.get<UserResponseDto>('/user/me');
        return response.data;
    });
}

export async function updateCurrentUser(updateDto: UpdateUserDto) {
    return createServerAction<UserResponseDto>(async (api) => {
        const response = await api.patch<UserResponseDto>('/user/me', updateDto);
        return response.data;
    });
}

export async function deleteCurrentUser() {
    return createServerAction<DeleteUserResponseDto>(async (api) => {
        const response = await api.delete<DeleteUserResponseDto>('/user/me');
        return response.data;
    });
}
