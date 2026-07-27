#!/usr/bin/env bash
#
# HD-03 — Verificação reproduzível do bytecode do programa Eternal Word.
#
# O programa é a única parte irreversível do sistema. Este script prova que o
# bytecode publicado on-chain foi compilado a partir DESTE código-fonte, com a
# toolchain fixada (Agave 3.1.13 / Anchor 1.0.0), e não de outro lugar — um .so
# compilado com toolchain diferente é indistinguível de um adulterado.
#
# Faz duas verificações:
#   1. REBUILD  — reconstrói o .so no container fixado e confere o sha256 contra
#                 programs/eternal-word/deployment.json (a fonte de verdade).
#   2. ON-CHAIN — (--onchain) baixa o bytecode publicado e confere que ele bate
#                 com o rebuild. Fecha o elo "fonte → binário → cadeia".
#
# Qualquer pessoa reproduz sem confiar neste script: rode `pnpm program:build`
# e compare `sha256sum target/deploy/eternal_word.so` com o valor no manifesto.
#
# Uso:
#   pnpm program:verify                       # rebuild + compara com devnet
#   pnpm program:verify -- --cluster mainnet-beta
#   pnpm program:verify -- --onchain          # também confere contra a cadeia
#   pnpm program:verify -- --skip-build       # só re-hasheia o .so já presente
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

MANIFEST="programs/eternal-word/deployment.json"
SO_PATH="target/deploy/eternal_word.so"
IMAGE="eternal-word-build"

CLUSTER="devnet"
DO_ONCHAIN=0
SKIP_BUILD=0

while [ $# -gt 0 ]; do
  case "$1" in
    --) shift ;;
    --cluster) CLUSTER="$2"; shift 2 ;;
    --onchain) DO_ONCHAIN=1; shift ;;
    --skip-build) SKIP_BUILD=1; shift ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

# Expected hash + program id from the manifest (node is the project runtime).
read_manifest() { node -e "const m=require('./$MANIFEST').clusters['$CLUSTER']||{};process.stdout.write(String(m['$1']??''))"; }
EXPECTED="$(read_manifest bytecodeSha256)"
PROGRAM_ID="$(read_manifest programId)"

if [ -z "$EXPECTED" ] || [ "$EXPECTED" = "null" ]; then
  echo "no expected hash for cluster '$CLUSTER' in $MANIFEST (mainnet-beta is filled in the S07 cutover)" >&2
  exit 1
fi

# 1. Rebuild in the pinned container.
if [ "$SKIP_BUILD" -eq 0 ]; then
  if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
    echo "==> building the pinned toolchain image ($IMAGE)"
    pnpm docker:build
  fi
  echo "==> rebuilding the program in the container"
  pnpm program:build
fi

[ -f "$SO_PATH" ] || { echo "no $SO_PATH — build failed or nothing to hash" >&2; exit 1; }
ACTUAL="$(sha256sum "$SO_PATH" | awk '{print $1}')"

echo ""
echo "cluster:            $CLUSTER"
echo "program id:         $PROGRAM_ID"
echo "expected (manifest): $EXPECTED"
echo "rebuilt (.so):       $ACTUAL"
if [ "$ACTUAL" != "$EXPECTED" ]; then
  echo "MISMATCH — the rebuild does not reproduce the committed hash." >&2
  echo "The toolchain, the source, or the manifest is out of sync." >&2
  exit 1
fi
echo "OK — rebuild reproduces the committed bytecode hash."

# 2. Optional: compare against the bytecode actually deployed on-chain.
if [ "$DO_ONCHAIN" -eq 1 ]; then
  echo ""
  echo "==> dumping deployed bytecode from $CLUSTER"
  # solana lives in the container; dump into the mounted target/ dir.
  docker run --rm -v "$REPO_ROOT:/workspace" "$IMAGE" \
    solana program dump "$PROGRAM_ID" /workspace/target/deploy/onchain.so --url "$CLUSTER"

  # The dump is padded with trailing zeros up to the ProgramData allocation
  # (the account was `program extend`ed in PG-11). Trim to the build length
  # before hashing; a real difference shows up inside the first bytes, padding
  # never does.
  BUILD_LEN="$(stat -c%s "$SO_PATH")"
  head -c "$BUILD_LEN" target/deploy/onchain.so > target/deploy/onchain.trimmed.so
  # The tail beyond the build length must be all zeros — otherwise it is not padding.
  if [ "$(stat -c%s target/deploy/onchain.so)" -gt "$BUILD_LEN" ]; then
    TAIL_NONZERO="$(tail -c +"$((BUILD_LEN + 1))" target/deploy/onchain.so | tr -d '\0' | wc -c)"
    [ "$TAIL_NONZERO" -eq 0 ] || { echo "on-chain bytes past the build length are not zero padding" >&2; exit 1; }
  fi
  ONCHAIN="$(sha256sum target/deploy/onchain.trimmed.so | awk '{print $1}')"
  echo "on-chain (trimmed):  $ONCHAIN"
  if [ "$ONCHAIN" != "$EXPECTED" ]; then
    echo "MISMATCH — deployed bytecode differs from the rebuilt source." >&2
    exit 1
  fi
  echo "OK — deployed bytecode matches the rebuilt source."
  rm -f target/deploy/onchain.so target/deploy/onchain.trimmed.so
fi

echo ""
echo "bytecode verification PASSED ($CLUSTER)."
