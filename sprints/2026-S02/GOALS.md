# Sprint S02 — Programa Anchor em devnet

**Prefixo:** `PG`
**Branch:** `s02` (a partir de `s01`)
**Depende de:** S01 — a Merkle root e a geração de proofs precisam existir

---

## Objetivo

Colocar `register_verse` rodando em **devnet**: registro permissionless, com
validação Merkle do texto, uma conta por versículo e duplicidade impossível
por construção.

## Por que esta sprint é a mais crítica

O programa é a única parte **irreversível** do sistema. Depois do deploy em
mainnet (S07), erro de desenho não se corrige — não há instrução de `update`
nem de `close`, e as contas criadas são permanentes. Tudo aqui é escrito
para durar: sem atalho, sem "arruma depois".

## Escopo

- Conta de configuração com a(s) Merkle root(s)
- `VerseAccount` e a PDA `["verse", book, chapter, verse]`
- `register_verse` com verificação de proof on-chain
- Suíte de testes cobrindo principalmente os **caminhos de falha**
- Deploy em devnet + IDL versionado no repositório

## Fora de escopo

Banco e indexer (S03), interface (S04), deploy em mainnet e decisão sobre a
upgrade authority (S06/S07 — riscos R2 e R3 do ROADMAP).

---

## Bloqueador de partida

**PG-00 decide a forma da árvore e trava o resto da sprint.** O pior caso
medido (Ester 8:9, 493 bytes + proof de 15 níveis) deixa ~8 bytes de folga
no limite de 1.232 bytes da transação — margem que uma instrução
`ComputeBudget` consome. Nada de `register_verse` é escrito antes desse
número fechar.

---

## Critério de pronto

Além da definição global (ver [`../ROADMAP.md`](../ROADMAP.md)):

1. Programa deployado em devnet, Program ID e hash do bytecode registrados
   em `docs/sessions/latest.md`
2. Suíte verde cobrindo: registro feliz; **duplicidade rejeitada**; proof
   inválida rejeitada; texto adulterado rejeitado; posição não-registrável
   impossível; referência fora de faixa rejeitada
3. Registro do **versículo mais longo (Ester 8:9)** confirmado em devnet
   junto com uma instrução `ComputeBudget` — prova prática do orçamento
4. Rent e compute units medidos em devnet e documentados (números reais
   substituem as estimativas das ADRs)
5. IDL commitado; `packages/blockchain` consumindo o programa com tipos
6. ADR do desenho final da árvore (resultado do PG-00) aceita
