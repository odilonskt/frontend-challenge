# Quickstart: back-end em produção

Guia de implantação e validação (não é guia de implementação; ver `tasks.md`). Contratos:
`contracts/api-delta.md`, `contracts/verification-suite.md`; tabelas: `data-model.md`.

## Pré-requisitos

- Node 24, pnpm, Docker (Postgres local), `vercel` CLI autenticada (`vercel whoami`).
- Emenda constitucional 1.5.0 aprovada (sem ela, só o passo 5 — deploy corrigido — pode seguir).
- Acesso à conta Vercel para adicionar a integração de Postgres (Neon).

## 1. Banco local e migração

```sh
docker run --name nft-pg -e POSTGRES_PASSWORD=dev -p 5432:5432 -d postgres:16
cp apps/api/.env.example apps/api/.env.local   # DATABASE_URL=postgres://postgres:dev@localhost:5432/postgres
pnpm --dir apps/api db:migrate
```

Esperado: `001_init.sql` aplicada; repetir o comando não faz nada.

## 2. Verificação local (sem Vercel)

```sh
pnpm --dir apps/api dev:local            # http://localhost:4001/api
ADMIN_EMAIL=voce@exemplo.com ADMIN_PASSWORD='<senha longa e nova>' pnpm --dir apps/api seed:admin
BASE_URL=http://localhost:4001/api AUTH_JWT_SECRET=<o mesmo> pnpm --dir apps/api verify:deploy
```

Esperado: todas as 14 checagens `✓`; concorrência com **zero** atualizações perdidas.

## 3. Provisionar o banco na Vercel (precisa de confirmação)

Projeto `nft-marketplace-api` → Storage → adicionar **Neon Postgres** (Marketplace), um ramo para *preview* e um
para *production*. A integração injeta a URL de conexão; confirmar que é a do *pooler* e que a variável se
chama `DATABASE_URL` (renomear se vier como `POSTGRES_URL`).

```sh
cd apps/api
vercel env ls
printf '%s' "$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")" | vercel env add AUTH_JWT_SECRET production
# repetir para preview com OUTRO valor
```

## 4. Migrar e criar o admin em cada ambiente

```sh
vercel env pull .env.production.local --environment=production   # arquivo fora do Git (*.local)
DATABASE_URL=<producao> pnpm --dir apps/api db:migrate
DATABASE_URL=<producao> ADMIN_EMAIL=... ADMIN_PASSWORD='<nova>' pnpm --dir apps/api seed:admin
```

Use uma **senha nova** (a antiga esteve legível no Blob público). Apague `.env.production.local` depois.

## 5. Implantar preview e verificar

```sh
cd apps/api
vercel deploy                                    # usa framework:null + buildCommand:"" do vercel.json
BASE_URL=https://<preview>.vercel.app/api PROTECTION_BYPASS=<segredo> AUTH_JWT_SECRET=<preview> \
  pnpm verify:deploy
```

Esperado: `GET /api/health` = `200`; todas as checagens `✓`. Se `/api/*` voltar `404` da plataforma, o preset
de framework do projeto sobrescreveu o `vercel.json` (ver `apps/api/README.md`, "Deploying").

## 6. Promover a produção e verificar o alias

```sh
vercel deploy --prod        # ou: vercel promote <url-do-preview>
BASE_URL=https://nft-marketplace-api-ochre.vercel.app/api AUTH_JWT_SECRET=<producao> pnpm verify:deploy
```

Esperado: 14 de 14 checagens; p95 ≤ 2 s (SC-006).

## 7. Cadeia ponta a ponta pelo site (FR-003)

```sh
BASE_URL=https://nft-marketplace-web-wheat.vercel.app/backend AUTH_JWT_SECRET=<producao> pnpm --dir apps/api verify:deploy
```

Esperado: `GET /backend/health` = `200` da API real. Isso destrava a US2 da 008 (T014): marque-a como concluída
em `specs/008-web-production-env/tasks.md`.

## 8. Concorrência repetida (SC-002)

```sh
BASE_URL=... AUTH_JWT_SECRET=... pnpm --dir apps/api verify:deploy -- --repeat 10
```

Esperado: 10 de 10 sem atualização perdida.

## 9. Reverter uma implantação ruim

```sh
vercel rollback                    # volta ao deploy de produção anterior; o banco não é tocado
```

Migrações são aditivas; não há reversão de dados nesta feature. Se a falha for de dados, restaurar o ramo do
banco (ponto no tempo do Neon).

## 10. Limpeza do armazenamento antigo (depois de verificar)

Apagar os objetos do store de Blob e removê-lo se nada mais o usa; remover `BLOB_READ_WRITE_TOKEN` das
variáveis do projeto. Confirmar que nenhuma URL antiga de admin responde.
