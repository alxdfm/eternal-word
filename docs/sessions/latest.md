# Última Sessão — Contexto Persistido

> Fallback quando `session-delta` MCP não está disponível.
> Atualizado ao final de cada sessão com `session_end` ou manualmente.
> **Substitui** a necessidade de re-explicar o estado do projeto toda vez.

---

**Última atualização:** 2026-07-19 (S02 iniciada — PG-00 e PG-01 entregues)
**Sessão anterior durou:** N/A — sessão inicial

---

## S02 em andamento (branch `s02`)

**PG-00 fechado — e mudou a decisão.** Medido com transações reais
(`pnpm spike:pg00`), não somando bytes: a **árvore global não cabe**, 1.264 B
contra o limite de 1.232 já **sem** `ComputeBudget`. A estimativa da S01 errou
~38 B para menos (esqueceu os prefixos de 4 B do Borsh em `String`/`Vec` e
chutou o envelope em 240 B quando o real é 270). **Root por capítulo adotada**:
998 B em v0 com `ComputeBudget`, **234 B de folga**. Risco **R1 encerrado**.
Pior caso real confirmado por varredura dos 31.098: Ester 8:9 (o texto domina
a profundidade da proof). A estimativa duplicada foi **removida** do
`packages/catalog/src/cli/merkle.ts` — dimensionamento existe num lugar só.

**PG-01 fechado.** `programs/eternal-word/` scaffoldado, `anchor build` verde,
IDL gerado.

```
Program ID (devnet):  9up3jAXPTgkJz9UvMLwEiUUSVdPd6E1KshwfxT3dZCdG
Toolchain:            Agave 3.1.13 + Anchor CLI 1.0.0 (container)
anchor-lang:          1.1.2 — fixado pelo Cargo.lock versionado
```

⚠️ **`target/deploy/eternal_word-keypair.json` só existe nesta VM** e não é
versionada. É a keypair de upgrade do programa — backup manual pendente.

**Ambiente definido pelo Alexandre (2026-07-19):**
- Build em container (`Dockerfile.build`), por reprodutibilidade de bytecode
- **Sem localnet**: nada de `solana-test-validator`; validação em devnet
- **Node 24**, mesma major do runtime alvo das Lambdas (`nodejs24.x`)

**PG-02 fechado.** Config em PDA `["config"]` com o `roots_commitment` gravado
na criação e nunca reescrito; 66 contas `["roots", book]` (maior: Salmos,
4.800 B, sem realloc). `load_chapter_root` só aceita root que prove contra o
commitment — a authority escolhe *quando* carregar, nunca *o quê*, então não
há janela de confiança nem antes do `seal()`, que é irreversível. Sem `update`
nem `close` em lugar nenhum. **Risco R3 fechado por construção.**

⚠️ **Falha encontrada e corrigida durante o PG-02:** a folha do commitment era
a chapter root crua. Com pares ordenados e sem bits de direção, isso não
prendia a posição — dava para gravar uma root real no slot de outro capítulo e
torná-lo **permanentemente irregistrável**. Texto não podia ser forjado (o leaf
do versículo carrega o próprio endereço), mas era vandalismo irreversível. A
folha passou a codificar `book:u8 | chapter:u16le | root:32`. Mudou só o
`rootsCommitment` do `merkle-root.json`; a global root segue `112e5318…`.

**PG-06: framework decidido.** Rust + `litesvm`, com proofs vindas de
`data/test-fixtures.json` geradas pelo Catálogo. `anchor-bankrun` foi
descartado (parado desde out/2024) e o `litesvm` TS migrou para `@solana/kit`,
que conflita com o web3.js v1 do STACK. 5 testes Rust verdes; a suíte de
`register_verse` depende do PG-05.

```
commitment das roots:  d36e745881ff874a1e877f347d9b8ff3986a3749f08ee1ce1de301bc30e82efc
root global (S01):     112e5318594829adc058b35543812bf976ec999c4afdfec03a94e8ee5b3f7adb
```

**PG-03/04/05 fechados** — `VerseAccount` (texto on-chain, `space()` sem
número mágico), PDA `["verse", book, chapter, verse]` numérica (duplicidade
via `init`), `register_verse` espelhando a Merkle do Catálogo. Budget remedido
com 5 contas: 1.031 B / 201 B de folga.

**PG-06 fechado — o programa foi executado de verdade.** 20 testes Rust: 11 de
Merkle + 8 rodando o bytecode no `litesvm` + 1 unit. Os 8 de execução provam o
que só rodando o programa se prova: registro feliz grava os campos,
**duplicidade recusada pelo `init`** (conta fica com o primeiro adopter),
config forjada rejeitada (R3), texto adulterado recusado, gate de `sealed`
segura, fluxo de carga completo. Para chegar em `sealed` sem 1.255 transações,
os testes semeiam config+roots com `set_account`. CI ganhou job que compila o
`.so` com `cargo build-sbf` e roda tudo; sem `.so`, os de execução pulam limpo.

**PG-07 concluído (2026-07-21) — programa vivo em devnet:**

```
Program Id:        9up3jAXPTgkJz9UvMLwEiUUSVdPd6E1KshwfxT3dZCdG
ProgramData:       FkRZPX48U4pyYKz8zcos4fYHHQPG1rh5rGneTZpKzxrA
Upgrade authority: 83n4Vyyz3UyzchsSRRQVzhyu2ycDgTtCQZ53AAH7q8Ud (a carteira; R2/S06)
Deploy slot:       477844909
Bytecode sha256:   68b88a1ba359adbe22d06d165dbacdc50b43997d033f6be1ed473b49b61e7ac5
```

Auditoria de segurança fechada antes do deploy (3 lentes: 2 minhas + 1 agente
independente) — nada de confiança alta. Achado crítico (front-run de
`initialize_config`) corrigido antes: commitment no bytecode + bootstrap
permissionless (ADR `2026-07-21_...`).

Nota operacional do deploy: o RPC público de devnet estourou "max retries" no
1º `anchor deploy` (buffer parcial, 1.58 SOL presos — recuperados com
`solana program close`). Redeploy com `solana program deploy --max-sign-attempts
1000 --with-compute-unit-price 20000` funcionou. RPC dedicado fica para a S03.

**PG-08 concluído (2026-07-21) — canon carregado, selado e smoke test verde.**

Bootstrap (`pnpm bootstrap:devnet`): config + 1.189 loads (2/tx) + 66 completes
+ seal, tudo permissionless, ~0,34 SOL (rent dos 66 `book_roots`). O retry loop
segurou o RPC público congestionado sem intervenção. Smoke test
(`pnpm smoke:devnet`) — **números medidos em devnet:**

| | Gênesis 1:1 | Ester 8:9 (mais longo) |
|---|---|---|
| texto | 56 B | 493 B |
| transação (v0 + ComputeBudget) | 594 B | **1031 B** de 1232 |
| compute units | 22.459 | 15.616 |
| conta / rent | 114 B → 0,001684 SOL | 551 B → 0,004726 SOL |

- Ester 8:9 = **1031 B**, idêntico à previsão do spike PG-00 (201 B de folga) —
  a análise off-chain confirmada na chain.
- Duplicidade de Gênesis 1:1 **recusada** pelo `init` (conta já existe).
- CU real ~15-22k, muito abaixo do default de 200k; o limite de 400k do cliente
  tem folga enorme.

Assinaturas (devnet): Gn 1:1 `5L97vDDf…AVzMv5x`, Et 8:9 `2GGAjM9Q…DisDbVxJ`.

**PG-10:** estimativas substituídas pelos números acima. Rent worst-case medido
(0,0047 SOL) bate com a estimativa da ADR. **S02 completa** — resta só o merge
para `main` (branch nunca pushada).

---

## O que foi feito na última sessão

Spec inicial do Eternal Word revisada e o project-skeleton aplicado com todos
os placeholders preenchidos: CLAUDE.md, README, STACK, OVERVIEW, linguagem
ubíqua, code style e 4 ADRs (1 aceita, 3 propostas). Nenhum código criado
ainda — o monorepo `apps/` + `packages/` + `programs/` é o próximo passo.

---

## Estado atual do projeto

```
O que está funcionando:   S01 entregue — monorepo pnpm + Biome + Vitest + CI;
                          packages/{domain,catalog,shared} implementados;
                          Merkle root reprodutível commitada; 40 testes verdes
O que está em progresso:  nada — pronto para a S02 (programa Anchor)
O que está bloqueado:     nada
```

## Merkle root do CanonicalText (S01)

```
root global:      112e5318594829adc058b35543812bf976ec999c4afdfec03a94e8ee5b3f7adb
algoritmo:        sha256, prefixo 0x00 folha / 0x01 nó, pares ordenados,
                  nó ímpar promovido (nunca duplicado)
folha:            book:u8 | chapter:u16le | verse:u16le | textLen:u32le | text:utf8
artefato:         data/merkle-root.json (inclui as 1.189 roots por capítulo)
```

**Spike PG-00 praticamente resolvido pelos números medidos:**

```
árvore global:      15 níveis → proof 480 B → transação ~1.226 / 1.232 B
árvore por capítulo: 8 níveis → proof 256 B → transação ~1.002 / 1.232 B
```

A forma por capítulo é a que cabe com margem — falta só confirmar em
transação real na S02 e registrar a ADR.

---

## Decisões tomadas nesta sessão

- Produto completo, não MVP, sem fins lucrativos → ADR aceita
- Conta por versículo (não por capítulo) → ADR aceita por Alexandre
- Validação Merkle do texto canônico → ADR aceita por Alexandre
- CanonicalText: arquivos versionados em `data/canonical-text/` (1 JSON por
  livro) como source of truth + seed no banco → ADR aceita (aplicada)
- "Dar créditos" NÃO viabiliza tradução protegida (atribuição ≠ licença) —
  registrado na ADR da tradução
- Texto on-chain em INGLÊS (Alexandre: língua universal); edição final:
  WEB — World English Bible (Alexandre trocou a KJV por inglês moderno);
  cadeia de ADRs: Bíblia Livre → KJV → WEB (as duas primeiras substituídas)
- UI English-first com i18n desde o início (Alexandre); toda string via
  chaves de mensagem, pt-BR como primeira locale adicional → ADR aceita
- Sem limite de registro por carteira (Alexandre, 2026-07-19) — risco R6
  encerrado; `register_verse` não ganha cota nem verificação de identidade
- Config do programa **precisa** ser PDA de seeds fixas: conta de config
  forjada é o único caminho conhecido para burlar a validação Merkle (PG-02)
- Modelo de dados off-chain: Registro separado do Catálogo (translations,
  books, verse_texts, verses); tradução mora no Catálogo com is_canonical,
  não na linha do registro → ADR aceita
- Sincronização do indexer em 3 camadas (webhook/evento + PENDING otimista
  + reconciliação periódica via getProgramAccounts) → ADR aceita
- Extensibilidade sem construir agora (Alexandre): novas traduções e
  anotações editoriais (contexto histórico, termos) ficam possíveis via
  endereço universal (book, chapter, verse), sempre off-chain → ADR aceita
- Verbo canônico do código é `register`; "adotar" só em UI/marketing
- Campo `owner` banido em favor de `adopter` (colisão com Solana)
- Seeds de PDA usam índices numéricos (1-66), nunca strings de nomes de livros

---

## Próximos passos (para retomar)

**S01 concluída** (só FD-10, infra externa, segue aberta por decisão).
**Executar a Sprint S02** — `sprints/2026-S02/tasks.md`: começar pelo spike
**PG-00** (confirmar em transação real a forma da árvore), depois
`anchor init`, conta de config com as roots por capítulo, `register_verse`
com verificação de proof, testes dos caminhos de falha e deploy em devnet.

Sequência completa e riscos abertos: `sprints/ROADMAP.md`.

**Premissa de ambiente (2026-07-19):** desenvolvimento sempre contra
ambiente local (Postgres em Docker, validador local ou devnet público), com
portas/adapters isolando serviço gerenciado. Infra externa (Supabase, AWS,
RPC/webhook) provisionada **ao final da S03** — o smoke test da S02 é
on-chain em devnet e não depende dela. Três smoke tests: S02 (on-chain),
S03 (indexer) e S04 (jornada completa) — tabela no `sprints/ROADMAP.md`.

---

## Contexto técnico importante

- Estimativas de custo (base das ADRs): rent ≈ 6.960 lamports/byte;
  VerseAccount ≈ 325 bytes ≈ 0,0023 SOL; total do projeto ≈ 70 SOL
- Texto canônico: WEB (World English Bible), edição protestante, snapshot
  engwebp do eBible.org, domínio público — 31.098 versículos registráveis;
  5 posições null (Lc 17:36, At 8:37, At 15:34, At 24:7, Rm 16:25) NÃO são
  registráveis; snapshot CONGELADO (nunca atualizar após a Merkle root ir
  on-chain); proveniência em data/canonical-text/PROVENANCE.md
- Decisões anteriores (Bíblia Livre PT, depois KJV) substituídas — ADRs
  antigas registram a cadeia; PT poderá voltar como exibição off-chain
- `project-skeleton.zip` na raiz é o template original — pode ser removido
- Alexandre trabalha numa VM Linux via VS Code remote; arquivos "em Downloads"
  podem estar na máquina host, não na VM

---

- **Orçamento de transação sem margem (risco R1)**: pior caso medido no
  dataset real — Ester 8:9 (493 bytes) + proof de 15 níveis (480) ≈ 1.224
  dos 1.232 bytes; um `ComputeBudget` estoura. Mitigação analisada: root por
  capítulo (proof cai para 256 bytes). Decide no spike PG-00 da S02.
- Versículo médio = 129 bytes → conta ≈ 186 bytes ≈ 0,0022 SOL de rent;
  pior caso ≈ 0,0047 SOL. Total do projeto ≈ 68 SOL, distribuído.
- `scripts/onboarding.sh` está neutralizado por guard — reexecutar
  corromperia os docs já preenchidos (só roda com `FORCE_ONBOARDING=1`)

---

## Guardrails descobertos nesta sessão

- Não registrar texto de tradução sem confirmar domínio público — infração
  on-chain é permanente e irremovível
- Não criar instruções `update`/`close` no programa — a imutabilidade vem de
  não existir caminho de escrita
