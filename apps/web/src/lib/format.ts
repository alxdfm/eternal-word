// Abrevia uma chave pública base58 para exibição: 4 primeiros + 4 últimos.
export function shortenAddress(address: string): string {
  if (address.length <= 8) {
    return address
  }
  return `${address.slice(0, 4)}…${address.slice(-4)}`
}

/**
 * Casas decimais para exibir um valor em SOL. O rent é ~0.002 SOL/verso, então a
 * contribuição de uma carteira individual (poucos versos) fica abaixo de 0.01 e
 * arredondaria para 0 com 2 casas — mostrando "◎0" para quem de fato contribuiu.
 * Abaixo de 0.01 usamos 4 casas (◎0.0043); acima, 2 (◎12.35).
 */
export function solFractionDigits(sol: number): number {
  return sol > 0 && sol < 0.01 ? 4 : 2
}
