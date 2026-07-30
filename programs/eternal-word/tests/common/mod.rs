//! Shared litesvm harness for the program's test binaries.
//!
//! Lives in `tests/common/` (not directly under `tests/`) so cargo does not
//! compile it as a test binary of its own; each test file pulls it in with
//! `mod common;`. Extracted verbatim from `program_flow.rs` when
//! `program_guards.rs` was added, so the 400-line file rule holds without
//! duplicating the harness.
#![allow(dead_code)] // each test binary compiles this module and uses a subset

use std::fs;
use std::path::PathBuf;

use anchor_lang::{AnchorSerialize, Discriminator};
use eternal_word::state::{BookRoots, Config};
use litesvm::types::TransactionMetadata;
use litesvm::LiteSVM;
use solana_account::Account;
use solana_instruction::{AccountMeta, Instruction};
use solana_keypair::Keypair;
use solana_message::Message;
use solana_pubkey::Pubkey;
use solana_sha256_hasher::hashv;
use solana_signer::Signer;
use solana_transaction::Transaction;

// ─── fixtures ───────────────────────────────────────────────────────────────

pub fn repo_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("..")
}

pub fn hex_bytes(value: &str) -> Vec<u8> {
    (0..value.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&value[i..i + 2], 16).unwrap())
        .collect()
}

pub fn hex32(value: &str) -> [u8; 32] {
    let mut out = [0u8; 32];
    out.copy_from_slice(&hex_bytes(value));
    out
}

/// Standard base64 with padding — matches what `sol_log_data` writes on the
/// `Program data:` line. Hand-rolled to keep the tests dependency-free, like
/// `hex_bytes` above.
pub fn base64(bytes: &[u8]) -> String {
    const ALPHABET: &[u8; 64] =
        b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::new();
    for chunk in bytes.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = *chunk.get(1).unwrap_or(&0) as u32;
        let b2 = *chunk.get(2).unwrap_or(&0) as u32;
        let n = (b0 << 16) | (b1 << 8) | b2;
        out.push(ALPHABET[((n >> 18) & 63) as usize] as char);
        out.push(ALPHABET[((n >> 12) & 63) as usize] as char);
        out.push(if chunk.len() > 1 {
            ALPHABET[((n >> 6) & 63) as usize] as char
        } else {
            '='
        });
        out.push(if chunk.len() > 2 {
            ALPHABET[(n & 63) as usize] as char
        } else {
            '='
        });
    }
    out
}

pub fn fixtures() -> serde_json::Value {
    let raw = fs::read_to_string(repo_root().join("data/test-fixtures.json"))
        .expect("run `pnpm catalog:fixtures` first");
    serde_json::from_str(&raw).unwrap()
}

/// A chapter sample: (root, commitment proof).
pub fn chapter_fixture(f: &serde_json::Value, book: u8, chapter: u16) -> ([u8; 32], Vec<[u8; 32]>) {
    let c = f["chapters"]
        .as_array()
        .unwrap()
        .iter()
        .find(|c| c["book"].as_u64() == Some(book as u64) && c["chapter"].as_u64() == Some(chapter as u64))
        .unwrap_or_else(|| panic!("no chapter fixture for {book}:{chapter}"));
    let root = hex32(c["root"].as_str().unwrap());
    let proof = c["proof"]
        .as_array()
        .unwrap()
        .iter()
        .map(|p| hex32(p.as_str().unwrap()))
        .collect();
    (root, proof)
}

pub fn verse_fixture(
    f: &serde_json::Value,
    book: u8,
    chapter: u16,
    verse: u16,
) -> (String, [u8; 32], Vec<[u8; 32]>) {
    let v = f["verses"]
        .as_array()
        .unwrap()
        .iter()
        .find(|v| {
            v["book"].as_u64() == Some(book as u64)
                && v["chapter"].as_u64() == Some(chapter as u64)
                && v["verse"].as_u64() == Some(verse as u64)
        })
        .unwrap_or_else(|| panic!("no verse fixture for {book}:{chapter}:{verse}"));
    let text = v["text"].as_str().unwrap().to_string();
    let chapter_root = hex32(v["chapterRoot"].as_str().unwrap());
    let proof = v["proof"]
        .as_array()
        .unwrap()
        .iter()
        .map(|p| hex32(p.as_str().unwrap()))
        .collect();
    (text, chapter_root, proof)
}

// ─── harness ────────────────────────────────────────────────────────────────

pub const CONFIG_SEED: &[u8] = b"config";
pub const ROOTS_SEED: &[u8] = b"roots";
pub const VERSE_SEED: &[u8] = b"verse";

pub fn program_id() -> Pubkey {
    Pubkey::from(eternal_word::ID.to_bytes())
}

/// Anchor instruction discriminator: sha256("global:<name>")[..8].
pub fn discriminator(name: &str) -> [u8; 8] {
    let mut out = [0u8; 8];
    out.copy_from_slice(&hashv(&[format!("global:{name}").as_bytes()]).to_bytes()[..8]);
    out
}

pub fn config_pda() -> Pubkey {
    Pubkey::find_program_address(&[CONFIG_SEED], &program_id()).0
}

pub fn book_roots_pda(book: u8) -> Pubkey {
    Pubkey::find_program_address(&[ROOTS_SEED, &[book]], &program_id()).0
}

pub fn verse_pda(book: u8, chapter: u16, verse: u16) -> Pubkey {
    Pubkey::find_program_address(
        &[VERSE_SEED, &[book], &chapter.to_le_bytes(), &verse.to_le_bytes()],
        &program_id(),
    )
    .0
}

pub struct Harness {
    pub svm: LiteSVM,
    pub authority: Keypair,
}

/// Returns `None` — a clean skip, not a failure — when the compiled program is
/// absent. These tests run the real bytecode, so they need `pnpm program:build`
/// (or `cargo build-sbf`) first; a host-only `cargo test` legitimately can't.
pub fn setup() -> Option<Harness> {
    let so = repo_root().join("target/deploy/eternal_word.so");
    if !so.exists() {
        eprintln!("skipping program execution test — {so:?} not built");
        return None;
    }
    let mut svm = LiteSVM::new();
    svm.add_program_from_file(program_id(), so).expect("load program .so");
    let authority = Keypair::new();
    svm.airdrop(&authority.pubkey(), 100_000_000_000).unwrap();
    Some(Harness { svm, authority })
}

impl Harness {
    pub fn send(&mut self, ix: Instruction, signers: &[&Keypair]) -> Result<(), String> {
        self.send_meta(ix, signers).map(|_| ())
    }

    /// Like `send`, but keeps the transaction metadata — needed to read the
    /// program logs where `emit!` writes the `VerseRegistered` event.
    pub fn send_meta(
        &mut self,
        ix: Instruction,
        signers: &[&Keypair],
    ) -> Result<TransactionMetadata, String> {
        let msg = Message::new(&[ix], Some(&signers[0].pubkey()));
        let tx = Transaction::new(signers, msg, self.svm.latest_blockhash());
        self.svm
            .send_transaction(tx)
            .map_err(|failed| format!("{:?}", failed.err))
    }

    pub fn account(&self, pda: &Pubkey) -> Option<Account> {
        self.svm.get_account(pda)
    }

    /// Writes a program-owned, rent-exempt account directly — the shortcut that
    /// lets a verse be registered without first loading and sealing all 66
    /// books through 1,255 transactions.
    pub fn write_account(&mut self, pda: Pubkey, data: Vec<u8>) {
        let lamports = self.svm.minimum_balance_for_rent_exemption(data.len());
        let account = Account {
            lamports,
            data,
            owner: program_id(),
            executable: false,
            rent_epoch: 0,
        };
        self.svm.set_account(pda, account).unwrap();
    }

    pub fn seed_config(&mut self, sealed: bool) {
        self.seed_config_counts(66, sealed);
    }

    /// Like `seed_config`, but with an explicit `books_complete` — the seal
    /// guard tests need a complete-but-unsealed canon and an incomplete one.
    pub fn seed_config_counts(&mut self, books_complete: u8, sealed: bool) {
        let (pda, bump) = Pubkey::find_program_address(&[CONFIG_SEED], &program_id());
        let config = Config {
            translation: *b"engwebp\0",
            books_complete,
            sealed,
            bump,
        };
        let mut data = Config::DISCRIMINATOR.to_vec();
        data.extend(borsh_bytes(&config));
        self.write_account(pda, data);
    }

    pub fn seed_book_roots(&mut self, book: u8, chapter: u16, root: [u8; 32]) {
        let (pda, bump) = Pubkey::find_program_address(&[ROOTS_SEED, &[book]], &program_id());
        let chapters = eternal_word::constants::chapters_in_book(book) as usize;
        let mut roots = vec![[0u8; 32]; chapters];
        roots[(chapter - 1) as usize] = root;
        let mut loaded_mask = vec![0u8; chapters.div_ceil(8)];
        let index = (chapter - 1) as usize;
        loaded_mask[index / 8] |= 1 << (index % 8);
        let book_roots = BookRoots {
            book,
            loaded: 1,
            completed: false,
            loaded_mask,
            roots,
            bump,
        };
        let mut data = BookRoots::DISCRIMINATOR.to_vec();
        data.extend(borsh_bytes(&book_roots));
        self.write_account(pda, data);
    }
}

/// anchor-lang and the split solana crates each carry a `Pubkey`; convert by
/// bytes so this compiles whether or not they resolve to the same type.
pub fn anchor_key(p: &Pubkey) -> anchor_lang::prelude::Pubkey {
    anchor_lang::prelude::Pubkey::new_from_array(p.to_bytes())
}

/// Borsh-serialize an Anchor account body (no discriminator).
pub fn borsh_bytes<T: AnchorSerialize>(value: &T) -> Vec<u8> {
    let mut buf = Vec::new();
    value.serialize(&mut buf).unwrap();
    buf
}

/// The shared ground of every `register_verse` test: a canon (sealed or not)
/// with Genesis 1:1 loaded and a funded adopter. Returns `None` — a skip — when
/// the compiled program is absent, exactly like `setup`.
pub fn register_setup(sealed: bool) -> Option<(Harness, String, Vec<[u8; 32]>, Keypair)> {
    let f = fixtures();
    let (text, root, proof) = verse_fixture(&f, 1, 1, 1);
    let mut h = setup()?;
    h.seed_config(sealed);
    h.seed_book_roots(1, 1, root);
    let adopter = Keypair::new();
    h.svm.airdrop(&adopter.pubkey(), 10_000_000_000).unwrap();
    Some((h, text, proof, adopter))
}

// ─── instruction builders ───────────────────────────────────────────────────

pub fn ix_initialize_config(payer: &Pubkey) -> Instruction {
    Instruction {
        program_id: program_id(),
        accounts: vec![
            AccountMeta::new(config_pda(), false),
            AccountMeta::new(*payer, true),
            AccountMeta::new_readonly(solana_pubkey::Pubkey::default(), false), // system program
        ],
        data: discriminator("initialize_config").to_vec(),
    }
}

pub fn ix_initialize_book_roots(authority: &Pubkey, book: u8) -> Instruction {
    let mut data = discriminator("initialize_book_roots").to_vec();
    data.push(book);
    Instruction {
        program_id: program_id(),
        accounts: vec![
            AccountMeta::new_readonly(config_pda(), false),
            AccountMeta::new(book_roots_pda(book), false),
            AccountMeta::new(*authority, true),
            AccountMeta::new_readonly(solana_pubkey::Pubkey::default(), false),
        ],
        data,
    }
}

pub fn ix_load_chapter_root(
    signer: &Pubkey,
    book: u8,
    chapter: u16,
    root: [u8; 32],
    proof: &[[u8; 32]],
) -> Instruction {
    let mut data = discriminator("load_chapter_root").to_vec();
    data.push(book);
    data.extend_from_slice(&chapter.to_le_bytes());
    data.extend_from_slice(&root);
    data.extend_from_slice(&(proof.len() as u32).to_le_bytes());
    for sibling in proof {
        data.extend_from_slice(sibling);
    }
    Instruction {
        program_id: program_id(),
        accounts: vec![
            AccountMeta::new_readonly(config_pda(), false),
            AccountMeta::new(book_roots_pda(book), false),
            AccountMeta::new_readonly(*signer, true),
        ],
        data,
    }
}

pub fn ix_complete_book(signer: &Pubkey, book: u8) -> Instruction {
    let mut data = discriminator("complete_book").to_vec();
    data.push(book);
    Instruction {
        program_id: program_id(),
        accounts: vec![
            AccountMeta::new(config_pda(), false),
            AccountMeta::new(book_roots_pda(book), false),
            AccountMeta::new_readonly(*signer, true),
        ],
        data,
    }
}

pub fn ix_seal(signer: &Pubkey) -> Instruction {
    Instruction {
        program_id: program_id(),
        accounts: vec![
            AccountMeta::new(config_pda(), false),
            AccountMeta::new_readonly(*signer, true),
        ],
        data: discriminator("seal").to_vec(),
    }
}

pub fn ix_register_verse(
    adopter: &Pubkey,
    book: u8,
    chapter: u16,
    verse: u16,
    text: &str,
    proof: &[[u8; 32]],
    config: Pubkey,
) -> Instruction {
    let mut data = discriminator("register_verse").to_vec();
    data.push(book);
    data.extend_from_slice(&chapter.to_le_bytes());
    data.extend_from_slice(&verse.to_le_bytes());
    data.extend_from_slice(&(text.len() as u32).to_le_bytes());
    data.extend_from_slice(text.as_bytes());
    data.extend_from_slice(&(proof.len() as u32).to_le_bytes());
    for sibling in proof {
        data.extend_from_slice(sibling);
    }
    Instruction {
        program_id: program_id(),
        accounts: vec![
            AccountMeta::new_readonly(config, false),
            AccountMeta::new_readonly(book_roots_pda(book), false),
            AccountMeta::new(verse_pda(book, chapter, verse), false),
            AccountMeta::new(*adopter, true),
            AccountMeta::new_readonly(Pubkey::default(), false),
        ],
        data,
    }
}
