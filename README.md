# Eternal Word

> The Word, recorded forever.

**Eternal Word** is a **non-profit** platform for permanently recording the verses of the Bible on the Solana blockchain.

Instead of a single maintainer funding all of the storage, anyone can **adopt** one or more verses, paying only the account-creation cost (rent) and the network fees. Once recorded, a verse never needs to be recorded again: the on-chain account is immutable and verifiable by anyone.

**Goal: 100% of the Bible on-chain — distributed, immutable and auditable.**

---

## Status

**Live on Solana devnet.** The devnet deployment runs at **[devnet.eternalword.site](https://devnet.eternalword.site)** — anyone can register a verse end to end, and the explore, dashboard, map, search and profile screens reflect the on-chain state through the open indexer. The interface is English-first, with Portuguese (pt-BR) as a second locale.

**[eternalword.site](https://eternalword.site)** (the apex) is reserved for mainnet: browsing is open, but the register action is replaced by a "launching soon" notice until the mainnet program is deployed — so the empty canon never offers a button that would fail on-chain.

- **Program ID (devnet):** `9up3jAXPTgkJz9UvMLwEiUUSVdPd6E1KshwfxT3dZCdG`
- **Next milestone:** mainnet launch — deploying the *same* verified bytecode to mainnet-beta, flipping registration on, and revoking the upgrade authority (`--final`) at cutover.

---

## How it works

1. A user looks up a verse (book → chapter → verse).
2. If the status is `AVAILABLE`, they connect a wallet.
3. The site fetches the canonical text and its **Merkle proof**, then builds the `register_verse` transaction. The wallet signs and sends it.
4. The on-chain program proves the text against the canon **committed in the program's bytecode**, and creates one account at the PDA `["verse", book, chapter, verse]` — exactly one account per verse, with no possible duplication.
5. The program emits a `VerseRegistered` event; the indexer observes it and marks the verse `REGISTERED` in the off-chain mirror.

The blockchain is the source of truth. The off-chain database acts as a cache, search index and statistics store — and can be **rebuilt from scratch from the chain** by anyone.

### Verse lifecycle (off-chain mirror)

| State | Meaning |
|-------|---------|
| `AVAILABLE` | No account on-chain — open for registration. |
| `PENDING` | Transaction submitted; confirmation not yet observed by the indexer. |
| `REGISTERED` | Account confirmed on-chain. **Terminal and permanent.** |
| `FAILED` | Transaction failed or expired; reconciliation returns it to `AVAILABLE`. |

Because registration is permissionless, a verse can jump straight from `AVAILABLE` to `REGISTERED` when someone registers directly against the program, bypassing the site — that is a normal path, not an anomaly.

---

## Principles

- **Non-profit** — no service fee; whoever adopts pays only rent + network fees.
- **Permissionless** — anyone can register directly against the program, without relying on the site. There is no privileged authority in the registration path.
- **Immutable** — the program has **no `update` and no `close` instruction**. Permanence comes from the absence of a write path, not from a flag someone has to respect.
- **Auditable** — open indexer; the off-chain state is always reconstructible from the blockchain, and the canonical Merkle root is reproducible from this repository.
- **Free and universal text** — the World English Bible (public domain), in modern English as today's universal language; no copyrighted translation goes on-chain.

---

## The canonical text and its Merkle commitment

The whole design hangs on one idea: **the canon is baked into the program**, not supplied to it.

- The canonical text is the **World English Bible (WEB)**, protestant edition — modern English, public domain. Snapshot `engwebp` from eBible.org.
- **66 books · 1,189 chapters · 31,098 registrable verses.** The WEB preserves the traditional numbering but follows the Majority Text in the New Testament, so 5 positions carry no text and are **not registrable** (Luke 17:36, Acts 8:37, Acts 15:34, Acts 24:7, and Romans 16:25 — whose text lives instead in Romans 14:24–26). Provenance in [`data/canonical-text/PROVENANCE.md`](data/canonical-text/PROVENANCE.md).

The commitment is a **two-level Merkle structure**:

- Each **chapter** has a Merkle root over its verse leaves. A leaf is `book:u8 | chapter:u16le | verse:u16le | textLen:u32le | text:utf8` — every field fixed-width or length-prefixed, so no two verses can ever encode to the same bytes.
- A single **root commitment** covers all 1,189 chapter roots. That 32-byte value (`d36e7458…2efc`) is the `ROOTS_COMMITMENT` constant compiled into the program.

Hashing is SHA-256 with domain-separated leaf (`0x00`) and node (`0x01`) prefixes, sorted pairs, and odd nodes promoted — all published in [`data/merkle-root.json`](data/merkle-root.json), so the root is reproducible byte for byte.

Baking the commitment into the bytecode is what removes the need for any authority: nobody — not even a front-runner between deploy and initialization — can choose what counts as "canonical". The canon *is* the program.

Anyone can regenerate the commitment from this repository and confirm it matches what is on-chain:

```bash
pnpm catalog:verify      # 66 books / 1,189 chapters / 31,098 verses + the 5 gaps
pnpm catalog:merkle --check   # reproduces the exact root that goes on-chain
```

Once the root is committed on-chain, the snapshot in `data/canonical-text/` is **frozen** — upstream WEB revisions are deliberately not incorporated, since any change would invalidate on-chain validation.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router) · React 19 · TypeScript · styled-components · TanStack Query · next-intl (en / pt-BR) · Solana Wallet Adapter |
| Read API + indexer | AWS Lambda · TypeScript · Drizzle ORM |
| Database | Postgres — Supabase in production, Docker Compose locally |
| Real-time indexing | Helius webhooks + a scheduled reconcile backstop |
| Blockchain | Solana · Anchor (Rust) — Agave 3.1.13 / Anchor 1.0.0 |
| Deploy | SST v3 (Ion) on AWS · OpenNext for Next.js |
| Tooling | pnpm workspaces · Node 24 · Biome · Vitest · litesvm (Rust program tests) |

### Indexing tiers

The off-chain mirror stays fresh through three layers, so no single failure loses a registration:

1. **Real-time** — Helius posts each confirmed `register_verse` to a webhook Lambda (~1s freshness).
2. **Backstop** — a reconcile Lambda runs every 15 minutes, catching any missed webhook, expiring stale `PENDING` rows, and stamping a heartbeat.
3. **Alerting** — a CloudWatch alarm on the indexer's health metric emails when it falls behind the chain or stops.

Because the chain is the source of truth, the entire mirror can be rebuilt from `getProgramAccounts` at any time.

---

## Monorepo structure

```
apps/
  web/            ← Next.js site (home, register, explore, chapter, map, dashboard, search, profile)
  api/            ← AWS Lambda handlers (webhook, reconcile, web-api) + indexer CLI
packages/
  domain/         ← entities and business rules (verse address, status lifecycle, testament)
  catalog/        ← CanonicalText dataset, integrity checks and Merkle tree
  shared/         ← shared types, Result helpers, repo-root resolution
  application/    ← use cases (indexer sync, reads, proofs, aggregates, pending)
  infrastructure/ ← Drizzle schema/migrations, Postgres repos, chain adapters
  blockchain/     ← program client, PDAs, transaction builders, IDL
programs/
  eternal-word/   ← Anchor program (Rust)
data/
  canonical-text/ ← frozen WEB snapshot (1 JSON per book) + PROVENANCE.md
  merkle-root.json ← published roots and algorithm parameters
scripts/          ← devnet bootstrap, smoke tests, IDL sync, spikes
```

---

## The on-chain program

The program (`programs/eternal-word/`) has a deliberately small surface. Bootstrapping the canon is a one-time, permissionless sequence; after it is **sealed**, only `register_verse` remains callable.

| Instruction | Purpose |
|-------------|---------|
| `initialize_config` | Creates the singleton config PDA. Takes no commitment and no authority — the commitment is the bytecode constant. |
| `initialize_book_roots` | Allocates one book's chapter-roots account, sized deterministically from a bytecode constant. |
| `load_chapter_root` | Stores one chapter root, accepted only if it proves into the commitment. |
| `register_verse` | Proves a verse's text against its chapter root and creates the verse account. Gated on `sealed`. |
| `complete_book` | Marks a book fully loaded (idempotent). |
| `seal` | Closes the canon for good once all 66 books are complete. After sealing, config and roots are never written again. |

**Accounts:**

- `Config` (fixed-seed PDA) — tracks how many books are loaded and whether the canon is sealed. Holds no authority.
- `BookRoots` (PDA per book) — the chapter roots for one book, plus a bitmap of which chapters are loaded. Sharded per book to stay within Solana's per-instruction account-growth limit.
- `VerseAccount` (PDA `["verse", book:u8, chapter:u16le, verse:u16le]`) — the registered verse: `adopter`, `created_at`, `book`, `chapter`, `verse`, and the canonical `text` itself. The wallet is named `adopter`, never `owner` (which on Solana already means the owning program). **This account is created once and never written again.**

The five empty WEB positions need no special-casing: they have no leaf in any chapter tree, so no proof can verify and registration simply fails.

The published bytecode is pinned in [`programs/eternal-word/deployment.json`](programs/eternal-word/deployment.json) (toolchain, artifact hash, deploy slot per cluster) and can be checked against the chain with `pnpm program:verify`.

---

## Read API

The web is a pure client; the database stays server-side behind a Lambda Function URL. Per-IP rate limiting protects both paths (generous for reads, strict for the single write).

| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/` | Verse status by reference (`?book&chapter&verse`). |
| `GET` | `/proof` | Canonical text + Merkle proof for the `register_verse` transaction. |
| `GET` | `/dashboard` | Global aggregates. |
| `GET` | `/progress` | Per-book progress; `?book=N` drills into that book's chapters. |
| `GET` | `/chapter` | One chapter's verses with status (`?book&chapter`). |
| `GET` | `/verses` | Paginated explore listing (`?filter&page&pageSize`). |
| `GET` | `/search` | Full-text search over the canonical text (`?q&limit`). |
| `GET` | `/adopter` | One wallet's profile (`?pubkey&page&pageSize`). |
| `POST` | `/pending` | Optimistic `PENDING` at submit time (best-effort; the indexer reconciles regardless). |

---

## Getting started

**Prerequisites:** Node 24 (`.nvmrc`), pnpm 10.11, and Docker (for the local Postgres and the reproducible program build).

```bash
pnpm install
cp .env.example .env        # local dev values match docker-compose.yml

# quality gates
pnpm typecheck
pnpm lint
pnpm test

# canonical text + Merkle integrity
pnpm catalog:verify
pnpm catalog:merkle --check
```

### Local database + indexer

```bash
pnpm db:up          # start Postgres via docker-compose
pnpm db:migrate     # apply Drizzle migrations
pnpm db:seed        # seed the canonical text
pnpm indexer:dev    # run the indexer locally
```

### Web app

```bash
pnpm web:dev        # Next.js dev server
```

### The Solana program

The release bytecode is built inside a pinned container so it is reproducible:

```bash
pnpm docker:build       # build the toolchain image (Agave 3.1.13 / Anchor 1.0.0)
pnpm program:build      # compile the program in the container
pnpm program:verify     # compare the artifact hash against deployment.json / chain
pnpm bootstrap:devnet   # load the canon and seal it on devnet
pnpm smoke:devnet       # end-to-end registration smoke test
```

> The program's Rust tests run in-process against **litesvm** (no `solana-test-validator`); they are exercised by CI and by `cargo test` under `programs/eternal-word/`.

---

## Continuous integration

`.github/workflows/ci.yml` runs on pushes to `main`, on every pull request, and on manual dispatch:

- **Verify** — `pnpm typecheck`, `pnpm lint`, `pnpm test`.
- **CanonicalText integrity** — dataset counts, **Merkle-root reproducibility**, test-fixture freshness, and a bootstrap dry-run — the spine of the project's public auditability.
- **Program (Rust)** — builds the BPF artifact and runs the program tests in litesvm (happy-path registration, duplicate rejected, forged config rejected, seal gate).

---

## Biblical text and license

The canonical text is the **World English Bible (WEB)** — modern English, public domain. English was chosen as today's universal language; translations into other languages (including Portuguese) may exist as an off-chain display layer, without touching the on-chain record. There are **31,098 registrable verses**. Snapshot provenance in [`data/canonical-text/PROVENANCE.md`](data/canonical-text/PROVENANCE.md).

Code license: [MIT](LICENSE). The biblical text is public domain.
