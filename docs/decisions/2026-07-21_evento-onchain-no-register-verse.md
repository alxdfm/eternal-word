## Decisão: Emitir o evento `VerseRegistered` on-chain no `register_verse` (`emit!`)

**Data:** 2026-07-21
**Status:** aceita (Alexandre, 2026-07-21)
**Autor:** Claude (validação pedida pelo Alexandre no arranque da S03)

---

## Contexto

A camada 1 do indexer (`2026-07-18_sincronizacao-indexer-tres-camadas.md`)
precisa saber, em segundos, quando um verse foi registrado. Hoje o programa
**não emite nenhum evento** (`register_verse.rs` só grava o estado da conta), e
o `VerseRegistered` do glossário é um evento *do indexer*, não Anchor on-chain.
Sem evento, a camada 1 teria que derivar o registro da transação — parsear os
logs/contas para achar a `VerseAccount` criada e lê-la — trabalho frágil e
verboso. O programa ainda é **upgradeable** (a upgrade authority é a carteira;
sua revogação, risco R2, só se decide na S06), então esta é a janela — possivelmente
a última — para acrescentar o evento no bytecode.

---

## Opções consideradas

| Opção | Prós | Contras |
|-------|------|---------|
| Sem evento — derivar da transação | Nenhum upgrade do programa | Indexer frágil e verboso; precisa identificar a conta criada e reler; acopla o indexer ao formato da tx |
| `emit_cpi!` (event CPI) | Robusto a truncamento de log (dado vai na instrução interna) | Conta extra de event-authority em **toda** transação de registro + mais CU; robustez desnecessária dado que a camada 3 já reconcilia |
| `emit!` (log-based) — a escolhida | Evento tipado, decodificável via IDL; a camada 1 grava sem reler a conta; **não** afeta o tamanho da transação; CU desprezível | Log pode ser truncado sob carga — mitigado pela camada 3; exige um upgrade do programa |

---

## Decisão tomada

> **`emit!(VerseRegistered { book, chapter, verse, adopter, created_at })` ao
> fim de `handle_register_verse`, feito agora enquanto a authority existe.**

`emit!` produz uma linha de log (`Program data:` base64) — **saída de execução,
não parte da transação assinada** —, então **não consome a folga de 201 B** que
o Ester 8:9 mediu na S02; só custa alguns compute units (folga enorme: 15–22k
contra 200k). A instrução não muda em contas, argumentos nem validação Merkle —
só acrescenta o evento. `emit_cpi!` foi descartado: o evento é minúsculo e a
camada 3 já é a rede de segurança para qualquer evento perdido ou truncado.

O upgrade **preserva o estado** (config selada, os 66 `book_roots`, as contas já
registradas) — troca só o bytecode. Não há re-bootstrap nem re-seal; apenas
registros novos passam a emitir.

---

## Consequências

**Positivas:**
- Camada 1 decodifica um evento tipado via IDL, sem reler a conta criada
- `logsSubscribe` (dev) e Helius webhook (prod) decodificam o **mesmo**
  `Program data:` — a port `EventSource` fica uniforme
  (`2026-07-21_fonte-de-eventos-do-indexer.md`)
- Entra antes de a authority ser revogada (R2/S06); depois seria impossível

**Negativas / Trade-offs:**
- Um upgrade do programa em devnet — muda o `sha256` do bytecode (re-registrar
  em `docs/sessions/latest.md`)
- `emit!` está sujeito a truncamento de log sob carga — aceito porque a camada 3
  reconcilia qualquer perda

**Impacto no código:**
- `programs/eternal-word/src/instructions/register_verse.rs` — `#[event]` +
  `emit!`
- Teste no litesvm capturando o log do evento
- `pnpm sync-idl` (o IDL ganha a definição do evento) + upgrade-deploy em devnet

---

## Revisão futura

No deploy definitivo em mainnet (S07) o `emit!` já vai no bytecode inicial.
Reavaliar `emit_cpi!` apenas se o truncamento de log virar problema real medido
— até lá, a camada 3 cobre.
