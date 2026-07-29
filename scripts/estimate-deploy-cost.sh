#!/usr/bin/env bash
#
# Estima o custo em SOL para publicar o programa Eternal Word num cluster.
#
# O que domina o custo NÃO é a taxa de rede — é o depósito rent-exempt das
# contas que o Upgradeable Loader cria no deploy:
#
#   Program account      36 B fixos  (aponta pra ProgramData)
#   ProgramData account  bytecode + 45 B de metadado  ← guarda o .so
#
# Como o rent-exempt é 2 anos de rent cravados de uma vez, ele escala linear com
# o tamanho do .so. É um DEPÓSITO recuperável (solana program close devolve),
# não uma queima.
#
# A matemática de rent é a mesma de packages/application/src/read/sol-estimate.ts
# (6960 lamports/byte = 3480/byte-ano × 2 anos; header de 128 B). Mantê-las em
# sincronia é intencional — se uma mudar, a outra também muda.
#
# Por padrão o `anchor deploy` aloca a ProgramData no TAMANHO EXATO do bytecode,
# sem folga pra upgrade (foi por isso que a PG-11 precisou de `program extend`
# em devnet). Passe --max-len pra estimar o cenário com folga reservada.
#
# Uso:
#   pnpm program:estimate-cost                 # usa target/deploy/eternal_word.so
#   pnpm program:estimate-cost -- --so caminho/outro.so
#   pnpm program:estimate-cost -- --max-len 456560   # folga p/ upgrade futuro
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Rent params — em sincronia com sol-estimate.ts (mainnet e devnet usam os mesmos).
readonly LAMPORTS_PER_SOL=1000000000
readonly RENT_LAMPORTS_PER_BYTE=6960   # 3480 lamports/byte-ano × 2 anos de threshold
readonly RENT_HEADER_BYTES=128         # metadado que a Solana conta em toda conta
readonly SIGNATURE_FEE_LAMPORTS=5000

# Upgradeable Loader account layouts (bincode-serialized state sizes).
readonly PROGRAM_ACCOUNT_BYTES=36      # enum(4) + programdata pubkey(32)
readonly PROGRAMDATA_METADATA_BYTES=45 # enum(4) + slot(8) + option authority(1+32)
readonly WRITE_CHUNK_BYTES=1012        # ~payload gravado por transação no deploy

SO_PATH="target/deploy/eternal_word.so"
MAX_LEN=""

while [ $# -gt 0 ]; do
  case "$1" in
    --) shift ;;
    --so) SO_PATH="$2"; shift 2 ;;
    --max-len) MAX_LEN="$2"; shift 2 ;;
    -h|--help)
      grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

if [ ! -f "$SO_PATH" ]; then
  echo "no $SO_PATH — build it first with 'pnpm program:build'." >&2
  exit 1
fi

SO_BYTES="$(stat -c%s "$SO_PATH")"

# Tamanho reservado da ProgramData: bytecode (ou --max-len) + metadado.
if [ -n "$MAX_LEN" ]; then
  RESERVED_BYTES="$MAX_LEN"
else
  RESERVED_BYTES="$SO_BYTES"
fi
programdata_data_bytes=$((RESERVED_BYTES + PROGRAMDATA_METADATA_BYTES))

rent() { echo $(( ($1 + RENT_HEADER_BYTES) * RENT_LAMPORTS_PER_BYTE )); }

programdata_lamports="$(rent "$programdata_data_bytes")"
program_lamports="$(rent "$PROGRAM_ACCOUNT_BYTES")"

# Taxas de assinatura: o bytecode é gravado no buffer em pedaços, uma tx por
# pedaço, mais um punhado de txs de criar/deploy. Estimativa grosseira.
write_txs=$(( (SO_BYTES + WRITE_CHUNK_BYTES - 1) / WRITE_CHUNK_BYTES ))
fee_lamports=$(( (write_txs + 4) * SIGNATURE_FEE_LAMPORTS ))

total_lamports=$((programdata_lamports + program_lamports + fee_lamports))

sol() { awk -v l="$1" -v d="$LAMPORTS_PER_SOL" 'BEGIN{printf "%.9f", l/d}'; }
kib() { awk -v b="$1" 'BEGIN{printf "%.1f", b/1024}'; }

echo ""
echo "Eternal Word — estimativa de custo de deploy (depósito rent-exempt)"
echo ""
printf '  bytecode (.so):        %s\n' "$SO_PATH"
printf '  size:                  %s bytes (%s KiB)\n' "$SO_BYTES" "$(kib "$SO_BYTES")"
if [ -n "$MAX_LEN" ]; then
  printf '  reserved (--max-len):  %s bytes\n' "$MAX_LEN"
fi
echo "  ────────────────────────────────────────────────"
printf '  ProgramData account:   %8s B  → %s SOL\n' "$programdata_data_bytes" "$(sol "$programdata_lamports")"
printf '  Program account:       %8s B  → %s SOL\n' "$PROGRAM_ACCOUNT_BYTES" "$(sol "$program_lamports")"
printf '  deploy tx fees (~%s):  %s SOL\n' "$write_txs" "$(sol "$fee_lamports")"
echo "  ────────────────────────────────────────────────"
printf '  TOTAL:                 ~%s SOL\n' "$(sol "$total_lamports")"
echo ""
echo "  Depósito recuperável, não queima (solana program close devolve o rent)."
if [ -z "$MAX_LEN" ]; then
  echo "  Sem folga de upgrade — o mesmo default que exigiu 'program extend' na PG-11."
  echo "  Reserve espaço com --max-len <bytes> (ex.: 2× = $((SO_BYTES * 2)))."
fi
echo ""
