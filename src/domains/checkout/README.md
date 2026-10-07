# Domínio `checkout`

**Tela:** Pagamento (`/checkout`), rota protegida.

- Dados do colecionador, seleção de carteira cadastrada e rede, simulação de conexão/recusa/desconexão.
- Etapa de revisão; revalida a cotação antes de confirmar. Se mudar, exige nova confirmação.
- Cria o pedido com `Idempotency-Key` estável por tentativa e bloqueia cliques repetidos.
