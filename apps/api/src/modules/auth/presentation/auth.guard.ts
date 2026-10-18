import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { UserRepository } from '../../users/domain/user.repository';
import { Role, publicUser } from '../../users/domain/user';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly jwt: JwtService, private readonly users: UserRepository) {}
  async canActivate(ctx: ExecutionContext) {
    if (this.reflector.getAllAndOverride<boolean>('public', [ctx.getHandler(), ctx.getClass()])) return true;
    const request = ctx.switchToHttp().getRequest();
    const header: string | undefined = request.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : request.cookies?.support_session;
    if (!token) throw new UnauthorizedException('Please sign in.');
    let id: string;
    try {
      const payload = await this.jwt.verifyAsync<{sub: string}>(token);
      if (typeof payload.sub !== 'string' || !/^[0-9a-f-]{36}$/i.test(payload.sub)) throw new Error('Invalid subject');
      id = payload.sub;
    } catch { throw new UnauthorizedException('Your session has expired. Please sign in again.'); }
    const user = await this.users.findById(id);
    if (!user) throw new UnauthorizedException('Account no longer exists.');
    request.user = publicUser(user);
    const roles = this.reflector.getAllAndOverride<Role[]>('roles', [ctx.getHandler(), ctx.getClass()]);
    if (roles && !roles.includes(user.role)) throw new ForbiddenException('You do not have permission to perform this action.');
    return true;
  }
}
