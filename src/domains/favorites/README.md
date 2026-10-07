# Domínio `favorites`

**Telas:** sem tela própria; fornece `FavoriteButton` para o catálogo e o detalhe.

- Persistência por usuário autenticado (`GET/PUT/DELETE /api/favorites`).
- **Atualização otimista com rollback**: é a interação de referência do projeto.
- Visitante que favorita é redirecionado ao login e volta para o mesmo NFT.
