use anchor_lang::prelude::*;

use crate::constants::{CONFIG_SEED, TRANSLATION};
use crate::state::Config;

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + Config::INIT_SPACE,
        seeds = [CONFIG_SEED],
        bump,
    )]
    pub config: Account<'info, Config>,
    /// Any wallet: creating the config is permissionless. The commitment it
    /// validates against is the `ROOTS_COMMITMENT` constant, so whoever creates
    /// it — including a front-runner — installs the same, real canon.
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

/// Creates the singleton config. There is no commitment parameter: the canon's
/// commitment lives in the bytecode (`ROOTS_COMMITMENT`), so no caller can
/// choose it. `init` also means a second call fails — the account exists.
pub fn handle_initialize_config(ctx: Context<InitializeConfig>) -> Result<()> {
    let config = &mut ctx.accounts.config;
    config.translation = TRANSLATION;
    config.books_complete = 0;
    config.sealed = false;
    config.bump = ctx.bumps.config;
    Ok(())
}
