# Verification

| Check                       | Command                | Purpose                                       |
| --------------------------- | ---------------------- | --------------------------------------------- |
| Types                       | `npm run typecheck`    | API/frontend type safety                      |
| Format                      | `npm run format:check` | Source consistency                            |
| Unit                        | `npm test`             | Auth, policy, workflow, conflicts, classifier |
| PostgreSQL HTTP integration | `npm run test:e2e`     | Guards, DTOs, transactions, real persistence  |
| Classifier evaluation       | `npm run ai:evaluate`  | Held-out category predictions                 |
| Production build            | `npm run build`        | Nest and Next compilation                     |
| Browser                     | `npm run test:ui`      | Desktop/mobile Chromium user flows            |

The backend has 21 unit tests and 11 database integration tests. Six browser scenarios cover a complete staff lifecycle, customer isolation, hidden staff controls, login errors, and narrow-screen overflow on desktop and mobile. Command output is authoritative for current counts.

Integration tests load `.env`, replace the URL's schema parameter with `test_<pid>_<timestamp>`, deploy migrations there, and create test-only accounts. Cleanup drops only that generated schema. Public tables and demo users are preserved. Schema creation permission is required; an abruptly killed run can leave an isolated test schema for manual inspection.

Critical cases include ownership isolation across detail/list/stats, role escalation rejection, null-field/input validation, cross-origin cookie write rejection, invalid transitions, closed-comment rejection, one winner from simultaneous versioned updates, AI advice not silently changing priority, and admin-only cascading deletion.

Browser tests need migrated/seeded demo data and `DEMO_PASSWORD`. They start dev servers unless existing servers use the expected ports. Install Chromium with `npx playwright install chromium`. Minimal Linux hosts may require `--with-deps` and sudo. Tests remove only tickets they create. Reports and traces are ignored; review them for session data before sharing.

GitHub Actions provisions PostgreSQL, runs the checks, builds both apps, seeds disposable accounts, and runs browser tests. CI credentials are demonstration values, not production secrets.

Root overrides pin patched `deepmerge-ts` and `js-yaml`. Prisma migration/generation, Swagger JSON, tests, and builds check compatibility. Re-run `npm audit` when updating dependencies; an audit is a point-in-time dependency check, not a security certification.
