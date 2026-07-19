# Convenções de Código

> Específico para a stack deste projeto (TypeScript + Rust/Anchor).
> Atualize conforme padrões novos forem estabelecidos.

---

## Princípios gerais

1. **Explícito > implícito** — nomes longos e claros valem mais que abreviações
2. **Funções pequenas** — máximo 30 linhas por função; se maior, extraia
3. **Um nível de abstração por função** — não misture lógica de negócio com I/O
4. **Erro explícito** — nunca silenciar erros; sempre logar ou propagar
5. **Sem estado global** — state deve ser local ou passado explicitamente

---

## Nomenclatura

```
variáveis:      camelCase         → bookIndex, verseText
constantes:     SCREAMING_SNAKE   → MAX_VERSE_LENGTH, PDA_SEED_VERSE
funções:        camelCase + verbo → registerVerse(), findAvailableVerses()
classes/tipos:  PascalCase        → VerseAccount, RegisterVerseInput
arquivos:       kebab-case        → verse-account.ts, register-verse.ts
pastas:         kebab-case        → packages/blockchain/, src/verse-catalog/
Rust:           snake_case fns/campos, PascalCase structs → register_verse, VerseAccount
```

> **Atenção:** use sempre os termos do `UBIQUITOUS_LANGUAGE.md` nos nomes acima.

---

## Idioma

- Mensagens de erro e logs: sempre em **inglês**
- Comentários inline: podem ser em português; documentação técnica: inglês
- Textos de UI: inglês (locale padrão), sempre via chaves i18n — nunca
  hardcoded em componentes; pt-BR é a primeira locale adicional planejada

---

## Padrões específicos da stack

### TypeScript

```typescript
// ✅ Prefira tipos explícitos em interfaces públicas
interface RegisterVerseInput {
  book: number
  chapter: number
  verse: number
}

// ❌ Evite `any` — use `unknown` e narrowing

// ✅ Result pattern para erros de negócio (não throw)
type Result<T> = { ok: true; data: T } | { ok: false; error: string }
```

### Funções assíncronas

```typescript
// ✅ Sempre trate o erro explicitamente
const result = await fetchVerseStatus(id).catch(err => {
  logger.error('fetchVerseStatus failed', { id, err })
  return null
})

// ❌ Nunca deixe promise sem .catch ou try/catch

// ❌ Nunca use forEach para operações async — use for...of ou Promise.all
// ✅ Prefira Map a filter/find repetidos em arrays grandes (31k+ versículos)
```

### Rust / Anchor

```rust
// ✅ Erros customizados com mensagens em inglês
#[error_code]
pub enum EternalWordError {
    #[msg("Verse text does not match the canonical text")]
    InvalidCanonicalProof,
}

// ✅ Espaço de conta calculado com constantes nomeadas, nunca números mágicos
// ✅ require!/require_keys_eq! em vez de unwrap/panic
// ❌ O programa NÃO deve ter instruções de update nem close (imutabilidade)
```

---

## Testes

```
unitários:    __tests__/unit.test.ts          (Vitest)
integração:   __tests__/integration.test.ts   (Vitest)
programa:     programs/eternal-word/tests/    (anchor test, bankrun/litesvm a definir)
```

---

## Estrutura de um módulo

```
src/
  {feature}/
    index.ts           ← exportações públicas do módulo
    {feature}.ts       ← lógica principal
    {feature}.types.ts ← tipos e interfaces
    {feature}.utils.ts ← helpers locais (não exportar para fora)
    __tests__/
      unit.test.ts
```

---

## Comentários — o quê vs por quê

```typescript
// ❌ Ruim — descreve O QUÊ (óbvio pelo código)
// Incrementa o contador
counter++

// ✅ Bom — explica O POR QUÊ (não óbvio)
// A PDA usa índices numéricos (1-66) e não nomes de livros porque
// strings variam entre traduções e quebrariam o determinismo do endereço
const seeds = [SEED_VERSE, bookIndex, chapter, verse]
```

**Regra:** Se o código já diz o que faz, o comentário é ruído.
Comente apenas decisões não-óbvias, workarounds e trade-offs.

---

## Imports

```typescript
// Ordem: externos → internos → tipos
import { Connection } from '@solana/web3.js'
import { db } from '@/lib/database'
import type { Verse } from '@eternal-word/domain'
```

---

## Commits

```
Conventional Commits: type(scope): description in English
Tipos comuns:         feat, fix, refactor, chore, docs, test
Apenas primeira linha — sem body, sem trailers
Staging sempre explícito — nunca `git add .` ou `git add -A`
```

---

## Proibido neste projeto

```
- Não usar forEach com callbacks async (use for...of ou Promise.all)
- Não usar var (use const/let)
- Não usar console.log em produção (use o logger configurado)
- Não usar `any` (use unknown + narrowing)
- Não usar o termo `owner` em código (ver UBIQUITOUS_LANGUAGE.md)
```
