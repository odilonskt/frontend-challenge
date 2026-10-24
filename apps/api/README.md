# apps/api

A real (not mocked) backend, independent of `server/` (the `006-platform-coins` backend — not
touched by this feature). Deployed as Vercel Serverless Functions, built as a single Express app
(`src/app.ts`) mounted behind one catch-all function (`api/index.ts`). Persists its data in
**Vercel Blob**, including the structured balance/transaction example resource. See
`specs/007-monorepo-vercel-blob/` for the full spec, plan, research, data model, and API contract.

## Setup

```sh
cp apps/api/.env.example apps/api/.env.local
# fill in BLOB_READ_WRITE_TOKEN (Vercel dashboard -> Storage -> Blob, or `vercel blob store add`)
# generate AUTH_JWT_SECRET with:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Running locally

- `pnpm dev` (from `apps/api`, or `pnpm dev:api` from the repo root) — runs `vercel dev`. This is
  the **only** way to validate local/production parity (see quickstart.md's User Story 2 section);
  it requires `vercel link` to have been run once against your own Vercel account.
- `pnpm dev:local` — a plain `app.listen` via `tsx` on port **4001** (4000 is `server/`'s), for fast
  iteration on the Express app itself without `vercel dev`. Routes live under `/api` there too
  (`http://localhost:4001/api/health`). **Does not** exercise the Vercel rewrite/invocation model —
  never use it to validate parity with production.

## Known, documented limitations

1. **Token issuance trusts the requested owner id.** `POST /auth/token` signs a JWT for whatever
   `ownerId` it's asked for — there is no password or login behind it, because this project has no
   real authentication anywhere. What the resulting token *does* guarantee: once issued, it cannot
   be used to act as a different owner, and a request with no token (or an expired/tampered one) is
   rejected before touching any data. It does **not** stop someone who already knows another user's
   id from requesting a token for that id directly. Closing that gap would require real login across
   the whole product, which is out of scope here. See `specs/007-monorepo-vercel-blob/spec.md`
   (Assumptions) for the full writeup.
2. **Vercel Blob has no transactions.** Balance writes use an application-level optimistic-
   concurrency check (read version, write, re-check before committing) — this reduces, but does not
   eliminate, the race window between two near-simultaneous writes to the same balance. Accepted at
   this project's demo scale; see `specs/007-monorepo-vercel-blob/research.md` (D5).

## Verified during implementation (US1)

- `nx show projects` → lists `api` and `web`.
- `nx run web:typecheck` and `nx run api:typecheck` each run independently (neither triggers the other's build).
- A single `pnpm install` from the repo root installs all three workspace projects (`web`, `api`, root).

## Verifying

```sh
AUTH_JWT_SECRET=<same as the server> BASE_URL=http://localhost:3000/api pnpm smoke-test
```

Runs `scripts/smoke-test.mjs` against a running instance (`BASE_URL` defaults to
`http://localhost:4001/api`, i.e. `pnpm dev:local`; point it at `vercel dev` for full parity).
`AUTH_JWT_SECRET` is needed to mint an already-expired token for the expiry check. See
`specs/007-monorepo-vercel-blob/quickstart.md` for the full list of scenarios it covers.

## Deploying

```sh
cd apps/api
vercel link     # once, against your own Vercel account/project
vercel deploy    # preview deploy
```

Required environment variables on the Vercel project (Project Settings -> Environment Variables):
`BLOB_READ_WRITE_TOKEN`, `AUTH_JWT_SECRET`.
