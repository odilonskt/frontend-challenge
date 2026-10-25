# Data Model: Perfil do colecionador que acompanha a conta

Dois contextos delimitados, sem armazenamento compartilhado: **conta** (site, simulada) e **perfil** (serviço real).
O elo entre eles é só o identificador do usuário (`SessionUser.id`), usado como `ownerId` no token do serviço real.

## Serviço real (`apps/api`, Postgres via Prisma)

### `Profile` → tabela `profiles`

| Campo | Tipo | Regra |
|-------|------|-------|
| `ownerId` (PK, `owner_id`) | texto | vem do `sub` do token verificado; nunca do corpo |
| `displayName` (`display_name`) | texto | 3 a 60 caracteres, depois de aparar |
| `bio` | texto, padrão `''` | até 280, depois de aparar |
| `ensName` (`ens_name`) | texto, padrão `''` | vazio ou `^[a-z0-9][a-z0-9-]{2,39}$` |
| `ensTld` (`ens_tld`) | texto, padrão `.eth` | um de `.eth`, `.xyz`, `.art` |
| `walletNickname` (`wallet_nickname`) | texto, padrão `''` | até 40, depois de aparar |
| `updatedAt` (`updated_at`) | timestamptz | gravado pelo servidor a cada `PUT` (`@updatedAt`) |

Uma linha por dono (no máximo). Sem linha = "nunca salvou" (a API responde valores vazios, `updatedAt: null`).

### `ProfileAvatar` → tabela `profile_avatars`

| Campo | Tipo | Regra |
|-------|------|-------|
| `ownerId` (PK, `owner_id`) | texto | sem FK para `profiles`: a foto pode existir antes do primeiro salvamento do perfil |
| `contentType` (`content_type`) | texto | `image/png`, `image/jpeg` ou `image/webp`; **detectado pelos bytes** |
| `data` | bytea | de 1 a 1.048.576 bytes |
| `byteSize` (`byte_size`) | inteiro | igual ao tamanho de `data` |
| `updatedAt` (`updated_at`) | timestamptz | vira o `avatarVersion` do perfil |

CHECKs escritos à mão na migração `1_profile` (o Prisma não modela CHECK, como na `0_init`): `byte_size BETWEEN 1 AND
1048576`, `content_type IN (...)`, `char_length(display_name) BETWEEN 3 AND 60`, `char_length(bio) <= 280`,
`char_length(wallet_nickname) <= 40`, `ens_tld IN ('.eth','.xyz','.art')`. O banco reforça o que o serviço valida.

### Transições de estado

```text
sem registro ──PUT /profile──▶ salvo ──PUT /profile──▶ salvo (substituição, último vence)
sem foto ──PUT /profile/avatar──▶ com foto ──PUT──▶ com foto (substitui) ──DELETE──▶ sem foto ──DELETE──▶ sem foto
```

Nenhuma transição apaga o outro lado: remover a foto não altera o texto e salvar o texto não altera a foto.

## Site (`apps/web`)

### Contexto **conta** (`domains/auth`, MSW `/api`)

`SessionUser`: `id`, `name` (nome do cadastro, não editável), `email`, `username`, `role`. **Perde `avatarUrl`.**
`UpdateAccountRequest`: `{ username, email }` (regras e unicidade de hoje: `^[a-z0-9_]{3,20}$` sem nomes reservados;
e-mail válido e único). `ChangePasswordRequest`: `{ currentPassword, newPassword }` (regras de hoje). `UserRecord`
(mock) **perde** `bio`, `ensName`, `ensTld`, `walletNickname`, `avatarUrl`.

### Contexto **perfil** (`domains/profile`, serviço real em `/backend`)

- `ProfileResponse` (o que a API devolve): `displayName`, `bio`, `ensName`, `ensTld`, `walletNickname`, `avatarVersion`
  (ISO ou `null`), `updatedAt` (ISO ou `null`).
- `ProfileView` (o que a tela usa): o `ProfileResponse` com `displayName` já substituído pelo nome da conta quando vazio,
  mais `avatarUrl` (data URL ou `null`) montado a partir da consulta da foto.
- `ProfileSummary` (barra de navegação): `{ displayName, avatarUrl }`; sempre definido para quem tem sessão (cai no nome
  da conta e no ícone).
- `UpdateProfileRequest`: `displayName`, `bio`, `ensName`, `ensTld`, `walletNickname`. `UpdateAvatarRequest`:
  `{ dataUrl }` (`data:image/(png|jpeg|webp);base64,...`).
- `ProfileFieldCode` → mensagem em português (as de hoje): `too_short` "Informe pelo menos 3 caracteres.", `too_long`
  (60/280/40, "Use no máximo N caracteres."), `invalid_format` (ENS) "Use de 3 a 40 letras minúsculas, números ou hífen.",
  `invalid` (domínio) "Domínio ENS inválido.", foto `invalid_format` "Envie uma imagem PNG, JPEG ou WebP.", `too_large`
  "A imagem deve ter no máximo 1 MB."

### Estado do mock do serviço (`nft-mock:backend-profile`, esquema próprio versão 1)

```text
{ profiles: Record<ownerId, { displayName, bio, ensName, ensTld, walletNickname, updatedAt }>,
  avatars:  Record<ownerId, { contentType, dataUrl, updatedAt }> }
```

Limpo por `mockControls.reset`; não faz parte do `store` do site.

## Regras entre contextos

- Salvar "Dados da conta" nunca chama o serviço do perfil, e salvar "Perfil" nunca chama `/api/account` (FR-016).
- O nome de exibição vazio no serviço significa "usar o nome do cadastro" (FR-008 e FR-017); o serviço nunca recebe o nome
  do cadastro.
- Pedidos, recibos e qualquer registro emitido não leem o perfil (FR-013): `Order.collector.fullName` continua sendo o
  snapshot do checkout.
- Nada do perfil aparece para outras contas, visitantes ou administradores (FR-015); a busca de usuários do admin lê só a
  conta (`AdminUserDetail` perde `bio` e `avatarUrl`).
