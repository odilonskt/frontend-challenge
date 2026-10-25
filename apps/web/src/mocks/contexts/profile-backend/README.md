# Mock `profile-backend`: o perfil do serviço real

Simula, sob `/backend/profile*`, o perfil do colecionador do serviço real (`apps/api`; specs/014-user-profile,
contracts/profile-endpoints.md). Só é registrado quando `env.enableBackendMocks` está ligado (dev e e2e); em produção o
`/backend` chega ao serviço de verdade.

- **Mesmas regras e códigos da API**, escritos de forma independente do formulário do site: nome de exibição de 3 a 60
  caracteres, bio até 280, ENS vazio ou `^[a-z0-9][a-z0-9-]{2,39}$`, domínio `.eth|.xyz|.art`, apelido até 40; tudo
  conta **caracteres** (pontos de código); todos os campos inválidos voltam juntos em `error.fields`. A foto: PNG, JPEG ou
  WebP, até 1.048.576 bytes **decodificados** (calculado antes de decodificar), tipo conferido pela **assinatura dos
  bytes** e igual ao declarado. O e2e (`e2e/profile`) compara os códigos com os do roteiro da API real.
- **Estado em chave própria** do `localStorage` (`nft-mock:backend-profile`, versão 1), fora do `store` do site: é outro
  serviço, e precisa sobreviver a um recarregamento como um servidor sobreviveria. `mockControls.reset` o limpa. Cada
  navegador tem o seu: a prova de "outro navegador" está no roteiro da API (`pnpm smoke-test:profile:local`) e no
  quickstart, não aqui.
- **Identidade**: o dono vem **só** do token, emitido pelo mesmo emissor do mock de moedas (`LedgerService`), porque é o
  mesmo serviço. Token ausente ou inválido responde `401`.
- **Cenário `profile-unavailable`**: todas as rotas `/backend/profile*` respondem `503`; moedas e conta seguem.
- Isto **não** é proteção de verdade: é uma simulação para desenvolvimento e testes.
