import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { UsersService } from './application/users.service';
import { UserRepository } from './domain/user.repository';
import { PrismaUserRepository } from './infrastructure/prisma-user.repository';
import { UsersController } from './presentation/users.controller';

@Module({
  imports: [PrismaModule],
  controllers: [UsersController],
  providers: [UsersService, { provide: UserRepository, useClass: PrismaUserRepository }],
  exports: [UserRepository, UsersService],
})
export class UsersModule {}
