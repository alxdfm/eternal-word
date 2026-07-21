//
// Copies the IDL produced by `anchor build` into packages/blockchain, where it
// is versioned.
//
// `anchor build` writes to target/, which is gitignored — so the IDL never
// reaches git on its own. But the S02 definition of done requires it committed
// (sprints/2026-S02/GOALS.md), and packages/blockchain needs it to type the
// program client (PG-09). This script is the bridge.
//
// Committing the IDL matters beyond convenience: it is the public schema of an
// immutable program. Anyone auditing a VerseAccount, or rebuilding the indexer
// from the chain alone, needs the exact layout the deployed bytecode uses.
//
//   pnpm program:build && pnpm sync-idl
//
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fromRepoRoot } from '@eternal-word/shared'

const SOURCE = fromRepoRoot(import.meta.url, 'target/idl/eternal_word.json')
const TARGET = fromRepoRoot(import.meta.url, 'packages/blockchain/src/idl/eternal_word.json')

if (!existsSync(SOURCE)) {
  process.stderr.write(
    `IDL not found at ${SOURCE}\nRun \`pnpm program:build\` first — the IDL is a build artifact.\n`,
  )
  process.exit(1)
}

const idl = JSON.parse(readFileSync(SOURCE, 'utf8')) as { address?: string }
if (typeof idl.address !== 'string' || idl.address.length === 0) {
  process.stderr.write(
    'IDL has no `address` field — refusing to sync an IDL without a Program ID\n',
  )
  process.exit(1)
}

mkdirSync(dirname(TARGET), { recursive: true })
copyFileSync(SOURCE, TARGET)

process.stdout.write(`IDL synced — program ${idl.address}\n  ${SOURCE}\n  -> ${TARGET}\n`)
