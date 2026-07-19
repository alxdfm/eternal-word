# Última Sessão — Contexto Persistido

> Fallback quando `session-delta` MCP não está disponível.
> Atualizado ao final de cada sessão com `session_end` ou manualmente.
> **Substitui** a necessidade de re-explicar o estado do projeto toda vez.

---

**Última atualização:** 2026-07-19 (fundação + sprints + pipeline)
**Sessão anterior durou:** N/A — sessão inicial

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
- Alexandre trabalha numa VM (`callydus-vm`) via VS Code remote; arquivos
  "em Downloads" podem estar na máquina host, não na VM

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
