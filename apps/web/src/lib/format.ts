// Abrevia uma chave pública base58 para exibição: 4 primeiros + 4 últimos.
export function shortenAddress(address: string): string {
  if (address.length <= 8) {
    return address
  }
  return `${address.slice(0, 4)}…${address.slice(-4)}`
}
