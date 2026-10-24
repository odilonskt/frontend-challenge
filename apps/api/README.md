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

1. **O Blob não é armazenamento privado.** Este SDK só grava com `access: "public"`; o registro do admin
   (e-mail + hash scrypt com salt) fica numa URL pública de CDN. O hostname do store não é adivinhável e a
   senha nunca é gravada em claro, mas quem obtiver essa URL pode tentar quebrar o hash offline. Uma senha
   fraca cai rápido nesse cenário: use uma senha longa e única. Para guardar credenciais de verdade, o
   caminho certo é um armazenamento privado (banco), o que é outra decisão de arquitetura.
2. **Sem limite de tentativas de login.** Não há rate limit nem bloqueio por tentativas em `/admin/login`
   (função serverless sem estado). A defesa atual é o custo do scrypt e a resposta idêntica para e-mail
   desconhecido e senha errada.
3. **`/auth/token` aceita `ownerId` com `/`.** Isso pode fazer o prefixo de um dono colidir com o de outro
   nas listagens do Blob; as rotas de admin validam o `ownerId`, mas a emissão de token de dono ainda não.

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
3. **A tight burst of same-IP requests to the Blob CDN domain can trigger Vercel's own bot/abuse
   challenge, not an application bug.** Confirmed by direct testing against a real store: a public
   blob URL (`*.public.blob.vercel-storage.com`) occasionally returns a transient `403` for a few
   hundred ms right after `put()` (the edge hasn't replicated the write yet — `blobStore.ts`'s
   `fetchJson` retries a handful of times for exactly this case). Separately, and not fixable by
   retrying, a *sustained burst* of many concurrent requests to the same pathname from one IP (e.g.
   this repo's own smoke test's 50-concurrent-top-ups check, or a diagnostic hitting the balance URL
   directly) can trip Vercel's edge security layer: the CDN responds with `403`, `Retry-After: 30`,
   and `x-vercel-mitigated: challenge`, serving an HTML "Vercel Security Checkpoint" page instead of
   the blob. No server-side retry can solve that page (it expects a browser), so once triggered the
   request genuinely fails until the window passes. This was reproducible from this project's own
   sandboxed test environment at concurrency as low as ~8; real end users spread across many
   distinct IPs are far less likely to trigger it than a single script firing 50 requests from one
   IP, but if you see `500 blob_read_failed` under real concurrent load, check the response headers
   for `x-vercel-mitigated` before assuming a data bug — and note that every failure observed this
   way was a clean, visible `500` (the request was rejected outright), never a silently wrong
   balance (no lost update was ever observed in the requests that *did* succeed).

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
vercel link      # once, against your own Vercel account/project
vercel deploy    # preview deploy
vercel --prod    # promote to production (nft-marketplace-api-ochre.vercel.app)
```

Required environment variables on the Vercel project (Project Settings -> Environment Variables):
`BLOB_READ_WRITE_TOKEN`, `AUTH_JWT_SECRET`.

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
