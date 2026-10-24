# Domínio `coins`

Saldo de "moedas da plataforma" e o pagamento alternativo ao fluxo de carteira/ETH no checkout.
**Diferente de todos os outros domínios deste projeto**: os dados aqui não vêm do MSW — vêm de um
backend real (`server/`, raiz do repositório), por uma exceção explícita e documentada na
constituição do projeto (v1.1.0, "Exceção Pontual: Backend Real de Moedas da Plataforma").

Por isso, este domínio usa sua própria instância Axios (`api/client.ts`, apontando para
`env.coinsApiUrl`), nunca o cliente `@/shared/api/http` (que é interceptado pelo MSW).

**Público**: `CoinBalance`, `ETH_TO_COINS_RATE`, `useCoinsBalance()`, `useTopUpCoins()` — mais
`debitCoins`/`refundCoins` (funções assíncronas simples, não hooks, para uso imperativo no
checkout).

**Usado por**: `pages/wallets` (saldo + recarga) e `pages/checkout` (pagamento com coins).

## Produção (specs/008-web-production-env)

As moedas só existem em builds com `VITE_COINS_API_URL` definida (`coinsEnabled`, exportado por este
domínio). Em desenvolvimento a variável tem o padrão `http://localhost:4000` (o `server/` local); em
**produção não há padrão**: o `server/` usa SQLite em arquivo e não roda na Vercel, então o build
publicado esconde a seção de saldo em `pages/wallets` e o seletor de forma de pagamento em
`pages/checkout`, e `useCoinsBalance` não consulta nada. O pagamento com carteira/ETH não muda.

Reativar as moedas em produção exige uma feature própria (outro armazenamento para o saldo), não só
definir a variável.
