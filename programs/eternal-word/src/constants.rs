use anchor_lang::prelude::*;

/// PDA seeds.
///
/// Seeds are numeric on purpose: book names never appear in an address
/// (docs/conventions/UBIQUITOUS_LANGUAGE.md bans string seeds).
#[constant]
pub const CONFIG_SEED: &[u8] = b"config";
#[constant]
pub const BOOK_ROOTS_SEED: &[u8] = b"roots";

/// Books in the protestant canon.
pub const BOOK_COUNT: u8 = 66;

/// Chapters in each book, indexed by `book - 1`.
///
/// Fixed by the frozen CanonicalText snapshot, so it can live in the bytecode:
/// it makes every roots account size deterministic and verifiable by anyone
/// reading the program, instead of trusting whoever initializes it.
/// Sums to 1,189. Cross-checked against the catalog in tests.
pub const CHAPTERS_PER_BOOK: [u16; 66] = [
    50, 40, 27, 36, 34, 24, 21, 4, 31, 24, 22, //
    25, 29, 36, 10, 13, 10, 42, 150, 31, 12, 8, //
    66, 52, 5, 48, 12, 14, 3, 9, 1, 4, 7, //
    3, 3, 3, 2, 14, 4, 28, 16, 24, 21, 28, //
    16, 16, 13, 6, 6, 4, 4, 5, 3, 6, 4, //
    3, 1, 13, 5, 5, 3, 5, 1, 1, 1, 22, //
];

/// Total chapters — the leaf count of the tree the commitment covers.
pub const TOTAL_CHAPTERS: u16 = 1189;

/// Longest inclusion proof in the commitment tree: ceil(log2(1189)).
/// A proof may be shorter when a node was promoted, never longer.
pub const MAX_COMMITMENT_PROOF: usize = 11;

/// Translation identifier of the frozen snapshot (eBible `engwebp`).
pub const TRANSLATION: [u8; 8] = *b"engwebp\0";

/// Whether `(book, chapter)` exists in the canon.
///
/// The commitment leaf binds the address, so verification does not need the
/// leaf's index in the tree — but a reference outside the canon must still be
/// rejected before any account is touched.
pub fn chapter_exists(book: u8, chapter: u16) -> bool {
    if book == 0 || book > BOOK_COUNT || chapter == 0 {
        return false;
    }
    chapter <= CHAPTERS_PER_BOOK[(book - 1) as usize]
}
