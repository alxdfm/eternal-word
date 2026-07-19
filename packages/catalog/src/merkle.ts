import { createHash } from 'node:crypto'

/**
 * Merkle tree used to commit the CanonicalText on-chain.
 *
 * Design choices, all of which the Anchor program must mirror exactly:
 *
 * - **sha256** — available as a Solana syscall and built into Node, so the
 *   same digest is reachable on both sides with no dependency.
 * - **Domain separation** — leaves are hashed with a `0x00` prefix and
 *   internal nodes with `0x01`, so no leaf digest can ever be mistaken for
 *   an internal node (second-preimage attack).
 * - **Sorted pairs** — each pair is hashed in byte order, which removes the
 *   need to send direction bits with the proof. Transaction budget is the
 *   binding constraint here (see risk R1); position is bound anyway by the
 *   PDA seeds and by the address inside the leaf.
 * - **Odd node promoted, never duplicated** — duplicating the last node
 *   admits two distinct leaf sets with the same root (the flaw behind
 *   CVE-2012-2459 in Bitcoin).
 */

const LEAF_PREFIX = Uint8Array.of(0x00)
const NODE_PREFIX = Uint8Array.of(0x01)

export type Hash = Buffer

function sha256(...parts: readonly Uint8Array[]): Hash {
  const hash = createHash('sha256')
  for (const part of parts) hash.update(part)
  return hash.digest()
}

export function hashLeaf(payload: Uint8Array): Hash {
  return sha256(LEAF_PREFIX, payload)
}

export function hashPair(left: Hash, right: Hash): Hash {
  return Buffer.compare(left, right) <= 0
    ? sha256(NODE_PREFIX, left, right)
    : sha256(NODE_PREFIX, right, left)
}

export interface MerkleTree {
  /** layers[0] holds the leaves; the last layer holds the single root. */
  readonly layers: readonly (readonly Hash[])[]
  readonly root: Hash
  readonly leafCount: number
  /** Number of sibling hashes in the longest proof. */
  readonly depth: number
}

export function buildMerkleTree(leaves: readonly Hash[]): MerkleTree {
  if (leaves.length === 0) throw new Error('cannot build a Merkle tree with no leaves')

  const layers: Hash[][] = [[...leaves]]
  while (true) {
    const current = layers[layers.length - 1]
    if (current === undefined || current.length <= 1) break

    const next: Hash[] = []
    for (let i = 0; i < current.length; i += 2) {
      const left = current[i]
      const right = current[i + 1]
      if (left === undefined) continue
      // Odd one out rides up untouched instead of being paired with itself.
      next.push(right === undefined ? left : hashPair(left, right))
    }
    layers.push(next)
  }

  const rootLayer = layers[layers.length - 1]
  const root = rootLayer?.[0]
  if (root === undefined) throw new Error('failed to derive Merkle root')

  return { layers, root, leafCount: leaves.length, depth: layers.length - 1 }
}

/** Sibling hashes needed to walk `index` up to the root, bottom layer first. */
export function merkleProof(tree: MerkleTree, index: number): Hash[] {
  if (!Number.isInteger(index) || index < 0 || index >= tree.leafCount) {
    throw new Error(`leaf index out of range: ${index}`)
  }

  const proof: Hash[] = []
  let position = index

  for (let level = 0; level < tree.layers.length - 1; level++) {
    const layer = tree.layers[level]
    if (layer === undefined) break

    const siblingIndex = position % 2 === 0 ? position + 1 : position - 1
    const sibling = layer[siblingIndex]
    // No sibling means this node was promoted; nothing to prove at this level.
    if (sibling !== undefined) proof.push(sibling)
    position = Math.floor(position / 2)
  }

  return proof
}

export function verifyMerkleProof(leaf: Hash, proof: readonly Hash[], root: Hash): boolean {
  let computed = leaf
  for (const sibling of proof) computed = hashPair(computed, sibling)
  return computed.equals(root)
}
