# CLAUDE.md — Project Intelligence

> Este arquivo é o ponto de entrada para toda sessão de trabalho.
> Leia-o completamente antes de qualquer ação.

---

## ⚡ Protocolo de início de sessão

**Ao abrir qualquer sessão neste projeto, faça SEMPRE em ordem:**

1. Leia este CLAUDE.md completo
2. Leia `docs/architecture/STACK.md` para entender a stack atual
3. Leia `docs/conventions/UBIQUITOUS_LANGUAGE.md` para a linguagem do domínio
4. Se existir `session-delta` MCP disponível → chame `session_start("eternal-word")`
5. Se não existir → leia o arquivo `docs/sessions/latest.md` se existir
6. Confirme: "Contexto carregado. Stack: [X]. Domínio: [Y]. Pronto."

**Nunca assuma contexto que não foi lido. Nunca invente nomes de variáveis, funções ou módulos sem consultar a linguagem ubíqua.**

---

## 🎯 Sobre este projeto

```
Nome:        eternal-word
Domínio:     Plataforma sem fins lucrativos para registro permanente e
             colaborativo da Bíblia na blockchain Solana — cada usuário
             "adota" versículos pagando o rent e as taxas de rede.
Status:      draft
Iniciado em: 2026-07-18
```

> Onboarding concluído em 2026-07-18 — todos os documentos estão preenchidos.
> `scripts/onboarding.sh` é artefato do template e **não deve ser reexecutado**
> (corromperia os docs já preenchidos); ele tem guard e sai sem fazer nada.

---

## 📐 Regras de trabalho

### Arquivos e módulos
- Nenhum arquivo deve ultrapassar **400 linhas**. Se ultrapassar, proponha divisão.
- Um arquivo = uma responsabilidade. Sem misturar domínios.
- Nomes de arquivos sempre em `kebab-case`. Nomes de classes em `PascalCase`.

### Antes de criar qualquer código
1. Confirme que entende o requisito
2. Verifique se já existe algo parecido no codebase (`rg "termo-chave"`)
3. Verifique a linguagem ubíqua em `docs/conventions/UBIQUITOUS_LANGUAGE.md`
4. Proponha a abordagem **antes** de implementar se for algo novo

### Busca no codebase
- Use `rg` (ripgrep) para buscas de texto — nunca `grep` puro
- Use `sg` (ast-grep) para buscas estruturais (padrões de código, AST)
- Consulte `.ripgrepignore` para entender o que é ignorado
- Sempre filtre ruído: `rg "termo" --type ts` em vez de busca global

### Decisões técnicas
- Toda decisão não-trivial deve ser registrada em `docs/decisions/`
- Use o template: `docs/decisions/_TEMPLATE.md`
- Uma decisão por arquivo, nomeada `YYYY-MM-DD_titulo.md`

### Ao encerrar sessão
- Se `session-delta` MCP disponível → chame `session_end("resumo do que foi feito")`
- Se não → atualize `docs/sessions/latest.md` com o resumo

---

## 🗂️ Mapa do projeto

```
CLAUDE.md                    ← você está aqui
README.md                    ← visão do produto (Eternal Word)
LICENSE                      ← MIT (código); texto bíblico é domínio público
.github/workflows/           ← ci.yml (push/PR) + release.yml (deploy por release)
data/
  canonical-text/            ← CanonicalText (WEB, inglês) — 1 JSON por livro
                               + PROVENANCE.md (snapshot CONGELADO — não editar)
docs/
  architecture/
    STACK.md                 ← stack, versões, decisões de infra
    OVERVIEW.md              ← diagrama de alto nível do sistema
  conventions/
    UBIQUITOUS_LANGUAGE.md   ← glossário do domínio (source of truth)
    CODE_STYLE.md            ← padrões de código específicos da stack
  decisions/
    _TEMPLATE.md             ← template para registrar decisões
    YYYY-MM-DD_*.md          ← decisões registradas
  sessions/
    latest.md                ← contexto da última sessão (fallback sem MCP)
sprints/
  ROADMAP.md                 ← sequência de sprints, riscos abertos, DoD global
  2026-SXX/                  ← GOALS.md + tasks.md por sprint
scripts/
  onboarding.sh              ← artefato do template, neutralizado (não reexecutar)
apps/                        ← web (S04) e api/indexer (S03) — placeholders
packages/
  domain/  catalog/  shared/ ← implementados
  application/ infrastructure/ blockchain/ ← placeholders
.ripgrepignore               ← o que o agente NÃO deve ler
.gitignore                   ← padrão
```

> A estrutura de código (monorepo `apps/` + `packages/` + `programs/`) ainda
> não foi criada — o layout alvo está documentado em `docs/architecture/STACK.md`.

---

## 🚫 Guardrails — nunca faça isso

- **Nunca** crie arquivos fora da estrutura acima sem propor e receber confirmação
- **Nunca** use sinônimos para termos do domínio — consulte sempre `UBIQUITOUS_LANGUAGE.md`
- **Nunca** deixe um TODO sem uma issue ou decisão linkada
- **Nunca** instale uma dependência nova sem registrar o motivo em `docs/decisions/`
- **Nunca** faça refactor em escopo maior que o pedido — proponha separado
- **Nunca** rode comandos destrutivos (`drop`, `delete`, `rm -rf`) sem confirmação explícita

---

## 📎 Referências rápidas

- Convenções de código: `docs/conventions/CODE_STYLE.md`
- Stack atual: `docs/architecture/STACK.md`
- Glossário: `docs/conventions/UBIQUITOUS_LANGUAGE.md`
- Última sessão: `docs/sessions/latest.md`
- Sprint atual e riscos: `sprints/ROADMAP.md`
