use anchor_lang::prelude::*;

use crate::constants::{chapter_exists, BOOK_ROOTS_SEED, CONFIG_SEED, MAX_COMMITMENT_PROOF};
use crate::error::EternalWordError;
use crate::merkle::{hash_leaf, verify_proof};
use crate::state::{BookRoots, Config};

#[derive(Accounts)]
#[instruction(book: u8)]
pub struct LoadChapterRoot<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(
        mut,
        seeds = [BOOK_ROOTS_SEED, &[book]],
        bump = book_roots.bump,
    )]
    pub book_roots: Account<'info, BookRoots>,
    /// Any signer: loading is permissionless and pays no rent (the account
    /// already exists). Not named `payer` because nothing is paid here.
    pub signer: Signer<'info>,
}

/// Commitment leaf: the chapter's address bound to its root.
///
///   book u8 | chapter u16le | root 32
///
/// Mirrors `encodeChapterRootLeaf` in packages/catalog/src/canonical-merkle.ts.
/// The address has to be in the leaf: pairs are hashed sorted and proofs carry
/// no direction bits, so a proof over a bare root would only prove the root is
/// *somewhere* in the tree. Without this, a real root could be written into
/// another chapter's slot — unforgeable text, but that chapter would be
/// permanently unregistrable in a program with no update path.
fn commitment_leaf(book: u8, chapter: u16, root: &[u8; 32]) -> [u8; 32] {
    let mut payload = [0u8; 35];
    payload[0] = book;
    payload[1..3].copy_from_slice(&chapter.to_le_bytes());
    payload[3..].copy_from_slice(root);
    hash_leaf(&payload)
}

/// Writes one chapter root, but only if it proves into the committed tree at
/// exactly this address.
///
/// This is why the authority is not a trusted party: it chooses *when* to
/// load, never *what*. A forged root fails against the commitment fixed at
/// config creation, so there is no window — not even before sealing — for a
/// wrong canonical text. Loading is therefore permissionless: anyone can
/// advance it, nobody can corrupt it.
pub fn handle_load_chapter_root(
    ctx: Context<LoadChapterRoot>,
    book: u8,
    chapter: u16,
    root: [u8; 32],
    proof: Vec<[u8; 32]>,
) -> Result<()> {
    let config = &ctx.accounts.config;
    require!(!config.sealed, EternalWordError::ConfigSealed);
    require!(
        proof.len() <= MAX_COMMITMENT_PROOF,
        EternalWordError::ProofTooLong
    );
    require!(
        chapter_exists(book, chapter),
        EternalWordError::ChapterOutOfRange
    );

    let leaf = commitment_leaf(book, chapter, &root);
    require!(
        verify_proof(leaf, &proof, &config.roots_commitment),
        EternalWordError::RootNotCommitted
    );

    let book_roots = &mut ctx.accounts.book_roots;

    // Idempotent: the proof already fixed the only value this slot can hold,
    // so a repeat write changes nothing. Guarding the counter keeps `loaded`
    // honest when someone replays the same instruction.
    if !book_roots.is_loaded(chapter) {
        book_roots.mark_loaded(chapter);
        book_roots.loaded += 1;
    }
    book_roots.roots[(chapter - 1) as usize] = root;
    Ok(())
}
