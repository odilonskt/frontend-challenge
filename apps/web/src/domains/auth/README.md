# Domínio `auth`

Sessão (cadastro, login, logout, restauração após refresh, expiração).
Logout/troca de usuário limpam o cache privado e reconectam o socket com a nova sessão.

## A conta (specs/014-user-profile)

A **conta** é a identidade de login do colecionador: nome de usuário, e-mail e senha. É simulada no site
(`PATCH /api/account`, `POST /api/account/password`) e **nunca** vai para o serviço real. O nome do cadastro
(`SessionUser.name`) não é editável; ele só serve de valor inicial do nome de exibição do perfil, que mora em
`profile`.

- `useUpdateAccount()` grava usuário e e-mail e coloca o usuário devolvido direto no cache da sessão.
- `useChangePassword()` troca a senha (regras de hoje: pelo menos 8 caracteres, com letras e números).
- `useEnsureSession()` confere a sessão no servidor, sem cache. É para quem grava em um serviço que não conhece a
  sessão do site (o perfil): um `401` aciona o redirecionamento global ao login (`use-auth-error-redirect`).
