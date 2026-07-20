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

function assertFits(instruction: TransactionInstruction, payer: PublicKey, label: string) {
  const transaction = new Transaction({ feePayer: payer, recentBlockhash: PROGRAM_ID.toBase58() })
  transaction.add(instruction)
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

    // Validate every instruction serializes within the packet limit, using a
    // throwaway payer. The per-chapter load is the tight one (PG-00).
    const payer = Keypair.generate().publicKey
    assertFits(initializeConfigInstruction(payer, commitment), payer, 'initialize_config')
    let worst = 0
    for (const { book, chapter, root, proof } of chapters) {
      const instruction = loadChapterRootInstruction(payer, book, chapter, root, proof)
      assertFits(instruction, payer, `load ${book}:${chapter}`)
      worst = Math.max(worst, instruction.data.length)
    }
    process.stdout.write(
      `dry run OK — commitment matches the artifact, ${chapters.length} loads validated, largest instruction ${worst} B\n`,
    )
    return
  }

  const keypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(readFileSync(options.keypairPath, 'utf8'))),
  )
  const connection = new Connection(options.url, 'confirmed')
  const authority = keypair.publicKey
  process.stdout.write(`authority:    ${authority.toBase58()}\n\n`)

  const priorityFee = ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 })
  const send = async (instruction: TransactionInstruction) => {
    const transaction = new Transaction().add(priorityFee, instruction)
    const { blockhash } = await connection.getLatestBlockhash()
    transaction.recentBlockhash = blockhash
    transaction.feePayer = authority
    const signature = await connection.sendTransaction(transaction, [keypair])
    await connection.confirmTransaction(signature, 'confirmed')
  }
  const exists = async (pda: PublicKey) => (await connection.getAccountInfo(pda)) !== null

  const [config] = configPda()
  if (await exists(config)) {
    process.stdout.write('config already exists — skipping initialize_config\n')
  } else {
    await send(initializeConfigInstruction(authority, commitment))
    process.stdout.write('config created\n')
  }

  for (const [book, bookChapters] of books) {
    const [bookRoots] = bookRootsPda(book)
    if (!(await exists(bookRoots))) {
      await send(initializeBookRootsInstruction(authority, book))
    }
    for (const { chapter, root, proof } of bookChapters) {
      // load_chapter_root is idempotent — a re-load writes the same value — so
      // resending on a resumed run is safe.
      await send(loadChapterRootInstruction(authority, book, chapter, root, proof))
    }
    try {
      await send(completeBookInstruction(authority, book))
    } catch (error) {
      if (!String(error).includes('6005')) throw error // BookAlreadyComplete
    }
    process.stdout.write(`book ${book}: ${bookChapters.length} chapters loaded and completed\n`)
  }

  try {
    await send(sealInstruction(authority))
    process.stdout.write('\ncanon sealed — registration is now open\n')
  } catch (error) {
    if (String(error).includes('6000')) {
      process.stdout.write('\ncanon was already sealed\n')
    } else {
      throw error
    }
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
  process.exit(1)
})
