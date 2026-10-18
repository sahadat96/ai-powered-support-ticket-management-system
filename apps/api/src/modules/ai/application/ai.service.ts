import { ConflictException, Injectable } from '@nestjs/common';
import { Actor } from '../../users/domain/user';
import { TicketsService } from '../../tickets/application/tickets.service';
import { TicketRepository } from '../../tickets/domain/ticket.repository';
import { TicketAnalyzer } from '../domain/ticket-analyzer';

@Injectable()
export class AiService {
  constructor(private readonly analyzer: TicketAnalyzer, private readonly tickets: TicketsService, private readonly repository: TicketRepository) {}
  preview(title: string, description: string) { return this.analyzer.analyze(title, description); }
  async analyze(actor: Actor, id: string, version: number) {
    const ticket = await this.tickets.detail(actor, id);
    if (ticket.version !== version) throw new ConflictException('Ticket changed. Refresh before analyzing.');
    const analysis = await this.analyzer.analyze(ticket.title, ticket.description);
    const updated = await this.repository.update(id, version, {aiAnalysis: analysis}, actor.id, 'ANALYZED', `AI suggested ${analysis.category} / ${analysis.priority}; human review required`);
    if (!updated) throw new ConflictException('Ticket changed during analysis. Refresh and try again.');
    return updated;
  }
}
