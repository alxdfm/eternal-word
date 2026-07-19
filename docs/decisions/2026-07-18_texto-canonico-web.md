# Decisão: World English Bible (WEB) como texto canônico

**Data:** 2026-07-18
**Status:** aceita
**Autor:** Alexandre ("Não use King James, use World English Bible (WEB)")

---

## Contexto

A decisão anterior havia selecionado a KJV pelo peso icônico e pelo texto
congelado. Alexandre optou pela WEB: inglês **moderno e legível** — coerente
com a escolha do inglês como língua universal, que só faz sentido se o texto
for compreensível pelo leitor global de hoje. A exigência de texto livre de
direitos permanece atendida: a WEB é expressamente dedicada ao domínio
público.

---

## Opções consideradas

| Opção | Prós | Contras |
|-------|------|---------|
| KJV (1769) | Icônica; texto estável há 250+ anos; 31.102 versículos | Inglês arcaico (thee/thou) — barreira real para o leitor global atual |
| WEB — a escolhida | Inglês moderno; domínio público expresso; baseada na ASV com NT do Texto Majoritário; edição protestante de 66 livros distribuída pelo eBible.org | Texto ainda recebe revisões upstream (mitigado: nosso snapshot é congelado por design); 5 versículos da numeração tradicional sem texto |

---

## Decisão tomada

> **World English Bible, edição protestante (snapshot `engwebp` do eBible.org)**

A WEB preserva a numeração tradicional, mas omite do texto principal 5
versículos ausentes do Texto Majoritário: **Lucas 17:36, Atos 8:37,
Atos 15:34, Atos 24:7 e Romanos 16:25**. No dataset, essas posições são
`null`: existem na versificação, não têm texto e **não são registráveis**
on-chain (ficam fora da Merkle tree e do denominador do progresso).

Totais oficiais do projeto: **66 livros, 1.189 capítulos, 31.098 versículos
registráveis**.

---

## Consequências

**Positivas:**
- Texto legível pelo público global de hoje, sem custo jurídico
- Numeração tradicional preservada — referências familiares continuam válidas

**Negativas / Trade-offs:**
- O denominador do dashboard muda de 31.102 (KJV) para **31.098** — toda a
  documentação e o Catálogo usam o novo número
- Programa/domínio precisam rejeitar registro das 5 posições `null`
  (a validação Merkle já garante isso: não há folha para elas)
- Snapshot congelado diverge de futuras revisões upstream da WEB (aceito:
  é a natureza do registro permanente)

**Impacto no código:**
- `data/canonical-text/` (regenerado; posições omitidas = `null`)
- `scripts/build-canonical-text.mjs` (suporte a placeholders)
- Catálogo/domínio: conceito de posição não-registrável

---

## Revisão futura

Nenhuma para o texto on-chain (definitivo por design). Traduções adicionais
entram apenas como camada de exibição off-chain.
