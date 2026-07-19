# Decisão: Validação on-chain do texto via Merkle proof

**Data:** 2026-07-18
**Status:** aceita (Alexandre, 2026-07-18)
**Autor:** Claude (recomendação técnica)

---

## Contexto

Na spec inicial, o programa aceita `text: String` de quem paga a transação —
nada valida que o texto submetido é o versículo verdadeiro. Como a PDA
impede re-registro, um texto vandalizado (ou com um simples typo) ocuparia o
slot daquele versículo **para sempre**. Um produto cuja promessa é
"imutável e verificável" precisa garantir a integridade do texto no momento
do registro.

---

## Opções consideradas

| Opção | Prós | Contras |
|-------|------|---------|
| Sem validação (spec original) | Programa mínimo | Vandalismo permanente e irreversível; quebra a promessa central |
| Backend co-assina como authority | Simples de implementar | Centraliza; quebra o registro permissionless (a spec prevê registro direto no programa); authority vira ponto único de falha |
| Merkle proof on-chain — a escolhida | Permissionless e seguro; texto auto-validável; permite alocar espaço exato da conta | Tooling para gerar a árvore; proof de ~480 bytes por transação; root fixa a tradução escolhida |

---

## Decisão tomada

> **Merkle root do texto canônico em conta de config + proof em cada registro**

Uma conta de configuração do programa armazena a Merkle root do CanonicalText
completo. A instrução `register_verse(book, chapter, verse, text, proof)`
computa `leaf = hash(book, chapter, verse, text)` e verifica a proof contra a
root. Com 31.098 folhas a árvore tem 15 níveis → proof de 480 bytes.

> ⚠️ **Orçamento de transação — validar antes de implementar (spike PG-00).**
> Medido no dataset real: versículo mais longo = **Ester 8:9, 493 bytes**.
> Pior caso da instrução: 493 (texto) + 480 (proof) + 13 = **986 bytes**;
> com assinatura, header, contas e blockhash a transação fica em ~1.224 dos
> **1.232 bytes** permitidos — cabe, mas com ~8 bytes de margem. Uma
> instrução `ComputeBudget` (priority fee, comum em congestionamento)
> estoura o limite.
> Mitigação analisada: **uma root por capítulo** guardadas numa conta de
> config (1.189 × 32 = 38KB — a conta é passada por endereço, não ocupa
> espaço na transação). Maior capítulo = Salmo 119 (176 versos) → 8 níveis
> → proof de 256 bytes, derrubando o pior caso para ~762 bytes de instrução.
> A forma final da árvore é decidida no spike PG-00 e vira ADR própria.

---

## Consequências

**Positivas:**
- Qualquer pessoa registra direto no programa sem confiar no backend
- Impossível registrar texto adulterado; o dado on-chain é auto-validável
- O tamanho exato de cada conta é conhecido de antemão (texto canônico)

**Negativas / Trade-offs:**
- Tooling off-chain para gerar árvore e proofs (script no Catálogo)
- A root gravada congela a tradução/versificação — mudança exige nova config
  e invalidaria registros pendentes (aceitável: é a natureza do produto)

**Impacto no código:**
- `programs/eternal-word/` (conta de config, verificação de proof)
- `packages/blockchain/` (geração de proofs client-side)
- Catálogo: script de build da Merkle tree a partir do CanonicalText

---

## Revisão futura

Revisitar se o suporte a múltiplas traduções (evolução futura) exigir
múltiplas roots ou outra estrutura de commitment.
