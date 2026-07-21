# Roadmap de Sprints — Eternal Word

> Sequência de entregas até o lançamento em mainnet e o backlog contínuo
> depois dele. Detalhe fino só nas sprints próximas — as distantes têm
> escopo e critério de pronto, e ganham `tasks.md` ao serem iniciadas.

---

## Modelo de execução

- **Produto real, não MVP.** Nenhuma sprint fecha com "depois a gente
  arruma": teste automatizado, tratamento de erro e documentação fazem
  parte da entrega, não de uma fase futura.
- **Entrega contínua.** Cada sprint termina com algo verificável rodando —
  não com código parado numa branch.
- **Branch por sprint** (`s01`, `s02`, …) a partir de `main`; merge só com
  o critério de pronto atendido.
- **Toda decisão não-trivial vira ADR** em `docs/decisions/` antes de virar
  código (guardrail do CLAUDE.md).
- **`docs/sessions/latest.md` atualizado ao fim de cada sessão.**

## Smoke tests — três, não um

O provisionamento de infra externa (Supabase, AWS, RPC/webhook) foi adiado
por decisão do Alexandre. Isso **não** empurra a validação real para o fim:
cada camada tem seu smoke test no momento em que fica testável.

| Quando | O que se valida | Precisa de infra? |
|--------|-----------------|-------------------|
| **Fim da S02** | Registro real on-chain em **devnet**: carteira assina, programa cria a conta, duplicidade é recusada, Ester 8:9 cabe na transação com `ComputeBudget` | **Não** — devnet é público e gratuito |
| **Fim da S03** | Indexer real: registro feito direto no programa aparece no banco em segundos; reconciliação recupera evento derrubado de propósito | **Sim** — Supabase, AWS e provider de webhook |
| **Fim da S04** | Jornada completa: site → carteira → programa → indexer → banco → tela, com `PENDING → REGISTERED` | Sim (a mesma da S03) |

**Provisionar a infra ao final da S03, não ao final do desenvolvimento.** O
desenvolvimento da S03 e da S04 continua local (Postgres em Docker,
validador local ou devnet público, atrás de portas/adapters — ver FD-10),
mas o comportamento que só aparece contra serviço real — entrega de webhook,
cold start de Lambda, rate limit de RPC — precisa ser exercitado enquanto o
indexer ainda está fresco. Descobrir na S04 que o provider se comporta
diferente invalidaria trabalho da S03.

O smoke test da S02 é o mais importante dos três: valida a única parte
irreversível do sistema, e não custa nada nem depende de ninguém.

---

## Definição de pronto (global)

Vale para toda sprint, além do critério específico dela:

1. `pnpm test` verde no CI (unit + integração da sprint)
2. `tsc` sem erro e linter limpo nos arquivos tocados
3. Sem `TODO` órfão — todo pendente aponta para issue ou ADR
4. Documentação afetada atualizada (STACK, OVERVIEW, glossário, ADRs)
5. Nada quebrado no que sprints anteriores entregaram

---

## Sequência

```
S01 fundação  →  S02 programa  →  S03 dados+indexer  →  S04 registro web
                                                              ↓
                          S07 mainnet  ←  S06 endurecimento  ←  S05 acompanhamento
                                ↓
                          S08+ backlog contínuo
```

### S01 — Fundação do monorepo e do Catálogo
**Entrega:** repositório executável — `pnpm test` verde no CI, domínio
modelado e **Merkle root do CanonicalText gerada de forma reprodutível**.
Prefixos: `FD` (fundação), `CT` (catálogo).
→ [`2026-S01/`](2026-S01/GOALS.md)

### S02 — Programa Anchor em devnet
**Entrega:** `register_verse` deployado em devnet, com validação Merkle,
IDL publicado e suíte de testes cobrindo os caminhos de falha.
Começa pelo **spike PG-00 (orçamento de transação)**, que decide a forma da
árvore e bloqueia o resto da sprint.
Prefixo: `PG`.
→ [`2026-S02/`](2026-S02/GOALS.md)

### S03 — Dados e indexer
**Entrega:** um registro feito **direto no programa** (sem site) aparece no
banco em segundos, e a reconciliação corrige um evento perdido de propósito.
Schema Drizzle, seed das 31.098 posições, indexer nas 3 camadas, alerta de
atraso do indexer. Prefixos: `DB`, `IX`.

### S04 — Registro pela web
**Entrega:** qualquer pessoa com carteira registra um versículo pelo site em
devnet, do início ao fim, e vê `PENDING → REGISTERED`. Next.js com i18n
English-first, wallet adapter, busca por referência, construção da proof no
cliente. Prefixo: `WB`.

### S05 — Acompanhamento e comunidade
**Entrega:** telas de progresso no ar — explorar (registrados, pendentes,
recentes), dashboard global, perfil do adopter, busca textual e mapa de
progresso por livro. Prefixo: `EX`.

> Detalhe de UI a não esquecer: as quatro posições sem texto na WEB
> (Lc 17:36, At 8:37, At 15:34, At 24:7) criam saltos na numeração — quem
> ler Atos 8 vai de 36 para 38. A tela precisa explicar a ausência, senão
> parece defeito. Só nota explicativa; o texto ausente **não** vai on-chain
> (ver ADR do texto canônico).

### S06 — Endurecimento e prontidão para mainnet
**Entrega:** checklist de go-live completa. Revisão de segurança do
programa, **decisão sobre a upgrade authority** (ver riscos abaixo),
verificação de bytecode, teste de carga do indexer, rate limiting, runbooks,
backup/restore, pt-BR como segunda locale. Prefixo: `HD`.

### S07 — Lançamento em mainnet
**Entrega:** produto no ar e primeiro versículo registrado em mainnet. Root
definitiva, deploy do programa, seed de produção, domínio, monitoramento.
Prefixo: `GL`.

### S08+ — Backlog contínuo (pós-lançamento)
API pública de consulta; indexador self-host documentado (reconstruir o
banco do zero a partir da chain); exportação JSON/CSV para auditoria
independente; badges e NFTs comemorativos de marcos; traduções de exibição
off-chain; anotações editoriais (ver ADR de extensibilidade). Sem ordem
fixa — priorizar por demanda real da comunidade.

---

## Riscos abertos que atravessam sprints

| # | Risco | Onde se resolve |
|---|-------|-----------------|
| ~~R1~~ | ~~**Orçamento de transação sem margem**~~ — **encerrado em 2026-07-19** pelo spike PG-00. Medido com transações reais, era pior do que se pensava: a árvore global dava 1.264 B e **não cabia nem sem `ComputeBudget`** (a estimativa antiga errou ~38 B para menos). Root por capítulo adotada: 998 B em v0 com `ComputeBudget`, 234 B de folga. Ver ADR `2026-07-19_forma-da-merkle-tree-e-orcamento-de-transacao.md`. | Resolvido |
| R2 | **Upgrade authority do programa** — um programa "eterno" que continua atualizável contradiz a promessa. Revogar a authority (imutável de verdade) versus manter para correções de segurança é decisão de produto, não só técnica. | **HD** (S06) → vira ADR antes do go-live |
| R3 | **Autoridade da Merkle root** — se a conta de config permite trocar a root depois do lançamento, existe um caminho para reescrever o que é "canônico". Relacionado ao R2. | Desenho do programa (S02) + **HD** (S06) |
| R4 | **Indexer parado passa despercebido** — o site continua servindo dado velho sem erro visível. Precisa de alerta por atraso (heartbeat/lag), não só health check. | **IX** (S03), endurecido em **HD** (S06) |
| R5 | **Custo de RPC/webhook em mainnet** — projeto sem receita; provider pago é custo recorrente do mantenedor. | **HD** (S06) |
| ~~R6~~ | ~~**Monopolização do registro**~~ — **encerrado em 2026-07-19**: sem limite por carteira, por decisão de produto. O financiamento distribuído é meio, não fim. Ver ADR `2026-07-19_registro-sem-limite-por-carteira.md`. | Resolvido |
