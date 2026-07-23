## Decisão: Fonte de eventos da camada 1 do indexer — `logsSubscribe` em dev, Helius webhook em prod

**Data:** 2026-07-21
**Status:** aceita (Alexandre, 2026-07-21)
**Autor:** Claude (em resposta à escolha do Alexandre no arranque da S03)

---

## Contexto

A ADR `2026-07-18_sincronizacao-indexer-tres-camadas.md` decidiu a camada 1
(frescor) como "webhook (Helius) **ou** `logsSubscribe`", sem cravar qual. A
S03 precisa desenvolver o indexer **antes** de a infra externa existir: por
decisão do Alexandre e do ROADMAP, Supabase/Helius/AWS só são provisionados no
**fim** da S03, e até lá o desenvolvimento roda local contra o devnet público.
Um webhook Helius exige um endpoint público e uma conta de provider — que ainda
não temos —, então a camada 1 precisa de uma fonte que funcione hoje, sem
provider e sem custo.

---

## Opções consideradas

| Opção | Prós | Contras |
|-------|------|---------|
| Só Helius webhook | É o alvo de produção; escala bem, sem conexão persistente | Não funciona local sem endpoint público + conta de provider; travaria o desenvolvimento da S03 até o fim da própria sprint |
| Só `logsSubscribe` | Funciona hoje no devnet público, sem provider nem custo | WebSocket persistente não casa com Lambda; sozinho, é frágil em produção (reconexão, perdas) — já mitigado pela camada 3 |
| `logsSubscribe` em dev + Helius em prod, ambos atrás da port `EventSource` — a escolhida | Desenvolve a camada 1 hoje sem infra; troca a fonte de produção sem reescrever o núcleo; a camada 3 cobre perdas de qualquer das duas | Dois adapters para manter; um contrato de `EventSource` para acertar de saída |

---

## Decisão tomada

> **`logsSubscribe` no devnet público como adapter de desenvolvimento; Helius
> webhook como adapter de produção; ambos implementam a port `EventSource`.**

O núcleo do indexer (`packages/application`) não conhece a origem do evento:
recebe um `VerseRegistered` normalizado de qualquer adapter. `logsSubscribe`
destrava a S03 sem depender de infra; o webhook Helius entra na IX-05, plugado
na mesma port, sem tocar no núcleo. A camada 3 (reconciliação) é a rede de
segurança de qualquer das fontes — nenhuma das duas precisa ser perfeita.

Evento on-chain: a PG-11 acrescenta `emit!(VerseRegistered { … })` ao
`register_verse` (ADR `2026-07-21_evento-onchain-no-register-verse.md`), então
os dois adapters decodificam o **mesmo** evento Anchor tipado da linha
`Program data:` do log — nenhum precisa reconstruir a `VerseAccount` criada. A
port `EventSource` normaliza esse evento independentemente da fonte.

---

## Consequências

**Positivas:**
- A S03 desenvolve e testa a camada 1 desde o dia 1, sem provider nem custo
- Trocar/ter mais de uma fonte de produção não mexe no núcleo (só o adapter)
- Alinha com a camada 3 já decidida: a fonte não precisa ser à prova de falha

**Negativas / Trade-offs:**
- Dois adapters de `EventSource` para manter
- `logsSubscribe` (WebSocket persistente) não é modelo de Lambda — por isso
  fica em dev/degradado, e a produção usa webhook

**Impacto no código:**
- `packages/application`: port `EventSource` + normalização de `VerseRegistered`
- `apps/api`/infra: adapter `logsSubscribe` (dev) e adapter Helius (prod)

---

## Revisão futura

Revisitar no endurecimento para mainnet (S06): avaliar `logsSubscribe` próprio
como fonte de produção se o custo do provider pesar (risco R5), e o intervalo da
reconciliação que cobre as perdas da camada 1.
