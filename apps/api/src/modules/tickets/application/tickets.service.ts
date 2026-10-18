import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Actor } from '../../users/domain/user';
import { UserRepository } from '../../users/domain/user.repository';
import {
  assertTransition,
  canAccess,
  CreateTicket,
  TicketQuery,
  UpdateTicket,
} from '../domain/ticket';
import { TicketRepository, TicketChanges } from '../domain/ticket.repository';

@Injectable()
export class TicketsService {
  constructor(
    private readonly tickets: TicketRepository,
    private readonly users: UserRepository,
  ) {}
  create(actor: Actor, input: CreateTicket) {
    return this.tickets.create({ ...input, requesterId: actor.id });
  }
  list(actor: Actor, query: TicketQuery) {
    return this.tickets.list(actor, query).then((result) => ({
      ...result,
      page: query.page,
      limit: query.limit,
      pages: Math.ceil(result.total / query.limit),
    }));
  }
  stats(actor: Actor) {
    return this.tickets.stats(actor);
  }
  async detail(actor: Actor, id: string) {
    const ticket = await this.tickets.findById(id);
    // Return 404 for both a missing ticket and another customer's ticket.
    if (!ticket || !canAccess(ticket, actor))
      throw new NotFoundException('Ticket not found.');
    return ticket;
  }
  async update(actor: Actor, id: string, input: UpdateTicket) {
    const ticket = await this.detail(actor, id);
    if (ticket.version !== input.version)
      throw new ConflictException(
        'This ticket changed. Refresh before saving.',
      );
    const { version, ...provided } = input;
    // DTO class fields exist as undefined even when omitted from JSON.
    const changes = Object.fromEntries(
      Object.entries(provided).filter(([, value]) => value !== undefined),
    ) as Omit<UpdateTicket, 'version'>;
    if (Object.keys(changes).length === 0)
      throw new ConflictException('No changes were supplied.');
    if (actor.role === 'CUSTOMER') {
      if (
        changes.priority !== undefined ||
        changes.category !== undefined ||
        changes.assigneeId !== undefined
      )
        throw new ForbiddenException(
          'Only staff can change priority, category, or assignment.',
        );
      if (
        (changes.title !== undefined || changes.description !== undefined) &&
        ticket.status !== 'OPEN'
      )
        throw new ForbiddenException(
          'Ticket content can only be edited while open.',
        );
    }
    if (changes.status) assertTransition(ticket.status, changes.status, actor);
    if (changes.assigneeId !== undefined) {
      if (
        actor.role === 'AGENT' &&
        (changes.assigneeId !== actor.id ||
          (ticket.assigneeId && ticket.assigneeId !== actor.id))
      )
        throw new ForbiddenException(
          'Agents can claim unassigned tickets. Reassignment requires an admin.',
        );
      if (changes.assigneeId) {
        const assignee = await this.users.findById(changes.assigneeId);
        if (!assignee || assignee.role === 'CUSTOMER')
          throw new ConflictException(
            'Assign tickets to an existing agent or admin.',
          );
      }
    }
    const data: TicketChanges = { ...changes };
    if (changes.status && changes.status !== ticket.status)
      data.resolvedAt = ['RESOLVED', 'CLOSED'].includes(changes.status)
        ? (ticket.resolvedAt ?? new Date())
        : null;
    // Content edits invalidate old analysis rather than showing stale AI advice.
    if (changes.title !== undefined || changes.description !== undefined)
      data.aiAnalysis = { stale: true };
    const detail =
      Object.entries(changes)
        .filter(([key]) => !['description', 'title'].includes(key))
        .map(([key, value]) => `${key}: ${value ?? 'unassigned'}`)
        .join(', ') || 'Ticket content updated';
    const updated = await this.tickets.update(
      id,
      version,
      data,
      actor.id,
      'UPDATED',
      detail,
    );
    if (!updated)
      throw new ConflictException(
        'This ticket changed. Refresh before saving.',
      );
    return updated;
  }
  async comment(actor: Actor, id: string, body: string) {
    const ticket = await this.detail(actor, id);
    if (ticket.status === 'CLOSED')
      throw new ConflictException(
        'Reopen this ticket before adding a comment.',
      );
    if (!(await this.tickets.addComment(id, ticket.version, body, actor.id)))
      throw new ConflictException(
        'This ticket changed. Refresh and try again.',
      );
    return this.detail(actor, id);
  }
  async delete(actor: Actor, id: string, version: number) {
    if (actor.role !== 'ADMIN')
      throw new ForbiddenException('Only admins can delete tickets.');
    const ticket = await this.detail(actor, id);
    if (ticket.version !== version || !(await this.tickets.delete(id, version)))
      throw new ConflictException(
        'This ticket changed. Refresh before deleting.',
      );
  }
}
