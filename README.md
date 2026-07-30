# Eternal Word

> The Word, recorded forever.

**Eternal Word** is a **non-profit** platform for permanently recording the verses of the Bible on the Solana blockchain.

Instead of a single maintainer funding all of the storage, anyone can **adopt** one or more verses, paying only the account-creation cost (rent) and the network fees. Once recorded, a verse never needs to be recorded again: the on-chain account is immutable and verifiable by anyone.

**Goal: 100% of the Bible on-chain — distributed, immutable and auditable.**

---

## How it works

1. A user looks up a verse (book → chapter → verse).
2. If the status is `AVAILABLE`, they connect a wallet and sign the transaction.
3. The Anchor program validates the text against the canonical text and creates the account at the PDA `["verse", book, chapter, verse]` — exactly one account per verse, with no possible duplication.
4. The indexer detects the new account and marks the verse as `REGISTERED` in the off-chain index.

The blockchain is the source of truth. The off-chain database (Supabase) acts as a cache, search index and statistics store — and can be rebuilt from scratch from the chain by anyone.

---

## Principles

- **Non-profit** — no service fee; whoever adopts pays only rent + network fees.
- **Permissionless** — anyone can register directly against the program, without relying on the site.
- **Immutable** — the program has no `update` or `close` instructions.
- **Auditable** — open indexer; the off-chain state is always reconstructible from the blockchain.
- **Free and universal text** — the World English Bible (public domain), in modern English as today's universal language; no copyrighted translation goes on-chain.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js + TypeScript + styled-components |
| Backend | AWS Lambda + TypeScript + Drizzle ORM |
| Database | Supabase (Postgres) |
| Blockchain | Solana + Anchor (Rust) |

Details in [`docs/architecture/STACK.md`](docs/architecture/STACK.md) and [`docs/architecture/OVERVIEW.md`](docs/architecture/OVERVIEW.md).

---

## Monorepo structure

```
apps/
  web/            ← Next.js (register, explore, profile, dashboard, map, search)
  api/            ← AWS Lambda (read API + indexer)
packages/
  domain/         ← entities and business rules
  catalog/        ← CanonicalText, integrity and Merkle tree
  shared/         ← shared types and utilities
  application/    ← use cases (indexer sync, reads)
  infrastructure/ ← Drizzle, Supabase, chain adapters
  blockchain/     ← program client, PDAs, transactions
scripts/          ← workspace utilities and spikes
programs/
  eternal-word/   ← Anchor program (Rust)
```

---

## Status

**Live on Solana devnet** at **[eternalword.site](https://eternalword.site)** — anyone can register a verse end to end from the site, and the explore, dashboard, map, search and profile screens reflect the on-chain state through the open indexer. The interface is English-first, with Portuguese (pt-BR) as a second locale. Architecture decisions are recorded in [`docs/decisions/`](docs/decisions/). **Mainnet launch is the next milestone.**

## Biblical text and license

The canonical text is the **World English Bible (WEB)** — modern English, public domain. English was chosen as today's universal language; translations into other languages (including Portuguese) may exist as an off-chain display layer, without touching the on-chain record. There are **31,098 registrable verses** (the WEB preserves the traditional numbering, but 5 positions have no text). Snapshot provenance in [`data/canonical-text/PROVENANCE.md`](data/canonical-text/PROVENANCE.md).

Code license: [MIT](LICENSE).
