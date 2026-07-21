# Módulo: Programa Anchor `eternal-word`

> Referência definitiva do programa on-chain — a **única parte irreversível** do
> sistema. Localização: `programs/eternal-word/`. Cliente TypeScript:
> `packages/blockchain/`. Decisões em `docs/decisions/` (prefixo das datas).
>
> Entregue na **S02**. Este documento descreve o que o programa **é**; as ADRs
> descrevem **por quê** cada escolha foi feita.

---

## 1. O que o programa garante

Um registro permanente e colaborativo da Bíblia na Solana. Cada versículo vira
**uma conta on-chain** (`VerseAccount`) cuja existência **é** o registro. As
garantias, todas por construção (não por processo):

1. **Só texto canônico registra.** O texto de cada versículo é provado contra
   uma Merkle tree cujo commitment está **cravado no bytecode**. Forjar texto
   não-canônico exigiria uma segunda-preimagem de sha256.
2. **Um versículo, uma conta, para sempre.** A PDA `["verse", book, chapter,
   verse]` só pode ser criada uma vez (`init` do Anchor). Não há duplicidade,
   sobrescrita, `update` nem `close`.
3. **Sem parte confiável.** Todo o bootstrap é permissionless; não existe
   `authority`. Nem quem inicializa o programa pode corromper o canon.
4. **Imutável.** A permanência vem da **ausência de caminho de escrita**, não de
   uma flag. Não há instrução que altere ou apague um `VerseAccount`.

---

## 2. Estado deployado (devnet)

```
Program Id:         9up3jAXPTgkJz9UvMLwEiUUSVdPd6E1KshwfxT3dZCdG
ProgramData:        FkRZPX48U4pyYKz8zcos4fYHHQPG1rh5rGneTZpKzxrA
Cluster:            devnet
Upgrade authority:  83n4Vyyz3UyzchsSRRQVzhyu2ycDgTtCQZ53AAH7q8Ud (carteira; ver §11)
Deploy slot:        477844909
Bytecode sha256:    68b88a1ba359adbe22d06d165dbacdc50b43997d033f6be1ed473b49b61e7ac5
Canon:              66/66 livros carregados e SELADO — registro aberto
```

Toolchain (reproduzível via `Dockerfile.build`): Agave 3.1.13, Anchor CLI 1.0.0,
`anchor-lang` 1.1.2 (fixado pelo `Cargo.lock`). Mainnet é a **S07**.

---

## 3. Instruções

Seis instruções. As cinco de bootstrap são **permissionless** (qualquer
signatário); só existem para montar o canon uma vez.

| Instrução | Args | Quem pode | O que faz |
|-----------|------|-----------|-----------|
| `initialize_config` | — | qualquer um (paga rent) | Cria a `Config` singleton. Sem parâmetro: o commitment é constante do bytecode. |
| `initialize_book_roots` | `book: u8` | qualquer um (paga rent) | Aloca a conta de roots de um livro, com tamanho fixado por constante. |
| `load_chapter_root` | `book: u8, chapter: u16, root: [u8;32], proof: Vec<[u8;32]>` | qualquer signatário | Grava a root de um capítulo **se** ela provar contra `ROOTS_COMMITMENT`. Idempotente. |
| `complete_book` | `book: u8` | qualquer signatário | Marca um livro como completo quando todas as suas roots estão carregadas. Idempotente (flag `completed`). |
| `seal` | — | qualquer signatário | Fecha o canon quando os 66 livros estão completos. **Irreversível.** |
| `register_verse` | `book: u8, chapter: u16, verse: u16, text: String, proof: Vec<[u8;32]>` | o adopter (paga rent) | Prova o texto contra a root do capítulo e cria a `VerseAccount`. Exige `sealed`. |

Ordem do bootstrap: `initialize_config` → para cada livro `initialize_book_roots`
+ N × `load_chapter_root` + `complete_book` → `seal`. Automatizado em
`scripts/bootstrap-devnet.ts` (§13).

---

## 4. Contas

Todas são PDAs próprias do programa (`Account<'info, T>` → owner e discriminador
validados pelo Anchor). Layouts em `programs/eternal-word/src/state.rs`.

### `Config` — singleton, PDA `["config"]`
```
translation:    [u8; 8]   — identificador da tradução ("engwebp\0")
books_complete: u8        — livros completos; selar exige 66
sealed:         bool      — registro só abre quando true
bump:           u8
```
Não guarda authority nem commitment: o commitment é constante do bytecode e o
bootstrap é permissionless. As seeds fixas ainda importam — `register_verse` lê
`sealed` daqui, então aceitar uma conta arbitrária deixaria forjar "selado".

### `BookRoots` — um por livro, PDA `["roots", book:u8]`
```
book:        u8
loaded:      u16          — capítulos com root gravada
completed:   bool         — set uma vez por complete_book (idempotência)
loaded_mask: Vec<u8>      — bitmap, 1 bit por capítulo, índice (chapter-1)
roots:       Vec<[u8;32]> — roots por capítulo, índice (chapter-1)
bump:        u8
```
Sharded por livro porque as 1.189 roots numa conta só seriam 38 KB — acima do
limite de 10.240 B que o runtime deixa uma conta crescer por instrução. Maior
livro: Salmos, 150 capítulos ≈ 4.800 B, cabe numa criação única (sem realloc).

### `VerseAccount` — um por versículo, PDA `["verse", book:u8, chapter:u16le, verse:u16le]`
```
adopter:    Pubkey        — carteira que registrou (nunca "owner", ver glossário)
created_at: i64           — unix timestamp do slot
book:       u8
chapter:    u16
verse:      u16
text:       String        — o texto canônico, on-chain (premissa do produto)
bump:       u8
```
Tamanho exato por `VerseAccount::space(text_len)` — só constantes nomeadas, sem
número mágico. A existência da conta é o registro; não há `update` nem `close`.

---

## 5. Esquema de PDA

| Conta | Seeds | Observação |
|-------|-------|------------|
| Config | `["config"]` | seeds fixas — base da validação (risco R3) |
| BookRoots | `["roots", book:u8]` | um por livro |
| VerseAccount | `["verse", book:u8, chapter:u16le, verse:u16le]` | índices numéricos, **nunca** nomes de livro |

Encodings little-endian, espelhados em `packages/blockchain/src/pdas.ts` e
`encoding.ts`. Um descasamento de largura derivaria endereço diferente e toda
transação falharia na resolução de contas.

---

## 6. Esquema Merkle

Duas árvores, mesmo algoritmo (`programs/eternal-word/src/merkle.rs`, espelhando
`packages/catalog/src/merkle.ts` byte a byte):

- **sha256**, syscall on-chain e nativo no Node.
- **Separação de domínio**: folha = `sha256(0x00 ‖ payload)`, nó =
  `sha256(0x01 ‖ esq ‖ dir)`. Impede que um nó interno seja apresentado como
  folha (família CVE-2012-2459).
- **Pares ordenados** por bytes: sem bits de direção na proof (economia que
  decidiu a forma da árvore — ver §8 e a ADR do orçamento). Por isso a
  **posição precisa estar dentro da folha**.
- **Nó ímpar promovido, nunca duplicado**: duas listas de folhas distintas não
  podem compartilhar a mesma root.

### Árvore de versículos (uma por capítulo)
Folha: `book:u8 | chapter:u16le | verse:u16le | text_len:u32le | text:utf8`.
`register_verse` reconstrói a folha, prova contra a root do capítulo (lida da
`BookRoots`), e só então cria a conta.

### Árvore de commitment (as 1.189 roots)
Folha: `book:u8 | chapter:u16le | root:[u8;32]`. A **posição no folha** é o que
impede gravar uma root real no capítulo errado — sem isso, aquele capítulo
ficaria permanentemente irregistrável (falha encontrada e corrigida no PG-02,
ADR `2026-07-19_conta-de-configuracao...`).

As cinco posições vazias da WEB (Lc 17:36, At 8:37, At 15:34, At 24:7, Rm 16:25)
não precisam de caso especial: não têm folha em árvore nenhuma, então nenhuma
proof verifica e o registro simplesmente falha.

---

## 7. Constantes irreversíveis

Em `programs/eternal-word/src/constants.rs`, verificadas **ao vivo contra o
Catálogo** antes do deploy (uma transposição na tabela passaria por um teste de
soma; o cross-check é por índice):

| Constante | Valor | Verificação |
|-----------|-------|-------------|
| `CHAPTERS_PER_BOOK` | tabela de 66, soma 1.189 | idêntica ao Catálogo |
| `TOTAL_CHAPTERS` | 1.189 | — |
| `MAX_VERSE_BYTES` | 493 | == maior versículo (Ester 8:9) |
| `MAX_VERSE_PROOF` | 8 | == profundidade do maior capítulo (Salmo 119, 176 versos) |
| `MAX_COMMITMENT_PROOF` | 11 | == profundidade da árvore de commitment |
| `TRANSLATION` | `engwebp\0` | eBible WEB, domínio público |
| `ROOTS_COMMITMENT` | `d36e745881…30e82efc` | == commitment do Catálogo (teste `hardcoded_commitment_matches_the_catalog`) |

---

## 8. O commitment no bytecode (histórico de segurança)

A versão original recebia o `roots_commitment` como **parâmetro** de
`initialize_config` e tinha uma `authority`. Auditoria pré-deploy encontrou um
**front-run crítico**: entre o deploy e a inicialização legítima, qualquer um
podia instalar um commitment próprio e registrar qualquer texto — ou virar
authority e travar o bootstrap. Fatal num programa imutável.

Correção (ADR `2026-07-21_commitment-no-bytecode-e-bootstrap-permissionless.md`):
o commitment virou constante do bytecode e a authority foi **removida**. Com o
commitment fixo, não há nada que uma authority possa corromper, então ela não
precisa existir. O bootstrap ficou permissionless e à prova de front-run.

Três lentes de segurança rodaram antes do deploy (dois reviews meus + um agente
independente com threat model completo): **nenhum achado de confiança alta**.

---

## 9. Erros

`EternalWordError` (`error.rs`), códigos Anchor 6000+ (índice 0-12):

| Código | Nome | Quando |
|--------|------|--------|
| 6000 | `ConfigSealed` | escrever no canon já selado |
| 6001 | `BookOutOfRange` | livro fora de 1-66 |
| 6002 | `ChapterOutOfRange` | capítulo inexistente no livro |
| 6003 | `ProofTooLong` | proof acima do máximo do desenho |
| 6004 | `RootNotCommitted` | root não prova contra o commitment |
| 6005 | `BookAlreadyComplete` | `complete_book` repetido no mesmo livro |
| 6006 | `BookIncomplete` | completar livro com capítulos faltando |
| 6007 | `CanonIncomplete` | selar com menos de 66 livros |
| 6008 | `ChapterRootMissing` | registrar em capítulo sem root carregada |
| 6009 | `TextTooLong` | texto acima de `MAX_VERSE_BYTES` |
| 6010 | `TextEmpty` | texto vazio |
| 6011 | `VerseNotCanonical` | texto não bate com a proof (vandalismo) |
| 6012 | `CanonNotSealed` | registrar antes do selo |

Só `require!` — nunca `unwrap`/`panic`. `overflow-checks = true` no profile de
release: qualquer over/underflow **aborta**, não gera valor errado.

---

## 10. Números medidos em devnet (PG-08)

| | Gênesis 1:1 | Ester 8:9 (mais longo) |
|---|---|---|
| texto | 56 B | 493 B |
| transação (v0 + ComputeBudget) | 594 B | **1.031 B** de 1.232 |
| compute units | 22.459 | 15.616 |
| conta / rent | 114 B → 0,001684 SOL | 551 B → 0,004726 SOL |

Ester 8:9 = 1.031 B, **idêntico à previsão do spike PG-00** (201 B de folga). CU
real ~15-22k, muito abaixo do default de 200k. Custo total distribuído estimado
para os 31.098 versículos: ~70 SOL, cada adopter pagando o rent do seu.

---

## 11. Imutabilidade e a upgrade authority (R2)

O programa **em si** não tem caminho de escrita para alterar registros. Mas o
**BPF upgrade authority** (quem pode substituir o bytecode inteiro) é a carteira
`83n4Vyyz…` em devnet. Um programa "eterno" que continua atualizável contradiz
a promessa — a decisão de **revogar** a authority (imutável de verdade) versus
mantê-la para correções é o **risco R2**, tratado na **S06** antes do go-live em
mainnet. Em devnet, mantê-la é intencional (permite redeploy nos testes).

⚠️ **`target/deploy/eternal_word-keypair.json`** (a keypair do programa) só
existe na VM e **não é versionada**. Quem a tem controla o Program ID. Backup
manual fora do repositório é obrigatório.

---

## 12. Testes

22 testes Rust (`programs/eternal-word/tests/`), rodam no host via litesvm (BPF
in-process, sem validator):

- **`merkle_fixtures.rs`** (12) — cross-check TS↔Rust: o programa aceita
  exatamente as proofs que o Catálogo gera (fixtures `data/test-fixtures.json`
  via `pnpm catalog:fixtures`); rejeita texto adulterado, endereço trocado,
  posições omitidas; confirma a tabela de capítulos e que `ROOTS_COMMITMENT`
  bate com o Catálogo.
- **`program_flow.rs`** (9) — executa o bytecode: registro feliz grava os
  campos, duplicidade recusada (conta fica com o 1º adopter), config forjada
  rejeitada, texto adulterado recusado, gate de `sealed`, fluxo de carga
  completo, `complete_book` duas vezes falha.
- CI (`.github/workflows/ci.yml`): job `program` compila o `.so` com
  `cargo build-sbf` (Agave pré-compilado) e roda a suíte.

Cliente TS (`packages/blockchain`): 24 testes — proof do cliente verifica contra
a root do capítulo, transação de pior caso ≤ 1.232 B, decoders de conta.

---

## 13. Runbook de operações

Todos os comandos assumem `nvm use` (Node 24) e Docker com a imagem
`eternal-word-build` (`pnpm docker:build`).

### Build reproduzível
```
pnpm program:build      # anchor build no container → target/deploy/eternal_word.so
pnpm sync-idl           # copia o IDL para packages/blockchain/src/idl/
sha256sum target/deploy/eternal_word.so   # hash para o registro
```

### Deploy (PG-07)
```
solana program deploy target/deploy/eternal_word.so \
  --program-id target/deploy/eternal_word-keypair.json \
  --url devnet --max-sign-attempts 1000 --with-compute-unit-price 20000
```
> **Gotcha (visto no PG-07):** o RPC público de devnet estoura "max retries" em
> deploys grandes. Se falhar deixando um buffer parcial:
> ```
> solana program show --buffers --url devnet          # achar o buffer preso
> solana program close <BUFFER> --url devnet           # recupera o SOL
> ```
> depois redeploya. `--max-sign-attempts` alto reduz a chance de falhar.

### Bootstrap do canon (PG-08)
```
pnpm bootstrap:devnet -- --dry-run    # valida commitment vs artefato e tamanhos (também no CI)
pnpm bootstrap:devnet                 # ~730 tx: init + 1.189 load (2/tx) + 66 complete + seal
```
Idempotente: lê o estado on-chain e retoma de onde parou; um retry loop segura
o RPC congestionado. Custo ~0,34 SOL (rent dos 66 `book_roots`).

### Smoke test (PG-08)
```
pnpm smoke:devnet     # registra Gn 1:1 e Et 8:9, recusa duplicidade, mede rent/CU
```

### Verificação on-chain
```
solana program show 9up3jAXPTgkJz9UvMLwEiUUSVdPd6E1KshwfxT3dZCdG --url devnet
solana balance --url devnet
```

---

## 14. O que este módulo NÃO faz (fronteiras)

- **Não indexa.** Descobrir/exibir registros é do indexer + banco (S03) e da web
  (S04). O programa só cria contas.
- **Não guarda tradução alternativa nem anotações.** Extensibilidade é off-chain,
  ancorada no endereço `(book, chapter, verse)` — ver ADR de extensibilidade.
- **Não limita registro por carteira** (risco R6 encerrado; adoção é
  permissionless e first-come, por decisão de produto).
- **Não subsidia rent.** Quem registra paga.

---

## 15. Pendências e próximos passos

- **R2 (upgrade authority)** — decidir revogar vs manter, na S06, antes de mainnet.
- **RPC dedicado** — devnet/mainnet usarão um provider (Helius?), provisionado na
  S03; o público basta para testes.
- **Mainnet (S07)** — rebuild do programa (novo hash), commitment definitivo,
  deploy, bootstrap de produção. O commitment cravado significa que o bytecode
  de mainnet **atesta** o canon.
