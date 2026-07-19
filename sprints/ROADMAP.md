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
| R1 | **Orçamento de transação sem margem** — pior caso (Ester 8:9 + proof de 15 níveis) fica a ~8 bytes do limite de 1.232; uma instrução `ComputeBudget` estoura. Mitigação analisada: root por capítulo (proof cai para 256 bytes). | Spike **PG-00** (S02) → vira ADR |
| R2 | **Upgrade authority do programa** — um programa "eterno" que continua atualizável contradiz a promessa. Revogar a authority (imutável de verdade) versus manter para correções de segurança é decisão de produto, não só técnica. | **HD** (S06) → vira ADR antes do go-live |
| R3 | **Autoridade da Merkle root** — se a conta de config permite trocar a root depois do lançamento, existe um caminho para reescrever o que é "canônico". Relacionado ao R2. | Desenho do programa (S02) + **HD** (S06) |
| R4 | **Indexer parado passa despercebido** — o site continua servindo dado velho sem erro visível. Precisa de alerta por atraso (heartbeat/lag), não só health check. | **IX** (S03), endurecido em **HD** (S06) |
| R5 | **Custo de RPC/webhook em mainnet** — projeto sem receita; provider pago é custo recorrente do mantenedor. | **HD** (S06) |
| ~~R6~~ | ~~**Monopolização do registro**~~ — **encerrado em 2026-07-19**: sem limite por carteira, por decisão de produto. O financiamento distribuído é meio, não fim. Ver ADR `2026-07-19_registro-sem-limite-por-carteira.md`. | Resolvido |
