# Página `profile` — Perfil do colecionador

**Rota:** `/account/profile` (protegida: um visitante vai ao login e volta aqui depois de entrar)

Duas seções independentes, cada uma com o próprio botão de salvar (specs/014-user-profile):

- **Dados da conta** (`components/AccountSection.tsx`): nome de usuário, e-mail e troca de senha. É a conta
  simulada do site (`/api/account*`, domínio `auth`). O nome do cadastro não é editável aqui.
- **Perfil** (`components/ProfileSection.tsx`): nome de exibição, bio, nome ENS com domínio, apelido da carteira e
  foto. Vive no **serviço real** (`/backend/profile*`, domínio `profile`) e acompanha a conta em qualquer navegador.
  Nome ENS e apelido são opcionais.

Salvar uma seção nunca chama, depende de nem desfaz a outra: com o serviço do perfil fora do ar, a seção "Perfil"
mostra "Não foi possível carregar o perfil." com "Tentar novamente" (sem formulário com dados inventados) e a seção
"Dados da conta" continua funcionando.

**Usa os domínios:** `profile`, `auth`.
