# Quickstart: validar a coleção "Fauna Brasileira"

Guia de validação. Os dados e a arte estão em [data-model.md](./data-model.md); as decisões em [research.md](./research.md).

## 1. Gerar a arte (e provar que é reproduzível)

```bash
pnpm install
pnpm --dir apps/web generate:fauna-art     # escreve nft-049…060-{1,2,3}.svg e artist-9.svg em public/art
git status --short apps/web/public/art     # 36 + 1 arquivos novos
pnpm --dir apps/web generate:fauna-art     # de novo
git diff --exit-code apps/web/public/art   # sem diff: determinístico
```

## 2. Ver a coleção no site

```bash
pnpm --dir apps/web dev
```

1. **Página inicial** (`/`): a primeira página do catálogo, em "Mais recentes", mostra os 12 animais, a Onça-Pintada no
   topo; o hero é o de sempre. Percorra as 5 páginas.
2. **Busca**: digite `onça`, `onca`, `ONÇA`, `tamandua` e `Fauna Brasileira`.
3. **Mercado** (`/market`): "Em alta" mostra a Onça-Pintada junto dos 3 destaques de antes; "Coleções" mostra "Fauna
   Brasileira" (o cartão leva ao catálogo filtrado; o número no cartão é 1, limite conhecido).
4. **Detalhe** (`/nft/nft_049`): galeria com 3 imagens, 3 edições; adicione a Rare ao carrinho; veja o carrinho e
   "Colecionadores também viram" com 4 itens.
5. **Criadores** (`/creators`): "Fauna Viva" com 12; abra a página dele.
6. **Quem já tinha o site aberto**: no console do navegador,
   `const s = JSON.parse(localStorage['nft-mock:state']); s.state.nfts = s.state.nfts.filter(n => !n.id.match(/^nft_0(49|5\d|60)$/)); localStorage['nft-mock:state'] = JSON.stringify(s)`
   e recarregue: os 12 voltam, e o carrinho, os pedidos e os favoritos continuam.

## 3. Revisão visual da arte

Renderize as 36 vistas no Chromium (folha de contato) e confira, uma a uma, que cada animal é reconhecível sem legenda e
que as 3 vistas mostram o mesmo animal (SC-008). O comando exato fica nas tarefas.

## 4. Testes

```bash
pnpm typecheck && pnpm lint && pnpm build
pnpm --dir apps/web check:production-bundle
pnpm --dir apps/web exec playwright test e2e/fauna
pnpm --dir apps/web exec playwright test            # suíte completa
pnpm --dir apps/web exec playwright test -c playwright.production.config.ts
```

Esperado: tudo verde. As baselines de `home-*`, `market-*`, `creators-*` e `cart-*` mudam (12 imagens): revise cada uma
antes de gravar com `--update-snapshots` e repita sem a flag. `git status` não pode mostrar nada em `apps/api`, `server/`
nem `apps/web/src/domains/`.
