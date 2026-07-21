use anchor_lang::prelude::*;

/// PDA seeds.
///
/// Seeds are numeric on purpose: book names never appear in an address
/// (docs/conventions/UBIQUITOUS_LANGUAGE.md bans string seeds).
#[constant]
pub const CONFIG_SEED: &[u8] = b"config";
#[constant]
pub const BOOK_ROOTS_SEED: &[u8] = b"roots";
#[constant]
pub const VERSE_SEED: &[u8] = b"verse";

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

/// Longest inclusion proof inside a chapter tree: the largest chapter is
/// Psalm 119 with 176 verses, so 8 siblings. Sending more is not an attack —
/// the sender burns their own compute units — but rejecting it early keeps the
/// contract explicit and avoids pointless work.
pub const MAX_VERSE_PROOF: usize = 8;

/// Longest verse in the CanonicalText (Esther 8:9) in UTF-8 bytes. Registering
/// anything longer cannot prove into the canon, so it is rejected before the
/// account is sized.
pub const MAX_VERSE_BYTES: usize = 493;

/// Translation identifier of the frozen snapshot (eBible `engwebp`).
pub const TRANSLATION: [u8; 8] = *b"engwebp\0";

/// Merkle commitment over the 1,189 chapter roots of the frozen CanonicalText.
///
/// Hardcoded in the bytecode on purpose, not accepted as a parameter. If it
/// were a parameter, whoever called `initialize_config` first — including a
/// front-runner between deploy and the legitimate init — would choose what is
/// "canonical" and could register arbitrary text. Baking it in makes the canon
/// part of the program itself: auditable, immutable, un-forgeable. It also
/// removes any need for a privileged authority, so the whole bootstrap is
/// permissionless. Cross-checked against the catalog in `merkle_fixtures.rs`.
pub const ROOTS_COMMITMENT: [u8; 32] = [
    0xd3, 0x6e, 0x74, 0x58, 0x81, 0xff, 0x87, 0x4a, //
    0x1e, 0x87, 0x7f, 0x34, 0x7d, 0x9b, 0x8f, 0xf3, //
    0x98, 0x6a, 0x37, 0x49, 0xf0, 0x8e, 0xe1, 0xce, //
    0x1d, 0xe3, 0x01, 0xbc, 0x30, 0xe8, 0x2e, 0xfc, //
];

/// Chapters in a book, or 0 when the book is outside the canon.
///
/// Returning 0 rather than indexing blindly is what keeps callers panic-free:
/// `BookRoots::space` runs during account resolution, before any `require!`
/// can reject a bad `book`, so it must never index out of range.
pub fn chapters_in_book(book: u8) -> u16 {
    if book == 0 || book > BOOK_COUNT {
        return 0;
    }
    CHAPTERS_PER_BOOK[(book - 1) as usize]
}

/// Whether `(book, chapter)` exists in the canon.
///
/// The commitment leaf binds the address, so verification does not need the
/// leaf's index in the tree — but a reference outside the canon must still be
/// rejected before any account is touched.
pub fn chapter_exists(book: u8, chapter: u16) -> bool {
    chapter >= 1 && chapter <= chapters_in_book(book)
}
