'use client'

import styled from 'styled-components'

// Página de prova do scaffold (WB-00): renderiza com styled-components via SSR.
// As strings viram chaves i18n na WB-01 — aqui elas só provam o pipeline.
const Main = styled.main`
  min-height: 100dvh;
  display: grid;
  place-content: center;
  gap: 0.5rem;
  padding: 2rem;
  text-align: center;
  font-family: system-ui, -apple-system, sans-serif;
`

const Title = styled.h1`
  margin: 0;
  font-size: clamp(2rem, 5vw, 3rem);
`

const Subtitle = styled.p`
  margin: 0;
  color: #6b7280;
`

export default function HomePage() {
  return (
    <Main>
      <Title>Eternal Word</Title>
      <Subtitle>Web scaffold — S04 (WB-00)</Subtitle>
    </Main>
  )
}
