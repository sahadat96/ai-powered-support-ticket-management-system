import { Role, UserRecord } from './user';

export abstract class UserRepository {
  abstract findByEmail(email: string): Promise<UserRecord | null>;
  abstract findById(id: string): Promise<UserRecord | null>;
  abstract create(data: {name: string; email: string; passwordHash: string}): Promise<UserRecord>;
  abstract listStaff(): Promise<{id: string; name: string; email: string; role: Role}[]>;
}
