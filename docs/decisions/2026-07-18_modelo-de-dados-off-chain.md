# Decisão: Modelo de dados off-chain — Registro separado do Catálogo

**Data:** 2026-07-18
**Status:** aceita (Alexandre confirmou o objetivo do espelho: "dado fresco e confiável com o que tem na blockchain", exibindo registrados, pendentes e quem registrou)
**Autor:** Claude (em resposta à dúvida do Alexandre: "vale adicionar no registro qual tradução é?")

---

## Contexto

Ao desenhar a tabela de versículos, surgiu a questão de incluir a tradução
na linha do registro, junto com os dados on-chain (endereço da conta, quem
registrou, transação). Mas o banco acumula duas responsabilidades distintas:
espelhar o estado on-chain (Registro) e servir texto para leitura e busca
(Catálogo) — e a evolução multi-tradução já prevista afeta só a segunda.

---

## Opções consideradas

| Opção | Prós | Contras |
|-------|------|---------|
| Tabela única `verses` com coluna `translation` | Uma tabela só | Conflitos de semântica: sugere que a mesma posição pode ser registrada por tradução (falso — on-chain só existe a canônica); texto duplicado quando vierem traduções de exibição |
| Registro separado do Catálogo — a escolhida | Espelha os bounded contexts já definidos (Registro / Catálogo); adicionar tradução de exibição = inserir linhas, zero migração; linha de registro enxuta = espelho fiel da VerseAccount | Uma join a mais nas listagens (trivial com índices) |

---

## Decisão tomada

> **Quatro tabelas: `translations` e `verse_texts` (Catálogo); `books` (compartilhada); `verses` (Registro)**

```
translations                     -- Catálogo: traduções disponíveis
  id             smallserial PK
  code           text UNIQUE     -- 'engwebp'
  name           text            -- 'World English Bible'
  language       text            -- 'en'
  license        text            -- 'public domain'
  source_url     text
  is_canonical   boolean         -- exatamente uma TRUE (índice único parcial);
                                 -- é a tradução registrada on-chain

books                            -- compartilhada pelos dois contextos
  id             smallint PK     -- 1-66, mesmo índice das seeds da PDA
  slug           text UNIQUE
  name           text
  abbreviation   text
  testament      text            -- OLD | NEW
  chapters_count smallint

verse_texts                      -- Catálogo: o texto em si
  translation_id smallint FK → translations
  book           smallint FK → books
  chapter        smallint
  verse          smallint
  text           text NULL      -- NULL = posição omitida na tradução
                                 -- (5 casos na WEB); não registrável
  PK (translation_id, book, chapter, verse)

verses                           -- Registro: espelho do estado on-chain
  book           smallint FK → books
  chapter        smallint
  verse          smallint
  status         verse_status    -- AVAILABLE | PENDING | REGISTERED | FAILED
  adopter        text NULL      -- pubkey da carteira que registrou
  transaction    text NULL      -- assinatura da transação
  account        text NULL      -- endereço da PDA (derivável das seeds +
                                 -- program id; armazenado como cache)
  slot           bigint NULL    -- slot da confirmação (reconciliação/reorg)
  registered_at  timestamptz NULL
  PK (book, chapter, verse)
  -- somente posições registráveis: 31.098 linhas
```

A tradução fica registrada no banco — em `translations`, com `is_canonical`
apontando a que vive on-chain — mas fora da linha de registro, onde seria
redundante e semanticamente errada.

---

## Consequências

**Positivas:**
- Adicionar tradução de exibição (pt-BR etc.) = inserir linhas em
  `translations` + `verse_texts`; nada muda em `verses`
- `verses` é espelho 1:1 da VerseAccount — reconstrução pelo indexer é direta
- Busca textual (tsvector/pg_trgm) indexa `verse_texts`, por tradução
- As 5 posições omitidas ficam explícitas (`text NULL`) — a UI pode exibir
  "versículo omitido nesta tradução" em vez de um buraco na numeração

**Negativas / Trade-offs:**
- Join `verses` × `verse_texts` nas listagens (barato; índices por PK)
- A tabela `chapters` da spec original é dispensada — `chapters_count` em
  `books` + versificação do CanonicalText cobrem o uso

**Impacto no código:**
- Schema Drizzle em `packages/infrastructure/`
- Script de seed: popula `translations` (WEB, canônica), `books`,
  `verse_texts` e as 31.098 linhas AVAILABLE de `verses`

---

## Revisão futura

Revisitar quando a camada de exibição multi-tradução for implementada
(possível coluna de versificação por tradução, se alguma não seguir a
numeração tradicional).
