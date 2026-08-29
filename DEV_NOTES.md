# DEV_NOTES.md

Engineering log for the Customer Data Platform. Each entry records a decision, the
alternatives considered, and why the chosen option won — written at the time the
decision was made, not reconstructed afterwards.

---

## Project Context

A multi-tenant customer data platform for industrial parts distributors, replacing a
manual spreadsheet-based process for looking up and maintaining customer records.

**Stack:** FastAPI + SQLAlchemy (backend), React + Vite (frontend), SQLite (dev).

**Current state:** `GET /customers` and `POST /customers` both complete, backend and
frontend — search/pagination table, plus an "Add Customer" modal form with client-side
`required` validation, null-coalescing on optional fields, and a refetch-on-success flow.

**Planned sequence (locked, in order):**

1. Complete CRUD (`POST`, `PUT`, `DELETE`)
2. Authentication + multi-tenancy
3. Asynchronous CSV import (migrate to Postgres here)
4. Tests, CI, load-testing analysis

Anything outside this list is out of scope until step 4 is complete.

### Future Vision (post-locked-sequence, not yet scoped)

Recorded 2026-08-29 for continuity — not a commitment to build, and not reordering the
locked sequence above. The project's shape has clarified beyond "a table with search":

- Each tenant (a business using the platform) manages its own set of client records —
  this is the concrete use case Entry 001's `account_id` tenant-isolation model was
  chosen for. Step 2 (Auth + multi-tenancy) is where this actually gets built.
- An admin role that can view across all of a tenant's clients and build a dashboard
  scoped to them.
- Per-tenant dashboards: search/filter by region, map-based visualization of client
  locations.

**Terminology flag, to resolve at step 2, not now:** the current `Customer` model is what
this vision calls a "client" (a tenant's managed record) — "customer" in the new framing
means the paying tenant itself. Renaming `Customer` → `Client` (or naming the new tenant
table something other than "Customer") is a live decision once the tenant/`Account` table
is actually built — flagged now so it's deliberate rather than stumbled into.

### Deferred: Inline Per-Field Validation Errors

Currently, a failed `POST` shows one `alert()` with all validation messages joined
together, rather than highlighting the specific invalid input. Deliberately deferred:
the backend already rejects invalid data (the actual correctness boundary), the modal
already stays open with entered data intact on failure, and building per-field error
mapping (matching FastAPI's `detail[].loc` to the right input, plus per-field error
state and styling) is real UI work with no correctness payoff — pure polish. Revisit
after `PUT`'s edit form exists, since the two forms will share enough shape to see the
right abstraction rather than guessing at it now.

---

## Entry 001 — Tenant Isolation Model

**Date:** 2026-08-27

### Feature / Milestone

Chose the isolation strategy for separating one tenant's customer data from another's.
Decision: **shared tables with an `account_id` foreign key on every tenant-owned row**,
with scoping enforced at the query layer.

### Architectural Trade-offs

Three models were considered.

**Schema-per-tenant** (each tenant gets its own Postgres schema) gives stronger isolation
because a missing filter clause cannot leak across tenants — the wrong data is not
reachable from the connection at all. It was rejected on two grounds. First, migrations
become an N-times operation: a single `ALTER TABLE` turns into a loop over every tenant
schema, and a failure partway through leaves the estate in a split state (some tenants
migrated, some not) against application code that assumes one shape. That requires
migration tooling that tracks per-tenant state and can resume. Second, any cross-tenant
query — usage reporting, internal analytics — becomes a `UNION` across every schema.

**Database-per-tenant** offers the strongest isolation and was rejected immediately as
operationally disproportionate at this scale.

**Shared tables** was chosen because the costs it carries are ones this project can
actually pay: isolation depends on application correctness, which is a testable property.
The mitigation is described in Entry 002.

The deciding argument was that isolation strength was not the binding constraint here —
operational cost was. Schema-per-tenant buys protection against a bug class that
integration tests can catch directly, at the price of permanent migration complexity.
That trade only pays off under a compliance requirement for physical separation, which
this project does not have.

### Engineering Challenges

The main risk with shared tables is a single forgotten `WHERE account_id = ?`, which
silently exposes one tenant's records to another. Unlike most bugs, this one produces no
error and no crash — it returns a valid-looking response containing the wrong data. It is
therefore invisible to manual testing unless you are specifically looking for it.

A second, subtler issue: `account_id` must never be accepted from the request body. If a
client can supply it, the isolation boundary is decorative. It is read from the verified
JWT claims on every request.

### Interview Talking Points

- **Situation/Task:** Needed tenant isolation for a customer data platform where a leak
  between tenants would be a serious data-exposure incident.
- **Action:** Evaluated schema-per-tenant against shared tables with row-level scoping.
  Chose shared tables after determining that schema-per-tenant's isolation advantage was
  reachable through integration tests, while its migration cost (N-times DDL with
  partial-failure states) was permanent and unavoidable.
- **Result:** A model whose failure mode is a testable application bug rather than an
  operational burden — and a documented trigger for revisiting it, namely a tenant with a
  contractual requirement for physical data separation.

---

## Entry 002 — Enforcing Tenant Scoping

**Date:** 2026-08-27

### Feature / Milestone

Chose the safety mechanism that prevents tenant-scoping filters from being omitted:
**integration tests per endpoint first, extract a shared query helper once the repetition
is demonstrated.**

### Architectural Trade-offs

Three options were weighed: rely on code review; write cross-tenant tests per endpoint; or
build a helper that applies the filter automatically so endpoints cannot query unscoped.

Code review was rejected as a control — it depends on attention, and the bug is invisible
in a diff that otherwise looks correct.

The helper was deliberately *deferred* rather than rejected. Building it upfront would be
abstracting before the duplication exists, and the shape of the right abstraction is not
yet known — it depends on how the query patterns actually vary across endpoints. The
refactor is mechanical once the filter has been written enough times to see the pattern.

Tests were chosen as the primary control because they catch the bug regardless of how the
code is structured, and they remain valid after the helper is introduced.

Postgres row-level security was noted as the strongest option — the database enforces
isolation regardless of what the application sends — but rejected as premature while the
project is still on SQLite, and recorded as the escalation path.

### Engineering Challenges

The test shape that matters: create two accounts, create a record under account A, then
assert that a request authenticated as account B receives `404` — specifically **not**
`403`. A `403` confirms the record exists, which is itself a small information leak. The
correct behaviour is for the resource to appear not to exist at all.

### Interview Talking Points

- **Situation/Task:** Shared-table multi-tenancy makes isolation dependent on every query
  carrying a scoping filter — one omission is a cross-tenant data leak.
- **Action:** Made the failure directly testable rather than relying on review discipline,
  writing per-endpoint tests that assert a foreign tenant gets `404` rather than `403`.
  Deferred the automatic-scoping helper until duplication justified the abstraction.
- **Result:** The highest-severity bug class in the design became one an automated test
  catches, with a documented escalation to database-level row security if isolation
  requirements harden.

---

## Entry 003 — Deferring the Postgres Migration

**Date:** 2026-08-27

### Feature / Milestone

Decided to **remain on SQLite** through CRUD and multi-tenancy, migrating to Postgres
immediately before building the asynchronous import worker.

### Architectural Trade-offs

The initial instinct was to migrate before adding tables, on the reasoning that schema work
would otherwise be done twice. That reasoning was examined and found to be weak: SQLAlchemy
abstracts the dialect, so the migration is largely a connection-string change and the
"twice" cost does not really exist.

The decision was reversed to defer. The concrete trigger for migrating is SQLite's
single-writer lock, which will produce `database is locked` errors once a background worker
writes concurrently with the API. That condition arrives in step 3 and not before, so the
migration is scheduled there rather than performed speculatively.

Two dialect differences were recorded so they do not surface as surprises later:

- Foreign keys are not enforced by default in SQLite (`PRAGMA foreign_keys=ON` is
  required), so a broken `account_id` reference can pass locally and fail in production.
- `LIKE` is case-insensitive in SQLite but case-sensitive in Postgres; the search feature
  will need `ILIKE` after the move.

### Engineering Challenges

The interesting part was recognising a weak justification and reversing it. "Production
uses Postgres" and "we might need it later" are not requirements. Identifying the specific
technical event that forces the change — concurrent writes from a second process — turned
an open-ended anxiety into a scheduled task.

### Interview Talking Points

- **Situation/Task:** Faced the common pull toward adopting production-grade infrastructure
  before any requirement demanded it.
- **Action:** Traced the migration to a specific forcing condition — SQLite's single-writer
  lock breaking under a concurrent background worker — and scheduled the move to that point
  rather than performing it speculatively. Documented the dialect differences in advance.
- **Result:** Development stayed on zero-setup tooling through two feature milestones, with
  a defined trigger rather than an open question. Demonstrates deferring decisions until
  the information needed to make them well actually exists.

---

## Entry 004 — Soft Delete with Time-Bounded Retention

**Date:** 2026-08-27

### Feature / Milestone

Chose **soft delete** via a `deleted_at` timestamp, with a purge of rows deleted more than
30 days ago, rather than immediate hard deletion or an archive table.

### Architectural Trade-offs

Hard delete was rejected because permanent removal of business records is usually the wrong
default in a customer data platform: accidental deletions need recovery, and other records
may reference the deleted customer.

An **archive table** (hard-delete the row, copy it to `customers_archive`, purge later) was
considered and rejected on schema-drift grounds. The archive must mirror the live table
forever; adding a column to `customers` and forgetting the archive means every subsequent
restore silently loses that field. It also breaks foreign keys pointing at the original row
and makes restoration an insert rather than a flag flip.

Soft delete costs one column, one filter clause, and one index. That was judged the better
trade.

The 30-day purge was added deliberately: pure soft delete retains data indefinitely, which
is both a storage cost and a poor answer to any right-to-erasure request. Time-bounding it
gives operational undo without permanent retention.

### Engineering Challenges

**Unique constraints break under soft delete.** With a unique index on `email`, a customer
who is soft-deleted and then re-entered with the same address triggers a constraint
violation — while the user is looking at a list where that customer visibly does not exist.
The error is correct and the experience is nonsense.

Resolved with a partial unique index, so uniqueness applies only among live rows:

```sql
CREATE UNIQUE INDEX uq_customer_email_active
ON customers (email) WHERE deleted_at IS NULL;
```

**Purge condition.** The purge triggers on `deleted_at`, not `updated_at`. An edit to an
already-deleted row should not extend its retention; those are two independent questions,
and conflating them would make retention unpredictable.

**Scope note:** the `deleted_at` column is added now. The purge job is *not* built now — it
is a scheduled background task and there is no worker process yet. It becomes the second
job for the worker introduced in step 3.

### Interview Talking Points

- **Situation/Task:** Deleting customer records needed to be recoverable without retaining
  personal data indefinitely.
- **Action:** Implemented soft delete with a 30-day retention window, rejecting an archive
  table because a mirrored schema drifts from the live one and silently corrupts restores.
  Resolved the resulting unique-constraint conflict with a partial index scoped to live rows.
- **Result:** Recoverable deletes with bounded retention. The unique-constraint interaction
  is a concrete example of a second-order effect that only surfaces when you reason past the
  happy path — soft delete looks like a one-column change until it meets a unique index.

---

## Entry 005 — Request/Response Schema Separation

**Date:** 2026-08-27

### Feature / Milestone

Adopted **three Pydantic schemas per resource** — `CustomerCreate`, `CustomerUpdate`,
`CustomerResponse` — over a single shared schema.

### Architectural Trade-offs

A single schema is simpler and is defensible for small internal tools. It was rejected
because it cannot express three genuinely different contracts:

**`CustomerCreate`** omits `id`, `created_at`, `deleted_at`, and critically `account_id`.
That last omission is the tenant boundary: if `account_id` were accepted from the request
body, a client could write records into another tenant's account. The server sets it from
the verified JWT. A single schema makes this constraint inexpressible.

**`CustomerUpdate`** marks every field optional, which is what makes partial updates
possible. Reusing the create schema would force a client changing one phone number to
resend the full object — omitting `name` would either fail validation or null the field.

**`CustomerResponse`** acts as an output allowlist. With `response_model=` set on the
route, FastAPI strips any field not declared, so a column added to the ORM model later
cannot leak through an existing endpoint by accident.

The line against overengineering: each schema encodes a distinct contract (what may be
sent, what may be changed, what is returned). A `CustomerDelete` schema would encode
nothing and was not created.

### Engineering Challenges

Shared fields live in a `CustomerBase` that the three inherit from — one of the few cases
where abstracting immediately is justified, because the overlap is genuine and stable
rather than speculative.

`CustomerResponse` requires `model_config = ConfigDict(from_attributes=True)` under
Pydantic v2 to populate from a SQLAlchemy ORM object rather than a dict.

### Interview Talking Points

- **Situation/Task:** Needed to prevent clients from setting server-owned fields —
  particularly `account_id`, which defines the tenant boundary.
- **Action:** Separated input and output schemas so that fields a client must not control
  are structurally absent from the request model, and applied `response_model` as an output
  allowlist against accidental field exposure.
- **Result:** Mass-assignment and field-leak vulnerabilities became structurally impossible
  rather than dependent on validation code. Illustrates the distinction between abstraction
  that encodes a real constraint and abstraction added for symmetry.

---

## Entry 006 — POST /customers: Backend Route and Modal Form

**Date:** 2026-08-29

### Feature / Milestone

Completed the create half of CRUD: `POST /customers` (FastAPI + `CustomerCreate`/`CustomerOut`
schemas, SQLAlchemy insert) and a matching frontend slice — a modal "Add Customer" form that
posts to it and refreshes the table on success.

### Architectural Trade-offs

**Modal vs. inline form.** Originally scoped as an inline section above the table, to avoid
the added complexity of an overlay (backdrop, click-outside-to-close, stacking) for a single
form with no other justification. Reversed mid-build for a concrete UX reason (visual
polish) rather than a functional one — worth recording as a deliberate reversal of an earlier
call, not scope drift.

**Refetch over local mutation.** On successful create, the frontend refetches `GET /customers`
rather than prepending the new row into local state — reuses the existing fetch path instead
of maintaining two ways to update the table, at the cost of one extra round trip.

### Engineering Challenges

**Debounce cleanup broke silently during a refactor.** Extracting the inline `useEffect` fetch
logic into a standalone `fetchCustomer()` function initially dropped the debounce's cleanup
function — `useEffect(() => { fetchCustomer() }, ...)` calls the function but discards its
return value, so React had no cleanup to run between renders. Old `setTimeout` timers were
never cancelled, meaning rapid search input could fire multiple overlapping fetches with no
guarantee of response order — a real race condition, not just wasted requests. Fixed by
returning the function's result: `return fetchCustomer()`.

**FastAPI's validation error shape doesn't include a `message` field.** A `422` response body
is `{"detail": [...]}` — a list of per-field error objects — not `{"message": ...}`. Code
written to `alert(data.message)` silently displayed `undefined` on every validation failure
until corrected to read `data.detail`.

**`onClick` vs `onSubmit` on the form.** Submit logic was initially wired to the Submit
button's `onClick`, which covers a mouse click but not pressing Enter inside an input — Enter
would trigger the browser's native form submission (full-page reload) instead, since the
`<form>` had no `onSubmit` handler to intercept it. Moved the handler to the `<form>`'s
`onSubmit` prop, which catches both paths.

**Modal nested inside `.app-header` in the DOM.** The modal backdrop was initially a JSX child
of the header section rather than a sibling. Harmless today since `position: fixed` ignores
DOM ancestry for positioning — but any ancestor later gaining a CSS `transform`, `filter`,
`perspective`, or `will-change` would silently re-anchor the "full-screen" overlay to that
ancestor's box instead of the viewport. Moved to be a sibling of `.app-header` to remove the
risk before it could surface as a confusing bug.

### Interview Talking Points

- **Situation/Task:** Needed to add customer-creation to both the API and the UI, keeping the
  existing debounced search/pagination behavior intact through a refactor.
- **Action:** Extracted the fetch logic into a reusable function to support both the
  debounced search effect and a post-create refresh — and in doing so, surfaced and fixed a
  real cleanup-function bug that would have broken debouncing silently. Also caught a
  validation-error-shape mismatch and an `onClick`/`onSubmit` gap before they shipped.
- **Result:** A complete create flow with the debounce behavior verified intact, form errors
  surfaced correctly instead of showing `undefined`, and a latent CSS positioning bug removed
  before it could bite later. Demonstrates that refactors carry real risk even when the
  end-to-end feature "looks like it worked" — the cleanup-function bug wouldn't have been
  caught by casual manual testing.

---
