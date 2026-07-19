# Decisão: Toolchain do programa Anchor e integração ao monorepo

**Data:** 2026-07-19
**Status:** aceita
**Autor:** Claude (PG-01 da S02 — a task exige ADR das versões)

---

## Contexto

O programa é a única parte irreversível do projeto: sem instrução de `update`
nem de `close`, e com contas permanentes depois do go-live. Isso muda o
critério para escolher toolchain — o que importa não é a versão mais nova, é
**conseguir provar depois qual toolchain gerou o bytecode publicado**. Um
binário compilado com versão diferente da registrada é indistinguível de um
binário adulterado por quem audita.

O Alexandre também definiu duas restrições de ambiente (2026-07-19): build
**em container** e **nada de localnet** — a validação real acontece em devnet.

---

## Opções consideradas

### Onde roda a toolchain

| Opção | Prós | Contras |
|-------|------|---------|
| Instalar Agave e Anchor direto na VM | Um passo a menos; sem overhead de container | Versão passa a depender do estado da máquina; ninguém consegue reproduzir o bytecode a partir do repositório |
| **Container `Dockerfile.build` — a escolhida** | Versões fixadas no arquivo, versionado junto com o código; qualquer pessoa reproduz | Imagem de 2,7 GB; primeiro build demora (o `avm` compila) |

Vale registrar **por que** o container existe aqui. Num host antigo demais para
Agave 3.x (glibc anterior à 2.32), ele é necessidade pura. Esta VM é Ubuntu
24.04 (glibc 2.39) e rodaria nativamente — o container existe por
reprodutibilidade, não por compatibilidade. A distinção importa: herdar a
justificativa errada faria alguém remover o container assim que percebesse que
a máquina roda a toolchain sozinha, perdendo a garantia que de fato interessa.

### Versões

| Componente | Versão | Por quê |
|-----------|--------|---------|
| Agave (Solana CLI) | 3.1.13 | Traz platform-tools v1.43 (cargo 1.85+, suporte a edition2024) |
| Anchor CLI | 1.0.0 | Via `avm`, casada com a versão do Agave acima |
| `anchor-lang` (crate) | 1.1.2 | Resolvido pelo caret `"1.0.0"` do scaffold; **fixado pelo `Cargo.lock`, que é versionado** |
| Rust (host, no container) | 1.97.1 | `stable` no momento do build da imagem |

---

## Decisão tomada

> **Container com Agave 3.1.13 + Anchor CLI 1.0.0; `Cargo.lock` versionado
> como o pin real das crates; `programs/` na raiz.**

**Layout** — `programs/eternal-word/` com `Anchor.toml` e `Cargo.toml`
(workspace Rust) na raiz, ao lado do workspace pnpm. É o layout já previsto em
`STACK.md` e o que o Anchor espera; `packages/blockchain` consome o IDL (PG-09).

**`Cargo.lock` é o pin que vale.** O `Cargo.toml` declara `anchor-lang = "1.0.0"`,
que em semântica de caret aceita 1.1.2 — e foi 1.1.2 que o build resolveu.
Pinar com `=` no `Cargo.toml` seria redundante e mais frágil que o lockfile, que
fixa a árvore inteira e não só o topo. O lockfile é versionado por isso.

**Sem `rust-toolchain.toml`.** O scaffold gera um pinando Rust 1.89.0, enquanto
a imagem traz 1.97.1. Dois pins discordantes forçariam o rustup a baixar uma
terceira toolchain a cada execução do container, e — pior — criariam duas
fontes de verdade sobre qual Rust compila o projeto. O container já é a
fronteira de reprodutibilidade; o arquivo foi descartado. (É o mesmo raciocínio
que removeu a estimativa duplicada de orçamento do `catalog` no PG-00.)

**Devnet apenas.** O `Anchor.toml` não tem `[programs.localnet]` nem
`cluster = "localnet"`, de propósito.

> **Correção (2026-07-19, mesma data):** a primeira versão desta ADR afirmava
> reprodutibilidade que o `Dockerfile.build` não entregava — o `avm` era
> instalado do branch default do Anchor, sem pin. Corrigido em
> `2026-07-19_endurecimento-de-seguranca-do-build-e-do-ci.md`.

---

## Consequências

**Positivas:**
- Bytecode reproduzível a partir do repositório, sem depender da máquina
- Toolchain declarada em arquivo, não no estado da máquina de quem compila
- `anchor build` verde já no PG-01, com IDL gerado — a toolchain está provada
  antes de existir lógica de domínio em cima

**Negativas / Trade-offs:**
- Imagem de 2,7 GB e primeiro build demorado
- Container roda como root; artefatos precisam de `chown` depois (embutido nos
  scripts `program:*`)
- O scaffold trouxe `litesvm` e crates `solana-*` como dev-dependencies do
  programa. Ficam por ora; **o PG-06 decide** se os testes são em Rust
  (litesvm) ou em TypeScript (anchor-bankrun, consumindo as proofs do
  `packages/catalog`) e remove o que sobrar

**Impacto no código:**
- `Anchor.toml`, `Cargo.toml`, `Cargo.lock`, `programs/eternal-word/`
- `.gitignore` — nota explícita sobre a keypair de upgrade
- `package.json` — scripts `docker:build`, `program:build|keys|deploy`

---

## Ponto de atenção: a keypair de upgrade

`target/deploy/eternal_word-keypair.json` **não é versionada** (`target/` está
no `.gitignore`) e existe apenas nesta VM. Quem tem esse arquivo pode
substituir o bytecode do programa — em devnet agora, e em mainnet depois da
S07. Perder o arquivo significa não conseguir mais atualizar o programa;
vazá-lo significa que outra pessoa consegue. Backup manual, fora do repositório.

Program ID: `9up3jAXPTgkJz9UvMLwEiUUSVdPd6E1KshwfxT3dZCdG` (devnet).

A decisão sobre **revogar ou manter** essa authority é o risco R2, e se
resolve na S06 (HD), antes do go-live.

---

## Revisão futura

Revisitar as versões se o Anchor 1.x trouxer correção de segurança relevante —
o que exigiria rebuild da imagem e novo hash de bytecode. Depois do deploy em
mainnet (S07), qualquer mudança de toolchain precisa ser tratada como evento,
não como manutenção de rotina.
