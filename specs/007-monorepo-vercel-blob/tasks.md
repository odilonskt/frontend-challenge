---

description: "Task list for 007-monorepo-vercel-blob"
---

# Tasks: Monorepo na Vercel com Vercel Blob

**Input**: Design documents from `/specs/007-monorepo-vercel-blob/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api-routes.md, quickstart.md (all present)

**Tests**: Not requested as a separate TDD suite in the spec. Verification is a standalone smoke-test script (`apps/api/scripts/smoke-test.mjs`), built incrementally alongside the stories it verifies, per the project's existing convention for real (non-mocked) backends (`server/scripts/smoke-test.mjs` in `006-platform-coins`). `apps/web`'s existing Playwright suite is a regression gate, not new test authoring.

**Organization**: Tasks are grouped by user story (spec.md) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Maps the task to a user story (US1-US4) from spec.md
- Every task names exact file paths, taken from plan.md's Project Structure

## Path Conventions

Monorepo (per plan.md): `apps/web/` (existing frontend, relocated unchanged), `apps/api/` (new backend), root `pnpm-workspace.yaml` / `nx.json` / `package.json`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Turn the repository into a pnpm + Nx workspace with both apps scaffolded, without changing `apps/web`'s behavior and without touching `server/`.

- [X] T001 Create `pnpm-workspace.yaml` at the repo root declaring `apps/*` and `packages/*` (plan.md Project Structure)
- [X] T002 Relocate the existing frontend into `apps/web/` — `git mv` `src/`, `e2e/`, `public/`, `index.html`, `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `playwright.config.ts`, `components.json`, `.oxlintrc.json` into `apps/web/`, leaving `server/` and `specs/**` untouched at the repo root (FR-001, FR-002)
- [X] T003 [P] Create `apps/web/package.json` (renamed `"name": "web"`, same scripts/deps as the pre-move root `package.json`, MSW `workerDirectory` path updated to `apps/web/public`) and trim the now-relocated app-only scripts/deps from the root `package.json`
- [X] T004 [P] Create `apps/api/package.json` (`"name": "api"`; deps `express`, `cors`, `@vercel/blob`, `jsonwebtoken`, `zod`; devDeps `vercel`, `typescript`, `tsx`, `@types/express`, `@types/cors`, `@types/jsonwebtoken`, `@types/node`) and `apps/api/tsconfig.json` (strict mode, matching the project's "no `any`" rule)
- [X] T005 [P] Create `apps/api/.env.example` documenting `BLOB_READ_WRITE_TOKEN` and `AUTH_JWT_SECRET` (contracts/api-routes.md, data-model.md AuthToken)
- [X] T006 [P] Create `apps/web/vercel.json` (static/SPA build config) and `apps/api/vercel.json` (rewrite `/api/(.*)` → `/api/index`, Node.js runtime; research.md D7/D3)
- [X] T007 Create `nx.json` at the repo root plus `apps/web/project.json` and `apps/api/project.json`, each declaring `build`/`typecheck`/`lint`/`dev` targets (`apps/web/project.json` also declares `test:e2e`) — FR-004
- [X] T008 Update the root `package.json` scripts (`dev`, `dev:all`, `build`, `typecheck`, `lint`) to delegate to `nx run`/`nx run-many` scoped per project, replacing the direct `vite`/`concurrently` invocations that used to target the root app directly
- [X] T009 Run `pnpm install` from the repo root and fix any path breakage from the `apps/web` move (Vite root, `tsconfig` references, Playwright `testDir`/baseURL, MSW worker path) until `apps/web` builds and runs identically to before the move (FR-001, SC-004 regression gate) — verified via `nx show projects` (lists `web`+`api`) and `nx run web:typecheck` (passes clean)

**Checkpoint**: `pnpm install` works once from the root; `apps/web` is relocated and unbroken; `apps/api` exists as an installable package with no routes yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The minimum working Express app + Vercel entry point that every user story's routes mount into. No user story's routes can be built before this phase is done.

**⚠️ CRITICAL**: No Phase 3+ work can begin until this phase is complete.

- [X] T010 Create `apps/api/src/app.ts`: mounts `cors`, JSON body parsing, a router-mount point for future routers, a catch-all handler returning a consistent `404` for unknown `/api` paths (spec.md Edge Cases, US2 Acceptance Scenario 4), and a final Express error-handling middleware
- [X] T011 [P] Create `apps/api/src/lib/errors.ts`: the standardized error response shape `{ "error": { "code": "string", "message": "string" } }` and helper functions for `400`/`401`/`402`/`404`/`409`/`500` responses (contracts/api-routes.md)
- [X] T012 Create `apps/api/api/index.ts`: the single Vercel Function entry point — `import app from "../src/app"; export default app;` (research.md D3) — **corrected after /speckit-analyze (I1)**: the Vercel rewrite keeps the original `/api/...` path, so routers are now mounted under `/api` in `src/app.ts` (previously `/coins` etc., which would 404 on Vercel); contracts/api-routes.md updated
- [X] T013 Create `apps/api/src/routes/health.ts` implementing `GET /health` per contracts/api-routes.md (`200 { "status": "ok" }`; `500` with `code: "missing_blob_token"` when `BLOB_READ_WRITE_TOKEN` is unset) and mount it in `apps/api/src/app.ts`
- [X] T014 [P] Create `apps/api/src/server.ts`: an optional `app.listen(...)` bootstrap (port via env, default distinct from `server/`'s port) for local development outside `vercel dev` (research.md D8 — MUST NOT be used to validate SC-002) — **corrected after /speckit-analyze (I4)**: default was 4000 (= `server/`'s port); now 4001
- [X] T015 [P] Create `apps/api/README.md` documenting local setup, the two documented limitations (token issuance trusts the requested `ownerId` — spec.md Assumptions; Vercel Blob has no transactions — FR-009), and how to run `scripts/smoke-test.mjs`
- [X] T016 Add fail-fast startup checks in `apps/api/src/app.ts`/`apps/api/src/server.ts`: throw a clear, specific error (not a generic `500`) if `BLOB_READ_WRITE_TOKEN` or `AUTH_JWT_SECRET` is missing (FR-010, FR-016) — implemented as a startup check in `server.ts` (process exits with a clear message) and lazy per-request checks in `health.ts`/`lib/auth.ts` (structured `500` instead of crashing the Vercel function)
- [X] T017 Verify `apps/api` boots locally and `GET /health` responds `200 { "status": "ok" }` — **adapted**: verified via the plain `tsx src/server.ts` listener (T014), not `vercel dev`, because this sandbox has no authenticated Vercel CLI session; `vercel dev`-based parity (SC-002) still needs to be run by the user (see final report)

**Checkpoint**: Foundation ready — `apps/api` has a working, deployable Express app with one real route (`/health`). User story work can now begin.

---

## Phase 3: User Story 1 - Developer runs the whole project as one monorepo (Priority: P1) 🎯 MVP

**Goal**: From a clean clone, one root install and one (or two) root dev command(s) bring up both `apps/web` and `apps/api`, with Nx recognizing and scoping each independently.

**Independent Test**: From a clean clone, run the root install and dev commands; confirm both apps start, `nx show projects` lists `web` and `api`, scoped `typecheck`/`build` don't cross-trigger the other app, and `server/` is untouched.

### Implementation for User Story 1

- [X] T018 [US1] Add a root `dev:all` script to `package.json` that runs `apps/web`'s `vite` dev server and `apps/api`'s `vercel dev` concurrently (extends the project's existing `concurrently`-based `dev:all` pattern, mirroring how it already runs `server/`'s dev script alongside the frontend) — implemented as a 3-way `concurrently` (`web`, `api`, `coins`), preserving the pre-existing `server/` dev workflow instead of dropping it
- [X] T019 [P] [US1] Verify `nx show projects` lists exactly `web` and `api`, and that `nx run web:typecheck` / `nx run api:typecheck` each complete without triggering the other project's build (FR-004, SC-005) — record the verified commands in `apps/api/README.md` — verified: `nx show projects` → `api`, `web`; `nx run web:typecheck` and `nx run api:typecheck` both pass independently
- [X] T020 [P] [US1] Verify, from a clean `pnpm install` at the repo root, that both `apps/web` and `apps/api` resolve their dependencies without a separate per-app install step (FR-003, SC-001) — verified: one root `pnpm install` installed all 3 workspace projects (`web`, `api`, root)
- [X] T021 [US1] Diff-check that `server/` and `specs/006-platform-coins/**` are byte-for-byte unchanged by this feature (`git diff --stat` against the pre-restructure commit shows no entries under those paths) — FR-002 — verified: `git status --porcelain -- server specs/006-platform-coins` returns empty

**Checkpoint**: User Story 1 is fully functional and independently testable — the monorepo environment itself works, even with no backend routes beyond `/health` yet.

---

## Phase 4: User Story 2 - Backend exposes a documented, structured set of routes on Vercel (Priority: P2)

**Goal**: Prove the deployment + routing pattern (local `vercel dev` parity with a real Vercel deployment, consistent 404 handling) using the one route that already exists (`/health`), before any resource-specific route is added.

**Independent Test**: Call `GET /api/health` via local `vercel dev` and via a real Vercel deployment and confirm identical responses; call an unknown `/api/*` path in both environments and confirm a consistent `404`.

### Implementation for User Story 2

- [ ] T022 [US2] **BLOCKED (needs your Vercel account)** — Link `apps/api` to its own Vercel project (`vercel link`, run from `apps/api`) and deploy a preview (`vercel deploy`); record the exact steps in `apps/api/README.md`. Steps are documented in `apps/api/README.md`'s "Deploying" section; this agent has no Vercel credentials to run `vercel login`/`vercel link`/`vercel deploy` itself.
- [ ] T023 [US2] **BLOCKED (depends on T022)** — Verify `GET /api/health` returns an identical response from local `vercel dev` and from a deployed preview URL (SC-002). Locally verified instead via the plain `tsx` listener (see T017); real `vercel dev` vs. deployed-URL parity needs to be run by you once T022 is done.
- [X] T024 [US2] Verify a request to an undocumented path (e.g. `GET /does-not-exist`) returns a consistent `404` shape — verified locally: `{"error":{"code":"route_not_found","message":"No route for GET /does-not-exist"}}`, `404`. Re-verify against `vercel dev`/deployed URL once linked (same code path, same expected result).
- [X] T025 [P] [US2] Document, in `apps/api/README.md`, the deployment path for `apps/api` and the environment variables it needs (`BLOB_READ_WRITE_TOKEN`, `AUTH_JWT_SECRET`); `apps/web`'s env vars are unchanged from before this feature — FR-011

**Checkpoint**: User Stories 1 and 2 are both independently functional — a deployable, documented backend pattern exists, proven end-to-end with `/health`.

---

## Phase 5: User Story 3 - Backend routes are protected by signed-token authentication (Priority: P3)

**Goal**: `POST /auth/token` issues a short-lived signed token per owner id; every `/coins/*` route requires a valid token and derives the acting owner exclusively from it. Storage for this phase is an in-memory placeholder — Phase 6 swaps it for Vercel Blob without touching this phase's route/auth contract.

**Independent Test**: Call a coins route with no token (expect `401`), obtain a token for owner A via `/auth/token`, use it successfully against owner A's own (placeholder) data, then confirm a request carrying owner A's token cannot read or change owner B's data no matter what other id it claims elsewhere in the request.

### Implementation for User Story 3

- [X] T026 [US3] Create `apps/api/src/lib/auth.ts`: `signToken(ownerId: string)` — HS256 JWT via `jsonwebtoken`, signed with `AUTH_JWT_SECRET`, `sub: ownerId`, 15-minute expiry (data-model.md AuthToken) — and a `requireAuth` Express middleware that reads `Authorization: Bearer <token>`, rejects a missing header, invalid signature, or expired token with `401` (contracts/api-routes.md, FR-012/FR-014), and otherwise attaches the verified `ownerId` (the token's `sub` claim only) to `req` for downstream handlers (research.md D10, FR-013)
- [X] T027 [US3] Create `apps/api/src/routes/auth.ts` implementing `POST /auth/token` per contracts/api-routes.md (`{ "ownerId": "string" }` → `200 { "token": "string", "expiresAt": "ISO-8601" }`; `400` when `ownerId` is missing or empty) and mount it in `apps/api/src/app.ts`, unauthenticated (FR-015)
- [X] T028 [US3] Create `apps/api/src/domains/coins/contracts.ts` with the `CoinBalanceRecord` (`ownerId: string`, `amount: integer >= 0`, `version: integer`, `updatedAt: ISO-8601`) and `CoinTransactionRecord` (`txId: string`, `ownerId: string`, `direction: "credit" | "debit"`, `amount: integer > 0`, `resultingBalance: integer`, `createdAt: ISO-8601`) types exactly as specified in data-model.md
- [X] T029 [US3] Create `apps/api/src/domains/coins/service.ts` exporting `getBalance(ownerId)`, `topUp(ownerId, amount)`, `debit(ownerId, amount)`, `listTransactions(ownerId, limit)`, backed for this phase by an in-memory `Map<ownerId, CoinBalanceRecord>` and an in-memory array of `CoinTransactionRecord` per owner, starting new owners at `{ amount: 0, version: 0 }` — `debit` MUST reject with an insufficient-balance error when `amount` requested exceeds the current balance (FR-007 Key Entities semantics; Phase 6 replaces internals only, same exported signatures)
- [X] T030 [US3] Create `apps/api/src/routes/coins.ts` implementing `GET /coins/balance`, `GET /coins/transactions`, `POST /coins/topup`, `POST /coins/debit` per contracts/api-routes.md, every route wrapped in `requireAuth`, reading `ownerId` only from `req`'s verified identity (never from a header, query, or body field — FR-013), and mount it in `apps/api/src/app.ts`
- [X] T031 [US3] Extend `apps/api/scripts/smoke-test.mjs` with the auth scenarios from quickstart.md: no `Authorization` header → `401` with no data access; a token issued for owner A never succeeds in reading/changing owner B's data (SC-007); a token with a tampered signature or an expired `exp` → `401` (SC-006) — **corrected after /speckit-analyze (G1)**: the expired-token case was missing; the script now mints a validly-signed token with `exp` in the past (needs `AUTH_JWT_SECRET`). Also, per the constitution's Principle II (C2), Blob reads and JWT claims are now Zod-validated instead of cast, and `jwt.verify` pins `HS256` (a forged `alg: none` token is rejected — verified)
- [X] T032 [US3] Run the extended smoke test and confirm every auth scenario passes — **adapted**: run against the local `tsx` listener (no `vercel dev` session available here); all 11 checks passed, including the no-token/tampered-token/cross-owner scenarios (quickstart.md "Validar User Story 3"). Re-run against `vercel dev` once you have it linked, for full parity.

**Checkpoint**: User Stories 1-3 are independently functional — routes exist, are documented, are deployed, and are genuinely protected (storage is still a placeholder).

---

## Phase 6: User Story 4 - Backend persists structured data in Vercel Blob (Priority: P4)

**Goal**: Replace the in-memory placeholder from Phase 5 with real Vercel Blob-backed storage, using optimistic concurrency, without changing the route or auth contract at all.

**Independent Test**: Through the now-protected routes, perform a top-up then a debit against the same (real) balance and confirm it's correct on re-read, including after a cold start; run 50 concurrent top-ups against the same balance and confirm the final value exactly matches the sum of accepted requests.

### Implementation for User Story 4

- [X] T033 [US4] Create `apps/api/src/lib/blobStore.ts`: `getBalance(ownerId)` / `putBalance(record, expectedVersion)` against `coins/balances/<ownerId>.json`, implementing the optimistic-concurrency double-check from research.md D5 — re-read the current `version` immediately before `put`ting and reject with a conflict error if it no longer matches `expectedVersion` — and `appendTransaction(record)` / `listTransactions(ownerId, limit)` against `coins/transactions/<ownerId>/<ISO-timestamp>-<txId>.json`, ordered lexicographically per research.md D6 — implemented as `readBalance`/`writeBalance`/`appendTransaction`/`listTransactions`; uses `addRandomSuffix: false` (the installed `@vercel/blob@0.27.3` has no `allowOverwrite` flag)
- [X] T034 [US4] Replace the in-memory logic inside `apps/api/src/domains/coins/service.ts` with calls into `blobStore.ts`, keeping the exact exported function signatures `routes/coins.ts` already depends on (no route changes); `topUp`/`debit` MUST retry the read-modify-write once on a detected version conflict before surfacing `409` to the caller (FR-008). **Bug found and fixed while exercising this**: `apps/api` was first scaffolded on Express 4, which doesn't forward rejected promises from async handlers — any Blob error crashed the whole process. Fixed by aligning `apps/api` with `server/`'s Express 5 (as plan.md intended: "mesma stack de `server/`"), which forwards async rejections to the error middleware natively. Re-verified at runtime: Blob failures return a structured `500` and the server stays up.
- [X] T035 [US4] Confirm `apps/api/src/routes/coins.ts`'s `409` (concurrency conflict) and `402` (insufficient balance) responses match contracts/api-routes.md exactly, now sourced from `service.ts`'s Blob-backed errors instead of the Phase 5 placeholder's — verified by code review (same error classes, same route mapping); the `402` path was also exercised live in Phase 5
- [X] T036 [US4] Extend `apps/api/scripts/smoke-test.mjs` with the Blob-backed scenarios from quickstart.md — already covered by the single smoke-test written in T031 (fresh balance, top-up/debit, over-limit debit, 50 concurrent top-ups with `409` retry, transaction ordering)
- [ ] T037 [US4] **BLOCKED (needs a real `BLOB_READ_WRITE_TOKEN`)** — Run the full smoke test against the Blob-backed service and confirm zero lost updates in the concurrency scenario (quickstart.md "Validar User Story 4"). With a fake token, every `/coins/*` route returns a structured `500 "Vercel Blob: This store does not exist."` without crashing, which is the expected behavior; the real Blob run needs your store token.

**Checkpoint**: All four user stories are independently functional — the feature is complete end-to-end.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final regression gates and documentation required by the constitution before this feature is considered done.

- [X] T038 [P] Run `nx run web:lint`, `nx run web:typecheck`, `nx run web:build`, and `nx run web:test:e2e`; confirm zero regressions attributable to the `apps/web` relocation (SC-004) — lint (warnings only, all pre-existing), typecheck and build pass. Playwright: **115 passed, 6 failed**; all 6 are visual-snapshot diffs on `checkout` and `wallets` (3 viewports each). **Pre-existing, not caused by this feature**: those baselines date from commit `9c692bf`, but both pages later gained the 006 coins UI (`CoinsBalanceSection`, `PaymentMethodPicker`) without the snapshots being regenerated. Left untouched pending your decision (`pnpm --dir apps/web test:e2e:update`).
- [X] T039 [P] Confirm the `006-platform-coins` backend is completely unaffected (FR-002) — `server/` has no git changes and `tsc --noEmit` passes there
- [X] T040 Update `docs/TEAMS.md` to describe the new `apps/web` / `apps/api` layout — done; root `README.md` scripts table updated too (frontend-only scripts now run via `pnpm --dir apps/web <script>`)
- [ ] T041 **PARTIAL** — Walk through `quickstart.md` top to bottom. Done: US1 commands, local auth/validation/404 checks, regression gates. Blocked on your Vercel account: `vercel link`/`vercel deploy` (US2 parity) and a real `BLOB_READ_WRITE_TOKEN` (US4 persistence + 50-concurrent-writes run).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories.
- **User Stories (Phase 3-6)**: All depend on Foundational completion.
  - US1 (Phase 3) has no dependency on US2-US4.
  - US2 (Phase 4) depends only on Foundational (it exercises `/health`, already built in Phase 2).
  - US3 (Phase 5) depends only on Foundational (it adds its own placeholder storage — does not require US4).
  - US4 (Phase 6) depends on US3 (Phase 5) — it replaces US3's placeholder storage inside `service.ts` and cannot start before `routes/coins.ts`/`service.ts` exist.
- **Polish (Phase 7)**: Depends on all four user stories being complete.

### User Story Dependencies

- **US1 (P1)**: Independent — no dependency on US2/US3/US4.
- **US2 (P2)**: Independent of US1/US3/US4 — exercises only `/health`, built in Foundational.
- **US3 (P3)**: Independent of US1/US2 — builds its own routes and placeholder storage; **US4 depends on US3**.
- **US4 (P4)**: Depends on US3 (replaces its storage internals; same routes).

### Within Each User Story

- Contracts/types before service logic.
- Service logic before route wiring.
- Route wiring before smoke-test extension.
- Smoke-test extension before the "run and confirm" verification task.

### Parallel Opportunities

- All Setup tasks marked `[P]` (T003-T006) can run in parallel once T001-T002 are done.
- `[P]` Foundational tasks (T011, T014, T015) can run in parallel with each other.
- Once Foundational (Phase 2) is done, **US1 and US2 can proceed fully in parallel** (different concerns, no shared files beyond `app.ts`, which only US2/Foundational touch). **US3 can also start in parallel with US1/US2** (it only adds new files + mounts two new routers in `app.ts`).
- US4 cannot start until US3's `service.ts`/`routes/coins.ts` exist.
- Polish tasks T038/T039 can run in parallel with each other.

---

## Parallel Example: Setup Phase

```bash
# After T001 (pnpm-workspace.yaml) and T002 (apps/web relocated):
Task: "Create apps/web/package.json and trim the root package.json"
Task: "Create apps/api/package.json and apps/api/tsconfig.json"
Task: "Create apps/api/.env.example documenting BLOB_READ_WRITE_TOKEN and AUTH_JWT_SECRET"
Task: "Create apps/web/vercel.json and apps/api/vercel.json"
```

## Parallel Example: User Stories 1-3 together (after Foundational)

```bash
# Developer/agent A:
Task: "US1 — add root dev:all script, verify Nx project scoping"

# Developer/agent B:
Task: "US2 — link apps/api to Vercel, verify /health parity local vs deployed"

# Developer/agent C:
Task: "US3 — build auth.ts, routes/auth.ts, coins contracts/service/routes with placeholder storage"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (blocks everything).
3. Complete Phase 3: User Story 1.
4. **STOP and VALIDATE**: a developer can clone and run the whole workspace.

### Incremental Delivery

1. Setup + Foundational → workspace boots, `/health` works.
2. + US1 → monorepo environment proven (MVP).
3. + US2 → deployment/routing pattern proven on Vercel.
4. + US3 → `/coins/*` exists, documented, and genuinely protected by signed tokens (placeholder storage).
5. + US4 → placeholder storage swapped for real Vercel Blob persistence with optimistic concurrency — feature complete.
6. Polish → regression gates on `apps/web` and `server/`, docs updated.

### Parallel Team Strategy

After Foundational is done: one person/agent on US1 (workspace ergonomics), one on US2 (Vercel deployment plumbing), one on US3 (auth + coins routes with placeholder storage) — all three are mutually independent. US4 starts only once US3 lands.

---

## Notes

- `[P]` tasks touch different files with no incomplete dependency.
- `[Story]` labels trace every Phase 3+ task back to spec.md's user stories.
- US4's entire job is an internal swap inside `service.ts` — it MUST NOT change `routes/coins.ts`'s external contract (contracts/api-routes.md stays authoritative throughout).
- `server/` and `specs/006-platform-coins/**` are never touched by any task in this list (FR-002) — if a task seems to require editing something there, stop and re-check against plan.md before proceeding.
- The token-issuance limitation (FR-015: issuance trusts the requested `ownerId`) is a documented, accepted scope boundary, not a bug to "fix" during implementation — see spec.md Assumptions.
