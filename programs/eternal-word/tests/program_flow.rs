//! Executes the real bytecode in litesvm — the piece the Merkle-only tests
//! cannot reach. Here the program actually runs: PDAs are created, `init`
//! rejects a second registration, a forged config is refused, the `sealed`
//! gate holds.
//!
//! Devnet (PG-08) proves the chain agrees; this proves the logic, offline and
//! in milliseconds. Needs `pnpm program:build` for target/deploy/*.so and
//! `pnpm catalog:fixtures` for the proofs.
//!
//! The harness (fixtures, PDAs, instruction builders) lives in
//! `tests/common/mod.rs`, shared with the error-path suite in
//! `program_guards.rs`.

mod common;

use anchor_lang::{AnchorDeserialize, Discriminator};
use common::*;
use eternal_word::instructions::register_verse::VerseRegistered;
use eternal_word::state::{Config, VerseAccount};
use solana_keypair::Keypair;
use solana_pubkey::Pubkey;
use solana_signer::Signer;

/// Completing a book twice must not count it twice. A retry — which the launch
/// runbook will do — has to fail cleanly, not inflate `books_complete` toward
/// an early, permanent seal of an incomplete canon.
#[test]
fn completing_a_book_twice_fails() {
    let f = fixtures();
    let (root, proof) = chapter_fixture(&f, 31, 1);

    let Some(mut h) = setup() else { return };
    let auth = h.authority.insecure_clone();
    h.send(ix_initialize_config(&auth.pubkey()), &[&auth]).unwrap();
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
    let Some((mut h, text, proof, adopter)) = register_setup(true) else { return };

    // litesvm's clock starts at 0; set a known timestamp so the assertion below
    // proves the program actually stores Clock::get().unix_timestamp.
    let mut clock: solana_clock::Clock = h.svm.get_sysvar();
    clock.unix_timestamp = 1_700_000_000;
    h.svm.set_sysvar(&clock);

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

/// The indexer's real-time layer keys off the on-chain event, not the account.
/// A successful registration must emit `VerseRegistered` with the exact fields —
/// discriminator and Borsh body — on the `Program data:` log line.
#[test]
fn register_verse_emits_the_verse_registered_event() {
    let Some((mut h, text, proof, adopter)) = register_setup(true) else { return };

    let mut clock: solana_clock::Clock = h.svm.get_sysvar();
    clock.unix_timestamp = 1_700_000_000;
    h.svm.set_sysvar(&clock);

    let meta = h
        .send_meta(
            ix_register_verse(&adopter.pubkey(), 1, 1, 1, &text, &proof, config_pda()),
            &[&adopter],
        )
        .expect("register_verse happy path");

    // Rebuild the exact bytes `emit!` logs: discriminator ++ Borsh body, base64.
    let event = VerseRegistered {
        book: 1,
        chapter: 1,
        verse: 1,
        adopter: anchor_key(&adopter.pubkey()),
        created_at: 1_700_000_000,
    };
    let mut expected = VerseRegistered::DISCRIMINATOR.to_vec();
    expected.extend(borsh_bytes(&event));
    let expected_b64 = base64(&expected);

    assert!(
        meta.logs.iter().any(|line| line.contains(&expected_b64)),
        "VerseRegistered event not found in logs: {:?}",
        meta.logs
    );
}

/// The core permanence guarantee: the same verse cannot be registered twice.
/// This is the whole reason there is no `close` — `init` refuses the address.
#[test]
fn registering_the_same_verse_twice_fails() {
    let Some((mut h, text, proof, adopter)) = register_setup(true) else { return };

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
    let Some((mut h, text, proof, adopter)) = register_setup(false) else { return };

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
    let Some((mut h, text, proof, adopter)) = register_setup(true) else { return };

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
    let Some((mut h, text, proof, adopter)) = register_setup(true) else { return };

    // A second, attacker-owned "config" at an address that is not the PDA.
    let forged = Pubkey::new_unique();
    let config = Config {
        translation: *b"engwebp\0",
        books_complete: 66,
        sealed: true,
        bump: 255,
    };
    let mut data = Config::DISCRIMINATOR.to_vec();
    data.extend(borsh_bytes(&config));
    h.write_account(forged, data);

    let err = h
        .send(
            ix_register_verse(&adopter.pubkey(), 1, 1, 1, &text, &proof, forged),
            &[&adopter],
        )
        .expect_err("a forged config must be rejected");
    // Anchor's ConstraintSeeds is framework error 2006.
    assert!(err.contains("2006"), "expected a seeds-constraint failure, got {err}");
}

// ─── tests: the commitment-gated load path ──────────────────────────────────

/// Obadiah (book 31) has a single chapter, so it can be fully loaded and
/// completed in one pass — the whole load lifecycle without 1,189 transactions.
#[test]
fn loads_and_completes_a_single_chapter_book() {
    let f = fixtures();
    let (root, proof) = chapter_fixture(&f, 31, 1);

    let Some(mut h) = setup() else { return };
    let auth = h.authority.insecure_clone();

    h.send(ix_initialize_config(&auth.pubkey()), &[&auth])
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
    let (root, proof) = chapter_fixture(&f, 31, 1);

    let Some(mut h) = setup() else { return };
    let auth = h.authority.insecure_clone();
    h.send(ix_initialize_config(&auth.pubkey()), &[&auth]).unwrap();
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
    let Some(mut h) = setup() else { return };
    let auth = h.authority.insecure_clone();
    h.send(ix_initialize_config(&auth.pubkey()), &[&auth]).unwrap();
    h.send(ix_initialize_book_roots(&auth.pubkey(), 31), &[&auth]).unwrap();

    let err = h
        .send(ix_complete_book(&auth.pubkey(), 31), &[&auth])
        .expect_err("incomplete book must not complete");
    // BookIncomplete is error index 6 → Anchor code 6006.
    assert!(err.contains("Custom(6006)"), "expected BookIncomplete, got {err}");
}
