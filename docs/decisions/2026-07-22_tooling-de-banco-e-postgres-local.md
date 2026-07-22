## Decisão: Tooling de banco — driver `postgres.js`, `drizzle-kit` e Postgres local em Docker

**Data:** 2026-07-22
**Status:** aceita (escolha técnica dentro da direção já aceita em
`STACK.md` e `2026-07-18_modelo-de-dados-off-chain.md`; revisitável na IX-05)
**Autor:** Claude (arranque da DB-00, autorizado pelo Alexandre)

---

## Contexto

A S03 usa **Drizzle ORM + Supabase Postgres** — já decidido no `STACK.md` e na
ADR do modelo de dados. Falta cravar o *tooling* concreto para começar a
DB-00: qual **driver** Postgres o Drizzle usa, como rodar **migrations**, e
como ter um Postgres **local** enquanto a infra gerenciada só entra na IX-05
(premissa do ROADMAP: desenvolvimento local atrás de ports/adapters). Como
envolve dependências novas, registra-se aqui o motivo (guardrail do CLAUDE.md).

---

## Opções consideradas

| Tema | Opção | Escolha |
|------|-------|---------|
| Driver | `pg` (node-postgres) — maduro, ubíquo | — |
| Driver | `postgres` (postgres.js) — leve, sem build nativo, par recomendado do Drizzle com Supabase, `prepare:false` casa com o pooler | **escolhida** |
| Migrations | `drizzle-kit generate` + `migrate` (SQL versionado) vs `push` (sem histórico) | **generate + migrate** — banco reconstruível do zero, migrations versionadas |
| Postgres local | binário na máquina vs container | **docker-compose** — reprodutível, isolado, alinhado ao "sem instalar serviço no host" |
| Versão | Supabase oferece **15** e 17 (pulou o 16); 15 é o mais rodado | **15** — alinhamento final na IX-05 |

---

## Decisão tomada

> **`drizzle-orm` sobre `postgres` (postgres.js), migrations por `drizzle-kit`
> generate+migrate, Postgres 15 local via `docker-compose`, conexão só por
> `DATABASE_URL`.**

- `postgres.js` com `prepare: false`: o mesmo cliente serve o Postgres local
  (conexão direta) e o Supabase em produção (pooler Supavisor em modo
  *transaction*, que não suporta prepared statements). Um cliente, dois
  ambientes — a port isola o resto do código do driver (FD-10).
- `drizzle-kit generate` emite SQL versionado em `packages/infrastructure`; o
  esquema é reconstruível do zero (critério de pronto da S03). `push` foi
  descartado por não deixar histórico auditável.
- Nenhuma credencial no repositório: `.env` é gitignored, commita-se
  `.env.example` com o valor de dev local.

---

## Consequências

**Positivas:**
- Desenvolvimento local sem depender do Supabase (só na IX-05)
- Driver único para local e produção; troca de driver não vaza além da port
- Migrations versionadas — reconstrução do banco é auditável

**Negativas / Trade-offs:**
- `prepare: false` desliga prepared statements (perda de performance pequena;
  necessária para o pooler do Supabase)
- Três dependências novas em `packages/infrastructure`: `drizzle-orm`,
  `postgres` (runtime), `drizzle-kit` (dev)

**Impacto no código:**
- `docker-compose.yml`, `.env.example` (raiz)
- `packages/infrastructure`: cliente Drizzle, `drizzle.config.ts`, schema
  (DB-01) e a implementação da port `VerseRepository` (DB-01/IX-00)
- Scripts `db:up` / `db:generate` / `db:migrate` (e `db:seed` na DB-02)

---

## Revisão futura

Revisitar na IX-05, ao provisionar o Supabase: fixar a **major** do Postgres à
do projeto Supabase e a string de conexão do pooler (porta 6543, modo
transaction). Reavaliar `prepare` se sair do pooler para conexão direta.
