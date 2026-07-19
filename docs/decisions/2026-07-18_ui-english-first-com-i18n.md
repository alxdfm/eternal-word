# Decisão: UI English-first com i18n pronto desde o início

**Data:** 2026-07-18
**Status:** aceita
**Autor:** Alexandre ("English first, mas com o sistema de translates i18n pronto para implementação de novas traduções")

---

## Contexto

Com o texto on-chain em inglês (KJV) e o produto mirando alcance global,
ficou aberta a questão do idioma da interface: nascer em português (público
brasileiro inicial), apenas em inglês, ou inglês com infraestrutura de
internacionalização desde o primeiro componente.

---

## Opções consideradas

| Opção | Prós | Contras |
|-------|------|---------|
| UI apenas em português | Público inicial brasileiro | Contradiz o posicionamento global; retrabalho ao internacionalizar |
| UI apenas em inglês, sem i18n | Menos infra no início | Strings hardcoded viram dívida; adicionar idiomas depois exige refactor amplo |
| English-first + i18n desde o início — a escolhida | Alcance global imediato; adicionar um idioma = adicionar um arquivo de mensagens, sem tocar componentes | Pequeno overhead por string (chaves de mensagem em vez de texto direto) |

---

## Decisão tomada

> **Inglês como locale padrão; toda string de UI via sistema de mensagens i18n**

Nenhum texto hardcoded em componentes — desde o primeiro. Novas traduções da
UI (pt-BR é a primeira candidata) entram como arquivos de mensagens.
Biblioteca provável: `next-intl` (padrão de facto para Next.js App Router) —
confirmar no scaffolding e registrar em STACK.md.

Escopo: esta decisão cobre as **strings da interface**. A exibição do texto
bíblico em outras traduções (camada off-chain sobre o registro KJV) é um
sistema separado, já previsto como evolução futura.

---

## Consequências

**Positivas:**
- Produto global desde o lançamento; PT (e outros idiomas) plugáveis sem refactor
- Disciplina de conteúdo: strings centralizadas e revisáveis

**Negativas / Trade-offs:**
- Toda string passa por chave de mensagem (custo pequeno e constante)
- Termos do domínio precisam de forma canônica por idioma no glossário
  (ex.: "adopt" / "adotar" como termo de produto)

**Impacto no código:**
- `apps/web/` (provider i18n, `messages/en.json` como base)
- `docs/conventions/UBIQUITOUS_LANGUAGE.md` (termos de UI por idioma)

---

## Revisão futura

Revisitar a escolha da biblioteca no scaffolding do `apps/web`; revisitar a
lista de locales quando houver demanda real de outros idiomas.
