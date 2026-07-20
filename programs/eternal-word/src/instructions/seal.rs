use anchor_lang::prelude::*;

use crate::constants::{chapters_in_book, BOOK_COUNT, BOOK_ROOTS_SEED, CONFIG_SEED};
use crate::error::EternalWordError;
use crate::state::{BookRoots, Config};

#[derive(Accounts)]
#[instruction(book: u8)]
pub struct CompleteBook<'info> {
    #[account(mut, seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [BOOK_ROOTS_SEED, &[book]], bump = book_roots.bump)]
    pub book_roots: Account<'info, BookRoots>,
    /// Any signer: completing a book only reads commitment-validated state.
    pub signer: Signer<'info>,
}

/// Records that a book has every chapter root loaded.
///
/// Counted here instead of at seal time because `seal` cannot receive 66
/// accounts in one transaction. Permissionless: it only reads state that the
/// commitment already validated.
pub fn handle_complete_book(ctx: Context<CompleteBook>, book: u8) -> Result<()> {
    let book_roots = &mut ctx.accounts.book_roots;
    require!(!ctx.accounts.config.sealed, EternalWordError::ConfigSealed);
    require!(book_roots.book == book, EternalWordError::BookOutOfRange);
    require!(
        book_roots.loaded == chapters_in_book(book),
        EternalWordError::BookIncomplete
    );
    // The per-book flag is what makes this idempotent: a second call for the
    // same book fails here instead of counting it twice. Without it, one book
    // completed 66 times would let `seal` close an incomplete canon.
    require!(
        !book_roots.completed,
        EternalWordError::BookAlreadyComplete
    );
    book_roots.completed = true;

    let config = &mut ctx.accounts.config;
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
