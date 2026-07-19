# Decisão: Extensibilidade para traduções e conteúdo editorial (não construir agora)

**Data:** 2026-07-18
**Status:** aceita
**Autor:** Alexandre ("Não vamos fazer, mas vale deixar aberto para novas traduções e outros registros gerais... como anotações sobre contextos históricos e explicações sobre termos usados")

---

## Contexto

Bíblias de estudo trazem conteúdo além do texto: notas de contexto
histórico, explicações de termos, referências cruzadas. Nada disso será
construído agora, mas o modelo de dados não pode fechar a porta — adicionar
esse conteúdo no futuro deve ser acréscimo, nunca migração.

---

## Opções consideradas

| Opção | Prós | Contras |
|-------|------|---------|
| Modelar tabelas de anotações já | "Pronto" desde o início | Construir o que não será usado; chute de requisitos |
| Ignorar o tema | Zero esforço | Risco de decisões futuras quebrarem o endereçamento |
| Fixar o princípio do endereço universal, sem construir — a escolhida | Custo zero hoje; qualquer conteúdo futuro pluga como tabela nova | Exige disciplina: todo conteúdo novo ancora no endereço canônico |

---

## Decisão tomada

> **Dois princípios, nenhuma tabela nova agora**

**1. On-chain permanece mínimo e definitivo.** Só o texto canônico (WEB) vai
para a blockchain. Traduções adicionais, anotações e qualquer conteúdo
editorial são camada de exibição **off-chain** — sempre.

**2. O endereço universal é `(book, chapter, verse)`.** Todo conteúdo
presente ou futuro ancora nessa tripla (a mesma das seeds da PDA). Novas
traduções já pluga em `translations` + `verse_texts`; anotações, quando (e
se) vierem, entram como tabela própria sem tocar Registro nem Catálogo:

```
verse_annotations (esboço futuro — NÃO construir agora)
  book, chapter, verse       -- âncora canônica (+ verse_end para intervalos)
  type                       -- HISTORICAL_CONTEXT | TERM_EXPLANATION | ...
  translation_id NULL       -- nota sobre wording de uma tradução específica;
                             -- NULL = vale para todas
  language                   -- conteúdo editorial segue a decisão de i18n
  content, source
```

---

## Consequências

**Positivas:**
- Zero custo agora; extensão futura é `CREATE TABLE`, não migração
- Fronteira nítida preservada: o eterno (on-chain) vs o editorial (off-chain)

**Negativas / Trade-offs:**
- Disciplina permanente: nenhum conteúdo futuro pode inventar endereçamento
  próprio (ex.: "Gn 1:1" como string) — sempre a tripla numérica

**Impacto no código:**
- Nenhum agora. Guardrail para schemas futuros em `packages/infrastructure/`

---

## Revisão futura

Quando anotações forem priorizadas: definir autoria/moderação do conteúdo
editorial (quem escreve, quem revisa) — fora do escopo desta decisão.
