# Decisão: Texto canônico em inglês — King James Version (KJV 1769)

**Data:** 2026-07-18
**Status:** substituída por 2026-07-18_texto-canonico-web.md (a decisão pelo inglês permanece; Alexandre trocou a edição KJV pela WEB)
**Autor:** Alexandre (idioma) / Claude (edição)

---

## Contexto

A decisão anterior (Bíblia Livre, em português) assumia público brasileiro.
Alexandre definiu que o texto registrado on-chain deve ser em **inglês**, por
ser a língua universal atual — o registro é permanente e global, e o idioma
do artefato eterno deve maximizar alcance. Isso substitui a escolha da
tradução; a exigência de texto livre de direitos permanece.

---

## Opções consideradas

| Opção | Prós | Contras |
|-------|------|---------|
| KJV (1769) — a escolhida | Domínio público; a tradução mais reconhecida da história do inglês; texto **estável há 250+ anos** (zero risco de divergência do snapshot congelado); versificação de referência = **31.102 versículos**, exatamente os números da spec; distribuição estruturada no eBible.org | Inglês arcaico (thee/thou); no Reino Unido a impressão é restrita por Crown patent (não afeta uso digital global) |
| WEB — World English Bible | Domínio público explícito; inglês moderno | Menos icônica; texto ainda recebe revisões upstream (conflita com snapshot congelado) |
| ASV (1901) | Domínio público; literal | Inglês datado sem o peso icônico da KJV; menos disponível |

---

## Decisão tomada

> **King James Version, texto padrão de 1769 (snapshot `eng-kjv` do eBible.org)**

Para um registro imutável e eterno, a KJV é o fit natural: é o texto bíblico
mais reconhecido da língua inglesa, congelado há séculos — o que torna o
snapshot definitivo por natureza — e sua versificação é exatamente a da spec
(31.102). A linguagem arcaica é mitigável: traduções modernas e em outros
idiomas (incluindo português) podem existir como camada de exibição off-chain
(evolução futura já prevista), sem tocar o registro on-chain.

---

## Consequências

**Positivas:**
- Alcance global do artefato permanente; zero risco jurídico
- Números do dashboard confirmados: 66 / 1.189 / 31.102
- Texto-fonte estável elimina o trade-off "snapshot congelado vs upstream vivo"
  que existia com a Bíblia Livre
- Dataset regenerado em `data/canonical-text/` (proveniência em `PROVENANCE.md`)

**Negativas / Trade-offs:**
- Leitura menos acessível para o público brasileiro no curto prazo —
  compensar com camada de exibição PT off-chain
- Abre a questão do idioma da UI do produto (inglês global vs português) —
  a confirmar com Alexandre

**Impacto no código:**
- `data/canonical-text/` (66 JSONs em inglês, nomes de livros em inglês)
- `scripts/build-canonical-text.mjs` (tabela de livros + filtro de apócrifos)

---

## Revisão futura

Revisitar apenas a camada de exibição (traduções modernas/PT off-chain) —
o texto on-chain e sua Merkle root são definitivos por design.
