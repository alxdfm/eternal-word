# Decisão: Forma da Merkle tree e orçamento de transação

**Data:** 2026-07-19
**Status:** aceita
**Autor:** Claude (spike PG-00 da S02 — bloqueador da sprint, risco R1 do ROADMAP)

---

## Contexto

A validação Merkle exige que a proof viaje dentro da transação de registro,
que na Solana tem limite rígido de **1.232 bytes**. Duas formas de árvore
estavam em aberto desde a S01:

- **(a) árvore global** — uma root sobre os 31.098 versículos, 15 níveis,
  proof de 480 bytes;
- **(b) root por capítulo** — 1.189 roots numa conta de config; o capítulo
  mais profundo (Salmo 119, 176 versículos) tem 8 níveis, proof de 256 bytes.

A estimativa da S01 (`packages/catalog/src/cli/merkle.ts`) dava à opção (a)
uma folga de ~6 bytes: instrução de 986 B + envelope de 240 B ≈ 1.226 de
1.232. Isso originou o risco **R1** — "orçamento sem margem: uma instrução
`ComputeBudget` estoura". O PG-00 existe porque essa conta era uma **soma de
bytes**, não uma transação real.

---

## Método

`scripts/spike-pg00-transaction-budget.ts` monta e **serializa transações de
verdade** com `@solana/web3.js`, nas quatro combinações que importam: legacy
e v0, com e sem `ComputeBudget` (`setComputeUnitLimit` + `setComputeUnitPrice`).
As PDAs de config e de `VerseAccount` são derivadas de fato, e os dados da
instrução seguem o layout Borsh do Anchor.

O script também varre os 31.098 versículos para achar o **verdadeiro pior
caso** da opção (b) — o máximo de `texto + profundidade do próprio capítulo`.
Dimensionar (b) por "versículo mais longo + árvore mais profunda" mede um
versículo que não existe: Ester 8:9 (493 B) está num capítulo de 5 níveis, e
o Salmo 119 tem 8 níveis mas versículos curtos.

---

## Resultado medido

Pior caso real: **Ester 8:9** (17:8:9, 493 bytes de texto) — a varredura
confirma que o texto domina a profundidade da proof.

| Forma | Instrução | legacy | legacy + CB | v0 | v0 + CB |
|-------|-----------|--------|-------------|-----|---------|
| (a) global, 15 níveis | 994 B | 1.264 B ❌ | 1.316 B ❌ | 1.266 B ❌ | rejeitada ❌ |
| (b) por capítulo, 5 níveis | 674 B | 944 B ✅ | 996 B ✅ | 946 B ✅ | **998 B ✅** |

**A estimativa da S01 estava errada em ~38 bytes, para menos, e na direção
que importa.** Duas causas:

1. **Prefixos de tamanho do Borsh esquecidos** — `String` e `Vec<[u8; 32]>`
   carregam 4 bytes de comprimento cada. A instrução real tem 994 B, não 986.
2. **Envelope subestimado** — o `TRANSACTION_OVERHEAD = 240` era um chute; o
   real é **270 B** (assinatura, header, 6 chaves de conta e blockhash).

A consequência é qualitativa, não só numérica: **a opção (a) nunca coube.**
Não é "sem margem para o `ComputeBudget`" — ela estoura em 32 bytes mesmo
**sem** `ComputeBudget` nenhum. O `web3.js` se recusa a serializar a v0 com
`ComputeBudget`: `MessageV0.serialize` codifica num buffer de exatamente
`PACKET_DATA_SIZE` (1.232) e lança `RangeError`. A recusa da biblioteca é,
por si, a prova. (A mensagem legacy usa um buffer de 2.048 bytes e por isso
devolve números acima do limite em vez de falhar — os dois caminhos são
medidos justamente por causa dessa assimetria.)

---

## Opções consideradas

| Opção | Prós | Contras |
|-------|------|---------|
| (a) árvore global | Uma root só; config trivial | **Não cabe na transação** — 1.264 B contra o limite de 1.232, antes de qualquer `ComputeBudget`. Inviável, não apenas apertada |
| (a) + Address Lookup Tables | Recuperaria ~100 B comprimindo chaves de conta | Só 6 contas — ganho pequeno; ALT é mais uma conta para criar, manter e validar, num programa que precisa ser auditável e imutável |
| (a) + proof em conta separada | Sem limite de tamanho | Duas transações por registro, estado intermediário e um caminho de falha novo, num fluxo que precisa ser atômico |
| **(b) root por capítulo — a escolhida** | **234 B de folga** com `ComputeBudget` em v0; proof de no máximo 8 irmãos; config de 38 KB não custa nada na transação (conta viaja como endereço) | 1.189 roots para gravar na config; um nível a mais de indireção na construção da proof |

---

## Decisão tomada

> **(b) root por capítulo**

É a única forma que cabe. As alternativas para salvar a (a) — ALT ou proof
em conta separada — trocam um limite estourado por complexidade permanente
num programa que não terá instrução de `update` nem de `close`. Com 234 bytes
de folga, a (b) absorve `ComputeBudget`, priority fee e ainda deixa margem
para o que a S04 descobrir.

Decorrências para a implementação:

- **PG-05 limita a proof a 8 irmãos** — profundidade do Salmo 119, o maior
  capítulo. Não é proteção contra ataque (quem manda proof gigante queima os
  próprios compute units), é validação barata que deixa o contrato explícito.
- **A config guarda as 1.189 roots** mais o commitment sobre elas
  (`perChapter.rootsCommitment` em `data/merkle-root.json`), para que um único
  valor de 32 bytes continue fixando todo o CanonicalText.
- **Transações v0** como padrão no `packages/blockchain` (PG-09): custam 2
  bytes a mais que legacy e mantêm ALT disponível se algum dia fizer falta.

---

## Consequências

**Positivas:**
- Risco **R1 encerrado** com número medido, não estimado
- 234 B de folga no pior caso real, com `ComputeBudget` anexado
- Limite de proof (8) vira constante nomeada no programa, testável em PG-06

**Negativas / Trade-offs:**
- Inicialização da config precisa gravar 1.189 roots — não cabe numa
  transação só; vai precisar de escrita em lotes (PG-02/PG-07)
- Cliente precisa saber a que capítulo o versículo pertence antes de montar a
  proof — já resolvido em `packages/catalog`

**Impacto no código:**
- `scripts/spike-pg00-transaction-budget.ts` (novo — o spike)
- `packages/catalog/src/cli/merkle.ts` — a estimativa embutida ali foi
  **removida**, não corrigida: dimensionamento de transação agora existe num
  lugar só, o spike, que serializa em vez de somar. Manter uma segunda conta
  feita à mão é justamente o que deixou o número divergir sem ninguém notar
- `packages/catalog/__tests__/integration.test.ts` — o teste que trava a
  profundidade máxima em 8 continua valendo; só o comentário foi corrigido
- `programs/eternal-word/` — constante de profundidade máxima da proof
- `packages/blockchain/` — construção da transação em v0

---

## Atualização (2026-07-19, após o PG-02/PG-05)

Os números acima foram medidos quando `register_verse` tinha **4 contas**. O
desenho final tem **5**: as chapter roots vivem numa conta por livro, que
viaja junto. Uma chave a mais são 32 bytes a mais na transação.

| Forma | v0 + ComputeBudget | Folga |
|-------|--------------------|-------|
| (a) global | **rejeitada pelo web3.js** | — |
| (b) por capítulo | **1.031 B** | **201 B** |

A decisão não muda; a folga passou de 234 para 201 bytes, ainda confortável. A
opção (a) piorou: agora nem a versão **sem** `ComputeBudget` serializa.

O spike (`pnpm spike:pg00`) monta a lista de contas idêntica à do programa, e é
o lugar a atualizar se ela mudar de novo.

---

## Confirmado em devnet (PG-08, 2026-07-21)

O smoke test registrou os dois versículos de verdade na chain. A previsão bateu:

| | previsto (spike) | medido (devnet) |
|---|---|---|
| Ester 8:9 — tx v0 + ComputeBudget | 1.031 B | **1.031 B** |
| folga sobre 1.232 | 201 B | 201 B |
| compute units (verificação da proof) | não medido | 15.616 (Gn 1:1: 22.459) |
| rent VerseAccount (pior caso, 493 B) | ~0,0047 SOL (estimativa) | 0,004726 SOL |

O tamanho de transação — a coisa que decidiu a forma da árvore — saiu idêntico
ao número off-chain. Os compute units reais (~15-22k) ficam muito abaixo do
default de 200k, então a folga de 201 B para o `ComputeBudget` é mais que
suficiente; o limite de 400k do cliente é conservador de propósito.

---

## Revisão futura

Os números aqui são **tamanho de transação**, medidos off-chain. O PG-08 mede
em devnet o que este spike não alcança: **compute units** da verificação da
proof e o **rent real** da conta de config. Se a verificação de 8 hashes
sha256 estourar o orçamento padrão de compute units, o `ComputeBudget` já tem
espaço reservado — é justamente para isso que a folga existe.

Revisitar se o CanonicalText mudar de tradução (o que não deve acontecer: o
snapshot está congelado) ou se a Solana alterar o limite de 1.232 bytes.
