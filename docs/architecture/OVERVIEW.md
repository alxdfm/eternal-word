# Overview do Sistema

> Diagrama de alto nível e fluxo principal.
> Atualize quando a arquitetura mudar significativamente.

---

## O que este sistema faz

```
Plataforma sem fins lucrativos onde qualquer pessoa registra ("adota")
versículos da Bíblia permanentemente na blockchain Solana, pagando apenas
rent e taxas de rede. O objetivo é completar 100% da Bíblia de forma
distribuída, imutável e verificável — com progresso público e auditável.
```

---

## Fluxo principal

```
[Usuário com carteira Solana]
      │  busca versículo (livro / capítulo / versículo / texto)
      ▼
[apps/web — Next.js]
      │  consulta status no índice off-chain
      ▼
[apps/api — Lambda + Supabase]
      │  AVAILABLE → usuário assina a transação (client-side, wallet adapter)
      ▼
[Programa Anchor — register_verse]  ✅ deployado em devnet (S02)
      │  prova o texto contra o texto canônico (Merkle proof, verificada on-chain)
      │  cria VerseAccount na PDA ["verse", book, chapter, verse]
      ▼
[Indexer — webhook/logsSubscribe]
      │  detecta a nova VerseAccount (mesmo registros feitos fora do site)
      ▼
[Supabase — verses.status = REGISTERED]
      │
      ▼
[Dashboard / perfil / estatísticas atualizados]
```

---

## Módulos principais

| Módulo | Responsabilidade | Localização | Estado |
|--------|-----------------|-------------|--------|
| eternal-word (program) | Programa Anchor: `register_verse`, validação Merkle, contas | `programs/eternal-word/` | ✅ deployado em devnet (S02) — ver [`docs/modules/eternal-word-program.md`](../modules/eternal-word-program.md) |
| catalog | CanonicalText, integridade e Merkle tree | `packages/catalog/` | ✅ S01 |
| blockchain | PDAs, transações, proof client-side, cliente tipado do programa | `packages/blockchain/` | ✅ S02 |
| domain | Entidades (Verse, Book...) e regras de negócio | `packages/domain/` | ✅ S01 |
| shared | Tipos e utilitários comuns | `packages/shared/` | ✅ S01 |
| application | Sync core: ports (`EventSource`/`ChainReader`/`VerseRepository`) + casos de uso do indexer | `packages/application/` | ✅ S03 |
| infrastructure | Drizzle (schema/seed/repo) + adapters `logsSubscribe`/`getProgramAccounts` | `packages/infrastructure/` | ✅ S03 |
| api | Indexer nas 3 camadas (runner + CLI `pnpm indexer:dev`) | `apps/api/` | ✅ S03 (Lambdas na IX-05) |
| web | UI: busca, exploração, adoção, perfil, dashboard | `apps/web/` | placeholder — S04 |

---

## Integrações externas

| Serviço | Tipo | Para que serve |
|---------|------|----------------|
| Supabase | Postgres gerenciado | Espelho off-chain (dev usa Postgres local; provisionar na IX-05) |
| RPC Solana (devnet público; dedicado a definir) | RPC / WebSocket | Envio/confirmação de transações e `logsSubscribe` da camada 1 |
| Helius Webhooks | Webhook | Camada 1 em produção — adapter alternativo da port `EventSource` (IX-05) |

---

## Contextos de domínio (DDD)

- **Catálogo**: texto canônico da tradução escolhida, livros, capítulos e
  versificação. Fonte da Merkle tree usada na validação on-chain. Extensível
  off-chain a novas traduções e conteúdo editorial (anotações) ancorados no
  endereço universal `(book, chapter, verse)` — nada disso vai on-chain.
- **Registro**: adoção de versículos — construção da transação, PDA,
  confirmação, prevenção de duplicidade.
- **Sincronização**: indexer que reconcilia blockchain → banco off-chain,
  incluindo registros feitos fora do site.
- **Acompanhamento**: progresso global, estatísticas, perfil do adopter,
  dashboard (66 livros / 1.189 capítulos / total de versículos da tradução).
