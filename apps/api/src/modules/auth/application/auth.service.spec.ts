import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { UserRepository } from '../../users/domain/user.repository';
import { PasswordHasher } from '../domain/password-hasher';

describe('Authentication', () => {
  const user = {
    id: 'user-id',
    email: 'customer@test.local',
    name: 'Customer',
    role: 'CUSTOMER' as const,
    passwordHash: 'hashed',
    createdAt: new Date(),
  };
  const users = { findByEmail: jest.fn(), create: jest.fn() };
  const passwords = {
    hash: jest.fn().mockResolvedValue('hashed'),
    verify: jest.fn(),
  };
  const jwt = { signAsync: jest.fn().mockResolvedValue('signed-token') };
  let service: AuthService;
  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(
      users as unknown as UserRepository,
      passwords as PasswordHasher,
      jwt as unknown as JwtService,
    );
  });
  it('hashes passwords and creates only customer accounts', async () => {
    users.findByEmail.mockResolvedValue(null);
    users.create.mockResolvedValue(user);
    const result = await service.register({
      email: 'CUSTOMER@test.local',
      name: 'Customer',
      password: 'a-secret123',
    });
    expect(passwords.hash).toHaveBeenCalledWith('a-secret123');
    expect(users.create).toHaveBeenCalledWith({
      name: 'Customer',
      email: user.email,
      passwordHash: 'hashed',
    });
    expect(result.user).not.toHaveProperty('passwordHash');
  });
  it('rejects duplicate registration', async () => {
    users.findByEmail.mockResolvedValue(user);
    await expect(
      service.register({
        email: user.email,
        name: 'Customer',
        password: 'abc1234567',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
  it.each([null, user])(
    'uses the same error for an unknown user or wrong password',
    async (record) => {
      users.findByEmail.mockResolvedValue(record);
      passwords.verify.mockResolvedValue(false);
      await expect(
        service.login({ email: user.email, password: 'wrong123' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(passwords.verify).toHaveBeenCalledTimes(1);
    },
  );
});
