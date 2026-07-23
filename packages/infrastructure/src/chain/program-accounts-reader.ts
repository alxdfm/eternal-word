import type { ChainReader, VerseRegistered } from '@eternal-word/application'
import { PROGRAM_ID, accountDiscriminator, decodeVerseAccount } from '@eternal-word/blockchain'
import type { Connection } from '@solana/web3.js'

const VERSE_ACCOUNT_DISCRIMINATOR = accountDiscriminator('VerseAccount')

/**
 * Camada 3: the full set of on-chain VerseAccounts, for reconciliation only —
 * never the primary sync path (guardrail in STACK.md). `getProgramAccounts`
 * returns every account the program owns; VerseAccounts are filtered by their
 * discriminator. The registering signature is not available here, so events are
 * emitted with `transaction: null` and the repository keeps any stored one.
 */
export function createProgramAccountsReader(connection: Connection): ChainReader {
  return {
    async listRegistrations() {
      const accounts = await connection.getProgramAccounts(PROGRAM_ID, { commitment: 'confirmed' })
      const slot = BigInt(await connection.getSlot('confirmed'))
      const registrations: VerseRegistered[] = []
      for (const { pubkey, account } of accounts) {
        const data = account.data
        if (data.length < 8 || !data.subarray(0, 8).equals(VERSE_ACCOUNT_DISCRIMINATOR)) continue
        const decoded = decodeVerseAccount(data)
        registrations.push({
          address: { book: decoded.book, chapter: decoded.chapter, verse: decoded.verse },
          adopter: decoded.adopter.toBase58(),
          account: pubkey.toBase58(),
          transaction: null,
          slot,
          registeredAt: new Date(Number(decoded.createdAt) * 1000),
        })
      }
      return registrations
    },
  }
}
