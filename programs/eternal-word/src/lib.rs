pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use instructions::*;

declare_id!("9up3jAXPTgkJz9UvMLwEiUUSVdPd6E1KshwfxT3dZCdG");

#[program]
pub mod eternal_word {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        initialize::handler(ctx)
    }
}
