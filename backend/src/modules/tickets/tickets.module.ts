import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModule } from '../ai/ai.module';
import { UserOrmEntity } from '../users/infrastructure/user.orm-entity';
import { TicketsService } from './application/tickets.service';
import { TicketRepository } from './domain/ticket.repository';
import { CommentOrmEntity } from './infrastructure/comment.orm-entity';
import { EventOrmEntity } from './infrastructure/event.orm-entity';
import { TicketOrmEntity } from './infrastructure/ticket.orm-entity';
import { TypeOrmTicketRepository } from './infrastructure/typeorm-ticket.repository';
import { TicketsController } from './presentation/tickets.controller';

@Module({
  imports: [AiModule, TypeOrmModule.forFeature([TicketOrmEntity, CommentOrmEntity, EventOrmEntity, UserOrmEntity])],
  controllers: [TicketsController],
  providers: [TicketsService, { provide: TicketRepository, useClass: TypeOrmTicketRepository }],
  exports: [TicketsService],
})
export class TicketsModule {}
