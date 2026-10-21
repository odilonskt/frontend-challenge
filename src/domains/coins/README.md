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
