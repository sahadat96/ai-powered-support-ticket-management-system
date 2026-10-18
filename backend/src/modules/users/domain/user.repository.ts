import { User, UserRole } from './user';

export interface CreateUserInput {
  email: string;
  name: string;
  role: UserRole;
  passwordHash: string;
}

export class EmailAlreadyExistsError extends Error {
  constructor() {
    super('An account with this email already exists');
    this.name = 'EmailAlreadyExistsError';
  }
}

export abstract class UserRepository {
  abstract findById(id: string): Promise<User | null>;
  abstract findByEmail(email: string): Promise<User | null>;
  abstract create(input: CreateUserInput): Promise<User>;
  abstract findAgents(): Promise<User[]>;
}
