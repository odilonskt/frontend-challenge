# apps/api

A real (not mocked) backend, independent of `server/` (the `006-platform-coins` backend — not
touched by this feature). Deployed as Vercel Serverless Functions, built as a single Express app
(`src/app.ts`) mounted behind one catch-all function (`api/index.ts`). Persists its data in
**Postgres on Neon**, accessed through **Prisma ORM** (`@prisma/client` + `@prisma/adapter-neon` over
`@neondatabase/serverless`; constitution 1.6.0): balances, the transaction ledger and admins. It used Vercel Blob until 2026-10-24; that store is no longer read or written. See
`specs/007-monorepo-vercel-blob/` for the full spec, plan, research, data model, and API contract.

## Setup

```sh
cp apps/api/.env.example apps/api/.env.local
# DATABASE_URL and DATABASE_URL_UNPOOLED come from the Neon integration: `vercel env pull .env.local`
# generate AUTH_JWT_SECRET with:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

`pnpm install` (from the repo root) also runs `prisma generate` (the `postinstall` of `apps/api`), which writes the
client to `src/generated/prisma`. That folder is **not committed**; the root `package.json` lists `prisma` and
`@prisma/engines` in `pnpm.onlyBuiltDependencies` so pnpm lets their install scripts run. Pin the three Prisma
packages to the same exact version (7.10.1): the `latest` tag of `prisma` is currently an 8.0 release candidate.

## Database (Prisma)

- Schema: `prisma/schema.prisma` (models `Balance`, `CoinTransaction`, `Admin`, `Profile`, `ProfileAvatar` mapped to
  the tables `balances`, `transactions`, `admins`, `profiles`, `profile_avatars`). Migrations: `prisma/migrations/`
  (initial: `0_init`; collector profile: `1_profile`). Prisma does not model `CHECK`
  constraints, so they are written by hand in the migration SQL: keep them when adding migrations.
- `pnpm db:migrate` = `prisma migrate deploy` (applies pending migrations, using `DATABASE_URL_UNPOOLED`, the direct
  connection; the pooler is not safe for Migrate's advisory lock). `pnpm db:status` = `prisma migrate status`.
- A database created **before** Prisma (tables already exist): baseline it instead of migrating:
  `pnpm exec prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` must exit `0`,
  check the `CHECK` constraints in `pg_constraint` (the diff cannot see them), then
  `pnpm exec prisma migrate resolve --applied 0_init`.
- Changing the schema: edit `schema.prisma`, `pnpm exec prisma migrate dev --create-only --name <name>`, review the
  SQL (re-add any `CHECK`), then `pnpm db:migrate`.
- The balance change (top-up/debit) is **one raw SQL statement** run with `$queryRaw`, not the ORM: it must update
  the balance and append the ledger entry atomically, and Neon's HTTP mode has no transactions. It is the only raw
  SQL in the API; `$queryRawUnsafe` and `$executeRawUnsafe` are forbidden (constitution 1.6.0). A losing duplicate
  `Idempotency-Key` write surfaces as `PrismaClientKnownRequestError` with code `23505`, which the repository maps
  to the original result.

## Running locally

- `pnpm dev:vercel` (from `apps/api`, or `pnpm dev:api` from the repo root) — runs `vercel dev`.
  This is the **only** way to validate local/production parity (see quickstart.md's User Story 2
  section); it requires `vercel link` to have been run once against your own Vercel account. Note:
  the script can't be named `dev` — Vercel CLI's recursion guard refuses to run `vercel dev` when
  `package.json`'s own `dev` script also invokes `vercel dev`.
- `pnpm dev:local` — a plain `app.listen` via `tsx` on port **4001** (4000 is `server/`'s), for fast
  iteration on the Express app itself without `vercel dev`. Routes live under `/api` there too
  (`http://localhost:4001/api/health`). **Does not** exercise the Vercel rewrite/invocation model —
  never use it to validate parity with production.

## Documentation (Swagger / OpenAPI)

Interactive API docs and a machine-readable spec, both public (no token), under `/api` (feature
`009-api-swagger-docs`):

- `GET /api/docs` — **Swagger UI** (assets loaded from a pinned CDN, so nothing heavy is bundled
  into the function). Use "Authorize" to paste a Bearer token and "Try it out" against the live
  instance.
- `GET /api/openapi.json` — the **OpenAPI 3.1** document.

The document is **generated from the same Zod schemas that validate requests** (`src/openapi/`
builds it via Zod v4's native `z.toJSONSchema`), so the docs cannot drift from the real validation.
Request schemas live once in `src/domains/<domínio>/contracts.ts` and are imported by both the route
(runtime validation) and the generator. No new runtime dependency is added — this stays within the
`apps/api` stack allowed by the constitution. See `specs/009-api-swagger-docs/` for the full spec.

> Scope note: the generated document currently covers the six core routes (`health`, `auth/token`,
> `coins/*`). The `/api/admin/*` routes (below) are **not yet** in the OpenAPI document — documenting
> them is a follow-up.

## Admin

Administradores entram com e-mail e senha de verdade (`POST /api/admin/login`) e recebem um token com
`role: "admin"`. Rotas (todas somente leitura, exigem o token): `GET /api/admin/me`, `GET /api/admin/owners`,
`GET /api/admin/owners/:ownerId`. Contrato completo em `specs/007-monorepo-vercel-blob/contracts/api-routes.md`.

Cadastrar ou trocar a senha de um admin (as credenciais vêm só do ambiente, nunca de arquivo):

```sh
ADMIN_EMAIL=voce@exemplo.com ADMIN_PASSWORD='...' pnpm seed:admin
ADMIN_EMAIL=voce@exemplo.com ADMIN_PASSWORD='...' BASE_URL=http://localhost:3000/api pnpm smoke-test:admin
```

Limitações conhecidas, sem rodeios:

1. **Senha fraca continua sendo risco.** Os dados agora estão num banco privado (Neon), não em URL pública,
   mas a senha do admin ainda deve ser longa e única: o hash só protege enquanto a senha não for adivinhável.
2. **Sem limite de tentativas de login.** Não há rate limit nem bloqueio por tentativas em `/admin/login`
   (função serverless sem estado). A defesa atual é o custo do scrypt e a resposta idêntica para e-mail
   desconhecido e senha errada.

## Profile (collector)

Per-owner profile of the collector (`specs/014-user-profile`, constitution 1.9.0). Owner routes only, behind
`requireAuth` (an admin token gets `403 wrong_token_type`; there is **no** admin route for profiles). The owner is read
**only** from the verified token; an `ownerId` in a body is ignored.

| Route | What it does |
|-------|--------------|
| `GET /api/profile` | Display name, bio, ENS label + TLD, wallet nickname, `avatarVersion`, `updatedAt`. An owner that never saved reads empty values with `updatedAt: null` (never `404`). |
| `PUT /api/profile` | Replaces the five text fields (creates on first use). Idempotent; the last save wins. All invalid fields come back together in `error.fields`; nothing is written if any fails. |
| `GET /api/profile/avatar` | The photo as `{ dataUrl, version }`, or `404 no_avatar`. Separate from the profile so reading the profile never loads the image. |
| `PUT /api/profile/avatar` | Replaces the photo. |
| `DELETE /api/profile/avatar` | Removes the photo. Idempotent (`200` with or without one). |

- **Field codes** (`error.fields`): `displayName` → `too_short` \| `too_long` (3–60 characters), `bio` → `too_long`
  (≤ 280), `ensName` → `invalid_format` (empty, or `^[a-z0-9][a-z0-9-]{2,39}$`), `ensTld` → `invalid` (`.eth`,
  `.xyz`, `.art`), `walletNickname` → `too_long` (≤ 40), `avatar` → `invalid_format` \| `too_large`. Lengths count
  characters (code points), the same unit as the `CHECK` constraints of `1_profile`.
- **Photo**: PNG, JPEG or WebP, at most 1,048,576 bytes **decoded**, stored as `BYTEA` in `profile_avatars` (separate
  from `profiles`). The type is read from the **bytes** (signature), never from a file name, and must equal the type
  declared in the data URL. A refused photo leaves the current one untouched.
- **Body limit**: `express.json()` caps bodies at 100 kB, but a 1 MiB photo is ~1.4 MB of base64. Only
  `/api/profile/avatar` gets a 2 MB parser (`src/app.ts`, mounted before the global one); above that the answer is
  `413 payload_too_large`. Malformed JSON anywhere is `400 invalid_json` (it used to surface as a `500`).
- **Writes** are one `INSERT ... ON CONFLICT` statement each (no transactions on Neon's HTTP mode), so two simultaneous
  saves end in one complete row, never a mix.
- **What it does not hold**: username, e-mail and password stay in the site's simulated account; this API never sees
  them (a body that sends them is ignored). The profile is presentation data only.
- **Verifying**: `pnpm smoke-test:profile:local` runs `scripts/profile-smoke-test.mjs` against the real Express app over
  an in-memory repository (no database): HTTP, auth, validation, limits and the service rules. It does **not** prove the
  Prisma adapter or the migration; for those run `pnpm db:migrate` on a **development** database and
  `AUTH_JWT_SECRET=<same as the server> BASE_URL=http://localhost:4001/api pnpm smoke-test:profile` against
  `pnpm dev:local`.

## Known, documented limitations

1. **Token issuance trusts the requested owner id.** `POST /auth/token` signs a JWT for whatever
   `ownerId` it's asked for — there is no password or login behind it, because this project has no
   real authentication anywhere. What the resulting token *does* guarantee: once issued, it cannot
   be used to act as a different owner, and a request with no token (or an expired/tampered one) is
   rejected before touching any data. It does **not** stop someone who already knows another user's
   id from requesting a token for that id directly. Closing that gap would require real login across
   the whole product, which is out of scope here. See `specs/007-monorepo-vercel-blob/spec.md`
   (Assumptions) for the full writeup. **This applies to the profile too:** whoever knows another collector's id
   can request a token for it and read or change that collector's profile and photo. It is not full protection
   against account takeover and must never be presented as one.
2. **Concurrency is the database's job now.** Top-up and debit are each one atomic SQL statement that
   updates the balance and appends the ledger entry together, under the row lock; a debit only applies when
   `amount >= requested`. Verified: 50 concurrent top-ups end exactly at +50, and 50 concurrent debits
   against a balance of 30 accept exactly 30, reject 20 with `402`, end at `0`, with 31 ledger entries.
   The old Blob-era `409 concurrency_conflict` no longer exists.

## Verified during implementation (US1)

- `nx show projects` → lists `api` and `web`.
- `nx run web:typecheck` and `nx run api:typecheck` each run independently (neither triggers the other's build).
- A single `pnpm install` from the repo root installs all three workspace projects (`web`, `api`, root).

## Verifying

```sh
AUTH_JWT_SECRET=<same as the server> BASE_URL=http://localhost:4001/api pnpm smoke-test
```

Runs `scripts/smoke-test.mjs` against a running instance (`BASE_URL` defaults to
`http://localhost:4001/api`, i.e. `pnpm dev:local`; point it at `vercel dev` for full parity).
`AUTH_JWT_SECRET` is needed to mint an already-expired token for the expiry check. See
`specs/007-monorepo-vercel-blob/quickstart.md` for the full list of scenarios it covers.

### Full environment check (`verify:deploy`)

One command proves an environment (local, preview or production — also the site's `/backend` origin):

```sh
BASE_URL=https://<host>/api AUTH_JWT_SECRET=<that environment's secret>   ADMIN_EMAIL=... ADMIN_PASSWORD=... [PROTECTION_BYPASS=<secret>] [DIRECT_PROBE_URLS=<url,url>]   pnpm verify:deploy [--repeat 10] [--skip-admin]
```

It runs the 16 checks of `specs/010-api-production-backend/contracts/verification-suite.md` (health, structured
404, auth, isolation, admin login, 50 concurrent operations, balance == sum of the history, idempotency, direct-read
denial, latency p95, OpenAPI + Swagger UI, admin owners pagination), prints one `✓`/`✗` per check, never prints tokens, secrets or hashes, and exits non-zero on
any failure. `--repeat N` reruns the suite with fresh owners and stops at the first lost update.

### Idempotency

`POST /api/coins/topup` and `/debit` accept an optional `Idempotency-Key` header (1–128 characters). The same key
with the same operation returns the original result without a new effect; with another amount or direction it
returns `409 idempotency_key_conflict`; an invalid key returns `400 invalid_idempotency_key`.

## Deploying

```sh
cd apps/api
vercel link      # once, against your own Vercel account/project
vercel deploy    # preview deploy
vercel --prod    # promote to production (nft-marketplace-api-ochre.vercel.app)
```

Required environment variables on the Vercel project (Project Settings -> Environment Variables):
`DATABASE_URL` and `DATABASE_URL_UNPOOLED` (both set by the Neon integration), `AUTH_JWT_SECRET`. Apply the
schema once per database with `prisma migrate deploy` (see "Database (Prisma)").
Use a separate Neon branch for Development, Preview and Production and a **different** `AUTH_JWT_SECRET` per
environment; the Vercel build must show `prisma generate` running in `postinstall` (a `500` on every route,
including `/health`, right after a deploy means the client was not generated).
Order: migrate + seed the admin → `vercel deploy` → `pnpm verify:deploy` against the preview → `vercel deploy --prod`
→ `pnpm verify:deploy` against production and against the site's `/backend`.

Rollback: `vercel rollback` (or redeploy the previous deployment); the schema only ever gains columns/indexes, so the
previous code keeps working against the migrated database.

**Rotate the admin password.** While the API stored admins in Vercel Blob, the admin's password hash was readable
by anyone who knew its public URL. Seed the production admin with a **new** password (`pnpm seed:admin`), never the
one used back then.

### Framework preset (important)

This project must deploy as **`api/`-directory serverless functions only**, not as a framework
app. `vercel.json` pins `"framework": null` and `"buildCommand": ""` for exactly this reason:
if Vercel auto-selects the **`express` framework preset**, it creates a catch-all function that
collides with `api/index.ts`'s `/api/*` namespace and every `/api/*` route returns Vercel's own
`NOT_FOUND` in production (it still works under `vercel dev`, which masks the bug). With the pins
above, a build produces a single `λ api/index` function and the `/api/(.*)` → `/api/index` rewrite
routes all traffic to the Express app. Verify a preview with:

```sh
vercel curl /api/health --deployment <preview-url>   # expect {"status":"ok"}
```

(Preview deployments are SSO-protected; `vercel curl` authenticates via your CLI session. On
Git Bash, prefix with `MSYS_NO_PATHCONV=1` so the `/api/...` path isn't rewritten to a Windows path.)
