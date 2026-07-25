'use client'

import dynamic from 'next/dynamic'

// Botão oficial de conectar/trocar/desconectar (react-ui). ssr:false evita
// mismatch de hidratação — o estado da carteira só existe no cliente.
export const WalletButton = dynamic(
  async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
  { ssr: false },
)
