# Domínio `cart`

**Tela:** Carrinho de NFTs (`/cart`)

- Itens por NFT + edição, quantidades inteiras respeitando o estoque.
- Carrinho do visitante persiste após refresh e é mesclado ao autenticar (`POST /api/cart/merge`).
- Cupom e resumo vêm da **cotação** (`POST /api/quote`); a UI nunca recalcula o total final.
- Reage a `nft.updated`: avisa o usuário (região `aria-live`) e invalida a cotação.
