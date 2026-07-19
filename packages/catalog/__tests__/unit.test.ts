import { describe, expect, it } from 'vitest'
import {
  buildCanonicalTree,
  buildMerkleTree,
  canonicalLeaf,
  encodeVerseLeaf,
  hashLeaf,
  hashPair,
  merkleProof,
  proofForAddress,
  verifyMerkleProof,
} from '../src/index.js'
import type { CanonicalVerse } from '../src/index.js'

function verse(book: number, chapter: number, verseNumber: number, text: string): CanonicalVerse {
  return { address: { book, chapter, verse: verseNumber }, text }
}

const sample: CanonicalVerse[] = [
  verse(1, 1, 1, 'In the beginning, God created the heavens and the earth.'),
  verse(1, 1, 2, 'The earth was formless and empty.'),
  verse(1, 1, 3, 'God said, "Let there be light," and there was light.'),
  verse(1, 2, 1, 'The heavens, the earth, and all their vast array were finished.'),
  verse(66, 22, 21, 'The grace of the Lord Jesus Christ be with all the saints. Amen.'),
]

describe('leaf encoding', () => {
  it('lays out the fields exactly as the program will rebuild them', () => {
    const encoded = encodeVerseLeaf({ book: 1, chapter: 2, verse: 3 }, 'ab')
    expect(encoded.readUInt8(0)).toBe(1)
    expect(encoded.readUInt16LE(1)).toBe(2)
    expect(encoded.readUInt16LE(3)).toBe(3)
    expect(encoded.readUInt32LE(5)).toBe(2)
    expect(encoded.subarray(9).toString('utf8')).toBe('ab')
  })

  it('counts bytes, not characters, for non-ascii text', () => {
    const encoded = encodeVerseLeaf({ book: 1, chapter: 1, verse: 1 }, '’')
    expect(encoded.readUInt32LE(5)).toBe(3)
  })

  it('cannot be confused between neighbouring fields', () => {
    // Without the length prefix, ("ab", "c") and ("a", "bc") could collide.
    const first = encodeVerseLeaf({ book: 1, chapter: 1, verse: 1 }, 'ab')
    const second = encodeVerseLeaf({ book: 1, chapter: 1, verse: 1 }, 'a')
    expect(first.equals(second)).toBe(false)
  })

  it('separates the same text at different addresses', () => {
    const here = canonicalLeaf(verse(1, 1, 1, 'same text'))
    const there = canonicalLeaf(verse(1, 1, 2, 'same text'))
    expect(here.equals(there)).toBe(false)
  })
})

describe('merkle tree', () => {
  it('hashes pairs in byte order, so sibling order cannot change the root', () => {
    const a = hashLeaf(Buffer.from('a'))
    const b = hashLeaf(Buffer.from('b'))
    expect(hashPair(a, b).equals(hashPair(b, a))).toBe(true)
  })

  it('separates leaf digests from internal node digests', () => {
    // A leaf must never be reinterpretable as an internal node.
    const leaf = hashLeaf(Buffer.alloc(64))
    const node = hashPair(hashLeaf(Buffer.from('x')), hashLeaf(Buffer.from('y')))
    expect(leaf.equals(node)).toBe(false)
  })

  it('proves every leaf of a tree with an odd number of leaves', () => {
    const leaves = ['a', 'b', 'c', 'd', 'e'].map((value) => hashLeaf(Buffer.from(value)))
    const tree = buildMerkleTree(leaves)

    leaves.forEach((leaf, index) => {
      const proof = merkleProof(tree, index)
      expect(verifyMerkleProof(leaf, proof, tree.root), `leaf ${index}`).toBe(true)
    })
  })

  it('rejects a proof for a leaf that is not in the tree', () => {
    const leaves = ['a', 'b', 'c', 'd'].map((value) => hashLeaf(Buffer.from(value)))
    const tree = buildMerkleTree(leaves)
    const proof = merkleProof(tree, 0)
    const forged = hashLeaf(Buffer.from('forged'))
    expect(verifyMerkleProof(forged, proof, tree.root)).toBe(false)
  })

  it('rejects a tampered proof', () => {
    const leaves = ['a', 'b', 'c', 'd'].map((value) => hashLeaf(Buffer.from(value)))
    const tree = buildMerkleTree(leaves)
    const proof = merkleProof(tree, 1)
    const tampered = [...proof]
    tampered[0] = hashLeaf(Buffer.from('z'))
    expect(verifyMerkleProof(leaves[1] as Buffer, tampered, tree.root)).toBe(false)
  })

  it('refuses to build over an empty set', () => {
    expect(() => buildMerkleTree([])).toThrow()
  })

  it('grows depth logarithmically', () => {
    const leaves = Array.from({ length: 1000 }, (_, i) => hashLeaf(Buffer.from(String(i))))
    expect(buildMerkleTree(leaves).depth).toBe(10)
  })
})

describe('canonical tree', () => {
  it('proves each verse of the sample against the root', () => {
    const tree = buildCanonicalTree(sample)
    for (const item of sample) {
      const proof = proofForAddress(tree, item.address)
      expect(verifyMerkleProof(canonicalLeaf(item), proof, tree.tree.root)).toBe(true)
    }
  })

  it('rejects altered text under a valid proof — the vandalism case', () => {
    const tree = buildCanonicalTree(sample)
    const target = sample[0] as CanonicalVerse
    const proof = proofForAddress(tree, target.address)
    const altered = canonicalLeaf({ address: target.address, text: 'In the beginning, nothing.' })
    expect(verifyMerkleProof(altered, proof, tree.tree.root)).toBe(false)
  })

  it('changes the root when any verse changes', () => {
    const original = buildCanonicalTree(sample)
    const edited = buildCanonicalTree([...sample.slice(0, 4), verse(66, 22, 21, 'Amen.')])
    expect(original.tree.root.equals(edited.tree.root)).toBe(false)
  })

  it('has no proof for an address outside the tree', () => {
    const tree = buildCanonicalTree(sample)
    expect(() => proofForAddress(tree, { book: 44, chapter: 8, verse: 37 })).toThrow(
      /not registrable/,
    )
  })
})
