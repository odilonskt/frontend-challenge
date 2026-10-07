# Organização por domínio (DDD)

Cada tela pertence a um **domínio** em `src/domains/<domínio>`. Um time é dono de um ou mais domínios
e pode trabalhar sem conflitar com os demais.

| Domínio | Telas | Rotas | Mocks (MSW) |
| --- | --- | --- | --- |
| `catalog` | Início, Detalhes do NFT | `/`, `/nft/$nftId` | `mocks/handlers/catalog.ts` |
| `favorites` | (botão em catálogo/detalhe) | — | `mocks/handlers/favorites.ts` |
| `cart` | Carrinho | `/cart` | `mocks/handlers/cart.ts`, `quote.ts` |
| `checkout` | Pagamento | `/checkout` | `mocks/handlers/orders.ts` |
| `orders` | Confirmação | `/orders/$orderId` | `mocks/handlers/orders.ts` |
| `auth` | Login, Cadastro | `/login`, `/signup` | `mocks/handlers/auth.ts` |
| `profile` | Perfil | `/account/profile` | `mocks/handlers/profile.ts` |
| `wallets` | Carteiras | `/account/wallets` | `mocks/handlers/wallets.ts` |

## Anatomia de um domínio

```
src/domains/<domínio>/
  model/       contratos tipados (DTOs) e regras puras, sem React e sem Axios
  api/         funções Axios + queryOptions/queryKeys do TanStack Query
  hooks/       hooks de estado (queries, mutations, eventos de tempo real)
  components/  componentes visuais do domínio (usam shared/ui)
  pages/       componentes de página montados pelas rotas
  index.ts     API pública: o que outros domínios podem importar
  README.md    responsabilidades, eventos e dependências
```

## Regras de fronteira

1. **Um domínio importa outro apenas via `@/domains/<outro>`** (o `index.ts`), nunca por caminhos internos.
   Dentro do próprio domínio use imports relativos (`../model/...`). O lint (`pnpm lint`) bloqueia violações.
2. `src/shared/` não importa nada de `src/domains/`.
3. `src/app/routes/` contém rotas **finas**: validação de search params, guards e `loader`. A UI vem de `pages/`.
4. Contratos REST ficam em `model/contracts.ts` do domínio e são reutilizados pelos handlers MSW em `src/mocks`.
5. Componentes, hooks e o cliente Axios **não** contêm dados fictícios: toda simulação fica em `src/mocks`.

## Camadas compartilhadas

| Pasta | Dono | Conteúdo |
| --- | --- | --- |
| `src/app` | Plataforma | Providers, router, rotas finas, layout raiz |
| `src/shared/ui` | Design System | Componentes shadcn/ui adaptados ao Figma |
| `src/shared/api` | Plataforma | Axios, `ApiError`, QueryClient, contratos de transporte |
| `src/shared/realtime` | Plataforma | Cliente Socket.IO, deduplicação e versionamento de eventos |
| `src/shared/lib` | Plataforma | Utilitários (`cn`, aritmética ETH) |
| `src/mocks` | Plataforma | MSW: banco em memória, fixtures, handlers, cenários, socket |
| `e2e/` | QA | Playwright por domínio (`e2e/<domínio>/*.spec.ts`) |
