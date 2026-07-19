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
```

### Layout alvo do monorepo (a criar)

```
apps/
  web/            ← Next.js
  api/            ← AWS Lambda (API + indexer)
packages/
  domain/         ← entidades e regras de negócio (sem dependências externas)
  application/    ← casos de uso (orquestram domain via ports)
  infrastructure/ ← Drizzle, Supabase, adapters (implementam ports)
  blockchain/     ← cliente do programa, derivação de PDAs, construção de transações
  shared/         ← tipos e utilitários comuns
programs/
  eternal-word/   ← programa Anchor (Rust)
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
