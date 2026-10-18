import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../../users/domain/user';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  function context(role?: UserRole): ExecutionContext {
    return {
      getHandler: () => jest.fn(),
      getClass: () => class TestController {},
      switchToHttp: () => ({ getRequest: () => ({ user: role ? { role } : undefined }) }),
    } as unknown as ExecutionContext;
  }

  it.each([UserRole.AGENT, UserRole.ADMIN])('allows a permitted staff role: %s', (role) => {
    const reflector = {
      getAllAndOverride: () => [UserRole.AGENT, UserRole.ADMIN],
    } as unknown as Reflector;

    expect(new RolesGuard(reflector).canActivate(context(role))).toBe(true);
  });

  it.each([UserRole.CUSTOMER, undefined])('denies restricted routes for role: %s', (role) => {
    const reflector = {
      getAllAndOverride: () => [UserRole.AGENT, UserRole.ADMIN],
    } as unknown as Reflector;

    expect(new RolesGuard(reflector).canActivate(context(role))).toBe(false);
  });

  it('allows an authenticated customer to access routes without role restrictions', () => {
    const reflector = {
      getAllAndOverride: () => undefined,
    } as unknown as Reflector;

    expect(new RolesGuard(reflector).canActivate(context(UserRole.CUSTOMER))).toBe(true);
  });
});
