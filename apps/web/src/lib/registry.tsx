'use client'

import { useServerInsertedHTML } from 'next/navigation'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { ServerStyleSheet, StyleSheetManager } from 'styled-components'

// SSR registry do styled-components para o App Router: coleta as regras
// geradas no servidor e as injeta no <head> via useServerInsertedHTML, evitando
// o flash de conteúdo sem estilo. Padrão oficial do styled-components 6 + Next.
export function StyledComponentsRegistry({ children }: { children: ReactNode }) {
  const [styledComponentsStyleSheet] = useState(() => new ServerStyleSheet())

  useServerInsertedHTML(() => {
    const styles = styledComponentsStyleSheet.getStyleElement()
    styledComponentsStyleSheet.instance.clearTag()
    return <>{styles}</>
  })

  // No cliente, o styled-components assume o controle — não reembrulhar.
  if (typeof window !== 'undefined') {
    return <>{children}</>
  }

  return (
    <StyleSheetManager sheet={styledComponentsStyleSheet.instance}>{children}</StyleSheetManager>
  )
}
