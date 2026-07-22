use anchor_lang::prelude::*;

use crate::constants::{
    chapter_exists, BOOK_ROOTS_SEED, CONFIG_SEED, MAX_VERSE_BYTES, MAX_VERSE_PROOF, VERSE_SEED,
};
use crate::error::EternalWordError;
use crate::merkle::{hash_leaf, verify_proof};
use crate::state::{BookRoots, Config, VerseAccount};

#[derive(Accounts)]
#[instruction(book: u8, chapter: u16, verse: u16, text: String)]
pub struct RegisterVerse<'info> {
    /// Read only to gate registration on `sealed`: a verse cannot be adopted
    /// until the canon is declared final. The Merkle check itself does not
    /// need config — the chapter root is validated against the commitment when
    /// it is loaded, and `book_roots` is bound by its own PDA seeds — but
    /// opening registration against a half-loaded canon would let someone
    /// permanently adopt a verse before the text set is complete.
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,

    #[account(
        seeds = [BOOK_ROOTS_SEED, &[book]],
        bump = book_roots.bump,
    )]
    pub book_roots: Account<'info, BookRoots>,

    /// Numeric seeds, never book names. `init` is what makes a second
    /// registration of the same verse impossible: the address already exists.
    #[account(
        init,
        payer = adopter,
        space = VerseAccount::space(text.len()),
        seeds = [
            VERSE_SEED,
            &[book],
            &chapter.to_le_bytes(),
            &verse.to_le_bytes(),
        ],
        bump,
    )]
    pub verse_account: Account<'info, VerseAccount>,

    #[account(mut)]
    pub adopter: Signer<'info>,
    pub system_program: Program<'info, System>,
}

/// Leaf of a chapter tree, mirroring `encodeVerseLeaf` in
/// packages/catalog/src/canonical-merkle.ts:
///
///   book u8 | chapter u16le | verse u16le | text_len u32le | text utf8
///
/// Every field is fixed-width or length-prefixed, so no two different verses
/// can encode to the same bytes.
fn verse_leaf(book: u8, chapter: u16, verse: u16, text: &str) -> [u8; 32] {
    let bytes = text.as_bytes();
    let mut payload = Vec::with_capacity(9 + bytes.len());
    payload.push(book);
    payload.extend_from_slice(&chapter.to_le_bytes());
    payload.extend_from_slice(&verse.to_le_bytes());
    payload.extend_from_slice(&(bytes.len() as u32).to_le_bytes());
    payload.extend_from_slice(bytes);
    hash_leaf(&payload)
}

/// Emitted on every successful registration so the indexer can record it in
/// real time without re-reading the account. Carries only what the program
/// knows at registration; the indexer enriches it with the transaction
/// signature and the confirmation slot to build the domain event
/// (docs/conventions/UBIQUITOUS_LANGUAGE.md → VerseRegistered).
#[event]
pub struct VerseRegistered {
    pub book: u8,
    pub chapter: u16,
    pub verse: u16,
    pub adopter: Pubkey,
    pub created_at: i64,
}

/// Registers a verse: proves the text against the canon, then creates the
/// account that holds it forever.
///
/// The five positions the WEB leaves empty (Lk 17:36, Acts 8:37, Acts 15:34,
/// Acts 24:7, Rom 16:25) need no special case — they have no leaf in any
/// chapter tree, so no proof can verify and registration simply fails.
pub fn handle_register_verse(
    ctx: Context<RegisterVerse>,
    book: u8,
    chapter: u16,
    verse: u16,
    text: String,
    proof: Vec<[u8; 32]>,
) -> Result<()> {
    require!(
        ctx.accounts.config.sealed,
        EternalWordError::CanonNotSealed
    );
    require!(!text.is_empty(), EternalWordError::TextEmpty);
    require!(
        text.len() <= MAX_VERSE_BYTES,
        EternalWordError::TextTooLong
    );
    require!(
        proof.len() <= MAX_VERSE_PROOF,
        EternalWordError::ProofTooLong
    );
    require!(
        chapter_exists(book, chapter),
        EternalWordError::ChapterOutOfRange
    );

    let book_roots = &ctx.accounts.book_roots;
    require!(
        book_roots.is_loaded(chapter),
        EternalWordError::ChapterRootMissing
    );
    let root = book_roots.roots[(chapter - 1) as usize];

    require!(
        verify_proof(verse_leaf(book, chapter, verse, &text), &proof, &root),
        EternalWordError::VerseNotCanonical
    );

    let adopter = ctx.accounts.adopter.key();
    let created_at = Clock::get()?.unix_timestamp;

    let verse_account = &mut ctx.accounts.verse_account;
    verse_account.adopter = adopter;
    verse_account.created_at = created_at;
    verse_account.book = book;
    verse_account.chapter = chapter;
    verse_account.verse = verse;
    verse_account.text = text;
    verse_account.bump = ctx.bumps.verse_account;

    // The indexer's real-time layer keys off this — see the ADR
    // 2026-07-21_evento-onchain-no-register-verse. A log, not part of the
    // transaction, so it costs nothing against the size budget.
    emit!(VerseRegistered {
        book,
        chapter,
        verse,
        adopter,
        created_at,
    });
    Ok(())
}
