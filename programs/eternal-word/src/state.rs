use anchor_lang::prelude::*;

use crate::constants::chapters_in_book;

/// Global configuration. One per program, at a PDA of fixed seeds.
///
/// Holds no commitment and no authority: the commitment is the
/// `ROOTS_COMMITMENT` constant in the bytecode, and every bootstrap
/// instruction is permissionless. This account only tracks progress —
/// how many books are loaded and whether the canon is sealed. Its fixed seeds
/// still matter: `register_verse` reads `sealed` from it, so accepting an
/// arbitrary account here would let someone fake a sealed canon.
#[account]
#[derive(InitSpace)]
pub struct Config {
    /// Translation identifier of the frozen snapshot.
    pub translation: [u8; 8],
    /// Books whose roots are fully loaded. Sealing requires all 66.
    pub books_complete: u8,
    /// Once true, no instruction writes to config or roots ever again.
    pub sealed: bool,
    pub bump: u8,
}

/// Chapter roots of a single book, at a PDA seeded by the book index.
///
/// Sharded per book because all 1,189 roots in one account would be 38,048
/// bytes — over the 10,240-byte limit the runtime allows an account to grow
/// per instruction. The largest book (Psalms, 150 chapters) needs 4,800 bytes
/// and fits in a single creation, so no account here ever needs realloc.
#[account]
pub struct BookRoots {
    pub book: u8,
    /// How many roots are filled. Complete when it equals the book's chapters.
    pub loaded: u16,
    /// Set once by `complete_book`. Without it, calling `complete_book` twice
    /// for the same book would increment `Config::books_complete` twice, and a
    /// single loaded book completed 66 times would let `seal` close an
    /// incomplete canon — permanently. This flag makes completion idempotent.
    pub completed: bool,
    /// Bitmap of loaded chapters, so a rewrite is never counted twice.
    /// One bit per chapter, `(chapter - 1)` indexed.
    pub loaded_mask: Vec<u8>,
    /// Chapter roots, `(chapter - 1)` indexed.
    pub roots: Vec<[u8; 32]>,
    pub bump: u8,
}

impl BookRoots {
    pub fn mask_bytes(book: u8) -> usize {
        (chapters_in_book(book) as usize).div_ceil(8)
    }

    /// Exact account size for a book — deterministic, from the bytecode
    /// constant, so nobody can over- or under-allocate.
    ///
    /// Runs during account resolution, before the handler can validate `book`.
    /// An out-of-range book yields a tiny account here; the handler then
    /// rejects it with `BookOutOfRange` and the whole transaction reverts, so
    /// nothing is created — but this must not panic to get there.
    pub fn space(book: u8) -> usize {
        let chapters = chapters_in_book(book) as usize;
        8                                  // anchor discriminator
            + 1                            // book
            + 2                            // loaded
            + 1                            // completed
            + 4 + Self::mask_bytes(book)   // loaded_mask (vec len + bytes)
            + 4 + chapters * 32            // roots (vec len + entries)
            + 1 // bump
    }

    pub fn is_loaded(&self, chapter: u16) -> bool {
        let index = (chapter - 1) as usize;
        match self.loaded_mask.get(index / 8) {
            Some(byte) => byte & (1 << (index % 8)) != 0,
            None => false,
        }
    }

    pub fn mark_loaded(&mut self, chapter: u16) {
        let index = (chapter - 1) as usize;
        if let Some(byte) = self.loaded_mask.get_mut(index / 8) {
            *byte |= 1 << (index % 8);
        }
    }
}

/// A registered verse. One account per verse, created once and never written
/// again — the existence of the account *is* the registration.
///
/// There is no `update` and no `close` instruction for this account anywhere
/// in the program. That is the whole guarantee: permanence comes from the
/// absence of a write path, not from a flag.
#[account]
pub struct VerseAccount {
    /// Wallet that paid for and registered this verse. Never named `owner`:
    /// on Solana that word already means the program that owns the account
    /// (docs/conventions/UBIQUITOUS_LANGUAGE.md).
    pub adopter: Pubkey,
    /// Unix timestamp of the registering slot.
    pub created_at: i64,
    pub book: u8,
    pub chapter: u16,
    pub verse: u16,
    /// The canonical text itself. On-chain by design — the premise of the
    /// product is that the text lives on the chain, not a pointer to it.
    pub text: String,
    pub bump: u8,
}

impl VerseAccount {
    /// Exact size for a verse of `text_len` UTF-8 bytes. Every term is named;
    /// no magic number.
    pub fn space(text_len: usize) -> usize {
        const DISCRIMINATOR: usize = 8;
        const ADOPTER: usize = 32;
        const CREATED_AT: usize = 8;
        const BOOK: usize = 1;
        const CHAPTER: usize = 2;
        const VERSE: usize = 2;
        const STRING_PREFIX: usize = 4;
        const BUMP: usize = 1;

        DISCRIMINATOR
            + ADOPTER
            + CREATED_AT
            + BOOK
            + CHAPTER
            + VERSE
            + STRING_PREFIX
            + text_len
            + BUMP
    }
}
