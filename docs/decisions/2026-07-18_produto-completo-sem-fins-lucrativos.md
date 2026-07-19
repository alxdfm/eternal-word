# Decisão: Produto completo (não MVP), sem fins lucrativos

**Data:** 2026-07-18
**Status:** aceita
**Autor:** Alexandre (definido em conversa durante a estruturação do projeto)

---

## Contexto

Durante a revisão da spec inicial foi sugerido simplificar o escopo para um
MVP: eliminar a camada `apps/api` (Lambda) e usar Next.js route handlers
falando direto com o Supabase, deixando apenas o indexer como backend
separado. Era preciso decidir se o projeto nasceria enxuto ou já com a
arquitetura completa.

---

## Opções consideradas

| Opção | Prós | Contras |
|-------|------|---------|
| MVP: Next.js fullstack, sem `apps/api` | Menos infra, entrega mais rápida | Migração futura para Lambda; arquitetura provisória |
| Produto completo: monorepo com `apps/api` (Lambda) — a escolhida | Arquitetura definitiva desde o início; API pública independente do site; indexer como cidadão de primeira classe | Mais setup inicial; mais superfícies para manter |

---

## Decisão tomada

> **Produto completo desde o início**

Não é um MVP. A ideia é criar um produto real, sem fins lucrativos: nenhuma
taxa de serviço, quem registra paga apenas rent + taxas de rede. A
arquitetura da spec (apps/web + apps/api + packages em Clean Architecture +
programa Anchor) é mantida integralmente.

---

## Consequências

**Positivas:**
- A API pública (evolução futura da spec) já nasce com casa própria
- Indexer roda em infraestrutura dedicada, não acoplado ao frontend

**Negativas / Trade-offs:**
- Setup inicial maior (monorepo, deploy AWS + Vercel, mais tooling)
- Custo de infra recorrente pago pelo mantenedor (Lambda, Supabase)

**Impacto no código:**
- Estrutura alvo do monorepo documentada em `docs/architecture/STACK.md`

---

## Revisão futura

Revisitar apenas se o custo de infra recorrente se tornar insustentável para
um projeto sem receita.
