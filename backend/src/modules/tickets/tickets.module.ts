import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { AiModule } from '../ai/ai.module';
import { TicketsService } from './application/tickets.service';
import { TicketRepository } from './domain/ticket.repository';
import { PrismaTicketRepository } from './infrastructure/prisma-ticket.repository';
import { TicketsController } from './presentation/tickets.controller';

@Module({
  imports: [AiModule, PrismaModule],
  controllers: [TicketsController],
  providers: [TicketsService, { provide: TicketRepository, useClass: PrismaTicketRepository }],
  exports: [TicketsService],
})
export class TicketsModule {}
