'use client'

import styled from 'styled-components'

/** The panel surface — vellum leaf / ink page. The base container for cards,
 * feeds, stat tiles and the book-detail strip. */
export const Card = styled.div`
  background: ${({ theme }) => theme.color.panel};
  border: 1px solid ${({ theme }) => theme.color.rule};
  border-radius: ${({ theme }) => theme.radius.xl};
  padding: ${({ theme }) => theme.space.xl};
  box-shadow: ${({ theme }) => theme.shadow.card};
`
