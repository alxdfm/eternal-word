# Módulo: Indexer (Sincronização off-chain)

> O que este módulo **é**: o espelho da chain no Postgres. Mantém o banco fiel e
> fresco ao estado on-chain, para que dashboard, perfis e "o que falta" sejam
> servidos por queries baratas — nunca pela chain.

Entregue na **S03**. Fonte da verdade é sempre a blockchain; o banco diverge no
máximo temporariamente e qualquer conflito resolve a favor dela.

## Onde vive

```
packages/application/src/sync/   núcleo portável (sem driver, sem AWS)
  events.ts        VerseRegistered (evento de domínio, normalizado)
  ports.ts         EventSource · ChainReader · VerseRepository · HeartbeatStore
  use-cases.ts     recordRegistered · markPending · expirePending · reconcile
  heartbeat.ts     evaluateHeartbeat (saúde do indexer, R4)
packages/infrastructure/src/
  db/schema.ts     4 tabelas + verse_status/testament + sync_heartbeat (Drizzle)
  db/verse-repository.ts   VerseRepository sobre Drizzle/postgres.js
  db/heartbeat-store.ts    HeartbeatStore
  chain/logs-event-source.ts       EventSource via connection.onLogs (camada 1)
  chain/program-accounts-reader.ts ChainReader via getProgramAccounts (camada 3)
apps/api/src/indexer/run.ts   runIndexer: amarra as 3 camadas + heartbeat
apps/api/src/cli/indexer.ts   entrypoint (pnpm indexer:dev)
```

## As três camadas (ADR `2026-07-18_sincronizacao-indexer-tres-camadas`)

1. **Tempo real (camada 1).** `EventSource` entrega cada `register_verse`
   confirmado. Em dev: `logsSubscribe` no devnet público, decodificando o evento
   Anchor `VerseRegistered` da linha `Program data:` (ADR
   `2026-07-21_fonte-de-eventos-do-indexer`, `2026-07-21_evento-onchain-no-register-verse`).
   Em prod: Helius webhook na **mesma** port (IX-05). → `recordRegistered`.
2. **PENDING otimista (camada 2).** `markPending` grava PENDING ao enviar a
   transação (consumidor real é a S04); só o indexer promove a REGISTERED.
   `expirePending` envelhece PENDING parado (coluna `updated_at`) → FAILED.
3. **Reconciliação (camada 3).** `reconcile` varre `getProgramAccounts` (só aqui,
   nunca como mecanismo primário — guardrail do STACK) e corrige o que a camada 1
   perdeu; devolve a AVAILABLE um REGISTERED sumido por reorg ou um FAILED gasto.
   Grava só o que falta, para não apagar a assinatura que o evento capturou.

## Regras que não podem quebrar

- **REGISTERED é terminal.** O seed é `onConflictDoNothing` — re-semear nunca
  reverte estado do indexer. A reconciliação nunca reescreve um REGISTERED que a
  chain confirma.
- **Uma tradução canônica.** Índice único parcial em `translations.is_canonical`.
- Nomes: coluna `adopter`, nunca `owner` (glossário). Endereço numérico
  `(book, chapter, verse)`.

## Heartbeat (R4)

`sync_heartbeat` (linha única) é carimbada a cada ciclo de reconciliação.
`evaluateHeartbeat` separa **parado** (silêncio → processo morto) de **atrasado**
(lag de slots), para um indexer parado não passar despercebido. O alerta real
(página/e-mail) é endurecimento da S06; hoje o ciclo loga o estado.

## Verificação

- Testes unitários: `packages/application/__tests__` (reconcile, expiry,
  validação, heartbeat) e `packages/blockchain/__tests__` (decoders do evento e
  da conta).
- Smoke local ponta a ponta: `pnpm smoke:indexer` — reconciliação espelha as
  contas on-chain e um versículo recém-registrado aparece via `logsSubscribe`;
  contra Postgres local + devnet. A mesma execução roda na IX-05 contra a infra
  provisionada.

## Operação e custo (produção)

Deploy via SST (`sst.config.ts`). Ver ADRs
`2026-07-22_deploy-do-indexer-em-sst` e `2026-07-23_tuning-de-custo-do-indexer`.

- **Webhook** (camada 1): `sst.aws.Function` com Function URL, protegida por
  `authHeader` (secret `WebhookAuthToken`). Event-driven — custo ≈ nº de
  registros. **Não faz RPC.**
- **Cron** (camadas 2/3 + R4): `sst.aws.Cron` a **cada 15 min**. Lê a chain
  (`getProgramAccounts`) pelo **devnet público** — Helius fica só no webhook.
- Ambas: **256 MB**, retenção de logs **2 semanas**.

Botões (tudo por env / `sst.config.ts`, sem tocar no núcleo):

| O quê | Onde | Default |
|-------|------|---------|
| Intervalo do cron | `schedule` no `sst.config.ts` | `rate(15 minutes)` |
| RPC do reconcile | `reconcileRpcUrl` no `sst.config.ts` | devnet público |
| TTL do PENDING | `INDEXER_PENDING_TTL_MS` | 120.000 (2 min) |
| Lag máximo (R4) | `INDEXER_MAX_LAG_SLOTS` | 4.000 (~27 min de slots) |
| Silêncio máximo (R4) | `INDEXER_MAX_SILENCE_MS` | 2.700.000 (45 min) |
| Memória / retenção | `shared` no `sst.config.ts` | 256 MB / 2 semanas |

**Segredos:** `sst secret set DatabaseUrl <pooler 6543>` e
`sst secret set WebhookAuthToken <token>` (o mesmo do `authHeader` no Helius).
**Desmontar:** `sst remove --stage production`.

**Custo:** AWS em centavos/mês (o cron consome ~730 GB-s); o teto real é o **free
tier da Helius** (só o webhook o toca agora). Confirmar no dashboard da Helius
após ~24h.

⚠️ **Pré-mainnet (S06):** rate limiting na borda do Function URL (o `authHeader`
bloqueia injeção, mas cada request ainda invoca a Lambda — custo/DoS), RPC
dedicado para o reconcile, e alarme real do heartbeat (CloudWatch → SNS).
