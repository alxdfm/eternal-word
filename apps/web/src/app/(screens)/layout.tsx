import { AppHeader } from '@/components/app-header'
import type { ReactNode } from 'react'

/** Shared chrome for the exploration screens (dashboard, explore, map, search,
 * profile): the nav header above each page. The register landing (`/`) keeps
 * its own minimal layout. */
export default function ScreensLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AppHeader />
      {children}
    </>
  )
}
