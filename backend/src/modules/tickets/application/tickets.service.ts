import {BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException} from '@nestjs/common';
import {TriageService} from '../../ai/application/triage.service';
import {AuthUser, UserRole} from '../../users/domain/user';
import {Ticket} from '../domain/ticket';
import {TicketListQuery, TicketPatch, TicketRepository} from '../domain/ticket.repository';
import {allowedTransitions, transitionError} from '../domain/workflow';
import {AnalyzeTicketInput, ChangeStatusInput, CreateCommentInput, CreateTicketInput, UpdateTicketInput} from './ticket.inputs';

@Injectable()
export class TicketsService {
  constructor(private readonly repository: TicketRepository, private readonly triage: TriageService) {}
  private staff(user: AuthUser) {return user.role !== UserRole.CUSTOMER;}
  private async accessible(id: string, user: AuthUser): Promise<Ticket> {
    const ticket = await this.repository.findById(id);
    if (!ticket || !this.staff(user) && ticket.requesterId !== user.id) throw new NotFoundException('Ticket not found');
    return ticket;
  }
  private checkVersion(ticket: Ticket, version: number) {
    if (ticket.version !== version) throw new ConflictException('This ticket changed. Refresh it before saving again.');
  }
  private async save(ticket: Ticket, version: number, patch: TicketPatch, user: AuthUser, action: string, detail: string) {
    this.checkVersion(ticket, version);
    const updated = await this.repository.update(ticket.id, version, patch, user.id, action, detail);
    if (!updated) throw new ConflictException('This ticket changed. Refresh it before saving again.');
    return updated;
  }
  list(query: TicketListQuery, user: AuthUser) {
    return this.repository.list({...query, requesterId: this.staff(user) ? undefined : user.id});
  }
  stats(user: AuthUser) {return this.repository.stats(this.staff(user) ? undefined : user.id);}
  async create(input: CreateTicketInput, user: AuthUser) {
    const title = input.title.trim();
    const description = input.description.trim();
    if (title.length < 5 || description.length < 15) throw new BadRequestException('Provide a meaningful title and description');
    const ai = this.triage.analyze(title, description);
    return this.repository.create({title, description, requesterId: user.id, category: input.category ?? ai.category, priority: input.priority ?? ai.priority, ai}, user.id);
  }
  async detail(id: string, user: AuthUser) {
    const ticket = await this.accessible(id, user);
    const [comments, events] = await Promise.all([this.repository.comments(id, this.staff(user)), this.repository.events(id)]);
    return {ticket, comments, events: this.staff(user) ? events : events.filter(event => event.action !== 'INTERNAL_NOTE_ADDED'), allowedTransitions: allowedTransitions(ticket.status, this.staff(user))};
  }
  async update(id: string, input: UpdateTicketInput, user: AuthUser) {
    const ticket = await this.accessible(id, user);
    this.checkVersion(ticket, input.version);
    if (!this.staff(user)) {
      if (ticket.status !== 'OPEN') throw new ForbiddenException('You can edit the description only while the ticket is open');
      if (input.assigneeId !== undefined || input.priority !== undefined || input.category !== undefined) throw new ForbiddenException('Only staff can change assignment, priority, or category');
    }
    const {version, ...changes} = input;
    const patch: TicketPatch = Object.fromEntries(Object.entries(changes).filter(([, value]) => value !== undefined));
    if (!Object.keys(patch).length) throw new BadRequestException('Provide at least one field to update');
    if (patch.title !== undefined) {patch.title = patch.title.trim(); if (patch.title.length < 5) throw new BadRequestException('Title must be at least 5 characters');}
    if (patch.description !== undefined) {patch.description = patch.description.trim(); if (patch.description.length < 15) throw new BadRequestException('Description must be at least 15 characters');}
    if (patch.assigneeId) {
      if (!await this.repository.findAgent(patch.assigneeId)) throw new BadRequestException('Assignee must be a support agent or administrator');
    }
    if (patch.assigneeId === null && ['IN_PROGRESS', 'RESOLVED'].includes(ticket.status)) throw new BadRequestException('Reopen the ticket before removing its assignee');
    if (patch.title !== undefined || patch.description !== undefined) patch.ai = this.triage.analyze(patch.title ?? ticket.title, patch.description ?? ticket.description);
    const names = Object.keys(patch).filter(key => key !== 'ai').join(', ');
    return this.save(ticket, version, patch, user, 'UPDATED', `Updated ${names}`);
  }
  async changeStatus(id: string, input: ChangeStatusInput, user: AuthUser) {
    const ticket = await this.accessible(id, user);
    this.checkVersion(ticket, input.version);
    const error = transitionError(ticket.status, input.status, this.staff(user), ticket.assigneeId);
    if (error) throw new BadRequestException(error);
    return this.save(ticket, input.version, {status: input.status, resolvedAt: input.status === 'RESOLVED' ? new Date() : input.status === 'OPEN' ? null : ticket.resolvedAt}, user, 'STATUS_CHANGED', `${ticket.status} → ${input.status}`);
  }
  async addComment(id: string, input: CreateCommentInput, user: AuthUser) {
    const ticket = await this.accessible(id, user);
    if (ticket.status === 'CLOSED') throw new BadRequestException('Reopen this ticket before adding a message');
    if (input.internal && !this.staff(user)) throw new ForbiddenException('Only staff can add internal notes');
    if (!input.body.trim()) throw new BadRequestException('Message cannot be blank');
    return this.repository.addComment(id, user.id, input.body.trim(), input.internal ?? false);
  }
  async analyze(id: string, input: AnalyzeTicketInput, user: AuthUser) {
    const ticket = await this.accessible(id, user);
    if (!this.staff(user)) throw new ForbiddenException('Only staff can rerun triage');
    const ai = this.triage.analyze(ticket.title, ticket.description);
    return this.save(ticket, input.version, {ai, ...(input.apply ? {category: ai.category, priority: ai.priority} : {})}, user, 'AI_TRIAGED', input.apply ? 'Applied suggested category and priority' : 'Refreshed automatic triage');
  }
  async delete(id: string, version: number, user: AuthUser) {
    const ticket = await this.accessible(id, user);
    if (user.role !== UserRole.ADMIN && !(user.role === UserRole.CUSTOMER && ticket.status === 'OPEN')) throw new ForbiddenException('Only administrators or the requester of an open ticket can delete it');
    this.checkVersion(ticket, version);
    if (!await this.repository.delete(id, version, user.id)) throw new ConflictException('This ticket changed. Refresh before deleting it.');
  }
}
