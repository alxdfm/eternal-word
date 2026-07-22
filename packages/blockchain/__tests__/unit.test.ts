import {
  buildChapterTrees,
  canonicalLeaf,
  listRegistrableVerses,
  loadCanonicalBooks,
  verifyMerkleProof,
} from '@eternal-word/catalog'
import type { VerseAddress } from '@eternal-word/domain'
import { Keypair, PublicKey } from '@solana/web3.js'
import { describe, expect, it } from 'vitest'
import {
  CatalogProver,
  IDL,
  PROGRAM_ID,
  accountDiscriminator,
  bookRootsPda,
  completeBookInstruction,
  configPda,
  decodeBookRoots,
  decodeConfig,
  decodeVerseAccount,
  decodeVerseRegisteredEvent,
  encodeRegisterVerse,
  eventDiscriminator,
  initializeBookRootsInstruction,
  initializeConfigInstruction,
  instructionDiscriminator,
  loadChapterRootInstruction,
  registerVerseTransaction,
  sealInstruction,
  versePda,
  verseRegisteredEventsFromLogs,
} from '../src/index.js'

const address = (book: number, chapter: number, verse: number): VerseAddress => ({
  book,
  chapter,
  verse,
})

describe('program metadata', () => {
  it('reads the Program ID from the IDL', () => {
    expect(PROGRAM_ID.toBase58()).toBe(IDL.address)
  })

  it('resolves an instruction discriminator from the IDL', () => {
    const fromIdl = IDL.instructions.find((i) => i.name === 'register_verse')?.discriminator
    expect([...instructionDiscriminator('register_verse')]).toEqual(fromIdl)
  })
})

describe('PDA derivation', () => {
  it('is deterministic and program-owned', () => {
    const [config] = configPda()
    expect(config).toEqual(configPda()[0])
    expect(PublicKey.isOnCurve(config.toBytes())).toBe(false) // a real PDA
  })

  it('gives a distinct address per verse', () => {
    const a = versePda(address(1, 1, 1))[0].toBase58()
    const b = versePda(address(1, 1, 2))[0].toBase58()
    const c = versePda(address(2, 1, 1))[0].toBase58()
    expect(new Set([a, b, c]).size).toBe(3)
  })

  it('derives the book-roots account per book', () => {
    expect(bookRootsPda(1)[0]).not.toEqual(bookRootsPda(19)[0])
  })
})

describe('CatalogProver', () => {
  const prover = new CatalogProver()
  const books = loadCanonicalBooks()
  const chapters = buildChapterTrees(listRegistrableVerses(books))
  const rootOf = (book: number, chapter: number) =>
    chapters.find((c) => c.book === book && c.chapter === chapter)?.tree.root

  it('builds a proof the chapter root accepts', () => {
    for (const [book, chapter, verse] of [
      [1, 1, 1],
      [19, 119, 176],
      [17, 8, 9], // Esther 8:9, the longest verse
      [66, 22, 21], // last verse of the canon
    ] as const) {
      const { text, proof } = prover.proofFor(address(book, chapter, verse))
      const root = rootOf(book, chapter)
      expect(root, `root for ${book}:${chapter}`).toBeDefined()
      const leaf = canonicalLeaf({ address: address(book, chapter, verse), text })
      expect(verifyMerkleProof(leaf, proof, root as Buffer), `${book}:${chapter}:${verse}`).toBe(
        true,
      )
    }
  })

  it('refuses a position the WEB leaves empty', () => {
    // Acts 8:37 has no text in the WEB, so no leaf and no proof.
    expect(() => prover.proofFor(address(44, 8, 37))).toThrow(/not registrable/)
  })

  it('refuses a reference outside the canon', () => {
    // Genesis 1 has 31 verses; verse 32 is a valid triple but not in the canon.
    expect(() => prover.proofFor(address(1, 1, 32))).toThrow(/not registrable/)
  })
})

describe('register_verse encoding', () => {
  it('prefixes the IDL discriminator and round-trips the header', () => {
    const { text, proof } = new CatalogProver().proofFor(address(1, 1, 1))
    const data = encodeRegisterVerse(address(1, 1, 1), text, proof)

    expect([...data.subarray(0, 8)]).toEqual([...instructionDiscriminator('register_verse')])
    expect(data.readUInt8(8)).toBe(1) // book
    expect(data.readUInt16LE(9)).toBe(1) // chapter
    expect(data.readUInt16LE(11)).toBe(1) // verse
    expect(data.readUInt32LE(13)).toBe(Buffer.byteLength(text, 'utf8')) // text length
  })
})

describe('transaction budget', () => {
  it('fits the worst-case verse with ComputeBudget under the 1232-byte limit', () => {
    const prover = new CatalogProver()
    const worst = address(17, 8, 9) // Esther 8:9
    const { text, proof } = prover.proofFor(worst)

    const transaction = registerVerseTransaction({
      adopter: Keypair.generate().publicKey,
      address: worst,
      text,
      proof,
      recentBlockhash: PublicKey.default.toBase58(),
      computeUnitLimit: 400_000,
      priorityFeeMicroLamports: 1000,
    })

    expect(transaction.serialize().length).toBeLessThanOrEqual(1232)
  })
})

describe('admin instructions', () => {
  const authority = Keypair.generate().publicKey

  it('prefixes each with the discriminator the IDL declares', () => {
    const cases: [Buffer, string][] = [
      [initializeConfigInstruction(authority).data, 'initialize_config'],
      [initializeBookRootsInstruction(authority, 1).data, 'initialize_book_roots'],
      [
        loadChapterRootInstruction(authority, 1, 1, new Uint8Array(32), []).data,
        'load_chapter_root',
      ],
      [completeBookInstruction(authority, 1).data, 'complete_book'],
      [sealInstruction(authority).data, 'seal'],
    ]
    for (const [data, name] of cases) {
      expect([...data.subarray(0, 8)], name).toEqual([...instructionDiscriminator(name)])
    }
  })

  it('keeps the account order and signer/writable flags from the IDL', () => {
    const ix = loadChapterRootInstruction(authority, 1, 1, new Uint8Array(32), [])
    const idlAccounts = IDL.instructions.find((i) => i.name === 'load_chapter_root')?.accounts
    expect(ix.keys.map((k) => ({ signer: k.isSigner, writable: k.isWritable }))).toEqual([
      { signer: false, writable: false }, // config
      { signer: false, writable: true }, // book_roots
      { signer: true, writable: false }, // signer
    ])
    expect(idlAccounts?.map((a) => a.name)).toEqual(['config', 'book_roots', 'signer'])
  })

  it('round-trips the load_chapter_root arguments', () => {
    const proof = [new Uint8Array(32).fill(7), new Uint8Array(32).fill(9)]
    const { data } = loadChapterRootInstruction(
      authority,
      19,
      119,
      new Uint8Array(32).fill(3),
      proof,
    )
    expect(data.readUInt8(8)).toBe(19) // book
    expect(data.readUInt16LE(9)).toBe(119) // chapter
    expect([...data.subarray(11, 43)]).toEqual(Array(32).fill(3)) // root
    expect(data.readUInt32LE(43)).toBe(2) // proof length
  })

  it('takes no argument for initialize_config — the commitment is in the bytecode', () => {
    expect([...initializeConfigInstruction(authority).data]).toEqual([
      ...instructionDiscriminator('initialize_config'),
    ])
  })
})

describe('account decoders', () => {
  it('reads the sealed flag from a Config account', () => {
    const build = (sealed: number) =>
      Buffer.concat([
        accountDiscriminator('Config'),
        Buffer.alloc(8), // translation
        Buffer.from([66]), // books_complete
        Buffer.from([sealed]),
        Buffer.from([255]), // bump
      ])
    expect(decodeConfig(build(1)).sealed).toBe(true)
    expect(decodeConfig(build(0)).sealed).toBe(false)
    expect(decodeConfig(build(1)).booksComplete).toBe(66)
  })

  it('reads loaded chapters from a BookRoots bitmap', () => {
    const mask = Buffer.alloc(7) // Genesis: 50 chapters -> 7 mask bytes
    mask[0] = 0b0000_0101 // chapters 1 and 3 loaded
    const data = Buffer.concat([
      accountDiscriminator('BookRoots'),
      Buffer.from([1]), // book
      Buffer.from([2, 0]), // loaded = 2 (u16le)
      Buffer.from([0]), // completed = false
      Buffer.from([mask.length, 0, 0, 0]), // mask length (u32le)
      mask,
    ])
    const state = decodeBookRoots(data)
    expect(state.book).toBe(1)
    expect(state.loaded).toBe(2)
    expect(state.completed).toBe(false)
    expect(state.isChapterLoaded(1)).toBe(true)
    expect(state.isChapterLoaded(2)).toBe(false)
    expect(state.isChapterLoaded(3)).toBe(true)
    expect(state.isChapterLoaded(50)).toBe(false)
  })

  it('rejects data whose discriminator is not the expected account', () => {
    expect(() => decodeConfig(Buffer.alloc(83))).toThrow(/not a Config/)
  })
})

describe('event and account decoding', () => {
  const adopter = Keypair.generate().publicKey

  function verseRegisteredBytes(
    book: number,
    chapter: number,
    verse: number,
    createdAt: bigint,
  ): Buffer {
    const body = Buffer.alloc(1 + 2 + 2 + 32 + 8)
    let offset = 0
    body.writeUInt8(book, offset)
    offset += 1
    body.writeUInt16LE(chapter, offset)
    offset += 2
    body.writeUInt16LE(verse, offset)
    offset += 2
    adopter.toBuffer().copy(body, offset)
    offset += 32
    body.writeBigInt64LE(createdAt, offset)
    return Buffer.concat([eventDiscriminator('VerseRegistered'), body])
  }

  it('decodes a VerseRegistered event', () => {
    const event = decodeVerseRegisteredEvent(verseRegisteredBytes(1, 1, 1, 1_700_000_000n))
    expect(event.book).toBe(1)
    expect(event.chapter).toBe(1)
    expect(event.verse).toBe(1)
    expect(event.adopter.equals(adopter)).toBe(true)
    expect(event.createdAt).toBe(1_700_000_000n)
  })

  it('pulls VerseRegistered events off Program data log lines', () => {
    const line = `Program data: ${verseRegisteredBytes(17, 8, 9, 42n).toString('base64')}`
    const events = verseRegisteredEventsFromLogs(['Program log: noise', line, 'Program log: end'])
    expect(events).toHaveLength(1)
    expect(events[0]?.verse).toBe(9)
  })

  it('rejects data that is not a VerseRegistered event', () => {
    expect(() => decodeVerseRegisteredEvent(Buffer.alloc(53))).toThrow(/not a VerseRegistered/)
  })

  it('decodes a VerseAccount', () => {
    const text = 'In the beginning God created the heavens and the earth.'
    const textBytes = Buffer.from(text, 'utf8')
    const body = Buffer.alloc(32 + 8 + 1 + 2 + 2 + 4 + textBytes.length + 1)
    let offset = 0
    adopter.toBuffer().copy(body, offset)
    offset += 32
    body.writeBigInt64LE(1_700_000_000n, offset)
    offset += 8
    body.writeUInt8(1, offset)
    offset += 1
    body.writeUInt16LE(1, offset)
    offset += 2
    body.writeUInt16LE(1, offset)
    offset += 2
    body.writeUInt32LE(textBytes.length, offset)
    offset += 4
    textBytes.copy(body, offset)
    offset += textBytes.length
    body.writeUInt8(254, offset)
    const state = decodeVerseAccount(Buffer.concat([accountDiscriminator('VerseAccount'), body]))
    expect(state.adopter.equals(adopter)).toBe(true)
    expect(state.createdAt).toBe(1_700_000_000n)
    expect(state.book).toBe(1)
    expect(state.text).toBe(text)
  })
})
