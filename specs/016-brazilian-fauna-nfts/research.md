# Research: Coleção "Fauna Brasileira"

Fase 0 do plano. Nenhuma incógnita ficou pendente; cada item é uma decisão técnica que a spec deixou em aberto de
propósito, ou um fato do código que mudou o desenho. Verificados no repositório em 2026-10-25.

## D1. Onde ficam os dados: módulo próprio, anexado depois dos 48

- **Decisão**: `fixtures/fauna.ts` exporta a lista curada dos 12 (id, nome, bioma, categoria, descrição, etiquetas, preço
  base e estoque); `buildNftFixtures()` constrói os 48 como hoje e **anexa** os 12 no fim. `NFT_COUNT` continua 48 (é o
  dos placeholders).
- **Razão**: o fixture dos 48 usa um gerador pseudoaleatório (`createRandom(20260115)`) consumido em ordem; preço, estoque
  e "esgotado" de cada NFT dependem da posição. Anexar depois, sem consumir o gerador, deixa os 48 byte a byte iguais
  (FR-014; `e2e/cart` depende do estoque de `nft_005`). Os 12 usam dados explícitos: revisáveis e reproduzíveis.
- **Alternativas**: estender `NAMES` até 60 (mudaria a regra por índice de categoria, criador, coleção e destaque, e a
  semente já não bastaria); gerar os 12 com o mesmo gerador (preços e estoques sem curadoria).

## D2. Quem já abriu o site: reconciliação aditiva do catálogo persistido

- **Fato**: `state.nfts` é persistido no `localStorage` (`nft-mock:state`, versão 1) e `createInitialState()` só roda
  quando não há estado salvo. Quem já usa o site continua com os 48 e **nunca** veria a coleção.
- **Decisão**: o `Store` ganha um terceiro parâmetro opcional `migrate(loaded)`, aplicado ao estado carregado do
  armazenamento; `state.ts` o usa para acrescentar, por id, os NFTs de fixture que faltam em `state.nfts`. Não altera
  nem recria nada que já existe (estoque comprado, edições mexidas pelo admin, NFTs tirados da vitrine seguem como
  estão) e **não muda a versão do esquema**.
- **Razão**: subir a versão apagaria carrinhos, pedidos, carteiras e favoritos de demonstração de todo usuário (a 014 já
  decidiu não fazer isso). Os ids do admin vêm de `randomId('nft')` (aleatórios), então não colidem com `nft_049…060`.
  O mesmo passo serve a qualquer coleção futura.
- **Alternativas**: subir a versão (descartada, acima); não fazer nada (a coleção some para quem já abriu o site);
  reconciliar em tempo de leitura no repositório (espalha a regra pelos leitores do catálogo).

## D3. Ordem: os 12 são os mais recentes, a onça-pintada a primeira

- **Decisão**: `createdAt` explícitos, todos depois do mais novo dos 48 (`2026-01-15T00:00:00Z`): do primeiro ao último
  animal, `2026-01-16T12:00:00Z` menos 0, 1, 2 … 11 horas. A busca ordena `createdAt` decrescente com desempate por id,
  então a primeira página do catálogo (12 por página) é exatamente a coleção, com a onça no topo.
- **Razão**: SC-001 e FR-008; datas explícitas não dependem de relógio nem de índice.

## D4. Destaque: só a onça-pintada

- **Fato**: `featured` alimenta **somente** os carrosséis "Em alta" e "Coleções" do Mercado e a lista "Colecionadores
  também viram" do carrinho (`.slice(0, 5)`). O hero da home é uma imagem fixa (`/art/nft-001-1.svg`), não usa destaque.
- **Decisão**: `featured: true` só na onça-pintada (a ordem do array a põe em 4º lugar: `nft_001…003`, depois ela).
  O "Em alta" passa de 3 para 4; "Coleções" ganha "Fauna Brasileira" (o cartão leva ao catálogo com `q` = nome da
  coleção, que já funciona); o carrinho passa a listar 4 relacionados.
- **Limite conhecido**: o cartão de coleção mostra `N NFTs` contado **só entre os destaques**; a coleção nova mostra 1.
  É assim para todas as coleções hoje (cada uma mostra 1). Corrigir muda o comportamento das atuais e fica fora de
  escopo (spec, Assumptions).
- **Alternativas**: destacar vários animais (infla "Em alta" e o carrinho sem ganho); nenhum destaque (a coleção não
  apareceria no Mercado, contra o pedido; a escolha do usuário foi destacar a onça).

## D5. Sistema de arte: desenho por código, determinístico

- **Decisão**: `infra/fauna-art.mjs` (JS puro, como `placeholder-art.mjs`) exporta `faunaTile(animal, view)` e a lista
  de animais. Cada animal tem: **bioma** (paleta de céu, água e chão), **função de desenho** (formas geométricas sobre
  600×600, com um traço inconfundível) e um **foco** (retângulo do rosto). As 3 vistas saem da mesma cena:
  1. **cena completa**: céu em degradê, sol, chão ou água do bioma, vegetação de fundo e o animal;
  2. **detalhe do rosto**: a mesma cena com `viewBox` recortado no foco (vetorial, sem perda);
  3. **entardecer**: a mesma cena com sol baixo, céu quente e uma sobreposição translúcida escura sobre tudo.
- **Razão**: garante que as 3 vistas são o mesmo animal (SC-008), concentra a paleta em um lugar e evita 36 arquivos
  mantidos à mão. Sem animação (nada a respeitar de `prefers-reduced-motion`) e sem fonte externa: texto não é usado na
  arte (o nome do animal vem do texto alternativo e do cartão).
- **Cores literais**: ficam em `mocks/infra` (arte e dados), que o `check-tokens` ignora; não são cores de interface.
- **Alternativas**: SVGs escritos à mão (36 arquivos, sem reaproveito); rasterizar (arquivos maiores, sem recorte
  vetorial para o detalhe); fotos (licença, fora do pedido).

## D6. Reconhecibilidade e honestidade sobre a qualidade

- **Decisão**: cada animal é desenhado por poucas formas bem escolhidas e **conferido a olho**: renderizo as 36 vistas no
  Chromium e reviso as imagens antes de aceitar (tabela de traços em [data-model.md](./data-model.md)). A spec descreve
  a arte como "estilizada".
- **Razão**: SVG feito à mão não tem o acabamento de um ilustrador; o critério (SC-008) é reconhecer o animal pelo nome e
  pelos traços, não a qualidade artística.

## D7. Script e reprodutibilidade

- **Decisão**: `scripts/generate-fauna-art.mjs` (+ `generate:fauna-art` no `package.json`) escreve
  `public/art/nft-049…060-{1,2,3}.svg` e `public/art/artist-9.svg` (via `avatar(90_009, 'FV')` existente). O
  `generate-art.mjs` **não muda** (continua só 1–48), então um nunca sobrescreve o outro. Rodar o script duas vezes não
  pode produzir diff.
- **Razão**: mesmo padrão do gerador atual; a reprodutibilidade é verificável com `git diff --exit-code`.

## D8. Texto alternativo

- **Decisão**: vista 1: `"<Nome>, obra digital de Fauna Viva"` (o padrão atual); vista 2: `"<Nome>, detalhe do rosto"`;
  vista 3: `"<Nome> ao entardecer"`.
- **Razão**: FR-006. O padrão atual das vistas 2 e 3 (`"detalhe 1 da obra"`, `"detalhe 2 da obra"`) não diz o que a
  imagem mostra; para os novos, o texto descritivo é melhor para leitor de tela sem custo.

## D9. Conteúdo: descrições e preços

- **Decisão**: descrições curtas em português, **uma ou duas frases** com fatos consolidados (bioma e uma característica
  reconhecida: "maior felino das Américas", "maior papagaio voador do mundo", "maior roedor do mundo", "maior canídeo da
  América do Sul", "maior golfinho de rio do mundo"), **sem números de população** e **sem afirmar registro em
  blockchain** (os 48 atuais dizem "registrada on-chain"; os novos não repetem isso). Preços-base e estoque na tabela
  curada de [data-model.md](./data-model.md), com os multiplicadores e suprimentos de `EDITION_TEMPLATES`.
- **Razão**: FR-002, FR-003, FR-004. Estoques variados (e a Legendary sempre com 1) exercitam o "baixo estoque" e o
  limite por pedido sem esgotar nada na estreia.

## D10. `EDITION_TEMPLATES` sobe para um módulo

- **Decisão**: mover `EDITION_TEMPLATES` de `nfts.ts` para `fixtures/edition-templates.ts`; `nfts.ts` e `fauna.ts`
  importam dele.
- **Razão**: `nfts.ts` importa `fauna.ts`, e `fauna.ts` precisa dos templates: sem um módulo comum haveria import
  circular. É um movimento de código, sem mudança de valor.

## D11. Verificação

- **Decisão**: (1) `e2e/fauna/fauna.spec.ts` (primeira página da home, 5 páginas e 60 distintos, busca com e sem
  acento, Mercado, hero igual, detalhe e compra, criador, imagens existentes, **os 48 antigos idênticos por hash**, e a
  reconciliação do estado antigo); (2) baselines da home, do Mercado, dos criadores e do carrinho atualizadas e
  revisadas; (3) reprodutibilidade do gerador; (4) revisão visual das 36 vistas.
- **Os 48 idênticos (SC-005)**: antes de mexer em `nfts.ts`, um script de uma vez lê `/api/nfts/<id>` dos 48 NFTs no
  código atual e grava um hash; o teste recalcula e compara. É a única forma de provar "idênticos" sem copiar 48 objetos.
- **Reconciliação (D2)**: o teste abre o site, remove `nft_049…060` do estado salvo no `localStorage` (simulando o estado
  de antes), recarrega e confere que os 12 voltaram e que o resto (usuário, pedido, favoritos) ficou como estava.
- **Baselines afetadas**: `home-*` (a grade de catálogo), `market-*` (Em alta e Coleções), `creators-*` (um cartão a
  mais), `cart-*` ("Colecionadores também viram" com 4). `design-system/catalog-*` é só a vitrine de tokens e não muda.
