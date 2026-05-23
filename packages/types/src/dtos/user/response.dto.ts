export class UserResponseDto {
    id!: string;
    email!: string;
    firstName?: string | null;
    lastName?: string | null;
    imageUrl?: string | null;
    createdAt!: Date | number;
    updatedAt!: Date | number;
    username?: string | null;
    phoneNumbers?: unknown[];
    emailAddresses?: unknown[];
    externalAccounts?: unknown[];
    [key: string]: unknown;
}

export class DeleteUserResponseDto {
    success!: boolean;
    message!: string;
}
