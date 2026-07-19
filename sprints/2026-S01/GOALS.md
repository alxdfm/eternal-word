# Sprint S01 — Fundação do monorepo e do Catálogo

**Prefixos:** `FD` (fundação/tooling) · `CT` (catálogo/Merkle)
**Branch:** `s01`
**Depende de:** nada (primeira sprint)

---

## Objetivo

Transformar o repositório de documentação em **repositório executável**: o
monorepo montado, o domínio modelado com testes, e a **Merkle root do
CanonicalText gerada de forma reprodutível** — a partir dela o programa
Anchor da S02 pode ser escrito.

## Por que esta sprint vem primeiro

A root é a peça mais irreversível do projeto: ela é gravada on-chain e
define o que é texto canônico para sempre. Precisa existir, ser
reproduzível por terceiros e estar coberta por teste **antes** de qualquer
linha do programa depender dela.

## Escopo

- Monorepo pnpm com os pacotes previstos em `docs/architecture/STACK.md`
- Tooling: TypeScript, linter, Vitest, CI no GitHub Actions
- `packages/domain`: entidades e regras que não dependem de infraestrutura
- `packages/shared`: tipos e utilitários comuns
- Catálogo: validação do dataset + construção da Merkle tree + root commitada

## Fora de escopo

Programa Anchor (S02), banco e indexer (S03), qualquer interface (S04).
`apps/web` e `apps/api` entram como diretórios vazios com `package.json`
mínimo, só para fixar o layout do workspace.

---

## Critério de pronto

Além da definição global (ver [`../ROADMAP.md`](../ROADMAP.md)):

1. `pnpm install && pnpm test` verde do zero em máquina limpa e no CI
2. `pnpm catalog:verify` confirma integridade do dataset (66/1.189/31.098,
   contiguidade, posições `null` esperadas) e **falha** se algo divergir
3. `pnpm catalog:merkle` regenera a root e ela **bate byte a byte** com a
   root commitada — reprodutibilidade provada por teste, não por confiança
4. Domínio com cobertura de teste nas regras de endereçamento e status
5. ADR registrada para cada dependência nova (guardrail do CLAUDE.md)
