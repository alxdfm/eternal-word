# Sprint S03 — Tasks

> Prefixos: **PG** = programa Anchor · **DB** = dados (schema/seed/banco) ·
> **IX** = indexer. Objetivo e critério de pronto em [`GOALS.md`](GOALS.md).
> **Sem spike bloqueador** (a forma da árvore fechou na S02). Dependências:
> **DB-01/02 bloqueiam o IX** (sem tabelas não há onde escrever) e **PG-11
> bloqueia a IX-01** (o adapter decodifica o evento que ela emite). PG-11 é
> independente do DB. Ordem: **PG-11 + DB em paralelo, depois IX.**

## Programa — evento on-chain (precursor da camada 1)

- [x] **PG-11** Emitir o evento `VerseRegistered` on-chain no `register_verse`
      (upgrade do programa) — **precursor da IX-01**, independente do DB. ADR
      `docs/decisions/2026-07-21_evento-onchain-no-register-verse.md`.
      Acrescentar `#[event] VerseRegistered { book, chapter, verse, adopter,
      created_at }` + `emit!` ao fim de `handle_register_verse`, **sem** mudar
      contas, argumentos ou a validação Merkle. `emit!` (log-based), **não**
      `emit_cpi!`: evento minúsculo e a camada 3 já cobre truncamento. Não
      afeta o tamanho da transação (é log, não instrução — a folga de 201 B do
      Ester 8:9 fica intacta); CU desprezível. **Janela:** a authority ainda
      existe (R2 só na S06) — depois de revogada, seria impossível.
      Entregar: atualizar a entrada **VerseRegistered** do glossário (o conceito
      passa a existir on-chain — regra do CLAUDE.md: conceito antes do código);
      manter a constante `ROOTS_COMMITMENT` do bytecode **inalterada** (só
      acrescentar `emit!`, senão o `sha256` muda por dois motivos e confunde a
      verificação); teste no litesvm capturando o `Program data:`; rebuild no
      container; `pnpm sync-idl` (o IDL ganha o evento); **upgrade-deploy** em
      devnet (estado preservado — sem re-bootstrap nem re-seal); registrar **um
      versículo novo de amostra em devnet** para confirmar o `Program data:`
      antes de construir o indexer; re-registrar o novo `sha256`/slot em
      `docs/sessions/latest.md`.
      ✅ **2026-07-22** — evento emitido (`emit!`, log-based); 23 testes verdes
      (o novo decodifica o `Program data:` no litesvm); IDL sincronizado; upgrade
      em devnet (slot 478083892, sha256 `8f2c6ecf…485388`) após `solana program
      extend 10240` — o ProgramData da S02 tinha ~128 B de folga e o `.so` com
      `emit!` ficou 856 B maior (228.280 B). Verificado on-chain com Gênesis 1:2
      (`Program data:` de 53 B, discriminador de `VerseRegistered` conferido).
      Detalhes em `docs/sessions/latest.md`.

## Dados (DB)

- [x] **DB-00** Postgres local + cliente Drizzle atrás de port.
      `docker-compose.yml` com Postgres (major alinhada ao Supabase),
      conexão só via env (`DATABASE_URL`) — **nenhuma credencial no repo**.
      Cliente Drizzle em `packages/infrastructure`, implementando a port
      `VerseRepository` (e afins) definida na `application`. Comandos
      `pnpm db:up` / `db:migrate` / `db:seed`. FD-10: o adapter isola o
      Supabase — o mesmo código roda contra Postgres local e contra o
      gerenciado. Empacotamento de deploy é **SST** (ver IX-05); nenhuma
      dependência nova sem ADR.

- [x] **DB-01** Schema Drizzle das 4 tabelas, **exatamente** como a ADR
      `2026-07-18_modelo-de-dados-off-chain.md`: `translations`, `verse_texts`
      (Catálogo), `books` (compartilhada), `verses` (Registro). Enum
      `verse_status` = `AVAILABLE | PENDING | REGISTERED | FAILED`. PKs/FKs +
      índice único **parcial** garantindo exatamente uma tradução
      `is_canonical`; índices para a listagem `verses` × `verse_texts`. Coluna
      **`adopter`**, nunca `owner` (glossário). Migrations versionadas
      (drizzle-kit) — schema reconstruível do zero.

- [x] **DB-02** Seed idempotente a partir do CanonicalText
      (`packages/catalog`): `translations` (WEB `engwebp`, `is_canonical`),
      `books` (1–66 com slug/abreviação/testamento/`chapters_count`),
      `verse_texts` (31.098 + 5 posições `NULL` da WEB) e as **31.098** linhas
      `verses` em `AVAILABLE` (só posições registráveis). Reconstrói do zero e
      **roda de novo sem duplicar**. As contagens conferem com
      `catalog:verify` (66 / 1.189 / 31.098). Decidir se o `account` (PDA) é
      cacheado no seed (derivável de seeds + program id via
      `packages/blockchain`) ou preenchido pelo indexer.

## Indexer (IX)

- [x] **IX-00** Núcleo de sincronização em `packages/application`, atrás de
      ports — **portável, zero dependência de AWS**. Casos de uso:
      `recordRegistered` (evento → `REGISTERED`), `markPending`
      (envio → `PENDING`), `expirePending` (→ `FAILED` → `AVAILABLE`),
      `reconcile` (varredura → correção). Ports: `EventSource` (assina
      `VerseRegistered`), `VerseRepository` (Drizzle), `ChainReader`
      (`getProgramAccounts`/`getAccountInfo` via `packages/blockchain`).

- [x] **IX-01** Camada 1 — evento em tempo real. Adapter `logsSubscribe` no
      **devnet público** (ADR `2026-07-21_fonte-de-eventos-do-indexer.md`):
      assina os logs do Program ID, **decodifica o evento `VerseRegistered`
      tipado via IDL** (emitido pela PG-11, na linha `Program data:`) e chama
      `recordRegistered`, gravando `REGISTERED` + `adopter` + `transaction` +
      `slot` + `registered_at`. Captura registros feitos **fora do site**. O
      adapter Helius webhook pluga na **mesma** port na IX-05 e decodifica o
      mesmo `Program data:`.

- [x] **IX-02** Camada 2 — `PENDING` otimista. O caso de uso `markPending`
      grava `PENDING` ao enviar a transação; a promoção para `REGISTERED` vem
      **somente** do indexer (camada 1/3), **nunca** do cliente. `PENDING`
      além do limite (N slots/segundos) sem confirmação → `FAILED` → volta a
      `AVAILABLE` na reconciliação. A S04 será o consumidor real; aqui o caso
      de uso é exercitado direto, integrado a `packages/blockchain/register`.

- [x] **IX-03** Camada 3 — reconciliação periódica. Job que varre
      `getProgramAccounts` (**só** na reconciliação — nunca como mecanismo
      primário, guardrail do `STACK.md`) e compara o conjunto on-chain com o
      banco: grava eventos perdidos, corrige efeito de reorg via `slot`,
      destrava `PENDING` órfão, resolve **toda** divergência a favor da chain.
      Idempotente; loga o que corrigiu.

- [x] **IX-04** Alerta de atraso do indexer (**risco R4**). Heartbeat: última
      altura processada × slot atual da chain; dispara alerta quando o lag
      passa do limite **ou** o indexer para de bater — não só health check.
      Persistir o cursor (último slot processado) para retomar sem
      reprocessar tudo.

- [x] **IX-05** Provisionamento da infra externa + smoke test S03. Supabase
      Postgres (a mesma migração/seed roda contra ele), Helius plugado na port
      `EventSource`, empacotamento das Lambdas em **SST (v3 / Ion)** — webhook
      via Function URL, reconciliação (IX-03) e heartbeat (IX-04) via cron do
      EventBridge, segredos (RPC + `DATABASE_URL`) no Secrets. ADR do pipeline
      de deploy fecha aqui. **Smoke test em devnet:** (a) registro direto no
      programa (script, sem site) vira `REGISTERED` em segundos, decodificado
      do evento; (b) evento derrubado de propósito (fonte off) é recuperado
      pela reconciliação; (c) `PENDING` expirado volta a `AVAILABLE`. Medir o
      lag real.
      ✅ **2026-07-23 — deployado e verificado em produção.** Supabase (PG 15,
      pooler 6543) migrado + semeado (66/31.103/31.098); SST v4 deployou o
      webhook (Function URL) + Cron de reconciliação (2 min) + Secrets em
      us-west-1; webhook Helius rawDevnet no Program ID. **Smoke real:** um
      `register_verse` em devnet apareceu no Supabase em **~2s** via a Lambda do
      webhook; o cron reconcilia com `health ok`. ADR
      `2026-07-22_deploy-do-indexer-em-sst`. **Bug corrigido no deploy:** o
      `catalog` resolvia o repo root no topo do módulo (`fromRepoRoot`),
      quebrando o INIT da Lambda — virou lazy (`canonicalTextDir()`).
      ⚠️ **Pré-mainnet (S06/S07):** o Function URL é público sem auth —
      adicionar `authHeader` no webhook Helius + checagem na Lambda; rotacionar
      as credenciais AWS/Helius expostas.

## Documentação

- [x] **DB-10** ADRs aceitas: fonte de eventos
      (`2026-07-21_fonte-de-eventos-do-indexer.md`) e evento on-chain
      (`2026-07-21_evento-onchain-no-register-verse.md`). Atualizar `STACK.md`
      (Postgres/Drizzle, **deploy via SST**, comandos `db:*`, novo `sha256` do
      programa), `OVERVIEW.md` (fluxo real do indexer com o evento) e
      `docs/modules/` (indexer e schema; refletir o `emit!` em
      `eternal-word-program.md`). Nenhum `TODO` órfão.
