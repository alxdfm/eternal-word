use anchor_lang::prelude::*;

use crate::constants::{CONFIG_SEED, TRANSLATION};
use crate::state::Config;

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + Config::INIT_SPACE,
        seeds = [CONFIG_SEED],
        bump,
    )]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

/// Creates the config with the commitment already inside it.
///
/// The commitment arrives at creation and there is no instruction that writes
/// it again — that is what makes every later root write checkable rather than
/// trusted. `init` also means a second call fails: the account already exists.
pub fn handle_initialize_config(ctx: Context<InitializeConfig>, roots_commitment: [u8; 32]) -> Result<()> {
    let config = &mut ctx.accounts.config;
    config.authority = ctx.accounts.authority.key();
    config.roots_commitment = roots_commitment;
    config.translation = TRANSLATION;
    config.books_complete = 0;
    config.sealed = false;
    config.bump = ctx.bumps.config;
    Ok(())
}
