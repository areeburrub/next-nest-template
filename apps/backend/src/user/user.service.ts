import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { prisma } from '@website-builder/database';
import { CreateUserDto, UpdateUserDto } from '@website-builder/types';
import { createClerkClient } from '@clerk/backend';

@Injectable()
export class UserService {
    private readonly logger = new Logger(UserService.name);
    private readonly clerkClient = createClerkClient({
        secretKey: process.env.CLERK_SECRET_KEY,
    });

    async create(data: CreateUserDto) {
        try {
            const user = await prisma.userEntity.create({
                data: {
                    id: data.id,
                    email: data.email,
                    firstName: data.firstName,
                    lastName: data.lastName,
                    imageUrl: data.imageUrl,
                },
            });
            this.logger.log(`User created: ${user.id}`);
            return user;
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Error creating user: ${message}`);
            throw new HttpException(
                'Failed to create user',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    async update(userId: string, data: UpdateUserDto) {
        try {
            const user = await prisma.userEntity.update({
                where: { id: userId },
                data,
            });
            this.logger.log(`User updated: ${user.id}`);
            return user;
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Error updating user: ${message}`);
            throw new HttpException(
                'Failed to update user',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    async findById(userId: string) {
        try {
            const user = await prisma.userEntity.findUnique({
                where: { id: userId },
            });

            if (!user) {
                try {
                    const clerkUser = await this.clerkClient.users.getUser(userId);

                    if (!clerkUser) {
                        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
                    }

                    const primaryEmail = clerkUser.emailAddresses.find(
                        (email) => email.id === clerkUser.primaryEmailAddressId,
                    )?.emailAddress;

                    if (!primaryEmail) {
                        throw new HttpException(
                            'User has no primary email',
                            HttpStatus.BAD_REQUEST,
                        );
                    }

                    const newUser = await this.create({
                        id: clerkUser.id,
                        email: primaryEmail,
                        firstName: clerkUser.firstName ?? undefined,
                        lastName: clerkUser.lastName ?? undefined,
                        imageUrl: clerkUser.imageUrl,
                    });

                    this.logger.log(`User synced from Clerk: ${newUser.id}`);

                    return {
                        ...newUser,
                        ...clerkUser,
                    };
                } catch (clerkError) {
                    const message =
                        clerkError instanceof Error ? clerkError.message : 'Unknown error';
                    this.logger.error(`Failed to fetch user from Clerk: ${message}`);
                    throw new HttpException('User not found', HttpStatus.NOT_FOUND);
                }
            }

            try {
                const clerkUser = await this.clerkClient.users.getUser(user.id);
                this.logger.log(`User fetched: ${user.id}`);
                return {
                    ...user,
                    ...clerkUser,
                };
            } catch (clerkError) {
                const message =
                    clerkError instanceof Error ? clerkError.message : 'Unknown error';
                this.logger.error(`Failed to fetch Clerk user details for ${user.id}: ${message}`);
                return user;
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Error finding user: ${message}`);
            throw error;
        }
    }

    async delete(userId: string) {
        try {
            await prisma.userEntity.delete({
                where: { id: userId },
            });
            this.logger.log(`User deleted: ${userId}`);
            return { success: true, message: 'User deleted successfully' };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Error deleting user: ${message}`);
            throw new HttpException(
                'Failed to delete user',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }
}
