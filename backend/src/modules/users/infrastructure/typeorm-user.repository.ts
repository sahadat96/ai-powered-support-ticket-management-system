import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { User, UserRole } from '../domain/user';
import {
  CreateUserInput,
  EmailAlreadyExistsError,
  UserRepository,
} from '../domain/user.repository';
import { UserOrmEntity } from './user.orm-entity';

@Injectable()
export class TypeOrmUserRepository extends UserRepository {
  constructor(
    @InjectRepository(UserOrmEntity)
    private readonly repository: Repository<UserOrmEntity>,
  ) {
    super();
  }

  async findById(id: string): Promise<User | null> {
    const entity = await this.repository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :id', { id })
      .getOne();
    return entity ? this.toDomain(entity) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const entity = await this.repository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email })
      .getOne();
    return entity ? this.toDomain(entity) : null;
  }

  async create(input: CreateUserInput): Promise<User> {
    try {
      const entity = await this.repository.save(this.repository.create(input));
      return this.toDomain(entity);
    } catch (error: unknown) {
      // The unique database constraint also handles concurrent registrations.
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string }).code === '23505'
      ) {
        throw new EmailAlreadyExistsError();
      }
      throw error;
    }
  }

  async findAgents(): Promise<User[]> {
    const entities = await this.repository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.role IN (:...roles)', { roles: [UserRole.AGENT, UserRole.ADMIN] })
      .orderBy('user.name', 'ASC')
      .addOrderBy('user.id', 'ASC')
      .getMany();
    return entities.map((entity) => this.toDomain(entity));
  }

  private toDomain(entity: UserOrmEntity): User {
    return {
      id: entity.id,
      email: entity.email,
      name: entity.name,
      role: entity.role,
      passwordHash: entity.passwordHash,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
