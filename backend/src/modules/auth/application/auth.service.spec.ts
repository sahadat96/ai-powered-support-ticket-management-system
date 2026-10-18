import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User, UserRole } from '../../users/domain/user';
import { EmailAlreadyExistsError, UserRepository } from '../../users/domain/user.repository';
import { PasswordHasher } from '../domain/auth-session';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let users: jest.Mocked<UserRepository>;
  let passwords: jest.Mocked<PasswordHasher>;
  let sign: jest.Mock;
  const user: User = {
    id: '195a2cf4-bb34-4cdd-8e25-c9d9c4cc1a61',
    email: 'alex@example.com',
    name: 'Alex Morgan',
    role: UserRole.CUSTOMER,
    passwordHash: 'stored-hash',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    users = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      create: jest.fn(),
      findAgents: jest.fn(),
    };
    passwords = { hash: jest.fn(), verify: jest.fn() };
    sign = jest.fn().mockResolvedValue('signed-jwt');
    service = new AuthService(users, passwords, { signAsync: sign } as unknown as JwtService);
  });

  it('registers normalized customer credentials and returns no password hash', async () => {
    users.findByEmail.mockResolvedValue(null);
    users.create.mockResolvedValue(user);
    passwords.hash.mockResolvedValue('stored-hash');

    const session = await service.register({
      email: ' ALEX@EXAMPLE.COM ',
      name: ' Alex Morgan ',
      password: 'my-secure-password',
    });

    expect(users.findByEmail).toHaveBeenCalledWith('alex@example.com');
    expect(passwords.hash).toHaveBeenCalledWith('my-secure-password');
    expect(users.create).toHaveBeenCalledWith({
      email: 'alex@example.com',
      name: 'Alex Morgan',
      passwordHash: 'stored-hash',
      role: UserRole.CUSTOMER,
    });
    expect(sign).toHaveBeenCalledWith({ sub: user.id });
    expect(session.user).toEqual({
      id: user.id,
      email: user.email,
      name: user.name,
      role: UserRole.CUSTOMER,
    });
    expect(session.token).toBe('signed-jwt');
  });

  it('always assigns the customer role even if an internal caller supplies another role', async () => {
    users.findByEmail.mockResolvedValue(null);
    users.create.mockResolvedValue(user);
    passwords.hash.mockResolvedValue('stored-hash');
    const input = {
      email: user.email,
      name: user.name,
      password: 'my-secure-password',
      role: UserRole.ADMIN,
    };

    await service.register(input);

    expect(users.create).toHaveBeenCalledWith(expect.objectContaining({ role: UserRole.CUSTOMER }));
  });

  it('rejects an email that is already registered without creating a new account', async () => {
    users.findByEmail.mockResolvedValue(user);

    await expect(
      service.register({
        email: user.email,
        name: user.name,
        password: 'my-secure-password',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(users.create).not.toHaveBeenCalled();
    expect(passwords.hash).not.toHaveBeenCalled();
  });

  it('turns a concurrent unique email conflict into HTTP 409', async () => {
    users.findByEmail.mockResolvedValue(null);
    passwords.hash.mockResolvedValue('stored-hash');
    users.create.mockRejectedValue(new EmailAlreadyExistsError());

    await expect(
      service.register({
        email: user.email,
        name: user.name,
        password: 'my-secure-password',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('allows a valid password and normalizes the login email', async () => {
    users.findByEmail.mockResolvedValue(user);
    passwords.verify.mockResolvedValue(true);

    const session = await service.login({
      email: ' ALEX@EXAMPLE.COM ',
      password: 'correct-password',
    });

    expect(users.findByEmail).toHaveBeenCalledWith('alex@example.com');
    expect(passwords.verify).toHaveBeenCalledWith('correct-password', 'stored-hash');
    expect(session.user.id).toBe(user.id);
    expect(session.user).not.toHaveProperty('passwordHash');
  });

  it.each([false, true])('returns the same login failure when user exists=%s', async (exists) => {
    users.findByEmail.mockResolvedValue(exists ? user : null);
    passwords.verify.mockResolvedValue(false);

    await expect(service.login({ email: user.email, password: 'wrong-password' })).rejects.toThrow(
      new UnauthorizedException('Invalid email or password'),
    );
    expect(sign).not.toHaveBeenCalled();
  });
});
