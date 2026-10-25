# Contrato: conta simulada do site (MSW, `/api/account*`)

Só existe nos mocks (a conta do colecionador é simulada; constituição: credenciais fictícias). Substitui os antigos
`PATCH /api/profile`, `PUT/DELETE /api/profile/avatar` e `POST /api/profile/password`, que **saem**. Autenticação: a
sessão do site (`Authorization: Bearer <token da sessão>`), como as demais rotas `/api`.

## `PATCH /api/account`

Corpo: `{ "username": "ana_s", "email": "ana@nft.dev" }`.

`200`: o `SessionUser` atualizado (`id`, `name`, `email`, `username`, `role`; **sem `avatarUrl`**).

`400 VALIDATION_ERROR` com `fields` em português, as mensagens de hoje: `username` "Use de 3 a 20 caracteres: letras
minúsculas, números ou _." / "Este nome de usuário é reservado."; `email` "Informe um e-mail válido.".
`409 CONFLICT` com `fields`: `username` "Este nome de usuário já está em uso."; `email` "Este e-mail já está em uso.".
`401` sem sessão. O nome do cadastro (`name`) **não** é aceito nem alterado aqui.

## `POST /api/account/password`

Corpo: `{ "currentPassword": "...", "newPassword": "..." }`. `204` em sucesso.
`400 VALIDATION_ERROR`: `newPassword` "A senha precisa de pelo menos 8 caracteres." / "Use letras e números na senha." /
"A nova senha deve ser diferente da atual."; `currentPassword` "A senha atual está incorreta.". `401` sem sessão.

## Regras

- Salvar a conta nunca toca o serviço do perfil (FR-016); o mock não depende de `/backend/profile*`.
- A atualização de e-mail e usuário reflete na sessão: o web grava o `SessionUser` devolvido no cache da sessão.
- A unicidade de e-mail e nome de usuário ignora o próprio registro (salvar sem mudar nada não conflita).
