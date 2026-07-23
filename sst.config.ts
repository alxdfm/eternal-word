/// <reference path="./.sst/platform/config.d.ts" />

// Deploy of the indexer (apps/api) on AWS via SST v3 / Ion. The program itself
// is never in a pipeline (ADR 2026-07-19_pipeline-de-deploy). Scaffolded in the
// S03/IX-05 handoff; complete with `sst install` then `sst deploy`.
//
// Secrets (set before deploy):
//   sst secret set DatabaseUrl "postgres://...supabase-pooler...:6543/postgres"
//   sst secret set SolanaRpcUrl "https://devnet.helius-rpc.com/?api-key=..."
export default $config({
  app(input) {
    return {
      name: 'eternal-word',
      removal: input.stage === 'production' ? 'retain' : 'remove',
      home: 'aws',
    }
  },
  async run() {
    const databaseUrl = new sst.Secret('DatabaseUrl')
    // Shared secret the webhook checks against Helius's Authorization header.
    const webhookAuthToken = new sst.Secret('WebhookAuthToken')

    // getProgramAccounts (the reconcile) is a heavy call and the biggest RPC
    // consumer. It runs on the FREE public devnet RPC, so Helius credits are
    // spent only on the webhook. For mainnet, or if the public RPC throttles
    // getProgramAccounts, point this at a dedicated RPC (e.g. Helius). Ver ADR
    // docs/decisions/2026-07-23_tuning-de-custo-do-indexer.md.
    const reconcileRpcUrl = 'https://api.devnet.solana.com'

    // Both handlers use ~100 MB, so 256 MB is ample; a 2-week log retention caps
    // CloudWatch storage. Same ADR.
    const shared = {
      memory: '256 MB',
      logging: { retention: '2 weeks' },
    } as const

    // Camada 1 (prod): Helius posts confirmed registrations here (with the
    // matching authHeader). The handler makes no RPC call — it only parses and
    // writes — so it needs no SOLANA_RPC_URL.
    const webhook = new sst.aws.Function('IndexerWebhook', {
      ...shared,
      handler: 'apps/api/src/handlers/webhook.handler',
      url: true,
      environment: {
        DATABASE_URL: databaseUrl.value,
        WEBHOOK_AUTH_TOKEN: webhookAuthToken.value,
      },
    })

    // Camadas 2/3 + heartbeat: the backstop. Every 15 min is enough — the
    // webhook gives ~1s freshness, so this only catches misses, expires stale
    // PENDING, and stamps the heartbeat (R4). Longer interval = fewer Lambda
    // runs, and the public RPC means zero Helius credits.
    new sst.aws.Cron('IndexerReconcile', {
      schedule: 'rate(15 minutes)',
      function: {
        ...shared,
        handler: 'apps/api/src/handlers/reconcile.handler',
        timeout: '120 seconds',
        environment: {
          DATABASE_URL: databaseUrl.value,
          SOLANA_RPC_URL: reconcileRpcUrl,
        },
      },
    })

    return { webhookUrl: webhook.url }
  },
})
