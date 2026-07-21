//
// Bootstraps a freshly deployed program: creates the config, loads all 1,189
// chapter roots, completes every book, seals. Until the canon is sealed no
// verse can be registered (the `sealed` gate), so this must run once after the
// PG-07 deploy and before the PG-08 smoke test.
//
//   pnpm bootstrap:devnet -- --dry-run          build and validate, send nothing
//   pnpm bootstrap:devnet -- --keypair PATH     run against devnet
//
// Idempotent: existing accounts are skipped and already-done steps (a loaded
// root, a completed book, a sealed config) are recognised, so a re-run after an
// interruption resumes instead of failing. That safety is exactly why the
// program's complete_book had to be made idempotent first.
//
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import {
  PROGRAM_ID,
  bookRootsPda,
  completeBookInstruction,
  configPda,
  decodeBookRoots,
  decodeConfig,
  initializeBookRootsInstruction,
  initializeConfigInstruction,
  loadChapterRootInstruction,
  sealInstruction,
} from '@eternal-word/blockchain'
import {
  buildChapterRootsTree,
  buildChapterTrees,
  chapterRootProof,
  listRegistrableVerses,
  loadCanonicalBooks,
  toHex,
} from '@eternal-word/catalog'
import { fromRepoRoot } from '@eternal-word/shared'
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  type PublicKey,
  Transaction,
  type TransactionInstruction,
} from '@solana/web3.js'

const TRANSACTION_LIMIT = 1232
/** Two loads share the config/book_roots/signer accounts and fit under the
 * packet limit (the deepest load instruction is ~399 B). Halves the ~1,189
 * load transactions. The dry-run proves the batch fits. */
const LOADS_PER_TX = 2
/** Generous cap; load verifies up to 11 sha256 (a handful of thousand CU). The
 * exact figure is measured in PG-08 — this only has to be safely above it. */
const COMPUTE_UNIT_LIMIT = 400_000

interface Options {
  dryRun: boolean
  url: string
  keypairPath: string
}

function parseArgs(argv: readonly string[]): Options {
  const options: Options = {
    dryRun: argv.includes('--dry-run'),
    url: 'https://api.devnet.solana.com',
    keypairPath: `${homedir()}/.config/solana/id.json`,
  }
  const at = (flag: string) => {
    const i = argv.indexOf(flag)
    return i >= 0 ? argv[i + 1] : undefined
  }
  options.url = at('--url') ?? options.url
  options.keypairPath = at('--keypair') ?? options.keypairPath
  return options
}

/** Chapter roots and their commitment proofs, computed from the CanonicalText. */
function buildCanonPlan() {
  const books = loadCanonicalBooks()
  const chapters = buildChapterTrees(listRegistrableVerses(books))
  const commitment = buildChapterRootsTree(chapters)
  const plan = chapters.map((chapter) => ({
    book: chapter.book,
    chapter: chapter.chapter,
    root: chapter.tree.root,
    proof: chapterRootProof(chapters, chapter.book, chapter.chapter, commitment),
  }))
  return { commitment: commitment.root, chapters: plan }
}

/** Groups the flat chapter list into its 66 books, in canonical order. */
function byBook(chapters: ReturnType<typeof buildCanonPlan>['chapters']) {
  const groups = new Map<number, typeof chapters>()
  for (const chapter of chapters) {
    const list = groups.get(chapter.book) ?? []
    list.push(chapter)
    groups.set(chapter.book, list)
  }
  return [...groups.entries()].sort(([a], [b]) => a - b)
}

const computeBudget = (): TransactionInstruction[] => [
  ComputeBudgetProgram.setComputeUnitLimit({ units: COMPUTE_UNIT_LIMIT }),
  ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 }),
]

/** Splits an array into chunks of at most `size`. */
function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size))
  return chunks
}

/** Asserts a transaction built from these instructions fits the packet limit —
 * the same composition (with ComputeBudget) the real run sends. */
function assertFits(
  instructions: readonly TransactionInstruction[],
  payer: PublicKey,
  label: string,
) {
  const transaction = new Transaction({ feePayer: payer, recentBlockhash: PROGRAM_ID.toBase58() })
  transaction.add(...computeBudget(), ...instructions)
  const size = 1 + 64 + transaction.compileMessage().serialize().length
  if (size > TRANSACTION_LIMIT) {
    throw new Error(`${label} does not fit: ${size} B of ${TRANSACTION_LIMIT}`)
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const { commitment, chapters } = buildCanonPlan()
  const books = byBook(chapters)

  process.stdout.write(
    [
      'Eternal Word — canon bootstrap',
      `program:      ${PROGRAM_ID.toBase58()}`,
      `commitment:   ${toHex(commitment)}`,
      `chapters:     ${chapters.length} across ${books.length} books`,
      `mode:         ${options.dryRun ? 'DRY RUN — nothing is sent' : options.url}`,
      '',
    ].join('\n'),
  )

  if (options.dryRun) {
    // The commitment this script will write on-chain must be the one committed
    // to the repo — the same value the program validates every load against. A
    // drift here would mean the bootstrap installs a canon nobody can audit.
    const artifact = JSON.parse(
      readFileSync(fromRepoRoot(import.meta.url, 'data/merkle-root.json'), 'utf8'),
    ) as { perChapter: { rootsCommitment: string } }
    if (artifact.perChapter.rootsCommitment !== toHex(commitment)) {
      throw new Error(
        `commitment drift: bootstrap ${toHex(commitment)} vs artifact ${artifact.perChapter.rootsCommitment}`,
      )
    }

    // Validate the batched load transaction — the exact composition the real
    // run sends (ComputeBudget + up to LOADS_PER_TX loads). Uses the deepest
    // proofs so a passing dry-run guarantees the tightest real batch fits too.
    const payer = Keypair.generate().publicKey
    assertFits([initializeConfigInstruction(payer)], payer, 'initialize_config')
    const deepest = [...chapters].sort((a, b) => b.proof.length - a.proof.length)
    for (const [, group] of byBook(deepest)) {
      for (const batch of chunk(group.slice(0, LOADS_PER_TX), LOADS_PER_TX)) {
        assertFits(
          batch.map((c) => loadChapterRootInstruction(payer, c.book, c.chapter, c.root, c.proof)),
          payer,
          `load batch in book ${batch[0]?.book}`,
        )
      }
    }
    const worst = Math.max(...chapters.map((c) => 8 + 1 + 2 + 32 + 4 + c.proof.length * 32))
    process.stdout.write(
      `dry run OK — commitment matches the artifact, ${chapters.length} loads validated ` +
        `(${LOADS_PER_TX}/tx), largest instruction ${worst} B\n`,
    )
    return
  }

  const keypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(readFileSync(options.keypairPath, 'utf8'))),
  )
  const connection = new Connection(options.url, 'confirmed')
  const wallet = keypair.publicKey
  process.stdout.write(`wallet:    ${wallet.toBase58()}\n\n`)

  const send = async (instructions: TransactionInstruction[]) => {
    const transaction = new Transaction().add(...computeBudget(), ...instructions)
    const { blockhash } = await connection.getLatestBlockhash()
    transaction.recentBlockhash = blockhash
    transaction.feePayer = wallet
    const signature = await connection.sendTransaction(transaction, [keypair])
    await connection.confirmTransaction(signature, 'confirmed')
  }
  const fetch = (pda: PublicKey) => connection.getAccountInfo(pda)

  // Idempotency reads state, never error strings: Anchor surfaces custom errors
  // as hex (`0x1775`), so matching the decimal `6005` would silently never fire.
  const [config] = configPda()
  const configInfo = await fetch(config)
  if (configInfo === null) {
    await send([initializeConfigInstruction(wallet)])
    process.stdout.write('config created\n')
  } else if (decodeConfig(configInfo.data).sealed) {
    process.stdout.write('canon is already sealed — nothing to do\n')
    return
  } else {
    process.stdout.write('config already exists — resuming\n')
  }

  for (const [book, bookChapters] of books) {
    const [bookRoots] = bookRootsPda(book)
    const info = await fetch(bookRoots)
    const state = info === null ? null : decodeBookRoots(info.data)
    if (state === null) {
      await send([initializeBookRootsInstruction(wallet, book)])
    }

    // Skip chapters already stored — a resume does only what remains.
    const pending = bookChapters.filter((c) => !(state?.isChapterLoaded(c.chapter) ?? false))
    for (const batch of chunk(pending, LOADS_PER_TX)) {
      await send(
        batch.map((c) => loadChapterRootInstruction(wallet, book, c.chapter, c.root, c.proof)),
      )
    }

    if (!(state?.completed ?? false)) {
      await send([completeBookInstruction(wallet, book)])
    }
    process.stdout.write(
      `book ${book}: ${bookChapters.length} chapters — ${pending.length} loaded, completed\n`,
    )
  }

  await send([sealInstruction(wallet)])
  process.stdout.write('\ncanon sealed — registration is now open\n')
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
  process.exit(1)
})
