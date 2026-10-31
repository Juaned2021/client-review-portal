# Design decisions

Short records of the choices behind this codebase: what was decided, why, and what it costs.

---

## 1. Server Components by default, Client Components only for interactivity

**Decision.** Every page and layout is a Server Component that loads its own data, already scoped by tenant. `"use client"` is used only where the browser is required, and each such file starts with a comment explaining why:

| Client Component | Why it must run in the browser |
|---|---|
| `login-form`, `project-form`, `deliverable-form`, `review-form`, `new-version-form` | `useActionState` for pending state and inline validation errors |
| `comment-thread` | optimistic updates through the React Query cache |
| `local-time` | only the browser knows the viewer's time zone |
| `lib/trpc/client` | React Query keeps its cache in browser memory |
| `error.tsx` | error boundaries must be Client Components |

The project filters use a plain `<form method="get">`, so they need no client JS: the URL changes and the server re-renders. Logout is a `<form>` bound to a Server Action.

**Trade-off.** More server round trips than a SPA, in exchange for less JavaScript shipped, no client-side data fetching on first paint, and secrets/DB access that never leave the server.

## 2. tRPC for comments, Server Actions for forms

**Decision.**
- **Server Actions** handle form-shaped mutations: login, create project, create deliverable, approve / request changes, submit a new version. They work without client JS (progressive enhancement), and `revalidatePath` refreshes every server-rendered view that shows the changed status.
- **tRPC + TanStack Query** handles the comment thread: a chatty, interactive feature that benefits from a client cache, optimistic updates with rollback, end-to-end types (`AppRouter` is a type-only import on the client), and structured errors (`NOT_FOUND`, `BAD_REQUEST` with Zod field errors).

The review form invalidates the tRPC comment cache after a change request, because that action also posts a comment.

The tRPC context (which reads the session cookie) lives in `trpc/context.ts`, separate from `trpc/init.ts`. Routers therefore don't depend on the Next.js runtime, and integration tests call them directly with `appRouter.createCaller({ user })` as different tenants.

**Trade-off.** Two mutation styles to learn. The split follows one rule: forms that change server-rendered state use Server Actions, live client-side UI uses tRPC.

## 3. Authorization: one module, scoped queries, 404 for other tenants

**Decision.** `src/server/authz.ts` is the only place that encodes "who can see or do what":

- **Scope builders** (`projectScope`, `deliverableScope`, `commentScope`) return Prisma `where` fragments. Every read composes one: `findFirst({ where: { id, ...projectScope(user) } })`. A client who guesses another company's ID gets `null` and the page answers **404**, never 403, so the record's existence is never confirmed.
- **Predicates** (`canReviewDeliverable`, `canComment`, `canManageProjects`) guard mutations on an already-loaded row.
- **Fail closed:** a `CLIENT` with no company throws instead of producing an empty (match-everything) filter. The database also forbids that state with a `CHECK` constraint.

Defense in layers:
1. `proxy.ts` (Next 16's replacement for `middleware.ts`) only redirects anonymous users. It is **not** the security boundary.
2. Every page, Server Action and tRPC procedure re-checks on the server. Server Actions are public POST endpoints, so they never trust the page that rendered them. This was verified by replaying an admin action with a client's session.
3. The JWT stores only the user id. Role and company are reloaded from Postgres on every request (`getCurrentUser`, deduped with `React.cache`), so permission changes apply immediately.

**Tested** with pure unit tests (admin vs. client vs. other company) and an integration suite against real Postgres that calls the actual queries with real IDs from another tenant.

## 4. Time: `timestamptz` for instants, `date` for calendar days

**Decision.**
- Instants (`createdAt`, `updatedAt`) are `timestamptz(6)`. They cross the wire as ISO-8601 UTC strings and are formatted in the viewer's zone by `<LocalTime>`. The server renders a UTC fallback; `useSyncExternalStore` switches to local time after hydration without a hydration mismatch.
- Due dates are `date`. In application code they stay `"YYYY-MM-DD"` strings and are formatted with `timeZone: "UTC"`.

**Why.** `new Date("2026-12-15")` is UTC midnight, which is **Dec 14, 19:00 in Bogotá (UTC-5)**: formatting it in local time silently moves the deadline one day earlier. `tests/unit/dates.test.ts` runs with `TZ=America/Bogota`, reproduces the naive bug, and proves the form → DB → UI path keeps Dec 15.

## 5. Indexes and one `EXPLAIN ANALYZE`

Every foreign key has an index. Composite indexes match the queries that actually run:

| Index | Serves |
|---|---|
| `Project(clientId, status)` | tenant project list filtered by status (also covers the `clientId` FK) |
| `Deliverable(projectId, createdAt)` | deliverables of a project, newest first |
| `Comment(deliverableId, createdAt)` | the comment thread, oldest first |
| `ActivityLog(deliverableId, createdAt)` | a deliverable's status history |
| `ActivityLog(clientId, createdAt)` | tenant activity feed |

**Measured** on 100,000 synthetic comments, inside a transaction that was rolled back:

```sql
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF)
SELECT id, body, "createdAt", "authorId" FROM "Comment"
WHERE "deliverableId" = 'bench-d-1234'
ORDER BY "createdAt" ASC;
```

With `Comment_deliverableId_createdAt_idx`:
```
Sort (actual time=0.288..0.291 rows=50 loops=1)
  Sort Key: "createdAt"
  ->  Bitmap Heap Scan on "Comment" (actual time=0.033..0.098 rows=50 loops=1)
        Recheck Cond: ("deliverableId" = 'bench-d-1234'::text)
        Buffers: shared hit=53
        ->  Bitmap Index Scan on "Comment_deliverableId_createdAt_idx" (actual time=0.020..0.021 rows=50 loops=1)
              Index Cond: ("deliverableId" = 'bench-d-1234'::text)
Execution Time: 0.344 ms
```

Without it (`DROP INDEX` inside the same transaction):
```
Sort (actual time=5.128..5.131 rows=50 loops=1)
  ->  Seq Scan on "Comment" (actual time=0.094..5.107 rows=50 loops=1)
        Filter: ("deliverableId" = 'bench-d-1234'::text)
        Rows Removed by Filter: 99956
        Buffers: shared hit=1275
Execution Time: 5.177 ms
```

The index reads **53 buffers instead of 1,275** (≈15× faster here). The sequential scan's cost grows with the whole table, while the indexed lookup only touches the rows of one deliverable.

**Avoiding N+1.** Pages load everything in one Prisma call with nested `select` and `_count`. The dashboard uses a single SQL statement (`JOIN` + `COUNT(*) FILTER (WHERE status = …)`) via `$queryRaw` tagged templates, which bind values as parameters (no SQL injection). Search escapes `%` and `_`.

## 6. Migrations: additive, reviewed, verified in CI

**Decision.**
- Generate with `prisma migrate dev --create-only`, **read the SQL**, and hand-edit only what Prisma cannot express (`CHECK` constraints), then apply.
- Follow-ups are **additive** (expand → migrate → contract). Migration #2 adds an enum, a table, and `Deliverable.version INTEGER NOT NULL DEFAULT 1`, which on Postgres 11+ is metadata-only (no table rewrite). Its `CHECK (version >= 1)` is added `NOT VALID` and then `VALIDATE`d, to avoid a long exclusive lock. It was applied on top of existing seed data: all rows read `version = 1`.
- Applied migrations are **never edited**: Prisma checksums them. `.gitattributes` forces LF so Windows line endings cannot change a checksum.
- Production uses `prisma migrate deploy` only (no `dev`, no `reset`).
- CI applies every migration from scratch on a throwaway Postgres, fails on schema drift (`prisma migrate diff --exit-code`), seeds, and runs the integration tests.

## 7. Concurrency and integrity of reviews

**Decision.** The review is a small state machine (`server/review.ts`, pure and unit-tested). The status write is `updateMany({ where: { id, status, version } })`: if anyone changed the deliverable since it was read, zero rows match and the user sees a conflict instead of a silent overwrite (optimistic concurrency, no locks). The status change, the review comment and the `ActivityLog` row commit in one `$transaction`.

Only the project's **client** can approve: the agency cannot approve its own work. Requesting changes requires a meaningful comment.

## 8. Secrets and sensitive data

- `.env` is git-ignored; `.env.example` documents every variable. CI uses obviously fake values.
- Nothing logs passwords, hashes, tokens or user objects. The seed prints counts only; tRPC logs only unexpected errors, without input.
- `ActivityLog` has **no free-text column**: ids, statuses and version numbers only.
- Login: bcrypt (cost 12), a dummy hash comparison for unknown emails (constant time), one generic error message, Zod-validated input, a same-origin-only `callbackUrl` (no open redirects).
- Links are restricted to `http(s)` (no `javascript:`/`data:` XSS) and open with `rel="noopener noreferrer"`.
- tRPC accepts only JSON bodies (a cross-site `text/plain` form post gets 415), and Auth.js cookies are `SameSite=Lax`.
- npm 11.19 blocks dependency install scripts by default; only four known packages are allow-listed in `package.json`.

## 9. Rendering and HTTP status codes

`loading.tsx` streams a skeleton, but once streaming starts the status code is fixed at 200, so a later `notFound()` would become a "soft 404". Loading UI therefore lives only on list pages (`dashboard/`, and `projects/(list)/` via a route group). Detail pages don't stream and return a **real 404** for other tenants' IDs.

Cache Components (`cacheComponents`) is disabled on purpose: every page is per-user and tenant-scoped, so pages render dynamically and re-authorize on each request.

## 10. What I'd do next

- **Rate limiting** on login and comment creation (for example Upstash Redis), plus account lockout.
- **Postgres Row-Level Security** as a second tenant wall below the application (`SET app.client_id` per transaction).
- **File uploads** to S3-compatible storage (Cloudflare R2) with presigned PUT URLs, size/type validation and per-tenant object keys, behind an env flag.
- **Trigram index** (`pg_trgm`) so `ILIKE '%term%'` search stays fast on large tables.
- **E2E tests** with Playwright for the optimistic comment flow and the review happy path.
- **Cache Components** for the few truly shared, non-tenant fragments (marketing pages), keeping tenant data dynamic.
- Real-time comment updates (server-sent events or Supabase Realtime) instead of refetch-on-focus.
