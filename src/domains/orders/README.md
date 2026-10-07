# Domínio `orders`

**Tela:** Confirmação de pedido (`/orders/$orderId`), rota protegida.

- Estados `pending` → `confirmed` | `declined` (terminais).
- Consome `order.updated`; reconcilia com `GET /api/orders/:id` após reconexão/refresh.
- O recibo exibe o **snapshot** do pedido e não lê o catálogo.
