use anchor_lang::prelude::*;

use crate::constants::{BOOK_COUNT, BOOK_ROOTS_SEED, CHAPTERS_PER_BOOK, CONFIG_SEED};
use crate::error::EternalWordError;
use crate::state::{BookRoots, Config};

#[derive(Accounts)]
#[instruction(book: u8)]
pub struct CompleteBook<'info> {
    #[account(mut, seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(seeds = [BOOK_ROOTS_SEED, &[book]], bump = book_roots.bump)]
    pub book_roots: Account<'info, BookRoots>,
    pub payer: Signer<'info>,
}

/// Records that a book has every chapter root loaded.
///
/// Counted here instead of at seal time because `seal` cannot receive 66
/// accounts in one transaction. Permissionless: it only reads state that the
/// commitment already validated.
pub fn handle_complete_book(ctx: Context<CompleteBook>, book: u8) -> Result<()> {
    let book_roots = &ctx.accounts.book_roots;
    require!(!ctx.accounts.config.sealed, EternalWordError::ConfigSealed);
    require!(book_roots.book == book, EternalWordError::BookOutOfRange);
    require!(
        book_roots.loaded == CHAPTERS_PER_BOOK[(book - 1) as usize],
        EternalWordError::BookIncomplete
    );

    let config = &mut ctx.accounts.config;
    // The bitmap makes `loaded` reach the total only once per book, but the
    // counter is global state — guard it so a replay cannot inflate it.
    require!(
        config.books_complete < BOOK_COUNT,
        EternalWordError::BookAlreadyComplete
    );
    config.books_complete += 1;
    Ok(())
}

#[derive(Accounts)]
pub struct Seal<'info> {
    #[account(mut, seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(address = config.authority)]
    pub authority: Signer<'info>,
}

/// Closes the canon. Irreversible: no instruction clears `sealed`.
pub fn handle_seal(ctx: Context<Seal>) -> Result<()> {
    let config = &mut ctx.accounts.config;
    require!(!config.sealed, EternalWordError::ConfigSealed);
    require!(
        config.books_complete == BOOK_COUNT,
        EternalWordError::CanonIncomplete
    );
    config.sealed = true;
    Ok(())
}
