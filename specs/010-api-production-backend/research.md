# Research: Back-end de produção (`apps/api`)

Sem `NEEDS CLARIFICATION` pendente. Cada decisão abaixo responde a um requisito da spec.

## D1: Armazenamento — Postgres gerenciado (Neon) no lugar do Vercel Blob

**Decision**: guardar saldo, transações e administradores em **PostgreSQL** (Neon, integração do Vercel
Marketplace, que injeta a URL de conexão como variável de ambiente do projeto).

**Rationale**: o defeito medido (12 → 4) vem de o Blob não ter escrita condicional atômica e de leituras logo
após a escrita serem obsoletas; o hash do admin é legível porque o SDK só grava `access: "public"`. Um banco
relacional resolve as duas coisas de uma vez: atomicidade por instrução/transação (FR-004, FR-005), restrições
de integridade (`CHECK`, `UNIQUE`) e acesso apenas por credencial do servidor (FR-008). Também remove o
problema do CDN anti-bot sob rajada, porque nenhuma leitura passa mais por URL pública.

**Alternatives considered**:
- *Redis (Upstash)*: `INCRBY`/Lua são atômicos, mas o invariante "saldo = soma do histórico" e a listagem
  paginada de donos/admins ficam artesanais; dois tipos de dado, nenhum vencedor claro. Rejeitado.
- *Derivar o saldo do log append-only no Blob*: elimina a perda de atualização, mas mantém admin e dados em URL
  pública (viola FR-008) e a listagem por prefixo é eventualmente consistente. Rejeitado.
- *Manter Blob com mais tentativas*: já medido; a leitura obsoleta não some com retry. Rejeitado.
- *Vercel KV/Edge Config*: não são armazenamento transacional de uso geral. Rejeitado.

## D2: Driver — `pg` (node-postgres) com *pooler*, não o driver HTTP do Neon

**Decision**: `pg` com `Pool({ max: 1 })` por instância da função e a URL com *pooler* do Neon.

**Rationale**: o mesmo código e o mesmo SQL rodam no Postgres local (Docker) e na produção, o que dá paridade
(spec 007 SC-002 exigia paridade local/produção). Sem *prepared statements* nomeados, funciona com o
*pooler* em modo transação.

**Alternatives considered**: `@neondatabase/serverless` (HTTP/WebSocket) funciona sem TCP, mas não fala com um
Postgres local comum — perde a paridade. `postgres.js`: equivalente, sem ganho que justifique trocar.

## D3: Atomicidade em **uma instrução** SQL (sem laço de retry)

**Decision**: crédito e débito são um único comando: uma CTE que (a) faz `INSERT ... ON CONFLICT (owner_id)
DO UPDATE SET amount = balances.amount + $v` com a condição `balances.amount + $v >= 0` e (b) insere a linha
em `coin_transactions` com o saldo resultante, tudo no mesmo comando. Se a condição falhar, nenhuma linha é
afetada e o serviço responde `402`. O Postgres serializa as escritas na mesma linha, então 50 operações
concorrentes são aplicadas em fila e nenhuma se perde.

**Rationale**: uma instrução é atômica por definição; saldo e histórico entram juntos ou não entram (spec US2
cenário 4). Elimina o `ConcurrencyConflictError` e o "tentar uma vez" do serviço atual.

**Alternatives considered**: transação interativa `BEGIN … SELECT … FOR UPDATE … COMMIT` — correta, mas
exige reter a conexão entre idas e voltas e é mais lenta em serverless; a instrução única dá a mesma garantia.
Nível `SERIALIZABLE` com retry — complexidade desnecessária para uma linha por dono.

## D4: Invariante "saldo = soma do histórico" garantido pelo banco

**Decision**: `CHECK (amount >= 0)` na tabela de saldo e uma consulta de auditoria
(`SELECT owner_id, saldo, soma_historico`) usada pela verificação (SC-003). Nenhuma escrita altera um lado sem
o outro (D3).

**Rationale**: a restrição torna impossível um saldo negativo mesmo se houver bug no serviço (FR-005).

## D5: Idempotência por `Idempotency-Key` opcional

**Decision**: `POST /coins/topup` e `/coins/debit` aceitam o cabeçalho opcional `Idempotency-Key`. A chave é
gravada em `coin_transactions` com `UNIQUE (owner_id, idempotency_key)`. Mesma chave + mesmo valor/direção →
devolve o resultado original sem reaplicar; mesma chave + valor diferente → `409 idempotency_key_conflict`.
Sem a chave, o comportamento é o atual.

**Rationale**: FR-007. A unicidade no banco evita a corrida entre dois pedidos com a mesma chave. É aditivo:
clientes existentes (`apps/web`) continuam funcionando sem mudança (FR-014).

**Alternatives considered**: chave só em memória/cache — perde-se entre instâncias serverless. Rejeitado.

## D6: Administradores no banco, mesmas garantias de segurança

**Decision**: tabela `admins(id, email UNIQUE, password_hash, role, created_at)`. `id` continua sendo o
`sha256` do e-mail normalizado (compatível com o token já emitido). O hash scrypt, o login indistinguível e o
`dummyHash` não mudam. O script `seed-admin.ts` lê `ADMIN_EMAIL`/`ADMIN_PASSWORD` do ambiente e usa o
repositório.

**Rationale**: FR-008/FR-009/FR-010 — só o armazenamento muda; nenhuma garantia de segurança é enfraquecida.

## D7: Migrações como SQL versionado + script idempotente

**Decision**: `db/migrations/NNN_*.sql` aplicados em ordem por `scripts/migrate.ts`, registrando o que já rodou
numa tabela `schema_migrations`. Rodado manualmente na implantação (passo do quickstart), não no *runtime* da
função.

**Rationale**: reprodutível e revisável no PR; evita DDL em tempo de requisição. Sem ORM novo (constituição:
sem dependências desnecessárias).

**Alternatives considered**: Prisma/Drizzle — adicionam toolchain e geração de código para 3 tabelas. Rejeitado.

## D8: Implantação — a correção do 404 já existe; falta implantar e promover

**Decision**: manter `framework: null` + `buildCommand: ""` + rewrite `/api/(.*)` → `/api/index`
(`apps/api/vercel.json`), implantar um preview, rodar `verify-deploy.mjs`, e só então promover a produção e
verificar o alias. Documentado no quickstart, com volta à versão anterior por `vercel rollback`.

**Rationale**: o preset `express` cria uma função catch-all que colide com `api/index.ts` (diagnóstico da 007
T022). A 007 provou o preview; faltou promover. Separar "corrigir o 404" de "trocar o banco" permite entregar
US1 sozinha (prioridade P1).

## D9: Verificação única e executável contra qualquer ambiente

**Decision**: `scripts/verify-deploy.mjs` com as checagens do contrato `verification-suite.md`, incluindo 50
operações concorrentes e tentativa de leitura direta sem credencial; reaproveita as funções de
`smoke-test.mjs`/`admin-smoke-test.mjs`. Sai com código ≠ 0 e mensagem clara se algo falhar (FR-012, US4).

**Rationale**: um comando prova o ambiente (SC-007, < 5 min). Contra preview protegido, aceita
`PROTECTION_BYPASS` como a 008.

## D10: Dados de demonstração antigos são descartados

**Decision**: produção começa com banco vazio; o admin inicial é recriado por `seed-admin`. Nada é migrado do
Blob. Os objetos antigos do store de Blob são removidos depois da troca (e o store, se não houver outro uso).

**Rationale**: Assumption da spec (dados de demonstração). Migrar saldo e hash de um armazenamento público só
para preservar dados fictícios não compensa; descartar também elimina o hash que já esteve exposto — e como ele
esteve legível, a senha do admin de demonstração deve ser **trocada** ao recriar o admin.

**Alternatives considered**: script de migração Blob → Postgres — mais código para dados sem valor, e
perpetuaria o hash exposto. Rejeitado.
