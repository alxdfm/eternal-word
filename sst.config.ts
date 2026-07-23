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
    const solanaRpcUrl = new sst.Secret('SolanaRpcUrl')
    // Shared secret the webhook checks against Helius's Authorization header.
    const webhookAuthToken = new sst.Secret('WebhookAuthToken')

    const environment = {
      DATABASE_URL: databaseUrl.value,
      SOLANA_RPC_URL: solanaRpcUrl.value,
    }

    // Camada 1 (prod): Helius posts confirmed registrations to this URL. Point a
    // Helius raw-transaction webhook (with the matching authHeader) at it.
    const webhook = new sst.aws.Function('IndexerWebhook', {
      handler: 'apps/api/src/handlers/webhook.handler',
      url: true,
      environment: { ...environment, WEBHOOK_AUTH_TOKEN: webhookAuthToken.value },
    })

    // Camadas 2/3 + heartbeat: reconciliation on a schedule (R4 backstop).
    new sst.aws.Cron('IndexerReconcile', {
      schedule: 'rate(2 minutes)',
      function: {
        handler: 'apps/api/src/handlers/reconcile.handler',
        timeout: '120 seconds',
        environment,
      },
    })

    return { webhookUrl: webhook.url }
  },
})
