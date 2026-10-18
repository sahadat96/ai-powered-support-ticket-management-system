# Testing

Prisma verification on 18 October 2026 passed 47 Jest unit/model tests, 19 PostgreSQL integration tests, and 10 Chromium browser tests. Prisma schema validation, backend type checking/build, formatting, and whitespace checks passed. Fresh-database migration and repeatable seeding passed. All 10 original application/public tables matched their row fingerprints after baseline adoption and seeding. The browser suite includes a 390px mobile layout, private-note visibility, ticket workflow, request-body limits, and proxy origin handling. Container images and remote GitHub Actions were not executed.

Install dependencies using the README setup steps. Run unit tests and static checks without a running browser:

```bash
npm --prefix backend test
npm --prefix backend run typecheck
npm run build
npm --prefix frontend run typecheck
npm --prefix backend run ai:evaluate
```

The backend unit suite covers authentication behavior, DTO validation, role and JWT guards, ticket state transitions, and local model behavior. The AI evaluation uses a separate small curated dataset and reports accuracy, per-class metrics, and a confusion matrix; it does not establish production accuracy.

Build before running the frontend type check on a fresh checkout so Next.js can generate its environment and route declarations. Local browser requests share the Next.js proxy's API rate-limit bucket; a burst of sign-ins across multiple test sessions can exhaust that shared limit. Production requires trusted client-IP forwarding and a shared throttle store.

## PostgreSQL HTTP integration

Use a dedicated database. The suite refuses a database whose actual name does not end in `-test` or `_test`.

```bash
createdb -h localhost -U sahadat 'ai-powered-ticket-management-test'
export TEST_DATABASE_URL='postgresql://sahadat:your-password@localhost:5432/ai-powered-ticket-management-test'
DATABASE_URL="$TEST_DATABASE_URL" npm run db:migrate
npm --prefix backend run test:e2e
```

The shell override selects the test database for migrations; it does not change the normal database URL in `.env`. Both the migration CLI and runtime Prisma client use its `support` schema. The suite starts Nest in-process against `TEST_DATABASE_URL`, registers uniquely named accounts, and removes records belonging to that run after testing. It does not truncate the schema or remove unrelated fixtures. No seed is needed in the test database.

Coverage includes protected routes, cookie authentication, denied privilege escalation, input validation, cross-customer isolation, scoped lists and dashboard counts, internal notes, assignment, legal and illegal transitions, optimistic concurrency, closed-ticket replies, and archival.

## Prisma migration verification

Dependency installation generates the Prisma client; the backend build regenerates it when the schema changes. Validate the schema from the backend directory:

```bash
cd backend
npx prisma validate
```

Verify migration deployment against a dedicated test database first. An empty database must receive the support tables and `support._prisma_migrations`. Running `db:migrate` again should leave existing records unchanged. To check adoption, use a disposable copy of the earlier TypeORM database and confirm that accounts, passwords, ticket numbers, comments, events, database constraints, and indexes remain intact. Public tables, their `_prisma_migrations`, and the legacy `support_migrations` must remain unchanged.

Schema changes are developed with `prisma migrate dev` against a separate disposable development database. Review the generated SQL, including existing CHECK constraints and partial indexes, before deployment. Integration tests use `db:migrate` and never require a database reset.

## Browser workflow

Build both projects and seed the normal development database with the three demo accounts first. Browser tests operate on those demo accounts and create their own tickets. Do not point them at a production deployment.

```bash
npm run build
cd frontend
npx playwright install chromium
E2E_DEMO_PASSWORD='your-local-demo-password' npm test
```

The Playwright configuration starts the built API and frontend when no suitable local services are running. `E2E_DEMO_PASSWORD` must match the password used when the demo accounts were first created. For interactive investigation:

```bash
cd frontend
E2E_DEMO_PASSWORD='your-local-demo-password' npm run test:ui
```

Use `E2E_BASE_URL` and `E2E_API_URL` to select existing local servers. `PLAYWRIGHT_CHROMIUM_EXECUTABLE` can select an already installed compatible Chromium browser. Tests run sequentially with no retries. Failed runs retain traces and screenshots under `/tmp/relay-playwright-results` and an HTML report under `/tmp/relay-playwright-report` by default; `PLAYWRIGHT_OUTPUT_DIR` and `PLAYWRIGHT_REPORT_DIR` override these locations. CI collects reports from ignored directories under `frontend/`.

## Manual review

| Scenario                          | Expected result                                                 |
| --------------------------------- | --------------------------------------------------------------- |
| Submit an incomplete ticket       | Inline validation; no ticket created                            |
| Create a duplicate-charge request | Saved ticket with explainable local classification and priority |
| Search, filter, and change pages  | Results and counts match the URL and database                   |
| Sign in as another customer       | Other customers' tickets cannot be read or changed              |
| Add an internal staff note        | Visible to staff; absent from customer responses                |
| Start unassigned work             | Rejected until an agent or administrator is assigned            |
| Save stale data from a second tab | Conflict shown; newer database changes retained                 |
| Reply to a closed ticket          | Rejected until it is reopened                                   |
| Interrupt the API connection      | Understandable error and retry path                             |
| Use a narrow viewport or keyboard | Navigation, forms, focus, and content remain usable             |

## Continuous integration

The GitHub Actions workflow installs locked dependencies and generates the Prisma client, validates the Prisma schema, provisions PostgreSQL, migrates independent application and test databases, seeds the application demo, runs backend unit and HTTP tests, evaluates the model, builds both projects, and runs Playwright in Chromium. Environment values in CI are disposable test credentials, not deployment secrets. Dockerfiles and Compose are optional local tooling; container execution is not part of the automated test claim.
