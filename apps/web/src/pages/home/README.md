# Página `home` — Início

**Rota:** `/` (search params: `q`, `category`, `availability`, `minPrice`, `maxPrice`, `sort`, `page`)

Destaques, catálogo, busca, filtros combináveis, ordenação, paginação e navegação para o NFT.
O estado de busca vive na URL (sobrevive a refresh e histórico); mudar filtro volta para `page=1`.

O catálogo tem 60 NFTs (5 páginas de 12): em "Mais recentes", a primeira página é a coleção **Fauna Brasileira**, que fica
logo depois dos 48 NFTs abstratos na ordem do fixture mas é a mais nova (specs/016-brazilian-fauna-nfts). O hero é uma imagem fixa.

**Usa os domínios:** `catalog`, `favorites`, `cart`.
