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
    // Where the indexer-down alarm sends (HD-04/R4). Set before deploy:
    //   sst secret set AlertEmail you@example.com
    // The email subscription needs a one-time confirmation click from AWS SNS.
    const alertEmail = new sst.Secret('AlertEmail')

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
      // Cost/DoS ceiling (HD-05): the AWS ACCOUNT concurrency limit is the hard
      // cap (currently 10 total — a new-account default). Per-function reserved
      // concurrency is intentionally NOT set: it can't exceed the account total
      // and would starve the other functions. The authHeader blocks
      // unauthenticated writes; per-IP abuse is handled in the app. If the
      // account limit is raised for mainnet and per-function guarantees are
      // wanted, use `concurrency: { reserved: N }` (NOT a transform).
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
          // Dimension for the EMF health metric (HD-04).
          STAGE: $app.stage,
        },
      },
    })

    // R4 — alerta real de indexer parado/atrasado (HD-04). O reconcile emite a
    // métrica `IndexerHealthy` (1/0) via EMF a cada ciclo; este alarme dispara
    // quando ela cai abaixo de 1 (rodando mas atrasado) OU some (parado —
    // `treatMissingData: breaching`). Um alarme cobre os dois modos de falha do
    // R4. Notifica por e-mail via SNS.
    const alertsTopic = new aws.sns.Topic('IndexerAlerts')
    new aws.sns.TopicSubscription('IndexerAlertsEmail', {
      topic: alertsTopic.arn,
      protocol: 'email',
      endpoint: alertEmail.value,
    })
    new aws.cloudwatch.MetricAlarm('IndexerDown', {
      alarmDescription: 'Eternal Word indexer is behind the chain or stopped (R4).',
      namespace: 'EternalWord/Indexer',
      metricName: 'IndexerHealthy',
      dimensions: { Stage: $app.stage },
      statistic: 'Minimum',
      comparisonOperator: 'LessThanThreshold',
      threshold: 1,
      // Cron roda a cada 15 min → 1 datapoint/900s. 2 períodos ≈ 30 min tolera um
      // ciclo ruim/perdido antes de alarmar; missing = breaching pega o indexer morto.
      period: 900,
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      treatMissingData: 'breaching',
      alarmActions: [alertsTopic.arn],
      okActions: [alertsTopic.arn],
    })

    // Web-facing API (S04, D3): the browser reads verse status here and posts
    // the optimistic PENDING (camada 2, WB-05). The web is a pure client — the
    // DB stays server-side. No RPC needed; CORS is handled by the Function URL.
    const webApi = new sst.aws.Function('WebApi', {
      ...shared,
      handler: 'apps/api/src/handlers/web-api.handler',
      url: {
        cors: { allowOrigins: ['*'], allowMethods: ['GET', 'POST'], allowHeaders: ['content-type'] },
      },
      // Cost ceiling for the public read/PENDING path (HD-05): the account
      // concurrency limit (10 today) is the hard cap. The per-IP token bucket in
      // the handler cuts naive abuse (validated: 429 + Retry-After). Reserved
      // concurrency is not set — see the note on IndexerWebhook above.
      environment: {
        DATABASE_URL: databaseUrl.value,
      },
    })

    // The site (S04, D4): Next.js on AWS via OpenNext, in the same SST app so
    // devnet → mainnet is one stage switch (S07). NEXT_PUBLIC_WEB_API_URL is
    // inlined at build from the WebApi Function URL; the Solana RPC defaults to
    // public devnet in the app. No custom domain yet — the default URL is enough
    // for the devnet journey.
    const web = new sst.aws.Nextjs('Web', {
      path: 'apps/web',
      environment: {
        NEXT_PUBLIC_WEB_API_URL: webApi.url,
      },
    })

    return { webhookUrl: webhook.url, webApiUrl: webApi.url, webUrl: web.url }
  },
})
