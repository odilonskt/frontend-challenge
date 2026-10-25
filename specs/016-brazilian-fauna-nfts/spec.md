# Feature Specification: Coleção "Fauna Brasileira" — NFTs de animais brasileiros

**Feature Branch**: `016-brazilian-fauna-nfts`

**Created**: 2026-10-25

**Status**: Draft

**Input**: User description: "Criar NFTs de animais brasileiros": uma coleção "Fauna Brasileira" com 12 animais (onça-pintada, arara-azul, boto-cor-de-rosa, mico-leão-dourado, tamanduá-bandeira, lobo-guará, tucano-toco, capivara, bicho-preguiça, jacaré-do-pantanal, peixe-boi-da-amazônia e ararajuba), com ilustração própria, criador próprio ("Fauna Viva"), edições Standard, Rare e Legendary, e compra pelo fluxo que já existe.

Fatos verificados no repositório (2026-10-25), para situar quem lê:

1. O catálogo tem hoje **48 NFTs abstratos**, com nomes em inglês e imagens provisórias (um bloco de cor com o número
   escrito). Nenhum deles representa algo reconhecível.
2. Os NFTs do catálogo são **simulados**: nada é registrado em blockchain de verdade (integração real de blockchain está
   fora de escopo pela constituição).
3. O **catálogo paginado** (12 NFTs por página, 4 páginas hoje, com filtros, busca e ordenação, "Mais recentes" por
   padrão) fica na **página inicial**. O hero da página inicial é uma imagem fixa.
4. A página **Mercado** tem as categorias e dois carrosséis, "Em alta" e "Coleções", ambos montados a partir dos NFTs
   **em destaque** (hoje os 3 primeiros). O cartão de coleção leva ao catálogo filtrado pelo nome da coleção.
5. A lista e a página de **criadores** são derivadas dos NFTs do catálogo: um criador existe enquanto tiver NFTs. No
   detalhe do NFT o criador aparece como texto ("Por …"), sem link.
6. Cada NFT tem 1 a 3 edições (Standard, Rare, Legendary) com preço, suprimento finito e limite por pedido, e uma
   galeria de 3 imagens.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Encontrar a coleção e conhecer os animais (Priority: P1)

O colecionador abre a página inicial e, no catálogo ordenado por "Mais recentes", vê logo na primeira página os 12
animais da coleção "Fauna Brasileira", cada um com sua ilustração, nome, criador e preço a partir de. Na página Mercado, a
onça-pintada aparece em "Em alta" e a coleção aparece em "Coleções". Também chega aos animais pela busca (pelo nome, com
ou sem acento, ou pelo nome da coleção).

**Why this priority**: É o que torna a coleção existente para quem usa o site. Sem isso, os NFTs estariam no catálogo mas
ninguém os encontraria, e é a fatia mínima que já entrega valor sozinha.

**Independent Test**: Abrir a página inicial e contar os 12 animais na primeira página; buscar "onça" e "onca" e ver a
onça-pintada; buscar "Fauna Brasileira" e ver os 12; percorrer as 5 páginas e ver 60 NFTs distintos; abrir o Mercado e
ver a onça-pintada em "Em alta" e "Fauna Brasileira" em "Coleções".

**Acceptance Scenarios**:

1. **Given** a página inicial com o catálogo em "Mais recentes", **When** a primeira página abre, **Then** ela mostra
   exatamente os 12 animais da coleção, cada um com ilustração, nome em português, criador "Fauna Viva" e preço inicial.
2. **Given** o catálogo, **When** o colecionador busca "onça", "onca" ou "ONÇA", **Then** a onça-pintada aparece nos
   resultados, e a mesma regra vale para os outros 11 nomes.
3. **Given** o catálogo, **When** busca "Fauna Brasileira", **Then** vê os 12 animais e nenhum dos 48 NFTs antigos.
4. **Given** o catálogo com 60 NFTs, **When** percorre as páginas, **Then** são 5 páginas de 12, sem NFT repetido nem
   faltando entre elas.
5. **Given** a página Mercado, **When** ela abre, **Then** "Em alta" mostra a onça-pintada junto dos destaques atuais, e
   "Coleções" mostra a coleção "Fauna Brasileira", que leva ao catálogo filtrado pelo nome dela.
6. **Given** a página inicial, **When** ela abre, **Then** o hero continua o mesmo de antes.
7. **Given** os filtros e ordenações do catálogo (categoria, preço, nome, disponibilidade), **When** o colecionador os usa,
   **Then** os animais respondem a eles como qualquer outro NFT.

---

### User Story 2 - Conhecer um animal e comprar uma edição (Priority: P2)

O colecionador abre o detalhe de um animal e vê a galeria de 3 imagens (a cena completa, o detalhe do rosto e a cena ao
entardecer), a descrição em português, o criador, a coleção e as três edições com preço e unidades disponíveis. Escolhe
uma edição, coloca no carrinho e compra pelo fluxo de sempre.

**Why this priority**: Um NFT que só se vê e não se compra é uma vitrine; a compra prova que os novos itens são
cidadãos de primeira classe do catálogo, com estoque e limites.

**Independent Test**: Abrir o detalhe da onça-pintada, ver 3 imagens e 3 edições, adicionar uma edição ao carrinho,
chegar ao checkout e ver o item com o nome e a imagem corretos; tentar passar do limite por pedido da edição Legendary e
ser impedido.

**Acceptance Scenarios**:

1. **Given** o detalhe de um animal, **When** abre, **Then** mostra nome, criador, coleção, descrição, etiquetas, galeria
   de 3 imagens e as edições Standard, Rare e Legendary com preço, unidades disponíveis e limite por pedido.
2. **Given** a galeria, **When** o colecionador troca de imagem (teclado ou toque), **Then** vê a cena completa, o detalhe
   do rosto e a cena ao entardecer do mesmo animal, cada uma com texto alternativo em português que nomeia o animal.
3. **Given** uma edição disponível, **When** adiciona ao carrinho, **Then** o carrinho mostra o animal com a imagem, o nome
   da edição e o preço, e respeita o limite por pedido e o estoque, como qualquer NFT.
4. **Given** a edição Legendary, que tem uma única unidade, **When** ela é comprada, **Then** passa a aparecer como
   esgotada para todos, e as outras edições do mesmo animal seguem disponíveis.
5. **Given** um pedido confirmado com um animal da coleção, **When** o colecionador abre o recibo, **Then** o recibo
   mostra o nome e os valores registrados no momento da compra, imutáveis a mudanças posteriores no catálogo.
6. **Given** o detalhe ou o cartão de um animal, **When** o colecionador usa o coração de favorito, **Then** o estado do
   coração muda e se mantém ao recarregar, como em qualquer outro NFT.

---

### User Story 3 - Conhecer o criador da coleção (Priority: P3)

O colecionador encontra "Fauna Viva" na lista de criadores e abre a página dele, que mostra os 12 animais da coleção.

**Why this priority**: Dá um dono e uma identidade à coleção, e confirma que a lista de criadores reflete o catálogo
novo; é útil, mas não bloqueia nem a descoberta nem a compra.

**Independent Test**: Abrir a lista de criadores e ver "Fauna Viva" com 12 NFTs; abrir a página dele e ver os 12 animais.

**Acceptance Scenarios**:

1. **Given** a lista de criadores, **When** abre, **Then** mostra "Fauna Viva" com avatar próprio e a contagem de 12 NFTs,
   e os 8 criadores anteriores continuam com as mesmas contagens.
2. **Given** a página de "Fauna Viva", **When** abre, **Then** lista os 12 animais da coleção.

---

### Edge Cases

- **Busca sem acento e com maiúsculas** ("onca", "ONÇA", "Tamandua"): encontra o animal, como a busca já faz com os
  outros nomes.
- **Edição esgotada ou indisponível**: segue o comportamento atual (aparece como esgotada, não vai ao carrinho); a coleção
  nasce com todas as edições disponíveis.
- **Imagem que não carrega**: o cartão e a galeria mantêm o espaço e o texto alternativo, sem quebrar a página; uma
  imagem faltando é um defeito, e todas as 36 novas precisam existir (ver SC-004).
- **Tela estreita (390 px)**: a galeria, as edições e o cartão cabem sem rolagem horizontal.
- **Nome longo** ("Peixe-Boi-da-Amazônia", "Jacaré-do-Pantanal"): não quebra o cartão nem a página de detalhe.
- **Descrição**: não afirma registro em blockchain real, pois nada é registrado de verdade.
- **Ordenação por preço ou por nome**: os animais entram na ordem correta entre os 48 antigos.
- **Quem já tinha um NFT antigo no carrinho, marcado como favorito ou num pedido**: nada disso muda.
- **Contagem no cartão de coleção do Mercado**: o cartão conta só os NFTs em destaque da coleção (comportamento atual de
  todas as coleções), então "Fauna Brasileira" mostra 1, não 12. Não é corrigido nesta entrega (ver Assumptions).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O catálogo MUST incluir a coleção "Fauna Brasileira" com 12 NFTs, um por animal: Onça-Pintada, Arara-Azul,
  Boto-Cor-de-Rosa, Mico-Leão-Dourado, Tamanduá-Bandeira, Lobo-Guará, Tucano-Toco, Capivara, Bicho-Preguiça,
  Jacaré-do-Pantanal, Peixe-Boi-da-Amazônia e Ararajuba.
- **FR-002**: Cada NFT da coleção MUST ter nome em português, criador "Fauna Viva", coleção "Fauna Brasileira", uma
  categoria já existente (Arte ou Colecionáveis), pelo menos 2 etiquetas e uma descrição curta em português que cite o
  bioma ou uma característica reconhecida do animal.
- **FR-003**: As descrições MUST conter só fatos consolidados sobre o animal (sem números de população) e MUST NOT
  afirmar registro em blockchain real.
- **FR-004**: Cada NFT MUST ter as edições Standard, Rare e Legendary, com as mesmas regras de preço, suprimento e limite
  por pedido das edições dos NFTs atuais, e todas disponíveis na estreia da coleção.
- **FR-005**: Cada NFT MUST ter uma galeria de 3 imagens (cena completa, detalhe do rosto e cena ao entardecer), e a
  primeira imagem MUST ser a que aparece nos cartões da página inicial, do Mercado e da busca e no carrinho.
- **FR-006**: Toda imagem da coleção MUST ter texto alternativo em português que identifique o animal e a vista (a
  imagem principal nomeia o animal e o criador; as demais indicam o detalhe).
- **FR-007**: As ilustrações MUST ser originais do projeto, estilizadas e reconhecíveis (o animal é identificável pelo
  nome e por seus traços), sem fotografias nem obras de terceiros.
- **FR-008**: Em "Mais recentes", os 12 animais MUST ocupar as primeiras posições do catálogo da página inicial.
- **FR-009**: Exatamente um animal, a Onça-Pintada, MUST ser NFT em destaque, de modo que apareça em "Em alta" e que a
  coleção apareça em "Coleções" na página Mercado. Os outros 11 MUST NOT ser destaque, e o hero da página inicial MUST
  continuar o mesmo.
- **FR-010**: O catálogo MUST passar a ter 60 NFTs em 5 páginas de 12, e os filtros, ordenações e a paginação
  existentes MUST funcionar com os novos itens sem repetir nem omitir NFT entre as páginas.
- **FR-011**: A busca MUST encontrar cada animal pelo nome, ignorando acentos e maiúsculas, e MUST encontrar os 12 pelo
  nome da coleção ou do criador.
- **FR-012**: Adicionar ao carrinho, comprar e receber o recibo de um animal MUST usar o fluxo atual, sem regra própria:
  limites por pedido, estoque finito, atualização de disponibilidade e recibo imutável.
- **FR-013**: O criador "Fauna Viva" MUST aparecer na lista de criadores com avatar próprio e 12 NFTs, e MUST ter página
  própria com os 12 animais.
- **FR-014**: Os 48 NFTs existentes MUST permanecer idênticos em nome, imagens, criador, preço, edições e estoque, e os 8
  criadores anteriores MUST manter suas contagens.
- **FR-015**: Nenhuma imagem referenciada pelo catálogo (60 NFTs, 3 imagens cada, mais os avatares de criador) MUST
  falhar ao carregar.
- **FR-016**: Os cartões e o detalhe dos animais MUST ser acessíveis por teclado e leitor de tela e MUST caber, sem
  rolagem horizontal, em 390, 768 e 1440 px.

### Key Entities *(include if feature involves data)*

- **NFT da Fauna Brasileira**: um dos 12 animais. Tem nome, criador, coleção, categoria, descrição, etiquetas, 3 imagens
  com texto alternativo, de 1 a 3 edições e a marca de destaque (só a Onça-Pintada). É um NFT de catálogo como os atuais.
- **Edição**: Standard, Rare ou Legendary de um animal. Tem preço, suprimento, unidades disponíveis, limite por pedido e
  estado (disponível, esgotada ou indisponível).
- **Coleção "Fauna Brasileira"**: o agrupamento dos 12 animais; um nome que a busca, o detalhe e o Mercado mostram.
- **Criador "Fauna Viva"**: o autor da coleção. Não tem estado próprio: existe porque os 12 NFTs o citam como criador.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Com o catálogo da página inicial em "Mais recentes", 12 de 12 animais aparecem na primeira página, sem
  filtro nem troca de página.
- **SC-002**: Buscar o nome de cada um dos 12 animais, com e sem acento, devolve o animal correspondente em 100% das
  tentativas; buscar "Fauna Brasileira" devolve exatamente os 12.
- **SC-003**: A partir da página inicial, um colecionador chega a ter uma edição de um animal no carrinho em no máximo 4
  interações (abrir o animal, escolher a edição, adicionar, abrir o carrinho).
- **SC-004**: 100% das imagens do catálogo (180) carregam; em particular as 36 novas e o avatar do criador.
- **SC-005**: Os 48 NFTs antigos têm, antes e depois da mudança, o mesmo nome, preço, edições e estoque em 100% dos
  casos, e os 8 criadores anteriores têm as mesmas contagens.
- **SC-006**: Percorrendo as 5 páginas do catálogo aparecem 60 NFTs distintos, 12 por página, sem repetição.
- **SC-007**: A página inicial, o Mercado, o detalhe de um animal e a página do criador não têm violações críticas de
  acessibilidade e não têm rolagem horizontal em 390, 768 e 1440 px.
- **SC-008**: Numa revisão visual das 36 ilustrações sem legenda, cada animal é reconhecível pelo nome e pelos traços
  (12 de 12 animais, e as 3 vistas de cada um mostram o mesmo animal).
- **SC-009**: Na página Mercado, a Onça-Pintada aparece em "Em alta" e "Fauna Brasileira" aparece em "Coleções", e o
  cartão da coleção leva ao catálogo com os 12 animais.

## Assumptions

- **Simulados como os atuais**: os 12 NFTs vivem no catálogo versionado do repositório (visíveis a todos) e são simulados;
  nada é cunhado nem registrado em blockchain (a constituição deixa isso fora de escopo).
- **Sem categoria nova**: usam "Arte" e "Colecionáveis", alternadas; filtros e contratos não mudam.
- **Arte**: ilustrações vetoriais originais, estilizadas (formas geométricas e paleta própria por bioma: Amazônia,
  Pantanal, Cerrado e Mata Atlântica), desenhadas para o projeto. Não têm o acabamento de um ilustrador profissional, e a
  spec as trata como "estilizadas". O formato vetorial mantém os arquivos leves e sem licença de terceiros.
- **Três vistas**: cena completa, detalhe do rosto e cena ao entardecer (a mesma cena com outra luz).
- **Criador novo**: "Fauna Viva", com avatar próprio; como a lista de criadores é derivada do catálogo, ele aparece sozinho.
  O detalhe do NFT continua mostrando o criador como texto; ligar esse texto à página do criador é outro trabalho.
- **Posição**: os 12 entram como os mais recentes de todos. Só a Onça-Pintada é destaque (decisão tomada depois de
  verificar que o destaque alimenta apenas os carrosséis do Mercado e não o hero, que é uma imagem fixa).
- **Contagem do cartão de coleção**: o Mercado conta os NFTs em destaque de cada coleção (hoje 1 em cada uma). A coleção
  nova segue a mesma regra e mostra 1; corrigir a contagem para o total real é outro trabalho e afetaria as coleções
  atuais.
- **Preços e estoque**: preço-base por animal escolhido para a coleção, com os multiplicadores e suprimentos das edições
  atuais (Standard, Rare 2,5× e Legendary 6×; 25, 8 e 1 unidades; até 5, 2 e 1 por pedido). Não são aleatórios, para o
  catálogo ser reproduzível.
- **Verificações visuais existentes** da página inicial, do Mercado e dos criadores mudam por causa dos itens novos e do
  destaque e precisam ser atualizadas e revisadas junto com a entrega.
- **Fora de escopo**: cunhagem real, categoria nova, novos filtros (por bioma, por espécie), criação pelo console de
  administração, arte de ilustrador ou fotografia, tradução dos 48 NFTs antigos, link do criador no detalhe, correção da
  contagem do cartão de coleção, qualquer mudança nos serviços reais.
