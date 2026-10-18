import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { TicketRepository } from '../domain/ticket.repository';
import { UserRepository } from '../../users/domain/user.repository';

describe('Ticket application permissions and concurrency', () => {
  const tickets = {
    findById: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    addComment: jest.fn(),
  };
  const users = { findById: jest.fn() };
  const actor = { id: 'owner', role: 'CUSTOMER' as const };
  const admin = { id: 'admin', role: 'ADMIN' as const };
  let service: TicketsService;
  beforeEach(() => {
    jest.resetAllMocks();
    tickets.findById.mockResolvedValue({
      id: 'ticket',
      requesterId: 'owner',
      status: 'OPEN',
      version: 2,
      assigneeId: null,
    });
    service = new TicketsService(
      tickets as unknown as TicketRepository,
      users as unknown as UserRepository,
    );
  });
  it('hides another customer’s ticket', async () => {
    await expect(
      service.detail({ id: 'other', role: 'CUSTOMER' }, 'ticket'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
  it('rejects stale versions before writing', async () => {
    await expect(
      service.update(admin, 'ticket', { version: 1, priority: 'HIGH' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tickets.update).not.toHaveBeenCalled();
  });
  it('rejects a patch containing only the version and undefined DTO fields', async () => {
    await expect(
      service.update(admin, 'ticket', {
        version: 2,
        title: undefined,
        priority: undefined,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tickets.update).not.toHaveBeenCalled();
  });
  it('reports a conflict if a concurrent write wins after the read', async () => {
    tickets.update.mockResolvedValue(null);
    await expect(
      service.update(admin, 'ticket', { version: 2, priority: 'HIGH' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
  it('prevents customers changing staff-controlled fields', async () => {
    await expect(
      service.update(actor, 'ticket', { version: 2, priority: 'URGENT' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('prevents assignment to a customer', async () => {
    users.findById.mockResolvedValue({ role: 'CUSTOMER' });
    await expect(
      service.update(admin, 'ticket', { version: 2, assigneeId: 'customer' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
  it('prevents agents reassigning another agent’s ticket', async () => {
    tickets.findById.mockResolvedValue({
      requesterId: 'owner',
      status: 'OPEN',
      version: 2,
      assigneeId: 'other',
    });
    await expect(
      service.update({ id: 'agent', role: 'AGENT' }, 'ticket', {
        version: 2,
        assigneeId: 'agent',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('prevents comments on closed tickets', async () => {
    tickets.findById.mockResolvedValue({
      requesterId: 'owner',
      status: 'CLOSED',
      version: 2,
    });
    await expect(
      service.comment(actor, 'ticket', 'Reply'),
    ).rejects.toBeInstanceOf(ConflictException);
  });
  it('requires admin for deletion', async () => {
    await expect(service.delete(actor, 'ticket', 2)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
