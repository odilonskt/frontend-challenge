# Data Model: Back-end de produção (`apps/api`)

Três tabelas e uma de controle. Todas as colunas de valor são inteiras; o dado lido do banco é validado com Zod
na borda do repositório. O contrato HTTP não muda (ver `contracts/api-delta.md`): as respostas continuam com os
mesmos campos (`ownerId`, `amount`, `version`, `updatedAt`, etc.).

## `coin_balances` — saldo por dono

| Coluna | Tipo | Regra |
|---|---|---|
| `owner_id` | texto, **PK** | identificador do dono (claim do token) |
| `amount` | inteiro (`bigint`) | `CHECK (amount >= 0)` — o saldo nunca é negativo (FR-005) |
| `version` | inteiro | `+1` a cada operação aceita (mantém o campo `version` da resposta atual) |
| `updated_at` | `timestamptz` | instante da última operação aceita |

Dono sem linha ⇒ saldo `0`, `version` `0` (criação preguiçosa como hoje, `GET /coins/balance`).

## `coin_transactions` — histórico imutável

| Coluna | Tipo | Regra |
|---|---|---|
| `tx_id` | `uuid`, **PK** | gerado pela API |
| `owner_id` | texto | FK lógica para `coin_balances.owner_id` |
| `direction` | texto | `CHECK (direction IN ('credit','debit'))` |
| `amount` | inteiro | `CHECK (amount > 0)`; o sinal vem de `direction` |
| `resulting_balance` | inteiro | `CHECK (resulting_balance >= 0)` |
| `idempotency_key` | texto, **anulável** | opcional, vindo do cabeçalho `Idempotency-Key` |
| `created_at` | `timestamptz` | instante da operação |

Restrições: `UNIQUE (owner_id, idempotency_key)` (D5; vários `NULL` são permitidos). Índice
`(owner_id, created_at DESC)` para `GET /coins/transactions` (mais recentes primeiro).

## `admins` — administradores

| Coluna | Tipo | Regra |
|---|---|---|
| `id` | texto, **PK** | `sha256` hex do e-mail normalizado (igual ao atual) |
| `email` | texto, `UNIQUE` | minúsculas, sem espaços nas pontas |
| `password_hash` | texto | scrypt com salt (`lib/password.ts`); nunca legível por URL |
| `role` | texto | `CHECK (role = 'admin')` |
| `created_at` | `timestamptz` | preservado quando a senha é trocada pelo seed |

## `schema_migrations` — controle

`(name texto PK, applied_at timestamptz)`; `scripts/migrate.ts` aplica cada arquivo uma vez.

## Invariantes (provadas pela verificação)

1. **Saldo = soma do histórico**: para todo dono, `amount = Σ(credit) − Σ(debit)` em `coin_transactions`
   (SC-003). Garantido porque saldo e transação são gravados na **mesma instrução** (research D3).
2. **Sem saldo negativo**: `CHECK` na tabela; a guarda `amount + valor >= 0` recusa antes de gravar (`402`).
3. **Operação idempotente tem efeito único**: a unicidade `(owner_id, idempotency_key)` impede o segundo
   efeito mesmo sob concorrência (SC-005).
4. **Isolamento por dono**: todas as consultas filtram por `owner_id` vindo **exclusivamente** do token
   verificado (007 FR-013); nunca de corpo, cabeçalho ou query.
5. **Nada é legível sem a API**: o banco só aceita a credencial do servidor; não há URL pública de objeto
   (SC-004).

## Transições de estado de uma operação

```text
pedido ──► (chave já usada, mesmo valor)    ──► devolve resultado original (sem novo efeito)
       ├─► (chave já usada, valor diferente) ──► 409 idempotency_key_conflict
       ├─► (débito deixaria saldo < 0)        ──► 402 insufficient_balance (nada gravado)
       └─► aceito ──► saldo e transação gravados juntos ──► 200 com o saldo novo
```

## Migração dos dados antigos

Não há (research D10): produção começa vazia; o admin é recriado por `seed-admin` com **senha nova**.
