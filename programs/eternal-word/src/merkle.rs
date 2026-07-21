use solana_sha256_hasher::hashv;

/// Merkle verification, mirroring `packages/catalog/src/merkle.ts` exactly.
///
/// Any divergence here silently rejects valid proofs — or, far worse, accepts
/// forged ones. The four rules that must match:
///
/// - **sha256**, reachable as a syscall on-chain and built into Node off-chain.
/// - **Domain separation**: `0x00` for leaves, `0x01` for internal nodes, so a
///   leaf digest can never be replayed as an internal node.
/// - **Sorted pairs**: each pair is hashed in byte order, which is why proofs
///   carry no direction bits — the binding constraint is transaction size
///   (see the PG-00 ADR). Position must therefore be bound inside the leaf.
/// - **Odd node promoted, never duplicated**: duplicating the last node would
///   admit two distinct leaf sets with the same root (CVE-2012-2459). A
///   promoted level contributes no sibling, so a proof may be shorter than the
///   tree depth — never longer.
const LEAF_PREFIX: [u8; 1] = [0x00];
const NODE_PREFIX: [u8; 1] = [0x01];

pub fn hash_leaf(payload: &[u8]) -> [u8; 32] {
    hashv(&[&LEAF_PREFIX, payload]).to_bytes()
}

pub fn hash_pair(left: &[u8; 32], right: &[u8; 32]) -> [u8; 32] {
    if left <= right {
        hashv(&[&NODE_PREFIX, left.as_slice(), right.as_slice()]).to_bytes()
    } else {
        hashv(&[&NODE_PREFIX, right.as_slice(), left.as_slice()]).to_bytes()
    }
}

/// Folds `leaf` up through `proof` and compares against `root`.
///
/// `leaf` is already hashed by the caller: what a leaf commits to differs per
/// tree (a verse payload, or a chapter address bound to its root), and only
/// the caller knows which.
pub fn verify_proof(leaf: [u8; 32], proof: &[[u8; 32]], root: &[u8; 32]) -> bool {
    let mut computed = leaf;
    for sibling in proof {
        computed = hash_pair(&computed, sibling);
    }
    computed == *root
}
