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
- **Processamento** (via `pnpm catalog:build <engwebp_vpl.txt>`):
  - espaços normalizados; aspas tipográficas da fonte preservadas;
  - títulos dos Salmos integrados ao versículo 1 (convenção da fonte);
  - o texto dos versículos não foi alterado.

## Posições omitidas (`null`)

A WEB preserva a numeração tradicional (KJV), mas segue o Texto Majoritário
no Novo Testamento. Cinco posições ficam sem texto e aparecem como `null` no
JSON — existem na versificação e **não são registráveis** on-chain. Elas não
são todas do mesmo tipo:

**Quatro são variantes textuais ausentes** dos manuscritos que embasam o
Texto Majoritário. O texto não existe nesta tradução:

- Lucas 17:36 — paralelo de Mateus 24:40
- Atos 8:37 — confissão do eunuco etíope; citada por Ireneu (c. 180 d.C.)
- Atos 15:34
- Atos 24:7 — parte da passagem de Lísias

**Uma é apenas deslocamento de numeração.** Romanos 16:25 está vazio porque
a WEB coloca a doxologia final ao fim do capítulo 14, seguindo o Texto
Majoritário. **O texto existe e é registrável** — em Romanos 14:24-26, que
por isso tem 26 versículos em vez dos 23 tradicionais. Nada de Romanos se
perde no registro; muda o endereço.

## Snapshot congelado

Este diretório é a base da Merkle root registrada on-chain. Depois que a
root for gravada, **nenhuma alteração é permitida** — a WEB recebe revisões
upstream ocasionais, que NÃO devem ser incorporadas: qualquer mudança aqui
invalida a validação on-chain.
