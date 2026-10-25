# Research: Perfil do colecionador que acompanha a conta

Fase 0 do plano. Nenhuma incógnita ficou pendente; cada item abaixo é uma decisão técnica que a spec deixou em aberto de
propósito. Fatos citados foram verificados no repositório em 2026-10-25.

## D1. Governança: emenda 1.9.0 antes de qualquer código

- **Decisão**: abrir uma PR só de documentação que emenda a constituição para 1.9.0 (MINOR: expansão material),
  acrescentando `profile` à lista de domínios da conta do serviço real. Texto em
  [contracts/constitution-amendment-1.9.0.md](./contracts/constitution-amendment-1.9.0.md). O `tasks.md` terá uma tarefa
  de bloqueio no topo: nenhuma tarefa de código começa antes do merge.
- **Razão**: a 1.8.0 diz que "qualquer expansão futura desta exceção exige nova emenda explícita" e enumera os seis
  domínios; `profile` não está lá. O mesmo caminho foi usado antes (PR #6 emendou para 1.8.0 antes da spec 015).
- **Alternativas**: (a) implementar e emendar depois → o código nasceria em violação e `/speckit-analyze` o
  reprovaria; (b) encaixar o perfil em `favorites`/`support` → mentira de modelagem.

## D2. Divisão dos dados: conta no site, perfil no serviço real

- **Decisão**: **conta** (nome de usuário, e-mail, senha, papel, suspensão, nome do cadastro) continua na conta
  simulada do site, em `domains/auth` e MSW `/api`. **Perfil** (nome de exibição, bio, nome ENS e domínio, apelido da
  carteira, foto) vai para `apps/api`. O nome do cadastro (`SessionUser.name`) deixa de ser editável e passa a ser só o
  valor inicial do nome de exibição.
- **Razão**: usuário e e-mail são a credencial de login (a constituição exige credenciais fictícias e login simulado);
  guardá-los nos dois lugares criaria duas fontes de verdade para o login, e a API não deve conhecê-los (FR-012). A
  decisão já foi tomada na spec e confirmada em `/speckit-clarify` (duas seções, cada uma salva por si).
- **Alternativas**: mover tudo para a API (exigiria login real, fora do escopo); manter um formulário só com gravação
  em dois lugares (rejeitada na clarificação: sucesso parcial sem controle).

## D3. Forma do serviço: `/profile` como recurso do dono

- **Decisão**: cinco rotas atrás de `requireAuth` (o dono vem só de `req.ownerId`, nunca do corpo):
  `GET /profile`, `PUT /profile`, `GET /profile/avatar`, `PUT /profile/avatar`, `DELETE /profile/avatar`.
  `PUT /profile` **substitui** os cinco campos de texto (cria no primeiro uso). `GET /profile` de um dono sem registro
  responde **200 com valores vazios e `updatedAt: null`**, não 404. Contratos em
  [contracts/profile-endpoints.md](./contracts/profile-endpoints.md).
- **Razão**: o primeiro acesso (FR-008) não é erro, e o 404 faria a tela tratar "ainda não salvou" como falha. A
  substituição integral casa com um formulário que sempre envia todos os campos e dá idempotência de graça (D5).
- **Alternativas**: `PATCH` parcial (sem ganho, o formulário envia tudo; abre espaço a campos esquecidos); `POST` de
  criação separado (duas operações onde uma basta).

## D4. Foto: bytes no Postgres, conferidos pelo conteúdo, versão no perfil

- **Decisão**: tabela própria `profile_avatars` com `BYTEA` (até 1 MiB), separada de `profiles` para que ler o perfil
  nunca puxe a imagem. A API **detecta o tipo pelos bytes** (assinatura PNG `89 50 4E 47 0D 0A 1A 0A`, JPEG `FF D8 FF`,
  WebP `RIFF????WEBP`) e exige que combine com o tipo declarado no data URL; tamanho decodificado de 1 a 1.048.576 bytes
  (CHECK também no banco). A foto trafega como **data URL em JSON** (`PUT {dataUrl}`; `GET` devolve `{dataUrl}`), porque
  `<img src>` não envia o cabeçalho `Authorization`. O JSON do perfil traz só `avatarVersion` (instante da última troca,
  ou `null`); o web busca a imagem à parte e a guarda em cache por versão (D9).
- **Razão**: FR-005 pede verificação do conteúdo, não do nome; a constituição manda dado estruturado para o Postgres e o
  Blob só serve URL pública. Separar a imagem evita baixar até 1,4 MB (base64) em toda página, já que a barra de
  navegação lê o perfil em todas.
- **Alternativas**: Vercel Blob (URL pública e sem dono, contra a privacidade da foto e contra a direção "Blob →
  Postgres" da 010); foto dentro do JSON do perfil (peso em toda página, Lighthouse); rota `GET` que devolve o binário
  (exigiria buscar com `fetch` autenticado e criar URL de objeto, mais código sem ganho para o demo).

## D5. Concorrência e idempotência

- **Decisão**: sem `Idempotency-Key` e sem versão otimista. `PUT /profile` e `PUT /profile/avatar` são substituições, e
  `DELETE /profile/avatar` é idempotente (responde 200 mesmo sem foto). O **último salvamento vence**; `updatedAt` é
  gravado pelo servidor (`@updatedAt`) e devolvido, e a tela o mostra.
- **Razão**: FR-009 e FR-010. Cinco `PUT` iguais deixam o mesmo estado (SC-006); a spec rejeita aviso de conflito. A chave
  de idempotência existe para operações que somam (moedas), e perfil não soma.
- **Alternativas**: `If-Match`/versão para detectar edição simultânea (fora da decisão da spec; mais UI para um caso raro).

## D6. Corpo da requisição e erros do Express

- **Decisão**: o `app.ts` hoje usa `express.json()` global (limite de 100 kB). Montar **antes** dele um parser com limite de
  2 MB só em `/api/profile/avatar` (o `body-parser` ignora corpos já lidos). Em `lib/errors.ts`, mapear os erros do parser
  para o envelope: JSON inválido → `400 invalid_json`; corpo acima do limite → `413 payload_too_large`.
- **Razão**: 1 MiB de imagem vira ~1,4 MB em base64, bem acima de 100 kB; sem isso nenhuma foto seria salva. Hoje esses
  erros caem no ramo genérico e viram `500 internal_error`, o que é errado para o cliente; o 413 permite ao web mostrar
  "no máximo 1 MB". O teto de 2 MB fica abaixo do limite de 4,5 MB de corpo da Vercel.
- **Alternativas**: subir o limite global (alarga a superfície de todas as rotas); upload multipart (nova dependência).

## D7. Validação, erros por campo e regras opcionais

- **Decisão**: erro de validação do perfil = `400` com
  `{ error: { code: "validation_error", message, fields: { <campo>: <código> } } }`. A API devolve **códigos**; o web
  traduz para as mensagens em português que já existem hoje. Regras (as da spec/FR-003): `displayName` com aparas, 3 a 60
  (`too_short`, `too_long`); `bio` com aparas, até 280 (`too_long`); `ensName` vazio ou `^[a-z0-9][a-z0-9-]{2,39}$`
  (`invalid_format`); `ensTld` ∈ `.eth`, `.xyz`, `.art` (`invalid`); `walletNickname` com aparas, até 40 (`too_long`);
  foto: `invalid_format`, `too_large`. A mesma regra roda no web (Zod, antes de enviar) e na API (Zod, na borda).
- **Nome ENS e apelido opcionais**: o formulário atual **exige** os dois (regex sem a opção vazia; `min(1)` no apelido),
  mas a spec diz que o ENS pode ficar vazio e que o primeiro acesso mostra "os demais campos vazios". Segue-se a spec e o
  formulário é relaxado; o mock do serviço atual já aceitava vazio, então o comportamento do servidor não muda.
- **Razão**: o envelope atual da API não tem campos; códigos mantêm a API sem texto de interface (as mensagens atuais da
  API são em inglês) e o web já tem `domains/ledger/model/messages.ts` como precedente de tradução por código.
- **Alternativas**: pacote compartilhado de schemas (`packages/*` é permitido, mas é escopo novo; as regras são cinco
  linhas, e o e2e e o roteiro da API fecham a divergência); mensagens em português na API (acopla texto de interface ao
  serviço).

## D8. Cliente web do serviço real: módulo compartilhado, `ledger` intacto

- **Decisão**: extrair para `shared/api/backend-client.ts` (sem importar `domains/`) a lógica que hoje vive em
  `domains/ledger/api/client.ts`: instância Axios em `/backend`, token por dono guardado em memória e renovado 30 s antes
  de expirar, emissão compartilhada entre chamadas simultâneas, **uma** renovação em 401, limpeza do cache em
  login/logout/troca de usuário (`subscribeSessionToken`) e erro normalizado (`BackendError` com `status`, `code`,
  `fields`). O `profile` usa o módulo; **`ledger` e `coins-admin` não são migrados nesta feature**.
- **Razão**: a 015 precisará do mesmo cliente; migrar moedas agora arriscaria regressão numa área estável sem ganho para o
  perfil. Registrado como dívida de acompanhamento.
- **Alternativas**: copiar o cliente do `ledger` (terceira cópia com a 015); fazer o `profile` importar `domains/ledger`
  (Princípio I proíbe domínio importar domínio).

## D9. Estado remoto no web e a barra de navegação

- **Decisão**: chaves por usuário: `['profile', userId]` e `['profile', 'avatar', userId, avatarVersion]`. O perfil usa
  `staleTime` de 5 min e repete só falha transitória (rede, timeout, 5xx); a foto usa `staleTime: Infinity` porque a
  versão está na chave. `useSaveProfile`, `useUpdateAvatar` e `useRemoveAvatar` gravam a resposta no cache com
  `setQueryData`, então a barra de navegação atualiza sem recarregar (SC-009). `useProfileSummary()` entrega
  `{ displayName, avatarUrl }` para a barra: usa o nome de exibição quando existe, senão o nome da conta (`SessionUser.name`);
  sem foto, o ícone padrão. Falha ou demora do serviço **não** mostra erro na barra: ela cai no nome da conta e no ícone.
  A barra passa a renderizar `shared/ui/avatar` com `ProfileIcon` de reserva.
- **Razão**: FR-017 e Princípio III. Hoje `SessionUser.avatarUrl` chega à barra, mas ela só desenha o ícone (o campo é
  ignorado); com a foto saindo da conta, o campo some do contrato da sessão. Com o ícone como reserva, as baselines
  visuais de quem não tem foto não mudam.
- **Alternativas**: guardar o resumo no contexto de sessão (duplica o cache); mostrar erro na barra (a navegação não pode
  falhar por causa do perfil).

## D10. Mocks (Princípio V)

- **Decisão**: (1) `mocks/contexts/profile-backend/` simula o serviço do perfil sob `env.backendBaseUrl`, ligado só com
  `enableBackendMocks`, com **as mesmas regras e códigos** da API (inclui a checagem por assinatura de bytes sobre o
  base64) e estado em chave **própria** do `localStorage` (`nft-mock:backend-profile`), limpa por `mockControls.reset`.
  A identidade vem do mesmo emissor de token do mock de moedas (`LedgerService.authenticate`), pois é o mesmo serviço
  real. (2) A conta vira `PATCH /api/account` (nome de usuário e e-mail, com as regras de unicidade atuais) e
  `POST /api/account/password` em `mocks/contexts/auth`; `mocks/contexts/profile` é removido. (3) Novo cenário
  `profile-unavailable` ("Perfil indisponível", `/backend/profile*` responde 503, o resto do serviço segue), para provar
  FR-016 (a conta salva com o perfil fora do ar) sem derrubar as moedas.
- **Razão**: estado numa chave própria modela um serviço separado da conta e é aditivo (nada do estado persistido atual
  muda, então não há versão de esquema a subir). `UserRecord` perde `bio`, ENS, apelido e foto; registros antigos com
  esses campos soltos são ignorados em execução.
- **Alternativas**: guardar o perfil no estado do site (apaga a fronteira entre conta e serviço e mente sobre o que é
  persistido onde); subir a versão do esquema (apagaria carrinhos, pedidos e carteiras de demonstração sem necessidade).

## D11. Verificação

- **Decisão**: (1) **Playwright** (`e2e/profile/profile.spec.ts`) contra os mocks: ver e salvar, recarregar, erros por
  campo, foto válida/inválida/grande, remoção, primeiro acesso, serviço fora do ar ao abrir e ao salvar, conta salva com o
  perfil fora do ar, isolamento entre duas contas, barra de navegação atualizando, redirecionamento do visitante, axe e
  visuais em 390/768/1440. (2) **Roteiro da API** (`scripts/profile-smoke-test.mjs`, com `smoke-test:profile`) contra uma
  instância real: dois tokens do mesmo dono veem o mesmo perfil (a prova de "outro navegador"), outro dono não vê nada,
  admin recebe 403, sem token 401, validação por campo, cinco `PUT` iguais, foto de ~1 MiB aceita e 1 MiB + 1 recusada,
  arquivo que não é imagem com extensão de imagem recusado, `DELETE` duas vezes. (3) **Manual** (quickstart): dois
  navegadores reais contra a prévia publicada.
- **Razão**: o Playwright não pode apontar para `apps/api` (constituição) e cada navegador tem seu próprio mock, então
  SC-001 só se prova com a API real. Dois tokens do mesmo dono provam a persistência no servidor, e o passo manual fecha o
  ciclo com navegadores de verdade.
- **Alternativas**: testes de integração da API com banco de teste (exigiria infraestrutura nova); só e2e (não prova
  SC-001).

## D12. Efeitos colaterais e dados antigos

- **Decisão**: `AdminUserDetail` perde `bio` e `avatarUrl` (nenhuma tela do admin nem e2e os usa; a spec exclui o perfil
  do admin). `SessionUser` perde `avatarUrl`. O `PATCH /api/profile` e o `PUT/DELETE /api/profile/avatar` do MSW saem,
  junto com a troca de senha em `/api/profile/password`, que passa para `/api/account/password`. Perfis do `localStorage`
  não são migrados (decisão da spec).
- **Razão**: manter campos mortos no contrato mente sobre o que existe. Os dois campos do admin só existiam porque a
  conta guardava o perfil.
- **Alternativas**: manter os campos no admin, sempre vazios (contrato que mente).
