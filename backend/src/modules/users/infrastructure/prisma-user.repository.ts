import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { Prisma, type User as UserRecord } from '../../../generated/prisma/client';
import { User, UserRole } from '../domain/user';
import {
  CreateUserInput,
  EmailAlreadyExistsError,
  UserRepository,
} from '../domain/user.repository';

@Injectable()
export class PrismaUserRepository extends UserRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findById(id: string): Promise<User | null> {
    const record = await this.prisma.user.findUnique({ where: { id } });
    return record ? this.toDomain(record) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const record = await this.prisma.user.findUnique({ where: { email } });
    return record ? this.toDomain(record) : null;
  }

  async create(input: CreateUserInput): Promise<User> {
    try {
      return this.toDomain(await this.prisma.user.create({ data: input }));
    } catch (error: unknown) {
      // A database constraint also protects concurrent registrations.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new EmailAlreadyExistsError();
      }
      throw error;
    }
  }

  async findAgents(): Promise<User[]> {
    const records = await this.prisma.user.findMany({
      where: { role: { in: [UserRole.AGENT, UserRole.ADMIN] } },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    return records.map((record) => this.toDomain(record));
  }

  private toDomain(record: UserRecord): User {
    return {
      id: record.id,
      email: record.email,
      name: record.name,
      // The database CHECK constraint enforces the domain's role values.
      role: record.role as UserRole,
      passwordHash: record.passwordHash,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
