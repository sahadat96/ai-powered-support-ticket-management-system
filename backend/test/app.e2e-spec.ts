import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { configureApp } from '../src/bootstrap';
import { createPrismaClient } from '../src/database/prisma-client';
import { DashboardStats, Ticket } from '../src/modules/tickets/domain/ticket';
import { TicketRepository } from '../src/modules/tickets/domain/ticket.repository';
import { UserRole } from '../src/modules/users/domain/user';
import {
  EmailAlreadyExistsError,
  UserRepository,
} from '../src/modules/users/domain/user.repository';

type Client = ReturnType<typeof request.agent>;
interface Actor {
  id: string;
  email: string;
  client: Client;
  registrationCookies: string[];
}

describe('Support desk HTTP integration against PostgreSQL', () => {
  const runId = randomUUID();
  const password = `Assessment-${runId}`;
  const prefix = '/api/v1';
  const emails = ['requester', 'other', 'agent', 'admin', 'injected', 'duplicate'].map(
    (name) => `e2e-${name}-${runId}@example.com`,
  );
  let app: INestApplication | undefined;
  let data: ReturnType<typeof createPrismaClient> | undefined;
  let verifiedDatabase = false;
  let customer: Actor;
  let otherCustomer: Actor;
  let agent: Actor;
  let admin: Actor;
  let ownTicket: Ticket;
  let otherTicket: Ticket;

  function assertTestDatabase(name: string): void {
    if (!/(?:-test|_test)$/.test(name)) {
      throw new Error(
        'HTTP tests require a dedicated PostgreSQL database ending in -test or _test',
      );
    }
  }

  async function register(index: number): Promise<Actor> {
    const client = request.agent(app!.getHttpServer());
    const response = await client
      .post(`${prefix}/auth/register`)
      .send({
        name: `HTTP Test ${index}`,
        email: emails[index],
        password,
      })
      .expect(201);
    return {
      id: response.body.user.id as string,
      email: emails[index],
      client,
      registrationCookies: response.headers['set-cookie'] as unknown as string[],
    };
  }

  async function createTicket(
    actor: Actor,
    title = 'Unable to access the account dashboard',
    fields: Record<string, unknown> = {},
  ): Promise<Ticket> {
    const response = await actor.client
      .post(`${prefix}/tickets`)
      .send({
        title: `${runId} ${title}`,
        description:
          'Our team cannot access the account dashboard after signing in. Please investigate this problem.',
        ...fields,
      })
      .expect(201);
    return response.body as Ticket;
  }

  beforeAll(async () => {
    const testUrl = process.env.TEST_DATABASE_URL;
    if (!testUrl)
      throw new Error('Set TEST_DATABASE_URL to a migrated, dedicated PostgreSQL test database');
    const parsed = new URL(testUrl);
    if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
      throw new Error('TEST_DATABASE_URL must use PostgreSQL');
    }
    assertTestDatabase(decodeURIComponent(parsed.pathname.slice(1)));
    data = createPrismaClient(testUrl);
    const [{ name }] = await data.$queryRaw<
      {
        name: string;
      }[]
    >`SELECT current_database() AS name`;
    assertTestDatabase(name);
    verifiedDatabase = true;

    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = testUrl;
    process.env.JWT_SECRET ??= 'http-integration-test-secret-with-more-than-32-characters';
    process.env.FRONTEND_URL ??= 'http://localhost:3000';
    process.env.API_ORIGIN ??= 'http://localhost:4000';
    // AppModule evaluates ConfigModule.forRoot at import, so import after selecting the test database.
    const { AppModule } = await import('../src/app.module');
    app = await NestFactory.create(AppModule, { logger: false });
    configureApp(app);
    await app.init();

    customer = await register(0);
    otherCustomer = await register(1);
    agent = await register(2);
    admin = await register(3);
    await data.user.update({ where: { id: agent.id }, data: { role: UserRole.AGENT } });
    await data.user.update({ where: { id: admin.id }, data: { role: UserRole.ADMIN } });
    for (const actor of [customer, otherCustomer, agent, admin]) {
      await actor.client
        .post(`${prefix}/auth/login`)
        .send({ email: actor.email, password })
        .expect(200);
    }
    ownTicket = await createTicket(customer);
    otherTicket = await createTicket(
      otherCustomer,
      'Billing invoice contains the wrong subscription amount',
    );
  });

  afterAll(async () => {
    try {
      if (data && verifiedDatabase) {
        // Remove only accounts created by this run and tickets requested by those accounts.
        // This deliberately avoids truncate, schema drops, or deleting unrelated fixtures.
        await data.$transaction(async (transaction) => {
          const users = await transaction.user.findMany({
            where: { email: { in: emails } },
            select: { id: true },
          });
          const ids = users.map((user) => user.id);
          if (!ids.length) return;
          const tickets = await transaction.ticket.findMany({
            where: { requesterId: { in: ids } },
            select: { id: true },
          });
          const ticketIds = tickets.map((ticket) => ticket.id);
          await transaction.comment.deleteMany({ where: { ticketId: { in: ticketIds } } });
          await transaction.ticketEvent.deleteMany({ where: { ticketId: { in: ticketIds } } });
          await transaction.ticket.deleteMany({ where: { id: { in: ticketIds } } });
          await transaction.user.deleteMany({ where: { id: { in: ids } } });
        });
      }
    } finally {
      if (app) await app.close();
      if (data) await data.$disconnect();
    }
  });

  it('serves database health publicly and rejects unauthenticated private requests', async () => {
    await request(app!.getHttpServer())
      .get(`${prefix}/health`)
      .expect(200)
      .expect(({ body }) => expect(body.status).toBe('ok'));
    await request(app!.getHttpServer()).get(`${prefix}/auth/me`).expect(401);
    await request(app!.getHttpServer()).get(`${prefix}/tickets`).expect(401);
  });

  it('uses HTTP-only session cookies and exposes no hashes or browser bearer tokens', async () => {
    expect(
      customer.registrationCookies.some(
        (cookie) =>
          cookie.startsWith('support_session=') &&
          cookie.includes('HttpOnly') &&
          cookie.includes('SameSite=Lax') &&
          cookie.includes('Path=/'),
      ),
    ).toBe(true);
    const response = await customer.client.get(`${prefix}/auth/me`).expect(200);
    expect(response.body.user).toEqual({
      id: customer.id,
      email: customer.email,
      name: 'HTTP Test 0',
      role: 'CUSTOMER',
    });
    expect(response.body).not.toHaveProperty('token');
    expect(JSON.stringify(response.body)).not.toMatch(
      /"(?:password|passwordHash|password_hash)"\s*:/i,
    );
    expect(JSON.stringify(ownTicket)).not.toMatch(/"(?:password|passwordHash|password_hash)"\s*:/i);
  });

  it('returns a generic failure for incorrect and unknown login credentials', async () => {
    const known = await request(app!.getHttpServer())
      .post(`${prefix}/auth/login`)
      .send({ email: customer.email, password: 'incorrect-password' })
      .expect(401);
    const unknown = await request(app!.getHttpServer())
      .post(`${prefix}/auth/login`)
      .send({ email: `unknown-${runId}@example.com`, password: 'incorrect-password' })
      .expect(401);
    expect(known.body.message).toEqual(unknown.body.message);
  });

  it('rejects registration role injection rather than granting elevated access', async () => {
    await request(app!.getHttpServer())
      .post(`${prefix}/auth/register`)
      .send({
        email: emails[4],
        name: 'Injected Admin',
        password,
        role: 'ADMIN',
      })
      .expect(400);
    const count = await data!.user.count({ where: { email: emails[4] } });
    expect(count).toBe(0);
  });

  it('maps concurrent duplicate-email database failures to the domain error', async () => {
    const repository = app!.get(UserRepository);
    const { passwordHash } = await data!.user.findUniqueOrThrow({
      where: { id: customer.id },
      select: { passwordHash: true },
    });
    const input = {
      email: emails[5],
      name: 'Concurrent registration test',
      role: UserRole.CUSTOMER,
      passwordHash,
    };
    const outcomes = await Promise.allSettled([repository.create(input), repository.create(input)]);
    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
    const failures = outcomes.filter(
      (outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected',
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].reason).toBeInstanceOf(EmailAlreadyExistsError);
    expect(await data!.user.count({ where: { email: emails[5] } })).toBe(1);
  });

  it('rolls back the ticket update when inserting its audit event violates a foreign key', async () => {
    const repository = app!.get(TicketRepository);
    const select = { title: true, version: true, updatedAt: true, deletedAt: true } as const;
    const before = await data!.ticket.findUniqueOrThrow({
      where: { id: ownTicket.id },
      select,
    });
    expect(before.deletedAt).toBeNull();
    const eventCount = await data!.ticketEvent.count({ where: { ticketId: ownTicket.id } });
    const missingActorId = randomUUID();
    expect(await data!.user.findUnique({ where: { id: missingActorId } })).toBeNull();

    await expect(
      repository.update(
        ownTicket.id,
        before.version,
        { title: `${runId} This failed update must be rolled back` },
        missingActorId,
        'UPDATED',
        'This audit event has no valid actor',
      ),
    ).rejects.toMatchObject({ code: 'P2003' });

    const after = await data!.ticket.findUniqueOrThrow({
      where: { id: ownTicket.id },
      select,
    });
    expect(after).toEqual(before);
    expect(await data!.ticketEvent.count({ where: { ticketId: ownTicket.id } })).toBe(eventCount);
  });

  it('validates ticket content, unknown fields, versions, UUIDs, and pagination', async () => {
    await customer.client
      .post(`${prefix}/tickets`)
      .send({ title: 'tiny', description: 'too short' })
      .expect(400);
    await customer.client
      .post(`${prefix}/tickets`)
      .send({
        title: 'A valid ticket title',
        description: 'A sufficiently detailed explanation of this issue.',
        requesterId: otherCustomer.id,
      })
      .expect(400);
    await customer.client
      .patch(`${prefix}/tickets/${ownTicket.id}`)
      .send({ version: '1', title: 'A valid new title' })
      .expect(400);
    await customer.client.get(`${prefix}/tickets/not-a-uuid`).expect(400);
    await customer.client.get(`${prefix}/tickets`).query({ limit: 51 }).expect(400);
  });

  it('rejects foreign unsafe origins and accepts requests from the API origin used by Swagger', async () => {
    await customer.client
      .post(`${prefix}/tickets`)
      .set('Origin', 'https://foreign.example')
      .send({
        title: 'A valid ticket title',
        description: 'A sufficiently detailed explanation of this issue.',
      })
      .expect(403);
    await customer.client
      .post(`${prefix}/tickets`)
      .set('Origin', process.env.API_ORIGIN!)
      .send({
        title: `${runId} Same-origin API request`,
        description: 'A sufficiently detailed explanation of this issue.',
      })
      .expect(201);
  });

  it('creates tickets with server-owned identity and persisted ML suggestions', async () => {
    expect(ownTicket).toMatchObject({
      status: 'OPEN',
      version: 1,
      requesterId: customer.id,
      assigneeId: null,
    });
    expect(ownTicket.number).toBeGreaterThan(0);
    expect(['ACCOUNT', 'TECHNICAL', 'BILLING', 'GENERAL']).toContain(ownTicket.category);
    expect(ownTicket.ai).toBeDefined();
    const detail = await customer.client.get(`${prefix}/tickets/${ownTicket.id}`).expect(200);
    expect(detail.body.ticket.ai).toEqual(ownTicket.ai);
    expect(detail.body.events).toEqual(
      expect.arrayContaining([expect.objectContaining({ action: 'CREATED' })]),
    );
  });

  it('isolates customer lists and returns 404 for another customer ticket', async () => {
    const list = await customer.client.get(`${prefix}/tickets`).query({ limit: 50 }).expect(200);
    expect(list.body.items.map((item: Ticket) => item.id)).toContain(ownTicket.id);
    expect(list.body.items.map((item: Ticket) => item.id)).not.toContain(otherTicket.id);
    expect(list.body.items.every((item: Ticket) => item.requesterId === customer.id)).toBe(true);
    await customer.client.get(`${prefix}/tickets/${otherTicket.id}`).expect(404);
    await customer.client
      .patch(`${prefix}/tickets/${otherTicket.id}`)
      .send({ version: otherTicket.version, title: 'Unauthorized changed title' })
      .expect(404);
    await customer.client
      .post(`${prefix}/tickets/${otherTicket.id}/comments`)
      .send({ body: 'Unauthorized reply' })
      .expect(404);
  });

  it('limits the assignment directory to staff and returns sanitized staff records', async () => {
    await customer.client.get(`${prefix}/users/agents`).expect(403);
    const response = await agent.client.get(`${prefix}/users/agents`).expect(200);
    expect(response.body.items.map((item: { id: string }) => item.id)).toEqual(
      expect.arrayContaining([agent.id, admin.id]),
    );
    expect(
      response.body.items.every((item: { role: string }) => ['AGENT', 'ADMIN'].includes(item.role)),
    ).toBe(true);
    expect(JSON.stringify(response.body)).not.toMatch(
      /"(?:password|passwordHash|password_hash)"\s*:/i,
    );
  });

  it('prevents customers from assigning, prioritizing, reclassifying, rerunning ML, or posting internal notes', async () => {
    for (const fields of [
      { assigneeId: agent.id },
      { priority: 'URGENT' },
      { category: 'BILLING' },
    ]) {
      await customer.client
        .patch(`${prefix}/tickets/${ownTicket.id}`)
        .send({ version: 1, ...fields })
        .expect(403);
    }
    await customer.client
      .post(`${prefix}/tickets/${ownTicket.id}/triage`)
      .send({ version: 1 })
      .expect(403);
    await customer.client
      .post(`${prefix}/tickets/${ownTicket.id}/comments`)
      .send({ body: 'Private escalation', internal: true })
      .expect(403);
  });

  it('requires a real staff assignee and enforces the complete status workflow with reopen', async () => {
    let ticket = await createTicket(customer, 'Workflow integration case');
    const path = `${prefix}/tickets/${ticket.id}`;
    await agent.client
      .patch(`${path}/status`)
      .send({ version: ticket.version, status: 'IN_PROGRESS' })
      .expect(400);
    await agent.client
      .patch(`${path}/status`)
      .send({ version: ticket.version, status: 'RESOLVED' })
      .expect(400);
    await agent.client
      .patch(path)
      .send({ version: ticket.version, assigneeId: customer.id })
      .expect(400);
    await agent.client
      .patch(path)
      .send({ version: ticket.version, assigneeId: randomUUID() })
      .expect(400);
    ticket = (
      await agent.client
        .patch(path)
        .send({ version: ticket.version, assigneeId: agent.id })
        .expect(200)
    ).body as Ticket;
    expect(ticket.assigneeId).toBe(agent.id);
    ticket = (
      await agent.client
        .patch(`${path}/status`)
        .send({ version: ticket.version, status: 'IN_PROGRESS' })
        .expect(200)
    ).body as Ticket;
    await agent.client.patch(path).send({ version: ticket.version, assigneeId: null }).expect(400);
    await customer.client
      .patch(path)
      .send({
        version: ticket.version,
        title: 'Customer changed a ticket while work is in progress',
      })
      .expect(403);
    ticket = (
      await agent.client
        .patch(`${path}/status`)
        .send({ version: ticket.version, status: 'RESOLVED' })
        .expect(200)
    ).body as Ticket;
    expect(ticket.resolvedAt).toBeTruthy();
    ticket = (
      await customer.client
        .patch(`${path}/status`)
        .send({ version: ticket.version, status: 'CLOSED' })
        .expect(200)
    ).body as Ticket;
    expect(ticket.status).toBe('CLOSED');
    await customer.client
      .post(`${path}/comments`)
      .send({ body: 'This must not appear on a closed ticket.' })
      .expect(400);
    ticket = (
      await customer.client
        .patch(`${path}/status`)
        .send({ version: ticket.version, status: 'OPEN' })
        .expect(200)
    ).body as Ticket;
    expect(ticket.status).toBe('OPEN');
    expect(ticket.resolvedAt).toBeNull();
    await agent.client
      .patch(path)
      .send({ version: 1, title: 'Stale version cannot overwrite the reopened ticket' })
      .expect(409);
  });

  it('hides internal note bodies and audit events from requesters while preserving public replies', async () => {
    const ticket = await createTicket(customer, 'Visibility integration case');
    const path = `${prefix}/tickets/${ticket.id}`;
    const note = `Private investigation ${runId}`;
    const reply = `Public requester reply ${runId}`;
    await agent.client.post(`${path}/comments`).send({ body: note, internal: true }).expect(201);
    await customer.client.post(`${path}/comments`).send({ body: reply }).expect(201);
    const staffDetail = await agent.client.get(path).expect(200);
    expect(staffDetail.body.comments).toHaveLength(2);
    expect(staffDetail.body.events).toEqual(
      expect.arrayContaining([expect.objectContaining({ action: 'INTERNAL_NOTE_ADDED' })]),
    );
    const requesterDetail = await customer.client.get(path).expect(200);
    expect(requesterDetail.body.comments).toHaveLength(1);
    expect(requesterDetail.body.comments[0].body).toBe(reply);
    expect(
      requesterDetail.body.events.some(
        (event: { action: string }) => event.action === 'INTERNAL_NOTE_ADDED',
      ),
    ).toBe(false);
    expect(JSON.stringify(requesterDetail.body)).not.toContain(note);
  });

  it('allows only one of two concurrent updates with the same version', async () => {
    const ticket = await createTicket(customer, 'Optimistic concurrency integration case');
    const path = `${prefix}/tickets/${ticket.id}`;
    const responses = await Promise.all([
      agent.client
        .patch(path)
        .send({ version: ticket.version, title: `${runId} Concurrent first change` }),
      admin.client
        .patch(path)
        .send({ version: ticket.version, title: `${runId} Concurrent second change` }),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    const detail = await agent.client.get(path).expect(200);
    expect(detail.body.ticket.version).toBe(ticket.version + 1);
    expect(
      detail.body.events.filter((event: { action: string }) => event.action === 'UPDATED'),
    ).toHaveLength(1);
  });

  it('soft deletes open requester tickets and keeps closed-ticket deletion restricted to administrators', async () => {
    const open = await createTicket(customer, 'Requester archive integration case');
    await customer.client
      .delete(`${prefix}/tickets/${open.id}`)
      .query({ version: open.version })
      .expect(204);
    await customer.client.get(`${prefix}/tickets/${open.id}`).expect(404);
    const list = await customer.client.get(`${prefix}/tickets`).query({ limit: 50 }).expect(200);
    expect(list.body.items.map((item: Ticket) => item.id)).not.toContain(open.id);
    const stored = await data!.ticket.findUniqueOrThrow({
      where: { id: open.id },
      select: { deletedAt: true },
    });
    expect(stored.deletedAt).not.toBeNull();

    const created = await createTicket(customer, 'Administrator archive integration case');
    const closed = (
      await customer.client
        .patch(`${prefix}/tickets/${created.id}/status`)
        .send({ version: created.version, status: 'CLOSED' })
        .expect(200)
    ).body as Ticket;
    await customer.client
      .delete(`${prefix}/tickets/${closed.id}`)
      .query({ version: closed.version })
      .expect(403);
    await agent.client
      .delete(`${prefix}/tickets/${closed.id}`)
      .query({ version: closed.version })
      .expect(403);
    await admin.client
      .delete(`${prefix}/tickets/${closed.id}`)
      .query({ version: closed.version })
      .expect(204);
    await admin.client.get(`${prefix}/tickets/${closed.id}`).expect(404);
  });

  it('paginates priority sorting deterministically and treats search wildcards literally', async () => {
    const literal = await createTicket(customer, 'Literal %_ search marker', {
      priority: 'LOW',
      category: 'BILLING',
    });
    const urgent = await createTicket(customer, 'Critical outage search marker', {
      priority: 'URGENT',
      category: 'TECHNICAL',
    });
    const first = await agent.client
      .get(`${prefix}/tickets`)
      .query({ sort: 'priority', page: 1, limit: 2 })
      .expect(200);
    const second = await agent.client
      .get(`${prefix}/tickets`)
      .query({ sort: 'priority', page: 2, limit: 2 })
      .expect(200);
    expect(first.body.items).toHaveLength(2);
    expect(second.body.items).toHaveLength(2);
    const ids = [...first.body.items, ...second.body.items].map((item: Ticket) => item.id);
    expect(new Set(ids).size).toBe(4);
    const priorities = ['URGENT', 'HIGH', 'MEDIUM', 'LOW'];
    const ranks = [...first.body.items, ...second.body.items].map((item: Ticket) =>
      priorities.indexOf(item.priority),
    );
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    const search = await customer.client
      .get(`${prefix}/tickets`)
      .query({ search: '%_', limit: 50 })
      .expect(200);
    expect(search.body.items.map((item: Ticket) => item.id)).toContain(literal.id);
    expect(search.body.items.map((item: Ticket) => item.id)).not.toContain(urgent.id);
    expect(
      search.body.items.every(
        (item: Ticket) => item.title.includes('%_') || item.description.includes('%_'),
      ),
    ).toBe(true);
    const filtered = await customer.client
      .get(`${prefix}/tickets`)
      .query({ category: 'TECHNICAL', priority: 'URGENT', unassigned: 'true' })
      .expect(200);
    expect(filtered.body.items.map((item: Ticket) => item.id)).toContain(urgent.id);
  });

  it('scopes dashboard aggregates to the requester and keeps staff aggregates complete', async () => {
    const customerResponse = await customer.client.get(`${prefix}/tickets/stats`).expect(200);
    const staffResponse = await agent.client.get(`${prefix}/tickets/stats`).expect(200);
    const ownTotal = await data!.ticket.count({
      where: { requesterId: customer.id, deletedAt: null },
    });
    const allTotal = await data!.ticket.count({ where: { deletedAt: null } });
    expect(customerResponse.body.total).toBe(ownTotal);
    expect(staffResponse.body.total).toBe(allTotal);
    expect(allTotal).toBeGreaterThan(ownTotal);
    for (const stats of [customerResponse.body, staffResponse.body] as DashboardStats[]) {
      expect(stats.open + stats.inProgress + stats.resolved + stats.closed).toBe(stats.total);
      expect(stats.byCategory.reduce((sum, item) => sum + item.count, 0)).toBe(stats.total);
      expect(stats.byPriority.reduce((sum, item) => sum + item.count, 0)).toBe(stats.total);
      expect(stats.dailyCreated).toHaveLength(7);
    }
  });

  it('clears the browser session when logging out', async () => {
    const response = await otherCustomer.client.post(`${prefix}/auth/logout`).expect(204);
    const cookies = response.headers['set-cookie'] as unknown as string[];
    expect(
      cookies.some(
        (cookie) => cookie.startsWith('support_session=;') && cookie.includes('Expires='),
      ),
    ).toBe(true);
    await otherCustomer.client.get(`${prefix}/auth/me`).expect(401);
  });
});
