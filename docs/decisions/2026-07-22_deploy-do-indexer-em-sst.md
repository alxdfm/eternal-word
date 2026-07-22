## Decisão: Deploy do indexer em AWS via SST (webhook + cron)

**Data:** 2026-07-22
**Status:** aceita (Alexandre confirmou SST; scaffold no handoff da IX-05,
`sst deploy` fica com o Alexandre)
**Autor:** Claude (fechando o "ADR do pipeline" que a IX-05 previa)

---

## Contexto

O indexer tem duas naturezas de execução que não cabem no mesmo formato: a
**camada 1** (tempo real) precisa de um endpoint HTTP que o Helius chame a cada
registro, e as **camadas 2/3** (reconciliação, expiração de PENDING, heartbeat)
precisam rodar **no relógio**, inclusive quando ninguém registra nada. O
`STACK.md` já fixou AWS Lambda + SST; falta cravar a forma. O programa Solana
**nunca** entra em pipeline (ADR `2026-07-19_pipeline-de-deploy`).

---

## Opções consideradas

| Opção | Prós | Contras |
|-------|------|---------|
| Processo `logsSubscribe` sempre ligado (como em dev) | Um só mecanismo | WebSocket persistente não é modelo de Lambda; exigiria um serviço 24/7 (ECS/EC2) — custo fixo para um projeto sem receita |
| AWS CDK | Oficial, estável | Mais boilerplate, sem live-dev; TS menos ergonômico |
| SST v3 (Ion) — a escolhida | TS-native; `Function` (URL) + `Cron` + `Secret` cobrem exatamente o indexer; `sst dev` para iterar no webhook | Framework novo, com backend de state próprio; churn |

---

## Decisão tomada

> **SST v3: uma `Function` com Function URL para o webhook Helius (camada 1) e um
> `Cron` para a reconciliação/expiração/heartbeat (camadas 2/3, R4); segredos em
> `sst.Secret`.**

- `apps/api/src/handlers/webhook.handler` recebe o payload raw do Helius, decodifica
  os eventos `VerseRegistered` (`parseHeliusWebhook`, mesma decodificação da linha
  `Program data:` do adapter de dev) e chama `recordRegistered`. Responde 200 para
  o Helius não reenviar — o que passar é recuperado pela reconciliação.
- `apps/api/src/handlers/reconcile.handler` roda a cada 2 min: `expirePending`,
  `reconcile` (via `getProgramAccounts`) e grava o heartbeat; loga alerta quando
  `evaluateHeartbeat` acusa parada/atraso.
- Segredos `DatabaseUrl` (pooler do Supabase, porta 6543) e `SolanaRpcUrl` (RPC
  dedicado, ex. Helius) via `sst secret set`. Os mesmos ports/adapters de dev —
  só muda a configuração.

---

## Consequências

**Positivas:**
- Camada 1 sem serviço 24/7: paga-se por invocação do webhook
- Reconciliação garantida pelo cron mesmo em silêncio (fecha o R4 em produção)
- Núcleo inalterado: os handlers só instanciam adapters e chamam casos de uso

**Negativas / Trade-offs:**
- Provisionamento externo (AWS + Supabase + Helius) fica com o mantenedor
- Alerta real (SNS/e-mail) do heartbeat é endurecimento da S06; hoje vai para o
  log do CloudWatch

**Impacto no código:**
- `sst.config.ts` (raiz), `apps/api/src/handlers/*`, `apps/api/src/context.ts`
- `packages/infrastructure/src/chain/helius-webhook.ts`

---

## Revisão futura

Na S06 (endurecimento): alarme de CloudWatch sobre o heartbeat, rate limiting do
webhook, e reavaliar o intervalo do cron sob carga real. O RPC/webhook pago entra
no custo recorrente do mantenedor (risco R5).
