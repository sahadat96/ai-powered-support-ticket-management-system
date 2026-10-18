import { AuthUser } from '../../users/domain/user';

export const AUTH_SESSION_COOKIE = 'support_session';
export const AUTH_SESSION_TTL_SECONDS = 2 * 60 * 60;

export interface AuthTokenPayload {
  sub: string;
}

export interface AuthSession {
  user: AuthUser;
  token: string;
}

export abstract class PasswordHasher {
  abstract hash(password: string): Promise<string>;
  abstract verify(password: string, hash: string): Promise<boolean>;
}
