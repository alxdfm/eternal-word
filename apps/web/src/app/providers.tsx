'use client'

import { SOLANA_RPC_URL } from '@/lib/env'
import type { Adapter } from '@solana/wallet-adapter-base'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'

// Fronteira de estado da web (ADR 2026-07-24_estado-e-data-fetching-web):
// TanStack Query cuida do estado de servidor (status dos versículos vindo da
// API de leitura); o Wallet Adapter cuida do estado da carteira. Um não invade
// o outro.
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())
  const endpoint = useMemo(() => SOLANA_RPC_URL, [])
  // Wallet Standard auto-detecta Phantom, Solflare e Backpack — sem adapters
  // manuais. O array vazio deixa a detecção padrão cuidar disso.
  const wallets = useMemo<Adapter[]>(() => [], [])

  return (
    <QueryClientProvider client={queryClient}>
      <ConnectionProvider endpoint={endpoint}>
        <WalletProvider wallets={wallets} autoConnect>
          <WalletModalProvider>{children}</WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    </QueryClientProvider>
  )
}
