import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { isUUID } from 'class-validator';
import { toAuthUser } from '../../../users/domain/user';
import { UserRepository } from '../../../users/domain/user.repository';
import { AUTH_SESSION_COOKIE, AuthTokenPayload } from '../../domain/auth-session';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthenticatedRequest } from './authenticated-request';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly users: UserRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      return true;
    }
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const bearer = request.headers.authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];
    const cookie: unknown = request.cookies?.[AUTH_SESSION_COOKIE];
    const token = bearer ?? (typeof cookie === 'string' ? cookie : undefined);
    if (!token) {
      throw new UnauthorizedException('Authentication required');
    }
    let payload: AuthTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AuthTokenPayload>(token, {
        algorithms: ['HS256'],
      });
    } catch {
      throw new UnauthorizedException('Session is invalid or expired');
    }
    if (!payload || typeof payload.sub !== 'string' || !isUUID(payload.sub)) {
      throw new UnauthorizedException('Session is invalid or expired');
    }
    const user = await this.users.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('Session is invalid or expired');
    }
    request.user = toAuthUser(user);
    return true;
  }
}
