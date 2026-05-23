import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { User as ClerkUser } from '@clerk/backend';

export interface RequestAuth {
    userId: string;
    user: ClerkUser;
}

export const Auth = createParamDecorator(
    (_data: unknown, ctx: ExecutionContext): RequestAuth => {
        const request = ctx.switchToHttp().getRequest();
        const user = request.user as ClerkUser;

        return {
            userId: user.id,
            user: user,
        };
    },
);
