# Sprint S01 — Tasks

> Prefixos: **FD** = fundação/tooling · **CT** = catálogo/Merkle
> Objetivo e critério de pronto em [`GOALS.md`](GOALS.md).

## Fundação

- [x] **FD-01** Monorepo pnpm — `pnpm-workspace.yaml`, `package.json` raiz,
      `tsconfig.base.json`. Layout de `docs/architecture/STACK.md`:
      `apps/{web,api}` + `packages/{domain,application,infrastructure,blockchain,shared}`
      + `programs/`. Apps e pacotes ainda sem código entram com `package.json`
      mínimo só para fixar o workspace.
- [x] **FD-02** Tooling — TypeScript strict, linter/formatter (avaliar Biome
      vs ESLint+Prettier → **ADR**), Vitest com projeto por pacote. Scripts
      raiz: `test`, `typecheck`, `lint`.
- [x] **FD-03** CI no GitHub Actions (`.github/workflows/ci.yml`):
      `typecheck` + `lint` + `test` em push e PR, com cache do pnpm, mais job
      dedicado que roda `catalog:verify` e `catalog:merkle --check`.
- [x] **FD-04** `packages/domain` — entidades e regras puras, sem I/O:
      `VerseAddress` (book/chapter/verse, validação de faixa), `Book`,
      `Testament`, `VerseStatus`, e a noção de **posição não-registrável**
      (as 5 omitidas da WEB). Termos exatamente como no glossário —
      `adopter`, nunca `owner`; `register`, nunca `adopt`.
- [x] **FD-05** `packages/shared` — tipos comuns e `Result<T>` (padrão de erro
      do `CODE_STYLE.md`).
- [x] **FD-06** Testes unitários do domínio — faixas válidas/inválidas,
      transições de status, rejeição das posições não-registráveis.
      Arquivos em `__tests__/unit.test.ts` (convenção do projeto).

## Catálogo

- [x] **CT-01** Geração do dataset movida para o workspace: o script solto
      `scripts/build-canonical-text.mjs` virou `pnpm catalog:build`
      (`packages/catalog/src/cli/build-dataset.ts`), com a tabela de livros
      extraída para `src/books.ts` e a validação de contiguidade preservada.
      **Verificado:** regenerar do VPL original reproduz os 66 arquivos
      commitados byte a byte.
- [x] **CT-02** `pnpm catalog:verify` — verificação independente do dataset
      commitado: 66 livros, 1.189 capítulos, 31.098 versículos registráveis,
      exatamente as 5 posições `null` esperadas (Lc 17:36, At 8:37, At 15:34,
      At 24:7, Rm 16:25), sem lacuna de numeração. Roda no CI.
- [x] **CT-03** Construção da Merkle tree — folha canônica
      `hash(book, chapter, verse, text)` com **encoding fixo e documentado**
      (ordem, tipos, separadores; sem ambiguidade possível). Função de hash a
      definir: precisa ser barata em compute units na verificação on-chain →
      avaliar `keccak`/`sha256` do Solana → **ADR**.
- [x] **CT-04** Root commitada no repositório em arquivo próprio, com metadados
      (fonte, contagem, data, algoritmo). É o artefato que a S02 consome.
- [x] **CT-05** Teste de reprodutibilidade — regenerar do dataset e comparar
      com a root commitada; **falha o CI** se divergir. Este teste é a
      garantia central da auditabilidade pública do projeto.
- [x] **CT-06** Geração de proof para um versículo — API do Catálogo que a
      web (S04) e os testes do programa (S02) vão consumir. Incluir teste com
      **Ester 8:9** (o versículo mais longo, 493 bytes) e um caso de proof
      inválida.
- [x] **CT-07** Medir e documentar o orçamento de transação com os números
      reais medidos — insumo do spike **PG-00** da S02 (ver risco R1 no
      ROADMAP). Deixar os números num arquivo do Catálogo, não só na ADR.

## Pendências operacionais

> Tudo aqui precisa estar resolvido **antes ou junto do primeiro commit** —
> depois de publicado, o histórico do git carrega o que entrou.

- [x] **FD-07** `git` — **concluído em 2026-07-19.** Commit inicial `240f5d2`
      publicado em `git@github.com:alxdfm/eternal-word.git`, branch `main`.
- [x] **FD-08** `LICENSE` do código — **MIT** (Alexandre, 2026-07-19).
      Titular gravado como "Eternal Word contributors"; trocar pelo nome
      legal se preferir atribuição pessoal. O texto bíblico é domínio público
      e fica fora da licença (nota no próprio `LICENSE` + `PROVENANCE.md`).
- [x] **FD-09** Faxina da raiz — **`asv.txt` removido em 2026-07-19**
      (Alexandre). `project-skeleton.zip` e `scripts/onboarding.sh` ficam
      como referência do template; ambos inertes (zip ignorado no git, script
      com guard).
- [ ] **FD-10** Contas e serviços externos — **provisionar ao final da S03**
      (refinado em 2026-07-19; ver a tabela de smoke tests no ROADMAP):
      projeto no Supabase, infra AWS (incl. role de OIDC para o deploy) e
      provider de RPC/webhook. O smoke test da S02 é on-chain em devnet e
      **não depende de nada disso**.
      **Exceção — domínio:** único item cuja espera tem risco real (o nome
      pode ser registrado por outra pessoa). Verificar disponibilidade e
      garantir o nome cedo, mesmo sem apontar para nada.
      **Consequência para o planejamento:** S03 e S04 são desenvolvidas
      contra ambiente local (Postgres em Docker, validador local ou devnet
      público) e só encostam em infra real no smoke test. As tasks dessas
      sprints precisam nascer com essa premissa — nada de acoplar código a
      serviço gerenciado sem camada de porta/adapter.
      O domínio é o item de maior prazo: vale checar disponibilidade cedo.
- [x] **FD-11** Ligar o job `catalog` do CI ao `catalog:verify` (CT-02) e à
      verificação de reprodutibilidade da root (CT-05), substituindo a
      verificação inline que está no workflow hoje.
