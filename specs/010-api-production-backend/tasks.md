---

description: "Task list for 010-api-production-backend"
---

# Tasks: Back-end de produção (`apps/api`) funcionando de verdade

**Input**: Design documents from `/specs/010-api-production-backend/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api-delta.md, contracts/verification-suite.md, quickstart.md (all present)

**Tests**: The spec requires an executable verification (FR-012), so the test artifact is `apps/api/scripts/verify-deploy.mjs` (contract: `contracts/verification-suite.md`), built incrementally with the stories it proves. No separate unit-test framework is introduced.

**Organization**: Tasks are grouped by user story (spec.md US1–US4).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1–US4 from spec.md
- All paths are relative to the repository root.

## Path Conventions

`apps/api/` plus `.specify/memory/constitution.md` and, for status updates only, `specs/008-web-production-env/`. `server/`, `apps/web/` and `specs/006`/`007` are **not** modified (FR-015).

## Ordering note

**US1 (deploy fix) does not depend on the database or on the constitutional amendment**: it deploys the code that already exists. It may start right after Phase 1 and ship alone as the MVP. Phase 2 (database layer) blocks **US2, US3 and US4's database steps** only.

---

## Phase 1: Setup

- [ ] T001 **Gate — needs the user's approval.** Amend `.specify/memory/constitution.md` to v1.5.0 (MINOR): in the "Monorepo na Vercel com Vercel Blob" exception, replace "Nenhum driver de banco relacional é introduzido" and "persiste dados via Vercel Blob" with: `apps/api` persists in managed PostgreSQL (Neon via Vercel Marketplace) using the `pg` driver, with SQL migrations versioned in `apps/api/db/migrations`; remove the "limitação assumida" that the admin hash lives in non-private storage; keep every other bullet (admin hash/login/role rules, token identity model, `server/` untouched, e2e against mocks) verbatim. Add the Sync Impact Report entry (1.4.0 → 1.5.0) and bump `Last Amended`. No storage code (Phase 2 onward) starts before this is approved
- [ ] T002 [P] Add `pg` and `@types/pg` to `apps/api/package.json` and the scripts `"db:migrate": "tsx scripts/migrate.ts"` and `"verify:deploy": "node scripts/verify-deploy.mjs"`. **Keep `@vercel/blob`** for now (US1 deploys the current code; it is removed in T029). Run `pnpm install` from the repo root
- [ ] T003 [P] Edit `apps/api/.env.example`: add `DATABASE_URL=` with a comment (local: `postgres://postgres:dev@localhost:5432/postgres`; Vercel: the Neon *pooler* URL), keep `AUTH_JWT_SECRET` and `PORT=4001`; leave `BLOB_READ_WRITE_TOKEN` documented as "removed after T029"

---

## Phase 2: Foundational (database layer — blocks US2, US3, US4 DB steps; NOT US1)

**⚠️ Requires T001 approved.**

- [ ] T004 Create `apps/api/db/migrations/001_init.sql` exactly per `data-model.md`: `coin_balances(owner_id text PRIMARY KEY, amount bigint NOT NULL CHECK (amount >= 0), version bigint NOT NULL, updated_at timestamptz NOT NULL)`; `coin_transactions(tx_id uuid PRIMARY KEY, owner_id text NOT NULL, direction text NOT NULL CHECK (direction IN ('credit','debit')), amount bigint NOT NULL CHECK (amount > 0), resulting_balance bigint NOT NULL CHECK (resulting_balance >= 0), idempotency_key text NULL, created_at timestamptz NOT NULL, UNIQUE (owner_id, idempotency_key))` plus index `(owner_id, created_at DESC)`; `admins(id text PRIMARY KEY, email text NOT NULL UNIQUE, password_hash text NOT NULL, role text NOT NULL CHECK (role = 'admin'), created_at timestamptz NOT NULL)`
- [ ] T005 [P] Create `apps/api/src/lib/db.ts`: a lazily created `pg` `Pool` with `max: 1`, no named prepared statements, exporting a typed `query<T>(text, params)` helper; if `DATABASE_URL` is unset throw the specific `ApiError` `missing_database_url` (via `internal(...)` from `lib/errors.ts`) at first use and from `src/server.ts` at startup (FR-011); never log the URL
- [ ] T006 Create `apps/api/scripts/migrate.ts`: creates `schema_migrations(name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`, applies each `db/migrations/*.sql` in filename order inside a transaction once, skips already applied ones (idempotent), prints what ran. Depends on T004, T005
- [ ] T007 Start local Postgres (`docker run --name nft-pg -e POSTGRES_PASSWORD=dev -p 5432:5432 -d postgres:16`), copy `.env.example` to `apps/api/.env.local`, run `pnpm --dir apps/api db:migrate` twice; the second run MUST apply nothing. Confirm the three tables and constraints exist with `docker exec nft-pg psql -U postgres -c "\d coin_transactions"`. Depends on T006

**Checkpoint**: A migrated local database exists and the API can reach it.

---

## Phase 3: User Story 1 — A API publicada responde em produção (Priority: P1) 🎯 MVP

**Goal**: `/api/*` answers in production, directly and through the site's `/backend/*`.

**Independent Test**: `GET https://nft-marketplace-api-ochre.vercel.app/api/health` and `GET https://nft-marketplace-web-wheat.vercel.app/backend/health` both return `200` from the real API.

- [X] T008 [US1] Verify `apps/api/vercel.json` contains `"framework": null`, `"buildCommand": ""` and the rewrite `/api/(.*)` → `/api/index` (it does on 2026-10-24; do not change it), and make sure `apps/api/README.md` "Deploying" states why (the `express` preset creates a catch-all function that collides with `api/index.ts`). Edit the README only if that explanation is missing
- [X] T009 (2026-10-24: new project `nft-marketplace-api`; AUTH_JWT_SECRET + Blob store connected; deployed straight to production, no separate preview) [US1] **Needs the user's confirmation — deploys.** Check `vercel env ls` in `apps/api` that `BLOB_READ_WRITE_TOKEN` and `AUTH_JWT_SECRET` exist for **Production** (the current code still needs both); add what is missing without printing values. Then `vercel deploy` from `apps/api` and verify the preview with the existing `scripts/smoke-test.mjs` (`BASE_URL=https://<preview>/api`, bypass header for the protected preview): `/api/health` = `200`, unknown route = the API's own `404` JSON
- [X] T010 [US1] **Needs the user's confirmation — publishes to production.** `vercel deploy --prod` from `apps/api`; verify `GET https://nft-marketplace-api-ochre.vercel.app/api/health` = `200 {"status":"ok"}` and `GET .../api/nao-existe` returns the API's structured `404` (US1 scenarios 1 and 3). If it still returns the platform `NOT_FOUND`, the project-level framework preset overrides `vercel.json`: set the project's Framework Preset to "Other" in the dashboard (CLI 48 has no `vercel api`) and redeploy
- [X] T011 (2026-10-24: production API https://nft-marketplace-api-ochre.vercel.app and site /backend/health both 200; token → topup → balance verified through the site; no-token ⇒ 401; 008 T014 marked done) [US1] Verify the chain through the site: `GET https://nft-marketplace-web-wheat.vercel.app/backend/health` = `200` from the API (FR-003). Then update `specs/008-web-production-env/tasks.md`: mark T014 `[X]` with the date and result, and note in its US2 that FR-013 is satisfied. Do not edit anything else of the 008

**Checkpoint**: US1 delivered on the current storage; the site's real back-end link works. Remaining stories fix the data layer.

---

## Phase 4: User Story 2 — O saldo de moedas nunca perde uma atualização (Priority: P2)

**Goal**: Atomic, idempotent balance operations; saldo = soma do histórico.

**Independent Test**: 50 concurrent operations on one balance end with exactly `inicial + soma das aceitas`, 10 runs out of 10, locally and in production.

- [ ] T012 [P] [US2] Create `apps/api/src/domains/coins/repository.ts` with the **port** `CoinsRepository` (`getBalance(ownerId)`, `applyOperation({ownerId, direction, amount, idempotencyKey?})` returning `{ balance, replayed }`, `listTransactions(ownerId, limit)`), no SQL and no `pg` import in the port file's types. Row shapes validated with the existing `coinBalanceRecordSchema`/`coinTransactionRecordSchema`
- [ ] T013 [US2] In the same file add `PgCoinsRepository` implementing the port with **one SQL statement** per operation (research D3): a CTE that upserts `coin_balances` with `amount = coin_balances.amount ± $amount`, `version = version + 1`, `updated_at = now()` guarded by `WHERE coin_balances.amount ± $amount >= 0` (a debit that would go below 0 affects no row ⇒ `InsufficientBalanceError`), and inserts into `coin_transactions` the `resulting_balance` plus `idempotency_key` in the same statement. Idempotency (research D5): on `UNIQUE (owner_id, idempotency_key)` conflict, read the stored transaction; same direction+amount ⇒ return the original resulting balance with `replayed: true` and no new effect; different ⇒ throw `IdempotencyConflictError`. Constraints to honor verbatim: `amount > 0` integer, `amount >= 0` balance, `Idempotency-Key` 1..128 chars. Depends on T005, T012
- [ ] T014 [P] [US2] Edit `apps/api/src/domains/coins/contracts.ts`: add `export class IdempotencyConflictError extends Error` and an `idempotencyKeySchema = z.string().min(1).max(128)`; keep `ConcurrencyConflictError` exported but unused-by-the-API (documented as reserved, `contracts/api-delta.md`)
- [ ] T015 [US2] Rewrite `apps/api/src/domains/coins/service.ts` to depend only on the `CoinsRepository` port (constructor/parameter injection, default `PgCoinsRepository`): delete `applyTransactionOnce`/retry loop; `getBalance` returns `{ownerId, amount: 0, version: 0, updatedAt: new Date(0).toISOString()}` when there is no row; keep the exported function names (`getBalance`, `topUp`, `debit`, `listTransactions`) so routes and the OpenAPI document keep working. Depends on T012–T014
- [ ] T016 [US2] Edit `apps/api/src/routes/coins.ts`: read optional header `Idempotency-Key` through `idempotencyKeySchema` (invalid ⇒ `400 invalid_idempotency_key`), pass it to the service; map `IdempotencyConflictError` ⇒ `409 idempotency_key_conflict`; keep `402 insufficient_balance`; remove the `ConcurrencyConflictError` ⇒ `409` branches. Response bodies and status codes for the existing cases stay identical (FR-014). Depends on T015
- [ ] T017 [US2] Create `apps/api/scripts/verify-deploy.mjs` with the coins checks of `contracts/verification-suite.md`: #1 health, #2 structured 404, #3 no token ⇒ 401, #4 expired/tampered ⇒ 401, #5 token → credit → debit → balance → history, #6 over-debit ⇒ 402 with balance intact, #7 owner isolation, **#10 50 concurrent mixed operations** (count platform challenges — 403/429 with `x-vercel-mitigated` or `Retry-After` — separately from accepted-and-lost), **#11 balance == sum of returned history**, **#12 idempotency** (same key ×5 ⇒ one effect; same key different amount ⇒ 409). Env: `BASE_URL`, `AUTH_JWT_SECRET`, optional `PROTECTION_BYPASS` (header `x-vercel-protection-bypass`); fresh owner ids per run (`verify-<timestamp>-<n>`); exit code ≠ 0 on any failure; never print tokens or secrets. Reuse helpers from `scripts/smoke-test.mjs`
- [ ] T018 [US2] Update `apps/api/src/openapi/document.ts` (spec 009) so the generated document describes the optional `Idempotency-Key` header and the `409 idempotency_key_conflict` / `400 invalid_idempotency_key` responses on `POST /coins/topup` and `/coins/debit`, and drops `concurrency_conflict` from them. Keep it generated from the Zod schemas (no hand-written duplicate)
- [ ] T019 [US2] Run locally: `pnpm --dir apps/api dev:local` (port 4001) then `BASE_URL=http://localhost:4001/api AUTH_JWT_SECRET=<local> node apps/api/scripts/verify-deploy.mjs` ten times in a row; all coins checks pass with **zero** lost updates every time. If any run loses an update, stop and fix T013 before continuing. Depends on T007, T016, T017

**Checkpoint**: US2 is proven locally (SC-002, SC-003, SC-005). Production proof happens in T034/T035.

---

## Phase 5: User Story 3 — Dados sensíveis deixam de ser publicamente legíveis (Priority: P3)

**Goal**: Admins, hashes, balances and history live only in the database, reachable only through the API.

**Independent Test**: No direct address returns an admin or balance record; admin login still works with the same responses.

- [ ] T020 [P] [US3] Create `apps/api/src/domains/admin/repository.ts` with the port `AdminRepository` (`findByEmail`, `upsert`, `listOwners(limit, cursor)`) and `PgAdminRepository`: `admins` table per data-model (`id` = sha256 hex of the normalized e-mail, unchanged; `role` always `'admin'`; `created_at` preserved on re-seed), and `listOwners` reading `coin_balances` ordered by `owner_id` with a keyset cursor (the `owner_id` of the last row), returning `{ owners: { ownerId, updatedAt }[], cursor?: string }` exactly as `blobStore.listOwners` does today. Move `normalizeEmail`/`adminIdFor` out of `blobStore.ts` into this file. Depends on T005
- [ ] T021 [US3] Edit `apps/api/src/domains/admin/service.ts` to depend only on `AdminRepository` (replace every `blobStore.*`); keep `authenticateAdmin` verifying a hash even for an unknown e-mail (`getDummyHash`) so both failures stay indistinguishable (FR-009), and `upsertAdmin`'s 8-character minimum. Depends on T020
- [ ] T022 [P] [US3] Edit `apps/api/scripts/seed-admin.ts` to require `DATABASE_URL` instead of `BLOB_READ_WRITE_TOKEN` and use the repository-backed `upsertAdmin`; credentials still only from `ADMIN_EMAIL`/`ADMIN_PASSWORD`, never from a file or a log (FR-010)
- [ ] T023 [US3] Edit `apps/api/src/routes/health.ts`: after the secrets check run `SELECT 1` through `lib/db.ts`; return `200 {"status":"ok"}`, `500 database_unavailable` when the query fails, `500 missing_database_url` when the variable is absent (replaces `missing_blob_token`). Edit `apps/api/src/server.ts` `REQUIRED_ENV_VARS` to `["DATABASE_URL", "AUTH_JWT_SECRET"]`. Depends on T005
- [ ] T024 [US3] Extend `apps/api/scripts/verify-deploy.mjs` with #8 admin login (correct ⇒ `role:"admin"` token; unknown e-mail and wrong password return the same status and body), #9 admin token rejected on owner routes and owner token rejected on admin routes, and **#13 direct-read denial**: none of the `DIRECT_PROBE_URLS` (comma-separated env) returns record data, and the admin's password hash never appears in any response body. Depends on T017
- [ ] T025 [US3] Remove Blob: delete `apps/api/src/lib/blobStore.ts`, remove `@vercel/blob` from `apps/api/package.json`, remove `BLOB_READ_WRITE_TOKEN` from `.env.example`, and fix every remaining reference (`grep -ri "blob" apps/api/src apps/api/scripts` must find none except comments about history). Run `pnpm install` from the repo root. Depends on T015, T021, T022, T023
- [ ] T026 [US3] Run locally: `pnpm --dir apps/api typecheck && pnpm --dir apps/api lint`; seed a local admin (`ADMIN_EMAIL=... ADMIN_PASSWORD=... pnpm --dir apps/api seed:admin`), run `scripts/admin-smoke-test.mjs` and the full `verify-deploy.mjs`; every check passes. Depends on T024, T025

**Checkpoint**: Storage is private and Blob is gone from the code (SC-004 locally).

---

## Phase 6: User Story 4 — Operar e verificar a produção é repetível (Priority: P4)

**Goal**: Anyone can deploy, verify and roll back the API by following the docs.

**Independent Test**: Follow only `quickstart.md` to a verified preview and a verified production.

- [ ] T027 [US4] Extend `apps/api/scripts/verify-deploy.mjs` with **#14 latency** (first call plus 20 more, print p95 and whether ≤ 2 s) and a `--repeat N` flag that reruns the whole suite N times with fresh owners, failing on the first lost update. Depends on T024
- [ ] T028 [P] [US4] Rewrite the storage sections of `apps/api/README.md`: Postgres instead of Blob; the env matrix of `contracts/api-delta.md`; setup with Docker Postgres + `db:migrate`; "Deploying" (framework preset, migrations, secrets via `vercel env`, preview → verify → promote); rollback with `vercel rollback`; remove the Blob "known limitations" 1–3 that no longer apply and **keep** the token-issuance limitation (spec Assumptions). State that the old hash was exposed and the admin password must be rotated
- [ ] T029 [P] [US4] Update `specs/008-web-production-env/deploy-environments.md` API section: `DATABASE_URL` and `AUTH_JWT_SECRET` per environment instead of `BLOB_READ_WRITE_TOKEN`; link `specs/010-api-production-backend/quickstart.md`. No other 008 file changes
- [ ] T030 [US4] **Needs the user's confirmation — creates external resources.** In the Vercel project `nft-marketplace-api` add the **Neon Postgres** integration (Marketplace) with separate branches for Preview and Production (quickstart step 3); ensure the variable is named `DATABASE_URL` and is the pooler URL; set `AUTH_JWT_SECRET` to **different** 32-byte hex values for Preview and Production; confirm with `vercel env ls`. Never print values
- [ ] T031 [US4] Migrate and seed each remote database (quickstart step 4): `DATABASE_URL=<preview>` then `<production>` with `pnpm --dir apps/api db:migrate`, then `ADMIN_EMAIL=... ADMIN_PASSWORD='<NEW password>' pnpm --dir apps/api seed:admin`. The password MUST differ from the one used while the hash was publicly readable. Delete any `.env.*.local` pulled for this afterwards. Depends on T030
- [ ] T032 [US4] **Needs the user's confirmation — deploys.** `vercel deploy` from `apps/api`; run `BASE_URL=https://<preview>/api PROTECTION_BYPASS=<secret> AUTH_JWT_SECRET=<preview> pnpm --dir apps/api verify:deploy`; all 14 checks `✓`. Depends on T025–T027, T031
- [ ] T033 [US4] **Needs the user's confirmation — publishes to production.** `vercel deploy --prod` (or `vercel promote <preview>`); run `verify:deploy` against `https://nft-marketplace-api-ochre.vercel.app/api` and then against `https://nft-marketplace-web-wheat.vercel.app/backend` (end-to-end chain, FR-003); run once more with `-- --repeat 10` (SC-002: 10 of 10 with zero lost updates). Record the p95 from check #14 in `quickstart.md` under a "Resultado" heading
- [ ] T034 [US4] **Needs the user's confirmation — deletes data.** Clean up the old storage (quickstart step 10): delete the old Blob objects (admin records first), remove the Blob store if nothing else uses it, remove `BLOB_READ_WRITE_TOKEN` from the project's env vars, and confirm no old public URL still returns an admin or balance record. Depends on T033

**Checkpoint**: Production is verified end to end, repeatably (SC-001–SC-007).

---

## Phase 7: Polish & Cross-Cutting

- [ ] T035 Regression gate from the repo root: `pnpm typecheck`, `pnpm lint`, `pnpm build`, then `pnpm --dir apps/web exec playwright test`; the result must equal the pre-feature one (only the 6 known stale `checkout`/`wallets` snapshots fail; SC-008). Confirm `git status` shows no change under `server/`, `apps/web/` (except none expected), `specs/006-platform-coins/`, `specs/007-monorepo-vercel-blob/` (FR-015)
- [ ] T036 Re-read `spec.md` FR-001…FR-015 and SC-001…SC-008 against the final state and list in the completion report which are verified (and how) and which are not; expected open items, if any: SC-006 on cold starts depends on the measured p95

---

## Dependencies & Execution Order

- **Phase 1** → **Phase 2** (needs T001 approved) → **US2/US3/US4 DB work**.
- **US1 (T008–T011)** has no dependency on Phase 1 or 2 — it can run first, in parallel with T001's review, and ships alone.
- US2 → US3: T020/T021 use `lib/db.ts` (T005) and the migrated schema (T007); T024 extends the script created in T017; T025 (remove Blob) needs T015, T021, T022, T023.
- US4's remote steps (T030–T034) need all code done (T025–T027) and the user's confirmations.
- Same-file sequences: `verify-deploy.mjs` = T017 → T024 → T027; `package.json` = T002 → T025; `coins/repository.ts` = T012 → T013.

### Parallel opportunities

- T002, T003 together. T005 alongside T004.
- T012, T014 (different files) together; T020, T022, T023 are independent of each other; T028, T029 together.

```text
Task: "T012 CoinsRepository port in domains/coins/repository.ts"
Task: "T014 IdempotencyConflictError + idempotencyKeySchema in domains/coins/contracts.ts"
Task: "T005 lib/db.ts (Pool, fail-fast)"
```

## Implementation strategy

### MVP first (US1)

T008–T011: deploy the code that exists and verify `/api/health` in production and through the site. This alone unblocks the 008 (T014) and gives a working back-end link, with the known storage defects still documented.

### Incremental delivery

1. + Phase 1–2 and US2 (T012–T019): correctness of the balance, proven locally.
2. + US3 (T020–T026): private storage, Blob removed.
3. + US4 (T027–T034): remote database, verified production, cleanup.
4. Polish (T035–T036).

## Notes

- External actions need the user's explicit confirmation immediately before running: T001 (constitution), T009/T010 (deploys), T030 (integration), T032/T033 (deploys), T034 (data deletion). Never print env values, tokens or hashes.
- If a task seems to require editing `server/`, `apps/web/` (beyond nothing) or specs 006/007, stop and re-check the plan.
- If T019 shows any lost update, the atomic statement (T013) is wrong — do not proceed to US3/US4 until it is fixed.
