//! Error-path guards, executed against the real bytecode (freeze review,
//! 2026-07-30). `program_flow.rs` covers the happy paths and the Merkle
//! rejections; this suite fires every remaining `require!` at least once, so
//! no guard reaches mainnet having only ever been read, not run. `seal` in
//! particular had only ever executed on devnet (PG-08) before these tests.
//!
//! Same prerequisites as `program_flow.rs`: `pnpm program:build` for the .so,
//! `pnpm catalog:fixtures` for the proofs; skips cleanly without the .so.

mod common;

use anchor_lang::AnchorDeserialize;
use common::*;
use eternal_word::state::Config;
use solana_signer::Signer;

// ─── seal ───────────────────────────────────────────────────────────────────

/// A complete canon must seal, and the flag must persist in the account —
/// the in-process counterpart of what PG-08 proved on devnet.
#[test]
fn seal_closes_a_complete_canon() {
    let Some(mut h) = setup() else { return };
    h.seed_config_counts(66, false);
    let auth = h.authority.insecure_clone();

    h.send(ix_seal(&auth.pubkey()), &[&auth])
        .expect("seal with all 66 books complete");

    let raw = h.account(&config_pda()).expect("config exists");
    let config = Config::try_from_slice(&raw.data[8..]).expect("deserialize Config");
    assert!(config.sealed, "seal must persist sealed = true");
}

/// Sealing an incomplete canon would freeze missing chapters out forever —
/// this guard is all that stands between a partial load and a permanent,
/// incomplete canon.
#[test]
fn seal_with_an_incomplete_canon_fails() {
    let Some(mut h) = setup() else { return };
    let auth = h.authority.insecure_clone();
    h.send(ix_initialize_config(&auth.pubkey()), &[&auth]).unwrap();

    let err = h
        .send(ix_seal(&auth.pubkey()), &[&auth])
        .expect_err("sealing with 0 of 66 books complete must fail");
    // CanonIncomplete is error index 7 → 6007.
    assert!(err.contains("Custom(6007)"), "expected CanonIncomplete, got {err}");
}

/// `sealed` is a one-way flag; a second seal must fail, not silently succeed.
#[test]
fn sealing_twice_fails() {
    let Some(mut h) = setup() else { return };
    h.seed_config(true);
    let auth = h.authority.insecure_clone();

    let err = h
        .send(ix_seal(&auth.pubkey()), &[&auth])
        .expect_err("a second seal must fail");
    // ConfigSealed is error index 0 → 6000.
    assert!(err.contains("Custom(6000)"), "expected ConfigSealed, got {err}");
}

// ─── register_verse ─────────────────────────────────────────────────────────

/// Empty text can never prove into the canon, but it must be rejected by its
/// own guard before any hashing happens.
#[test]
fn register_rejects_empty_text() {
    let Some((mut h, _text, proof, adopter)) = register_setup(true) else { return };

    let err = h
        .send(
            ix_register_verse(&adopter.pubkey(), 1, 1, 1, "", &proof, config_pda()),
            &[&adopter],
        )
        .expect_err("empty text must fail");
    // TextEmpty is error index 10 → 6010.
    assert!(err.contains("Custom(6010)"), "expected TextEmpty, got {err}");
}

/// One byte past Esther 8:9 (493, the longest canonical verse) must be
/// rejected before the account is sized.
#[test]
fn register_rejects_text_longer_than_any_canonical_verse() {
    let Some((mut h, _text, proof, adopter)) = register_setup(true) else { return };

    let oversized = "a".repeat(494);
    let err = h
        .send(
            ix_register_verse(&adopter.pubkey(), 1, 1, 1, &oversized, &proof, config_pda()),
            &[&adopter],
        )
        .expect_err("text longer than MAX_VERSE_BYTES must fail");
    // TextTooLong is error index 9 → 6009.
    assert!(err.contains("Custom(6009)"), "expected TextTooLong, got {err}");
}

/// One sibling past the deepest chapter tree (Psalm 119 → 8) must be rejected
/// before any Merkle work.
#[test]
fn register_rejects_an_oversized_proof() {
    let Some((mut h, text, _proof, adopter)) = register_setup(true) else { return };

    let oversized = vec![[0u8; 32]; 9];
    let err = h
        .send(
            ix_register_verse(&adopter.pubkey(), 1, 1, 1, &text, &oversized, config_pda()),
            &[&adopter],
        )
        .expect_err("a proof longer than MAX_VERSE_PROOF must fail");
    // ProofTooLong is error index 3 → 6003.
    assert!(err.contains("Custom(6003)"), "expected ProofTooLong, got {err}");
}

/// Genesis has 50 chapters; registering in chapter 51 must fail on the canon
/// bounds, before the roots slot is even considered.
#[test]
fn register_rejects_a_chapter_outside_the_book() {
    let Some((mut h, text, proof, adopter)) = register_setup(true) else { return };

    let err = h
        .send(
            ix_register_verse(&adopter.pubkey(), 1, 51, 1, &text, &proof, config_pda()),
            &[&adopter],
        )
        .expect_err("a chapter outside the book must fail");
    // ChapterOutOfRange is error index 2 → 6002.
    assert!(err.contains("Custom(6002)"), "expected ChapterOutOfRange, got {err}");
}

/// `register_setup` loads only Genesis 1. Chapter 2 exists in the canon but
/// its root slot is still zeroed — the `is_loaded` gate must fire, not the
/// Merkle check against a zero root.
#[test]
fn register_rejects_a_chapter_whose_root_is_not_loaded() {
    let Some((mut h, text, proof, adopter)) = register_setup(true) else { return };

    let err = h
        .send(
            ix_register_verse(&adopter.pubkey(), 1, 2, 1, &text, &proof, config_pda()),
            &[&adopter],
        )
        .expect_err("registering against an unloaded chapter root must fail");
    // ChapterRootMissing is error index 8 → 6008.
    assert!(err.contains("Custom(6008)"), "expected ChapterRootMissing, got {err}");
}

// ─── load_chapter_root ──────────────────────────────────────────────────────

/// One sibling past the commitment tree depth (ceil(log2(1189)) = 11) must be
/// rejected before any Merkle work.
#[test]
fn load_rejects_an_oversized_proof() {
    let f = fixtures();
    let (root, _proof) = chapter_fixture(&f, 31, 1);

    let Some(mut h) = setup() else { return };
    let auth = h.authority.insecure_clone();
    h.send(ix_initialize_config(&auth.pubkey()), &[&auth]).unwrap();
    h.send(ix_initialize_book_roots(&auth.pubkey(), 31), &[&auth]).unwrap();

    let oversized = vec![[0u8; 32]; 12];
    let err = h
        .send(ix_load_chapter_root(&auth.pubkey(), 31, 1, root, &oversized), &[&auth])
        .expect_err("a proof longer than MAX_COMMITMENT_PROOF must fail");
    assert!(err.contains("Custom(6003)"), "expected ProofTooLong, got {err}");
}

/// Obadiah has a single chapter; loading a root for chapter 2 must fail on the
/// canon bounds — the guard that keeps `roots[chapter - 1]` in range.
#[test]
fn load_rejects_a_chapter_outside_the_book() {
    let f = fixtures();
    let (root, proof) = chapter_fixture(&f, 31, 1);

    let Some(mut h) = setup() else { return };
    let auth = h.authority.insecure_clone();
    h.send(ix_initialize_config(&auth.pubkey()), &[&auth]).unwrap();
    h.send(ix_initialize_book_roots(&auth.pubkey(), 31), &[&auth]).unwrap();

    let err = h
        .send(ix_load_chapter_root(&auth.pubkey(), 31, 2, root, &proof), &[&auth])
        .expect_err("a chapter outside the book must fail");
    assert!(err.contains("Custom(6002)"), "expected ChapterOutOfRange, got {err}");
}

/// After seal, no root can be written again — even the correct one.
#[test]
fn load_after_seal_fails() {
    let f = fixtures();
    let (root, proof) = chapter_fixture(&f, 31, 1);

    let Some(mut h) = setup() else { return };
    h.seed_config(true);
    h.seed_book_roots(31, 1, root);
    let auth = h.authority.insecure_clone();

    let err = h
        .send(ix_load_chapter_root(&auth.pubkey(), 31, 1, root, &proof), &[&auth])
        .expect_err("loading into a sealed canon must fail");
    assert!(err.contains("Custom(6000)"), "expected ConfigSealed, got {err}");
}

// ─── initialize_book_roots ──────────────────────────────────────────────────

/// After seal, no roots account can be allocated — and the reverted `init`
/// must leave nothing behind.
#[test]
fn initialize_book_roots_after_seal_fails() {
    let Some(mut h) = setup() else { return };
    h.seed_config(true);
    let auth = h.authority.insecure_clone();

    let err = h
        .send(ix_initialize_book_roots(&auth.pubkey(), 40), &[&auth])
        .expect_err("allocating book roots after seal must fail");
    assert!(err.contains("Custom(6000)"), "expected ConfigSealed, got {err}");
    assert!(
        h.account(&book_roots_pda(40)).is_none(),
        "the reverted init must not leave an account behind"
    );
}

/// Books 0 and 67 resolve `BookRoots::space` to the 0-chapter minimum before
/// the handler can reject them (state.rs docs) — the whole transaction must
/// revert with `BookOutOfRange` and persist nothing.
#[test]
fn initialize_book_roots_rejects_books_outside_the_canon() {
    let Some(mut h) = setup() else { return };
    let auth = h.authority.insecure_clone();
    h.send(ix_initialize_config(&auth.pubkey()), &[&auth]).unwrap();

    for book in [0u8, 67u8] {
        let err = h
            .send(ix_initialize_book_roots(&auth.pubkey(), book), &[&auth])
            .expect_err("a book outside 1..=66 must fail");
        // BookOutOfRange is error index 1 → 6001.
        assert!(
            err.contains("Custom(6001)"),
            "expected BookOutOfRange for book {book}, got {err}"
        );
        assert!(
            h.account(&book_roots_pda(book)).is_none(),
            "no account must persist for book {book}"
        );
    }
}
