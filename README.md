# AI-Powered Support Ticket Management

A support workspace with a separate NestJS API and Next.js frontend. Customers open tickets and follow conversations; support staff manage assignments, priorities, status, and private notes. A local machine-learning model suggests ticket categories without an external AI service or API key.

## Run locally

Requirements: Node.js 22.12 LTS or Node.js 24 and newer, npm, and PostgreSQL 14 or newer.

```bash
npm run setup
cp .env.example .env
cp frontend/.env.example frontend/.env.local
```

Edit the root `.env`:

```dotenv
DATABASE_URL=postgresql://user:your-password@localhost:5432/ai-powered-ticket-management
JWT_SECRET=your-random-secret-with-at-least-32-characters
FRONTEND_URL=http://localhost:3000
API_ORIGIN=http://localhost:4000
SEED_DEMO=true
DEMO_PASSWORD=your-local-demo-password
```

Generate a random JWT secret with `openssl rand -hex 32`. URL-encode special characters in database credentials. The backend loads `backend/.env` first, then the root `.env`; a process environment variable takes precedence over both. The frontend reads `frontend/.env.local`, with `API_URL=http://localhost:4000`.

The project uses Prisma 7 with the `ai-powered-ticket-management` database. Its tables and Prisma migration history live in the `support` schema. The backend and Prisma CLI select that schema automatically; the database URL above can stay as written. Existing tables and Prisma migration history in `public` are preserved.

```bash
npm run db:migrate
npm run db:seed
```
Start the applications in separate terminals:

```bash
npm run dev:backend
```

```bash
npm run dev:frontend
```

| Service               | Local address                         |
| --------------------- | ------------------------------------- |
| Application           | <http://localhost:3000>               |
| Swagger / OpenAPI     | <http://localhost:4000/docs>          |
| API                   | <http://localhost:4000/api/v1>        |
| Database health check | <http://localhost:4000/api/v1/health> |

Both services run locally, and optional container setup is described below.

## Demo accounts

The opt-in seed creates these accounts, ten example tickets, conversation replies, an internal note, and activity history:

| Email                    | Role          | Password                        |
| ------------------------ | ------------- | ------------------------------- |
| `admin@support.local`    | Administrator | SupportDemo!2026                |
| `agent@support.local`    | Agent         | SupportDemo!2026                |
| `customer@support.local` | Customer      | SupportDemo!2026               |

For a disposable local demo, `DEMO_PASSWORD=SupportDemo!2026` is a usable example. Seeding requires `SEED_DEMO=true` and is disabled when `NODE_ENV=production`. Running it again preserves existing accounts, passwords, and tickets; changing the environment value does not reset an existing account password.

Optional login shortcuts are controlled by `NEXT_PUBLIC_SHOW_DEMO` and `NEXT_PUBLIC_DEMO_PASSWORD` in `frontend/.env.local`. Enable them only for intentionally public demo credentials; these values are included in browser code. Restart the development server after changing them.

## Main flow

1. Sign in as a customer, create a ticket, and inspect its suggested category, priority, and summary.
2. Sign in as an agent, find the ticket using search or filters, review the suggested reply template, assign a team member, and move it into progress.
3. Add a public reply and an internal note. The customer sees the public conversation; staff see both.
4. Resolve the assigned ticket. The requester can close it or reopen it if the issue remains.
5. Inspect the activity log and dashboard. Open the same ticket in two tabs to observe stale edit protection.

Customers can access their own tickets. Agents and administrators can access the support queue, assign work, change category and priority, and review AI recommendations. A customer can edit or archive their own open ticket; an administrator can archive any ticket. Archived conversations and audit records remain in the database. Closed tickets must be reopened before adding replies.

## Project structure

```text
backend/
  src/modules/
    auth/       # Login, sessions, and access guards
    users/      # User persistence and assignable team members
    tickets/    # Ticket workflow, conversations, and audit history
    ai/         # Local classifier, training data, and evaluation
  prisma/       # Prisma schema and explicit SQL migrations
  prisma.config.ts
  scripts/      # Existing-schema validation and migration deployment
  src/database/ # Shared Prisma client module and opt-in demo seed
  test/         # HTTP integration tests against a separate database
frontend/
  src/app/      # Login, dashboard, ticket list, creation, and detail routes
  src/components/
  src/lib/      # Typed API client, formatting, and request state
docs/
```

Each backend business module separates `presentation`, `application`, `domain`, and `infrastructure`. Domain types and workflow rules are independent of Prisma. Repository ports are wired to Prisma PostgreSQL adapters through Nest providers. The generated Prisma client stays in infrastructure; the API controls authorization and validation, and the frontend uses a same-origin proxy and an HTTP-only session cookie.

See [architecture and database relationships](docs/architecture.md), [AI implementation and evaluation](docs/ai-evaluation.md), and [testing instructions](docs/testing.md).

## Useful commands

```bash
npm run build
npm --prefix backend run typecheck
npm --prefix frontend run typecheck
npm --prefix backend test
npm --prefix backend run ai:evaluate
```

## Optional Docker setup

Docker Compose creates its own PostgreSQL database named `support_desk`, published on host port **5433**. It does not use the existing host database on port 5432. API and web ports default to 4000 and 3000, so stop other processes on those ports first.

With the root `.env` configured and a valid `JWT_SECRET`:

```bash
docker compose up --build -d
docker compose run --rm api node dist/database/seed.js
```

Compose waits for PostgreSQL, runs the same Prisma migration wrapper as local setup, then starts the API and frontend. The image includes the generated client, Prisma CLI, schema, and SQL migrations. The seed uses the same explicit `SEED_DEMO` and `DEMO_PASSWORD` values as local setup. Container demo mode intentionally uses the development API environment for HTTP cookies; the frontend runs its production build. Images exclude environment files and run application processes as a non-root user.

```bash
docker compose logs -f api web
docker compose down
```

## AI behavior and limits

Category inference uses multinomial naive Bayes fitted from 96 curated English examples. Priority uses explicit rules; the summary extracts text, and suggested replies are templates. The model runs locally and does not send ticket content to an external provider. Its relative category score is uncalibrated and should not be interpreted as a probability of correctness.

The separate 32-example curated evaluation is a development benchmark, with its results and limitations documented in [AI evaluation](docs/ai-evaluation.md).

Other current limits: no email notifications, file attachments, password reset, organization tenancy, or real-time updates; JWT logout clears the cookie without individual token revocation. These are suitable next changes after the core workflow is understood and verified.

API throttling currently uses the connection IP. Browser requests forwarded by Next.js share the proxy's IP and therefore the same rate-limit bucket. Production needs trusted client-IP forwarding and a shared throttle store across API instances.
