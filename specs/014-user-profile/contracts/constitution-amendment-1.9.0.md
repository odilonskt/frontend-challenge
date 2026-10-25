# Emenda 1.9.0 da constituição (1º entregável, bloqueia o código)

**Tipo**: MINOR (expansão material da lista de domínios da conta). **De**: 1.8.0. **Para**: 1.9.0.
**Motivação**: a spec 014 leva o perfil do colecionador para o serviço real; a 1.8.0 enumera os domínios permitidos e exige
emenda explícita para ampliar a lista. **Entrega**: PR só de documentação (`.specify/memory/constitution.md`), como a
PR #6 (1.8.0), aprovada por ao menos um responsável de time antes de qualquer tarefa de código.

## Mudanças no texto

1. **Escopo ampliado (1.8.0)**, nova entrada na lista:

   > - **Perfil** (1.9.0): nome de exibição, bio, nome ENS com domínio, apelido da carteira e foto, guardados em
   >   `apps/api` por dono. A foto é guardada como bytes no Postgres (PNG, JPEG ou WebP, até 1 MiB), e o tipo MUST ser
   >   verificado pelo conteúdo, nunca pelo nome do arquivo. Nome de usuário, e-mail e senha continuam na conta simulada
   >   do site, e `apps/api` MUST NOT guardá-los. A limitação de identidade é a mesma dos demais domínios da conta.

2. **Domínios da conta (1.8.0)** (na exceção de `apps/api`): trocar "ganha os domínios `favorites`, `purchases`, `offers`,
   `activity`, `downloads` e `support`" por "ganha os domínios `favorites`, `purchases`, `offers`, `activity`,
   `downloads`, `support` e `profile`". Acrescentar: "O `profile` tem rotas de dono atrás de `requireAuth` e **nenhuma**
   rota de administrador."

3. **Segurança**: sem mudança (a lista já diz que o perfil exige autenticação).

4. **Rodapé e cabeçalho**: `**Version**: 1.9.0 | **Ratified**: 2026-10-14 | **Last Amended**: <data do merge>`; atualizar o
   Sync Impact Report do topo do arquivo (versão 1.8.0 → 1.9.0, seção modificada, nenhum princípio removido).

## Impacto

- Nenhum princípio (I a VII) muda; nenhuma exceção é removida.
- Mock-first continua valendo no web: os testes Playwright seguem contra os mocks (`/backend/profile*` simulado).
- Sem plano de migração: o perfil do navegador não é copiado (decisão da spec).
