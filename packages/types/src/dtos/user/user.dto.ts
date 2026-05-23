import { IsString, IsOptional, IsNotEmpty, IsEmail, IsUrl } from 'class-validator';

export class CreateUserDto {
    @IsString()
    @IsNotEmpty()
    id!: string;

    @IsEmail()
    @IsNotEmpty()
    email!: string;

    @IsOptional()
    @IsString()
    firstName?: string;

    @IsOptional()
    @IsString()
    lastName?: string;

    @IsOptional()
    @IsUrl()
    imageUrl?: string;
}

export class UpdateUserDto {
    @IsOptional()
    @IsEmail()
    email?: string;

    @IsOptional()
    @IsString()
    firstName?: string;

    @IsOptional()
    @IsString()
    lastName?: string;

    @IsOptional()
    @IsUrl()
    imageUrl?: string;
}
