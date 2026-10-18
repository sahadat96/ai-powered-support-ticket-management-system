import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { User, UserRole } from '../../../users/domain/user';
import { UserRepository } from '../../../users/domain/user.repository';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: { getAllAndOverride: jest.Mock };
  let verify: jest.Mock;
  let findById: jest.Mock;
  const user: User = {
    id: '195a2cf4-bb34-4cdd-8e25-c9d9c4cc1a61',
    email: 'agent@example.com',
    name: 'Alex Agent',
    role: UserRole.AGENT,
    passwordHash: 'private-hash',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  function context(request: Record<string, unknown>): ExecutionContext {
    return {
      getHandler: () => jest.fn(),
      getClass: () => class TestController {},
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
    verify = jest.fn().mockResolvedValue({ sub: user.id });
    findById = jest.fn().mockResolvedValue(user);
    guard = new JwtAuthGuard(
      reflector as unknown as Reflector,
      { verifyAsync: verify } as unknown as JwtService,
      { findById } as unknown as UserRepository,
    );
  });

  it('allows public routes without a session', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);

    await expect(guard.canActivate(context({ headers: {} }))).resolves.toBe(true);
    expect(verify).not.toHaveBeenCalled();
  });

  it('rejects a missing session', async () => {
    await expect(guard.canActivate(context({ headers: {} }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it.each([
    { headers: {}, cookies: { support_session: 'cookie-token' } },
    { headers: { authorization: 'Bearer bearer-token' } },
  ])('loads the current database role and exposes only public user fields', async (request) => {
    await expect(guard.canActivate(context(request))).resolves.toBe(true);

    expect(findById).toHaveBeenCalledWith(user.id);
    expect(request).toHaveProperty('user.role', UserRole.AGENT);
    expect(request).not.toHaveProperty('user.passwordHash');
  });

  it('rejects expired or incorrectly signed tokens', async () => {
    verify.mockRejectedValue(new Error('expired'));

    await expect(
      guard.canActivate(context({ headers: { authorization: 'Bearer expired' } })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(findById).not.toHaveBeenCalled();
  });

  it('rejects sessions whose account has been deleted', async () => {
    findById.mockResolvedValue(null);

    await expect(
      guard.canActivate(context({ headers: { authorization: 'Bearer token' } })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it.each([null, {}, { sub: 'not-a-uuid' }])(
    'rejects malformed JWT claims without querying PostgreSQL',
    async (payload) => {
      verify.mockResolvedValue(payload);

      await expect(
        guard.canActivate(context({ headers: { authorization: 'Bearer malformed' } })),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(findById).not.toHaveBeenCalled();
    },
  );
});
