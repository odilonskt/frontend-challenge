# Specification Quality Checklist: Coleção "Fauna Brasileira" — NFTs de animais brasileiros

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-10-25
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- Validação em 2 iterações. A primeira encontrou: o teste independente da US2 citava rota e id interno de NFT
  (detalhe de implementação); o cenário 6 da US2 e o FR-005 pressupunham uma **página de favoritos que não existe**
  (a spec 015 ainda não foi implementada); e a US3 pressupunha um **link do criador no detalhe do NFT**, que hoje é
  só texto. Os três foram corrigidos na spec, sem inventar interface.
- A leitura do código depois da primeira versão mostrou que o catálogo paginado de 12 por página é a **página
  inicial**, e que a página **Mercado** só tem categorias e os carrosséis "Em alta" e "Coleções", montados só com os
  NFTs **em destaque**; e que o hero da home é uma imagem fixa. Isso corrigiu um erro do plano aprovado ("mercado" com
  5 páginas; "não destacar para não mudar o hero"). Decisão do usuário: **destacar a Onça-Pintada** (FR-009), para a
  coleção aparecer no Mercado sem tocar no hero.
- **Limite conhecido, registrado e não corrigido**: o cartão de coleção do Mercado conta só os destaques da coleção
  (hoje 1 em cada), então "Fauna Brasileira" mostra 1, não 12. Está em Edge Cases e Assumptions; corrigir é outro
  trabalho.
- O plano de 2026-10-25 (`~/.claude/plans/…`) precisa ser relido com estas correções antes do `/speckit-plan`.
