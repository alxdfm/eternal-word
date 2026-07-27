import { type CatalogProver, registerVerseTransaction } from '@eternal-word/blockchain'
import type { VerseAddress } from '@eternal-word/domain'
import type { Connection, Keypair, VersionedTransaction } from '@solana/web3.js'

// Helpers compartilhados pelos scripts que registram versículos em devnet
// (smoke-devnet, load-indexer). Ficam aqui para a montagem da transação existir
// num lugar só — não duplicada em cada script.

/** Lê o valor de uma flag `--x valor` do argv. */
export function argAt(argv: readonly string[], flag: string): string | undefined {
  const i = argv.indexOf(flag)
  return i >= 0 ? argv[i + 1] : undefined
}

/**
 * Monta e assina a transação de `register_verse` de um versículo: pega a
 * proof/texto do Catálogo, um blockhash fresco e anexa o ComputeBudget. O caller
 * decide quando enviar e confirmar (o smoke mede, o load test faz PENDING no
 * meio), então isto para na tx assinada. Devolve também o `text` e o tamanho na
 * rede, que os callers logam.
 */
export async function buildRegisterTx(
  connection: Connection,
  wallet: Keypair,
  prover: CatalogProver,
  address: VerseAddress,
): Promise<{ transaction: VersionedTransaction; text: string; wireBytes: number }> {
  const { text, proof } = prover.proofFor(address)
  const { blockhash } = await connection.getLatestBlockhash()
  const transaction = registerVerseTransaction({
    adopter: wallet.publicKey,
    address,
    text,
    proof,
    recentBlockhash: blockhash,
    computeUnitLimit: 400_000,
    priorityFeeMicroLamports: 1000,
  })
  transaction.sign([wallet])
  return { transaction, text, wireBytes: transaction.serialize().length }
}
