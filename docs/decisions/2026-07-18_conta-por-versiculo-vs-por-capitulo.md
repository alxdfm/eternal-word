# Decisão: Uma conta on-chain por versículo (não por capítulo)

**Data:** 2026-07-18
**Status:** aceita (Alexandre, 2026-07-18)
**Autor:** Claude (recomendação técnica)

---

## Contexto

A spec inicial modela uma VerseAccount por versículo (~31.102 contas). Uma
consideração posterior sugeriu uma conta por capítulo (1.189 contas) com
bitmap de versículos adotados e realloc incremental, para reduzir o custo
total de rent. É preciso escolher a granularidade antes de escrever o
programa Anchor, pois a decisão define as seeds da PDA e é irreversível
após o primeiro registro em mainnet.

---

## Opções consideradas

| Opção | Prós | Contras |
|-------|------|---------|
| Conta por capítulo (bitmap + realloc) | Rent total ~40 SOL (~45% menor); menos contas | Realloc limitado a 10KB/instrução (Salmo 119 estoura); contenção de write-lock entre usuários do mesmo capítulo; serialização manual com offsets; perde a semântica "1 versículo = 1 conta = 1 adopter" |
| Conta por versículo — a escolhida | Fit natural do modelo colaborativo; PDA simples; sem contenção; base direta para NFTs/badges; programa muito mais simples | Rent total ~70 SOL (estimativa: ~325 bytes/conta × 6.960 lamports/byte ≈ 0,0023 SOL por versículo) |

---

## Decisão tomada

> **Uma conta por versículo, PDA `["verse", book_index, chapter, verse]`**

Ninguém paga o custo total — esse é o ponto do modelo colaborativo. A
economia da opção por capítulo é ~0,001 SOL *por usuário* (centavos), e o
preço é complexidade significativa num programa que precisa ser imutável e
correto de primeira. O custo individual de ~0,0023 SOL por versículo já é
acessível.

---

## Consequências

**Positivas:**
- Programa Anchor simples: uma instrução `register_verse`, `init` na PDA
- Duplicidade impossível por construção (conta já existe → transação falha)
- Cada versículo tem um `adopter` claro — base para perfil, NFTs, badges

**Negativas / Trade-offs:**
- Rent total do projeto ~70 SOL em vez de ~40 SOL (absorvido coletivamente)
- ~31k contas para o indexer acompanhar (mitigado por webhooks)

**Impacto no código:**
- `programs/eternal-word/` (seeds, struct VerseAccount)
- `packages/blockchain/` (derivação de PDA)

---

## Revisão futura

Revisitar apenas antes do deploy em mainnet, se o preço do SOL tornar
0,002-0,003 SOL por registro uma barreira real de adoção.
