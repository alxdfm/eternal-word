## Decisão: Tuning de custo do indexer — cron de 15 min, reconcile no RPC público, 256 MB

**Data:** 2026-07-23
**Status:** aceita (Alexandre, projeto sem fins lucrativos — pediu para minimizar custo e documentar)
**Autor:** Claude (refino operacional do deploy da IX-05)

---

## Contexto

O indexer foi deployado (ADR `2026-07-22_deploy-do-indexer-em-sst`) com valores
de partida: cron de reconciliação a **cada 2 min**, Lambda de **1024 MB**, e o
reconcile lendo a chain pela **Helius** (mesma RPC do resto). Isso funciona, mas
o projeto é **sem fins lucrativos** e há dois tetos a respeitar:

- **AWS Lambda:** free tier de 1M requests + 400k GB-s/mês. Para contas criadas
  a partir de ~jul/2025 (como a do Alexandre) o modelo virou **crédito por ~6
  meses**, depois tarifa padrão — então importa manter o consumo baixo mesmo
  fora do free tier.
- **Helius:** cota mensal de créditos, e o `getProgramAccounts` (a varredura da
  reconciliação) é uma chamada **pesada**. Este é o teto mais apertado.

O webhook não é o problema: é event-driven (≈ 1 invocação por registro) e o seu
handler **não faz RPC**. O custo contínuo mora no **cron**.

---

## Opções consideradas

| Eixo | Opção | Escolha |
|------|-------|---------|
| Intervalo do cron | 2 min (frescor do backstop) vs 15 min (custo) | **15 min** — o webhook já dá ~1s; o cron só precisa pegar o que ele perder |
| RPC do reconcile | Helius (confiável, gasta crédito) vs devnet público (grátis, pode limitar) | **devnet público** — tira o `getProgramAccounts` da conta da Helius; falha ocasional não importa num backstop |
| Memória da Lambda | 1024 MB (default) vs 256 MB | **256 MB** — os handlers usam ~100 MB |
| Retenção de logs | infinita (default) vs 2 semanas | **2 semanas** — impede o storage do CloudWatch crescer sem fim |

---

## Decisão tomada

> **Cron a cada 15 min; reconcile lê a chain pelo devnet público (Helius só no
> webhook); ambas as Lambdas em 256 MB com retenção de logs de 2 semanas;
> thresholds do heartbeat recalibrados para a cadência de 15 min.**

- **Helius fica só com o webhook** (camada 1). O `getProgramAccounts` da camada 3
  roda em `https://api.devnet.solana.com` — consumo de crédito Helius ≈ zero.
- **Heartbeat (R4):** `INDEXER_MAX_LAG_SLOTS=4000` (~27 min de slots) e
  `INDEXER_MAX_SILENCE_MS=2.700.000` (45 min) — ~2–3 intervalos de folga, para o
  monitor externo (S06) não dar falso positivo entre execuções.
- Tudo é **override por env** (`INDEXER_RECONCILE_MS` no CLI local;
  `INDEXER_MAX_*`, `SOLANA_RPC_URL` nas Lambdas) — mudar não exige tocar código.

### Custo estimado (tarifa AWS cheia, us-west-1)

| Item | Antes (2 min / 1 GB) | Depois (15 min / 256 MB) |
|------|----------------------|--------------------------|
| Invocações do cron | ~21.900/mês | ~2.900/mês |
| Compute | ~21.900 GB-s → ~US$0,37 | ~730 GB-s → **~US$0,01** |
| `getProgramAccounts` na Helius | ~21.900/mês | **0** (RPC público) |

AWS total continua em **centavos/mês**; o alívio real é no **Helius** (créditos)
e no storage de logs.

---

## Consequências

**Positivas:**
- Consumo Helius do indexer ≈ zero (webhook é barato; gPA saiu da conta)
- Custo AWS praticamente nulo, mesmo fora do free tier
- Logs não acumulam custo de storage

**Negativas / Trade-offs:**
- Backstop mais lento: um registro que o webhook perder aparece em até **15 min**
  (raro — o webhook Helius é confiável); PENDING órfão expira em até 15 min
- Janela de detecção de indexer morto (R4) sobe para ~45 min — aceitável em
  devnet; apertar na S06
- O devnet público pode **limitar/atrasar** o `getProgramAccounts` de vez em
  quando; como o cron é backstop, a próxima execução refaz

**Impacto no código:**
- `sst.config.ts` (intervalo, memória, retenção, RPC do reconcile)
- `apps/api/src/handlers/reconcile.ts` (defaults dos thresholds)

---

## Revisão futura

Na **S06/S07 (mainnet):** RPC dedicado para o reconcile (o público não aguenta
mainnet), cron possivelmente mais frequente, **rate limiting na borda** do
Function URL do webhook (o `authHeader` bloqueia injeção, mas cada request ainda
invoca a Lambda — vetor de custo/DoS), e alarme real do heartbeat (CloudWatch →
SNS). Confirmar o consumo real no **dashboard da Helius** após ~24h rodando.
