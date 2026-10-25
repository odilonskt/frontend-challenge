# Feature Specification: Perfil do colecionador que acompanha a conta

**Feature Branch**: `014-user-profile`

**Created**: 2026-10-25

**Status**: Draft

**Input**: User description: "da uma analisar e monta com skills" — analisar o estado do projeto e especificar, pelo fluxo Spec Kit, a feature reservada como 014 (perfil do usuário), escolhida pelo usuário entre as opções apresentadas.

Fatos verificados no repositório (2026-10-25), para situar quem lê:

1. A página **Perfil do colecionador** (`/account/profile`) já existe: nome de exibição, nome de usuário, e-mail, bio,
   nome ENS com domínio, apelido da carteira, foto e troca de senha, com mensagens de erro por campo.
2. Esses dados vivem só na **simulação do navegador** (armazenamento local). Quem entra com a mesma conta em outro
   navegador, ou limpa os dados do navegador, **perde o perfil**.
3. A **spec 015** (conta: lista de interesse, arquivos baixados, ofertas, suporte, atividade) leva os dados da conta
   para o **serviço real** da plataforma, por usuário, e reserva o número 014 para o perfil. Esta feature segue o mesmo
   padrão.
4. A constituição **1.8.0** lista quais dados da conta o serviço real guarda; o **perfil não está nessa lista**, e
   qualquer expansão exige emenda explícita (ver Assumptions).
5. O login e a senha do colecionador continuam **fictícios e simulados** (constituição: "credenciais fictícias
   apenas"). Esta feature **não** introduz login real.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Meu perfil em qualquer navegador (Priority: P1)

O colecionador abre "Dados do perfil" no menu da conta, edita nome de exibição, bio, nome ENS e apelido da carteira, e
salva. Ao entrar com a mesma conta em outro navegador (ou depois de limpar os dados do navegador), vê exatamente os
dados que salvou.

**Why this priority**: É a razão da feature: hoje o perfil parece da conta, mas some fora do navegador em que foi
preenchido. Entrega valor sozinha e prova a ligação do perfil com o serviço real.

**Independent Test**: Entrar, preencher e salvar o perfil, abrir o endereço do perfil em outro navegador com a mesma
conta e ver os mesmos valores; editar um campo, salvar, recarregar e ver o valor novo.

**Acceptance Scenarios**:

1. **Given** um colecionador autenticado com perfil salvo, **When** abre o perfil em qualquer navegador, **Then** vê os
   dados salvos, e nenhum valor de outra conta.
2. **Given** o formulário preenchido com valores válidos, **When** salva, **Then** vê a confirmação de que foi salvo e
   os mesmos valores continuam depois de recarregar a página.
3. **Given** um campo inválido (bio com mais de 280 caracteres, nome ENS fora do formato, apelido da carteira com mais
   de 40 caracteres, nome vazio), **When** tenta salvar, **Then** o campo mostra a mensagem do problema, nada é salvo e
   o que o usuário digitou nos outros campos é mantido.
4. **Given** um visitante sem sessão, **When** abre a rota do perfil, **Then** é levado ao login e, depois de entrar,
   volta ao perfil.
5. **Given** dois colecionadores diferentes, **When** cada um abre o próprio perfil, **Then** cada um vê só os próprios
   dados, e nenhum caminho do site permite ler ou alterar o perfil do outro.

---

### User Story 2 - Foto de perfil que me acompanha (Priority: P2)

O colecionador envia, troca ou remove a foto do perfil. A foto escolhida aparece em qualquer navegador em que ele entre
com a mesma conta.

**Why this priority**: A foto é o dado mais "visível" do perfil e o mais pesado; separá-la da P1 mantém a P1 como fatia
mínima e deixa as regras de tamanho e formato testáveis à parte.

**Independent Test**: Enviar uma imagem válida, ver a foto no perfil, abrir em outro navegador e ver a mesma foto;
remover e ver o retorno ao estado sem foto nos dois navegadores.

**Acceptance Scenarios**:

1. **Given** um colecionador sem foto, **When** envia uma imagem PNG, JPEG ou WebP de até 1 MB, **Then** a foto aparece
   no perfil e continua lá depois de recarregar e em outro navegador.
2. **Given** um colecionador com foto, **When** envia outra imagem válida, **Then** a nova substitui a anterior, e a
   anterior deixa de ser exibida em qualquer lugar.
3. **Given** um arquivo que não é PNG, JPEG ou WebP, ou com mais de 1 MB, **When** tenta enviar, **Then** vê a mensagem
   do problema e a foto atual não muda.
4. **Given** um colecionador com foto, **When** remove a foto, **Then** volta ao estado sem foto, e continua assim
   depois de recarregar e em outro navegador.

---

### User Story 3 - Primeiro acesso, falhas e edições em dois lugares (Priority: P3)

Uma conta que nunca salvou o perfil abre a página e vê valores iniciais razoáveis em vez de erro. Quando o serviço está
indisponível, o usuário recebe uma mensagem clara e não perde o que digitou. Quando a mesma conta edita em dois
navegadores, o resultado é previsível.

**Why this priority**: Cobre os casos que fazem a P1 parecer quebrada na prática, mas só importam depois que a P1 existe.

**Independent Test**: Abrir o perfil de uma conta recém-criada; derrubar o serviço (cenário de falha) e tentar salvar;
editar o mesmo campo em dois navegadores e conferir qual valor fica.

**Acceptance Scenarios**:

1. **Given** uma conta que nunca salvou o perfil, **When** abre a página, **Then** vê o formulário com o nome que usou
   no cadastro e os demais campos vazios, e o primeiro salvamento cria o perfil.
2. **Given** o serviço indisponível ao abrir, **When** a página carrega, **Then** vê "Não foi possível carregar o
   perfil." com "Tentar novamente", e o formulário não aparece com dados falsos.
3. **Given** o serviço indisponível ao salvar, **When** o usuário envia o formulário, **Then** vê uma mensagem de falha,
   os valores digitados continuam no formulário e salvar de novo depois funciona.
4. **Given** a mesma conta aberta em dois navegadores, **When** os dois salvam valores diferentes, **Then** vale o
   último salvamento, quem recarregar o outro navegador vê esse valor, e o perfil mostra a data da última alteração.
5. **Given** um salvamento enviado duas vezes por duplo clique ou nova tentativa depois de resposta perdida, **When** o
   serviço o recebe, **Then** o resultado é o mesmo de enviar uma vez só.

---

### Edge Cases

- **Nome ENS** vazio é permitido (campo opcional); preenchido, segue o formato já validado hoje (3 a 40 letras
  minúsculas, números ou hífen) e um dos três domínios permitidos.
- **Bio com espaços nas pontas** e **apelido da carteira só com espaços**: os espaços são ignorados antes de validar e
  de salvar.
- **Imagem com tipo declarado diferente do conteúdo** (por exemplo, um arquivo `.png` que não é uma imagem): é recusada
  como formato inválido.
- **Sessão expirada no meio da edição**: o salvamento falha com a mensagem de sessão inativa, nada é salvo e o
  formulário mantém os valores digitados enquanto a página estiver aberta, para que o usuário entre de novo e salve.
- **Conta suspensa pela administração**: não consegue entrar, portanto não acessa o perfil; os dados dela não são
  apagados.
- **Usuário muda o nome de exibição**: pedidos antigos continuam mostrando o nome que estava no pedido quando foi feito
  (recibos são imutáveis), e não o nome atual do perfil.
- **Foto removida duas vezes seguidas** (duas abas): a segunda remoção é inofensiva e termina no mesmo estado.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST guardar, por colecionador, nome de exibição, bio, nome ENS com domínio, apelido da carteira
  e foto, de forma que apareçam em qualquer navegador em que a mesma conta entre.
- **FR-002**: O colecionador MUST conseguir ver e editar esses dados em "Dados do perfil", com confirmação de
  salvamento visível.
- **FR-003**: O sistema MUST validar nome de exibição, bio (até 280 caracteres), nome ENS (vazio ou de 3 a 40 letras
  minúsculas, números ou hífen), domínio ENS (um dos três permitidos) e apelido da carteira (até 40 caracteres) com as
  mesmas regras e mensagens que o perfil já usa hoje, e mostrar o erro no campo correspondente.
- **FR-004**: Um salvamento inválido MUST NOT alterar nenhum dado guardado, e o formulário MUST manter o que o usuário
  digitou.
- **FR-005**: O sistema MUST aceitar como foto só imagens PNG, JPEG ou WebP de até 1 MB, MUST verificar o conteúdo e não
  apenas o nome do arquivo, e MUST permitir substituir e remover a foto.
- **FR-006**: Cada colecionador MUST ler e alterar somente o próprio perfil; a identidade do dono de cada requisição
  MUST vir da sessão verificada, nunca de um dado enviado pelo usuário na própria requisição.
- **FR-007**: O perfil MUST exigir sessão ativa; um visitante MUST ser levado ao login e voltar ao perfil depois de
  entrar.
- **FR-008**: Uma conta sem perfil salvo MUST ver o formulário com o nome do cadastro e os demais campos vazios, e o
  primeiro salvamento MUST criar o perfil, sem erro.
- **FR-009**: Salvar o mesmo conteúdo mais de uma vez (duplo clique, nova tentativa depois de resposta perdida) MUST ter
  o mesmo efeito de salvar uma vez.
- **FR-010**: Quando duas sessões da mesma conta salvam, o último salvamento MUST prevalecer, e o perfil MUST mostrar a
  data da última alteração.
- **FR-011**: Se o serviço estiver indisponível, o carregamento MUST mostrar mensagem de falha com "Tentar novamente"
  sem exibir dados inventados, e o salvamento MUST mostrar mensagem de falha sem perder o digitado.
- **FR-012**: Nome de usuário, e-mail e senha MUST continuar sendo da conta do site, com as regras atuais de
  unicidade e de troca de senha, e MUST NOT ser guardados no serviço real do perfil.
- **FR-013**: Mudar o perfil MUST NOT alterar pedidos, recibos ou qualquer registro já emitido; eles mantêm o que foi
  gravado no momento em que foram criados.
- **FR-014**: A página MUST permanecer acessível por teclado e leitor de tela e sem rolagem horizontal em 390, 768 e
  1440 px, como as demais páginas da conta.
- **FR-015**: O perfil MUST NOT aparecer para outras contas nem para visitantes; nenhuma página pública de perfil é
  criada por esta feature.

### Key Entities *(include if feature involves data)*

- **Perfil do colecionador**: dados de apresentação de um colecionador: nome de exibição, bio, nome ENS e domínio,
  apelido da carteira, data da última alteração. Pertence a exatamente uma conta; uma conta tem no máximo um perfil.
- **Foto de perfil**: imagem opcional do perfil (PNG, JPEG ou WebP, até 1 MB). Pertence ao perfil; uma conta tem no
  máximo uma foto por vez.
- **Conta (existente, fora do escopo)**: identidade de login do site (nome de usuário, e-mail, senha, papel,
  suspensão). Define quem é o dono do perfil, mas não é alterada de lugar por esta feature.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Em 100% das tentativas, um perfil salvo em um navegador aparece idêntico ao abrir a mesma conta em outro
  navegador, em até 5 segundos depois de abrir a página.
- **SC-002**: Um colecionador consegue abrir o perfil, editar um campo e ver a confirmação de salvamento em menos de 1
  minuto, sem consultar ajuda.
- **SC-003**: Em 100% das tentativas de ler ou alterar o perfil de outra conta, ou de acessar o perfil sem sessão, o
  tentativa é recusada e nenhum dado do outro usuário é exibido.
- **SC-004**: Em 100% dos salvamentos inválidos, nenhum dado guardado muda e cada campo com problema mostra sua
  mensagem.
- **SC-005**: Em 100% dos envios de foto fora das regras (formato ou tamanho), a foto atual permanece e o usuário vê o
  motivo.
- **SC-006**: Salvar o mesmo conteúdo cinco vezes seguidas deixa o perfil idêntico a salvá-lo uma vez.
- **SC-007**: Com o serviço indisponível, 100% dos usuários veem uma mensagem de falha com caminho para tentar de novo,
  e nenhum valor digitado é perdido.
- **SC-008**: A página não tem violações críticas de acessibilidade e não tem rolagem horizontal em 390, 768 e 1440 px.

## Assumptions

- **Escopo dos dados**: vão para o serviço real o nome de exibição, a bio, o nome ENS com domínio, o apelido da
  carteira e a foto. **Nome de usuário, e-mail e senha ficam na conta simulada do site**, porque são a credencial de
  login e a constituição exige credenciais fictícias; guardá-los em dois lugares criaria duas fontes de verdade para o
  login. A tela continua mostrando e editando os seis campos juntos, e o usuário não percebe a divisão.
- **Pré-requisito de governança**: a constituição 1.8.0 não inclui o perfil entre os dados da conta que o serviço real
  guarda e exige emenda para ampliar essa lista. A emenda (versão 1.9.0, expansão material) precisa ser aprovada antes do
  plano; esta spec não a faz.
- **Limitação assumida, igual à da 015**: o serviço real identifica o dono pelo identificador que o site pede ao
  emitir a sessão do serviço, porque o login do colecionador é simulado. Isso protege um colecionador de agir sobre o
  perfil de outro depois de autenticado, mas **não** é proteção completa contra quem já conhece o identificador de outra
  conta; precisa ficar documentado e nunca ser apresentado como proteção completa.
- **Sem migração**: os perfis já preenchidos na simulação do navegador são dados de demonstração e não são copiados
  para o serviço real; a primeira abertura depois da mudança cai no cenário de primeiro acesso (US3).
- **Edição simultânea**: o último salvamento vence; não há aviso de conflito nem mesclagem de campos.
- **Fora de escopo**: perfil público ou visível a outros usuários, página de perfil de criadores, login real do
  colecionador, recuperação de senha, exclusão de conta, verificação de e-mail e visualização ou edição do perfil de
  alguém por administradores.
- **Dependência**: a feature 015 já define o padrão de acesso do site ao serviço real para dados da conta; esta feature
  o reaproveita e não duplica essa ligação. Os testes de ponta a ponta do site continuam rodando contra a simulação de
  rede.
