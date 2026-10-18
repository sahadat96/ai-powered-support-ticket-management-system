import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma.service';
import { UserRepository } from '../domain/user.repository';

@Injectable()
export class PrismaUserRepository extends UserRepository {
  constructor(private readonly prisma: PrismaService) { super(); }
  findByEmail(email: string) { return this.prisma.user.findUnique({where: {email}}); }
  findById(id: string) { return this.prisma.user.findUnique({where: {id}}); }
  create(data: {name: string; email: string; passwordHash: string}) { return this.prisma.user.create({data}); }
  listStaff() {
    return this.prisma.user.findMany({where: {role: {in: ['ADMIN', 'AGENT']}}, select: {id: true, name: true, email: true, role: true}, orderBy: {name: 'asc'}});
  }
}
