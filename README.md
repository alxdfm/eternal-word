# Eternal Word

> A Palavra, registrada para sempre.

**Eternal Word** é uma plataforma **sem fins lucrativos** para registrar permanentemente os versículos da Bíblia na blockchain Solana.

Em vez de um único mantenedor custear todo o armazenamento, qualquer pessoa pode **adotar** um ou mais versículos, pagando apenas o custo de criação da conta (rent) e as taxas de rede. Uma vez registrado, o versículo nunca mais precisa ser registrado: a conta on-chain é imutável e verificável por qualquer pessoa.

**Meta: 100% da Bíblia on-chain, de forma distribuída, imutável e auditável.**

---

## Como funciona

1. O usuário busca um versículo (livro → capítulo → versículo).
2. Se o status for `AVAILABLE`, conecta a carteira e assina a transação.
3. O programa Anchor valida o texto contra o texto canônico e cria a conta na PDA `["verse", book, chapter, verse]` — exatamente uma conta por versículo, sem duplicidade possível.
4. O indexer detecta a nova conta e marca o versículo como `REGISTERED` no índice off-chain.

A blockchain é a fonte da verdade. O banco off-chain (Supabase) funciona como cache, índice de busca e base de estatísticas — e pode ser reconstruído do zero a partir da chain por qualquer pessoa.

---

## Princípios

- **Sem fins lucrativos** — nenhuma taxa de serviço; quem adota paga apenas rent + taxas de rede.
- **Permissionless** — qualquer pessoa pode registrar direto no programa, sem depender do site.
- **Imutável** — o programa não possui instruções de `update` nem `close`.
- **Auditável** — indexador aberto; o estado off-chain é sempre reconstituível a partir da blockchain.
- **Texto livre e universal** — World English Bible (domínio público), em inglês moderno por ser a língua universal atual; nenhuma tradução protegida vai on-chain.

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | Next.js + TypeScript + styled-components |
| Backend | AWS Lambda + TypeScript + Drizzle ORM |
| Banco | Supabase (Postgres) |
| Blockchain | Solana + Anchor (Rust) |

Detalhes em [`docs/architecture/STACK.md`](docs/architecture/STACK.md) e [`docs/architecture/OVERVIEW.md`](docs/architecture/OVERVIEW.md).

---

## Estrutura planejada do monorepo

```
apps/
  web/            ← Next.js (busca, exploração, perfil, dashboard)
  api/            ← AWS Lambda (API + indexer)
packages/
  domain/         ← entidades e regras de negócio
  application/    ← casos de uso
  infrastructure/ ← Drizzle, Supabase, adapters
  blockchain/     ← cliente do programa, PDAs, transações
  shared/         ← tipos e utilitários comuns
programs/
  eternal-word/   ← programa Anchor (Rust)
```

---

## Status

**Fase de especificação.** As decisões de arquitetura estão sendo registradas em [`docs/decisions/`](docs/decisions/) — algumas ainda com status `proposta`, aguardando aceite.

## Texto bíblico e licença

O texto canônico é a **World English Bible (WEB)** — inglês moderno, domínio público. O inglês foi escolhido por ser a língua universal atual; traduções em outros idiomas (incluindo português) poderão existir como camada de exibição off-chain, sem tocar o registro on-chain. São **31.098 versículos registráveis** (a WEB preserva a numeração tradicional, mas 5 posições não têm texto). Proveniência do snapshot em [`data/canonical-text/PROVENANCE.md`](data/canonical-text/PROVENANCE.md).

Licença do código: [MIT](LICENSE).
