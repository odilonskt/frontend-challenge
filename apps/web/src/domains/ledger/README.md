# Domínio `ledger`

Conexão do frontend com o backend real da Vercel (`apps/api`, specs/007-monorepo-vercel-blob):
saldo de moedas e histórico de transações guardados no Vercel Blob.

Não confundir com `coins`, que fala com `server/` (spec 006, SQLite, identidade por `X-User-Id`).

## Como a conexão funciona

```
browser --/backend/*--> Vite proxy (dev/preview)  --> vercel dev (apps/api) /api/*
                        vercel.json rewrite (prod) --> https://<api>.vercel.app/api/*
```

- O prefixo é `/backend` (`VITE_BACKEND_BASE_URL`), **não** `/api`: o MSW é dono de todo o `/api`.
- Mesma origem para o navegador, então não há CORS.
- Dev/preview: `BACKEND_PROXY_TARGET` (default `http://localhost:3000`, o `vercel dev` do `apps/api`).
- Produção: rewrite em `apps/web/vercel.json` para a URL do deploy da API.

## Autenticação

`apps/api` exige um token assinado por requisição. `api/client.ts` emite um token por usuário da
sessão (`POST /auth/token`), guarda em memória, renova perto de expirar e refaz uma vez após `401`.
Os tokens são descartados quando o token de sessão do app muda (login/logout/troca de usuário).

Limitação herdada da API: a emissão do token confia no `ownerId` informado (o projeto não tem login
real). Ver `apps/api/README.md`.

## API pública

`useLedgerBalance`, `useLedgerTransactions(limit)`, `useLedgerTopUp`, `useLedgerDebit` e `LedgerError`
(`isInsufficientBalance` para o `402`). Respostas são validadas com Zod; `409` de concorrência em
escritas é reenviado automaticamente (o contrato exige que o cliente tente de novo).

## Testes

O Playwright roda contra `src/mocks/contexts/ledger` (MSW), nunca contra o backend real.
