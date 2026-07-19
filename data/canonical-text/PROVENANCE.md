# Proveniência — CanonicalText

O texto bíblico neste diretório é a **World English Bible (WEB)**, edição
protestante — **domínio público** (dedicação expressa dos mantenedores; o
nome "World English Bible" é marca registrada usada para proteger a
integridade do texto, cujo uso é permitido quando o texto não é modificado).

## Snapshot

- **Fonte:** distribuição verse-per-line (VPL) do eBible.org, ID `engwebp`
  — https://ebible.org/details.php?id=engwebp — obtida em 2026-07-18.
- **Conteúdo:** canon protestante de 66 livros, 1.189 capítulos,
  **31.098 versículos com texto** + 5 posições vazias (ver abaixo).
- **Processamento** (via `scripts/build-canonical-text.mjs`):
  - espaços normalizados; aspas tipográficas da fonte preservadas;
  - títulos dos Salmos integrados ao versículo 1 (convenção da fonte);
  - o texto dos versículos não foi alterado.

## Posições omitidas (`null`)

A WEB preserva a numeração tradicional (KJV), mas omite do texto principal
os versículos ausentes do Texto Majoritário. Essas posições aparecem como
`null` no JSON — existem na versificação, não têm texto e **não são
registráveis** on-chain:

- Lucas 17:36
- Atos 8:37
- Atos 15:34
- Atos 24:7
- Romanos 16:25

## Snapshot congelado

Este diretório é a base da Merkle root registrada on-chain. Depois que a
root for gravada, **nenhuma alteração é permitida** — a WEB recebe revisões
upstream ocasionais, que NÃO devem ser incorporadas: qualquer mudança aqui
invalida a validação on-chain.
