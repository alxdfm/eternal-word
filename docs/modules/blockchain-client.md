# Módulo: `@eternal-word/blockchain` (cliente do programa)

> Cliente TypeScript do programa Anchor: derivação de PDA, construção de
> transações, proof client-side e decoders de conta. Localização:
> `packages/blockchain/`. Consome `@eternal-word/catalog` (texto + Merkle) e
> `@solana/web3.js` v1. É o que a **S04** (web) e o **S03** (indexer) vão usar.
>
> Referência do programa on-chain: [`eternal-word-program.md`](eternal-word-program.md).

---

## Por que web3.js v1 (e não o client do Anchor)

O TS client do Anchor (`@coral-xyz/anchor`) só chegou na 0.32, com mismatch em
relação ao CLI 1.0 usado aqui. Em vez de arrastar essa incompatibilidade, o
cliente é enxuto sobre `@solana/web3.js` v1 e **lê os discriminadores e a ordem
das contas direto do IDL sincronizado** (`src/idl/eternal_word.json`) — assim um
programa rebuildado que mude qualquer um deles nunca diverge em silêncio do
cliente. Ver ADR do PG-09 (tarefa em `sprints/2026-S02/tasks.md`).

---

## API pública (`src/index.ts`)

### Metadados e PDAs
```ts
import { PROGRAM_ID, IDL, configPda, bookRootsPda, versePda } from '@eternal-word/blockchain'

PROGRAM_ID                       // PublicKey, lido do IDL
const [config]     = configPda()
const [bookRoots]  = bookRootsPda(book)
const [verse]      = versePda({ book, chapter, verse })
```
As PDAs espelham as seeds do programa (u8/u16le). Passe um `programId` custom
como último argumento para apontar a outro deploy.

### Proof client-side — `CatalogProver`
```ts
import { CatalogProver } from '@eternal-word/blockchain'

const prover = new CatalogProver()          // constrói as árvores uma vez
const { address, text, proof } = prover.proofFor({ book: 1, chapter: 1, verse: 1 })
```
Constrói as árvores de capítulo uma única vez no construtor; cada `proofFor` é um
lookup + caminhada. Lança em posição não-registrável (fora do canon ou uma das
cinco lacunas da WEB). A proof retornada verifica contra a root do capítulo — o
mesmo contrato Merkle que o programa valida do outro lado (cross-check nos testes
Rust).

### Transação de registro
```ts
import { registerVerseTransaction, registerVerseInstruction } from '@eternal-word/blockchain'

const tx = registerVerseTransaction({
  adopter: wallet.publicKey,
  address, text, proof,
  recentBlockhash,
  computeUnitLimit: 400_000,          // opcional; cabe nos 201 B de folga (PG-00)
  priorityFeeMicroLamports: 1000,     // opcional
})
// retorna VersionedTransaction (v0) NÃO assinada — o wallet adapter assina
```
`registerVerseInstruction` devolve só a `TransactionInstruction` se você quer
compor. `encodeRegisterVerse` expõe o encoding Borsh cru.

### Instruções administrativas (bootstrap — não para a web)
`initializeConfigInstruction`, `initializeBookRootsInstruction`,
`loadChapterRootInstruction`, `completeBookInstruction`, `sealInstruction`.
Usadas só pelo `scripts/bootstrap-devnet.ts`. Permissionless; a web nunca as
chama.

### Decoders de conta
```ts
import { decodeConfig, decodeBookRoots } from '@eternal-word/blockchain'

decodeConfig(accountInfo.data)      // { sealed, booksComplete }
decodeBookRoots(accountInfo.data)   // { book, loaded, completed, isChapterLoaded(ch) }
```
Validam o discriminador antes de ler; os offsets espelham os structs Rust. Um
decode errado é auto-corrigível pelo bootstrap (guards do programa), mas o
cross-check real com a serialização do Anchor só acontece rodando contra o
programa (feito no PG-08).

---

## Layout do pacote
```
src/
  program.ts     PROGRAM_ID, IDL, discriminadores (do IDL)
  encoding.ts    u8/u16le/u32le — encoders LE compartilhados
  pdas.ts        configPda / bookRootsPda / versePda
  proof.ts       CatalogProver
  register.ts    encodeRegisterVerse / registerVerseInstruction / registerVerseTransaction
  admin.ts       instruções de bootstrap
  accounts.ts    decodeConfig / decodeBookRoots
  idl/eternal_word.json   IDL sincronizado (fonte da verdade da ABI)
```

O IDL é versionado e regenerado por `pnpm sync-idl` após qualquer mudança no
programa. Nunca editar à mão.

---

## Testes
`__tests__/unit.test.ts` (24): metadados vs IDL, PDAs determinísticas, a proof do
`CatalogProver` verifica contra a root do capítulo, encoding do `register_verse`,
a transação de pior caso (Ester 8:9) serializa ≤ 1.232 B, flags/discriminadores
das instruções admin conferem contra o IDL, decoders de conta.
