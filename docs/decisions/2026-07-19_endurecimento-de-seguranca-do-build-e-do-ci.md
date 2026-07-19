# Decisão: Endurecimento de segurança do build e do CI

**Data:** 2026-07-19
**Status:** aceita
**Autor:** Claude (auditoria de segurança pedida pelo Alexandre)

---

## Contexto

O repositório é **público**. Auditoria sobre os 23 commits confirmou que
**nenhum segredo jamais foi versionado** — sem chave privada, sem keypair
Solana, sem token, sem connection string, sem ARN. Os secrets do CI são
referenciados por nome e a AWS usa OIDC.

Mas a auditoria encontrou falhas de **configuração**, e uma delas invalidava
uma garantia que a ADR do toolchain afirmava ter.

---

## O achado que importava

`Dockerfile.build` instalava o `avm` assim:

```
cargo install --git https://github.com/coral-xyz/anchor avm --locked
```

Sem `--tag`, isso compila **o que estiver no branch default do repositório do
Anchor no momento do build**. `--locked` só respeita o `Cargo.lock` de lá; não
fixa o commit. Dois builds da mesma imagem, em datas diferentes, podiam
instalar `avm` diferentes — e é o `avm` que instala o Anchor que compila o
programa que vai **imutável** para a chain.

Isso contradizia frontalmente a ADR `2026-07-19_toolchain-do-programa-anchor.md`,
que justifica a existência do container pela reprodutibilidade do bytecode. A
promessa estava escrita, mas não era verdadeira.

**Correção:** `--tag v${ANCHOR_VERSION}`.

Registrado junto: **não trocar por `cargo install avm` do crates.io.** Lá o
nome `avm` pertence a outro pacote ("Manages node.js installations"). A
colisão de nome é uma armadilha de dependency confusion para quem tentar
"simplificar" essa linha depois.

---

## Demais correções

| # | Onde | Problema | Correção |
|---|------|----------|----------|
| 1 | `release.yml` (job `summary`) | `${{ github.event.release.tag_name }}` interpolado dentro de `run:` — injeção de shell via nome de tag | Passa por `env:`, referenciado como `${TAG_NAME}` |
| 2 | `ci.yml`, `release.yml` | Sem `permissions:` — herdavam o default do repositório, que pode conceder escrita ao `GITHUB_TOKEN` | `permissions: contents: read` no topo; `deploy-api` amplia só para `id-token: write` (OIDC) |
| 3 | `release.yml` (deploy web) | `vercel@latest` recebendo `VERCEL_TOKEN` — qualquer release publicada da CLI ganharia o token | Versão fixada |
| 4 | `release.yml` (deploy web) | `--token="$VERCEL_TOKEN"` na linha de comando expõe o segredo no `argv` do runner | Removido; a CLI lê `VERCEL_TOKEN` do ambiente |
| 5 | Ambos workflows | Actions em tag mutável (`@v4`) | Fixadas em SHA, com a tag em comentário |

A injeção do item 1 exige write access para ser explorada (só mantenedor
publica release), então a severidade hoje é baixa. Foi corrigida porque o
custo é uma linha e porque o modelo de ameaça muda no instante em que um bot
de release entrar no fluxo.

---

## Dependências

`pnpm audit` acusava 6 vulnerabilidades, **todas em ferramenta de
desenvolvimento**, nenhuma explorável no estado atual do projeto (a crítica do
Vitest exige `vitest --ui`, que não usamos; as do Vite são do dev server, que
só existe a partir da S04). Foram corrigidas mesmo assim, porque entram no
caminho crítico quando a web chegar:

- **Vitest 2 → 4**, que resolve a crítica e arrasta Vite e esbuild corrigidos.
  Os 43 testes passam sem alteração — usam só `describe`/`it`/`expect`.
- **`vite` como devDependency direta.** Não usamos Vite diretamente; ele é
  peer **opcional** do Vitest, e por ser opcional o pnpm reaproveitava um
  `vite@5.4.21` obsoleto do lockfile em vez de resolver a versão que o Vitest
  4 exige. `pnpm.overrides` não resolve isso — override não alcança peer
  opcional. Declarar a dependência é o que força a resolução correta.
- **`uuid` via override** (`"uuid@<11.1.1": ">=11.1.1"`), transitiva de
  `@solana/web3.js > jayson`.

Sobre o `uuid`: o caminho vulnerável (bounds check em v3/v5/v6 quando `buf` é
passado) é **inalcançável** aqui — `jayson` chama `uuid.v4()` sem argumentos.
Foi corrigido assim mesmo por uma razão operacional, não técnica: `pnpm audit`
permanentemente vermelho treina todo mundo a ignorar o `pnpm audit`, e aí o
achado que importa passa despercebido. O resultado agora é **0
vulnerabilidades**, o que torna qualquer regressão futura visível.

---

## Consequências

**Positivas:**
- A reprodutibilidade que a ADR do toolchain promete passa a ser real
- Superfície de CI fechada antes de existir qualquer secret de produção em uso
- `pnpm audit` limpo, portanto utilizável como sinal

**Negativas / Trade-offs:**
- Actions fixadas em SHA exigem atualização manual (ou Dependabot)
- Versão do Vercel CLI fixada precisa ser bumpada de tempos em tempos
- Uma devDependency (`vite`) que não usamos diretamente, existindo só para
  forçar resolução — comentada aqui para ninguém "limpar" depois

**Impacto no código:**
- `Dockerfile.build`, `.github/workflows/{ci,release}.yml`, `package.json`,
  `pnpm-lock.yaml`

---

## Revisão futura

Revisitar ao final da S03, quando existirem secrets de produção reais
(Supabase, AWS, provider de RPC) — o modelo de ameaça muda quando o CI passa a
ter acesso a infraestrutura viva. O item 1 (injeção via tag) deve ser
reavaliado como severidade alta se algum dia um bot passar a publicar releases.
