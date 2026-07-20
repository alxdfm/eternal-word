# Decisão: Conta de configuração, carga das roots e selo

**Data:** 2026-07-19
**Status:** aceita
**Autor:** Claude, com as escolhas de layout e autoridade feitas por Alexandre

---

## Contexto

O PG-02 precisa guardar on-chain as 1.189 chapter roots que a ADR
`2026-07-19_forma-da-merkle-tree-e-orcamento-de-transacao.md` escolheu, e
resolver o **risco R3**: se a conta de config permitir trocar a root depois do
lançamento, existe um caminho para reescrever o que é "canônico".

Dois números limitam o desenho:

- **38.048 bytes** para as 1.189 roots numa conta só — acima dos 10.240 bytes
  que o runtime permite uma conta crescer por instrução, exigindo `realloc`.
- **1.232 bytes** de transação — nem os 4.800 bytes do maior livro cabem num
  envio. **Nenhum desenho consegue criar-e-preencher atomicamente**; a carga é
  incremental por construção.

---

## Decisões

### Layout: uma conta por livro

66 PDAs `["roots", book]`, cada uma com as roots dos capítulos daquele livro.
A maior (Salmos, 150 capítulos) ocupa 4.800 bytes e cabe numa criação única —
nenhuma conta precisa de `realloc`. `register_verse` recebe só a conta do livro
em questão, então carrega no máximo 4.800 bytes em vez de 38 KB.

O tamanho de cada conta vem de `CHAPTERS_PER_BOOK`, constante no bytecode.
Isso é deliberado: qualquer pessoa lendo o programa confere o tamanho esperado,
em vez de confiar em quem inicializou.

### Autoridade: carga validada pelo commitment, depois selo

O `roots_commitment` é gravado **na criação** da config e não existe instrução
que o reescreva. Cada `load_chapter_root` só é aceita se a root provar contra
esse commitment.

A consequência é o que interessa: **a authority escolhe quando carregar, nunca
o quê.** Não existe janela — nem antes do selo — em que uma root falsa possa
entrar. Por isso a carga é permissionless: qualquer um pode avançá-la, ninguém
pode corrompê-la.

`seal()` fecha o processo e é irreversível: nenhuma instrução limpa a flag.
Não há `update` nem `close` em lugar nenhum do programa — a imutabilidade vem
de não existir caminho de escrita, não de uma flag que alguém precisa respeitar.

---

## A falha encontrada durante a implementação

A primeira versão usava como folha do commitment a **root crua de 32 bytes**.
Estava errada.

A árvore usa **pares ordenados sem bits de direção** — escolha registrada em
`merkle.ts`, feita para caber no orçamento de transação. O comentário de lá diz
que a posição "é presa pelas seeds da PDA e pelo endereço dentro da folha", e
isso vale para folhas de versículo, que codificam `(book, chapter, verse)`.
**Não valia para as folhas do commitment**, que não carregavam endereço nenhum.

Com isso, um proof válido para a root do capítulo X verificava igualmente se
alguém alegasse que ela pertence ao capítulo Y. O atacante não conseguiria
forjar texto — o leaf do versículo carrega o próprio endereço e não bateria
contra a árvore errada — mas conseguiria gravar roots em posições trocadas,
deixando aqueles capítulos **permanentemente irregistráveis** num programa sem
caminho de correção. Vandalismo irreversível, sem ganho para o atacante.

**Correção:** a folha do commitment passou a ser
`hashLeaf(book:u8 | chapter:u16le | root:32)`, espelhando o que as folhas de
versículo já faziam. `encodeChapterRootLeaf` em `packages/catalog` e
`commitment_leaf` no programa são a mesma coisa nos dois lados.

Isso alterou **uma linha** de `data/merkle-root.json` — o `rootsCommitment`. A
root global (`112e5318…`) e as roots por capítulo não mudaram, porque são
árvores diferentes. O `pnpm catalog:merkle --check` acusou a divergência antes
da regeneração, exatamente como deveria.

O teste `rejects_a_valid_root_claimed_for_another_chapter` existe para essa
regressão.

---

## Consequências

**Positivas:**
- R3 fechado por construção, não por processo: não há como instalar root falsa
- Carga permissionless — o projeto não depende do mantenedor estar disponível
- Tamanhos de conta auditáveis a partir do bytecode

**Negativas / Trade-offs:**
- Inicialização leva 1.189 transações de `load_chapter_root` mais 66 de
  `complete_book` — barato (~0,006 SOL em taxas), mas precisa de um runbook
- `complete_book` existe só porque `seal` não pode receber 66 contas numa
  transação; é contabilidade, não regra de negócio
- `solana-sha256-hasher` entrou como dependência direta do programa: o
  `anchor_lang::solana_program` do Anchor 1.0 não reexporta mais `hash`

**Impacto no código:**
- `programs/eternal-word/src/{constants,state,error,merkle}.rs` e as quatro
  instruções
- `packages/catalog/src/canonical-merkle.ts` — `encodeChapterRootLeaf`,
  `chapterRootProof`
- `data/merkle-root.json`, `data/test-fixtures.json`

---

## Revisão futura

O custo real de compute de `load_chapter_root` e o rent das 67 contas serão
medidos em devnet no PG-08, substituindo as estimativas. A decisão sobre a
**upgrade authority do programa** (risco R2) continua aberta para a S06 — nada
aqui a antecipa: config selada e programa atualizável ainda seriam
contraditórios, e é isso que o HD precisa resolver antes do go-live.
