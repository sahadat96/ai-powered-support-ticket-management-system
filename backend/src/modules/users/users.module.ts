import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './application/users.service';
import { UserRepository } from './domain/user.repository';
import { TypeOrmUserRepository } from './infrastructure/typeorm-user.repository';
import { UserOrmEntity } from './infrastructure/user.orm-entity';
import { UsersController } from './presentation/users.controller';

@Module({
  imports: [TypeOrmModule.forFeature([UserOrmEntity])],
  controllers: [UsersController],
  providers: [UsersService, { provide: UserRepository, useClass: TypeOrmUserRepository }],
  exports: [UserRepository, UsersService],
})
export class UsersModule {}
