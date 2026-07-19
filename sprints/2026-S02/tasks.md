# Sprint S02 — Tasks

> Prefixo: **PG** = programa Anchor
> Objetivo e critério de pronto em [`GOALS.md`](GOALS.md).
> **PG-00 bloqueia todo o resto.**

## Spike bloqueador

- [ ] **PG-00** Orçamento de transação e forma da árvore — **BLOQUEIA A SPRINT**.
      Medir de verdade (montando transações reais, não só somando bytes) as
      duas opções:
      - **(a) árvore global** — 31.098 folhas, 15 níveis, proof de 480 bytes;
        pior caso ~1.224/1.232 bytes, sem espaço para `ComputeBudget`;
      - **(b) root por capítulo** — 1.189 roots numa conta de config
        (1.189 × 32 = 38KB; a conta entra na transação como endereço, não
        como dado), maior capítulo = Salmo 119 com 176 versos → 8 níveis →
        proof de 256 bytes; pior caso ~762 bytes de instrução.

      Avaliar também o custo em **compute units** da verificação e o rent da
      conta de config. Decidir, medir com Ester 8:9 + `ComputeBudget`, e
      registrar **ADR**. Recomendação de partida: **(b)**, pela margem.

## Programa

- [ ] **PG-01** `anchor init programs/eternal-word` integrado ao workspace
      (Anchor + toolchain Solana fixados em `STACK.md` → **ADR** das versões).
- [ ] **PG-02** Conta de configuração — guarda a(s) root(s), o identificador
      da tradução (`engwebp`) e metadados de proveniência. Definir **quem
      pode escrever nela e quando** (risco R3): a intenção é root gravada uma
      vez e nunca mais alterável.
- [ ] **PG-03** `VerseAccount` — layout com espaço calculado por constantes
      nomeadas, sem número mágico. Campo **`adopter`**, nunca `owner`
      (glossário). Sem instrução de `update` nem de `close`.
- [ ] **PG-04** PDA `["verse", book, chapter, verse]` com índices numéricos
      (1–66), nunca strings — a existência da conta é o que impede
      duplicidade.
- [ ] **PG-05** `register_verse` — verificação da Merkle proof contra a root
      da config, criação da conta, gravação de `adopter` e `created_at`.
      Erros customizados com mensagem em inglês; `require!` em vez de
      `unwrap`/`panic`.
- [ ] **PG-06** Testes do programa — framework a definir (litesvm/bankrun vs
      `anchor test` → **ADR**). Cobrir principalmente falhas:
      - registro feliz grava os campos corretos
      - **segundo registro da mesma posição falha** (duplicidade)
      - proof inválida falha
      - texto que não bate com a proof falha (vandalismo)
      - posição não-registrável (ex.: At 8:37) não tem folha → falha
      - book/chapter/verse fora de faixa falha
      - conta de config errada/forjada falha
- [ ] **PG-07** Deploy em devnet — Program ID e hash do bytecode registrados;
      inicialização da config com a root da S01.
- [ ] **PG-08** Registro de fumaça em devnet — Gênesis 1:1, Ester 8:9 (o mais
      longo, com `ComputeBudget` anexado) e uma tentativa de duplicidade
      recusada. Medir rent e compute units reais.
- [ ] **PG-09** `packages/blockchain` — derivação de PDA, construção da
      transação de registro e proof client-side (consumindo o Catálogo da
      S01), com o IDL tipado. É o que a S04 vai usar.

## Documentação

- [ ] **PG-10** Atualizar `STACK.md` (versões de Anchor/Solana), `OVERVIEW.md`
      (fluxo real) e as ADRs de custo com os **números medidos** em devnet,
      substituindo as estimativas.
