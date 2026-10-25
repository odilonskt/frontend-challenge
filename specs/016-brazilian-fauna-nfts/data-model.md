# Data Model: Coleção "Fauna Brasileira"

Sem entidade nova no sistema: os 12 animais são `Nft` do catálogo (`domains/catalog/model/contracts.ts`), com as mesmas
regras de hoje. Este documento fixa os **dados** (a tabela curada), a **arte** e a **reconciliação** do estado.

## Valores comuns a todos os 12

| Campo | Valor |
|-------|-------|
| `artist` | `{ id: 'art_faunaviva', name: 'Fauna Viva', avatarUrl: '/art/artist-9.svg' }` |
| `collection` | `Fauna Brasileira` |
| `version` | `1` |
| `image` / `gallery[0]` | `/art/nft-0NN-1.svg`, 600×600, alt `"<Nome>, obra digital de Fauna Viva"` |
| `gallery[1]` | `/art/nft-0NN-2.svg`, 600×600, alt `"<Nome>, detalhe do rosto"` |
| `gallery[2]` | `/art/nft-0NN-3.svg`, 600×600, alt `"<Nome> ao entardecer"` |
| `featured` | `true` só na Onça-Pintada; `false` nos outros 11 |
| `createdAt` | `2026-01-16T12:00:00Z` menos `i` horas (`i` = 0 na Onça-Pintada … 11 na Ararajuba) |
| `editions` | Standard, Rare e Legendary, de `EDITION_TEMPLATES`: suprimento 25 / 8 / 1; limite por pedido 5 / 2 / 1; preço = base × 1 / 2,5 / 6 (`decimal.js`, 18 casas, string); `status: 'available'` |
| `priceFrom`, `totalAvailable` | de `derivePricing(editions)`, como nos atuais |

## Tabela curada

`Std`, `Rare`, `Leg` = unidades **disponíveis** (suprimento 25 / 8 / 1). Todas as edições abrem disponíveis.

| id | Nome | Bioma | Categoria | Preço-base (ETH) | Std | Rare | Leg | Etiquetas |
|----|------|-------|-----------|------------------|-----|------|-----|-----------|
| `nft_049` | Onça-Pintada | Pantanal | `art` | 1.2 | 18 | 5 | 1 | fauna, Pantanal |
| `nft_050` | Arara-Azul | Pantanal | `collectibles` | 0.75 | 22 | 6 | 1 | fauna, Pantanal |
| `nft_051` | Boto-Cor-de-Rosa | Amazônia | `art` | 0.5 | 25 | 8 | 1 | fauna, Amazônia |
| `nft_052` | Mico-Leão-Dourado | Mata Atlântica | `collectibles` | 0.33 | 14 | 3 | 1 | fauna, Mata Atlântica |
| `nft_053` | Tamanduá-Bandeira | Cerrado | `art` | 0.25 | 20 | 7 | 1 | fauna, Cerrado |
| `nft_054` | Lobo-Guará | Cerrado | `collectibles` | 0.5 | 17 | 4 | 1 | fauna, Cerrado |
| `nft_055` | Tucano-Toco | Cerrado | `art` | 0.33 | 23 | 5 | 1 | fauna, Cerrado |
| `nft_056` | Capivara | Pantanal | `collectibles` | 0.15 | 25 | 8 | 1 | fauna, Pantanal |
| `nft_057` | Bicho-Preguiça | Mata Atlântica | `art` | 0.12 | 21 | 6 | 1 | fauna, Mata Atlântica |
| `nft_058` | Jacaré-do-Pantanal | Pantanal | `collectibles` | 0.25 | 19 | 5 | 1 | fauna, Pantanal |
| `nft_059` | Peixe-Boi-da-Amazônia | Amazônia | `art` | 0.33 | 16 | 4 | 1 | fauna, Amazônia |
| `nft_060` | Ararajuba | Amazônia | `collectibles` | 0.75 | 24 | 7 | 1 | fauna, Amazônia |

Restrições do contrato `Nft` respeitadas: `name` com 3 a 60 caracteres (o mais longo, "Peixe-Boi-da-Amazônia", tem 21);
`category` ∈ `NFT_CATEGORIES`; preço como string decimal; `available` ≤ `supply`.

## Descrições (pt-BR, fatos consolidados, sem números de população, sem "on-chain")

| Animal | Texto |
|--------|-------|
| Onça-Pintada | O maior felino das Américas é símbolo do Pantanal e da Amazônia. A obra a mostra à beira d'água, com as rosetas que distinguem cada indivíduo. |
| Arara-Azul | A arara-azul-grande é o maior papagaio voador do mundo e vive no Pantanal e no Cerrado. A obra destaca o amarelo em volta do bico e dos olhos. |
| Boto-Cor-de-Rosa | O boto-cor-de-rosa vive nos rios da Amazônia e é o maior golfinho de rio do mundo. A obra o mostra com o focinho comprido que o distingue. |
| Mico-Leão-Dourado | Símbolo da Mata Atlântica, o mico-leão-dourado tem pelagem alaranjada e uma juba que lhe deu o nome. Só existe no Brasil. |
| Tamanduá-Bandeira | O tamanduá-bandeira, dos campos e cerrados, tem focinho longo, língua comprida e uma cauda peluda que parece uma bandeira. |
| Lobo-Guará | O maior canídeo da América do Sul tem pernas longas, orelhas grandes e vive nos campos e no Cerrado. |
| Tucano-Toco | O maior dos tucanos tem o bico alaranjado de ponta preta, quase do tamanho do corpo, e vive no Cerrado e em áreas abertas. |
| Capivara | A capivara é o maior roedor do mundo. Vive em bandos, sempre perto da água, em grande parte do Brasil. |
| Bicho-Preguiça | Lento e silencioso, o bicho-preguiça passa a vida nas árvores das florestas brasileiras, quase sempre pendurado nos galhos. |
| Jacaré-do-Pantanal | Típico do Pantanal, o jacaré-do-pantanal vive em rios, lagoas e baías, com o focinho e o dorso à flor d'água. |
| Peixe-Boi-da-Amazônia | Mamífero aquático e herbívoro, o peixe-boi-da-amazônia vive nos rios amazônicos e se alimenta de plantas aquáticas. |
| Ararajuba | A ararajuba é uma ave da Amazônia de plumagem amarelo-dourada e asas verdes. |

## Arte: traço de cada animal e foco do detalhe

Cenário por bioma (3 cores de céu/chão/água por vista). `Foco` = recorte do detalhe (rosto), em coordenadas 600×600.

| Animal | Bioma (cenário) | Traços que o identificam | Foco |
|--------|-----------------|--------------------------|------|
| Onça-Pintada | Pantanal: água rasa, aguapés | corpo dourado, rosetas escuras com miolo claro, cabeça larga, cauda longa | cabeça |
| Arara-Azul | Pantanal: palmeira | corpo azul-cobalto, face amarela ao redor do bico preto curvo, cauda longa e pontuda | cabeça |
| Boto-Cor-de-Rosa | Amazônia: rio, mata ao fundo | corpo rosa, focinho comprido e fino, nadadeira dorsal baixa | cabeça |
| Mico-Leão-Dourado | Mata Atlântica: folhagem | pelagem alaranjada, juba em volta do rosto escuro, cauda longa | cabeça |
| Tamanduá-Bandeira | Cerrado: capim, cupinzeiro | focinho longo e fino, faixa preta e branca no ombro, cauda enorme e peluda | cabeça |
| Lobo-Guará | Cerrado: capim alto | pernas muito longas e escuras, pelagem avermelhada, orelhas grandes, crina negra | cabeça |
| Tucano-Toco | Cerrado: galho | corpo preto, papo branco, bico laranja enorme com mancha preta na ponta | cabeça e bico |
| Capivara | Pantanal: margem e água | corpo em barril marrom, focinho rombudo, orelhas pequenas | cabeça |
| Bicho-Preguiça | Mata Atlântica: galho | pendurada de cabeça para cima, máscara facial escura, garras longas | cabeça |
| Jacaré-do-Pantanal | Pantanal: água e margem | focinho longo, dorso com placas, olhos e narinas à flor d'água | cabeça |
| Peixe-Boi-da-Amazônia | Amazônia: rio | corpo cinza arredondado, cauda em pá, focinho curto com bigodes | cabeça |
| Ararajuba | Amazônia: copa de árvore | plumagem amarelo-dourada, asas verdes, bico claro | cabeça |

## Arquivos de arte

- `public/art/nft-0NN-{1,2,3}.svg`, `NN` de 49 a 60: **36 arquivos**, 600×600, determinísticos.
- `public/art/artist-9.svg`: avatar de "Fauna Viva" (`avatar(90_009, 'FV')`, o mesmo gerador dos 8 atuais).
- O `generate-art.mjs` continua gerando só os `nft-001…048` e `artist-1…8`.

## Reconciliação do estado persistido

`addMissingCatalogNfts(state)`: para cada NFT de `buildNftFixtures()` cujo `id` **não** está em `state.nfts`, acrescenta ao
fim; devolve o mesmo estado. Não toca em NFT presente (nem estoque, nem edições, nem `featured`), nem em
`delistedNftIds`, usuários, sessões, carrinhos, carteiras, pedidos ou favoritos. É aplicada uma vez, quando o estado é
carregado do `localStorage`; quando não há estado salvo, o estado inicial já traz os 60.

## Invariantes (verificáveis)

- Os 48 primeiros NFTs: mesmo conteúdo antes e depois (hash do JSON de `/api/nfts/<id>`).
- 60 ids distintos; 60 × 3 imagens existem em `public/art`; 9 criadores, com "Fauna Viva" em 12.
- `featured`: exatamente 4 NFTs (`nft_001`, `nft_002`, `nft_003`, `nft_049`).
- Primeira página de `GET /api/nfts?sort=recent&pageSize=12` = `nft_049` … `nft_060`, nessa ordem.
