import { Injectable } from '@nestjs/common';
import { AuthUser, toAuthUser } from '../domain/user';
import { UserRepository } from '../domain/user.repository';

@Injectable()
export class UsersService {
  constructor(private readonly users: UserRepository) {}

  async listAgents(): Promise<AuthUser[]> {
    return (await this.users.findAgents()).map(toAuthUser);
  }
}
