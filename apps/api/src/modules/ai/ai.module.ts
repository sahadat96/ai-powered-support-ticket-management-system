import { Module } from '@nestjs/common';
import { TicketsModule } from '../tickets/tickets.module';
import { TicketAnalyzer } from './domain/ticket-analyzer';
import { LocalTicketAnalyzer } from './infrastructure/local-ticket-analyzer';
import { AiService } from './application/ai.service';
import { AiController } from './presentation/ai.controller';

@Module({imports: [TicketsModule], providers: [AiService, {provide: TicketAnalyzer, useClass: LocalTicketAnalyzer}], controllers: [AiController]})
export class AiModule {}
