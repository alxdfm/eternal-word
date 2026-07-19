import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Locates the repository root by walking up from a module until it finds the
 * pnpm workspace manifest.
 *
 * Why not a relative path like `new URL('../../../data', import.meta.url)`:
 * the depth of a module differs between source and build output. With
 * `rootDir: "."`, `packages/catalog/src/cli/merkle.ts` compiles to
 * `packages/catalog/dist/src/cli/merkle.js` — one level deeper — so the same
 * `../../../../` resolves to two different directories. Everything still works
 * today only because these modules are always run from source through `tsx`;
 * the emitted JavaScript silently points at paths that do not exist.
 *
 * Walking up to a known marker is depth-independent, so source and build agree.
 */
const WORKSPACE_MARKER = 'pnpm-workspace.yaml'

export function findRepoRoot(from: string | URL): string {
  // `import.meta.url` arrives as a string, but a `file://` one — treating it as
  // a filesystem path silently yields a directory that never matches.
  const isFileUrl = typeof from === 'string' ? from.startsWith('file:') : from.protocol === 'file:'
  const start = isFileUrl ? fileURLToPath(from) : String(from)
  let directory = dirname(start)

  // Root is reached when dirname stops changing ('/' on POSIX).
  for (;;) {
    if (existsSync(join(directory, WORKSPACE_MARKER))) return directory
    const parent = dirname(directory)
    if (parent === directory) {
      throw new Error(`repository root not found: no ${WORKSPACE_MARKER} above ${start}`)
    }
    directory = parent
  }
}

/** Absolute path for a repo-relative path, independent of the caller's depth. */
export function fromRepoRoot(from: string | URL, ...segments: string[]): string {
  return resolve(findRepoRoot(from), ...segments)
}
