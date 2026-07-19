# Decisão: CanonicalText versionado no repo; banco como camada de consulta

**Data:** 2026-07-18
**Status:** aceita (aplicada em 2026-07-18 ao montar o dataset da Bíblia Livre; layout conforme proposto)
**Autor:** Claude (em resposta à dúvida do Alexandre: "vale subir no banco? arquivo na raiz?")

---

## Contexto

Com a validação Merkle aceita, o CanonicalText precisa viver off-chain de
forma **reprodutível**: a Merkle root é derivada byte a byte dele, e qualquer
alteração no texto muda a root. Surgiu a dúvida de onde esse dataset deve
morar: no banco (Supabase), num arquivo na raiz do projeto, ou ambos.

---

## Opções consideradas

| Opção | Prós | Contras |
|-------|------|---------|
| Apenas no banco (Supabase) | Fonte única; busca já resolvida | Texto editável sem revisão; terceiros não conseguem reproduzir a Merkle root sem acesso ao banco; auditoria fraca |
| Arquivo único na raiz do projeto | Simples de montar | ~4-5MB num arquivo só; diff e code review impraticáveis; raiz poluída |
| `data/canonical-text/` com 1 JSON por livro + seed no banco — a escolhida | Fonte da verdade versionada em git; qualquer pessoa reproduz a root com `git clone` + script; correções de texto passam por PR; banco vira camada derivada | Dataset em dois lugares — exige seed idempotente e a regra de nunca editar texto direto no banco |

---

## Decisão tomada

> **Arquivos versionados no repo como source of truth; banco populado via seed**

66 arquivos JSON (um por livro) em `data/canonical-text/`, com estrutura
`{ book, name, abbreviation, testament, chapters: [[verso1, verso2, ...]] }`.
Um script gera a Merkle root a partir desses arquivos (root commitada junto)
e outro faz o seed do Supabase. O banco continua necessário — busca por
texto, status e estatísticas — mas é sempre **derivado**, nunca editado à mão.

---

## Consequências

**Positivas:**
- Auditoria pública total — alinha com o princípio "indexador aberto"
- Erros de digitação no texto são corrigíveis via PR revisável (antes da
  root ser gravada on-chain)
- Banco reconstruível do zero: `seed` (catálogo) + `indexer` (registros)

**Negativas / Trade-offs:**
- Pipeline de seed a manter; risco de divergência se alguém editar o banco
  diretamente (mitigar: seed idempotente + texto do banco tratado como cache)

**Impacto no código:**
- `data/canonical-text/` (novo diretório — já listado no `.ripgrepignore`)
- Script de seed em `packages/infrastructure/`
- Script da Merkle tree no tooling do Catálogo

---

## Revisão futura

Revisitar quando o suporte a múltiplas traduções (camada de exibição
off-chain) exigir um layout para mais de um dataset.
