# Demonstration and review guide

## Walkthrough

1. Run `npm run dev`, open `http://localhost:3000`, and sign in as `admin@support.local` using `DEMO_PASSWORD`.
2. Show live dashboard counts, category distribution, and the urgent-ticket shortcut.
3. Search the queue for `invoice`, apply filters, then clear them.
4. Create a ticket describing a production API outage affecting all users. Preview AI triage before submitting.
5. Run **Analyze ticket**. Explain category prediction, rule-based priority, extractive summary, and template reply.
6. **Apply suggestions**, use a reply draft, edit it, and send it. Show the activity history.
7. Assign an agent and move from open to in progress to resolved.
8. Sign in as a customer to demonstrate ownership and limited controls; customers may close/reopen their resolved tickets.
9. Open Swagger at `http://localhost:4000/docs`. Call login and paste its access token into **Authorize** for protected requests.
10. Run unit/integration tests and `npm run ai:evaluate`; explain the difference between synthetic evaluation and real-world accuracy.

## Decisions to explain

- A modular monolith gives clear feature boundaries without distributed-system complexity.
- Domain ports keep persistence, password hashing, and classification replaceable.
- PostgreSQL enforces identity, enums, foreign keys, and transactional writes.
- Version checks protect collaborators from lost updates.
- Local inference makes the AI feature repeatable without paid credentials.
- Human review prevents unverified suggestions silently driving operational decisions.

## Limits

This is a single-workspace tool without tenancy, email ingestion/notifications, attachments, private notes, password recovery, verification emails, refresh tokens, or staff account administration UI. Staff provisioning is explicit in the seed. Logout clears cookies but copied tokens remain valid until expiry. Rate limits are in-memory and proxy traffic shares an IP budget.

The AI corpus is small and English-only. Ambiguity, mixed topics, spelling errors, and negation can be misunderstood. Scores are uncalibrated, summaries are extracts, and reply drafts are templates. Evaluate representative labeled customer data before operational reliance.

Admin deletion permanently removes related history. Production needs HTTPS, secret management, durable rate-limit state, monitoring, backups, recovery, appropriate account provisioning, and any required retention policies. No public deployment has been created.

## Authorship

AI coding assistance was used. The supplied assessment prohibits AI-generated project submissions. This reference implementation cannot truthfully be represented as independently authored assessment work.
