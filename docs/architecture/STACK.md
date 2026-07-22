# Stack & Arquitetura

> Preenchido durante onboarding (2026-07-18, a partir da spec inicial).
> Atualize este arquivo sempre que uma decisão de stack mudar.

---

## Runtime & Linguagem

```
Linguagem principal:  TypeScript 5.x (apps e packages) + Rust (programa Solana)
Runtime:              Node 24 (`.nvmrc`) — mesma major do runtime alvo das
                      Lambdas (`nodejs24.x`); CI lê `node-version-file`
Package manager:      pnpm (workspaces)
```

## Frontend

```
Framework:      Next.js 15 (App Router)
Estilização:    styled-components 6
State:          a definir (provável: TanStack Query para dados de servidor +
                Solana Wallet Adapter para estado da carteira)
i18n:           English-first, toda string via mensagens — lib a confirmar
                no scaffolding (provável: next-intl); pt-BR planejado
```

## Backend

```
Framework:      AWS Lambda (TypeScript) — deploy via SST (v3 / Ion); ADR do
                pipeline fecha na S03 (IX-05)
ORM / DB:       Drizzle ORM + Supabase Postgres
Auth:           carteira Solana (conexão + assinatura de mensagem) — sem contas tradicionais
```

## Infra & Deploy

```
Hosting:        apps/api e indexer: AWS via SST (S03); apps/web: a definir
                (provável Vercel)
CI/CD:          indefinido
Monitoramento:  nenhum por ora
```

## Blockchain / Web3

```
Chain:          Solana
SDK principal:  @coral-xyz/anchor + @solana/web3.js
Wallet:         Solana Wallet Adapter (Phantom, Solflare, Backpack)
Ambiente:       devnet (mainnet-beta apenas no lançamento)
```

---

## Versões fixadas (crítico)

> Liste aqui dependências com comportamento sensível à versão.

| Pacote | Versão | Motivo de fixar |
|--------|--------|-----------------|
| Node | 24 | `.nvmrc` + `engines`; mesma major das Lambdas (`nodejs24.x`) |
| Agave (Solana CLI) | 3.1.13 | Fixado no `Dockerfile.build`. Bytecode compilado com toolchain diferente da que gerou o hash publicado é indistinguível de bytecode adulterado — ver S02 |
| Anchor CLI | 1.0.0 | Idem; instalado via `avm` no container |
| `anchor-lang` (crate) | 1.1.2 | Fixado pelo `Cargo.lock` **versionado**, não pelo `Cargo.toml` (que declara caret `"1.0.0"`). O lockfile fixa a árvore inteira; ver ADR `2026-07-19_toolchain-do-programa-anchor.md` |

---

## Padrões de arquitetura

```
Padrão geral:     Clean Architecture em monorepo pnpm
Separação:        packages/domain → application → infrastructure | blockchain | shared
Testes:           Vitest — unitários em `__tests__/unit.test.ts`,
                  integração em `__tests__/integration.test.ts`
Testes do programa: anchor-bankrun (BPF VM in-process, sem validator local),
                  rodando sob o Vitest do workspace — S02/PG-06
Toolchain Solana: container `Dockerfile.build` (Agave + Anchor fixados);
                  build e deploy dentro dele, testes no host
Lint/format:      Biome (ver ADR 2026-07-19_tooling-e-pacote-catalog.md)
TypeScript:       strict + noUncheckedIndexedAccess + project references
```

### Layout do monorepo

```
apps/
  web/            ← Next.js (placeholder até a S04)
  api/            ← indexer nas 3 camadas (runner + CLI) ✅ S03; Lambdas na IX-05
packages/
  domain/         ← entidades e regras de negócio (sem dependências externas) ✅
  catalog/        ← CanonicalText, integridade e Merkle tree ✅
  shared/         ← tipos e utilitários comuns ✅
  application/    ← sync core: ports + casos de uso do indexer ✅ S03
  infrastructure/ ← Drizzle (schema/seed/repo) + adapters de chain ✅ S03
  blockchain/     ← cliente do programa, PDAs, transações, decoders ✅ S02/S03
scripts/          ← pacote do workspace (@eternal-word/scripts): spikes e
                    utilitários. É pacote, e não pasta solta, para entrar no
                    `tsc --build` — script fora das project references não é
                    checado por ninguém
programs/
  eternal-word/   ← programa Anchor (Rust) ✅ scaffold (PG-01)
Anchor.toml       ← devnet apenas, sem entrada de localnet
Cargo.toml        ← workspace Rust (members = programs/*)
Cargo.lock        ← versionado: é o pin real das crates do programa
Dockerfile.build  ← toolchain Agave + Anchor fixada
```

> `catalog` não constava na lista original de pacotes; foi acrescentado na
> S01 porque o Catálogo já era um bounded context em `OVERVIEW.md` e precisa
> ser consumido por web, testes do programa e seed sem arrastar
> infraestrutura junto.

### Comandos

```
pnpm typecheck          tsc --build sobre todas as project references
pnpm lint / lint:fix    Biome (lint + formatação)
pnpm test               Vitest
pnpm catalog:verify     integridade do CanonicalText (66 / 1.189 / 31.098)
pnpm catalog:merkle     regenera data/merkle-root.json
pnpm catalog:merkle --check   falha se a root divergir da commitada (CI)
pnpm spike:pg00         orçamento de transação medido com transações reais
pnpm sync-idl           copia o IDL de target/ para packages/blockchain (versionado)
pnpm docker:build       constrói a imagem da toolchain Anchor/Agave
pnpm program:build      compila o programa dentro do container
pnpm program:keys       anchor keys sync (dentro do container)
pnpm program:deploy     anchor deploy em devnet (monta ~/.config/solana)
pnpm bootstrap:devnet   carga do canon + seal em devnet
pnpm smoke:devnet       registro de fumaça on-chain (rent/CU medidos)
pnpm db:up / db:down    Postgres local (docker compose)
pnpm db:migrate         aplica as migrations Drizzle (db:generate as gera)
pnpm db:seed            popula o Catálogo + as 31.098 posições AVAILABLE
pnpm indexer:dev        roda o indexer (devnet + Postgres local)
pnpm smoke:indexer      smoke do indexer: chain → Postgres nas 2 camadas
```

---

## O que NÃO usar neste projeto

> Registre decisões de "não usar X" aqui para evitar regressões.

- Não usar `getProgramAccounts` como mecanismo primário do indexer — caro e lento
  em mainnet; usar webhooks/`logsSubscribe`, com `getProgramAccounts` apenas na
  reconciliação periódica.
- Não usar armazenamento off-chain (IPFS/Arweave) para o texto dos versículos —
  o texto vive on-chain; essa é a premissa do produto.
- Não subsidiar rent com fundos do projeto — quem registra paga (modelo
  colaborativo, sem fins lucrativos, sem taxa de serviço).
- Não usar `owner` como nome de campo no programa — ver Termos BANIDOS em
  `docs/conventions/UBIQUITOUS_LANGUAGE.md`.
- Não usar `solana-test-validator` / localnet (decisão do Alexandre,
  2026-07-19). Testes do programa rodam em `anchor-bankrun` (BPF VM
  in-process) e a validação real é em **devnet**. Rodar o validator dentro de
  container exige contornar a lentidão do overlayfs para o RocksDB (symlink do
  ledger para um filesystem nativo) — complexidade que o bankrun dispensa.
- Não usar árvore Merkle global — não cabe na transação. Ver ADR
  `2026-07-19_forma-da-merkle-tree-e-orcamento-de-transacao.md`.
