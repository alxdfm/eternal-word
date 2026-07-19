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
O que está funcionando:   documentação de fundação completa (docs/) +
                          CanonicalText em data/canonical-text/ (66 livros,
                          1.189 capítulos, 31.098 versículos registráveis
                          + 5 placeholders null — validado)
O que está em progresso:  nada — pronto para o scaffolding do código
O que está bloqueado:     nada
```

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

**Executar a Sprint S01** — plano em `sprints/2026-S01/tasks.md`:
monorepo pnpm + tooling (FD-01, FD-02), domínio com testes (FD-04..FD-06),
Catálogo com Merkle root reprodutível (CT-01..CT-07). CI (FD-03) já existe.
Depois S02 (programa Anchor) começando pelo spike bloqueador **PG-00**.

Sequência completa e riscos abertos: `sprints/ROADMAP.md`.

**Premissa de ambiente (2026-07-19):** infra externa (Supabase, AWS, RPC,
domínio) só será provisionada depois do desenvolvimento, antes do primeiro
smoke test. S03 e S04 devem rodar contra ambiente local — Postgres em
Docker, validador local ou devnet público — com portas/adapters isolando
serviço gerenciado.

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
