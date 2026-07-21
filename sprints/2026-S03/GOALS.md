# Sprint S03 — Dados e indexer

**Prefixos:** `DB` (schema/seed/banco) · `IX` (indexer)
**Branch:** `s03` (a partir de `main`)
**Depende de:** S02 — o programa vivo em devnet e `packages/blockchain`
(PDAs, `accounts`, `register`), que o indexer reaproveita para ler a chain

---

## Objetivo

Tornar o banco um **espelho fiel e fresco** do estado on-chain. Um
`register_verse` feito **direto no programa** (sem site — o programa é
permissionless) aparece no banco como `REGISTERED` em segundos; a
reconciliação corrige um evento perdido de propósito. O banco nunca afirma um
registro que não está na chain.

## Por que esta sprint

O sistema de leitura (dashboard, perfis, o que falta registrar) é servido por
queries baratas no Postgres, não pela chain. Isso exige duas garantias
distintas: **frescor** (segundos, inclusive registros feitos fora do site) e
**confiabilidade** (o banco diverge da chain no máximo temporariamente, e
qualquer conflito resolve a favor dela). É onde o risco **R4** — indexer parado
passando despercebido — precisa fechar com alerta de atraso, não só health
check.

## Escopo

- **Upgrade do programa** para emitir o evento `VerseRegistered` on-chain
  (`emit!`) — precursor da camada 1, na janela antes da revogação da authority
  (R2/S06); ADR `2026-07-21_evento-onchain-no-register-verse.md`
- Schema Drizzle das 4 tabelas + migrations (modelo já decidido em
  `docs/decisions/2026-07-18_modelo-de-dados-off-chain.md`)
- Seed idempotente das 31.098 posições a partir do CanonicalText
- Indexer em 3 camadas (evento em tempo real · PENDING otimista ·
  reconciliação periódica) — `docs/decisions/2026-07-18_sincronizacao-indexer-tres-camadas.md`
- Alerta de atraso do indexer (R4)
- Provisionamento da infra externa (Supabase · Helius · AWS) **no fim da
  sprint** + smoke test da S03 em devnet

## Fora de escopo

Interface (S04), telas de acompanhamento (S05), índice de busca textual
(`tsvector`/`pg_trgm` sobre `verse_texts` — a **tabela** entra aqui, o índice
de busca é S05), decisão sobre a upgrade authority (R2/S06). A **única** mudança
no programa é acrescentar o `emit!` do evento (PG-11) — sem tocar em contas,
argumentos ou validação, feito enquanto a authority ainda existe. Nenhuma outra
instrução nova, e nada de `update`/`close`.

---

## Premissa de ambiente

Desenvolvimento **local** até a IX-05: Postgres em Docker e camada 1 via
`logsSubscribe` no **devnet público** (sem provider) — ver ADR
`2026-07-21_fonte-de-eventos-do-indexer.md`. A infra gerenciada (Supabase,
Helius webhook, AWS/Lambda) é provisionada **ao final da S03** (FD-10), atrás
de ports/adapters, e o mesmo smoke test roda contra ela. Descobrir na S04 que
o provider se comporta diferente invalidaria trabalho da S03.

---

## Critério de pronto

Além da definição global (ver [`../ROADMAP.md`](../ROADMAP.md)):

1. Programa com `emit!` re-deployado em devnet (upgrade), estado preservado
   (sem re-bootstrap nem re-seal) e o novo `sha256` do bytecode registrado em
   `docs/sessions/latest.md`
2. `docker compose up` + `pnpm db:migrate` + `pnpm db:seed` reconstrói o banco
   do zero em máquina limpa; contagens **66 / 1.189 / 31.098** conferem e o
   seed é idempotente (rodar de novo não duplica nem falha)
3. **Smoke test S03 em devnet:** um `register_verse` feito direto no programa
   (script, sem site) aparece como `REGISTERED` em segundos — decodificado do
   evento `VerseRegistered` emitido on-chain — com `adopter`, `transaction` e
   `slot` corretos
4. **Reconciliação:** um evento derrubado de propósito (webhook/subscription
   fora do ar) é recuperado pela camada 3; um `PENDING` expirado volta a
   `AVAILABLE`; qualquer divergência resolve a favor da chain
5. **Alerta de atraso (R4):** dispara quando o lag do indexer passa do limite
   ou o indexer para de bater — não só health check
6. Infra externa provisionada e o **mesmo** smoke test verde contra ela;
   ports/adapters isolam o serviço gerenciado (FD-10)
7. ADRs da fonte de eventos e do evento on-chain aceitas; `STACK.md` e
   `OVERVIEW.md` atualizados; módulo do indexer e do schema documentados em
   `docs/modules/`
