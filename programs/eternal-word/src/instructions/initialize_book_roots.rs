use anchor_lang::prelude::*;

use crate::constants::{BOOK_COUNT, BOOK_ROOTS_SEED, CHAPTERS_PER_BOOK, CONFIG_SEED};
use crate::error::EternalWordError;
use crate::state::{BookRoots, Config};

#[derive(Accounts)]
#[instruction(book: u8)]
pub struct InitializeBookRoots<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(
        init,
        payer = payer,
        space = BookRoots::space(book),
        seeds = [BOOK_ROOTS_SEED, &[book]],
        bump,
    )]
    pub book_roots: Account<'info, BookRoots>,
    /// Any wallet: allocating a book's roots account is permissionless. The
    /// account can only be created once (`init`) and its size is fixed by the
    /// bytecode, so an early creator only does the bootstrap's work for free.
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

/// Allocates the roots account for one book, sized from the bytecode constant.
pub fn handle_initialize_book_roots(ctx: Context<InitializeBookRoots>, book: u8) -> Result<()> {
    require!(!ctx.accounts.config.sealed, EternalWordError::ConfigSealed);
    require!(
        book >= 1 && book <= BOOK_COUNT,
        EternalWordError::BookOutOfRange
    );

    let chapters = CHAPTERS_PER_BOOK[(book - 1) as usize] as usize;
    let book_roots = &mut ctx.accounts.book_roots;
    book_roots.book = book;
    book_roots.loaded = 0;
    book_roots.completed = false;
    book_roots.loaded_mask = vec![0u8; BookRoots::mask_bytes(book)];
    book_roots.roots = vec![[0u8; 32]; chapters];
    book_roots.bump = ctx.bumps.book_roots;
    Ok(())
}
