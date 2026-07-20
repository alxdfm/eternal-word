pub mod constants;
pub mod error;
pub mod instructions;
pub mod merkle;
pub mod state;

use anchor_lang::prelude::*;

pub use instructions::*;

declare_id!("9up3jAXPTgkJz9UvMLwEiUUSVdPd6E1KshwfxT3dZCdG");

/// Eternal Word — permanent, collaborative registry of the Bible on Solana.
///
/// There is deliberately no `update` and no `close` instruction anywhere in
/// this program: immutability comes from no write path existing, not from a
/// flag someone has to respect.
///
/// Handlers are called by full path (`instructions::x::handler`) because the
/// instruction name and its module name collide otherwise — `seal` is both.
#[program]
pub mod eternal_word {
    use super::*;

    /// Creates the config with the commitment over the canonical chapter roots.
    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        roots_commitment: [u8; 32],
    ) -> Result<()> {
        handle_initialize_config(ctx, roots_commitment)
    }

    /// Allocates the roots account of one book, sized from a bytecode constant.
    pub fn initialize_book_roots(ctx: Context<InitializeBookRoots>, book: u8) -> Result<()> {
        handle_initialize_book_roots(ctx, book)
    }

    /// Stores one chapter root, only if it proves into the commitment.
    pub fn load_chapter_root(
        ctx: Context<LoadChapterRoot>,
        book: u8,
        chapter: u16,
        root: [u8; 32],
        proof: Vec<[u8; 32]>,
    ) -> Result<()> {
        handle_load_chapter_root(ctx, book, chapter, root, proof)
    }

    /// Registers a verse, proving its text against the canonical Merkle root.
    pub fn register_verse(
        ctx: Context<RegisterVerse>,
        book: u8,
        chapter: u16,
        verse: u16,
        text: String,
        proof: Vec<[u8; 32]>,
    ) -> Result<()> {
        handle_register_verse(ctx, book, chapter, verse, text, proof)
    }

    /// Marks a book as fully loaded.
    pub fn complete_book(ctx: Context<CompleteBook>, book: u8) -> Result<()> {
        handle_complete_book(ctx, book)
    }

    /// Closes the canon for good.
    pub fn seal(ctx: Context<Seal>) -> Result<()> {
        handle_seal(ctx)
    }
}
