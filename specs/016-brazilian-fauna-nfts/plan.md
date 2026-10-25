# Implementation Plan: Coleção "Fauna Brasileira" — NFTs de animais brasileiros

**Branch**: `016-brazilian-fauna-nfts` | **Date**: 2026-10-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/016-brazilian-fauna-nfts/spec.md`

## Summary

O catálogo simulado ganha a coleção "Fauna Brasileira": 12 NFTs de animais brasileiros, do criador "Fauna Viva", com
ilustração vetorial estilizada própria (3 vistas por NFT, 36 arquivos mais o avatar do criador), edições Standard, Rare e
Legendary e descrições em português. Nada muda em `apps/api`, `server/` nem em regra de negócio: os animais são NFTs de
catálogo como os 48 atuais e usam a busca, os filtros, o carrinho, o checkout e o recibo que já existem.

Três pontos de desenho decidem o resto (detalhes em [research.md](./research.md)):

1. **Dados novos em módulo próprio, depois dos 48.** Os 12 ficam em `fixtures/fauna.ts` e `buildNftFixtures()` os anexa
   no fim. O gerador pseudoaleatório só é consumido pelos 48 originais, então estoque e preço deles não mudam.
2. **Quem já abriu o site precisa receber a coleção.** O catálogo vive no estado persistido do navegador, e os fixtures
   são só o estado inicial; sem tratamento, só visitantes novos veriam os animais. Um passo aditivo de reconciliação na
   carga do estado acrescenta os NFTs de fixture que faltam, sem subir a versão do esquema (o que apagaria carrinhos,
   pedidos e favoritos de demonstração).
3. **Arte gerada por código, no padrão que já existe**: um módulo de desenho compartilhado (`fauna-art.mjs`) e um script
   que escreve os SVGs, determinísticos e reproduzíveis, como `placeholder-art.mjs` e `generate-art.mjs`.

## Technical Context

**Language/Version**: TypeScript ~6.0, React 19 (inalterados); scripts e módulo de arte em JavaScript puro (`.mjs`), como
os de `placeholder-art.mjs`/`generate-art.mjs`.

**Primary Dependencies**: as do `apps/web` (MSW, Zod, `decimal.js`, Playwright). **Nenhuma nova.**

**Storage**: nenhum novo. O catálogo vive em `MockState.nfts`, persistido no `localStorage` (`nft-mock:state`, versão 1).
Os SVGs são arquivos estáticos em `apps/web/public/art/`.

**Testing**: Playwright contra os mocks (nova pasta `e2e/fauna/`, com axe e visuais em 390/768/1440); as baselines
existentes afetadas são atualizadas e revisadas; verificação de reprodutibilidade do gerador; revisão visual das 36 vistas.

**Target Platform**: navegador; SPA na Vercel (produção continua um demo com mocks para `/api/*`).

**Project Type**: web app (`apps/web`).

**Performance Goals**: sem meta nova. Cada SVG de arte fica pequeno (algumas dezenas de formas, na casa de poucos KB),
porque a home carrega 12 imagens por página.

**Constraints**: os 48 NFTs existentes ficam idênticos (FR-014, SC-005); nada em `apps/api`, `server/`, `domains/orders`;
fronteiras do Princípio I (esta feature só toca `mocks/`, `public/`, `scripts/`, `e2e/` e `docs/`); `any` proibido;
`mocks/` é isento do `check-tokens` (cores literais da arte não violam o design system).

**Scale/Scope**: 12 NFTs, 36 SVGs + 1 avatar, 1 criador, 1 módulo de fixture, 1 módulo de arte, 1 script, 1 passo de
reconciliação do estado, 1 pasta de e2e, 4 conjuntos de baselines atualizados (12 imagens), docs.

## Constitution Check

*GATE: avaliado antes da Fase 0 e reavaliado após a Fase 1. Base: constituição **v1.9.0**.*

| Princípio / Seção | Avaliação |
|-------------------|-----------|
| I. Camadas e fronteiras | **OK.** Só `mocks/` (fixtures, `state.ts`, `infra/store.ts`, `infra/fauna-art.mjs`), `public/art`, `scripts`, `e2e` e `docs`. Nenhuma página, rota ou domínio muda; o `Navbar`, a home e o Mercado leem o catálogo como sempre. |
| II. Tipagem estrita | **OK.** Os fixtures são `Nft` tipados; preços como string decimal de 18 casas com `decimal.js` (como hoje); sem `any`. |
| III. Estado remoto | **OK / N/A.** Nenhum endpoint nem consulta novos; a paginação, a busca e os filtros que já vivem na URL seguem iguais. |
| IV. Tempo real | N/A. Os animais usam o `nft.updated` existente quando o estoque muda por compra. |
| V. Mocks só na rede | **OK.** Os dados novos e a reconciliação ficam em `src/mocks`; nenhum dado fictício em componente. Os SVGs são ativos estáticos em `public/`, como os 153 atuais. |
| VI. Acessibilidade/responsividade | **OK.** Texto alternativo em português em toda imagem; sem animação nos SVGs (sem risco para `prefers-reduced-motion`); axe e 390/768/1440 sem rolagem horizontal nas telas tocadas; contraste da arte não carrega informação sozinha (o nome está em texto). |
| VII. Testes | **OK.** E2E por página (`e2e/fauna/`) com falhas já cobertas pelos cenários existentes, visuais atualizados e revisados; Lighthouse das páginas públicas (home) reexecutado. |
| Escopo e segurança | **OK.** Sem blockchain real, sem dado novo no serviço real, sem credencial, sem alteração do que é gravado em `apps/api`. |
| Fluxo: documentação | `docs/TEAMS.md` ganha o script e a coleção; README da página `home` e o do contexto de mocks citam o passo de reconciliação. |

**Resultado do gate**: sem violações. **Pós-Fase 1**: sem violações novas; o passo de reconciliação em `infra/store.ts`
é infraestrutura de mock (Princípio V) e não entra na lista de exceções da constituição.

## Project Structure

### Documentation (this feature)

```text
specs/016-brazilian-fauna-nfts/
├── plan.md               # este arquivo
├── research.md           # Fase 0: decisões D1–D11
├── data-model.md         # Fase 1: os 12 NFTs (tabela curada), edições, arte, reconciliação
├── quickstart.md         # Fase 1: gerar a arte, rodar, verificar
├── checklists/requirements.md
└── tasks.md              # /speckit-tasks (não criado aqui)
```

Não há `contracts/`: a feature não cria nem muda interface (a API simulada, os contratos de `domains/catalog` e as rotas
são os mesmos); o contrato dos dados é o próprio `Nft` e está em `data-model.md`.

### Source Code (repository root)

```text
apps/web/
├── src/mocks/
│   ├── fixtures/
│   │   ├── edition-templates.ts   # NOVO: EDITION_TEMPLATES (Standard/Rare/Legendary), movidos de nfts.ts para dois usarem
│   │   ├── fauna.ts               # NOVO: os 12 NFTs curados (nome, bioma, categoria, descrição, preço, estoque)
│   │   └── nfts.ts                # buildNftFixtures() anexa os 12 depois dos 48; NFT_COUNT segue 48
│   ├── infra/
│   │   ├── fauna-art.mjs          # NOVO: desenho dos 12 animais + cenários por bioma + 3 vistas (JS puro)
│   │   └── store.ts               # Store ganha um 3º parâmetro opcional `migrate` aplicado ao estado carregado
│   └── state.ts                   # passa `addMissingCatalogNfts` ao Store (reconciliação aditiva do catálogo)
├── scripts/
│   └── generate-fauna-art.mjs     # NOVO: escreve public/art/nft-049…060-{1,2,3}.svg e artist-9.svg
├── public/art/                    # +36 SVGs de NFT e +1 avatar de criador
├── e2e/fauna/fauna.spec.ts        # NOVO (+ baselines do detalhe de um animal)
├── e2e/{home,market,creators,cart}/*-snapshots/   # baselines atualizadas e revisadas (12 imagens)
└── package.json                   # + script "generate:fauna-art"
docs/TEAMS.md                      # script e coleção
```

**Structure Decision**: tudo cabe nas camadas de mock e nos ativos estáticos já existentes; o reaproveitamento é
máximo (`derivePricing`, `avatar()`, `createRandom` ficam como estão). `EDITION_TEMPLATES` sobe para um módulo próprio
só para `nfts.ts` e `fauna.ts` o compartilharem sem import circular.

## Complexity Tracking

> Sem violações da constituição a justificar.

| Escolha | Por que é necessária | Alternativa mais simples rejeitada porque |
|---------|----------------------|-------------------------------------------|
| Passo de reconciliação do estado persistido (`migrate` no `Store`) | Sem ele só visitantes novos veem a coleção; o estado já salvo mantém os 48 antigos | Subir a versão do esquema apagaria carrinhos, pedidos, carteiras e favoritos de demonstração de quem já usa o site; não fazer nada esconde a feature de todo mundo que já abriu o site |
| Módulo de desenho por animal (12 funções) em vez de 12 arquivos SVG escritos à mão | 36 SVGs à mão seriam 36 arquivos para manter à mão, sem reaproveitar cenário nem paleta | Escrever os SVGs direto: cada ajuste de paleta ou de cenário viraria 36 edições, e a 3ª vista (entardecer) não teria garantia de ser a mesma cena |
