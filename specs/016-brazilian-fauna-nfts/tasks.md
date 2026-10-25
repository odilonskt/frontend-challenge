---

description: "Task list for 016-brazilian-fauna-nfts"
---

# Tasks: Coleção "Fauna Brasileira" — NFTs de animais brasileiros

**Input**: Design documents from `/specs/016-brazilian-fauna-nfts/`

**Prerequisites**: plan.md, spec.md, research.md (D1–D11), data-model.md, quickstart.md. Não há `contracts/` (a feature não cria interface).

**Tests**: Incluídos. A constituição (Princípio VII) exige E2E Playwright por página contra os mocks, com visuais; SC-001 a SC-009 só se provam com testes e com revisão visual da arte.

**Organization**: Tarefas agrupadas por história de usuário (spec.md US1–US3). Os dados e a arte são a fundação das três.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência de tarefa incompleta)
- **[Story]**: US1–US3 da spec.md
- Todos os caminhos são relativos à raiz do repositório.

## Regras que valem para todas as tarefas

- **Sem `any`** em TypeScript. **Nada** em `apps/api`, `server/` nem `apps/web/src/domains/` muda nesta feature; a página, a rota e o domínio de catálogo continuam como estão.
- Tudo o que a feature toca fica em `apps/web/src/mocks/`, `apps/web/public/art/`, `apps/web/scripts/`, `apps/web/e2e/`, `apps/web/package.json` e `docs/`.
- Arquivos que duas tarefas editam (`fauna-art.mjs`, `fauna.spec.ts`, `nfts.ts`) são editados **em sequência**, nunca em paralelo.
- **Arte**: a revisão visual de cada lote é parte da tarefa. Se um animal não for reconhecível sem legenda, **refaça o desenho** antes de seguir; não relaxe o critério (SC-008).

## Path Conventions

Tudo em `apps/web/` mais `docs/TEAMS.md` e `specs/016-brazilian-fauna-nfts/`.

---

## Phase 1: Setup

- [X] T001 (2026-10-25: linha de base 230 testes em 30 arquivos, 153 arquivos de arte, checklist 16/16, typecheck limpo) Confirmar que a branch é `016-brazilian-fauna-nfts` (saída de `origin/main`, com a constituição 1.9.0 e a spec 014 já nela), `pnpm install` na raiz e `pnpm typecheck` e `pnpm lint` limpos. Guardar a linha de base de `pnpm --dir apps/web exec playwright test --list | tail -1` (a contagem de testes antes da feature) e conferir que `apps/web/public/art` tem 153 arquivos (`nft-001…048-{1,2,3}.svg`, `artist-1…8.svg`, `avatar-ana.svg`)
- [X] T002 (2026-10-25: `OLD_CATALOG_SHA256` = `b17c7b5bee628a3c6bd0b28954b28462b8717bfd988babb9c8e4f3e4a4831222`, igual em duas rodadas; `OLD_CREATOR_COUNTS`: 8 criadores, todos com 6 NFTs: art_orbitian, art_moondancer, art_nebulakid, art_animakid, art_robotica, art_keepitreal, art_dishamodi, art_ghiblier) **Capturar o hash dos 48 NFTs atuais, ANTES de mexer em qualquer fixture** (SC-005). Criar um spec descartável `apps/web/e2e/fauna/_capture.spec.ts` que abre `/`, busca `GET /api/nfts/nft_001` … `nft_048` com `fetch` dentro da página (o catálogo é respondido pelo MSW no navegador), junta os 48 JSONs numa lista em ordem de id e imprime o SHA-256 de `JSON.stringify(lista)`. No mesmo spec descartável, ler também `GET /api/creators` e imprimir a lista `{ id, nftCount }` dos **8 criadores atuais** (ela vira a constante `OLD_CREATOR_COUNTS` da T020). Rodar uma vez, **anotar o hash e a lista** (o hash vira a constante `OLD_CATALOG_SHA256` da T013) e **apagar o spec**. Depende de T001

---

## Phase 2: Foundational (bloqueia as três histórias)

**Purpose**: a arte, o gerador e os dados dos 12 animais. Nada aparece no site ainda: o `buildNftFixtures()` só é ligado na T014.

- [X] T003 [P] (2026-10-25: o hash dos 48 ficou idêntico depois do refactor) Em `apps/web/src/mocks/fixtures/edition-templates.ts` (novo) mover `EDITION_TEMPLATES` de `apps/web/src/mocks/fixtures/nfts.ts` **sem mudar nenhum valor** (Standard `multiplier '1'`, `supply 25`, `maxPerOrder 5`; Rare `'2.5'`, `8`, `2`; Legendary `'6'`, `1`, `1`) e fazer o `nfts.ts` importá-lo (evita import circular quando `fauna.ts` entrar). `pnpm typecheck` limpo. **Provar que nada mudou**: repetir a captura da T002 (mesmo spec descartável, de novo, e apagá-lo) e conferir que o hash é idêntico
- [X] T004 [P] (2026-10-25) Em `apps/web/src/mocks/infra/store.ts` dar ao `Store` um terceiro parâmetro **opcional** `migrate?: (loaded: TState) => TState`, aplicado **só** ao estado vindo de `persistence.load()` (nunca ao estado inicial). Sem o parâmetro, o comportamento é exatamente o atual. `pnpm typecheck` limpo; os outros usos de `new Store(...)` (por exemplo `mocks/contexts/ledger/service.ts`) não mudam
- [X] T005 (2026-10-25: o `horizon` é passado à parte porque a paleta não o tem) Criar `apps/web/src/mocks/infra/fauna-art.mjs` (JS puro, como `placeholder-art.mjs`; **sem texto** dentro do desenho): (a) paletas dos 4 biomas, **Pantanal, Amazônia, Cerrado e Mata Atlântica**, cada uma com céu (topo e base do degradê), sol, chão e água, em versão dia e versão entardecer; (b) `scene(biome, mood)` que desenha céu em degradê, sol, o chão ou a água do bioma e uma vegetação de fundo simples, em 600×600; (c) o construtor de vistas `faunaTile(slug, view)` com `view` ∈ `1 | 2 | 3`: **1** cena completa, **2** a mesma cena com o `viewBox` recortado no `focus` do animal (o SVG continua `width="600" height="600"`), **3** a mesma cena com o céu e o sol do entardecer e uma sobreposição translúcida escura sobre tudo; (d) a lista exportada `FAUNA` com, para cada um dos 12 animais, `{ slug, biome, focus: { x, y, width, height }, draw }`, na **ordem da tabela de data-model.md** (Onça-Pintada primeiro), com `draw` ainda devolvendo um retângulo provisório. Sem estado global e **sem `Math.random`**: tudo determinístico
- [X] T006 (2026-10-25: aceita `--only=`, `--size=` e `--out=`) Criar `apps/web/scripts/fauna-contact-sheet.mjs` e o script `"fauna:contact-sheet"` em `apps/web/package.json`: abre o Chromium do Playwright (`chromium` de `@playwright/test`, como `scripts/lighthouse.mjs`), monta uma página HTML com as **36 vistas** (12 linhas, uma por animal, com a vista 1, 2 e 3 lado a lado, cada vista com o nome do animal escrito **fora** do desenho) e grava `apps/web/test-results/fauna-contact-sheet.png` (a pasta já é ignorada pelo git). É a ferramenta de revisão visual das T007–T010. Depende de T005
- [X] T007 (2026-10-25: onça e mico-leão reconhecíveis de primeira; a faixa do tamanduá foi estendida em diagonal) Desenhar, em `apps/web/src/mocks/infra/fauna-art.mjs`, o primeiro lote: **Onça-Pintada** (corpo dourado, rosetas escuras com miolo claro, cabeça larga, cauda longa; Pantanal, água rasa e aguapés), **Mico-Leão-Dourado** (pelagem alaranjada, juba em volta do rosto escuro, cauda longa; Mata Atlântica, folhagem) e **Tamanduá-Bandeira** (focinho longo e fino, faixa preta e branca no ombro, cauda enorme e peluda; Cerrado, capim e cupinzeiro), cada um com o `focus` do rosto da tabela de [data-model.md](./data-model.md). Rodar `pnpm --dir apps/web fauna:contact-sheet`, **olhar a imagem** e refazer o que não for reconhecível sem legenda. Depende de T005, T006
- [X] T008 (2026-10-25) Desenhar o segundo lote em `fauna-art.mjs`: **Lobo-Guará** (pernas muito longas e escuras, pelagem avermelhada, orelhas grandes, crina negra; Cerrado, capim alto), **Capivara** (corpo em barril marrom, focinho rombudo, orelhas pequenas; Pantanal, margem e água) e **Bicho-Preguiça** (pendurada de cabeça para cima num galho, máscara facial escura, garras longas; Mata Atlântica). Folha de contato e revisão como na T007. Depende de T007
- [X] T009 (2026-10-25) Desenhar o terceiro lote em `fauna-art.mjs`: **Arara-Azul** (corpo azul-cobalto, face amarela ao redor do bico preto curvo, cauda longa e pontuda; Pantanal, palmeira), **Tucano-Toco** (corpo preto, papo branco, bico laranja enorme com mancha preta na ponta; Cerrado, galho; o `focus` pega o bico inteiro) e **Ararajuba** (plumagem amarelo-dourada, asas verdes, bico claro; Amazônia, copa de árvore). Folha de contato e revisão. Depende de T008
- [X] T010 (2026-10-25: o rio da Amazônia virou verde-escuro, porque o marrom se lia como chão; folha de contato das 12 linhas revisada; a vista 1 do jacaré é a composição mais fraca, mas o animal é identificável) Desenhar o quarto lote em `fauna-art.mjs`: **Boto-Cor-de-Rosa** (corpo rosa, focinho comprido e fino, nadadeira dorsal baixa; Amazônia, rio e mata ao fundo), **Jacaré-do-Pantanal** (focinho longo, dorso com placas, olhos e narinas à flor d'água; Pantanal) e **Peixe-Boi-da-Amazônia** (corpo cinza arredondado, cauda em pá, focinho curto com bigodes; Amazônia, rio). Folha de contato com **as 12 linhas** e revisão final: cada animal reconhecível sem legenda e as 3 vistas do mesmo animal (SC-008). Se algum falhar, refazer. Depende de T009
- [X] T011 (2026-10-25: 2 execuções idênticas, 37 arquivos, o maior com 6,6 KB, os 153 antigos intactos) Criar `apps/web/scripts/generate-fauna-art.mjs` e o script `"generate:fauna-art": "node scripts/generate-fauna-art.mjs"` em `apps/web/package.json`: para cada animal de `FAUNA`, índice `i` de 0 a 11 e `NN = 49 + i`, escreve `public/art/nft-0NN-1.svg`, `-2.svg` e `-3.svg` com `faunaTile(slug, view)`, e escreve `public/art/artist-9.svg` com `avatar(90_009, 'FV')` importado de `src/mocks/infra/placeholder-art.mjs` (o mesmo gerador dos 8 avatares atuais). **Não** alterar `scripts/generate-art.mjs`. Rodar duas vezes e provar que é determinístico (`git diff --exit-code apps/web/public/art` depois da segunda rodada), conferir que há **37** arquivos novos e que **cada SVG tem poucos KB** (anotar o maior; a home carrega 12 por página). Depende de T010
- [X] T012 (2026-10-25) Criar `apps/web/src/mocks/fixtures/fauna.ts` com `buildFaunaFixtures(): Nft[]`, que devolve os 12 `Nft` **exatamente como em [data-model.md](./data-model.md)**: ids `nft_049` a `nft_060` na ordem da tabela; `name` com 3 a 60 caracteres (o mais longo, "Peixe-Boi-da-Amazônia", tem 21); `category` só `art` ou `collectibles`, alternadas como na tabela; `artist` `{ id: 'art_faunaviva', name: 'Fauna Viva', avatarUrl: '/art/artist-9.svg' }`; `collection: 'Fauna Brasileira'`; `version: 1`; `featured: true` **só** na Onça-Pintada; `createdAt` = `2026-01-16T12:00:00.000Z` menos `i` horas; `tags` da tabela; `description` verbatim da tabela de descrições (**sem** "on-chain" nem números de população); `image` e `gallery` com os 3 caminhos e os textos alternativos `"<Nome>, obra digital de Fauna Viva"`, `"<Nome>, detalhe do rosto"` e `"<Nome> ao entardecer"`, 600×600; edições a partir de `EDITION_TEMPLATES` (T003) com `price = base × multiplier` por `decimal.js` e `toFixed(18)`, `supply` 25/8/1, `maxPerOrder` 5/2/1, `available` = os valores Std/Rare/Leg da tabela, `status: 'available'`, `id` `nft_0NN_standard|rare|legendary`; `priceFrom` e `totalAvailable` de `derivePricing` (`mocks/contexts/catalog/pricing.ts`). Dados explícitos: **sem** `createRandom`. `pnpm typecheck` limpo. Depende de T003, T011

**Checkpoint**: a arte existe, é reprodutível e reconhecível; os dados dos 12 estão prontos e tipados; nada aparece no site ainda.

---

## Phase 3: User Story 1 — Encontrar a coleção e conhecer os animais (Priority: P1) 🎯 MVP

**Goal**: os 12 animais aparecem na primeira página do catálogo da home, na busca e no Mercado, e quem já abriu o site também os recebe.

**Independent Test**: abrir a home e ver os 12 na primeira página; buscar "onça" e "Fauna Brasileira"; percorrer as 5 páginas e ver 60 distintos; abrir o Mercado e ver a Onça-Pintada em "Em alta" e "Fauna Brasileira" em "Coleções".

### Tests for User Story 1 (escrever primeiro e ver falhar)

- [ ] T013 [US1] Criar `apps/web/e2e/fauna/fauna.spec.ts` (helpers de `apps/web/e2e/design-system/helpers.ts`: `selectScenario`, `runAxe`, `hasNoHorizontalScroll`, `VIEWPORTS`), constante `OLD_CATALOG_SHA256` com o hash da T002: (a) a primeira página do catálogo da home, em "Mais recentes", tem **exatamente** os 12 animais, na ordem `nft_049` a `nft_060` (conferir por `GET /api/nfts?sort=recent&pageSize=12` e pelos nomes nos cartões da página); (b) a paginação tem **5 páginas** (existe o botão "Página 5" e não existe "Página 6") e, percorrendo `GET /api/nfts?pageSize=12&page=1…5`, aparecem **60 ids distintos**, 12 por página (SC-006); (c) busca por cada um dos 12 nomes, **com acento, sem acento e em maiúsculas** (`onça`, `onca`, `ONÇA`, `tamandua`, `peixe-boi`…), devolve o animal (SC-002), e `q=Fauna Brasileira` devolve exatamente os 12 e nenhum dos antigos; (d) o Mercado (`/market`): "Em alta" tem a Onça-Pintada e tem 4 cartões, "Coleções" tem o cartão "Fauna Brasileira" e clicar nele leva a `/?q=Fauna%20Brasileira` com os 12 na grade; (e) o hero da home continua com a imagem `/art/nft-001-1.svg` (FR-009); (f) filtros e ordenações existentes respondem aos novos: `category=art` inclui só animais `art` entre os novos, `sort=price_asc` e `sort=name_asc` os colocam na ordem certa, `availability=available` mantém os 12; (g) **nenhuma imagem do catálogo falha**: para os 60 NFTs, `GET /api/nfts/<id>` e cada `image.src` e `gallery[].src`, mais os avatares dos criadores, respondem `200` com `image/svg+xml` (`page.request.get`, SC-004); (h) os **48 antigos idênticos**: o SHA-256 do JSON de `GET /api/nfts/nft_001…048` (como na T002) é `OLD_CATALOG_SHA256` (SC-005); (i) **estado antigo recebe a coleção**: abrir o site, tirar `nft_049…060` de `state.nfts` no `localStorage['nft-mock:state']`, recarregar, e conferir que os 12 voltaram, que um usuário criado antes e um item no carrinho continuam, e que um NFT dos antigos cujo estoque foi mexido **não** foi restaurado; (j) com `selectScenario(page, 'server-error')` o catálogo mostra o estado de erro de sempre (nada da coleção quebra isso); (k) as descrições dos 12 não contêm "on-chain" nem "blockchain" (FR-003)
- [ ] T014 [US1] Em `apps/web/src/mocks/fixtures/nfts.ts`, fazer `buildNftFixtures()` devolver os 48 de sempre **seguidos** de `buildFaunaFixtures()` (T012): 60 no total. `NFT_COUNT` continua 48 (é o dos placeholders). O `createRandom` **não** pode ser consumido pelos novos. Depende de T012
- [ ] T015 [US1] Reconciliação do estado persistido (research D2): em `apps/web/src/mocks/state.ts`, criar `addMissingCatalogNfts(state: MockState): MockState`, que para cada NFT de `buildNftFixtures()` cujo `id` **não** está em `state.nfts` o acrescenta ao fim e devolve o mesmo estado, **sem tocar** em nenhum NFT presente (estoque, edições, `featured`), em `delistedNftIds`, usuários, sessões, carrinhos, carteiras, pedidos nem favoritos; passá-la como 3º argumento (`migrate`, T004) ao `new Store<MockState>(...)`. **Não** mudar `SCHEMA_VERSION`. Comentar o porquê (os fixtures são só o estado inicial; sem isto quem já abriu o site não veria a coleção). Depende de T004, T014
- [ ] T016 [US1] Rodar `pnpm typecheck`, `pnpm lint` e `pnpm --dir apps/web exec playwright test e2e/fauna`: os testes da T013 passam. Depois, as pastas cujas baselines o relatório prevê que mudam (`e2e/home`, `e2e/market`, `e2e/cart`) devem falhar **só** nas imagens (e nos contadores esperados, por exemplo o "Em alta" com 4); **ler cada diff** e confirmar que a mudança é a esperada (grade da home com a coleção, "Em alta" e "Coleções" com a Onça-Pintada e a Fauna Brasileira, "Colecionadores também viram" no carrinho com 4) e nada mais. Depende de T013–T015
- [ ] T017 [US1] Atualizar as baselines `home-390/768/1440`, `market-390/768/1440` e `cart-390/768/1440` com `--update-snapshots`, **abrir e revisar cada uma das 9 imagens** (os 12 animais legíveis nos cartões, sem corte nem estouro de nome longo, "Fauna Brasileira" no Mercado) e repetir `e2e/home e2e/market e2e/cart e2e/fauna` **duas vezes** sem a flag: tudo verde. Se algum teste de `e2e/home`, `e2e/market` ou `e2e/cart` falhar por motivo que não seja imagem, parar e entender antes de seguir. Depende de T016

**Checkpoint**: US1 funciona; a coleção está no catálogo, na busca e no Mercado, e o estado antigo a recebe.

---

## Phase 4: User Story 2 — Conhecer um animal e comprar uma edição (Priority: P2)

**Goal**: o detalhe de um animal mostra a galeria de 3 imagens, a descrição e as 3 edições, e a compra usa o fluxo atual.

**Independent Test**: abrir o detalhe da Onça-Pintada, ver 3 imagens e 3 edições, adicionar uma edição ao carrinho e chegar ao checkout.

### Tests for User Story 2 (escrever primeiro e ver falhar)

- [ ] T018 [US2] Acrescentar a `apps/web/e2e/fauna/fauna.spec.ts` (helpers `createOrderViaApi`, `signIn`, `settleAllOrders`, `apiGet` de `e2e/design-system/helpers.ts`): (a) o detalhe da Onça-Pintada (`/nft/nft_049`) mostra nome, "Por Fauna Viva", coleção, descrição, etiquetas, **3 imagens** na galeria com os textos alternativos `"Onça-Pintada, obra digital de Fauna Viva"`, `"Onça-Pintada, detalhe do rosto"` e `"Onça-Pintada ao entardecer"` (trocar de imagem por clique e por teclado), e as edições **Standard, Rare e Legendary** com preço, unidades disponíveis (18, 5 e 1) e limite por pedido (5, 2 e 1); (b) para os **12** animais o detalhe abre sem erro e mostra 3 imagens que carregam (largura natural > 0) e 3 edições; (c) adicionar a Rare ao carrinho mostra o animal com a imagem, a edição e o preço no carrinho, e tentar passar do limite por pedido (3 na Rare, 2 na Legendary) é impedido como em qualquer NFT; (d) comprar a **Legendary** (1 unidade) com `createOrderViaApi(page, { nftId: 'nft_049', editionId: 'nft_049_legendary' })` e `settleAllOrders` faz a edição aparecer **esgotada** no detalhe e as outras duas continuarem disponíveis; (e) o **recibo** (`GET /api/orders/<id>`) guarda o nome e os valores da compra e **não muda** depois de o admin alterar o preço da edição pela API de admin (reaproveitar o padrão de `e2e/order-confirmation`); (f) o coração de favorito no detalhe e no cartão muda de estado e **se mantém ao recarregar**; (g) nomes longos ("Peixe-Boi-da-Amazônia", "Jacaré-do-Pantanal") não estouram o cartão nem o detalhe em 390 px (sem rolagem horizontal); (h) axe sem violações críticas e `hasNoHorizontalScroll` no detalhe da Onça-Pintada em 390/768/1440, e baselines `fauna-detail-390/768/1440.png` (tela com sessão não é necessária: o detalhe é público). Depende de T017

### Implementation for User Story 2

- [ ] T019 [US2] Rodar `e2e/fauna` e consertar **o que falhar** no que a feature controla (dados e arte): cartão ou detalhe que estoure com nome longo só se resolve nos fixtures e na arte, **não** em `pages/` nem em `domains/` (esses são fora de escopo; se o defeito for de página, registrar e parar para decidir). Gerar as baselines `fauna-detail-*` com `--update-snapshots`, **abrir e revisar cada uma das 3 imagens** e repetir `e2e/fauna` duas vezes sem a flag. Depende de T018

**Checkpoint**: US2 funciona; US1 continua verde.

---

## Phase 5: User Story 3 — Conhecer o criador da coleção (Priority: P3)

**Goal**: "Fauna Viva" aparece na lista de criadores e tem página própria com os 12 animais.

**Independent Test**: abrir a lista de criadores e ver "Fauna Viva" com 12; abrir a página dele e ver os 12.

### Tests for User Story 3 (escrever primeiro e ver falhar)

- [ ] T020 [US3] Acrescentar a `apps/web/e2e/fauna/fauna.spec.ts`: (a) a lista de criadores (`/creators`) tem **9** criadores, e "Fauna Viva" aparece com avatar (`/art/artist-9.svg` carrega) e a contagem **12**; (b) os 8 criadores anteriores mantêm as contagens de antes (a constante `OLD_CREATOR_COUNTS` capturada na T002) e a soma das contagens antigas é 48; (c) a página do criador (`/creators/art_faunaviva`) lista os 12 animais, cada um leva ao seu detalhe; (d) axe e `hasNoHorizontalScroll` na página do criador em 390/768/1440. Depende de T019
- [ ] T021 [US3] Rodar `e2e/creators e2e/fauna` e atualizar as baselines `creators-390/768/1440` (um cartão a mais) com `--update-snapshots`, **abrir e revisar as 3 imagens** (o novo cartão com o avatar e o 12) e repetir duas vezes sem a flag; as baselines `creator-detail-*` (de `art_orbitian`) **não** devem mudar: se mudarem, parar e entender. Depende de T020

**Checkpoint**: as três histórias funcionam.

---

## Phase 6: Polish & Cross-Cutting

- [ ] T022 [P] Documentação: `docs/TEAMS.md` (o script `generate:fauna-art`, o módulo `fauna-art.mjs`, a coleção e o passo `migrate` do `Store` que reconcilia o catálogo persistido) e o README de `apps/web/src/pages/home/README.md` (uma linha: o catálogo agora tem 60 NFTs e a coleção "Fauna Brasileira" abre "Mais recentes")
- [ ] T023 Lighthouse das páginas públicas: `pnpm --dir apps/web build` e `pnpm --dir apps/web lighthouse` (home e detalhe de NFT). Acessibilidade ≥ 95 (o script falha abaixo disso) e CLS 0; anotar desempenho e comparar com os 67 e 70 medidos na feature 014 (a home passa a carregar 12 SVGs novos por página)
- [ ] T024 Gate de regressão a partir da raiz: `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm --dir apps/web check:production-bundle`, `pnpm --dir apps/web exec playwright test` (suíte completa: a linha de base da T001 mais os testes novos, **0 falhas**; o teste instável conhecido `e2e/wallets/coins` "retrying after a lost response" falha às vezes mesmo no HEAD, repetir só ele antes de concluir que é regressão) e `-c playwright.production.config.ts`; `git status` **sem mudanças** em `apps/api/`, `server/` e `apps/web/src/domains/`; confirmar que `git diff --stat origin/main -- apps/web/src` só toca `mocks/`. Depende de T021, T022
- [ ] T025 Abrir a PR (fluxo do repositório: branch + PR via `gh`, nunca push direto na `main`; **não** fazer o merge): título `feat(web): coleção Fauna Brasileira (spec 016)`, descrição com o que muda para o usuário, o limite conhecido do cartão de coleção do Mercado ("1 NFTs", herdado), que a arte é estilizada e feita por código, as 12 baselines regravadas e revisadas, e a nota de que o estado já salvo no navegador recebe a coleção pela reconciliação. Depende de T024

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (T001–T002)** → **Foundational (T003–T012)** → US1 → US2 → US3 → Polish.
- T002 **precisa vir antes** de qualquer edição de fixture (T003 em diante): o hash dos 48 antigos só é confiável se capturado no código original.
- Dentro de Foundational: T003 ∥ T004; T005 → T006 → T007 → T008 → T009 → T010 → T011 (mesmo arquivo `fauna-art.mjs`, em sequência); T012 depende de T003 e T011.

### User Story Dependencies

- **US1** precisa de Foundational e liga os dados ao catálogo (T014–T015); US2 e US3 só têm testes e ajustes, porque os dados já estão ligados, então **dependem da US1**.
- US2 e US3 não dependem uma da outra, mas editam o mesmo `fauna.spec.ts`, então rodam em sequência.

### Within Each Story

- E2E primeiro (T013, T018, T020), vê-los falhar, depois ligar os dados e atualizar baselines.

### Parallel Opportunities

- Foundational: T003 ∥ T004. Polish: T022 ∥ T023.
- O resto é sequencial por compartilhar arquivo ou por depender da revisão visual do lote anterior.

## Implementation Strategy

### MVP First (US1)

T001–T017: a coleção está no catálogo, na busca e no Mercado, com arte reconhecível, e quem já abriu o site a recebe.
O detalhe e a compra (US2) e o criador (US3) já funcionam nesse ponto (são os mesmos dados); as duas histórias seguintes
os **provam** com testes, baselines e correções.

### Incremental Delivery

1. Setup + Foundational (arte e dados) → 2. US1 (ligar, reconciliar, baselines da home/Mercado/carrinho) → 3. US2 (detalhe
   e compra) → 4. US3 (criador) → 5. Polish e PR.

## Notes

- A arte é **estilizada** (formas geométricas e paleta por bioma), não obra de ilustrador; o critério é reconhecer o animal
  pelo nome e pelos traços (SC-008).
- O cartão de coleção do Mercado mostra "1 NFTs" para a coleção nova (conta só os destaques; vale para todas as coleções);
  **não** é corrigido aqui.
- `apps/api`, `server/`, `domains/` e as páginas **não mudam**. Se uma tarefa parecer exigir isso, parar.
- Nada é publicado por esta feature; a PR não é mergeada sem aprovação.
