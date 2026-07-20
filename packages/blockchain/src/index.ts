export { IDL, PROGRAM_ID, SEEDS, instructionDiscriminator } from './program.js'
export { bookRootsPda, configPda, versePda } from './pdas.js'
export { type VerseRegistrationProof, CatalogProver } from './proof.js'
export {
  type RegisterVerseParams,
  type RegisterVerseTransactionParams,
  encodeRegisterVerse,
  registerVerseInstruction,
  registerVerseTransaction,
} from './register.js'
