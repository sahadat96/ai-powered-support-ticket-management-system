import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRepository } from '../../users/domain/user.repository';
import { publicUser } from '../../users/domain/user';
import { PasswordHasher } from '../domain/password-hasher';

@Injectable()
export class AuthService {
  // Valid bcrypt hash used to reduce the timing difference for unknown accounts.
  private readonly dummyHash = '$2b$12$C6UzMDM.H6dfI/f/IKcEe.yrjHpkOnyLXyNrEkMHDrR/hT1aN6v2K';
  constructor(private readonly users: UserRepository, private readonly passwords: PasswordHasher, private readonly jwt: JwtService) {}
  async register(input: {name: string; email: string; password: string}) {
    const email = input.email.toLowerCase().trim();
    if (await this.users.findByEmail(email)) throw new ConflictException('An account with this email already exists.');
    const user = await this.users.create({name: input.name.trim(), email, passwordHash: await this.passwords.hash(input.password)});
    return this.session(user);
  }
  async login(input: {email: string; password: string}) {
    const user = await this.users.findByEmail(input.email.toLowerCase().trim());
    const valid = await this.passwords.verify(input.password, user?.passwordHash ?? this.dummyHash);
    if (!user || !valid) throw new UnauthorizedException('Invalid email or password.');
    return this.session(user);
  }
  private async session(user: NonNullable<Awaited<ReturnType<UserRepository['findById']>>>) {
    return {accessToken: await this.jwt.signAsync({sub: user.id}), user: publicUser(user)};
  }
}
