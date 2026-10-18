# Relay · AI-Powered Support Ticket Management

A support workspace built with **NestJS, Next.js, PostgreSQL, Prisma, and TypeScript**. Customers submit requests, agents work the queue, and admins manage assignments. A local machine-learning classifier suggests categories; explainable rules suggest priorities. People review every suggestion before applying it.

## Run locally

Requirements: Node.js **22.14+** (24 recommended), npm, PostgreSQL 17 or 18.

```bash
npm ci
cp .env.example .env
```

Edit the root `.env`: set `DATABASE_URL` for `ai-powered-ticket-management`, a random `JWT_SECRET` of at least 32 characters, and `DEMO_PASSWORD` with at least 10 characters including a letter and number. Generate a secret with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. URL-encode special characters in database credentials.

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

**In the original local checkout, `.env` is already configured and the database migrated and seeded.** Do not replace that file unless reconfiguring. Both apps read the root `.env`; it is ignored by Git.

| Service            | URL                                 |
| ------------------ | ----------------------------------- |
| Application        | http://localhost:3000               |
| Swagger UI         | http://localhost:4000/docs          |
| OpenAPI JSON       | http://localhost:4000/docs-json     |
| API base           | http://localhost:4000/api/v1        |
| Database readiness | http://localhost:4000/api/v1/health |

Optional Docker database: set `POSTGRES_PASSWORD` in `.env`, align it with `DATABASE_URL`, and run `docker compose --profile local-db up -d`. Skip Docker for your existing database. Migrations require an existing database and permission to create its tables/types.

## Demo accounts

All accounts use **`DEMO_PASSWORD` from your local `.env`**. The initial local demo value is `ChangeMe123!`; change it before first seeding any shared environment.

| Email                    | Role     | Capabilities                                                        |
| ------------------------ | -------- | ------------------------------------------------------------------- |
| `admin@support.local`    | Admin    | Shared queue, assignment, triage, status, replies, deletion         |
| `agent@support.local`    | Agent    | Shared queue, claim unassigned tickets, triage, status, replies     |
| `customer@support.local` | Customer | Own requests, edit while open, reply, close/reopen resolved tickets |

Registration always creates a customer. Staff are provisioned through the explicit seed script. The seed adds 10 example tickets and preserves existing matching users/tickets. Re-running it does not reset passwords or undo ticket changes. It prints no passwords.

## Features

- Bcrypt passwords, expiring JWTs, HttpOnly browser cookies, role and ownership checks.
- Responsive dashboard, category charts, search, filters, pagination, personal assignment view, and insights.
- Ticket CRUD, assignment, controlled status transitions, replies, and activity history.
- Version checks to prevent concurrent edits silently overwriting work.
- Local AI preview, saved triage suggestions, explicit approval, and editable reply templates.
- Validated inputs, consistent errors, loading/empty/success/error states, throttling, CORS, and cookie origin checks.
- Swagger, committed migrations, repeatable seed, unit/integration/browser tests, and CI.

## Architecture

```text
apps/api/
  prisma/                 schema, SQL migrations, demo seed
  src/modules/
    auth/                 sessions, authentication, roles
    users/                identity repository
    tickets/              lifecycle, CRUD, comments, statistics
    ai/                   classifier and triage use cases
  src/shared/             database, errors, readiness
  test/                   PostgreSQL HTTP integration tests
apps/web/
  src/app/                Next.js screens and same-origin API proxy
  src/components/         session, layout, tables, charts, UI states
  src/lib/                API client, types, query hook
docs/                     architecture, verification, demo guide
tests/browser/            Playwright desktop/mobile scenarios
```

Features separate **presentation → application → domain**, with infrastructure implementing domain ports. Domain policies import neither NestJS nor Prisma. Nest modules bind concrete adapters through dependency injection. Application orchestration deliberately uses Nest DI and HTTP exceptions; business rules and contracts remain independent. Read [architecture](docs/ARCHITECTURE.md).

## AI feature

No external AI service, paid API, API key, or runtime internet access is needed for classification.

- Input: ticket title and description.
- Category: multinomial Naive Bayes with Laplace smoothing, trained on 32 authored English examples. Unfamiliar/low-confidence text falls back to general review.
- Priority: separate, explainable impact-word rules.
- Other output: model score, reasons, short text extract, and category-specific reply template.
- Human control: analysis never silently changes category/priority or sends replies. Content edits mark old analysis stale.
- Evaluation: `npm run ai:evaluate` uses 16 held-out synthetic examples. Initial result: **16/16**, a small demonstration rather than a real-world accuracy claim.
- Limitations: English only, small vocabulary, ambiguous/mixed topics, incomplete negation handling, uncalibrated scores, and no verified business impact. Summaries are extracts and replies are templates.

## Verify

```bash
npm run typecheck
npm run format:check
npm test
npm run test:e2e
npm run ai:evaluate
npm run build
npx playwright install chromium
npm run test:ui
```

Database integration tests migrate and drop their own `test_<pid>_<timestamp>` schema, preserving public tables. The database user needs schema-creation permission. Browser tests use seeded accounts and remove their own tickets; use a development database. Minimal Linux hosts may need `npx playwright install --with-deps chromium` with system privileges. Read [testing](docs/TESTING.md).

## Production builds

```bash
npm run build
# Separate terminals/processes:
npm run start -w apps/api
npm run start -w apps/web
```

Provide production process variables: `NODE_ENV=production`, a fresh `JWT_SECRET`, production `DATABASE_URL`, exact HTTPS `WEB_ORIGIN` without trailing slash, internal `API_URL`, and API `PORT=4000`. Set the frontend port separately to 3000. HTTPS is required for production Secure cookies. Apply migrations before startup and avoid demo accounts publicly. No public deployment is provisioned here.

## Project notes

- Feature branches are merged into `sahadat` with explicit merge commits. No artificial commit delays or authorship claims are used.
- AI coding assistance was used. The supplied assessment prohibits AI-generated submissions; this implementation does not satisfy that independent-authorship policy.
- Logout clears the browser cookie; a copied bearer token remains valid until expiry. There is no refresh/revocation system.
- Throttling is in-memory. Proxied traffic shares the proxy IP; production needs trusted proxy configuration and a distributed/per-user limit strategy.
- Patched transitive dependencies are pinned with root overrides and checked through migration, Swagger, tests, and builds.
- See [the demonstration guide](docs/DEMO.md) for the walkthrough and scope limits.

Framework references: [NestJS guards](https://docs.nestjs.com/guards), [Swagger security](https://docs.nestjs.com/openapi/security), [Next.js App Router](https://nextjs.org/docs/app/getting-started), [Prisma 6 migrations](https://www.prisma.io/docs/orm/v6/prisma-migrate/getting-started).
