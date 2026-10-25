# Implementation Plan: Perfil do colecionador que acompanha a conta

**Branch**: `014-user-profile` | **Date**: 2026-10-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/014-user-profile/spec.md`

## Summary

O perfil do colecionador (nome de exibição, bio, nome ENS com domínio, apelido da carteira e foto) passa a ser guardado
no serviço real (`apps/api`, Postgres/Prisma), por dono, e a página `/account/profile` passa a ter **duas seções
independentes**: "Dados da conta" (nome de usuário, e-mail, troca de senha, que continuam na conta simulada do site) e
"Perfil" (os dados que vão para o serviço real). A barra de navegação passa a mostrar o nome de exibição e a foto do
perfil. Segue DDD: dois contextos delimitados, **conta** (`domains/auth`, MSW `/api`) e **perfil** (`domains/profile`,
serviço real em `/backend`), sem compartilhar armazenamento. Na API, o domínio `profile` segue o padrão dos domínios
existentes (contratos Zod, porta `ProfileRepository`, adaptador Prisma, serviço, rota atrás de `requireAuth`). A foto
vira bytes no Postgres, validados pelo conteúdo, e trafega como data URL; o JSON do perfil só carrega a versão da foto,
para a barra de navegação não baixar até 1,4 MB a cada página.

**Pré-requisito de governança**: a constituição 1.8.0 não inclui `profile` nos domínios da conta do serviço real. A
emenda **1.9.0** (texto pronto em [contracts/constitution-amendment-1.9.0.md](./contracts/constitution-amendment-1.9.0.md))
é o **primeiro entregável** e bloqueia todo código (ver Constitution Check e Rollout).

## Technical Context

**Language/Version**: TypeScript ~6.0 em `apps/web` (React 19) e `apps/api` (Node, Express 5). Inalterados.

**Primary Dependencies**: as já existentes (`apps/web`: TanStack Router/Query, Axios, Zod, react-hook-form, MSW,
shadcn/ui; `apps/api`: Express, Prisma 7 com adaptador Neon, `zod`, `jsonwebtoken`). **Nenhuma dependência nova.**

**Storage**: `apps/api` → Postgres no Neon via Prisma Migrate: duas tabelas novas (`profiles`, `profile_avatars`, esta
com `BYTEA`). `apps/web` → o mock do serviço guarda em chave própria do `localStorage` (`nft-mock:backend-profile`), para
modelar um serviço separado da conta e sobreviver a recarregamentos nos testes.

**Testing**: Playwright contra os mocks (`e2e/profile/`, com axe e visuais em 390/768/1440, cenário de serviço fora do
ar), mais um roteiro de verificação da API (`scripts/profile-smoke-test.mjs`) contra uma instância real. O Playwright
**não** vai à API (constituição); logo, "outro navegador" (SC-001) é provado pelo roteiro da API e pelo quickstart manual.

**Target Platform**: SPA na Vercel (`apps/web`) e Vercel Serverless Function Express (`apps/api`).

**Project Type**: monorepo web + API (`apps/web`, `apps/api`).

**Performance Goals**: SC-001: perfil de outra sessão em ≤ 5 s depois de abrir a página; a barra de navegação não deve
atrasar a página (uma requisição leve por sessão; a foto é buscada à parte e guardada em cache por versão).

**Constraints**: `any` proibido; sem dependência nova; o dono vem só do token verificado (FR-006); a API **não** conhece
usuário, e-mail nem senha (FR-012); Playwright nunca aponta para `apps/api`; limite de corpo da API (100 kB por padrão)
precisa subir só para a rota da foto; `server/`, pedidos e catálogo intocados; fronteiras pelo `oxlint` (Princípio I).

**Scale/Scope**: 5 rotas novas na API (`GET/PUT /profile`, `GET/PUT/DELETE /profile/avatar`), 2 tabelas, 1 migração;
no web, 1 página refeita (duas seções), 1 componente de layout ajustado (barra de navegação), 1 módulo compartilhado
novo (cliente do serviço real), 2 domínios tocados (`profile` refeito, `auth` ganha a conta), 1 contexto de mock novo e
1 removido, 1 cenário novo, 1 pasta de e2e, docs.

## Constitution Check

*GATE: avaliado antes da Fase 0 e reavaliado após a Fase 1. Base: constituição **v1.8.0**.*

| Princípio / Seção | Avaliação |
|-------------------|-----------|
| I. Camadas e fronteiras | **OK.** Rota `account.profile` → página `profile` (README atualizado) → `@/domains/profile` e `@/domains/auth` pela API pública → `shared`. A página não importa outra página; o cliente do serviço real sobe para `shared/api` (não importa `domains/`, `pages/` nem `app/`). A barra de navegação (`app/layout`) usa `@/domains/profile`. |
| II. Tipagem estrita | **OK.** Contratos Zod/TS em `domains/profile/model` e `domains/auth/model`; respostas do serviço validadas na borda; sem `any`; sem valores em ETH nesta feature. |
| III. Estado remoto | **OK.** Axios + TanStack Query; chaves isoladas por usuário (`['profile', userId]`, `['profile','avatar', userId, version]`); mutations tratam carregamento, erro e sucesso e gravam o resultado no cache; repetição só em falha transitória; política de cache documentada em research D9. Nenhum filtro/paginação nesta feature. |
| IV. Tempo real | N/A. Logout e troca de usuário limpam o cache de token do serviço real (`subscribeSessionToken`) e o cache de consultas (chaves por usuário). |
| V. Mocks só na rede | **OK.** `/backend/profile*` em `mocks/contexts/profile-backend` (ligado só com `enableBackendMocks`); `/api/account*` em `mocks/contexts/auth`; nenhum dado fictício em componente. |
| VI. Acessibilidade/responsividade | **OK.** Duas seções com título, erros associados aos campos, `role="alert"` nas falhas, skeleton com shimmer ao carregar, foto com texto alternativo, 390/768/1440 sem rolagem horizontal, axe na página. |
| VII. Testes | **OK.** E2E por página (`e2e/profile/`) com falhas (serviço fora do ar, sessão expirada, formato e tamanho de foto, campos inválidos) e visuais; roteiro de verificação próprio da API; lint/typecheck/build verdes; Lighthouse conferido na página. |
| Escopo 1.8.0: segurança | **OK.** "Perfil … exige autenticação": rotas atrás de `requireAuth`; token de admin recusado com 403 nas rotas de dono. |
| Stack permitida em `apps/api` | **OK.** Express, Zod, Prisma/Neon; sem dependência nova; SQL só via Prisma Migrate (CHECKs à mão na migração, como na `0_init`). |
| **Domínios da conta (1.8.0)** | **VIOLAÇÃO CONDICIONAL.** A lista (`favorites, purchases, offers, activity, downloads, support`) não inclui `profile`, e "qualquer expansão exige nova emenda explícita". Resolvida pela emenda 1.9.0, que é o 1º entregável. |
| Fluxo: documentação | `docs/TEAMS.md`, READMEs da página e do domínio, README de `apps/api` (seção do perfil e limitação de identidade), OpenAPI da API. |

**Resultado do gate (pré-Fase 0)**: **FALHA CONDICIONADA** a uma única linha (domínios da conta). O plano prossegue porque
a correção é um entregável documental pequeno e isolado, e a **implementação fica bloqueada** até a emenda 1.9.0 estar
mergeada (tarefa de bloqueio no topo do `tasks.md`). **Pós-Fase 1**: nenhuma violação nova; o escopo da emenda ficou
restrito ao `profile` (nada de usuário, e-mail ou senha no serviço real).

## Project Structure

### Documentation (this feature)

```text
specs/014-user-profile/
├── plan.md               # este arquivo
├── research.md           # Fase 0: decisões D1–D12
├── data-model.md         # Fase 1: tabelas, contratos de tela, regras, estados
├── quickstart.md         # Fase 1: validar mocks, API real e dois navegadores
├── contracts/
│   ├── profile-endpoints.md                # serviço real: /api/profile*
│   ├── account-endpoints.md                # conta simulada: /api/account*
│   └── constitution-amendment-1.9.0.md     # texto da emenda (1º entregável)
├── checklists/requirements.md
└── tasks.md              # /speckit-tasks (não criado aqui)
```

### Source Code (repository root)

```text
.specify/memory/constitution.md          # emenda 1.9.0 (PR docs separada, ANTES do código)

apps/api/
├── prisma/
│   ├── schema.prisma                    # + models Profile, ProfileAvatar
│   └── migrations/1_profile/migration.sql   # tabelas + CHECKs à mão
├── src/
│   ├── app.ts                           # monta /profile; parser JSON de 2 MB só para /profile/avatar
│   ├── lib/errors.ts                    # erros do parser (JSON inválido 400, corpo grande 413) viram envelope
│   ├── routes/profile.ts                # requireAuth; 5 rotas finas
│   ├── domains/profile/
│   │   ├── contracts.ts                 # schemas Zod, códigos de campo, limites, detector de imagem
│   │   ├── repository.ts                # porta ProfileRepository
│   │   ├── prismaProfileRepository.ts   # adaptador (upsert, bytes da foto)
│   │   └── service.ts                   # regras; depende só da porta
│   └── openapi/{components.ts,document.ts}  # documentação gerada dos mesmos schemas
├── scripts/profile-smoke-test.mjs       # verificação da API (dois "navegadores", isolamento, validação)
├── package.json                         # + script smoke-test:profile
└── README.md                            # seção "Perfil" + limitação de identidade

apps/web/src/
├── shared/api/backend-client.ts         # NOVO: token por dono, 401 renova uma vez, erro normalizado
├── domains/
│   ├── profile/                         # REFEITO: contexto "perfil" (serviço real)
│   │   ├── model/{contracts.ts,messages.ts}   # Zod, códigos de campo → mensagens pt-BR
│   │   ├── api/profile.ts               # chamadas ao /backend/profile*
│   │   ├── hooks/                       # useProfile, useSaveProfile, useProfileAvatar, useUpdateAvatar,
│   │   │                                #   useRemoveAvatar, useProfileSummary (barra de navegação)
│   │   └── index.ts, README.md
│   ├── auth/                            # ganha o contexto "conta"
│   │   ├── model/contracts.ts           # SessionUser perde avatarUrl; + UpdateAccountRequest
│   │   ├── api/account.ts               # PATCH /api/account, POST /api/account/password
│   │   └── hooks/useAccount.ts          # useUpdateAccount, useChangePassword
│   └── admin/model/contracts.ts         # AdminUserDetail perde bio e avatarUrl
├── pages/profile/
│   ├── ProfilePage.tsx                  # compõe as duas seções
│   ├── components/{AccountSection.tsx,ProfileSection.tsx,AvatarEditor.tsx}   # ProfileForm.tsx removido
│   └── README.md
├── app/
│   ├── layout/Navbar.tsx                # foto (Avatar) + nome de exibição
│   └── routes/__root.tsx                # NavbarContainer usa useProfileSummary
└── mocks/
    ├── contexts/profile-backend/{service.ts,handlers.ts}   # NOVO: serviço do perfil (chave própria)
    ├── contexts/auth/{service.ts,handlers.ts}              # + conta (PATCH /api/account, senha)
    ├── contexts/profile/                                   # REMOVIDO (virou conta + perfil)
    ├── contexts/admin/service.ts        # detalhe do usuário sem bio/avatar
    ├── fixtures/users.ts, state.ts      # UserRecord perde bio, ENS, apelido e foto
    ├── scenarios/definitions.ts         # + cenário profile-unavailable
    └── composition.ts                   # liga os handlers novos; reset limpa o perfil
apps/web/e2e/profile/                    # NOVO: profile.spec.ts + baselines visuais
docs/TEAMS.md                            # página, domínios, módulo compartilhado novo
```

**Structure Decision**: dois contextos delimitados com dono claro (conta no `auth`, perfil no `profile`), cada um com
sua porta de rede; o que duas telas ou dois domínios usam (cliente do serviço real) sobe para `shared/api`. Em `apps/api`,
o domínio `profile` repete exatamente a divisão dos domínios existentes (contratos / porta / adaptador / serviço /
rota), para a regra de negócio ser testável sem banco e o Prisma ficar isolado no adaptador (inversão de dependência).

## Rollout

1. **PR 1 (docs)**: emenda 1.9.0 da constituição. Sem ela, nada abaixo começa.
2. **PR 2 (API)**: schema + migração + domínio + rotas + OpenAPI + roteiro de verificação + README. Compatível com o
   site atual (só acrescenta rotas).
3. **PR 3 (web)**: cliente compartilhado, domínios, página, barra de navegação, mocks, e2e, docs.
4. **Publicação (ação externa, só com confirmação)**: aplicar a migração no banco de produção, publicar a API, depois o
   site, nesta ordem (o site em produção chama o serviço real, então a API precisa estar no ar antes).

## Riscos e pontos de atenção

- **Spec × formulário atual**: o formulário hoje **exige** nome ENS e apelido da carteira; a spec os trata como
  opcionais (nome ENS vazio permitido; "demais campos vazios" no primeiro acesso). O plano segue a spec e relaxa o
  formulário (research D7).
- **Limitação de identidade herdada**: `POST /auth/token` confia no identificador pedido; o perfil de alguém que
  conheça o identificador de outra conta pode ser lido e alterado. Documentar no README de `apps/api`, sem nunca
  apresentar como proteção completa.
- **Dependência da 015**: a 015 (ainda sem plano) vai precisar do mesmo cliente do serviço real. Este plano cria o
  módulo compartilhado; a 015 deve reutilizá-lo (se a 015 chegar antes com cliente próprio, trocar na integração).
- **Limite de corpo**: o parser global rejeita corpos acima de 100 kB; sem o parser específico, nenhuma foto seria
  salva. Coberto pelo roteiro da API (foto de ~1 MB aceita, de 1 MB + 1 recusada).
- **Dados antigos**: perfis salvos no `localStorage` do mock não são migrados (decisão da spec); registros antigos
  mantêm campos soltos que o código ignora, e por isso o esquema persistido do mock **não** muda de versão.

## Complexity Tracking

| Violação | Por que é necessária | Alternativa mais simples rejeitada porque |
|----------|----------------------|-------------------------------------------|
| `profile` fora da lista de domínios da conta da constituição 1.8.0 | O objetivo da feature é o perfil acompanhar a conta em qualquer navegador, e só o serviço real guarda dados por dono fora do navegador | Manter o perfil no mock não entrega a feature; guardar no `server/` ou no Blob contraria as exceções vigentes (`server/` não pode ser tocado; dados estruturados vão para o Postgres) |
| Módulo compartilhado novo `shared/api/backend-client.ts` | Perfil e 015 precisam do mesmo token por dono, renovação em 401 e erro normalizado | Copiar o cliente de `domains/ledger` repete ~80 linhas de lógica de token e já seria a terceira cópia com a 015; migrar o `ledger` agora arriscaria regressão em moedas, então ele fica como está |
