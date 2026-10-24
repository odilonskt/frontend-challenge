# Implementation Plan: Back-end de produção (`apps/api`) funcionando de verdade

**Branch**: `010-api-production-backend` | **Date**: 2026-10-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/010-api-production-backend/spec.md`

## Summary

Três defeitos reais, uma causa comum no terceiro e no segundo: o Vercel Blob **não é um banco**. Ele não tem
escrita condicional atômica (o saldo perde atualizações: 12 → 4 medido) e só serve objetos por URL pública
(o hash do admin fica legível). O plano troca o armazenamento por **Postgres hospedado (Neon, via Vercel
Marketplace)** acessado pelo driver `pg` atrás de repositórios (portas), mantendo o contrato HTTP. A atomicidade
vem de **uma única instrução SQL** (CTE que atualiza o saldo com guarda `saldo + valor >= 0` e insere a
transação no mesmo comando), e a idempotência de uma chave única `(dono, chave)`. O deploy volta a funcionar
com a configuração já escrita (`framework: null`, `buildCommand: ""`), promovida a produção e verificada por um
script único que também prova concorrência (50 operações) e negação de leitura pública. Pré-requisito
documentado: **emenda constitucional v1.5.0** (a exceção `apps/api` hoje fixa o Blob e proíbe banco relacional).

## Technical Context

**Language/Version**: TypeScript ~6.0, Node 24 (projeto Vercel `24.x`), Express 5 (inalterados).

**Primary Dependencies**: adiciona `pg` (+ `@types/pg`); remove `@vercel/blob`. Mantém `express`, `cors`, `zod`,
`jsonwebtoken`, `oxlint`, `tsx`.

**Storage**: PostgreSQL gerenciado (Neon, integração do Vercel Marketplace → `DATABASE_URL` com *pooler*);
desenvolvimento local com Postgres em Docker (paridade de SQL). Migrações como arquivos `.sql` versionados.

**Testing**: scripts de verificação executáveis contra qualquer `BASE_URL` (padrão já usado:
`smoke-test.mjs`, `admin-smoke-test.mjs`) unificados em `verify-deploy.mjs` (FR-012), mais testes de repositório
contra o Postgres local; e2e do `apps/web` inalterado (roda contra mocks).

**Target Platform**: Vercel Serverless Functions (Node), projeto `nft-marketplace-api`, domínio
`nft-marketplace-api-teal.vercel.app`.

**Project Type**: web-service dentro do monorepo pnpm+Nx (alvo: `apps/api`).

**Performance Goals**: SC-006 — 95% das requisições comuns ≤ 2 s em produção, inclusive a primeira após
inatividade em ≥ 90% das vezes.

**Constraints**: contrato HTTP inalterado (FR-014; só um cabeçalho opcional novo); `server/` e `apps/web`
intocados (FR-015); nenhum segredo em arquivo versionado (FR-010); uma conexão por instância e sem
*prepared statements* nomeados (compatível com *pooler* em modo transação).

**Scale/Scope**: demo; dezenas de donos, 50 operações concorrentes por saldo no teste de aceitação. ~12 arquivos
em `apps/api`, 1 migração, 3 scripts, 1 emenda constitucional, documentação.

## Constitution Check

*GATE: avaliado antes da Fase 0 e reavaliado após a Fase 1. Base: constituição v1.4.0.*

| Princípio / Seção | Avaliação |
|-------------------|-----------|
| I. Camadas e fronteiras | N/A para `apps/web` (não muda). Em `apps/api` aplica-se a orientação do projeto (SOLID/DDD): rotas → serviços → repositórios (porta + adaptador `pg`); serviços não conhecem SQL. |
| II. Tipagem estrita | OK. Sem `any`; linhas do banco validadas com Zod na borda do repositório (dado externo); valores monetários inteiros (`bigint` no banco, `number` seguro validado). |
| III–VII (SPA) | N/A: a feature não altera o comportamento do `apps/web`; o e2e continua contra mocks (SC-008). |
| Exceção `apps/api` (1.4.0): "Nenhum driver de banco relacional é introduzido" e "persiste via Vercel Blob" | **VIOLAÇÃO.** Atender FR-004/FR-008 exige banco relacional. Tratada por **emenda 1.5.0** (ver Complexity Tracking), entregue como a primeira tarefa e MUST ser aprovada antes de qualquer código de armazenamento. |
| Exceção `apps/api` (1.4.0): administradores (hash salgado, token de admin, login indistinguível, `/admin/*` somente leitura) | OK, preservada integralmente (FR-009). A "limitação assumida" do hash em armazenamento público **é removida** pela emenda, pois deixa de valer. |
| Exceção `server/` (1.1.0) | OK. `server/` não é tocado (FR-015). |
| Fluxo: estrutura/comportamento | Atualizar `apps/api/README.md`, `apps/api/.env.example`; registrar a emenda e o Sync Impact Report na constituição. Sem mudança em `docs/TEAMS.md` (estrutura do `apps/web` igual). |

Pós-Fase 1: sem novas violações; a única é justificada e tem caminho de resolução.

## Project Structure

### Documentation (this feature)

```text
specs/010-api-production-backend/
├── plan.md                         # este arquivo
├── research.md                     # Fase 0 — decisões D1-D10
├── data-model.md                   # Fase 1 — tabelas, invariantes, migração
├── quickstart.md                   # Fase 1 — implantar, verificar, reverter
├── contracts/
│   ├── api-delta.md                # Fase 1 — o que NÃO muda no contrato HTTP + Idempotency-Key
│   └── verification-suite.md       # Fase 1 — checagens de verify-deploy (FR-012)
├── checklists/requirements.md
└── tasks.md                        # gerado por /speckit-tasks
```

### Source Code (repository root)

```text
apps/api/
├── vercel.json                          # framework:null, buildCommand:"" (já escrito; só falta implantar)
├── package.json                         # + pg, @types/pg, scripts db:migrate / verify:deploy; − @vercel/blob
├── .env.example                         # DATABASE_URL no lugar de BLOB_READ_WRITE_TOKEN
├── db/
│   └── migrations/
│       └── 001_init.sql                 # owners_balance, coin_transactions, admins (+ CHECK, UNIQUE)
├── scripts/
│   ├── migrate.ts                       # aplica db/migrations em ordem, idempotente
│   ├── seed-admin.ts                    # (existe) passa a gravar via repositório pg
│   ├── smoke-test.mjs                   # (existe) mantido
│   └── verify-deploy.mjs                # novo: suíte completa FR-012 contra BASE_URL
└── src/
    ├── lib/
    │   ├── db.ts                        # novo: Pool do pg (max 1/instância), falha rápida sem DATABASE_URL
    │   └── blobStore.ts                 # REMOVIDO
    ├── domains/
    │   ├── coins/
    │   │   ├── contracts.ts             # + IdempotencyConflictError (mantém o resto)
    │   │   ├── repository.ts            # novo: porta CoinsRepository + adaptador PgCoinsRepository
    │   │   └── service.ts               # usa a porta; sem laço de retry (atomicidade no SQL)
    │   └── admin/
    │       ├── repository.ts            # novo: porta AdminRepository + adaptador pg
    │       └── service.ts               # usa a porta
    └── routes/
        ├── coins.ts                     # lê Idempotency-Key opcional; 409 só p/ chave reutilizada com outro valor
        └── health.ts                    # health passa a checar também o banco (SELECT 1)

.specify/memory/constitution.md          # emenda 1.5.0 (T001)
```

**Structure Decision**: a mudança fica em `apps/api`; as portas `CoinsRepository`/`AdminRepository` isolam o
SQL para que o serviço e as rotas não saibam qual banco existe (princípio de inversão de dependência pedido no
projeto) e para testar o serviço com um repositório em memória. O SQL de atomicidade vive **só** no adaptador.
`apps/web` e `server/` não entram na lista.

## Complexity Tracking

| Violação | Por que é necessária | Alternativa mais simples rejeitada porque |
|----------|----------------------|-------------------------------------------|
| Banco relacional em `apps/api` (emenda 1.5.0) | Só um armazenamento com escrita atômica e acesso privado atende FR-004 e FR-008. | **Derivar o saldo do log no Blob**: resolve a perda de atualização, mas deixa o admin em URL pública e a listagem por prefixo continua eventualmente consistente — não atende FR-008 nem SC-004. **Manter Blob + mais retries**: a perda vem de leitura obsoleta no CDN, não de falta de tentativas; já medido. |

## Riscos e dependências

| Risco | Efeito | Tratamento |
|---|---|---|
| Emenda constitucional não aprovada | Bloqueia toda a troca de armazenamento | T001 é a primeira tarefa e porta de entrada; sem aprovação, só US1 (deploy) segue |
| Provisionar Neon exige ação na conta do usuário (Marketplace) | US2/US3 não rodam em produção | Quickstart passo 1; tarefa marcada "precisa de confirmação" como nas 008 |
| Conexões em funções serverless (esgotar o banco) | Erros intermitentes sob a rajada de 50 | `pg` com `max: 1` por instância + URL do *pooler*; teste de 50 operações no verify-deploy |
| Proteção anti-bot da plataforma recusa rajada do mesmo IP | Falso negativo no teste de concorrência | verify-deploy distingue "recusada pela plataforma" de "aceita e perdida"; com o banco, o CDN do Blob sai do caminho |
| Cold start | SC-006 | Uma conexão por instância, SQL simples; medir no verify-deploy |
