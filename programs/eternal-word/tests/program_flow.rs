//! Executes the real bytecode in litesvm — the piece the Merkle-only tests
//! cannot reach. Here the program actually runs: PDAs are created, `init`
//! rejects a second registration, a forged config is refused, the `sealed`
//! gate holds.
//!
//! Devnet (PG-08) proves the chain agrees; this proves the logic, offline and
//! in milliseconds. Needs `pnpm program:build` for target/deploy/*.so and
//! `pnpm catalog:fixtures` for the proofs.

use std::fs;
use std::path::PathBuf;

use anchor_lang::{AnchorDeserialize, AnchorSerialize, Discriminator};
use eternal_word::state::{BookRoots, Config, VerseAccount};
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

fn repo_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("..")
}

fn hex_bytes(value: &str) -> Vec<u8> {
    (0..value.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&value[i..i + 2], 16).unwrap())
        .collect()
}

fn hex32(value: &str) -> [u8; 32] {
    let mut out = [0u8; 32];
    out.copy_from_slice(&hex_bytes(value));
    out
}

fn fixtures() -> serde_json::Value {
    let raw = fs::read_to_string(repo_root().join("data/test-fixtures.json"))
        .expect("run `pnpm catalog:fixtures` first");
    serde_json::from_str(&raw).unwrap()
}

/// A chapter sample: (root, commitment proof).
fn chapter_fixture(f: &serde_json::Value, book: u8, chapter: u16) -> ([u8; 32], Vec<[u8; 32]>) {
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

// ─── harness ────────────────────────────────────────────────────────────────

const CONFIG_SEED: &[u8] = b"config";
const ROOTS_SEED: &[u8] = b"roots";
const VERSE_SEED: &[u8] = b"verse";

fn program_id() -> Pubkey {
    Pubkey::from(eternal_word::ID.to_bytes())
}

/// Anchor instruction discriminator: sha256("global:<name>")[..8].
fn discriminator(name: &str) -> [u8; 8] {
    let mut out = [0u8; 8];
    out.copy_from_slice(&hashv(&[format!("global:{name}").as_bytes()]).to_bytes()[..8]);
    out
}

fn config_pda() -> Pubkey {
    Pubkey::find_program_address(&[CONFIG_SEED], &program_id()).0
}

fn book_roots_pda(book: u8) -> Pubkey {
    Pubkey::find_program_address(&[ROOTS_SEED, &[book]], &program_id()).0
}

struct Harness {
    svm: LiteSVM,
    authority: Keypair,
}

/// Returns `None` — a clean skip, not a failure — when the compiled program is
/// absent. These tests run the real bytecode, so they need `pnpm program:build`
/// (or `cargo build-sbf`) first; a host-only `cargo test` legitimately can't.
fn setup() -> Option<Harness> {
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
    fn send(&mut self, ix: Instruction, signers: &[&Keypair]) -> Result<(), String> {
        let msg = Message::new(&[ix], Some(&signers[0].pubkey()));
        let tx = Transaction::new(signers, msg, self.svm.latest_blockhash());
        self.svm
            .send_transaction(tx)
            .map(|_| ())
            .map_err(|failed| format!("{:?}", failed.err))
    }

    fn account(&self, pda: &Pubkey) -> Option<Account> {
        self.svm.get_account(pda)
    }

    /// Writes a program-owned, rent-exempt account directly — the shortcut that
    /// lets a verse be registered without first loading and sealing all 66
    /// books through 1,255 transactions.
    fn write_account(&mut self, pda: Pubkey, data: Vec<u8>) {
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

    fn seed_config(&mut self, sealed: bool) {
        let (pda, bump) = Pubkey::find_program_address(&[CONFIG_SEED], &program_id());
        let config = Config {
            authority: anchor_key(&self.authority.pubkey()),
            roots_commitment: [0u8; 32],
            translation: *b"engwebp\0",
            books_complete: 66,
            sealed,
            bump,
        };
        let mut data = Config::DISCRIMINATOR.to_vec();
        data.extend(borsh_bytes(&config));
        self.write_account(pda, data);
    }

    fn seed_book_roots(&mut self, book: u8, chapter: u16, root: [u8; 32]) {
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
fn anchor_key(p: &Pubkey) -> anchor_lang::prelude::Pubkey {
    anchor_lang::prelude::Pubkey::new_from_array(p.to_bytes())
}

/// Borsh-serialize an Anchor account body (no discriminator).
fn borsh_bytes<T: AnchorSerialize>(value: &T) -> Vec<u8> {
    let mut buf = Vec::new();
    value.serialize(&mut buf).unwrap();
    buf
}

fn verse_pda(book: u8, chapter: u16, verse: u16) -> Pubkey {
    Pubkey::find_program_address(
        &[VERSE_SEED, &[book], &chapter.to_le_bytes(), &verse.to_le_bytes()],
        &program_id(),
    )
    .0
}

fn verse_fixture(f: &serde_json::Value, book: u8, chapter: u16, verse: u16) -> (String, [u8; 32], Vec<[u8; 32]>) {
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

fn ix_register_verse(
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

/// Completing a book twice must not count it twice. A retry — which the launch
/// runbook will do — has to fail cleanly, not inflate `books_complete` toward
/// an early, permanent seal of an incomplete canon.
#[test]
fn completing_a_book_twice_fails() {
    let f = fixtures();
    let commitment = hex32(f["rootsCommitment"].as_str().unwrap());
    let (root, proof) = chapter_fixture(&f, 31, 1);

    let Some(mut h) = setup() else { return };
    let auth = h.authority.insecure_clone();
    h.send(ix_initialize_config(&auth.pubkey(), commitment), &[&auth]).unwrap();
    h.send(ix_initialize_book_roots(&auth.pubkey(), 31), &[&auth]).unwrap();
    h.send(ix_load_chapter_root(&auth.pubkey(), 31, 1, root, &proof), &[&auth]).unwrap();
    h.send(ix_complete_book(&auth.pubkey(), 31), &[&auth]).expect("first completion");

    // A distinct signer keeps the retry from deduping as AlreadyProcessed;
    // completion is permissionless, so any signer reaches the same guard.
    let retry = Keypair::new();
    h.svm.airdrop(&retry.pubkey(), 10_000_000_000).unwrap();
    let err = h
        .send(ix_complete_book(&retry.pubkey(), 31), &[&retry])
        .expect_err("a second completion of the same book must fail");
    // BookAlreadyComplete is error index 5 → 6005.
    assert!(err.contains("Custom(6005)"), "expected BookAlreadyComplete, got {err}");
}

// ─── tests: register_verse, running the real bytecode ───────────────────────

/// The happy path: a sealed canon, a loaded chapter, a valid proof — the verse
/// account is created and every field is what was sent.
#[test]
fn registers_a_verse_and_stores_the_right_fields() {
    let f = fixtures();
    let (text, root, proof) = verse_fixture(&f, 1, 1, 1);

    let Some(mut h) = setup() else { return };
    h.seed_config(true);
    h.seed_book_roots(1, 1, root);

    // litesvm's clock starts at 0; set a known timestamp so the assertion below
    // proves the program actually stores Clock::get().unix_timestamp.
    let mut clock: solana_clock::Clock = h.svm.get_sysvar();
    clock.unix_timestamp = 1_700_000_000;
    h.svm.set_sysvar(&clock);

    let adopter = Keypair::new();
    h.svm.airdrop(&adopter.pubkey(), 10_000_000_000).unwrap();

    h.send(
        ix_register_verse(&adopter.pubkey(), 1, 1, 1, &text, &proof, config_pda()),
        &[&adopter],
    )
    .expect("register_verse happy path");

    let raw = h.account(&verse_pda(1, 1, 1)).expect("verse account created");
    let stored = VerseAccount::try_from_slice(&raw.data[8..]).expect("deserialize VerseAccount");
    assert_eq!(stored.book, 1);
    assert_eq!(stored.chapter, 1);
    assert_eq!(stored.verse, 1);
    assert_eq!(stored.text, text);
    assert_eq!(stored.adopter, anchor_key(&adopter.pubkey()));
    assert_eq!(stored.created_at, 1_700_000_000);
}

/// The core permanence guarantee: the same verse cannot be registered twice.
/// This is the whole reason there is no `close` — `init` refuses the address.
#[test]
fn registering_the_same_verse_twice_fails() {
    let f = fixtures();
    let (text, root, proof) = verse_fixture(&f, 1, 1, 1);

    let Some(mut h) = setup() else { return };
    h.seed_config(true);
    h.seed_book_roots(1, 1, root);

    let adopter = Keypair::new();
    h.svm.airdrop(&adopter.pubkey(), 10_000_000_000).unwrap();

    h.send(
        ix_register_verse(&adopter.pubkey(), 1, 1, 1, &text, &proof, config_pda()),
        &[&adopter],
    )
    .expect("first registration");

    // A different wallet tries to claim the same verse. A second adopter keeps
    // the transaction distinct (identical ones dedupe as AlreadyProcessed
    // before executing) and mirrors the real race: two people, one verse.
    let rival = Keypair::new();
    h.svm.airdrop(&rival.pubkey(), 10_000_000_000).unwrap();
    h.send(
        ix_register_verse(&rival.pubkey(), 1, 1, 1, &text, &proof, config_pda()),
        &[&rival],
    )
    .expect_err("second registration of the same verse must fail");

    // Stronger than matching an error code: the account still belongs to the
    // first adopter. `init` refused to recreate the address, and nothing
    // overwrote the original registration.
    let raw = h.account(&verse_pda(1, 1, 1)).expect("verse account still exists");
    let stored = VerseAccount::try_from_slice(&raw.data[8..]).unwrap();
    assert_eq!(
        stored.adopter,
        anchor_key(&adopter.pubkey()),
        "the first adopter must keep the verse"
    );
    assert_ne!(stored.adopter, anchor_key(&rival.pubkey()));
}

/// Registration must not open before the canon is sealed.
#[test]
fn registration_is_closed_until_the_canon_is_sealed() {
    let f = fixtures();
    let (text, root, proof) = verse_fixture(&f, 1, 1, 1);

    let Some(mut h) = setup() else { return };
    h.seed_config(false); // canon not sealed
    h.seed_book_roots(1, 1, root);

    let adopter = Keypair::new();
    h.svm.airdrop(&adopter.pubkey(), 10_000_000_000).unwrap();

    let err = h
        .send(
            ix_register_verse(&adopter.pubkey(), 1, 1, 1, &text, &proof, config_pda()),
            &[&adopter],
        )
        .expect_err("registration before seal must fail");
    // CanonNotSealed is error index 12 → 6012.
    assert!(err.contains("Custom(6012)"), "expected CanonNotSealed, got {err}");
}

/// Right address, altered text — the vandalism case the Merkle check exists for,
/// now proven against the running program.
#[test]
fn registering_tampered_text_fails() {
    let f = fixtures();
    let (text, root, proof) = verse_fixture(&f, 1, 1, 1);

    let Some(mut h) = setup() else { return };
    h.seed_config(true);
    h.seed_book_roots(1, 1, root);

    let adopter = Keypair::new();
    h.svm.airdrop(&adopter.pubkey(), 10_000_000_000).unwrap();

    let tampered = format!("{text} ");
    let err = h
        .send(
            ix_register_verse(&adopter.pubkey(), 1, 1, 1, &tampered, &proof, config_pda()),
            &[&adopter],
        )
        .expect_err("tampered text must fail");
    // VerseNotCanonical is error index 11 → 6011.
    assert!(err.contains("Custom(6011)"), "expected VerseNotCanonical, got {err}");
}

/// The R3 defense: a config account the attacker controls, passed in place of
/// the real one, is rejected because the seeds constraint recomputes the PDA.
#[test]
fn a_forged_config_account_is_rejected() {
    let f = fixtures();
    let (text, root, proof) = verse_fixture(&f, 1, 1, 1);

    let Some(mut h) = setup() else { return };
    h.seed_config(true);
    h.seed_book_roots(1, 1, root);

    // A second, attacker-owned "config" at an address that is not the PDA.
    let forged = Pubkey::new_unique();
    let config = Config {
        authority: anchor_key(&h.authority.pubkey()),
        roots_commitment: [0xAA; 32],
        translation: *b"engwebp\0",
        books_complete: 66,
        sealed: true,
        bump: 255,
    };
    let mut data = Config::DISCRIMINATOR.to_vec();
    data.extend(borsh_bytes(&config));
    h.write_account(forged, data);

    let adopter = Keypair::new();
    h.svm.airdrop(&adopter.pubkey(), 10_000_000_000).unwrap();

    let err = h
        .send(
            ix_register_verse(&adopter.pubkey(), 1, 1, 1, &text, &proof, forged),
            &[&adopter],
        )
        .expect_err("a forged config must be rejected");
    // Anchor's ConstraintSeeds is framework error 2006.
    assert!(err.contains("2006"), "expected a seeds-constraint failure, got {err}");
}

// ─── instruction builders ───────────────────────────────────────────────────

fn ix_initialize_config(authority: &Pubkey, commitment: [u8; 32]) -> Instruction {
    let mut data = discriminator("initialize_config").to_vec();
    data.extend_from_slice(&commitment);
    Instruction {
        program_id: program_id(),
        accounts: vec![
            AccountMeta::new(config_pda(), false),
            AccountMeta::new(*authority, true),
            AccountMeta::new_readonly(solana_pubkey::Pubkey::default(), false), // system program
        ],
        data,
    }
}

fn ix_initialize_book_roots(authority: &Pubkey, book: u8) -> Instruction {
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

fn ix_load_chapter_root(
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

fn ix_complete_book(signer: &Pubkey, book: u8) -> Instruction {
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

// ─── tests: the commitment-gated load path ──────────────────────────────────

/// Obadiah (book 31) has a single chapter, so it can be fully loaded and
/// completed in one pass — the whole load lifecycle without 1,189 transactions.
#[test]
fn loads_and_completes_a_single_chapter_book() {
    let f = fixtures();
    let commitment = hex32(f["rootsCommitment"].as_str().unwrap());
    let (root, proof) = chapter_fixture(&f, 31, 1);

    let Some(mut h) = setup() else { return };
    let auth = h.authority.insecure_clone();

    h.send(ix_initialize_config(&auth.pubkey(), commitment), &[&auth])
        .expect("initialize_config");
    h.send(ix_initialize_book_roots(&auth.pubkey(), 31), &[&auth])
        .expect("initialize_book_roots");
    h.send(ix_load_chapter_root(&auth.pubkey(), 31, 1, root, &proof), &[&auth])
        .expect("load_chapter_root");
    h.send(ix_complete_book(&auth.pubkey(), 31), &[&auth])
        .expect("complete_book");

    assert!(h.account(&book_roots_pda(31)).is_some(), "book roots created");
}

/// A root that is real but tampered must not prove into the commitment.
#[test]
fn load_rejects_a_root_not_in_the_commitment() {
    let f = fixtures();
    let commitment = hex32(f["rootsCommitment"].as_str().unwrap());
    let (root, proof) = chapter_fixture(&f, 31, 1);

    let Some(mut h) = setup() else { return };
    let auth = h.authority.insecure_clone();
    h.send(ix_initialize_config(&auth.pubkey(), commitment), &[&auth]).unwrap();
    h.send(ix_initialize_book_roots(&auth.pubkey(), 31), &[&auth]).unwrap();

    let mut tampered = root;
    tampered[0] ^= 0x01;
    let err = h
        .send(ix_load_chapter_root(&auth.pubkey(), 31, 1, tampered, &proof), &[&auth])
        .expect_err("tampered root must be rejected");
    // Anchor custom error codes start at 6000; RootNotCommitted is index 4.
    assert!(err.contains("Custom(6004)"), "expected RootNotCommitted, got {err}");
}

/// Completing a book before its chapter is loaded must fail.
#[test]
fn complete_book_before_load_fails() {
    let f = fixtures();
    let commitment = hex32(f["rootsCommitment"].as_str().unwrap());

    let Some(mut h) = setup() else { return };
    let auth = h.authority.insecure_clone();
    h.send(ix_initialize_config(&auth.pubkey(), commitment), &[&auth]).unwrap();
    h.send(ix_initialize_book_roots(&auth.pubkey(), 31), &[&auth]).unwrap();

    let err = h
        .send(ix_complete_book(&auth.pubkey(), 31), &[&auth])
        .expect_err("incomplete book must not complete");
    // BookIncomplete is error index 6 → Anchor code 6006.
    assert!(err.contains("Custom(6006)"), "expected BookIncomplete, got {err}");
}
