use anchor_lang::prelude::*;

#[error_code]
pub enum EternalWordError {
    #[msg("Config is sealed; the canonical text can no longer be changed")]
    ConfigSealed,
    #[msg("Book index is outside the canon (expected 1 to 66)")]
    BookOutOfRange,
    #[msg("Chapter does not exist in this book")]
    ChapterOutOfRange,
    #[msg("Merkle proof is longer than the commitment tree allows")]
    ProofTooLong,
    #[msg("Chapter root does not belong to the committed canonical text")]
    RootNotCommitted,
    #[msg("Book roots are already complete")]
    BookAlreadyComplete,
    #[msg("Book roots are incomplete; every chapter must be loaded first")]
    BookIncomplete,
    #[msg("Not every book is complete; all 66 must be loaded before sealing")]
    CanonIncomplete,
}
