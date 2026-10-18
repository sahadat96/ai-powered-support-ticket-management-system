import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User, UserRole, toAuthUser } from '../../users/domain/user';
import { EmailAlreadyExistsError, UserRepository } from '../../users/domain/user.repository';
import { AuthSession, PasswordHasher } from '../domain/auth-session';

export interface RegisterInput {
  email: string;
  name: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

// Unknown users still pay the bcrypt verification cost. This is never a login credential.
const DUMMY_PASSWORD_HASH = '$2b$12$ySulkDlcSPsc3BfbDuL55.2yNRNC5gyc0v3w695u/bPybZC8UZCBC';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly jwt: JwtService,
  ) {}

  async register(input: RegisterInput): Promise<AuthSession> {
    const email = input.email.trim().toLowerCase();
    if (await this.users.findByEmail(email)) {
      throw new ConflictException('An account with this email already exists');
    }
    const passwordHash = await this.passwordHasher.hash(input.password);
    let user: User;
    try {
      user = await this.users.create({
        email,
        name: input.name.trim(),
        passwordHash,
        role: UserRole.CUSTOMER,
      });
    } catch (error: unknown) {
      if (error instanceof EmailAlreadyExistsError) {
        throw new ConflictException('An account with this email already exists');
      }
      throw error;
    }
    return this.createSession(user);
  }

  async login(input: LoginInput): Promise<AuthSession> {
    const user = await this.users.findByEmail(input.email.trim().toLowerCase());
    const validPassword = await this.passwordHasher.verify(
      input.password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );
    if (!user || !validPassword) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return this.createSession(user);
  }

  private async createSession(user: User): Promise<AuthSession> {
    return {
      user: toAuthUser(user),
      token: await this.jwt.signAsync({ sub: user.id }),
    };
  }
}
