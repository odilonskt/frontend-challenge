# Domínio `catalog`

**Telas:** Início (`/`) e Detalhes do NFT (`/nft/$nftId`)

| Pasta | Conteúdo |
| --- | --- |
| `model/` | Contratos (`Nft`, `NftEdition`, `CatalogSearch`), schemas de busca da URL |
| `api/` | Chamadas Axios + query keys/options (`catalogQueries`) |
| `hooks/` | `useCatalog`, `useNft`, sincronização com `nft.updated` |
| `components/` | Destaques, cards, filtros, ordenação, paginação, galeria, skeletons |
| `pages/` | `HomePage`, `NftDetailPage`, `NftNotFound` |

**Eventos consumidos:** `nft.updated` (preço/disponibilidade).
**Depende de:** `favorites` (botão de favorito), `cart` (adicionar ao carrinho).
