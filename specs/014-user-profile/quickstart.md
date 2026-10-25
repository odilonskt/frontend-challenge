# Quickstart: validar o perfil que acompanha a conta

Guia de validação. Os contratos estão em [contracts/](./contracts/) e as regras em [data-model.md](./data-model.md).

## 0. Pré-requisito

A emenda 1.9.0 da constituição precisa estar mergeada (ver
[contracts/constitution-amendment-1.9.0.md](./contracts/constitution-amendment-1.9.0.md)). Sem ela, não há código.

## 1. Site contra os mocks (dev e e2e)

```bash
pnpm install
pnpm --dir apps/web dev          # MSW responde /api/* e /backend/* (enableBackendMocks)
```

1. Criar uma conta, abrir **Conta → Dados do perfil**: a seção "Perfil" mostra o nome do cadastro e os demais campos
   vazios; "Dados da conta" mostra usuário e e-mail.
2. Preencher a seção "Perfil" e salvar: confirmação visível; recarregar e ver os mesmos valores; a etiqueta da conta na
   barra de navegação mostra o nome de exibição **sem recarregar** ao salvar.
3. Enviar uma foto PNG/JPEG/WebP de até 1 MB: aparece no perfil e na barra de navegação; enviar um `.txt` renomeado
   `.png` e uma imagem acima de 1 MB: mensagem do motivo e a foto atual continua.
4. Cenário **Perfil indisponível** (abrir o site com `?scenario=profile-unavailable` ou, no console do navegador,
   `window.__nftMock.scenario.select('profile-unavailable')`): abrir o perfil mostra "Não foi possível carregar o perfil." com
   "Tentar novamente"; salvar "Dados da conta" (trocar o e-mail) **funciona**; salvar "Perfil" mostra a falha e mantém o
   digitado.

```bash
pnpm typecheck && pnpm lint && pnpm build
pnpm --dir apps/web exec playwright test e2e/profile
pnpm --dir apps/web exec playwright test            # suíte completa: nenhuma baseline antiga muda
```

Esperado: tudo verde; nenhuma baseline visual de quem não tem foto muda (o ícone é a reserva); as baselines novas de
`e2e/profile/` são revisadas uma a uma antes de gravar.

## 2. API real (local, banco de desenvolvimento)

```bash
cd apps/api
# .env.local com DATABASE_URL, DATABASE_URL_UNPOOLED e AUTH_JWT_SECRET (README, seção Setup)
pnpm db:migrate                                   # aplica 1_profile (banco de DEV, nunca produção)
pnpm dev:local                                    # http://localhost:4001
AUTH_JWT_SECRET=<o mesmo> BASE_URL=http://localhost:4001/api pnpm smoke-test:profile
```

Esperado: todas as verificações `✓`, incluindo persistência entre dois tokens do mesmo dono, isolamento entre donos,
`403` para token de admin, foto de ~1 MiB aceita e de 1 MiB + 1 recusada, `413` e `400 invalid_json`.

## 3. Dois navegadores reais (SC-001), contra a prévia publicada

1. Navegador A (Chrome): entrar com `ana@nft.dev`, salvar nome, bio, ENS e uma foto.
2. Navegador B (outro perfil de navegador ou janela anônima): entrar com a mesma conta, abrir o perfil: mesmos valores e
   mesma foto, em até 5 s.
3. No B, trocar a bio; no A, recarregar: a bio nova aparece e a data da última alteração mudou.
4. No B, remover a foto; no A, recarregar: sem foto na página e na barra de navegação.

## 4. Publicação (ação externa: só com confirmação do dono do projeto)

Ordem: (1) aplicar a migração `1_profile` no banco de produção (`prisma migrate deploy`), (2) publicar a API, (3)
publicar o site. Depois repetir a seção 3 em produção. Não publicar o site antes da API: em produção o site chama o
serviço real.
