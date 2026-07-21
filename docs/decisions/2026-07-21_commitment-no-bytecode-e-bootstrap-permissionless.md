# Decisão: Commitment no bytecode e bootstrap permissionless

**Data:** 2026-07-21
**Status:** aceita
**Autor:** Claude (auditoria do programa pré-deploy, pedida pelo Alexandre)

---

## Contexto

Auditoria completa do programa antes do deploy em devnet (o programa é imutável,
então o deploy é o ponto sem volta do desenho). Encontrou uma falha de segurança
real no `initialize_config`.

---

## A falha: front-running de `initialize_config`

A config era um PDA singleton de seeds fixas, mas `initialize_config`:

1. recebia o `roots_commitment` como **parâmetro**, e
2. não restringia **quem** podia chamar — o primeiro a chamar virava `authority`.

Entre o deploy e a inicialização legítima, qualquer um podia chamar
`initialize_config(commitment_falso)` e:

- instalar um commitment sobre um canon que **ele** controla → `register_verse`
  passaria a aceitar **qualquer texto** como canônico, permanentemente;
- ou, mesmo sem forjar texto, virar `authority` e **travar** o bootstrap
  (recusar-se a criar `book_roots` / a selar) → registro nunca abre, num
  programa que não se pode corrigir.

As seeds fixas fechavam o R3 contra uma config *forjada como conta*; não fechavam
contra um commitment forjado *via front-run*, nem contra o DoS da authority.

---

## Opções consideradas

| Opção | Fecha forja? | Fecha DoS? | Custo |
|-------|:---:|:---:|-------|
| Deixar como está, inicializar rápido no deploy | ❌ | ❌ | Janela de corrida em mainnet; inaceitável para programa imutável |
| Cravar só o commitment, manter authority dinâmica | ✅ | ❌ | Sobra o DoS por front-run da authority |
| Cravar commitment **e** authority (pubkey fixa) | ✅ | ✅ | Acopla o bytecode a uma chave; build de devnet ≠ mainnet |
| **Cravar o commitment + remover a authority — a escolhida** | ✅ | ✅ | Nenhum; mais simples e sem parte confiável |

---

## Decisão tomada

> **O `roots_commitment` vira a constante `ROOTS_COMMITMENT` no bytecode, e a
> `authority` deixa de existir. Todo o bootstrap é permissionless.**

Com o commitment fixo no binário, **não há nada que uma authority possa
corromper**, então ela não precisa existir. As instruções ficam:

- `initialize_config()` — sem parâmetro, sem dono. Cria a config singleton.
- `initialize_book_roots(book)` — qualquer um paga o rent e cria.
- `load_chapter_root(...)` — permissionless, validado contra `ROOTS_COMMITMENT`.
- `complete_book(book)` — permissionless.
- `seal()` — permissionless; só tem efeito quando os 66 livros já estão
  completos contra o commitment fixo, então quem quer que dispare apenas
  finaliza o **único** canon correto.

Não existe cenário em que uma ação de bootstrap seja danosa: cada uma só
avança o canon correto. Um "griefer" que rode o bootstrap está **doando** o
rent das contas certas.

Isto alinha com a premissa do produto — registro permanente, colaborativo, sem
parte confiável: o próprio bytecode atesta o canon.

### Verificação

`ROOTS_COMMITMENT` cravado à mão é verificado por um teste
(`merkle_fixtures.rs::hardcoded_commitment_matches_the_catalog`) contra o
commitment que o Catálogo gera — um erro de digitação na constante brickava o
programa em silêncio (todo load falharia). O teste fecha esse buraco.

---

## Consequências

**Positivas:**
- Impossível forjar o canon (commitment no binário, auditável e imutável)
- Impossível travar o bootstrap (nada é privilegiado)
- Config menor (sai `authority` 32 B + `roots_commitment` 32 B); a decisão
  sobre a **upgrade authority** do programa (R2) segue para o S06, é separada

**Negativas / Trade-offs:**
- O bytecode passa a depender do CanonicalText exato — mas ele é **congelado**
  por premissa, então isso é desejável (o binário atesta o canon)
- Trocar de tradução exigiria rebuild do programa; não é um caminho previsto

**Impacto no código:**
- `constants.rs` (`ROOTS_COMMITMENT`), `state.rs` (`Config` enxuta),
  `initialize_config.rs`, `initialize_book_roots.rs`, `load_chapter_root.rs`,
  `seal.rs`, `lib.rs`
- TS: `accounts.ts` (offsets), `admin.ts` (`initialize_config` sem arg),
  `bootstrap-devnet.ts` (permissionless)
- Substitui parte da ADR `2026-07-19_conta-de-configuracao-e-carga-das-roots.md`:
  a `authority` descrita lá não existe mais; a carga permissionless com
  commitment fixo é o modelo final.

---

## Revisão futura

A auditoria confirmou o resto do programa sólido: constantes irreversíveis
conferidas ao vivo contra o Catálogo (tabela de capítulos, tamanhos, limites de
proof), Merkle com separação de domínio e posição na folha, sem
`missing account validation`, sem overflow. A **upgrade authority** do BPF
(quem pode substituir o bytecode) é decisão de deploy, tratada no R2/S06 —
independente desta mudança.
