# Contrato: serviço real do perfil (`apps/api`, `/api/profile*`)

Visto pelo site em `/backend/profile*` (o proxy do Vite e o `vercel.json` mapeiam `/backend/*` para `/api/*`). O mock do
site (`mocks/contexts/profile-backend`) MUST responder exatamente isto, com as mesmas regras e códigos.

**Autenticação**: `Authorization: Bearer <token de dono>` em todas as rotas (token de `POST /auth/token`, já existente).
O dono é o `sub` do token. Sem token: `401 missing_token`; token inválido ou expirado: `401 invalid_token`; **token de
admin: `403 wrong_token_type`**. Não existe rota de perfil para administrador.

**Envelope de erro** (o existente): `{ "error": { "code": "...", "message": "..." } }`. O erro de validação ganha `fields`.

## `GET /profile`

`200`:

```json
{
  "displayName": "Ana Souza",
  "bio": "",
  "ensName": "ana",
  "ensTld": ".eth",
  "walletNickname": "Principal",
  "avatarVersion": "2026-10-25T14:03:11.482Z",
  "updatedAt": "2026-10-25T14:05:40.019Z"
}
```

Dono que nunca salvou: `200` com `displayName: ""`, `bio: ""`, `ensName: ""`, `ensTld: ".eth"`, `walletNickname: ""`,
`avatarVersion: null` (ou a versão da foto, se só a foto existir) e `updatedAt: null`. Nunca `404`.

## `PUT /profile`

Corpo (substitui os cinco campos; cria no primeiro uso):

```json
{ "displayName": "Ana Souza", "bio": "", "ensName": "ana", "ensTld": ".eth", "walletNickname": "Principal" }
```

`200`: o mesmo formato do `GET`, com o `updatedAt` novo. Idempotente: o mesmo corpo repetido deixa o mesmo estado.
`400 validation_error`:

```json
{ "error": { "code": "validation_error", "message": "Invalid profile.", "fields": { "bio": "too_long" } } }
```

Códigos por campo: `displayName` → `too_short` | `too_long`; `bio` → `too_long`; `ensName` → `invalid_format`; `ensTld` →
`invalid`; `walletNickname` → `too_long`. Campo ausente ou de tipo errado → o código do campo é `invalid`. Todos os campos
com problema voltam juntos; nada é gravado se algum falhar.

## `GET /profile/avatar`

`200`: `{ "dataUrl": "data:image/png;base64,...", "version": "2026-10-25T14:03:11.482Z" }`.
Sem foto: `404 no_avatar`.

## `PUT /profile/avatar`

Corpo: `{ "dataUrl": "data:image/(png|jpeg|webp);base64,..." }`. Parser JSON próprio de **2 MB** nesta rota.
`200`: o mesmo formato do `GET /profile` (com o `avatarVersion` novo). Substitui a foto anterior.

`400 validation_error` com `fields.avatar`:

- `invalid_format`: não é um data URL de PNG/JPEG/WebP, o base64 é inválido, os bytes **não têm a assinatura** do tipo
  declarado (um `.png` que não é imagem), ou o tipo declarado diverge do detectado;
- `too_large`: mais de 1.048.576 bytes depois de decodificar.

`413 payload_too_large`: corpo acima de 2 MB (antes de decodificar). Corpo que não é JSON: `400 invalid_json`.

## `DELETE /profile/avatar`

`200`: o mesmo formato do `GET /profile`, com `avatarVersion: null`. Idempotente: sem foto também responde `200`.

## Documentação e verificação

- As cinco operações entram no OpenAPI (`/api/openapi.json`, `/api/docs`), gerado dos mesmos schemas Zod, com os códigos
  acima, o esquema `bearerAuth` e a tag `profile`.
- `scripts/profile-smoke-test.mjs` cobre: persistência entre dois tokens do mesmo dono, isolamento entre donos, `401`,
  `403` para admin, validação por campo, cinco `PUT` iguais, foto de ~1 MiB aceita e de 1 MiB + 1 recusada, arquivo
  falso recusado, `DELETE` repetido, `413` e `400 invalid_json`.
