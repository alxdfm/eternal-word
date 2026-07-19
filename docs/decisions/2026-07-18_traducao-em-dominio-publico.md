# Decisão: Tradução livre de direitos — Bíblia Livre (BLIVRE)

**Data:** 2026-07-18
**Status:** substituída por 2026-07-18_texto-canonico-em-ingles-kjv.md (o texto on-chain será em inglês; a exigência de texto livre de direitos permanece)
**Autor:** Claude

---

## Contexto

Traduções da Bíblia são obras protegidas por direitos autorais — ARA, NAA e
NVI, por exemplo, têm direitos reservados (SBB/Biblica). Registrar texto
protegido on-chain seria infração **permanente e irremovível**. Além disso, a
tradução escolhida define a versificação, o espaço de seeds
`(book, chapter, verse)` e a Merkle root para sempre.

---

## Opções consideradas

| Opção | Prós | Contras |
|-------|------|---------|
| Tradução Brasileira (1917) | Domínio público puro, sem condições | Linguagem datada; fontes digitais (Wikisource/CrossWire) sem distribuição canônica estruturada |
| Almeida Revista e Corrigida — edição 1898 | Domínio público; Almeida é a tradução mais reconhecida no Brasil | Difícil obter texto digital fiel à edição de 1898; edições modernas da RC têm direitos da SBB |
| KJV (inglês) | Domínio público consolidado | Não é português — desconectada do público-alvo |
| Tradução protegida (ARA/NAA/NVI) + créditos | Texto moderno e familiar | **Atribuição não substitui licença**: créditos atendem ao direito moral, mas a reprodução integral exige autorização patrimonial (Lei 9.610/98, arts. 28-29); on-chain, infração permanente |
| Bíblia Livre (BLIVRE, 2018) — a escolhida | Licença explícita **CC BY 4.0** (livre, irrevogável); modernização da Almeida 1819 (domínio público); distribuição estruturada e mantida no eBible.org; versificação Textus Receptus = **31.102 versículos**, confirmando os números da spec | Não é "domínio público" puro — exige atribuição (condição única e trivial de cumprir) |

---

## Decisão tomada

> **Bíblia Livre (BLIVRE), snapshot `porbr2018` do eBible.org**

É a única opção em português com licença livre *explícita* (não dependemos de
análise de domínio público de edição centenária), texto moderno legível e
fonte digital estruturada. Sob CC BY 4.0, dar os créditos é exatamente o que
a licença exige — a atribuição está em `data/canonical-text/ATTRIBUTION.md` e
deve constar também no site e nos metadados da conta de config do programa.

---

## Consequências

**Positivas:**
- Risco jurídico eliminado; licença irrevogável cobre reprodução permanente
- Versificação TR: 66 livros / 1.189 capítulos / 31.102 versículos — os
  números do dashboard da spec estão confirmados e exatos
- Dataset aplicado em `data/canonical-text/` (1 JSON por livro), gerado por
  `scripts/build-canonical-text.mjs` a partir do VPL oficial

**Negativas / Trade-offs:**
- Obrigação perpétua de atribuição em todas as superfícies de reprodução
- BLIVRE é trabalho em andamento; nosso snapshot é congelado — correções
  upstream não entram após a Merkle root ser gravada on-chain

**Impacto no código:**
- `data/canonical-text/` (source of truth do CanonicalText)
- Merkle tree, tabelas `books`/`verses` e números do dashboard

---

## Revisão futura

Revisitar ao implementar múltiplas traduções (camada de exibição off-chain)
— nunca para substituir o texto on-chain, cuja root é definitiva.
