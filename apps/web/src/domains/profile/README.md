# Domínio `profile`

O **perfil** do colecionador no **serviço real** (`apps/api`, pelo caminho `/backend/profile*`): nome de exibição,
bio, nome ENS com domínio, apelido da carteira e foto. Acompanha a conta em qualquer navegador
(specs/014-user-profile). Usuário, e-mail e senha **não** ficam aqui: são a conta do site, em `auth`.

## O que expõe

- `useProfile()`: o perfil como a página o mostra (`ProfileView`). Um colecionador que nunca salvou lê valores vazios
  do serviço, e a visão mostra o nome da conta no lugar do nome de exibição (FR-008).
- `useSaveProfile()`: grava os cinco campos de texto. `useUpdateAvatar()` e `useRemoveAvatar()`: a foto, que salva na
  hora e à parte do texto.
- `useProfileSummary()`: o que a barra de navegação mostra (`{ displayName, avatarUrl }`). **Nunca lança e nunca mostra
  erro**: carregando, com o serviço fora do ar ou sem perfil salvo, cai no nome da conta e no ícone padrão (FR-017).
- `profileFormSchema` e `profileFieldMessage`: as regras do formulário e a tradução dos códigos de campo do serviço
  (`too_short`, `too_long`, `invalid_format`, `invalid`, `too_large`) para as mensagens em português.

## Rede e cache

- O serviço real exige um token por dono (`POST /backend/auth/token`) e **não conhece a sessão do site**. Por isso
  `shared/api/backend-client.ts` cuida do token (em memória, renovado antes de expirar, uma renovação em `401`), e
  todo salvamento chama `useEnsureSession()` (de `auth`) antes: com a sessão do site expirada, o `401` leva ao login e
  nada é enviado ao serviço.
- Chaves por usuário: `['profile', userId]` e `['profile', 'avatar', userId, versão]`. O perfil tem `staleTime` de 5
  min e repete só falha transitória (rede, timeout, 5xx), no máximo duas vezes. A foto vem à parte (o JSON do perfil só
  traz `avatarVersion`) e é guardada por versão com `staleTime: Infinity`; ao enviar, o `dataUrl` enviado já é
  gravado sob a versão nova, sem buscar de novo.
- Logout e troca de usuário limpam o cache de token (`subscribeSessionToken`) e o cache de consultas.

## Limitações assumidas

- O serviço identifica o dono pelo identificador que o site pede ao emitir o token (o login do colecionador é
  simulado). Quem conhece o identificador de outra conta poderia ler e alterar o perfil dela; **isto não é proteção
  completa contra tomada de conta** (ver `apps/api/README.md`).
- Perfis que existiam no armazenamento do navegador não foram migrados (eram dados de demonstração).
