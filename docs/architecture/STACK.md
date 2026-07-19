# Stack & Arquitetura

> Preenchido durante onboarding (2026-07-18, a partir da spec inicial).
> Atualize este arquivo sempre que uma decisão de stack mudar.

---

## Runtime & Linguagem

```
Linguagem principal:  TypeScript 5.x (apps e packages) + Rust (programa Solana)
Runtime:              Node 22 LTS
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
Framework:      AWS Lambda (TypeScript) — framework de deploy a confirmar (provável: SST)
ORM / DB:       Drizzle ORM + Supabase Postgres
Auth:           carteira Solana (conexão + assinatura de mensagem) — sem contas tradicionais
```

## Infra & Deploy

```
Hosting:        a definir (provável: Vercel para apps/web, AWS para apps/api e indexer)
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
| —      | —      | —               |

---

## Padrões de arquitetura

```
Padrão geral:     Clean Architecture em monorepo pnpm
Separação:        packages/domain → application → infrastructure | blockchain | shared
Testes:           Vitest — unitários em `__tests__/unit.test.ts`,
                  integração em `__tests__/integration.test.ts`
Lint/format:      Biome (ver ADR 2026-07-19_tooling-e-pacote-catalog.md)
TypeScript:       strict + noUncheckedIndexedAccess + project references
```

### Layout do monorepo

```
apps/
  web/            ← Next.js (placeholder até a S04)
  api/            ← AWS Lambda: API + indexer (placeholder até a S03)
packages/
  domain/         ← entidades e regras de negócio (sem dependências externas) ✅
  catalog/        ← CanonicalText, integridade e Merkle tree ✅
  shared/         ← tipos e utilitários comuns ✅
  application/    ← casos de uso (orquestram domain via ports) — S03/S04
  infrastructure/ ← Drizzle, Supabase, adapters (implementam ports) — S03
  blockchain/     ← cliente do programa, PDAs, transações — S02
programs/
  eternal-word/   ← programa Anchor (Rust) — S02
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
