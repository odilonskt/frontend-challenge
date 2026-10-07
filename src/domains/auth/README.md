# Domínio `auth`

**Telas:** Login (`/login`) e Cadastro (`/signup`)

- Sessão via cookie simulado; `GET /api/session` restaura a sessão após refresh.
- `redirect` na search da URL devolve o usuário ao fluxo anterior.
- Expiração (401 `SESSION_EXPIRED`) abre o diálogo de reautenticação sem perder o contexto.
- Logout/troca de usuário: `queryClient.clear()` dos dados privados + desconexão do socket.
