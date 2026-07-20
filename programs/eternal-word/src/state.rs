use anchor_lang::prelude::*;

use crate::constants::CHAPTERS_PER_BOOK;

/// Global configuration. One per program, at a PDA of fixed seeds.
///
/// The fixed seeds are the whole security of the Merkle validation: if
/// `register_verse` accepted any account passed as config, an attacker would
/// supply their own with a root of their choosing and every text check would
/// become decorative (risk R3, task PG-02).
#[account]
#[derive(InitSpace)]
pub struct Config {
    /// Can create roots accounts and seal. Cannot choose what gets written:
    /// every root is checked against `roots_commitment` first.
    pub authority: Pubkey,
    /// Merkle root over the 1,189 chapter roots, in canonical order. Written
    /// once at creation and never writable again.
    pub roots_commitment: [u8; 32],
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
    /// Bitmap of loaded chapters, so a rewrite is never counted twice.
    /// One bit per chapter, `(chapter - 1)` indexed.
    pub loaded_mask: Vec<u8>,
    /// Chapter roots, `(chapter - 1)` indexed.
    pub roots: Vec<[u8; 32]>,
    pub bump: u8,
}

impl BookRoots {
    pub fn mask_bytes(book: u8) -> usize {
        let chapters = CHAPTERS_PER_BOOK[(book - 1) as usize] as usize;
        chapters.div_ceil(8)
    }

    /// Exact account size for a book — deterministic, from the bytecode
    /// constant, so nobody can over- or under-allocate.
    pub fn space(book: u8) -> usize {
        let chapters = CHAPTERS_PER_BOOK[(book - 1) as usize] as usize;
        8                                  // anchor discriminator
            + 1                            // book
            + 2                            // loaded
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
