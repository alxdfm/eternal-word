//! Cross-implementation check: the Rust Merkle must accept exactly the proofs
//! the TypeScript catalog produces.
//!
//! Fixtures come from `pnpm catalog:fixtures` and are committed. The catalog is
//! the reference implementation; this program has to agree with it, byte for
//! byte, or valid registrations get rejected on-chain forever. Generating the
//! proofs here in Rust would only prove the implementation agrees with itself.

use std::fs;
use std::path::PathBuf;

use eternal_word::constants::{chapter_exists, CHAPTERS_PER_BOOK, TOTAL_CHAPTERS};
use eternal_word::merkle::{hash_leaf, verify_proof};

fn repo_root() -> PathBuf {
    // CARGO_MANIFEST_DIR is <repo>/programs/eternal-word
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("..")
}

fn hex32(value: &str) -> [u8; 32] {
    let bytes = hex_bytes(value);
    let mut out = [0u8; 32];
    out.copy_from_slice(&bytes);
    out
}

fn hex_bytes(value: &str) -> Vec<u8> {
    (0..value.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&value[i..i + 2], 16).expect("invalid hex in fixture"))
        .collect()
}

struct Fixture {
    book: u8,
    chapter: u16,
    root: [u8; 32],
    leaf: Vec<u8>,
    proof: Vec<[u8; 32]>,
}

fn load() -> ([u8; 32], Vec<Fixture>) {
    let path = repo_root().join("data/test-fixtures.json");
    let raw = fs::read_to_string(&path)
        .unwrap_or_else(|_| panic!("run `pnpm catalog:fixtures` first — missing {path:?}"));
    let json: serde_json::Value = serde_json::from_str(&raw).expect("fixtures are not valid JSON");

    let commitment = hex32(json["rootsCommitment"].as_str().unwrap());
    let chapters = json["chapters"]
        .as_array()
        .unwrap()
        .iter()
        .map(|c| Fixture {
            book: c["book"].as_u64().unwrap() as u8,
            chapter: c["chapter"].as_u64().unwrap() as u16,
            root: hex32(c["root"].as_str().unwrap()),
            leaf: hex_bytes(c["leaf"].as_str().unwrap()),
            proof: c["proof"]
                .as_array()
                .unwrap()
                .iter()
                .map(|p| hex32(p.as_str().unwrap()))
                .collect(),
        })
        .collect();

    (commitment, chapters)
}

/// The program builds the leaf itself; this mirrors `commitment_leaf`.
fn commitment_leaf(book: u8, chapter: u16, root: &[u8; 32]) -> [u8; 32] {
    let mut payload = [0u8; 35];
    payload[0] = book;
    payload[1..3].copy_from_slice(&chapter.to_le_bytes());
    payload[3..].copy_from_slice(root);
    hash_leaf(&payload)
}

#[test]
fn accepts_every_proof_the_catalog_produces() {
    let (commitment, chapters) = load();
    assert!(!chapters.is_empty(), "fixtures carry no chapters");

    for fixture in &chapters {
        let leaf = commitment_leaf(fixture.book, fixture.chapter, &fixture.root);
        assert!(
            verify_proof(leaf, &fixture.proof, &commitment),
            "rejected a valid proof for {}:{} — Rust and TypeScript disagree",
            fixture.book,
            fixture.chapter
        );
    }
}

#[test]
fn leaf_encoding_matches_the_catalog_byte_for_byte() {
    let (_, chapters) = load();
    for fixture in &chapters {
        let mut expected = vec![fixture.book];
        expected.extend_from_slice(&fixture.chapter.to_le_bytes());
        expected.extend_from_slice(&fixture.root);
        assert_eq!(
            fixture.leaf, expected,
            "leaf encoding drifted for {}:{}",
            fixture.book, fixture.chapter
        );
    }
}

/// The attack the position-bound leaf exists to stop: a real chapter root
/// replayed into a different chapter's slot.
#[test]
fn rejects_a_valid_root_claimed_for_another_chapter() {
    let (commitment, chapters) = load();
    let fixture = &chapters[0];

    let forged = commitment_leaf(fixture.book, fixture.chapter + 1, &fixture.root);
    assert!(
        !verify_proof(forged, &fixture.proof, &commitment),
        "a root proved for one chapter verified at another — position is not bound"
    );
}

#[test]
fn rejects_a_tampered_root() {
    let (commitment, chapters) = load();
    let fixture = &chapters[0];

    let mut tampered = fixture.root;
    tampered[0] ^= 0x01;
    let leaf = commitment_leaf(fixture.book, fixture.chapter, &tampered);
    assert!(!verify_proof(leaf, &fixture.proof, &commitment));
}

#[test]
fn chapter_counts_match_the_canon() {
    let total: u16 = CHAPTERS_PER_BOOK.iter().sum();
    assert_eq!(total, TOTAL_CHAPTERS, "chapter table drifted from 1,189");

    assert!(chapter_exists(1, 50), "Genesis has 50 chapters");
    assert!(!chapter_exists(1, 51));
    assert!(chapter_exists(19, 150), "Psalms has 150 chapters");
    assert!(!chapter_exists(19, 151));
    assert!(!chapter_exists(0, 1), "book 0 is not in the canon");
    assert!(!chapter_exists(67, 1), "book 67 is not in the canon");
    assert!(!chapter_exists(1, 0), "chapter 0 does not exist");
}
