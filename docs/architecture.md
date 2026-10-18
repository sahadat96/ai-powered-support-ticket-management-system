# Architecture

The API is a NestJS modular monolith backed by PostgreSQL. Its independent
`backend/` project exposes REST endpoints under `/api/v1` and interactive OpenAPI
documentation at `/docs`. The frontend boundary is a separate Next.js App Router
project, with browser requests passing through a server proxy that forwards the
HTTP-only session cookie. The API remains the authority for validation, access
control, ticket state, and persistence.

## Module boundaries

Each business module owns its HTTP adapter, use cases, domain contracts, and
persistence adapters. Nest modules compose concrete dependencies through providers.

| Layer | Responsibilities | Examples |
| --- | --- | --- |
| Presentation | REST controllers, request validation, OpenAPI metadata, authentication and role guards | `auth/presentation`, `tickets/presentation`, `users/presentation` |
| Application | Coordinate use cases, enforce user access, call domain rules and repository ports | `AuthService`, `TicketsService`, `UsersService`, `TriageService` |
| Domain | Framework-independent types, workflow rules, repository and password hashing contracts, local classification | `TicketRepository`, `UserRepository`, `PasswordHasher`, `workflow.ts`, `TicketTriageModel` |
| Infrastructure | Implement PostgreSQL repositories with TypeORM, bcrypt hashing, curated model training data | `TypeOrmTicketRepository`, `TypeOrmUserRepository`, `BcryptPasswordHasher` |

Application input interfaces are independent of controller DTOs. Controllers
validate HTTP input and pass structurally compatible values to the application
services. Domain repository ports are abstract classes, allowing Nest dependency
injection without coupling use cases to TypeORM entities. Infrastructure maps
entities to explicit public domain records rather than returning database rows.
Application services use Nest exceptions for HTTP-oriented use case failures;
domain workflow and classification code remain usable without Nest.

```mermaid
flowchart LR
  Browser[Next.js browser UI] --> Proxy[Next.js server proxy]
  Proxy --> Guards[JWT and role guards]
  Guards --> HTTP[Controllers and DTO validation]
  HTTP --> App[Application services]
  App --> Rules[Domain types and workflow rules]
  App --> Ports[Repository ports]
  Ports --> ORM[TypeORM repository adapters]
  ORM --> DB[(PostgreSQL support schema)]
  App --> AI[TriageService]
  AI --> Model[Local naive Bayes model]
```

## Data ownership and existing database preservation

The application uses the existing database selected by `DATABASE_URL`. Its
business tables live in the dedicated `support` schema:

- `users`: normalized unique email, display name, bcrypt hash, role, timestamps.
- `tickets`: generated display number, requester, optional assignee, status,
  category, priority, version, triage JSON, timestamps, and soft deletion marker.
- `comments`: public replies and staff-only internal notes.
- `ticket_events`: actor, action, description, and timestamp for audit history.

The migration bookkeeping table is `support_migrations`. Explicit migrations
create the application's schema and tables. TypeORM has `synchronize: false` and
`installExtensions: false`; starting the API does not synchronize or drop tables,
or install PostgreSQL extensions. Existing application tables in `public` remain
outside this project's schema. The migration relies on PostgreSQL's available
`gen_random_uuid()` function. Reverting the initial migration explicitly removes
the `support` schema, so rollback is a deliberate destructive operation.

Database constraints enforce valid roles, statuses, categories, priorities,
positive versions, nonempty data, foreign keys, and an assignee for active or
resolved work. Indexes cover recent tickets, requester and assignee queues, status,
and per-ticket conversations. Parameterized query builders handle search and
filters, and search escapes SQL wildcard characters.

## Authentication and role visibility

Registration always creates a `CUSTOMER`; a client cannot request staff
privileges. Passwords use bcrypt with cost 12. Input limits account for bcrypt's
72 UTF-8 byte limit. Login verifies a valid dummy hash for unknown emails to avoid
skipping the password verification work. Duplicate registrations are also caught
by the database's unique constraint if two requests race.

Successful registration and login set `support_session`, a two-hour JWT session
cookie. It is HTTP-only, uses `SameSite=Lax`, and is secure in production. The API
also accepts a Bearer token for API clients. JWT verification pins HS256, checks
expiry and the subject format, and reloads the current user from the database;
roles are not trusted from an old token payload. Responses map to public user
fields and never include a password hash. Logout clears the browser cookie;
tokens are stateless and are not individually revoked before expiry.

Unsafe browser requests with an `Origin` header must match the configured
`FRONTEND_URL` or `API_ORIGIN`; the API origin supports Swagger's own requests.
Credentialed CORS permits the configured frontend origin. HTTPS origins and secure
cookies are required in production. Helmet, strict DTO validation, global rate
limits, tighter authentication limits, and sanitized server error responses are
configured centrally.

| Action | Customer | Agent | Administrator |
| --- | --- | --- | --- |
| List, search, dashboard counts | Own tickets | All tickets | All tickets |
| Read a ticket and public replies | Own tickets | All tickets | All tickets |
| Read or write internal notes | No | Yes | Yes |
| Create tickets and public replies | Yes | Yes | Yes |
| Edit title and description | Own open tickets | Any visible ticket | Any visible ticket |
| Assign, reprioritize, recategorize, rerun triage | No | Yes | Yes |
| Delete a ticket | Own open tickets | No | Any ticket |

Tickets belonging to another customer return 404, limiting information about
their existence. Customer list filters and aggregate queries receive a
server-assigned requester scope. Internal comments are excluded at query time;
their corresponding audit events are excluded from customer detail responses.
Assignees must be agents or administrators.

## Workflow

```mermaid
stateDiagram-v2
  [*] --> OPEN: Ticket created
  OPEN --> IN_PROGRESS: Staff; assignee required
  IN_PROGRESS --> RESOLVED: Staff; assignee required
  IN_PROGRESS --> OPEN: Staff reopens work
  OPEN --> CLOSED: Requester or staff
  IN_PROGRESS --> CLOSED: Requester or staff
  RESOLVED --> CLOSED: Requester or staff
  RESOLVED --> OPEN: Requester or staff reopens
  CLOSED --> OPEN: Requester or staff reopens
```

Unchanged states and skipped transitions are rejected. The detail response
includes role-appropriate possible next statuses; starting or resolving work also
requires an assignee. An active or resolved ticket cannot have its assignee
removed until it is reopened. Entering `RESOLVED` records `resolvedAt`; reopening
clears it. Closed tickets accept no new comments until reopened. Deletion is soft
archival, retaining the conversation and event history.

## Transactions and concurrency

Ticket edits, status changes, deletion, and staff triage requests carry the
current `version`. The service checks that version, and the repository makes an
atomic update using both ticket ID and expected version in the SQL predicate.
The same transaction increments the version and inserts its audit event. If
another request has already saved or archived the ticket, zero rows match and the
API returns 409. The client should fetch the current ticket, preserve its draft,
and let the user reapply the intended change. A pre-read version check alone is
not relied on for concurrency safety.

Ticket creation and its first event are transactional. Adding a comment locks
the ticket row, rechecks that it is open to replies and not archived, then writes
the comment, timestamp, and event in one transaction. This serializes against
concurrent status changes or deletion and prevents a late reply from being added
to a closed or removed ticket. Comments do not increment the ticket edit version.

## Verification boundaries

Domain and application tests exercise workflow, authentication, input validation,
access guards, and local triage. Database-backed HTTP tests should validate the
full authentication and ticket workflow, cross-customer isolation, internal note
visibility, stale version rejection, and closed-ticket comment behavior against
the migrated PostgreSQL schema. The API health endpoint executes `SELECT 1` so a
successful check includes database connectivity.

See [the AI evaluation notes](./ai-evaluation.md) for model behavior and limits.
