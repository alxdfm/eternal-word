# Sprint S02 — Tasks

> Prefixo: **PG** = programa Anchor
> Objetivo e critério de pronto em [`GOALS.md`](GOALS.md).
> **PG-00 bloqueia todo o resto.**

## Spike bloqueador

- [x] **PG-00** Orçamento de transação e forma da árvore — **BLOQUEIA A SPRINT**.
      ✅ **Resolvido em 2026-07-19** — ADR
      `docs/decisions/2026-07-19_forma-da-merkle-tree-e-orcamento-de-transacao.md`.
      Medido com transações reais em `scripts/spike-pg00-transaction-budget.ts`
      (`pnpm spike:pg00`): **(a) não cabe** — 1.264 B contra o limite de 1.232
      já **sem** `ComputeBudget`; a estimativa da S01 errou ~38 B para menos
      (esqueceu os prefixos de tamanho do Borsh e subestimou o envelope em 30 B).
      **(b) escolhida**: 998 B em v0 com `ComputeBudget`, **234 B de folga**.
      Falta ainda medir compute units e rent da config — vai no PG-08, em devnet.
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

- [x] **PG-01** `anchor init programs/eternal-word` integrado ao workspace
      (Anchor + toolchain Solana fixados em `STACK.md` → **ADR** das versões).
      ✅ **2026-07-19** — ADR `docs/decisions/2026-07-19_toolchain-do-programa-anchor.md`.
      Agave 3.1.13 + Anchor CLI 1.0.0 no container; `anchor-lang` 1.1.2 fixado
      pelo `Cargo.lock` versionado. `anchor build` verde, IDL gerado.
      Program ID devnet: `9up3jAXPTgkJz9UvMLwEiUUSVdPd6E1KshwfxT3dZCdG`.
      Descartado o `rust-toolchain.toml` do scaffold (pinava Rust 1.89 contra
      1.97 da imagem — dois pins discordantes). `Anchor.toml` sem localnet.
      IDL versionado em `packages/blockchain/src/idl/` via `pnpm sync-idl`
      (`target/` é gitignorado, então o IDL não chegava ao git sozinho).
      Resíduo do scaffold resolvido no PG-02: a instrução placeholder
      `initialize` e o `CustomError` saíram; as dev-dependencies `litesvm`/
      `solana-*` deixaram de ser resíduo e passaram a ser intencionais quando
      o PG-06 escolheu testar em Rust.
- [x] **PG-02** Conta de configuração — guarda a(s) root(s), o identificador
      da tradução (`engwebp`) e metadados de proveniência. Definir **quem
      pode escrever nela e quando** (risco R3): a intenção é root gravada uma
      vez e nunca mais alterável.
      **Obrigatório: a config precisa ser uma PDA de seeds fixas**, validada
      pela constraint `seeds` do Anchor. Se a instrução aceitar qualquer
      conta passada como config, um atacante fornece a própria conta, com uma
      root que ele escolheu, e **toda a validação Merkle deixa de valer** —
      passa a conseguir gravar qualquer texto. É a falha clássica de
      "missing account validation" e o único caminho conhecido para
      contornar a proteção do texto. Teste correspondente: PG-06.
      ✅ **2026-07-19** — ADR `docs/decisions/2026-07-19_conta-de-configuracao-e-carga-das-roots.md`.
      Config em PDA de seeds fixas; 66 contas `["roots", book]` (a maior, Salmos,
      4.800 B — sem realloc). Commitment gravado na criação e nunca reescrito:
      cada root só entra se provar contra ele, então a authority escolhe *quando*
      carregar, nunca *o quê*. `seal()` irreversível. Sem `update` nem `close`.
      **Falha corrigida no caminho:** a folha do commitment era a root crua, e
      com pares ordenados isso não prendia a posição — dava para gravar uma root
      real no capítulo errado e torná-lo irregistrável para sempre. Agora a folha
      codifica `book|chapter|root`. Regressão coberta por teste.
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
      **Limitar o tamanho da proof** ao máximo do desenho escolhido (8
      irmãos na forma por capítulo). Não é vulnerabilidade — quem envia
      proof gigante queima os próprios compute units — mas é validação
      barata que evita trabalho inútil e deixa o contrato explícito.
      Espelhar exatamente o algoritmo de `packages/catalog/src/merkle.ts`:
      sha256, prefixo `0x00` folha / `0x01` nó, pares ordenados por bytes,
      nó ímpar promovido; folha =
      `book:u8 | chapter:u16le | verse:u16le | textLen:u32le | text:utf8`.
- [~] **PG-06** Testes do programa — framework a definir (litesvm/bankrun vs
      `anchor test` → **ADR**). Cobrir principalmente falhas:
      🔶 **Framework decidido em 2026-07-19** — ADR
      `docs/decisions/2026-07-19_testes-do-programa-em-rust-com-fixtures.md`:
      Rust + `litesvm`, com as proofs vindas de `data/test-fixtures.json`
      geradas pelo Catálogo (`pnpm catalog:fixtures`). `anchor-bankrun` foi
      descartado — parado desde out/2024; `litesvm` TS migrou para `@solana/kit`,
      que conflita com o web3.js v1 do STACK.
      5 testes verdes cobrindo a Merkle e a tabela do canon. **Falta** a suíte
      de `register_verse` (depende do PG-05) e os casos abaixo:
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
