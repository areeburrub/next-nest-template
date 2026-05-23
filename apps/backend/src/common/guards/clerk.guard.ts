import {
    CanActivate,
    ExecutionContext,
    Injectable,
    Logger,
    UnauthorizedException,
} from '@nestjs/common';
import { verifyToken } from '@clerk/backend';
import { Request } from 'express';
import { User as ClerkUser } from '@clerk/backend';

@Injectable()
export class ClerkAuthGuard implements CanActivate {
    private readonly logger = new Logger(ClerkAuthGuard.name);

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        let token = this.extractTokenFromHeader(request);
        if (!token) {
            token = this.extractTokenFromQuery(request);
        }

        if (!token) {
            this.logger.error(`[canActivate] No token found in request`);
            throw new UnauthorizedException();
        }

        try {
            const sessionClaims = await verifyToken(token, {
                secretKey: process.env.CLERK_SECRET_KEY,
            });
            const user = sessionClaims.user as ClerkUser;
            request['user'] = user;

            this.logger.log(`[canActivate] Token verified successfully for user:`, {
                userId: user.id,
            });

            return true;
        } catch (error) {
            this.logger.error(`[canActivate] Token verification failed:`, {
                error: error instanceof Error ? error.message : error,
            });
            throw new UnauthorizedException();
        }
    }

    private extractTokenFromHeader(request: Request): string | undefined {
        const [type, token] = request.headers.authorization?.split(' ') ?? [];
        return type === 'Bearer' ? token : undefined;
    }

    private extractTokenFromQuery(request: Request): string | undefined {
        return request.query?.token as string;
    }
}
