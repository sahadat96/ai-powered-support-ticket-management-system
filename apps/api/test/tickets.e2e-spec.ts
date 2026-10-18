import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import request from 'supertest';
import { hash } from 'bcryptjs';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/shared/infrastructure/prisma.service';

describe('Real PostgreSQL API integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let customer: string;
  let other: string;
  let agent: string;
  let admin: string;
  let cookie: string;
  let ticket: { id: string; version: number };
  const password = 'IntegrationTest123!';
  beforeAll(async () => {
    execFileSync(
      process.execPath,
      [
        require.resolve('prisma/build/index.js'),
        'migrate',
        'deploy',
        '--schema',
        join(__dirname, '../prisma/schema.prisma'),
      ],
      { env: process.env, stdio: 'pipe' },
    );
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = configureApp(module.createNestApplication());
    await app.init();
    prisma = app.get(PrismaService);
    const passwordHash = await hash(password, 4);
    await prisma.user.createMany({
      data: [
        {
          name: 'Agent',
          email: 'agent@test.local',
          passwordHash,
          role: 'AGENT',
        },
        {
          name: 'Admin',
          email: 'admin@test.local',
          passwordHash,
          role: 'ADMIN',
        },
      ],
    });
    const register = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ name: 'Customer', email: 'customer@test.local', password })
      .expect(201);
    customer = register.body.accessToken;
    cookie = register.headers['set-cookie'][0].split(';')[0];
    expect(register.body.user).not.toHaveProperty('passwordHash');
    other = (
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ name: 'Other', email: 'other@test.local', password })
        .expect(201)
    ).body.accessToken;
    agent = (
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'agent@test.local', password })
        .expect(200)
    ).body.accessToken;
    admin = (
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'admin@test.local', password })
        .expect(200)
    ).body.accessToken;
  });
  afterAll(async () => {
    if (prisma && /^test_\d+_\d+$/.test(process.env.TEST_SCHEMA ?? ''))
      await prisma.$executeRawUnsafe(
        `DROP SCHEMA "${process.env.TEST_SCHEMA}" CASCADE`,
      );
    if (app) await app.close();
  });
  const api = () => request(app.getHttpServer());
  it('protects routes and rejects role escalation', async () => {
    await api().get('/api/v1/tickets').expect(401);
    await api()
      .post('/api/v1/auth/register')
      .send({
        name: 'Hacker',
        email: 'hacker@test.local',
        password,
        role: 'ADMIN',
      })
      .expect(400);
    await api()
      .post('/api/v1/auth/register')
      .send({
        name: 'Byte limit',
        email: 'bytes@test.local',
        password: `A1${'é'.repeat(40)}`,
      })
      .expect(400);
    await api()
      .get('/api/v1/auth/staff')
      .auth(customer, { type: 'bearer' })
      .expect(403);
  });
  it('validates input and creates a persisted ticket', async () => {
    await api()
      .post('/api/v1/tickets')
      .auth(customer, { type: 'bearer' })
      .send({ title: 'x', description: 'short' })
      .expect(400);
    const response = await api()
      .post('/api/v1/tickets')
      .auth(customer, { type: 'bearer' })
      .send({
        title: 'Production API outage',
        description:
          'The production API is down for all users and returns timeout errors.',
      })
      .expect(201);
    ticket = response.body;
    expect(ticket.version).toBe(1);
    expect(await prisma.ticket.count()).toBe(1);
    expect(response.body.requester).not.toHaveProperty('passwordHash');
  });
  it('isolates customer detail, list, and statistics', async () => {
    await api()
      .get(`/api/v1/tickets/${ticket.id}`)
      .auth(other, { type: 'bearer' })
      .expect(404);
    const list = await api()
      .get('/api/v1/tickets')
      .auth(other, { type: 'bearer' })
      .expect(200);
    expect(list.body.total).toBe(0);
    const stats = await api()
      .get('/api/v1/tickets/stats')
      .auth(other, { type: 'bearer' })
      .expect(200);
    expect(stats.body.total).toBe(0);
  });
  it('rejects null fields, invalid pagination, and customer priority changes', async () => {
    await api()
      .patch(`/api/v1/tickets/${ticket.id}`)
      .auth(admin, { type: 'bearer' })
      .send({ version: ticket.version })
      .expect(409);
    await api()
      .patch(`/api/v1/tickets/${ticket.id}`)
      .auth(admin, { type: 'bearer' })
      .send({ version: ticket.version, priority: null })
      .expect(400);
    await api()
      .get('/api/v1/tickets?limit=1000')
      .auth(admin, { type: 'bearer' })
      .expect(400);
    await api()
      .patch(`/api/v1/tickets/${ticket.id}`)
      .auth(customer, { type: 'bearer' })
      .send({ version: ticket.version, priority: 'URGENT' })
      .expect(403);
  });
  it('blocks cross-origin cookie writes and permits same-origin writes', async () => {
    const path = `/api/v1/tickets/${ticket.id}/comments`;
    await api()
      .post(path)
      .set('Cookie', cookie)
      .set('Origin', 'https://evil.example')
      .send({ body: 'forged reply' })
      .expect(403);
    const result = await api()
      .post(path)
      .set('Cookie', cookie)
      .set('Origin', process.env.WEB_ORIGIN!)
      .send({ body: 'Additional context from the requester.' })
      .expect(201);
    ticket = result.body;
    expect(result.body.comments).toHaveLength(1);
  });
  it('persists AI suggestions without silently applying them', async () => {
    await api()
      .post(`/api/v1/tickets/${ticket.id}/analysis`)
      .auth(customer, { type: 'bearer' })
      .send({ version: ticket.version })
      .expect(403);
    const result = await api()
      .post(`/api/v1/tickets/${ticket.id}/analysis`)
      .auth(agent, { type: 'bearer' })
      .send({ version: ticket.version })
      .expect(201);
    ticket = result.body;
    expect(result.body.aiAnalysis.priority).toBe('URGENT');
    expect(result.body.priority).toBe('MEDIUM');
  });
  it('allows exactly one of two concurrent writes with the same version', async () => {
    const results = await Promise.all(
      ['HIGH', 'LOW'].map((priority) =>
        api()
          .patch(`/api/v1/tickets/${ticket.id}`)
          .auth(admin, { type: 'bearer' })
          .send({ version: ticket.version, priority }),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    ticket = results.find((r) => r.status === 200)!.body;
  });
  it('rejects invalid status jumps and progresses through resolution', async () => {
    await api()
      .patch(`/api/v1/tickets/${ticket.id}`)
      .auth(agent, { type: 'bearer' })
      .send({ version: ticket.version, status: 'RESOLVED' })
      .expect(409);
    for (const status of ['IN_PROGRESS', 'WAITING_ON_CUSTOMER', 'RESOLVED'])
      ticket = (
        await api()
          .patch(`/api/v1/tickets/${ticket.id}`)
          .auth(agent, { type: 'bearer' })
          .send({ version: ticket.version, status })
          .expect(200)
      ).body;
    const result = await api()
      .patch(`/api/v1/tickets/${ticket.id}`)
      .auth(customer, { type: 'bearer' })
      .send({ version: ticket.version, status: 'CLOSED' })
      .expect(200);
    ticket = result.body;
    expect(result.body.resolvedAt).toBeTruthy();
    await api()
      .post(`/api/v1/tickets/${ticket.id}/comments`)
      .auth(customer, { type: 'bearer' })
      .send({ body: 'Too late' })
      .expect(409);
  });
  it('returns accurate aggregate stats and an audit trail', async () => {
    const stats = await api()
      .get('/api/v1/tickets/stats')
      .auth(admin, { type: 'bearer' })
      .expect(200);
    expect(stats.body.total).toBe(1);
    expect(stats.body.resolved).toBe(1);
    const detail = await api()
      .get(`/api/v1/tickets/${ticket.id}`)
      .auth(admin, { type: 'bearer' })
      .expect(200);
    expect(
      detail.body.activities.some(
        (a: { action: string }) => a.action === 'ANALYZED',
      ),
    ).toBe(true);
  });
  it('limits deletion to admins and cascades child records', async () => {
    await api()
      .delete(`/api/v1/tickets/${ticket.id}`)
      .auth(agent, { type: 'bearer' })
      .send({ version: ticket.version })
      .expect(403);
    await api()
      .delete(`/api/v1/tickets/${ticket.id}`)
      .auth(admin, { type: 'bearer' })
      .send({ version: ticket.version })
      .expect(204);
    expect(await prisma.comment.count()).toBe(0);
    expect(await prisma.activity.count()).toBe(0);
  });
  it('serves API documentation and database health', async () => {
    await api().get('/api/v1/health').expect(200);
    await api().get('/docs-json').expect(200);
  });
});
