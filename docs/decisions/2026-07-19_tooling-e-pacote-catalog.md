# Decisão: Tooling do workspace e pacote `catalog`

**Data:** 2026-07-19
**Status:** aceita
**Autor:** Claude (execução da S01 — FD-02 exige ADR para a escolha do linter)

---

## Contexto

A S01 monta o workspace e precisa fechar três escolhas que ficam difíceis de
reverter depois que houver código em cima: o linter/formatter, o runner de
testes e onde mora a lógica do Catálogo (dataset + Merkle), que não estava
prevista na lista de pacotes de `STACK.md`.

---

## Opções consideradas

### Linter e formatter

| Opção | Prós | Contras |
|-------|------|---------|
| ESLint + Prettier | Ecossistema maior; plugins para tudo | Duas ferramentas, dois configs; lento em monorepo |
| Biome — a escolhida | Uma ferramenta para lint e formatação, config única, ordens de grandeza mais rápido; já em uso pelo Alexandre em outro projeto | Menos plugins de nicho |

### Onde mora o Catálogo

| Opção | Prós | Contras |
|-------|------|---------|
| Dentro de `domain` | Sem pacote novo | Domínio passaria a ler arquivo do disco, quebrando a regra de não ter I/O |
| Dentro de `infrastructure` | Já é a camada de I/O | Catálogo é consumido por web, testes do programa e seed — puxaria infraestrutura para todos |
| `packages/catalog` — a escolhida | Isola o CanonicalText e a Merkle atrás de uma API própria; consumido por qualquer camada sem arrastar dependência | Um pacote a mais que o previsto em `STACK.md` |

---

## Decisão tomada

> **Biome + Vitest + `packages/catalog`**

- **Biome** para lint e formatação, com `noExplicitAny`, `noNonNullAssertion`
  e `noConsoleLog` como erro (exceto nos CLIs e scripts, via override).
- **Vitest** como runner, com a convenção do projeto: `__tests__/unit.test.ts`
  e `__tests__/integration.test.ts`.
- **TypeScript com project references**, `strict` e `noUncheckedIndexedAccess`.
- **`packages/catalog`** é o dono do CanonicalText: carrega o dataset,
  verifica integridade, constrói a Merkle tree e gera proofs. O Catálogo já
  era um bounded context em `OVERVIEW.md` — ganha pacote próprio.

O pacote expõe as duas formas de árvore (global e por capítulo) porque a
escolha entre elas é o spike PG-00; ter as duas medidas no código, com teste,
é o que fecha o risco R1 com número em vez de estimativa.

---

## Consequências

**Positivas:**
- Um comando (`pnpm lint`) cobre lint e formatação; CI simples e rápido
- Catálogo utilizável por qualquer camada sem dependência de infraestrutura
- Ambas as formas de árvore medidas e cobertas por teste antes da S02

**Negativas / Trade-offs:**
- Biome tem menos regras de nicho que o ecossistema ESLint
- Um pacote além dos previstos originalmente em `STACK.md` (documentado lá)

**Impacto no código:**
- `biome.json`, `vitest.config.ts`, `tsconfig.base.json`, `tsconfig.json`
- `packages/catalog/` e os comandos `catalog:verify` / `catalog:merkle`

---

## Revisão futura

Revisitar o Biome se alguma regra necessária não existir. Revisitar a
fronteira do `catalog` quando o seed (S03) e a web (S04) o consumirem de
verdade.
