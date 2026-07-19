# Linguagem Ubíqua — Glossário do Domínio

> **Esta é a source of truth para todos os nomes usados no projeto.**
> Código, variáveis, funções, tipos, rotas, mensagens de UI e documentação
> devem usar EXATAMENTE os termos definidos aqui. Sem sinônimos.
>
> Quando um novo conceito surgir → adicione aqui ANTES de criar o código.

---

## Como usar este arquivo

O agente deve consultar este glossário:
- Antes de nomear qualquer variável, função, módulo ou tipo
- Antes de criar endpoints ou eventos
- Ao revisar código que usa termos não listados aqui

Se um termo não está aqui e não é óbvio → **pergunte antes de inventar**.

---

## Glossário

> Formato: `**Termo** — Definição. [Nunca use: sinônimo1, sinônimo2]`

### Entidades principais

**Verse** — Menor unidade registrável do sistema; identificado pela tripla
`(book, chapter, verse)` na versificação canônica. Entidade principal.
[Nunca use: passage, scripture, text (para se referir à entidade)]

**Book** — Um dos 66 livros da Bíblia, com índice canônico numérico de 1 a 66
(`bookIndex`) usado nas seeds da PDA. Nome e abreviação vivem no Catálogo.
[Nunca use: volume; strings como seed de PDA]

**Chapter** — Subdivisão numerada de um Book. Total: 1.189 capítulos.
[Nunca use: section]

**VerseAccount** — Conta on-chain (PDA) que armazena um Verse registrado.
Exatamente uma por versículo; a existência da conta é o registro, imutável.
[Nunca use: verse record, verse NFT]

**Adopter** — Carteira que pagou e registrou um Verse. Campo `adopter` na
VerseAccount e coluna `wallet` no banco.
[Nunca use: owner (colide com o `owner` nativo de contas Solana), sponsor, buyer]

**CanonicalText** — Dataset off-chain com o texto oficial da tradução
escolhida: World English Bible (WEB, domínio público, inglês moderno),
snapshot congelado em `data/canonical-text/` (1 JSON por livro). Fonte da
Merkle root usada na validação on-chain. Posições `null` (5 versículos da
numeração tradicional sem texto na WEB) não são registráveis.
[Nunca use: bible source, original text]

**Testament** — Divisão da Bíblia: `OLD` | `NEW`.

---

### Ações / Verbos

**register** — Ato completo de registrar um Verse on-chain: assinar a
transação que cria a VerseAccount. Instrução Anchor: `register_verse`.
Caso de uso: `registerVerse`.
[Nunca use no código: adopt, claim, mint, buy, save]

---

### Estados / Status

**AVAILABLE** — Verse sem VerseAccount; pode ser registrado.
**PENDING** — Transação enviada, aguardando confirmação do indexer.
**REGISTERED** — VerseAccount confirmada on-chain. Estado final e permanente.
**FAILED** — Transação falhou ou expirou; retorna a AVAILABLE após reconciliação.

---

### Eventos

**VerseRegistered** — Disparado quando o indexer confirma uma nova
VerseAccount. Payload: `{ book, chapter, verse, adopter, transaction, registeredAt }`.

---

## Mapeamento de código → domínio

> Para casos onde o código usa um nome técnico mas o domínio usa outro.

| No código | No domínio | Motivo |
|-----------|-----------|--------|
| `register` | "adopt" (en) / "adotar" (pt-BR) na UI/marketing | O verbo canônico do código é `register`; a metáfora de adoção é termo de produto, permitida apenas em textos de UI e marketing (via chaves i18n) |
| `adopter` | "quem adotou o versículo" | Renomeado de `owner` para evitar colisão com o `owner` nativo de contas Solana (programa dono da conta) |

---

## Termos BANIDOS neste projeto

> Termos que já causaram confusão e foram substituídos.

| Banido | Use em vez disso | Motivo |
|--------|-----------------|--------|
| `owner` | `adopter` | Em Solana, `owner` já significa o programa dono da conta |
| `adopt` (em código) | `register` | Um único verbo no código; "adotar" fica restrito à camada de produto/UI |
