# Decisão: Testes do programa em Rust, com fixtures geradas pelo Catálogo

**Data:** 2026-07-19
**Status:** aceita
**Autor:** Claude (PG-06 da S02 — a task exige ADR da escolha do framework)

---

## Contexto

O PG-06 pede uma suíte que cubra sobretudo **caminhos de falha** do
`register_verse`. A escolha do framework precisava sair antes do PG-02, porque
define onde o código de teste vive e como as Merkle proofs chegam até ele.

A recomendação inicial era replicar o `anchor-bankrun` usado em outro projeto
Solana do Alexandre. **A investigação derrubou essa recomendação.**

---

## O que a investigação mostrou

| Pacote | Versão | Última publicação |
|--------|--------|-------------------|
| `anchor-bankrun` | 0.5.0 | **outubro/2024** |
| `solana-bankrun` | 0.4.0 | **outubro/2024** |
| `litesvm` (npm) | 1.3.0 | julho/2026 |
| `anchor-litesvm` | 0.2.1 | depende de `litesvm ^0.3.3` e `anchor ^0.31.1` |

Duas descobertas mudaram o desenho:

1. **`anchor-bankrun` está parado há ~21 meses** e é anterior ao Agave 3.x.
   Replicar aquele padrão seria adotar uma dependência abandonada na única
   parte irreversível do projeto.
2. **`litesvm` 1.x migrou para `@solana/kit`** (web3.js v2). Confirmado nas
   dependências do pacote e reproduzido na prática: `addProgramFromFile`
   rejeita um `PublicKey` do web3.js v1 porque espera um `Address` do Kit. O
   `STACK.md` fixa web3.js v1, e o spike do PG-00 já está escrito nele.

Ou seja, testar em TypeScript hoje exigiria **ou** adotar o Kit no repositório
inteiro (reescrevendo o spike e o `packages/blockchain`, com o wallet adapter
da S04 ainda majoritariamente em v1), **ou** manter dois SDKs — testes
construindo transações por um caminho diferente do que a aplicação usa, que é
exatamente o que um teste de integração não pode fazer.

---

## Opções consideradas

| Opção | Prós | Contras |
|-------|------|---------|
| `anchor-bankrun` (TS) | Padrão já conhecido em outro projeto | Abandonado desde 2024, anterior ao Agave 3.x |
| `litesvm` TS + `@solana/kit` no repo todo | Direção atual do ecossistema JS | Reescreve o spike e o `blockchain`; muda o `STACK.md`; wallet adapter da S04 ainda é v1 |
| Dois SDKs (v1 no código, Kit nos testes) | Sem migração | Teste exercita caminho diferente do da aplicação |
| **`litesvm` crate (Rust) + fixtures — a escolhida** | Default do Anchor 1.0, já nas dev-dependencies; sem SDK JS envolvido; decisão de SDK adiada para a S04, quando o wallet adapter dita o requisito | Fixtures precisam de regeneração quando o Catálogo mudar |

---

## Decisão tomada

> **Testes no crate, com `litesvm`, alimentados por fixtures que o
> `packages/catalog` gera.**

O ponto que resolve a objeção óbvia — "testar em Rust obriga a reimplementar a
Merkle" — é que **não obriga**. As fixtures são geradas pelo Catálogo em
TypeScript e commitadas; o teste em Rust apenas as consome:

```
packages/catalog (TS)  ──gera──>  fixture commitada  ──lê──>  teste (Rust)
        ^                          address, text,              exercita a
   implementação                   proof[], root               verificação
   de referência                                               on-chain
```

Isso **é** o cross-check que interessa. O programa precisa reimplementar o
algoritmo de qualquer forma — é ele que verifica on-chain. O que o teste prova
é que a implementação Rust aceita exatamente as proofs que a implementação TS
produz. Se as duas divergirem em qualquer detalhe (ordem dos pares, prefixo de
folha, endianness), a fixture falha.

Uma suíte escrita em Rust gerando as próprias proofs em Rust não provaria nada
disso — validaria a implementação contra si mesma.

---

## Consequências

**Positivas:**
- Sem dependência abandonada no caminho do artefato irreversível
- Sem decisão de SDK JS forçada agora; ela cabe à S04, guiada pelo wallet adapter
- Divergência entre a Merkle do TS e a do Rust falha o teste, por construção
- `cargo test` roda sem validator, sem Docker e sem rede

**Negativas / Trade-offs:**
- As fixtures são artefato gerado e commitado: mudar o Catálogo exige
  regenerá-las, e um `--check` no CI (como já existe para a Merkle root)
  precisa garantir que não fiquem obsoletas
- Os testes ficam em Rust, distantes do runner Vitest do resto do monorepo:
  `pnpm test` não os cobre; precisam de passo próprio no CI

**Impacto no código:**
- `programs/eternal-word/tests/`, `Cargo.toml` (dev-dependencies já presentes
  vindas do scaffold — deixam de ser resíduo e passam a ser intencionais)
- `packages/catalog` — gerador de fixtures + comando `pnpm catalog:fixtures`
- `.github/workflows/ci.yml` — passo de `cargo test` no container

---

## Revisão futura

Revisitar na S04, quando o `packages/blockchain` precisar falar com a chain de
verdade a partir do navegador: se o ecossistema de wallet adapter já estiver em
`@solana/kit`, vale reavaliar o SDK do repositório inteiro — e aí testes em
TypeScript com `litesvm` voltam à mesa sem o custo de manter dois SDKs.
