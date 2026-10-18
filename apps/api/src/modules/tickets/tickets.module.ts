import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { TicketRepository } from './domain/ticket.repository';
import { PrismaTicketRepository } from './infrastructure/prisma-ticket.repository';
import { TicketsService } from './application/tickets.service';
import { TicketsController } from './presentation/tickets.controller';

@Module({imports: [UsersModule], providers: [TicketsService, {provide: TicketRepository, useClass: PrismaTicketRepository}], controllers: [TicketsController], exports: [TicketsService, TicketRepository]})
export class TicketsModule {}
